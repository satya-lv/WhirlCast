# Demand Planning — Enhancement: "Apply Scenario" on What-If Tab

Step A.3.4 (What-If tab) is built and verified as a read-only simulation sandbox. This adds a real write action: applying the simulated scenario into actual Planner Adjustment data, using the SAME PATCH mechanism the Forecast Grid already uses (per Step A.3.1) - this is wiring an existing, already-verified write pathway into a new UI flow, not building new write logic from scratch.

## What to build

### 1. Week range selector
Before applying, the planner should be able to select WHICH of the 26 forward/editable weeks (27-52) to apply the scenario to - not forced to apply to all 26 at once. A simple UI for this (e.g. a week-range slider/picker, or checkboxes for a few common presets like "Next 4 weeks" / "Next 13 weeks" / "All remaining weeks" plus a custom range option) - your call on exact UI, but it must let the planner choose a subset, not just all-or-nothing.

### 2. "Apply Scenario" button
Visible only when a real scenario is active (i.e. not in the "No scenario applied" state - per Step A.3.4's existing logic). Clicking it opens the week range selector (if not already chosen) and a confirmation step.

### 3. Confirmation step
Before actually writing anything, show a clear confirmation: which SKU-location, which weeks, and what will change (e.g. "This will set Planner Adjustment for AC_1.5T_Inverter, Mumbai, weeks 27-39 based on a +17% volume scenario. This will OVERWRITE any existing Planner Adjustment values in those weeks. Continue?"). This matters because applying overwrites whatever Planner Adjustment values already exist for the selected weeks/SKU/location, including manual edits a planner may have made directly in the Forecast Grid.

### 4. On confirm
For each selected week, compute the new Planner Adjustment value needed so that Final Consensus matches the scenario's calculated volume for that week (i.e. new_planner_adjustment = scenario_volume_for_week - system_forecast_for_week), then call the existing grid PATCH endpoint for each affected week (reuse, don't reinvent). After applying, show a success confirmation and consider whether the Forecast Grid (if the planner switches back to that tab) should reflect the change immediately or on next load - confirm and state which behavior you implemented.

### 5. All-or-nothing failure handling (REQUIRED)
If any of the sequential PATCH calls fails partway through applying a multi-week scenario, the result must NOT be a partially-applied, inconsistent forecast (e.g. weeks 27-31 showing new scenario numbers while weeks 32-39 still show old values) - this would look broken/inconsistent in a demo with no good explanation. On any failure:
- Stop immediately, do not continue applying remaining weeks.
- Roll back any weeks that were already successfully updated in this same apply operation, restoring their previous Planner Adjustment values (you'll need to capture the "before" values for all selected weeks before starting the write sequence, specifically so a rollback is possible).
- Show a clear error message to the planner (e.g. "Apply failed at week 32 - no changes were saved. Please try again.") rather than leaving them unsure what state the data is in.
- Confirm this rollback approach explicitly in your pre-build proposal - capturing "before" state for every selected week before writing anything is a real implementation requirement, not optional.

## Before writing code

Confirm your exact UI approach for the week range selector and the confirmation dialog copy before building - same review-before-build pattern as the rest of this project.

## Verification

Give me manual browser steps to verify:
1. With a scenario active, the Apply Scenario button appears; with no scenario applied, it does not.
2. Selecting a partial week range (e.g. weeks 27-35 only) and applying only changes those weeks - weeks 36-52 keep their PREVIOUS Planner Adjustment values, unchanged.
3. The confirmation dialog clearly states what will be overwritten before anything is written.
4. After confirming, switch to the Forecast Grid tab and confirm the affected weeks now show the new Planner Adjustment and Final Consensus values matching the scenario.
5. The top-bar KPIs (e.g. Open Planner Adjustments count) update correctly after applying.
6. (If feasible to simulate) confirm that if a failure occurred partway through a multi-week apply, no partial/inconsistent state is left behind - either describe how you tested this (e.g. temporarily forcing a failure) or explain clearly why this particular case couldn't be directly tested, without skipping the question.

Confirm no Supply Planning file was touched.
