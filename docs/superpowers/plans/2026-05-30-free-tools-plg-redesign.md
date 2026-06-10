# Free-Tool PLG Redesign + Freemium Workspace — Implementation Plan

> ⚠️ **SUPERSEDED (2026-06-05)** by
> [`2026-05-31-free-tools-plg-master.md`](2026-05-31-free-tools-plg-master.md),
> the consolidated master plan. It reconciles this plan with the docs, excludes
> Position Analyzer from simplification (SaaS bridge), and adopts the local-first
> conversion ladder. Kept for history; do not execute from this file.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the six free tools conform to the "1-3-More" progressive-disclosure skeleton with value-first lead capture, then add a freemium (`free`) dashboard tier whose Tools tab hosts the calculators with account-backed saves while platform tabs preview paid features.

**Architecture:** `specter-web` owns all tool UI and the dashboard; a single `tool-layout.tsx` enforces the canonical render order via content slots so individual tool pages cannot drift back into density. `specter-api` (FastAPI + SQLAlchemy async + Alembic) gains a `free` plan beneath RECON and a `saved_calculations` table backing the workspace. Each phase (P1→P5e) ships independently and keeps all tests green.

**Tech Stack:** Next.js 14 App Router (TypeScript strict), Tailwind + shadcn/ui, TanStack Query, Supabase Auth (HS256 JWT), PostHog, Recharts/Framer Motion; FastAPI, SQLAlchemy 2.0 async, asyncpg, Alembic, Pydantic v2, pytest. Frontend tests: Vitest (`npm test`). Backend tests: pytest.

---

## Source-of-Truth References

- Design spec: `docs/superpowers/specs/2026-05-30-free-tools-plg-redesign-design.md` (§2.1 skeleton, §2.2 per-tool 1-3-More, §3 gate, §5 segmentation, §12 freemium).
- Per-tool gate configs already exist: `specter-web/lib/feature-gates.ts` (`PRICE_POSITION_GATES`, `FBA_GATES`, `SHOPIFY_GATES`, `SHIPPING_GATES`, `ROAS_GATES`, `INVENTORY_GATES`). Reuse these — do not invent new gate keys.
- Analytics event catalogue: `specter-web/lib/analytics.ts`. New events are added in P4/P5e by extending `AnalyticsEvent` + `EventProperties`.
- Backend plan gate: `specter-api/auth/plan_gate.py` (`PLAN_HIERARCHY`, `requires_plan`, `plan_gate`).

## Conventions (read before starting any task)

- **Frontend test policy (from CLAUDE.md):** *test calculator math logic only* — never add tests for marketing/section/layout components. So P1/P2/P4 UI work is verified with `npm run lint` + `npm run build` + a manual run, NOT component unit tests. Where a task introduces **pure logic** (e.g. a verdict helper, OG-image param encoding, saved-calc serialization), write a Vitest unit test for that function.
- **Backend test policy:** full TDD with pytest. Follow the existing pattern in `specter-api/routers/test_merchants.py` (real HS256 JWTs via `make_jwt`, `MagicMock(spec=Merchant)` via `make_merchant`, dependency overrides on `get_current_merchant` and `get_db`).
- **Run commands:**
  - Frontend (cwd `specter-web`): `npm run lint`, `npm run build`, `npm test`, `npm run dev`.
  - Backend (cwd `specter-api`): `python -m pytest -q` (env vars are set by `tests/conftest.py`).
- **Commit cadence:** one commit per task (or per step where noted). Branch off `master` before starting (do not commit on `master`).
- **Hard rules (never violate):** never gate the core calculation; all SEO text + FAQ + schema stay in the DOM (visual hiding only); public `/tools/*` stay public + crawlable; no fake blurred *real* data; plan gating enforced server-side (frontend gating is UI-only).

---

# PHASE P1 — Shared Skeleton

**Outcome:** `tool-layout.tsx` exports slot components (`ResultVerdict`, `ToolHero`, `SupportingMetrics`, `FullBreakdown`) that encode the canonical order from spec §2.1. No per-tool logic changes yet; one tool (price-position) is migrated to prove the API.

### Task P1.1: Add the `ResultVerdict` slot component

**Files:**
- Modify: `specter-web/components/tools/tool-layout.tsx` (append after `SignalBadge`, end of file ~line 282)

- [ ] **Step 1: Implement `ResultVerdict`**

Append to `specter-web/components/tools/tool-layout.tsx`:

```tsx
// ── THE ANSWER slot: hero number + "what this means" + "do this next" ────────

export function ResultVerdict({
  hero,
  heroLabel,
  variant = 'highlight',
  whatThisMeans,
  doThisNext,
}: {
  /** The single hero value, already formatted (e.g. "$12.40" or "RAISE"). */
  hero: React.ReactNode
  /** Small label above the hero (e.g. "Net profit per unit"). */
  heroLabel: string
  variant?: 'default' | 'positive' | 'negative' | 'warning' | 'highlight'
  /** One plain-English sentence interpreting the hero. */
  whatThisMeans: string
  /** One concrete next action sentence. */
  doThisNext: string
}) {
  const colors = {
    default:   'text-text',
    positive:  'text-emerald-400',
    negative:  'text-rose-400',
    warning:   'text-amber-400',
    highlight: 'text-primary',
  }
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 text-center">
      <p className="font-body text-xs text-muted uppercase tracking-widest mb-2">{heroLabel}</p>
      <div className={cn('font-mono text-4xl md:text-5xl font-bold mb-4', colors[variant])}>
        {hero}
      </div>
      <div className="max-w-md mx-auto space-y-2 text-left">
        <p className="font-body text-sm text-text">
          <span className="text-muted font-semibold uppercase text-xs tracking-wide mr-2">What this means</span>
          {whatThisMeans}
        </p>
        <p className="font-body text-sm text-text">
          <span className="text-primary font-semibold uppercase text-xs tracking-wide mr-2">Do this next</span>
          {doThisNext}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Lint + build**

Run (cwd `specter-web`): `npm run lint && npm run build`
Expected: exit 0, no new errors (the export is unused so far — that's fine).

- [ ] **Step 3: Commit**

```bash
git add specter-web/components/tools/tool-layout.tsx
git commit -m "feat(tools): add ResultVerdict 'THE ANSWER' slot to tool-layout"
```

### Task P1.2: Add `ToolHero`, `SupportingMetrics`, and `FullBreakdown` slots

**Files:**
- Modify: `specter-web/components/tools/tool-layout.tsx`

- [ ] **Step 1: Implement the three slots**

Append to `specter-web/components/tools/tool-layout.tsx` (after `ResultVerdict`):

```tsx
// ── Supporting metrics row: at most 3, visually secondary ───────────────────

export function SupportingMetrics({
  children,
}: {
  /** Pass at most 3 <Metric> children. Enforced visually by the 3-col grid. */
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface/50 border border-border rounded-2xl p-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{children}</div>
    </div>
  )
}

// ── Full breakdown: collapsed by default, content stays in DOM (SEO-safe) ────

