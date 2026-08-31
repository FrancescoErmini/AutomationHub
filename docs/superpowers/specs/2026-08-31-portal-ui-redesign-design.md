# Portal UI Redesign — Design

**Date:** 2026-08-31
**Branch:** `master` (working inline)
**Status:** Implemented (shell + simple-ops); other pages pending their polish passes
**Plan:** `docs/superpowers/plans/2026-08-31-portal-ui-redesign.md`

## Problem

The portal reads as "not enterprise, flat, and not clear." Two causes:

1. **No single design system.** Most pages use Tailwind utilities against a
   custom "moonlit slate" palette (wisteria/purple on cool grey, IBM Plex,
   deliberately flat hairline cards). `SimpleOpsPage.css` (also imported by
   `SlaKpiPage`) runs a *second*, parallel system: a scoped `.simple-ops-page`
   block that re-declares its own `--color-*` tokens. The duplication is why
   pages drift.
2. **The visual language itself** — flat cards, purple accent, thin type — does
   not match the executive-console look the stakeholders want.

## Target

An enterprise "executive console" (see `design/specs/*.jpg`, `palette.md`):

- Dark navy `#001C3E` top navigation bar, white content on a light
  `#F7F7F7` canvas.
- White cards with **soft shadows** (depth, not flat hairlines).
- **Inter**, bold headings, near-black `#1A1A1A` text.
- KPI stat cards: uppercase kicker, large bold value, sign-coloured delta
  (green `#2E8B57` / red `#CC0000`), optional status dot.
- A specific blue/green chart palette for CAPEX / OPEX breakdowns.

`palette.md` is a reference, not a contract — deviate where the product needs it.

Scope of *this* pass: the shared shell (`Layout`) and the **simple-ops page**
(`/simple-ops`, "Operations"), built as the reference implementation. Every
other page inherits the new token layer and gets a dedicated polish pass later.

Decisions locked with the user:

- Include the shared shell (navy nav) in this pass.
- Switch typeface to **Inter** (Google Fonts `<link>`, not an npm package —
  the corporate TLS proxy breaks `npm ci` for `@fontsource/*` in Docker).
- Full chart restyle on simple-ops now (palette + card treatment).
- Light theme only; tokens structured so dark mode *could* be layered later.

## Approach

**CSS-variable token layer + Tailwind mirror + shared React primitives.**

Rejected alternatives:

- *All-in Tailwind, delete the plain CSS* — requires rewriting the hand-rolled
  SVG/CSS charts (stacked bars, occupancy heatmap, tooltips) up front. Large,
  risky, slow to first result.
- *CSS-vars only, leave Tailwind alone* — every Tailwind utility across the app
  keeps emitting the old purple/slate. The inconsistency survives.

The chosen approach works with both styling systems that exist today, lets
charts read token values directly, and allows pages to migrate one at a time.

## Components

### 1. Token layer — `src/styles/theme.css` (new)

A single `:root` block, light-only, every token prefixed `--ah-`. Imported once
at the top of `src/index.css`. This file is the **canonical source of truth**
for the palette.

| Group | Tokens |
| --- | --- |
| Surfaces | `--ah-canvas #F7F7F7`, `--ah-surface #FFFFFF`, `--ah-surface-sunken #F2F4F7` |
| Lines / elevation | `--ah-border #E0E0E0`, `--ah-border-strong #D9D9D9`, `--ah-shadow-card`, `--ah-shadow-pop` |
| Ink | `--ah-ink #1A1A1A`, `--ah-ink-2 #444444`, `--ah-ink-3 #666666` |
| Structure / interaction | `--ah-navy #001C3E`, `--ah-navy-hover` (~`#0A2C55`), `--ah-indigo #4A1A7D`, `--ah-indigo-hover`, `--ah-brand-red #E2001A` (logo only) |
| Semantic | `--ah-positive #2E8B57`, `--ah-negative #CC0000`, `--ah-pending #A0A0A0`, plus `-bg` soft tints for badges |
| Chart | `--ah-chart-capex #1E3A8A`, `--ah-chart-opex-personnel #2F855A`, `--ah-chart-opex-infra #9CA3AF`, `--ah-chart-opex-licensing #4FD1C5`, `--ah-chart-grid #E0E0E0`, `--ah-chart-axis #C7CED7`, `--ah-chart-tick #666666` |
| Type | `--ah-font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif` |
| Radius | `--ah-radius-sm 8px`, `--ah-radius-md 12px`, `--ah-radius-lg 16px` |

Shadow definitions (soft, navy-tinted rather than pure black):

```
--ah-shadow-card: 0 1px 2px rgba(0, 28, 62, 0.06), 0 8px 24px -12px rgba(0, 28, 62, 0.18);
--ah-shadow-pop:  0 8px 28px rgba(0, 28, 62, 0.16);
```

