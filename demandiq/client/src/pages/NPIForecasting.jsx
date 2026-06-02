import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CATEGORIES = ['Direct Cool Refrigerator','Frost Free Refrigerator','Washing Machine','Air Conditioner','Microwave','Induction'];
const BRANCHES   = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
const MONTHS     = ['Jun','Jul','Aug','Sep','Oct','Nov'];

const CAT_MAP_NPI = {
  'REF_190L_DirectCool':'Direct Cool Refrigerator','REF_240L_FrostFree':'Frost Free Refrigerator',
  'REF_340L_TripleDoor':'Frost Free Refrigerator', 'WM_7KG_TopLoad':'Washing Machine',
  'WM_8KG_FrontLoad':'Washing Machine',            'WM_6.5KG_SemiAuto':'Washing Machine',
  'AC_1.5T_Inverter':'Air Conditioner',            'AC_2.0T_Split':'Air Conditioner',
  'MW_25L_Convection':'Microwave',                 'IH_3B_SmartGlass':'Induction',
};
const SEED_BASE_NPI = {
  'Direct Cool Refrigerator':1800,'Frost Free Refrigerator':2060,'Washing Machine':3620,
  'Air Conditioner':4905,'Microwave':558,'Induction':430,
};

const RESULTS = {
  recommended: {
    tag: 'Recommended', tagColor: '#E31837',
    method: 'Look-alike Blend Model',
    desc: 'Weighted average of 3 similar SKUs — REF_190L_DirectCool (50%), REF_185L_Legacy (30%), REF_200L_DC (20%)',
    totalUnits: 18240, confidence: 87, confColor: '#22C55E',
    monthly: [2100,2800,3200,3500,3300,3340], dark: true,
  },
  conservative: {
    tag: 'Conservative', tagColor: '#3B82F6',
    method: '3-Month SARIMAX Projection',
    desc: 'Short-horizon model using only 90-day trend data — lower risk, lower upside.',
    totalUnits: 14800, confidence: 74, confColor: '#3B82F6',
    monthly: [1800,2300,2600,2800,2700,2600], dark: false,
  },
  optimistic: {
    tag: 'Optimistic', tagColor: '#16A34A',
    method: 'High-Growth Scenario',
    desc: 'Best-case with planned Q3 trade promotion uplift (+22% AC category) applied.',
    totalUnits: 22600, confidence: 61, confColor: '#16A34A',
    monthly: [2600,3400,4000,4200,4200,4200], dark: false,
  },
};

const REQUIRED_FIELDS = ['sku', 'category', 'price', 'launch'];
const LOOKALIKE_LINES = ['Recommended', 'Conservative', 'Optimistic'];
const LINE_COLORS_NPI = { Recommended:'#E31837', Conservative:'#3B82F6', Optimistic:'#16A34A' };

const fieldStyle = {
  width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)',
  borderRadius: 10, fontSize: 13, background: 'var(--bg)', color: 'var(--text-1)', outline: 'none',
};
const labelStyle = {
  fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
  color: 'var(--text-2)', display: 'block', marginBottom: 6,
};
const thStyle = { padding: '8px 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7280', background: '#F8FAFF', textAlign: 'left', border: '1px solid #E5E7EB', whiteSpace: 'nowrap' };
const tdStyle = { padding: '8px 12px', fontSize: 12, border: '1px solid #E5E7EB' };

