import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import {
  deleteExamples,
  getLocalModel,
  listExamples,
  needsVolunteer,
  saveExamples,
  setLocalModel,
  type LocalModel,
  type Review,
  type TrainingExample,
} from '../lib/db';
import { downloadBlob, exportImprovements, importFile } from '../lib/improvements-file';
import { getLanguage, languageName } from '../lib/languages';
import { ml } from '../lib/ml';
import { getMeaning, type MeaningId } from '../lib/taxonomy';
import { usePlayer } from '../lib/usePlayer';
import { useVoices } from '../lib/voice-library';
import { useVolunteer } from '../lib/volunteer';
import { MeaningSelect } from './MeaningSelect';
import { Recordings } from './Recordings';
import { ReviewItem } from './ReviewsList';
import { ScreenHero } from './ScreenHero';

type Section = 'reviews' | 'teach' | 'recordings' | 'share';

export function ImprovePanel({ reviews, onChange }: { reviews: Review[]; onChange: () => void }) {
  const { lang, t } = useI18n();
  const [section, setSection] = useState<Section>('reviews');
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [model, setModel] = useState<LocalModel | null>(null);
  const { recordings, refresh: refreshRecordings } = useVoices();
  const { credential, can } = useVolunteer();

  const refresh = useCallback(async () => {
    const [ex, m] = await Promise.all([listExamples(), getLocalModel()]);
    setExamples(ex);
    setModel(m ?? null);
  }, []);
  useEffect(() => void refresh(), [refresh, reviews]);

  const toCheck = reviews.filter(needsVolunteer);
  const pendingVetting = recordings.filter((r) => r.status === 'pending' && can('vet', r.language)).length;
  const SECTIONS: { id: Section; label: string; badge?: number; show: boolean }[] = [
    { id: 'reviews', label: t('improveReviews'), badge: toCheck.length, show: can('correct') },
    { id: 'teach', label: t('improveTeach'), show: can('correct') },
    { id: 'recordings', label: t('improveRecordings'), badge: pendingVetting, show: can('record') || can('vet') },
    { id: 'share', label: t('improveShare'), show: true },
  ];
  const visible = SECTIONS.filter((s) => s.show);
  const active = visible.some((s) => s.id === section) ? section : visible[0].id;
  if (!credential) return null;

  return (
    <section className="panel improve">
      <ScreenHero eyebrow={t('improveEyebrow')} title={t('improveTitle')} intro={t('improveIntro')} />
      <div className="volunteer-card">
        <strong>{t('signedInAs', { name: credential.name })}</strong>
        <div className="hint">
          {credential.languages.map((code) => languageName(getLanguage(code), lang)).join(', ')} ·{' '}
          {credential.roles.map((r) => t(`role_${r}`)).join(', ')}
        </div>
      </div>
      {can('correct') && <ModelStatus examples={examples} model={model} onChange={refresh} />}
      <nav className="subtabs">
        {visible.map((s) => (
          <button key={s.id} className={active === s.id ? 'active' : ''} onClick={() => setSection(s.id)}>
            {s.label}
            {!!s.badge && <span className="badge">{s.badge}</span>}
          </button>
        ))}
      </nav>
      {active === 'reviews' && <ReviewQueue reviews={toCheck} onChange={onChange} />}
      {active === 'teach' && <Teach examples={examples} onChange={refresh} />}
      {active === 'recordings' && <Recordings />}
      {active === 'share' && (
        <Share
          onImported={async () => {
            await Promise.all([refresh(), refreshRecordings()]);
            onChange();
          }}
        />
      )}
    </section>
  );
}

