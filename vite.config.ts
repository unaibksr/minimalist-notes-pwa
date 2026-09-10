import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
       registerType: 'autoUpdate',
       includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
       injectRegister: 'auto',
       workbox: {
         globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
       },
       manifest: {
         name: 'Minimal Notes',
         short_name: 'Notes',
         description: 'A minimalist, mobile-first rich-text notes app with offline sync.',
         theme_color: '#faf8f5',
         background_color: '#faf8f5',
         display: 'standalone',
         orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});
