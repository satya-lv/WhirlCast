import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import IndiaMap from '../components/shared/IndiaMap';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/shared/PageHeader';
import { useIsMobile } from '../utils/useIsMobile';

const CONFLICT_MAP = {
  Mumbai:      'conflict',
  'New Delhi': 'clean',
  Kolkata:     'conflict',
  Chennai:     'warning',
  Bangalore:   'clean',
  Hyderabad:   'warning',
  Pune:        'clean',
  Ahmedabad:   'clean',
};

const LEGEND_ITEMS = [
  { color:'#F59E0B', label:'Active conflict' },
  { color:'#F97316', label:'Watch'           },
  { color:'#22C55E', label:'Clean'           },
];

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
  return <span style={{ background:`#${c.bg}`, color:`#${c.text}`, fontSize:9, fontWeight:600, padding:'1px 6px', borderRadius:20 }}>{cat}</span>;
};

const CAT_MAP = {
  'REF_190L_DirectCool':'Direct Cool Refrigerator', 'REF_240L_FrostFree':'Frost Free Refrigerator',
  'REF_340L_TripleDoor':'Frost Free Refrigerator',  'WM_7KG_TopLoad':'Washing Machine',
  'WM_8KG_FrontLoad':'Washing Machine',             'WM_6.5KG_SemiAuto':'Washing Machine',
  'AC_1.5T_Inverter':'Air Conditioner',             'AC_2.0T_Split':'Air Conditioner',
  'MW_25L_Convection':'Microwave',                  'IH_3B_SmartGlass':'Induction',
};

const BRANCH_STATS = {
  'Mumbai':      { acc:'91.0', bias:'2.3' },
  'New Delhi':   { acc:'85.1', bias:'6.9' },
  'Kolkata':     { acc:'81.0', bias:'8.2' },
  'Chennai':     { acc:'79.4', bias:'9.1' },
  'Bangalore':   { acc:'89.2', bias:'3.4' },
  'Hyderabad':   { acc:'83.5', bias:'5.8' },
  'Pune':        { acc:'88.0', bias:'3.8' },
  'Ahmedabad':   { acc:'86.2', bias:'4.5' },
};

const CATEGORIES = ['Direct Cool Refrigerator','Frost Free Refrigerator','Washing Machine','Air Conditioner','Microwave','Induction'];

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
            <input type="checkbox" checked={selected.length===0||selected.length===options.length}
              onChange={() => onChange([])} style={{ accentColor:'#1B3A6B', cursor:'pointer' }}/>
            <em style={{ color:'var(--text-2)' }}>All Categories</em>
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

