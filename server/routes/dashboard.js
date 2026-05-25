const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

router.get('/', (req, res) => {
  try {
    const db = getDb();

    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    if (!cycle) return res.json({ cycle: null, kpis: {}, branches: [] });

    const scenario = db.prepare(`SELECT * FROM forecast_scenarios WHERE cycle_id=? AND status='finalized' LIMIT 1`).get(cycle.cycle_id);
    const allScenarios = db.prepare(`SELECT COUNT(*) as cnt FROM forecast_scenarios WHERE cycle_id=?`).get(cycle.cycle_id);

    const overrides = db.prepare(`SELECT * FROM branch_overrides WHERE cycle_id=?`).all(cycle.cycle_id);
    const submittedBranches = [...new Set(overrides.filter(o => o.status !== 'pending').map(o => o.branch))];
    const conflictBranches = [...new Set(overrides.filter(o => {
      if (!o.override_value || !o.ai_forecast) return false;
      const dev = Math.abs((o.override_value - o.ai_forecast) / o.ai_forecast);
      return dev > 0.2;
    }).map(o => o.branch))];

    const exceptions = db.prepare(`SELECT * FROM exception_log`).all();
    const unresolvedConflicts = overrides.filter(o => {
      if (!o.override_value || !o.ai_forecast) return false;
      const dev = Math.abs((o.override_value - o.ai_forecast) / o.ai_forecast);
      return dev > 0.2 && o.status !== 'resolved';
    });

    const BRANCHES = ['Mumbai', 'New Delhi', 'Kolkata', 'Chennai', 'Bangalore', 'Hyderabad', 'Pune', 'Ahmedabad'];
    const CITY_COORDS = {
      'Mumbai': [19.076, 72.8777], 'New Delhi': [28.6139, 77.209],
      'Kolkata': [22.5726, 88.3639], 'Chennai': [13.0827, 80.2707],
      'Bangalore': [12.9716, 77.5946], 'Hyderabad': [17.385, 78.4867],
      'Pune': [18.5204, 73.8567], 'Ahmedabad': [23.0225, 72.5714]
    };

    const branchData = BRANCHES.map(branch => {
      const branchOverrides = overrides.filter(o => o.branch === branch);
      const submitted = branchOverrides.some(o => o.status !== 'pending');
      const hasConflict = branchOverrides.some(o => {
        if (!o.override_value || !o.ai_forecast) return false;
        const dev = Math.abs((o.override_value - o.ai_forecast) / o.ai_forecast);
        return dev > 0.2;
      });
      const exceeded = branchOverrides.some(o => {
        if (!o.override_value || !o.ai_forecast) return false;
        const dev = Math.abs((o.override_value - o.ai_forecast) / o.ai_forecast);
        return dev > 0.3;
      });

      let status = 'pending';
      if (submitted && exceeded) status = 'submitted_exceeded';
      else if (submitted && hasConflict) status = 'submitted_conflict';
      else if (submitted) status = 'submitted_clean';

      const totalForecast = db.prepare(`SELECT SUM(value) as total FROM forecast_runs WHERE cycle_id=? AND branch=? AND scenario_id=?`).get(cycle.cycle_id, branch, scenario ? scenario.scenario_id : 0);
      const accuracyMap = { 'Mumbai': 91, 'Bangalore': 89, 'Pune': 88, 'New Delhi': 85, 'Hyderabad': 83, 'Kolkata': 81, 'Chennai': 79, 'Ahmedabad': 78 };

      return {
        name: branch,
        lat: CITY_COORDS[branch][0],
        lng: CITY_COORDS[branch][1],
        status,
        metric: totalForecast?.total || 0,
        metricLabel: 'Total Units',
        accuracy: accuracyMap[branch] || 82,
        overrideStatus: submitted ? 'Submitted' : 'Pending',
      };
    });

    const activity = [
      { icon: 'conflict', text: 'Holly (Kolkata) submitted overrides — 2 conflicts flagged', time: '2h ago', type: 'conflict' },
      { icon: 'check', text: 'Scenario 1 finalized by Priya Sharma', time: '5h ago', type: 'success' },
      { icon: 'warning', text: '6 exceptions detected — 4 acknowledged', time: '1d ago', type: 'warning' },
      { icon: 'ai', text: 'Demand Sensing applied: Q2_Promo_Brief.pdf', time: '1d ago', type: 'ai' },
      { icon: 'check', text: 'Forecast generated for May 2026 cycle', time: '1d ago', type: 'success' },
    ];

    db.close();
    res.json({
      cycle,
      scenario,
      kpis: {
        totalUnits: scenario?.total_units || 124850,
        accuracy: scenario?.accuracy || 87.3,
        pendingBranches: BRANCHES.length - submittedBranches.length,
        unresolvedConflicts: unresolvedConflicts.length,
        scenariosCount: allScenarios.cnt,
      },
      branches: branchData,
      activity,
      cycleSteps: [
        { label: 'Forecast Generated', status: 'done', date: '14-May', note: '' },
        { label: 'Forecast Compared',  status: 'done', date: '14-May', note: '' },
        { label: 'Forecast Finalized', status: 'done', date: '', note: 'Baseline SARIMAX' },
        { label: 'Branch Overrides', status: 'active', date: '', note: `${submittedBranches.length} of 8 submitted` },
        { label: 'Sign-off', status: 'pending', date: '', note: '' },
      ],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
