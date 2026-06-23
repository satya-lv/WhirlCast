# WhirlCast → IBP/S&OP Platform — Project Brief

> **Read this file at the start of every session.** This is the single source of truth for scope, architecture, and constraints. If anything in a chat instruction conflicts with this file, flag the conflict instead of silently picking one.

---

## 0. What this project is

WhirlCast is an existing demo application (Whirlpool India demand planning tool) with real domain formulas behind synthetic data — not a static mockup. The goal of this project is to **grow WhirlCast into a full end-to-end S&OP platform** (Kinaxis/o9-style), covering the complete cycle from statistical forecasting through executive sign-off, while:

- Keeping every existing working formula/calculation intact unless explicitly told to change it
- Extending the UI shell and navigation to support many more modules without it becoming incoherent
- Building genuinely new modules that don't exist yet
- Fixing known bugs along the way
- Enforcing one consistent design system across old and new screens

This is an **extend-and-unify** project, not a rebuild. Do not regenerate working modules from scratch. Read before you write.

---
## 1. Current State (confirmed via Phase 0 audit — [DATE: fill in])

### 1.0 Stack & structure
- Frontend: React 18 (CRA/react-scripts) + React Router v6 + Recharts + React-Leaflet. No TypeScript.
- Backend: Node.js + Express + SQLite (better-sqlite3).
- `client/src/pages/` — one file per route. `client/src/components/layout/` and `components/shared/` for reusable pieces (KPICard, Badge, Modal, IndiaMap, PageHeader, Toast).
- `server/routes/` — one file per feature area. `server/db/schema.js` + `seed.js` + `demandiq.db`.
- Auth/role-gating via `AuthContext` + `ProtectedRoute`, enforced per-route.
- Data fetching is plain `fetch()` in `useEffect` per page — no shared API client, no React Query/SWR.

### 1.1 Confirmed existing modules — actual implementation quality
| Module | File | Formula quality |
|---|---|---|
| Dashboard | `Dashboard.jsx` | Mixed — branch map/cycle tracker real; trend chart is hardcoded static arrays (lines 32-48); two KPI cards have field-name bugs (see 1.2) |
| Workbench | `ForecastWorkbench.jsx` | Real formulas — strong |
| Scenarios | `ForecastSelection.jsx` | Real formulas — strong |
| Collaborate | `CollaborationSuite.jsx` | Real formulas |
| Conflicts | `OverrideConflicts.jsx` | Real formulas — strongest in codebase |
| Sensing | `DemandSensing.jsx` | Stubbed — `SAMPLE_INSIGHTS` hardcoded (lines 12-45), preview data is pseudo-random; the actual Claude API call is real, but pre-upload display is fabricated |
| NPI | `NPIForecasting.jsx` | Mixed — "New Product Innovation" path is a hardcoded `RESULTS` object (lines 17-44); "Renovation" path has real `computePhaseOut()`/`computeRenovBlended()` math |
| Report | `ForecastingReport.jsx` | Real formulas — strong |
| Admin | `AdminConsole.jsx` | No formulas needed — correct, pure CRUD |

### 1.2 Known bugs — exact cause and fix
**Bug 1 — "Pending Overrides" shows `NaN branches`**
`Dashboard.jsx:204` reads `liveSummary.total_branches`, but the API (`forecast.js:180-188`) returns the field as `branches_total`. Fix: rename the read to `liveSummary.branches_total`.

**Bug 2 — "Unresolved Conflicts" shows `undefined`**
`Dashboard.jsx:205` reads `liveSummary.conflicts_pending`, but the API returns `conflicts_count`. Fix: rename both reads on that line to `liveSummary.conflicts_count`.

**"How this works ▾" sections — NOT a bug.** Toggle logic in `PageHeader.jsx:4-33` works correctly via `useState`. It only renders if a page passes a `helpText` prop. Most pages simply don't pass one — sparse adoption, not broken code.

### 1.3 Supply-chain tier modules — CONFIRMED: none exist
Exhaustive search across `client/src/` and `server/` for every relevant term. Zero matches for all of: Inventory Optimization, Replenishment Planning, Raw Material Planning, Production Scheduling/RCCP, Supplier Collaboration, Executive Cockpit, Risk Management. **The platform today only covers S&OP Stages 1-2 (forecasting). Everything from Stage 3 onward must be built from scratch, including new database tables.**

