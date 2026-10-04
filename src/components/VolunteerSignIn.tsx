import { useState } from 'react';
import { useI18n } from '../i18n';
import { CredentialError } from '../lib/credential';
import { signIn } from '../lib/volunteer';

/** Volunteers paste the access code the project team sent them, or open a link that carries it. */
export function VolunteerSignIn({ onClose, onSignedIn }: { onClose: () => void; onSignedIn: () => void }) {
  const { t } = useI18n();
  const [code, setCode] = useState(() =>
    location.hash.startsWith('#volunteer=') ? decodeURIComponent(location.hash.slice('#volunteer='.length)) : '',
  );
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await signIn(code);
      onClose();
      onSignedIn();
    } catch (e) {
      const reason = e instanceof CredentialError ? e.reason : 'malformed';
      setError(t(reason === 'expired' ? 'codeExpired' : 'codeInvalid'));
    }
  }

  return (
    <section className="panel signin">
      <h2>{t('volunteerSignIn')}</h2>
      <p className="hint">{t('signInIntro')}</p>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={3}
        placeholder="EL1.…"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="primary" onClick={submit} disabled={!code.trim()}>
          {t('signIn')}
        </button>
        <button className="ghost" onClick={onClose}>
          {t('cancel')}
        </button>
      </div>
    </section>
  );
}
