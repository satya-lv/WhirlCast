| **WHIRLPOOL INDIA** **IBP / S****&****OP Platform** Functional Specification & Wireframe Guide |
| --- |

# 1. System Overview & Architecture

## 1.1 What This Is

This is not a reporting dashboard. It is an active planning workbench: every number in every module is computed from formulas, not hardcoded. A planner can change an assumption and see downstream impact immediately. The platform runs the full S&OP cycle from statistical forecast through executive sign-off.

## 1.2 S&OP Cycle Stages

The platform maps directly to the five-stage S&OP cycle. The cycle tracker in the UI shows the current stage and navigates to the relevant module on click.

| **Stage** | **Name** | **Module(s)** | **Owner** |
| --- | --- | --- | --- |
| 1 | Initialize Cycle | Executive Cockpit (cycle launch) | S&OP Lead |
| 2 | Consensus Demand Planning | Demand Planning | Demand Planner / Commercial |
| 3 | Aggregate Supply & Capacity Planning | Inventory · Replenishment · Raw Material · Production Scheduling | Supply Planner / Ops |
| 4 | Rebalance & Scenario Collaboration | Supplier Collaboration · Risk Management | Procurement / Finance |
| 5 | Executive Review & Approval | S&OP Decision Review | S&OP Head / Leadership |

## 1.3 Module Map

| **Group** | **Module** | **Status** | **Key Output** |
| --- | --- | --- | --- |
| Overview | Executive Cockpit | Live | KPI bar, alerts, AI actions, S&OP cycle tracker |
| Plan | Demand Planning | Live | 6-model statistical forecast, multi-stakeholder workbench, what-if |
| Plan | Inventory Optimization | Live | Safety stock (LRTV-driven), EOQ, ROP, supply-demand match, transfers |
| Plan | Replenishment Planning | Live | ROP-triggered FG replenishment queue, PO creation |
| Plan | Raw Material Planning | Live | BOM explosion, RM supply-demand netting, supplier risk |
| Plan | Production Scheduling | Live | RCCP: required vs available capacity per line per month, overload resolution |
| Collaborate | Supplier Collaboration | Live | OTIF scorecard, forecast sharing, capacity commitment requests |
| Decide | S&OP Decision Review | Upcoming | Named scenario comparison, financial impact, executive approval |
| Monitor | Risk Management | Upcoming | Rule-based exception detection, financial exposure, escalation |

# 2. Data Model & Key Entities

All data is synthetic but computed from real domain formulas. There is no mock static state — every KPI, every chart, every table derives from the dataset through the same formulas a production system would use.

## 2.1 Master Data

| **Entity** | **Key Fields** | **Count** | **Notes** |
| --- | --- | --- | --- |
| Sku | id, name, category, segment (Mass/Premium), price, leadTimeDays, leadTimeVariabilityDays | 12 | REF/WM/AC/MW categories |
| Location (Branch) | id, name | 4 | Delhi, Mumbai, Chennai, Kolkata |
| Supplier | id, name, component, leadTimeDays, historicalOtifPct | 5 | One supplier per component type |
| BomLine | skuId, supplierId, componentName, qtyPerUnit | ~48 | Category-conditional: AC→Compressor, WM→Motor, etc. |
| ProductionLine | id, name, category, shiftsPerDay, daysPerWeek, unitsPerShift | 4 | One per product category |

## 2.2 Transactional Data

| **Entity** | **Key Fields** | **Grain** | **Notes** |
| --- | --- | --- | --- |
| ForecastRecord | skuId, region, monthIndex, actual, baseline, trendOnly, enriched, operational, consensus | SKU × Branch × Month | 24 months history + 4 forward |
| InventoryRecord | skuId, region, onHandUnits, demandStdDevUnits, serviceLevelTargetPct | SKU × Branch | serviceLevelTargetPct is now LRTV-driven, not hardcoded |
| RmInventoryRecord | componentName, supplierId, onHandUnits, avgMonthlyConsumption | Component | Synthetic — real RM feed does not exist in this dataset |
| ProductionRecord | skuId, monthLabel, plannedUnits, actualUnits | SKU × Month (national) | Historical only |

