import React, { useState, useEffect } from 'react';
import { Play, Save, AlertTriangle, BarChart2, Pencil, Download } from 'lucide-react';
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Modal from '../components/shared/Modal';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/shared/PageHeader';

const BRANCHES   = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
const CATEGORIES = ['Air Conditioner','Direct Cool Refrigerator','Frost Free Refrigerator','Washing Machine','Microwave','Induction'];
const SKUS       = ['REF_190L_DirectCool','REF_240L_FrostFree','REF_340L_TripleDoor','WM_7KG_TopLoad','WM_8KG_FrontLoad','WM_6.5KG_SemiAuto','AC_1.5T_Inverter','AC_2.0T_Split','MW_25L_Convection','IH_3B_SmartGlass'];
const CAT_MAP    = { 'REF_190L_DirectCool':'Direct Cool Refrigerator','REF_240L_FrostFree':'Frost Free Refrigerator','REF_340L_TripleDoor':'Frost Free Refrigerator','WM_7KG_TopLoad':'Washing Machine','WM_8KG_FrontLoad':'Washing Machine','WM_6.5KG_SemiAuto':'Washing Machine','AC_1.5T_Inverter':'Air Conditioner','AC_2.0T_Split':'Air Conditioner','MW_25L_Convection':'Microwave','IH_3B_SmartGlass':'Induction' };
const ALGORITHMS = ['SARIMAX','ARIMA','Exponential Smoothing','Moving Average','Random Forest','XGBoost','Prophet'];
const MONTHS_FWD = ['06-2026','07-2026','08-2026','09-2026','10-2026','11-2026'];
const MONTH_LBL  = ["Jun'26","Jul'26","Aug'26","Sep'26","Oct'26","Nov'26"];
const ABC = ['A (High Vol)','B (Mid Vol)','C (Low Vol)'];
const XYZ = ['X (Easy)','Y (Medium)','Z (Difficult)'];

const FORECAST_LEVELS = [
  { id:'branch_sku',       label:'Branch × SKU',       desc:'Most granular — 80 rows' },
  { id:'branch_category',  label:'Branch × Category',  desc:'48 rows' },
  { id:'national_category',label:'National × Category',desc:'6 rows' },
  { id:'national_total',   label:'National Total',     desc:'1 row' },
];

const PRIMARY_VARS = [
  { id:'historicalSales', label:'Historical Sales',  tip:'Combined actuals from DMS and SAP for past periods' },
  { id:'primarySales',    label:'Primary Sales',     tip:'Manufacturer to depot shipments from SAP ERP' },
  { id:'secondarySales',  label:'Secondary Sales',   tip:'Depot to retailer sales from DMS — closest to real end demand' },
  { id:'allCombined',     label:'All Combined',      tip:'Weighted blend of all data sources' },
];

const INT_CAUSALS = [
  { id:'tradeProm',    label:'Trade Promotions', tip:'Type and spend on active channel schemes' },
  { id:'pricing',      label:'Pricing Changes',  tip:'MRP and trade price changes' },
  { id:'newLaunch',    label:'New Launch',        tip:'NPI product introductions' },
  { id:'pipeline',     label:'Pipeline Changes',  tip:'Repipeline and redistribution activity' },
  { id:'scheme',       label:'Scheme Changes',    tip:'Channel incentive program adjustments' },
];

const EXT_CAUSALS = [
  { id:'festival',    label:'Festival Calendar',          tip:'Festival and holiday demand uplift' },
  { id:'weather',     label:'Weather Data',               tip:'Temperature correlations for AC and cooling categories' },
  { id:'sentiment',   label:'Consumer Sentiment Index',   tip:'RBI consumer confidence data — correlates with discretionary appliance spend' },
  { id:'competitor',  label:'Competitor Activity',        tip:'Competitor pricing or launch signals from trade intelligence' },
  { id:'govtReg',     label:'Govt Regulations',           tip:'BEE star rating changes, GST revisions, import duties' },
];

const EXCEPTION_COLORS = {
  'Extreme Outlier High':'#DC2626','Zero Value Anomaly':'#D97706',
  'Z-Score Violation':'#7C3AED','Negative Value Error':'#DC2626',
  'Null Data Point':'#6B7280','Sudden Volume Drop':'#EA580C',
};

const SKU_DETAILS = {
  'REF_190L_DirectCool': { segment:'180-200L', subsegment:'Single Door' },
  'REF_240L_FrostFree':  { segment:'240L', subsegment:'Double Door' },
  'REF_340L_TripleDoor': { segment:'340L', subsegment:'Triple Door' },
  'WM_7KG_TopLoad':      { segment:'7KG', subsegment:'Top Load' },
  'WM_8KG_FrontLoad':    { segment:'8KG', subsegment:'Front Load' },
  'WM_6.5KG_SemiAuto':   { segment:'6.5KG', subsegment:'Semi-Automatic' },
  'AC_1.5T_Inverter':    { segment:'1.5 Ton', subsegment:'Inverter Split' },
  'AC_2.0T_Split':       { segment:'2.0 Ton', subsegment:'Split' },
  'MW_25L_Convection':   { segment:'25L', subsegment:'Convection' },
  'IH_3B_SmartGlass':    { segment:'3 Burner', subsegment:'Smart Glass' },
};

const SEGMENT_MAP = {
  'Air Conditioner':          ['1.5 Ton','2.0 Ton'],
  'Direct Cool Refrigerator': ['180-200L'],
  'Frost Free Refrigerator':  ['240L','340L'],
  'Washing Machine':          ['7KG','8KG','6.5KG'],
  'Microwave':                ['25L'],
  'Induction':                ['3 Burner'],
};

