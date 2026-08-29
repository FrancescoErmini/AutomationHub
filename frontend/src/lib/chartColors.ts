/**
 * One chart language across the app. recharts needs literal color values
 * (not CSS variables), so the data-semantic palette is mirrored here from
 * the Tailwind theme: savings = teal, spend = ochre, losses = brick.
 */
export const chart = {
  positive: '#0F7B6C',
  spend: '#B5762E',
  spendDark: '#6F471B',
  spendLight: '#C68F55',
  negative: '#A23B2E',
  neutral: '#57534E',

  // shared axis / grid treatment
  grid: '#E7E4DF',
  axis: '#C9C5BF',
  tick: '#8A8580',
  tooltipBorder: '#E7E4DF',
} as const

/**
 * Categorical slots for generic trend/rank charts with no good/bad meaning
 * (Operations / SLA pages). Drawn from the same teal/ochre family as the
 * money charts so the whole app reads as one chart language.
 */
export const chartSeries = ['#0f7b6c', '#b5762e', '#3f6c7b', '#8a7a52'] as const
