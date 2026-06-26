import React, { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useToast } from '../shared/Toast';

const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];

const CATEGORIES = [
  'Direct Cool Refrigerator', 'Frost Free Refrigerator', 'Washing Machine',
  'Air Conditioner', 'Microwave', 'Induction',
];
const NPI_RESULTS = {
  recommended: {
    tag: 'Recommended', tagColor: '#E31837',
    method: 'Look-alike Blend Model',
    desc: 'Weighted average of 3 similar SKUs — REF_190L_DirectCool (50%), REF_185L_Legacy (30%), REF_200L_DC (20%)',
    totalUnits: 18240, confidence: 87, confColor: '#22C55E',
    monthly: [2100, 2800, 3200, 3500, 3300, 3340], dark: true,
  },
  conservative: {
    tag: 'Conservative', tagColor: '#3B82F6',
    method: '3-Month SARIMAX Projection',
    desc: 'Short-horizon model using only 90-day trend data — lower risk, lower upside.',
    totalUnits: 14800, confidence: 74, confColor: '#3B82F6',
    monthly: [1800, 2300, 2600, 2800, 2700, 2600], dark: false,
  },
  optimistic: {
    tag: 'Optimistic', tagColor: '#16A34A',
    method: 'High-Growth Scenario',
    desc: 'Best-case with planned Q3 trade promotion uplift (+22% AC category) applied.',
    totalUnits: 22600, confidence: 61, confColor: '#16A34A',
    monthly: [2600, 3400, 4000, 4200, 4200, 4200], dark: false,
  },
};
const LOOKALIKE_LINES = ['Recommended', 'Conservative', 'Optimistic'];
const LINE_COLORS_NPI = { Recommended: '#E31837', Conservative: '#3B82F6', Optimistic: '#16A34A' };
const NP_FORM_DEFAULT = { sku: '', category: 'Direct Cool Refrigerator', segment: '', price: '', launch: '' };
const npFieldStyle = {
  width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)',
  borderRadius: 10, fontSize: 13, background: 'var(--bg)', color: 'var(--text-1)', outline: 'none',
};

// Standard new-SKU launch ramp curve used in the blended total.
// Month 1 at transition = 50% channel fill; months 2-6 = normal ramp.
// These are representative national units for an appliance category launch.
// Planners refine actuals in the Forecast Grid after launch.
const RAMP_MONTHLY = [2100, 2800, 3200, 3500, 3300, 3340];

const thStyle = {
  padding: '8px 12px', fontSize: 10, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.04em',
  color: '#6B7280', background: '#F8FAFF',
  textAlign: 'left', border: '1px solid #E5E7EB', whiteSpace: 'nowrap',
};
const tdStyle = { padding: '8px 12px', fontSize: 12, border: '1px solid #E5E7EB' };
const labelStyle = {
  fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
  textTransform: 'uppercase', color: 'var(--text-2)',
  display: 'block', marginBottom: 6,
};

