import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globIgnores: [
          '**/assets/ort-wasm*',
          '**/assets/*transformers*',
        ],
        navigateFallbackDenylist: [/^\/api\//, /googleapis\.com/, /accounts\.google\.com/, /huggingface\.co/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(www|upload|content)\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
            options: { cacheName: 'no-cache-googleapis' },
          },
          {
            urlPattern: /^https:\/\/accounts\.google\.com\/.*/i,
            handler: 'NetworkOnly',
            options: { cacheName: 'no-cache-google-accounts' },
          },
          {
            urlPattern: /^https:\/\/huggingface\.co\/.*\.(onnx|json|bin|txt)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'whisper-model',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 90 },
              rangeRequests: true,
            },
          },
          {
            urlPattern: /^https:\/\/cdn-lfs(-[a-z0-9]+)?\.huggingface\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'whisper-model-lfs',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 90 },
              rangeRequests: true,
            },
          },
        ],
      },
      manifest: {
        name: 'Chantier Notes',
        short_name: 'Chantier',
        description: 'Dictée vocale et transcription pour notes de chantier, sync Google Drive.',
        theme_color: '#0b5394',
        background_color: '#0b5394',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'fr',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
