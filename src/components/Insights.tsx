import { useMemo, useState } from 'react';
import { useI18n, type StringKey } from '../i18n';
import { getAdvice } from '../lib/advice';
import { needsVolunteer, type Review } from '../lib/db';
import {
  computeInsights,
  type Mood,
  type MoodSummary,
  type Period,
  type Recommendation,
  type TopicStat,
  type Trend,
  type WeekStat,
} from '../lib/insights';
import { getMeaning, type MeaningId } from '../lib/taxonomy';
import { usePlayer } from '../lib/usePlayer';
import { useVoices } from '../lib/voice-library';
import { ScreenHero } from './ScreenHero';

const DAY = 24 * 60 * 60 * 1000;
const WEEK_CHART_HEIGHT = 96;

const PERIODS: { id: Period; label: StringKey }[] = [
  { id: 7, label: 'period7' },
  { id: 30, label: 'period30' },
  { id: 'all', label: 'periodAll' },
];

const MOODS: { mood: Exclude<Mood, 'unknown'>; label: StringKey; head: StringKey; meaning: MeaningId }[] = [
  { mood: 'happy', label: 'moodHappy', head: 'moodHeadHappy', meaning: 1 },
  { mood: 'mixed', label: 'moodMixed', head: 'moodHeadMixed', meaning: 2 },
  { mood: 'unhappy', label: 'moodUnhappy', head: 'moodHeadUnhappy', meaning: 3 },
];

const FACE_MOUTHS: Record<Mood, string> = {
  happy: 'M17 30 Q26 39 35 30',
  mixed: 'M18 33 H34',
  unhappy: 'M17 36 Q26 28 35 36',
  unknown: 'M19 33 H33',
};

