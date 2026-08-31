# Portal UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the portal's flat purple-on-grey styling with an enterprise "executive console" look (navy nav, light canvas, soft-shadowed white cards, Inter, blue/green semantics), driven by one global design-token layer, using the shared shell + the simple-ops page as the reference implementation.

**Architecture:** A new `src/styles/theme.css` `:root` block holds all design tokens (`--ah-*`) and is the single source of truth. `tailwind.config.js` mirrors those hex values so existing utility classes across every page pick up the new palette. New `src/components/ui/` primitives (`Card`, `KpiStat`, `PageHeader`, `SectionHeading`, `StatusBadge`, `Tag`) give pages a shared vocabulary. `Layout.tsx` and `SimpleOpsPage` are rebuilt on this foundation; the scoped `.simple-ops-page` CSS variables are re-pointed at `--ah-*` tokens (kept as aliases, not deleted, because `SlaKpiPage` consumes them by name).

**Tech Stack:** React 18 + TypeScript, Vite 6, Tailwind CSS 3.4, recharts 3, React Query. No test framework (project convention — do not add one). Verification = `npm run typecheck`, `npm run lint`, `npm run build`, plus manual visual review.

**Spec:** `docs/superpowers/specs/2026-08-31-portal-ui-redesign-design.md`

## Global Constraints

- **No test framework / CI.** Testing is manual (project memory: `no-automated-tests`). Every task verifies with `npm run typecheck`, `npm run build`, and where noted `npm run lint`.
- **Fonts load via Google Fonts `<link>` only.** Never add `@fontsource/*` or any npm font package — the corporate TLS proxy breaks `npm ci` in Docker (project memory: `frontend-container-npm-proxy`).
- **Light theme only.** Tokens are structured as CSS variables so dark mode could be layered later, but no dark palette or toggle in this work.
- **Presentation layer only.** No changes to API calls, React Query keys, component props that carry data, routes, or backend.
- **`theme.css` is the canonical palette.** Any hex in `tailwind.config.js` must carry a comment pointing back to it.
- **Menarini red `#E2001A`** is reserved for the logo/wordmark only — never as a UI accent.
- Run all commands from `frontend/`. Working inline on `master` (no worktree).
- Commit after every task. End commit messages with:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GRVW3K4wio1D2xMZVY87Up
  ```

## Palette reference (from spec / `design/specs/palette.md`)

| Role | Hex |
| --- | --- |
| Navy (nav bg, primary buttons) | `#001C3E` |
| Navy hover | `#0A2C55` |
| Indigo (links, active underline, hover, selected) | `#4A1A7D` |
| Indigo hover | `#5B2C90` |
| Canvas | `#F7F7F7` |
| Surface | `#FFFFFF` |
| Sunken surface | `#F2F4F7` |
| Border | `#E0E0E0` |
| Border strong | `#D9D9D9` |
| Ink | `#1A1A1A` |
| Ink 2 | `#444444` |
| Ink 3 | `#666666` |
| Positive | `#2E8B57` |
| Negative | `#CC0000` |
| Pending | `#A0A0A0` |
| Chart CAPEX | `#1E3A8A` |
| Chart OPEX personnel | `#2F855A` |
| Chart OPEX infra | `#9CA3AF` |
| Chart OPEX licensing | `#4FD1C5` |
| Menarini red (logo only) | `#E2001A` |

## File structure

| File | Status | Responsibility |
| --- | --- | --- |
| `frontend/src/styles/theme.css` | Create | Canonical `--ah-*` design tokens on `:root`. |
| `frontend/src/index.css` | Modify | Import `theme.css`; set `body` background/color/font from tokens. |
| `frontend/index.html` | Modify | Swap IBM Plex Sans `<link>` → Inter; drop IBM Plex Mono (unused). |
| `frontend/tailwind.config.js` | Modify | Mirror `theme.css` palette into Tailwind tokens; Inter as `sans`; system mono fallback. |
| `frontend/src/components/ui/Card.tsx` | Create | White soft-shadow surface primitive. |
| `frontend/src/components/ui/KpiStat.tsx` | Create | KPI stat card (kicker / value / delta / dot; `hero` variant). |
| `frontend/src/components/ui/PageHeader.tsx` | Create | `h1` + subtitle page top block. |
| `frontend/src/components/ui/SectionHeading.tsx` | Create | `h2` with optional dot + right-aligned stat. |
| `frontend/src/components/ui/StatusBadge.tsx` | Create | Pill + dot; `positive` / `negative` / `pending`. |
| `frontend/src/components/ui/Tag.tsx` | Create | Neutral chip for system labels. |
| `frontend/src/components/ui/index.ts` | Create | Barrel re-export. |
| `frontend/src/components/Layout.tsx` | Modify | Navy enterprise nav shell. |
| `frontend/src/components/AsyncSection.tsx` | Modify | Error box → negative tones. |
| `frontend/src/lib/chartColors.ts` | Modify | New CAPEX/OPEX chart palette + grey axis/grid. |
| `frontend/src/components/RunningCostTrendChart.tsx` | Modify | Segment colours → new tokens. |
| `frontend/src/pages/SimpleOpsPage.tsx` | Modify | Rebuild chrome on `ui/` primitives; fix `$` typo; retarget inline styles. |
| `frontend/src/pages/SimpleOpsPage.css` | Modify | Re-point scoped `--color-*` vars at `--ah-*`; add card elevation. |
| `docs/superpowers/specs/2026-08-31-portal-ui-redesign-design.md` | Modify (Task 8) | Mark status implemented. |