export function FullBreakdown({
  label = 'See full breakdown',
  children,
  className,
}: {
  label?: string
  children: React.ReactNode
  className?: string
}) {
  // Uses <details> so content is ALWAYS in the DOM for crawlers/screen readers.
  return (
    <details className={cn('group bg-surface border border-border rounded-2xl', className)}>
      <summary className="flex items-center justify-between cursor-pointer list-none px-5 py-4 font-mono text-xs uppercase tracking-wider text-muted hover:text-text">
        <span>{label}</span>
        <span className="transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
      </summary>
      <div className="px-5 pb-5 pt-1 space-y-5">{children}</div>
    </details>
  )
}
```

> **Why `<details>` not `AdvancedAccordion`:** `AdvancedAccordion` (Framer Motion) unmounts content on close, removing it from the DOM and breaking the "SEO text stays in DOM" rule. `<details>` keeps children rendered. Keep `AdvancedAccordion` for *input* options only.

- [ ] **Step 2: Implement `ToolHero` thin wrapper**

The hero badge/title/description already live in `ToolLayout`'s `<section>`. `ToolHero` is a no-op marker that documents intent and lets pages opt into the Quick-Answer-first ordering. Append:

```tsx
// ── Marker wrapper so pages declare the canonical slot order explicitly ──────
// Renders children unchanged; exists to make the render order self-documenting
// and to give a single import surface for the skeleton slots.
export function ToolSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-6', className)}>{children}</div>
}
```

- [ ] **Step 3: Lint + build**

Run (cwd `specter-web`): `npm run lint && npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add specter-web/components/tools/tool-layout.tsx
git commit -m "feat(tools): add SupportingMetrics, FullBreakdown, ToolSection slots"
```

### Task P1.3: Migrate price-position-analyzer to the slot API (reference implementation)

**Files:**
- Modify: `specter-web/app/tools/price-position-analyzer/page.tsx`

This proves the skeleton end-to-end on the highest-conversion tool. The math (`calcPricePosition`) and gates are unchanged — only render order/grouping changes.

- [ ] **Step 1: Import the new slots**

In `page.tsx`, change the `tool-layout` import (line 6-8) to add the new slots:

```tsx
import ToolLayout, {
  CalcCard, Field, Input, Metric, SignalBadge,
  ResultVerdict, SupportingMetrics, FullBreakdown, ToolSection,
} from '@/components/tools/tool-layout'
```

- [ ] **Step 2: Replace the manual-mode results column with the slot order**

Inside `{mode === 'manual' && ( ... )}`, the results column currently renders: Signal card, Market Overview card, Your Position card, "How signals work" card. Re-express as the canonical order. Replace the results `<div className="flex flex-col gap-5">…</div>` (lines ~308-380) with:

```tsx
<ToolSection>
  {/* 3. THE ANSWER */}
  <ResultVerdict
    heroLabel="Your signal"
    variant={r.signal === 'RAISE' ? 'positive' : r.signal === 'LOWER' ? 'negative' : 'warning'}
    hero={
      <span className="inline-flex items-center gap-3">
        {r.signal}
        {r.signal !== 'HOLD' && (
          <span className="text-2xl text-primary">{fmt(fromUSD(r.suggested_price))}</span>
        )}
      </span>
    }
    whatThisMeans={r.signal_reason}
    doThisNext={
      r.signal === 'RAISE'
        ? `Test raising toward ${fmt(fromUSD(r.suggested_price))} and watch conversion for a week.`
        : r.signal === 'LOWER'
        ? `You're priced above market — review whether your brand/reviews justify the premium before holding.`
        : `You're competitively placed. Re-check when a competitor moves more than 5%.`
    }
  />

  {/* 4. SUPPORTING — exactly 3 */}
  <SupportingMetrics>
    <Metric label="Market average" value={fmt(fromUSD(r.market_avg))} variant="highlight" />
    <Metric label="Your rank" value={`#${r.my_rank} of ${r.total_competitors + 1}`} sub={`${r.competitors_below} cheaper · ${r.competitors_above} pricier`} />
    <Metric label="Gap vs avg" value={fmtPct(r.gap_pct_vs_avg)} variant={r.gap_pct_vs_avg > 5 ? 'negative' : r.gap_pct_vs_avg < -5 ? 'positive' : 'default'} sub={r.gap_pct_vs_avg > 0 ? 'Above average' : r.gap_pct_vs_avg < 0 ? 'Below average' : 'At average'} />
  </SupportingMetrics>

  {/* 5. FULL BREAKDOWN — everything else, collapsed but in DOM */}
  <FullBreakdown>
    <CalcCard title="Market Overview">
      {/* MOVE the existing Market Low/High/Avg/Median grid + Price Range Visualizer here unchanged */}
    </CalcCard>
    <CalcCard title="Your Position">
      {/* MOVE the existing vs-low / position grid here unchanged */}
    </CalcCard>
    <div className="bg-surface/50 border border-border rounded-xl p-4">
      {/* MOVE the existing "How signals work" block here unchanged */}
    </div>
  </FullBreakdown>