export default function NPITab({ lockedSkuFamily }) {
  const { toast } = useToast();
  const [npiType,          setNpiType]          = useState(null);
  const [lflMappings,      setLflMappings]      = useState([]);
  const [selectedLfl,      setSelectedLfl]      = useState('');
  const [predecessorStats, setPredecessorStats] = useState(null);
  const [statsLoading,     setStatsLoading]     = useState(false);
  const [statsError,       setStatsError]       = useState(null);
  const [generating,       setGenerating]       = useState(false);
  const [renovationReady,  setRenovationReady]  = useState(false);
  const [submitAttempted,  setSubmitAttempted]  = useState(false);
  const [saved,            setSaved]            = useState(false);
  const [npForm,           setNpForm]           = useState(NP_FORM_DEFAULT);
  const [npLoading,        setNpLoading]        = useState(false);
  const [npResults,        setNpResults]        = useState(null);
  const [npSelected,       setNpSelected]       = useState('recommended');
  const [npChartLines,     setNpChartLines]     = useState([...LOOKALIKE_LINES]);

  const filteredLflMappings = useMemo(() => {
    if (!lockedSkuFamily) return lflMappings;
    return lflMappings.filter(m => m.category === lockedSkuFamily);
  }, [lflMappings, lockedSkuFamily]);

  const selectedLflEntry = selectedLfl !== '' ? filteredLflMappings[parseInt(selectedLfl)] || null : null;

  useEffect(() => {
    fetch('/api/admin/lfl')
      .then(r => r.json())
      .then(d => setLflMappings(d.mappings || []))
      .catch(() => {});
  }, []);

  // When LFL selection changes, fetch the replacement SKU's demand history.
  // We query the NEW sku (not old) because the old predecessor has no rows
  // in demand_weekly_data — the LFL replacement is the demand baseline.
  useEffect(() => {
    if (!selectedLflEntry?.new_sku) { setPredecessorStats(null); setStatsError(null); return; }
    setStatsLoading(true);
    setStatsError(null);
    fetch(`/api/demand-planning/npi/predecessor-stats?sku=${encodeURIComponent(selectedLflEntry.new_sku)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setPredecessorStats(null);
          setStatsError(`Could not load demand stats for this predecessor — ${d.error}`);
        } else {
          setPredecessorStats(d);
        }
      })
      .catch(() => {
        setPredecessorStats(null);
        setStatsError('Could not load demand stats for this predecessor — please try again');
      })
      .finally(() => setStatsLoading(false));
  }, [selectedLflEntry?.new_sku]);

  const handleTypeSelect = (type) => {
    setNpiType(type);
    setRenovationReady(false);
    setSubmitAttempted(false);
    setSelectedLfl('');
    setPredecessorStats(null);
    setStatsError(null);
    setSaved(false);
    setNpResults(null);
    setNpForm(NP_FORM_DEFAULT);
    setNpChartLines([...LOOKALIKE_LINES]);
  };

  // ── Renovation math ──────────────────────────────────────────────────────────

  const computePhaseOut = () => {
    if (!renovationReady || !predecessorStats || npiType !== 'renovation') return [];
    let opening = Math.round(predecessorStats.avgMonthlyUnits * 3 * 2.5);
    const str = 0.65;
    return MONTHS.map(month => {
      const sold    = Math.round(opening * str);
      const closing = Math.max(0, opening - sold);
      const status  = opening === 0 ? 'Phase-out Complete' : closing === 0 ? 'Transition Complete' : 'Active';
      const row     = { month, opening, sold, closing, status };
      opening       = closing;
      return row;
    });
  };

  const getTransIdx = () => {
    const base = selectedLflEntry?.effective_date;
    if (!base) return 0;
    const d = new Date(base);
    d.setDate(d.getDate() + 30);
    return Math.max(0, Math.min(5, d.getMonth() - 5));
  };

  const getTransitionDate = () => {
    const base = selectedLflEntry?.effective_date;
    if (!base) return null;
    const d = new Date(base);
    d.setDate(d.getDate() + 30);
    return d;
  };

  const computeRenovBlended = () => {
    if (!renovationReady || !predecessorStats || npiType !== 'renovation') return [];
    const phaseOut  = computePhaseOut();
    const transIdx  = getTransIdx();
    return MONTHS.map((month, i) => {
      const oldSku = phaseOut[i]?.sold || 0;
      let newSku = 0;
      if (i === transIdx) {
        newSku = Math.round((RAMP_MONTHLY[0] || 0) * 0.5);
      } else if (i > transIdx) {
        const ri = i - transIdx;
        newSku = RAMP_MONTHLY[Math.min(ri, RAMP_MONTHLY.length - 1)] || 0;
      }
      return { month, oldSku, newSku, total: oldSku + newSku };
    });
  };

  const handleGenerate = async () => {
    setSubmitAttempted(true);
    if (!selectedLfl || !predecessorStats) return;
    setGenerating(true);
    await new Promise(r => setTimeout(r, 900));
    setRenovationReady(true);
    setGenerating(false);
  };

  const handleNpGenerate = async () => {
    setSubmitAttempted(true);
    if (!npForm.sku || !npForm.price || !npForm.launch) return;
    setNpLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    setNpResults(NPI_RESULTS);
    setNpSelected('recommended');
    setNpLoading(false);
    toast('✦ AI generated 3 forecast views using look-alike modelling', 'ai');
  };

  const handleNpSave = () => {
    toast(`✅ Look-alike Blend forecast saved for ${npForm.sku || 'new SKU'} — added to Jun 2026 cycle`, 'success');
  };

  const npChartData = npResults
    ? MONTHS.map((m, i) => ({
        month: m,
        Recommended: NPI_RESULTS.recommended.monthly[i],
        Conservative: NPI_RESULTS.conservative.monthly[i],
        Optimistic: NPI_RESULTS.optimistic.monthly[i],
      }))
    : [];

  const phaseOutRows = computePhaseOut();
  const blendedRows  = computeRenovBlended();
  const transDate    = getTransitionDate();
  const oldSkuName   = selectedLflEntry?.old_sku || 'Old SKU';
  const newSkuName   = selectedLflEntry?.new_sku || 'New SKU';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24 }}>

      {/* ── Type selector ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 14 }}>
          What type of product introduction is this?
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 760 }}>

          <div onClick={() => handleTypeSelect('renovation')}
            style={{
              borderRadius: 14, padding: 22, cursor: 'pointer', transition: 'all 0.2s',
              border:     npiType === 'renovation' ? '2px solid #D97706'          : '1.5px solid var(--border)',
              background: npiType === 'renovation' ? '#FFFBEB'                    : 'var(--card)',
              boxShadow:  npiType === 'renovation' ? 'var(--shadow-md)'           : 'var(--shadow-sm)',
              transform:  npiType === 'renovation' ? 'translateY(-2px)'           : 'none',
            }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🔄</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>Product Renovation</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Updated version of an existing product. Existing inventory must be phased out as the new SKU launches.
            </div>
            {npiType === 'renovation' && (
              <div style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: '#D97706' }}>✓ Selected</div>
            )}
          </div>

          <div onClick={() => handleTypeSelect('new_product')}
            style={{
              borderRadius: 14, padding: 22, cursor: 'pointer', transition: 'all 0.2s',
              border:     npiType === 'new_product' ? '2px solid var(--navy-accent)' : '1.5px solid var(--border)',
              background: npiType === 'new_product' ? '#EFF6FF'                      : 'var(--card)',
              boxShadow:  npiType === 'new_product' ? 'var(--shadow-md)'             : 'var(--shadow-sm)',
              transform:  npiType === 'new_product' ? 'translateY(-2px)'             : 'none',
            }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✨</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy-accent)', marginBottom: 6 }}>New Product Innovation</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Entirely new product with no sales history. Uses look-alike modelling from similar existing SKUs.
            </div>
            {npiType === 'new_product' && (
              <div style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: 'var(--navy-accent)' }}>✓ Selected</div>
            )}
          </div>
        </div>
      </div>

      {/* ── New Product Innovation — form + AI forecast ── */}
      {npiType === 'new_product' && (
        <>
          {/* Step 1: Register new product */}
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-sm)', marginBottom: 16, border: '0.5px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, background: 'var(--navy-accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>1</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Register New Product</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
              {[
                { key: 'sku',     label: 'New SKU Code',    placeholder: 'e.g. REF_225L_DC_2026', required: true },
                { key: 'segment', label: 'Segment / Size',  placeholder: 'e.g. 225L',             required: false },
                { key: 'price',   label: 'Price Point (₹)', placeholder: 'e.g. 14500',            required: true },
              ].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}{f.required && <span style={{ color: '#DC2626', marginLeft: 2 }}>*</span>}</label>
                  <input
                    value={npForm[f.key]}
                    onChange={e => setNpForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ ...npFieldStyle, borderColor: submitAttempted && f.required && !npForm[f.key] ? '#DC2626' : 'var(--border)' }}
                  />
                  {submitAttempted && f.required && !npForm[f.key] && <span style={{ color: '#DC2626', fontSize: 10, marginTop: 3, display: 'block' }}>Required</span>}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Category<span style={{ color: '#DC2626', marginLeft: 2 }}>*</span></label>
                <select value={npForm.category} onChange={e => setNpForm(p => ({ ...p, category: e.target.value }))} style={npFieldStyle}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Expected Launch Date<span style={{ color: '#DC2626', marginLeft: 2 }}>*</span></label>
                <input type="date" value={npForm.launch} onChange={e => setNpForm(p => ({ ...p, launch: e.target.value }))}
                  style={{ ...npFieldStyle, borderColor: submitAttempted && !npForm.launch ? '#DC2626' : 'var(--border)' }} />
                {submitAttempted && !npForm.launch && <span style={{ color: '#DC2626', fontSize: 10, marginTop: 3, display: 'block' }}>Required</span>}
              </div>
              <div>
                <label style={labelStyle}>Target Branches</label>
                <div style={{ ...npFieldStyle, color: 'var(--text-2)' }}>All 8 Branches selected</div>
              </div>
            </div>

            <button onClick={handleNpGenerate} disabled={npLoading}
              style={{ background: npLoading ? '#6B7280' : 'var(--navy-accent)', color: 'white', border: 'none', borderRadius: 12, padding: '13px 28px', fontSize: 14, fontWeight: 700, cursor: npLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'opacity 0.15s' }}>
              {npLoading ? (
                <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> AI is analysing look-alike products...</>
              ) : (
                <> ⚡ Generate Forecast </>
              )}
            </button>
          </div>

          {/* Step 2: AI-generated forecast results */}
          {npResults && (
            <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, background: 'var(--navy-accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>2</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>AI-Generated Forecast — 3 Views</div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 20, marginLeft: 40 }}>
                Based on <strong>{npForm.sku || 'your new SKU'}</strong>, the AI identified 3 look-alike products and generated 3 demand scenarios.
                The <strong>Recommended</strong> view uses a weighted blend of all 3.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
                {Object.entries(npResults).map(([key, r]) => (
                  <div key={key} onClick={() => setNpSelected(key)}
                    style={{ borderRadius: 14, padding: 20, cursor: 'pointer', background: r.dark ? 'var(--navy)' : npSelected === key ? '#EFF6FF' : 'var(--bg)', border: npSelected === key ? `2px solid ${r.dark ? '#3B82F6' : r.tagColor}` : `0.5px solid ${r.dark ? 'rgba(255,255,255,0.08)' : 'var(--border)'}`, transition: 'all 0.2s ease', transform: npSelected === key ? 'translateY(-2px)' : 'none', boxShadow: npSelected === key ? 'var(--shadow-md)' : 'none' }}>
                    <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', padding: '4px 10px', borderRadius: 20, marginBottom: 10, background: r.tagColor, color: 'white' }}>{r.tag}</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: r.dark ? 'white' : 'var(--text-1)', marginBottom: 4 }}>{r.method}</div>
                    <div style={{ fontSize: 11, color: r.dark ? 'rgba(255,255,255,0.4)' : 'var(--text-2)', lineHeight: 1.5, marginBottom: 14 }}>{r.desc}</div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: r.dark ? 'white' : r.tagColor, marginBottom: 2 }}>{r.totalUnits.toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: 11, color: r.dark ? 'rgba(255,255,255,0.4)' : 'var(--text-2)', marginBottom: 14 }}>projected units · 6 months</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <div style={{ flex: 1, height: 5, borderRadius: 3, background: r.dark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: r.confColor, width: `${r.confidence}%`, transition: 'width 0.8s ease' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: r.dark ? 'rgba(255,255,255,0.7)' : 'var(--text-2)' }}>{r.confidence}% conf.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40, marginBottom: 10 }}>
                      {r.monthly.map((v, i) => {
                        const maxV = Math.max(...r.monthly);
                        const h = (v / maxV) * 100;
                        const opacity = 0.35 + (i / r.monthly.length) * 0.65;
                        return <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0', height: `${h}%`, background: r.dark ? `rgba(255,255,255,${opacity})` : r.tagColor, opacity: r.dark ? 1 : opacity }} />;
                      })}
                    </div>
                    <div style={{ fontSize: 9, color: r.dark ? 'rgba(255,255,255,0.35)' : 'var(--text-3)', lineHeight: 1.4 }}>
                      {MONTHS.map((m, i) => `${m}: ${r.monthly[i].toLocaleString('en-IN')}`).join(' · ')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Ramp trajectory chart */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ background: '#F8FAFF', borderRadius: 8, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', border: '0.5px solid var(--border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>Ramp Trajectory — All 3 Views</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Show:</span>
                  {LOOKALIKE_LINES.map(line => (
                    <label key={line} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: 'var(--text-1)' }}>
                      <input type="checkbox" checked={npChartLines.includes(line)} onChange={e => setNpChartLines(v => e.target.checked ? [...v, line] : v.filter(l => l !== line))} style={{ accentColor: LINE_COLORS_NPI[line], cursor: 'pointer' }} />
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: LINE_COLORS_NPI[line], display: 'inline-block', flexShrink: 0 }} />
                      {line}
                    </label>
                  ))}
                </div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={npChartData}>
                      <defs>
                        <linearGradient id="npiGradRed"  x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#E31837" stopOpacity={0.2} /><stop offset="95%" stopColor="#E31837" stopOpacity={0} /></linearGradient>
                        <linearGradient id="npiGradBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.12} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-2)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-2)' }} tickFormatter={v => v.toLocaleString('en-IN')} />
                      <Tooltip formatter={(v, n) => [v.toLocaleString('en-IN') + ' units', n]} contentStyle={{ borderRadius: 10, fontSize: 12, border: '0.5px solid var(--border)' }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {npChartLines.includes('Recommended')  && <Area type="monotone" dataKey="Recommended"  name="Recommended"  stroke="#E31837" strokeWidth={2.5} fill="url(#npiGradRed)"  dot={false} />}
                      {npChartLines.includes('Conservative') && <Area type="monotone" dataKey="Conservative" name="Conservative" stroke="#3B82F6" strokeWidth={2}   fill="url(#npiGradBlue)" dot={false} strokeDasharray="6 3" />}
                      {npChartLines.includes('Optimistic')   && <Line type="monotone" dataKey="Optimistic"   name="Optimistic"   stroke="#16A34A" strokeWidth={2}   dot={false} strokeDasharray="3 3" />}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <button onClick={handleNpSave}
                style={{ background: '#16A34A', color: 'white', border: 'none', borderRadius: 12, padding: '13px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                ✓ Use {Object.entries(npResults).find(([k]) => k === npSelected)?.[1]?.tag} as Forecast → Save to Cycle
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Renovation: LFL selector + generate ── */}
      {npiType === 'renovation' && (
        <div style={{
          background: 'var(--card)', borderRadius: 16, padding: 24,
          boxShadow: 'var(--shadow-sm)', marginBottom: 16, border: '0.5px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 28, height: 28, background: '#D97706', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0,
            }}>1</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Select LFL Predecessor</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                Phase-out plan is derived from the replacement SKU's 2025 demand history (like-for-like basis).
              </div>
            </div>
          </div>

          {filteredLflMappings.length === 0 ? (
            <div style={{
              padding: '12px 14px', borderRadius: 8,
              background: '#F3F4F6', color: '#9CA3AF',
              border: '1px solid #E5E7EB', fontSize: 13, marginBottom: 20,
            }}>
              No LFL predecessors found. Ask your admin to add one in the Admin Console.
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>
                LFL Predecessor<span style={{ color: '#DC2626', marginLeft: 2 }}>*</span>
              </label>
              <select
                value={selectedLfl}
                onChange={e => {
                  setSelectedLfl(e.target.value);
                  setRenovationReady(false);
                  setStatsError(null);
                  setSaved(false);
                }}
                style={{
                  width: '100%', padding: '10px 12px',
                  border: `0.5px solid ${submitAttempted && !selectedLfl ? '#DC2626' : 'var(--border)'}`,
                  borderRadius: 10, fontSize: 13,
                  background: 'var(--bg)', color: 'var(--text-1)', outline: 'none',
                }}
              >
                <option value="">Select LFL predecessor…</option>
                {filteredLflMappings.map((l, i) => (
                  <option key={i} value={String(i)}>
                    {l.old_sku} → {l.new_sku} (effective: {l.effective_date})
                  </option>
                ))}
              </select>
              {submitAttempted && !selectedLfl && (
                <span style={{ color: '#DC2626', fontSize: 10, marginTop: 3, display: 'block' }}>Required</span>
              )}

              {/* Demand basis disclosure — shown once stats load */}
              {selectedLflEntry && predecessorStats && !statsLoading && (
                <div style={{
                  marginTop: 10, padding: '8px 12px', borderRadius: 8,
                  background: '#F0FDF4', border: '0.5px solid #BBF7D0',
                  fontSize: 11, color: '#15803D',
                }}>
                  Demand basis: <strong>{newSkuName}</strong> (LFL replacement) ·
                  Avg monthly demand 2025: <strong>{predecessorStats.avgMonthlyUnits.toLocaleString('en-IN')} units</strong> ·
                  Opening inventory basis: <strong>{Math.round(predecessorStats.avgMonthlyUnits * 3 * 2.5).toLocaleString('en-IN')} units</strong>
                  {' '}(3-month avg × 2.5 buffer)
                </div>
              )}
              {statsError && !statsLoading && (
                <div style={{
                  marginTop: 10, padding: '8px 12px', borderRadius: 8,
                  background: '#FEF2F2', border: '0.5px solid #FECACA',
                  fontSize: 11, color: '#DC2626',
                }}>
                  ⚠ {statsError}
                </div>
              )}
              {statsLoading && (
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
                  Loading demand history…
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || statsLoading || !predecessorStats}
            style={{
              background: generating || !predecessorStats ? '#6B7280' : '#D97706',
              color: 'white', border: 'none', borderRadius: 12,
              padding: '13px 28px', fontSize: 14, fontWeight: 700,
              cursor: generating || !predecessorStats ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: generating || !predecessorStats ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {generating ? (
              <>
                <div style={{
                  width: 16, height: 16,
                  border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                }}/>
                Computing phase-out plan…
              </>
            ) : (
              <>⚡ Generate Phase-Out Forecast</>
            )}
          </button>
        </div>
      )}

      {/* ══════════════════════════ RENOVATION OUTPUT ══════════════════════════ */}
      {renovationReady && npiType === 'renovation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Section A: Predecessor Phase-Out Plan */}
          <div style={{
            background: 'var(--card)', borderRadius: 16, padding: 24,
            boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 28, height: 28, background: '#D97706', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
              }}>A</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
                  Predecessor Phase-Out Plan
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                  {oldSkuName} · Opening: {(phaseOutRows[0]?.opening || 0).toLocaleString('en-IN')} units ·
                  Sell-through: 65%/month · Basis: {newSkuName} 2025 demand history (LFL)
                </div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Month', 'Opening Inventory', 'Monthly Sell-through', 'Closing Inventory', 'Phase-out Status'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {phaseOutRows.map((row, i) => (
                    <tr key={row.month} style={{ background: i % 2 === 0 ? 'var(--card)' : '#FAFAFA' }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{row.month} '26</td>
                      <td style={tdStyle}>{row.opening.toLocaleString('en-IN')}</td>
                      <td style={tdStyle}>{row.sold.toLocaleString('en-IN')}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: row.closing === 0 ? '#16A34A' : 'var(--text-1)' }}>
                        {row.closing.toLocaleString('en-IN')}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                          background: row.status !== 'Active' ? '#F0FDF4' : '#FFFBEB',
                          color:      row.status !== 'Active' ? '#16A34A' : '#D97706',
                        }}>
                          {row.status === 'Transition Complete' ? '✅ Transition Complete'
                            : row.status === 'Phase-out Complete' ? '✅ Phase-out Complete'
                            : '🔄 Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: Blended Total Forecast */}
          <div style={{
            background: 'var(--card)', borderRadius: 16, padding: 24,
            boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{
                width: 28, height: 28, background: '#16A34A', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
              }}>B</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
                  Blended Total Forecast
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                  Phase-out sell-through + new SKU ramp ·
                  Ramp starts {transDate
                    ? transDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'}
                </div>
              </div>
            </div>

            <div style={{
              padding: '8px 12px', borderRadius: 8, marginBottom: 16,
              background: '#FFF7ED', border: '0.5px solid #FED7AA',
              fontSize: 11, color: '#92400E',
            }}>
              New SKU ramp uses a standard appliance launch curve: Month 1 = 50% channel fill,
              Months 2–6 = normal demand ramp. Refine actual weekly numbers in the Forecast Grid
              after launch.
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Month', oldSkuName, `${newSkuName} (ramp)`, 'Combined Total'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {blendedRows.map((row, i) => (
                    <tr key={row.month} style={{ background: i % 2 === 0 ? 'var(--card)' : '#FAFAFA' }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{row.month} '26</td>
                      <td style={{ ...tdStyle, color: row.oldSku === 0 ? '#9CA3AF' : '#D97706', fontWeight: row.oldSku > 0 ? 600 : 400 }}>
                        {row.oldSku.toLocaleString('en-IN')}
                      </td>
                      <td style={{ ...tdStyle, color: row.newSku === 0 ? '#9CA3AF' : 'var(--navy-accent)', fontWeight: row.newSku > 0 ? 600 : 400 }}>
                        {row.newSku.toLocaleString('en-IN')}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, background: '#EFF3FF', color: 'var(--navy-accent)' }}>
                        {row.total.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#F0FDF4' }}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>6M Total</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#D97706' }}>
                      {blendedRows.reduce((s, r) => s + r.oldSku, 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--navy-accent)' }}>
                      {blendedRows.reduce((s, r) => s + r.newSku, 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 800, background: '#DCFCE7', color: '#16A34A' }}>
                      {blendedRows.reduce((s, r) => s + r.total, 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => setSaved(true)}
                style={{
                  background: saved ? '#16A34A' : 'var(--navy-accent)',
                  color: 'white', border: 'none', borderRadius: 12,
                  padding: '13px 28px', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', transition: 'background 0.2s',
                }}
              >
                {saved ? '✓ Saved to Cycle' : '✓ Save Blended Forecast → Jun 2026 Cycle'}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
