// Fixed 8-colour rainbow palette for the Ticket ID label. Kept in sync with
// the backend list in app/schemas/ticket.py (TICKET_COLORS). `null` means
// "no colour" -- the Ticket ID cell keeps its normal background.
export const TICKET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
] as const

/** Pick a readable text colour (near-black or white) for a hex background,
 *  using the WCAG relative-luminance formula. */
export function contrastText(hex: string): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  const channel = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  const luminance =
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  return luminance > 0.5 ? '#1e293b' : '#ffffff'
}