</ToolSection>
```

Move the existing JSX from those three cards into the marked `FullBreakdown` children verbatim (do not delete any metric — it must stay in the DOM for SEO). The inputs column (left) is unchanged.

- [ ] **Step 3: Manual verification**

Run (cwd `specter-web`): `npm run dev`, open `http://localhost:3000/tools/price-position-analyzer`.
Verify by eye: on first paint you see Quick Answer → inputs → ONE hero verdict → 3 supporting metrics → a collapsed "See full breakdown". Expand it; all the old metrics/visualizer are present. `View Source` / disable JS: the breakdown text is still in the HTML (it's `<details>`, always rendered).

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: exit 0, 38/38 (or current count) static pages compiled.

- [ ] **Step 5: Commit**

```bash
git add specter-web/app/tools/price-position-analyzer/page.tsx
git commit -m "refactor(tools): migrate price-position to 1-3-More skeleton slots"
```

### Task P1.4: Document the slot contract in WEBSITE.md cross-check

**Files:**
- Modify: `docs/WEBSITE.md` (the "Tool Page Standard Skeleton" section already lists the 9-step order — add the slot component names)

- [ ] **Step 1: Annotate the skeleton steps with component names**

In `docs/WEBSITE.md`, under "Tool Page Standard Skeleton", append one line:

```markdown
**Slot components** (`components/tools/tool-layout.tsx`): step 1 `QuickAnswer`; step 2 `CalcCard`/`Field`/`Input` + `AdvancedAccordion` (inputs only); step 3 `ResultVerdict`; step 4 `SupportingMetrics` (≤3 `Metric`); step 5 `FullBreakdown` (`<details>`, stays in DOM); steps 6-9 `EmailCaptureGate`/`LockedSection`/`ShareResult`+`EmbedCode`/`ToolFAQ`+`ToolDisclaimer`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/WEBSITE.md
git commit -m "docs(website): map skeleton steps to tool-layout slot components"
```

---

# PHASE P2 — Per-Tool Simplification (worst-first)

**Outcome:** each remaining tool re-expressed in the slot order with its spec §2.2 hero + 3 supporting + breakdown mapping, plain-English labels, and a "what this means / do this next". **Order: shipping → roas → shopify-profit → fba → inventory** (price-position done in P1.3).

**The canonical recipe (applies to every P2 task):**
1. Add the new slot imports (as in P1.3 Step 1).
2. Wrap the results region in `<ToolSection>`.
3. Render exactly ONE `<ResultVerdict>` using the tool's HERO from the table below, with a `whatThisMeans` + `doThisNext` written in plain English.
4. Render exactly THREE `<Metric>` inside `<SupportingMetrics>` from the "3 SUPPORTING" column.
5. Move every other currently-visible metric/card/chart/table verbatim into `<FullBreakdown>` (nothing deleted — SEO).
6. For any input beyond the 4 primary ones, move it inside an `<AdvancedAccordion label="Advanced options">`.
7. Replace jargon labels with plain-English per spec §6 (keep the precise term in a hint/tooltip).
8. Leave existing `EmailCaptureGate`, `LockedSection`, `ShareResult`, `EmbedCode`, `ToolFAQ`, `ToolDisclaimer` in place (re-timing happens in P3).

**Per-task verification (identical each time):** `npm run lint && npm run build` (exit 0) + `npm run dev` eyeball that first paint shows ≤ 1 hero + 3 supporting + ≤1 chart and the breakdown holds everything else and is still in the DOM. Commit `git commit -m "refactor(tools): migrate <tool> to 1-3-More skeleton"`.

### Task P2.1: shipping-calculator (worst — 12 metrics / 15 cards, no accordion)

**Files:** Modify `specter-web/app/tools/shipping-calculator/page.tsx`. Logic: `specter-web/lib/tools/shipping.ts`, `shipping-rates.ts`. Gates: `SHIPPING_GATES`.

Mapping (spec §2.2):
- **HERO:** Cheapest carrier + its cost (e.g. "USPS — $7.20"). `variant="positive"`.
- **3 SUPPORTING:** Cost per package · Margin impact · vs next-cheapest carrier.
- **FULL BREAKDOWN:** per-carrier comparison table, international duties detail, 1-box packaging optimizer.
- **whatThisMeans** example: "USPS is your cheapest option for this package — $1.80 less than the next carrier." **doThisNext:** "Use USPS for this weight/zone; re-check if your average package weight changes."
- **Plain-English labels:** "Dimensional weight" → keep term, hint "Carriers bill the greater of actual vs size-based weight."
- Move the multiple expanded tabs into `FullBreakdown`; bulk-shipment tab stays gated (P3 handles email gating — leave the existing `SHIPPING_GATES.bulkShipment` wiring as-is).

Follow the canonical recipe + per-task verification + commit.

### Task P2.2: roas-calculator (no progressive disclosure today)

**Files:** Modify `specter-web/app/tools/roas-calculator/page.tsx`. Logic: `lib/tools/roas.ts`, `benchmarks.ts`. Gates: `ROAS_GATES`.

Mapping:
- **HERO:** "Your ROAS vs break-even ROAS" verdict (e.g. "3.2× — Profitable", green) — profitable if actual ≥ break-even, else "Below break-even" (red).
- **3 SUPPORTING:** Profit on ad spend · Break-even ROAS · CPA vs target.
- **FULL BREAKDOWN:** funnel detail, full benchmark table (keep only 2 of 6 platforms free — `ROAS_GATES.topPlatformBenchmarks` free; `extendedBenchmarks` stays the blurred email-gated preview).
- **whatThisMeans:** "Every $1 of ad spend returns $3.20 in revenue — above the $X you need to break even." **doThisNext:** "You have room to scale spend; watch that ROAS stays above break-even as you increase budget." (Flip copy when below break-even.)
- **Plain-English:** "ROAS" hint "Revenue per $1 of ad spend"; "Break-even ROAS" hint "The ROAS where you stop losing money."

Recipe + verification + commit.

### Task P2.3: shopify-profit-calculator (13 metrics, heavy tabs)

**Files:** Modify `specter-web/app/tools/shopify-profit-calculator/page.tsx`. Logic: `lib/tools/shopify-profit.ts`. Gates: `SHOPIFY_GATES`.

Mapping:
- **HERO:** Monthly net profit (currency, color by sign).
- **3 SUPPORTING:** Margin % · Profit per order · Health badge.
- **FULL BREAKDOWN:** expense breakdown, plan comparison, basic LTV detail (`SHOPIFY_GATES.basicLtv` is email-gated — leave wiring).
- **whatThisMeans:** "After product, platform, and payment costs, you keep $X/month — a Y% margin." **doThisNext:** "If margin is under ~10%, review your two biggest expense lines first."
- **Plain-English:** "Contribution margin" hint "What's left after product + selling costs."

Recipe + verification + commit.

### Task P2.4: amazon-fba-calculator (closest already; trim default cards)

**Files:** Modify `specter-web/app/tools/amazon-fba-calculator/page.tsx`. Logic: `lib/tools/fba.ts`. Gates: `FBA_GATES`.

Mapping:
- **HERO:** Net profit per unit.
- **3 SUPPORTING:** Margin % · ROI % · Break-even price.
- **FULL BREAKDOWN:** full fee breakdown, tier-fee chart, cost-distribution chart; advanced inputs into `AdvancedAccordion`.
- **whatThisMeans:** "After Amazon fees and your costs, you net $X per unit (Y% margin)." **doThisNext:** "If margin is thin, the fee breakdown shows which fee to attack first."
- **Plain-English:** "Break-even price" hint "The price where you stop losing money."

Recipe + verification + commit.

### Task P2.5: inventory-reorder-calculator (metric count OK; card sprawl)

**Files:** Modify `specter-web/app/tools/inventory-reorder-calculator/page.tsx`. Logic: `lib/tools/inventory.ts`. Gates: `INVENTORY_GATES`.

Mapping:
- **HERO:** "Reorder now?" yes/no + reorder point in units (e.g. "Reorder now — 120 units").
- **3 SUPPORTING:** Reorder quantity · Days of stock left · Safety stock.
- **FULL BREAKDOWN:** demand/lead-time detail, carrying-cost breakdown, multi-SKU table (`INVENTORY_GATES.multiSkuOptimization` email-gated — leave wiring).
- **whatThisMeans:** "At your current sales rate you have N days of stock; your reorder point is P units." **doThisNext:** "Place an order when on-hand hits P units to avoid a stockout during lead time."
- **Plain-English:** "Reorder point" hint "Stock level where you should order more"; "Safety stock" hint "Buffer for demand spikes / late deliveries."

Recipe + verification + commit.

---

# PHASE P3 — Gate Timing + Segmentation

**Outcome:** the Layer-1 email gate fires on *earned value* (not a 3s timer against a pre-filled result); pre-filled inputs are tagged "Example"; CSV/scenario/save sit behind email while PDF/print stay free.

### Task P3.1: Re-time `EmailCaptureGate` to an earned-value trigger

**Files:**
- Modify: `specter-web/components/tools/email-capture-gate.tsx`

Currently the gate shows on a 3s timer once `isResultReady` is true (fires against the always-present pre-filled result). Change it to require an explicit "earned value" signal.

- [ ] **Step 1: Add an `earned` prop and gate on it**

In `EmailCaptureGateProps` add:

```tsx
  /** True once the user has signalled investment: edited an input, expanded the
   *  breakdown, or clicked Save/Compare/CSV. The gate only arms after this. */
  earned?: boolean
```

In the show-effect (lines ~50-61), change the guard so the timer only starts when earned:

```tsx
  useEffect(() => {
    if (!isResultReady || dismissed || earned === false) return
    // earned===undefined keeps legacy behavior; earned===true arms immediately
    const delay = earned ? 600 : DELAY_MS
    timerRef.current = setTimeout(() => {
      setVisible(true)
      if (toolId) trackEmailGateShown(toolId)
    }, delay)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isResultReady, dismissed, earned])
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build` → exit 0.

- [ ] **Step 3: Commit**

```bash
git add specter-web/components/tools/email-capture-gate.tsx
git commit -m "feat(tools): arm email gate on earned-value signal, not a fixed timer"
```

### Task P3.2: Wire the earned-value signal in each tool page

**Files:** Modify all 6 `app/tools/*/page.tsx`.

- [ ] **Step 1: Track earned value per page**

In each page, add state and set it on the three earned-value moments:

```tsx
const [earned, setEarned] = useState(false)
// call markEarned() from: any input onChange, FullBreakdown onToggle, and Save/Compare/CSV handlers
const markEarned = () => setEarned(true)
```

Pass to the gate: `<EmailCaptureGate ... earned={earned} />`. For the breakdown, add `onToggle={markEarned}` by wrapping `<FullBreakdown>` in a `<div onClick>` or add an `onToggle` prop to `FullBreakdown` (`<details onToggle={...}>`). Hook the existing input `onChange`s to also call `markEarned()` (cheapest: wrap the primary input's setter).

- [ ] **Step 2: Add `onToggle` to `FullBreakdown`**

In `tool-layout.tsx` `FullBreakdown`, add an optional `onToggle?: () => void` prop and pass to `<details onToggle={onToggle}>`.

- [ ] **Step 3: Verify + commit**

Run: `npm run lint && npm run build` → exit 0. Manually: load a tool, confirm the gate does NOT pop on the pre-filled result; edit an input or open the breakdown → gate arms.

```bash
git add specter-web/app/tools specter-web/components/tools/tool-layout.tsx
git commit -m "feat(tools): fire email gate only after earned value across all tools"
```

### Task P3.3: "Example" tags on pre-filled inputs

**Files:** Modify `specter-web/components/tools/tool-layout.tsx` (`Field`), and each tool page's primary inputs.

- [ ] **Step 1: Add an `example` flag to `Field`**

Extend `Field` props with `example?: boolean`; when true and the value is still the default, render a small tag:

```tsx
{example && (
  <span className="ml-2 inline-block font-mono text-[10px] uppercase tracking-wide text-muted/70 border border-border rounded px-1.5 py-0.5 align-middle">
    Example
  </span>
)}
```

(Place next to the `label`.)

- [ ] **Step 2: Mark pre-filled inputs**

In each tool page, pass `example` to the primary `Field`s that ship with default values; clear it once the user edits (track a `touched` boolean per field, or compare to the default constant).

- [ ] **Step 3: Verify + commit**

`npm run lint && npm run build` → exit 0.

```bash
git add specter-web/components/tools specter-web/app/tools
git commit -m "feat(tools): label pre-filled inputs as Example until edited"
```

### Task P3.4: Gate CSV behind email; keep PDF/print free

**Files:**
- Modify: `specter-web/components/tools/export-bar.tsx`
- Read: `specter-web/hooks/use-export.ts` (confirm `exportCsv` / `exportPdf`)

- [ ] **Step 1: Add an `emailCaptured` gate to the CSV button**

`ExportBar` gets a new prop `csvUnlocked: boolean` (true when `localStorage['specter_email_captured']` exists). When locked, the CSV button, instead of calling `exportCsv`, scrolls to / arms the email gate:

```tsx
interface ExportBarProps {
  toolId: string
  inputs: ExportRow[]
  results: ExportRow[]
  currency: string
  csvUnlocked: boolean
  onRequireEmail: () => void   // calls markEarned() + reveals the gate
}
```

```tsx
<button
  onClick={csvUnlocked ? exportCsv : onRequireEmail}
  title={csvUnlocked ? 'Download CSV' : 'Enter email to unlock CSV'}
  ...
>
  <Download size={11} aria-hidden="true" />
  CSV{!csvUnlocked && ' 🔒'}
</button>
```

PDF button is unchanged (always free).

- [ ] **Step 2: Wire each page**

Each tool page computes `csvUnlocked` from `localStorage` (in a `useEffect`/state to stay SSR-safe) and passes `onRequireEmail={() => { markEarned(); /* gate arms */ }}`.

- [ ] **Step 3: Verify + commit**

`npm run lint && npm run build` → exit 0. Manual: CSV shows lock pre-email; PDF always works; after email capture, CSV downloads.

```bash
git add specter-web/components/tools/export-bar.tsx specter-web/app/tools
git commit -m "feat(tools): gate CSV behind email (Layer-1); PDF/print stay free"
```

### Task P3.5: Scenario compare + Save behind email

**Files:**
- Read: `specter-web/components/tools/scenario-panel.tsx`
- Modify: `scenario-panel.tsx` + each page's `ScenarioPanel` usage

- [ ] **Step 1: Gate scenario save**

Add `unlocked: boolean` + `onRequireEmail: () => void` props to `ScenarioPanel`. When locked, the "Save scenario" action calls `onRequireEmail` instead of persisting. Loading/comparing already-saved scenarios stays available. Pass `unlocked={csvUnlocked}` (same localStorage flag) and `onRequireEmail` from each page.

- [ ] **Step 2: Verify + commit**

`npm run lint && npm run build` → exit 0.

```bash
git add specter-web/components/tools/scenario-panel.tsx specter-web/app/tools
git commit -m "feat(tools): gate scenario save behind email (Layer-1)"
```

---

# PHASE P4 — Viral + Measurement

**Outcome:** shared links render a branded per-result OG image; a "challenge" share variant; new PostHog funnel events.

### Task P4.1: Per-result OG image route

**Files:**
- Create: `specter-web/app/tools/[tool]/opengraph-image.tsx` *(or per-tool `opengraph-image.tsx` if dynamic segment routing isn't used)* — use Next.js `ImageResponse`.
- Create: `specter-web/lib/tools/og.ts` (pure helper that turns share state → headline string)
- Test: `specter-web/lib/tools/og.test.ts`

- [ ] **Step 1: Write the failing test for the headline helper**

`specter-web/lib/tools/og.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ogHeadline } from './og'

describe('ogHeadline', () => {
  it('formats a price-position result', () => {
    expect(ogHeadline('price-position', { signal: 'RAISE', rank: 2, of: 6 }))
      .toBe('My store ranks #2 of 6 — signal: RAISE')
  })
  it('falls back to a generic line for unknown tools', () => {
    expect(ogHeadline('unknown' as never, {})).toBe('See your result on SPECTER')
  })
})
```

- [ ] **Step 2: Run it, expect FAIL**

Run (cwd `specter-web`): `npm test -- og.test.ts`
Expected: FAIL — `ogHeadline` not exported.

- [ ] **Step 3: Implement `lib/tools/og.ts`**

```ts
import type { ToolId } from '@/lib/analytics'

type OgParams = Record<string, string | number>

export function ogHeadline(tool: ToolId, p: OgParams): string {
  switch (tool) {
    case 'price-position':
      if ('signal' in p && 'rank' in p && 'of' in p)
        return `My store ranks #${p.rank} of ${p.of} — signal: ${p.signal}`
      break
  }
  return 'See your result on SPECTER'
}
```

- [ ] **Step 4: Run it, expect PASS**

Run: `npm test -- og.test.ts` → PASS.

- [ ] **Step 5: Implement the OG image route**

Create `specter-web/app/tools/price-position-analyzer/opengraph-image.tsx` (start with the proven tool; replicate per-tool later):

```tsx
import { ImageResponse } from 'next/og'
import { ogHeadline } from '@/lib/tools/og'
import { decodeShareState } from '@/lib/tools/share'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ searchParams }: { searchParams: { s?: string } }) {
  const state = searchParams?.s ? decodeShareState(searchParams.s) : null
  const headline = state
    ? ogHeadline('price-position', { signal: (state as any).signal ?? 'HOLD', rank: 2, of: 6 })
    : 'Competitor Price Position Analyzer'
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: '#06070D', color: '#E8EAF0', fontSize: 56 }}>
        <div style={{ color: '#00E87A', fontSize: 28, letterSpacing: 4 }}>SPECTER</div>
        <div style={{ marginTop: 24, fontWeight: 700 }}>{headline}</div>
        <div style={{ marginTop: 24, fontSize: 24, color: '#6B7280' }}>Free tool · specterapp.io</div>
      </div>
    ),
    { ...size },
  )
}
```

- [ ] **Step 6: Build + commit**

Run: `npm run build` → exit 0 (route compiles).

```bash
git add specter-web/lib/tools/og.ts specter-web/lib/tools/og.test.ts specter-web/app/tools/price-position-analyzer/opengraph-image.tsx
git commit -m "feat(tools): per-result OG image + ogHeadline helper (price-position)"
```

### Task P4.2: Challenge-share copy variant

**Files:** Modify `specter-web/components/tools/share-result.tsx`.

- [ ] **Step 1:** Add an optional `challengeText?: string` prop; when present, show a secondary "Challenge a friend" button whose copied text is the curiosity-loop line (e.g. price-position: `"My store ranks #2 of 6 — check yours: <url>"`). Pages pass `challengeText` built from their result.
- [ ] **Step 2:** `npm run lint && npm run build` → exit 0. Commit `git commit -m "feat(tools): add challenge-share variant to ShareResult"`.

### Task P4.3: PostHog funnel events for the redesign

**Files:** Modify `specter-web/lib/analytics.ts`.

- [ ] **Step 1: Extend the event catalogue**

Add to `AnalyticsEvent`: `'tool_breakdown_expanded'`, `'tool_csv_unlocked'`, `'tool_scenario_saved'`, `'tool_challenge_shared'`. Add matching `EventProperties` entries, all `{ tool: ToolId }`. Add convenience helpers mirroring `trackToolCalculated`.

```ts
  | 'tool_breakdown_expanded'
  | 'tool_csv_unlocked'
  | 'tool_scenario_saved'
  | 'tool_challenge_shared'
