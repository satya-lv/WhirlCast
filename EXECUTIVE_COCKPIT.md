# Executive Cockpit — Replace "Coming Soon" with a Real Dashboard

Read PROJECT_BRIEF.md, DEMAND_PLANNING_SPEC.md, and SUPPLY_PLANNING_SPEC.md before starting. This replaces the current "Coming Soon" placeholder (shown when clicking Executive Cockpit on the persona landing menu) with a real page. Speed matters here - this is intentionally scoped small and reuses existing data/endpoints wherever possible, no new calculations.

## Source of inspiration

The user provided a reference HTML bundle (a different, more complete IBP platform mockup) showing an "Executive S&OP Cockpit" page. We reviewed its actual content and deliberately selected ONLY the pieces that genuinely map to real things we've already built - we are NOT cloning that page, NOT building anything fictional, and NOT including pieces that don't apply to us (e.g. its 5-step cycle tracker had 3 steps with no real destination - we use only 2).

## What to build (5 pieces, all using EXISTING data - no new backend calculations)

### 1. Simplified 2-step process tracker
A small horizontal tracker with exactly 2 steps: "Demand Planning" and "Supply Planning" - both clickable, navigating to those real modules (/demand-planning and /supply respectively). Visual style: simple, clean, similar spirit to the reference's step circles/connectors but only 2 real steps - no fake/unlinked steps, no fictional "stage 1 of 5" framing.

### 2. KPI tiles (6-8 tiles)
Reuse values directly from the EXISTING /api/demand-planning/kpis and /api/supply/kpis endpoints (already built and verified earlier today) - do not compute anything new. Suggested mix: Forecast Accuracy, Service Level, Revenue at Risk, Open Exceptions (from Demand Planning); Supply Gap, Capacity Utilization (from Supply Planning) - pick a representative ~6-8 tile set from these two endpoints' existing response fields.

### 3. Exception alerts list
Pull real data from Demand Planning's existing Exceptions data and Supply Planning's existing flagged constraint/recommendation issues - condense into a simple list (title + severity + brief detail), similar visual treatment to the reference (severity icon/badge, item count). This is a READ-ONLY summary view - no acknowledge/dismiss actions needed here, just surfacing what already exists elsewhere in the app.

### 4. Branch/location snapshot chart
A simple bar chart of units (use whatever real aggregate sales/demand figure is easily available per location) - reuse the existing Recharts pattern already used elsewhere in the app (e.g. Patterns tab's charts) for visual consistency.

### 5. Recommended actions list (condensed)
Pull real data from Supply Planning's EXISTING Recommendations endpoint (Add Overtime, Expedite Supplier, etc. - the same real recommendations already built and verified earlier today) and show a condensed list (3-5 items) - title + brief rationale, no Apply button needed on this summary view (that action lives in Supply Planning itself, this is just a glanceable summary).

## Explicitly NOT building
- The written narrative paragraph summary (reference had this, explicitly decided against it - plain KPI tiles only).
- A "Roles in this session" placeholder note - we already have a real, working persona system, no need for an apologetic note about a feature we've already shipped.
- Any of the 3 cycle-tracker steps that don't map to a real module.
- Any new backend calculation - every number on this page must trace back to an EXISTING endpoint already built today.

## Persona behavior
This page shows the FULL, unscoped picture regardless of which persona/role is logged in (Demand Planner, Branch Manager, Category Manager, or unscoped Supply Planning access) - it does not respect any persona's locked filters. This is intentional: an executive overview sits above any one role's narrow scope.

## Before writing code

Confirm which exact fields from the existing /api/demand-planning/kpis and /api/supply/kpis responses you're using for the KPI tiles, and confirm where the Exceptions and Recommendations data will be pulled from (reuse existing fetch logic/endpoints, don't duplicate it) - show me this mapping before building, briefly, since we're moving fast.

## Verification

Quick verification steps:
1. Clicking Executive Cockpit from the landing menu now shows this real page, not "Coming Soon."
2. KPI tiles show real, non-zero numbers matching what's shown in the actual Demand Planning / Supply Planning KPI bars.
3. The 2-step tracker correctly navigates to the real modules when clicked.
4. Exception alerts and Recommended actions show real, current data - not placeholders.
5. Confirm no regressions to anything else (this should be a new, additive page only).
