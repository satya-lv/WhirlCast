# Supply Planning Build Plan — Phase 3 (Revised)

> Run these as SEPARATE Claude Code sessions, strictly in order. This phase is bigger than anything done so far — do not compress steps to save time, that's exactly how this kind of build goes wrong.

---

## Step 3.0 — Commit current state FIRST

Before starting any of this, commit everything currently sitting uncommitted from Phases 1-2. This phase starts with a schema migration — you want a guaranteed-clean rollback point before that begins.

```
git add .
git commit -m "Phase 1+2 complete: design system, shell restructure, dashboard fixes (checkpoint before Supply Planning build)"
```

---

## Step 3.1 — Schema Migration Only

**Goal:** Add every new database table/field needed, with realistic seed data, and verify it independently of any UI. No frontend work in this step.

```
Read PROJECT_BRIEF.md (all sections, including the Section 2 revision) and
SUPPLY_PLANNING_SPEC.md in full.

This step is database work ONLY — do not build any UI or routes yet.

1. Design and add migrations for every new entity in SUPPLY_PLANNING_SPEC.md
   Section 2: Customer, Plant, ProductionLine, WorkCenter, Supplier, BomLine,
   Component, PlanningOrder, FirmProductionOrder, PurchaseOrder,
   TransferOrder, ScenarioSupplyPlan.

2. PlanningOrder is the core weekly grid cell record — confirm its shape
   supports: skuId, locationId, plantId, productionLineId, weekNumber, year,
   and every measure listed in Spec Section 2 (Forecast Demand, Customer
   Orders, Priority Demand, Beginning Inventory, Planned Production, Firm
   Production Orders, Purchase Orders, Transfer Orders, Ending Inventory,
   Capacity Available, Capacity Required, Material Availability, Shortage
   Quantity, Supply Gap).

3. Seed realistic, internally-consistent synthetic data:
   - Reuse existing SKUs/locations from the current product_master and
     branch data where it makes sense, extending rather than replacing.
   - Generate Plants, Production Lines, Work Centers, Suppliers, Components,
     and BOM lines that make sense for Whirlpool-style appliance
     manufacturing (compressors, motors, sheet metal, etc. as component
     categories — keep it plausible, not generic).
   - CRITICAL: capacity vs demand vs BOM math must reconcile correctly.
     If a SKU's planned production for a week implies X units of a
     component, the component's required quantity in that week must
     actually equal X * qtyPer from the BOM. Capacity required must
     actually derive from real production volume, not be randomly
     generated independent of it. This is a fabricated dataset, but the
     internal arithmetic must be real and consistent — verify this with
     a script before declaring done, don't just eyeball it.
   - Seed 52 weeks of PlanningOrder data per SKU/location combination.

4. After seeding, run a verification script (write one) that confirms:
   - No orphaned foreign keys
   - Capacity required reconciles with planned production for a sample
     of records
   - Component shortage quantities reconcile with BOM math for a sample
     of records
   - Report the sample size checked and any reconciliation failures found

Do NOT build any API routes or frontend code in this step. Report back the
final schema (table list + key fields), the seed data volumes (e.g. "8
plants, 14 production lines, X SKUs x 52 weeks = Y planning order rows"),
and the verification script's results.
```

**Definition of done:** Schema exists, seed data is consistent (verified by script, not eyeballed), zero frontend changes. Review the verification report yourself before moving on — if reconciliation failures are reported, stop and fix before Step 3.2.

---

## Step 3.2 — API Layer Only

**Goal:** Build the backend routes to serve this data, still no frontend.

```
Read PROJECT_BRIEF.md and SUPPLY_PLANNING_SPEC.md.

The schema from Step 3.1 now exists (confirm by reading server/db/schema.js
before proceeding). Build the API routes needed to serve the Supply Planning
Workbench:

1. GET endpoint(s) for the planning grid — must support filtering by Region,
   Plant, Product Family, SKU, Customer, and week range, and must NOT
   return all 52 weeks x all SKUs x all locations in one unfiltered payload
   (that will be too large). Design pagination/filtering so the frontend
   can request only what's visible.

2. GET endpoint for the 8 KPI cards (Section 3.2 of spec) — compute from
   real PlanningOrder data, server-side.

3. GET endpoint for the Constraint Dashboard (capacity view, material view,
   demand impact view — Section 3.6).

4. GET endpoint for the Pegging View dependency chain (Section 3.7).

5. POST/PUT endpoints for the planning actions (Section 3.4 — increase
   production, pull ahead, push, change plant, allocate, overtime, expedite)
   — these should write changes back to PlanningOrder/FirmProductionOrder
   records.

6. Endpoint(s) for the Recommendation Engine (Section 3.5/3.9) — given
   current state, compute and return ranked recommended actions with
   before/after impact. Remember: simulated METHOD, real DATA — the numbers
   must derive from actual current PlanningOrder/capacity/BOM state every
   time, not be hardcoded.

7. Endpoints to support Scenario Simulation (Section 3.8) — create/list/
   compare named ScenarioSupplyPlan records.

Follow the same route file-per-feature-area convention already used in
server/routes/. Do not build any frontend page yet.

Report back every endpoint created, its inputs/outputs, and confirm you
tested each one returns real (not error/empty) data using the seed data
from Step 3.1.
```