---

## Task 1: Global token layer + fonts

**Files:**
- Create: `frontend/src/styles/theme.css`
- Modify: `frontend/src/index.css`
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties on `:root`, all prefixed `--ah-`, listed below. Every later task references these exact names:
  `--ah-canvas`, `--ah-surface`, `--ah-surface-sunken`, `--ah-border`, `--ah-border-strong`,
  `--ah-shadow-card`, `--ah-shadow-pop`, `--ah-ink`, `--ah-ink-2`, `--ah-ink-3`,
  `--ah-navy`, `--ah-navy-hover`, `--ah-indigo`, `--ah-indigo-hover`, `--ah-brand-red`,
  `--ah-positive`, `--ah-positive-bg`, `--ah-negative`, `--ah-negative-bg`, `--ah-pending`, `--ah-pending-bg`,
  `--ah-chart-capex`, `--ah-chart-opex-personnel`, `--ah-chart-opex-infra`, `--ah-chart-opex-licensing`,
  `--ah-chart-grid`, `--ah-chart-axis`, `--ah-chart-tick`,
  `--ah-font-sans`, `--ah-radius-sm`, `--ah-radius-md`, `--ah-radius-lg`.

- [ ] **Step 1: Create `frontend/src/styles/theme.css`**

```css
/* Canonical design tokens for the Automation Hub portal.
   This file is the single source of truth for the palette. tailwind.config.js
   mirrors these hex values; plain-CSS pages and charts read the variables directly.
   Light theme only — see docs/superpowers/specs/2026-08-31-portal-ui-redesign-design.md */

:root {
  /* Surfaces */
  --ah-canvas: #f7f7f7;
  --ah-surface: #ffffff;
  --ah-surface-sunken: #f2f4f7;

  /* Lines & elevation */
  --ah-border: #e0e0e0;
  --ah-border-strong: #d9d9d9;
  --ah-shadow-card: 0 1px 2px rgba(0, 28, 62, 0.06), 0 8px 24px -12px rgba(0, 28, 62, 0.18);
  --ah-shadow-pop: 0 8px 28px rgba(0, 28, 62, 0.16);

  /* Ink */
  --ah-ink: #1a1a1a;
  --ah-ink-2: #444444;
  --ah-ink-3: #666666;

  /* Structure & interaction */
  --ah-navy: #001c3e;
  --ah-navy-hover: #0a2c55;
  --ah-indigo: #4a1a7d;
  --ah-indigo-hover: #5b2c90;
  --ah-brand-red: #e2001a; /* logo/wordmark only */

  /* Semantic status */
  --ah-positive: #2e8b57;
  --ah-positive-bg: #e8f3ec;
  --ah-negative: #cc0000;
  --ah-negative-bg: #fbeaea;
  --ah-pending: #a0a0a0;
  --ah-pending-bg: #f0f0f0;

  /* Chart palette */
  --ah-chart-capex: #1e3a8a;
  --ah-chart-opex-personnel: #2f855a;
  --ah-chart-opex-infra: #9ca3af;
  --ah-chart-opex-licensing: #4fd1c5;
  --ah-chart-grid: #e0e0e0;
  --ah-chart-axis: #c7ced7;
  --ah-chart-tick: #666666;

  /* Type */
  --ah-font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

  /* Radius */
  --ah-radius-sm: 8px;
  --ah-radius-md: 12px;
  --ah-radius-lg: 16px;
}
```

- [ ] **Step 2: Wire it into `frontend/src/index.css`**

Replace the entire file with:

```css
@import './styles/theme.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply m-0 min-w-80 antialiased;
    background: var(--ah-canvas);
    color: var(--ah-ink);
    font-family: var(--ah-font-sans);
  }

  button,
  input,
  textarea,
  select {
    font-family: inherit;
  }

  /* Money data is everywhere here — lock table figures to tabular so
     columns of € values line up digit-for-digit. */
  table {
    font-variant-numeric: tabular-nums;
  }
}
```

