# Supply Planning — Structural Simplification Batch

Read PROJECT_BRIEF.md, SUPPLY_PLANNING_SPEC.md, and PERSONA_LOGIN_NAVIGATION.md before starting. This is a combined batch of 5 distinct, already-decided structural changes to Supply Planning. Each is final - confirm understanding before building, but these are not open for redesign.

## Item 1 — Simplify grid hierarchy: SKU/Category → Plant (remove Location level)

The Planning Grid currently has a 3-level hierarchy: SKU → Location → Plant/Line. Change this to a 2-level hierarchy: SKU → Plant/Line directly - the Location grouping level is removed entirely. Since each Plant is already tied to a specific location in the data, this is a flattening (no information is lost - a Mumbai plant simply appears directly under its SKU instead of nested under a separate "Mumbai" location row first).

This affects: the grid's row-building/tree logic, any aggregation that currently rolls up by Location before Plant, and any filter/display logic that assumes this 3-level structure. Show me your plan for how the tree-building logic changes before implementing.

## Item 2 — Remove Branch Manager / Category Manager personas from Supply Planning

Supply Planning no longer has a role-selection step. When a user picks "Supply Planning" from the persona landing menu, they should skip the role-selection screen ENTIRELY and land directly on the Supply Planning workbench - unrestricted, full access, the same behavior the unscoped "Supply Planner" role already has today.

Demand Planning's persona system (Demand Planner / Branch Manager / Category Manager, with locked filters) is UNCHANGED - this only affects Supply Planning's flow. Update the routing (likely in PersonaRoleSelect or wherever the module->role flow branches) so picking Supply Planning navigates straight to /supply without an intermediate role-selection screen.

## Item 3 — Remove the "Gap vs Safety Stock" grid row

Remove this row entirely from the Supply measure group (added in an earlier session). The grid's Supply rows go back to: Demand, Inventory, Production, Gap, Days of Cover (DoC) - only "Gap vs Safety Stock" specifically is removed, everything else stays.

## Item 4 — Constraints tab: fix capacity column labels (confirmed real bug)

In the Capacity sub-view, the column currently labeled "Hrs/Mo (cap)" is a confirmed mislabel - the underlying value is genuinely a WEEKLY rate (hours_per_shift x shifts_per_day x working_days_per_week from production_lines), not a monthly figure, and relabeling it to "Mo" during the earlier week->month pass made it actively misleading.

Fix the labels (no calculation changes - the math is already correct):
- Rename "Hrs/Mo (cap)" -> "Cap (hrs/wk)" - explicitly weekly, since this is a deliberate, explained exception to the rest of the month-labeled UI (shifts/working-days are inherently weekly concepts; converting to an approximate monthly figure would introduce a less natural, approximated number for no real benefit).
- Rename "Hrs Required" -> "Hrs Required (total, M24-M52)" or similar - make explicit that this is a RANGE TOTAL across all visible periods, not a per-period figure (this was the second half of the confusion - one column is a rate, the other is a total, and neither was labeled to make that distinction clear).
- Confirm Utilization % and Overload Hrs labels are also clear about what they represent (range-aggregated, derived from the rate x period count) - adjust if needed for clarity, but their underlying calculation is already correct and should not change.

## Item 5 — Tune seed data so fewer SKUs sit in prolonged zero-inventory/shortage

Confirmed: the current inventory roll-forward logic (ending[N] floors at 0, becomes beginning[N+1], shortage tracked separately) is CORRECT real-world behavior - this is not being changed. The issue is that the SEED DATA currently produces too many SKUs stuck in prolonged shortage (inventory at 0 for many consecutive periods), which makes the grid look overly empty/zeroed-out for demo purposes.

Fix: adjust seed_supply.js's starting conditions (e.g. higher initial beginning inventory, more realistic production capacity relative to demand, or whatever combination produces a more balanced result) so that, across the 10 SKUs, a healthier mix recovers from or avoids prolonged shortage - while keeping the exact same calculation formula/logic Item 4's investigation already confirmed is correct. This is a data-calibration change, not a logic change. Show me before/after summary stats (e.g. how many SKU-plant combinations are in prolonged shortage before vs after your seed adjustment) so we can see the improvement is real before approving.

## Before writing code

Explain your plan for Item 1 (hierarchy flattening) and Item 5 (seed tuning approach) before implementing - these are the two items with the most room for a wrong approach to cause subtle issues.

## Verification

Give me manual browser steps to verify:
1. Grid shows SKU expanding directly to Plant rows, no Location level.
2. Picking "Supply Planning" from the landing menu skips role-selection and lands directly on the workbench.
3. "Gap vs Safety Stock" row is gone; Demand/Inventory/Production/Gap/DoC remain.
4. Capacity sub-view shows the corrected, clearer labels - confirm by hand-checking one row that the labels now accurately describe what each number is.
5. Seed data produces a visibly more balanced picture - show me the before/after stats from your own investigation.
6. Confirm no regressions to Demand Planning's persona system (still has all 3 roles working correctly) or anything else previously verified today.