## 2.3 Classification System

Two intersecting classification axes drive planning policy throughout the platform:

ABC (revenue Pareto): A = top 70% cumulative revenue, B = next 20%, C = bottom 10%

XYZ (demand variability): X = CoV ≤ 25%, Y = CoV ≤ 50%, Z = CoV > 50%

LRTV (planning tier): Leader = A non-Volatile, Rider = B non-Volatile, Tail = C non-Volatile, Volatile = any Z-class item

LRTV drives actual service-level policy — it is not decorative:

| Leader  → 98% service level target (AX/AY items) |
| --- |
| Rider   → 95% service level target (BX/BY items) |
| Tail    → 90% service level target (CX/CY items) |
| Volatile→ 95% service level target, but σ_D is high so SS is large regardless |

| **MODULE: DEMAND PLANNING** |
| --- |

# 3. Demand Planning

The demand planning module runs a fully APS-grade multi-stakeholder workbench. It is not just a chart — it is the central collaboration space where statistical forecasts are enriched by sales, marketing, and planner judgment, with full audit trail, a separate Save Draft / Submit workflow, and model-level transparency.

## 3.1 Forecast Build-up Architecture

The forecast flows through five tiers. Each tier is stored separately in the dataset so the waterfall decomposition is exact, not approximated:

| **Tier** | **Field** | **What it represents** |
| --- | --- | --- |
| Baseline (Statistical) | baseline | Auto-selected statistical model forecast. No human input. |
| Trend Adjustment | trendOnly | Baseline + Sales intelligence (trend and market signals). |
| Marketing / Promo Enriched | enriched | trendOnly × promo multiplier (1.3x for Oct/Nov festive calendar). |
| Operational | operational | enriched after operational constraint (supply cap, MOQ, etc.). |
| Consensus | consensus | Final number after Planner Adjustment. This is what flows to supply planning. |

## 3.2 Workbench Row Logic

| **[ FORECAST GRID — Workbench (SKU-Location × Month) ]** |
| --- |
| Row 1: Actual Sales          [read-only, historical months only] |
| Row 2: System Forecast       [baseline from auto-selected model, read-only] |
| Row 3: Sales Adjustment      [trendOnly - baseline, read-only — annotated delta] |
| Row 4: Marketing Adjustment  [enriched - trendOnly, read-only — promo/event impact] |
| Row 5: Planner Adjustment    [EDITABLE: forward months only — planner enters absolute delta] |
| Row 6: Final Consensus       [baseline + sales + marketing + planner — recomputes live] |
|  |
| Pending edits shown in amber (●), submitted edits shown in green (✓) |
| Action bar: [Save Draft] — non-committing   [Submit Forecast (N)] — advances Approval Stage |

*Design decision: rows display as absolute numbers (not deltas) for system-computed rows. The delta annotation is secondary. This matches how real stakeholders think: Sales says "600," not "+31." Currently implemented as deltas — this is a known open item for the next iteration.*

## 3.3 Statistical Model Library

The system runs a rolling backtest across 6 models and auto-selects the lowest-MAPE model per SKU-branch. The planner can override and switch models; Recalculate commits new parameter settings but does NOT reset the model choice.

| **Model** | **Tunable Parameters** | **Best for** |
| --- | --- | --- |
| Seasonal Naive | None | Strong seasonal SKUs (e.g. AC). Most common winner. |
| Naive (Last Value) | None | Very stable, non-seasonal items. Low MAPE on flat demand. |
| 3-Month Moving Average | Window (2–6 months) | Stable demand, ignores noise. Appropriate when CoV is low. |
| Simple Exp. Smoothing | Alpha (0.05–0.95) | Stable with recent level change. More responsive than MA. |
| Holt-Winters (additive) | Alpha, Beta, Gamma | Trend + seasonal. Good for REF/WM with mild seasonal pattern. |
| Linear Regression | None | Strong trend, little seasonality. Wins on growing items. |