export default function NPIForecasting() {
  useEffect(() => { document.title = 'WhirlCast — NPI Forecasting'; }, []);
  const { toast } = useToast();

  /* ── Shared state ── */
  const [npiType, setNpiType]           = useState(null);
  const [form, setForm]                 = useState({ sku: '', category: CATEGORIES[0], segment: '', price: '', launch: '', branches: [...BRANCHES] });
  const [loading, setLoading]           = useState(false);
  const [results, setResults]           = useState(null);
  const [selected, setSelected]         = useState('recommended');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [chartLines, setChartLines]     = useState([...LOOKALIKE_LINES]);

  /* ── Renovation-specific state ── */
  const [lflMappings, setLflMappings] = useState([]);
  const [selectedLfl, setSelectedLfl] = useState(''); // index into lflMappings as string

  useEffect(() => {
    fetch('/api/admin/lfl')
      .then(r => r.json())
      .then(d => setLflMappings(d.mappings || []))
      .catch(() => {});
  }, []);

  /* ── Type selection — reset state on type change ── */
  const handleTypeSelect = (type) => {
    setNpiType(type);
    setResults(null);
    setSubmitAttempted(false);
    setSelectedLfl('');
  };

  /* ── Derived LFL ── */
  const selectedLflEntry = selectedLfl !== '' ? lflMappings[parseInt(selectedLfl)] || null : null;

  /* ── Generate ── */
  const handleGenerate = async () => {
    setSubmitAttempted(true);
    if (npiType === 'renovation') {
      if (lflMappings.length === 0) { toast('No LFL predecessors available. Contact your admin.', 'warning'); return; }
      if (!selectedLfl) { toast('Please select an LFL predecessor', 'warning'); return; }
    } else {
      const missing = REQUIRED_FIELDS.filter(f => !form[f]);
      if (missing.length) { toast('Please fill in all required fields', 'warning'); return; }
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    setResults(RESULTS);
    setSelected('recommended');
    setLoading(false);
    toast('✦ AI generated 3 forecast views using look-alike modelling', 'ai');
  };

  const handleSave = () => {
    toast(`✅ Look-alike Blend forecast saved for ${form.sku} — added to Jun 2026 cycle`, 'success');
  };

  /* ── Renovation: phase-out computed from backend defaults (user does not input these) ── */
  const computePhaseOut = () => {
    if (!results || npiType !== 'renovation') return [];
    const cat = selectedLflEntry ? CAT_MAP_NPI[selectedLflEntry.old_sku] : null;
    const monthlyAvg = Math.round((cat ? SEED_BASE_NPI[cat] : 1000) / 6);
    let opening = Math.round(monthlyAvg * 3 * 2.5); // 3-month avg demand × 2.5 buffer
    const str = 0.65; // default 65% sell-through
    return MONTHS.map(month => {
      const sold    = Math.round(opening * str);
      const closing = Math.max(0, opening - sold);
      const status  = opening === 0 ? 'Phase-out Complete' : closing === 0 ? 'Transition Complete' : 'Active';
      const row     = { month, opening, sold, closing, status };
      opening       = closing;
      return row;
    });
  };

  /* ── Renovation: transition = LFL effective date + 30 days ── */
  const getTransIdx = () => {
    const base = selectedLflEntry?.effective_date || form.launch;
    if (!base) return 0;
    const d = new Date(base);
    d.setDate(d.getDate() + 30);
    return Math.max(0, Math.min(5, d.getMonth() - 5));
  };

  const getTransitionDate = () => {
    const base = selectedLflEntry?.effective_date || form.launch;
    if (!base) return null;
    const d = new Date(base);
    d.setDate(d.getDate() + 30);
    return d;
  };

  /* ── Renovation: blended total ── */
  const computeRenovBlended = () => {
    if (!results || npiType !== 'renovation') return [];
    const phaseOut = computePhaseOut();
    const transIdx = getTransIdx();
    return MONTHS.map((month, i) => {
      const oldSku = phaseOut[i]?.sold || 0;
      let newSku = 0;
      if (i === transIdx) {
        newSku = Math.round((RESULTS.recommended.monthly[0] || 0) * 0.5);
      } else if (i > transIdx) {
        const ri = i - transIdx;
        newSku = RESULTS.recommended.monthly[Math.min(ri, RESULTS.recommended.monthly.length - 1)] || 0;
      }
      return { month, oldSku, newSku, total: oldSku + newSku };
    });
  };

  /* ── Chart data ── */
  const chartData = results
    ? MONTHS.map((m, i) => ({ month: m, Recommended: RESULTS.recommended.monthly[i], Conservative: RESULTS.conservative.monthly[i], Optimistic: RESULTS.optimistic.monthly[i] }))
    : [];

  /* ═══════════════════════════════════════════════════════════ RENDER */
  return (
    <div style={{ padding: 24, background: 'var(--bg)', minHeight: 'calc(100vh - 52px)' }}>
      <PageHeader
        title="New Product Introduction"
        subtitle="Forecast demand for a new SKU — choose a path below to get started"
        helpText="For a brand new product, the AI identifies look-alike SKUs and generates 3 demand scenarios. For a product renovation, it also plans the predecessor phase-out and creates a blended forecast for supply planning."
      />

      {/* ── Step 0: Product type selector ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginBottom: 14 }}>
          What type of product introduction is this?
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 760 }}>
          <div
            onClick={() => handleTypeSelect('new_product')}
            style={{
              borderRadius: 14, padding: 22, cursor: 'pointer', transition: 'all 0.2s',
              border: npiType === 'new_product' ? '2px solid var(--navy-accent)' : '1.5px solid var(--border)',
              background: npiType === 'new_product' ? '#EFF6FF' : 'var(--card)',
              boxShadow: npiType === 'new_product' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
              transform: npiType === 'new_product' ? 'translateY(-2px)' : 'none',
            }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✨</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy-accent)', marginBottom: 6 }}>New Product Innovation</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Entirely new product with no sales history. We will use look-alike modelling from similar existing SKUs.
            </div>
            {npiType === 'new_product' && (
              <div style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: 'var(--navy-accent)' }}>✓ Selected</div>
            )}
          </div>

          <div
            onClick={() => handleTypeSelect('renovation')}
            style={{
              borderRadius: 14, padding: 22, cursor: 'pointer', transition: 'all 0.2s',
              border: npiType === 'renovation' ? '2px solid #D97706' : '1.5px solid var(--border)',
              background: npiType === 'renovation' ? '#FFFBEB' : 'var(--card)',
              boxShadow: npiType === 'renovation' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
              transform: npiType === 'renovation' ? 'translateY(-2px)' : 'none',
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
        </div>
      </div>

      {/* ── Renovation: just the LFL predecessor selector ── */}
      {npiType === 'renovation' && (
        <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-sm)', marginBottom: 16, border: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 28, height: 28, background: '#D97706', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>1</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Select LFL Predecessor</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                AI will use predecessor forecast history to plan the phase-out and ramp the new SKU.
              </div>
            </div>
          </div>

          {lflMappings.length === 0 ? (
            <div style={{ ...fieldStyle, background: '#F3F4F6', color: '#9CA3AF', border: '1px solid #E5E7EB', cursor: 'not-allowed', marginBottom: 20 }}>
              No LFL predecessors found. Ask your admin to add one in the Admin Console.
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>LFL Predecessor<span style={{ color:'#DC2626', marginLeft:2 }}>*</span></label>
              <select
                value={selectedLfl}
                onChange={e => setSelectedLfl(e.target.value)}
                style={{ ...fieldStyle, borderColor: submitAttempted && !selectedLfl ? '#DC2626' : 'var(--border)' }}>
                <option value="">Select LFL predecessor…</option>
                {lflMappings.map((l, i) => (
                  <option key={i} value={String(i)}>
                    {l.old_sku} → {l.new_sku} (effective: {l.effective_date})
                  </option>
                ))}
              </select>
              {submitAttempted && !selectedLfl && (
                <span style={{ color:'#DC2626', fontSize:10, marginTop:3, display:'block' }}>Required</span>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 6 }}>
                Managed by your admin team in the Admin Console.
              </div>
            </div>
          )}

          <button onClick={handleGenerate} disabled={loading}
            style={{ background: loading ? '#6B7280' : '#D97706', color: 'white', border: 'none', borderRadius: 12, padding: '13px 28px', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'opacity 0.15s' }}>
            {loading ? (
              <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/> AI is analysing predecessor history...</>
            ) : (
              <> ⚡ Generate Forecast </>
            )}
          </button>
        </div>
      )}

      {/* ── New product: full Register New Product form ── */}
      {npiType === 'new_product' && (
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
                <label style={labelStyle}>{f.label}{f.required && <span style={{ color:'#DC2626', marginLeft:2 }}>*</span>}</label>
                <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ ...fieldStyle, borderColor: submitAttempted && f.required && !form[f.key] ? '#DC2626' : 'var(--border)' }}/>
                {submitAttempted && f.required && !form[f.key] && <span style={{ color:'#DC2626', fontSize:10, marginTop:3, display:'block' }}>Required</span>}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Category<span style={{ color:'#DC2626', marginLeft:2 }}>*</span></label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={fieldStyle}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Expected Launch Date<span style={{ color:'#DC2626', marginLeft:2 }}>*</span></label>
              <input type="date" value={form.launch} onChange={e => setForm(p => ({ ...p, launch: e.target.value }))}
                style={{ ...fieldStyle, borderColor: submitAttempted && !form.launch ? '#DC2626' : 'var(--border)' }}/>
              {submitAttempted && !form.launch && <span style={{ color:'#DC2626', fontSize:10, marginTop:3, display:'block' }}>Required</span>}
            </div>
            <div>
              <label style={labelStyle}>Target Branches</label>
              <div style={{ ...fieldStyle, color: 'var(--text-2)' }}>All 8 Branches selected</div>
            </div>
          </div>

          <button onClick={handleGenerate} disabled={loading}
            style={{ background: loading ? '#6B7280' : 'var(--navy-accent)', color: 'white', border: 'none', borderRadius: 12, padding: '13px 28px', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'opacity 0.15s' }}>
            {loading ? (
              <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/> AI is analysing look-alike products...</>
            ) : (
              <> ⚡ Generate Forecast </>
            )}
          </button>
        </div>
      )}

      {/* ══════════════════════════════════ NEW PRODUCT OUTPUT ══════════════════════════════════ */}
      {results && npiType === 'new_product' && (
        <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)', animation: 'fadeUp 0.4s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, background: 'var(--navy-accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>2</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>AI-Generated Forecast — 3 Views</div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 20, marginLeft: 40 }}>
            Based on <strong>{form.sku || 'your new SKU'}</strong>, the AI identified 3 look-alike products and generated 3 demand scenarios.
            The <strong>Recommended</strong> view uses a weighted blend of all 3. Select the view that best fits your planning assumptions.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
            {Object.entries(results).map(([key, r]) => (
              <div key={key} onClick={() => setSelected(key)}
                style={{ borderRadius: 14, padding: 20, cursor: 'pointer', background: r.dark ? 'var(--navy)' : selected === key ? '#EFF6FF' : 'var(--bg)', border: selected === key ? `2px solid ${r.dark ? '#3B82F6' : r.tagColor}` : `0.5px solid ${r.dark ? 'rgba(255,255,255,0.08)' : 'var(--border)'}`, transition: 'all 0.2s ease', transform: selected === key ? 'translateY(-2px)' : 'none', boxShadow: selected === key ? 'var(--shadow-md)' : 'none' }}>
                <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', padding: '4px 10px', borderRadius: 20, marginBottom: 10, background: r.tagColor, color: 'white' }}>{r.tag}</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: r.dark ? 'white' : 'var(--text-1)', marginBottom: 4 }}>{r.method}</div>
                <div style={{ fontSize: 11, color: r.dark ? 'rgba(255,255,255,0.4)' : 'var(--text-2)', lineHeight: 1.5, marginBottom: 14 }}>{r.desc}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: r.dark ? 'white' : r.tagColor, marginBottom: 2 }}>{r.totalUnits.toLocaleString('en-IN')}</div>
                <div style={{ fontSize: 11, color: r.dark ? 'rgba(255,255,255,0.4)' : 'var(--text-2)', marginBottom: 14 }}>projected units · 6 months</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: r.dark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: r.confColor, width: `${r.confidence}%`, transition: 'width 0.8s ease' }}/>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: r.dark ? 'rgba(255,255,255,0.7)' : 'var(--text-2)' }}>{r.confidence}% conf.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40, marginBottom: 10 }}>
                  {r.monthly.map((v, i) => {
                    const maxV = Math.max(...r.monthly);
                    const h = (v / maxV) * 100;
                    const opacity = 0.35 + (i / r.monthly.length) * 0.65;
                    return <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0', height: `${h}%`, background: r.dark ? `rgba(255,255,255,${opacity})` : r.tagColor, opacity: r.dark ? 1 : opacity }}/>;
                  })}
                </div>
                <div style={{ fontSize: 9, color: r.dark ? 'rgba(255,255,255,0.35)' : 'var(--text-3)', lineHeight: 1.4 }}>
                  {MONTHS.map((m, i) => `${m}: ${r.monthly[i].toLocaleString('en-IN')}`).join(' · ')}
                </div>
              </div>
            ))}
          </div>

          {/* Comparison chart */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ background:'#F8FAFF', borderRadius:8, padding:'10px 14px', marginBottom:10, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', border:'0.5px solid var(--border)' }}>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--text-1)' }}>Ramp Trajectory — All 3 Views</span>
              <span style={{ fontSize:11, color:'var(--text-3)' }}>Show:</span>
              {LOOKALIKE_LINES.map(line => (
                <label key={line} style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer', fontSize:12, color:'var(--text-1)' }}>
                  <input type="checkbox" checked={chartLines.includes(line)} onChange={e => setChartLines(v => e.target.checked ? [...v,line] : v.filter(l=>l!==line))} style={{ accentColor:LINE_COLORS_NPI[line], cursor:'pointer' }}/>
                  <span style={{ width:10, height:10, borderRadius:'50%', background:LINE_COLORS_NPI[line], display:'inline-block', flexShrink:0 }}/>
                  {line}
                </label>
              ))}
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="npiGradRed"  x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#E31837" stopOpacity={0.2}/><stop offset="95%" stopColor="#E31837" stopOpacity={0}/></linearGradient>
                    <linearGradient id="npiGradBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.12}/><stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/></linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-2)' }}/>
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-2)' }} tickFormatter={v => v.toLocaleString('en-IN')}/>
                  <Tooltip formatter={(v, n) => [v.toLocaleString('en-IN') + ' units', n]} contentStyle={{ borderRadius: 10, fontSize: 12, border: '0.5px solid var(--border)' }}/>
                  <Legend wrapperStyle={{ fontSize: 12 }}/>
                  {chartLines.includes('Recommended')  && <Area type="monotone" dataKey="Recommended"  name="Recommended"  stroke="#E31837" strokeWidth={2.5} fill="url(#npiGradRed)"  dot={false}/>}
                  {chartLines.includes('Conservative') && <Area type="monotone" dataKey="Conservative" name="Conservative" stroke="#3B82F6" strokeWidth={2}   fill="url(#npiGradBlue)" dot={false} strokeDasharray="6 3"/>}
                  {chartLines.includes('Optimistic')   && <Line type="monotone" dataKey="Optimistic"   name="Optimistic"   stroke="#16A34A" strokeWidth={2}   dot={false} strokeDasharray="3 3"/>}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <button onClick={handleSave} style={{ background: '#16A34A', color: 'white', border: 'none', borderRadius: 12, padding: '13px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            ✓ Use {Object.entries(results).find(([k]) => k === selected)?.[1]?.tag} as Forecast → Save to Cycle
          </button>
        </div>
      )}

      {/* ══════════════════════════════════ RENOVATION OUTPUT ══════════════════════════════════ */}
      {results && npiType === 'renovation' && (() => {
        const phaseOutRows = computePhaseOut();
        const transDate    = getTransitionDate();
        const oldSkuName   = selectedLflEntry?.old_sku || 'Old SKU';
        const newSkuName   = selectedLflEntry?.new_sku || 'New SKU';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeUp 0.4s ease' }}>

            {/* Section A: Predecessor Phase-Out Plan */}
            <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, background: '#D97706', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>A</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Predecessor Phase-Out Plan</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                    {oldSkuName} · Starting inventory: {(phaseOutRows[0]?.opening || 0).toLocaleString('en-IN')} units · Sell-through: 65%/month
                  </div>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Month','Opening Inventory','Monthly Sell-through','Closing Inventory','Phase-out Status'].map(h => (
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
                        <td style={{ ...tdStyle, fontWeight: 600, color: row.closing === 0 ? '#16A34A' : 'var(--text-1)' }}>{row.closing.toLocaleString('en-IN')}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: row.status === 'Transition Complete' || row.status === 'Phase-out Complete' ? '#F0FDF4' : '#FFFBEB', color: row.status === 'Transition Complete' || row.status === 'Phase-out Complete' ? '#16A34A' : '#D97706' }}>
                            {row.status === 'Transition Complete' ? '✅ Transition Complete' : row.status === 'Phase-out Complete' ? '✅ Phase-out Complete' : '🔄 Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section B: New SKU Ramp Forecast */}
            <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, background: 'var(--navy-accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>B</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>New SKU Ramp Forecast — {newSkuName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                    Ramp starts {transDate ? transDate.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'} · Month 1 = channel fill (50%) · Months 2–6 = normal look-alike ramp
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {Object.entries(results).map(([key, r]) => {
                  const transIdx = getTransIdx();
                  const rampMonthly = MONTHS.map((_, i) => {
                    if (i < transIdx) return 0;
                    if (i === transIdx) return Math.round(r.monthly[0] * 0.5);
                    const ri = i - transIdx;
                    return r.monthly[Math.min(ri, r.monthly.length - 1)] || 0;
                  });
                  const rampTotal = rampMonthly.reduce((s, v) => s + v, 0);
                  const maxV = Math.max(...rampMonthly, 1);
                  return (
                    <div key={key} onClick={() => setSelected(key)}
                      style={{ borderRadius: 14, padding: 20, cursor: 'pointer', background: r.dark ? 'var(--navy)' : selected === key ? '#EFF6FF' : 'var(--bg)', border: selected === key ? `2px solid ${r.dark ? '#3B82F6' : r.tagColor}` : `0.5px solid ${r.dark ? 'rgba(255,255,255,0.08)' : 'var(--border)'}`, transition: 'all 0.2s', transform: selected === key ? 'translateY(-2px)' : 'none' }}>
                      <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, marginBottom: 10, background: r.tagColor, color: 'white' }}>{r.tag}</span>
                      <div style={{ fontSize: 13, fontWeight: 700, color: r.dark ? 'white' : 'var(--text-1)', marginBottom: 4 }}>{r.method}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: r.dark ? 'white' : r.tagColor, marginBottom: 2 }}>{rampTotal.toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 11, color: r.dark ? 'rgba(255,255,255,0.4)' : 'var(--text-2)', marginBottom: 14 }}>projected units · post-transition</div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36, marginBottom: 8 }}>
                        {rampMonthly.map((v, i) => {
                          const h = (v / maxV) * 100;
                          const opacity = 0.35 + (i / rampMonthly.length) * 0.65;
                          return <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0', height: `${Math.max(h, v > 0 ? 5 : 0)}%`, background: r.dark ? `rgba(255,255,255,${opacity})` : r.tagColor, opacity: r.dark ? 1 : opacity }}/>;
                        })}
                      </div>
                      <div style={{ fontSize: 9, color: r.dark ? 'rgba(255,255,255,0.35)' : 'var(--text-3)', lineHeight: 1.4 }}>
                        {MONTHS.map((m, i) => `${m}: ${rampMonthly[i].toLocaleString('en-IN')}`).join(' · ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section C: Blended Total Forecast */}
            <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, background: '#16A34A', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>C</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Blended Total Forecast</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>Actual plan submitted to supply — combined old and new SKU demand</div>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Month', `${oldSkuName} Units`, `${newSkuName} Units`, 'Combined Total'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {computeRenovBlended().map((row, i) => (
                      <tr key={row.month} style={{ background: i % 2 === 0 ? 'var(--card)' : '#FAFAFA' }}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{row.month} '26</td>
                        <td style={{ ...tdStyle, color: row.oldSku === 0 ? '#9CA3AF' : '#D97706', fontWeight: row.oldSku > 0 ? 600 : 400 }}>{row.oldSku.toLocaleString('en-IN')}</td>
                        <td style={{ ...tdStyle, color: row.newSku === 0 ? '#9CA3AF' : 'var(--navy-accent)', fontWeight: row.newSku > 0 ? 600 : 400 }}>{row.newSku.toLocaleString('en-IN')}</td>
                        <td style={{ ...tdStyle, fontWeight: 700, background: '#EFF3FF', color: 'var(--navy-accent)' }}>{row.total.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#F0FDF4', fontWeight: 700 }}>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>6M Total</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#D97706' }}>{computeRenovBlended().reduce((s, r) => s + r.oldSku, 0).toLocaleString('en-IN')}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--navy-accent)' }}>{computeRenovBlended().reduce((s, r) => s + r.newSku, 0).toLocaleString('en-IN')}</td>
                      <td style={{ ...tdStyle, fontWeight: 800, background: '#DCFCE7', color: '#16A34A' }}>{computeRenovBlended().reduce((s, r) => s + r.total, 0).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16 }}>
                <button onClick={handleSave} style={{ background: '#16A34A', color: 'white', border: 'none', borderRadius: 12, padding: '13px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  ✓ Use {Object.entries(results).find(([k]) => k === selected)?.[1]?.tag} as Forecast → Save to Cycle
                </button>
              </div>
            </div>

          </div>
        );
      })()}
    </div>
  );
}
