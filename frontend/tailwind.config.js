/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Palette mirrors src/styles/theme.css — that file is the source of truth.
      colors: {
        ink: '#1A1A1A', // --ah-ink

        brand: '#001C3E', // --ah-navy — nav bar, primary action buttons
        brandHover: '#0A2C55', // --ah-navy-hover
        accent: '#4A1A7D', // --ah-indigo — links, active underline, hover, selected
        accentHover: '#5B2C90', // --ah-indigo-hover
        brandRed: '#E2001A', // logo/wordmark only

        positive: '#2E8B57', // --ah-positive
        negative: '#CC0000', // --ah-negative
        pending: '#A0A0A0', // --ah-pending
        spend: '#666666', // run-cost / money out — aligns to --ah-ink-3

        // Neutral grey ramp — replaces the old bluish slate. Existing slate-*
        // utilities across every page pick this up automatically.
        slate: {
          50: '#F7F7F7',
          100: '#F0F0F0',
          200: '#E0E0E0',
          300: '#D9D9D9',
          400: '#A0A0A0',
          500: '#808080',
          600: '#666666',
          700: '#444444',
          800: '#2A2A2A',
          900: '#1A1A1A',
          950: '#111111',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
}
