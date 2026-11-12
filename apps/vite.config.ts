// One config for the app build, the dev server and the tests: vitest/config's
// defineConfig is vite's, plus the `test` block below. PostCSS (Tailwind +
// autoprefixer) is configured inline too, so there's no separate
// postcss.config / vitest.config file.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import path from 'path'
import fs from 'fs'

// The single source of truth for the app version is package.json — the
// same value electron-builder stamps into the installer, latest.yml, and
// (via app.getVersion()) the Electron main process. Before this it was
// hand-copied into src/lib/i18n/en.ts, id.ts, and a JSX literal in
// Profile.tsx, and had already drifted (Profile said v1.0.0 while
// package.json said 1.1.3). __APP_VERSION__ (see src/lib/app/appVersion.ts and
// src/vite-env.d.ts) is now the only other place the number is written.
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')) as {
  version: string
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  css: {
    postcss: {
      plugins: [tailwindcss({ config: './config/tailwind.config.mjs' }), autoprefixer()],
    },
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
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    // Vitest's 5000ms default is fine uninstrumented, but V8 coverage
    // instrumentation (below) adds enough overhead to PBKDF2 (hashPassword,
    // used by password.ts/loginThrottle.ts/recoveryCode.ts/authStore's
    // signIn) to trip it under `--coverage` — a tooling artifact, not a
    // real slowdown or a reason to weaken the actual PBKDF2 work factor.
    // Costs nothing on the normal (uninstrumented) path: this is a ceiling,
    // not something tests wait out.
    testTimeout: 15000,
    // Feeds `fallow health --coverage coverage/coverage-final.json` real
    // numbers instead of its own static estimate — this project has 1500+
    // tests over src/lib, src/store, and server/, none of which fallow's
    // heuristic could see without an actual coverage run. React components
    // (src/pages, src/components) are excluded: there is no component-level
    // test tooling (no React Testing Library) in this project, so including
    // them would just report 0% everywhere they already show as
    // coverage_tier "none" — no new information, and a much slower run.
    coverage: {
      provider: 'v8',
      reporter: ['json'],
      include: ['src/lib/**', 'src/store/**', 'server/**'],
    },
  },
})
