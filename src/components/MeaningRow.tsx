import { useI18n } from '../i18n';
import { useLanguageName, useVoices } from '../lib/voice-library';
import { getMeaning, type MeaningId } from '../lib/taxonomy';

interface Props {
  id: MeaningId;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  detail?: string;
  count?: number;
  /** Relative frequency (0–1), drawn as a bar under the text. */
  bar?: number;
}

export function MeaningRow({ id, playing, onPlay, onStop, detail, count, bar }: Props) {
  const { lang, t } = useI18n();
  const m = getMeaning(id);
  const { clip: clipFor, text: textFor, language } = useVoices();
  const clip = clipFor(id);
  const localText = textFor(id);
  const languageName = useLanguageName();
  return (
    <li className={`meaning ${clip ? 'has-audio' : 'no-audio'} ${playing ? 'playing' : ''}`}>
      <span className="meaning-num">{String(id).padStart(2, '0')}</span>
      <div className="meaning-body">
        <div className="meaning-text">{lang === 'fr' ? m.fr : m.en}</div>
        {localText && (
          <div className="meaning-local" lang={language.code}>
            {localText}
            {clip?.local && <span className="local-tag">{t('localRecording')}</span>}
          </div>
        )}
        {detail && <div className="meaning-detail">{detail}</div>}
        {bar !== undefined && <div className="bar" style={{ width: `${Math.max(bar, 0.04) * 100}%` }} />}
      </div>
      {count !== undefined && <span className="meaning-count">{count}</span>}
      {clip ? (
        <button
          className={`play ${playing ? 'is-playing' : ''}`}
          onClick={playing ? onStop : onPlay}
          aria-label={playing ? t('stopPlayback') : t('play')}
        >
          {playing ? '■' : '▶'}
        </button>
      ) : (
        <span className="no-recording" title={t('noRecording', { language: languageName })}>
          {t('noRecording', { language: languageName })}
        </span>
      )}
    </li>
  );
}
