import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/misiones-pareja/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectManifest: {
        globIgnores: ['**/version.json'],
      },
      manifest: {
        name: 'Shared Calendar',
        short_name: 'Shared Cal',
        description: 'Shared weekly planning for couples',
        theme_color: '#0a0714',
        background_color: '#0a0714',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/misiones-pareja/',
        start_url: '/misiones-pareja/',
        icons: [
          { src: '/misiones-pareja/icon-192.png',          sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/misiones-pareja/icon-512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/misiones-pareja/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/misiones-pareja/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