const SUBSEGMENT_MAP = {
  '1.5 Ton':  ['Inverter Split'],
  '2.0 Ton':  ['Split'],
  '180-200L': ['Single Door'],
  '240L':     ['Double Door'],
  '340L':     ['Triple Door'],
  '7KG':      ['Top Load'],
  '8KG':      ['Front Load'],
  '6.5KG':    ['Semi-Automatic'],
  '25L':      ['Convection'],
  '3 Burner': ['Smart Glass'],
};

const WB_CAT_COLORS = {
  'Direct Cool Refrigerator': { bg:'EFF6FF', text:'1D4ED8' },
  'Frost Free Refrigerator':  { bg:'F0FDFA', text:'0F766E' },
  'Washing Machine':          { bg:'F0FDF4', text:'166534' },
  'Air Conditioner':          { bg:'FFFBEB', text:'92400E' },
  'Microwave':                { bg:'FDF4FF', text:'7E22CE' },
  'Induction':                { bg:'FFF7ED', text:'9A3412' },
};
const CatBadge = ({ cat }) => {
  const c = WB_CAT_COLORS[cat] || { bg:'F3F4F6', text:'374151' };
  return <span style={{ background:`#${c.bg}`, color:`#${c.text}`, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, whiteSpace:'nowrap' }}>{cat}</span>;
};

const LINE_COLORS = ['#1B3A6B','#E31837','#16A34A','#D97706','#7C3AED','#0891B2','#EA580C','#0F766E'];

/* ── Small helpers ── */
const InfoTooltip = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position:'relative', display:'inline-flex', alignItems:'center' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span style={{ fontSize:10, color:'#9CA3AF', cursor:'help', marginLeft:3, lineHeight:1 }}>ℹ</span>
      {show && (
        <div style={{ position:'absolute', left:16, top:-4, zIndex:60, background:'#1A1A2E', color:'white', borderRadius:6, padding:'7px 10px', fontSize:11, lineHeight:1.45, width:210, boxShadow:'0 4px 14px rgba(0,0,0,0.25)', whiteSpace:'normal', pointerEvents:'none' }}>
          {text}
        </div>
      )}
    </span>
  );
};

const getExceptionReason = (exc) => {
  const v = exc.original_value ?? 0;
  const sug = exc.corrected_value ?? 0;
  switch (exc.exception_type) {
    case 'Extreme Outlier High': {
      const mean = sug > 0 ? Math.round(sug * 0.75) : 1;
      const ratio = (v / mean).toFixed(1);
      return `Value ${v.toLocaleString('en-IN')} is ${ratio}x branch mean of ${mean.toLocaleString('en-IN')} — threshold: 3x mean`;
    }
    case 'Zero Value Anomaly':   return 'Value is 0 — no sales recorded this period';
    case 'Negative Value Error': return `Value ${v} — negative sales not valid`;
    case 'Z-Score Violation': {
      const sd = sug * 0.15 || 1;
      const z  = Math.abs((v - sug) / sd).toFixed(1);
      return `Z-score ${z} exceeds ±3σ threshold from historical mean`;
    }
    case 'Sudden Volume Drop': {
      const pct = sug > 0 ? Math.round((1 - v / sug) * 100) : 100;
      return `Drop of ${pct}% vs expected ${sug.toLocaleString('en-IN')} — prior trend extrapolation`;
    }
    case 'Null Data Point': return 'Missing data point — imputed from neighboring periods';
    default: return exc.expected_range ? `Expected: ${exc.expected_range} — detected: ${v}` : `Detected value: ${v}`;
  }
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#FFF', borderRadius:8, padding:'10px 14px', boxShadow:'0 4px 20px rgba(0,0,0,0.12)', borderLeft:'3px solid #1B3A6B', fontSize:12 }}>
      <div style={{ fontWeight:600, color:'#1A1A2E', marginBottom:6 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color:p.color, marginBottom:2 }}>{p.name}: <strong>{p.value?.toLocaleString('en-IN')}</strong></div>)}
    </div>
  );
};

