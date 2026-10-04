import type { Classification } from './classifier';
import type { HeadWeights } from './trained-classifier';

export type ModelKey = 'embedder' | 'asr';
export type ReviewLanguage = 'en' | 'fr';
export type SpeechLanguage = 'auto' | ReviewLanguage;

export interface Transcript {
  text: string;
  language: ReviewLanguage;
}

export interface TrainResult {
  head: HeadWeights;
  exampleCount: number;
}

export type WorkerRequest =
  | { id: number; type: 'load'; model: ModelKey }
  | { id: number; type: 'classify'; text: string }
  | { id: number; type: 'transcribe'; audio: Float32Array; language: SpeechLanguage }
  /** null restores the built-in classifier. */
  | { id: number; type: 'set-head'; head: HeadWeights | null }
  | { id: number; type: 'train'; examples: { text: string; label: number }[] };

export type WorkerResponse =
  | { type: 'progress'; model: ModelKey; loaded: number; total: number }
  | { type: 'ready'; model: ModelKey }
  | { type: 'train-progress'; id: number; stage: 'embedding' | 'training'; done: number; total: number }
  | { type: 'result'; id: number; data: Classification | Transcript | TrainResult | null }
  | { type: 'error'; id: number; error: string };
