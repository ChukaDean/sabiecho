import type { Review } from './db';
import type { MeaningGroup, MeaningId } from './taxonomy';

export type Period = 7 | 30 | 'all';
export type Mood = 'happy' | 'mixed' | 'unhappy' | 'unknown';

const DAY = 24 * 60 * 60 * 1000;

/** The paired topics: what visitors praised and what they complained about. */
export const TOPICS: { group: MeaningGroup; good: MeaningId; bad: MeaningId }[] = [
  { group: 'explanations', good: 4, bad: 5 },
  { group: 'welcome', good: 6, bad: 7 },
  { group: 'understanding', good: 8, bad: 9 },
  { group: 'participation', good: 10, bad: 11 },
  { group: 'place', good: 12, bad: 13 },
  { group: 'food', good: 14, bad: 15 },
  { group: 'shopping', good: 16, bad: 17 },
  { group: 'comfort', good: 18, bad: 19 },
  { group: 'organisation', good: 20, bad: 21 },
  { group: 'price', good: 22, bad: 23 },
  { group: 'access', good: 24, bad: 25 },
];

const PROBLEMS = new Set<MeaningId>(TOPICS.map((tp) => tp.bad));
const PRAISE = new Set<MeaningId>([...TOPICS.map((tp) => tp.good), 26]);

/** Safety problems are raised above more common but less serious ones, and need less evidence. */
const SEVERITY: Partial<Record<MeaningId, number>> = { 19: 1.5 };
const URGENT = new Set<MeaningId>([19]);

/** A problem becomes a recommendation once it has this much evidence. */
export const MIN_MENTIONS = 2;
export const STRONG_MENTIONS = 3;
export const MIN_SHARE = 0.15;
/** Below this many reviews, recommendations are shown as early signals. */
export const EARLY_SIGNAL_BELOW = 10;
const MAX_RECOMMENDATIONS = 3;

export function reviewMood(r: Review): Mood {
  const s = new Set(r.selected);
  if (s.has(1)) return 'happy';
  if (s.has(3)) return 'unhappy';
  if (s.has(2)) return 'mixed';
  const pos = r.selected.filter((id) => PRAISE.has(id)).length;
  const neg = r.selected.filter((id) => PROBLEMS.has(id)).length;
  if (pos && neg) return 'mixed';
  if (pos) return 'happy';
  if (neg) return 'unhappy';
  return 'unknown';
}

export interface MoodSummary {
  happy: number;
  mixed: number;
  unhappy: number;
  unknown: number;
  /** Reviews with a known mood. */
  known: number;
  /** Happy share minus unhappy share, from -1 to 1. */
  score: number;
}

export function moodSummary(reviews: Review[]): MoodSummary {
  const m = { happy: 0, mixed: 0, unhappy: 0, unknown: 0 };
  for (const r of reviews) m[reviewMood(r)]++;
  const known = m.happy + m.mixed + m.unhappy;
  return { ...m, known, score: known ? (m.happy - m.unhappy) / known : 0 };
}

export interface Trend {
  direction: 'up' | 'down' | 'same';
  /** Length of the compared windows, in days. */
  days: number;
}

const TREND_MIN_REVIEWS = 3;
const TREND_MIN_CHANGE = 0.1;

export interface Recommendation {
  kind: 'problem' | 'unexplained' | 'spread-word';
  /** The meaning the advice is about: a problem, 3 for unexplained unhappiness, 26 for spreading the word. */
  id: MeaningId;
  count: number;
  total: number;
  rising: boolean;
  /** The reviews behind it, newest first. */
  reviews: Review[];
}

export interface TopicStat {
  group: MeaningGroup;
  good: MeaningId;
  bad: MeaningId;
  goodCount: number;
  badCount: number;
}

export interface WeekStat {
  start: number;
  happy: number;
  mixed: number;
  unhappy: number;
  unknown: number;
}

export interface Insights {
  reviews: Review[];
  mood: MoodSummary;
  trend: Trend | null;
  recommendations: Recommendation[];
  /** Too few reviews for the recommendations to be reliable. */
  early: boolean;
  /** Problems without enough evidence yet, but worth watching. */
  watch: MeaningId[];
  loved: { id: MeaningId; count: number }[];
  topics: TopicStat[];
  weeks: WeekStat[];
}

const mentions = (reviews: Review[], id: MeaningId) => reviews.filter((r) => r.selected.includes(id));

