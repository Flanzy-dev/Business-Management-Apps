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
        surface: {
          canvas: 'var(--surface-canvas)',
          card: 'var(--surface-card)',
          sunken: 'var(--surface-sunken)',
        },
        border: {
          subtle: 'var(--border-subtle)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
        accent: {
          mint: 'var(--accent-mint)',
          amber: 'var(--accent-amber)',
          blue: 'var(--accent-blue)',
          lavender: 'var(--accent-lavender)',
          critical: 'var(--accent-critical)',
          'critical-bg': 'var(--accent-critical-bg)',
        },
        status: {
          available: 'var(--accent-mint)',
          'in-progress': 'var(--accent-amber)',
          'on-hold': 'var(--accent-blue)',
          'awaiting-parts': 'var(--accent-critical)',
        },
      },
      spacing: {
        'sidebar-icon': '72px',
        'sidebar-expanded': '200px',
        'card-padding': '24px',
        'card-gutter': '16px',
      },
      borderRadius: {
        'card': '16px',
        'tile': '8px',
        'pill': '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'page-title': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'card-title': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'kpi': ['28px', { lineHeight: '32px', fontWeight: '700' }],
      },
    },
  },
  plugins: [],
}
