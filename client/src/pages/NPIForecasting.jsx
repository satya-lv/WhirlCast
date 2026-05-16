import React, { useState } from 'react';
import { PageHeader } from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CATEGORIES = ['Direct Cool Refrigerator','Frost Free Refrigerator','Washing Machine','Air Conditioner','Microwave','Induction'];
const BRANCHES   = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
const MONTHS     = ['Jun','Jul','Aug','Sep','Oct','Nov'];

const RESULTS = {
  recommended: {
    tag: 'Recommended',
    tagColor: '#E31837',
    method: 'Look-alike Blend Model',
    desc: 'Weighted average of 3 similar SKUs — REF_190L_DirectCool (50%), REF_185L_Legacy (30%), REF_200L_DC (20%)',
    totalUnits: 18240,
    confidence: 87,
    confColor: '#22C55E',
    monthly: [2100,2800,3200,3500,3300,3340],
    dark: true,
  },
  conservative: {
    tag: 'Conservative',
    tagColor: '#3B82F6',
    method: '3-Month SARIMAX Projection',
    desc: 'Short-horizon model using only 90-day trend data — lower risk, lower upside.',
    totalUnits: 14800,
    confidence: 74,
    confColor: '#3B82F6',
    monthly: [1800,2300,2600,2800,2700,2600],
    dark: false,
  },
  optimistic: {
    tag: 'Optimistic',
    tagColor: '#16A34A',
    method: 'High-Growth Scenario',
    desc: 'Best-case with planned Q3 trade promotion uplift (+22% AC category) applied.',
    totalUnits: 22600,
    confidence: 61,
    confColor: '#16A34A',
    monthly: [2600,3400,4000,4200,4200,4200],
    dark: false,
  },
};

