import { openDB, type DBSchema } from 'idb';
import type { MeaningScore } from './classifier';
import type { MeaningId } from './taxonomy';
import type { HeadWeights } from './trained-classifier';
import type { ReviewLanguage } from './worker-protocol';

export interface ClauseLabel {
  text: string;
  /** 0 = not about any supported meaning. */
  label: number;
  /** Classifier confidence, for its own guesses only. */
  score?: number;
}

export interface Review {
  id: string;
  createdAt: number;
  source: 'text' | 'voice';
  text: string;
  /** Original voice note, kept so a person can listen to it later. */
  audio?: Blob;
  /** Spoken language detected or chosen for voice reviews. */
  language?: ReviewLanguage;
  /** Current meanings: the classifier's output, or the operator's correction. */
  selected: MeaningId[];
  uncertain: boolean;
  topScores: MeaningScore[];
  /** The classifier's best guess for each part of the review. */
  modelClauses?: ClauseLabel[];
  /** What the classifier originally said, kept once a person corrects the review. */
  modelSelected?: MeaningId[];
  /** A person's labels for each part of the review. */
  clauseLabels?: ClauseLabel[];
  /** A person's overall feeling for the whole review (1–3), when it has several parts. */
  overallLabel?: MeaningId;
  correctedAt?: number;
  correctedBy?: string;
  /** The host thinks SabiEcho got this one wrong and wants a volunteer to check it. */
  flagged?: boolean;
  /** When the host last sent it to volunteers for checking. */
  sharedAt?: number;
  /** Set on a volunteer's device when the review came from a host's file. */
  importedAt?: number;
}

/** Reviews a volunteer should look at: SabiEcho was unsure or the host flagged it, and nobody has corrected it. */
export const needsVolunteer = (r: Review) => (r.uncertain || !!r.flagged) && !r.correctedAt;

export interface TrainingExample {
  id: string;
  text: string;
  label: number;
  source: 'correction' | 'manual';
  reviewId?: string;
  by?: string;
  createdAt: number;
}

export type RecordingStatus = 'pending' | 'approved' | 'rejected';

export interface VoiceRecording {
  id: string;
  /** Local language code, see languages.ts. */
  language: string;
  meaningId: MeaningId;
  audio: Blob;
  /** The message written in the local language, as spoken; may be empty for mostly oral languages. */
  text: string;
  status: RecordingStatus;
  recordedBy: string;
  createdAt: number;
  vettedBy?: string;
  vettedAt?: number;
}

export interface LocalModel {
  head: HeadWeights;
  trainedAt: number;
  exampleCount: number;
}

interface SabiEchoDB extends DBSchema {
  reviews: { key: string; value: Review; indexes: { createdAt: number } };
  examples: { key: string; value: TrainingExample; indexes: { createdAt: number } };
  recordings: { key: string; value: VoiceRecording; indexes: { createdAt: number } };
  settings: { key: string; value: unknown };
}

// Storage names (this database and the `echoloc:` localStorage keys) predate the SabiEcho rename;
// changing them would orphan the reviews, recordings and sign-ins already saved on devices.
const dbPromise = openDB<SabiEchoDB>('echoloc', 3, {
  async upgrade(db, oldVersion, _newVersion, tx) {
    if (oldVersion < 1) {
      db.createObjectStore('reviews', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
    }
    if (oldVersion < 2) {
      db.createObjectStore('examples', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      db.createObjectStore('recordings', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      db.createObjectStore('settings');
    }
    if (oldVersion === 2) {
      // Version 2 recordings were all Fon, with the text in `fonText`.
      let cursor = await tx.objectStore('recordings').openCursor();
      while (cursor) {
        const { fonText, ...rest } = cursor.value as VoiceRecording & { fonText?: string };
        await cursor.update({ ...rest, language: rest.language ?? 'fon', text: rest.text ?? fonText ?? '' });
        cursor = await cursor.continue();
      }
    }
  },
});

export async function saveReview(review: Review) {
  await (await dbPromise).put('reviews', review);
}

export async function listReviews(): Promise<Review[]> {
  return (await (await dbPromise).getAllFromIndex('reviews', 'createdAt')).reverse();
}

export async function deleteReview(id: string) {
  await (await dbPromise).delete('reviews', id);
}

export async function saveExamples(examples: TrainingExample[]) {
  const tx = (await dbPromise).transaction('examples', 'readwrite');
  await Promise.all([...examples.map((e) => tx.store.put(e)), tx.done]);
}

export async function listExamples(): Promise<TrainingExample[]> {
  return (await (await dbPromise).getAllFromIndex('examples', 'createdAt')).reverse();
}

export async function deleteExamples(ids: string[]) {
  const tx = (await dbPromise).transaction('examples', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

export async function saveRecording(recording: VoiceRecording) {
  await (await dbPromise).put('recordings', recording);
}

export async function listRecordings(): Promise<VoiceRecording[]> {
  return (await (await dbPromise).getAllFromIndex('recordings', 'createdAt')).reverse();
}

export async function deleteRecording(id: string) {
  await (await dbPromise).delete('recordings', id);
}

export async function getLocalModel(): Promise<LocalModel | undefined> {
  return (await (await dbPromise).get('settings', 'localModel')) as LocalModel | undefined;
}

export async function setLocalModel(model: LocalModel | null) {
  const db = await dbPromise;
  if (model) await db.put('settings', model, 'localModel');
  else await db.delete('settings', 'localModel');
}
