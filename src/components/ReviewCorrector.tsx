import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { reviewClauses } from '../lib/classifier';
import {
  deleteExamples,
  listExamples,
  saveExamples,
  saveReview,
  type ClauseLabel,
  type Review,
  type TrainingExample,
} from '../lib/db';
import { ml } from '../lib/ml';
import { FALLBACK_ID, type MeaningId } from '../lib/taxonomy';
import { useObjectUrl } from '../lib/useObjectUrl';
import { useVolunteer } from '../lib/volunteer';
import { MeaningSelect } from './MeaningSelect';

type Row = ClauseLabel;

const OVERALL = new Set([1, 2, 3]);

/** Meanings for the whole review from a person's per-part labels, following the same rules as the classifier. */
export function selectedFromLabels(rows: ClauseLabel[], overall: number): MeaningId[] {
  const labels = [...new Set(rows.map((r) => r.label).filter((l) => l > 0))];
  const feelings = overall ? [overall] : labels.filter((l) => OVERALL.has(l));
  const feeling = feelings.length > 1 ? 2 : feelings[0];
  const selected = [...(feeling ? [feeling] : []), ...labels.filter((l) => !OVERALL.has(l))] as MeaningId[];
  return selected.length ? selected : [FALLBACK_ID];
}

async function guessRows(text: string): Promise<Row[]> {
  if (!text.trim()) return [];
  const { clauseGuesses = [] } = await ml.classify(text);
  return clauseGuesses.length ? clauseGuesses : reviewClauses(text).map((t) => ({ text: t, label: 0 }));
}

/** Lets a guide or operator say what each part of a review really meant; every part becomes a training example. */
export function ReviewCorrector({
  review,
  onDone,
  onCancel,
}: {
  review: Review;
  onDone: (review: Review) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const name = useVolunteer().credential?.name;
  const audioUrl = useObjectUrl(review.audio ?? null);
  const [text, setText] = useState(review.text);
  const [rows, setRows] = useState<Row[] | null>(review.clauseLabels ?? review.modelClauses ?? null);
  const [splitText, setSplitText] = useState(review.text.trim());
  const [overall, setOverall] = useState<number>(
    review.overallLabel ?? review.selected.find((id) => OVERALL.has(id)) ?? 0,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rows) return;
    guessRows(review.text).then(setRows, (e: Error) => setError(e.message));
  }, [review.text, rows]);

  async function resplit() {
    if (text.trim() === splitText) return;
    setSplitText(text.trim());
    setRows(null);
    try {
      setRows(await guessRows(text));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function save() {
    if (!rows || !name) return;
    setSaving(true);
    try {
      const now = Date.now();
      const clauseLabels = rows.map(({ text, label }) => ({ text, label }));
      const examples: TrainingExample[] = clauseLabels.map((c) => ({
        id: crypto.randomUUID(),
        text: c.text,
        label: c.label,
        source: 'correction',
        reviewId: review.id,
        by: name,
        createdAt: now,
      }));
      if (rows.length > 1 && overall) {
        examples.push({
          id: crypto.randomUUID(),
          text: text.trim(),
          label: overall,
          source: 'correction',
          reviewId: review.id,
          by: name,
          createdAt: now,
        });
      }
      const previous = (await listExamples()).filter((e) => e.reviewId === review.id).map((e) => e.id);
      await deleteExamples(previous);
      await saveExamples(examples);
      const updated: Review = {
        ...review,
        text: text.trim(),
        selected: selectedFromLabels(clauseLabels, rows.length > 1 ? overall : 0),
        uncertain: false,
        flagged: false,
        modelSelected: review.modelSelected ?? review.selected,
        clauseLabels,
        overallLabel: rows.length > 1 && overall ? (overall as MeaningId) : undefined,
        correctedAt: now,
        correctedBy: name,
      };
      await saveReview(updated);
      onDone(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <div className="corrector">
      <h3>{t('correctTitle')}</h3>
      <p className="hint">{t('correctIntro')}</p>
      {audioUrl && (
        <div className="voice-preview">
          <span>{t('originalVoice')}</span>
          <audio controls src={audioUrl} />
        </div>
      )}
      <label className="field">
        <span>{t('transcriptEditable')}</span>
        <textarea value={text} rows={3} onChange={(e) => setText(e.target.value)} onBlur={resplit} />
      </label>

      {!rows && !error && (
        <div className="busy">
          <span className="spinner" />
          {t('analyzing')}
        </div>
      )}
      {rows && rows.length === 0 && <p className="hint">{t('nothingToCorrect')}</p>}
      {rows && rows.length > 0 && (
        <ol className="clause-list">
          {rows.map((row, i) => (
            <li key={`${i}-${row.text}`} className={row.score !== undefined && row.score < 0.5 ? 'unsure' : ''}>
              <q>{row.text}</q>
              <MeaningSelect
                value={row.label}
                label={row.text}
                onChange={(label) => setRows(rows.map((r, j) => (j === i ? { ...r, label, score: undefined } : r)))}
              />
            </li>
          ))}
        </ol>
      )}
      {rows && rows.length > 1 && (
        <label className="field">
          <span>{t('overallOfWhole')}</span>
          <MeaningSelect value={overall} onChange={setOverall} overallOnly />
        </label>
      )}

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="primary" onClick={save} disabled={!rows?.length || !name || saving}>
          {t('saveCorrection')}
        </button>
        <button className="ghost" onClick={onCancel} disabled={saving}>
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
