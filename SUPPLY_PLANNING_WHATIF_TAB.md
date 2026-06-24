# Supply Planning — What-If Tab (Gap-Based Multi-SKU Lever Simulation)

Read PROJECT_BRIEF.md and SUPPLY_PLANNING_SPEC.md before starting. This builds on the existing, deployed, working Supply Planning module (including Step B's live demand connection and the recent visual enhancements batch). Treat with the same care as prior Supply Planning work.

This is a genuinely new feature, decided through extended discussion - the mechanics below are FINAL, not open for reinterpretation. Confirm your understanding of each before building, but do not redesign the mechanics themselves.

## The confirmed mechanics

1. **Levers**: a dropdown to pick ONE lever to simulate at a time - Add Overtime, Shift Production Location, or Expedite Supplier. These already exist as real, working actions in the existing Actions panel - REUSE that underlying logic/calculation, don't reinvent it. This tab is a new front-end for testing those same actions across MULTIPLE SKUs at once before committing, not a new calculation engine.

2. **Selection**: a list/table of SKU-locations that currently have Gap > 0 (i.e. a real shortage), each with a checkbox for multi-select. Quick-filters to narrow this list by ABC class, XYZ class, and/or gap severity (your call on exact severity buckets, consistent with existing thresholds elsewhere in the app). Confirmed: Supply Planning CAN query product_master.abc_class/xyz_class directly (same database, already verified) - no new infrastructure needed for this filter.

3. **Simulation**: once SKUs are selected and a lever is chosen, a "Simulate" action computes what that lever would do for EACH selected SKU-location, reusing the existing action calculation logic (e.g. Add Overtime's existing capacity-increase math) per SKU rather than building new math.

4. **Results display - BOTH required**:
   - A combined summary headline (e.g. total Gap reduction across all selected SKUs, total cost/impact).
   - A per-SKU breakdown table: one row per selected SKU-location showing its own before/after Gap, Service Level impact, and cost - so a planner can see that a lever helps some SKUs more than others and make an informed choice about which to actually approve.

5. **Approval**: INDIVIDUAL per-SKU approval, not one "approve all" button - each row in the results table gets its own Approve action, so a planner can choose to skip SKUs where the lever didn't help much. Reuse the all-or-nothing rollback pattern from Demand Planning's Apply Scenario feature (capture "before" state, roll back cleanly if a write fails) - even though approval here is per-SKU rather than per-week, the same safety principle applies: don't leave a partially-failed write in an inconsistent state.

## Before writing code

Confirm your understanding of all 5 mechanics above in your own words, and propose:
- Exact gap severity bucket thresholds for the filter.
- Where this tab lives in the existing Supply Planning navigation (a new top-level tab? Confirm exact placement).
- The exact API endpoint(s) needed - reusing existing action calculation logic, not duplicating it.

## Verification

Give me manual browser steps to verify:
1. Selecting multiple SKUs via checkboxes and filtering by ABC/XYZ/gap severity narrows the list correctly.
2. Running a simulation (e.g. Add Overtime) on a multi-SKU selection produces both a combined summary AND a per-SKU table, with numbers that make sense (e.g. a SKU that's material-constrained, not capacity-constrained, should show little/no benefit from Add Overtime - confirm the simulation reflects real constraint logic, not a uniform blanket improvement).
3. Approving ONE row from the results table actually writes that change (visible in the Planning Grid afterward) without affecting the other, non-approved rows.
4. Test a forced-failure scenario for the rollback (similar to how we proved Demand Planning's rollback worked) if approving multiple rows in sequence.
5. Confirm no Demand Planning file was touched, and no existing Supply Planning functionality regressed.
