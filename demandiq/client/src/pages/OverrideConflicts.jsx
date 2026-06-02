import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import IndiaMap from '../components/shared/IndiaMap';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/shared/PageHeader';
import { useIsMobile } from '../utils/useIsMobile';

/* ── Constants ── */
const MONTHS_FWD  = ['06-2026','07-2026','08-2026','09-2026','10-2026','11-2026'];
const MONTHS_LBL  = ['Jun','Jul','Aug','Sep','Oct','Nov'];
const BRANCHES    = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
const CATEGORIES  = ['Direct Cool Refrigerator','Frost Free Refrigerator','Washing Machine','Air Conditioner','Microwave','Induction'];

const CONFLICT_MAP = {
  Mumbai: 'conflict', 'New Delhi': 'clean', Kolkata: 'conflict',
  Chennai: 'warning', Bangalore: 'clean', Hyderabad: 'warning',
  Pune: 'clean', Ahmedabad: 'clean',
};

const LEGEND_ITEMS = [
  { color:'#F59E0B', label:'Active conflict' },
  { color:'#F97316', label:'Watch' },
  { color:'#22C55E', label:'Clean' },
];

const CAT_COLORS = {
  'Direct Cool Refrigerator': { bg:'EFF6FF', text:'1D4ED8' },
  'Frost Free Refrigerator':  { bg:'F0FDFA', text:'0F766E' },
  'Washing Machine':          { bg:'F0FDF4', text:'166534' },
  'Air Conditioner':          { bg:'FFFBEB', text:'92400E' },
  'Microwave':                { bg:'FDF4FF', text:'7E22CE' },
  'Induction':                { bg:'FFF7ED', text:'9A3412' },
};

const CAT_MAP = {
  'REF_190L_DirectCool':'Direct Cool Refrigerator', 'REF_240L_FrostFree':'Frost Free Refrigerator',
  'REF_340L_TripleDoor':'Frost Free Refrigerator',  'WM_7KG_TopLoad':'Washing Machine',
  'WM_8KG_FrontLoad':'Washing Machine',             'WM_6.5KG_SemiAuto':'Washing Machine',
  'AC_1.5T_Inverter':'Air Conditioner',             'AC_2.0T_Split':'Air Conditioner',
  'MW_25L_Convection':'Microwave',                  'IH_3B_SmartGlass':'Induction',
};

const BRANCH_STATS = {
  'Mumbai':    { acc:'91.0', bias:'2.3' }, 'New Delhi':   { acc:'85.1', bias:'6.9' },
  'Kolkata':   { acc:'81.0', bias:'8.2' }, 'Chennai':     { acc:'79.4', bias:'9.1' },
  'Bangalore': { acc:'89.2', bias:'3.4' }, 'Hyderabad':   { acc:'83.5', bias:'5.8' },
  'Pune':      { acc:'88.0', bias:'3.8' }, 'Ahmedabad':   { acc:'86.2', bias:'4.5' },
};

const SEED_CAT_BASE = { 'Direct Cool Refrigerator':1800,'Frost Free Refrigerator':2060,'Washing Machine':3620,'Air Conditioner':4905,'Microwave':558,'Induction':430 };
const BRANCH_FACTORS_OC = { 'Mumbai':1.25,'New Delhi':1.22,'Kolkata':0.95,'Chennai':1.05,'Bangalore':1.08,'Hyderabad':0.98,'Pune':0.88,'Ahmedabad':0.85 };
const seedAI = (cat, branch) => Math.round((SEED_CAT_BASE[cat]||1000) * (BRANCH_FACTORS_OC[branch]||1.0));

const CatBadge = ({ cat }) => {
  const c = CAT_COLORS[cat] || { bg:'F3F4F6', text:'374151' };
  return <span style={{ background:`#${c.bg}`, color:`#${c.text}`, fontSize:9, fontWeight:600, padding:'1px 6px', borderRadius:20 }}>{cat}</span>;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#FFF', borderRadius:8, padding:'10px 14px', boxShadow:'0 4px 16px rgba(0,0,0,0.1)', borderLeft:'3px solid #1B3A6B', fontSize:12 }}>
      <div style={{ fontWeight:600, marginBottom:4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color:p.color }}>{p.name}: <strong>{p.value?.toLocaleString('en-IN')}</strong></div>)}
    </div>
  );
};

function MultiSelectDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const display = selected.length === 0 || selected.length === options.length ? `All ${label}` : `${selected.length} selected`;
  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ background:'var(--card)', border:'0.5px solid var(--border)', borderRadius:7, padding:'5px 10px', fontSize:12, cursor:'pointer', color:'var(--text-1)', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 }}>
        {display} ▾
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:60, background:'var(--card)', border:'0.5px solid var(--border)', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', padding:'6px 0', minWidth:260, maxHeight:240, overflowY:'auto' }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px', cursor:'pointer', fontSize:12 }}
            onMouseEnter={e => e.currentTarget.style.background='#F5F8FF'} onMouseLeave={e => e.currentTarget.style.background=''}>
            <input type="checkbox" checked={selected.length===0||selected.length===options.length} onChange={() => onChange([])} style={{ accentColor:'#1B3A6B', cursor:'pointer' }}/>
            <em style={{ color:'var(--text-2)' }}>All {label}</em>
          </label>
          {options.map(opt => (
            <label key={opt} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px', cursor:'pointer', fontSize:12 }}
              onMouseEnter={e => e.currentTarget.style.background='#F5F8FF'} onMouseLeave={e => e.currentTarget.style.background=''}>
              <input type="checkbox" checked={selected.includes(opt)} style={{ accentColor:'#1B3A6B', cursor:'pointer' }}
                onChange={e => onChange(e.target.checked ? [...selected,opt] : selected.filter(s=>s!==opt))}/>
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function OverrideConflicts() {
  useEffect(() => { document.title = 'WhirlCast — Override Conflicts'; }, []);
  const { toast }  = useToast();
  const { user }   = useAuth();
  const isMobile   = useIsMobile();

  /* ── Shared state ── */
  const [activeTab, setActiveTab]   = useState('national');
  const [data, setData]             = useState(null);
  const [reportData, setReportData] = useState(null);

  /* ── National View: editable grid state ── */
  const [edits, setEdits]         = useState({});       // { `${branch}|${sku}|${month}`: number }
  const [inputVals, setInputVals] = useState({});       // raw typed values while editing
  const [savingCat, setSavingCat] = useState(null);
  const [expandedCats, setExpandedCats]         = useState({});
  const [expandedBranches, setExpandedBranches] = useState({});

  /* ── National View: chart filters ── */
  const [chartViewBy, setChartViewBy]             = useState('Category');
  const [filterCats, setFilterCats]               = useState([]);
  const [filterChartBranches, setFilterChartBranches] = useState([]);

  /* ── Conflict Resolution tab state ── */
  const [decisions, setDecisions]     = useState({});
  const [customVals, setCustomVals]   = useState({});
  const [saving, setSaving]           = useState(false);
  const [filterBranch, setFilterBranch] = useState(null);
  const [showSignoffModal, setShowSignoffModal] = useState(false);
  const [signingOff, setSigningOff]   = useState(false);
  const [signedOff, setSignedOff]     = useState(false);

  const isReadOnly = user?.role === 'demand_planning';
  const canResolve = user?.role === 'category_team';

  /* ── Data loading ── */
  const loadConflicts = () => fetch('/api/conflicts').then(r => r.json()).then(d => setData(d));
  useEffect(() => { loadConflicts(); }, []);
  useEffect(() => { fetch('/api/report').then(r => r.json()).then(setReportData).catch(() => {}); }, []);

  /* ── Conflict resolution handlers ── */
  const makeDecision = (ovId, decision, val) => setDecisions(prev => ({ ...prev, [ovId]: { decision, final_value: val } }));

  const handleConfirmAll = async () => {
    setSaving(true);
    const decisionList = Object.entries(decisions).map(([id, d]) => ({ override_id: parseInt(id), ...d }));
    try {
      await fetch('/api/conflicts/resolve', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ decisions: decisionList }) });
      toast.success(`✅ ${decisionList.length} decisions saved`);
      setDecisions({});
      loadConflicts();
    } catch { toast.error('Failed to save decisions'); }
    finally { setSaving(false); }
  };

  const handleSignoff = async () => {
    setSigningOff(true);
    try {
      await fetch('/api/cycles/signoff', { method: 'POST' });
      toast.success('Jun 2026 forecast signed off successfully');
      setSignedOff(true);
      setShowSignoffModal(false);
    } catch { toast.error('Sign-off failed'); }
    finally { setSigningOff(false); }
  };

  /* ═══════════════════════════════════════════════════════════════
     EDITABLE GRID — Data maps (derived from reportData + conflicts)
  ═══════════════════════════════════════════════════════════════ */
  const { aiMap, catBranchSkuData, ovMap, ovMeta } = useMemo(() => {
    const aiM = {}, catBSK = {}, ovM = {}, ovMe = {};

    for (const r of reportData?.by_branch_sku || []) {
      const { branch, sku, category: cat, month, value } = r;
      if (!aiM[branch]) aiM[branch] = {};
      if (!aiM[branch][sku]) aiM[branch][sku] = {};
      aiM[branch][sku][month] = value;

      if (cat) {
        if (!catBSK[cat]) catBSK[cat] = {};
        if (!catBSK[cat][branch]) catBSK[cat][branch] = {};
        catBSK[cat][branch][sku] = {};
      }
    }

    for (const o of data?.overrides || []) {
      if (!ovM[o.branch]) ovM[o.branch] = {};
      if (!ovM[o.branch][o.sku]) ovM[o.branch][o.sku] = {};
      if (o.override_value) {
        ovM[o.branch][o.sku][o.month] = { value: o.override_value, override_by: o.override_by, status: o.status };
      }
      if (!ovMe[o.branch]) ovMe[o.branch] = {};
      ovMe[o.branch][o.sku] = { override_by: o.override_by, status: o.status };
    }

    return { aiMap: aiM, catBranchSkuData: catBSK, ovMap: ovM, ovMeta: ovMe };
  }, [reportData, data]);

  /* ── Effective value: session edit > saved override > AI forecast ── */
  const getEff = (branch, sku, month) => {
    const k = `${branch}|${sku}|${month}`;
    if (edits[k] !== undefined) return edits[k];
    return ovMap[branch]?.[sku]?.[month]?.value ?? aiMap[branch]?.[sku]?.[month] ?? 0;
  };

  const getAI = (branch, sku, month) => aiMap[branch]?.[sku]?.[month] ?? 0;

  /* ── Aggregate helpers ── */
  const getCatMonthEff = (cat, month) => {
    let t = 0;
    for (const b of Object.keys(catBranchSkuData[cat] || {})) {
      for (const s of Object.keys(catBranchSkuData[cat][b] || {})) t += getEff(b, s, month);
    }
    return t;
  };
  const getCat6MEff = (cat) => MONTHS_FWD.reduce((s, m) => s + getCatMonthEff(cat, m), 0);
  const getCat6MAI  = (cat) => {
    let t = 0;
    for (const b of Object.keys(catBranchSkuData[cat] || {})) {
      for (const s of Object.keys(catBranchSkuData[cat][b] || {})) {
        for (const m of MONTHS_FWD) t += getAI(b, s, m);
      }
    }
    return t;
  };

  const getBranchMonthEff = (cat, branch, month) => {
    let t = 0;
    for (const s of Object.keys(catBranchSkuData[cat]?.[branch] || {})) t += getEff(branch, s, month);
    return t;
  };
  const getBranch6MEff = (cat, branch) => MONTHS_FWD.reduce((s, m) => s + getBranchMonthEff(cat, branch, m), 0);
  const getBranch6MAI  = (cat, branch) => {
    let t = 0;
    for (const s of Object.keys(catBranchSkuData[cat]?.[branch] || {})) {
      for (const m of MONTHS_FWD) t += getAI(branch, s, m);
    }
    return t;
  };

  const getSku6MEff = (branch, sku) => MONTHS_FWD.reduce((s, m) => s + getEff(branch, sku, m), 0);
  const getSku6MAI  = (branch, sku) => MONTHS_FWD.reduce((s, m) => s + getAI(branch, sku, m), 0);

  const dc = (pct) => Math.abs(pct) < 10 ? '#16A34A' : Math.abs(pct) < 20 ? '#D97706' : '#DC2626';

  /* ── Cascade: category 6M total → all branches × SKUs × months ── */
  const cascadeCat6M = (cat, newTotal) => {
    const orig = getCat6MEff(cat);
    if (orig === 0) return;
    setEdits(prev => {
      const next = { ...prev };
      for (const b of Object.keys(catBranchSkuData[cat] || {})) {
        for (const s of Object.keys(catBranchSkuData[cat][b] || {})) {
          for (const m of MONTHS_FWD) {
            const k = `${b}|${s}|${m}`;
            const cur = prev[k] !== undefined ? prev[k] : (ovMap[b]?.[s]?.[m]?.value ?? aiMap[b]?.[s]?.[m] ?? 0);
            next[k] = Math.max(0, Math.round(cur / orig * newTotal));
          }
        }
      }
      return next;
    });
  };

  /* ── Cascade: category month total → all branches × SKUs for that month ── */
  const cascadeCatMonth = (cat, month, newVal) => {
    const orig = getCatMonthEff(cat, month);
    if (orig === 0) return;
    setEdits(prev => {
      const next = { ...prev };
      for (const b of Object.keys(catBranchSkuData[cat] || {})) {
        for (const s of Object.keys(catBranchSkuData[cat][b] || {})) {
          const k = `${b}|${s}|${month}`;
          const cur = prev[k] !== undefined ? prev[k] : (ovMap[b]?.[s]?.[month]?.value ?? aiMap[b]?.[s]?.[month] ?? 0);
          next[k] = Math.max(0, Math.round(cur / orig * newVal));
        }
      }
      return next;
    });
  };

  /* ── Cascade: branch month total → SKUs for that branch × month ── */
  const cascadeBranchMonth = (cat, branch, month, newVal) => {
    const orig = getBranchMonthEff(cat, branch, month);
    if (orig === 0) return;
    setEdits(prev => {
      const next = { ...prev };
      for (const s of Object.keys(catBranchSkuData[cat]?.[branch] || {})) {
        const k = `${branch}|${s}|${month}`;
        const cur = prev[k] !== undefined ? prev[k] : (ovMap[branch]?.[s]?.[month]?.value ?? aiMap[branch]?.[s]?.[month] ?? 0);
        next[k] = Math.max(0, Math.round(cur / orig * newVal));
      }
      return next;
    });
  };

  /* ── Direct SKU edit ── */
  const setSkuEdit = (branch, sku, month, n) => {
    setEdits(prev => ({ ...prev, [`${branch}|${sku}|${month}`]: Math.max(0, n) }));
  };

  /* ── Save a category's edits to backend ── */
  const saveCategoryEdits = async (cat) => {
    const toSave = [];
    for (const b of Object.keys(catBranchSkuData[cat] || {})) {
      for (const s of Object.keys(catBranchSkuData[cat][b] || {})) {
        for (const m of MONTHS_FWD) {
          const k = `${b}|${s}|${m}`;
          if (edits[k] !== undefined) toSave.push({ branch: b, sku: s, month: m, value: edits[k], category: cat });
        }
      }
    }
    if (toSave.length === 0) { toast.info('No changes to save'); return; }

    setSavingCat(cat);
    try {
      await fetch('/api/conflicts/category-override', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ overrides: toSave }) });
      toast.success('Override saved and cascaded to branch × SKU level.');
      setEdits(prev => {
        const next = { ...prev };
        for (const b of Object.keys(catBranchSkuData[cat] || {})) {
          for (const s of Object.keys(catBranchSkuData[cat][b] || {})) {
            for (const m of MONTHS_FWD) delete next[`${b}|${s}|${m}`];
          }
        }
        return next;
      });
      loadConflicts();
      fetch('/api/report').then(r => r.json()).then(setReportData);
    } catch { toast.error('Save failed'); }
    finally { setSavingCat(null); }
  };

  /* ── Render editable input cell ── */
  const renderInput = (editKey, val, onChange, small = false, hasEditOverride) => {
    const hasEdit = hasEditOverride !== undefined ? hasEditOverride : edits[editKey] !== undefined;
    const display = inputVals[editKey] ?? String(Math.round(val));
    return (
      <input
        type="text"
        value={display}
        onChange={e => {
          const raw = e.target.value;
          setInputVals(p => ({ ...p, [editKey]: raw }));
          const n = parseInt(raw.replace(/,/g, ''), 10);
          if (!isNaN(n) && n >= 0) onChange(n);
        }}
        onBlur={() => setInputVals(p => { const n = { ...p }; delete n[editKey]; return n; })}
        style={{
          width: small ? 60 : 76, padding: '3px 5px', fontSize: 11,
          border: `1.5px solid ${hasEdit ? '#1B3A6B' : '#D1D5DB'}`,
          borderRadius: 5, textAlign: 'right', outline: 'none',
          background: hasEdit ? '#EFF6FF' : '#FFF',
          color: hasEdit ? '#1D4ED8' : 'inherit',
          fontFamily: 'Inter', boxSizing: 'border-box',
        }}
      />
    );
  };

  /* ── Has-edits helpers ── */
  const catHasEdits = (cat) =>
    Object.keys(catBranchSkuData[cat] || {}).some(b =>
      Object.keys(catBranchSkuData[cat][b] || {}).some(s =>
        MONTHS_FWD.some(m => edits[`${b}|${s}|${m}`] !== undefined)));

  const branchHasEdits = (cat, branch) =>
    Object.keys(catBranchSkuData[cat]?.[branch] || {}).some(s =>
      MONTHS_FWD.some(m => edits[`${branch}|${s}|${m}`] !== undefined));

  /* ── Chart data for national view ── */
  const catChartData = CATEGORIES.filter(cat => catBranchSkuData[cat]).map(cat => {
    let aiTot = 0, effTot = 0;
    for (const b of Object.keys(catBranchSkuData[cat] || {})) {
      for (const s of Object.keys(catBranchSkuData[cat][b] || {})) {
        for (const m of MONTHS_FWD) { aiTot += getAI(b, s, m); effTot += ovMap[b]?.[s]?.[m]?.value ?? getAI(b, s, m); }
      }
    }
    const name = cat.length > 18 ? cat.split(' ').slice(-2).join(' ') : cat;
    return { name, fullName: cat, 'AI Forecast': aiTot, 'After Overrides': effTot };
  });

  const branchChartData = BRANCHES.map(branch => {
    const effCats = filterCats.length ? CATEGORIES.filter(c => filterCats.includes(c)) : CATEGORIES;
    let aiTot = 0, effTot = 0;
    for (const cat of effCats) {
      for (const s of Object.keys(catBranchSkuData[cat]?.[branch] || {})) {
        for (const m of MONTHS_FWD) { aiTot += getAI(branch, s, m); effTot += ovMap[branch]?.[s]?.[m]?.value ?? getAI(branch, s, m); }
      }
    }
    return { name: branch, 'AI Forecast': aiTot, 'After Overrides': effTot };
  });

  const activeChartData = chartViewBy === 'Branch'
    ? (filterChartBranches.length ? branchChartData.filter(d => filterChartBranches.includes(d.name)) : branchChartData)
    : (filterCats.length ? catChartData.filter(d => filterCats.includes(d.fullName)) : catChartData);

  /* ── Conflict Resolution tab data ── */
  const overrides      = data?.overrides     || [];
  const categoryRollup = data?.categoryRollup || [];
  const allResolved    = !signedOff && overrides.length > 0 && overrides.every(o => o.final_override != null || o.status === 'resolved');
  const filteredOverrides = filterBranch ? overrides.filter(o => o.branch === filterBranch) : overrides;

  const catRows = (() => {
    const cats = categoryRollup.length
      ? categoryRollup.map(r => r.category)
      : [...new Set((reportData?.by_category||[]).map(r => r.category))];
    return cats.map(cat => {
      const cr = categoryRollup.find(r => r.category === cat);
      const catOvs = overrides.filter(o => CAT_MAP[o.sku] === cat);
      const branchDev = {};
      catOvs.forEach(o => { branchDev[o.branch] = (branchDev[o.branch]||0) + Math.abs(o.deviation||0); });
      const topBranches = Object.entries(branchDev).sort((a,b) => b[1]-a[1]).slice(0,2).map(([b]) => b);
      return { cat, aiTotal:cr?.ai_total||0, overrideTotal:cr?.override_total||0, deviation:cr?.deviation||0, status:cr?.status||'ok', topBranches };
    });
  })();

  const getBranchOverrideRows = (cat) => {
    const catOvs = overrides.filter(o => CAT_MAP[o.sku] === cat);
    return BRANCHES.map(branch => {
      const bOvs = catOvs.filter(o => o.branch === branch);
      const reportAI = (reportData?.by_branch_sku||[]).filter(r => r.branch === branch && CAT_MAP[r.sku] === cat).reduce((s,r) => s + (r.value||0), 0);
      const aiTotal = reportAI || bOvs.reduce((s,o) => s + (o.ai_forecast||0), 0) || seedAI(cat, branch);
      const overriddenAI  = bOvs.reduce((s,o) => s + (o.ai_forecast||0), 0);
      const overriddenVal = bOvs.reduce((s,o) => s + (o.override_value||0), 0);
      const overrideTotal = bOvs.length > 0 ? (aiTotal - overriddenAI + overriddenVal) : aiTotal;
      const deviation = aiTotal > 0 ? ((overrideTotal - aiTotal) / aiTotal * 100) : 0;
      const skuDev = {};
      bOvs.forEach(o => { skuDev[o.sku] = (skuDev[o.sku]||0) + Math.abs(o.deviation||0); });
      const topSkus = Object.entries(skuDev).sort((a,b) => b[1]-a[1]).slice(0,2).map(([s]) => s);
      const stats = BRANCH_STATS[branch] || { acc:'85.0', bias:'5.0' };
      return { branch, aiTotal, overrideTotal, deviation, acc:stats.acc, bias:stats.bias, topSkus };
    }).sort((a,b) => Math.abs(b.deviation) - Math.abs(a.deviation));
  };

  const getSkuOverrideRows = (cat, branch) => {
    const skuOvs = overrides.filter(o => CAT_MAP[o.sku] === cat && o.branch === branch);
    const skus = [...new Set(skuOvs.map(o => o.sku))];
    return skus.map(sku => {
      const sOvs = skuOvs.filter(o => o.sku === sku);
      const aiTotal = sOvs.reduce((s,o) => s + (o.ai_forecast||0), 0);
      const ovTotal = sOvs.reduce((s,o) => s + (o.override_value||0), 0);
      const deviation = aiTotal > 0 ? ((ovTotal - aiTotal) / aiTotal * 100) : 0;
      const last = sOvs[sOvs.length - 1];
      return { sku, aiTotal, overrideVal:ovTotal, deviation, overrideBy:last?.override_by, reason:last?.reason, status:last?.status };
    });
  };

  /* ── Grid column template ── */
  const GRID_TPL = '190px repeat(6, 72px) 92px 92px 65px 90px';

  /* ═══════════════════════════════════════════════════════════ RENDER */
  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth:1440, margin:'0 auto', background:'var(--bg)', minHeight:'calc(100vh - 52px)', paddingBottom: isMobile ? 80 : undefined }}>
      <PageHeader title="Override Conflicts"
        subtitle="Review and resolve branch forecast overrides — Jun 2026"
        helpText="The category team reviews all branch overrides nationally. Use National View to edit forecasts at any level with automatic cascade, or Conflict Resolution to adjudicate individual branch override requests."/>

      {/* Navigation banner for category_team */}
      {user?.role === 'category_team' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          <div
            onClick={() => setActiveTab('national')}
            style={{ border:`2px solid ${activeTab==='national'?'#1B3A6B':'#BFDBFE'}`, borderRadius:10, padding:'12px 16px', background:activeTab==='national'?'#EFF6FF':'var(--card)', cursor:'pointer', transition:'all 0.15s' }}>
            <div style={{ fontWeight:600, fontSize:13, color:'#1B3A6B' }}>📊 Review & edit forecasts at national level →</div>
            <div style={{ fontSize:11, color:'#6B7280', marginTop:3 }}>National View tab — edit at category, branch or SKU level with cascade</div>
          </div>
          <div
            onClick={() => setActiveTab('conflicts')}
            style={{ border:`2px solid ${activeTab==='conflicts'?'#7C3AED':'#E9D5FF'}`, borderRadius:10, padding:'12px 16px', background:activeTab==='conflicts'?'#FDF4FF':'var(--card)', cursor:'pointer', transition:'all 0.15s' }}>
            <div style={{ fontWeight:600, fontSize:13, color:'#7C3AED' }}>⚡ Resolve branch override conflicts →</div>
            <div style={{ fontSize:11, color:'#6B7280', marginTop:3 }}>Conflict Resolution tab — accept, reject or set custom values</div>
          </div>
        </div>
      )}

      {isReadOnly && (
        <div style={{ background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:10, padding:'12px 16px', marginBottom:12, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:16 }}>🔒</span>
          <span style={{ fontSize:13, color:'#92400E' }}>Read only — conflicts are resolved by the category team.</span>
        </div>
      )}

      {user?.role === 'category_team' && (
        <div style={{ background:'linear-gradient(135deg, #6D28D9 0%, #5B21B6 100%)', borderRadius:12, padding:'14px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontSize:24 }}>⚡</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:'white' }}>Good morning, {user?.name?.split(' ')[0]} 👋</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:3 }}>
              {overrides.filter(o => !o.final_override && Math.abs(o.deviation) > 20).length || 3} override conflicts require your attention for the Jun 2026 cycle.
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, background:'#F4F6FA', borderRadius:10, padding:4, marginBottom:20, width:'fit-content' }}>
        {[{ id:'national', label:'🗺 National View' }, { id:'conflicts', label:'⚡ Conflict Resolution' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            background: activeTab === tab.id ? '#FFF' : 'transparent',
            color:      activeTab === tab.id ? '#1B3A6B' : '#6B7280',
            border:'none', borderRadius:8, padding:'8px 16px', fontSize:13,
            fontWeight: activeTab === tab.id ? 600 : 400,
            cursor:'pointer', boxShadow: activeTab === tab.id ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
            transition:'all 0.15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ══════════════════════════════════ NATIONAL VIEW ══════════════════════════════════ */}
      {activeTab === 'national' && (
        <div>
          {/* Top instruction */}
          <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:8, padding:'10px 16px', marginBottom:16, fontSize:13, color:'#1D4ED8', fontWeight:500, display:'flex', alignItems:'center', gap:8 }}>
            <span>✏️</span> Edit at any level — changes cascade proportionally to individual SKUs automatically.
          </div>

          {/* ── Editable grid ── */}
          <div style={{ background:'var(--card)', borderRadius:12, boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)', marginBottom:20, overflowX:'auto' }}>

            {/* Grid header */}
            <div style={{ display:'grid', gridTemplateColumns:GRID_TPL, background:'#F8FAFF', borderBottom:'0.5px solid var(--border)', padding:'8px 12px', fontSize:10, fontWeight:600, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'0.05em', alignItems:'center', minWidth:900 }}>
              <div>Category / Branch / SKU</div>
              {MONTHS_LBL.map(m => <div key={m} style={{textAlign:'center'}}>{m}</div>)}
              <div style={{textAlign:'right'}}>6M Total</div>
              <div style={{textAlign:'right'}}>AI Forecast</div>
              <div style={{textAlign:'center'}}>Δ%</div>
              <div style={{textAlign:'center'}}>Actions</div>
            </div>

            {/* Tree rows */}
            <div style={{ minWidth:900 }}>
              {CATEGORIES.filter(cat => catBranchSkuData[cat]).map((cat, ci) => {
                const isCatOpen  = !!expandedCats[cat];
                const cat6M      = getCat6MEff(cat);
                const catAI      = getCat6MAI(cat);
                const catDelta   = catAI > 0 ? ((cat6M - catAI) / catAI * 100) : 0;
                const hasCatEdit = catHasEdits(cat);
                const catDc      = dc(catDelta);

                return (
                  <React.Fragment key={cat}>
                    {/* ── Level 1: Category ── */}
                    <div style={{ display:'grid', gridTemplateColumns:GRID_TPL, padding:'9px 12px', background:ci%2===0?'#FFF':'#FAFBFF', borderBottom:'0.5px solid #E5E7EB', alignItems:'center' }}>

                      {/* Name + expand */}
                      <div style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontWeight:700, color:'#1B3A6B', fontSize:12 }}
                        onClick={() => setExpandedCats(p => ({ ...p, [cat]: !p[cat] }))}>
                        <span style={{ fontSize:10, color:'#6B7280', userSelect:'none' }}>{isCatOpen ? '▼' : '▶'}</span>
                        <span title={cat}>{cat.length > 22 ? cat.split(' ').slice(0,2).join(' ') : cat}</span>
                      </div>

                      {/* Month cells — editable when expanded; read-only aggregate when collapsed */}
                      {MONTHS_FWD.map((m, mi) => {
                        const catMonthVal = getCatMonthEff(cat, m);
                        return (
                          <div key={m} style={{textAlign:'center', padding:'0 2px'}}>
                            {isCatOpen
                              ? renderInput(`cat_m|${cat}|${m}`, catMonthVal, (n) => cascadeCatMonth(cat, m, n), true, hasCatEdit)
                              : <span style={{fontSize:11, color:'#6B7280'}}>{catMonthVal.toLocaleString('en-IN')}</span>
                            }
                          </div>
                        );
                      })}

                      {/* 6M Total — editable when collapsed; auto-sum when expanded */}
                      <div style={{textAlign:'right', paddingRight:4}}>
                        {isCatOpen
                          ? <span style={{fontSize:12, fontWeight:700, color:'#1B3A6B'}}>{cat6M.toLocaleString('en-IN')}</span>
                          : renderInput(`cat6m|${cat}`, cat6M, (n) => cascadeCat6M(cat, n), false, hasCatEdit)
                        }
                      </div>

                      {/* AI Forecast */}
                      <div style={{textAlign:'right', fontSize:11, color:'var(--text-3)', paddingRight:4}}>{catAI.toLocaleString('en-IN')}</div>

                      {/* Δ% */}
                      <div style={{textAlign:'center'}}>
                        <span style={{fontSize:11, fontWeight:600, color:catDc}}>
                          {catDelta > 0 ? '+' : ''}{catDelta.toFixed(1)}%
                        </span>
                      </div>

                      {/* Save button */}
                      <div style={{textAlign:'center'}}>
                        {hasCatEdit && (
                          <button
                            onClick={() => saveCategoryEdits(cat)}
                            disabled={savingCat === cat}
                            style={{ background:'#1B3A6B', color:'white', border:'none', borderRadius:6, padding:'4px 12px', fontSize:11, cursor:'pointer', fontFamily:'Inter', fontWeight:600 }}>
                            {savingCat === cat ? '…' : 'Save'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── Level 2: Branch rows ── */}
                    {isCatOpen && BRANCHES.filter(b => catBranchSkuData[cat]?.[b]).map((branch, bi) => {
                      const brKey     = `${cat}__${branch}`;
                      const isBrOpen  = !!expandedBranches[brKey];
                      const br6M      = getBranch6MEff(cat, branch);
                      const brAI      = getBranch6MAI(cat, branch);
                      const brDelta   = brAI > 0 ? ((br6M - brAI) / brAI * 100) : 0;
                      const hasBrEdit = branchHasEdits(cat, branch);
                      const brDc      = dc(brDelta);

                      return (
                        <React.Fragment key={brKey}>
                          <div style={{ display:'grid', gridTemplateColumns:GRID_TPL, padding:'7px 12px', background:'#F4F6FA', borderBottom:'0.5px solid #E5E7EB', alignItems:'center' }}>

                            <div style={{ display:'flex', alignItems:'center', gap:6, paddingLeft:20, cursor:'pointer', color:'#374151', fontSize:12 }}
                              onClick={() => setExpandedBranches(p => ({ ...p, [brKey]: !p[brKey] }))}>
                              <span style={{ fontSize:9, color:'#9CA3AF', userSelect:'none' }}>{isBrOpen ? '▼' : '▶'}</span>
                              {branch}
                            </div>

                            {MONTHS_FWD.map(m => {
                              const brMonthVal = getBranchMonthEff(cat, branch, m);
                              return (
                                <div key={m} style={{textAlign:'center', padding:'0 2px'}}>
                                  {renderInput(`br_m|${cat}|${branch}|${m}`, brMonthVal, (n) => cascadeBranchMonth(cat, branch, m, n), true, hasBrEdit)}
                                </div>
                              );
                            })}

                            <div style={{textAlign:'right', fontSize:12, fontWeight:600, color:'#1B3A6B', paddingRight:4}}>{br6M.toLocaleString('en-IN')}</div>
                            <div style={{textAlign:'right', fontSize:11, color:'var(--text-3)', paddingRight:4}}>{brAI.toLocaleString('en-IN')}</div>

                            <div style={{textAlign:'center'}}>
                              <span style={{fontSize:11, fontWeight:600, color:brDc}}>
                                {brDelta > 0 ? '+' : ''}{brDelta.toFixed(1)}%
                              </span>
                            </div>

                            <div style={{textAlign:'center'}}>
                              {hasBrEdit && (
                                <button onClick={() => saveCategoryEdits(cat)} disabled={savingCat===cat}
                                  style={{ background:'#1B3A6B', color:'white', border:'none', borderRadius:6, padding:'4px 12px', fontSize:11, cursor:'pointer', fontFamily:'Inter', fontWeight:600 }}>
                                  {savingCat===cat?'…':'Save'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* ── Level 3: SKU rows ── */}
                          {isBrOpen && Object.keys(catBranchSkuData[cat]?.[branch] || {}).sort().map((sku, si) => {
                            const sku6M    = getSku6MEff(branch, sku);
                            const skuAI    = getSku6MAI(branch, sku);
                            const skuDelta = skuAI > 0 ? ((sku6M - skuAI) / skuAI * 100) : 0;
                            const ovrMeta  = ovMeta[branch]?.[sku];
                            const skuDc    = dc(skuDelta);
                            const skuEdit  = MONTHS_FWD.some(m => edits[`${branch}|${sku}|${m}`] !== undefined);

                            return (
                              <div key={sku} style={{ display:'grid', gridTemplateColumns:GRID_TPL, padding:'5px 12px', background:si%2===0?'#FAFBFF':'#F0F4FF', borderBottom:'0.5px solid #EEF0F4', alignItems:'center' }}>

                                <div style={{ paddingLeft:40, fontSize:10, fontFamily:'monospace', color:'#6B7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={sku}>
                                  {sku}
                                </div>

                                {MONTHS_FWD.map(m => (
                                  <div key={m} style={{textAlign:'center', padding:'0 2px'}}>
                                    {renderInput(`${branch}|${sku}|${m}`, getEff(branch, sku, m), (n) => setSkuEdit(branch, sku, m, n), true)}
                                  </div>
                                ))}

                                <div style={{textAlign:'right', fontSize:11, fontWeight:600, paddingRight:4}}>{sku6M.toLocaleString('en-IN')}</div>

                                <div style={{textAlign:'right', fontSize:10, color:'#6B7280', paddingRight:4}}>
                                  {ovrMeta?.override_by || '—'}
                                </div>

                                <div style={{textAlign:'center'}}>
                                  {skuDelta !== 0 ? (
                                    <span style={{ fontSize:10, fontWeight:600, color:skuDc, background:`${skuDc}18`, borderRadius:5, padding:'1px 5px' }}>
                                      {skuDelta > 0 ? '+' : ''}{skuDelta.toFixed(1)}%
                                    </span>
                                  ) : <span style={{fontSize:10, color:'#9CA3AF'}}>—</span>}
                                </div>

                                <div style={{textAlign:'center'}}>
                                  {ovrMeta?.status ? (
                                    <span style={{ fontSize:9, fontWeight:600, borderRadius:8, padding:'1px 6px', background:ovrMeta.status==='submitted'?'#FFFBEB':ovrMeta.status==='resolved'?'#F0FDF4':'#F4F6FA', color:ovrMeta.status==='submitted'?'#D97706':ovrMeta.status==='resolved'?'#16A34A':'#6B7280' }}>
                                      {ovrMeta.status}
                                    </span>
                                  ) : (
                                    skuEdit ? (
                                      <button onClick={() => saveCategoryEdits(cat)} disabled={savingCat===cat}
                                        style={{ background:'#1B3A6B', color:'white', border:'none', borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer', fontFamily:'Inter', fontWeight:600 }}>
                                        {savingCat===cat?'…':'Save'}
                                      </button>
                                    ) : <span style={{fontSize:10, color:'#9CA3AF'}}>—</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {CATEGORIES.filter(cat => catBranchSkuData[cat]).length === 0 && (
                <div style={{ padding:40, textAlign:'center', color:'var(--text-2)', fontSize:13 }}>
                  No forecast data available. Please finalize a scenario first.
                </div>
              )}
            </div>
          </div>

          {/* Global save / discard */}
          {Object.keys(edits).length > 0 && (
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginBottom:16 }}>
              <button onClick={() => setEdits({})} style={{ background:'var(--bg)', border:'0.5px solid var(--border)', borderRadius:8, padding:'8px 16px', fontSize:12, cursor:'pointer', color:'var(--text-2)' }}>
                Discard All Changes
              </button>
              <button
                style={{ background:'#16A34A', color:'white', border:'none', borderRadius:8, padding:'8px 20px', fontSize:12, fontWeight:600, cursor:'pointer' }}
                onClick={async () => {
                  const cats = [...new Set(
                    Object.keys(edits).map(k => {
                      const [b, s] = k.split('|');
                      for (const [cat, bMap] of Object.entries(catBranchSkuData)) {
                        if (bMap[b]?.[s] !== undefined) return cat;
                      }
                      return null;
                    }).filter(Boolean)
                  )];
                  for (const cat of cats) await saveCategoryEdits(cat);
                }}>
                💾 Save All ({Object.keys(edits).length} cells)
              </button>
            </div>
          )}

          {/* Bar Chart — AI vs After Overrides */}
          <div style={{ background:'var(--card)', borderRadius:12, padding:'20px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:8 }}>
              <h3 style={{ margin:0, fontSize:14, fontWeight:600 }}>AI Forecast vs After Overrides</h3>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <div style={{ display:'flex', gap:3, background:'#F4F6FA', borderRadius:8, padding:3 }}>
                  {['Category','Branch'].map(v => (
                    <button key={v} onClick={() => setChartViewBy(v)} style={{ background:chartViewBy===v?'var(--navy-accent)':'transparent', color:chartViewBy===v?'white':'var(--text-2)', border:'none', borderRadius:6, padding:'4px 12px', fontSize:11, cursor:'pointer', fontFamily:'Inter', fontWeight:chartViewBy===v?600:400 }}>
                      {v}
                    </button>
                  ))}
                </div>
                {chartViewBy === 'Category' && (
                  <MultiSelectDropdown label="Categories" options={CATEGORIES} selected={filterCats} onChange={setFilterCats}/>
                )}
                {chartViewBy === 'Branch' && (
                  <MultiSelectDropdown label="Branches" options={BRANCHES} selected={filterChartBranches} onChange={setFilterChartBranches}/>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={activeChartData} margin={{ top:5, right:10, left:0, bottom:chartViewBy==='Branch'?5:40 }}>
                <defs>
                  <linearGradient id="barGradNavy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#1B3A6B" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#0D1B35" stopOpacity={0.7}/>
                  </linearGradient>
                  <linearGradient id="barGradRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#E31837" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#9B1226" stopOpacity={0.7}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0"/>
                <XAxis dataKey="name" tick={{ fontSize:9, fill:'#6B7280' }} angle={chartViewBy==='Category'?-20:0} textAnchor={chartViewBy==='Category'?'end':'middle'}/>
                <YAxis tick={{ fontSize:10, fill:'#6B7280' }} tickFormatter={v => (v/1000).toFixed(0)+'k'}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend/>
                <Bar dataKey="AI Forecast"     fill="url(#barGradNavy)" radius={[3,3,0,0]} isAnimationActive/>
                <Bar dataKey="After Overrides" fill="url(#barGradRed)"  radius={[3,3,0,0]} isAnimationActive/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════ CONFLICT RESOLUTION ══════════════════════════════════ */}
      {activeTab === 'conflicts' && (
        <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', gap:16, alignItems:'flex-start' }}>

          {/* Map card — 38% */}
          <div style={{ width: isMobile ? '100%' : '38%', flexShrink:0, background:'#0D1B35', borderRadius:16, padding:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'white', marginBottom:4 }}>
              Conflicts raised by branch managers requiring category review.
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:8 }}>Click branch to filter table</div>
            <div style={{ display:'flex', gap:12, marginBottom:12, flexWrap:'wrap' }}>
              {LEGEND_ITEMS.map(({ color, label }) => (
                <span key={label} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'rgba(255,255,255,0.65)' }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0, display:'inline-block' }}/>
                  {label}
                </span>
              ))}
            </div>
            <IndiaMap
              onBranchClick={(branch) => setFilterBranch(prev => prev === branch ? null : branch)}
              activeBranch={filterBranch}
              statusMap={CONFLICT_MAP}
              showAsFilter={true}
            />
            {filterBranch && (
              <div style={{ display:'flex', justifyContent:'center', marginTop:12 }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.12)', color:'white', borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:600 }}>
                  Showing: {filterBranch}
                  <button onClick={() => setFilterBranch(null)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', padding:0, fontSize:16, lineHeight:1, display:'flex', alignItems:'center' }}>×</button>
                </span>
              </div>
            )}
          </div>

          {/* Table — 62% */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-1)' }}>
                {filterBranch
                  ? `${filteredOverrides.length} conflict${filteredOverrides.length !== 1 ? 's' : ''} — ${filterBranch}`
                  : `${overrides.length} total conflict${overrides.length !== 1 ? 's' : ''}`}
              </span>
              <select style={{ padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, background:'var(--card)', color:'var(--text-1)', outline:'none' }}>
                <option>All Status</option>
                <option>Pending</option>
                <option>Resolved</option>
              </select>
            </div>

            <div style={{ background:'var(--card)', borderRadius:12, boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:900 }}>
                  <thead>
                    <tr style={{ background:'#F8FAFF' }}>
                      {['Branch','SKU','Month','AI Forecast','Override Value','Reason','By','Deviation%','Decision','Final Override'].map(h => (
                        <th key={h} style={{ padding:'10px 12px', fontSize:10, fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:'1px solid #E5E7EB', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOverrides.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding:40, textAlign:'center', color:'var(--text-2)', fontSize:13 }}>
                          {filterBranch ? `No conflicts for ${filterBranch}.` : 'No conflicts found.'}
                        </td>
                      </tr>
                    ) : filteredOverrides.map((ov, i) => {
                      const dec    = decisions[ov.override_id];
                      const devAbs = Math.abs(ov.deviation);
                      const dc2    = devAbs <= 10 ? '#16A34A' : devAbs <= 20 ? '#D97706' : '#DC2626';
                      const rowBg  = dec?.decision === 'accept' ? '#F0FDF4' : dec?.decision === 'reject' ? '#FFFBEB' : i % 2 === 0 ? '#FFF' : '#FAFAFA';
                      return (
                        <tr key={i} style={{ background:rowBg }}>
                          <td style={{ padding:'10px 12px', fontWeight:500 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ width:7, height:7, borderRadius:'50%', background: CONFLICT_MAP[ov.branch] === 'conflict' ? '#F59E0B' : CONFLICT_MAP[ov.branch] === 'warning' ? '#F97316' : '#22C55E', flexShrink:0, display:'inline-block' }}/>
                              {ov.branch}
                            </div>
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ fontSize:11, color:'#6B7280', marginBottom:3 }}>{ov.sku}</div>
                            <CatBadge cat={CAT_MAP[ov.sku] || 'Other'}/>
                          </td>
                          <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>{ov.month?.replace('-2026',"'26")}</td>
                          <td style={{ padding:'10px 12px' }}>{(ov.ai_forecast||0).toLocaleString('en-IN')}</td>
                          <td style={{ padding:'10px 12px', fontWeight:600 }}>{(ov.override_value||0).toLocaleString('en-IN')}</td>
                          <td style={{ padding:'10px 12px', fontSize:11, color:'#6B7280', maxWidth:120 }}>{ov.reason}</td>
                          <td style={{ padding:'10px 12px' }}>{ov.override_by}</td>
                          <td style={{ padding:'10px 12px' }}>
                            <span style={{ color:dc2, fontWeight:600, background:`${dc2}18`, borderRadius:8, padding:'2px 7px', fontSize:11 }}>
                              {ov.deviation > 0 ? '+' : ''}{ov.deviation?.toFixed(1)}%
                            </span>
                          </td>
                          <td style={{ padding:'8px 10px' }}>
                            {ov.status === 'resolved' ? (
                              <span style={{ color:'#16A34A', fontSize:11 }}>✅ Resolved</span>
                            ) : isReadOnly ? (
                              <span style={{ background:'#F3F4F6', color:'#6B7280', borderRadius:8, padding:'3px 8px', fontSize:10, fontWeight:500 }}>View Only</span>
                            ) : (
                              <div style={{ display:'flex', gap:4 }}>
                                <button onClick={() => makeDecision(ov.override_id, 'accept', ov.override_value)} style={{ background: dec?.decision==='accept'?'#16A34A':'#F0FDF4', color: dec?.decision==='accept'?'white':'#16A34A', border:'1px solid #BBF7D0', borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer' }}>✅ Accept</button>
                                <button onClick={() => makeDecision(ov.override_id, 'reject', ov.ai_forecast)}    style={{ background: dec?.decision==='reject'?'#D97706':'#FFFBEB', color: dec?.decision==='reject'?'white':'#D97706', border:'1px solid #FCD34D', borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer' }}>❌ Reject</button>
                                <button onClick={() => makeDecision(ov.override_id, 'custom', customVals[ov.override_id] || ov.override_value)} style={{ background: dec?.decision==='custom'?'#1B3A6B':'#F4F6FA', color: dec?.decision==='custom'?'white':'#1B3A6B', border:'1px solid #BFDBFE', borderRadius:5, padding:'3px 6px', fontSize:10, cursor:'pointer' }}>✏</button>
                              </div>
                            )}
                          </td>
                          <td style={{ padding:'8px 10px' }}>
                            {dec?.decision === 'custom' ? (
                              <input value={customVals[ov.override_id] || ''} onChange={e => {
                                setCustomVals(prev => ({ ...prev, [ov.override_id]: e.target.value }));
                                setDecisions(prev => ({ ...prev, [ov.override_id]: { decision:'custom', final_value: parseInt(e.target.value) } }));
                              }} style={{ width:70, padding:'4px 6px', border:'1px solid #1B3A6B', borderRadius:5, fontSize:11 }}/>
                            ) : (
                              <span style={{ fontSize:12, color:'var(--text-1)' }}>
                                {ov.final_override || dec?.final_value || '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ padding:'16px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                {!isReadOnly && (
                  <button onClick={handleConfirmAll} disabled={saving || Object.keys(decisions).length === 0} style={{
                    background: Object.keys(decisions).length > 0 ? '#16A34A' : '#E5E7EB',
                    color:      Object.keys(decisions).length > 0 ? 'white' : '#9CA3AF',
                    border:'none', borderRadius:8, padding:'10px 24px', fontSize:13, fontWeight:600,
                    cursor: Object.keys(decisions).length > 0 ? 'pointer' : 'not-allowed', minHeight:44,
                  }}>
                    {saving ? 'Saving…' : `✅ Confirm All Decisions (${Object.keys(decisions).length})`}
                  </button>
                )}
                {canResolve && allResolved && (
                  <button onClick={() => setShowSignoffModal(true)} style={{ background:'#16A34A', color:'white', border:'none', borderRadius:8, padding:'10px 24px', fontSize:13, fontWeight:600, cursor:'pointer', minHeight:44, marginLeft:'auto' }}>
                    ✅ Submit for Sign-off
                  </button>
                )}
                {canResolve && signedOff && (
                  <span style={{ fontSize:13, color:'#16A34A', fontWeight:600, marginLeft:'auto' }}>✅ Jun 2026 Signed Off</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sign-off modal */}
      {showSignoffModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setShowSignoffModal(false)}>
          <div style={{ background:'var(--card)', borderRadius:14, padding:'28px', maxWidth:400, width:'90%', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--text-1)', marginBottom:10 }}>Submit for Sign-off?</div>
            <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.6, marginBottom:22 }}>
              Submit Jun 2026 forecast for final sign-off? All conflicts resolved. This action is final.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowSignoffModal(false)} style={{ flex:1, background:'var(--bg)', border:'0.5px solid var(--border)', borderRadius:8, padding:'10px', cursor:'pointer', fontSize:13 }}>Cancel</button>
              <button onClick={handleSignoff} disabled={signingOff} style={{ flex:2, background:'#16A34A', color:'white', border:'none', borderRadius:8, padding:'10px', cursor:'pointer', fontWeight:600, fontSize:13 }}>
                {signingOff ? 'Submitting…' : '✅ Confirm Sign-off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thS = { padding:'10px 12px', textAlign:'right', fontSize:10, fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap' };