| // Auto-selection logic (run on first load, per SKU × Branch) |
| --- |
| for each model in [Seasonal Naive, Naive, MA, SES, HW, LR]: |
| mape[model] = rollingBacktestMAPE(model, skuId, region) |
| recommendedModel = argmin(mape) |
|  |
| // Recalculate: commits params, does NOT change model selection |
| handleRecalculate() → setAppliedParams(draftParams) |
|  |
| // Reset to recommended: resets both model AND params |
| handleResetToRecommended() → delete modelOverrides[activeKey]; setAppliedParams(DEFAULT_PARAMS) |
|  |
| // Forward projection: uses SELECTED model, applied params |
| // History: never restated regardless of model choice |

## 3.4 Approval Workflow

Save Draft and Submit Forecast are separate, intentional actions. This distinction matters in multi-stakeholder S&OP: a planner should be able to save work-in-progress without accidentally triggering a submission that advances the cycle.

| **Action** | **Effect** | **Does it advance the Approval Stage?** |
| --- | --- | --- |
| Save Draft | Persists planner adjustments in local state. Timestamps the save. | No |
| Submit Forecast (N) | Marks N adjustments as "submitted." Logs to submission log. Advances Approval Stage from Draft → Submitted. | Yes — Draft → Submitted only |
| Advance to Under Review → | Manual action on the Overview tab Approval Status card. Moves Submitted → Under Review. | Yes |
| Approved | Final stage. Set manually in the Overview card. Locks the cycle. | Yes |

## 3.5 What-If Simulation

| // Demand what-if: causal model |
| --- |
| promoLiftFactor = 1 + (promoDiscountPct / REFERENCE_PROMO_DISCOUNT_PCT) × REFERENCE_PROMO_LIFT × marketingSpendMultiplier |
| priceLiftFactor  = 1 + (priceChangePct / 100) × PRICE_ELASTICITY |
| // PRICE_ELASTICITY = -2.0 (cited range for durable appliances: -1.5 to -2.5) |
| scenarioUnits    = baselineUnits × promoLiftFactor × priceLiftFactor |
| scenarioRevenue  = scenarioUnits × (price × (1 + priceChangePct/100)) |
|  |
| // Assumptions stated in UI, not hidden in code |
| // REFERENCE_PROMO_LIFT = 0.30 (matches dataset festive promo calibration) |
| // REFERENCE_PROMO_DISCOUNT_PCT = 10 |

| **MODULE: INVENTORY OPTIMIZATION ****&**** SUPPLY PLANNING** |
| --- |

# 4. Inventory Optimization & Supply Planning

## 4.1 Safety Stock Formula

This is the textbook combined-variability safety stock formula — both demand variability and lead-time variability contribute to the buffer. Using only σ_D (demand standard deviation) and ignoring σ_LT (lead-time variability) is a common and costly oversimplification.

| // Safety Stock (Hadley-Whitin combined formula) |
| --- |
| SS = Z × √(LT × σ_D² + D̄² × σ_LT²) |
|  |
| Z    = inverseNormalCDF(serviceLevelTargetPct)   // Acklam rational approximation |
| LT   = leadTimeDays / 30                         // in months |
| σ_D  = demandStdDevUnits (deseasonalized)        // from InventoryRecord |
| D̄    = avgMonthlyDemand (6-month lookback) |
| σ_LT = leadTimeVariabilityDays / 30 |
|  |
| // LRTV drives serviceLevelTargetPct: |
| Leader:   98%  (Z = 2.054) |
| Rider:    95%  (Z = 1.645) |
| Tail:     90%  (Z = 1.282) |
| Volatile: 95%  (Z = 1.645, but σ_D is already large, so SS is still high) |

## 4.2 EOQ Formula

| // Economic Order Quantity |
| --- |
| EOQ = √(2 × D_annual × S / H) |
|  |
| D_annual = avgMonthlyDemand × 12 |
| S        = 12,000 INR (stated PO ordering cost assumption) |
| H        = sku.price × 0.20 (stated 20% annual holding cost rate) |

## 4.3 Reorder Point

