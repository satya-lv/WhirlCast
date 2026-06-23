# Supply Planning — Grid Simplification & UI Trim

Read PROJECT_BRIEF.md and SUPPLY_PLANNING_SPEC.md before starting.

This batch simplifies the Planning Grid's measure tabs and trims the visible Supply Planning navigation for now, WITHOUT deleting any backend code or data. Everything hidden here must remain fully intact in the codebase/database so it can be re-enabled later.

---

## Item A — Remove the "Demand" measure tab from the Planning Grid

**Why:** Demand Planning (the separate module) already owns demand forecasting. Showing a Demand view inside the Supply Planning grid duplicates that, with no added value for this module's story.

**What to do:**
1. Remove the "Demand" option from the grid's measure tab switcher (currently: Demand / Supply / Constraints). The grid should now only switch between Supply and Constraints.
2. IMPORTANT - before removing it from the UI, tell me explicitly: where does Supply Planning's "Total Demand" KPI and the Cap Req calculations currently source their demand number from? Is it reading from the same `forecast_records`/demand data Demand Planning uses, or from an independently-seeded number in the Supply Planning tables (e.g. planning_orders.forecast_demand)? I need this confirmed and written down clearly in your report, since we'll need it later when checking whether Demand Planning and Supply Planning numbers are actually connected.
3. Do not delete any demand-related columns/fields from the database or API - only remove the tab/view from the grid UI.

---

## Item B — Simplify the "Supply" measure tab to 4 rows

**Why:** The current Supply view (Beginning Inventory, Planned Production, Firm Production Orders, Purchase Orders, Transfer Orders, Ending Inventory) has too much granular accounting detail for this audience and demo. Simplify to the essential story: what's needed, what we have, what we're making, and the resulting gap.

**What to do:**
1. Replace the current Supply measure rows with exactly 4 rows: **Demand**, **Inventory**, **Production**, **Gap**.
2. "Gap" = Demand − (Inventory + Production) for that SKU/location/week. Confirm this is computed using the SAME underlying logic/values as the existing Shortage Qty / Supply Gap KPI - it should be the same concept, just simplified and shown per-row in the grid rather than only as an aggregate KPI. Do not introduce a second, different gap calculation.
3. "Inventory" should be Beginning Inventory for that week (i.e. what's on hand at the start of the week, before that week's production).
4. "Production" is the existing Planned Production value - still editable (double-click to edit), exactly as it is today.
5. Keep Firm Production Orders, Purchase Orders, Transfer Orders, and Ending Inventory in the database and accessible via API if anything else depends on them - just don't show them as grid rows anymore.

---

## Item C — Hide Pegging and Scenarios from the visible navigation

**Why:** Trimming the demo surface for now. Both features remain fully functional in the codebase; just not reachable from the current UI.

**What to do:**
1. Remove "Pegging" and "Scenarios" from the visible tab row in the Supply Planning Workbench (currently: Planning Grid / Constraints / Pegging / Recommendations / Inbox / Scenarios).
2. The resulting visible tab order should be: **Planning Grid, Constraints, Recommendations, Inbox**.
3. Do NOT delete the Pegging or Scenarios components, routes, or database tables/data. Comment out or conditionally hide the navigation entries only (e.g. a feature flag or simply removing them from the rendered tab list) - the underlying code must still work if re-enabled by adding the tab back.
4. Confirm: if a recommendation card's "View Fix" or similar link ever pointed to the Recommendations tab (not Pegging/Scenarios), that should still work fine. If anything currently routes TO Pegging or Scenarios from elsewhere (e.g. a button), flag it so we can decide what should happen to that link.

---

## Report back

For each item, confirm what changed, which file(s), and:
- Item A: explicitly state where the demand number currently comes from (this is required, not optional).
- Item B: confirm the Gap row matches the existing Supply Gap KPI's logic.
- Item C: confirm Pegging/Scenarios still work if accessed directly (e.g. via URL) even though hidden from the tab nav, and flag any other place in the app that links to them.