export default function OverrideConflicts() {
  useEffect(() => { document.title = 'WhirlCast — Override Conflicts'; }, []);
  const { toast }  = useToast();
  const { user }   = useAuth();
  const isMobile   = useIsMobile();
  const [activeTab, setActiveTab]   = useState('national');
  const [data, setData]             = useState(null);
  const [decisions, setDecisions]   = useState({});
  const [customVals, setCustomVals] = useState({});
  const [saving, setSaving]         = useState(false);
  const [filterBranch, setFilterBranch] = useState(null);
  const [showSignoffModal, setShowSignoffModal] = useState(false);
  const [signingOff, setSigningOff] = useState(false);
  const [signedOff, setSignedOff]   = useState(false);
  const [reportData, setReportData]             = useState(null);
  const [expandedCats, setExpandedCats]         = useState({});
  const [expandedBranches, setExpandedBranches] = useState({});
  const [filterCats, setFilterCats]             = useState([]);

  const isReadOnly  = user?.role === 'demand_planning';
  const canResolve  = user?.role === 'category_team';

  const loadConflicts = () => fetch('/api/conflicts').then(r => r.json()).then(d => setData(d));

  useEffect(() => { loadConflicts(); }, []);
  useEffect(() => { fetch('/api/report').then(r => r.json()).then(setReportData).catch(() => {}); }, []);

  const makeDecision = (ovId, decision, val) => {
    setDecisions(prev => ({ ...prev, [ovId]: { decision, final_value: val } }));
  };

  const handleConfirmAll = async () => {
    setSaving(true);
    const decisionList = Object.entries(decisions).map(([id, d]) => ({ override_id: parseInt(id), ...d }));
    try {
      await fetch('/api/conflicts/resolve', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ decisions: decisionList }),
      });
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

  const overrides      = data?.overrides     || [];
  const categoryRollup = data?.categoryRollup || [];
  const allResolved    = !signedOff && overrides.length > 0 && overrides.every(o => o.final_override != null || o.status === 'resolved');
  const filteredOverrides = filterBranch ? overrides.filter(o => o.branch === filterBranch) : overrides;

  /* ── Category rows with topBranches for "Driven by" attribution ── */
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
      return {
        cat,
        aiTotal:       cr?.ai_total       || 0,
        overrideTotal: cr?.override_total || 0,
        deviation:     cr?.deviation      || 0,
        status:        cr?.status         || 'ok',
        topBranches,
      };
    });
  })();

  /* ── Branch rows: only branches that have submitted overrides for that category ── */
  const getBranchOverrideRows = (cat) => {
    const catOvs = overrides.filter(o => CAT_MAP[o.sku] === cat);
    const branches = [...new Set(catOvs.map(o => o.branch))];
    return branches.map(branch => {
      const bOvs = catOvs.filter(o => o.branch === branch);
      const aiTotal = (reportData?.by_branch_sku||[])
        .filter(r => r.branch === branch && CAT_MAP[r.sku] === cat)
        .reduce((s, r) => s + (r.value||0), 0);
      const overriddenAI  = bOvs.reduce((s,o) => s + (o.ai_forecast||0), 0);
      const overriddenVal = bOvs.reduce((s,o) => s + (o.override_value||0), 0);
      const overrideTotal = aiTotal - overriddenAI + overriddenVal;
      const deviation = aiTotal > 0 ? ((overrideTotal - aiTotal) / aiTotal * 100) : 0;
      const skuDev = {};
      bOvs.forEach(o => { skuDev[o.sku] = (skuDev[o.sku]||0) + Math.abs(o.deviation||0); });
      const topSkus = Object.entries(skuDev).sort((a,b) => b[1]-a[1]).slice(0,2).map(([s]) => s);
      const stats = BRANCH_STATS[branch] || { acc:'85.0', bias:'5.0' };
      return { branch, aiTotal, overrideTotal, deviation, acc:stats.acc, bias:stats.bias, topSkus };
    }).sort((a,b) => Math.abs(b.deviation) - Math.abs(a.deviation));
  };

  /* ── SKU rows: individual overrides for a branch+category ── */
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

  const chartData = catRows.map(r => ({
    category: r.cat,
    'AI Forecast': r.aiTotal,
    'After Overrides': r.overrideTotal || r.aiTotal,
  }));

  const filteredChartData = filterCats.length ? chartData.filter(d => filterCats.includes(d.category)) : chartData;

  const devColor = (dev) => Math.abs(dev) < 10 ? '#16A34A' : Math.abs(dev) < 20 ? '#D97706' : '#DC2626';

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth:1440, margin:'0 auto', background:'var(--bg)', minHeight:'calc(100vh - 52px)', paddingBottom: isMobile ? 80 : undefined }}>
      <PageHeader title="Override Conflicts"
        subtitle="Review and resolve branch forecast overrides — Jun 2026"
        helpText="The category team reviews all branch overrides nationally. Resolve conflicts by accepting, rejecting, or setting a custom value. All decisions are final."/>

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

      {/* ── National View ── */}
      {activeTab === 'national' && (
        <div>
          {/* 3-level expandable tree */}
          <div style={{ background:'var(--card)', borderRadius:12, boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)', overflow:'hidden', marginBottom:20 }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:820 }}>
                <thead>
                  <tr style={{ background:'#F8FAFF' }}>
                    <th style={{ ...thS, textAlign:'left', minWidth:200 }}>Category / Branch / SKU</th>
                    <th style={thS}>AI Forecast</th>
                    <th style={thS}>After Overrides</th>
                    <th style={thS}>Deviation %</th>
                    <th style={thS}>Acc% / Override By</th>
                    <th style={thS}>BIAS% / Reason</th>
                    <th style={thS}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {catRows.map((cr, ci) => {
                    const catKey = cr.cat;
                    const isCatOpen = !!expandedCats[catKey];
                    const brRows = isCatOpen ? getBranchOverrideRows(catKey) : [];
                    const dc = devColor(cr.deviation);
                    return (
                      <React.Fragment key={catKey}>
                        {/* ── Level 1: Category ── */}
                        <tr
                          onClick={() => setExpandedCats(p => ({ ...p, [catKey]: !p[catKey] }))}
                          style={{ background: ci % 2 === 0 ? '#FFF' : '#FAFAFA', cursor:'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F0F4FF'}
                          onMouseLeave={e => e.currentTarget.style.background = ci % 2 === 0 ? '#FFF' : '#FAFAFA'}
                        >
                          <td style={{ padding:'10px 12px', fontWeight:700, color:'#1B3A6B' }}>
                            <span style={{ marginRight:6, fontSize:10 }}>{isCatOpen ? '▼' : '▶'}</span>
                            {catKey}
                          </td>
                          <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:600 }}>
                            {(cr.aiTotal||0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:600 }}>
                            {(cr.overrideTotal||cr.aiTotal||0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding:'10px 12px', textAlign:'right' }}>
                            <span style={{ color:dc, fontWeight:600 }}>
                              {cr.deviation > 0 ? '+' : ''}{cr.deviation?.toFixed(1)}%
                            </span>
                            {cr.topBranches.length > 0 && (
                              <div style={{ fontSize:9, color:'#9CA3AF', marginTop:2, fontWeight:400, textAlign:'right' }}>
                                Driven by: {cr.topBranches.join(', ')}
                              </div>
                            )}
                          </td>
                          <td style={{ padding:'10px 12px', color:'#9CA3AF', textAlign:'center' }}>—</td>
                          <td style={{ padding:'10px 12px', color:'#9CA3AF', textAlign:'center' }}>—</td>
                          <td style={{ padding:'10px 12px' }}>
                            <span style={{ background: cr.status==='ok' ? '#F0FDF4' : '#FFFBEB', color: cr.status==='ok' ? '#16A34A' : '#D97706', borderRadius:12, padding:'2px 8px', fontSize:10, fontWeight:600, whiteSpace:'nowrap' }}>
                              {cr.status==='ok' ? '✅ Within range' : '⚠ Watch'}
                            </span>
                          </td>
                        </tr>

                        {/* ── Level 2: Branch ── */}
                        {isCatOpen && brRows.map(br => {
                          const brKey = `${catKey}__${br.branch}`;
                          const isBrOpen = !!expandedBranches[brKey];
                          const skRows = isBrOpen ? getSkuOverrideRows(catKey, br.branch) : [];
                          const bdc = devColor(br.deviation);
                          return (
                            <React.Fragment key={brKey}>
                              <tr
                                onClick={() => setExpandedBranches(p => ({ ...p, [brKey]: !p[brKey] }))}
                                style={{ background:'#F4F6FA', cursor:'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#EBF0FA'}
                                onMouseLeave={e => e.currentTarget.style.background = '#F4F6FA'}
                              >
                                <td style={{ padding:'8px 12px 8px 28px', fontWeight:500, color:'#374151' }}>
                                  <span style={{ marginRight:6, fontSize:9 }}>{isBrOpen ? '▼' : '▶'}</span>
                                  {br.branch}
                                </td>
                                <td style={{ padding:'8px 12px', textAlign:'right', fontSize:11 }}>
                                  {(br.aiTotal||0).toLocaleString('en-IN')}
                                </td>
                                <td style={{ padding:'8px 12px', textAlign:'right', fontSize:11 }}>
                                  {(br.overrideTotal||0).toLocaleString('en-IN')}
                                </td>
                                <td style={{ padding:'8px 12px', textAlign:'right', fontSize:11 }}>
                                  <span style={{ color:bdc, fontWeight:600 }}>
                                    {br.deviation > 0 ? '+' : ''}{br.deviation?.toFixed(1)}%
                                  </span>
                                  {br.topSkus.length > 0 && (
                                    <div style={{ fontSize:9, color:'#9CA3AF', marginTop:2, fontWeight:400, textAlign:'right' }}>
                                      Driven by: {br.topSkus.join(', ')}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding:'8px 12px', textAlign:'right', fontSize:11, color:'#374151' }}>
                                  {br.acc}%
                                </td>
                                <td style={{ padding:'8px 12px', textAlign:'right', fontSize:11, color:'#374151' }}>
                                  {br.bias}%
                                </td>
                                <td style={{ padding:'8px 12px', color:'#9CA3AF', textAlign:'center' }}>—</td>
                              </tr>

                              {/* ── Level 3: SKU ── */}
                              {isBrOpen && skRows.map(sr => {
                                const sdc = devColor(sr.deviation);
                                return (
                                  <tr key={sr.sku} style={{ background:'#FAFBFF' }}>
                                    <td style={{ padding:'7px 12px 7px 46px', color:'#6B7280', fontSize:11, fontFamily:'monospace' }}>
                                      {sr.sku}
                                    </td>
                                    <td style={{ padding:'7px 12px', textAlign:'right', fontSize:11, color:'#6B7280' }}>
                                      {(sr.aiTotal||0).toLocaleString('en-IN')}
                                    </td>
                                    <td style={{ padding:'7px 12px', textAlign:'right', fontSize:11, color: sr.overrideVal ? '#E31837' : '#9CA3AF', fontWeight: sr.overrideVal ? 600 : 400 }}>
                                      {sr.overrideVal ? sr.overrideVal.toLocaleString('en-IN') : '—'}
                                    </td>
                                    <td style={{ padding:'7px 12px', textAlign:'right', fontSize:11 }}>
                                      {sr.overrideVal ? (
                                        <span style={{ color:sdc, fontWeight:600, background:`${sdc}18`, borderRadius:8, padding:'2px 6px', fontSize:10 }}>
                                          {sr.deviation > 0 ? '+' : ''}{sr.deviation?.toFixed(1)}%
                                        </span>
                                      ) : '—'}
                                    </td>
                                    <td style={{ padding:'7px 12px', fontSize:11, color:'#374151' }}>
                                      {sr.overrideBy || '—'}
                                    </td>
                                    <td style={{ padding:'7px 12px', fontSize:10, color:'#9CA3AF', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={sr.reason}>
                                      {sr.reason || '—'}
                                    </td>
                                    <td style={{ padding:'7px 12px' }}>
                                      {sr.status ? (
                                        <span style={{ background: sr.status==='resolved' ? '#F0FDF4' : '#FFFBEB', color: sr.status==='resolved' ? '#16A34A' : '#D97706', borderRadius:12, padding:'2px 6px', fontSize:10, fontWeight:600, whiteSpace:'nowrap' }}>
                                          {sr.status==='resolved' ? '✅' : '⚠'} {sr.status}
                                        </span>
                                      ) : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bar Chart with category filter */}
          <div style={{ background:'var(--card)', borderRadius:12, padding:'20px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
            {/* Filter bar */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:8 }}>
              <h3 style={{ margin:0, fontSize:14, fontWeight:600 }}>AI Forecast vs After Overrides</h3>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:11, color:'var(--text-3)' }}>Filter:</span>
                <MultiSelectDropdown label="Categories" options={CATEGORIES} selected={filterCats} onChange={setFilterCats}/>
              </div>
            </div>

            {/* Filter pills */}
            {filterCats.length > 0 && filterCats.length < CATEGORIES.length && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                {filterCats.map(cat => (
                  <span key={cat} style={{ background:'#EFF6FF', color:'#1B3A6B', border:'1px solid #BFDBFE', borderRadius:12, padding:'2px 10px', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                    {cat.length > 22 ? cat.split(' ').slice(0,2).join(' ') : cat}
                    <button onClick={() => setFilterCats(v => v.filter(c => c !== cat))} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#1B3A6B', lineHeight:1, fontSize:14, fontFamily:'Inter' }}>×</button>
                  </span>
                ))}
              </div>
            )}

            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={filteredChartData} margin={{ top:5, right:10, left:0, bottom:40 }}>
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
                <XAxis dataKey="category" tick={{ fontSize:9, fill:'#6B7280' }} angle={-20} textAnchor="end"/>
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

      {/* ── Conflict Resolution ── */}
      {activeTab === 'conflicts' && (
        <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', gap:16, alignItems:'flex-start' }}>

          {/* Map card — 38% */}
          <div style={{ width: isMobile ? '100%' : '38%', flexShrink:0, background:'#0D1B35', borderRadius:16, padding:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'white', marginBottom:8 }}>Conflict Status by Branch</div>
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
