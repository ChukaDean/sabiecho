import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { AutoModelForCausalLM, AutoTokenizer, pipeline } from '@huggingface/transformers';
import { buildIndex, classify, type Embed } from '../src/lib/classifier';
import { EMBEDDING_MODEL } from '../src/lib/models';
import { MEANINGS } from '../src/lib/taxonomy';
import { dequantize, trainHead, type BaseTrainingSet } from '../src/lib/train';
import { classifyTrained, type HeadWeights } from '../src/lib/trained-classifier';

type Case = { text: string; labels: number[] };
type Classifier = (text: string) => Promise<number[]>;

const cases = JSON.parse(readFileSync(new URL('../data/test.json', import.meta.url), 'utf8')) as Case[];
const RESULTS = new URL('../data/benchmark-results.json', import.meta.url);
const method = process.argv[2] ?? 'similarity';

async function embedder(): Promise<Embed> {
  const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL.id, { dtype: EMBEDDING_MODEL.dtype });
  return async (texts) => (await extractor(texts, { pooling: 'mean', normalize: true })).tolist() as number[][];
}

const SYSTEM_PROMPT = `You label tourist feedback for a small tourism business in Benin. Feedback may be in English or French.
Pick every message from this list that the feedback clearly expresses:
${MEANINGS.filter((m) => m.id !== 27).map((m) => `${m.id}. ${m.en}`).join('\n')}
27. None of the above / not feedback about the visit.

Rules:
- Use only numbers from the list.
- Pick at most one of 1, 2, 3, and only when the visitor gives an overall verdict on the visit.
- Never pick both messages of an opposite pair (4/5, 6/7, 8/9, 10/11, 12/13, 14/15, 16/17, 18/19, 20/21, 22/23, 24/25).
- If nothing applies, answer 27.
Answer with the numbers only, separated by commas.`;

const FEW_SHOT: [string, string][] = [
  ['We had a great time. The host explained everything clearly, the food was excellent, but the farm was hard to find.', '1, 4, 14, 25'],
  ["C'était correct, mais on a attendu longtemps et c'était un peu cher.", '2, 21, 23'],
  ['Is the museum open on Monday?', '27'],
];

async function llm(modelId: string, dtype: string): Promise<Classifier> {
  const tokenizer = await AutoTokenizer.from_pretrained(modelId);
  const model = await AutoModelForCausalLM.from_pretrained(modelId, { dtype: dtype as 'q8' });
  return async (text) => {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...FEW_SHOT.flatMap(([u, a]) => [
        { role: 'user', content: u },
        { role: 'assistant', content: a },
      ]),
      { role: 'user', content: text },
    ];
    const inputs = tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      return_dict: true,
      enable_thinking: false,
    } as Parameters<typeof tokenizer.apply_chat_template>[1]) as { input_ids: { dims: number[] } };
    const output = (await model.generate({ ...inputs, max_new_tokens: 24, do_sample: false })) as {
      slice: (...args: unknown[]) => unknown;
    };
    const promptLength = inputs.input_ids.dims.at(-1)!;
    const generated = output.slice(null, [promptLength, null]);
    const answer = tokenizer.batch_decode(generated as never, { skip_special_tokens: true })[0];
    const ids = [...new Set((answer.replace(/<think>[\s\S]*?<\/think>/g, '').match(/\d+/g) ?? []).map(Number))].filter(
      (n) => n >= 1 && n <= 27,
    );
    const withoutFallback = ids.filter((n) => n !== 27);
    return withoutFallback.length ? withoutFallback : [27];
  };
}

async function load(): Promise<{ classify: Classifier; download: string }> {
  if (method === 'similarity') {
    const embed = await embedder();
    const index = await buildIndex(embed);
    return { classify: async (t) => (await classify(index, embed, t)).selected, download: '118 MB (shared)' };
  }
  if (method === 'trained') {
    const embed = await embedder();
    const head = JSON.parse(readFileSync(new URL('../src/lib/classifier-weights.json', import.meta.url), 'utf8')) as HeadWeights;
    return { classify: async (t) => (await classifyTrained(head, embed, t)).selected, download: '118 MB (shared) + 0.09 MB' };
  }
  if (method === 'on-device') {
    // Same path as an in-app retrain with no operator examples: shipped int8 base set, 300 epochs.
    const embed = await embedder();
    const dir = new URL('../public/training/', import.meta.url);
    const meta = JSON.parse(readFileSync(new URL('base.json', dir), 'utf8')) as BaseTrainingSet;
    const X = dequantize(new Int8Array(readFileSync(new URL('base.bin', dir))), meta);
    const head = trainHead(X, meta.labels, { epochs: 300 });
    return { classify: async (t) => (await classifyTrained(head, embed, t)).selected, download: '118 MB (shared) + 0.3 MB' };
  }
  const [modelId, dtype = 'q8'] = method.split('@');
  const sizes: Record<string, string> = {
    'onnx-community/Qwen3-0.6B-ONNX': '570 MB (q4f16, browser)',
    'onnx-community/Qwen2.5-1.5B-Instruct': '1.2 GB (q4f16, browser)',
    'onnx-community/Qwen3-1.7B-ONNX': '1.4 GB (q4f16, browser)',
  };
  return { classify: await llm(modelId, dtype), download: sizes[modelId] ?? '?' };
}

const { classify: run, download } = await load();
await run('warm up');

let exact = 0;
let tp = 0;
let fp = 0;
let fn = 0;
let feelingOk = 0;
let ms = 0;
const misses: string[] = [];
for (const c of cases) {
  const t = performance.now();
  const got = await run(c.text);
  ms += performance.now() - t;
  const g = new Set(got);
  const w = new Set(c.labels);
  const ok = g.size === w.size && [...g].every((x) => w.has(x));
  if (ok) exact++;
  else misses.push(`want=[${c.labels}] got=[${got}]  ${c.text}`);
  for (const x of g) (w.has(x) ? tp++ : fp++);
  for (const x of w) if (!g.has(x)) fn++;
  const feel = (s: Set<number>) => [...s].filter((x) => x <= 3).join();
  if (feel(g) === feel(w)) feelingOk++;
}
const precision = tp / (tp + fp);
const recall = tp / (tp + fn);
const result = {
  method,
  exact: `${exact}/${cases.length}`,
  precision: +precision.toFixed(2),
  recall: +recall.toFixed(2),
  f1: +((2 * precision * recall) / (precision + recall)).toFixed(2),
  overallFeelingAccuracy: `${feelingOk}/${cases.length}`,
  msPerReviewOnThisMac: Math.round(ms / cases.length),
  download,
};
console.log(misses.join('\n'));
console.log(JSON.stringify(result, null, 2));

const all = existsSync(RESULTS) ? (JSON.parse(readFileSync(RESULTS, 'utf8')) as (typeof result)[]) : [];
writeFileSync(RESULTS, JSON.stringify([...all.filter((r) => r.method !== method), result], null, 2));
