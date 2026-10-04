import { useI18n } from '../i18n';
import { LOCAL_LANGUAGES } from '../lib/languages';
import { MEANINGS } from '../lib/taxonomy';
import { usePlayer } from '../lib/usePlayer';
import { useLanguageName, useVoices } from '../lib/voice-library';
import { MeaningRow } from './MeaningRow';
import { ScreenHero } from './ScreenHero';

export function MessagesList() {
  const { lang, t } = useI18n();
  const player = usePlayer();
  const { language, setLanguage, coverage } = useVoices();
  const languageName = useLanguageName();
  const recorded = coverage(language.code);
  return (
    <section className="panel">
      <ScreenHero
        eyebrow={t('messagesEyebrow')}
        title={t('messagesTitle', { language: languageName })}
        intro={t('messagesIntro')}
        stat={{ value: recorded, label: t('recordedOf', { language: languageName }) }}
        progress={recorded / MEANINGS.length}
      />

      <ul className="meanings">
        {MEANINGS.map((m) => (
          <MeaningRow
            key={m.id}
            id={m.id}
            playing={player.playing === m.id}
            onPlay={() => player.play([m.id])}
            onStop={player.stop}
          />
        ))}
      </ul>

      <h2 className="languages-title">{t('languagesTitle')}</h2>
      <p className="hint">{t('languagesIntro')}</p>
      <ul className="languages">
        {LOCAL_LANGUAGES.map((l) => {
          const n = coverage(l.code);
          return (
            <li key={l.code} className={l.code === language.code ? 'active' : ''}>
              <div className="language-body">
                <div>
                  <strong>{lang === 'fr' ? l.fr.charAt(0).toUpperCase() + l.fr.slice(1) : l.en}</strong>
                  {l.endonym !== l.en && <span className="endonym" lang={l.code}> · {l.endonym}</span>}
                </div>
                <div className="language-meta">
                  {l.country[lang]} · {l.places}
                </div>
                <div className="bar" style={{ width: `${Math.max(n / MEANINGS.length, 0.02) * 100}%` }} />
              </div>
              <span className="meaning-count">{n}/27</span>
              {l.code === language.code ? (
                <span className="tag ok">{t('inUse')}</span>
              ) : (
                <button className="ghost small" onClick={() => setLanguage(l.code)}>
                  {t('useLanguage')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