- [ ] **Step 3: Swap fonts in `frontend/index.html`**

Replace the two font `<link>` lines (the `preconnect` lines stay) so the stylesheet href becomes:

```html
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
```

(IBM Plex Mono is removed — `grep -rn "font-mono\|Plex Mono" frontend/src` returns nothing.)

- [ ] **Step 4: Verify the build compiles and fonts are gone**

Run:
```bash
cd frontend
grep -rn "Plex" index.html src/ ; echo "exit: $?"   # expect: no matches, exit 1
npm run build
```
Expected: grep prints nothing; `npm run build` succeeds.

- [ ] **Step 5: Visual smoke check**

Run `npm run dev`, open the app. Expected: body background is light grey `#F7F7F7`, base text near-black, font is Inter (rounded-terminal 'a', tall x-height). Pages will look half-migrated — that is fine at this step.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/styles/theme.css frontend/src/index.css frontend/index.html
git commit -m "feat(frontend): add global design-token layer, switch to Inter"
```

---

## Task 2: Tailwind palette remap

**Files:**
- Modify: `frontend/tailwind.config.js`

**Interfaces:**
- Consumes: `--ah-*` names/values from Task 1 (mirrored as literals here).
- Produces: Tailwind tokens `ink`, `accent`, `pending` (new), remapped `brand`, `positive`, `negative`, `spend`, and a neutral `slate` ramp. `fontFamily.sans` → Inter. These back every `text-*`/`bg-*`/`border-*` utility already in the pages.

- [ ] **Step 1: Replace `theme.extend` in `frontend/tailwind.config.js`**

```js
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
```

- [ ] **Step 2: Typecheck + build**

Run:
```bash
cd frontend && npm run typecheck && npm run build
```
Expected: both succeed. (`brandHover` / `accentHover` may be unused for now — that is not an error.)

- [ ] **Step 3: Visual regression spot check**

`npm run dev`, visit `/executive` and `/ideas` (utility-class pages, not rebuilt in this plan). Expected: purple accents are now navy; positive figures green `#2E8B57`; greys are neutral not bluish; layouts intact, nothing unreadable. Note anything badly broken for a follow-up pass — do not fix other pages here.

- [ ] **Step 4: Commit**

```bash
git add frontend/tailwind.config.js
git commit -m "feat(frontend): remap Tailwind palette to the enterprise token set"
```

---

## Task 3: Shared UI primitives

**Files:**
- Create: `frontend/src/components/ui/Card.tsx`
- Create: `frontend/src/components/ui/KpiStat.tsx`
- Create: `frontend/src/components/ui/PageHeader.tsx`
- Create: `frontend/src/components/ui/SectionHeading.tsx`
- Create: `frontend/src/components/ui/StatusBadge.tsx`
- Create: `frontend/src/components/ui/Tag.tsx`
- Create: `frontend/src/components/ui/index.ts`

**Interfaces:**
- Consumes: Tailwind tokens from Task 2.
- Produces:
  - `Card({ kicker?: string, title?: string, className?: string, children: ReactNode })`
  - `KpiStat({ label: string, value: string, delta?: string, deltaTone?: 'auto' | 'positive' | 'negative' | 'muted', dot?: 'positive' | 'negative' | 'pending', hero?: boolean })` — when `deltaTone` is `'auto'` (default) the sign of a leading `+`/`-` in `delta` picks green/red, else muted.
  - `PageHeader({ title: string, subtitle?: ReactNode })`
  - `SectionHeading({ children: ReactNode, dotColor?: string, stat?: ReactNode })` — renders `<h2>`
  - `StatusBadge({ tone: 'positive' | 'negative' | 'pending', children: ReactNode })`
  - `Tag({ children: ReactNode })`
  - Barrel `index.ts` re-exports all six.

- [ ] **Step 1: Create `Card.tsx`**