```
```ts
  tool_breakdown_expanded: { tool: ToolId }
  tool_csv_unlocked:       { tool: ToolId }
  tool_scenario_saved:     { tool: ToolId }
  tool_challenge_shared:   { tool: ToolId }
```

- [ ] **Step 2: Fire them** from the earned-value handlers added in P3 (`onToggle` → breakdown_expanded, CSV unlock → csv_unlocked, scenario save → scenario_saved, challenge share → challenge_shared).
- [ ] **Step 3:** `npm run lint && npm run build` → exit 0. Commit `git commit -m "feat(analytics): add PLG funnel events for tool redesign"`.

---

# PHASE P5a — `free` Plan State (backend)

**Outcome:** `free` added to the plan hierarchy beneath RECON; first sign-in creates a `free` merchant (no auto-trial); an explicit "start trial" endpoint sets `plan='recon'` + `trial_ends_at`; the read-only 402 lockout is replaced by a `free` downgrade path.

### Task P5a.1: Add `free` to `PLAN_HIERARCHY` and limits

**Files:**
- Modify: `specter-api/auth/plan_gate.py`
- Modify: `specter-api/routers/test_merchants.py` (the `test_plan_hierarchy_order` assertion)

- [ ] **Step 1: Update the existing failing test**

In `test_merchants.py`, change `test_plan_hierarchy_order` to expect `free` first:

```python
    def test_plan_hierarchy_order(self):
        assert PLAN_HIERARCHY == ["free", "recon", "cipher", "phantom", "predator", "eclipse"]