| // Continuous-review ROP |
| --- |
| ROP = (avgMonthlyDemand / 30) × leadTimeDays + SS |
|  |
| // Status thresholds: |
| below-rop:  onHand < ROP |
| watch:      onHand < ROP × 1.4  (40% band — "plan ahead" signal) |
| excess:     daysOfCover > 90 |
| healthy:    otherwise |

## 4.4 Time-Phased Supply-Demand Match

This is the core supply planning view — not a snapshot, but a rolling simulation of whether demand will actually be covered month by month. It answers the question that reorder-point-alone cannot: "will I still be covered when the October promo spike arrives?"

| // Order-up-to-S periodic review (simulation runs monthly) |
| --- |
| // Policy: forecast-aware (orders sized against forward consensus, not trailing average) |
|  |
| targetLevel = protectedDemand + protectedSafetyStock |
| // protectedDemand = avg(consensus[m+1..m+protectionWindow]) × protectionMonths |
| // protectionMonths = reviewPeriodMonths + leadTimeMonths |
| // protectedSafetyStock = Z × σ_D × √protectionMonths |
|  |
| for each month m in forecastWindow: |
| supplyIn   = arrivals due in month m |
| ending     = beginning + supplyIn − demand[m] |
| isShort    = ending < 0 |
| position   = ending + inPipeline |
| if position < targetLevel: |
| raise order(qty = targetLevel − position, arrives = m + leadTimeMonths) |
| beginning = max(0, ending) |
|  |
| // The toggle between forecast-aware and naive is the demo story: |
| // Naive uses trailing avgMonthlyDemand — 5 of 48 combos go short in Oct |
| // Forecast-aware uses forward consensus — 0 gaps, promo is anticipated |

## 4.5 Network Transfer Recommendations

| // Identifies branches with a meaningful days-of-cover imbalance for the same SKU |
| --- |
| spread = max(daysOfCover across branches) - min(daysOfCover across branches) |
| if spread >= TRANSFER_SPREAD_THRESHOLD (30 days): |
| targetDoc  = avg(daysOfCover across branches) |
| excessAtSource = max(0, source.onHand - targetDoc × sourceDailyDemand) |
| needAtDest     = max(0, targetDoc × destDailyDemand - dest.onHand) |
| transferQty    = min(excessAtSource, needAtDest) |

| **MODULE: RAW MATERIAL PLANNING** |
| --- |

# 5. Raw Material Planning

## 5.1 BOM Explosion

| // Gross requirement for one component in one month |
| --- |
| grossRequirement(component, monthIndex) = |
| Σ over all SKUs that use this component: |
| ( Σ consensus_forecast[sku, branch, monthIndex] ) × qtyPerUnit[sku, component] |
|  |
| // This is real MRP explosion: FG forecast → component requirement |
| // Nothing is scaled or approximated |

## 5.2 RM Coverage Status

| // Days of cover check against supplier lead time |
| --- |
| daysOfCover = onHandUnits / (avgMonthlyConsumption / 30) |
|  |
| critical: daysOfCover < leadTimeDays         // can't even bridge the lead time — production will stop |
| watch:    daysOfCover < leadTimeDays × 1.5   // thin margin |
| healthy:  otherwise |

## 5.3 Supplier Risk Scoring

| // Blended risk score (0-100) |
| --- |
| reliabilityRisk = 1 - historicalOtifPct |
| leadTimeRisk    = supplierLeadTimeDays / max(all supplier lead times) |
| riskScore       = round((reliabilityRisk × 0.60 + leadTimeRisk × 0.40) × 100) |
|  |
| // Exposed revenue = annualised last-12-month sales × sku.price |
| //                  for all SKUs whose BOM includes this supplier's component |

| **MODULE: PRODUCTION SCHEDULING / RCCP** |
| --- |

# 6. Production Scheduling (RCCP)

This module implements Rough-Cut Capacity Planning: an aggregate monthly check of whether available production capacity covers the required build plan (= consensus FG forecast). This is not finite scheduling — it does not sequence individual jobs on the line. Finite scheduling requires real shop-floor data and a more granular time-base (day or shift, not month).