function MoodFace({ mood }: { mood: Mood }) {
  const fill = { happy: 'var(--amber)', mixed: 'var(--sand)', unhappy: 'var(--ink)', unknown: 'var(--tint)' }[mood];
  const ink = mood === 'unhappy' ? 'white' : 'var(--ink)';
  return (
    <svg className="mood-face" viewBox="0 0 52 52" aria-hidden>
      <circle cx="26" cy="26" r="26" fill={fill} />
      <circle cx="19" cy="21" r="2.6" fill={ink} />
      <circle cx="33" cy="21" r="2.6" fill={ink} />
      <path d={FACE_MOUTHS[mood]} fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

type Player = ReturnType<typeof usePlayer>;

export function Insights({ reviews }: { reviews: Review[] }) {
  const { t } = useI18n();
  const player = usePlayer();
  const [period, setPeriod] = useState<Period>(() =>
    reviews.some((r) => r.createdAt > Date.now() - 30 * DAY) ? 30 : 'all',
  );
  const insights = useMemo(() => computeInsights(reviews, period), [reviews, period]);

  if (reviews.length === 0)
    return (
      <section className="panel insights">
        <ScreenHero eyebrow={t('insightsEyebrow')} title={t('insightsTitle')} />
        <p className="empty">{t('insightsEmpty')}</p>
      </section>
    );

  const toRead = insights.reviews.filter(needsVolunteer).length;

  return (
    <section className="panel insights">
      <ScreenHero
        eyebrow={t('insightsEyebrow')}
        title={t('insightsTitle')}
        stat={{ value: insights.reviews.length, label: t('insightsStat') }}
      />
      <div className="period-picker" role="group">
        {PERIODS.map((p) => (
          <button key={p.id} className={period === p.id ? 'active' : ''} onClick={() => setPeriod(p.id)}>
            {t(p.label)}
          </button>
        ))}
      </div>
      {toRead > 0 && <p className="hint period-summary">{t('periodToRead', { n: toRead })}</p>}

      {insights.reviews.length === 0 ? (
        <p className="empty-period">{t('periodEmpty')}</p>
      ) : (
        <>
          <MoodCard mood={insights.mood} trend={insights.trend} player={player} />

          <h2>{t('workOnTitle')}</h2>
          {insights.recommendations.length === 0 ? (
            <p className="hint">{t('workOnEmpty')}</p>
          ) : (
            <>
              {insights.early && <p className="early-signal">{t('earlySignal', { n: insights.reviews.length })}</p>}
              <ol className="recs">
                {insights.recommendations.map((rec, i) => (
                  <RecommendationCard key={rec.kind + rec.id} rec={rec} rank={i + 1} player={player} />
                ))}
              </ol>
            </>
          )}
          {insights.watch.length > 0 && <WatchList ids={insights.watch} />}

          {insights.loved.length > 0 && (
            <>
              <h2>{t('lovedTitle')}</h2>
              <ul className="loved">
                {insights.loved.map((l) => (
                  <LovedRow key={l.id} id={l.id} count={l.count} player={player} />
                ))}
              </ul>
              <p className="hint">{t('lovedTip')}</p>
            </>
          )}

          <h2>{t('topicsTitle')}</h2>
          <TopicChart topics={insights.topics} />
        </>
      )}

      {insights.weeks.filter((w) => w.happy + w.mixed + w.unhappy + w.unknown > 0).length >= 2 && (
        <>
          <h2>{t('weeksTitle')}</h2>
          <WeekChart weeks={insights.weeks} />
        </>
      )}
    </section>
  );
}

function MoodCard({ mood, trend, player }: { mood: MoodSummary; trend: Trend | null; player: Player }) {
  const { t } = useI18n();
  const total = mood.known + mood.unknown;
  const top = mood.known ? MOODS.reduce((a, b) => (mood[b.mood] > mood[a.mood] ? b : a)) : null;
  const pct = (n: number) => Math.round((n / total) * 100);
  const segments = [...MOODS.map((m) => ({ key: m.mood, label: m.label })), { key: 'unknown' as const, label: 'moodUnknown' as const }];

  return (
    <div className="mood-card">
      <div className="mood-head">
        <MoodFace mood={top?.mood ?? 'unknown'} />
        <div className="mood-headline">
          <span className="mood-kicker">{t('moodTitle')}</span>
          <strong>{t(top?.head ?? 'moodHeadUnknown')}</strong>
          {trend && (
            <span className={`trend trend-${trend.direction}`}>
              {trend.direction === 'up' ? '↗' : trend.direction === 'down' ? '↘' : '→'}{' '}
              {t(trend.direction === 'up' ? 'trendUp' : trend.direction === 'down' ? 'trendDown' : 'trendSame', {
                days: trend.days,
              })}
            </span>
          )}
        </div>
        {top && <ListenButton id={top.meaning} player={player} />}
      </div>
      <div className="mood-bar" role="img" aria-label={segments.map((s) => `${t(s.label)} ${mood[s.key]}`).join(', ')}>
        {segments.map(
          (s) => mood[s.key] > 0 && <span key={s.key} className={`seg seg-${s.key}`} style={{ flexGrow: mood[s.key] }} />,
        )}
      </div>
      <ul className="mood-legend">
        {segments.map(
          (s) =>
            mood[s.key] > 0 && (
              <li key={s.key}>
                <span className={`dot seg-${s.key}`} aria-hidden />
                {t(s.label)} <b>{mood[s.key]}</b> <span className="pct">({pct(mood[s.key])}%)</span>
              </li>
            ),
        )}
      </ul>
    </div>
  );
}

function RecommendationCard({ rec, rank, player }: { rec: Recommendation; rank: number; player: Player }) {
  const { lang, t } = useI18n();
  const advice = getAdvice(rec.id, lang);
  if (!advice) return null;
  const good = rec.kind === 'spread-word';
  const evidence = t(good ? 'evidenceHappy' : 'evidenceProblem', { count: rec.count, total: rec.total });
  const quotes = rec.reviews.filter((r) => r.text.trim()).slice(0, 3);

  return (
    <li className={`rec ${good ? 'rec-good' : 'rec-problem'}`}>
      <div className="rec-head">
        <span className="rec-rank" aria-hidden>
          {good ? '★' : rank}
        </span>
        <div className="rec-title">
          <h3>{advice.title}</h3>
          <div className="rec-meaning">{lang === 'fr' ? getMeaning(rec.id).fr : getMeaning(rec.id).en}</div>
        </div>
        <ListenButton id={rec.id} player={player} />
      </div>
      <Proportion count={rec.count} total={rec.total} good={good} label={evidence} />
      {rec.rising && (
        <div className="rec-tags">
          <span className="tag warn">↗ {t('rising')}</span>
        </div>
      )}
      <ul className="rec-tips">
        {advice.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      {quotes.length > 0 && (
        <details className="rec-quotes">
          <summary>
            {t('showQuotes')} ({rec.count})
          </summary>
          <ul>
            {quotes.map((r) => (
              <li key={r.id}>
                <q>{r.text.length > 160 ? `${r.text.slice(0, 157)}…` : r.text}</q>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

/** "4 of 12" as a row of dots, or a bar when there are too many reviews for dots. */
function Proportion({ count, total, good, label }: { count: number; total: number; good: boolean; label: string }) {
  return (
    <div className={`proportion ${good ? 'good' : 'bad'}`}>
      {total <= 24 ? (
        <span className="dots" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={i < count ? 'on' : ''} />
          ))}
        </span>
      ) : (
        <span className="proportion-bar" aria-hidden>
          <span style={{ width: `${(count / total) * 100}%` }} />
        </span>
      )}
      <span className="proportion-label">{label}</span>
    </div>
  );
}

function WatchList({ ids }: { ids: MeaningId[] }) {
  const { lang, t } = useI18n();
  return (
    <div className="watch">
      <span className="watch-title">{t('watchTitle')}</span>
      <div className="chips">
        {ids.map((id) => (
          <span key={id} className="chip">
            {lang === 'fr' ? getMeaning(id).fr : getMeaning(id).en}
          </span>
        ))}
      </div>
    </div>
  );
}

function LovedRow({ id, count, player }: { id: MeaningId; count: number; player: Player }) {
  const { lang } = useI18n();
  const m = getMeaning(id);
  return (
    <li>
      <span className="loved-icon" aria-hidden>
        ♥
      </span>
      <span className="loved-text">{lang === 'fr' ? m.fr : m.en}</span>
      <span className="loved-count">×{count}</span>
      <ListenButton id={id} player={player} />
    </li>
  );
}

function TopicChart({ topics }: { topics: TopicStat[] }) {
  const { t } = useI18n();
  const mentioned = topics.filter((tp) => tp.goodCount + tp.badCount > 0);
  const unmentioned = topics.filter((tp) => tp.goodCount + tp.badCount === 0);
  const max = Math.max(1, ...mentioned.flatMap((tp) => [tp.goodCount, tp.badCount]));
  const name = (tp: TopicStat) => t(`topic_${tp.group}` as StringKey);
  const sorted = [...mentioned].sort((a, b) => b.badCount - a.badCount || b.goodCount - a.goodCount);

  return (
    <div className="topics">
      {mentioned.length > 0 && (
        <>
          <div className="topic-legend" aria-hidden>
            <span />
            <span className="bad">▼ {t('topicsBad')}</span>
            <span className="good">{t('topicsGood')} ▲</span>
          </div>
          <ul>
            {sorted.map((tp) => (
              <li key={tp.group} aria-label={`${name(tp)}: ${t('topicsBad')} ${tp.badCount}, ${t('topicsGood')} ${tp.goodCount}`}>
                <span className="topic-name">{name(tp)}</span>
                <span className="topic-side bad">
                  {tp.badCount > 0 && <b>{tp.badCount}</b>}
                  <span className="topic-bar" style={{ width: `${(tp.badCount / max) * 100}%` }} />
                </span>
                <span className="topic-side good">
                  <span className="topic-bar" style={{ width: `${(tp.goodCount / max) * 100}%` }} />
                  {tp.goodCount > 0 && <b>{tp.goodCount}</b>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {unmentioned.length > 0 && (
        <p className="hint">{t('topicsUnmentioned', { list: unmentioned.map(name).join(', ') })}</p>
      )}
    </div>
  );
}

function WeekChart({ weeks }: { weeks: WeekStat[] }) {
  const { lang, t } = useI18n();
  const totals = weeks.map((w) => w.happy + w.mixed + w.unhappy + w.unknown);
  const max = Math.max(1, ...totals);
  const order = ['unknown', 'unhappy', 'mixed', 'happy'] as const;
  const labels: Record<(typeof order)[number], StringKey> = {
    happy: 'moodHappy',
    mixed: 'moodMixed',
    unhappy: 'moodUnhappy',
    unknown: 'moodUnknown',
  };

  return (
    <div className="weeks">
      <div className="week-cols">
        {weeks.map((w, i) => {
          const date = new Date(w.start).toLocaleDateString(lang, { day: 'numeric', month: 'short' });
          return (
            <div
              key={w.start}
              className="week"
              role="img"
              aria-label={`${date}: ${order.map((k) => `${t(labels[k])} ${w[k]}`).join(', ')}`}
            >
              <span className="week-total">{totals[i] || ''}</span>
              <div className="week-stack" style={{ height: `${(totals[i] / max) * WEEK_CHART_HEIGHT}px` }}>
                {order.map((k) => w[k] > 0 && <span key={k} className={`seg seg-${k}`} style={{ flexGrow: w[k] }} />)}
              </div>
              <span className="week-label">{date}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListenButton({ id, player }: { id: MeaningId; player: Player }) {
  const { t } = useI18n();
  const { clip } = useVoices();
  if (!clip(id)) return null;
  const playing = player.playing === id;
  return (
    <button
      className={`play listen ${playing ? 'is-playing' : ''}`}
      onClick={playing ? player.stop : () => player.play([id])}
      aria-label={playing ? t('stopPlayback') : t('listen')}
      title={playing ? t('stopPlayback') : t('listen')}
    >
      {playing ? '■' : '▶'}
    </button>
  );
}
