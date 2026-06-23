# Demand Planning Workbench — Functional Spec

Status: DRAFT — foundational decisions confirmed, full detail to be filled in before any build starts. This spec exists so Claude Code (or anyone) can build this module the same deliberate, phased way Supply Planning was built — schema first, then API, then UI, with manual verification at every step.

## 0. Why this exists

WhirlCast currently has 9 separate Demand-Planning-related pages in the sidebar (Dashboard, Workbench, Scenarios, Collaborate, Conflicts, Sensing, NPI, Report, Admin). This spec defines a NEW, separate, unified "Demand Planning" workbench — consciously modeled on the Supply Planning workbench's pattern (top KPI bar + tabbed sub-views) — that consolidates a deliberately scoped subset of that functionality into one consistent module.

This is NOT a request to migrate or fix all 9 existing pages. Only the tabs listed in Section 2 are in scope. The existing 9 pages are left untouched unless/until separately decided.

## 1. Hard constraint: consistency with Supply Planning

This is the most important constraint on the entire build, more important than matching any reference screenshot:

- **Same catalog**: the exact same 10 SKUs × 8 locations already defined in Supply Planning's schema (`product_master`/whatever Supply Planning's SKU table is, and the location list Supply Planning uses) must be reused here — not a new or different SKU/location list.
- **Same time grain**: weekly, 52-week horizon — matching Supply Planning's `planning_orders` week structure, not monthly.
- **Same visual/component language**: reuse Supply Planning's existing shared components (Stack/Grid/Card/ActionButton/KPIBar/WorkbenchLayout, statusConfig.js, the design tokens from globals.css) — do not invent a parallel design system.
- **Reasoning**: the long-term goal (explicitly stated by the user, NOT being built yet) is for Demand Planning's forecast to eventually flow into Supply Planning's demand numbers. Building on a matching catalog and calendar now means that future connection is a straightforward data join later, not a painful reconciliation between two mismatched product/location/calendar systems.

This module's data is built to match Supply Planning's catalog/calendar shape (Section 1 above). The actual cross-module connection — wiring Supply Planning to read its demand number from this new data — IS part of this overall effort, but as a separately sequenced follow-on step. See Section 9 for the full decision and sequencing.

## 2. Scope — tabs in the new workbench

Top KPI bar, then these tabs only:

1. **Forecast Grid**
2. **Patterns**
3. **What-If**
4. **Exceptions**
5. **NPI Forecasting**

No other tabs (Sensing, Collaborate, Conflicts, Report, Admin, the old standalone Scenarios page) are in scope for this build.

## 3. KPI bar (FINALIZED)

1. Total Forecast Demand
2. Forecast Accuracy %
3. Bias %
4. Open Planner Adjustments (count)
5. Revenue Forecast
6. Inventory Days
7. A-Class (Stable) Coverage % — % of total demand volume contributed by A-class SKU-locations; a quick signal for how forecastable the portfolio is overall
8. Open Exceptions (count) — mirrors Supply Planning's Recommendations/Inbox badge-count pattern; ties the KPI bar directly to the Exceptions tab

## 4. Global filters (top filter row) — FINALIZED

Modeled on Supply Planning's filter bar:
- Branch/Location
- Product Group
- SKU search
- ABC/XYZ class (dropdown filter, not a separate tab)

## 5. Tab-by-tab functional intent

### 5.1 Forecast Grid (rows FINALIZED)
Weekly grid (52-week horizon), same hierarchical pattern as Supply Planning's Planning Grid (SKU → Location). Exactly 4 rows, each chosen because it has clear end-to-end meaning to a planner — no row included just because a reference screenshot had it:
- **Actual Sales** — real historical truth, read-only.
- **System Forecast** — the algorithm's raw output before any human adjustment, read-only.
- **Planner Adjustment** — the editable row; the actual human-in-the-loop override, same role as Supply Planning's editable Production row.
- **Final Consensus** — the bottom-line number everything rolls up to, same role as Supply Planning's Gap row.

Explicitly DROPPED from the reference screenshots' row set: "Sales Adjustment" and "Marketing Adjustment" — no clear real calculation backs these in our system, so they were cut rather than included as decoration. History weeks are locked/real; only forward weeks are editable (Planner Adjustment).

### 5.2 Patterns
Demand classification view. Includes: classification distribution (bar chart of Trend/Seasonal/Stable/Random counts), a volume × variability scatter, and a SKU-level detail table. The table shows one row per SKU-location (for volume/demand numbers, consistent with the rest of the app), but the ABC/XYZ classification badge is a PER-SKU property (see Section 7) — so the same SKU shows the identical classification badge across every location row it appears in, even though its volume/demand numbers differ by location. This is also where ABC/XYZ values are computed (see Section 7).

