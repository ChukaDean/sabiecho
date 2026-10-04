import builtInRecordings from './recordings.json';

/** Must match the runtime cache name for audio in vite.config.ts, so the service worker plays from it offline. */
export const VOICE_CACHE = 'sabiecho-voices';

/** Shipped clips average about 95 KB each. */
const APPROX_MB_PER_CLIP = 0.1;

export type VoicePackState =
  | { status: 'idle' | 'ready'; done: number; total: number }
  | { status: 'downloading'; done: number; total: number }
  | { status: 'error'; done: number; total: number; error: string };

const BUILT_IN = builtInRecordings as Record<string, Partial<Record<string, { text: string; audio?: string }>>>;

function packUrls(code: string): string[] {
  return Object.values(BUILT_IN[code] ?? {})
    .flatMap((entry) => (entry?.audio ? [new URL(`${import.meta.env.BASE_URL}${entry.audio}`, location.href).href] : []))
    .filter((url, i, all) => all.indexOf(url) === i);
}

export function packSizeMB(code: string): number {
  return Math.max(0.1, Math.round(packUrls(code).length * APPROX_MB_PER_CLIP * 10) / 10);
}

const states = new Map<string, VoicePackState>();
const listeners = new Set<(code: string, state: VoicePackState) => void>();
const running = new Map<string, Promise<void>>();

function set(code: string, state: VoicePackState) {
  states.set(code, state);
  listeners.forEach((l) => l(code, state));
}

export const voicePack = {
  state(code: string): VoicePackState {
    return states.get(code) ?? { status: 'idle', done: 0, total: packUrls(code).length };
  },

  subscribe(listener: (code: string, state: VoicePackState) => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },

  /** Reads which of a language's clips are already saved on this device. */
  async check(code: string): Promise<VoicePackState> {
    const urls = packUrls(code);
    if (!('caches' in window) || urls.length === 0) return voicePack.state(code);
    if (running.has(code)) return voicePack.state(code);
    const cache = await caches.open(VOICE_CACHE);
    const hits = await Promise.all(urls.map((u) => cache.match(u)));
    const done = hits.filter(Boolean).length;
    const state: VoicePackState = { status: done === urls.length ? 'ready' : 'idle', done, total: urls.length };
    set(code, state);
    return state;
  },

  /** Saves every shipped clip for a language. Safe to call repeatedly; only missing clips are fetched. */
  download(code: string): Promise<void> {
    const existing = running.get(code);
    if (existing) return existing;
    const job = (async () => {
      const urls = packUrls(code);
      if (!('caches' in window) || urls.length === 0) return;
      const cache = await caches.open(VOICE_CACHE);
      let done = 0;
      try {
        for (const url of urls) {
          if (!(await cache.match(url))) {
            set(code, { status: 'downloading', done, total: urls.length });
            const response = await fetch(url, { cache: 'no-cache' });
            if (!response.ok) throw new Error(`${response.status} ${url}`);
            await cache.put(url, response);
          }
          done++;
        }
        set(code, { status: 'ready', done, total: urls.length });
      } catch (e) {
        set(code, { status: 'error', done, total: urls.length, error: e instanceof Error ? e.message : String(e) });
      }
    })().finally(() => running.delete(code));
    running.set(code, job);
    return job;
  },
};
