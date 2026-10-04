/// <reference lib="webworker" />
import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type FeatureExtractionPipeline,
  type ProgressInfo,
} from '@huggingface/transformers';
import type { Embed } from './lib/classifier';
import headWeights from './lib/classifier-weights.json';
import { ASR_MODEL, EMBEDDING_MODEL } from './lib/models';
import { dequantize, trainHead, type BaseTrainingSet } from './lib/train';
import { classifyTrained, type HeadWeights } from './lib/trained-classifier';
import { detectEnglishOrFrench } from './lib/whisper-language';
import type { ModelKey, WorkerRequest, WorkerResponse } from './lib/worker-protocol';

env.allowLocalModels = false;

const wasm = env.backends.onnx.wasm;
if (wasm) {
  const variant = JSON.stringify(wasm.wasmPaths ?? '').includes('asyncify') ? '.asyncify' : '';
  const base = new URL(`${import.meta.env.BASE_URL}ort/`, self.location.origin).href;
  wasm.wasmPaths = {
    mjs: `${base}ort-wasm-simd-threaded${variant}.mjs`,
    wasm: `${base}ort-wasm-simd-threaded${variant}.wasm`,
  };
}

const post = (msg: WorkerResponse) => self.postMessage(msg);

function progressReporter(model: ModelKey) {
  return (p: ProgressInfo) => {
    if (p.status === 'progress_total') {
      post({ type: 'progress', model, loaded: p.loaded, total: p.total });
    }
  };
}

const BUILT_IN_HEAD = headWeights as HeadWeights;
let head = BUILT_IN_HEAD;
/** Operator examples are real-world data, so they count more than the built-in synthetic ones. */
const OPERATOR_EXAMPLE_WEIGHT = 3;

let basePromise: Promise<{ X: Float32Array[]; labels: number[] }> | null = null;
function loadBaseTrainingSet() {
  basePromise ??= (async () => {
    const root = `${import.meta.env.BASE_URL}training/`;
    const [meta, bin] = await Promise.all([
      fetch(`${root}base.json`).then((r) => r.json() as Promise<BaseTrainingSet>),
      fetch(`${root}base.bin`).then((r) => r.arrayBuffer()),
    ]);
    return { X: dequantize(new Int8Array(bin), meta), labels: meta.labels };
  })().catch((e) => {
    basePromise = null;
    throw e;
  });
  return basePromise;
}

let embedderPromise: Promise<Embed> | null = null;
function loadEmbedder() {
  embedderPromise ??= (async () => {
    const extractor = (await pipeline('feature-extraction', EMBEDDING_MODEL.id, {
      dtype: EMBEDDING_MODEL.dtype,
      progress_callback: progressReporter('embedder'),
    })) as FeatureExtractionPipeline;
    const embed: Embed = async (texts) =>
      (await extractor(texts, { pooling: 'mean', normalize: true })).tolist() as number[][];
    return embed;
  })().catch((e) => {
    embedderPromise = null;
    throw e;
  });
  return embedderPromise;
}

let asrPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
function loadAsr() {
  asrPromise ??= (
    pipeline('automatic-speech-recognition', ASR_MODEL.id, {
      dtype: ASR_MODEL.dtype,
      progress_callback: progressReporter('asr'),
    }) as Promise<AutomaticSpeechRecognitionPipeline>
  ).catch((e) => {
    asrPromise = null;
    throw e;
  });
  return asrPromise;
}

const WHISPER_LANGUAGE = { en: 'english', fr: 'french' } as const;
const SAMPLE_RATE = 16000;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    switch (req.type) {
      case 'load': {
        await (req.model === 'embedder' ? loadEmbedder() : loadAsr());
        post({ type: 'ready', model: req.model });
        post({ type: 'result', id: req.id, data: null });
        break;
      }
      case 'classify': {
        const embed = await loadEmbedder();
        post({ type: 'ready', model: 'embedder' });
        post({ type: 'result', id: req.id, data: await classifyTrained(head, embed, req.text) });
        break;
      }
      case 'transcribe': {
        const asr = await loadAsr();
        post({ type: 'ready', model: 'asr' });
        const language =
          req.language === 'auto' ? await detectEnglishOrFrench(asr, req.audio, SAMPLE_RATE) : req.language;
        const out = await asr(req.audio, {
          task: 'transcribe',
          language: WHISPER_LANGUAGE[language],
          chunk_length_s: 30,
          stride_length_s: 5,
        });
        const text = (Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text).trim();
        post({ type: 'result', id: req.id, data: { text, language } });
        break;
      }
      case 'set-head': {
        head = req.head ?? BUILT_IN_HEAD;
        post({ type: 'result', id: req.id, data: null });
        break;
      }
      case 'train': {
        const [embed, base] = await Promise.all([loadEmbedder(), loadBaseTrainingSet()]);
        post({ type: 'ready', model: 'embedder' });
        const texts = req.examples.map((e) => e.text);
        const extra: number[][] = [];
        for (let i = 0; i < texts.length; i += 16) {
          post({ type: 'train-progress', id: req.id, stage: 'embedding', done: i, total: texts.length });
          extra.push(...(await embed(texts.slice(i, i + 16))));
        }
        const X = [...base.X, ...extra];
        const labels = [...base.labels, ...req.examples.map((e) => e.label)];
        const sampleWeights = labels.map((_, n) => (n < base.X.length ? 1 : OPERATOR_EXAMPLE_WEIGHT));
        const trained = trainHead(X, labels, {
          epochs: 300,
          sampleWeights,
          onProgress: (done, total) => post({ type: 'train-progress', id: req.id, stage: 'training', done, total }),
        });
        head = trained;
        post({ type: 'result', id: req.id, data: { head: trained, exampleCount: req.examples.length } });
        break;
      }
    }
  } catch (e) {
    post({ type: 'error', id: req.id, error: e instanceof Error ? e.message : String(e) });
  }
};