## 6.1 Capacity Computation

| // Monthly capacity (stated assumptions) |
| --- |
| monthlyCapacity(line)      = shiftsPerDay × daysPerWeek × (365/12/7) × unitsPerShift |
| monthlyShiftCapacity(line) = shiftsPerDay × daysPerWeek × (365/12/7) |
|  |
| // Required production (real data) |
| required(line, month) = Σ consensus_forecast[skuId ∈ line.category, all branches, month] |
|  |
| // Utilization |
| utilizationPct = round(required / monthlyCapacity × 100) |
| overload       = required > monthlyCapacity |
|  |
| // Overload resolution |
| extraShiftsNeeded = ceil((required - monthlyCapacity) / unitsPerShift) |

## 6.2 Heatmap Color Logic

| **Color** | **Threshold** | **Meaning** |
| --- | --- | --- |
| Green | Utilization < 90% | Comfortable headroom. No action needed. |
| Amber | 90% ≤ Utilization ≤ 100% | Near capacity. Watch closely; no current overload. |
| Red | Utilization > 100% | Overloaded. Required exceeds available. Action needed. |

*Calibration note: production line capacities are stated assumptions, not fitted to real Whirlpool India line-rate data. They are deliberately calibrated so each line shows exactly one genuine overload month — AC overloads in July (peak summer), the other three overload in October (festive promo). This reflects a real, interesting operational story rather than uniform health or uniform crisis.*

| **UI / UX DESIGN PATTERNS** |
| --- |

# 7. UI/UX Conventions & Design Decisions

## 7.1 Global Layout

| **[ APP SHELL — full viewport ]** |
| --- |
| ┌──────────────────────────────────────────────────────────────┐ |
| │  [KPI BAR — 10 live KPIs, color-coded status bands]         │  fixed top, 2 rows |
| ├──────────────────────────────────────────────────────────────┤ |
| │ SIDEBAR  │  MODULE CONTENT AREA                             │ |
| │          │                                                  │ |
| │ Overview │  [Module tabs at top]                            │ |
| │ ──────── │                                                  │ |
| │ Plan     │  [Primary content — charts, tables, workbench]   │ |
| │   Demand │                                                  │ |
| │   Inven  │                                                  │ |
| │   Replen │                                                  │ |
| │   RawMat │                                                  │ |
| │   Prod   │                                                  │ |
| │ ──────── │                                                  │ |
| │ Collab   │                                                  │ |
| │   Suppl  │                                                  │ |
| │ ──────── │                                                  │ |
| │ Monitor  │                                                  │ |
| │   Risk   │                                                  │ |
| │ ──────── │                                                  │ |
| │ Decide   │                                                  │ |
| │   S&OP   │                                                  │ |
| └──────────┴──────────────────────────────────────────────────┘ |

## 7.2 KPI Bar

The KPI bar is always visible regardless of which module is active. Every KPI is computed from real data with a stated formula. Color bands are parameterized, not arbitrary:

| **KPI** | **Formula / Source** | **Good (green)** | **Warning (amber)** | **Critical (red)** |
| --- | --- | --- | --- | --- |
| Revenue at Risk | Σ(stockout-risk SKUs × avg monthly revenue) | — | — | Any value |
| Forecast Accuracy | 1 - MAPE (consensus tier, 6-month rolling) | > 85% | 75-85% | < 75% |
| Forecast Bias | mean((Ŷ - Y) / Y) × 100 | │bias│ < 5% | 5-12% | > 12% |
| Service Level | % SKU-branches above safety stock buffer | > 90% | 80-90% | < 80% |
| Inventory Value | Σ(onHand × price) | Neutral | Neutral | Neutral |
| Inventory Turns | (annual COGS) / (avg inventory value) | > 7x | 4-7x | < 4x |
| Stockout Risk | Count of SKU-branches where onHand < ROP | 0 | 1-3 | > 3 |
| Excess Inventory | Σ(onHand > 2.8 months demand × price) | Low | Medium | High |
| Supplier OTIF | weighted avg historicalOtifPct | > 95% | 90-95% | < 90% |
| Production Adherence | actual/planned (current month) | > 95% | 85-95% | < 85% |

