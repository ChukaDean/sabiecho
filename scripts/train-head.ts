import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pipeline } from '@huggingface/transformers';
import { EMBEDDING_MODEL } from '../src/lib/models';
import { MEANINGS } from '../src/lib/taxonomy';
import { quantize, trainHead, type BaseTrainingSet } from '../src/lib/train';

const train = JSON.parse(readFileSync(new URL('../data/train.json', import.meta.url), 'utf8')) as Record<string, string[]>;

const examples: { text: string; cls: number }[] = [];
for (const [cls, texts] of Object.entries(train)) for (const text of texts) examples.push({ text, cls: Number(cls) });
for (const m of MEANINGS) for (const text of m.examples) examples.push({ text, cls: m.id });
console.log(`${examples.length} examples`);

const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL.id, { dtype: EMBEDDING_MODEL.dtype });
const X = (await extractor(examples.map((e) => e.text), { pooling: 'mean', normalize: true })).tolist() as number[][];
const labels = examples.map((e) => e.cls);

const head = trainHead(X, labels, {
  epochs: 400,
  onProgress: (epoch) => epoch % 100 === 0 && console.log(`epoch ${epoch}`),
});
writeFileSync(new URL('../src/lib/classifier-weights.json', import.meta.url), JSON.stringify(head));

// Shipped so the app can retrain on-device with operator examples added to this base set.
const dir = new URL('../public/training/', import.meta.url);
mkdirSync(dir, { recursive: true });
const { data, scales } = quantize(X);
writeFileSync(new URL('base.bin', dir), data);
writeFileSync(
  new URL('base.json', dir),
  JSON.stringify({ dims: X[0].length, labels, scales: scales.map((s) => Number(s.toPrecision(6))) } satisfies BaseTrainingSet),
);
console.log('saved src/lib/classifier-weights.json and public/training/base.{bin,json}');
