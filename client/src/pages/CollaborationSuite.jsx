/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Download, Save, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import IndiaMap from '../components/shared/IndiaMap';
import Modal from '../components/shared/Modal';
import { useToast } from '../context/ToastContext';
import { useIsMobile } from '../utils/useIsMobile';

const BRANCHES = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
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
const REASONS  = ['A: Increase in ranging','B: New Promo/Activity','C: Pricing Change','D: Repipeline','E: Seasonality effects','F: Competitor Activity','G: Others'];
const MONTHS   = ['02-2026','03-2026','04-2026','05-2026','06-2026','07-2026'];
const MONTH_LABELS = ["Feb'26","Mar'26","Apr'26","May'26","Jun'26","Jul'26"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#FFF', borderRadius:8, padding:'10px 14px', boxShadow:'0 4px 16px rgba(0,0,0,0.1)', borderLeft:'3px solid #1B3A6B', fontSize:12 }}>
      <div style={{ fontWeight:600, marginBottom:4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color:p.color }}>{p.name}: <strong>{p.value}</strong></div>)}
    </div>
  );
};

export default function CollaborationSuite() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();

  const initBranch = user?.role === 'branch_sales'
    ? user.branch
    : (searchParams.get('branch') ? decodeURIComponent(searchParams.get('branch')) : null);

  const [activeBranch, setActiveBranch] = useState(initBranch);
  const [allBranchData, setAllBranchData]   = useState({});
  const [branchStatuses, setBranchStatuses] = useState({});
  const [overrides, setOverrides]   = useState({});
  const [reasons, setReasons]       = useState({});
  const [expandedRow, setExpandedRow]       = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading]       = useState(true);

  // Sync activeBranch from URL param changes (demand_planning only)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user?.role === 'branch_sales') return;
    const b = searchParams.get('branch');
    if (b) setActiveBranch(decodeURIComponent(b));
  }, [searchParams]);

  // Load all branch data in parallel on mount / after submit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setLoading(true);
    const branchesToLoad = user?.role === 'branch_sales' ? [user.branch] : BRANCHES;
    Promise.all(
      branchesToLoad.map(b =>
        fetch(`/api/collaboration/${b}`)
          .then(r => r.json())
          .then(d => ({ branch: b, data: d }))
          .catch(() => ({ branch: b, data: { tableData: [], submitted: false, hasConflicts: false } }))
      )
    ).then(results => {
      const dataMap    = {};
      const statusMap  = {};
      results.forEach(({ branch, data }) => {
        dataMap[branch]   = data;
        statusMap[branch] = data.submitted
          ? (data.hasConflicts ? 'submitted_conflict' : 'submitted_clean')
          : (data.hasConflicts ? 'conflict' : 'pending');
      });
      setAllBranchData(dataMap);
      setBranchStatuses(statusMap);
      setLoading(false);
    });
  }, [refreshKey]);

  // Sync overrides/reasons when activeBranch or data changes
  useEffect(() => {
    if (!activeBranch || !allBranchData[activeBranch]) return;
    const initOv = {};
    const initRe = {};
    (allBranchData[activeBranch]?.tableData || []).forEach(row => {
      row.months.forEach(m => {
        const key = `${row.sku}|${m.month}`;
        if (m.override_value) { initOv[key] = m.override_value; initRe[key] = m.reason || ''; }
      });
    });
    setOverrides(initOv);
    setReasons(initRe);
    setExpandedRow(null);
  }, [activeBranch, allBranchData]);

  const fetchBranchData = (branch) => {
    fetch(`/api/collaboration/${branch}`)
      .then(r => r.json())
      .then(d => {
        setAllBranchData(prev => ({ ...prev, [branch]: d }));
        const status = d.submitted
          ? (d.hasConflicts ? 'submitted_conflict' : 'submitted_clean')
          : (d.hasConflicts ? 'conflict' : 'pending');
        setBranchStatuses(prev => ({ ...prev, [branch]: status }));
      })
      .catch(() => {});
  };

  const handleMapClick = (branch) => {
    if (user?.role === 'branch_sales') return;
    setActiveBranch(prev => prev === branch ? null : branch);
  };

  const handleOverrideChange = (sku, month, val) => {
    setOverrides(prev => ({ ...prev, [`${sku}|${month}`]: val }));
  };

  const getToleranceStatus = (sku, month, val) => {
    const row = allBranchData[activeBranch]?.tableData?.find(r => r.sku === sku);
    const monthData = row?.months?.find(m => m.month === month);
    if (!monthData?.ai_forecast || !val) return null;
    const dev = Math.abs((val - monthData.ai_forecast) / monthData.ai_forecast) * 100;
    if (dev <= 20) return { color:'#16A34A', bg:'#F0FDF4', border:'#16A34A' };
    if (dev <= 30) return { color:'#D97706', bg:'#FFFBEB', border:'#D97706' };
    return { color:'#DC2626', bg:'#FEF2F2', border:'#DC2626' };
  };

  const saveOverride = async (sku, month) => {
    if (!activeBranch) return;
    const key = `${sku}|${month}`;
    const val = overrides[key];
    if (!val) return;
    try {
      await fetch('/api/collaboration/override', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ branch: activeBranch, sku, month, value: parseInt(val), reason: reasons[key] || '' }),
      });
      toast.success(`Override saved for ${sku}`);
      fetchBranchData(activeBranch);
    } catch { toast.error('Save failed'); }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/collaboration/submit/${activeBranch}`, { method:'POST' });
      toast.success(`✅ Overrides submitted for ${activeBranch}`);
      setShowSubmitModal(false);
      setRefreshKey(k => k + 1);
    } catch { toast.error('Submit failed'); }
    finally { setSubmitting(false); }
  };

  const isEditable     = !!activeBranch && user?.role === 'branch_sales';
  const isDpReadOnly   = !!activeBranch && user?.role === 'demand_planning';
  const showActionsCol = !!activeBranch;
  const showBranchCol  = !activeBranch;
  const tableRows = activeBranch
    ? (allBranchData[activeBranch]?.tableData || [])
    : BRANCHES.flatMap(b => (allBranchData[b]?.tableData || []).map(r => ({ ...r, _branch: b })));

  const colCount = (showBranchCol ? 1 : 0) + 4 + MONTHS.length + (showActionsCol ? 1 : 0);

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 1440, margin: '0 auto', background: 'var(--bg)', minHeight: 'calc(100vh - 52px)', paddingBottom: isMobile ? 80 : undefined }}>

      <PageHeader title="Collaboration Suite"
        subtitle="Branch managers review and submit overrides for May 2026"
        helpText="Branch managers review the AI forecast here and submit overrides for their branch. The system enforces a ±30% tolerance. Changes are saved to the database immediately."/>

      {user?.role === 'branch_sales' && (
        <div style={{
          background: 'linear-gradient(135deg, #15803D 0%, #166534 100%)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ fontSize: 24 }}>📍</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>
              Good morning, {user?.name?.split(' ')[0]} 👋
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>
              The May 2026 forecast has been finalized for {user?.branch}. Please review your AI forecast and submit any overrides by 20-May-2026.
            </div>
          </div>
        </div>
      )}

      {user?.role === 'demand_planning' && (
        <div style={{ background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:10, padding:'12px 16px', marginBottom:12, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:16 }}>🔒</span>
          <span style={{ fontSize:13, color:'#92400E', flex:1 }}>
            Read only — overrides are submitted by branch managers. You can see all branch data.
          </span>
        </div>
      )}

      {/* Alert banner */}
      <div style={{ background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:10, padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:16 }}>📋</span>
        <span style={{ fontSize:13, color:'#92400E', flex:1 }}>
          Finalized forecast for May 2026 cycle is ready for review. Please submit your overrides by 20-May-2026.
        </span>
        <span style={{ background:'#D97706', color:'white', borderRadius:12, padding:'3px 10px', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
          5 days remaining
        </span>
      </div>

      {/* Map + Table */}
      <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', gap:16, alignItems:'flex-start' }}>

        {/* Map card — 38% */}
        <div style={{ width: isMobile ? '100%' : '38%', flexShrink:0, background:'#0D1B35', borderRadius:16, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'white', marginBottom:4 }}>Branch Status Map</div>
          {user?.role === 'branch_sales' ? (
            <div style={{ marginBottom:12 }}>
              <span style={{ background:'var(--navy-accent)', color:'white', borderRadius:20, padding:'3px 12px', fontSize:11, fontWeight:600 }}>
                {activeBranch}
              </span>
            </div>
          ) : (
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:12 }}>Click branch to filter table</div>
          )}

          <IndiaMap
            onBranchClick={handleMapClick}
            activeBranch={activeBranch}
            statusMap={branchStatuses}
            showAsFilter={user?.role !== 'branch_sales'}
            lockedBranch={user?.role === 'branch_sales' ? user.branch : undefined}
          />

          {activeBranch && user?.role !== 'branch_sales' && (
            <div style={{ display:'flex', justifyContent:'center', marginTop:12 }}>
              <span style={{
                display:'inline-flex', alignItems:'center', gap:6,
                background:'rgba(255,255,255,0.12)', color:'white',
                borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:600,
              }}>
                Showing: {activeBranch}
                <button
                  onClick={() => setActiveBranch(null)}
                  style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', padding:0, fontSize:16, lineHeight:1, display:'flex', alignItems:'center' }}
                >×</button>
              </span>
            </div>
          )}
        </div>

        {/* Table card — 62% */}
        <div style={{ flex:1, minWidth:0, background:'var(--card)', borderRadius:12, boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)', flexWrap:'wrap', gap:8 }}>
            <h3 style={{ margin:0, fontSize:15, fontWeight:600 }}>
              Branch Forecast Overrides — {activeBranch || 'All Branches'}
            </h3>
            <button style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 12px', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:6, color:'var(--text-1)' }}>
              <Download size={13} /> Export CSV
            </button>
          </div>

          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--text-2)', fontSize:13 }}>Loading branch data…</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth: showBranchCol ? 980 : 900 }}>
                <thead>
                  <tr style={{ background:'#F8FAFF' }}>
                    {[
                      ...(showBranchCol ? ['Branch'] : []),
                      'SKU','Category','Last 6M Actual','AI Forecast (6M)',
                      ...MONTH_LABELS.map(m => `${m} Override`),
                      ...(showActionsCol ? ['Actions'] : []),
                    ].map(h => (
                      <th key={h} style={{ padding:'10px 12px', fontSize:11, fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:'1px solid #E5E7EB', textAlign:'left', whiteSpace:'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={colCount} style={{ padding:40, textAlign:'center', color:'var(--text-2)', fontSize:13 }}>
                        {activeBranch ? `No data for ${activeBranch}.` : 'No data available.'}
                      </td>
                    </tr>
                  ) : tableRows.map((row, ri) => {
                    const aiTotal   = row.months.reduce((s, m) => s + (m.ai_forecast || 0), 0);
                    const isExpanded = expandedRow === ri;
                    return (
                      <React.Fragment key={ri}>
                        <tr
                          style={{ background: ri % 2 === 0 ? '#FFF' : '#FAFAFA', cursor:'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F8FAFF'}
                          onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? '#FFF' : '#FAFAFA'}
                          onClick={() => setExpandedRow(isExpanded ? null : ri)}
                        >
                          {showBranchCol && (
                            <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>
                              <span style={{ background:'#EFF6FF', color:'#1B3A6B', borderRadius:10, padding:'2px 8px', fontSize:11, fontWeight:600 }}>{row._branch}</span>
                            </td>
                          )}
                          <td style={{ padding:'10px 12px', fontWeight:600, color:'var(--text-1)', whiteSpace:'nowrap' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              {isExpanded ? <ChevronUp size={13} color="#6B7280"/> : <ChevronDown size={13} color="#6B7280"/>}
                              {row.sku}
                            </div>
                          </td>
                          <td style={{ padding:'10px 12px' }}><CatBadge cat={row.category}/></td>
                          <td style={{ padding:'10px 12px', color:'var(--text-1)' }}>{(row.months[0]?.last_6m_actual || 0).toLocaleString('en-IN')}</td>
                          <td style={{ padding:'10px 12px', fontWeight:600 }}>{aiTotal.toLocaleString('en-IN')}</td>
                          {row.months.map((m, mi) => {
                            const key = `${row.sku}|${m.month}`;
                            const val = isEditable ? (overrides[key] || '') : (m.override_value || '');
                            const tol = (isEditable && val) ? getToleranceStatus(row.sku, m.month, parseInt(val)) : null;
                            return (
                              <td key={mi} style={{ padding:'6px 8px' }} onClick={e => e.stopPropagation()}>
                                {isEditable ? (
                                  <>
                                    <input
                                      value={val}
                                      onChange={e => handleOverrideChange(row.sku, m.month, e.target.value)}
                                      placeholder={m.ai_forecast || '—'}
                                      style={{
                                        width:70, padding:'5px 7px',
                                        border:`1.5px solid ${tol ? tol.border : '#E5E7EB'}`,
                                        borderRadius:6, fontSize:11, outline:'none',
                                        background: tol ? tol.bg : '#FFF',
                                        color: tol ? tol.color : '#1A1A2E',
                                      }}
                                    />
                                    {val && reasons[key] === undefined && (
                                      <select
                                        value={reasons[key] || ''}
                                        onChange={e => setReasons(prev => ({ ...prev, [key]: e.target.value }))}
                                        style={{ display:'block', width:70, marginTop:3, fontSize:10, padding:'2px 4px', border:'1px solid #E5E7EB', borderRadius:4 }}
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <option value="">Reason...</option>
                                        {REASONS.map(r => <option key={r}>{r}</option>)}
                                      </select>
                                    )}
                                  </>
                                ) : isDpReadOnly ? (
                                  <input disabled value={val || ''} placeholder={m.ai_forecast || '—'}
                                    style={{ width:70, padding:'5px 7px', border:'1px solid #E5E7EB', borderRadius:6, fontSize:11, background:'#F8FAFC', cursor:'not-allowed', color:'var(--text-2)' }}
                                  />
                                ) : (
                                  <span style={{ fontSize:11, color: val ? 'var(--text-1)' : 'var(--text-3)' }}>
                                    {val || (m.ai_forecast || '—')}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          {showActionsCol && (
                            <td style={{ padding:'10px 8px' }} onClick={e => e.stopPropagation()}>
                              {isEditable ? (
                                <div style={{ display:'flex', gap:4 }}>
                                  <button
                                    onClick={() => row.months.forEach(m => saveOverride(row.sku, m.month))}
                                    style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:6, padding:'4px 7px', cursor:'pointer', display:'flex', alignItems:'center' }}>
                                    <Save size={12} color="#1B3A6B"/>
                                  </button>
                                  <button
                                    onClick={() => {
                                      const newOv = { ...overrides };
                                      row.months.forEach(m => delete newOv[`${row.sku}|${m.month}`]);
                                      setOverrides(newOv);
                                    }}
                                    style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:6, padding:'4px 7px', cursor:'pointer', display:'flex', alignItems:'center' }}>
                                    <RotateCcw size={12} color="#DC2626"/>
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize:15 }}>🔒</span>
                              )}
                            </td>
                          )}
                        </tr>

                        {/* Inline chart — only in single-branch editable view */}
                        {isExpanded && isEditable && (
                          <tr>
                            <td colSpan={colCount} style={{ padding:'12px 20px', background:'#F8FAFF' }}>
                              <div style={{ height:180 }}>
                                <div style={{ fontSize:12, fontWeight:600, color:'#1B3A6B', marginBottom:8 }}>
                                  {row.sku} — AI Forecast vs Override
                                </div>
                                <ResponsiveContainer width="100%" height="100%">
                                  <ComposedChart
                                    data={MONTH_LABELS.map((ml, mi) => ({
                                      month: ml,
                                      'AI Forecast': row.months[mi]?.ai_forecast || 0,
                                      'Override': overrides[`${row.sku}|${MONTHS[mi]}`] ? parseInt(overrides[`${row.sku}|${MONTHS[mi]}`]) : null,
                                    }))}
                                    margin={{ top:5, right:20, left:0, bottom:5 }}
                                  >
                                    <defs>
                                      <linearGradient id="collabGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#1B3A6B" stopOpacity={0.18}/>
                                        <stop offset="95%" stopColor="#1B3A6B" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB"/>
                                    <XAxis dataKey="month" tick={{ fontSize:10 }}/>
                                    <YAxis tick={{ fontSize:10 }}/>
                                    <Tooltip content={<CustomTooltip/>}/>
                                    <Legend/>
                                    <Area type="monotone" dataKey="AI Forecast" stroke="#1B3A6B" strokeWidth={2} fill="url(#collabGrad)" dot={false}/>
                                    <Line type="monotone" dataKey="Override" stroke="#E31837" strokeWidth={2} strokeDasharray="5 3" dot={{ fill:'#E31837', r:3 }}/>
                                  </ComposedChart>
                                </ResponsiveContainer>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {isEditable && !loading && (
            <div style={{ padding:'16px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end' }}>
              <button onClick={() => setShowSubmitModal(true)} style={{
                background:'var(--navy-accent)', color:'white', border:'none', borderRadius:8,
                padding:'12px 24px', fontSize:13, fontWeight:600, cursor:'pointer',
                display:'flex', alignItems:'center', gap:8, minHeight:44,
              }}>
                📤 Submit All Overrides for {activeBranch} →
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showSubmitModal} onClose={() => setShowSubmitModal(false)} title="Submit Overrides">
        <div>
          <p style={{ fontSize:13, color:'#1A1A2E', marginBottom:20 }}>
            Submit {Object.keys(overrides).length} overrides for <strong>{activeBranch}</strong> branch? This cannot be undone.
          </p>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setShowSubmitModal(false)} style={{ flex:1, background:'#F4F6FA', border:'1px solid #E5E7EB', borderRadius:8, padding:'10px', cursor:'pointer' }}>Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} style={{ flex:2, background:'var(--navy-accent)', color:'white', border:'none', borderRadius:8, padding:'10px', cursor:'pointer', fontWeight:600 }}>
              {submitting ? 'Submitting…' : '✅ Confirm Submit'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