export default function NPIForecasting() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    sku: '', category: CATEGORIES[0], segment: '', price: '', launch: '', branches: [...BRANCHES],
  });
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState(null);
  const [selected, setSelected] = useState('recommended');

  const handleGenerate = async () => {
    if (!form.sku || !form.price) { toast('Please fill in SKU Code and Price Point', 'warning'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    setResults(RESULTS);
    setSelected('recommended');
    setLoading(false);
    toast('✦ AI generated 3 forecast views using look-alike modelling', 'ai');
  };

  const handleSave = () => {
    toast(`✅ Look-alike Blend forecast saved for ${form.sku} — added to May 2026 cycle`, 'success');
  };

  const chartData = results
    ? MONTHS.map((m, i) => ({
        month: m,
        Recommended:  RESULTS.recommended.monthly[i],
        Conservative: RESULTS.conservative.monthly[i],
        Optimistic:   RESULTS.optimistic.monthly[i],
      }))
    : [];

  return (
    <div style={{ padding: 24, background: 'var(--bg)', minHeight: 'calc(100vh - 52px)' }}>
      <PageHeader
        title="New Product Introduction"
        subtitle="Forecast demand for a new SKU — the system automatically finds look-alike products and generates 3 forecast views"
        helpText="Enter your new product's details and click Generate Forecast. The AI will identify the 3 most similar existing SKUs based on category, price, and segment, then produce a Recommended (blended), Conservative (trend-only), and Optimistic (promo-uplifted) forecast. Select the view that best matches your business assumptions."
      />

      {/* Step 1 — Product Details */}
      <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24,
        boxShadow: 'var(--shadow-sm)', marginBottom: 16, border: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 28, height: 28, background: 'var(--navy-accent)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>1</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Register New Product</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
          {[
            { key: 'sku',     label: 'New SKU Code',     placeholder: 'e.g. REF_225L_DC_2026' },
            { key: 'segment', label: 'Segment / Size',   placeholder: 'e.g. 225L' },
            { key: 'price',   label: 'Price Point (₹)',  placeholder: 'e.g. 14500' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
                textTransform: 'uppercase', color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
                {f.label}
              </label>
              <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{ width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)',
                  borderRadius: 10, fontSize: 13, background: 'var(--bg)', color: 'var(--text-1)',
                  outline: 'none' }}/>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
              textTransform: 'uppercase', color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
              Category
            </label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)',
                borderRadius: 10, fontSize: 13, background: 'var(--bg)', color: 'var(--text-1)' }}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
              textTransform: 'uppercase', color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
              Expected Launch Date
            </label>
            <input type="date" value={form.launch} onChange={e => setForm(p => ({ ...p, launch: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)',
                borderRadius: 10, fontSize: 13, background: 'var(--bg)', color: 'var(--text-1)' }}/>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px',
              textTransform: 'uppercase', color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
              Target Branches
            </label>
            <div style={{ padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: 10,
              fontSize: 12, background: 'var(--bg)', color: 'var(--text-2)' }}>
              All 8 Branches selected
            </div>
          </div>
        </div>

        <button onClick={handleGenerate} disabled={loading}
          style={{
            marginTop: 20, background: loading ? '#6B7280' : 'var(--navy-accent)',
            color: 'white', border: 'none', borderRadius: 12, padding: '13px 28px',
            fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 10, transition: 'opacity 0.15s',
          }}>
          {loading ? (
            <>
              <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
              AI is analysing look-alike products...
            </>
          ) : (
            <> ⚡ Generate Forecast </>
          )}
        </button>
      </div>

      {/* Step 2 — Results */}
      {results && (
        <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24,
          boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border)', animation: 'fadeUp 0.4s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, background: 'var(--navy-accent)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>2</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>AI-Generated Forecast — 3 Views</div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 20, marginLeft: 40 }}>
            Based on <strong>{form.sku || 'your new SKU'}</strong>, the AI identified 3 look-alike products and generated 3 demand scenarios.
            The <strong>Recommended</strong> view uses a weighted blend of all 3. Select the view that best fits your planning assumptions.
          </p>

          {/* 3 Result Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
            {Object.entries(results).map(([key, r]) => (
              <div key={key} onClick={() => setSelected(key)}
                style={{
                  borderRadius: 14, padding: 20, cursor: 'pointer',
                  background: r.dark ? 'var(--navy)' : selected === key ? '#EFF6FF' : 'var(--bg)',
                  border: selected === key
                    ? `2px solid ${r.dark ? '#3B82F6' : r.tagColor}`
                    : `0.5px solid ${r.dark ? 'rgba(255,255,255,0.08)' : 'var(--border)'}`,
                  transition: 'all 0.2s ease',
                  transform: selected === key ? 'translateY(-2px)' : 'none',
                  boxShadow: selected === key ? 'var(--shadow-md)' : 'none',
                }}>
                <span style={{
                  display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px',
                  padding: '4px 10px', borderRadius: 20, marginBottom: 10,
                  background: r.tagColor, color: 'white',
                }}>{r.tag}</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: r.dark ? 'white' : 'var(--text-1)', marginBottom: 4 }}>
                  {r.method}
                </div>
                <div style={{ fontSize: 11, color: r.dark ? 'rgba(255,255,255,0.4)' : 'var(--text-2)',
                  lineHeight: 1.5, marginBottom: 14 }}>{r.desc}</div>

                <div style={{ fontSize: 30, fontWeight: 800,
                  color: r.dark ? 'white' : r.tagColor, marginBottom: 2 }}>
                  {r.totalUnits.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: r.dark ? 'rgba(255,255,255,0.4)' : 'var(--text-2)',
                  marginBottom: 14 }}>projected units · 6 months</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 3,
                    background: r.dark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: r.confColor,
                      width: `${r.confidence}%`, transition: 'width 0.8s ease' }}/>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600,
                    color: r.dark ? 'rgba(255,255,255,0.7)' : 'var(--text-2)' }}>{r.confidence}% conf.</span>
                </div>

                {/* Monthly mini bars */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40, marginBottom: 10 }}>
                  {r.monthly.map((v, i) => {
                    const maxV = Math.max(...r.monthly);
                    const h = (v / maxV) * 100;
                    const opacity = 0.35 + (i / r.monthly.length) * 0.65;
                    return (
                      <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0',
                        height: `${h}%`,
                        background: r.dark ? `rgba(255,255,255,${opacity})` : r.tagColor,
                        opacity: r.dark ? 1 : opacity,
                      }}/>
                    );
                  })}
                </div>
                <div style={{ fontSize: 9, color: r.dark ? 'rgba(255,255,255,0.35)' : 'var(--text-3)', lineHeight: 1.4 }}>
                  {MONTHS.map((m, i) => `${m}: ${r.monthly[i].toLocaleString('en-IN')}`).join(' · ')}
                </div>
              </div>
            ))}
          </div>

          {/* Comparison Chart */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 14 }}>
              Ramp Trajectory — All 3 Views
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="npiGradRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#E31837" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#E31837" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="npiGradBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-2)' }}/>
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-2)' }}
                    tickFormatter={v => v.toLocaleString('en-IN')}/>
                  <Tooltip formatter={(v, n) => [v.toLocaleString('en-IN') + ' units', n]}
                    contentStyle={{ borderRadius: 10, fontSize: 12, border: '0.5px solid var(--border)' }}/>
                  <Legend wrapperStyle={{ fontSize: 12 }}/>
                  <Area type="monotone" dataKey="Recommended"  name="Recommended"  stroke="#E31837" strokeWidth={2.5} fill="url(#npiGradRed)"  dot={false}/>
                  <Area type="monotone" dataKey="Conservative" name="Conservative" stroke="#3B82F6" strokeWidth={2}   fill="url(#npiGradBlue)" dot={false} strokeDasharray="6 3"/>
                  <Line type="monotone" dataKey="Optimistic"   name="Optimistic"   stroke="#16A34A" strokeWidth={2}   dot={false} strokeDasharray="3 3"/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <button onClick={handleSave}
            style={{ background: '#16A34A', color: 'white', border: 'none', borderRadius: 12,
              padding: '13px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            ✓ Use {Object.entries(results).find(([k]) => k === selected)?.[1]?.tag} as Forecast → Save to Cycle
          </button>
        </div>
      )}
    </div>
  );
}