### 5.3 What-If
Scenario-testing view with adjustable inputs (e.g. promotion discount, price change, marketing spend) and a resulting forecast-impact chart/numbers, compared against a base forecast. Assumptions (e.g. price elasticity) must be stated visibly, not hidden — consistent with the "honesty" principle used throughout Supply Planning (e.g. clearly labeling this as rules-based, not ML).

### 5.4 Exceptions (trigger categories FINALIZED)
Flagged-issue list, mirroring Supply Planning's Exception Inbox in spirit. Four trigger categories, each with a clear "why a planner should care":
1. **Forecast accuracy degradation** — a SKU-location consistently missing actual sales by a wide margin. The system is failing here and trust in the number should be low.
2. **Large unexplained planner override** — a Planner Adjustment that swings Final Consensus far from System Forecast. Big manual overrides should be visible and reviewable, not buried in the grid.
3. **Demand pattern shift** — a SKU-location whose Patterns-tab classification recently changed (e.g. Stable → Random/Volatile). The planning strategy that worked last month may no longer fit.
4. **New-product risk** — anything flowing from NPI Forecasting with low confidence, flagged proactively rather than waiting for an accuracy miss to prove it.

Exact severity thresholds and wording to be refined once built and tested against real numbers — the categories themselves are locked, the tuning is not.

