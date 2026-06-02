import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
         ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, ReferenceLine } from 'recharts';
import KPICard from '../components/shared/KPICard';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/shared/PageHeader';
import { useIsMobile } from '../utils/useIsMobile';

/* ── Constants ── */
const CATEGORY_COLORS = ['#1B3A6B','#E31837','#16A34A','#D97706','#7C3AED','#0891B2'];

const CAT_COLORS = {
  'Direct Cool Refrigerator': { bg:'EFF6FF', text:'1D4ED8' },
  'Frost Free Refrigerator':  { bg:'F0FDFA', text:'0F766E' },
  'Washing Machine':          { bg:'F0FDF4', text:'166534' },
  'Air Conditioner':          { bg:'FFFBEB', text:'92400E' },
  'Microwave':                { bg:'FDF4FF', text:'7E22CE' },
  'Induction':                { bg:'FFF7ED', text:'9A3412' },
};

const MONTHS_FWD   = ['06-2026','07-2026','08-2026','09-2026','10-2026','11-2026'];
const MONTH_LABELS = ["Jun'26","Jul'26","Aug'26","Sep'26","Oct'26","Nov'26"];
const BRANCHES     = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];

const CAT_MAP = {
  'REF_190L_DirectCool':'Direct Cool Refrigerator', 'REF_240L_FrostFree':'Frost Free Refrigerator',
  'REF_340L_TripleDoor':'Frost Free Refrigerator',  'WM_7KG_TopLoad':'Washing Machine',
  'WM_8KG_FrontLoad':'Washing Machine',             'WM_6.5KG_SemiAuto':'Washing Machine',
  'AC_1.5T_Inverter':'Air Conditioner',             'AC_2.0T_Split':'Air Conditioner',
  'MW_25L_Convection':'Microwave',                  'IH_3B_SmartGlass':'Induction',
};
const SKU_META = {
  'REF_190L_DirectCool': { segment:'180-200L',  subsegment:'Single Door' },
  'REF_240L_FrostFree':  { segment:'240L',       subsegment:'Double Door' },
  'REF_340L_TripleDoor': { segment:'340L',       subsegment:'Triple Door' },
  'WM_7KG_TopLoad':      { segment:'7KG',        subsegment:'Top Load' },
  'WM_8KG_FrontLoad':    { segment:'8KG',        subsegment:'Front Load' },
  'WM_6.5KG_SemiAuto':   { segment:'6.5KG',      subsegment:'Semi-Automatic' },
  'AC_1.5T_Inverter':    { segment:'1.5 Ton',    subsegment:'Inverter Split' },
  'AC_2.0T_Split':       { segment:'2.0 Ton',    subsegment:'Split' },
  'MW_25L_Convection':   { segment:'25L',        subsegment:'Convection' },
  'IH_3B_SmartGlass':    { segment:'3 Burner',   subsegment:'Smart Glass' },
};

const BRANCH_ACC = {
  'Mumbai':    { acc:91.0, bias:2.3 }, 'New Delhi': { acc:85.1, bias:6.9 },
  'Kolkata':   { acc:81.0, bias:8.2 }, 'Chennai':   { acc:79.4, bias:9.1 },
  'Bangalore': { acc:89.2, bias:3.4 }, 'Hyderabad': { acc:83.5, bias:5.8 },
  'Pune':      { acc:88.0, bias:3.8 }, 'Ahmedabad': { acc:86.2, bias:4.5 },
};

/* Category offset applied on top of branch base to produce per-cell accuracy */
const CAT_OFFSET = {
  'Air Conditioner':          { acc: -2.0, bias:  0.8 },
  'Direct Cool Refrigerator': { acc:  1.5, bias: -0.5 },
  'Frost Free Refrigerator':  { acc: -0.5, bias:  0.3 },
  'Washing Machine':          { acc:  2.0, bias: -0.8 },
  'Microwave':                { acc: -3.5, bias:  1.5 },
  'Induction':                { acc: -5.0, bias:  2.0 },
};

const getBranchCatAcc = (branch, cat) => {
  const base     = BRANCH_ACC[branch]?.acc  ?? 85;
  const baseBias = BRANCH_ACC[branch]?.bias ?? 5;
  const offset   = CAT_OFFSET[cat] ?? { acc: 0, bias: 0 };
  return {
    acc:  Math.min(95, Math.max(70, base + offset.acc)).toFixed(1),
    bias: Math.max(0.5, baseBias + offset.bias).toFixed(1),
  };
};