function windowed(reviews: Review[], now: number, period: Period) {
  const days = period === 'all' ? 30 : period;
  const inWindow = (r: Review, from: number, to: number) => r.createdAt > now - to * DAY && r.createdAt <= now - from * DAY;
  return {
    days,
    current: period === 'all' ? reviews : reviews.filter((r) => inWindow(r, 0, days)),
    recent: reviews.filter((r) => inWindow(r, 0, days)),
    previous: reviews.filter((r) => inWindow(r, days, 2 * days)),
  };
}

function recency(r: Review, now: number) {
  const age = (now - r.createdAt) / DAY;
  return age <= 7 ? 1 : age <= 30 ? 0.8 : 0.6;
}

function isRising(id: MeaningId, recent: Review[], previous: Review[]) {
  if (previous.length < TREND_MIN_REVIEWS || recent.length === 0) return false;
  const share = (rs: Review[]) => mentions(rs, id).length / rs.length;
  return share(recent) >= share(previous) + TREND_MIN_CHANGE;
}

const enoughEvidence = (count: number, total: number, urgent = false) =>
  count >= MIN_MENTIONS && (urgent || count >= STRONG_MENTIONS || count / total >= MIN_SHARE);

export function computeInsights(all: Review[], period: Period, now = Date.now()): Insights {
  const { days, current: reviews, recent, previous } = windowed(all, now, period);
  const total = reviews.length;
  const mood = moodSummary(reviews);
  const early = total < EARLY_SIGNAL_BELOW;
  const newestFirst = (rs: Review[]) => [...rs].sort((a, b) => b.createdAt - a.createdAt);

  let trend: Trend | null = null;
  const before = moodSummary(previous);
  const after = moodSummary(recent);
  if (before.known >= TREND_MIN_REVIEWS && after.known >= TREND_MIN_REVIEWS) {
    const change = after.score - before.score;
    trend = { days, direction: change >= TREND_MIN_CHANGE ? 'up' : change <= -TREND_MIN_CHANGE ? 'down' : 'same' };
  }

  const scored: (Recommendation & { score: number })[] = [];
  const watch: MeaningId[] = [];
  for (const id of PROBLEMS) {
    const rs = mentions(reviews, id);
    if (rs.length === 0) continue;
    if (!enoughEvidence(rs.length, total, URGENT.has(id))) {
      watch.push(id);
      continue;
    }
    const weight = rs.reduce((sum, r) => sum + recency(r, now), 0);
    scored.push({
      kind: 'problem',
      id,
      count: rs.length,
      total,
      rising: isRising(id, recent, previous),
      reviews: newestFirst(rs),
      score: (weight / total) * (SEVERITY[id] ?? 1),
    });
  }

  const unexplained = reviews.filter((r) => reviewMood(r) === 'unhappy' && !r.selected.some((id) => PROBLEMS.has(id)));
  if (enoughEvidence(unexplained.length, total)) {
    const weight = unexplained.reduce((sum, r) => sum + recency(r, now), 0);
    scored.push({
      kind: 'unexplained',
      id: 3,
      count: unexplained.length,
      total,
      rising: false,
      reviews: newestFirst(unexplained),
      score: weight / total,
    });
  }

  const recommendations: Recommendation[] = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECOMMENDATIONS)
    .map(({ score: _score, ...rec }) => rec);

  if (recommendations.length < MAX_RECOMMENDATIONS && mood.known >= STRONG_MENTIONS && mood.happy / mood.known >= 0.6) {
    const happy = reviews.filter((r) => reviewMood(r) === 'happy');
    recommendations.push({
      kind: 'spread-word',
      id: 26,
      count: happy.length,
      total: mood.known,
      rising: false,
      reviews: newestFirst(happy),
    });
  }

  const loved = [...PRAISE]
    .map((id) => ({ id, count: mentions(reviews, id).length }))
    .filter((l) => l.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const topics = TOPICS.map((tp) => ({
    ...tp,
    goodCount: mentions(reviews, tp.good).length,
    badCount: mentions(reviews, tp.bad).length,
  }));

  return { reviews, mood, trend, recommendations, early, watch, loved, topics, weeks: weeklyMoods(all, now) };
}

/** Mood counts for each of the last `count` weeks, oldest first. */
export function weeklyMoods(reviews: Review[], now = Date.now(), count = 8): WeekStat[] {
  const end = startOfDay(now) + DAY;
  const weeks: WeekStat[] = Array.from({ length: count }, (_, i) => ({
    start: end - (count - i) * 7 * DAY,
    happy: 0,
    mixed: 0,
    unhappy: 0,
    unknown: 0,
  }));
  for (const r of reviews) {
    const index = count - 1 - Math.floor((end - 1 - r.createdAt) / (7 * DAY));
    if (index >= 0 && index < count) weeks[index][reviewMood(r)]++;
  }
  return weeks;
}

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