### 5.5 NPI Forecasting (approach FINALIZED)
New-product-introduction forecasting. The EXISTING NPI module (`NPIForecasting.jsx`) has a real, working `computePhaseOut()`/`computeRenovBlended()` path for "Renovation" forecasts — this gets preserved/reused as-is. The "New Product Innovation" path was previously a hardcoded, fake `RESULTS` object; rather than carrying that fake data forward, this path will be explicitly marked "Coming soon" in the UI rather than displaying invented numbers as if real. This matches the honesty standard already established elsewhere in the app (e.g. the Supply Planning demo guide's explicit "this is rules-based, not AI/ML" framing) — a clearly labeled placeholder is more credible to a client than quietly-fake data.

## 6. Explicitly OUT of scope for this build

- Migrating or touching the existing 9 sidebar pages (Dashboard, Workbench, Scenarios, Collaborate, Conflicts, Sensing, Report, Admin remain untouched).
- Fixing Sensing's hardcoded sample data (separate page, not part of this workbench).
- Building real logic for NPI's "New Product Innovation" path (explicitly deferred — marked "Coming soon" instead).

NOTE: the Demand→Supply connection is NOT on this out-of-scope list. See Section 9 — it IS planned, as a separately-sequenced Step B, after this build (Step A) is independently verified.

## 7. Database schema decisions (FINALIZED, updated post-Phase-0-audit)

- **ABC/XYZ grain — RESOLVED**: Phase 0 audit flagged a real contradiction between this section (originally said "columns on the SKU table") and Section 5.2 (originally said "per SKU-location"). Resolved: classification is PER SKU ONLY, nationally aggregated across all locations — NOT per SKU-location. This means `product_master` (which already has `sku` as its primary key) is the correct, confirmed home for these columns; no new table is needed for this part. Section 5.2 has been updated to reflect that the classification badge is the same across all of a SKU's location rows.
- **ABC/XYZ storage**: computed and STORED as actual new columns on `product_master`: `abc_class`, `xyz_class`, `cov`, `classification_updated_at` — consistent with how Supply Planning's KPIs/constraints already read from pre-computed columns rather than aggregating live each time.
- **ABC/XYZ recalculation trigger**: BOTH (a) automatic recompute every time the data is seeded/reset (matching Supply Planning's existing Reset pattern), AND (b) a manual "Recalculate Classification" button, mostly dormant infrastructure for now but useful once real data starts flowing.
- **Classification methodology**: standard approach. ABC = rank by volume/revenue contribution (A = high, B = medium, C = low). XYZ = rank by demand variability/CoV (X = stable, Y = variable, Z = erratic). Computed from `forecast_runs`' existing 2025 monthly history (12 months × 10 SKUs × 8 locations, aggregated to national totals per SKU since classification is per-SKU) — confirmed adequate sample size (n=12 meets the n≥8 minimum rule for CoV).

## 7a. CRITICAL — monthly vs. weekly grain gap (found in Phase 0 audit, must be resolved before schema work)

Phase 0 audit found: every existing demand planning table and route (`forecast_runs`, `branch_overrides`, etc.) works in MONTHLY grain (`month` column, format `'MM-YYYY'`). This spec's Forecast Grid (Section 5.1) requires a 52-WEEK grid matching Supply Planning's `planning_orders.week_number` structure. **There is no existing weekly historical demand data anywhere in the schema.** This is the single most consequential structural gap found in the audit.

**Required new table**: something like `demand_weekly_data`, minimum columns: `sku TEXT`, `location_id INTEGER` (FK to Supply Planning's `locations` table — see Section 7b), `week_number INTEGER`, `year INTEGER`, `actual_sales REAL`, `system_forecast REAL`, `planner_adjustment REAL`, `final_consensus REAL`.

**Seeding approach — RESOLVED**: fresh weekly data generation, NOT disaggregation of the existing monthly history. Reasoning: disaggregating a monthly total into ~4.33 weekly chunks would produce artificially smooth week-to-week numbers (real weekly demand has its own texture a monthly figure can't capture), and would create a hidden dependency where the new table's values are mathematically derived from `forecast_runs` — meaning any future change to the monthly data would silently desync the weekly data with no obvious link between them. Fresh generation (a weekly sibling to the existing `getSeasonalM()`, e.g. `getSeasonalW()`) keeps the new system self-contained, consistent with how Supply Planning's own seed script already works (independent, deterministic, seasonal formulas — not derived from another table).

## 7b. Location reference — RESOLVED to use Supply Planning's `location_id`

Phase 0 audit confirmed: Demand Planning's existing tables store location as a free-text `branch` column (e.g. `'Mumbai'`), while Supply Planning uses `location_id` (INTEGER, foreign key to a `locations` table). Audit confirmed the actual branch name strings used in Demand Planning's hardcoded route logic are identical to Supply Planning's `locations.name` values — there is no catalog drift, just a different reference style.

**Decision**: the new `demand_weekly_data` table (and any other new Demand Planning tables) will use `location_id` (matching Supply Planning's convention), not a free-text branch column — this is the correct choice for the long-term cross-module consistency goal stated in Section 1. Existing tables (`forecast_runs`, `branch_overrides`, etc.) are NOT being migrated to this convention — they stay as they are, since they power the existing 9 pages which remain untouched (Section 6).

## 7c. Exceptions table — new table needed

Phase 0 audit confirmed the existing `exception_log` table stores a different kind of thing (data-anomaly flags seeded at generation time) and doesn't map to this spec's 4 exception categories (Section 5.4). A new table (e.g. `demand_exceptions`) will be needed, computed from the new weekly data plus the Patterns/NPI logic — exact schema to be designed during the build phase.

## 8. Status: Phase 0 audit complete, findings incorporated

The Phase 0 audit (read-only investigation of existing code/data) is complete. Its one blocking finding — the ABC/XYZ grain contradiction — has been resolved (Section 7). Its other major finding — the monthly/weekly grain gap — has been documented (Section 7a) with the required new table identified and the seeding approach resolved. The location reference convention (Section 7b) and the need for a new exceptions table (Section 7c) are also confirmed.

Remaining before code is written: the exact `demand_exceptions` table schema should be finalized as part of the build's first real step (the equivalent of Supply Planning's Step 3.1).

## 9. Cross-module connection — DECISION UPDATE (supersedes Section 1's "out of scope" framing)

Earlier sections of this spec (and PROJECT_BRIEF.md Section 2.5) framed the Demand→Supply connection as deliberately out of scope, deferred to a separate future session. That has changed: the user has decided to actually wire this connection as part of this overall effort, not defer it indefinitely.

**Sequencing (confirmed)**: this happens in two clearly separated steps, not one combined pass:
1. **Step A (this spec's main scope)**: build the new weekly demand table, ABC/XYZ columns, and the 5-tab workbench UI — fully built and independently verified, exactly as described in Sections 1-8, with NO changes to Supply Planning's existing code.
2. **Step B (separate follow-on step, only after Step A is verified)**: modify Supply Planning's `planning_orders` seeding/query logic so its demand number is read from the new Demand Planning weekly table instead of its own independent formula. This requires re-verifying every Supply Planning KPI, Constraint, and Recommendation that depends on the demand input, since the input itself is changing — the same verification rigor used throughout the original Supply Planning build, not a quick patch.

**Why sequenced this way, not combined**: if Step A and Step B were done together and something broke, it would be hard to isolate whether the new demand data itself was wrong, or whether Supply Planning's adaptation to consume it was wrong. Building and verifying Step A in complete isolation first means any problem found during Step B can only be a Step B problem.

Step B is NOT started until Step A is confirmed working end-to-end by the user, the same hands-on-browser verification discipline used throughout Supply Planning's original build.