const ALL_VIEWS = [
  { id:'india_total', label:'🌍 India Total' },
  { id:'category',    label:'📦 By Category' },
  { id:'branch',      label:'📍 By Branch' },
  { id:'branch_sku',  label:'🔖 Branch × SKU' },
];

/* ── Small shared UI pieces ── */
const AccPill = ({ val }) => {
  const n = parseFloat(val);
  const [color, bg] = n >= 88 ? ['#16A34A','#DCFCE7'] : n >= 80 ? ['#D97706','#FEF3C7'] : ['#DC2626','#FEE2E2'];
  return <span style={{ background:bg, color, borderRadius:10, padding:'2px 8px', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>{val}%</span>;
};

const BiasPill = ({ val }) => {
  const n = Math.abs(parseFloat(val));
  const [color, bg] = n < 5 ? ['#16A34A','#DCFCE7'] : n < 10 ? ['#D97706','#FEF3C7'] : ['#DC2626','#FEE2E2'];
  return <span style={{ background:bg, color, borderRadius:10, padding:'2px 8px', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>{parseFloat(val) >= 0 ? '+' : ''}{val}%</span>;
};

const CatBadge = ({ cat }) => {
  const c = CAT_COLORS[cat] || { bg:'F3F4F6', text:'374151' };
  return <span style={{ background:`#${c.bg}`, color:`#${c.text}`, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, whiteSpace:'nowrap' }}>{cat}</span>;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--card)', borderRadius:8, padding:'10px 14px', boxShadow:'var(--shadow-md)', borderLeft:'3px solid var(--navy-accent)', fontSize:12 }}>
      <div style={{ fontWeight:600, marginBottom:4, color:'var(--text-1)' }}>{label}</div>
      {payload.map((p, i) => p.value !== null && (
        <div key={i} style={{ color:p.color }}>{p.name}: <strong>{p.value?.toLocaleString('en-IN')}</strong></div>
      ))}
    </div>
  );
};

/* ── CSV download helper ── */
const downloadCSV = (headerRow, dataRows, filename) => {
  const lines = [headerRow.join(','), ...dataRows.map(r => r.map(v => `"${v}"`).join(','))];
  const blob = new Blob([lines.join('\n')], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

/* ── Expandable table row (category or branch parent) ── */
function ExpandableRow({ row, ri, nameEl, subRows, isExpanded, onToggle }) {
  return (
    <React.Fragment>
      <tr
        style={{ background: ri % 2 === 0 ? 'var(--card)' : '#FAFAFA', cursor:'pointer' }}
        onMouseEnter={e => e.currentTarget.style.background = '#F5F8FF'}
        onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? 'var(--card)' : '#FAFAFA'}
        onClick={onToggle}
      >
        <td style={{ ...tdStyle, textAlign:'left', fontWeight:600 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {isExpanded ? <ChevronDown size={13} color="#6B7280"/> : <ChevronRight size={13} color="#6B7280"/>}
            {nameEl || row.name}
          </div>
        </td>
        {row.vals.map((v, vi) => <td key={vi} style={tdStyle}>{v.toLocaleString('en-IN')}</td>)}
        <td style={{ ...tdStyle, fontWeight:700, background:'#EFF3FF', color:'var(--navy-accent)' }}>{row.total.toLocaleString('en-IN')}</td>
        <td style={tdStyle}><AccPill val={row.acc}/></td>
        <td style={tdStyle}><BiasPill val={row.bias}/></td>
      </tr>
      {isExpanded && subRows.map((sub, si) => (
        <tr key={`sub-${si}`} style={{ background:'#EFF6FF' }}>
          <td style={{ ...tdStyle, textAlign:'left', paddingLeft:28, fontSize:11, color:'var(--text-2)' }}>↳ {sub.name}</td>
          {sub.vals.map((v, vi) => <td key={vi} style={{ ...tdStyle, fontSize:11, color:'var(--text-2)' }}>{v.toLocaleString('en-IN')}</td>)}
          <td style={{ ...tdStyle, fontWeight:600, fontSize:11, color:'var(--navy-accent)' }}>{sub.total.toLocaleString('en-IN')}</td>
          <td style={tdStyle}><AccPill val={sub.acc}/></td>
          <td style={tdStyle}><BiasPill val={sub.bias}/></td>
        </tr>
      ))}
    </React.Fragment>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function ForecastingReport() {
  useEffect(() => { document.title = 'WhirlCast — Forecasting Report'; }, []);
  const { user }  = useAuth();
  const { toast } = useToast();
  const isMobile  = useIsMobile();

  const isBranchSales = user?.role === 'branch_sales';
  const myBranch      = user?.branch || 'Mumbai';

  const [viewMode, setViewMode]       = useState('branch_sku');
  const [data, setData]               = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [trendTimeRange, setTrendTimeRange] = useState('All');
  const [branchFilter, setBranchFilter]     = useState([]);
  const [showBranchMenu, setShowBranchMenu] = useState(false);

  useEffect(() => {
    const url = isBranchSales ? `/api/report?branch=${encodeURIComponent(myBranch)}` : '/api/report';
    const load = () => fetch(url).then(r => r.json()).then(setData).catch(console.error);
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [isBranchSales, myBranch]);

  if (!data) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:400, background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, border:'3px solid var(--navy-accent)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
        <div style={{ color:'var(--text-2)' }}>Loading report…</div>
      </div>
    </div>
  );

  /* ── Derived data ── */
  const kpis = data.kpis || {};
  const sparkUp   = [1,2,3,3.5,4,4.2,4.8,5.2].map(v => ({ v }));
  const sparkDown = [5,4.8,4.5,4.3,4.2,4.0,3.8,3.6].map(v => ({ v }));
  const sparkBias = [5,4.5,4.2,4,3.8,3.6,3.5,3.6].map(v => ({ v }));

  /* Override lookup map: overrideMap[branch][sku][month] = override_value */
  const overrideMap = {};
  (data.overrides || []).forEach(o => {
    if (!o.override_value) return;
    if (!overrideMap[o.branch]) overrideMap[o.branch] = {};
    if (!overrideMap[o.branch][o.sku]) overrideMap[o.branch][o.sku] = {};
    overrideMap[o.branch][o.sku][o.month] = o.override_value;
  });

  /* Branch × SKU rows — ALL 80 combinations */
  const ffData = data.by_branch_sku || data.futureForecast || [];
  const bskuMap = {};
  ffData.forEach(r => {
    const key = `${r.branch}|${r.sku}`;
    if (!bskuMap[key]) bskuMap[key] = { branch:r.branch, sku:r.sku, cat:r.category||CAT_MAP[r.sku]||'', segment:r.segment||SKU_META[r.sku]?.segment||'', subsegment:r.subsegment||SKU_META[r.sku]?.subsegment||'', months:{} };
    bskuMap[key].months[r.month] = r.value;
  });
  const allBskuRows = Object.values(bskuMap);

  /* India total row */
  const indiaRow = (() => {
    if (!data.india_total?.length) return { vals:MONTHS_FWD.map(()=>0), total:0 };
    const vals = MONTHS_FWD.map(m => data.india_total.find(r => r.month === m)?.value || 0);
    return { vals, total:vals.reduce((s,v) => s+v, 0) };
  })();

  /* Category rows */
  const categoryRows = (() => {
    if (!data.by_category?.length) return [];
    const cats = [...new Set(data.by_category.map(r => r.category))];
    return cats.map(cat => {
      const vals = MONTHS_FWD.map(m => data.by_category.find(r => r.category===cat && r.month===m)?.value || 0);
      const total = vals.reduce((s,v) => s+v, 0);
      const avgAcc  = (BRANCHES.reduce((s,b) => s + parseFloat(getBranchCatAcc(b,cat).acc),  0) / BRANCHES.length).toFixed(1);
      const avgBias = (BRANCHES.reduce((s,b) => s + parseFloat(getBranchCatAcc(b,cat).bias), 0) / BRANCHES.length).toFixed(1);
      return { name:cat, vals, total, acc:avgAcc, bias:avgBias };
    });
  })();

  /* Branch rows */
  const allBranchRows = (() => {
    if (!data.by_branch?.length) return [];
    return BRANCHES.filter(b => data.by_branch.some(r => r.branch === b)).map(br => {
      const vals  = MONTHS_FWD.map(m => data.by_branch.find(r => r.branch===br && r.month===m)?.value || 0);
      const total = vals.reduce((s,v) => s+v, 0);
      const a     = BRANCH_ACC[br];
      return { name:br, vals, total, acc:a.acc.toFixed(1), bias:a.bias.toFixed(1) };
    });
  })();
  const displayBranchRows = user?.role === 'branch_sales'
    ? allBranchRows.filter(r => r.name === (user.branch || 'Mumbai'))
    : allBranchRows;

  /* Sub-rows for By Category expand → show branches */
  const getCatBranchSubRows = catName =>
    BRANCHES.map(branch => {
      const vals  = MONTHS_FWD.map(m =>
        ffData.filter(r => CAT_MAP[r.sku] === catName && r.branch === branch && r.month === m)
              .reduce((s, r) => s + (r.value || 0), 0)
      );
      const total = vals.reduce((s,v) => s+v, 0);
      if (total === 0) return null;
      const { acc, bias } = getBranchCatAcc(branch, catName);
      return { name:branch, vals, total, acc, bias };
    }).filter(Boolean);

  /* Sub-rows for By Branch expand → show categories */
  const getBranchCatSubRows = branchName => {
    const cats = [...new Set(ffData.filter(r => r.branch === branchName).map(r => CAT_MAP[r.sku]).filter(Boolean))];
    return cats.map(cat => {
      const vals  = MONTHS_FWD.map(m =>
        ffData.filter(r => r.branch === branchName && CAT_MAP[r.sku] === cat && r.month === m)
              .reduce((s, r) => s + (r.value || 0), 0)
      );
      const total = vals.reduce((s,v) => s+v, 0);
      if (total === 0) return null;
      const { acc, bias } = getBranchCatAcc(branchName, cat);
      return { name:cat, vals, total, acc, bias };
    }).filter(Boolean);
  };

  /* ── Per-view CSV export ── */
  const exportTable = () => {
    const date = new Date().toISOString().slice(0,10);
    const filename = `WhirlCast_${viewMode}_${date}.csv`;
    const monthCols = MONTH_LABELS;

    if (viewMode === 'india_total') {
      downloadCSV(
        ['Period', ...monthCols, 'Total'],
        [['All India', ...indiaRow.vals, indiaRow.total]],
        filename
      );
    } else if (viewMode === 'category') {
      downloadCSV(
        ['Category', ...monthCols, 'Total', 'Accuracy%', 'BIAS%'],
        categoryRows.map(r => [r.name, ...r.vals, r.total, r.acc, r.bias]),
        filename
      );
    } else if (viewMode === 'branch') {
      downloadCSV(
        ['Branch', ...monthCols, 'Total', 'Accuracy%', 'BIAS%'],
        displayBranchRows.map(r => [r.name, ...r.vals, r.total, r.acc, r.bias]),
        filename
      );
    } else {
      downloadCSV(
        ['Branch', 'SKU', 'Category', 'Segment', 'Subsegment', ...monthCols, 'Total'],
        allBskuRows.map(r => {
          const vals  = MONTHS_FWD.map(m => overrideMap[r.branch]?.[r.sku]?.[m] ?? r.months[m] ?? 0);
          return [r.branch, r.sku, r.cat, r.segment||'', r.subsegment||'', ...vals, vals.reduce((s,v) => s+v, 0)];
        }),
        filename
      );
    }
    toast.success('CSV downloaded');
  };

  const cycleStatus = data?.cycle?.status;

  /* ── Shared table header for expandable views ── */
  const AccBiasHeader = ({ nameLabel }) => (
    <tr style={{ background:'#F8FAFC' }}>
      <th style={{ ...thStyle, textAlign:'left' }}>{nameLabel}</th>
      {MONTH_LABELS.map(m => <th key={m} style={thStyle}>{m}</th>)}
      <th style={{ ...thStyle, background:'var(--navy-accent)', color:'white' }}>Total</th>
      <th style={thStyle}>Acc%</th>
      <th style={thStyle}>Bias%</th>
    </tr>
  );

  /* ═══════════════════════════════════════════════════════════ RENDER */
  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth:1400, margin:'0 auto', background:'var(--bg)', minHeight:'calc(100vh - 52px)', paddingBottom: isMobile ? 80 : 24 }}>

      {/* 1. Page header */}
      <PageHeader
        title="Forecasting Report"
        subtitle="Jun 2026 – Nov 2026 · Baseline SARIMAX | Final"
        helpText="Finalized forecast across all branches, categories and SKUs. Use the view toggle to switch between India-level, category, branch, or full branch × SKU granularity. Override cells are highlighted in amber."
      />

      {/* Role banners */}
      {isBranchSales && (
        <div style={{ background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:10, padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:600, color:'#92400E' }}>
          <span>📍</span> {myBranch} Branch Report — Showing forecast for your branch only.
        </div>
      )}
      {user?.role === 'category_team' && (
        <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:600, color:'#1B3A6B' }}>
          <span>👁</span> Category Overview — Read Only
        </div>
      )}
      {user?.role === 'demand_planning' && (
        <div style={{
          background: cycleStatus === 'signed_off' ? '#F0FDF4' : '#FFFBEB',
          border: `1px solid ${cycleStatus === 'signed_off' ? '#BBF7D0' : '#FCD34D'}`,
          borderRadius:10, padding:'10px 16px', marginBottom:14,
          display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:600,
          color: cycleStatus === 'signed_off' ? '#16A34A' : '#D97706',
        }}>
          <span>{cycleStatus === 'signed_off' ? '✓' : '⚠'}</span>
          {cycleStatus === 'signed_off' ? 'Signed Off — Jun 2026'
            : cycleStatus === 'overrides_pending' ? 'Awaiting branch overrides'
            : 'Awaiting conflict resolution'}
        </div>
      )}

      {/* 2. View toggle (hidden for branch_sales) + 3. Export */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:8 }}>
        {!isBranchSales ? (
          <div style={{ display:'flex', gap:4, background:'var(--card)', borderRadius:12, padding:4, boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
            {ALL_VIEWS.map(tab => (
              <button key={tab.id}
                onClick={() => { setViewMode(tab.id); setExpandedRow(null); }}
                style={{
                  padding: isMobile ? '7px 10px' : '8px 16px',
                  borderRadius:9, fontSize:12,
                  fontWeight: viewMode === tab.id ? 700 : 400,
                  background: viewMode === tab.id ? 'var(--navy-accent)' : 'transparent',
                  color:      viewMode === tab.id ? 'white' : 'var(--text-2)',
                  border:'none', cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap',
                }}>
                {isMobile ? tab.label.replace(/^.+ /,'') : tab.label}
              </button>
            ))}
          </div>
        ) : <div/>}
        <button onClick={exportTable}
          style={{ background:'var(--card)', border:'0.5px solid var(--border)', borderRadius:8, padding:'8px 14px', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:6, color:'var(--text-1)', boxShadow:'var(--shadow-sm)' }}>
          <Download size={13}/> Export CSV
        </button>
      </div>

      {/* 4. Future Forecast table */}
      <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)', marginBottom:24 }}>
        <div style={{ padding:'14px 20px', borderBottom:'0.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
          <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:'var(--text-1)' }}>
            Future Forecast
            <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'var(--text-2)' }}>
              {viewMode === 'india_total' ? 'All India Aggregate'
                : viewMode === 'category' ? 'By Category — click a row to expand branches'
                : viewMode === 'branch'   ? 'By Branch — click a row to expand categories'
                : isBranchSales ? `${myBranch} · 10 SKUs · Branch × SKU level` : 'Branch × SKU · all 80 combinations'}
            </span>
          </h3>
          {viewMode === 'branch_sku' && (
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text-3)' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#F59E0B', display:'inline-block' }}/>
              Override applied
            </div>
          )}
        </div>

        {/* India Total */}
        {viewMode === 'india_total' && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:700 }}>
              <thead>
                <tr style={{ background:'#F8FAFC' }}>
                  <th style={{ ...thStyle, textAlign:'left' }}>Period</th>
                  {MONTH_LABELS.map(m => <th key={m} style={thStyle}>{m}</th>)}
                  <th style={{ ...thStyle, background:'var(--navy-accent)', color:'white' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background:'var(--card)' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F5F8FF'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--card)'}>
                  <td style={{ ...tdStyle, textAlign:'left', fontWeight:700 }}>All India</td>
                  {indiaRow.vals.map((v,i) => <td key={i} style={tdStyle}>{v.toLocaleString('en-IN')}</td>)}
                  <td style={{ ...tdStyle, fontWeight:700, background:'#EFF3FF', color:'var(--navy-accent)' }}>{indiaRow.total.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* By Category */}
        {viewMode === 'category' && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:840 }}>
              <thead><AccBiasHeader nameLabel="Category"/></thead>
              <tbody>
                {categoryRows.map((row, ri) => (
                  <ExpandableRow key={row.name} row={row} ri={ri}
                    nameEl={<CatBadge cat={row.name}/>}
                    isExpanded={expandedRow === row.name}
                    onToggle={() => setExpandedRow(expandedRow === row.name ? null : row.name)}
                    subRows={expandedRow === row.name ? getCatBranchSubRows(row.name) : []}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* By Branch */}
        {viewMode === 'branch' && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:840 }}>
              <thead><AccBiasHeader nameLabel="Branch"/></thead>
              <tbody>
                {displayBranchRows.map((row, ri) => (
                  <ExpandableRow key={row.name} row={row} ri={ri}
                    isExpanded={expandedRow === row.name}
                    onToggle={() => setExpandedRow(expandedRow === row.name ? null : row.name)}
                    subRows={expandedRow === row.name ? getBranchCatSubRows(row.name) : []}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Branch × SKU */}
        {viewMode === 'branch_sku' && (
          <div style={{ overflowX:'auto', maxHeight:460, overflowY:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth: isBranchSales ? 1050 : 1200 }}>
              <thead>
                <tr style={{ background:'#F8FAFC', position:'sticky', top:0, zIndex:1 }}>
                  {!isBranchSales && <th style={{ ...thStyle, textAlign:'left', position:'sticky', left:0,   background:'#F8FAFC', zIndex:2, minWidth:90 }}>Branch</th>}
                  <th style={{ ...thStyle, textAlign:'left', position:'sticky', left: isBranchSales?0:90,  background:'#F8FAFC', zIndex:2, minWidth:140 }}>SKU</th>
                  <th style={{ ...thStyle, textAlign:'left', position:'sticky', left: isBranchSales?140:230, background:'#F8FAFC', zIndex:2, minWidth:160 }}>Category</th>
                  <th style={{ ...thStyle, textAlign:'left', minWidth:120 }}>Segment</th>
                  <th style={{ ...thStyle, textAlign:'left', minWidth:130 }}>Subsegment</th>
                  {MONTH_LABELS.map(m => <th key={m} style={thStyle}>{m}</th>)}
                  <th style={{ ...thStyle, background:'var(--navy-accent)', color:'white' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {allBskuRows.map((row, ri) => {
                  const vals  = MONTHS_FWD.map(m => overrideMap[row.branch]?.[row.sku]?.[m] ?? row.months[m] ?? 0);
                  const total = vals.reduce((s,v) => s+v, 0);
                  return (
                    <tr key={ri}
                      style={{ background: ri % 2 === 0 ? 'var(--card)' : '#FAFAFA' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F5F8FF'}
                      onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? 'var(--card)' : '#FAFAFA'}>
                      {!isBranchSales && <td style={{ ...tdStyle, textAlign:'left', position:'sticky', left:0, background:'inherit', fontWeight:600 }}>{row.branch}</td>}
                      <td style={{ ...tdStyle, textAlign:'left', position:'sticky', left: isBranchSales?0:90,  background:'inherit', fontSize:11, color:'var(--text-2)', fontFamily:'monospace' }}>{row.sku}</td>
                      <td style={{ ...tdStyle, textAlign:'left', position:'sticky', left: isBranchSales?140:230, background:'inherit' }}><CatBadge cat={row.cat}/></td>
                      <td style={{ ...tdStyle, textAlign:'left', fontSize:11 }}>{row.segment}</td>
                      <td style={{ ...tdStyle, textAlign:'left', fontSize:11 }}>{row.subsegment}</td>
                      {MONTHS_FWD.map((m, mi) => {
                        const hasOv = overrideMap[row.branch]?.[row.sku]?.[m] !== undefined;
                        return (
                          <td key={mi} style={{ ...tdStyle, background: hasOv ? 'rgba(245,158,11,0.09)' : undefined }}>
                            {hasOv && <span style={{ width:6, height:6, borderRadius:'50%', background:'#F59E0B', display:'inline-block', marginRight:4, verticalAlign:'middle' }}/>}
                            {vals[mi].toLocaleString('en-IN')}
                          </td>
                        );
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

      {/* 5. KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        <KPICard title="Predicted Sales"
          subtitle={isBranchSales ? `${myBranch} branch · Branch × SKU level` : undefined}
          value={(kpis.totalUnits||124850).toLocaleString('en-IN')} trend={`↑ ${kpis.unitsTrend||8.2}%`} trendDirection="up" sparklineData={sparkUp} borderColor="var(--navy-accent)" />
        <KPICard title="Forecast Accuracy" value={`${kpis.accuracy||87.3}%`}      trend={`↓ ${Math.abs(kpis.accuracyTrend||1.2)}%`} trendDirection="down" sparklineData={sparkDown} borderColor="#D97706" />
        <KPICard title="Forecast BIAS"     value={`${kpis.bias||3.6}%`}            trend={`↓ ${Math.abs(kpis.biasTrend||0.6)}%`}     trendDirection="up"   sparklineData={sparkBias} borderColor="#16A34A" />
        <KPICard title="Predicted Revenue" value={`₹${kpis.revenue||148.2} Cr`}   trend={`↑ ${kpis.revenueTrend||11.4}%`}           trendDirection="up"   sparklineData={sparkUp}   borderColor="var(--red)" />
      </div>

      {/* 6. Trend chart + 7. Accuracy chart + 8. Category mix */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 1fr 1fr', gap:16 }}>

        <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:20, boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
          {/* Trend chart filter bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:'var(--text-1)' }}>Forecast vs Actual Trend</h3>
            <select value={trendTimeRange} onChange={e => setTrendTimeRange(e.target.value)}
              style={{ padding:'5px 10px', border:'0.5px solid var(--border)', borderRadius:7, fontSize:11, color:'var(--text-1)', background:'var(--card)', fontFamily:'Inter', outline:'none' }}>
              <option value="All">All (12M)</option>
              <option value="6M">Last 6M</option>
              <option value="3M">Last 3M</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart
              data={(() => {
                const all = (data.trendData||[]).map(d => ({...d, month: d.month?.replace('-2026',"'26").replace('-2025',"'25")}));
                const n = trendTimeRange === '3M' ? 3 : trendTimeRange === '6M' ? 6 : all.length;
                return all.slice(-n);
              })()}
              margin={{top:5,right:20,left:0,bottom:5}}>
              <defs>
                <linearGradient id="gradActual"   x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1A1A2E" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#1A1A2E" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1B3A6B" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#1B3A6B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="month" tick={{fontSize:10,fill:'var(--text-2)'}}/>
              <YAxis tick={{fontSize:10,fill:'var(--text-2)'}} tickFormatter={v => v ? (v/1000).toFixed(0)+'k' : ''}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend/>
              <ReferenceLine x="Jun'26" stroke="#9CA3AF" strokeDasharray="4 2" label={{value:'Today',fill:'#9CA3AF',fontSize:10}}/>
              <Area type="monotone" dataKey="actual"          name="Actual"          stroke="var(--text-1)"      strokeWidth={2} fill="url(#gradActual)"   dot={false}/>
              <Area type="monotone" dataKey="ai_forecast"     name="AI Forecast"     stroke="var(--navy-accent)" strokeWidth={2} fill="url(#gradForecast)" dot={false} strokeDasharray="5 3"/>
              <Line type="monotone" dataKey="after_overrides" name="After Overrides" stroke="var(--red)"         strokeWidth={2} strokeDasharray="5 3"     dot={false}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:20, boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, gap:8, flexWrap:'wrap' }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:'var(--text-1)' }}>
              {isBranchSales ? `${myBranch} — Accuracy by Category` : 'Accuracy by Branch'}
            </h3>
            {!isBranchSales && (
              <div style={{ position:'relative' }}>
                <button onClick={() => setShowBranchMenu(v => !v)} style={{ background:'var(--card)', border:'0.5px solid var(--border)', borderRadius:7, padding:'4px 10px', fontSize:11, cursor:'pointer', color:'var(--text-1)', display:'flex', alignItems:'center', gap:5 }}>
                  {branchFilter.length === 0 ? 'All Branches' : `${branchFilter.length} selected`} ▾
                </button>
                {showBranchMenu && (
                  <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, zIndex:50, background:'var(--card)', border:'0.5px solid var(--border)', borderRadius:8, boxShadow:'var(--shadow-md)', padding:'6px 0', minWidth:180, maxHeight:220, overflowY:'auto' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px', cursor:'pointer', fontSize:12 }}
                      onMouseEnter={e => e.currentTarget.style.background='#F5F8FF'} onMouseLeave={e => e.currentTarget.style.background=''}>
                      <input type="checkbox" checked={branchFilter.length===0} onChange={() => setBranchFilter([])} style={{ accentColor:'#1B3A6B', cursor:'pointer' }}/>
                      <em style={{ color:'var(--text-2)' }}>All Branches</em>
                    </label>
                    {BRANCHES.map(b => (
                      <label key={b} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px', cursor:'pointer', fontSize:12 }}
                        onMouseEnter={e => e.currentTarget.style.background='#F5F8FF'} onMouseLeave={e => e.currentTarget.style.background=''}>
                        <input type="checkbox" checked={branchFilter.includes(b)} style={{ accentColor:'#1B3A6B', cursor:'pointer' }}
                          onChange={e => setBranchFilter(v => e.target.checked ? [...v,b] : v.filter(x=>x!==b))}/>
                        {b}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {!isBranchSales && branchFilter.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
              {branchFilter.map(b => (
                <span key={b} style={{ background:'#EFF6FF', color:'#1B3A6B', border:'1px solid #BFDBFE', borderRadius:12, padding:'2px 8px', fontSize:10, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                  {b} <button onClick={() => setBranchFilter(v => v.filter(x=>x!==b))} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#1B3A6B', lineHeight:1, fontSize:13 }}>×</button>
                </span>
              ))}
            </div>
          )}
          <ResponsiveContainer width="100%" height={240}>
            {isBranchSales ? (
              <BarChart data={data.categoryAccuracy||[]} layout="vertical" margin={{top:5,right:30,left:100,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
                <XAxis type="number" domain={[70,100]} tick={{fontSize:9}} tickFormatter={v => `${v}%`}/>
                <YAxis type="category" dataKey="category" tick={{fontSize:9,fill:'var(--text-2)'}} width={95}/>
                <Tooltip formatter={v => `${v}%`}/>
                <Bar dataKey="accuracy" radius={[0,3,3,0]}>
                  {(data.categoryAccuracy||[]).map((e,i) => (
                    <Cell key={i} fill={e.accuracy >= 88 ? '#16A34A' : e.accuracy >= 80 ? '#D97706' : '#EA580C'}/>
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={(branchFilter.length ? (data.branchAccuracy||[]).filter(b => branchFilter.includes(b.branch)) : data.branchAccuracy||[])} layout="vertical" margin={{top:5,right:30,left:60,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
                <XAxis type="number" domain={[70,100]} tick={{fontSize:9}} tickFormatter={v => `${v}%`}/>
                <YAxis type="category" dataKey="branch" tick={{fontSize:10,fill:'var(--text-2)'}} width={55}/>
                <Tooltip formatter={v => `${v}%`}/>
                <Bar dataKey="accuracy" radius={[0,3,3,0]}>
                  {(data.branchAccuracy||[]).map((e,i) => (
                    <Cell key={i} fill={e.accuracy >= 85 ? '#16A34A' : e.accuracy >= 80 ? '#D97706' : '#EA580C'}/>
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:20, boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:600, color:'var(--text-1)' }}>Category Mix</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data.categoryMix||[]} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value">
                {(data.categoryMix||[]).map((_,i) => <Cell key={i} fill={CATEGORY_COLORS[i]}/>)}
              </Pie>
              <Tooltip formatter={v => `${v}%`}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {(data.categoryMix||[]).map((cat,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:CATEGORY_COLORS[i], flexShrink:0 }}/>
                <span style={{ flex:1, color:'var(--text-2)' }}>{cat.name}</span>
                <span style={{ fontWeight:600, color:'var(--text-1)' }}>{cat.value}%</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

const thStyle = { padding:'9px 12px', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-2)', background:'#F8FAFC', textAlign:'center', border:'1px solid var(--border)', whiteSpace:'nowrap' };
const tdStyle = { padding:'8px 12px', fontSize:12, color:'var(--text-1)', border:'1px solid var(--border)', textAlign:'center' };
