## Step 3.7 — Full Verification Pass + Cross-Module Consistency Check (EXPANDED)

> This replaces the original, shorter Step 3.7 in SUPPLY_PLANNING_BUILD_PLAN.md.
> Supply Planning is now functionally complete (Steps 3.1-3.6 done and verified).
> This step does two things: confirms Supply Planning itself is solid end to
> end, AND deliberately checks whether Demand Planning and Supply Planning
> feel like ONE coherent product built by one team telling one story - not
> two modules bolted together at different times with different visual eras
> and disconnected numbers.

**Claude Code prompt:**
```
Read PROJECT_BRIEF.md, SUPPLY_PLANNING_SPEC.md, and IBP_SOP_SPEC.md in full.

PART A - Supply Planning internal verification
1. Confirm every sub-section of SUPPLY_PLANNING_SPEC.md Section 3 is built
   and functioning (Planning Grid, Constraints, Pegging, Recommendations,
   Inbox, Scenario Simulation).
2. Confirm the grid still performs well with full data after all the
   additional views were layered on top of it across Steps 3.4-3.6.
3. Confirm Demand Planning's existing routes/pages are completely
   unaffected by everything built in Phase 3 - re-test them directly.
4. List anything from SUPPLY_PLANNING_SPEC.md you had to interpret or
   simplify along the way, and flag it for review.

PART B - Visual consistency between Demand Planning and Supply Planning
1. Demand Planning's pages (Dashboard, Workbench, Scenarios, Collaborate,
   Conflicts, Sensing, NPI, Report) were last touched in Phase 1
   (design token consolidation) but never rebuilt against the new shared
   components the way Supply Planning was built from scratch. Go through
   each Demand Planning page and Supply Planning page side by side and
   report every visible inconsistency you find in:
   - Card/panel styling (padding, radius, shadow, border)
   - Color usage (are status colors, badges, KPI color-bands the same
     logic in both modules, or do they diverge?)
   - Typography (heading sizes, label styles, font weights)
   - Spacing (does Supply Planning use the Phase 1 spacing tokens
     consistently while Demand Planning still has some of the ad hoc
     padding values noted in the original Phase 0 audit?)
   - Button/action styling (does Supply Planning's ActionButton 3-state
     pattern look and feel identical to any equivalent action UI in
     Demand Planning, e.g. Scenarios' "Finalize & Push to Branches"?)
2. Do NOT silently fix these yet - first produce a full list of every
   inconsistency found, with file/line references, so I can decide which
   ones are worth fixing and which are acceptable as-is.

PART C - Data/story consistency between Demand Planning and Supply Planning
1. Demand Planning produces forecasts (e.g. via Workbench, Scenarios).
   Supply Planning consumes "Total Demand" as an input (e.g. the 1,98,507
   units KPI). Trace whether these numbers actually connect:
   - Does Supply Planning's demand figures for a given SKU/branch/week
     actually derive from a finalized Demand Planning scenario, or is it
     an independently-seeded number that happens to coexist in the same
     database?
   - If they're disconnected: explain exactly how, and propose what it
     would take to genuinely connect them (Demand Planning's finalized
     forecast becoming Supply Planning's demand input) versus what's
     acceptable to leave disconnected for a demo, with your reasoning.
2. Check whether the SKUs, branches/locations, and date ranges referenced
   in Demand Planning match the ones in Supply Planning exactly (e.g. does
   Demand Planning's branch list match Supply Planning's location list?
   Per the original Phase 0 audit, Demand Planning has 8 branches with
   specific city names - confirm Supply Planning's locations table uses
   the SAME branches, not a different/overlapping set).
3. Report whether walking through Demand Planning then Supply Planning in
   sequence (as a demo presenter would) tells ONE coherent story about
   Whirlpool India's planning cycle, or whether it would feel to an
   audience like two disconnected datasets. Be honest and specific - this
   is the single most important finding from this entire step.

Produce a structured report covering Parts A, B, and C separately. Do not
make any fixes yet - this is a diagnostic pass. We will decide together
what to act on before any changes are made.
```

**What to do with the report:** Once Claude Code reports back, review Part C first - the story-coherence finding matters most for a client-facing demo. Then decide together which Part B visual inconsistencies are worth a follow-up fix versus acceptable as-is, given time/effort tradeoffs. Only after that discussion should any actual code changes be made - treat this step as diagnosis, with a separate follow-up step for any agreed fixes.
