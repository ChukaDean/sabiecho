import assert from 'node:assert/strict';
import { ADVICE } from '../src/lib/advice';
import type { Review } from '../src/lib/db';
import { computeInsights, reviewMood, TOPICS } from '../src/lib/insights';
import type { MeaningId } from '../src/lib/taxonomy';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 4, 12);
let n = 0;
const review = (selected: MeaningId[], daysAgo = 1, text = 'x'): Review => ({
  id: String(n++),
  createdAt: now - daysAgo * DAY,
  source: 'text',
  text,
  selected,
  uncertain: selected.includes(27),
  topScores: [],
});

// Every problem, plus unexplained unhappiness and spreading the word, has advice in both languages.
for (const id of [...TOPICS.map((tp) => tp.bad), 3, 26] as MeaningId[]) {
  assert.ok(ADVICE[id]?.en.tips.length && ADVICE[id]?.fr.tips.length, `advice for ${id}`);
}

assert.equal(reviewMood(review([1, 5])), 'happy');
assert.equal(reviewMood(review([4, 23])), 'mixed');
assert.equal(reviewMood(review([25])), 'unhappy');
assert.equal(reviewMood(review([27])), 'unknown');

// A single complaint is only watched; two out of a few reviews become a recommendation.
const problems = (i: ReturnType<typeof computeInsights>) => i.recommendations.filter((r) => r.kind === 'problem');
let ins = computeInsights([review([1, 4]), review([3, 23]), review([1, 12])], 30, now);
assert.deepEqual(problems(ins), []);
assert.deepEqual(ins.watch, [23]);

ins = computeInsights([review([1, 4]), review([3, 23]), review([2, 23]), review([1, 12])], 30, now);
assert.deepEqual(problems(ins).map((r) => r.id), [23]);
assert.deepEqual(ins.recommendations.map((r) => r.id), [23]);
assert.equal(ins.early, true);
assert.equal(ins.recommendations[0].count, 2);

// Safety outranks an equally common problem; the most common problem comes first; at most 3 problems.
const many = [
  ...Array.from({ length: 4 }, () => review([2, 25])),
  ...Array.from({ length: 3 }, () => review([2, 21])),
  ...Array.from({ length: 3 }, () => review([3, 19])),
  ...Array.from({ length: 3 }, () => review([2, 11])),
  ...Array.from({ length: 7 }, () => review([1, 6])),
];
ins = computeInsights(many, 30, now);
assert.equal(ins.recommendations.length, 3);
assert.deepEqual(ins.recommendations.map((r) => r.id).slice(0, 2), [19, 25]);
assert.equal(ins.early, false);

// Two safety complaints are enough, even when they are a small share of reviews.
const safety = [review([3, 19]), review([2, 19]), ...Array.from({ length: 18 }, () => review([1, 6]))];
assert.deepEqual(problems(computeInsights(safety, 30, now)).map((r) => r.id), [19]);
const timing = [review([2, 21]), review([2, 21]), ...Array.from({ length: 18 }, () => review([1, 6]))];
assert.deepEqual(problems(computeInsights(timing, 30, now)), []);

// Mostly happy visitors with no problems: suggest asking them to spread the word.
ins = computeInsights([review([1, 6]), review([1, 14]), review([1, 26]), review([2])], 30, now);
assert.deepEqual(ins.recommendations.map((r) => r.kind), ['spread-word']);

// Unhappy without a stated reason.
ins = computeInsights([review([3]), review([3]), review([1]), review([1])], 30, now);
assert.deepEqual(ins.recommendations.map((r) => r.kind), ['unexplained']);

// Trend and rising problems compare with the previous window.
const older = [review([1], 10), review([1], 11), review([1, 25], 12), review([1], 13)];
const newer = [review([3, 25], 1), review([3, 25], 2), review([2, 25], 3), review([1], 4)];
ins = computeInsights([...older, ...newer], 7, now);
assert.equal(ins.trend?.direction, 'down');
assert.equal(ins.recommendations[0].id, 25);
assert.equal(ins.recommendations[0].rising, true);

// The period filters reviews; "all" keeps everything.
assert.equal(computeInsights([...older, ...newer], 7, now).reviews.length, 4);
assert.equal(computeInsights([...older, ...newer], 'all', now).reviews.length, 8);

// Weekly moods land in the right week.
const weeks = computeInsights([review([1], 0), review([3], 8), review([2], 60)], 'all', now).weeks;
assert.equal(weeks.length, 8);
assert.deepEqual([weeks[7].happy, weeks[6].unhappy], [1, 1]);
assert.equal(weeks.reduce((s, w) => s + w.happy + w.mixed + w.unhappy + w.unknown, 0), 2);

console.log('insights: all checks passed');
