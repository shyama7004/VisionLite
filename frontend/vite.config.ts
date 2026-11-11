import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// HTTPS=1 turns on a self signed certificate so a phone on the same Wi-Fi can use the camera.
const https = process.env.HTTPS === '1'

export default defineConfig({
  plugins: [
    react(),
    https ? basicSsl() : null,
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'VisionLite',
        short_name: 'VisionLite',
        description: 'Phone based eye screening',
        theme_color: '#0b5cab',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Precache static files only (app, camera model, wasm). Never the API.
        globPatterns: ['**/*.{js,css,html,png,svg,json,wasm,task}'],
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [],
      },
    }),
  ],
  server: { host: true, port: 5173, proxy: { '/api': 'http://localhost:8000' } },
  preview: { port: 4173, proxy: { '/api': 'http://localhost:8000' } },
})
