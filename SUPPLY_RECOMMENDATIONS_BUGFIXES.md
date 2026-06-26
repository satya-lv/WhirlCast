# Supply Planning — Recommendations Apply: 3 Bug Fixes

Read PROJECT_BRIEF.md and SUPPLY_PLANNING_SPEC.md before starting. This fixes 3 confirmed real bugs found during investigation of the Recommendations "Apply" action - each was diagnosed with real evidence (queries, before/after numbers), not guessed.

## Bug 1 — Overtime applies 9x its intended impact (SERIOUS)

In `server/routes/supply.js` around lines 706-717, the `add_overtime` action finds all rows sharing a production line (e.g. 9 SKU/period rows on Chennai AC Line) and gives EACH row the full `extraHoursPerWeek` value independently. The actual physical line only has that much overtime capacity ONCE, not once per row sharing it - so applying 8 hours of overtime to a line with 9 affected rows currently grants 72 hours of effective capacity (9x), which is semantically wrong.

**Fix**: divide the overtime hours across the affected rows proportionally (e.g. `extraHoursPerWeek / affectedRows.length` per row, or weight by each row's share of the line's total capacity requirement if that's more accurate to the existing capacity-allocation logic elsewhere in the codebase - your call on which approach fits the existing model best, explain your choice).

## Bug 2 — No inventory roll-forward cascade after Apply

In `recomputeAndSave` (around lines 649-663), when `planned_production` changes for period N, `ending_inventory` updates correctly for period N, but `beginning_inventory` for periods N+1, N+2, etc. is never recalculated - it stays stale. This means the real downstream effect of a production change (e.g. a pull-ahead action) doesn't propagate forward through the rest of the planning horizon, understating the action's true impact.

**Fix**: after updating a period's production/inventory, cascade the recalculation forward through all subsequent periods for that SKU/plant combination (re-deriving `beginning_inventory[N+1] = ending_inventory[N]`, then `ending_inventory[N+1]`, `shortage_qty[N+1]`, etc., continuing forward) - the same chained logic already used in the original seed/migration roll-forward, just triggered incrementally after a single-period edit rather than only at full reseed time.

## Bug 3 — Two different shortage formulas can disagree

`recomputeAndSave` stores `shortage_qty = MAX(0, po.forecast_demand - beg_inv - newProd)` using the raw `forecast_demand` column. But the KPI strip and other live queries calculate shortage using `COALESCE(NULLIF(dwd.final_consensus, 0), po.forecast_demand)` (the Demand Planning connected value, per today's earlier fix). After an Apply action, the grid's stored `shortage_qty` and the KPI strip's live-calculated shortage can diverge because one uses the old raw column and the other uses the connected value.

**Fix**: `recomputeAndSave` should use the SAME demand source (the connected `dwd.final_consensus` via the same COALESCE/NULLIF pattern, falling back to `po.forecast_demand`) when recalculating `shortage_qty` after any action - consistent with how every other part of Supply Planning already sources demand after today's connection work.

## Item 4 — Material recommendation clarity note

Material/expedite-supplier recommendation cards should include a brief, clear note stating what they actually improve (e.g. "Improves Material Coverage - does not directly affect Service Level this period") since these recs change `material_availability` but not `planned_production`/`shortage_qty`, so Service Level and the main shortage KPI correctly don't move when applied - this should be expected, not look like a no-op bug.

## Verification

Give me manual browser steps to verify:
1. Apply an overtime recommendation - confirm the actual capacity increase applied matches the intended single-line amount, not a multiplied version (hand-check against the recommendation's stated hours).
2. Apply a pull-ahead or production-change recommendation - confirm subsequent periods' beginning/ending inventory and shortage actually update (not just the immediately-edited period).
3. After any Apply action, confirm the grid's shortage display and the KPI strip's shortage value AGREE with each other (no divergence).
4. Confirm a Material/expedite recommendation card now shows the clarifying note about what it actually improves.
5. Confirm no regressions to anything previously verified today (the Demand-Supply connection, the What-If tab, existing grid editing).
