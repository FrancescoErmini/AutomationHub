import type { CSSProperties, ReactNode } from 'react'

type AppIconSize = 'sm' | 'md'

interface AppIconProps {
  /** Raw system/application name, e.g. "SAP APO", "Archiflow", "MIS Portal". */
  name: string
  /** 18px tile for card rows (default), 22px for the detail modal. */
  size?: AppIconSize
}

/**
 * Muted tints derived from the theme palette (see tailwind.config.js). Names are
 * hashed onto one of these so the same system always reads the same colour,
 * without resorting to a rainbow.
 */
const TINTS: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: '#E7EAF0', fg: '#001C3E' }, // navy
  { bg: '#ECE6F3', fg: '#4A1A7D' }, // indigo
  { bg: '#DCEEE8', fg: '#1F6F53' }, // teal
  { bg: '#F3EAD9', fg: '#8A5A1B' }, // amber
  { bg: '#F1E2E2', fg: '#9B2C2C' }, // rose
  { bg: '#E2E8F0', fg: '#234E7A' }, // blue
  { bg: '#ECECEC', fg: '#444444' }, // slate
]

function tintFor(name: string): { bg: string; fg: string } {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return TINTS[hash % TINTS.length]
}

function monogram(name: string): string {
  const cleaned = name.replace(/[^a-z0-9]+/gi, ' ').trim()
  if (!cleaned) return '?'
  const words = cleaned.split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return cleaned.slice(0, 2).toUpperCase()
}

const GLYPHS: Record<string, ReactNode> = {
  cube: (
    <>
      <path d="M8 1.6 14 4.9v6.2L8 14.4 2 11.1V4.9Z" />
      <path d="M2 4.9 8 8.2l6-3.3M8 8.2v6.2" />
    </>
  ),
  cloud: (
    <path d="M4.6 12.5a2.75 2.75 0 0 1 .1-5.5 3.75 3.75 0 0 1 7.2-1 2.75 2.75 0 0 1-.4 6.5Z" />
  ),
  cylinder: (
    <>
      <ellipse cx="8" cy="3.9" rx="4.8" ry="1.9" />
      <path d="M3.2 3.9v8.2c0 1 2.1 1.9 4.8 1.9s4.8-.9 4.8-1.9V3.9" />
      <path d="M3.2 8c0 1 2.1 1.9 4.8 1.9S12.8 9 12.8 8" />
    </>
  ),
  pill: (
    <g transform="rotate(-38 8 8)">
      <rect x="2.4" y="5.6" width="11.2" height="4.8" rx="2.4" />
      <path d="M8 5.7v4.6" />
    </g>
  ),
  envelope: (
    <>
      <rect x="1.8" y="3.6" width="12.4" height="8.8" rx="1.5" />
      <path d="M2.3 4.6 8 8.6l5.7-4" />
    </>
  ),
  grid: (
    <>
      <rect x="2.4" y="2.4" width="11.2" height="11.2" rx="1.5" />
      <path d="M2.4 6.6h11.2M2.4 10.2h11.2M6.6 2.4v11.2" />
    </>
  ),
  folder: (
    <path d="M2 5a1.5 1.5 0 0 1 1.5-1.5h2.4L7.4 5h5A1.5 1.5 0 0 1 15.9 6.5v5A1.5 1.5 0 0 1 14.4 13H3.5A1.5 1.5 0 0 1 2 11.5Z" />
  ),
  server: (
    <>
      <rect x="2.3" y="2.6" width="11.4" height="4.4" rx="1" />
      <rect x="2.3" y="9" width="11.4" height="4.4" rx="1" />
      <path d="M4.4 4.8h.01M4.4 11.2h.01" />
    </>
  ),
  tray: (
    <>
      <path d="M2 8.6 4 3.4A1.2 1.2 0 0 1 5.1 2.6h5.8A1.2 1.2 0 0 1 12 3.4l2 5.2" />
      <path d="M2 8.6h3.4L6.5 10.6h3L10.6 8.6H14v3.3A1.5 1.5 0 0 1 12.5 13.4h-9A1.5 1.5 0 0 1 2 11.9Z" />
    </>
  ),
  receipt: (
    <>
      <path d="M4 1.9v12.2l1.6-1 1.6 1 1.6-1 1.6 1 1.6-1V1.9l-1.6 1-1.6-1-1.6 1-1.6-1Z" />
      <path d="M6.1 5.6h3.8M6.1 8.1h3.8" />
    </>
  ),
  truck: (
    <>
      <path d="M1.6 4.4h7.2v6.4H1.6z" />
      <path d="M8.8 6.5h3.1l2.5 2.6v1.7H8.8z" />
      <circle cx="4.4" cy="12.1" r="1.4" />
      <circle cx="11.6" cy="12.1" r="1.4" />
    </>
  ),
  transfer: (
    <>
      <path d="M2.6 5.4h7.2M5.1 3 2.6 5.4 5.1 7.8" />
      <path d="M13.4 10.6H6.2M10.9 8.2l2.5 2.4-2.5 2.4" />
    </>
  ),
  bars: (
    <>
      <path d="M2.4 13.4h11.2" />
      <path d="M4 12V8.2M8 12V4.6M12 12V9.6" />
    </>
  ),
  shield: (
    <>
      <path d="M8 1.8 13 3.6v4.1c0 3.3-2.1 5.6-5 6.5-2.9-.9-5-3.2-5-6.5V3.6Z" />
      <path d="m5.9 8 1.5 1.5L10.4 6.6" />
    </>
  ),
  globe: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M2.2 8h11.6M8 2.1c2.1 2.2 2.1 9.6 0 11.8M8 2.1c-2.1 2.2-2.1 9.6 0 11.8" />
    </>
  ),
  sparkles: (
    <>
      <path d="M8 2.4 9.3 6.2 13.1 7.5 9.3 8.8 8 12.6 6.7 8.8 2.9 7.5 6.7 6.2Z" />
      <path d="M12.6 2.2v2.2M11.5 3.3h2.2" />
    </>
  ),
  window: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 6.2h12M4.3 4.6h.01M6.1 4.6h.01" />
    </>
  ),
  doc: (
    <>
      <path d="M4 2h5l3.2 3.2V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      <path d="M8.9 2v3.3h3.3M5.6 8.6h4.8M5.6 11h4.8" />
    </>
  ),
}

