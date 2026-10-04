import { useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { Recorder } from '../lib/audio';
import { deleteRecording, saveRecording, type VoiceRecording } from '../lib/db';
import { getLanguage, languageName, LOCAL_LANGUAGES } from '../lib/languages';
import { getMeaning, MEANINGS, type MeaningId } from '../lib/taxonomy';
import { useObjectUrl } from '../lib/useObjectUrl';
import { useLanguageName, useVoices } from '../lib/voice-library';
import { useVolunteer } from '../lib/volunteer';

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** Volunteers record the 27 messages in their languages; a second vetted speaker approves a clip before it plays. */
export function Recordings() {
  const { t } = useI18n();
  const { recordings, refresh } = useVoices();
  const { can } = useVolunteer();
  const pending = recordings.filter((r) => r.status === 'pending');
  const vetted = recordings.filter((r) => r.status !== 'pending');
  return (
    <>
      {can('record') && <NewRecording onSaved={refresh} />}
      <h3>
        {t('awaitingVetting')} {pending.length > 0 && <span className="badge">{pending.length}</span>}
      </h3>
      {pending.length === 0 ? (
        <p className="hint">{t('nothingToVet')}</p>
      ) : (
        <ul className="recordings">
          {pending.map((r) => (
            <RecordingItem key={r.id} recording={r} onChange={refresh} />
          ))}
        </ul>
      )}
      {vetted.length > 0 && (
        <details>
          <summary>{t('vettedRecordings', { n: vetted.length })}</summary>
          <ul className="recordings">
            {vetted.map((r) => (
              <RecordingItem key={r.id} recording={r} onChange={refresh} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function NewRecording({ onSaved }: { onSaved: () => Promise<void> }) {
  const { lang, t } = useI18n();
  const { credential } = useVolunteer();
  const { clip, text: textFor, language: deviceLanguage } = useVoices();
  const languages = LOCAL_LANGUAGES.filter((l) => credential?.languages.includes(l.code));
  const initial = languages.some((l) => l.code === deviceLanguage.code) ? deviceLanguage.code : languages[0]?.code;
  const [code, setCode] = useState(initial);
  const [meaningId, setMeaningId] = useState<MeaningId>(1);
  const [text, setText] = useState(() => textFor(1, initial) ?? '');
  const [audio, setAudio] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const recorder = useRef(new Recorder());
  const fileInput = useRef<HTMLInputElement>(null);
  const audioUrl = useObjectUrl(audio);
  const codeName = useLanguageName(code);

  if (!credential || !code) return null;

  function choose(nextCode: string, id: MeaningId) {
    setCode(nextCode);
    setMeaningId(id);
    setText(textFor(id, nextCode) ?? '');
    setAudio(null);
    setSavedNote(false);
  }

  async function toggleRecording() {
    setError(null);
    setSavedNote(false);
    if (recording) {
      setAudio(await recorder.current.stop());
      setRecording(false);
      return;
    }
    try {
      await recorder.current.start();
      setRecording(true);
    } catch {
      setError(t('micError'));
    }
  }

  async function save() {
    if (!audio || !credential || !code) return;
    await saveRecording({
      id: crypto.randomUUID(),
      language: code,
      meaningId,
      audio,
      text: text.trim(),
      status: 'pending',
      recordedBy: credential.name,
      createdAt: Date.now(),
    });
    setAudio(null);
    setSavedNote(true);
    await onSaved();
  }

  const m = getMeaning(meaningId);
  return (
    <div className="recorder-card">
      <h3>{t('recordMessage')}</h3>
      <label className="field">
        <span>{t('recordLanguage')}</span>
        <select value={code} onChange={(e) => choose(e.target.value, meaningId)}>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.en === l.endonym ? l.en : `${l.en} · ${l.endonym}`} ({l.country[lang]})
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('message')}</span>
        <select value={meaningId} onChange={(e) => choose(code, Number(e.target.value) as MeaningId)}>
          {MEANINGS.map((mm) => (
            <option key={mm.id} value={mm.id}>
              {clip(mm.id, code) ? '✓ ' : '○ '}
              {mm.id}. {lang === 'fr' ? mm.fr : mm.en}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">
        {t('sayIn', { language: codeName })} <strong>{m.fr}</strong> / <em>{m.en}</em>
      </p>
      <label className="field">
        <span>{t('recordingText', { language: codeName })}</span>
        <input value={text} onChange={(e) => setText(e.target.value)} lang={code} />
      </label>
      <div className="voice-controls">
        <button className={`secondary ${recording ? 'recording' : ''}`} onClick={toggleRecording}>
          {recording ? `■ ${t('stop')}` : `● ${t('record')}`}
        </button>
        <button className="secondary" onClick={() => fileInput.current?.click()} disabled={recording}>
          {t('upload')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="audio/*,.m4a,.mp3,.wav,.ogg,.opus,.aac"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setAudio(file);
            setSavedNote(false);
            e.target.value = '';
          }}
        />
      </div>
      {audioUrl && (
        <div className="voice-preview">
          <span>{t('listenBack')}</span>
          <audio controls src={audioUrl} />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {savedNote && <p className="saved">✓ {t('savedForVetting')}</p>}
      <div className="actions">
        <button className="primary" onClick={save} disabled={!audio || recording}>
          {t('saveForVetting')}
        </button>
      </div>
    </div>
  );
}

function RecordingItem({ recording: r, onChange }: { recording: VoiceRecording; onChange: () => Promise<void> }) {
  const { lang, t } = useI18n();
  const { credential, can } = useVolunteer();
  const url = useObjectUrl(r.audio);
  const m = getMeaning(r.meaningId);
  const language = getLanguage(r.language);
  const name = languageName(language, lang);
  const ownRecording = !!credential && sameName(credential.name, r.recordedBy);
  const mayVet = can('vet', r.language) && !ownRecording;

  async function vet(status: 'approved' | 'rejected') {
    if (!credential) return;
    await saveRecording({ ...r, status, vettedBy: credential.name, vettedAt: Date.now() });
    await onChange();
  }

  return (
    <li className={`recording ${r.status}`}>
      <div className="recording-head">
        <span className="meaning-num">{r.meaningId}</span>
        <div>
          <span className="tag">{language.en === language.endonym ? language.en : `${language.en} · ${language.endonym}`}</span>
          <div>{lang === 'fr' ? m.fr : m.en}</div>
          {r.text && (
            <div className="meaning-local" lang={r.language}>
              {r.text}
            </div>
          )}
          <div className="recording-meta">
            {t('recordedBy', { name: r.recordedBy })} · {new Date(r.createdAt).toLocaleDateString(lang)}
            {r.vettedBy && ` · ${t(r.status === 'approved' ? 'approvedBy' : 'rejectedBy', { name: r.vettedBy })}`}
          </div>
        </div>
      </div>
      {url && <audio controls src={url} />}
      {r.status === 'pending' && (
        <p className="hint">
          {ownRecording
            ? t('vetterMustDiffer')
            : mayVet
              ? t('vetterSpeaker', { language: name })
              : t('cannotVet', { language: name })}
        </p>
      )}
      <div className="review-actions">
        {r.status === 'pending' ? (
          mayVet && (
            <>
              <button className="primary" onClick={() => vet('approved')}>
                {t('approve')}
              </button>
              <button className="secondary" onClick={() => vet('rejected')}>
                {t('reject')}
              </button>
            </>
          )
        ) : (
          <span className={`tag ${r.status === 'approved' ? 'ok' : 'warn'}`}>
            {t(r.status === 'approved' ? 'approved' : 'rejected')}
          </span>
        )}
        {(ownRecording || can('vet', r.language)) && (
          <button
            className="ghost danger"
            onClick={async () => {
              await deleteRecording(r.id);
              await onChange();
            }}
          >
            {t('delete')}
          </button>
        )}
      </div>
    </li>
  );
}
