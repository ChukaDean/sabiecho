import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
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

const TAB_ICONS: Record<Tab, ReactNode> = {
  new: (
    <>
      <path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4.5 19.5l1.2-4.2A7.5 7.5 0 1 1 20 11.5z" />
      <path d="M12.5 8.5v6M9.5 11.5h6" />
    </>
  ),
  reviews: <path d="M5 6.5h14M5 12h14M5 17.5h9" />,
  insights: <path d="M6 19.5v-7M12 19.5v-15M18 19.5v-10" />,
  messages: (
    <>
      <path d="M5 5.5A2 2 0 0 1 7 3.5h12v14H7a2 2 0 0 0-2 2z" />
      <path d="M5 19.5a2 2 0 0 0 2 2h12v-4" />
    </>
  ),
  improve: <path d="M4.5 19.5h4l10-10-4-4-10 10zM13 7l4 4" />,
  offline: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" />,
};

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
  const plainLanguageName = useLanguageName().replace(/\s*\(.*\)$/, '');
  const shortLanguageName = plainLanguageName.charAt(0).toUpperCase() + plainLanguageName.slice(1);
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

      <nav className="tabs" data-count={tabs.length} style={{ '--tab-count': tabs.length } as CSSProperties}>
        {tabs.map((tb) => (
          <button key={tb.id} className={activeTab === tb.id ? 'active' : ''} onClick={() => setTab(tb.id)}>
            <span className="tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">{TAB_ICONS[tb.id]}</svg>
              {tb.id === 'messages' && <span className="tab-tag">{shortLanguageName}</span>}
            </span>
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
