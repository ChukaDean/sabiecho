/** Must match SHARE_CACHE in public/share-target.js. */
const SHARE_CACHE = 'sabiecho-share';

export type Shared = { text?: string; audio?: File };

/** True when the page was opened by sharing something to SabiEcho. */
export function wasShared(): boolean {
  return new URLSearchParams(location.search).has('shared');
}

/** Returns what was shared to SabiEcho, once, and clears it. */
export async function takeShared(): Promise<Shared | null> {
  const params = new URLSearchParams(location.search);
  params.delete('shared');
  const query = params.toString();
  history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
  if (!('caches' in window)) return null;
  const cache = await caches.open(SHARE_CACHE);
  const [textResponse, audioResponse] = await Promise.all([cache.match('shared/text'), cache.match('shared/audio')]);
  const shared: Shared = {};
  if (textResponse) shared.text = (await textResponse.text()).trim() || undefined;
  if (audioResponse) {
    const blob = await audioResponse.blob();
    const name = decodeURIComponent(audioResponse.headers.get('x-filename') ?? 'voice-note.opus');
    shared.audio = new File([blob], name, { type: blob.type });
  }
  await Promise.all([cache.delete('shared/text'), cache.delete('shared/audio')]);
  return shared.text || shared.audio ? shared : null;
}
