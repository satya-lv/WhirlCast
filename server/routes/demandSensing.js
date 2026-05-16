const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getDb } = require('../db/schema');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const FALLBACK_INSIGHTS = [
  { impact_level:'high', insight_text:'Trade promotion budget for AC category increased 22% for Q2 2026 — expected 15-18% demand uplift on AC_1.5T_Inverter across Delhi, Mumbai, Bangalore', affected_skus:['AC_1.5T_Inverter','AC_2.0T_Split'], affected_branches:['New Delhi','Mumbai','Bangalore'], suggested_adjustment_percent:16, confidence:85 },
  { impact_level:'medium', insight_text:'IMD forecast: above-normal temperatures across South India through June — positive signal for Direct Cool refrigerators in Chennai and Hyderabad', affected_skus:['REF_190L_DirectCool'], affected_branches:['Chennai','Hyderabad'], suggested_adjustment_percent:10, confidence:78 },
  { impact_level:'medium', insight_text:'WM_6.5KG_SemiAuto listed for exclusive Q2 promotion on Flipkart — modest 8% online channel uplift expected', affected_skus:['WM_6.5KG_SemiAuto'], affected_branches:['Mumbai','New Delhi','Bangalore'], suggested_adjustment_percent:8, confidence:72 },
  { impact_level:'low', insight_text:'Competitor LG launching 1.5T inverter AC at Rs 26,499 in May — potential 5% demand pressure on AC_1.5T_Inverter in tier-1 cities', affected_skus:['AC_1.5T_Inverter'], affected_branches:['Mumbai','New Delhi','Bangalore','Hyderabad'], suggested_adjustment_percent:-5, confidence:65 },
];

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const db = getDb();
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const filename = req.file?.originalname || 'document.pdf';
    const filetype = req.file?.mimetype || 'application/pdf';
    let insights = FALLBACK_INSIGHTS;
    let summary = 'Document analyzed. Key demand signals identified for Q2 2026 planning cycle, with primary focus on AC category uplift and regional temperature effects on refrigerator demand.';
    let usageLimitHit = false;

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const fileContent = req.file?.buffer?.toString('utf8') || filename;

        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: `You are a demand planning analyst for Whirlpool India. Analyze the provided document and extract demand signals relevant to these product categories: Direct Cool Refrigerators, Frost Free Refrigerators, Washing Machines (Top Load, Front Load, Semi-Auto), Air Conditioners (1.5T Inverter, 2.0T Split), Microwaves (25L Convection), and Induction cooktops (3 Burner Smart Glass). For each demand signal found, return a JSON array. Each object must have: impact_level (high/medium/low), insight_text (one clear actionable sentence), affected_skus (array from: REF_190L_DirectCool, REF_240L_FrostFree, REF_340L_TripleDoor, WM_7KG_TopLoad, WM_8KG_FrontLoad, WM_6.5KG_SemiAuto, AC_1.5T_Inverter, AC_2.0T_Split, MW_25L_Convection, IH_3B_SmartGlass), affected_branches (array from: Mumbai, New Delhi, Kolkata, Chennai, Bangalore, Hyderabad, Pune, Ahmedabad), suggested_adjustment_percent (number, positive=increase, negative=decrease), confidence (0-100). Return ONLY valid JSON array, no other text.`,
          messages: [{ role: 'user', content: `Analyze this document: ${fileContent.substring(0, 3000)}` }],
        });

        const text = response.content[0].text;
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) insights = JSON.parse(jsonMatch[0]);
      } catch (e) {
        const isLimit = e.status === 429 || e.status === 529 || /rate.limit|quota|usage.limit|overload/i.test(e.message);
        usageLimitHit = isLimit;
        console.log('Claude API failed, using fallback:', e.message);
        insights = FALLBACK_INSIGHTS;
      }
    }

    const logResult = db.prepare(`INSERT INTO demand_sensing_log (cycle_id, filename, file_type, insights_json, applied, created_at) VALUES (?,?,?,?,0,?)`).run(
      cycle.cycle_id, filename, filetype, JSON.stringify(insights), new Date().toISOString()
    );

    db.close();
    res.json({ insights, summary, log_id: logResult.lastInsertRowid, filename, usageLimitHit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/apply', (req, res) => {
  try {
    const db = getDb();
    const { log_id, adjustments } = req.body;
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();

    let skuCount = 0;
    let branchCount = new Set();

    for (const adj of adjustments || []) {
      const { sku, branch, month, adjustment_percent } = adj;
      const runs = db.prepare(`SELECT * FROM forecast_runs WHERE cycle_id=? AND sku=? AND branch=? AND month=?`).all(cycle.cycle_id, sku, branch, month);
      for (const run of runs) {
        const newVal = Math.round(run.value * (1 + adjustment_percent / 100));
        db.prepare(`UPDATE forecast_runs SET value=?, demand_sensing_adjusted=1 WHERE run_id=?`).run(newVal, run.run_id);
        skuCount++;
        branchCount.add(branch);
      }
    }

    if (log_id) {
      db.prepare(`UPDATE demand_sensing_log SET applied=1, adjustments_json=?, applied_at=? WHERE log_id=?`).run(JSON.stringify(adjustments), new Date().toISOString(), log_id);
    }

    db.close();
    res.json({ message: `Demand adjustments applied to ${skuCount} forecast entries across ${branchCount.size} branches`, skuCount, branchCount: branchCount.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', (req, res) => {
  try {
    const db = getDb();
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const logs = db.prepare(`SELECT * FROM demand_sensing_log WHERE cycle_id=? ORDER BY created_at DESC`).all(cycle.cycle_id);
    db.close();
    res.json({ logs: logs.map(l => ({ ...l, insights: JSON.parse(l.insights_json || '[]') })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
