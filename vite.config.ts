import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  base: './',
  // Bind the dev server to the LAN so the shop tablet can reach it without
  // passing --host every time. strictPort keeps the URL stable at :5173 —
  // without it Vite silently walks to 5174 when the port is busy, which
  // breaks a bookmarked tablet URL. It fails loudly instead.
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // In dev, the shop's actual data lives behind the LAN server embedded in
    // the Electron main process (electron/main.ts), not this dev server. A
    // tablet still only ever talks to the URL it bookmarked — Vite forwards
    // anything under /api straight through to Electron's server (also on
    // localhost, since Electron and `vite`/electron:dev run on the same
    // shop PC) so the app's own fetch('/api/...') calls need no dev/prod
    // branching.
    proxy: {
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true
  },
  build: {
    outDir: 'dist'
  }
})