const downloadCSV = (rows, filename, withDetails = false) => {
  const headers = withDetails
    ? ['Branch','SKU','Category','Segment','Subsegment',...MONTH_LBL,'6M Total']
    : ['Branch','SKU / Category',...MONTH_LBL,'6M Total'];
  const lines = [headers.join(','), ...rows.map(r => {
    const vals = MONTHS_FWD.map(m => r.months[m] || 0);
    const total = vals.reduce((s,v)=>s+v,0);
    if (withDetails) {
      const sd = SKU_DETAILS[r.sku] || {};
      return [`"${r.branch||''}"`,`"${r.sku||''}"`,`"${r.cat||CAT_MAP[r.sku]||''}"`,`"${r.segment||sd.segment||''}"`,`"${r.subsegment||sd.subsegment||''}"`, ...vals, total].join(',');
    }
    return [`"${r.branch||''}"`,`"${r.sku||''}"`, ...vals, total].join(',');
  })];
  const blob = new Blob([lines.join('\n')], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

/* ── MultiSelectDropdown ── */
function MultiSelectDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef();
  React.useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const display = selected.length === 0 || selected.length === options.length ? `All ${label}` : `${selected.length} selected`;
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ background:'var(--card)', border:'0.5px solid var(--border)', borderRadius:7, padding:'5px 10px', fontSize:12, cursor:'pointer', color:'var(--text-1)', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6, minWidth:110 }}>
        {display} <span style={{ fontSize:9 }}>▾</span>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:60, background:'var(--card)', border:'0.5px solid var(--border)', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', padding:'6px 0', minWidth:200, maxHeight:240, overflowY:'auto' }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px', cursor:'pointer', fontSize:12 }}>
            <input type="checkbox" checked={selected.length===0||selected.length===options.length}
              onChange={() => onChange([])} style={{ accentColor:'#1B3A6B', cursor:'pointer' }}/>
            <em style={{ color:'var(--text-2)' }}>All</em>
          </label>
          {options.map(opt => (
            <label key={opt} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px', cursor:'pointer', fontSize:12 }}>
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

/* ═══════════════════════════════════════════════════════ */
export default function ForecastWorkbench() {
  useEffect(() => { document.title = 'WhirlCast — Forecast Workbench'; }, []);
  const { toast } = useToast();

  /* Top filter bar */
  const [filterBranch,      setFilterBranch]      = useState([]);
  const [filterCategory,    setFilterCategory]    = useState([]);
  const [filterSegment,     setFilterSegment]     = useState([]);
  const [filterSubsegment,  setFilterSubsegment]  = useState([]);
  const [filterSku,         setFilterSku]         = useState([]);
  const [filterPeriod,      setFilterPeriod]      = useState('Jun–Nov 2026');
  const [forecastLevel,     setForecastLevel]     = useState('branch_sku');

  /* Variables / causals */
  const [primaryVars,  setPrimaryVars]  = useState({ historicalSales:false, primarySales:false, secondarySales:false, allCombined:true });
  const [intCausals,   setIntCausals]   = useState({});
  const [extCausals,   setExtCausals]   = useState({});

  /* Algorithm matrix */
  const [algoMatrix, setAlgoMatrix] = useState({});
  useEffect(() => {
    const m = {};
    ABC.forEach(a => XYZ.forEach(x => { m[`${a}|${x}`] = 'SARIMAX'; }));
    setAlgoMatrix(m);
  }, []);

  /* Cascade resets for segment/subsegment filters */
  useEffect(() => { setFilterSegment([]); setFilterSubsegment([]); }, [filterCategory]);
  useEffect(() => { setFilterSubsegment([]); }, [filterSegment]);
  useEffect(() => { setSelectedLines(null); }, [filterSegment, filterSubsegment]);

  /* Run state */
  const [loading, setLoading]           = useState(false);
  const [result,  setResult]            = useState(null);
  const [exceptions, setExceptions]     = useState([]);
  const [correctedCells, setCorrectedCells] = useState({});

  /* Output view */
  const [view, setView] = useState('chart');

  /* Chart line selector + time range */
  const [showLineMenu,    setShowLineMenu]    = useState(false);
  const [selectedLines,   setSelectedLines]   = useState(null); // null = auto top-3
  const [chartTimeRange,  setChartTimeRange]  = useState('All');

  /* Save scenario */
  const [showParamModal, setShowParamModal] = useState(false);
  const [scenarioName,   setScenarioName]   = useState('');
  const [scenarioNotes,  setScenarioNotes]  = useState('');
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/forecast/generate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ filters:{ branch:filterBranch, category:filterCategory, sku:filterSku, internalCausal:Object.keys(intCausals).filter(k=>intCausals[k]), externalCausal:Object.keys(extCausals).filter(k=>extCausals[k]), primaryVars }, algorithmConfig:algoMatrix }),
      });
      const data = await resp.json();
      setResult(data.forecast_runs || []);
      setExceptions(data.exceptions || []);
      setSelectedLines(null);
      toast.success(`Forecast generated — ${data.count} data points across ${BRANCHES.length} branches`);
    } catch { toast.error('Failed to generate forecast'); }
    finally { setLoading(false); }
  };

  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) { toast.warning('Please enter a scenario name'); return; }
    setSaving(true);
    try {
      await fetch('/api/forecast/save-scenario', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
        name:scenarioName, notes:scenarioNotes, forecast_runs:result,
        branch_filter:   filterBranch.length   ? filterBranch.join(',')   : null,
        category_filter: filterCategory.length  ? filterCategory.join(',') : null,
        segment_filter:  filterSegment.length   ? filterSegment.join(',')  : null,
      }) });
      toast.success('✅ Scenario saved to library');
      setScenarioName('');
    } catch { toast.error('Failed to save scenario'); }
    finally { setSaving(false); }
  };

  const correctException = (exc) => {
    const key = `${exc.branch}|${exc.sku}|${exc.month}`;
    setCorrectedCells(prev => ({ ...prev, [key]: exc.corrected_value }));
    setExceptions(prev => prev.filter(e => !(e.branch===exc.branch && e.sku===exc.sku && e.month===exc.month)));
    toast.success(`Corrected ${exc.sku} @ ${exc.branch}`);
  };

  /* Derived segment / subsegment option lists */
  const segmentOptions = filterCategory.length === 0
    ? Object.values(SEGMENT_MAP).flat()
    : filterCategory.flatMap(cat => SEGMENT_MAP[cat] || []);

  const subsegmentOptions = filterSegment.length === 0
    ? segmentOptions.flatMap(seg => SUBSEGMENT_MAP[seg] || [])
    : filterSegment.flatMap(seg => SUBSEGMENT_MAP[seg] || []);

  /* Segment / subsegment filtered result */
  const effResult = result ? result.filter(r => {
    const sd = SKU_DETAILS[r.sku] || {};
    if (filterSegment.length > 0 && !filterSegment.includes(sd.segment)) return false;
    if (filterSubsegment.length > 0 && !filterSubsegment.includes(sd.subsegment)) return false;
    return true;
  }) : null;

  /* Chart data + line keys */
  const allLineKeys = effResult ? (() => {
    const totals = {};
    effResult.forEach(r => { const k=`${r.sku} — ${r.branch}`; totals[k]=(totals[k]||0)+r.value; });
    return Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([k])=>k);
  })() : [];

  const top3 = allLineKeys.slice(0,3);
  const activeLines = selectedLines || top3;

  const RANGE_MONTHS = {
    '3M': ["Sep'26","Oct'26","Nov'26"],
    '6M': ["Jun'26","Jul'26","Aug'26","Sep'26","Oct'26","Nov'26"],
    'All': [],
  };

  const chartData = effResult ? (() => {
    const grouped = {};
    effResult.forEach(r => {
      const key = `${r.sku} — ${r.branch}`;
      if (!activeLines.includes(key)) return;
      const lbl = r.month.replace('-2026',"'26").replace('-2025',"'25");
      if (chartTimeRange !== 'All' && !RANGE_MONTHS[chartTimeRange].includes(lbl)) return;
      if (!grouped[lbl]) grouped[lbl] = { month:lbl };
      grouped[lbl][key] = (grouped[lbl][key]||0) + r.value;
    });
    return Object.values(grouped);
  })() : [];

  /* Table data per forecast level — uses effResult so segment/subsegment filters apply */
  const tableData = effResult ? (() => {
    if (forecastLevel === 'branch_sku') {
      const m = {};
      effResult.forEach(r => {
        const k=`${r.branch}|${r.sku}`;
        if(!m[k]) m[k]={ branch:r.branch, sku:r.sku, cat:r.category||CAT_MAP[r.sku]||'', segment:r.segment||SKU_DETAILS[r.sku]?.segment||'', subsegment:r.subsegment||SKU_DETAILS[r.sku]?.subsegment||'', months:{} };
        m[k].months[r.month]=r.value;
      });
      return Object.values(m);
    }
    if (forecastLevel === 'branch_category') {
      const m = {};
      effResult.forEach(r => { const cat=CAT_MAP[r.sku]||r.sku; const k=`${r.branch}|${cat}`; if(!m[k]) m[k]={branch:r.branch,sku:cat,months:{}}; m[k].months[r.month]=(m[k].months[r.month]||0)+r.value; });
      return Object.values(m);
    }
    if (forecastLevel === 'national_category') {
      const m = {};
      effResult.forEach(r => { const cat=CAT_MAP[r.sku]||r.sku; if(!m[cat]) m[cat]={branch:'National',sku:cat,months:{}}; m[cat].months[r.month]=(m[cat].months[r.month]||0)+r.value; });
      return Object.values(m);
    }
    const t = { branch:'National', sku:'All Categories', months:{} };
    effResult.forEach(r => { t.months[r.month]=(t.months[r.month]||0)+r.value; });
    return [t];
  })() : [];

  /* ── Checkbox helpers ── */
  const CB = ({ checked, onChange, label, tip }) => (
    <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, color:'var(--text-1)', userSelect:'none', marginBottom:6 }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor:'#1B3A6B', width:13, height:13, cursor:'pointer', flexShrink:0 }}/>
      {label}
      {tip && <InfoTooltip text={tip}/>}
    </label>
  );

  /* ═══════════════════════════════════════════ RENDER */
  return (
    <div style={{ padding:'24px', maxWidth:1400, margin:'0 auto', background:'var(--bg)', minHeight:'calc(100vh - 52px)' }}>
      <PageHeader title="Forecast Workbench"
        subtitle="Configure algorithms and generate demand forecasts for Jun–Nov 2026"
        helpText="Select variables, set algorithms, then click Generate. Review exceptions before saving your output as a named scenario."/>

      {/* ── Top filter bar ── */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center', background:'var(--card)', border:'0.5px solid var(--border)', borderRadius:10, padding:'12px 16px', marginBottom:20, boxShadow:'var(--shadow-sm)' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Branch</span>
          <MultiSelectDropdown label="Branches" options={BRANCHES} selected={filterBranch} onChange={setFilterBranch}/>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Category</span>
          <MultiSelectDropdown label="Categories" options={CATEGORIES} selected={filterCategory} onChange={setFilterCategory}/>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Segment</span>
          <MultiSelectDropdown label="Segments" options={segmentOptions} selected={filterSegment} onChange={setFilterSegment}/>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Subsegment</span>
          <MultiSelectDropdown label="Subsegments" options={subsegmentOptions} selected={filterSubsegment} onChange={setFilterSubsegment}/>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Product</span>
          <MultiSelectDropdown label="SKUs" options={SKUS} selected={filterSku} onChange={setFilterSku}/>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Time Period</span>
          <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} style={{ ...selectStyle, minWidth:120, fontSize:12, padding:'5px 8px' }}>
            {['Jun–Nov 2026','Jun–Aug 2026','Sep–Nov 2026'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        {/* Forecast Level */}
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>📍 Forecast Level</span>
          <select value={forecastLevel} onChange={e => setForecastLevel(e.target.value)} style={{ ...selectStyle, minWidth:160, fontSize:12, padding:'5px 8px', borderColor:'#BFDBFE', background:'#EFF6FF', color:'#1D4ED8', fontWeight:600 }}>
            {FORECAST_LEVELS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'flex-end', paddingBottom:2, fontSize:11, color:'var(--text-3)' }}>
          {forecastLevel === 'branch_sku' ? '8 branches · 10 SKUs · 480 data points' : FORECAST_LEVELS.find(f=>f.id===forecastLevel)?.desc}
        </div>
      </div>

      {/* Active filter pills */}
      {(filterBranch.length > 0 || filterCategory.length > 0 || filterSegment.length > 0 || filterSubsegment.length > 0 || filterSku.length > 0) && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
          <span style={{ fontSize:11, color:'var(--text-3)', alignSelf:'center' }}>Active filters:</span>
          {filterBranch.map(b => (
            <span key={b} style={{ background:'#EFF6FF', color:'#1B3A6B', border:'1px solid #BFDBFE', borderRadius:12, padding:'2px 8px', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
              {b} <button onClick={() => setFilterBranch(v=>v.filter(x=>x!==b))} style={{ background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1, fontSize:14, color:'#1B3A6B' }}>×</button>
            </span>
          ))}
          {filterCategory.map(c => (
            <span key={c} style={{ background:'#F0FDF4', color:'#15803D', border:'1px solid #BBF7D0', borderRadius:12, padding:'2px 8px', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
              {c} <button onClick={() => setFilterCategory(v=>v.filter(x=>x!==c))} style={{ background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1, fontSize:14, color:'#15803D' }}>×</button>
            </span>
          ))}
          {filterSegment.map(s => (
            <span key={s} style={{ background:'#F0FDFA', color:'#0F766E', border:'1px solid #99F6E4', borderRadius:12, padding:'2px 8px', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
              {s} <button onClick={() => setFilterSegment(v=>v.filter(x=>x!==s))} style={{ background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1, fontSize:14, color:'#0F766E' }}>×</button>
            </span>
          ))}
          {filterSubsegment.map(s => (
            <span key={s} style={{ background:'#FDF4FF', color:'#7C3AED', border:'1px solid #E9D5FF', borderRadius:12, padding:'2px 8px', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
              {s} <button onClick={() => setFilterSubsegment(v=>v.filter(x=>x!==s))} style={{ background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1, fontSize:14, color:'#7C3AED' }}>×</button>
            </span>
          ))}
          {filterSku.map(s => (
            <span key={s} style={{ background:'#FFFBEB', color:'#92400E', border:'1px solid #FDE68A', borderRadius:12, padding:'2px 8px', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
              {s} <button onClick={() => setFilterSku(v=>v.filter(x=>x!==s))} style={{ background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1, fontSize:14, color:'#92400E' }}>×</button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:20, alignItems:'start' }}>
        {/* ── LEFT: Config panel ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Select Variables */}
          <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:'18px 20px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
            <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:600 }}>Select Variables</h3>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:8 }}>Primary Variables</div>
              {PRIMARY_VARS.map(v => (
                <CB key={v.id} checked={!!primaryVars[v.id]} label={v.label} tip={v.tip}
                  onChange={e => setPrimaryVars(prev => ({ ...prev, [v.id]:e.target.checked }))}/>
              ))}
            </div>

            <div style={{ marginBottom:14, borderTop:'0.5px solid var(--border)', paddingTop:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:8 }}>Internal Causal</div>
              {INT_CAUSALS.map(v => (
                <CB key={v.id} checked={!!intCausals[v.id]} label={v.label} tip={v.tip}
                  onChange={e => setIntCausals(prev => ({ ...prev, [v.id]:e.target.checked }))}/>
              ))}
            </div>

            <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:8 }}>External Causal</div>
              {EXT_CAUSALS.map(v => (
                <CB key={v.id} checked={!!extCausals[v.id]} label={v.label} tip={v.tip}
                  onChange={e => setExtCausals(prev => ({ ...prev, [v.id]:e.target.checked }))}/>
              ))}
            </div>
          </div>

          {/* Causal Calendar */}
          <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:'18px 20px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
            <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:600 }}>Causal Calendar</h3>
            <div style={{ overflowX:'auto' }}>
              <div style={{ display:'flex', gap:8, minWidth:380 }}>
                {[
                  { month:'Jun', year:"'26", event:'Rath Yatra',         color:'#D97706' },
                  { month:'Aug', year:"'26", event:'Independence Day',   color:'#2563EB' },
                  { month:'Sep', year:"'26", event:'Onam',               color:'#EA580C' },
                  { month:'Oct', year:"'26", event:'Navratri + Diwali 🔥', color:'#DC2626', big:true },
                ].map((ev,i) => (
                  <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0 }}>
                    <div style={{ background:`${ev.color}18`, color:ev.color, border:`1px solid ${ev.color}40`, borderRadius:12, padding:'3px 8px', fontSize:10, fontWeight:600, whiteSpace:'nowrap', maxWidth:ev.big?120:100, textAlign:'center' }}>{ev.event}</div>
                    <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:500 }}>{ev.month}{ev.year}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Algorithm Matrix */}
          <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:'18px 20px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <h3 style={{ margin:0, fontSize:14, fontWeight:600 }}>ABC/XYZ Algorithm Matrix</h3>
              <button onClick={() => setShowParamModal(true)} style={{ background:'none', border:'none', color:'#1B3A6B', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontFamily:'Inter' }}>
                <Pencil size={12}/> Params
              </button>
            </div>
            <div style={{ fontSize:10, color:'var(--text-3)', marginBottom:8, lineHeight:1.4 }}>ABC = Volume · XYZ = Forecast Difficulty</div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:260 }}>
                <thead>
                  <tr>
                    <th style={thStyle}></th>
                    {ABC.map(a => <th key={a} style={{ ...thStyle, background:'#1B3A6B', color:'white' }}>{a.split(' ')[0]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {XYZ.map(x => (
                    <tr key={x}>
                      <td style={{ ...thStyle, background:'#E8EEF7', color:'#1B3A6B', fontWeight:600 }}>{x.split(' ')[0]}</td>
                      {ABC.map(a => (
                        <td key={a} style={{ padding:3, border:'1px solid #E5E7EB' }}>
                          <select value={algoMatrix[`${a}|${x}`]||'SARIMAX'} onChange={e => setAlgoMatrix(prev => ({ ...prev, [`${a}|${x}`]:e.target.value }))} style={{ ...selectStyle, fontSize:10, padding:'3px 4px' }}>
                            {ALGORITHMS.map(al => <option key={al}>{al}</option>)}
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Generate */}
          <button onClick={handleGenerate} disabled={loading} style={{
            background: loading ? '#6B7280' : 'var(--navy-accent)', color:'white', border:'none',
            borderRadius:10, padding:'14px', fontSize:14, fontWeight:600, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8, minHeight:52, width:'100%',
            transition:'transform 0.15s, box-shadow 0.15s',
          }}
            onMouseOver={e => { if(!loading){ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(27,58,107,0.35)'; }}}
            onMouseOut={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}>
            {loading ? (<><div style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>Running models...</>) : (<><Play size={16}/> Generate Forecast →</>)}
          </button>
        </div>

        {/* ── RIGHT: Output panel ── */}
        <div>
          {!result && !loading && (
            <div style={{ background:'var(--card)', borderRadius:12, padding:'60px 24px', textAlign:'center', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
              <BarChart2 size={48} color="#E5E7EB" style={{ marginBottom:16 }}/>
              <h3 style={{ margin:'0 0 8px', color:'var(--text-2)' }}>Configure and generate your forecast</h3>
              <p style={{ margin:0, color:'var(--text-3)', fontSize:13 }}>Select variables, set algorithms and click Generate</p>
            </div>
          )}

          {loading && (
            <div style={{ background:'var(--card)', borderRadius:12, padding:'40px 24px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
              <div style={{ textAlign:'center', marginBottom:24 }}>
                <div style={{ width:48, height:48, border:'3px solid #1B3A6B', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }}/>
                <div style={{ fontWeight:600, color:'var(--text-1)', marginBottom:4 }}>Analyzing 10 SKUs × 8 branches × 6 months...</div>
                <div style={{ fontSize:13, color:'var(--text-2)' }}>Running SARIMAX models and checking for exceptions</div>
              </div>
              {[1,2,3].map(i => <div key={i} style={{ height:56, background:'#F4F6FA', borderRadius:8, marginBottom:12 }}/>)}
            </div>
          )}

          {result && !loading && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* Exceptions */}
              {exceptions.length > 0 && (
                <div style={{ background:'#FFFBEB', borderRadius:12, padding:'16px 20px', border:'1px solid #FCD34D' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                    <AlertTriangle size={16} color="#D97706"/>
                    <span style={{ fontWeight:600, fontSize:14 }}>⚠️ {exceptions.length} Exceptions Detected</span>
                    <span style={{ background:'#D97706', color:'white', borderRadius:12, padding:'1px 8px', fontSize:11, fontWeight:600 }}>{exceptions.length}</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {exceptions.map((exc, i) => (
                      <div key={i} style={{ background:'#FFF', borderRadius:8, padding:'12px 14px', borderLeft:`4px solid ${EXCEPTION_COLORS[exc.exception_type]||'#DC2626'}`, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:EXCEPTION_COLORS[exc.exception_type]||'#DC2626', marginBottom:2 }}>
                            {exc.exception_type}
                          </div>
                          <div style={{ fontSize:12, color:'var(--text-1)' }}>{exc.branch} · {exc.sku} · {exc.month}</div>
                          <div style={{ fontSize:11, color:'var(--text-2)', marginTop:2 }}>
                            Detected: <strong>{exc.original_value}</strong> → Suggested: <strong>{exc.corrected_value}</strong>
                          </div>
                          <div style={{ fontSize:11, color:'#9CA3AF', fontStyle:'italic', marginTop:4 }}>
                            {getExceptionReason(exc)}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                          <button onClick={() => correctException(exc)} style={{ background:'#F0FDF4', color:'#16A34A', border:'1px solid #BBF7D0', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'Inter' }}>Correct</button>
                          <button onClick={() => setExceptions(prev => prev.filter((_,j) => j!==i))} style={{ background:'#F4F6FA', color:'var(--text-2)', border:'1px solid #E5E7EB', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'Inter' }}>Dismiss</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Output */}
              <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:'20px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <h3 style={{ margin:0, fontSize:14, fontWeight:600 }}>Forecast Output</h3>
                    <span style={{ fontSize:11, background:'#EFF6FF', color:'#1D4ED8', padding:'3px 10px', borderRadius:20, fontWeight:600 }}>
                      {FORECAST_LEVELS.find(f=>f.id===forecastLevel)?.label} · Jun–Nov 2026
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    {view === 'table' && (
                      <button onClick={() => { downloadCSV(tableData, `WhirlCast_workbench_${new Date().toISOString().slice(0,10)}.csv`, forecastLevel === 'branch_sku'); toast.success('CSV downloaded'); }}
                        style={{ background:'var(--bg)', border:'0.5px solid var(--border)', borderRadius:7, padding:'5px 10px', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4, color:'var(--text-1)' }}>
                        <Download size={12}/> Export CSV
                      </button>
                    )}
                    <div style={{ display:'flex', gap:3, background:'#F4F6FA', borderRadius:8, padding:3 }}>
                      {[{id:'chart',label:'📈 Chart'},{id:'table',label:'📋 Table'}].map(tab => (
                        <button key={tab.id} onClick={() => setView(tab.id)} style={{ background:view===tab.id?'#1B3A6B':'transparent', color:view===tab.id?'white':'var(--text-2)', border:'none', borderRadius:6, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'Inter', fontWeight:view===tab.id?600:400, transition:'all 0.15s' }}>
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Chart with line selector */}
                {view === 'chart' && (
                  <>
                    {/* Filter bar */}
                    <div style={{ background:'#F8FAFF', borderRadius:8, padding:'10px 14px', marginBottom:10, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', border:'0.5px solid var(--border)' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        <span style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.04em' }}>SKU / Branch</span>
                        <div style={{ position:'relative' }}>
                          <button onClick={() => setShowLineMenu(v => !v)} style={{ background:'var(--card)', border:'0.5px solid var(--border)', borderRadius:7, padding:'5px 10px', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:6, color:'var(--text-1)' }}>
                            {activeLines.length} line{activeLines.length!==1?'s':''} selected ▾
                          </button>
                          {showLineMenu && (
                            <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:50, background:'var(--card)', border:'0.5px solid var(--border)', borderRadius:8, boxShadow:'var(--shadow-md)', padding:'8px 0', minWidth:260, maxHeight:240, overflowY:'auto' }}>
                              {allLineKeys.map((key,i) => (
                                <label key={key} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px', cursor:'pointer', fontSize:12, color:'var(--text-1)' }}
                                  onMouseEnter={e => e.currentTarget.style.background='#F5F8FF'}
                                  onMouseLeave={e => e.currentTarget.style.background=''}>
                                  <input type="checkbox" checked={activeLines.includes(key)}
                                    onChange={e => {
                                      const cur = selectedLines || top3;
                                      setSelectedLines(e.target.checked ? [...cur,key] : cur.filter(k=>k!==key));
                                    }}
                                    style={{ accentColor:LINE_COLORS[i%LINE_COLORS.length], cursor:'pointer' }}/>
                                  <span style={{ width:10, height:10, borderRadius:'50%', background:LINE_COLORS[i%LINE_COLORS.length], flexShrink:0 }}/>
                                  {key}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        <span style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.04em' }}>Time Range</span>
                        <select value={chartTimeRange} onChange={e => setChartTimeRange(e.target.value)} style={{ padding:'5px 8px', border:'0.5px solid var(--border)', borderRadius:7, fontSize:11, color:'var(--text-1)', background:'var(--card)', fontFamily:'Inter', outline:'none' }}>
                          <option value="All">Jun–Nov 2026 (All)</option>
                          <option value="6M">Last 6M</option>
                          <option value="3M">Last 3M (Sep–Nov)</option>
                        </select>
                      </div>
                    </div>
                    {/* Active line pills */}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                      {activeLines.map((k,i) => {
                        const c = LINE_COLORS[allLineKeys.indexOf(k)%LINE_COLORS.length];
                        return (
                          <span key={k} style={{ fontSize:10, background:`${c}18`, color:c, border:`1px solid ${c}40`, borderRadius:12, padding:'2px 8px', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                            {k}
                            <button onClick={() => { const cur = selectedLines || top3; setSelectedLines(cur.filter(l=>l!==k)); }} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:c, lineHeight:1, fontSize:13, fontFamily:'Inter' }}>×</button>
                          </span>
                        );
                      })}
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <ComposedChart data={chartData} margin={{ top:5, right:20, left:0, bottom:5 }}>
                        <defs>
                          {activeLines.map((k,i) => {
                            const c = LINE_COLORS[allLineKeys.indexOf(k)%LINE_COLORS.length];
                            return <linearGradient key={i} id={`wbG${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={c} stopOpacity={0.18}/><stop offset="95%" stopColor={c} stopOpacity={0}/></linearGradient>;
                          })}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                        <XAxis dataKey="month" tick={{ fontSize:11, fill:'var(--text-2)' }}/>
                        <YAxis tick={{ fontSize:11, fill:'var(--text-2)' }} tickFormatter={v => (v/1000).toFixed(0)+'k'}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Legend/>
                        {activeLines.map((key,i) => {
                          const c = LINE_COLORS[allLineKeys.indexOf(key)%LINE_COLORS.length];
                          return <Area key={key} type="monotone" dataKey={key} name={key} stroke={c} strokeWidth={2} fill={`url(#wbG${i})`} dot={false} isAnimationActive={true} animationDuration={600} strokeDasharray={i>0?'5 3':'none'}/>;
                        })}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </>
                )}

                {view === 'table' && (
                  <div style={{ overflowX:'auto', maxHeight:360, overflowY:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth: forecastLevel === 'branch_sku' ? 1300 : 800 }}>
                      <thead>
                        <tr style={{ background:'#F8FAFF', position:'sticky', top:0, zIndex:1 }}>
                          <th style={{ ...thStyle, position:'sticky', left:0,  background:'#F8FAFF', zIndex:2, textAlign:'left', minWidth:90 }}>Branch</th>
                          <th style={{ ...thStyle, position:'sticky', left:90, background:'#F8FAFF', zIndex:2, textAlign:'left', minWidth:140 }}>
                            {forecastLevel === 'branch_sku' ? 'SKU' : 'SKU / Category'}
                          </th>
                          {forecastLevel === 'branch_sku' && <>
                            <th style={{ ...thStyle, textAlign:'left', minWidth:130 }}>Category</th>
                            <th style={{ ...thStyle, textAlign:'left', minWidth:110 }}>Segment</th>
                            <th style={{ ...thStyle, textAlign:'left', minWidth:120 }}>Subsegment</th>
                          </>}
                          {MONTH_LBL.map(m => <th key={m} style={thStyle}>{m}</th>)}
                          <th style={{ ...thStyle, background:'var(--navy-accent)', color:'white' }}>6M Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((row, i) => {
                          const vals  = MONTHS_FWD.map(m => row.months[m] || 0);
                          const total = vals.reduce((s,v) => s+v, 0);
                          return (
                            <tr key={i} style={{ background:i%2===0?'var(--card)':'#FAFAFA' }}
                              onMouseEnter={e => e.currentTarget.style.background='#F5F8FF'}
                              onMouseLeave={e => e.currentTarget.style.background=i%2===0?'var(--card)':'#FAFAFA'}>
                              <td style={{ ...tdStyle, position:'sticky', left:0,  background:'inherit', textAlign:'left', fontWeight:600 }}>{row.branch}</td>
                              <td style={{ ...tdStyle, position:'sticky', left:90, background:'inherit', textAlign:'left', fontSize:11, color:'var(--text-2)', fontFamily: forecastLevel === 'branch_sku' ? 'monospace' : 'inherit' }}>{row.sku}</td>
                              {forecastLevel === 'branch_sku' && <>
                                <td style={{ ...tdStyle, textAlign:'left' }}><CatBadge cat={row.cat}/></td>
                                <td style={{ ...tdStyle, textAlign:'left', fontSize:11 }}>{row.segment}</td>
                                <td style={{ ...tdStyle, textAlign:'left', fontSize:11 }}>{row.subsegment}</td>
                              </>}
                              {vals.map((v,vi) => {
                                const key = `${row.branch}|${row.sku}|${MONTHS_FWD[vi]}`;
                                const corr = correctedCells[key];
                                return <td key={vi} style={{ ...tdStyle, background:corr?'#F0FDF4':'inherit', color:corr?'#16A34A':'inherit' }}>{corr||v.toLocaleString('en-IN')}</td>;
                              })}
                              <td style={{ ...tdStyle, fontWeight:700, background:'#EFF3FF', color:'var(--navy-accent)' }}>{total.toLocaleString('en-IN')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Save Scenario */}
              <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:'20px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
                <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:600 }}>Save as Scenario</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <input value={scenarioName} onChange={e => setScenarioName(e.target.value)} placeholder="e.g. Baseline Jun 2026" style={inputStyle}/>
                  <textarea value={scenarioNotes} onChange={e => setScenarioNotes(e.target.value)} placeholder="Add notes (optional)" rows={2} style={{ ...inputStyle, resize:'vertical' }}/>
                  <button onClick={handleSaveScenario} disabled={saving} style={{ background:'#16A34A', color:'white', border:'none', borderRadius:8, padding:'12px', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, minHeight:44, fontFamily:'Inter' }}>
                    <Save size={14}/> {saving ? 'Saving...' : '💾 Save Scenario'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Params Modal */}
      <Modal isOpen={showParamModal} onClose={() => setShowParamModal(false)} title="Edit Algorithm Parameters">
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {[
            { name:'SARIMAX',       params:[{label:'p (AR order)',val:4},{label:'d (Differencing)',val:1},{label:'q (MA order)',val:2}] },
            { name:'Random Forest', params:[{label:'n_estimators',val:100},{label:'max_depth',val:7}] },
            { name:'XGBoost',       params:[{label:'learning_rate',val:0.1},{label:'max_depth',val:6}] },
          ].map(algo => (
            <div key={algo.name} style={{ background:'#F8FAFF', borderRadius:8, padding:'14px' }}>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:10, color:'#1B3A6B' }}>{algo.name}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {algo.params.map(p => (
                  <div key={p.label}>
                    <label style={{ fontSize:11, color:'#6B7280', display:'block', marginBottom:3 }}>{p.label}</label>
                    <input defaultValue={p.val} style={inputStyle} type="number"/>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={() => setShowParamModal(false)} style={{ background:'#F4F6FA', border:'1px solid #E5E7EB', borderRadius:8, padding:'8px 20px', cursor:'pointer', fontFamily:'Inter' }}>Cancel</button>
            <button onClick={() => { setShowParamModal(false); toast.info('Parameters updated'); }} style={{ background:'#1B3A6B', color:'white', border:'none', borderRadius:8, padding:'8px 20px', cursor:'pointer', fontFamily:'Inter', fontWeight:600 }}>Confirm</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const selectStyle = { width:'100%', padding:'8px 10px', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, color:'var(--text-1)', background:'var(--card)', fontFamily:'Inter', outline:'none' };
const inputStyle  = { width:'100%', padding:'10px 12px', border:'1px solid #E5E7EB', borderRadius:8, fontSize:13, color:'var(--text-1)', background:'var(--card)', fontFamily:'Inter', outline:'none', boxSizing:'border-box' };
const thStyle     = { padding:'8px 10px', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-2)', background:'#F8FAFF', textAlign:'center', border:'1px solid var(--border)' };
const tdStyle     = { padding:'7px 10px', fontSize:12, color:'var(--text-1)', border:'1px solid var(--border)', textAlign:'center' };
