// Loaded into the generated service worker (see workbox.importScripts in vite.config.ts).
// Receives what a host shares from WhatsApp (or any app) on Android, keeps it until the
// page picks it up via src/lib/shared-inbox.ts, then opens New review.
const SHARE_CACHE = 'sabiecho-share';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || !url.pathname.endsWith('/share-target')) return;
  event.respondWith(
    (async () => {
      const form = await event.request.formData();
      const cache = await caches.open(SHARE_CACHE);
      await Promise.all((await cache.keys()).map((key) => cache.delete(key)));
      const text = ['title', 'text', 'url']
        .map((field) => String(form.get(field) ?? '').trim())
        .filter((value, i, all) => value && all.indexOf(value) === i)
        .join('\n');
      if (text) await cache.put('shared/text', new Response(text));
      const audio = form.getAll('audio').find((file) => file instanceof File && file.size > 0);
      if (audio) {
        await cache.put(
          'shared/audio',
          new Response(audio, {
            headers: { 'content-type': audio.type || 'audio/ogg', 'x-filename': encodeURIComponent(audio.name || 'voice-note.opus') },
          }),
        );
      }
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })(),
  );
});
