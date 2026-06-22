# Supply Planning Workspace — Functional Specification

> Status: TARGET STATE — nothing in this spec exists in the repo yet (per Phase 0 audit). This is the second major build phase after Demand Planning. Read alongside `PROJECT_BRIEF.md` and `IBP_SOP_SPEC.md`.

## 0. Where this fits

Demand Planning (Stage 1-2 of the S&OP cycle) is mostly built and working. This spec covers **Stage 3: Aggregate Supply & Capacity Planning** — converting the unconstrained demand plan (output of Demand Planning) into a feasible, constrained supply plan.

This REPLACES the original `IBP_SOP_SPEC.md` plan of five separate supply-side modules (Inventory Optimization, Replenishment, Raw Material Planning, Production Scheduling, Supplier Collaboration) with **one unified Supply Planning Workbench**, matching how Kinaxis/o9/SAP IBP actually structure this stage. Those five concepts still exist conceptually but as *views within* this one workbench, not as separate sidebar modules.

## 1. Purpose

Convert unconstrained demand into a feasible constrained supply plan considering:
- Manufacturing capacity
- Material availability
- Supplier constraints
- Inventory targets
- Customer priorities
- Cost and service trade-offs

## 2. Data model additions required (none of this exists yet)

This module cannot be built without first extending the database. New entities needed, beyond what `IBP_SOP_SPEC.md` Section 2 already specified:

| Entity | Purpose | Key fields |
|---|---|---|
| `Customer` | Customer master | id, name, priorityTier |
| `ProductionLine` *(already planned, still missing)* | Manufacturing line | id, plantId, name, hoursPerShift, shiftsPerDay |
| `WorkCenter` | Sub-line capacity unit | id, productionLineId, name, hoursAvailable |
| `Plant` | Manufacturing site | id, name, region |
| `Supplier` *(already planned, still missing)* | Supplier master | id, name, otifPct, leadTimeDays |
| `BomLine` *(already planned, still missing)* | Component requirement per SKU | skuId, componentId, qtyPer |
| `Component` | Raw material/component master | id, name, supplierId, onHandQty |
| `PlanningOrder` | Weekly planning grid cell record | skuId, locationId, plantId, productionLineId, weekNumber, year, plus all measures below |
| `FirmProductionOrder` | Locked/firm production commitments | distinct from planned (system-suggested) orders |
| `PurchaseOrder` | Open POs to suppliers | componentId, supplierId, qty, dueDate |
| `TransferOrder` | Inter-location stock transfers | fromLocationId, toLocationId, skuId, qty, week |
| `ScenarioSupplyPlan` | Named what-if supply scenarios | references PlanningOrder set + the action(s) applied |

**Required measures per PlanningOrder (week × SKU × location × plant × line cell):**

*Demand:* Forecast Demand, Customer Orders, Priority Demand
*Supply:* Beginning Inventory, Planned Production, Firm Production Orders, Purchase Orders, Transfer Orders, Ending Inventory
*Constraints:* Capacity Available, Capacity Required, Material Availability, Shortage Quantity, Supply Gap

## 3. Screen 1 — Supply Planning Workbench

### 3.1 Filters
Region · Plant · Product Family · SKU · Customer · Planning Scenario · Planning Horizon

### 3.2 Executive KPI cards (8)
Total Demand · Feasible Supply · Unconstrained vs Constrained Gap · Service Level % · Revenue at Risk · Inventory Days · Capacity Utilization % · Material Coverage Days

All computed from real data — no hardcoded values, consistent with the rest of this platform's conventions.

### 3.3 Time-Phased Planning Grid

**Rows:** SKU → Location → Plant → Production Line (hierarchical, expandable)
**Columns:** Week 1–52 (full year, live and interactive per decision — see engineering note below)
**Cell measures:** all measures listed in Section 2 above, switchable via a measure selector (don't show all of them stacked at once — that's unreadable; follow the Kinaxis/o9 convention of one measure row expanded per group, switchable)

**Engineering note (critical):** A 52-week × multi-dimensional grid is a real performance problem, not just a UI problem. This must use row/column virtualization (render only visible cells) — do not render the full grid into the DOM at once. Flag this explicitly to Claude Code as a hard requirement, not an afterthought.

### 3.4 Planning actions (editable grid)
Planner can: increase production · pull ahead production · push production · change production plant · allocate limited supply · add overtime · expedite supplier orders

Each action follows the existing 3-state pattern (idle → loading → done) from the shared `ActionButton`/`simulatedAction` utility already built in Phase 1 — reuse it, don't rebuild it.

### 3.5 Constraint Solver (simulated, not a real optimizer)
Generates a recommended supply plan against objectives, in priority order:
1. Maximize customer service
2. Minimize inventory
3. Reduce production cost
4. Improve capacity utilization

**"Simulated" means:** the recommendation must be computed from the actual underlying numbers (real overload %, real shortage qty, real customer priority data) and must change correctly if the input data changes — it must NOT be a canned, hardcoded response. What's simulated is the *method* (no real linear/mixed-integer solver), not the realism of the inputs/outputs. Treat this the same way `computePhaseOut()`/`computeRenovBlended()` in NPI is real math without being a full ML model.

### 3.6 Constraint Dashboard (bottleneck views)

**Capacity view:** Plant · Line · Work Center · Available Hours · Required Hours · Utilization % · Overload %
**Material view:** Component · Supplier · BOM impact · Available Quantity · Shortage Quantity · Recovery Date
**Demand impact view:** Impacted Customer · Impacted Orders · Revenue Risk · Service Risk

### 3.7 Pegging View
End-to-end dependency chain, rendered as a visual trace:
`Customer Demand → Finished Goods → Production Order → Component Requirement → Supplier`

### 3.8 Scenario Simulation
Planner can create named scenarios (e.g. "Add Overtime," "Shift Production Location," "Expedite Supplier") and compare them side by side on: Service improvement · Cost impact · Inventory impact · Revenue recovery.

Reuse the existing Scenarios comparison pattern from Demand Planning (`ForecastSelection.jsx`) conceptually — same "select 2+, compare" interaction model, applied to supply scenarios instead of forecast algorithms.

### 3.9 Recommendation Engine
For every constraint/bottleneck found, show:
- **Issue** (e.g. "Plant capacity overloaded by 15%")
- **Recommended actions** (ranked list, e.g. move production to alternate plant / add shift / prioritize high-margin customers)
- **Before vs after impact** (using the same before/after comparison pattern as the existing Conflicts module's "AI Forecast vs After Overrides" chart)

## 4. UX requirements
- Modern enterprise APS SaaS look — consistent with the existing design system tokens from Phase 1, not a new visual language.
- Left navigation — already exists from Phase 2 shell; this module slots into the "Plan" group where placeholders already reserve its spot.
- Planner exception inbox — new, list of active constraint issues needing attention, feeds from the Constraint Dashboard data.
- Editable planning grid — see 3.4.
- Interactive charts — Recharts, consistent with existing modules' charting library (don't introduce a second charting library).

## 5. Explicit non-goals for this phase
- No real optimization solver (confirmed — simulated only, per Section 3.5)
- No real-time multi-user collaboration on the grid (single-planner editing is fine for demo)
- No actual ERP/MRP integration — all data is synthetic, generated to be internally consistent (capacity vs demand vs BOM math must all reconcile correctly even though the dataset itself is fabricated)
