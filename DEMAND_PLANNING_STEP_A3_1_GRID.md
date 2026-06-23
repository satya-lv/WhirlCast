# Demand Planning — Step A.3.1: Workbench Shell + Forecast Grid Tab

Read DEMAND_PLANNING_SPEC.md in full. Step A.1 (schema) and A.2 (API) are complete and verified - this step builds the first real UI, establishing the page shell that the other 4 tabs will later sit inside.

## What to build

### 1. The workbench shell
A new page (e.g. `client/src/pages/DemandPlanning.jsx`), reusing Supply Planning's existing shared components per spec Section 1 (Stack/Grid/Card/ActionButton/KPIBar/WorkbenchLayout, statusConfig.js, design tokens from globals.css) - do not invent new visual patterns.

- Top KPI bar showing all 8 values from the `/api/demand-planning/kpis` endpoint (Section 3 of spec).
- Filter row: Branch/Location, Product Group, SKU search, ABC/XYZ class (Section 4 of spec), wired to the `/api/demand-planning/filters` endpoint.
- Tab navigation for the 5 tabs (Forecast Grid, Patterns, What-If, Exceptions, NPI Forecasting) - only Forecast Grid needs to actually render content this step; the other 4 can be placeholder/disabled tabs for now, same way Supply Planning's build added tabs incrementally.

### 2. Forecast Grid tab content
Reuse Supply Planning's PlanningGrid component pattern if it's generically reusable (check first - it may be too coupled to Supply Planning's specific measure-tab logic, in which case build a new component following the same virtualization/hierarchy approach rather than forcing reuse where it doesn't fit).

- Hierarchical rows: SKU → Location (per spec Section 1's confirmed catalog).
- 52-week columns, virtualized the same way Supply Planning's grid is (this is a 4,160-row dataset, same scale - don't skip virtualization).
- Exactly 4 measure rows per spec Section 5.1: Actual Sales, System Forecast, Planner Adjustment, Final Consensus.
- Planner Adjustment cells editable via double-click, same interaction pattern as Supply Planning's Planned Production cells - but only for "forward" weeks (check Step A.1/A.2's definition of editable weeks, likely tracked via the `editableFrom` field mentioned in the A.2 filters response).
- Editing a cell should call the PATCH endpoint from Step A.2 and refresh the KPI bar afterward, mirroring Supply Planning's edit-then-refresh pattern.

## Before writing code

Confirm whether Supply Planning's existing grid component is cleanly reusable or needs a parallel new one - tell me which approach you're taking and why before building.

## Verification

Give me specific manual browser steps to verify:
1. The new page loads with real KPI numbers (not zeros/blanks).
2. Filters are populated with real options and narrow the grid when changed.
3. The grid renders all SKU/location rows, scrolls smoothly.
4. Expanding a SKU shows its locations; each shows the 4 measure rows.
5. Editing a Planner Adjustment cell on an editable week updates Final Consensus and the KPI bar.
6. Attempting to edit a locked/historical week does NOT allow editing (confirm what should actually happen here - read-only display, or some other clear indication).

Also confirm this build did NOT touch any Supply Planning file - same additive-only discipline as Step A.1.
