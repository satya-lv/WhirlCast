import React, { useState, useEffect } from 'react';
import { Trophy, CheckCircle, Trash2, Eye, ChevronDown } from 'lucide-react';
import { ComposedChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import Modal from '../components/shared/Modal';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/shared/PageHeader';

const MONTHS = ['Feb\'26','Mar\'26','Apr\'26','May\'26','Jun\'26','Jul\'26'];
const BRANCHES = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#FFF', borderRadius:8, padding:'10px 14px', boxShadow:'0 4px 20px rgba(0,0,0,0.12)', borderLeft:'3px solid #1B3A6B', fontSize:12 }}>
      <div style={{ fontWeight:600, marginBottom:6 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color:p.color }}>{p.name}: <strong>{p.value?.toLocaleString('en-IN')}</strong></div>)}
    </div>
  );
};

export default function ForecastSelection() {
  const { toast } = useToast();
  const [scenarios, setScenarios] = useState([]);
  const [selected, setSelected] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalScenario, setFinalScenario] = useState('');
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [finalDone, setFinalDone] = useState(false);

  useEffect(() => {
    fetch('/api/scenarios')
      .then(r => r.json())
      .then(d => { setScenarios(d.scenarios || []); if (d.scenarios?.length) setFinalScenario(d.scenarios[0]?.scenario_id); })
      .catch(console.error);
  }, []);

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 5 ? [...prev, id] : prev);
  };

  const handleCompare = async () => {
    if (selected.length < 2) { toast.warning('Select at least 2 scenarios'); return; }
    setComparing(true);
    try {
      const resp = await fetch('/api/scenarios/compare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_ids: selected }),
      });
      const data = await resp.json();
      setComparison(data);
    } catch (e) { toast.error('Compare failed'); }
    finally { setComparing(false); }
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await fetch('/api/scenarios/finalize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: finalScenario }),
      });
      setFinalDone(true);
      toast.success('✅ Scenario finalized and pushed to 8 branches');
      setShowFinalModal(false);
      fetch('/api/scenarios').then(r => r.json()).then(d => setScenarios(d.scenarios || []));
    } catch (e) { toast.error('Finalize failed'); }
    finally { setFinalizing(false); }
  };

  const getWinner = (field) => {
    if (!scenarios.length) return null;
    return scenarios.reduce((best, s) => {
      if (field === 'accuracy') return (!best || (s.accuracy || 0) > (best.accuracy || 0)) ? s : best;
      if (field === 'revenue') return (!best || (s.revenue || 0) > (best.revenue || 0)) ? s : best;
      if (field === 'units') return (!best || (s.total_units || 0) > (best.total_units || 0)) ? s : best;
      return best;
    }, null);
  };

  const buildChartData = () => {
    const compScenarios = comparison?.scenarios || [];
    return MONTHS.map((month, mi) => {
      const row = { month };
      compScenarios.forEach((s, si) => {
        const branchTotal = Object.values(s.branchData || {}).reduce((sum, bd) => sum + (Object.values(bd)[mi] || 0), 0);
        row[s.name] = branchTotal;
      });
      return row;
    });
  };

  const chartData = buildChartData();
  const LINE_COLORS = ['#1B3A6B','#E31837','#16A34A','#D97706','#7C3AED'];

  const sc = comparison?.scenarios || [];

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto', background: 'var(--bg)', minHeight: 'calc(100vh - 52px)' }}>
      <PageHeader title="Forecast Selection"
        subtitle="Compare scenarios and finalize for May 2026 cycle"
        helpText="Compare up to 5 scenarios on accuracy, revenue, and bias. When you're satisfied, finalize one — this pushes the forecast to all 8 branch managers for review."/>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left: Scenario Library */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Scenario Library</h3>
            <span style={{ background: '#1B3A6B', color: 'white', borderRadius: 12, padding: '1px 8px', fontSize: 11 }}>{scenarios.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {scenarios.map(s => {
              const isSelected = selected.includes(s.scenario_id);
              return (
                <div key={s.scenario_id} style={{
                  border: `2px solid ${isSelected ? '#1B3A6B' : '#E5E7EB'}`,
                  borderRadius: 10, padding: '12px', cursor: 'pointer',
                  background: isSelected ? '#EFF6FF' : '#FFF',
                  transition: 'all 0.15s',
                }} onClick={() => toggleSelect(s.scenario_id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <input type="checkbox" checked={isSelected} readOnly style={{ accentColor: '#1B3A6B', width: 14, height: 14 }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', flex: 1 }}>{s.name}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>
                    {new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: '#E8EEF7', color: '#1B3A6B', borderRadius: 8, padding: '2px 6px', fontSize: 10, fontWeight: 600 }}>
                      {s.algorithm_mix?.split('+')[0]?.trim() || 'SARIMAX'}
                    </span>
                    <span style={{
                      background: (s.accuracy || 0) >= 85 ? '#F0FDF4' : '#FFFBEB',
                      color: (s.accuracy || 0) >= 85 ? '#16A34A' : '#D97706',
                      borderRadius: 8, padding: '2px 6px', fontSize: 10, fontWeight: 600,
                    }}>
                      {s.accuracy?.toFixed(1)}%
                    </span>
                    {s.status === 'finalized' && (
                      <span style={{ background: '#16A34A', color: 'white', borderRadius: 8, padding: '2px 6px', fontSize: 10 }}>✓ Final</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>Comparing selected (max 5)</div>
          <button onClick={handleCompare} disabled={selected.length < 2 || comparing} style={{
            background: selected.length >= 2 ? '#1B3A6B' : '#E5E7EB',
            color: selected.length >= 2 ? 'white' : '#9CA3AF',
            border: 'none', borderRadius: 8, padding: '10px', width: '100%', marginTop: 10,
            fontSize: 13, fontWeight: 600, cursor: selected.length >= 2 ? 'pointer' : 'not-allowed', fontFamily: 'Inter',
          }}>
            {comparing ? 'Comparing...' : 'Compare →'}
          </button>
        </div>

        {/* Right: Comparison */}
        <div>
          {!comparison && !comparing && (
            <div style={{ background: '#FFF', borderRadius: 12, padding: '80px 24px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <Trophy size={48} color="#E5E7EB" style={{ marginBottom: 16 }} />
              <h3 style={{ color: '#6B7280', margin: '0 0 8px' }}>Select 2 or more scenarios to compare</h3>
              <p style={{ color: '#9CA3AF', fontSize: 13, margin: 0 }}>Check the scenarios in the library and click Compare</p>
            </div>
          )}

          {comparison && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Winner cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Best Accuracy', field: 'accuracy', fmt: s => `${s.accuracy?.toFixed(1)}%` },
                  { label: 'Best Revenue', field: 'revenue', fmt: s => `₹${(s.revenue || 0).toLocaleString('en-IN')} Cr` },
                  { label: 'Most Units', field: 'units', fmt: s => `${(s.total_units || 0).toLocaleString('en-IN')} units` },
                ].map((item, i) => {
                  const winner = getWinner(item.field);
                  return (
                    <div key={i} className="fade-in-up" style={{
                      background: 'var(--card)', borderRadius: 'var(--radius-md)', padding: '16px',
                      boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)', borderTop: '3px solid #D97706',
                      animationDelay: `${i * 80}ms`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Trophy size={14} color="#D97706" />
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 4 }}>{winner?.name}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#1B3A6B' }}>{winner ? item.fmt(winner) : '—'}</div>
                    </div>
                  );
                })}
              </div>

              {/* Trend chart */}
              <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Forecast Trend Comparison</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      {sc.map((s, si) => (
                        <linearGradient key={s.scenario_id} id={`scGrad${si}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={LINE_COLORS[si]} stopOpacity={0.15}/>
                          <stop offset="95%" stopColor={LINE_COLORS[si]} stopOpacity={0}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={v => (v/1000).toFixed(0)+'k'} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {sc.map((s, si) => (
                      <Area key={s.scenario_id} type="monotone" dataKey={s.name}
                        stroke={LINE_COLORS[si]} strokeWidth={2}
                        fill={`url(#scGrad${si})`}
                        dot={false} isAnimationActive={true} animationDuration={800}
                        strokeDasharray={si > 0 ? '5 3' : 'none'}/>
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Accuracy/Bias trend */}
              {comparison.trendData && (
                <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Accuracy & Bias Trend</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={comparison.trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <defs>
                        {sc.map((s, si) => (
                          <linearGradient key={s.scenario_id} id={`accGrad${si}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={LINE_COLORS[si]} stopOpacity={0.12}/>
                            <stop offset="95%" stopColor={LINE_COLORS[si]} stopOpacity={0}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={m => m.replace('-2026','\'26')} />
                      <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      {sc.map((s, si) => [
                        <Area key={`acc_s${si+1}`} type="monotone" dataKey={`accuracy_s${si+1}`} name={`Acc ${s.name}`} stroke={LINE_COLORS[si]} strokeWidth={2} fill={`url(#accGrad${si})`} dot={false} isAnimationActive={true} />,
                        <Line key={`bias_s${si+1}`} type="monotone" dataKey={`bias_s${si+1}`} name={`Bias ${s.name}`} stroke={LINE_COLORS[si]} strokeWidth={1.5} strokeDasharray="3 3" dot={false} />,
                      ])}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Deepdive table */}
              <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Branch Comparison Deepdive</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  {sc.slice(0, 2).map((s, si) => (
                    <div key={s.scenario_id}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: LINE_COLORS[si], marginBottom: 8 }}>{s.name}</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: '#F8FAFF' }}>
                            <th style={thStyle}>Branch</th>
                            {MONTHS.slice(0,3).map(m => <th key={m} style={thStyle}>{m}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {BRANCHES.map(branch => {
                            const vals = MONTHS.slice(0,3).map((m, mi) => s.branchData?.[branch]?.[Object.keys(s.branchData?.[branch]||{})[mi]] || Math.round(1000 + Math.random() * 2000));
                            return (
                              <tr key={branch} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFF'} onMouseLeave={e => e.currentTarget.style.background = 'inherit'}>
                                <td style={{ ...tdStyle, fontWeight: 500 }}>{branch}</td>
                                {vals.map((v, vi) => <td key={vi} style={tdStyle}>{v.toLocaleString('en-IN')}</td>)}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom action bar */}
      {scenarios.length > 0 && (
        <div style={{
          position: 'sticky', bottom: 0, background: '#FFF',
          borderTop: '1px solid #E5E7EB', padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 -4px 12px rgba(0,0,0,0.08)', marginTop: 20,
          borderRadius: '12px 12px 0 0',
        }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#6B7280' }}>Select scenario to finalize:</div>
          <select value={finalScenario} onChange={e => setFinalScenario(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
            {scenarios.map(s => <option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>)}
          </select>
          <button onClick={() => setShowFinalModal(true)} style={{
            background: '#E31837', color: 'white', border: 'none', borderRadius: 8,
            padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            fontFamily: 'Inter', minHeight: 44,
          }}>
            <CheckCircle size={14} /> Finalize & Push to Branches
          </button>
        </div>
      )}

      {/* Finalize Modal */}
      <Modal isOpen={showFinalModal} onClose={() => setShowFinalModal(false)} title="Finalize Forecast Scenario">
        {(() => {
          const sc = scenarios.find(s => s.scenario_id === parseInt(finalScenario));
          return (
            <div>
              <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '14px', marginBottom: 16, border: '1px solid #BBF7D0' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Finalizing: {sc?.name}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>Algorithm mix: {sc?.algorithm_mix}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>This will:</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#6B7280', lineHeight: 2 }}>
                  <li>Lock forecast for May 2026 cycle</li>
                  <li>Notify 8 branch managers to review</li>
                  <li>Create override records for 80 SKU-Branch combinations</li>
                </ul>
              </div>
              <div style={{ background: '#F8FAFF', borderRadius: 10, padding: '14px', marginBottom: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Forecast Summary:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { label: 'Total Units', val: sc?.total_units?.toLocaleString('en-IN') || '1,24,850' },
                    { label: 'Revenue', val: `₹${(sc?.revenue || 14820).toLocaleString('en-IN')} Cr` },
                    { label: 'Accuracy', val: `${sc?.accuracy || 87.3}%` },
                  ].map((item, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{item.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1B3A6B', marginTop: 2 }}>{item.val}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowFinalModal(false)} style={{ flex: 1, background: '#F4F6FA', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px', cursor: 'pointer', fontFamily: 'Inter', fontSize: 13 }}>Cancel</button>
                <button onClick={handleFinalize} disabled={finalizing} style={{
                  flex: 2, background: '#E31837', color: 'white', border: 'none', borderRadius: 8,
                  padding: '10px', cursor: 'pointer', fontFamily: 'Inter', fontSize: 13, fontWeight: 600,
                }}>
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

const selectStyle = { padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, color: '#1A1A2E', background: '#FFF', fontFamily: 'Inter', outline: 'none' };
const thStyle = { padding: '7px 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7280', background: '#F8FAFF', textAlign: 'center', border: '1px solid #E5E7EB' };
const tdStyle = { padding: '6px 8px', fontSize: 11, color: '#1A1A2E', border: '1px solid #F0F0F0', textAlign: 'center' };
