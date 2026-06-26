# Demand Planning — Disaggregation Tab

Read PROJECT_BRIEF.md and DEMAND_PLANNING_SPEC.md before starting. This is a genuinely new feature - a real, multi-stage proportional calculation, not a UI tweak. Treat it with the same care as Prophet's calculation earlier today: explain the exact math before writing code, and expect real verification against real data afterward.

## The confirmed mechanics (final, not open for redesign)

A planner enters a single number (e.g. +500 or -200 units) and selects a set of target months (current/future only, M24+). The tool then automatically distributes that total down to specific SKU x Location x Month combinations, using historical sales patterns as the basis for a realistic, defensible split - rather than the planner having to manually decide how to spread it themselves.

### Persona access
- Category Manager: operates on their own LOCKED category automatically - no category picker needed, since they're already scoped to one category everywhere else in the app.
- Demand Planner (unscoped): gets a category-selection dropdown, since they're not locked to one.
- Branch Manager: does NOT see this feature at all.

### Location in the UI
A new, separate, dedicated tab/section in Demand Planning's sidebar - NOT built into the existing What-If tab. This is a different kind of tool (realistic redistribution of a known total) from What-If's purpose (simulating the effect of a business lever like price or promotion).

### The calculation - 3-stage cascading proportional split
Given a total adjustment (e.g. +500 units) for a category and a set of target months:

1. Category total -> SKUs: split the total across the category's SKUs, proportional to each SKU's share of TOTAL historical Actual Sales volume across the full 12 months of real history (weeks 1-23, the locked historical period) - e.g. if AC_1.5T_Inverter historically sold 3x more than AC_2.0T_Split within the AC category, it gets 3x the share of the 500 units.

2. Each SKU's amount -> Locations: split that SKU's resulting amount across its locations, proportional to that SAME SKU's location-level historical sales share (e.g. if AC_1.5T_Inverter sold more in Mumbai than in a smaller branch historically, Mumbai gets a proportionally larger share of that SKU's allocation).

3. Each SKU-location's amount -> Months: split that SKU-location's resulting amount across the SELECTED target months only, proportional to that SAME SKU-location's own historical seasonal pattern across those specific calendar months (e.g. if this SKU-location's history shows month 6 historically much higher than month 2, and both are in the target range, month 6 gets a proportionally larger share).

All three stages use REAL historical Actual Sales data from demand_weekly_data (weeks 1-23) - no invented ratios. If a SKU-location combination has zero or near-zero historical data, decide a sensible fallback (e.g. exclude it from the split, or give it a minimal floor share) and explain your choice, the same way Prophet's calculation had an explicit fallback for thin-data SKUs.

### Flow: preview before commit
1. User enters the total adjustment number and selects target months (and category, if Demand Planner).
2. Click a "Preview"/"Calculate Split" action - this computes and displays a breakdown table (SKU x Location x Month, showing each cell's calculated share) WITHOUT writing anything to the database yet - read-only preview, same principle as What-If's Recalculate.
3. A separate "Apply" action commits the previewed split - writes each computed value into that SKU/location/month's planner_adjustment in demand_weekly_data.

### Write behavior
- Target: planner_adjustment column (the same row What-If's Apply Scenario writes to, and the same row that feeds into final_consensus per Stage 1's formula).
- ADDS to any existing planner_adjustment value for that SKU/location/month - does NOT replace/overwrite it. This must work correctly alongside previous What-If applies or manual edits without erasing them.
- Only writes to current/future months (M24+) - the same locked boundary used everywhere else in the app. Do not allow targeting historical/locked months.
- After Apply, final_consensus must be recalculated correctly for every affected row (system_forecast + planner_adjustment + branch_adjustment + category_adjustment, per Stage 1's existing formula).

## Before writing code

Propose:
1. The exact formula/approach for each of the 3 split stages, with a worked example using real data from one actual category - the same level of rigor as the Prophet calculation review earlier today. I will review this before any code is written.
2. Your approach for the thin/zero-history fallback case.
3. The exact API endpoint(s) needed (e.g. a preview/calculate endpoint that's read-only, a separate apply endpoint that writes - following the same pattern already established for What-If).
4. Where exactly this tab lives in the sidebar and what its UI looks like at a high level.

## Verification

Give me manual browser steps to verify:
1. As Category Manager, the tool operates on their locked category automatically with no category picker.
2. As Demand Planner, a category dropdown is available and changes which category is targeted.
3. As Branch Manager, this tab/feature does not appear at all.
4. Preview shows a real, correctly-proportioned SKU x Location x Month breakdown that sums back to the original entered total - hand-check this against real historical ratios for at least one category.
5. Apply correctly ADDS to (not replaces) any pre-existing planner_adjustment values - test by applying once, noting values, applying again with a different total, and confirming the second application adds on top rather than overwriting.
6. final_consensus recalculates correctly for all affected rows after Apply.
7. Attempting to target a historical/locked month (before M24) is not possible.
8. No regressions to What-If, the existing grid, or anything else previously verified.