### 1.4 Design system — partial
`globals.css` defines color tokens (`--navy-accent`, `--red`, `--bg`, `--text-1/2/3`, `--green`, `--amber`, `--danger`, shadows, radii) and imports DM Sans. Styling is 100% inline style objects — no CSS modules/Tailwind/styled-components. Colors are mostly used consistently. **Spacing and border-radius are NOT tokenized** — padding values and radii are hardcoded ad hoc per component, inconsistently. No shared layout primitives (`<Stack>`, `<Grid>`, etc.) exist — every page builds its own layout inline.

### 1.5 Data model — code vs. spec (critical gap, schema work needed before UI work)
| Spec entity | Actual state | Key discrepancies |
|---|---|---|
| Sku | `product_master` table | Missing `leadTimeDays`, `leadTimeVariabilityDays` (required for Safety Stock formula). PK is `sku` string, not numeric `id`. 10 SKUs, not 12. |
| Location/Branch | No table — hardcoded JS array in `dashboard.js`/`forecast.js` | 8 branches not 4; includes Bangalore/Hyderabad/Pune/Ahmedabad; uses "New Delhi" not "Delhi" |
| Supplier | Missing entirely | No table, no OTIF%, no lead times |
| BomLine | Missing entirely | No component-to-SKU mapping |
| ProductionLine | Missing entirely | No shifts/days-per-week/units-per-shift |
| ForecastRecord | `forecast_runs` table | Has `branch, sku, month, value, algorithm` but **missing the 5-tier waterfall fields** (`actual, baseline, trendOnly, enriched, operational, consensus`) — only one `value` column. **This means the spec's Workbench waterfall (Section 3.2) cannot be built without a schema migration.** |
| InventoryRecord | Missing entirely | No `onHandUnits`, `demandStdDevUnits`, `serviceLevelTargetPct` |
| RmInventoryRecord | Missing entirely | — |
| ProductionRecord | Missing entirely | — |

**Extra tables that exist but aren't in the spec (keep these — they're WhirlCast-specific and working):** `forecast_cycles`, `forecast_scenarios`, `branch_overrides`, `demand_sensing_log`, `exception_log`, `lfl_master`, `npi_forecasts`, `users`.

**Implication for the execution plan:** Phase 1 (design system) can proceed as planned. But Phase 3 module builds will each need a **schema migration sub-step first** — there is no supply-chain data to compute formulas against yet. Treat "add the needed tables/columns" as part of each module's Phase 3 task, not a separate hidden assumption.

---

## 2. Target State — Functional Specification (REVISED)

> **This section supersedes the original Section 2.3 module map.** The five separate supply-side modules (Inventory Optimization, Replenishment, Raw Material Planning, Production Scheduling, Supplier Collaboration) originally planned as distinct sidebar items are now consolidated into ONE unified Supply Planning Workbench, per `SUPPLY_PLANNING_SPEC.md`. This matches how Kinaxis/o9/SAP IBP actually structure Stage 3 of S&OP.

### 2.1 Revised build order
| Stage | Name | Status |
|---|---|---|
| 1-2 | Demand Planning | Mostly built (see Section 1) |
| 3 | **Supply Planning Workbench** | Next — see `SUPPLY_PLANNING_SPEC.md` |
| 4+ | Rebalance/Collaboration, Executive Review | Not yet specified — to be defined later |

### 2.2 Revised sidebar module map
The Phase 2 shell already reserved "Coming soon" placeholders for Inventory/Replenishment/Raw Material/Production/Supplier Collaboration under the "Plan" group. **These five placeholders are now consolidated into a single "Supply Planning" entry** in the "Plan" group, replacing the five separate placeholders. Supplier Collaboration's external-party-coordination angle may still warrant a thin separate view under "Collaborate" later — defer that decision until the core workbench exists.

### 2.3 Key build decisions already made (do not re-litigate without flagging to the user)
- **Time horizon:** Full 52 weeks, live and interactive (not a collapsed/summarized tail) — this is an explicit performance engineering requirement, not just a data question. Grid MUST use virtualization.
- **Constraint Solver / Recommendation Engine:** Simulated method (no real optimizer/solver library), but computed from real underlying numbers every time — must respond correctly to changes in input data, not return canned text. Same standard as the existing `computePhaseOut()` logic in NPI.
- **New database entities required:** Customer, Plant, ProductionLine, WorkCenter, Supplier, BomLine, Component, PlanningOrder, FirmProductionOrder, PurchaseOrder, TransferOrder, ScenarioSupplyPlan. None of these exist yet — full list and fields in `SUPPLY_PLANNING_SPEC.md` Section 2.
- **Reuse, don't rebuild:** ActionButton/simulatedAction (3-state pattern), Scenarios compare-2+ interaction model, Conflicts' before/after comparison chart pattern, existing design tokens — all from work already done in Phase 1/Demand Planning.

