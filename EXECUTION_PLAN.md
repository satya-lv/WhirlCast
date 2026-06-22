# Execution Plan — Run These Phases In Order

Each phase below is meant to be a **separate Claude Code session** (or at minimum a separate, clearly-bounded task within a session). Do not skip ahead. Each phase has a "Definition of Done" — don't move to the next phase until it's met.

Copy the prompt block for the phase you're on directly into Claude Code. Edit the `[bracketed]` parts based on what's actually true once you start (especially Phase 0's findings).

---

## Phase 0 — Repo Audit (run this first, always)

**Goal:** Know what's actually true on disk before any other phase. This output feeds directly into updating Section 1 of `PROJECT_BRIEF.md`.

**Claude Code prompt:**
```
Read PROJECT_BRIEF.md and IBP_SOP_SPEC.md fully before doing anything else.

Then audit this repository and report back (do not write any code yet):

1. Project structure: frameworks/libraries in use, folder layout, how routing works,
   where pages/modules live, where shared components live, where the data
   layer/formulas live.

2. For each module listed in PROJECT_BRIEF.md Section 1.1 (Dashboard, Workbench,
   Scenarios, Collaborate, Conflicts, Sensing, NPI, Report): confirm it exists,
   note the file(s) it lives in, and note its actual implementation quality
   (real formulas vs hardcoded vs partially stubbed).

3. For each module in PROJECT_BRIEF.md Section 2.3 marked "Verify state first"
   (Inventory Optimization, Replenishment Planning, Raw Material Planning,
   Production Scheduling/RCCP, Supplier Collaboration): does ANYTHING resembling
   this exist anywhere in the repo, even partially, even under a different name?
   Search thoroughly before concluding "does not exist."

4. Confirm or deny the two known bugs in PROJECT_BRIEF.md Section 1.2
   (NaN branches, undefined conflicts on Dashboard) and locate the exact
   file/line causing each.

5. Is there an existing design system (shared color tokens, spacing scale,
   component library, typography scale)? Or is styling done ad hoc per
   component? Be specific.

6. What does the data model actually look like in code right now vs. the
   target data model in IBP_SOP_SPEC.md Section 2? Note every discrepancy.

Output this as a structured report. Do not modify any files in this phase.
```

**Definition of done:** You have a written audit report. You update `PROJECT_BRIEF.md` Section 1 with the real findings (ask Claude Code to propose the exact diff to that section, then you approve it).

---

## Phase 1 — Design System Consolidation

**Goal:** One consistent visual language before any new module gets built, so Phase 2+ doesn't compound inconsistency.

**Precondition:** Phase 0 complete, Section 1 of brief updated.

**Claude Code prompt:**
```
Read PROJECT_BRIEF.md (updated) and IBP_SOP_SPEC.md, especially Section 7
(UI/UX Conventions).

Based on the Phase 0 audit, do ONE of the following depending on what we found:

- If no design system exists: extract the de facto visual language currently
  used across the existing modules (colors, spacing, typography, component
  patterns like cards/badges/buttons) and formalize it into a single source
  (e.g. a theme/tokens file + documented component variants). Do not invent
  a new aesthetic — codify what's already there, then fill gaps using
  IBP_SOP_SPEC.md Section 7 as the tie-breaker for anything undefined.

- If a partial design system exists: identify every inconsistency between
  modules (e.g. different badge styles, different spacing scales) and
  reconcile them into the single source, with the most-used pattern winning
  unless IBP_SOP_SPEC.md specifies otherwise.

Specifically formalize:
1. The KPI bar component (Section 7.2) — 10 KPIs, color-banded thresholds,
   must be reusable and driven by the formulas in Section 10, not hardcoded.
2. The Workbench pattern (Section 7.3) — filter bar + list/detail layout —
   as a reusable layout component, since it will be reused by Inventory,
   BOM, and RCCP workbenches later.
3. The 3-state action pattern (Section 7.4: idle → loading → done).
4. Badge/status color conventions (healthy/watch/critical, submitted/pending,
   etc.) — consolidate into one mapping used everywhere.

Do NOT restructure navigation yet (that's Phase 2). Do NOT build new modules
yet (that's Phase 3+). This phase is purely consolidation of what exists
into reusable, documented primitives.

Fix the two known Dashboard bugs (NaN branches, undefined conflicts) as part
of this pass since they're display/data-binding issues, not new scope.

When done, summarize exactly what was consolidated and flag anything you
think should be a design decision for me rather than something you decided
unilaterally.
```

**Definition of done:** Shared design tokens/components exist and are documented. Both known bugs are fixed. Existing modules still work exactly as before (visual polish only, no behavior change).

---

## Phase 2 — Navigation & Shell Restructuring

**Goal:** Move from WhirlCast's top-nav to the spec's KPI-bar + sidebar shell, without breaking any existing module.

**Precondition:** Phase 1 complete.

**Claude Code prompt:**
```
Read PROJECT_BRIEF.md and IBP_SOP_SPEC.md Section 7.1 (Global Layout) and 7.2
(KPI Bar).

Restructure the app shell to match the target layout:
- Fixed top KPI bar (10 KPIs from Section 7.2, using the reusable KPI
  component built in Phase 1), visible on every module.
- Left sidebar grouped by: Overview / Plan / Collaborate / Monitor / Decide,
  with the modules from PROJECT_BRIEF.md Section 2.3 nested under each group.
- Existing modules (Dashboard, Workbench, Scenarios, Collaborate, Conflicts,
  Sensing, NPI, Report) must be reachable from this new shell with NO loss
  of functionality. Map each old top-nav item to its new sidebar location
  explicitly and tell me the mapping you chose.
- Add placeholder/disabled sidebar entries for modules that don't exist yet
  (Inventory, Replenishment, Raw Material, Production Scheduling, Supplier
  Collaboration, S&OP Decision Review, Risk Management) so the full target
  IA is visible even before they're built — mark them clearly as "Coming soon"
  rather than broken links.

Do not build the logic for any new module in this phase — only the shell,
navigation, and placeholder states.

After this change, every existing module must still function identically
to before. Test/verify this explicitly and report what you checked.
```

**Definition of done:** New shell is live, all old functionality reachable and working, placeholders exist for future modules, nothing is broken.

---

## Phase 3 — Module-by-Module Build (repeat per module)

**Goal:** Build or complete one module at a time, in spec order, each as its own session.

**Suggested order** (adjust based on Phase 0 findings — if something is "partially built," prioritize completing it before starting net-new ones):
1. Inventory Optimization & Supply Planning (Spec Section 4)
2. Raw Material Planning (Spec Section 5)
3. Production Scheduling / RCCP (Spec Section 6)
4. Replenishment Planning (referenced in module map, formulas overlap with Inventory — confirm spec detail exists or needs defining together with you before building)
5. Supplier Collaboration (uses Supplier Risk Scoring from Section 5.3)
6. Risk Management (Spec Section 9.2) — depends on most other modules existing first, since its rules pull from each module's analytics
7. S&OP Decision Review (Spec Section 9.1) — **highest strategic priority**, but builds on scenario data from Demand Planning + outputs of Inventory/Production, so sequence it after at least Inventory and Production exist
8. Digital Twin (Spec Section 9.3) — visualization only, do last, lowest priority

**Generic Claude Code prompt template (fill in per module):**
```
Read PROJECT_BRIEF.md and IBP_SOP_SPEC.md Section [X] for [MODULE NAME].

Per the Phase 0 audit, this module currently [exists in full / exists
partially at FILE_PATH / does not exist].

[IF PARTIALLY EXISTS:]
Audit the current implementation against the spec's formulas in Section [X]
and Section 10. List every discrepancy between what's coded and what's
specified before changing anything. Then bring it into full compliance with
the spec, preserving any working parts that already match.

[IF NOT EXISTS:]
Build this module from scratch using:
- The exact formulas in Section [X] and cross-referenced in Section 10 —
  implement them precisely, do not approximate or simplify.
- The Workbench pattern component from Phase 1 if this module uses
  list+detail (per Section 7.3).
- The 3-state action pattern from Phase 1 for any simulated action
  (Section 7.4).
- The existing data model — extend it per Section 2 of the spec, matching
  existing entity shapes, not inventing a parallel schema.
- Honesty conventions (Section 7.5) — any synthetic/stated assumption must
  be disclosed in a Methodology panel in the UI.

This module must read from / write to the shared dataset consistently with
how other modules already do it — confirm how cross-module data access
currently works before adding a new pattern.

Wire it into the sidebar slot already reserved for it in the Phase 2 shell.

When done: summarize what you built, list any spec ambiguities you had to
make a judgment call on, and flag anything that needs my review before
being considered final.
```

**Definition of done (per module):** Module is live, formulas match spec exactly, visually consistent with Phase 1 system, reachable from Phase 2 shell, methodology/assumptions disclosed where relevant.

---

## Phase 4 — S&OP Decision Review (special handling)

This is explicitly called "the platform's climax" and "Highest Priority" in the spec (Section 9.1). Treat it with extra care:

**Claude Code prompt:**
```
Read PROJECT_BRIEF.md and IBP_SOP_SPEC.md Section 9.1 in full.

This module is the executive-facing climax of the platform — a Kinaxis
Maestro-style scenario comparison and approval screen. Before building,
confirm with me:
1. Where named scenarios (Base Plan, Demand Upside, Supply Risk, and any
   others) actually get their numbers from — which existing modules'
   outputs feed the comparison table (Revenue, Gross Margin %, Service
   Level, Inventory ₹Cr, Capacity overloads, Supplier at risk)?
2. Whether the three example scenarios in Section 9.1 are meant to be the
   only scenarios for the demo, or whether "+ Add scenario" needs to be
   functional (i.e., can a user construct an arbitrary new scenario, or
   just select from a preset library)?

Wait for my answer on these two before writing code, since this module's
data wiring touches nearly every other module.
```

**Definition of done:** Wait for explicit go-ahead from you on the two clarifying questions before this phase starts in earnest.

---

## Phase 5 — Cross-Cutting Polish Pass

**Goal:** Final consistency check across the whole platform once all modules exist.

**Claude Code prompt:**
```
Read PROJECT_BRIEF.md and IBP_SOP_SPEC.md in full.

Now that all modules exist, do a final cross-cutting consistency pass:
1. Verify every module uses the Phase 1 design system components — no
   one-off styling drift.
2. Verify the KPI bar formulas are live and consistent across every module
   (not frozen/stale on certain screens).
3. Verify the 3-state action pattern is used for every simulated action
   platform-wide — list any exceptions you find.
4. Verify the Honesty Conventions (Section 7.5) are present everywhere a
   stated assumption exists — list any module missing a Methodology panel
   where one is warranted.
5. Re-check the two original Dashboard bugs and confirm they're still fixed
   (regression check).
6. List any of the "Known Limitations & Open Items" from Section 11 that
   you addressed as a side effect of this work, and any that remain open.

Produce a final summary report. Do not make speculative changes in this
pass — only fix confirmed inconsistencies against the brief/spec.
```

**Definition of done:** Final report delivered, all checks pass or have explicit, justified exceptions.
