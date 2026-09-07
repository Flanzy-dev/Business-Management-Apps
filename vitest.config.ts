import { defineConfig } from 'vitest/config'

export default defineConfig({
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
