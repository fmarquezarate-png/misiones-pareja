import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png',          sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        // Accesos directos al mantener pulsado el icono de la app (Android/desktop).
        // iOS no soporta shortcuts de PWA — allí el equivalente es el badge del icono.
        shortcuts: [
          { name: 'Añadir tarea o evento', short_name: 'Añadir',     url: '/?action=add',    icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Semana actual',         short_name: 'Semana',     url: '/?tab=current',   icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Chat',                  short_name: 'Chat',       url: '/?tab=chat',      icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Calendario',            short_name: 'Calendario', url: '/?tab=calendar',  icons: [{ src: '/icon-192.png', sizes: '192x192' }] }
        ]
      }
    })
  ]
})
