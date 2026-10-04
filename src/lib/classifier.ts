import { FALLBACK_ID, MEANINGS, type MeaningGroup, type MeaningId } from './taxonomy';

/** Returns one L2-normalised vector per input text. */
export type Embed = (texts: string[]) => Promise<number[][]>;

export interface ClassifierIndex {
  anchors: { id: MeaningId; group: MeaningGroup; vectors: number[][] }[];
}

export interface MeaningScore {
  id: MeaningId;
  score: number;
  /** The part of the review that matched best. */
  evidence: string;
}

export interface Classification {
  selected: MeaningId[];
  scores: MeaningScore[];
  clauses: string[];
  uncertain: boolean;
  /** Best guess per clause (0 = no supported meaning), used to pre-fill corrections. */
  clauseGuesses?: { text: string; label: number; score: number }[];
}

export interface ClassifierOptions {
  /** Minimum similarity for a clause's best topic meaning (4–26) to be selected. */
  topicThreshold: number;
  /** Minimum similarity for an overall-feeling meaning (1–3). */
  overallThreshold: number;
}

export const DEFAULT_OPTIONS: ClassifierOptions = {
  topicThreshold: 0.55,
  overallThreshold: 0.65,
};

const OVERALL: MeaningId[] = [1, 2, 3];

const OPPOSITE = new Map<MeaningId, MeaningId>();
for (const [a, b] of [
  [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15],
  [16, 17], [18, 19], [20, 21], [22, 23], [24, 25],
] as [MeaningId, MeaningId][]) {
  OPPOSITE.set(a, b);
  OPPOSITE.set(b, a);
}

export async function buildIndex(embed: Embed): Promise<ClassifierIndex> {
  const anchors: ClassifierIndex['anchors'] = [];
  for (const m of MEANINGS) {
    if (m.examples.length === 0) continue;
    anchors.push({ id: m.id, group: m.group, vectors: await embed(m.examples) });
  }
  return { anchors };
}

const CONTRAST = 'but|mais|however|cependant|though|although|bien que|sauf que|except that';
const ADDITIVE = 'and|et|also|aussi|plus';
const LEADING_CONNECTOR = new RegExp(`^(?:${CONTRAST}|${ADDITIVE})\\s+`, 'i');

/** Parts of a review that get a meaning each; a one-word review is a single part. */
export function reviewClauses(text: string): string[] {
  const clauses = splitClauses(text);
  return clauses.length || !text.trim() ? clauses : [text.trim()];
}

export function splitClauses(text: string): string[] {
  const clauses: string[] = [];
  for (const segment of text.split(/[.!?;:\n]+|,/)) {
    for (const part of segment.split(new RegExp(`\\s+(?=(?:${CONTRAST})\\s)`, 'i'))) {
      let previous: string[] = [];
      for (const piece of part.trim().replace(LEADING_CONNECTOR, '').split(new RegExp(`\\s+(?:${ADDITIVE})\\s+`, 'i'))) {
        const words = piece.trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) continue;
        // "not welcomed and safe": a short tail inherits the start of the clause it was joined to.
        if (words.length <= 2 && previous.length > words.length) {
          clauses.push([...previous.slice(0, previous.length - words.length), ...words].join(' '));
        } else if (words.length >= 2) {
          clauses.push(words.join(' '));
          previous = words;
        }
      }
    }
  }
  return clauses;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export async function classify(
  index: ClassifierIndex,
  embed: Embed,
  text: string,
  options: ClassifierOptions = DEFAULT_OPTIONS,
): Promise<Classification> {
  const trimmed = text.trim();
  const clauses = splitClauses(trimmed);
  if (!trimmed || clauses.length === 0) {
    return { selected: [FALLBACK_ID], scores: [], clauses, uncertain: true };
  }

  const units = clauses.length > 1 ? [...clauses, trimmed] : clauses;
  const vectors = await embed(units);

  // sim[u][k] = best similarity of unit u to any example of anchor k.
  const sim = vectors.map((v) => index.anchors.map(({ vectors: av }) => Math.max(...av.map((a) => dot(v, a)))));

  const scores: MeaningScore[] = index.anchors.map(({ id }, k) => {
    let best = -1;
    let evidence = '';
    sim.forEach((row, u) => {
      if (row[k] > best) {
        best = row[k];
        evidence = units[u];
      }
    });
    return { id, score: best, evidence };
  });

  // Topics: each clause contributes only its single best-matching meaning.
  const topicHits = new Map<MeaningId, number>();
  const overallClause: { id: MeaningId; s: number }[] = [];
  clauses.forEach((_, u) => {
    let bestK = 0;
    sim[u].forEach((s, k) => {
      if (s > sim[u][bestK]) bestK = k;
    });
    const id = index.anchors[bestK].id;
    const s = sim[u][bestK];
    if (OVERALL.includes(id)) {
      if (s >= options.overallThreshold) overallClause.push({ id, s });
    } else if (s >= options.topicThreshold && s > (topicHits.get(id) ?? -1)) {
      topicHits.set(id, s);
    }
  });
  for (const [id, s] of topicHits) {
    const opp = OPPOSITE.get(id);
    if (opp && (topicHits.get(opp) ?? -1) > s) topicHits.delete(id);
  }

  // Overall feeling: only when the review expresses one explicitly.
  const wholeRow = sim[units.length - 1];
  const wholeBest = OVERALL.map((id) => ({
    id,
    s: wholeRow[index.anchors.findIndex((a) => a.id === id)],
  })).sort((a, b) => b.s - a.s)[0];
  let feeling: MeaningId | null = null;
  const said = new Set(overallClause.map((o) => o.id));
  if (said.has(1) && said.has(3)) feeling = 2;
  else if (overallClause.length) feeling = overallClause.sort((a, b) => b.s - a.s)[0].id;
  else if (wholeBest.s >= options.overallThreshold) feeling = wholeBest.id;

  const selected: MeaningId[] = [];
  if (feeling !== null) selected.push(feeling);
  selected.push(...[...topicHits.keys()].sort((a, b) => a - b));

  const uncertain = selected.length === 0;
  return {
    selected: uncertain ? [FALLBACK_ID] : selected,
    scores: scores.sort((a, b) => b.score - a.score),
    clauses,
    uncertain,
  };
}
