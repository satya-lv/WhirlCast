import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Trophy, CheckCircle, X } from 'lucide-react';
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Modal from '../components/shared/Modal';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/shared/PageHeader';

const MONTHS_FWD = ['06-2026','07-2026','08-2026','09-2026','10-2026','11-2026'];
const MONTH_LBL  = ["Jun'26","Jul'26","Aug'26","Sep'26","Oct'26","Nov'26"];
const BRANCHES   = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
const SKUS       = ['REF_190L_DirectCool','REF_240L_FrostFree','REF_340L_TripleDoor','WM_7KG_TopLoad','WM_8KG_FrontLoad','WM_6.5KG_SemiAuto','AC_1.5T_Inverter','AC_2.0T_Split','MW_25L_Convection','IH_3B_SmartGlass'];
const CAT_MAP    = { 'REF_190L_DirectCool':'Refrigerator','REF_240L_FrostFree':'Refrigerator','REF_340L_TripleDoor':'Refrigerator','WM_7KG_TopLoad':'Washing Machine','WM_8KG_FrontLoad':'Washing Machine','WM_6.5KG_SemiAuto':'Washing Machine','AC_1.5T_Inverter':'Air Conditioner','AC_2.0T_Split':'Air Conditioner','MW_25L_Convection':'Microwave','IH_3B_SmartGlass':'Induction' };
const CATEGORIES = ['All','Refrigerator','Washing Machine','Air Conditioner','Microwave','Induction'];
const LINE_COLORS = ['#1B3A6B','#E31837','#16A34A','#D97706','#7C3AED'];
const PAGE_SIZE  = 25;

const ALL_CATEGORIES_LIB = ['All','Air Conditioner','Direct Cool Refrigerator','Frost Free Refrigerator','Washing Machine','Microwave','Induction'];
const ALL_SEGMENTS_LIB   = ['All','1.5 Ton','2.0 Ton','180-200L','240L','340L','7KG','8KG','6.5KG','25L','3 Burner'];

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

const SEGMENT_MAP_SEL = {
  'Refrigerator':    ['180-200L','240L','340L'],
  'Washing Machine': ['7KG','8KG','6.5KG'],
  'Air Conditioner': ['1.5 Ton','2.0 Ton'],
  'Microwave':       ['25L'],
  'Induction':       ['3 Burner'],
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

const VIEW_LEVELS = ['Branch × SKU','Branch','Category','National'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#FFF', borderRadius:8, padding:'10px 14px', boxShadow:'0 4px 20px rgba(0,0,0,0.12)', borderLeft:'3px solid #1B3A6B', fontSize:12 }}>
      <div style={{ fontWeight:600, marginBottom:6 }}>{label}</div>
      {payload.map((p,i) => <div key={i} style={{ color:p.color }}>{p.name}: <strong>{p.value?.toLocaleString('en-IN')}</strong></div>)}
    </div>
  );
};

/* MultiSelect dropdown */
function MultiSelectDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const display = selected.length === 0 ? `All ${label}` : selected.length === options.length ? `All ${label}` : `${selected.length} selected`;
  return (
    <div style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ background:'var(--card)', border:'0.5px solid var(--border)', borderRadius:7, padding:'5px 10px', fontSize:12, cursor:'pointer', color:'var(--text-1)', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 }}>
        {display} ▾
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:60, background:'var(--card)', border:'0.5px solid var(--border)', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', padding:'6px 0', minWidth:200, maxHeight:220, overflowY:'auto' }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px', cursor:'pointer', fontSize:12 }}
            onMouseEnter={e => e.currentTarget.style.background='#F5F8FF'} onMouseLeave={e => e.currentTarget.style.background=''}>
            <input type="checkbox" checked={selected.length===0||selected.length===options.length}
              onChange={() => onChange([])} style={{ accentColor:'#1B3A6B', cursor:'pointer' }}/>
            <em style={{ color:'var(--text-2)' }}>All</em>
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

