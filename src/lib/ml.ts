import type { Classification } from './classifier';
import { getLocalModel } from './db';
import type { HeadWeights } from './trained-classifier';
import type {
  ModelKey,
  SpeechLanguage,
  TrainResult,
  Transcript,
  WorkerRequest,
  WorkerResponse,
} from './worker-protocol';

export type TrainProgress = (stage: 'embedding' | 'training', done: number, total: number) => void;

export type ModelState =
  | { status: 'idle' }
  | { status: 'loading'; loaded: number; total: number }
  | { status: 'ready' }
  | { status: 'error'; error: string };

type Listener = (model: ModelKey, state: ModelState) => void;
type RequestBody = WorkerRequest extends infer R ? (R extends WorkerRequest ? Omit<R, 'id'> : never) : never;

const READY_KEY = (model: ModelKey) => `echoloc:model-ready:${model}`;

class MlClient {
  private worker = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private listeners = new Set<Listener>();
  private trainProgress = new Map<number, TrainProgress>();
  readonly states: Record<ModelKey, ModelState> = { embedder: { status: 'idle' }, asr: { status: 'idle' } };
  /** A classifier retrained on this device survives reloads; reviews must not be classified before it is back. */
  private headRestored = getLocalModel()
    .then((m) => (m ? this.setHead(m.head) : null))
    .catch(() => null);

  constructor() {
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'progress':
          this.setState(msg.model, { status: 'loading', loaded: msg.loaded, total: msg.total });
          break;
        case 'ready':
          localStorage.setItem(READY_KEY(msg.model), '1');
          this.setState(msg.model, { status: 'ready' });
          break;
        case 'train-progress':
          this.trainProgress.get(msg.id)?.(msg.stage, msg.done, msg.total);
          break;
        case 'result':
          this.pending.get(msg.id)?.resolve(msg.data);
          this.pending.delete(msg.id);
          this.trainProgress.delete(msg.id);
          break;
        case 'error':
          this.pending.get(msg.id)?.reject(new Error(msg.error));
          this.pending.delete(msg.id);
          this.trainProgress.delete(msg.id);
          break;
      }
    };
  }

  /** Whether the model was fully downloaded on this device before. */
  wasDownloaded(model: ModelKey) {
    return localStorage.getItem(READY_KEY(model)) === '1';
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(model: ModelKey, state: ModelState) {
    this.states[model] = state;
    this.listeners.forEach((l) => l(model, state));
  }

  private request<T>(
    req: RequestBody,
    model: ModelKey | null,
    transfer: Transferable[] = [],
    onProgress?: TrainProgress,
  ): Promise<T> {
    const id = this.nextId++;
    if (model && this.states[model].status !== 'ready') this.setState(model, { status: 'loading', loaded: 0, total: 0 });
    if (onProgress) this.trainProgress.set(id, onProgress);
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject: (e) => {
          if (model && this.states[model].status !== 'ready') this.setState(model, { status: 'error', error: e.message });
          reject(e);
        },
      });
      this.worker.postMessage({ ...req, id } as WorkerRequest, transfer);
    });
  }

  load(model: ModelKey) {
    return this.request<null>({ type: 'load', model }, model);
  }

  async classify(text: string) {
    await this.headRestored;
    return this.request<Classification>({ type: 'classify', text }, 'embedder');
  }

  transcribe(audio: Float32Array, language: SpeechLanguage) {
    return this.request<Transcript>({ type: 'transcribe', audio, language }, 'asr', [audio.buffer]);
  }

  /** Switches the worker to a locally retrained classifier, or back to the built-in one with null. */
  setHead(head: HeadWeights | null) {
    return this.request<null>({ type: 'set-head', head }, null);
  }

  train(examples: { text: string; label: number }[], onProgress?: TrainProgress) {
    return this.request<TrainResult>({ type: 'train', examples }, 'embedder', [], onProgress);
  }
}

export const ml = new MlClient();
