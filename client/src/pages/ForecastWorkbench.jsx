import React, { useState, useEffect } from 'react';
import { Info, ChevronDown, Play, Save, AlertTriangle, CheckCircle, X, BarChart2, Table2, Pencil } from 'lucide-react';
import { ComposedChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import Modal from '../components/shared/Modal';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/shared/PageHeader';

const BRANCHES = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
const SKUS = ['REF_190L_DirectCool','REF_240L_FrostFree','REF_340L_TripleDoor','WM_7KG_TopLoad','WM_8KG_FrontLoad','WM_6.5KG_SemiAuto','AC_1.5T_Inverter','AC_2.0T_Split','MW_25L_Convection','IH_3B_SmartGlass'];
const CATEGORIES = ['Direct Cool Refrigerator','Frost Free Refrigerator','Washing Machine','Air Conditioner','Microwave','Induction'];
const ALGORITHMS = ['SARIMAX','ARIMA','Exponential Smoothing','Moving Average','Random Forest','XGBoost','Prophet'];
const MONTHS_FWD = ['Feb\'26','Mar\'26','Apr\'26','May\'26','Jun\'26','Jul\'26'];

const INTERNAL_CAUSAL = ['Trade Promotions','Pricing Changes','New Launch','Pipeline Changes','Scheme Changes'];
const EXTERNAL_CAUSAL = ['Festival Calendar','Weather Data','GDP Index','Competitor Activity','Govt Regulations'];

const ABC = ['A (High Vol)','B (Mid Vol)','C (Low Vol)'];
const XYZ = ['X (Easy)','Y (Medium)','Z (Difficult)'];

const EXCEPTION_COLORS = {
  'Extreme Outlier High': '#DC2626',
  'Zero Value Anomaly': '#D97706',
  'Z-Score Violation': '#7C3AED',
  'Negative Value Error': '#DC2626',
  'Null Data Point': '#6B7280',
  'Sudden Volume Drop': '#EA580C',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#FFF', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', borderLeft: '3px solid #1B3A6B', fontSize: 12 }}>
      <div style={{ fontWeight: 600, color: '#1A1A2E', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>{p.name}: <strong>{p.value?.toLocaleString('en-IN')}</strong></div>
      ))}
    </div>
  );
};

