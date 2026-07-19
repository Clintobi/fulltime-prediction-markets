/** @type {import('tailwindcss').Config} */
// Tokens are the hard constraints from DESIGN_BRIEF.md — do not add colors/fonts
// outside this map; extend the brief first.
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'ui-rounded', 'Segoe UI', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SF Mono', 'monospace'],
      },
      colors: {
        // Light warm shell
        bg: '#FBFAF7',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#1A1A1A',
          muted: '#5C5854',
        },
        hairline: '#E7E3DA',
        // Dark proof-ticket surface (all market/odds/settlement data)
        panel: {
          DEFAULT: '#161514',
          2: '#211F1D',
          ink: '#FFFFFF',
          muted: '#9A938C',
          hairline: '#302D2A',
        },
        // Accent + semantic (used sparingly — this is what makes it ours)
        accent: {
          DEFAULT: '#12E27E',
          ink: '#08170E',
          dim: '#0EA968',
        },
        negative: {
          DEFAULT: '#F0552E',
          ink: '#2A0C03',
        },
        // Legacy alias: existing sub-pages use `pitch-*` — remap onto the new
        // accent so they inherit the new brand until each page is fully reskinned.
        pitch: {
          50: '#eafff5',
          100: '#c9ffe6',
          200: '#93f7c9',
          300: '#5cefad',
          400: '#12E27E',
          500: '#0ec46e',
          600: '#0a9d58',
          700: '#0a7d47',
          800: '#0b5f38',
          900: '#0a3f26',
          950: '#062615',
        },
      },
      borderRadius: {
        ticket: '24px',
        card: '20px',
        input: '12px',
        tag: '8px',
      },
      boxShadow: {
        card: '0 12px 32px rgba(0,0,0,0.10)',
        'card-sm': '0 6px 18px rgba(0,0,0,0.08)',
        ticket: '0 16px 40px rgba(0,0,0,0.16)',
      },
      maxWidth: {
        content: '1072px',
        wide: '1200px',
      },
      keyframes: {
        drift: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(-2deg)' },
        },
        'drift-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(8px) rotate(3deg)' },
        },
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.8)' },
        },
      },
      animation: {
        drift: 'drift 6s ease-in-out infinite',
        'drift-slow': 'drift-slow 8s ease-in-out infinite',
        'rise-in': 'rise-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