## 7.3 Workbench Pattern (List + Detail)

Used in: Forecast Grid, Inventory Workbench, BOM Workbench, RCCP Workbench. The pattern is consistent throughout:

| **[ WORKBENCH PATTERN ]** |
| --- |
| ┌─── Filter bar ─────────────────────────────────────────────────┐ |
| │ [Branch ▼] [Category ▼] [Price Tier ▼] [ABC-XYZ ▼] [Search…] │ |
| └────────────────────────────────────────────────────────────────┘ |
|  |
| ┌─── SKU List (240-320px) ──┬─── Detail Panel (remaining) ──────┐ |
| │ N SKU-locations            │ [SKU name — Breadcrumb]           │ |
| │                            │ [status badge] [classification]   │ |
| │ > SKU Name  AX  Healthy    │                                   │ |
| │   Delhi                    │ [4-col KPI strip]                 │ |
| │                            │                                   │ |
| │   SKU Name  BX  Watch      │ [Primary chart / table]           │ |
| │   Mumbai                   │                                   │ |
| │                            │ [Action bar / interactive panel]  │ |
| │   ...                      │                                   │ |
| └────────────────────────────┴───────────────────────────────────┘ |

## 7.4 Action Patterns

Every simulated action uses a consistent 3-state pattern: idle → [loading 700ms] → done (visual confirmation). No action immediately commits — there is always a visual pause that gives the user confidence something happened.

| **Action** | **Pre-state button** | **In-flight state** | **Done state** |
| --- | --- | --- | --- |
| Submit Forecast | Submit Forecast (N) | Submitting… | Cells turn green ✓, log entry appears |
| Save Draft | Save Draft | Saving… | Timestamp shown next to "draft saved" |
| Create PO | Create PO | Creating… | PO Created ✓, log entry appears |
| Trigger Transfer | Trigger Transfer | Triggering… | Transfer Triggered ✓ (green) |
| Trigger Replenishment | Trigger Replenishment | Triggering… | Triggered ✓ |
| Share Forecast | Share Forecast | Sharing… | Forecast Shared ✓ |
| Request Capacity Commitment | Request Capacity for [Month] | Sending… | CAP-XXXXX log entry |
| Add Overtime Shifts | Add N Overtime Shifts | Adding… | Shift detail line shows "covered" green |

## 7.5 Honesty Conventions

Every module that involves a stated assumption rather than real data says so explicitly in its Methodology panel. The UI actively surfaces its own limitations. This is a deliberate design choice: it builds trust with technically sophisticated buyers (Whirlpool India procurement/planning team) who will probe the data.

- RM on-hand is a stated synthetic assumption — the Methodology panel says so.

- "Submit to SAP" is NOT in the UI — only Submit Forecast (internal workflow) and a note that ERP sync happens separately after approval.

- Trigger actions are labeled "simulated" in their log captions.

- Production Scheduling Methodology explicitly says this is rough-cut, not finite scheduling.

- Supply-Demand Match policy toggle is labeled "Naive (trailing avg)" vs "Forecast-aware" — names that carry the implicit argument.

# 8. Filters, Hierarchy & Navigation

## 8.1 Location Hierarchy

Country (India) → Branch (city). There is no intermediate zone or region level. The filter label is "All branches" or a specific branch name. The hierarchy breadcrumb is always shown as "India / Delhi" (not just "Delhi").

## 8.2 Standard Filter Set (Planning Modules)

| **Filter** | **Options** | **What it drives** |
| --- | --- | --- |
| Branch | All branches / Delhi / Mumbai / Chennai / Kolkata | Narrows the SKU-location list |
| Product Group | All / Refrigerator / Washing Machine / Air Conditioner / Microwave | Category-level filter |
| Price Tier | All / Mass / Premium | SKU segment filter (separate from ABC-XYZ) |
| Classification | All / Trend / Seasonal / Stable / Intermittent / Random | Demand pattern type (CoV-based) |
| ABC-XYZ | All / AX / AY / AZ / BX / BY / BZ / CX / CY / CZ | Planning-policy classification |
| Search | Free text | Filters by SKU name or ID |

