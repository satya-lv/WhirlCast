# Navigation Cleanup — Remove Stale KPI Strip, Module-Scoped Sidebar

Read PROJECT_BRIEF.md and PERSONA_LOGIN_NAVIGATION.md before starting. This is a UI cleanup task on top of the existing, working persona flow and both modules - no functional/data changes, purely navigation and dead-UI removal.

## Item 1 — Remove the old top KPI strip entirely

There is a leftover top bar (from the original Phase 2 shell restructuring, long before the current Demand/Supply Planning workbenches existed) showing placeholder KPIs with no real data: "Revenue at Risk", "Forecast Accuracy", "Inventory Turns", "Stockout Risk", "Forecast Bias", "Service Level", "Excess Inventory", "Supplier OTIF", "Inventory Value", "Prod. Adherence" - all rendering as "•  --" with no real values. This was superseded by the real, working KPI bars now built into both Demand Planning and Supply Planning workbenches.

Find this component (likely in the app shell/layout, rendered above or around the main content area) and remove it ENTIRELY - from every page it currently appears on, not just Demand Planning. Confirm you've found the actual component (show me the file) before removing it, and confirm no other part of the app depends on it remaining mounted (e.g. check it's not providing some context/state other code relies on - it almost certainly isn't, since it shows no real data, but verify rather than assume).

## Item 2 — Sidebar becomes module-scoped once inside a module

Currently, the left sidebar shows the OLD top-level app navigation (Dashboard, Demand Planning, Scenarios, Demand Sensing, NPI Forecasting, Supply Planning, Report, Admin Console) on every page, including when a user has already gone through the persona flow and landed inside a specific module. This is redundant - the user already chose their module via the persona flow.

**Change**: once a user is inside Demand Planning or Supply Planning (reached via the persona flow), the sidebar should show that MODULE'S OWN internal tabs instead of the old app-wide navigation:
- Demand Planning sidebar: Forecast Grid, Patterns, What-If, Exceptions, NPI Forecasting (the same 5 tabs already in the workbench's own tab bar - check whether this means the sidebar duplicates the existing in-page tab bar, or whether the in-page tab bar should be removed in favor of the sidebar now driving tab selection. Propose which approach makes more sense given the existing component structure, before building either way).
- Supply Planning sidebar: Planning Grid, Constraints, Recommendations, What-If (same consideration as above).

This ONLY applies to pages reached through the persona flow (i.e. when persona state is set). Confirm: does the Admin Console page (reached via the persona landing menu) still need the OLD-style navigation, or does it have its own separate layout already? Check before assuming.

Existing sidebar elements that should remain: the User/persona display ("Supply Planner" etc.), the action icons row, and the "Switch persona" link - these stay as they are, just the main navigation list above them changes to be module-scoped.

The cross-module floating CTA (already built) remains the only way to jump to the other module - no additional "back to landing" navigation is needed per this decision.

## Before writing code

Show me:
1. The actual file/component responsible for the old top KPI strip, before removing it.
2. Your proposed approach for whether the sidebar duplicates or replaces the existing in-page tab bars in both modules.

## Verification

Give me manual browser steps to verify:
1. The old blank KPI strip is gone from every page (Demand Planning, Supply Planning, Admin, and anywhere else it previously appeared).
2. Inside Demand Planning (any persona), the sidebar shows the 5 Demand Planning tabs, and clicking each correctly switches the visible tab content.
3. Inside Supply Planning (any persona), the sidebar shows the 4 Supply Planning tabs, and clicking each correctly switches content.
4. The cross-module CTA, logout/switch-persona, and all previously-verified persona scoping (locked filters, etc.) still work correctly - no regressions from this navigation change.
5. Confirm Admin Console (if reached via the persona landing menu) still works correctly.
