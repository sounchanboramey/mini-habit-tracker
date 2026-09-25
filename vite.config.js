import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt" = show our UpdateToast instead of silently replacing the SW
      registerType: 'prompt',

      // Include these files in the precache manifest (app shell)
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],

      manifest: {
        name: 'little by little',
        short_name: 'Habits',
        description: 'A gentle daily habit tracker',
        theme_color: '#315c49',
        background_color: '#f7f8f3',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },

      workbox: {
        // ── Caching strategies (hand-written decisions) ──────────────────
        //
        // App shell (JS, CSS, HTML) → precached automatically by VitePWA.
        // Reason: static assets never change between deploys; always fast.
        //
        // Google Fonts → StaleWhileRevalidate (cache-first with bg update).
        // Reason: fonts are immutable; serve instantly, refresh silently.
        //
        // Supabase API → NetworkFirst with 5s timeout, then cache fallback.
        // Reason: habit data must be current; only use cache when truly offline.
        //
        // Supabase Storage (avatars) → CacheFirst with 30-day expiry.
        // Reason: avatar paths are stable (upsert replaces same key); safe to cache.

        runtimeCaching: [
          {
            // Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Google Fonts files (woff2 etc.)
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase REST API — network-first, fallback to cache when offline
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase Storage (avatars) — cache-first, stable paths
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
