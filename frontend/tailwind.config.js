/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        // Menarini identity — logo and active-nav marker only, never on data.
        brand: '#E2001A',
        // Data-semantic palette — kept separate from the identity red.
        positive: '#0F7B6C', // savings / net gain — deep teal, not stoplight green
        spend: '#B5762E', // capex & run costs — warm ochre, money going out
        negative: '#A23B2E', // real losses / SLA breach — brick, distinct from brand
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
