import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, ReferenceLine } from 'recharts';
import KPICard from '../components/shared/KPICard';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/shared/PageHeader';
import { useIsMobile } from '../utils/useIsMobile';

const CATEGORY_COLORS = ['#1B3A6B','#E31837','#16A34A','#D97706','#7C3AED','#0891B2'];
const CAT_COLORS = {
  'Direct Cool Refrigerator': { bg:'EFF6FF', text:'1D4ED8' },
  'Frost Free Refrigerator':  { bg:'F0FDFA', text:'0F766E' },
  'Washing Machine':          { bg:'F0FDF4', text:'166534' },
  'Air Conditioner':          { bg:'FFFBEB', text:'92400E' },
  'Microwave':                { bg:'FDF4FF', text:'7E22CE' },
  'Induction':                { bg:'FFF7ED', text:'9A3412' },
};
const CatBadge = ({ cat }) => {
  const c = CAT_COLORS[cat] || { bg:'F3F4F6', text:'374151' };
  return <span style={{ background:`#${c.bg}`, color:`#${c.text}`, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20, whiteSpace:'nowrap' }}>{cat}</span>;
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

const CAT_ACC = {
  'Air Conditioner':          { acc:'85.2', bias:'4.1' },
  'Direct Cool Refrigerator': { acc:'88.4', bias:'3.2' },
  'Frost Free Refrigerator':  { acc:'86.7', bias:'5.1' },
  'Washing Machine':          { acc:'89.1', bias:'2.8' },
  'Microwave':                { acc:'82.3', bias:'6.4' },
  'Induction':                { acc:'80.1', bias:'7.2' },
};

const BRANCH_ACC = {
  'Mumbai':    { acc:'91.0', bias:'2.3' }, 'New Delhi': { acc:'85.1', bias:'6.9' },
  'Kolkata':   { acc:'81.0', bias:'8.2' }, 'Chennai':   { acc:'79.4', bias:'9.1' },
  'Bangalore': { acc:'89.2', bias:'3.4' }, 'Hyderabad': { acc:'83.5', bias:'5.8' },
  'Pune':      { acc:'88.0', bias:'3.8' }, 'Ahmedabad': { acc:'86.2', bias:'4.5' },
};

const ALL_VIEWS = [
  { id:'india_total', label:'🌍 India Total' },
  { id:'category',    label:'📦 By Category' },
  { id:'branch',      label:'📍 By Branch' },
  { id:'branch_sku',  label:'🔖 Branch × SKU' },
];

/* ── Pill helpers ── */
const AccPill = ({ val }) => {
  const n = parseFloat(val);
  const [color, bg] = n >= 88 ? ['#16A34A','#DCFCE7'] : n >= 80 ? ['#D97706','#FEF3C7'] : ['#DC2626','#FEE2E2'];
  return <span style={{ background:bg, color, borderRadius:10, padding:'2px 8px', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>{val}%</span>;
};

const BiasPill = ({ val }) => {
  const n = Math.abs(parseFloat(val));
  const [color, bg] = n < 5 ? ['#16A34A','#DCFCE7'] : n < 10 ? ['#D97706','#FEF3C7'] : ['#DC2626','#FEE2E2'];
  return <span style={{ background:bg, color, borderRadius:10, padding:'2px 8px', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>{parseFloat(val)>=0?'+':''}{val}%</span>;
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

export default function ForecastingReport() {
  const { user }  = useAuth();
  const { toast } = useToast();
  const isMobile  = useIsMobile();

  const defaultView = user?.role === 'branch_sales' ? 'branch'
    : user?.role === 'category_team' ? 'category' : 'branch_sku';
  const [viewMode, setViewMode] = useState(defaultView);

  const [data, setData]                     = useState(null);
  const [horizon, setHorizon]               = useState('6M');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [expandedRow, setExpandedRow]       = useState(null);

  useEffect(() => {
    const load = () => fetch('/api/report').then(r => r.json()).then(setData).catch(console.error);
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const handleExport = async () => {
    try {
      const resp = await fetch('/api/report/export', { method:'POST' });
      const csv  = await resp.text();
      const blob = new Blob([csv], { type:'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = 'DemandIQ_Forecast_May2026.csv'; a.click();
      toast.success('CSV downloaded');
    } catch { toast.error('Export failed'); }
  };

  if (!data) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:400, background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, border:'3px solid var(--navy-accent)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
        <div style={{ color:'var(--text-2)' }}>Loading report…</div>
      </div>
    </div>
  );

  const kpis      = data.kpis || {};
  const sparkUp   = [1,2,3,3.5,4,4.2,4.8,5.2].map(v => ({ v }));
  const sparkDown = [5,4.8,4.5,4.3,4.2,4.0,3.8,3.6].map(v => ({ v }));
  const sparkBias = [5,4.5,4.2,4,3.8,3.6,3.5,3.6].map(v => ({ v }));

  /* Live table data derived from API */
  const ffData = data.by_branch_sku?.length ? data.by_branch_sku : (data.futureForecast || []);

  const indiaRow = (() => {
    if (!data.india_total?.length) return { name:'All India', vals:MONTHS_FWD.map(()=>0), total:0 };
    const vals = MONTHS_FWD.map(m => data.india_total.find(r=>r.month===m)?.value||0);
    return { name:'All India', vals, total:vals.reduce((s,v)=>s+v,0) };
  })();

  const categoryRows = (() => {
    if (!data.by_category?.length) return [];
    const cats = [...new Set(data.by_category.map(r=>r.category))];
    return cats.map(cat => {
      const vals = MONTHS_FWD.map(m => data.by_category.find(r=>r.category===cat&&r.month===m)?.value||0);
      return { name:cat, vals, total:vals.reduce((s,v)=>s+v,0), ...(CAT_ACC[cat]||{acc:'85.0',bias:'4.5'}) };
    });
  })();

  const branchRows = (() => {
    if (!data.by_branch?.length) return [];
    const brs = [...new Set(data.by_branch.map(r=>r.branch))];
    return brs.map(br => {
      const vals = MONTHS_FWD.map(m => data.by_branch.find(r=>r.branch===br&&r.month===m)?.value||0);
      return { name:br, vals, total:vals.reduce((s,v)=>s+v,0), ...(BRANCH_ACC[br]||{acc:'85.0',bias:'4.5'}) };
    });
  })();
  const byBranchSku = {};
  ffData.forEach(r => {
    const key = `${r.branch}|${r.sku}`;
    if (!byBranchSku[key]) byBranchSku[key] = { branch:r.branch, sku:r.sku, months:{}, ds:{} };
    byBranchSku[key].months[r.month] = r.value;
    byBranchSku[key].ds[r.month]     = r.demand_sensing_adjusted;
  });
  const ffRows = Object.values(byBranchSku).slice(0, 40);

  /* Sub-row data for expandable rows */
  const getCatBranchRows = (catName) =>
    BRANCHES.map(branch => {
      const vals = MONTHS_FWD.map(m =>
        ffData.filter(r => CAT_MAP[r.sku] === catName && r.branch === branch && r.month === m)
              .reduce((s, r) => s + (r.value || 0), 0)
      );
      return { name:branch, vals, total:vals.reduce((s,v) => s+v, 0) };
    }).filter(r => r.total > 0);

  const getBranchSkuRows = (branchName) => {
    const skus = [...new Set(ffData.filter(r => r.branch === branchName).map(r => r.sku))].sort();
    return skus.map(sku => {
      const vals = MONTHS_FWD.map(m =>
        ffData.filter(r => r.branch === branchName && r.sku === sku && r.month === m)
              .reduce((s, r) => s + (r.value || 0), 0)
      );
      return { name:sku, vals, total:vals.reduce((s,v) => s+v, 0) };
    }).filter(r => r.total > 0);
  };

  /* Role-based permissions */
  const canExport = user?.role === 'demand_planning' || user?.role === 'category_team';

  const visibleViews = user?.role === 'branch_sales'
    ? ALL_VIEWS.filter(v => v.id === 'branch')
    : user?.role === 'category_team'
      ? ALL_VIEWS.filter(v => v.id === 'category' || v.id === 'branch')
      : ALL_VIEWS;

  const displayBranchRows = user?.role === 'branch_sales'
    ? branchRows.filter(r => r.name === (user.branch || 'Mumbai'))
    : branchRows;

  /* Expandable row renderer */
  const ExpandableRow = ({ row, ri, subRows, showAcc = true, nameEl }) => {
    const isExp = expandedRow === row.name;
    return (
      <React.Fragment>
        <tr
          style={{ background: ri % 2 === 0 ? 'var(--card)' : '#FAFAFA', cursor:'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = '#F5F8FF'}
          onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? 'var(--card)' : '#FAFAFA'}
          onClick={() => { setExpandedRow(isExp ? null : row.name); }}
        >
          <td style={{ ...tdStyle, textAlign:'left', fontWeight:600 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              {isExp ? <ChevronDown size={13} color="#6B7280"/> : <ChevronRight size={13} color="#6B7280"/>}
              {nameEl || row.name}
            </div>
          </td>
          {row.vals.map((v, vi) => <td key={vi} style={tdStyle}>{v.toLocaleString('en-IN')}</td>)}
          <td style={{ ...tdStyle, fontWeight:700, background:'#EFF3FF', color:'var(--navy-accent)' }}>{row.total.toLocaleString('en-IN')}</td>
          {showAcc && <><td style={tdStyle}><AccPill val={row.acc}/></td><td style={tdStyle}><BiasPill val={row.bias}/></td></>}
        </tr>
        {isExp && subRows.map((sub, si) => (
          <tr key={`sub-${si}`} style={{ background:'#EFF6FF' }}>
            <td style={{ ...tdStyle, textAlign:'left', paddingLeft:28, fontSize:11, color:'var(--text-2)' }}>↳ {sub.name}</td>
            {sub.vals.map((v, vi) => <td key={vi} style={{ ...tdStyle, fontSize:11, color:'var(--text-2)' }}>{v.toLocaleString('en-IN')}</td>)}
            <td style={{ ...tdStyle, fontWeight:600, fontSize:11, color:'var(--navy-accent)' }}>{sub.total.toLocaleString('en-IN')}</td>
            {showAcc && <td style={tdStyle} colSpan={2}/>}
          </tr>
        ))}
      </React.Fragment>
    );
  };

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth:1400, margin:'0 auto', background:'var(--bg)', minHeight:'calc(100vh - 52px)', paddingBottom: isMobile ? 80 : undefined }}>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:4, flexWrap:'wrap', gap:8 }}>
        <PageHeader title="Forecasting Report"
          subtitle="May 2026 — Baseline SARIMAX | Final"
          helpText="This report shows the finalized forecast across all branches, categories, and SKUs. Use the view toggle to switch between India-level, category, branch, or full branch × SKU granularity."/>
        <div style={{ display:'flex', gap:8, flexShrink:0, marginTop:4, alignItems:'center' }}>
          {user?.role === 'demand_planning' && (() => {
            const cs = data?.cycle?.status;
            const [label, bg, color, border] =
              cs === 'signed_off'
                ? ['✓ Signed Off — May 2026', '#F0FDF4', '#16A34A', '#BBF7D0']
                : cs === 'overrides_pending'
                ? ['Awaiting branch overrides', '#FFFBEB', '#D97706', '#FCD34D']
                : ['Awaiting conflict resolution', '#FFFBEB', '#D97706', '#FCD34D'];
            return (
              <span style={{ background:bg, color, border:`1px solid ${border}`, borderRadius:20, padding:'5px 12px', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
                {label}
              </span>
            );
          })()}
          {canExport && (
            <button onClick={handleExport} style={{ background:'var(--card)', border:'0.5px solid var(--border)', borderRadius:8, padding:'8px 14px', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:6, color:'var(--text-1)', boxShadow:'var(--shadow-sm)' }}>
              <Download size={13}/> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Role banners */}
      {user?.role === 'branch_sales' && (
        <div style={{ background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:16 }}>🔒</span>
          <span style={{ fontSize:13, fontWeight:600, color:'#92400E' }}>Mumbai Branch Report — Read Only 🔒</span>
        </div>
      )}
      {user?.role === 'category_team' && (
        <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:16 }}>👁</span>
          <span style={{ fontSize:13, fontWeight:600, color:'#1B3A6B' }}>Category Overview — Read Only</span>
        </div>
      )}

      {/* View Mode Toggle */}
      <div style={{ display:'flex', gap:4, background:'var(--card)', borderRadius:12, padding:4, marginBottom:20, boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)', width:'fit-content' }}>
        {visibleViews.map(tab => (
          <button key={tab.id}
            onClick={() => user?.role !== 'branch_sales' && setViewMode(tab.id)}
            style={{
              padding:'8px 16px', borderRadius:9, fontSize:12,
              fontWeight: viewMode === tab.id ? 700 : 400,
              background: viewMode === tab.id ? 'var(--navy-accent)' : 'transparent',
              color:      viewMode === tab.id ? 'white' : 'var(--text-2)',
              border:'none', cursor: user?.role === 'branch_sales' ? 'default' : 'pointer',
              transition:'all 0.15s', whiteSpace:'nowrap',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Cards — always India totals regardless of viewMode */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        <KPICard title="Predicted Sales"   value={(kpis.totalUnits||124850).toLocaleString('en-IN')} trend={`↑ ${kpis.unitsTrend||8.2}%`}             trendDirection="up"   sparklineData={sparkUp}   borderColor="var(--navy-accent)" />
        <KPICard title="Forecast Accuracy" value={`${kpis.accuracy||87.3}%`}                          trend={`↓ ${Math.abs(kpis.accuracyTrend||1.2)}%`} trendDirection="down" sparklineData={sparkDown}  borderColor="#D97706" />
        <KPICard title="Forecast BIAS"     value={`${kpis.bias||3.6}%`}                               trend={`↓ ${Math.abs(kpis.biasTrend||0.6)}%`}     trendDirection="up"   sparklineData={sparkBias}  borderColor="#16A34A" />
        <KPICard title="Predicted Revenue" value={`₹${kpis.revenue||148.2} Cr`}                       trend={`↑ ${kpis.revenueTrend||11.4}%`}           trendDirection="up"   sparklineData={sparkUp}   borderColor="var(--red)" />
      </div>

      {/* Charts Row */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 1fr 1fr', gap:16, marginBottom:24 }}>
        <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:20, boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:600, color:'var(--text-1)' }}>Forecast vs Actual Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={(data.trendData||[]).map(d=>({...d,month:d.month?.replace('-2026',"'26").replace('-2025',"'25")}))} margin={{top:5,right:20,left:0,bottom:5}}>
              <defs>
                <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1A1A2E" stopOpacity={0.15}/><stop offset="95%" stopColor="#1A1A2E" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1B3A6B" stopOpacity={0.2}/><stop offset="95%" stopColor="#1B3A6B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="month" tick={{fontSize:10,fill:'var(--text-2)'}}/>
              <YAxis tick={{fontSize:10,fill:'var(--text-2)'}} tickFormatter={v=>v?(v/1000).toFixed(0)+'k':''}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend/>
              <ReferenceLine x="May'26" stroke="#9CA3AF" strokeDasharray="4 2" label={{value:'Today',fill:'#9CA3AF',fontSize:10}}/>
              <Area type="monotone" dataKey="actual"           name="Actual"          stroke="var(--text-1)"      strokeWidth={2} fill="url(#gradActual)"   dot={false}/>
              <Area type="monotone" dataKey="ai_forecast"      name="AI Forecast"     stroke="var(--navy-accent)" strokeWidth={2} fill="url(#gradForecast)" dot={false} strokeDasharray="5 3"/>
              <Line type="monotone" dataKey="after_overrides"  name="After Overrides" stroke="var(--red)"         strokeWidth={2} strokeDasharray="5 3" dot={false}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:20, boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:600, color:'var(--text-1)' }}>Accuracy by Branch</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.branchAccuracy||[]} layout="vertical" margin={{top:5,right:30,left:60,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false}/>
              <XAxis type="number" domain={[70,100]} tick={{fontSize:9}} tickFormatter={v=>`${v}%`}/>
              <YAxis type="category" dataKey="branch" tick={{fontSize:10,fill:'var(--text-2)'}} width={55}/>
              <Tooltip formatter={v=>`${v}%`}/>
              <Bar dataKey="accuracy" radius={[0,3,3,0]}>
                {(data.branchAccuracy||[]).map((e,i)=>(
                  <Cell key={i} fill={e.accuracy>=85?'#16A34A':e.accuracy>=80?'#D97706':'#EA580C'}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', padding:20, boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:600, color:'var(--text-1)' }}>Category Mix</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data.categoryMix||[]} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                dataKey="value" onClick={e=>setSelectedCategory(e.name===selectedCategory?null:e.name)}>
                {(data.categoryMix||[]).map((_,i)=>(
                  <Cell key={i} fill={CATEGORY_COLORS[i]} opacity={selectedCategory&&selectedCategory!==data.categoryMix[i]?.name?0.4:1}/>
                ))}
              </Pie>
              <Tooltip formatter={v=>`${v}%`}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {(data.categoryMix||[]).map((cat,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:CATEGORY_COLORS[i], flexShrink:0 }}/>
                <span style={{ flex:1, color:'var(--text-2)' }}>{cat.name}</span>
                <span style={{ fontWeight:600, color:'var(--text-1)' }}>{cat.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Forecast Table ── */}
      <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'0.5px solid var(--border)', flexWrap:'wrap', gap:8 }}>
          <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:'var(--text-1)' }}>
            Future Forecast
            <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'var(--text-2)' }}>
              {viewMode==='india_total'?'— All India Aggregate':viewMode==='category'?'— By Category':viewMode==='branch'?'— By Branch':'— Branch × SKU'}
            </span>
          </h3>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ display:'flex', gap:3, background:'var(--bg)', borderRadius:8, padding:3 }}>
              {['3M','6M','12M'].map(h=>(
                <button key={h} onClick={()=>setHorizon(h)} style={{
                  background:horizon===h?'var(--navy-accent)':'transparent',
                  color:horizon===h?'white':'var(--text-2)',
                  border:'none', borderRadius:6, padding:'4px 10px', fontSize:11, cursor:'pointer',
                }}>{h}</button>
              ))}
            </div>
            {canExport && (
              <button onClick={handleExport} style={{ background:'var(--bg)', border:'0.5px solid var(--border)', borderRadius:8, padding:'5px 10px', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4, color:'var(--text-1)' }}>
                <Download size={12}/> Export
              </button>
            )}
          </div>
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
                  onMouseEnter={e => e.currentTarget.style.background='#F5F8FF'}
                  onMouseLeave={e => e.currentTarget.style.background='var(--card)'}>
                  <td style={{ ...tdStyle, textAlign:'left', fontWeight:700 }}>{indiaRow.name}</td>
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
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:780 }}>
              <thead>
                <tr style={{ background:'#F8FAFC' }}>
                  <th style={{ ...thStyle, textAlign:'left', width:160 }}>Category</th>
                  {MONTH_LABELS.map(m => <th key={m} style={thStyle}>{m}</th>)}
                  <th style={{ ...thStyle, background:'var(--navy-accent)', color:'white' }}>Total</th>
                  <th style={thStyle}>Accuracy</th>
                  <th style={thStyle}>BIAS</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((row, ri) => (
                  <ExpandableRow key={ri} row={row} ri={ri} subRows={expandedRow===row.name ? getCatBranchRows(row.name) : []} nameEl={<CatBadge cat={row.name}/>}/>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* By Branch */}
        {viewMode === 'branch' && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:780 }}>
              <thead>
                <tr style={{ background:'#F8FAFC' }}>
                  <th style={{ ...thStyle, textAlign:'left', width:130 }}>Branch</th>
                  {MONTH_LABELS.map(m => <th key={m} style={thStyle}>{m}</th>)}
                  <th style={{ ...thStyle, background:'var(--navy-accent)', color:'white' }}>Total</th>
                  <th style={thStyle}>Accuracy</th>
                  <th style={thStyle}>BIAS</th>
                </tr>
              </thead>
              <tbody>
                {displayBranchRows.map((row, ri) => (
                  <ExpandableRow key={ri} row={row} ri={ri} subRows={expandedRow===row.name ? getBranchSkuRows(row.name) : []}/>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Branch × SKU — unchanged */}
        {viewMode === 'branch_sku' && (
          <div style={{ overflowX:'auto', maxHeight:340, overflowY:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:800 }}>
              <thead>
                <tr style={{ background:'#F8FAFC', position:'sticky', top:0, zIndex:1 }}>
                  <th style={{ ...thStyle, position:'sticky', left:0,  background:'#F8FAFC', zIndex:2 }}>Branch</th>
                  <th style={{ ...thStyle, position:'sticky', left:80, background:'#F8FAFC', zIndex:2 }}>SKU</th>
                  {MONTH_LABELS.map(m=><th key={m} style={thStyle}>{m}</th>)}
                  <th style={{ ...thStyle, background:'var(--navy-accent)', color:'white' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {ffRows.map((row,ri)=>{
                  const vals  = MONTHS_FWD.map(m=>row.months[m]||0);
                  const total = vals.reduce((s,v)=>s+v,0);
                  return (
                    <tr key={ri} style={{ background:ri%2===0?'var(--card)':'#FAFAFA' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#F5F8FF'}
                      onMouseLeave={e=>e.currentTarget.style.background=ri%2===0?'var(--card)':'#FAFAFA'}>
                      <td style={{ ...tdStyle, position:'sticky', left:0,  background:'inherit', fontWeight:600 }}>{row.branch}</td>
                      <td style={{ ...tdStyle, position:'sticky', left:80, background:'inherit', fontSize:11, color:'var(--text-2)' }}>{row.sku}</td>
                      {vals.map((v,vi)=>(
                        <td key={vi} style={tdStyle}>
                          {row.ds[MONTHS_FWD[vi]] ? <span style={{ fontSize:9, color:'#7C3AED', marginRight:2 }}>✦</span> : null}
                          {v.toLocaleString('en-IN')}
                        </td>
                      ))}
                      <td style={{ ...tdStyle, fontWeight:700, background:'#EFF3FF', color:'var(--navy-accent)' }}>{total.toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Performance Table — Historical */}
      <div style={{ background:'var(--card)', borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)', marginBottom:20 }}>
        <div style={{ padding:'16px 20px', borderBottom:'0.5px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:'var(--text-1)' }}>Forecast Performance — Historical</h3>
          <span style={{ fontSize:11, color:'var(--text-3)' }}>Dec 2025</span>
        </div>
        <div style={{ overflowX:'auto', maxHeight:300, overflowY:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:800 }}>
            <thead>
              <tr style={{ background:'#F8FAFC', position:'sticky', top:0 }}>
                {['Branch','SKU','Month','Actual','AI Forecast','Override','Final','Accuracy%','BIAS%'].map(h=>(
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.perfData||[]).slice(0,30).map((row,ri)=>(
                <tr key={ri} style={{ background:ri%2===0?'var(--card)':'#FAFAFA' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#F5F8FF'}
                  onMouseLeave={e=>e.currentTarget.style.background=ri%2===0?'var(--card)':'#FAFAFA'}>
                  <td style={{ ...tdStyle, fontWeight:600 }}>{row.branch}</td>
                  <td style={{ ...tdStyle, fontSize:11, color:'var(--text-2)' }}>{row.sku}</td>
                  <td style={tdStyle}>Dec '25</td>
                  <td style={tdStyle}>{(row.actual||0).toLocaleString('en-IN')}</td>
                  <td style={tdStyle}>{(row.ai_forecast||0).toLocaleString('en-IN')}</td>
                  <td style={tdStyle}>{(row.override||0).toLocaleString('en-IN')}</td>
                  <td style={{ ...tdStyle, fontWeight:600 }}>{(row.final||0).toLocaleString('en-IN')}</td>
                  <td style={tdStyle}><AccPill val={(row.accuracy||85).toFixed(1)}/></td>
                  <td style={tdStyle}><BiasPill val={(row.bias||0).toFixed(1)}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

const thStyle = { padding:'9px 12px', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-2)', background:'#F8FAFC', textAlign:'center', border:'1px solid var(--border)', whiteSpace:'nowrap' };
const tdStyle = { padding:'8px 12px', fontSize:12, color:'var(--text-1)', border:'1px solid var(--border)', textAlign:'center' };