export default function ForecastWorkbench() {
  const { toast } = useToast();
  const [config, setConfig] = useState({ branches: [], category: '', skus: [], internalCausal: [], externalCausal: [], algorithms: {} });
  const [algoMatrix, setAlgoMatrix] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [view, setView] = useState('chart');
  const [showParamModal, setShowParamModal] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioNotes, setScenarioNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [exceptions, setExceptions] = useState([]);
  const [correctedCells, setCorrectedCells] = useState({});

  useEffect(() => {
    const defaultMatrix = {};
    ABC.forEach(a => XYZ.forEach(x => { defaultMatrix[`${a}|${x}`] = 'SARIMAX'; }));
    setAlgoMatrix(defaultMatrix);
  }, []);

  const toggleChip = (key, arr, item) => {
    setConfig(prev => ({
      ...prev,
      [key]: prev[key].includes(item) ? prev[key].filter(i => i !== item) : [...prev[key], item],
    }));
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/forecast/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: config, algorithmConfig: algoMatrix }),
      });
      const data = await resp.json();
      setResult(data.forecast_runs || []);
      setExceptions(data.exceptions || []);
      toast.success(`Forecast generated — ${data.count} data points across ${BRANCHES.length} branches`);
    } catch (e) {
      toast.error('Failed to generate forecast');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) { toast.warning('Please enter a scenario name'); return; }
    setSaving(true);
    try {
      const resp = await fetch('/api/forecast/save-scenario', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: scenarioName, notes: scenarioNotes, forecast_runs: result }),
      });
      const data = await resp.json();
      toast.success('✅ Scenario saved to library');
      setScenarioName('');
    } catch (e) {
      toast.error('Failed to save scenario');
    } finally {
      setSaving(false);
    }
  };

  const correctException = (exc) => {
    const key = `${exc.branch}|${exc.sku}|${exc.month}`;
    setCorrectedCells(prev => ({ ...prev, [key]: exc.corrected_value }));
    setExceptions(prev => prev.filter(e => !(e.branch === exc.branch && e.sku === exc.sku && e.month === exc.month)));
    toast.success(`Corrected ${exc.sku} @ ${exc.branch} to ${exc.corrected_value}`);
  };

  // Build chart data from results
  const buildChartData = () => {
    if (!result) return [];
    const grouped = {};
    result.forEach(r => {
      if (!grouped[r.month]) grouped[r.month] = {};
      if (!grouped[r.month][r.sku]) grouped[r.month][r.sku] = 0;
      grouped[r.month][r.sku] += r.value;
    });
    return Object.entries(grouped).map(([month, skus]) => {
      const monthLabel = month.replace('-', '\'').replace('2026', '26').replace('2025', '25');
      return { month: monthLabel, ...skus };
    });
  };

  // Build table data
  const buildTableData = () => {
    if (!result) return [];
    const byBranchSku = {};
    result.forEach(r => {
      const key = `${r.branch}|${r.sku}`;
      if (!byBranchSku[key]) byBranchSku[key] = { branch: r.branch, sku: r.sku, months: {} };
      byBranchSku[key].months[r.month] = r.value;
    });
    return Object.values(byBranchSku).slice(0, 40);
  };

  const chartData = buildChartData();
  const tableData = buildTableData();

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto', background: 'var(--bg)', minHeight: 'calc(100vh - 52px)' }}>
      <PageHeader title="Forecast Workbench"
        subtitle="Configure algorithms and generate demand forecasts for May 2026"
        helpText="Select which variables and algorithms to use, then click Generate. Review exceptions before they corrupt the forecast. Save your output as a named scenario."/>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        {/* LEFT: Config Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Select Variables */}
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#1A1A2E' }}>Select Variables</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 6 }}>Primary Variables</label>
              <select style={selectStyle}>
                <option>All Combined</option>
                <option>Historical Sales</option>
                <option>Primary Sales</option>
                <option>Secondary Sales</option>
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 6 }}>Internal Causal</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {INTERNAL_CAUSAL.map(item => {
                  const sel = config.internalCausal.includes(item);
                  return (
                    <button key={item} onClick={() => toggleChip('internalCausal', config.internalCausal, item)} style={{
                      background: sel ? '#1B3A6B' : '#F4F6FA', color: sel ? 'white' : '#6B7280',
                      border: `1px solid ${sel ? '#1B3A6B' : '#E5E7EB'}`,
                      borderRadius: 20, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter',
                      transition: 'all 0.15s',
                    }}>
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 6 }}>External Causal</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EXTERNAL_CAUSAL.map(item => {
                  const sel = config.externalCausal.includes(item);
                  return (
                    <button key={item} onClick={() => toggleChip('externalCausal', config.externalCausal, item)} style={{
                      background: sel ? '#1B3A6B' : '#F4F6FA', color: sel ? 'white' : '#6B7280',
                      border: `1px solid ${sel ? '#1B3A6B' : '#E5E7EB'}`,
                      borderRadius: 20, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter',
                      transition: 'all 0.15s',
                    }}>
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Causal Calendar */}
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#1A1A2E' }}>Causal Calendar</h3>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: 8, minWidth: 400 }}>
                {[
                  { month: 'Jun', year: '\'26', event: 'Rath Yatra', color: '#D97706' },
                  { month: 'Aug', year: '\'26', event: 'Independence Day', color: '#2563EB' },
                  { month: 'Sep', year: '\'26', event: 'Onam', color: '#EA580C' },
                  { month: 'Oct', year: '\'26', event: 'Navratri + Diwali 🔥', color: '#DC2626', big: true },
                  { month: 'Jan', year: '\'27', event: 'Republic Day Sale', color: '#2563EB' },
                ].map((ev, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <div style={{
                      background: `${ev.color}15`, color: ev.color, border: `1px solid ${ev.color}40`,
                      borderRadius: 12, padding: '3px 8px', fontSize: 10, fontWeight: 600,
                      whiteSpace: 'nowrap', maxWidth: ev.big ? 120 : 100, textAlign: 'center',
                    }}>
                      {ev.event}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>{ev.month}{ev.year}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Algorithm Matrix */}
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A1A2E' }}>ABC/XYZ Algorithm Matrix</h3>
              <button onClick={() => setShowParamModal(true)} style={{
                background: 'none', border: 'none', color: '#1B3A6B', fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Inter',
              }}>
                <Pencil size={12} /> Edit Params
              </button>
            </div>
            <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 10, lineHeight: 1.4 }}>
              ABC = Sales Volume (A=Top 80%, B=Next 15%, C=Bottom 5%) | XYZ = Forecast Difficulty
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 280 }}>
                <thead>
                  <tr>
                    <th style={thStyle}></th>
                    {ABC.map(a => <th key={a} style={{ ...thStyle, background: '#1B3A6B', color: 'white', borderRadius: 0 }}>{a.split(' ')[0]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {XYZ.map(x => (
                    <tr key={x}>
                      <td style={{ ...thStyle, background: '#E8EEF7', color: '#1B3A6B', fontWeight: 600 }}>{x.split(' ')[0]}</td>
                      {ABC.map(a => (
                        <td key={a} style={{ padding: 4, border: '1px solid #E5E7EB' }}>
                          <select
                            value={algoMatrix[`${a}|${x}`] || 'SARIMAX'}
                            onChange={e => setAlgoMatrix(prev => ({ ...prev, [`${a}|${x}`]: e.target.value }))}
                            style={{ ...selectStyle, fontSize: 10, padding: '3px 4px' }}
                          >
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

          {/* Generate Button */}
          <button onClick={handleGenerate} disabled={loading} style={{
            background: loading ? '#6B7280' : 'var(--navy-accent)', color: 'white', border: 'none',
            borderRadius: 10, padding: '14px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52,
            width: '100%',
            transition: 'transform 0.15s, box-shadow 0.15s',
            transform: 'none',
          }}
            onMouseOver={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(27,58,107,0.35)'; } }}
            onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            {loading ? (
              <>
                <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Running models...
              </>
            ) : (
              <><Play size={16} /> Generate Forecast →</>
            )}
          </button>
        </div>

        {/* RIGHT: Output Panel */}
        <div>
          {!result && !loading && (
            <div style={{ background: '#FFF', borderRadius: 12, padding: '60px 24px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <BarChart2 size={48} color="#E5E7EB" style={{ marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 8px', color: '#6B7280' }}>Configure and generate your forecast</h3>
              <p style={{ margin: 0, color: '#9CA3AF', fontSize: 13 }}>Select variables, set algorithms and click Generate</p>
            </div>
          )}

          {loading && (
            <div style={{ background: '#FFF', borderRadius: 12, padding: '40px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, border: '3px solid #1B3A6B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                <div style={{ fontWeight: 600, color: '#1A1A2E', marginBottom: 4 }}>Analyzing 10 SKUs × 8 branches × 6 months...</div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>Running SARIMAX models and checking for exceptions</div>
              </div>
              {[1,2,3].map(i => (
                <div key={i} style={{ height: 60, background: '#F4F6FA', borderRadius: 8, marginBottom: 12, animation: 'pulse-red 1.5s infinite' }} />
              ))}
            </div>
          )}

          {result && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Exceptions */}
              {exceptions.length > 0 && (
                <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '16px 20px', border: '1px solid #FCD34D', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <AlertTriangle size={16} color="#D97706" />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>⚠️ {exceptions.length} Exceptions Detected</span>
                    <span style={{ background: '#D97706', color: 'white', borderRadius: 12, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>{exceptions.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {exceptions.map((exc, i) => (
                      <div key={i} style={{
                        background: '#FFF', borderRadius: 8, padding: '12px 14px',
                        borderLeft: `4px solid ${EXCEPTION_COLORS[exc.exception_type] || '#DC2626'}`,
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                      }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: EXCEPTION_COLORS[exc.exception_type] || '#DC2626', marginBottom: 3 }}>
                            🔴 {exc.exception_type}
                          </div>
                          <div style={{ fontSize: 12, color: '#1A1A2E' }}>{exc.branch} | {exc.sku} | {exc.month}</div>
                          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                            Detected value: {exc.original_value} → Suggested: {exc.corrected_value}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => correctException(exc)} style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter' }}>
                            Correct
                          </button>
                          <button onClick={() => setExceptions(prev => prev.filter((_, j) => j !== i))} style={{ background: '#F4F6FA', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter' }}>
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Output */}
              <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Forecast Output</h3>
                  <div style={{ display: 'flex', gap: 4, background: '#F4F6FA', borderRadius: 8, padding: 3 }}>
                    {[{id:'chart', label:'📈 Chart'},{id:'table', label:'📋 Table'}].map(tab => (
                      <button key={tab.id} onClick={() => setView(tab.id)} style={{
                        background: view === tab.id ? '#1B3A6B' : 'transparent',
                        color: view === tab.id ? 'white' : '#6B7280',
                        border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
                        fontFamily: 'Inter', fontWeight: view === tab.id ? 600 : 400, transition: 'all 0.15s',
                      }}>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {view === 'chart' && (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <defs>
                        {['#1B3A6B','#E31837','#16A34A'].map((c, i) => (
                          <linearGradient key={i} id={`wbGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={c} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={c} stopOpacity={0}/>
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={v => (v/1000).toFixed(0)+'k'} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      {['REF_190L_DirectCool','WM_7KG_TopLoad','AC_1.5T_Inverter'].map((sku, i) => (
                        <Area key={sku} type="monotone" dataKey={sku}
                          stroke={['#1B3A6B','#E31837','#16A34A'][i]} strokeWidth={2}
                          fill={`url(#wbGrad${i})`}
                          dot={false} isAnimationActive={true} animationDuration={800}
                          strokeDasharray={i > 0 ? '5 3' : 'none'}/>
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}

                {view === 'table' && (
                  <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFF', position: 'sticky', top: 0 }}>
                          <th style={{ ...thStyle, position: 'sticky', left: 0, background: '#F8FAFF', zIndex: 1 }}>Branch</th>
                          <th style={{ ...thStyle, position: 'sticky', left: 80, background: '#F8FAFF', zIndex: 1 }}>SKU</th>
                          {MONTHS_FWD.map(m => <th key={m} style={thStyle}>{m}</th>)}
                          <th style={thStyle}>6M Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((row, i) => {
                          const months = ['02-2026','03-2026','04-2026','05-2026','06-2026','07-2026'];
                          const vals = months.map(m => row.months[m] || 0);
                          const total = vals.reduce((s, v) => s + v, 0);
                          return (
                            <tr key={i} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#F8FAFF'}
                              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#FFF' : '#FAFAFA'}
                            >
                              <td style={{ ...tdStyle, position: 'sticky', left: 0, background: 'inherit', fontWeight: 500 }}>{row.branch}</td>
                              <td style={{ ...tdStyle, position: 'sticky', left: 80, background: 'inherit', fontSize: 11, color: '#6B7280' }}>{row.sku}</td>
                              {vals.map((v, vi) => {
                                const key = `${row.branch}|${row.sku}|${months[vi]}`;
                                const isCorrected = correctedCells[key];
                                return (
                                  <td key={vi} style={{ ...tdStyle, background: isCorrected ? '#F0FDF4' : 'inherit', color: isCorrected ? '#16A34A' : 'inherit' }}>
                                    {isCorrected || v}
                                  </td>
                                );
                              })}
                              <td style={{ ...tdStyle, fontWeight: 600 }}>{total.toLocaleString('en-IN')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Save Scenario */}
              <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-md)', padding: '20px', boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>Save as Scenario</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    value={scenarioName}
                    onChange={e => setScenarioName(e.target.value)}
                    placeholder="e.g. Baseline May 2026"
                    style={{ ...inputStyle }}
                  />
                  <textarea
                    value={scenarioNotes}
                    onChange={e => setScenarioNotes(e.target.value)}
                    placeholder="Add notes (optional)"
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                  <button onClick={handleSaveScenario} disabled={saving} style={{
                    background: '#16A34A', color: 'white', border: 'none', borderRadius: 8,
                    padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    minHeight: 44, fontFamily: 'Inter',
                  }}>
                    <Save size={14} /> {saving ? 'Saving...' : '💾 Save Scenario'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Params Modal */}
      <Modal isOpen={showParamModal} onClose={() => setShowParamModal(false)} title="Edit Algorithm Parameters">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { name: 'SARIMAX', params: [{ label: 'p (AR order)', val: 4 }, { label: 'd (Differencing)', val: 1 }, { label: 'q (MA order)', val: 2 }] },
            { name: 'Random Forest', params: [{ label: 'n_estimators', val: 100 }, { label: 'max_depth', val: 7 }] },
            { name: 'XGBoost', params: [{ label: 'learning_rate', val: 0.1 }, { label: 'max_depth', val: 6 }] },
          ].map(algo => (
            <div key={algo.name} style={{ background: '#F8FAFF', borderRadius: 8, padding: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#1B3A6B' }}>{algo.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {algo.params.map(p => (
                  <div key={p.label}>
                    <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>{p.label}</label>
                    <input defaultValue={p.val} style={inputStyle} type="number" />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowParamModal(false)} style={{ background: '#F4F6FA', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontFamily: 'Inter' }}>Cancel</button>
            <button onClick={() => { setShowParamModal(false); toast.info('Parameters updated'); }} style={{ background: '#1B3A6B', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600 }}>Confirm</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const selectStyle = { width: '100%', padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, color: '#1A1A2E', background: '#FFF', fontFamily: 'Inter', outline: 'none' };
const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, color: '#1A1A2E', background: '#FFF', fontFamily: 'Inter', outline: 'none', boxSizing: 'border-box' };
const thStyle = { padding: '8px 10px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7280', background: '#F8FAFF', textAlign: 'center', border: '1px solid #E5E7EB' };
const tdStyle = { padding: '7px 10px', fontSize: 12, color: '#1A1A2E', border: '1px solid #F0F0F0', textAlign: 'center' };
