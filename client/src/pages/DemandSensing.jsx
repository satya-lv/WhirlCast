import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, X, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/shared/PageHeader';

const IMPACT_COLORS = { high: '#DC2626', medium: '#D97706', low: '#16A34A' };
const IMPACT_BG = { high: '#FEF2F2', medium: '#FFFBEB', low: '#F0FDF4' };
const MONTHS = ['Jun\'26','Jul\'26','Aug\'26','Sep\'26','Oct\'26','Nov\'26'];

const SAMPLE_INSIGHTS = [
  {
    insight_text: 'Q2 trade promotion for AC_1.5T_Inverter shows strong pre-sell signals. Expected 22% uplift in April–May across South and West branches based on retailer commitment data in the brief.',
    impact_level: 'high',
    affected_skus: ['AC_1.5T_Inverter', 'AC_2.0T_Split'],
    affected_branches: ['Mumbai', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune'],
    suggested_adjustment_percent: 22,
    confidence: 87,
  },
  {
    insight_text: 'Refrigerator category positioned for early summer stocking push. Buy-2-Get-1 scheme in North and East regions driving 14% above-baseline retailer ordering.',
    impact_level: 'medium',
    affected_skus: ['REF_240L_FrostFree', 'REF_190L_DirectCool'],
    affected_branches: ['New Delhi', 'Kolkata', 'Ahmedabad'],
    suggested_adjustment_percent: 14,
    confidence: 78,
  },
  {
    insight_text: 'Washing machine top-load SKUs flagged for targeted summer campaign via modern trade. West region partners committed display space for Mar–Apr window.',
    impact_level: 'medium',
    affected_skus: ['WM_7KG_TopLoad', 'WM_6.5KG_SemiAuto'],
    affected_branches: ['Mumbai', 'Pune', 'Ahmedabad'],
    suggested_adjustment_percent: 11,
    confidence: 72,
  },
  {
    insight_text: 'Digital-first awareness drive for Microwave across all urban branches noted in the brief. Expected modest pull-forward of ~7% in June–July.',
    impact_level: 'low',
    affected_skus: ['MW_25L_Convection'],
    affected_branches: ['Mumbai', 'New Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad'],
    suggested_adjustment_percent: 7,
    confidence: 65,
  },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#FFF', borderRadius:8, padding:'10px 14px', boxShadow:'0 4px 16px rgba(0,0,0,0.1)', borderLeft:'3px solid #1B3A6B', fontSize:12 }}>
      <div style={{ fontWeight:600, marginBottom:4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color:p.color }}>{p.name}: <strong>{p.value}</strong></div>)}
    </div>
  );
};

