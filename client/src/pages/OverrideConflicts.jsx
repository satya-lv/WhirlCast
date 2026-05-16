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

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#FFF', borderRadius:8, padding:'10px 14px', boxShadow:'0 4px 16px rgba(0,0,0,0.1)', borderLeft:'3px solid #1B3A6B', fontSize:12 }}>
      <div style={{ fontWeight:600, marginBottom:4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color:p.color }}>{p.name}: <strong>{p.value?.toLocaleString('en-IN')}</strong></div>)}
    </div>
  );
};

export default function OverrideConflicts() {
  const { toast }  = useToast();
  const { user }   = useAuth();
  const isMobile   = useIsMobile();
  const [activeTab, setActiveTab]   = useState('national');
  const [data, setData]             = useState(null);
  const [decisions, setDecisions]   = useState({});
  const [customVals, setCustomVals] = useState({});
  const [saving, setSaving]         = useState(false);
  const [filterBranch, setFilterBranch] = useState(null);

  useEffect(() => {
    fetch('/api/conflicts').then(r => r.json()).then(d => setData(d));
  }, []);

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
    } catch { toast.error('Failed to save decisions'); }
    finally { setSaving(false); }
  };

  const overrides      = data?.overrides     || [];
  const categoryRollup = data?.categoryRollup || [];
  const filteredOverrides = filterBranch
    ? overrides.filter(o => o.branch === filterBranch)
    : overrides;

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth:1440, margin:'0 auto', background:'var(--bg)', minHeight:'calc(100vh - 52px)', paddingBottom: isMobile ? 80 : undefined }}>
      <PageHeader title="Override Conflicts"
        subtitle="Review and resolve branch forecast overrides — May 2026"
        helpText="The category team reviews all branch overrides nationally. Resolve conflicts by accepting, rejecting, or setting a custom value. All decisions are final."/>

      {user?.role === 'category_team' && (
        <div style={{ background:'linear-gradient(135deg, #6D28D9 0%, #5B21B6 100%)', borderRadius:12, padding:'14px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontSize:24 }}>⚡</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:700, color:'white' }}>Good morning, {user?.name?.split(' ')[0]} 👋</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:3 }}>
              {overrides.filter(o => !o.final_override && Math.abs(o.deviation) > 20).length || 3} override conflicts require your attention for the May 2026 cycle.
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
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:20 }}>
          {/* Category Rollup */}
          <div style={{ background:'var(--card)', borderRadius:12, padding:'20px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
            <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:600 }}>Category Rollup</h3>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#F8FAFF' }}>
                  {['Category','AI Total','After Overrides','Deviation','Status'].map(h => (
                    <th key={h} style={{ padding:'8px 10px', fontSize:10, fontWeight:600, color:'#6B7280', textTransform:'uppercase', borderBottom:'1px solid #E5E7EB', textAlign:'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categoryRollup.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFF'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#FFF' : '#FAFAFA'}
                  >
                    <td style={{ padding:'8px 10px', fontWeight:500 }}>{row.category}</td>
                    <td style={{ padding:'8px 10px' }}>{(row.ai_total||0).toLocaleString('en-IN')}</td>
                    <td style={{ padding:'8px 10px' }}>{(row.override_total||0).toLocaleString('en-IN')}</td>
                    <td style={{ padding:'8px 10px', color: row.deviation > 0 ? '#16A34A' : '#DC2626', fontWeight:600 }}>
                      {row.deviation > 0 ? '+' : ''}{row.deviation?.toFixed(1)}%
                    </td>
                    <td style={{ padding:'8px 10px' }}>
                      <span style={{ background: row.status === 'ok' ? '#F0FDF4' : '#FFFBEB', color: row.status === 'ok' ? '#16A34A' : '#D97706', borderRadius:12, padding:'2px 8px', fontSize:10, fontWeight:600 }}>
                        {row.status === 'ok' ? '✅ Within range' : '⚠ Watch'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bar Chart */}
          <div style={{ background:'var(--card)', borderRadius:12, padding:'20px', boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
            <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:600 }}>AI Forecast vs After Overrides</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={categoryRollup} margin={{ top:5, right:10, left:0, bottom:40 }}>
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
                <XAxis dataKey="category" tick={{ fontSize:10, fill:'#6B7280' }} angle={-30} textAnchor="end"/>
                <YAxis tick={{ fontSize:10, fill:'#6B7280' }} tickFormatter={v => (v/1000).toFixed(0)+'k'}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend/>
                <Bar dataKey="ai_total"       name="AI Forecast"     fill="url(#barGradNavy)" radius={[3,3,0,0]} isAnimationActive/>
                <Bar dataKey="override_total" name="After Overrides" fill="url(#barGradRed)"  radius={[3,3,0,0]} isAnimationActive/>
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

            {/* Legend */}
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
                  <button
                    onClick={() => setFilterBranch(null)}
                    style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', padding:0, fontSize:16, lineHeight:1, display:'flex', alignItems:'center' }}
                  >×</button>
                </span>
              </div>
            )}
          </div>

          {/* Table — 62% */}
          <div style={{ flex:1, minWidth:0 }}>
            {/* Count + status filter */}
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
                      const devColor = devAbs <= 10 ? '#16A34A' : devAbs <= 20 ? '#D97706' : '#DC2626';
                      const rowBg = dec?.decision === 'accept' ? '#F0FDF4' : dec?.decision === 'reject' ? '#FFFBEB' : i % 2 === 0 ? '#FFF' : '#FAFAFA';
                      return (
                        <tr key={i} style={{ background:rowBg }}>
                          <td style={{ padding:'10px 12px', fontWeight:500 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ width:7, height:7, borderRadius:'50%', background: CONFLICT_MAP[ov.branch] === 'conflict' ? '#F59E0B' : CONFLICT_MAP[ov.branch] === 'warning' ? '#F97316' : '#22C55E', flexShrink:0, display:'inline-block' }}/>
                              {ov.branch}
                            </div>
                          </td>
                          <td style={{ padding:'10px 12px', fontSize:11, color:'#6B7280' }}>{ov.sku}</td>
                          <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>{ov.month?.replace('-2026',"'26")}</td>
                          <td style={{ padding:'10px 12px' }}>{(ov.ai_forecast||0).toLocaleString('en-IN')}</td>
                          <td style={{ padding:'10px 12px', fontWeight:600 }}>{(ov.override_value||0).toLocaleString('en-IN')}</td>
                          <td style={{ padding:'10px 12px', fontSize:11, color:'#6B7280', maxWidth:120 }}>{ov.reason}</td>
                          <td style={{ padding:'10px 12px' }}>{ov.override_by}</td>
                          <td style={{ padding:'10px 12px' }}>
                            <span style={{ color:devColor, fontWeight:600, background:`${devColor}18`, borderRadius:8, padding:'2px 7px', fontSize:11 }}>
                              {ov.deviation > 0 ? '+' : ''}{ov.deviation?.toFixed(1)}%
                            </span>
                          </td>
                          <td style={{ padding:'8px 10px' }}>
                            {ov.status === 'resolved' ? (
                              <span style={{ color:'#16A34A', fontSize:11 }}>✅ Resolved</span>
                            ) : (
                              <div style={{ display:'flex', gap:4 }}>
                                <button onClick={() => makeDecision(ov.override_id, 'accept', ov.override_value)} style={{
                                  background: dec?.decision === 'accept' ? '#16A34A' : '#F0FDF4',
                                  color:      dec?.decision === 'accept' ? 'white'   : '#16A34A',
                                  border:'1px solid #BBF7D0', borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer',
                                }}>✅ Accept</button>
                                <button onClick={() => makeDecision(ov.override_id, 'reject', ov.ai_forecast)} style={{
                                  background: dec?.decision === 'reject' ? '#D97706' : '#FFFBEB',
                                  color:      dec?.decision === 'reject' ? 'white'   : '#D97706',
                                  border:'1px solid #FCD34D', borderRadius:5, padding:'3px 8px', fontSize:10, cursor:'pointer',
                                }}>❌ Reject</button>
                                <button onClick={() => makeDecision(ov.override_id, 'custom', customVals[ov.override_id] || ov.override_value)} style={{
                                  background: dec?.decision === 'custom' ? '#1B3A6B' : '#F4F6FA',
                                  color:      dec?.decision === 'custom' ? 'white'   : '#1B3A6B',
                                  border:'1px solid #BFDBFE', borderRadius:5, padding:'3px 6px', fontSize:10, cursor:'pointer',
                                }}>✏</button>
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

              <div style={{ padding:'16px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end' }}>
                <button onClick={handleConfirmAll} disabled={saving || Object.keys(decisions).length === 0} style={{
                  background: Object.keys(decisions).length > 0 ? '#16A34A' : '#E5E7EB',
                  color:      Object.keys(decisions).length > 0 ? 'white'   : '#9CA3AF',
                  border:'none', borderRadius:8, padding:'10px 24px', fontSize:13, fontWeight:600,
                  cursor: Object.keys(decisions).length > 0 ? 'pointer' : 'not-allowed', minHeight:44,
                }}>
                  {saving ? 'Saving…' : `✅ Confirm All Decisions (${Object.keys(decisions).length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
