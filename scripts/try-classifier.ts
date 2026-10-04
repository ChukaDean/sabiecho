import { readFileSync } from 'node:fs';
import { pipeline } from '@huggingface/transformers';
import { splitClauses } from '../src/lib/classifier';
import { EMBEDDING_MODEL } from '../src/lib/models';
import { getMeaning, type MeaningId } from '../src/lib/taxonomy';
import { classifyTrained, predict, type HeadWeights } from '../src/lib/trained-classifier';
const head = JSON.parse(readFileSync(new URL('../src/lib/classifier-weights.json', import.meta.url), 'utf8')) as HeadWeights;
const ex = await pipeline('feature-extraction', EMBEDDING_MODEL.id, { dtype: EMBEDDING_MODEL.dtype });
const embed = async (t: string[]) => (await ex(t, { pooling: 'mean', normalize: true })).tolist() as number[][];
const label = (c: number) => (c === 0 ? 'none' : `${c} ${getMeaning(c as MeaningId).en}`);
for (const text of process.argv.slice(2)) {
  const r = await classifyTrained(head, embed, text);
  console.log(`\nREVIEW: ${text}\nRESULT: ${r.selected.map(label).join(' | ')}`);
  const clauses = splitClauses(text);
  const units = clauses.length > 1 ? [...clauses, text] : clauses;
  const vecs = await embed(units);
  units.forEach((u, i) => {
    const p = predict(head, vecs[i]);
    const top = head.classes.map((c, k) => ({ c, p: p[k] })).sort((a, b) => b.p - a.p).slice(0, 3);
    console.log(`  "${u}"\n     ${top.map((t) => `${label(t.c)} ${(t.p * 100).toFixed(0)}%`).join('  ·  ')}`);
  });
}