`src/index.css` base layer sets `body` to `background: var(--ah-canvas)`,
`color: var(--ah-ink)`, `font-family: var(--ah-font-sans)` and keeps the
existing tabular-nums rule for tables.

### 2. Font loading — `index.html`

Replace the IBM Plex Sans `<link>` with Inter (weights 400, 500, 600, 700),
keeping the `preconnect` hints. IBM Plex Mono: keep the load **only if**
`font-mono` / `--font-mono` is actually referenced in the codebase; otherwise
drop it and leave a system monospace fallback stack in the Tailwind config.
(Check during implementation — a grep for `font-mono` and `IBM Plex Mono`.)

### 3. Tailwind remap — `tailwind.config.js`

Re-point `theme.extend` so existing utility classes across every page pick up
the new palette automatically. Values mirror `theme.css` (comment in the file
points to it as the source of truth).

| Tailwind token | Current | New |
| --- | --- | --- |
| `ink` | `#2B2D42` | `#1A1A1A` |
| `slate` (50–950) | bluish `#EDF2F4 → #2B2D42` | neutral grey ramp `#F7F7F7 → #1A1A1A` |
| `brand` | `#7A5CA8` (wisteria) | `#001C3E` (navy) |
| `accent` *(new)* | — | `#4A1A7D` (indigo) |
| `positive` | `#1F7D5F` | `#2E8B57` |
| `negative` | `#2B2D42` | `#CC0000` |
| `pending` *(new)* | — | `#A0A0A0` |
| `spend` | `#5B6478` | `#666666` (align to `--ah-ink-3`) |
| `brandRed` | `#E2001A` | unchanged |
| `fontFamily.sans` | IBM Plex Sans | Inter |

The neutral `slate` ramp (illustrative — tuned during implementation):
`50 #F7F7F7`, `100 #F0F0F0`, `200 #E0E0E0`, `300 #D9D9D9`, `400 #A0A0A0`,
`500 #808080`, `600 #666666`, `700 #444444`, `800 #2A2A2A`, `900 #1A1A1A`,
`950 #111111`.

### 4. Shared primitives — `src/components/ui/` (new)

Built with Tailwind against the remapped palette. The vocabulary every page
reuses; this is what actually prevents drift.

| Component | Responsibility |
| --- | --- |
| `Card` | White surface, `--ah-radius-md`, `--ah-shadow-card`, standard padding. Optional `kicker` and `title` props; `as` / `className` passthrough. |
| `KpiStat` | Uppercase kicker, large bold value, delta line (auto green/red by sign) with optional status dot. `hero` variant = larger value + faint navy tint. |
| `PageHeader` | `h1` + subtitle paragraph; the standard page top block. |
| `SectionHeading` | `h2` with optional leading colour dot and optional right-aligned stat (e.g. "Avg. cost per process: €X"). |
| `StatusBadge` | Pill + dot; `tone: 'positive' | 'negative' | 'pending'`. The "STABLE / LIVE", "FAILED SYNC" chips. |
| `Tag` | Neutral `#D9D9D9` chip for system labels ("SAP", "FileZilla"). |

Each is a small, single-purpose function component. Props are the only
interface; internals (exact class lists) can change without touching callers.
An `index.ts` barrel re-exports them.

`MetricCard` (`src/components/MetricCard.tsx`) is re-expressed as a thin wrapper
over `KpiStat` (or replaced at its call sites in a later page pass — for this
pass, leave `MetricCard` working; just let it inherit the palette).

### 5. Shell — `src/components/Layout.tsx`

- Header bar: solid `--ah-navy` background, `--ah-navy` also fills the notch
  area. White square logo + white wordmark ("Menarini Automation Hub").
- Nav links: muted white (`rgba(255,255,255,0.72)`), `hover:` full white.
  **Active** link: full white text + a 2px `--ah-indigo` underline.
- Right cluster: user name in muted white; "Sign out" as a white-outline
  button. "Sign in" (unauthenticated) as a solid `--ah-indigo` button.
- `main`: `--ah-canvas` background, `max-w-7xl`, `px-6 py-10`.
- Header inner width bumped from `max-w-6xl` to `max-w-7xl` to line up with
  `main` (removes an existing subtle misalignment).
- No route or structural changes; nav items unchanged.

### 6. simple-ops — `src/pages/SimpleOpsPage.tsx` + `SimpleOpsPage.css`

Rebuilt as the reference implementation.

- Page chrome (`PageHeader`, KPI row, section headings, legend, pager buttons)
  → shared primitives + Tailwind. The KPI cards become `KpiStat` (hero card
  for "Total running cost").
- `SimpleOpsPage.css`: **delete** the scoped token block (the `--color-*`
  ladder, lines ~9–69). What remains is only the bespoke visual pieces that
  are genuinely CSS-heavy — stacked-bar rows (`.stack-row` / `.stack-bar` /
  `.stack-tip`), the occupancy heatmap grid (`.heat-grid`), the running-cost
  table (`.rct-table`) — and every one is retargeted to `--ah-*` tokens.
  Selectors stay scoped under `.simple-ops-page`.
