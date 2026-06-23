# Demand Planning Rebuild — Phase 0 Audit

Read DEMAND_PLANNING_SPEC.md and PROJECT_BRIEF.md before starting.

This is a READ-ONLY audit. Do not write, edit, or migrate anything yet. The goal is to confirm exactly what currently exists so the upcoming schema/build work is grounded in fact, not assumption — the same discipline used for Supply Planning's Phase 0 audit before Step 3.1.

Answer each question below with specifics (exact table/column names, exact file/line references) — not summaries.

---

## 1. `product_master` (or whatever the actual SKU table is called)

- List every existing column, with type.
- Is there room/sense in adding new columns here for ABC/XYZ classification (e.g. `abc_class`, `xyz_class`, `classification_updated_at`), or would these belong on a different/new table given the schema's current shape?
- Confirm: does this table currently use the SKU as a string primary key (as flagged in the original Phase 0 audit), and does that affect how a new classification column should be added?

## 2. Historical sales / actuals data

- What table currently holds historical actual sales data (used to populate "Actual Sales" in the existing Forecast Workbench, if applicable)?
- How many weeks/months of real history does it actually contain, per SKU-location? (Needed to know if CoV/variability calculations will be statistically meaningful or based on too little data.)
- Confirm the exact field names for SKU, location, time period, and the sales/quantity value.

## 3. `NPIForecasting.jsx`

- Confirm, with line numbers: where is the real `computePhaseOut()`/`computeRenovBlended()` logic for the "Renovation" path, and does it look genuinely reusable as-is, or does it depend on context/state specific to the old page that won't carry over cleanly?
- Confirm, with line numbers: where exactly is the hardcoded fake `RESULTS` object for "New Product Innovation," and what UI currently renders it (so we know exactly what needs to become a "Coming soon" state instead).

## 4. Existing Demand Planning API routes

- List the existing server routes that power Demand Planning's current pages (Dashboard, Workbench, Scenarios, Collaborate, Conflicts, Report) — just an inventory, file names and endpoint paths.
- Flag any of these that look reusable for the new workbench's Forecast Grid / Patterns / What-If / Exceptions tabs, versus ones that are tightly coupled to the old page structure and would need to be rebuilt rather than reused.

## 5. Cross-check against Supply Planning's existing catalog

- Confirm the exact 10 SKUs and 8 locations currently used in Supply Planning's schema (table/column names), so the new Demand Planning work can reuse the identical list rather than a re-typed or slightly different one.

---

Report back with a structured findings document (mirroring the style of the original Phase 0 audit in PROJECT_BRIEF.md Section 1) — current state confirmed, any gaps or risks flagged, and a clear statement of what schema changes will actually be needed once we move to the build phase. Do not propose code yet, just findings.
