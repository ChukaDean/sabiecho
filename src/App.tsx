import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ImprovePanel } from './components/ImprovePanel';
import { Insights } from './components/Insights';
import { MessagesList } from './components/MessagesList';
import { NewReview } from './components/NewReview';
import { OfflinePanel } from './components/OfflinePanel';
import { ReviewsList } from './components/ReviewsList';
import { VolunteerSignIn } from './components/VolunteerSignIn';
import { useI18n, type StringKey } from './i18n';
import { listReviews, needsVolunteer, type Review } from './lib/db';
import { LOCAL_LANGUAGES } from './lib/languages';
import { useLanguageName, useVoices } from './lib/voice-library';
import { signOut, useVolunteer } from './lib/volunteer';

type Tab = 'new' | 'reviews' | 'insights' | 'messages' | 'improve' | 'offline';

const TABS: { id: Tab; label: StringKey }[] = [
  { id: 'new', label: 'tabNew' },
  { id: 'reviews', label: 'tabReviews' },
  { id: 'insights', label: 'tabInsights' },
  { id: 'messages', label: 'tabPhrasebook' },
  { id: 'improve', label: 'tabImprove' },
  { id: 'offline', label: 'tabOffline' },
];

export function App() {
  const { lang, setLang, t } = useI18n();
  const [tab, setTab] = useState<Tab>('new');
  const [reviews, setReviews] = useState<Review[]>([]);
  const online = useOnline();

  const refresh = useCallback(() => {
    void listReviews().then(setReviews);
  }, []);
  useEffect(refresh, [refresh]);

  const { credential, can } = useVolunteer();
  const { recordings } = useVoices();
  const shortLanguageName = useLanguageName().replace(/\s*\(.*\)$/, '');
  const [signingIn, setSigningIn] = useState(() => location.hash.startsWith('#volunteer='));
  const toRead = reviews.filter(needsVolunteer).length;
  const toImprove =
    (can('correct') ? toRead : 0) + recordings.filter((r) => r.status === 'pending' && can('vet', r.language)).length;
  const tabs = TABS.filter((tb) => tb.id !== 'improve' || credential);
  const activeTab = tabs.some((tb) => tb.id === tab) ? tab : 'new';

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={36} height={36} />
          <div>
            <h1>SabiEcho</h1>
            <p className="tagline">{t('tagline')}</p>
          </div>
        </div>
        <div className="header-right">
          {credential && (
            <span className="volunteer-chip" title={`${t('volunteer')} · ${credential.name}`}>
              <span className="chip-role">{t('volunteer')} · </span>
              {credential.name.split(' ')[0]}
            </span>
          )}
          <span className={`net ${online ? 'on' : 'off'}`}>{online ? t('online') : t('offline')}</span>
          <div className="lang-switch" role="group" aria-label="Language">
            {(['fr', 'en'] as const).map((l) => (
              <button key={l} className={lang === l ? 'active' : ''} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <LanguagePicker />

      <nav className="tabs" style={{ '--tab-count': tabs.length } as CSSProperties}>
        {tabs.map((tb) => (
          <button key={tb.id} className={activeTab === tb.id ? 'active' : ''} onClick={() => setTab(tb.id)}>
            <span className="tab-label">
              {t(tb.label)}
              {tb.id === 'messages' && <span className="tab-lang"> ({shortLanguageName})</span>}
            </span>
            {tb.id === 'reviews' && toRead > 0 && <span className="badge">{toRead}</span>}
            {tb.id === 'improve' && toImprove > 0 && <span className="badge">{toImprove}</span>}
          </button>
        ))}
      </nav>

      <main>
        {signingIn && (
          <VolunteerSignIn
            onClose={() => {
              setSigningIn(false);
              if (location.hash) history.replaceState(null, '', location.pathname + location.search);
            }}
            onSignedIn={() => setTab('improve')}
          />
        )}
        {activeTab === 'new' && <NewReview onSaved={refresh} />}
        {activeTab === 'reviews' && <ReviewsList reviews={reviews} onChange={refresh} />}
        {activeTab === 'insights' && <Insights reviews={reviews} />}
        {activeTab === 'messages' && <MessagesList />}
        {activeTab === 'improve' && <ImprovePanel reviews={reviews} onChange={refresh} />}
        {activeTab === 'offline' && <OfflinePanel />}
      </main>

      <footer className="footer">
        {credential ? (
          <button className="ghost" onClick={() => (signOut(), setTab('new'))}>
            {t('signOut', { name: credential.name })}
          </button>
        ) : (
          !signingIn && (
            <button className="ghost" onClick={() => setSigningIn(true)}>
              {t('volunteerSignIn')}
            </button>
          )
        )}
      </footer>
    </div>
  );
}

function LanguagePicker() {
  const { lang, t } = useI18n();
  const { language, setLanguage, coverage } = useVoices();
  return (
    <label className="language-picker">
      <span>{t('localLanguage')}</span>
      <select value={language.code} onChange={(e) => setLanguage(e.target.value)}>
        {LOCAL_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {lang === 'fr' ? l.fr.charAt(0).toUpperCase() + l.fr.slice(1) : l.en} · {l.country[lang]} ({coverage(l.code)}/27)
          </option>
        ))}
      </select>
    </label>
  );
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
