import { reviewClauses, type Classification, type Embed, type MeaningScore } from './classifier';
import { FALLBACK_ID, type MeaningId } from './taxonomy';

/** Softmax layer over sentence embeddings. Class 0 means "no supported meaning". */
export interface HeadWeights {
  classes: number[];
  W: number[][];
  b: number[];
}

export interface TrainedOptions {
  topicThreshold: number;
  overallThreshold: number;
}

export const DEFAULT_TRAINED_OPTIONS: TrainedOptions = {
  topicThreshold: 0.5,
  overallThreshold: 0.5,
};

const OVERALL = new Set<number>([1, 2, 3]);
const OPPOSITE = new Map<number, number>();
for (const [a, b] of [
  [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15],
  [16, 17], [18, 19], [20, 21], [22, 23], [24, 25],
]) {
  OPPOSITE.set(a, b);
  OPPOSITE.set(b, a);
}

export function predict(head: HeadWeights, x: number[]): number[] {
  const logits = head.W.map((w, c) => {
    let s = head.b[c];
    for (let i = 0; i < x.length; i++) s += w[i] * x[i];
    return s;
  });
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export async function classifyTrained(
  head: HeadWeights,
  embed: Embed,
  text: string,
  options: TrainedOptions = DEFAULT_TRAINED_OPTIONS,
): Promise<Classification> {
  const trimmed = text.trim();
  const clauses = reviewClauses(trimmed);
  if (clauses.length === 0) {
    return { selected: [FALLBACK_ID], scores: [], clauses, uncertain: true };
  }
  const units = clauses.length > 1 ? [...clauses, trimmed] : clauses;
  const probs = (await embed(units)).map((v) => predict(head, v));

  const best = new Map<number, MeaningScore>();
  probs.forEach((p, u) => {
    head.classes.forEach((cls, k) => {
      if (cls === 0) return;
      if (p[k] > (best.get(cls)?.score ?? -1)) best.set(cls, { id: cls as MeaningId, score: p[k], evidence: units[u] });
    });
  });

  const topics = new Map<number, number>();
  const feelings = new Map<number, number>();
  probs.forEach((p, u) => {
    const isWhole = u === clauses.length;
    const ranked = head.classes.map((cls, k) => ({ cls, p: p[k] })).sort((a, b) => b.p - a.p);
    for (const { cls, p: pk } of ranked.slice(0, 2)) {
      if (cls === 0) continue;
      if (OVERALL.has(cls)) {
        if (pk >= options.overallThreshold) feelings.set(cls, Math.max(feelings.get(cls) ?? 0, pk));
      } else if (!isWhole && pk >= options.topicThreshold) {
        topics.set(cls, Math.max(topics.get(cls) ?? 0, pk));
      }
    }
  });
  for (const [cls, p] of topics) {
    const opp = OPPOSITE.get(cls);
    if (opp && (topics.get(opp) ?? -1) > p) topics.delete(cls);
  }

  let feeling: number | null = null;
  if (feelings.has(1) && feelings.has(3)) feeling = 2;
  else if (feelings.size) feeling = [...feelings].sort((a, b) => b[1] - a[1])[0][0];

  const selected = [...(feeling ? [feeling] : []), ...[...topics.keys()].sort((a, b) => a - b)] as MeaningId[];
  const clauseGuesses = clauses.map((text, u) => {
    let k = 0;
    probs[u].forEach((p, j) => p > probs[u][k] && (k = j));
    return { text, label: head.classes[k], score: probs[u][k] };
  });

  const uncertain = selected.length === 0;
  return {
    selected: uncertain ? [FALLBACK_ID] : selected,
    scores: [...best.values()].sort((a, b) => b.score - a.score),
    clauses,
    uncertain,
    clauseGuesses,
  };
}