## 8.3 Forecast Grid — Horizon Filter

| **Option** | **Months shown** | **Use case** |
| --- | --- | --- |
| Full window (10 mo) | 6 history + 4 forward | Default. Full context. |
| Backtest only (past) | 6 history months | Evaluating model accuracy. |
| Forecast only (forward) | 4 forward months | Focused planning view. |

| **UPCOMING MODULES (specification for development)** |
| --- |

# 9. Modules Build

## 9.1 S&OP Decision Review (Highest Priority)

This is the platform's climax — the Kinaxis Maestro-style executive review. The S&OP Head sees named scenarios side by side, understands the trade-offs, and formally approves one. Nothing in the current build fulfills this function.

| **[ S****&****OP DECISION REVIEW — Layout ]** |
| --- |
| ┌─── Scenario selector ──────────────────────────────────────────┐ |
| │ Active scenarios: [Base Plan ✓] [Demand Upside ✓] [Supply Risk]│ |
| │ [+ Add scenario]                                               │ |
| └────────────────────────────────────────────────────────────────┘ |
|  |
| ┌─── Comparison table (scenario × KPI) ─────────────────────────┐ |
| │                   Base Plan    Demand Upside    Supply Risk    │ |
| │ Revenue (₹ Cr)    487.2        534.6 (+9.7%)    431.8 (-11.4%) │ |
| │ Gross Margin %    31.2%        29.8% (-1.4pp)   32.1% (+0.9pp) │ |
| │ Service Level     95.8%        91.2% (-4.6pp)   97.4% (+1.6pp) │ |
| │ Inventory (₹ Cr)  90.1         112.4 (+24.7%)   74.3 (-17.5%)  │ |
| │ Capacity overloads 4           6                2              │ |
| │ Supplier at risk   2           2                4              │ |
| └────────────────────────────────────────────────────────────────┘ |
|  |
| ┌─── Notes & rationale ─────────────────────────────────────────┐ |
| │ [Scenario-level text area for S&OP Head notes]                │ |
| └────────────────────────────────────────────────────────────────┘ |
|  |
| [ Select & Approve: Demand Upside ]  [ Select & Approve: Base Plan ] |

Scenario construction logic:

| **Scenario** | **Demand** | **Supply / Inventory** | **Key parameter** |
| --- | --- | --- | --- |
| Base Plan | Consensus forecast (no change) | Current policy | Baseline. The approved S&OP plan if no change. |
| Demand Upside | +15% consensus, all categories | Safety stock +15%, EOQ +10% | Captures festive season beat scenario. |
| Supply Risk | Consensus (no change) | Lead time +30% for 2 worst-OTIF suppliers | Veltrix + Anand disruption scenario. |

## 9.2 Risk Management

| **[ RISK MANAGEMENT — Layout ]** |
| --- |
| ┌─── Risk register ─────────────────────────────────────────────┐ |
| │ [Severity ▼] [Category ▼] [Module source ▼]                  │ |
| ├──────┬────────────────────┬──────────┬─────────┬─────────────┤ |
| │ Sev  │ Risk               │ Module   │ Impact  │ Action      │ |
| ├──────┼────────────────────┼──────────┼─────────┼─────────────┤ |
| │ CRIT │ Line-AC overloaded │ Prod.    │ 668 u   │ [Resolve]   │ |
| │ HIGH │ Veltrix OTIF 84%   │ Supplier │ ₹495 Cr │ [Escalate]  │ |
| │ MED  │ AC Chennai <SS     │ Inventory│ ₹22 L   │ [Review]    │ |
| └──────┴────────────────────┴──────────┴─────────┴─────────────┘ |
|  |
| [Selected risk detail panel — root cause, options, dependencies] |

Risk detection rules:

- Capacity overload: utilizationPct > 100 in any line-month (from productionAnalytics)

- Supplier OTIF below threshold: historicalOtifPct < 0.90 (from supplierMaster)