```

- [ ] **Step 2: Run it, expect FAIL**

Run (cwd `specter-api`): `python -m pytest routers/test_merchants.py::TestPlanGate::test_plan_hierarchy_order -q`
Expected: FAIL (hierarchy still starts with `recon`).

- [ ] **Step 3: Add `free` to plan_gate**

In `plan_gate.py`:

```python
PLAN_HIERARCHY: list[str] = ["free", "recon", "cipher", "phantom", "predator", "eclipse"]
```

Add `free` to the limit maps so lookups never KeyError:

```python
PLAN_MAX_SKUS: dict[str, int | None] = {
    "free":     0,
    "recon":    100,
    ...
}
PLAN_COMPETITOR_LIMITS: dict[str, int | None] = {
    "free":     0,
    "recon":    3,
    ...
}
```

`requires_plan` is unchanged — any gated feature returns False for `free` (it's index 0), producing the existing 403 `upgrade_required`. Verify `requires_plan` is never called with a feature whose min is `free` (none are).

- [ ] **Step 4: Run it, expect PASS**

Run: `python -m pytest routers/test_merchants.py::TestPlanGate -q` → PASS.

- [ ] **Step 5: Commit**

```bash
git add specter-api/auth/plan_gate.py specter-api/routers/test_merchants.py
git commit -m "feat(api): add 'free' plan beneath RECON in PLAN_HIERARCHY"
```

### Task P5a.2: First sign-in creates a `free` merchant (no trial); drop read-only lockout

**Files:**
- Modify: `specter-api/auth/supabase.py`
- Test: `specter-api/auth/test_supabase_auth.py` (create)

- [ ] **Step 1: Write the failing test**

Create `specter-api/auth/test_supabase_auth.py`:

```python
import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"

import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from jose import jwt as jose_jwt

from auth.supabase import get_current_merchant
from models.merchants import Merchant

SECRET = "test-supabase-jwt-secret-32-char!"


def _token(sub="user-1", email="a@b.com"):
    return jose_jwt.encode({"sub": sub, "email": email, "aud": "authenticated", "exp": 9_999_999_999}, SECRET, algorithm="HS256")


def _session(existing):
    s = AsyncMock()
    s.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=existing)))
    s.add = MagicMock()
    s.flush = AsyncMock()
    return s


class _Creds:
    def __init__(self, token): self.credentials = token


@pytest.mark.anyio
async def test_first_signin_creates_free_merchant():
    s = _session(None)
    m = await get_current_merchant(_Creds(_token()), s)
    assert m.plan == "free"
    assert m.trial_ends_at is None


@pytest.mark.anyio
async def test_read_only_merchant_is_not_locked_out():
    existing = MagicMock(spec=Merchant)
    existing.read_only = True
    existing.notification_email = "a@b.com"
    s = _session(existing)
    # Should NOT raise 402 anymore — read_only is deprecated in favour of plan='free'
    m = await get_current_merchant(_Creds(_token()), s)
    assert m is existing
```

(If `anyio`/`pytest-asyncio` config differs, match the marker used in `signals/test_dispatcher_integration.py`.)

- [ ] **Step 2: Run, expect FAIL**

Run: `python -m pytest auth/test_supabase_auth.py -q`
Expected: FAIL — creates `recon`, and read_only raises 402.

- [ ] **Step 3: Edit `auth/supabase.py`**

Change the create branch (line ~80-88) and remove the read-only lockout (line ~93-100):

```python
    if merchant is None:
        # First sign-in — auto-create a FREE merchant. The 14-day trial is an
        # explicit action (POST /merchants/start-trial), not granted on sign-up.
        merchant = Merchant(
            supabase_user_id=supabase_user_id,
            plan="free",
            notification_email=email,
        )
        session.add(merchant)
        await session.flush()
    elif email and merchant.notification_email != email:
        merchant.notification_email = email

    # NOTE: the legacy read_only 402 lockout is removed. Trial expiry now
    # downgrades to plan='free' (see jobs/trial_expiry.py), preserving tool
    # access while gating platform features via plan_gate.
    return merchant
```

Update the module docstring line 8-9 to say `plan='free'`.

- [ ] **Step 4: Run, expect PASS**

Run: `python -m pytest auth/test_supabase_auth.py -q` → PASS.

- [ ] **Step 5: Commit**

```bash
git add specter-api/auth/supabase.py specter-api/auth/test_supabase_auth.py
git commit -m "feat(api): sign-up grants 'free'; remove read-only 402 lockout"
```

### Task P5a.3: `POST /merchants/start-trial` endpoint

**Files:**
- Modify: `specter-api/routers/merchants.py`
- Test: `specter-api/routers/test_merchants.py` (add a `TestStartTrial` class)

- [ ] **Step 1: Write the failing test**

Append to `test_merchants.py`:

```python
class TestStartTrial:
    def test_start_trial_sets_recon_and_trial_end(self, client: TestClient):
        merchant = make_merchant(plan="free")
        session = AsyncMock()
        session.commit = AsyncMock()
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)

        resp = client.post("/merchants/start-trial")
        assert resp.status_code == 200
        assert merchant.plan == "recon"
        assert merchant.trial_ends_at is not None
        assert merchant.max_competitors_per_sku == 3

    def test_start_trial_rejected_if_already_paid(self, client: TestClient):
        merchant = make_merchant(plan="cipher")
        session = AsyncMock(); session.commit = AsyncMock()
        app.dependency_overrides[get_current_merchant] = override_merchant(merchant)
        app.dependency_overrides[get_db] = override_db(session)
        resp = client.post("/merchants/start-trial")
        assert resp.status_code == 409
        assert resp.json()["detail"]["error"] == "trial_not_available"