- Cards sit on the `#F7F7F7` canvas with the new soft shadow, clearly
  separated.
- Fix the literal-`$` typo in the subtitle on `SimpleOpsPage.tsx:130`
  (`costs of ${CURRENT_YEAR}` renders a stray `$`).
- Inline `style={{ background: 'var(--color-neutral-700)' }}` etc. in the TSX
  (h2 dots, heatmap cell fills) → new `--ah-*` tokens.

### 6b. Charts

- `src/lib/chartColors.ts`: replace the moonlit-slate values with the new
  palette. `chart.positive → #2E8B57`, `chart.negative → #CC0000`,
  `chart.spend / neutral / grid / axis / tick` → new greys. Add named exports
  for the CAPEX/OPEX quartet. `chartSeries` becomes the CAPEX→OPEX ramp
  (`#1E3A8A`, `#2F855A`, `#9CA3AF`, `#4FD1C5`).
- `RunningCostTrendChart` (stacked cost bars + total line): segment colours →
  CAPEX/OPEX ramp; grid / axis / tooltip → new tokens; the companion
  `.rct-table` and its swatches inherit the retargeted CSS.
- The in-page stacked "cost breakdown by process" bars and the heatmap use the
  same palette via `--ah-*`.
- `RankBarChart` and `TrendChart` read `chartColors.ts`, so they shift with it
  (used by sla-kpi — see blast radius).

## Data flow

No data-flow changes. All API calls, React Query keys, and component props are
untouched. This is a presentation-layer change only.

## Blast radius (expected and acceptable — a coherent global system is the goal)

| Page | Effect this pass | Follow-up |
| --- | --- | --- |
| **simple-ops** | Full rebuild | — |
| **Layout / shell** | Full rebuild | — |
| **sla-kpi** | Shares `.simple-ops-page` CSS + `chartColors.ts` → shifts to the new palette automatically. Must not visually break. | Dedicated polish pass |
| **executive, ideas, catalog, home** | Tailwind remap swaps purple→navy, greens, neutral greys. Structure unchanged. | Dedicated polish pass each |

If a shared-CSS change would visibly break sla-kpi, adjust the token mapping
rather than forking the stylesheet.

## Error handling

`AsyncSection` is shared and small. Its error box switches from
`border-brand/30 bg-brand/5 text-brand` to `--ah-negative` tones
(`border-negative/30 bg-negative/5 text-negative`); its loading box keeps the
white surface + new muted ink.

## Testing / verification

Per project convention there are no automated tests. Verification is:

- `npm run typecheck` — clean
- `npm run lint` — eslint clean; `prettier --check` no worse than baseline
  (13 files already fail formatting on `master`; run `npm run format` on files
  this work touches).
- `npm run build` — succeeds
- Manual visual review by the user against `design/specs/*.jpg`, on
  `/simple-ops`, `/sla-kpi` (regression check), and one utility-based page
  (`/executive`) to confirm the remap didn't degrade it.

## Out of scope

- Dark mode.
- Rebuilding executive / ideas / catalog / home / wizard / detail pages (later
  passes).
- Any backend, API, or data change.
- New charts or new metrics.

## Implementation notes

Landed 2026-08-31 in 8 commits on `master` (from `feat(frontend): add global
design-token layer` through `chore(frontend): format redesign files`).
Verified: `npm run typecheck`, `npm run build`, `npx eslint . --max-warnings 0`
all clean. `prettier --check .` still lists the 13 pre-existing unformatted
files — unchanged baseline.

Deviations from the design:

- **`SimpleOpsPage.css` token block kept, not deleted.** The scoped
  `.simple-ops-page` block still declares every `--color-*` name, now as thin
  aliases to `--ah-*` (accent ramp → enterprise blue `#1E3A8A`, accent-2 →
  neutral grey). `SlaKpiPage.tsx` and inline styles reference those names
  directly, so deleting them would have broken sla-kpi. Same single-source-of-
  truth outcome, smaller blast radius.
- **KPI deltas render muted grey, not sign-coloured.** On a cost dashboard a
  rising figure is not "good", so green/red by raw sign would mislead.
  `KpiStat` still supports `deltaTone="auto"` (green/red by `+`/`-` prefix) for
  pages where polarity is unambiguous; simple-ops opts out.
- **`brandHover` / `accentHover` Tailwind tokens** were added but are currently
  only used via `var(--ah-*)` in `Layout.tsx`; kept for later pages.

Follow-up polish passes still owed: `/sla-kpi`, `/executive`, `/ideas`,
`/catalog`, `/` (home), the idea wizard, and idea detail. `MetricCard` should
be re-expressed over `KpiStat` during the executive pass.
