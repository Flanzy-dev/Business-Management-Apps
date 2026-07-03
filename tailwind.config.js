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
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          active: 'var(--accent-active)',
          muted: 'var(--accent-muted)',
          border: 'var(--accent-border)',
          // legacy multi-hue names, repointed onto the new single-accent model — see index.css
          mint: 'var(--accent-mint)',
          amber: 'var(--accent-amber)',
          blue: 'var(--accent-blue)',
          lavender: 'var(--accent-lavender)',
          critical: 'var(--accent-critical)',
          'critical-bg': 'var(--accent-critical-bg)',
        },
        success: { DEFAULT: 'var(--success)', muted: 'var(--success-muted)' },
        warning: { DEFAULT: 'var(--warning)', muted: 'var(--warning-muted)' },
        danger: { DEFAULT: 'var(--danger)', muted: 'var(--danger-muted)' },
        info: { DEFAULT: 'var(--info)', muted: 'var(--info-muted)' },
        status: {
          // legacy aliases, unchanged mechanism — still point at the accent.* CSS vars
          available: 'var(--accent-mint)',
          'in-progress': 'var(--accent-amber)',
          'on-hold': 'var(--accent-blue)',
          'awaiting-parts': 'var(--accent-critical)',
        },
        // Legacy 3-surface/2-text names — kept temporarily so unmigrated class names
        // keep rendering (with new colors) until each call site is moved to bg-*/fg-*.
        // Remove once Phase 7/8 confirm zero remaining references.
        surface: {
          canvas: 'var(--surface-canvas)',
          card: 'var(--surface-card)',
          sunken: 'var(--surface-sunken)',
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
        // Legacy names, repointed to their closest new-scale equivalent so existing
        // markup keeps rendering sensibly until migrated (card/tile/pill removed in Phase 8).
        card: '8px',
        tile: '6px',
        pill: '9999px',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'Segoe UI', 'sans-serif'],
        display: ['Space Grotesk', 'Segoe UI', 'sans-serif'],
        body: ['IBM Plex Sans', 'Segoe UI', 'sans-serif'],
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
        // Legacy named sizes, kept temporarily for unmigrated call sites (removed Phase 8).
        'page-title': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'card-title': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '16px', fontWeight: '500' }],
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
      transitionDuration: {
        fast: '120ms',
        med: '200ms',
        slow: '320ms',
      },
      transitionTimingFunction: {
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
