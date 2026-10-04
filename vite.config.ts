import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'training/*'],
      manifest: {
        name: 'SabiEcho',
        short_name: 'SabiEcho',
        description: 'Global visitors. Local understanding.',
        lang: 'en',
        theme_color: '#0D1321',
        background_color: '#F7F1E5',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Puts SabiEcho in the Android share sheet (WhatsApp voice notes and messages). iOS does not support this.
        share_target: {
          action: './share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [{ name: 'audio', accept: ['audio/*', '.opus', '.ogg', '.m4a', '.mp3', '.aac', '.wav'] }],
          },
        },
      },
      workbox: {
        // training/* is the built-in example set used to retrain the classifier offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}', 'training/*'],
        // The ONNX runtime (public/ort) is cached by Transformers.js itself on first use.
        globIgnores: ['ort/**'],
        importScripts: ['share-target.js'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Recordings are saved per language by src/lib/voice-pack.ts into this cache, not precached for every
        // language. Range support lets iOS Safari, which requests audio in byte ranges, play them offline.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/audio/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'sabiecho-voices',
              rangeRequests: true,
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
});
