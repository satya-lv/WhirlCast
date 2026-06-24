'use strict';
import React, { useState, useEffect } from 'react';

const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];

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

export default function NPITab() {
  const [npiType,          setNpiType]          = useState(null);
  const [lflMappings,      setLflMappings]      = useState([]);
  const [selectedLfl,      setSelectedLfl]      = useState('');
  const [predecessorStats, setPredecessorStats] = useState(null);
  const [statsLoading,     setStatsLoading]     = useState(false);
  const [generating,       setGenerating]       = useState(false);
  const [renovationReady,  setRenovationReady]  = useState(false);
  const [submitAttempted,  setSubmitAttempted]  = useState(false);
  const [saved,            setSaved]            = useState(false);

  const selectedLflEntry = selectedLfl !== '' ? lflMappings[parseInt(selectedLfl)] || null : null;

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
    if (!selectedLflEntry?.new_sku) { setPredecessorStats(null); return; }
    setStatsLoading(true);
    fetch(`/api/demand-planning/npi/predecessor-stats?sku=${encodeURIComponent(selectedLflEntry.new_sku)}`)
      .then(r => r.json())
      .then(d => setPredecessorStats(d.error ? null : d))
      .catch(() => setPredecessorStats(null))
      .finally(() => setStatsLoading(false));
  }, [selectedLflEntry?.new_sku]);

  const handleTypeSelect = (type) => {
    setNpiType(type);
    setRenovationReady(false);
    setSubmitAttempted(false);
    setSelectedLfl('');
    setPredecessorStats(null);
    setSaved(false);
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

      {/* ── New Product Innovation — coming soon ── */}
      {npiType === 'new_product' && (
        <div style={{
          background: 'var(--card)', borderRadius: 16, padding: 36,
          border: '0.5px solid var(--border)', maxWidth: 560, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✨</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 10 }}>
            New Product Innovation
          </div>
          <div style={{
            display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.6px',
            padding: '4px 14px', borderRadius: 20,
            background: '#DBEAFE', color: '#1D4ED8', marginBottom: 20,
          }}>
            COMING SOON
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 16, margin: '0 0 16px' }}>
            This path will generate demand scenarios for a brand-new product using
            look-alike modelling from similar existing SKUs — equivalent to how Supply
            Planning uses rules-based methods rather than guessing, with all assumptions
            stated visibly.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, margin: 0 }}>
            For a product replacing an existing SKU, use{' '}
            <strong style={{ color: '#D97706' }}>Product Renovation</strong> — that path
            is fully operational and uses your LFL predecessor demand history.
          </p>
        </div>
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

          {lflMappings.length === 0 ? (
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
                {lflMappings.map((l, i) => (
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