Full spec: see `SUPPLY_PLANNING_SPEC.md` in repo root.

## Addendum to Section 2 — Grid Simplification (post Step 3.6)

> Add this as a new subsection 2.4 in PROJECT_BRIEF.md, after the existing Section 2.3.

### 2.4 Current UI scope (simplified from original build)

Following hands-on demo prep, the Supply Planning Workbench was deliberately trimmed:

**Visible tabs (current):** Planning Grid · Constraints · Recommendations · Inbox
**Hidden but NOT deleted (code/data fully intact, can be re-enabled by removing from `HIDDEN_TABS` in `SupplyPlanning.jsx`):** Pegging, Scenarios

**Planning Grid measure tabs (current):** Supply, Constraints only (Demand tab removed from UI)
**Supply tab rows (current):** Demand, Inventory, Production, Gap (simplified from the original 6-field Beginning/Ending Inventory + Firm/Purchase/Transfer Orders view — those fields remain in the DB/API, just not shown as grid rows)

**Reasoning:** Reduces demo complexity for a non-expert audience. Scenario Simulation was deliberately kept out of THIS module's visible UI because Demand Planning already has its own Scenarios feature — showing two independent "Scenarios" concepts across two modules was judged confusing rather than impressive, pending the cross-module unification that Step 3.7 will inform.

### 2.5 CONFIRMED FINDING — Demand Planning and Supply Planning use independent demand numbers

This was explicitly investigated and confirmed (not assumed): Supply Planning's demand figures (`planning_orders.forecast_demand`, and the Total Demand KPI built from it) are generated by hardcoded seed constants in `server/db/seed_supply.js` (`FWD_BASE × BRANCH_FACTOR × SEASONAL × TREND`). This has **no connection** to Demand Planning's `forecast_records` table or any of its forecasting algorithms (SARIMAX, scenario finalization, branch overrides, etc.).

**Practical implication:** if Demand Planning's forecast changes, Supply Planning's demand numbers do NOT move. The two modules currently tell two independently-generated (but each internally consistent) stories that happen to coexist in the same app and database.

**This is the single most important open question for Step 3.7** (the cross-module consistency pass) to address. Step 3.7 should now explicitly decide: (a) is this disconnection acceptable to leave as-is for the current demo scope, given the UI no longer even shows a Demand tab in Supply Planning so the discrepancy is less visible, or (b) should Supply Planning's demand column be migrated to read from Demand Planning's finalized forecast as its actual input. Do not attempt the connection casually as a side effect of another task — this is a deliberate architectural decision requiring its own scoped session if pursued.

---

## 3. Hard constraints for Claude Code

1. **Audit before you build.** Every session that touches a new module area starts with reading the relevant existing code, not assuming based on this brief or the spec doc.
2. **Don't touch working formulas/calculations** unless the task explicitly says to change that formula. If you think a formula is wrong, flag it in your response — don't silently "fix" it.
3. **Don't redesign navigation and build features in the same task.** The shell/nav restructuring (2.4) is its own phase.
4. **Match the existing data model** (Section 2 of `IBP_SOP_SPEC.md`: Sku, Location, Supplier, BomLine, ProductionLine, ForecastRecord, InventoryRecord, RmInventoryRecord, ProductionRecord) when adding new entities — don't invent a parallel schema.
5. **Every new screen must visually match existing screens** — same component library, spacing, color system, typography as whatever WhirlCast already uses. If no formal design system exists yet, that's a task to do explicitly (see Phase 1 in the execution plan), not something to invent ad hoc per-module.
6. **Disclose assumptions in-UI**, per the honesty conventions (2.6). Don't hide synthetic data behind realistic-looking numbers without a methodology note.
7. **Fix bugs you encounter** that are clearly bugs (e.g. NaN/undefined renders) even if not explicitly in scope for that task — but call them out explicitly in your summary rather than burying the fix in unrelated changes.
8. **Ask before assuming** when a task is ambiguous about which existing module a new feature should live in or extend.

---

## 4. How to work session-to-session

- This brief + `IBP_SOP_SPEC.md` should be read at the start of each Claude Code session (point Claude Code at both files explicitly in your first message of a session).
- Work in the phased order in `EXECUTION_PLAN.md` — don't let Claude Code jump ahead to Phase 4 work while Phase 1 is incomplete.
- After each phase, update Section 1 of this brief with what's now actually true on disk (Claude Code should propose the diff; you confirm before it's saved).