- FG inventory below safety stock: onHandUnits < safetyStock (from inventoryAnalytics)

- RM coverage critical: daysOfCover < leadTimeDays (from rawMaterialAnalytics)

- Demand spike: consensus > 1.3 × trendOnly in any forward month (from demandAnalytics)

- High forecast bias: |consensusBias| > 12% for any SKU-branch (from computeSkuMetrics)

## 9.3 Digital Twin (Conceptual)

The Digital Twin is a network-level visualization of the supply chain: supplier nodes → component flows → production lines → branch warehouses → end demand. Each node is clickable and links to the relevant planning module. This is a visualization layer over existing analytics, not new computation.

| **[ DIGITAL TWIN — Network Map ]** |
| --- |
| [Anand Comp.]──compressor──┐ |
| [Veltrix PCB]──pcb─────────┤ |
| [Bharat Sheet]──body───────┤ |
| ↓ |
| [Supplier tier]          [Production Lines 1-4] |
| Line-REF  Line-WM |
| Line-AC   Line-MW |
| │ |
| [Warehouse / FG] |
| /    │    │    \ |
| [Delhi] [Mum] [Chen] [Kol] |
| ↓      ↓     ↓      ↓ |
| [Demand — end consumers] |
|  |
| Node click → opens the relevant planning module at that node's detail |
| Color = current status (green/amber/red from existing analytics) |

# 10. Formula Quick Reference

| **Formula** | **Expression** | **Used in** |
| --- | --- | --- |
| Safety Stock | SS = Z × √(LT·σ_D² + D̄²·σ_LT²) | Inventory, Supply-Demand Match |
| EOQ | √(2·D_annual·S / H) | Inventory, Replenishment |
| Reorder Point | ROP = (D̄/30)·LT + SS | Inventory, Replenishment, Supply-Demand Match |
| Inventory Turns | Turns = (D_annual·price) / (onHand·price) | Inventory KPIs |
| Days of Cover | DoC = onHand / (D̄/30) | Inventory, RM Planning |
| MAPE (backtest) | mean(│Ŷ_t - Y_t│ / Y_t) × 100 | Demand Planning model selection |
| Forecast Bias | mean((Ŷ_t - Y_t) / Y_t) × 100 | Demand Planning KPIs |
| CoV (XYZ) | σ(monthly demand) / mean(monthly demand) × 100 | ABC-XYZ, Patterns tab |
| Supplier Risk Score | (1−OTIF)×0.6 + (LT/maxLT)×0.4 × 100 | Supplier Risk tab |
| Price Elasticity | ΔQ% = PRICE_ELASTICITY × ΔP%  (= -2.0) | Demand What-If |
| RCCP Utilization | required / monthlyCapacity × 100 | Production Scheduling |
| Monthly Capacity | shiftsPerDay × daysPerWeek × 4.33 × unitsPerShift | Production Scheduling |

# 11. Known Limitations & Open Items

| **Item** | **Current state** | **Priority for next iteration** |
| --- | --- | --- |
| Open Sales Orders | Not shown — no order-management entity in dataset | Medium |
| Cross-module state propagation | Actions do not propagate across modules — each reads the static dataset independently | Medium (needs real backend) |
| Workbench rows as absolutes vs deltas | Currently shows deltas for Sales/Marketing Adjustment. Should show absolute numbers per stakeholder. | Medium |
| Finite scheduling | RCCP only. Day-level sequencing not implemented. | Low for demo, High for production |
| ML models (RF/XGBoost/LightGBM) | Not implemented. Belong in a Python forecasting service backend, not the frontend. | Out of scope for this build |
| ARIMA/SARIMA | Not implemented. Need iterative parameter fitting (MLE) — inappropriate for browser JS. | Out of scope for this build |
| Croston/Croston TSB | Not implemented. No intermittent demand in this 12-SKU catalog — Croston would produce identical results to SES. | N/A — wrong catalog for this model |
| Real RM inventory feed | Synthetic — stated assumption of 34+ days cover buffer | Real feed needed for production |

Classification | INTERNAL