```tsx
import type { ReactNode } from 'react'

interface CardProps {
  kicker?: string
  title?: string
  className?: string
  children: ReactNode
}

export function Card({ kicker, title, className = '', children }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-[var(--ah-shadow-card)] ${className}`}
    >
      {kicker && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
          {kicker}
        </p>
      )}
      {title && (
        <h3 className="mt-1 text-base font-bold tracking-tight text-ink">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create `KpiStat.tsx`**

```tsx
type Tone = 'auto' | 'positive' | 'negative' | 'muted'
type Dot = 'positive' | 'negative' | 'pending'

interface KpiStatProps {
  label: string
  value: string
  delta?: string
  deltaTone?: Tone
  dot?: Dot
  hero?: boolean
}

const DOT_CLASS: Record<Dot, string> = {
  positive: 'bg-positive',
  negative: 'bg-negative',
  pending: 'bg-pending',
}

function resolveDeltaClass(delta: string | undefined, tone: Tone): string {
  if (!delta) return ''
  if (tone === 'positive') return 'text-positive'
  if (tone === 'negative') return 'text-negative'
  if (tone === 'muted') return 'text-slate-500'
  const trimmed = delta.trimStart()
  if (trimmed.startsWith('-')) return 'text-negative'
  if (trimmed.startsWith('+')) return 'text-positive'
  return 'text-slate-500'
}

export function KpiStat({
  label,
  value,
  delta,
  deltaTone = 'auto',
  dot,
  hero = false,
}: KpiStatProps) {
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-xl border border-slate-200 p-4 shadow-[var(--ah-shadow-card)] ${
        hero ? 'bg-[color-mix(in_srgb,theme(colors.brand)_5%,#fff)]' : 'bg-white'
      }`}
    >
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
        {dot && (
          <span className={`h-2 w-2 rounded-full ${DOT_CLASS[dot]}`} aria-hidden />
        )}
        {label}
      </p>
      <p
        className={`font-bold tracking-tight text-ink [font-feature-settings:'pnum'_1] ${
          hero ? 'text-4xl' : 'text-2xl'
        }`}
      >
        {value}
      </p>
      {delta && (
        <p className={`text-xs font-semibold ${resolveDeltaClass(delta, deltaTone)}`}>
          {delta}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `PageHeader.tsx`**

```tsx
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
      {subtitle && (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          {subtitle}
        </p>
      )}
    </header>
  )
}
```

- [ ] **Step 4: Create `SectionHeading.tsx`**

```tsx
import type { ReactNode } from 'react'

interface SectionHeadingProps {
  children: ReactNode
  dotColor?: string
  stat?: ReactNode
}

export function SectionHeading({ children, dotColor, stat }: SectionHeadingProps) {
  return (
    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2 className="text-xl font-bold tracking-tight text-ink">
        {dotColor && (
          <span
            className="mr-2.5 inline-block h-2.5 w-2.5 rounded-full align-[1px]"
            style={{ background: dotColor }}
            aria-hidden
          />
        )}
        {children}
      </h2>
      {stat && <p className="text-sm text-slate-500">{stat}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Create `StatusBadge.tsx`**

```tsx
import type { ReactNode } from 'react'

type Tone = 'positive' | 'negative' | 'pending'

const TONE: Record<Tone, { wrap: string; dot: string }> = {
  positive: {
    wrap: 'bg-[var(--ah-positive-bg)] text-positive',
    dot: 'bg-positive',
  },
  negative: {
    wrap: 'bg-[var(--ah-negative-bg)] text-negative',
    dot: 'bg-negative',
  },
  pending: {
    wrap: 'bg-[var(--ah-pending-bg)] text-slate-600',
    dot: 'bg-pending',
  },
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: Tone
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${TONE[tone].wrap}`}
    >
      <span className={`h-2 w-2 rounded-full ${TONE[tone].dot}`} aria-hidden />
      {children}
    </span>
  )
}
```

- [ ] **Step 6: Create `Tag.tsx`**

```tsx
import type { ReactNode } from 'react'

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
      {children}
    </span>
  )
}
```

- [ ] **Step 7: Create `index.ts`**

```ts
export { Card } from './Card'
export { KpiStat } from './KpiStat'
export { PageHeader } from './PageHeader'
export { SectionHeading } from './SectionHeading'
export { StatusBadge } from './StatusBadge'
export { Tag } from './Tag'
```

- [ ] **Step 8: Typecheck**

Run:
```bash
cd frontend && npm run typecheck
```
Expected: passes. (Unused-export warnings do not occur — these are library modules; ESLint's `no-unused-vars` is scoped to locals.)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/ui
git commit -m "feat(frontend): add shared UI primitives (Card, KpiStat, PageHeader, ...)"
```

---

## Task 4: Layout shell — navy enterprise nav

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Interfaces:**
- Consumes: `--ah-*` tokens, Tailwind `brand`/`accent`.
- Produces: the shared app frame. No exported API change (`Layout` stays a zero-prop component used in `App.tsx`).

- [ ] **Step 1: Replace `frontend/src/components/Layout.tsx`**

```tsx
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

import logoSquare from '../images/logo-square.png'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `-mb-px border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition ${
    isActive
      ? 'border-[var(--ah-indigo)] text-white'
      : 'border-transparent text-white/70 hover:text-white'
  }`

export function Layout() {
  const auth = useAuth()

  return (
    <div className="min-h-screen bg-[var(--ah-canvas)]">
      <header className="bg-[var(--ah-navy)] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white"
          >
            <img src={logoSquare} alt="" className="h-8 w-8 rounded-md" />
            Menarini Automation Hub
          </NavLink>
          <nav
            aria-label="Main navigation"
            className="flex flex-wrap gap-x-6 gap-y-1 self-stretch"
          >
            <NavLink to="/" end className={navClass}>
              Home
            </NavLink>
            <NavLink to="/catalog" className={navClass}>
              Automations
            </NavLink>
            <NavLink to="/ideas" className={navClass}>
              Ideas
            </NavLink>
            <NavLink to="/executive" className={navClass}>
              Executive
            </NavLink>
            <NavLink to="/simple-ops" className={navClass}>
              Operations
            </NavLink>
            <NavLink to="/sla-kpi" className={navClass}>
              Performances
            </NavLink>
            <NavLink to="/process-economics" className={navClass}>
              Business Cases
            </NavLink>
          </nav>
          {auth.isAuthenticated ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-white/70">
                {auth.user?.profile.name ??
                  auth.user?.profile.preferred_username}
              </span>
              <button
                type="button"
                onClick={() => {
                  void auth.removeUser()
                  void auth.signoutRedirect()
                }}
                className="rounded-lg border border-white/30 px-3 py-2 font-semibold text-white transition hover:bg-white/10"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void auth.signinRedirect()}
              className="rounded-lg bg-[var(--ah-indigo)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--ah-indigo-hover)]"
            >
              Sign in
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + build**

```bash
cd frontend && npm run typecheck && npm run build
```
Expected: both succeed.

- [ ] **Step 3: Visual check**

`npm run dev`. Expected: solid navy header, white wordmark + logo, nav links muted white, the current route's link is full white with an indigo underline. "Sign in" is an indigo button (or "Sign out" a white-outline button when authenticated). Header content lines up with page content below (both `max-w-7xl`). Check on `/executive` and `/simple-ops`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat(frontend): rebuild nav shell as navy enterprise header"
```

---

## Task 5: Chart palette

**Files:**
- Modify: `frontend/src/lib/chartColors.ts`
- Modify: `frontend/src/components/RunningCostTrendChart.tsx`

**Interfaces:**
- Consumes: palette hexes from the reference table.
- Produces:
  - `chart` object with keys: `positive`, `spend`, `capex`, `opexPersonnel`, `opexInfra`, `opexLicensing`, `negative`, `neutral`, `grid`, `axis`, `tick`, `tooltipBorder` (all string literals — recharts needs literals, not `var()`).
  - `chartSeries: readonly string[]` — the CAPEX→OPEX ramp for categorical charts.
- Note: `chartColors.ts` is imported by `TcoRoiChart.tsx`, `RankBarChart.tsx`, `TrendChart.tsx`. `chart.spendDark` / `chart.spendLight` are removed — verify no remaining references (`grep`).

- [ ] **Step 1: Check current references**

```bash
cd frontend && grep -rn "chart\.\(spendDark\|spendLight\)\|chartSeries" src/
```
Note every hit — Step 2/3 must keep each referenced key valid.

- [ ] **Step 2: Replace `frontend/src/lib/chartColors.ts`**

```ts
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
```

- [ ] **Step 3: If Step 1 found `spendDark`/`spendLight` references**

Only `TcoRoiChart.tsx` is likely. For each reference, replace `chart.spendDark` → `chart.capex` and `chart.spendLight` → `chart.opexPersonnel` (the CAPEX/OPEX band split TcoRoiChart draws). Leave all other TcoRoiChart colours as they resolve through the updated `chart` object.

- [ ] **Step 4: Update segment colours in `frontend/src/components/RunningCostTrendChart.tsx`**

Replace the `SEGMENTS` array (lines ~16–34) with:

```tsx
const SEGMENTS: {
  key: keyof RunningCostTrendPoint
  name: string
  color: string
}[] = [
  { key: 'license_eur', name: 'Licences', color: 'var(--ah-chart-opex-licensing)' },
  {
    key: 'infrastructure_eur',
    name: 'Infrastructure',
    color: 'var(--ah-chart-opex-infra)',
  },
  { key: 'ams_1l_eur', name: 'AMS 1L', color: 'var(--ah-chart-opex-personnel)' },
  { key: 'ticket_2l_eur', name: '2L tickets', color: 'var(--ah-chart-capex)' },
  {
    key: 'change_request_eur',
    name: 'Change requests',
    color: 'var(--ah-ink-3)',
  },
]
```

Then in the JSX, update the recharts axis/grid/tooltip/line props that currently use old `--color-*` vars:
- `<CartesianGrid stroke="var(--ah-chart-grid)" vertical={false} />`
- both `<XAxis>` / `<YAxis>` `tick={{ fill: 'var(--ah-ink-2)', fontSize: 12 }}` and `stroke="var(--ah-chart-axis)"`
- `<Tooltip contentStyle={{ borderRadius: 8, borderColor: 'var(--ah-border-strong)', fontSize: 13 }} />`
- `<Line ... stroke="var(--ah-ink)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />`

(These `var()` values resolve because the chart renders inside `.simple-ops-page`, and `--ah-*` are on `:root`.)

- [ ] **Step 5: Typecheck + build**

```bash
cd frontend && npm run typecheck && npm run build
```
Expected: both succeed, no unresolved-identifier errors from `chartColors`.

- [ ] **Step 6: Visual check**

`npm run dev`. On `/simple-ops` the running-cost stacked bars are now blue/green/grey/aqua; grid lines light grey; total line near-black. On `/sla-kpi` and `/executive`, line/bar charts use the new blue→green ramp and are still legible. Note issues for follow-up; do not restyle sla-kpi/executive here.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/chartColors.ts frontend/src/components/RunningCostTrendChart.tsx frontend/src/components/TcoRoiChart.tsx
git commit -m "feat(frontend): move charts to the CAPEX/OPEX enterprise palette"
```
(Drop `TcoRoiChart.tsx` from the `git add` if Step 3 did not touch it.)

---

## Task 6: simple-ops CSS — re-point tokens, add elevation

**Files:**
- Modify: `frontend/src/pages/SimpleOpsPage.css`

**Interfaces:**
- Consumes: `--ah-*` from Task 1.
- Produces: the `.simple-ops-page` scope still defines every `--color-*`, `--color-accent-*`, `--color-accent-2-*`, `--color-neutral-*`, `--status-*` name that `SlaKpiPage.tsx`, `SimpleOpsPage.tsx`, and `RunningCostTrendChart.tsx` read — but now aliased to `--ah-*`. Cards gain `--ah-shadow-card`.

- [ ] **Step 1: Replace the token block (lines ~9–69, from `.simple-ops-page {` through the closing `}` before `.simple-ops-page * {`)**

```css
.simple-ops-page {
  /* All design tokens now alias the global layer in src/styles/theme.css.
     Local --color-* names are kept because SlaKpiPage.tsx and inline styles
     reference them directly. accent ramp = enterprise blue, accent-2 = grey. */
  --color-bg: var(--ah-canvas);
  --color-surface: var(--ah-surface);
  --color-text: var(--ah-ink);
  --color-accent: #1e3a8a;
  --color-accent-2: #9ca3af;
  --color-divider: var(--ah-border);

  --color-neutral-100: #f7f7f7;
  --color-neutral-200: #e0e0e0;
  --color-neutral-300: #d9d9d9;
  --color-neutral-400: #a0a0a0;
  --color-neutral-500: #808080;
  --color-neutral-600: #666666;
  --color-neutral-700: #444444;
  --color-neutral-800: #2a2a2a;
  --color-neutral-900: #1a1a1a;

  --color-accent-100: #eaf0fa;
  --color-accent-200: #d5e0f4;
  --color-accent-300: #b0c4e8;
  --color-accent-400: #6d8fce;
  --color-accent-500: #1e3a8a;
  --color-accent-600: #1b337b;
  --color-accent-700: #172c6a;
  --color-accent-800: #132456;
  --color-accent-900: #0d1a40;

  --color-accent-2-100: #f3f4f6;
  --color-accent-2-200: #e5e7eb;
  --color-accent-2-300: #d1d5db;
  --color-accent-2-400: #b3b8c0;
  --color-accent-2-500: #9ca3af;
  --color-accent-2-600: #6b7280;
  --color-accent-2-700: #4b5563;
  --color-accent-2-800: #374151;
  --color-accent-2-900: #1f2937;

  --status-green: var(--ah-positive);
  --status-amber: var(--ah-pending);
  --status-red: var(--ah-negative);

  --font-heading: var(--ah-font-sans);
  --font-heading-weight: 700;
  --font-body: var(--ah-font-sans);

  --space-1: 5px;
  --space-2: 10px;
  --space-3: 15px;
  --space-4: 20px;

  --radius-sm: var(--ah-radius-sm);
  --radius-md: var(--ah-radius-md);

  --shadow-lg: var(--ah-shadow-card);

  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.55;
}
```

- [ ] **Step 2: Give cards elevation**

In `.simple-ops-page .kpi` (around line 131): add `box-shadow: var(--ah-shadow-card);` and change `border` to `border: 1px solid var(--ah-border);`.

In `.simple-ops-page .card` (around line 603): add `box-shadow: var(--ah-shadow-card); border: 1px solid var(--ah-border);`.

- [ ] **Step 3: Heading weight**

`.simple-ops-page h1, .simple-ops-page h2, .simple-ops-page h3` already use `var(--font-heading-weight)` which is now `700`. No edit needed — confirm by reading lines ~80–87.

- [ ] **Step 4: Build**

```bash
cd frontend && npm run build
```
Expected: succeeds.

- [ ] **Step 5: Visual check**

`npm run dev`, `/simple-ops` and `/sla-kpi`. Expected: both pages now read blue/grey/green; KPI + `.card` tiles have a soft drop shadow and sit clearly above the `#F7F7F7` canvas; headings are bold; nothing overlaps or clips. `/sla-kpi` donuts/segmented controls still render (they use `--color-accent-*`, now blue).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/SimpleOpsPage.css
git commit -m "feat(frontend): alias simple-ops tokens to the global layer, add card elevation"
```

---

## Task 7: simple-ops page — rebuild chrome on primitives

**Files:**
- Modify: `frontend/src/pages/SimpleOpsPage.tsx`
- Modify: `frontend/src/components/AsyncSection.tsx`

**Interfaces:**
- Consumes: `ui/` primitives from Task 3; `--ah-*` tokens.
- Produces: no exported API change (`SimpleOpsPage` stays a zero-prop route component). Data fetching, `PROCESS_SEGMENTS`, pagination, hover state, the stacked-bar and heatmap JSX are unchanged.

- [ ] **Step 1: Update `AsyncSection.tsx` error box**

Replace the error branch's wrapper `className` (line ~27):

```tsx
        className="rounded-xl border border-negative/30 bg-negative/5 p-6 text-negative"
```

Leave the loading branch unchanged — its `bg-white` / `text-slate-600` are already correct under the new ramp.

- [ ] **Step 2: In `SimpleOpsPage.tsx`, add the import**

Below `import { RunningCostTrendChart } from '../components/RunningCostTrendChart'` add:

```tsx
import { KpiStat, PageHeader, SectionHeading } from '../components/ui'
```

- [ ] **Step 3: Replace the `KpiCard` component (lines ~50–71) with a thin adapter over `KpiStat`**

```tsx
interface KpiCardProps {
  label: string
  value: number | null
  unit: 'eur' | 'count'
  subtitle?: string | null
  spot?: boolean
  hero?: boolean
}

function KpiCard({ label, value, unit, subtitle, spot, hero }: KpiCardProps) {
  return (
    <KpiStat
      label={label}
      value={value === null ? 'N/A' : formatValue(value, unit)}
      delta={subtitle ?? undefined}
      deltaTone={spot ? 'muted' : 'auto'}
      hero={hero}
    />
  )
}
```

(The `.kpi-row` grid wrapper in the JSX stays — `KpiStat` renders one tile per cell. Remove the now-unused `.kpi`/`.kpi-hero`/`.kpi-num`/`.kpi-label`/`.kpi-delta` rules from `SimpleOpsPage.css` only if nothing else in that file references them — `.kpi-delta` IS used elsewhere in the file for empty states, so leave the CSS alone; unused `.kpi` rules are harmless.)

- [ ] **Step 4: Replace the page header block (lines ~126–131)**

Old:
```tsx
        <div className="sheet">
          <h1 className="dash-h1">Operations Dashboard</h1>
          <p className="dash-sub">
            A comprehensive view of your RPA maintenance and execution costs of ${CURRENT_YEAR}.
          </p>
```

New:
```tsx
        <div className="sheet">
          <PageHeader
            title="Operations Dashboard"
            subtitle={`A comprehensive view of your RPA maintenance and execution costs for ${CURRENT_YEAR}.`}
          />
```

(Fixes the stray `$` and the odd "of {year}" phrasing.)

- [ ] **Step 5: Convert the three `<h2>` section headings to `SectionHeading`**

For "Total running cost trend" (lines ~213–219):
```tsx
          <section className="blk">
            <SectionHeading dotColor="var(--ah-ink-3)">
              Total running cost trend
            </SectionHeading>
            <p className="note">
```

For "Cost breakdown by process" (lines ~239–248) — it has a `.blk-head` with a stat:
```tsx
          <section className="blk">
            <SectionHeading
              stat={
                avgCostPerProcess !== null ? (
                  <>
                    Avg. cost per process:{' '}
                    <span className="font-bold text-ink [font-feature-settings:'pnum'_1]">
                      {formatValue(avgCostPerProcess, 'eur')}
                    </span>
                  </>
                ) : undefined
              }
            >
              Cost breakdown by process
            </SectionHeading>
            <p className="note">
```

For "Infrastructure & machine utilisation" (lines ~369–375):
```tsx
          <section className="blk">
            <SectionHeading dotColor="var(--ah-chart-opex-infra)">
              Infrastructure &amp; machine utilisation
            </SectionHeading>
            <p className="note">
```

- [ ] **Step 6: Retarget remaining inline `var(--color-*)` in the JSX**

- heatmap cell fill (line ~412): `var(--color-accent)` → `var(--ah-chart-capex)`; the empty-cell `var(--color-neutral-200)` → `var(--ah-border)`.
- VM/DB stat-line values (lines ~441, ~452): `var(--color-accent-2-700)` → `var(--ah-ink-2)`.
- `tbd` border (line ~458): `var(--color-accent-2-300)` → `var(--ah-border-strong)`.

- [ ] **Step 7: Typecheck + lint + build**

```bash
cd frontend && npm run typecheck && npx eslint src/pages/SimpleOpsPage.tsx src/components/AsyncSection.tsx --max-warnings 0 && npm run build
```
Expected: all pass. If `CURRENT_YEAR` or `formatValue` becomes unused, remove the dead import/const (they are still used elsewhere in the file — verify before deleting).

- [ ] **Step 8: Visual review against `design/specs/*.jpg`**

`npm run dev`, `/simple-ops`. Check:
- KPI row: uppercase indigo kickers, big bold near-black numbers, "Total running cost" is the larger hero tile with faint navy tint, deltas green/red by sign, soft shadows.
- Section headings bold with colour dots; the breakdown heading shows the avg-cost stat right-aligned.
- Running-cost chart blue/green/grey/aqua on light grid.
- Heatmap uses blue intensity; stacked process bars use the accent ramp.
- Page sits on `#F7F7F7`; cards clearly elevated; no clipped tooltips or overlap at 1280px and at 375px width.
- `/sla-kpi` still renders correctly (regression).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/SimpleOpsPage.tsx frontend/src/components/AsyncSection.tsx
git commit -m "feat(frontend): rebuild simple-ops chrome on shared primitives"
```

---

## Task 8: Format, full verification, spec status

**Files:**
- Modify: any files this plan touched that fail `prettier --check`
- Modify: `docs/superpowers/specs/2026-08-31-portal-ui-redesign-design.md`

- [ ] **Step 1: Format only the files this work touched**

```bash
cd frontend
npx prettier --write src/styles/theme.css src/index.css index.html tailwind.config.js \
  src/components/ui src/components/Layout.tsx src/components/AsyncSection.tsx \
  src/lib/chartColors.ts src/components/RunningCostTrendChart.tsx \
  src/components/TcoRoiChart.tsx src/pages/SimpleOpsPage.tsx src/pages/SimpleOpsPage.css
```
(Do NOT run repo-wide `npm run format` — 13 unrelated files fail formatting on `master` and are out of scope.)

- [ ] **Step 2: Full verification**

```bash
cd frontend && npm run typecheck && npm run build && npx eslint . --max-warnings 0
```
Expected: all pass. `prettier --check .` will still report the 13 pre-existing files — that is the documented baseline, not a regression.

- [ ] **Step 3: Cross-page regression sweep**

`npm run dev`, click through every nav item: Home, Automations, Ideas, Executive, Operations, Performances, Business Cases. Confirm none is broken (unreadable text, invisible buttons, collapsed layout). Record any page needing a follow-up polish pass in the spec's "Blast radius" table.

- [ ] **Step 4: Update the spec status**

In `docs/superpowers/specs/2026-08-31-portal-ui-redesign-design.md`, change the `**Status:**` line to:
```
**Status:** Implemented (shell + simple-ops); other pages pending their polish passes
```
Add a short "## Implementation notes" section at the end noting anything that deviated from the design (e.g. which pages need follow-up).

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore(frontend): format redesign files; mark spec implemented"
```

---

## Self-review notes

- **Spec coverage:** token layer (T1), Tailwind remap (T3→T2), primitives (T3), shell (T5→T4), simple-ops rebuild (T6+T7), charts (T6b→T5), AsyncSection (T7), blast-radius verification (T8). All spec sections map to a task.
- **Type consistency:** `KpiStat` prop names (`label`, `value`, `delta`, `deltaTone`, `dot`, `hero`) are used identically in Task 3 (definition) and Task 7 (`KpiCard` adapter). `SectionHeading` prop `dotColor`/`stat` consistent between Task 3 and Task 7. `chart.capex` / `chart.opexPersonnel` etc. defined in Task 5 Step 2, referenced in Task 5 Steps 3–4.
- **No placeholders:** every code step shows full content; CSS edits give exact selector + old→new.
- **Known soft spot:** exact line numbers in `SimpleOpsPage.tsx` / `.css` will drift as edits land — each step also names the selector or JSX anchor text, so an executor reading out of order can still locate them.