export default function ForecastSelection() {
  useEffect(() => { document.title = 'WhirlCast — Forecast Selection'; }, []);
  const { toast } = useToast();

  /* Library state */
  const [scenarios, setScenarios]     = useState([]);
  const [search, setSearch]           = useState('');
  const [filterAlgo, setFilterAlgo]   = useState('All');
  const [filterAcc,  setFilterAcc]    = useState('All');
  const [filterDate, setFilterDate]   = useState('All');
  const [filterBranch2, setFilterBranch2] = useState([]);
  const [filterCat2,  setFilterCat2]  = useState('All');
  const [filterSeg2,  setFilterSeg2]  = useState('All');
  const [sortBy,     setSortBy]       = useState('Newest');
  const [page,       setPage]         = useState(1);
  const [deletingId, setDeletingId]   = useState(null);
  const [selectedCompLines, setSelectedCompLines] = useState(null);

  /* Selection & comparison */
  const [selected,    setSelected]    = useState([]);
  const [comparison,  setComparison]  = useState(null);
  const [comparing,   setComparing]   = useState(false);

  /* Comparison filters */
  const [viewLevel,      setViewLevel]      = useState('Branch × SKU');
  const [compBranch,     setCompBranch]     = useState([]);
  const [compSku,        setCompSku]        = useState([]);
  const [compCat,        setCompCat]        = useState('All');
  const [compSegment,    setCompSegment]    = useState([]);
  const [compSubsegment, setCompSubsegment] = useState([]);

  /* Chart-level filters */
  const [trendScenFilter,  setTrendScenFilter]  = useState([]);
  const [trendTimeRange,   setTrendTimeRange]   = useState('All');
  const [accScenFilter,    setAccScenFilter]    = useState([]);
  const [accTimeRange,     setAccTimeRange]     = useState('All');

  /* Finalize */
  const [finalizing,     setFinalizing]     = useState(false);
  const [finalScenario,  setFinalScenario]  = useState('');
  const [showFinalModal, setShowFinalModal] = useState(false);

  useEffect(() => {
    fetch('/api/scenarios').then(r => r.json())
      .then(d => { setScenarios(d.scenarios||[]); if(d.scenarios?.length) setFinalScenario(d.scenarios[0]?.scenario_id); })
      .catch(console.error);
  }, []);

  /* ── Filtered + sorted scenario list ── */
  const filteredScenarios = useMemo(() => {
    let list = [...scenarios];
    if (search.trim()) list = list.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));
    if (filterAlgo !== 'All') list = list.filter(s => (s.algorithm_mix||'').includes(filterAlgo));
    if (filterAcc === '>85%') list = list.filter(s => (s.accuracy||0) > 85);
    else if (filterAcc === '75-85%') list = list.filter(s => (s.accuracy||0) >= 75 && (s.accuracy||0) <= 85);
    else if (filterAcc === '<75%') list = list.filter(s => (s.accuracy||0) < 75);
    if (filterBranch2.length > 0) list = list.filter(s => {
      if (!s.branch_filter) return true;
      const stored = s.branch_filter.split(',').map(b => b.trim());
      return filterBranch2.some(b => stored.includes(b));
    });
    if (filterCat2 !== 'All') list = list.filter(s => {
      if (!s.category_filter) return true;
      return s.category_filter.includes(filterCat2);
    });
    if (filterSeg2 !== 'All') list = list.filter(s => {
      if (!s.segment_filter) return true;
      return s.segment_filter.includes(filterSeg2);
    });
    if (filterDate === 'Today') {
      const today = new Date().toDateString();
      list = list.filter(s => new Date(s.created_at).toDateString() === today);
    } else if (filterDate === 'This week') {
      const cutoff = Date.now() - 7*24*3600*1000;
      list = list.filter(s => new Date(s.created_at) >= cutoff);
    } else if (filterDate === 'This month') {
      const now = new Date();
      list = list.filter(s => { const d=new Date(s.created_at); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); });
    }
    if (sortBy === 'Oldest') list.sort((a,b) => new Date(a.created_at)-new Date(b.created_at));
    else if (sortBy === 'Highest accuracy') list.sort((a,b) => (b.accuracy||0)-(a.accuracy||0));
    else if (sortBy === 'Most units') list.sort((a,b) => (b.total_units||0)-(a.total_units||0));
    else list.sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
    return list;
  }, [scenarios, search, filterAlgo, filterAcc, filterBranch2, filterCat2, filterSeg2, filterDate, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredScenarios.length / PAGE_SIZE));
  const pageScenarios = filteredScenarios.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const toggleSelect = id => setSelected(prev => prev.includes(id) ? prev.filter(i=>i!==id) : prev.length < 5 ? [...prev,id] : prev);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const resp = await fetch(`/api/scenarios/${id}`, { method: 'DELETE' });
      if (!resp.ok) { const e = await resp.json(); toast.error(e.error || 'Delete failed'); return; }
      setScenarios(prev => prev.filter(s => s.scenario_id !== id));
      setSelected(prev => prev.filter(i => i !== id));
      toast.success('Scenario deleted');
    } catch { toast.error('Delete failed'); }
    finally { setDeletingId(null); }
  };

  const handleCompare = async () => {
    if (selected.length < 2) { toast.warning('Select at least 2 scenarios'); return; }
    setComparing(true);
    try {
      const resp = await fetch('/api/scenarios/compare', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ scenario_ids:selected }) });
      const data = await resp.json();
      setComparison(data);
      setCompBranch([]); setCompSku([]); setCompCat('All'); setCompSegment([]); setCompSubsegment([]); setViewLevel('Branch × SKU');
    } catch { toast.error('Compare failed'); }
    finally { setComparing(false); }
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await fetch('/api/scenarios/finalize', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ scenario_id:finalScenario }) });
      toast.success('✅ Scenario finalized and pushed to 8 branches');
      setShowFinalModal(false);
      fetch('/api/scenarios').then(r=>r.json()).then(d=>setScenarios(d.scenarios||[]));
    } catch { toast.error('Finalize failed'); }
    finally { setFinalizing(false); }
  };

  /* ── Derived comparison data ── */
  const sc = comparison?.scenarios || [];
  const getVal = useCallback((runsArr, branch, sku, month) => {
    if (!runsArr) return 0;
    const row = runsArr.find(r => r.branch===branch && r.sku===sku && r.month===month);
    return row?.value || 0;
  }, []);

  /* Derived segment / subsegment options for comparison filter bar */
  const compSegmentOptions = compCat === 'All'
    ? Object.values(SEGMENT_MAP_SEL).flat()
    : (SEGMENT_MAP_SEL[compCat] || []);

  const compSubsegmentOptions = compSegment.length === 0
    ? compSegmentOptions.flatMap(seg => SUBSEGMENT_MAP[seg] || [])
    : compSegment.flatMap(seg => SUBSEGMENT_MAP[seg] || []);

  /* Effective filter sets (empty = all) */
  const effBranches = compBranch.length ? compBranch : BRANCHES;
  const effSkus = (compSku.length ? compSku : SKUS).filter(s => {
    if (compCat !== 'All' && CAT_MAP[s] !== compCat) return false;
    if (compSegment.length > 0) {
      const sd = SKU_DETAILS[s];
      if (!sd || !compSegment.includes(sd.segment)) return false;
    }
    if (compSubsegment.length > 0) {
      const sd = SKU_DETAILS[s];
      if (!sd || !compSubsegment.includes(sd.subsegment)) return false;
    }
    return true;
  });

  /* Chart lines — keys depend on View Level */
  const chartLineKeys = useMemo(() => {
    if (!sc.length) return [];
    if (viewLevel === 'Branch') {
      return sc.flatMap(s => effBranches.map(b => `${s.name} — ${b}`));
    }
    if (viewLevel === 'Category') {
      const cats = compCat === 'All' ? ['Refrigerator','Washing Machine','Air Conditioner','Microwave','Induction'] : [compCat];
      return sc.flatMap(s => cats.map(c => `${s.name} — ${c}`));
    }
    if (viewLevel === 'Branch × SKU') {
      return sc.flatMap(s => effBranches.flatMap(b => effSkus.map(sku => `${s.name} — ${sku} — ${b}`)));
    }
    return sc.map(s => s.name); // National
  }, [sc, viewLevel, effBranches, effSkus, compCat]);

  /* Active comparison lines (top-3 auto when no manual selection) */
  const activeCompLines = useMemo(() => selectedCompLines || chartLineKeys.slice(0, 3), [selectedCompLines, chartLineKeys]);

  /* Chart data — respects View Level */
  const chartData = useMemo(() => {
    if (!sc.length) return [];
    return MONTHS_FWD.map((m, mi) => {
      const row = { month: MONTH_LBL[mi] };
      if (viewLevel === 'Branch') {
        sc.forEach(s => effBranches.forEach(b => {
          row[`${s.name} — ${b}`] = effSkus.reduce((ss, sku) => ss + getVal(s.runs, b, sku, m), 0);
        }));
      } else if (viewLevel === 'Category') {
        const cats = compCat === 'All' ? ['Refrigerator','Washing Machine','Air Conditioner','Microwave','Induction'] : [compCat];
        sc.forEach(s => cats.forEach(cat => {
          const catSkus = effSkus.filter(sk => CAT_MAP[sk] === cat);
          row[`${s.name} — ${cat}`] = effBranches.reduce((sum, b) => sum + catSkus.reduce((ss, sku) => ss + getVal(s.runs, b, sku, m), 0), 0);
        }));
      } else if (viewLevel === 'Branch × SKU') {
        sc.forEach(s => effBranches.forEach(b => effSkus.forEach(sku => {
          const key = `${s.name} — ${sku} — ${b}`;
          if (activeCompLines.includes(key)) row[key] = getVal(s.runs, b, sku, m);
        })));
      } else {
        sc.forEach(s => {
          row[s.name] = effBranches.reduce((sum, b) => sum + effSkus.reduce((ss, sku) => ss + getVal(s.runs, b, sku, m), 0), 0);
        });
      }
      return row;
    });
  }, [sc, viewLevel, effBranches, effSkus, compCat, activeCompLines, getVal]);

  /* Deepdive table rows */
  const deepDiveRows = useMemo(() => {
    if (sc.length < 2) return [];
    const s1 = sc[0], s2 = sc[1];
    const rows = [];

    if (viewLevel === 'Branch × SKU') {
      effBranches.forEach(branch => effSkus.forEach(sku => {
        const v1 = MONTHS_FWD.map(m => getVal(s1.runs, branch, sku, m));
        const v2 = MONTHS_FWD.map(m => getVal(s2.runs, branch, sku, m));
        const t1 = v1.reduce((a,v)=>a+v,0), t2 = v2.reduce((a,v)=>a+v,0);
        rows.push({ label1:branch, label2:sku, v1, v2, t1, t2, delta: t1>0 ? ((t2-t1)/t1*100).toFixed(1) : '0.0' });
      }));
    } else if (viewLevel === 'Branch') {
      effBranches.forEach(branch => {
        const v1 = MONTHS_FWD.map(m => effSkus.reduce((a,sku)=>a+getVal(s1.runs,branch,sku,m),0));
        const v2 = MONTHS_FWD.map(m => effSkus.reduce((a,sku)=>a+getVal(s2.runs,branch,sku,m),0));
        const t1=v1.reduce((a,v)=>a+v,0), t2=v2.reduce((a,v)=>a+v,0);
        rows.push({ label1:branch, label2:'', v1, v2, t1, t2, delta: t1>0?((t2-t1)/t1*100).toFixed(1):'0.0' });
      });
    } else if (viewLevel === 'Category') {
      const cats = compCat === 'All' ? ['Refrigerator','Washing Machine','Air Conditioner','Microwave','Induction'] : [compCat];
      cats.forEach(cat => {
        const skusInCat = SKUS.filter(s => CAT_MAP[s]===cat);
        const v1 = MONTHS_FWD.map(m => effBranches.reduce((a,b)=>a+skusInCat.reduce((aa,sku)=>aa+getVal(s1.runs,b,sku,m),0),0));
        const v2 = MONTHS_FWD.map(m => effBranches.reduce((a,b)=>a+skusInCat.reduce((aa,sku)=>aa+getVal(s2.runs,b,sku,m),0),0));
        const t1=v1.reduce((a,v)=>a+v,0), t2=v2.reduce((a,v)=>a+v,0);
        rows.push({ label1:cat, label2:'', v1, v2, t1, t2, delta: t1>0?((t2-t1)/t1*100).toFixed(1):'0.0' });
      });
    } else {
      const v1 = MONTHS_FWD.map(m => effBranches.reduce((a,b)=>a+effSkus.reduce((aa,sku)=>aa+getVal(s1.runs,b,sku,m),0),0));
      const v2 = MONTHS_FWD.map(m => effBranches.reduce((a,b)=>a+effSkus.reduce((aa,sku)=>aa+getVal(s2.runs,b,sku,m),0),0));
      const t1=v1.reduce((a,v)=>a+v,0), t2=v2.reduce((a,v)=>a+v,0);
      rows.push({ label1:'National Total', label2:'', v1, v2, t1, t2, delta: t1>0?((t2-t1)/t1*100).toFixed(1):'0.0' });
    }
    return rows;
  }, [sc, viewLevel, effBranches, effSkus, compCat, getVal]);

  const getWinner = field => scenarios.reduce((best,s) => {
    if (field==='accuracy') return (!best||(s.accuracy||0)>(best.accuracy||0))?s:best;
    if (field==='revenue')  return (!best||(s.revenue||0)>(best.revenue||0))?s:best;
    if (field==='units')    return (!best||(s.total_units||0)>(best.total_units||0))?s:best;
    return best;
  }, null);

  /* Active filter pills for "Showing:" row */
  const activeBranches = compBranch.length ? compBranch : [];
  const activeSkus     = compSku.length ? compSku : [];

  /* ═══════════════════ RENDER */
  return (
    <div style={{ padding:'24px', maxWidth:1400, margin:'0 auto', background:'var(--bg)', minHeight:'calc(100vh - 52px)' }}>
      <PageHeader title="Forecast Selection"
        subtitle="Compare scenarios and finalize for Jun 2026 cycle"
        helpText="Compare up to 5 scenarios on accuracy, revenue and bias. Finalize one to push the forecast to all 8 branch managers."/>

      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:20, alignItems:'start' }}>

        {/* ── Left: Scenario Library ── */}
        <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:'14px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600 }}>Scenario Library</h3>
            <span style={{ background:'#1B3A6B', color:'white', borderRadius:12, padding:'1px 8px', fontSize:11 }}>{scenarios.length}</span>
          </div>

          {/* Search */}
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name..."
            style={{ width:'100%', padding:'7px 10px', border:'0.5px solid var(--border)', borderRadius:7, fontSize:12, color:'var(--text-1)', background:'var(--bg)', fontFamily:'Inter', outline:'none', boxSizing:'border-box', marginBottom:7 }}/>

          {/* Filter grid — 2 columns */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:6 }}>
            {[
              { label:'Algorithm', value:filterAlgo, set:v=>{setFilterAlgo(v);setPage(1);}, opts:['All','SARIMAX','RF','XGBoost','Prophet','Moving Average'] },
              { label:'Accuracy',  value:filterAcc,  set:v=>{setFilterAcc(v);setPage(1);},  opts:['All','>85%','75-85%','<75%'] },
              { label:'Sort',      value:sortBy,     set:v=>{setSortBy(v);setPage(1);},     opts:['Newest','Oldest','Highest accuracy','Most units'] },
              { label:'Category',  value:filterCat2, set:v=>{setFilterCat2(v);setPage(1);}, opts:ALL_CATEGORIES_LIB },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize:9, fontWeight:600, color:'var(--text-3)', marginBottom:2, textTransform:'uppercase', letterSpacing:'0.04em' }}>{f.label}</div>
                <select value={f.value} onChange={e=>f.set(e.target.value)} style={{ ...selStyle, width:'100%', fontSize:11, padding:'4px 5px' }}>
                  {f.opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Branch multi-select */}
          <div style={{ marginBottom:5 }}>
            <div style={{ fontSize:9, fontWeight:600, color:'var(--text-3)', marginBottom:2, textTransform:'uppercase', letterSpacing:'0.04em' }}>Branch</div>
            <MultiSelectDropdown label="Branches" options={BRANCHES} selected={filterBranch2} onChange={v=>{setFilterBranch2(v);setPage(1);}}/>
          </div>

          {/* Segment dropdown */}
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:9, fontWeight:600, color:'var(--text-3)', marginBottom:2, textTransform:'uppercase', letterSpacing:'0.04em' }}>Segment</div>
            <select value={filterSeg2} onChange={e=>{setFilterSeg2(e.target.value);setPage(1);}} style={{ ...selStyle, width:'100%', fontSize:11, padding:'4px 5px' }}>
              {ALL_SEGMENTS_LIB.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          {/* Count */}
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>
            Showing {Math.min(page*PAGE_SIZE, filteredScenarios.length)} of {filteredScenarios.length}
            {selected.length > 0 && <span style={{ marginLeft:6, color:'#1B3A6B', fontWeight:600 }}>· {selected.length} selected</span>}
          </div>

          {/* Compact scrollable list */}
          <div style={{ maxHeight:360, overflowY:'auto', border:'0.5px solid var(--border)', borderRadius:8 }}>
            {pageScenarios.length === 0 && (
              <div style={{ padding:24, textAlign:'center', color:'var(--text-2)', fontSize:12 }}>No scenarios match filters</div>
            )}
            {pageScenarios.map(s => {
              const isSel = selected.includes(s.scenario_id);
              const acc   = s.accuracy || 0;
              return (
                <div key={s.scenario_id}
                  onClick={() => toggleSelect(s.scenario_id)}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 10px', borderBottom:'0.5px solid var(--border)', background:isSel?'#EFF6FF':'var(--card)', cursor:'pointer', transition:'background 0.1s' }}
                  onMouseEnter={e => { if(!isSel) e.currentTarget.style.background='#F5F8FF'; }}
                  onMouseLeave={e => { if(!isSel) e.currentTarget.style.background='var(--card)'; }}>
                  <input type="checkbox" checked={isSel} readOnly style={{ accentColor:'#1B3A6B', width:12, height:12, flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
                    <div style={{ display:'flex', gap:4, alignItems:'center', marginTop:2, flexWrap:'wrap' }}>
                      <span style={{ fontSize:9, color:'var(--text-3)' }}>{new Date(s.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span>
                      <span style={{ background:'#E8EEF7', color:'#1B3A6B', borderRadius:4, padding:'0 4px', fontSize:9, fontWeight:600 }}>{s.algorithm_mix?.split('+')[0]?.trim()||'SARIMAX'}</span>
                      {s.segment_filter && <span style={{ background:'#F0FDFA', color:'#0F766E', borderRadius:4, padding:'0 4px', fontSize:9, fontWeight:600 }}>{s.segment_filter.split(',')[0]}</span>}
                      {s.branch_filter && <span style={{ background:'#FDF4FF', color:'#7C3AED', borderRadius:4, padding:'0 4px', fontSize:9, fontWeight:600 }}>{s.branch_filter.split(',').slice(0,2).join(',')}{s.branch_filter.split(',').length>2?'+':''}</span>}
                      {s.status==='finalized' && <span style={{ background:'#16A34A', color:'white', borderRadius:4, padding:'0 4px', fontSize:9 }}>Final</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, flexShrink:0, marginRight:4 }}>
                    <span style={{ background:acc>=85?'#F0FDF4':'#FFFBEB', color:acc>=85?'#16A34A':'#D97706', borderRadius:5, padding:'1px 5px', fontSize:10, fontWeight:700 }}>{acc.toFixed(1)}%</span>
                    <span style={{ fontSize:9, color:'var(--text-3)' }}>{(s.total_units||0).toLocaleString('en-IN')}u</span>
                  </div>
                  <div style={{ display:'flex', gap:2, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                    <button title="Select" onClick={() => toggleSelect(s.scenario_id)} style={{ background:'none', border:'none', cursor:'pointer', padding:3, color:'#6B7280', fontSize:13, lineHeight:1 }}>👁</button>
                    {s.status !== 'finalized' && (
                      <button title="Delete" onClick={() => handleDelete(s.scenario_id)} disabled={deletingId===s.scenario_id}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:3, color:'#DC2626', fontSize:13, lineHeight:1, opacity:deletingId===s.scenario_id?0.4:1 }}>🗑</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
              <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ ...btnSm, opacity:page===1?0.4:1 }}>← Prev</button>
              <span style={{ fontSize:11, color:'var(--text-3)' }}>Page {page}/{totalPages}</span>
              <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ ...btnSm, opacity:page===totalPages?0.4:1 }}>Next →</button>
            </div>
          )}

          <div style={{ marginTop:8, fontSize:11, color:'var(--text-3)', textAlign:'center' }}>Select 2–5 scenarios to compare</div>
          <button onClick={handleCompare} disabled={selected.length<2||comparing}
            style={{ background:selected.length>=2?'#1B3A6B':'#E5E7EB', color:selected.length>=2?'white':'var(--text-3)', border:'none', borderRadius:8, padding:'10px', width:'100%', marginTop:8, fontSize:13, fontWeight:600, cursor:selected.length>=2?'pointer':'not-allowed', fontFamily:'Inter' }}>
            {comparing ? 'Comparing...' : `Compare ${selected.length>=2?`(${selected.length})`:''}→`}
          </button>
        </div>

        {/* ── Right: Comparison ── */}
        <div>
          {!comparison && !comparing && (
            <div style={{ background:'var(--card)', borderRadius:12, padding:'80px 24px', textAlign:'center', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
              <Trophy size={48} color="#E5E7EB" style={{ marginBottom:16 }}/>
              <h3 style={{ color:'var(--text-2)', margin:'0 0 8px' }}>Select 2 or more scenarios to compare</h3>
              <p style={{ color:'var(--text-3)', fontSize:13, margin:0 }}>Check scenarios in the library and click Compare</p>
            </div>
          )}

          {comparison && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* Comparison filter row */}
              <div style={{ background:'var(--card)', borderRadius:10, padding:'12px 16px', border:'0.5px solid var(--border)', display:'flex', flexWrap:'wrap', gap:12, alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', marginBottom:3, textTransform:'uppercase' }}>View Level</div>
                  <select value={viewLevel} onChange={e=>setViewLevel(e.target.value)} style={{ ...selStyle, color:'#1D4ED8', background:'#EFF6FF', borderColor:'#BFDBFE', fontWeight:600 }}>
                    {VIEW_LEVELS.map(v=><option key={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', marginBottom:3, textTransform:'uppercase' }}>Branch</div>
                  <MultiSelectDropdown label="Branches" options={BRANCHES} selected={compBranch} onChange={setCompBranch}/>
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', marginBottom:3, textTransform:'uppercase' }}>Category</div>
                  <select value={compCat} onChange={e=>{ setCompCat(e.target.value); setCompSegment([]); setCompSubsegment([]); }} style={selStyle}>
                    {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', marginBottom:3, textTransform:'uppercase' }}>Segment</div>
                  <MultiSelectDropdown label="Segments" options={compSegmentOptions} selected={compSegment} onChange={v=>{ setCompSegment(v); setCompSubsegment([]); }}/>
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', marginBottom:3, textTransform:'uppercase' }}>Subsegment</div>
                  <MultiSelectDropdown label="Subsegments" options={compSubsegmentOptions} selected={compSubsegment} onChange={setCompSubsegment}/>
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', marginBottom:3, textTransform:'uppercase' }}>SKU</div>
                  <MultiSelectDropdown label="SKUs" options={SKUS} selected={compSku} onChange={setCompSku}/>
                </div>
              </div>

              {/* Winner cards — always India total */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                {[
                  { label:'Best Accuracy', field:'accuracy', fmt:s=>`${s.accuracy?.toFixed(1)}%` },
                  { label:'Best Revenue',  field:'revenue',  fmt:s=>`₹${(s.revenue||0).toLocaleString('en-IN')} Cr` },
                  { label:'Most Units',    field:'units',    fmt:s=>`${(s.total_units||0).toLocaleString('en-IN')} units` },
                ].map((item,i) => {
                  const winner = getWinner(item.field);
                  return (
                    <div key={i} className="fade-in-up" style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:'16px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)', borderTop:'3px solid #D97706', animationDelay:`${i*80}ms` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                        <Trophy size={14} color="#D97706"/>
                        <span style={{ fontSize:11, fontWeight:600, color:'#D97706', textTransform:'uppercase', letterSpacing:'0.04em' }}>{item.label}</span>
                      </div>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text-1)', marginBottom:4 }}>{winner?.name}</div>
                      <div style={{ fontSize:22, fontWeight:700, color:'#1B3A6B' }}>{winner?item.fmt(winner):'—'}</div>
                      <div style={{ fontSize:10, color:'var(--text-3)', marginTop:4 }}>India Total</div>
                    </div>
                  );
                })}
              </div>

              {/* "Showing:" active filter pills */}
              {(activeBranches.length > 0 || activeSkus.length > 0) && (
                <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, color:'var(--text-3)' }}>Showing:</span>
                  {activeBranches.map(b => (
                    <span key={b} style={{ background:'#EFF6FF', color:'#1B3A6B', border:'1px solid #BFDBFE', borderRadius:12, padding:'2px 8px', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                      {b} <X size={10} style={{ cursor:'pointer' }} onClick={()=>setCompBranch(v=>v.filter(x=>x!==b))}/>
                    </span>
                  ))}
                  {activeSkus.map(s => (
                    <span key={s} style={{ background:'#FFFBEB', color:'#92400E', border:'1px solid #FDE68A', borderRadius:12, padding:'2px 8px', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                      {s} <X size={10} style={{ cursor:'pointer' }} onClick={()=>setCompSku(v=>v.filter(x=>x!==s))}/>
                    </span>
                  ))}
                </div>
              )}

              {/* Trend chart */}
              <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:'20px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:8 }}>
                  <h3 style={{ margin:0, fontSize:14, fontWeight:600 }}>
                    Forecast Trend Comparison
                    <span style={{ marginLeft:8, fontSize:10, fontWeight:400, color:'var(--text-3)', background:'#F4F6FA', borderRadius:5, padding:'2px 7px' }}>{viewLevel}</span>
                  </h3>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {viewLevel === 'Branch × SKU' && (
                      <MultiSelectDropdown label="Lines" options={chartLineKeys} selected={selectedCompLines||[]} onChange={v=>setSelectedCompLines(v.length?v:null)}/>
                    )}
                    <select value={trendTimeRange} onChange={e => setTrendTimeRange(e.target.value)}
                      style={{ padding:'5px 8px', border:'0.5px solid var(--border)', borderRadius:7, fontSize:11, color:'var(--text-1)', background:'var(--card)', fontFamily:'Inter', outline:'none' }}>
                      <option value="All">All Months</option>
                      <option value="3M">Last 3M</option>
                      <option value="6M">Last 6M</option>
                    </select>
                  </div>
                </div>
                {/* Active line pills for Branch × SKU */}
                {viewLevel === 'Branch × SKU' && activeCompLines.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                    {activeCompLines.map((k, ki) => (
                      <span key={k} style={{ background:`${LINE_COLORS[ki%LINE_COLORS.length]}18`, color:LINE_COLORS[ki%LINE_COLORS.length], border:`1px solid ${LINE_COLORS[ki%LINE_COLORS.length]}40`, borderRadius:10, padding:'2px 8px', fontSize:10, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                        {k}
                        <button onClick={() => setSelectedCompLines(prev => { const cur = prev||activeCompLines; const next = cur.filter(l=>l!==k); return next.length?next:null; })} style={{ background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1, fontSize:13 }}>×</button>
                      </span>
                    ))}
                    {viewLevel === 'Branch × SKU' && selectedCompLines && (
                      <button onClick={() => setSelectedCompLines(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, color:'var(--text-3)', fontFamily:'Inter' }}>Reset to top-3</button>
                    )}
                  </div>
                )}
                <ResponsiveContainer width="100%" height={250}>
                  {(() => {
                    const displayKeys = viewLevel === 'Branch × SKU' ? activeCompLines : (trendScenFilter.length ? chartLineKeys.filter(k=>trendScenFilter.some(n=>k.startsWith(n))) : chartLineKeys);
                    const n = trendTimeRange === '3M' ? 3 : trendTimeRange === '6M' ? 6 : chartData.length;
                    return (
                      <ComposedChart data={chartData.slice(-n)} margin={{top:5,right:20,left:0,bottom:5}}>
                        <defs>
                          {displayKeys.map((k,ki) => (
                            <linearGradient key={ki} id={`scG${ki}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor={LINE_COLORS[ki%LINE_COLORS.length]} stopOpacity={0.15}/>
                              <stop offset="95%" stopColor={LINE_COLORS[ki%LINE_COLORS.length]} stopOpacity={0}/>
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                        <XAxis dataKey="month" tick={{fontSize:11,fill:'var(--text-2)'}}/>
                        <YAxis tick={{fontSize:11,fill:'var(--text-2)'}} tickFormatter={v=>(v/1000).toFixed(0)+'k'}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Legend wrapperStyle={{fontSize:10}}/>
                        {displayKeys.map((key,ki) => (
                          <Area key={key} type="monotone" dataKey={key} name={key} stroke={LINE_COLORS[ki%LINE_COLORS.length]} strokeWidth={2} fill={`url(#scG${ki})`} dot={false} isAnimationActive animationDuration={800} strokeDasharray={ki>0?'5 3':'none'}/>
                        ))}
                      </ComposedChart>
                    );
                  })()}
                </ResponsiveContainer>
              </div>

              {/* Accuracy & Bias trend */}
              {comparison.trendData && (
                <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:'20px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:8 }}>
                    <h3 style={{ margin:0, fontSize:14, fontWeight:600 }}>Accuracy & Bias Trend</h3>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <MultiSelectDropdown label="Scenarios" options={sc.map(s=>s.name)} selected={accScenFilter} onChange={setAccScenFilter}/>
                      <select value={accTimeRange} onChange={e => setAccTimeRange(e.target.value)}
                        style={{ padding:'5px 8px', border:'0.5px solid var(--border)', borderRadius:7, fontSize:11, color:'var(--text-1)', background:'var(--card)', fontFamily:'Inter', outline:'none' }}>
                        <option value="All">All Months</option>
                        <option value="3M">Last 3M</option>
                        <option value="6M">Last 6M</option>
                      </select>
                    </div>
                  </div>
                  {accScenFilter.length > 0 && accScenFilter.length < sc.length && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                      {accScenFilter.map((name) => (
                        <span key={name} style={{ background:'#EFF6FF', color:'#1B3A6B', border:'1px solid #BFDBFE', borderRadius:12, padding:'2px 8px', fontSize:10, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                          {name} <button onClick={() => setAccScenFilter(v=>v.filter(n=>n!==name))} style={{ background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1, fontSize:13 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height={180}>
                    {(() => {
                      const activeSc2 = accScenFilter.length ? sc.filter(s => accScenFilter.includes(s.name)) : sc;
                      const allTD = comparison.trendData;
                      const n2 = accTimeRange === '3M' ? 3 : accTimeRange === '6M' ? 6 : allTD.length;
                      return (
                        <ComposedChart data={allTD.slice(-n2)} margin={{top:5,right:20,left:0,bottom:5}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                          <XAxis dataKey="month" tick={{fontSize:10,fill:'var(--text-2)'}} tickFormatter={m=>m.replace('-2026',"'26")}/>
                          <YAxis tick={{fontSize:10,fill:'var(--text-2)'}}/>
                          <Tooltip content={<CustomTooltip/>}/>
                          <Legend/>
                          {activeSc2.map((s,si) => [
                            <Area key={`a${si}`} type="monotone" dataKey={`accuracy_s${si+1}`} name={`Acc ${s.name}`} stroke={LINE_COLORS[si]} strokeWidth={2} fill="none" dot={false}/>,
                            <Area key={`b${si}`} type="monotone" dataKey={`bias_s${si+1}`} name={`Bias ${s.name}`} stroke={LINE_COLORS[si]} strokeWidth={1.5} strokeDasharray="3 3" fill="none" dot={false}/>,
                          ])}
                        </ComposedChart>
                      );
                    })()}
                  </ResponsiveContainer>
                </div>
              )}

              {/* Deepdive table — Branch × SKU from forecast_runs */}
              <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:'20px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
                  <h3 style={{ margin:0, fontSize:14, fontWeight:600 }}>
                    Comparison Deepdive
                    <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'var(--text-2)' }}>
                      {viewLevel} — {sc[0]?.name} vs {sc[1]?.name}
                    </span>
                  </h3>
                  <span style={{ fontSize:11, color:'var(--text-3)' }}>{deepDiveRows.length} rows</span>
                </div>
                <div style={{ overflowX:'auto', maxHeight:400, overflowY:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11, minWidth:820 }}>
                    <thead>
                      <tr style={{ background:'#F8FAFC', position:'sticky', top:0, zIndex:1 }}>
                        {viewLevel === 'Branch × SKU' ? (
                          <>
                            <th style={{ ...thStyle, textAlign:'left', position:'sticky', left:0, background:'#F8FAFC', zIndex:2 }}>Branch</th>
                            <th style={{ ...thStyle, textAlign:'left', position:'sticky', left:80, background:'#F8FAFC', zIndex:2 }}>SKU</th>
                          </>
                        ) : (
                          <th style={{ ...thStyle, textAlign:'left' }}>{viewLevel === 'Branch' ? 'Branch' : viewLevel === 'Category' ? 'Category' : 'Level'}</th>
                        )}
                        {MONTH_LBL.map(m => <th key={m} style={thStyle}>{m}</th>)}
                        <th style={{ ...thStyle, background:'#1B3A6B', color:'white' }}>Total ({sc[1]?.name?.slice(0,8)||'S2'})</th>
                        <th style={{ ...thStyle }}>vs {sc[0]?.name?.slice(0,8)||'S1'} Δ%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deepDiveRows.map((row,ri) => {
                        const deltaNum = parseFloat(row.delta);
                        const deltaColor = deltaNum > 0 ? '#16A34A' : deltaNum < 0 ? '#DC2626' : '#6B7280';
                        return (
                          <tr key={ri} style={{ background:ri%2===0?'var(--card)':'#FAFAFA' }}
                            onMouseEnter={e=>e.currentTarget.style.background='#F5F8FF'}
                            onMouseLeave={e=>e.currentTarget.style.background=ri%2===0?'var(--card)':'#FAFAFA'}>
                            {viewLevel === 'Branch × SKU' ? (
                              <>
                                <td style={{ ...tdStyle, textAlign:'left', position:'sticky', left:0, background:'inherit', fontWeight:600 }}>{row.label1}</td>
                                <td style={{ ...tdStyle, textAlign:'left', position:'sticky', left:80, background:'inherit', fontSize:10, color:'var(--text-2)', fontFamily:'monospace' }}>{row.label2}</td>
                              </>
                            ) : (
                              <td style={{ ...tdStyle, textAlign:'left', fontWeight:600 }}>{row.label1}</td>
                            )}
                            {row.v2.map((v,vi) => <td key={vi} style={tdStyle}>{v.toLocaleString('en-IN')}</td>)}
                            <td style={{ ...tdStyle, fontWeight:700, background:'#EFF3FF', color:'#1B3A6B' }}>{row.t2.toLocaleString('en-IN')}</td>
                            <td style={{ ...tdStyle, fontWeight:600, color:deltaColor }}>
                              {deltaNum > 0 ? '+' : ''}{row.delta}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky finalize bar */}
      {scenarios.length > 0 && (
        <div style={{ position:'sticky', bottom:0, background:'var(--card)', borderTop:'1px solid var(--border)', padding:'12px 24px', display:'flex', alignItems:'center', gap:12, boxShadow:'0 -4px 12px rgba(0,0,0,0.08)', marginTop:20, borderRadius:'12px 12px 0 0' }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--text-2)' }}>Finalize:</div>
          <select value={finalScenario} onChange={e=>setFinalScenario(e.target.value)} style={{ ...selStyle, flex:1 }}>
            {scenarios.map(s=><option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>)}
          </select>
          <button onClick={() => setShowFinalModal(true)} style={{ background:'#E31837', color:'white', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap', fontFamily:'Inter', minHeight:44 }}>
            <CheckCircle size={14}/> Finalize & Push to Branches
          </button>
        </div>
      )}

      {/* Finalize Modal */}
      <Modal isOpen={showFinalModal} onClose={() => setShowFinalModal(false)} title="Finalize Forecast Scenario">
        {(() => {
          const sc = scenarios.find(s => s.scenario_id === parseInt(finalScenario));
          return (
            <div>
              <div style={{ background:'#F0FDF4', borderRadius:10, padding:'14px', marginBottom:16, border:'1px solid #BBF7D0' }}>
                <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>Finalizing: {sc?.name}</div>
                <div style={{ fontSize:12, color:'#6B7280' }}>Algorithm mix: {sc?.algorithm_mix}</div>
              </div>
              <ul style={{ margin:'0 0 16px', paddingLeft:20, fontSize:13, color:'var(--text-2)', lineHeight:2 }}>
                <li>Lock forecast for Jun 2026 cycle</li>
                <li>Notify 8 branch managers to review</li>
                <li>Create override records for 80 SKU-Branch combinations</li>
              </ul>
              <div style={{ background:'#F8FAFF', borderRadius:10, padding:'14px', marginBottom:20 }}>
                <div style={{ fontWeight:600, fontSize:13, marginBottom:8 }}>Forecast Summary:</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {[{label:'Total Units',val:sc?.total_units?.toLocaleString('en-IN')||'1,24,850'},{label:'Revenue',val:`₹${(sc?.revenue||14820).toLocaleString('en-IN')} Cr`},{label:'Accuracy',val:`${sc?.accuracy||87.3}%`}].map((item,i) => (
                    <div key={i} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:11, color:'#9CA3AF' }}>{item.label}</div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#1B3A6B', marginTop:2 }}>{item.val}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setShowFinalModal(false)} style={{ flex:1, background:'#F4F6FA', border:'1px solid #E5E7EB', borderRadius:8, padding:'10px', cursor:'pointer', fontFamily:'Inter', fontSize:13 }}>Cancel</button>
                <button onClick={handleFinalize} disabled={finalizing} style={{ flex:2, background:'#E31837', color:'white', border:'none', borderRadius:8, padding:'10px', cursor:'pointer', fontFamily:'Inter', fontSize:13, fontWeight:600 }}>
                  {finalizing ? 'Finalizing...' : '✅ Confirm & Push →'}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

const selStyle = { padding:'6px 8px', border:'0.5px solid var(--border)', borderRadius:7, fontSize:12, color:'var(--text-1)', background:'var(--card)', fontFamily:'Inter', outline:'none' };
const btnSm    = { background:'var(--bg)', border:'0.5px solid var(--border)', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer', fontFamily:'Inter', color:'var(--text-1)' };
const thStyle  = { padding:'7px 10px', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-2)', background:'#F8FAFC', textAlign:'center', border:'1px solid var(--border)', whiteSpace:'nowrap' };
const tdStyle  = { padding:'6px 10px', fontSize:11, color:'var(--text-1)', border:'1px solid var(--border)', textAlign:'center' };
