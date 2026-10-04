import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { decodeForWhisper, Recorder } from '../lib/audio';
import type { Classification } from '../lib/classifier';
import { saveReview, type Review } from '../lib/db';
import { ml } from '../lib/ml';
import { ASR_MODEL, EMBEDDING_MODEL } from '../lib/models';
import { useLanguageName, useVoices } from '../lib/voice-library';
import { useVolunteer } from '../lib/volunteer';
import { takeShared, wasShared } from '../lib/shared-inbox';
import { useObjectUrl } from '../lib/useObjectUrl';
import { usePlayer } from '../lib/usePlayer';
import type { ReviewLanguage, SpeechLanguage } from '../lib/worker-protocol';
import { MeaningRow } from './MeaningRow';
import { ScreenHero } from './ScreenHero';
import { ReviewCorrector } from './ReviewCorrector';

type Busy = null | 'transcribing' | 'analyzing';

export function NewReview({ onSaved }: { onSaved: () => void }) {
  const { lang, t } = useI18n();
  const [text, setText] = useState('');
  const [voice, setVoice] = useState<Blob | null>(null);
  const [speechLang, setSpeechLang] = useState<SpeechLanguage>('auto');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ review: Review; classification: Classification } | null>(null);
  const recorder = useRef(new Recorder());
  const fileInput = useRef<HTMLInputElement>(null);
  const player = usePlayer();
  const { clip } = useVoices();
  const { credential, can } = useVolunteer();
  const languageName = useLanguageName();
  const [correcting, setCorrecting] = useState(false);

  const voiceUrl = useObjectUrl(voice);
  const [fromShare, setFromShare] = useState(false);

  useEffect(() => {
    if (!wasShared()) return;
    void takeShared().then((shared) => {
      if (!shared) return;
      if (shared.text) setText(shared.text);
      if (shared.audio) setVoice(shared.audio);
      setFromShare(true);
    });
  }, []);

  async function toggleRecording() {
    setError(null);
    if (recording) {
      setVoice(await recorder.current.stop());
      setRecording(false);
      return;
    }
    try {
      await recorder.current.start();
      setRecording(true);
      setResult(null);
    } catch {
      setError(t('micError'));
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    setVoice(file);
    setResult(null);
    setError(null);
    setFromShare(false);
  }

  async function analyze() {
    setError(null);
    setCorrecting(false);
    player.stop();
    let reviewText = text.trim();
    let language: ReviewLanguage | undefined;
    try {
      if (voice) {
        setBusy('transcribing');
        let samples: Float32Array;
        try {
          samples = await decodeForWhisper(voice);
        } catch {
          throw new Error(t('decodeError'));
        }
        const transcript = await ml.transcribe(samples, speechLang);
        reviewText = transcript.text;
        language = transcript.language;
        setText(reviewText);
      }
      setBusy('analyzing');
      const classification = await ml.classify(reviewText);
      const review: Review = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        source: voice ? 'voice' : 'text',
        text: reviewText,
        audio: voice ?? undefined,
        language,
        selected: classification.selected,
        uncertain: classification.uncertain,
        topScores: classification.scores.slice(0, 5),
        modelClauses: classification.clauseGuesses?.map((c) => ({ ...c, score: Math.round(c.score * 1000) / 1000 })),
      };
      await saveReview(review);
      setResult({ review, classification });
      onSaved();
      player.play(classification.selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function toggleFlag() {
    if (!result) return;
    const review = { ...result.review, flagged: !result.review.flagged };
    await saveReview(review);
    setResult({ ...result, review });
    onSaved();
  }

  function reset() {
    player.stop();
    setCorrecting(false);
    setText('');
    setVoice(null);
    setResult(null);
    setError(null);
    setFromShare(false);
  }

  const needsAsrDownload = voice && !ml.wasDownloaded('asr');
  const needsEmbedderDownload = !ml.wasDownloaded('embedder');
  const firstDownloadMB =
    (needsAsrDownload ? ASR_MODEL.approxMB : 0) + (needsEmbedderDownload ? EMBEDDING_MODEL.approxMB : 0);
  const canAnalyze = !busy && !recording && (voice || text.trim());
  const playable = result?.review.selected.filter((id) => clip(id)) ?? [];

  return (
    <section className="panel input-panel">
      <ScreenHero eyebrow={t('newEyebrow')} title={t('newTitle')} intro={t('newIntro', { language: languageName })} />
      {fromShare && !result && <p className="shared-note">{t('sharedReceived')}</p>}
      <label className="field-label" htmlFor="review-text">
        {t('inputLabel')}
      </label>
      <textarea
        id="review-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('inputPlaceholder')}
        rows={5}
        disabled={!!busy || !!voice}
      />

      <div className="voice-controls">
        <button className={`outline ${recording ? 'recording' : ''}`} onClick={toggleRecording} disabled={!!busy}>
          {recording ? `■ ${t('stop')}` : `● ${t('record')}`}
        </button>
        <button className="outline" onClick={() => fileInput.current?.click()} disabled={!!busy || recording}>
          {t('upload')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="audio/*,.opus,.ogg,.m4a,.mp3,.wav,.aac"
          hidden
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <label className="speech-lang">
          {t('speechLanguage')}
          <select value={speechLang} onChange={(e) => setSpeechLang(e.target.value as SpeechLanguage)}>
            <option value="auto">{t('auto')}</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </label>
      </div>
      {!voice && !text && <WhatsAppHint />}

      {voice && voiceUrl && (
        <div className="voice-preview">
          <span>{t('voiceAttached')}</span>
          <audio controls src={voiceUrl} />
        </div>
      )}

      <div className="actions">
        <button className="primary" onClick={analyze} disabled={!canAnalyze}>
          {t('analyze')}
        </button>
        <button className="ghost" onClick={reset} disabled={!!busy}>
          {t('clear')}
        </button>
      </div>

      {firstDownloadMB > 0 && !busy && !result && (
        <p className="hint">{t('firstDownload', { mb: firstDownloadMB })}</p>
      )}
      {busy && <BusyIndicator busy={busy} />}
      {error && <p className="error">{error}</p>}

      {result && correcting && (
        <ReviewCorrector
          review={result.review}
          onCancel={() => setCorrecting(false)}
          onDone={(review) => {
            setCorrecting(false);
            setResult({ ...result, review });
            onSaved();
          }}
        />
      )}
      {result && !correcting && (
        <div className="result">
          <div className="result-head">
            <h2>{t('resultTitle')}</h2>
            {playable.length > 0 && (
              <button
                className="primary"
                onClick={() => (player.playing ? player.stop() : player.play(result.review.selected))}
              >
                {player.playing ? `■ ${t('stopPlayback')}` : `▶ ${t('playAll', { language: languageName })}`}
              </button>
            )}
          </div>
          {result.review.uncertain && <p className="uncertain">{t('uncertainNote')}</p>}
          {result.review.correctedBy && (
            <p className="hint">{t('correctedBy', { name: result.review.correctedBy })}</p>
          )}
          <ul className="meanings">
            {result.review.selected.map((id) => {
              const score = result.classification.scores.find((s) => s.id === id);
              return (
                <MeaningRow
                  key={id}
                  id={id}
                  playing={player.playing === id}
                  onPlay={() => player.play([id])}
                  onStop={player.stop}
                  detail={score && score.evidence !== result.review.text ? `${t('evidence')}: “${score.evidence}”` : undefined}
                />
              );
            })}
          </ul>
          <p className="saved">
            ✓ {t('saved')} · {new Date(result.review.createdAt).toLocaleString(lang)}
          </p>
          {can('correct') && result.review.text.trim() && (
            <button className="secondary" onClick={() => (player.stop(), setCorrecting(true))}>
              {t('wrongCorrect')}
            </button>
          )}
          {!credential && !result.review.correctedAt && (
            <button className="ghost" onClick={toggleFlag}>
              {result.review.flagged ? `✓ ${t('flaggedNote')}` : t('flagForVolunteer')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function WhatsAppHint() {
  const { t } = useI18n();
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = matchMedia('(display-mode: standalone)').matches;
  const key = ios ? 'whatsappHintIos' : !/Android/.test(ua) ? null : installed ? 'whatsappHintAndroid' : 'whatsappHintInstall';
  return key ? <p className="hint">{t(key)}</p> : null;
}

function BusyIndicator({ busy }: { busy: Exclude<Busy, null> }) {
  const { t } = useI18n();
  const model = busy === 'transcribing' ? 'asr' : 'embedder';
  const [state, setState] = useState(ml.states[model]);
  useEffect(() => {
    setState(ml.states[model]);
    return ml.subscribe((m, s) => m === model && setState(s));
  }, [model]);
  const pct = state.status === 'loading' && state.total ? Math.round((state.loaded / state.total) * 100) : null;
  return (
    <div className="busy">
      <span className="spinner" />
      {state.status === 'loading'
        ? `${t('downloading')}${pct !== null ? ` ${pct}%` : '…'}`
        : t(busy === 'transcribing' ? 'transcribing' : 'analyzing')}
      {pct !== null && <progress value={pct} max={100} />}
    </div>
  );
}