```

- [ ] **Step 2: Run, expect FAIL**

Run: `python -m pytest routers/test_merchants.py::TestStartTrial -q` → FAIL (route 404).

- [ ] **Step 3: Implement the route**

In `routers/merchants.py`, add imports `from datetime import datetime, timedelta, timezone` and `from auth.plan_gate import PLAN_COMPETITOR_LIMITS`, then:

```python
@router.post("/start-trial", response_model=MerchantOut)
async def start_trial(
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> MerchantOut:
    """Convert a FREE account into a 14-day RECON trial (explicit action)."""
    if merchant.plan != "free":
        raise HTTPException(409, detail={"error": "trial_not_available",
                                         "message": "Trial is only available from a free account"})
    merchant.plan = "recon"
    merchant.trial_ends_at = datetime.now(tz=timezone.utc) + timedelta(days=14)
    merchant.max_competitors_per_sku = PLAN_COMPETITOR_LIMITS["recon"]
    await session.commit()
    return await get_me(merchant)
```

- [ ] **Step 4: Run, expect PASS**

Run: `python -m pytest routers/test_merchants.py::TestStartTrial -q` → PASS.

- [ ] **Step 5: Commit**

```bash
git add specter-api/routers/merchants.py specter-api/routers/test_merchants.py
git commit -m "feat(api): add POST /merchants/start-trial (free → recon trial)"
```

### Task P5a.4: Trial-expiry job downgrades to `free`

**Files:**
- Create: `specter-api/jobs/__init__.py`
- Create: `specter-api/jobs/trial_expiry.py`
- Test: `specter-api/jobs/test_trial_expiry.py`

- [ ] **Step 1: Write the failing test**

`specter-api/jobs/test_trial_expiry.py`:

```python
import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")

import uuid
from datetime import datetime, timedelta, timezone
import pytest
from unittest.mock import AsyncMock, MagicMock

from jobs.trial_expiry import downgrade_expired_trials
from models.merchants import Merchant


def _expired():
    m = MagicMock(spec=Merchant)
    m.id = uuid.uuid4()
    m.plan = "recon"
    m.razorpay_subscription_id = None
    m.trial_ends_at = datetime.now(tz=timezone.utc) - timedelta(days=1)
    return m


@pytest.mark.anyio
async def test_expired_trial_downgrades_to_free():
    m = _expired()
    session = AsyncMock()
    session.execute = AsyncMock(return_value=MagicMock(
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[m])))))
    session.commit = AsyncMock()

    n = await downgrade_expired_trials(session)
    assert n == 1
    assert m.plan == "free"
    assert m.max_competitors_per_sku == 0
```

- [ ] **Step 2: Run, expect FAIL**

Run: `python -m pytest jobs/test_trial_expiry.py -q` → FAIL (module missing).

- [ ] **Step 3: Implement**

`specter-api/jobs/__init__.py`: empty file.

`specter-api/jobs/trial_expiry.py`:

```python
"""Trial-expiry job: downgrade expired, unpaid trials to the FREE plan.

Replaces the legacy read-only lockout. A merchant whose trial_ends_at has
passed and who has no active paid subscription is moved to plan='free' — they
keep the Tools workspace; platform features re-gate via plan_gate.

Schedule this from the scraper scheduler or a Railway cron (e.g. hourly).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.plan_gate import PLAN_COMPETITOR_LIMITS
from models.merchants import Merchant


async def downgrade_expired_trials(session: AsyncSession) -> int:
    """Downgrade all expired, unpaid trials to FREE. Returns the count changed."""
    now = datetime.now(tz=timezone.utc)
    stmt = select(Merchant).where(
        Merchant.plan == "recon",
        Merchant.razorpay_subscription_id.is_(None),
        Merchant.trial_ends_at.is_not(None),
        Merchant.trial_ends_at < now,
    )
    rows = (await session.execute(stmt)).scalars().all()
    for m in rows:
        m.plan = "free"
        m.max_competitors_per_sku = PLAN_COMPETITOR_LIMITS["free"]
    if rows:
        await session.commit()
    return len(rows)
```

- [ ] **Step 4: Run, expect PASS**

Run: `python -m pytest jobs/test_trial_expiry.py -q` → PASS.

- [ ] **Step 5: Full suite + commit**

Run: `python -m pytest -q` → all pass.

```bash
git add specter-api/jobs
git commit -m "feat(api): trial-expiry job downgrades unpaid trials to 'free'"
```

---

# PHASE P5b — Tools Tab + Free Overview (frontend)

**Outcome:** dashboard gains a **Tools** nav item hosting the 6 calculators (reusing the public components), and the Overview is plan-aware (free users get a welcome/tools state).

### Task P5b.1: Expose `plan` and helpers in the frontend Merchant type

**Files:** Modify `specter-web/lib/api.ts`.

- [ ] **Step 1:** Widen the `Merchant.plan` union to include `'free'`:

```ts
  plan: 'free' | 'recon' | 'cipher' | 'phantom' | 'predator' | 'eclipse'
```

Add a `useStartTrial` mutation hook mirroring `useDisconnectShopify` but `POST /merchants/start-trial`, invalidating `queryKeys.merchant`.

- [ ] **Step 2:** `npm run lint && npm run build` → exit 0. Commit `git commit -m "feat(web): add 'free' to Merchant.plan + useStartTrial hook"`.

### Task P5b.2: Add the Tools tab route and nav entry

**Files:**
- Create: `specter-web/app/(dashboard)/tools/page.tsx`
- Modify: `specter-web/app/(dashboard)/layout.tsx` (NAV array)

- [ ] **Step 1: Add nav item**

In `layout.tsx` `NAV` (line 19-27), insert after Overview:

```tsx
  { href: '/tools', label: 'Tools', icon: Calculator },
```

Import `Calculator` from `lucide-react`.

- [ ] **Step 2: Create the Tools tab page**

`specter-web/app/(dashboard)/tools/page.tsx` — a grid linking to each calculator, reusing public tool routes inside the dashboard chrome (simplest first pass: cards that deep-link to `/tools/*`; the account-backed save lands in P5c). Include `export const metadata = { robots: { index: false } }` equivalent via a `noindex` — dashboard is already behind auth, but set it explicitly:

```tsx
import Link from 'next/link'

export const metadata = { title: 'Tools', robots: { index: false, follow: false } }

const TOOLS = [
  { href: '/tools/price-position-analyzer', name: 'Price Position Analyzer', desc: 'Rank your price vs competitors' },
  { href: '/tools/amazon-fba-calculator', name: 'Amazon FBA Calculator', desc: 'Net profit per unit after fees' },
  { href: '/tools/shopify-profit-calculator', name: 'Shopify Profit Calculator', desc: 'True monthly net profit' },
  { href: '/tools/shipping-calculator', name: 'Shipping Calculator', desc: 'Cheapest carrier + duties' },
  { href: '/tools/roas-calculator', name: 'ROAS Calculator', desc: 'ROAS vs break-even' },
  { href: '/tools/inventory-reorder-calculator', name: 'Inventory Reorder', desc: 'Reorder point + safety stock' },
]

export default function DashboardToolsPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-text mb-1">Tools</h1>
      <p className="font-body text-sm text-muted mb-6">Free calculators — yours to use, with saved history when signed in.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map(t => (
          <Link key={t.href} href={t.href} className="block bg-surface border border-border rounded-2xl p-5 hover:border-primary/40 transition-colors">
            <p className="font-display text-base font-semibold text-text">{t.name}</p>
            <p className="font-body text-sm text-muted mt-1">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3:** `npm run lint && npm run build` → exit 0. Manual: `/tools` tab appears in the sidebar and lists 6 tools.
- [ ] **Step 4: Commit**

```bash
git add specter-web/app/(dashboard)/tools/page.tsx specter-web/app/(dashboard)/layout.tsx
git commit -m "feat(dashboard): add Tools tab hosting the 6 calculators"
```

### Task P5b.3: Plan-aware Overview for free users

**Files:** Modify `specter-web/app/(dashboard)/dashboard/page.tsx`.

- [ ] **Step 1:** Read `useMerchant()`; when `merchant.plan === 'free'`, render a welcome panel (tool shortcuts + "Start 14-day trial" CTA via `useStartTrial`) instead of the signal summary. Paid plans keep the existing summary. Keep the change additive — branch at the top of the component.
- [ ] **Step 2:** `npm run lint && npm run build` → exit 0. Commit `git commit -m "feat(dashboard): free-plan Overview with tools + trial CTA"`.

---

# PHASE P5c — Account-Backed Saved Calculations (backend + frontend)

**Outcome:** a `saved_calculations` table + `/saved-calculations` CRUD; the Tools tab persists saves per account.

### Task P5c.1: `SavedCalculation` model

**Files:**
- Create: `specter-api/models/saved_calculations.py`
- Modify: `specter-api/models/__init__.py`
- Test: `specter-api/tests/test_models.py` (add column assertion)

- [ ] **Step 1: Write the failing model test**

In `specter-api/tests/test_models.py`, add:

```python
def test_saved_calculation_columns():
    from models.saved_calculations import SavedCalculation
    cols = set(SavedCalculation.__table__.columns.keys())
    assert {"id", "created_at", "merchant_id", "tool_id", "label", "inputs", "results"} <= cols
```

- [ ] **Step 2: Run, expect FAIL**

Run: `python -m pytest tests/test_models.py::test_saved_calculation_columns -q` → FAIL (module missing).

- [ ] **Step 3: Implement the model**

Check `models/base.py` for the `id`/`created_at` convention first (other models use `Base`). `specter-api/models/saved_calculations.py`:

```python
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base


class SavedCalculation(Base):
    __tablename__ = "saved_calculations"

    merchant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    tool_id: Mapped[str] = mapped_column(String(48), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    inputs: Mapped[dict] = mapped_column(JSONB, nullable=False)
    results: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()"),
    )
```

> Confirm whether `Base` already provides `id`/`created_at`. If `Base` defines `id` (UUID PK), drop the duplicate; if it defines `created_at`, drop the duplicate here. Match the exact pattern in `models/merchants.py` + `models/base.py`.

Register in `models/__init__.py`: add the import and `"SavedCalculation"` to `__all__`.

- [ ] **Step 4: Run, expect PASS**

Run: `python -m pytest tests/test_models.py::test_saved_calculation_columns -q` → PASS.

- [ ] **Step 5: Commit**

```bash
git add specter-api/models/saved_calculations.py specter-api/models/__init__.py specter-api/tests/test_models.py
git commit -m "feat(api): add SavedCalculation model"
```

### Task P5c.2: Alembic migration `0006_saved_calculations`

**Files:**
- Create: `specter-api/alembic/versions/0006_saved_calculations.py`

> Note: there is a Supabase SQL file `supabase/migrations/0006_notification_logs.sql` — that is a *separate* Supabase-side numbering. The Alembic chain is `0001→0005`; this is Alembic `0006`. Keep the two numbering systems independent.

- [ ] **Step 1: Write the migration** (mirror `0005_notification_email.py` structure)

```python
"""saved_calculations table

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-30
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "saved_calculations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("merchant_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tool_id", sa.String(length=48), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=True),
        sa.Column("inputs", postgresql.JSONB(), nullable=False),
        sa.Column("results", postgresql.JSONB(), nullable=False),
    )
    op.create_index("ix_saved_calculations_merchant_id", "saved_calculations", ["merchant_id"])