export default function DemandSensing() {
  useEffect(() => { document.title = 'WhirlCast — Demand Sensing'; }, []);
  const { toast } = useToast();
  const { user }  = useAuth();
  const isBranchSales = user?.role === 'branch_sales';
  const fileRef = useRef();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [state, setState] = useState('idle'); // idle | processing | done
  const [insights, setInsights] = useState([]);
  const [usageLimitHit, setUsageLimitHit] = useState(false);
  const [toggles, setToggles] = useState({});
  const [summary, setSummary] = useState('');
  const [logId, setLogId] = useState(null);
  const [adjPercents, setAdjPercents] = useState({});
  const [applying, setApplying] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch('/api/demand-sensing/history').then(r => r.json()).then(d => setHistory(d.logs || []));
  }, []);

  const handleFile = (f) => {
    setFile(f);
    setState('processing');
    const formData = new FormData();
    formData.append('file', f);
    fetch('/api/demand-sensing/upload', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => {
        setInsights(data.insights || []);
        setSummary(data.summary || '');
        setLogId(data.log_id);
        setUsageLimitHit(!!data.usageLimitHit);
        const initToggles = {};
        const initAdj = {};
        (data.insights || []).forEach((ins, i) => { initToggles[i] = true; initAdj[i] = ins.suggested_adjustment_percent; });
        setToggles(initToggles);
        setAdjPercents(initAdj);
        setState('done');
      })
      .catch(() => { toast.error('Upload failed'); setState('idle'); });
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleApply = async () => {
    const activeInsights = insights.filter((_, i) => toggles[i]);
    const adjustments = [];
    activeInsights.forEach((ins, i) => {
      const pct = adjPercents[i] ?? ins.suggested_adjustment_percent;
      ins.affected_skus?.forEach(sku => {
        (ins.affected_branches || [])
          .filter(branch => !isBranchSales || branch === user.branch)
          .forEach(branch => {
            ['06-2026','07-2026','08-2026','09-2026','10-2026','11-2026'].forEach(month => {
              adjustments.push({ sku, branch, month, adjustment_percent: pct });
            });
          });
      });
    });
    setApplying(true);
    try {
      const resp = await fetch('/api/demand-sensing/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: logId, adjustments, branch_filter: isBranchSales ? user.branch : null }),
      });
      const data = await resp.json();
      toast.ai(`✦ Demand adjustments applied to ${data.skuCount} SKUs across ${data.branchCount} branches. Forecasting Report updated.`);
      fetch('/api/demand-sensing/history').then(r => r.json()).then(d => setHistory(d.logs || []));
    } catch (e) { toast.error('Apply failed'); }
    finally { setApplying(false); }
  };

  const handleSampleClick = () => {
    setFile({ name: 'Q2_Trade_Promo_Brief.pdf', size: 204800 });
    setState('processing');
    setTimeout(() => {
      const initToggles = {};
      const initAdj = {};
      SAMPLE_INSIGHTS.forEach((ins, i) => { initToggles[i] = true; initAdj[i] = ins.suggested_adjustment_percent; });
      setInsights(SAMPLE_INSIGHTS);
      setToggles(initToggles);
      setAdjPercents(initAdj);
      setSummary('Q2 Trade Promotion Brief outlines a multi-SKU promotional push across AC, Refrigerator, and Washing Machine categories for Q2 2026. South and West branches lead AC commitments; North and East focus on refrigerator stocking incentives.');
      setLogId(null);
      setUsageLimitHit(false);
      setState('done');
    }, 1500);
  };

  const activeInsightCount = Object.values(toggles).filter(Boolean).length;

  // Build preview chart data
  const buildPreviewData = () => {
    return MONTHS.map((month, mi) => {
      const row = { month };
      const activeIns = insights.filter((_, i) => toggles[i]);
      if (activeIns.length > 0) {
        const avgAdj = activeIns.reduce((s, _, i) => s + (adjPercents[i] || 0), 0) / activeIns.length;
        const base = 1500 + mi * 200 + Math.random() * 300;
        row['Original'] = Math.round(base);
        row['AI-Adjusted'] = Math.round(base * (1 + avgAdj / 100));
      }
      return row;
    });
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto', background: 'var(--bg)', minHeight: 'calc(100vh - 52px)' }}>
      <PageHeader title="✦ Demand Sensing"
        subtitle="AI-powered document analysis — upload any brief or report"
        helpText="Upload any document — trade promotion brief, weather advisory, competitor report, or email. The AI extracts demand signals and shows you a before/after forecast adjustment. You decide what to apply."/>

      {isBranchSales && (
        <div style={{ background:'linear-gradient(135deg, #15803D 0%, #166534 100%)', borderRadius:10, padding:'12px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:20 }}>📍</span>
          <span style={{ fontSize:13, fontWeight:600, color:'white' }}>Branch Demand Sensing — adjustments apply to {user.branch} branch only</span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Sparkles size={20} color="#E31837" />
          <span style={{
            fontSize: 18, fontWeight: 700,
            background: 'linear-gradient(135deg, #1B3A6B 0%, #E31837 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            AI-Powered Module — Demand Sensing
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>Upload documents to extract demand signals and adjust forecasts</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* LEFT: Upload + Insights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upload zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => state === 'idle' && fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#1B3A6B' : '#CBD5E1'}`,
              borderRadius: 16, padding: '40px 24px', textAlign: 'center',
              background: dragOver ? '#EFF6FF' : '#FAFAFA',
              cursor: state === 'idle' ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
            }}
          >
            {state === 'idle' && (
              <>
                <Upload size={40} color="#CBD5E1" style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: '#1A1A2E' }}>Drop files here or click to browse</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6 }}>
                  Supports: PDF, Excel (.xlsx), Word (.docx), Email text (.eml/.txt), Images (.jpg/.png)
                </div>
              </>
            )}

            {state === 'processing' && (
              <div>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
                  background: 'conic-gradient(from 0deg, #1B3A6B, #E31837, #1B3A6B)',
                  animation: 'spin 1.2s linear infinite',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FAFAFA' }} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>✦ AI reading document...</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Extracting demand signals</div>
              </div>
            )}

            {state === 'done' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                <FileText size={24} color="#1B3A6B" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>{file?.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{(file?.size / 1024).toFixed(1)} KB</div>
                </div>
                <button onClick={() => { setFile(null); setState('idle'); setInsights([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" style={{ display: 'none' }} accept=".pdf,.xlsx,.docx,.eml,.txt,.jpg,.png" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />

          {/* Doc type chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['📋 Trade Promo Brief','📊 Market Report','🌤 Weather Advisory','🏪 Competitor Intel','📝 Internal Note'].map(type => (
              <button key={type} style={{ background: '#F4F6FA', border: '1px solid #E5E7EB', borderRadius: 20, padding: '4px 12px', fontSize: 11, cursor: 'pointer', color: '#6B7280', fontFamily: 'Inter' }}>
                {type}
              </button>
            ))}
          </div>

          {/* Usage limit warning */}
          {state === 'done' && usageLimitHit && (
            <div style={{
              background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10,
              padding: '12px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#92400E' }}>
                  Claude API usage limit reached
                </div>
                <div style={{ fontSize: 12, color: '#B45309', marginTop: 3 }}>
                  The live AI analysis could not run. Showing pre-built demo insights instead — all functionality remains available for the demo.
                </div>
              </div>
            </div>
          )}

          {/* Insights */}
          {state === 'done' && insights.length > 0 && (() => {
            const visibleInsights = insights.filter(ins => !isBranchSales || (ins.affected_branches||[]).includes(user.branch));
            return (
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: '#1B3A6B' }}>
                ✦ {visibleInsights.length} demand signals extracted from {file?.name}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {insights.map((ins, i) => {
                  if (isBranchSales && !(ins.affected_branches||[]).includes(user.branch)) return null;
                  return (
                  <div key={i} className="slide-in-right" style={{
                    background: '#FFF', borderRadius: 12, padding: '14px 16px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
                    borderLeft: `4px solid ${IMPACT_COLORS[ins.impact_level]}`,
                    animationDelay: `${i * 100}ms`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{
                        background: IMPACT_BG[ins.impact_level], color: IMPACT_COLORS[ins.impact_level],
                        borderRadius: 8, padding: '2px 8px', fontSize: 10, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {ins.impact_level} impact
                      </span>
                      <button onClick={() => setToggles(prev => ({ ...prev, [i]: !prev[i] }))} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        {toggles[i] ? <ToggleRight size={22} color="#16A34A" /> : <ToggleLeft size={22} color="#9CA3AF" />}
                      </button>
                    </div>
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: '#1A1A2E', lineHeight: 1.5 }}>{ins.insight_text}</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {(ins.affected_skus || []).map(s => <span key={s} style={{ background: '#EFF6FF', color: '#1B3A6B', borderRadius: 8, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>{s}</span>)}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {(ins.affected_branches || [])
                        .filter(b => !isBranchSales || b === user.branch)
                        .map(b => <span key={b} style={{ background: '#F3F4F6', color: '#6B7280', borderRadius: 8, padding: '2px 7px', fontSize: 10 }}>{b}</span>)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>Suggested adj:</div>
                      <input
                        type="number"
                        value={adjPercents[i] !== undefined ? adjPercents[i] : ins.suggested_adjustment_percent}
                        onChange={e => setAdjPercents(prev => ({ ...prev, [i]: parseFloat(e.target.value) }))}
                        style={{ width: 60, padding: '3px 6px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, fontFamily: 'Inter', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: 11, color: '#6B7280' }}>% &nbsp;|&nbsp; Confidence: <strong>{ins.confidence}%</strong></span>
                    </div>
                  </div>
                  );
                })}
              </div>

              {summary && (
                <div style={{ background: '#F8FAFF', borderRadius: 10, padding: '14px', marginTop: 12, border: '1px solid #E8EEF7' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>📝 DOCUMENT SUMMARY</div>
                  <p style={{ margin: 0, fontSize: 12, color: '#1A1A2E', lineHeight: 1.6 }}>{summary}</p>
                </div>
              )}
            </div>
          );
          })()}
        </div>

        {/* RIGHT: Adjustment Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#FFF', borderRadius: 12, padding: '20px', boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>Demand Adjustment Preview</h3>
            {state === 'done' && insights.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={buildPreviewData()} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="Original" stroke="#1B3A6B" strokeWidth={2} dot={false} isAnimationActive={true} />
                    <Line type="monotone" dataKey="AI-Adjusted" stroke="#E31837" strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={true} />
                  </LineChart>
                </ResponsiveContainer>

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Adjustment Table</div>
                  <div style={{ overflowX: 'auto', maxHeight: 200, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFF', position: 'sticky', top: 0 }}>
                          {['SKU','Branch','Adj%','Insight'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {insights.filter((_, i) => toggles[i]).flatMap((ins, i) =>
                          (ins.affected_skus || []).slice(0, 2).flatMap(sku =>
                            (ins.affected_branches || [])
                            .filter(branch => !isBranchSales || branch === user.branch)
                            .slice(0, 2).map(branch => ({
                              sku, branch, adj: adjPercents[i] ?? ins.suggested_adjustment_percent, impact: ins.impact_level
                            }))
                          )
                        ).slice(0, 10).map((row, ri) => (
                          <tr key={ri} style={{ background: ri % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                            <td style={tdStyle}>{row.sku}</td>
                            <td style={tdStyle}>{row.branch}</td>
                            <td style={{ ...tdStyle, color: row.adj >= 0 ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
                              {row.adj >= 0 ? '+' : ''}{row.adj}%
                            </td>
                            <td style={{ ...tdStyle }}>
                              <span style={{ background: IMPACT_BG[row.impact], color: IMPACT_COLORS[row.impact], borderRadius: 8, padding: '1px 6px', fontSize: 10 }}>{row.impact}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <button onClick={handleApply} disabled={applying || activeInsightCount === 0} style={{
                  background: '#16A34A', color: 'white', border: 'none', borderRadius: 8,
                  padding: '12px', width: '100%', marginTop: 16, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Inter', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  minHeight: 44,
                }}>
                  <Sparkles size={14} />
                  {applying ? 'Applying...' : `✦ Apply Adjustments (${activeInsightCount} insights)`}
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
                <Sparkles size={40} color="#E5E7EB" style={{ marginBottom: 12 }} />
                <div>Upload a document to see adjustment preview</div>
              </div>
            )}
          </div>

          {/* History */}
          <div style={{ background: '#FFF', borderRadius: 12, padding: '20px', boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>Previously Applied — This Cycle</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Sample entry */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#EFF6FF', borderRadius: 8, padding: '10px 12px', border: '1px solid #BFDBFE' }}>
                <FileText size={16} color="#1B3A6B" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Q2_Trade_Promo_Brief.pdf</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>20 Jun · 4 insights · Demo sample</div>
                </div>
                <button onClick={handleSampleClick} style={{
                  background: '#1B3A6B', color: 'white', border: 'none', borderRadius: 8,
                  padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>Try this →</button>
              </div>
              {history.map((log, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F8FAFF', borderRadius: 8, padding: '10px 12px' }}>
                  <FileText size={16} color="#1B3A6B" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{log.filename}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {new Date(log.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} | {(log.insights || []).length} insights
                    </div>
                  </div>
                  {log.applied === 1 && <span style={{ background: '#F0FDF4', color: '#16A34A', borderRadius: 12, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>✅ Applied</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const thStyle = { padding: '7px 8px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7280', background: '#F8FAFF', textAlign: 'left', border: '1px solid #E5E7EB' };
const tdStyle = { padding: '6px 8px', fontSize: 11, color: '#1A1A2E', border: '1px solid #F0F0F0' };
