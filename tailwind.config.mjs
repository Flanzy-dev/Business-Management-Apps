/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surya Baru primitive scale (DESIGN.md §1) — primary vocabulary going forward
        bg: {
          0: 'var(--bg-0)',
          1: 'var(--bg-1)',
          2: 'var(--bg-2)',
          3: 'var(--bg-3)',
          4: 'var(--bg-4)',
        },
        fg: {
          1: 'var(--fg-1)',
          2: 'var(--fg-2)',
          3: 'var(--fg-3)',
          inverse: 'var(--fg-inverse)',
        },
        border: {
          1: 'var(--border-1)',
          2: 'var(--border-2)',
          3: 'var(--border-3)',
          subtle: 'var(--border-subtle)', // legacy, repointed — see index.css
        },
        // DEFAULT uses rgb(var(...) / <alpha-value>) rather than a plain var()
        // reference so opacity modifiers (bg-accent/25, bg-danger/20, ...) work —
        // Tailwind can only generate those for colors it can resolve to RGB at
        // build time. The -rgb custom properties live in src/index.css.
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          hover: 'var(--accent-hover)',
          active: 'var(--accent-active)',
          muted: 'var(--accent-muted)',
          border: 'var(--accent-border)',
        },
        success: { DEFAULT: 'rgb(var(--success-rgb) / <alpha-value>)', muted: 'var(--success-muted)' },
        warning: { DEFAULT: 'rgb(var(--warning-rgb) / <alpha-value>)', muted: 'var(--warning-muted)' },
        danger: { DEFAULT: 'rgb(var(--danger-rgb) / <alpha-value>)', muted: 'var(--danger-muted)' },
        info: { DEFAULT: 'rgb(var(--info-rgb) / <alpha-value>)', muted: 'var(--info-muted)' },
        // Pre-existing 3-surface/2-text naming layer, kept as a permanent alias set
        // (not a migration shim) — used throughout the app alongside the bg-*/fg-*
        // primitives above. Repointed onto the new palette in index.css.
        surface: {
          canvas: 'var(--surface-canvas)',
          card: 'var(--surface-card)',
          sunken: 'var(--surface-sunken)',
          input: 'var(--surface-input)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
      },
      spacing: {
        'sidebar-icon': '72px',
        'sidebar-expanded': '200px',
        'card-padding': '24px',
        'card-gutter': '16px',
        'control-sm': '28px',
        'control-md': '34px',
        'control-lg': '40px',
        // Not part of DESIGN.md's size scale — added for shop-floor tablet
        // use (44px min touch target), mirroring Button.tsx's own `touch`
        // size. Added for symmetry with the trio above; Button/IconButton
        // write their actual sizes as arbitrary values (`h-[44px]`) rather
        // than referencing this token, since Tailwind's class scanner needs
        // literal strings and neither component references control-sm/md/lg
        // today either.
        'control-touch': '44px',
      },
      borderRadius: {
        // New Surya Baru radius scale (DESIGN.md §1) — deliberately namespaced under
        // `radius-*` rather than overriding Tailwind's own sm/md/lg/full, since those
        // built-ins are already used directly by several unrelated pages/components.
        'radius-xs': '4px',
        'radius-sm': '6px',
        'radius-md': '8px',
        'radius-lg': '12px',
        'radius-full': '9999px',
      },
      fontFamily: {
        // Self-hosted variable fonts (@fontsource-variable, imported in main.tsx);
        // the variable wght axis is what enables the 460/540 editorial sub-weights.
        sans: ['IBM Plex Sans Variable', 'IBM Plex Sans', 'Segoe UI', 'sans-serif'],
        display: ['Space Grotesk Variable', 'Space Grotesk', 'Segoe UI', 'sans-serif'],
        body: ['IBM Plex Sans Variable', 'IBM Plex Sans', 'Segoe UI', 'sans-serif'],
        mono: ['IBM Plex Mono', 'SF Mono', 'monospace'],
      },
      fontSize: {
        // New Surya Baru type scale (DESIGN.md §1). Overrides Tailwind's default
        // xs/sm/lg/xl/2xl/3xl/4xl/5xl intentionally — this is a full rebrand, and the
        // whole app should read off one consistent scale, not just DS components.
        '2xs': '11px',
        xs: '12px',
        sm: '13px',
        md: '14px',
        lg: '16px',
        xl: '20px',
        '2xl': '26px',
        '3xl': '34px',
        '4xl': '46px',
        '5xl': '64px',
        // Pre-existing named sizes, kept as permanent semantic aliases (page titles,
        // card titles, captions, KPI numbers) alongside the numeric scale above.
        // Editorial sub-weights (460/540) and tight display leading — variable-font
        // craft borrowed from DESIGN-superhuman.md; palette/canvas stay DESIGN.md.
        'page-title': ['24px', { lineHeight: '1.15', fontWeight: '540', letterSpacing: '-0.02em' }],
        'card-title': ['16px', { lineHeight: '24px', fontWeight: '540' }],
        'body': ['14px', { lineHeight: '20px', fontWeight: '460' }],
        'caption': ['12px', { lineHeight: '16px', fontWeight: '460' }],
        'kpi': ['28px', { lineHeight: '32px', fontWeight: '700' }],
      },
      lineHeight: {
        tight: '1.1',
        snug: '1.3',
        normal: '1.55',
      },
      letterSpacing: {
        tight: '-0.02em',
        normal: '0',
        wide: '0.08em',
      },
      // DEFAULT overrides Tailwind's own 150ms / cubic-bezier(0.4, 0, 0.2, 1)
      // (an ease-in-out, which starts slow — the wrong shape for a hover
      // response). Most `transition-colors` in the app are written bare, so
      // making the default *be* DESIGN.md §"Effects / motion" — 120ms ease-out —
      // is what actually reaches them; the named tokens below stay for the
      // sites that opt in explicitly.
      transitionDuration: {
        DEFAULT: '120ms',
        fast: '120ms',
        med: '200ms',
        slow: '320ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,.4)',
        md: '0 4px 12px rgba(0,0,0,.45)',
        lg: '0 12px 32px rgba(0,0,0,.55)',
        'glow-accent': '0 0 0 1px var(--accent-border), 0 4px 20px rgba(255,178,36,.15)',
      },
    },
  },
  plugins: [],
}