def downgrade() -> None:
    op.drop_index("ix_saved_calculations_merchant_id", table_name="saved_calculations")
    op.drop_table("saved_calculations")
```

> Align the `id`/`created_at` column definitions with whatever `models/base.py` + `0001_initial_schema.py` use (e.g. if `Base` PK is named differently or uses a different default). The migration must match the model exactly.

- [ ] **Step 2: Sanity import**

Run: `python -m pytest -q` (the model + migration import cleanly; no DB needed for the model test).

- [ ] **Step 3: Commit**

```bash
git add specter-api/alembic/versions/0006_saved_calculations.py
git commit -m "feat(api): alembic 0006 — saved_calculations table"
```

### Task P5c.3: `/saved-calculations` router (list / create / delete)

**Files:**
- Create: `specter-api/routers/saved_calculations.py`
- Modify: `specter-api/main.py` (register router)
- Test: `specter-api/routers/test_saved_calculations.py`

- [ ] **Step 1: Write the failing tests** (mirror `test_merchants.py` patterns)

`specter-api/routers/test_saved_calculations.py`:

```python
import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"

import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

from auth.supabase import get_current_merchant
from db import get_db
from main import app
from models.merchants import Merchant


def _merchant(plan="free"):
    m = MagicMock(spec=Merchant); m.id = uuid.uuid4(); m.plan = plan
    return m


def _override_merchant(m):
    async def _dep(): return m
    return _dep


def _override_db(session):
    async def _gen(): yield session
    return _gen


@pytest.fixture(autouse=True)
def _clear():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_create_saved_calculation(client):
    m = _merchant()
    session = AsyncMock(); session.add = MagicMock(); session.commit = AsyncMock(); session.flush = AsyncMock(); session.refresh = AsyncMock()
    app.dependency_overrides[get_current_merchant] = _override_merchant(m)
    app.dependency_overrides[get_db] = _override_db(session)

    resp = client.post("/saved-calculations", json={
        "tool_id": "price-position", "label": "My run",
        "inputs": {"my_price": "89.99"}, "results": {"signal": "RAISE"},
    })
    assert resp.status_code == 201
    assert session.add.called


def test_list_saved_calculations_returns_list(client):
    m = _merchant()
    session = AsyncMock()
    session.execute = AsyncMock(return_value=MagicMock(
        scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))))
    app.dependency_overrides[get_current_merchant] = _override_merchant(m)
    app.dependency_overrides[get_db] = _override_db(session)

    resp = client.get("/saved-calculations")
    assert resp.status_code == 200
    assert resp.json() == []
```

- [ ] **Step 2: Run, expect FAIL**

Run: `python -m pytest routers/test_saved_calculations.py -q` → FAIL (router 404).

- [ ] **Step 3: Implement the router**

`specter-api/routers/saved_calculations.py`:

```python
"""Saved tool calculations — account-backed history for the dashboard Tools tab.

Available to every authenticated merchant (including FREE) — calculators are
client-side and consume no SKU/scrape limits, so there is no plan_gate here.
"""
from __future__ import annotations

import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.supabase import get_current_merchant
from db import get_db
from models.merchants import Merchant
from models.saved_calculations import SavedCalculation

router = APIRouter(prefix="/saved-calculations", tags=["saved-calculations"])

MAX_PER_MERCHANT = 100


class SavedCalcIn(BaseModel):
    tool_id: str
    label: Optional[str] = None
    inputs: dict[str, Any]
    results: dict[str, Any]


class SavedCalcOut(BaseModel):
    id: uuid.UUID
    tool_id: str
    label: Optional[str]
    inputs: dict[str, Any]
    results: dict[str, Any]
    created_at: str

    model_config = {"from_attributes": True}


