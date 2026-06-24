# Supply Planning — Enhancement Batch: Status Row, Grid Additions, Inline Action

This batch adds a deliberately scoped set of enhancements to Supply Planning's existing workbench, decided item-by-item against a reference screenshot (not a wholesale redesign). Each item below was individually approved - do not add anything beyond this list (e.g. no sparkline charts, no Owner field, no second/parallel summary table, no smart per-constraint action labels - all explicitly decided against).

Read PROJECT_BRIEF.md and SUPPLY_PLANNING_SPEC.md before starting, since this builds on the existing, deployed, working Supply Planning module - treat with the same care as prior Supply Planning work (explain plan before building, verify after).

## What to build

### 1. Status-count breakdown row
A new row of small cards/chips, similar in spirit to the existing KPI bar but showing COUNTS of SKU-branches in each status category, using our EXISTING status categories from `statusConfig.js` / Constraints logic (PROJECTED STOCKOUT, INVENTORY BUFFER/Low Buffer, MATERIAL SHORTAGE, CAPACITY CONSTRAINT, ON PLAN, EXCESS) - do not invent new categories, reuse what already exists and is already computed elsewhere (e.g. the Constraints dashboard).

This should sit somewhere sensible relative to the existing 8 KPIs (your call on exact placement - e.g. a second row beneath them, or integrated into the same bar) - propose placement before building.

Plain numbers only, no sparklines (explicitly decided against).

### 2. Two new measure rows in the Planning Grid
Add to the grid's existing Supply measure tab (currently: Demand, Inventory, Production, Gap):
- **Gap vs Safety Stock**: how far below/above the safety stock buffer this row is (not the same as the existing Gap row, which is raw shortage vs. demand - this is specifically relative to the safety stock threshold).
- **DoC (Days of Cover)**: how many days the current inventory would last at current demand rate for that SKU/location/week.

State the exact formula for each before building, the same review-before-build pattern used throughout this project.

### 3. Inline "Take Action" button per row
Add a generic action button/icon visible on each SKU-location row in the grid (your call on exact placement - e.g. a new column, or an icon that appears on hover/row-selection). Clicking it opens the EXISTING Actions panel, pre-filled with that row's SKU/location already selected, saving the planner from manually finding and selecting it themselves. Do NOT build per-constraint-type smart logic (e.g. don't try to guess "this row should say Add Overtime") - this is explicitly a generic entry point into the existing panel, decided against being smart/contextual.

## Before writing code

Propose:
- Where the status-count row will be placed.
- The exact formulas for Gap vs Safety Stock and Days of Cover.
- The exact UI placement/interaction for the inline Take Action button.

## Verification

Give me manual browser steps to verify:
1. Status-count row shows real counts matching what the Constraints dashboard would show (e.g. if Constraints shows 8 capacity-overloaded cells, the status row's Capacity Constrained count should be consistent).
2. Gap vs Safety Stock and Days of Cover show sensible numbers for a few real rows - confirm the formula by hand-checking one row's math.
3. Clicking Take Action on a specific row opens the Actions panel pre-filled with that exact SKU/location, not a blank panel or the wrong one.
4. Confirm no existing functionality (grid editing, existing KPIs, Constraints, Recommendations) was broken by these additions.
