# Demand Planning Grid — Stage 1: New Adjustment Rows + Persona-Scoped Editing

Read PROJECT_BRIEF.md, DEMAND_PLANNING_SPEC.md, and PERSONA_LOGIN_NAVIGATION.md before starting. This builds on the existing Forecast Grid, the persona system (PersonaContext, locked filters), and the existing What-If Apply Scenario flow - all already working and verified.

## Decided changes (final, not open for redesign)

### 1. Rename row
"Planner Adjustment" -> "Marketing Adjustment" (label only - same underlying field/column, same editing mechanics as today, same column the What-If tab's Apply Scenario writes to). Find every place this label appears (grid row label, any tooltips, any other UI text referencing "Planner Adj") and rename consistently.

### 2. Two new rows: Branch Adjustment and Category Adjustment
Add two new editable rows to the Forecast Grid, positioned between Marketing Adjustment and Final Consensus:
- Actual Sales
- System Forecast
- Marketing Adjustment (renamed from Planner Adjustment)
- Branch Adjustment (NEW)
- Category Adjustment (NEW)
- Final Consensus

**New formula**: Final Consensus = System Forecast + Marketing Adjustment + Branch Adjustment + Category Adjustment (sum of all three adjustment rows). Update wherever Final Consensus is currently computed (client display formula AND any server-side calculation/storage) to include all three.

This requires new columns in `demand_weekly_data` for `branch_adjustment` and `category_adjustment` (both REAL, default 0, same pattern as the existing `planner_adjustment` column). Write a migration for this - follow the same additive, non-destructive migration pattern used throughout this project (e.g. `migrate_demand.js`'s existing ALTER TABLE approach).

### 3. Persona-scoped editing on these rows
- **Branch Manager**: can edit ONLY Branch Adjustment (for their locked branch/location). Marketing Adjustment and Category Adjustment are read-only/view-only for this persona - they can SEE the numbers (including other branches'/categories' values if applicable to what they can see elsewhere in their scoped view) but cannot type into those cells.
- **Category Manager**: can edit ONLY Category Adjustment (for their locked category). Marketing Adjustment and Branch Adjustment are read-only/view-only for this persona.
- **Demand Planner** (unscoped): can edit ALL THREE rows (Marketing, Branch, Category Adjustment) - full access, consistent with this persona's existing unrestricted behavior everywhere else.

**Important exception, already decided**: the existing What-If tab's "Apply Scenario" action continues to write to Marketing Adjustment for ANY persona, regardless of the above grid-editing restrictions - this is a separate, intentional path that stays universal. Do not restrict or change the What-If Apply flow - this task is ONLY about direct grid-cell editing permissions.

Implement this the same way the existing locked-filter mechanism works (read `persona.role` from PersonaContext) - reuse that existing pattern, don't invent a new permissions system.

### 4. Category Manager's new filter — branch adjustment severity buckets
For the Category Manager persona specifically, add a new filter (dropdown or similar) on the Forecast Grid, additional to existing filters: a way to filter/highlight branches by how much their Branch Adjustment has changed the forecast, as a percentage.

**Calculation**: for each branch (within the Category Manager's locked category), compute:
  `pctChange = (branch_adjustment / system_forecast) * 100` (absolute value, since both over- and under-adjustment are conflicts worth seeing)

**Buckets** (5 total): 0% (no adjustment) / 1-10% (minor) / 11-25% (moderate) / 26-50% (large) / 51%+ (extreme).

Selecting a bucket filters the grid/view to show only branches falling in that range. This is a NEW capability specific to the Category Manager persona - other personas don't need this filter.

## Before writing code

Explain your plan for:
1. Where in the existing grid component the two new rows get added, and how the persona-based edit/view-only logic will be implemented (reusing the existing locked-filter pattern).
2. The exact migration for the two new database columns.
3. How the severity-bucket filter will be computed and surfaced in the UI - propose the exact filter control's placement/design before building.

## Verification

Give me manual browser steps to verify:
1. The grid shows all 6 rows in the correct order, with "Marketing Adjustment" label (not "Planner Adjustment") anywhere it previously appeared.
2. Final Consensus correctly equals the sum of System Forecast + all three adjustment rows - confirm by hand-checking one real row's numbers.
3. Branch Manager persona: can edit Branch Adjustment, cannot edit Marketing or Category Adjustment (attempt to edit each, confirm correct behavior).
4. Category Manager persona: can edit Category Adjustment, cannot edit Marketing or Branch Adjustment.
5. Demand Planner persona: can edit all three rows.
6. What-If's Apply Scenario still writes to Marketing Adjustment correctly for a Branch Manager or Category Manager persona (confirming the intentional exception still works).
7. Category Manager's new severity-bucket filter correctly narrows the view based on real Branch Adjustment percentage calculations - verify by hand-checking one bucket's contents against the real numbers.
8. Confirm no regressions to Supply Planning or any other previously-verified functionality.