**Definition of done:** Every endpoint tested and returns real data. Still zero frontend changes.

---

## Step 3.3 — Grid Engine (the hard performance part, build in isolation)

**Goal:** Get the virtualized 52-week grid working and fast, before adding any of the other views around it.

```
Read PROJECT_BRIEF.md and SUPPLY_PLANNING_SPEC.md Section 3.3.

Build ONLY the Time-Phased Planning Grid component as an isolated piece:
- Hierarchical rows: SKU > Location > Plant > Production Line, expandable.
- Columns: Week 1-52, must use virtualization (only render visible columns/
  rows in the DOM — research and use a suitable virtualization approach
  given this is a CRA/react-scripts React 18 app with no existing
  virtualization library; pick one, justify the choice).
- A measure selector that switches which measure group is shown in the
  grid (Demand / Supply / Constraints) rather than showing all measures
  stacked simultaneously.
- Pull data from the Step 3.2 grid endpoint using its filter params.
- Cells in the Supply section should be editable per Section 3.4 (wire the
  UI interaction, even if the underlying planning-action endpoints get
  fully connected in the next step).

Test this with the FULL seeded dataset (all SKUs x all locations x 52
weeks) and confirm it stays responsive — report what you measured (e.g.
render time, scroll smoothness) and what virtualization approach you used.

Do not build the KPI cards, constraint dashboard, pegging view, or scenario
simulation yet — this step is the grid only, since it's the highest-risk
performance piece and needs to be solid before anything else is layered
on top of it.
```

**Definition of done:** Grid renders the full dataset, scrolls smoothly, measure switching works. You should personally test this with real interaction (scroll fast, expand/collapse rows) before moving on — performance problems are easy to miss in a written report.

---

## Step 3.4 — Surrounding Workbench (KPIs, filters, actions)

```
Read PROJECT_BRIEF.md and SUPPLY_PLANNING_SPEC.md Sections 3.1, 3.2, 3.4.

Assemble the full Supply Planning Workbench page around the grid built in
Step 3.3:
1. Filter bar (Section 3.1) wired to actually filter the grid.
2. 8 KPI cards (Section 3.2) using the Step 3.2 KPI endpoint and the
   existing KPICard/KPIBar components from Phase 1.
3. Wire the planning actions (Section 3.4) to their Step 3.2 endpoints,
   using the existing ActionButton/simulatedAction 3-state pattern.
4. Mount this page in the sidebar slot reserved for Supply Planning
   (replacing the five old "Coming soon" placeholders per
   PROJECT_BRIEF.md Section 2.2).

Report what you built and confirm the page loads, filters work, KPIs show
real numbers, and at least one planning action completes successfully
end to end.
```

**Definition of done:** Core workbench page is live and usable end to end, even before the advanced views below exist.

---

## Step 3.5 — Constraint Dashboard, Pegging View, Recommendation Engine

```
Read PROJECT_BRIEF.md and SUPPLY_PLANNING_SPEC.md Sections 3.5, 3.6, 3.7, 3.9.

Add to the Supply Planning Workbench:
1. Constraint Dashboard (capacity/material/demand-impact bottleneck views).
2. Pegging View (Customer Demand -> Finished Goods -> Production Order ->
   Component Requirement -> Supplier dependency chain, visual trace).
3. Recommendation Engine — for every constraint found, show Issue +
   Recommended actions (ranked) + Before/after impact, using the existing
   before/after chart pattern from the Conflicts module as a visual
   reference.
4. Planner exception inbox (Section 4) — list of active constraint issues,
   sourced from the Constraint Dashboard data.

Report what you built, and specifically confirm the Recommendation Engine's
output changes correctly when you alter underlying data (test this -
change a capacity number and confirm the recommendation updates
accordingly, don't just assume).
```

---

## Step 3.6 — Scenario Simulation

```
Read PROJECT_BRIEF.md and SUPPLY_PLANNING_SPEC.md Section 3.8.

Add Scenario Simulation to the Supply Planning Workbench: create named
scenarios (e.g. Add Overtime, Shift Production Location, Expedite
Supplier), and a compare view (service improvement, cost impact, inventory
impact, revenue recovery), modeled on the existing ForecastSelection.jsx
compare-2+ interaction pattern from Demand Planning.

Report what you built and confirm creating 2+ scenarios and comparing them
works end to end with real computed deltas.
```

---

## Step 3.7 — Full Verification Pass

```
Read PROJECT_BRIEF.md and SUPPLY_PLANNING_SPEC.md in full.

Do a complete pass over the Supply Planning Workbench:
1. Confirm every sub-section of SUPPLY_PLANNING_SPEC.md Section 3 is built
   and functioning.
2. Confirm the grid still performs well with full data after all the
   additional views were layered on top.
3. Confirm Demand Planning module is completely unaffected — re-test its
   existing routes/pages.
4. Confirm design consistency with Phase 1 tokens throughout.
5. List anything from the spec you had to interpret or simplify, and flag
   it for review.

Produce a final summary report.
```

**Definition of done:** Full report delivered. You do one more manual click-through yourself before considering this phase closed.
