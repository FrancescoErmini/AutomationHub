/**
 * One chart language across the app. recharts needs literal color values
 * (not CSS variables), so the "moonlit slate" palette is mirrored here.
 * The palette carries no good/bad hue pair, so money charts lean on weight:
 * savings = mint, cost = greys, totals/losses = slate.
 */
export const chart = {
  positive: '#4ECCA3', // savings / net gain
  spend: '#8D99AE', // run-cost / money out
  spendDark: '#8D99AE', // capex band
  spendLight: '#BFA6D8', // opex band — wisteria keeps the two bands apart
  negative: '#2B2D42', // losses / SLA breach
  neutral: '#2B2D42', // net-benefit line / totals

  // shared axis / grid treatment
  grid: '#E3E9ED',
  axis: '#C7CED7',
  tick: '#8D99AE',
  tooltipBorder: '#D4DBE2',
} as const

/**
 * Categorical slots for generic trend/rank charts with no good/bad meaning
 * (Operations / SLA pages) — the whole palette, darkest to lightest, so
 * adjacent series always separate.
 */
export const chartSeries = ['#BFA6D8', '#2B2D42', '#8D99AE', '#4ECCA3'] as const