/**
 * Ordered keyword rules — first match wins, so specific vendors sit above the
 * generic "portal" / "app" catch-alls. Anything unmatched falls back to a
 * monogram tile.
 */
const GLYPH_RULES: ReadonlyArray<[RegExp, keyof typeof GLYPHS]> = [
  [/\bsap\b|\bapo\b|\becc\b|\bs\/?4\b|hana/i, 'cube'],
  [/salesforce|\bsfdc\b/i, 'cloud'],
  [/\bp2p\b|invoic|procure|purchase.to.pay/i, 'receipt'],
  [/oracle|\bsql\b|\bdb2\b|database|\baccess\b/i, 'cylinder'],
  [/veeva|vault/i, 'pill'],
  [/gmail|outlook|\bmail\b|e-?mail|exchange/i, 'envelope'],
  [/excel|sheets?|spreadsheet/i, 'grid'],
  [/acrobat|adobe|\bpdf\b/i, 'doc'],
  [/drive|sharepoint|dropbox|\bfolder\b|\bdocs?\b/i, 'folder'],
  [/as[\s/-]?400|iseries|mainframe/i, 'server'],
  [/archiflow|archive|\bdms\b|document manag/i, 'tray'],
  [/\bdhl\b|\btnt\b|\bups\b|courier|shipp|deliver|logistic/i, 'truck'],
  [/filezilla|\bs?ftp\b|file[\s-]?transfer/i, 'transfer'],
  [/power\s?bi|\bbi\b|qlik|tableau|report|analytic/i, 'bars'],
  [/eudravigilance|\bemvo\b|pharmacovigil|serializ|vigilance/i, 'shield'],
  [/portal|supervisor|website|web[\s-]?app|\bweb\b|intranet/i, 'globe'],
  [/einstein|\bai\b|copilot|\bllm\b/i, 'sparkles'],
  [/application|custom app|\bapp\b|\bsystem\b|\btool\b/i, 'window'],
]

function glyphFor(name: string): ReactNode | null {
  const rule = GLYPH_RULES.find(([pattern]) => pattern.test(name))
  return rule ? GLYPHS[rule[1]] : null
}

/**
 * Compact tile standing in for an application/system name: a curated monochrome
 * glyph for systems we recognise, otherwise a tinted monogram. The full name is
 * always available via the tooltip and the accessible label.
 */
export function AppIcon({ name, size = 'sm' }: AppIconProps) {
  const tint = tintFor(name)
  const glyph = glyphFor(name)
  const tile =
    size === 'sm'
      ? 'h-[18px] w-[18px] text-[9px]'
      : 'h-[22px] w-[22px] text-[10px]'
  const svgSize = size === 'sm' ? 11 : 13
  const style: CSSProperties = { backgroundColor: tint.bg, color: tint.fg }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-semibold leading-none ${tile}`}
      style={style}
      title={name}
      role="img"
      aria-label={name}
    >
      {glyph ? (
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {glyph}
        </svg>
      ) : (
        <span aria-hidden>{monogram(name)}</span>
      )}
    </span>
  )
}
