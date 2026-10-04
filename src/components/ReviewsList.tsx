import { useState } from 'react';
import { useI18n } from '../i18n';
import { deleteReview, needsVolunteer, saveReview, type Review } from '../lib/db';
import { exportReviewsToCheck, shareOrDownload } from '../lib/improvements-file';
import { getMeaning } from '../lib/taxonomy';
import { useObjectUrl } from '../lib/useObjectUrl';
import { usePlayer } from '../lib/usePlayer';
import { useLanguageName, useVoices } from '../lib/voice-library';
import { useVolunteer } from '../lib/volunteer';
import { ReviewCorrector } from './ReviewCorrector';
import { ScreenHero } from './ScreenHero';

export function ReviewsList({ reviews, onChange }: { reviews: Review[]; onChange: () => void }) {
  const { t } = useI18n();
  const player = usePlayer();
  const { credential } = useVolunteer();
  const hero = (
    <ScreenHero
      eyebrow={t('reviewsEyebrow')}
      title={t('reviewsTitle')}
      stat={reviews.length ? { value: reviews.length, label: t('reviewsStat') } : undefined}
    />
  );
  if (reviews.length === 0)
    return (
      <section className="panel">
        {hero}
        <p className="empty">{t('reviewsEmpty')}</p>
      </section>
    );
  return (
    <section className="panel">
      {hero}
      {!credential && <SendForChecking reviews={reviews.filter(needsVolunteer)} onSent={onChange} />}
      <ul className="reviews">
        {reviews.map((r) => (
          <ReviewItem
            key={r.id}
            review={r}
            playing={player.playing !== null && r.selected.includes(player.playing)}
            onPlay={() => player.play(r.selected)}
            onStop={player.stop}
            onChange={onChange}
            onDelete={async () => {
              await deleteReview(r.id);
              onChange();
            }}
          />
        ))}
      </ul>
    </section>
  );
}

/** Hosts don't fix SabiEcho themselves: they send unclear or flagged reviews to the volunteers. */
function SendForChecking({ reviews, onSent }: { reviews: Review[]; onSent: () => void }) {
  const { lang, t } = useI18n();
  const { language } = useVoices();
  const [error, setError] = useState<string | null>(null);
  if (reviews.length === 0) return null;
  const lastSent = Math.max(0, ...reviews.map((r) => r.sharedAt ?? 0));

  async function send() {
    setError(null);
    try {
      const blob = await exportReviewsToCheck(reviews, language.code);
      const stamp = new Date().toISOString().slice(0, 10);
      await shareOrDownload(blob, `sabiecho-reviews-to-check-${stamp}.json`, t('sendTitle'));
      const sharedAt = Date.now();
      for (const r of reviews) await saveReview({ ...r, sharedAt });
      onSent();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="send-card">
      <div>
        <strong>{t('needVolunteer', { n: reviews.length })}</strong>
        <div className="hint">
          {lastSent ? t('lastSent', { date: new Date(lastSent).toLocaleString(lang) }) : t('sendIntro')}
        </div>
      </div>
      <button className="primary" onClick={send}>
        {t('sendForChecking')}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export function ReviewItem({
  review,
  playing,
  onPlay,
  onStop,
  onChange,
  onDelete,
}: {
  review: Review;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  onChange: () => void;
  onDelete?: () => void;
}) {
  const { lang, t } = useI18n();
  const { clip } = useVoices();
  const { credential, can } = useVolunteer();
  const languageName = useLanguageName();
  const [correcting, setCorrecting] = useState(false);
  const audioUrl = useObjectUrl(correcting ? null : (review.audio ?? null));
  const hasClip = review.selected.some((id) => clip(id));
  return (
    <li className={`review ${review.uncertain || review.flagged ? 'uncertain' : ''}`}>
      <div className="review-meta">
        <span>{new Date(review.createdAt).toLocaleString(lang)}</span>
        <span className="tag">
          {review.source === 'voice' ? t('voice') : t('text')}
          {review.language && ` · ${review.language.toUpperCase()}`}
        </span>
        {review.uncertain && !review.correctedAt && <span className="tag warn">{t('toRead')}</span>}
        {review.flagged && <span className="tag warn">{t('flagged')}</span>}
        {review.sharedAt && !review.correctedAt && !credential && <span className="tag">{t('sentForChecking')}</span>}
        {review.importedAt && <span className="tag">{t('fromHost')}</span>}
        {review.correctedBy && <span className="tag ok">{t('correctedBy', { name: review.correctedBy })}</span>}
      </div>
      {correcting ? (
        <ReviewCorrector
          review={review}
          onCancel={() => setCorrecting(false)}
          onDone={() => {
            setCorrecting(false);
            onChange();
          }}
        />
      ) : (
        <>
          <p className="review-text">{review.text || '—'}</p>
          {audioUrl && (
            <div className="voice-preview">
              <span>{t('originalVoice')}</span>
              <audio controls src={audioUrl} />
            </div>
          )}
          <div className="chips">
            {review.selected.map((id) => {
              const m = getMeaning(id);
              return (
                <span key={id} className={`chip ${clip(id) ? 'has-audio' : ''}`} title={lang === 'fr' ? m.fr : m.en}>
                  {id}. {lang === 'fr' ? m.fr : m.en}
                </span>
              );
            })}
          </div>
          <div className="review-actions">
            {hasClip && (
              <button className="secondary" onClick={playing ? onStop : onPlay}>
                {playing ? `■ ${t('stopPlayback')}` : `▶ ${t('playAll', { language: languageName })}`}
              </button>
            )}
            {can('correct') && review.text.trim() && (
              <button className="secondary" onClick={() => setCorrecting(true)}>
                {t(review.correctedAt ? 'editCorrection' : 'correct')}
              </button>
            )}
            {!credential && !review.correctedAt && (
              <button
                className="ghost"
                onClick={async () => {
                  await saveReview({ ...review, flagged: !review.flagged });
                  onChange();
                }}
              >
                {t(review.flagged ? 'unflag' : 'flag')}
              </button>
            )}
            {onDelete && (
              <button className="ghost danger" onClick={onDelete}>
                {t('delete')}
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}
