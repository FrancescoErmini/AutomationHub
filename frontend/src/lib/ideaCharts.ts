/**
 * Shared visual language for the Idea pipeline charts. Colours align with the
 * classification chips on IdeasPage and the portal palette
 * (positive green / indigo accent / grey / negative red).
 */
export const CLASSIFICATION_COLORS: Record<string, string> = {
  'Quick Win': '#2E8B57',
  'Strategic Investment': '#4A1A7D',
  'Low-Hanging Fruit': '#A0A0A0',
  'Deprioritize / Avoid': '#CC0000',
}

export const CLASSIFICATION_ORDER = [
  'Quick Win',
  'Strategic Investment',
  'Low-Hanging Fruit',
  'Deprioritize / Avoid',
]

export const CLASSIFICATION_FALLBACK_COLOR = '#A0A0A0'
