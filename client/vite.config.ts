import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const API = `http://localhost:${process.env.API_PORT ?? 4000}`;

export default defineConfig({
  plugins: [
    react(),
    // PWA: installable, caches the app shell + last-seen board data for offline viewing.
    // New requests made offline are queued in localStorage (src/lib/offlineQueue.ts).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Relay - Community emergency support',
        short_name: 'Relay',
        description: 'Post and fulfil urgent non-medical needs during local emergencies.',
        theme_color: '#1c6159',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/board',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Board data, request details, current user and filter metadata:
            // always try the network, fall back to the last cached copy when offline.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /^\/api\/(requests|auth\/me|meta)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'relay-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 400, maxAgeSeconds: 14 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts' },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    // Same-origin API calls in dev so the httpOnly auth cookie just works.
    proxy: {
      '/api': API,
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': API,
    },
  },
});