def _to_out(row: SavedCalculation) -> SavedCalcOut:
    return SavedCalcOut(
        id=row.id, tool_id=row.tool_id, label=row.label,
        inputs=row.inputs, results=row.results,
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


@router.get("", response_model=list[SavedCalcOut])
async def list_saved(
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> list[SavedCalcOut]:
    stmt = (select(SavedCalculation)
            .where(SavedCalculation.merchant_id == merchant.id)
            .order_by(SavedCalculation.created_at.desc()))
    rows = (await session.execute(stmt)).scalars().all()
    return [_to_out(r) for r in rows]


@router.post("", response_model=SavedCalcOut, status_code=status.HTTP_201_CREATED)
async def create_saved(
    body: SavedCalcIn,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> SavedCalcOut:
    if len(body.tool_id) > 48:
        raise HTTPException(422, detail={"error": "invalid_tool_id"})
    row = SavedCalculation(
        merchant_id=merchant.id, tool_id=body.tool_id, label=body.label,
        inputs=body.inputs, results=body.results,
    )
    session.add(row)
    await session.flush()
    await session.commit()
    return _to_out(row)


@router.delete("/{calc_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_saved(
    calc_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> Response:
    row = await session.get(SavedCalculation, calc_id)
    if row is None or row.merchant_id != merchant.id:
        raise HTTPException(404, detail={"error": "not_found"})
    await session.delete(row)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

Register in `main.py`:

```python
from routers import merchants, skus, competitors, signals, alerts, repricing, attribution, saved_calculations
...
app.include_router(saved_calculations.router)
```

- [ ] **Step 4: Run, expect PASS**

Run: `python -m pytest routers/test_saved_calculations.py -q` → PASS.

- [ ] **Step 5: Full suite + commit**

Run: `python -m pytest -q` → all pass.

```bash
git add specter-api/routers/saved_calculations.py specter-api/main.py specter-api/routers/test_saved_calculations.py
git commit -m "feat(api): /saved-calculations CRUD router"
```

### Task P5c.4: Frontend hooks + Tools-tab history

**Files:** Modify `specter-web/lib/api.ts`; modify `specter-web/app/(dashboard)/tools/page.tsx`.

- [ ] **Step 1: Add types + hooks** in `lib/api.ts`:

```ts
export interface SavedCalculation {
  id: string
  tool_id: string
  label: string | null
  inputs: Record<string, unknown>
  results: Record<string, unknown>
  created_at: string
}

export function useSavedCalculations() {
  return useQuery({
    queryKey: ['saved-calculations'] as const,
    queryFn: () => apiFetch<SavedCalculation[]>('/saved-calculations'),
  })
}

export function useCreateSavedCalculation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Omit<SavedCalculation, 'id' | 'created_at'>) =>
      apiFetch<SavedCalculation>('/saved-calculations', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-calculations'] }),
  })
}

export function useDeleteSavedCalculation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/saved-calculations/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-calculations'] }),
  })
}
```

- [ ] **Step 2:** In the Tools-tab page, render a "Saved reports" list from `useSavedCalculations()` above the tool grid (each row: tool name, label, date, delete button). Empty state: "No saved reports yet — run a tool and hit Save."
- [ ] **Step 3:** `npm run lint && npm run build` → exit 0. Commit `git commit -m "feat(web): saved-calculations hooks + Tools-tab history"`.

---

# PHASE P5d — Preview-Locked Platform Tabs

**Outcome:** for `free` accounts, Signals/Competitors/Alerts/Repricing/Attribution render the real UI populated with demo data, blurred, with a specific "see YOUR data" CTA — instead of a raw 403.

### Task P5d.1: Shared free-preview wrapper

**Files:**
- Create: `specter-web/components/dashboard/free-preview.tsx`
- Read: `specter-web/components/tools/demo-mode-panel.tsx`, `components/tools/locked-section.tsx` (reuse patterns)

- [ ] **Step 1:** Build `FreePreview` — given `plan`, when `plan === 'free'` render `children` (demo-populated) under a blur + a `LockedAutomateThis`-style CTA naming the specific unlock (e.g. "Connect your store to see real signals"); otherwise render `children` directly. Reuse `LockedMarketIntelligence` styling.
- [ ] **Step 2:** `npm run lint && npm run build` → exit 0. Commit `git commit -m "feat(dashboard): FreePreview wrapper for plan-gated tabs"`.

### Task P5d.2: Wrap the 5 platform pages

**Files:** Modify `signals/page.tsx`, `competitors/page.tsx`, `alerts/page.tsx`, `repricing/page.tsx`, `attribution/page.tsx`.

- [ ] **Step 1:** Each page reads `useMerchant()`. When `plan === 'free'`, render the page with **demo data** inside `<FreePreview>` (do not call the gated API, or tolerate its 403 and swap to demo). When paid, behavior is unchanged. Repricing/Attribution already render `UpgradeGate` on 403 — extend so `free` shows the richer demo preview instead of the bare gate.
- [ ] **Step 2:** `npm run lint && npm run build` → exit 0. Manual: set `specter_tier`/a free merchant and confirm each tab shows a blurred realistic preview, not an error. Commit `git commit -m "feat(dashboard): preview-locked platform tabs for free plan"`.

---

# PHASE P5e — In-Workspace PQL Upsell + Measurement

**Outcome:** usage-based upsell triggers in the workspace and PostHog events tracking free→trial.

### Task P5e.1: Workspace PQL analytics events

**Files:** Modify `specter-web/lib/analytics.ts`.

- [ ] **Step 1:** Add events `'workspace_viewed'`, `'workspace_tool_used'`, `'workspace_upsell_shown'`, `'workspace_trial_started'` with `EventProperties` (`{ source?: string }` where useful). Add a `trackWorkspaceTrialStarted(source)` helper.
- [ ] **Step 2:** `npm run lint && npm run build` → exit 0. Commit `git commit -m "feat(analytics): workspace PQL + free→trial events"`.

### Task P5e.2: Usage-based upsell card

**Files:**
- Create: `specter-web/components/dashboard/pql-upsell.tsx`
- Modify: Tools tab + Overview to render it.

- [ ] **Step 1:** `PqlUpsell` counts tool runs this week (localStorage counter incremented on `workspace_tool_used`); when the count crosses a threshold (e.g. 3), render a card: "You've run {n} tool checks this week — SPECTER monitors these automatically." with `useStartTrial`/sign-up CTA, firing `workspace_upsell_shown`. Honest, dismissable, no fake urgency.
- [ ] **Step 2:** Render it in the free Overview and Tools tab.
- [ ] **Step 3:** `npm run lint && npm run build` → exit 0. Commit `git commit -m "feat(dashboard): usage-based PQL upsell card"`.

---

## Final Verification (after all phases)

- [ ] Backend: `cd specter-api && python -m pytest -q` → all green (existing 155 + new P5a/P5c tests).
- [ ] Frontend: `cd specter-web && npm run lint && npm run build && npm test` → exit 0, all Vitest math/helper tests pass.
- [ ] Manual smoke (`npm run dev`): each `/tools/*` shows the 1-3-More skeleton; email gate fires on earned value; PDF free / CSV gated; dashboard `/tools` works; free Overview + preview tabs render without errors.
- [ ] Dispatch a final code-reviewer over the whole branch (subagent-driven-development terminal step), then use `superpowers:finishing-a-development-branch`.

---

## Self-Review (spec coverage)

| Spec section | Covered by |
|---|---|
| §2.1 enforced skeleton | P1.1–P1.4 |
| §2.2 per-tool 1-3-More | P1.3 (price-position) + P2.1–P2.5 |
| §3 value-first gate timing | P3.1–P3.2 |
| §5 segmentation (PDF free / CSV email / scenario email / Example tags) | P3.3–P3.5 |
| §6 UX simplification (plain-English, what-this-means/do-this-next) | P1.1 (`ResultVerdict`) + P2 recipe step 7 |
| §7 viral (OG image, challenge, referral) | P4.1–P4.2 (referral nudge copy lives in ONBOARDING.md nurture, not code) |
| §11 measurement KPIs | P4.3 + P5e.1 |
| §12.1 plan state (`free`, explicit trial, post-trial→free) | P5a.1–P5a.4 |
| §12.2 surfaces (Tools tab, free Overview, preview tabs, Settings trial) | P5b + P5d + P5b.3 |
| §12.3 conversion (PQL triggers) | P5e |
| §12.4 data model (`saved_calculations`) | P5c.1–P5c.4 |
| §12.5 SEO (`noindex` Tools tab) | P5b.2 (metadata robots) |

**Known deferrals (intentional, per spec §13):** referral *mechanics* beyond share copy; the Resend nurture-email implementation (documented in ONBOARDING.md, separate email-infra work); replicating the OG-image route across all 6 tools (P4.1 ships price-position; repeat per tool is mechanical follow-up).
