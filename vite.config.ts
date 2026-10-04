import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'audio/**/*', 'training/*'],
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
      },
      workbox: {
        // training/* is the built-in example set used to retrain the classifier offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,m4a,mp3,wav,ogg,webm}', 'training/*'],
        // The ONNX runtime (public/ort) is cached by Transformers.js itself on first use.
        globIgnores: ['ort/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
});