function ModelStatus({
  examples,
  model,
  onChange,
}: {
  examples: TrainingExample[];
  model: LocalModel | null;
  onChange: () => Promise<void>;
}) {
  const { lang, t } = useI18n();
  const [progress, setProgress] = useState<{ stage: 'embedding' | 'training'; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const newSince = examples.filter((e) => !model || e.createdAt > model.trainedAt).length;

  async function retrain() {
    setError(null);
    setProgress({ stage: 'embedding', pct: 0 });
    try {
      const all = await listExamples();
      const result = await ml.train(
        all.map(({ text, label }) => ({ text, label })),
        (stage, done, total) => setProgress({ stage, pct: total ? Math.round((done / total) * 100) : 0 }),
      );
      await setLocalModel({ head: result.head, trainedAt: Date.now(), exampleCount: result.exampleCount });
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  }

  async function reset() {
    if (!confirm(t('resetConfirm'))) return;
    await ml.setHead(null);
    await setLocalModel(null);
    await onChange();
  }

  return (
    <div className="model-status">
      <div>
        <strong>{model ? t('modelImproved') : t('modelBuiltIn')}</strong>
        <div className="hint">
          {model
            ? t('modelImprovedDetail', {
                date: new Date(model.trainedAt).toLocaleString(lang),
                n: model.exampleCount,
              })
            : t('modelBuiltInDetail')}
        </div>
        {newSince > 0 && <div className="pending-note">{t('newExamples', { n: newSince })}</div>}
      </div>
      <div className="model-actions">
        <button className="primary" onClick={retrain} disabled={!!progress || examples.length === 0}>
          {t('retrain')}
        </button>
        {model && (
          <button className="ghost" onClick={reset} disabled={!!progress}>
            {t('resetModel')}
          </button>
        )}
      </div>
      {progress && (
        <div className="busy">
          <span className="spinner" />
          {t(progress.stage === 'embedding' ? 'trainEmbedding' : 'trainTraining')} {progress.pct}%
          <progress value={progress.pct} max={100} />
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function ReviewQueue({ reviews, onChange }: { reviews: Review[]; onChange: () => void }) {
  const { t } = useI18n();
  const player = usePlayer();
  return (
    <>
      <p className="hint">{t('queueIntro')}</p>
      {reviews.length === 0 ? (
        <p className="empty">{t('queueEmpty')}</p>
      ) : (
        <ul className="reviews">
          {reviews.map((r) => (
            <ReviewItem
              key={r.id}
              review={r}
              playing={player.playing !== null && r.selected.includes(player.playing)}
              onPlay={() => player.play(r.selected)}
              onStop={player.stop}
              onChange={onChange}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function Teach({ examples, onChange }: { examples: TrainingExample[]; onChange: () => Promise<void> }) {
  const { lang, t } = useI18n();
  const name = useVolunteer().credential?.name;
  const [text, setText] = useState('');
  const [label, setLabel] = useState(0);

  async function add() {
    if (!text.trim() || !name) return;
    await saveExamples([
      { id: crypto.randomUUID(), text: text.trim(), label, source: 'manual', by: name, createdAt: Date.now() },
    ]);
    setText('');
    await onChange();
  }

  const labelText = (l: number) => {
    if (l === 0) return t('noneOfThese');
    const m = getMeaning(l as MeaningId);
    return `${l}. ${lang === 'fr' ? m.fr : m.en}`;
  };

  return (
    <>
      <p className="hint">{t('teachIntro')}</p>
      <div className="teach-form">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={t('teachPlaceholder')} />
        <MeaningSelect value={label} onChange={setLabel} />
        <button className="primary" onClick={add} disabled={!text.trim() || !name}>
          {t('addExample')}
        </button>
      </div>
      <h3>{t('examplesOnDevice', { n: examples.length })}</h3>
      {examples.length === 0 ? (
        <p className="empty">{t('examplesEmpty')}</p>
      ) : (
        <ul className="examples">
          {examples.map((e) => (
            <li key={e.id}>
              <q>{e.text}</q>
              <span className="chip">{labelText(e.label)}</span>
              <span className="example-meta">
                {t(e.source === 'correction' ? 'fromCorrection' : 'fromTeach')}
                {e.by && ` · ${e.by}`}
              </span>
              <button
                className="ghost danger small"
                onClick={async () => {
                  await deleteExamples([e.id]);
                  await onChange();
                }}
                aria-label={t('delete')}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Share({ onImported }: { onImported: () => Promise<void> }) {
  const { t } = useI18n();
  const name = useVolunteer().credential?.name ?? '';
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function doExport() {
    const blob = await exportImprovements(name);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `sabiecho-improvements-${stamp}${name ? `-${name.replace(/\W+/g, '_')}` : ''}.json`);
  }

  async function doImport(file: File) {
    try {
      const result = await importFile(file);
      const text =
        result.kind === 'reviews'
          ? t('importReviewsDone', { n: result.reviews })
          : t('importDone', { examples: result.examples, recordings: result.recordings }) +
            (result.rejected.length ? ` ${t('importRejected', { n: result.rejected.length })}\n${result.rejected.join('\n')}` : '');
      setMessage({ ok: true, text });
      await onImported();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <>
      <p className="hint">{t('shareIntro')}</p>
      <div className="actions">
        <button className="primary" onClick={doExport}>
          {t('exportFile')}
        </button>
        <button className="secondary" onClick={() => fileInput.current?.click()}>
          {t('importFile')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void doImport(file);
            e.target.value = '';
          }}
        />
      </div>
      {message && <p className={`${message.ok ? 'saved' : 'error'} preline`}>{message.text}</p>}
    </>
  );
}
