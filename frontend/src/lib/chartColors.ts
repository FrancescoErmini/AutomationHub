/**
 * One chart language across the app. recharts needs literal colour values
 * (not CSS variables), so the enterprise palette from src/styles/theme.css is
 * mirrored here. Money charts map to expense categories:
 * CAPEX = deep blue, OPEX = green / grey / aqua.
 */
export const chart = {
  positive: '#2E8B57', // savings / net gain
  negative: '#CC0000', // losses / SLA breach
  spend: '#666666', // generic run-cost / money out

  capex: '#1E3A8A', // CAPEX band
  opexPersonnel: '#2F855A', // OPEX — personnel
  opexInfra: '#9CA3AF', // OPEX — infrastructure
  opexLicensing: '#4FD1C5', // OPEX — licensing / software

  neutral: '#1A1A1A', // net-benefit line / totals

  // shared axis / grid treatment
  grid: '#E0E0E0',
  axis: '#C7CED7',
  tick: '#666666',
  tooltipBorder: '#D9D9D9',
} as const

/**
 * Categorical slots for generic trend/rank charts with no good/bad meaning
 * (Operations / SLA pages) — CAPEX blue → OPEX green → grey → aqua, so
 * adjacent series always separate.
 */
export const chartSeries = ['#1E3A8A', '#2F855A', '#9CA3AF', '#4FD1C5'] as const
