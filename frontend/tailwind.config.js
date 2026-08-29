/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Moonlit slate" palette — wisteria on cool greys. Elegant, calm,
        // technological. Five source hexes only: #BFA6D8 #2B2D42 #8D99AE
        // #EDF2F4 #4ECCA3 (tints/shades of these are allowed, new hues are not).
        ink: '#2B2D42', // all text — slate

        // Wisteria carries every interactive + accent role (nav, links,
        // buttons, focus, primary chart series). Darkened from the source
        // #BFA6D8 so text/controls clear WCAG AA on white; the light source
        // tone lives in `slate`-tinted fills and the chart palette.
        brand: '#7A5CA8',
        // Menarini identity red — reserved for the logo/wordmark only.
        brandRed: '#E2001A',

        // Status is a mint → grey → slate ramp (the palette has one signal
        // colour, so severity reads as weight, not hue).
        positive: '#1F7D5F', // savings / net gain / "on target" — mint, darkened for text
        spend: '#5B6478', // run-cost / money leaving — cool grey, no ochre in palette
        negative: '#2B2D42', // real losses / SLA breach — heaviest slate

        // Tailwind's built-in `slate` is rebuilt as the palette's cool-grey
        // ramp (#EDF2F4 surface → #8D99AE mid → #2B2D42 ink), so the ~200
        // existing slate-* utilities pick the new palette up automatically.
        slate: {
          50: '#EDF2F4',
          100: '#E3E9ED',
          200: '#D4DBE2',
          300: '#B7C0CC',
          400: '#8D99AE',
          500: '#6C7789',
          600: '#515A6B',
          700: '#3D4453',
          800: '#2F3341',
          900: '#2B2D42',
          950: '#212330',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: [
          '"IBM Plex Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
}
