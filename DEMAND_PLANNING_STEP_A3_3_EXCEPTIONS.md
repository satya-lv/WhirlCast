# Demand Planning — Step A.3.3: Exceptions Tab

Read DEMAND_PLANNING_SPEC.md Section 5.4 in full before starting. Steps A.3.1 (shell + Forecast Grid) and A.3.2 (Patterns) are complete and verified - this step adds the third tab.

## What to build

Add "Exceptions" as the third working tab. Pull from the `/api/demand-planning/exceptions` endpoint (Step A.2).

Look at Supply Planning's Exception Inbox for the general interaction pattern (list of flagged issues, severity indicators, financial impact, recommendation text) - but this is demand-side data with different categories, so don't copy supply-side language/fields that don't apply. Specifically:

- The 4 categories from spec Section 5.4 (accuracy degradation, large unexplained planner override, demand pattern shift, new-product risk) should each be clearly labeled as to WHICH category they are - a planner should immediately understand why each exception fired, not just see a generic "issue" card.
- Severity (high/medium/low, per Step A.2's seeded data) should be visually distinct, same color-coding logic as Supply Planning uses elsewhere (statusConfig.js) for consistency.
- Financial impact should display in the same lakh/crore INR convention used throughout the rest of the app (check Supply Planning's existing number formatting utility if one exists, reuse it rather than reinventing).
- Each exception should link back to or reference the specific SKU-location it's about, consistent with how the rest of this workbench identifies rows.

## Acknowledge action

Step A.2 already built a `PATCH /exceptions/:id/acknowledge` endpoint. Wire this up: each exception card/row should have an action to acknowledge/dismiss it, which calls this endpoint and removes it from the open list (mirroring the pattern already established - e.g. how Supply Planning's recommendation cards disappear once applied). Confirm whether "acknowledge" should also decrement the "Open Exceptions" KPI on the top bar - it should, since that KPI is explicitly meant to reflect what currently needs attention.

## Before writing code

Tell me what severity color convention you're reusing and from where, and confirm the financial impact number formatting matches the rest of the app.

## Verification

Give me specific manual browser steps to verify:
1. All open exceptions render, grouped or sorted by severity (high first), each clearly labeled with its category.
2. Financial impact figures display in the correct format/convention.
3. Acknowledging an exception removes it from the list AND decrements the "Open Exceptions" KPI on the top bar.
4. Switching tabs preserves state correctly (same display:none pattern as before) - acknowledging an exception, switching to Forecast Grid, then back to Exceptions should NOT bring the acknowledged exception back.

Confirm no Supply Planning file was touched.
