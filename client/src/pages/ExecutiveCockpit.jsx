import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { KPICard } from '../components/shared/KPICard';
import { ArrowRight, CheckCircle } from 'lucide-react';

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtInr(v) {
  if (v == null) return '--';
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${Math.round(v).toLocaleString()}`;
}
function fmtPct(v)   { return v == null ? '--' : `${v.toFixed(1)}%`; }
function fmtCount(v) { return v == null ? '--' : String(v); }

// ── KPI badge helpers ─────────────────────────────────────────────────────────

function bAccuracy(v) {
  if (v == null) return {};
  if (v > 85) return { badge: 'Good',   badgeType: 'up'      };
  if (v >= 75) return { badge: 'Fair',   badgeType: 'neutral' };
  return              { badge: 'Low',    badgeType: 'down'    };
}

function bServiceLevel(v) {
  if (v == null) return {};
  if (v > 90) return { badge: 'On Track', badgeType: 'up'      };
  if (v >= 80) return { badge: 'At Risk',  badgeType: 'neutral' };
  return              { badge: 'Critical', badgeType: 'down'    };
}

function bCapacity(v) {
  if (v == null) return {};
  if (v < 80) return { badge: 'Healthy',    badgeType: 'up'      };
  if (v <= 95) return { badge: 'High',       badgeType: 'neutral' };
  return              { badge: 'Overloaded', badgeType: 'down'    };
}

function bRevAtRisk(v) {
  if (!v || v === 0) return { badge: 'No Risk', badgeType: 'up'      };
  if (v < 5e6)       return { badge: 'Low',     badgeType: 'neutral' };
  return                    { badge: 'At Risk',  badgeType: 'down'    };
}

function bBias(v) {
  if (v == null) return {};
  if (Math.abs(v) < 5) return { badge: 'Neutral',        badgeType: 'up'      };
  if (v > 0)           return { badge: 'Over-forecast',  badgeType: 'neutral' };
  return                      { badge: 'Under-forecast', badgeType: 'down'    };
}

function bExceptions(v) {
  if (v == null) return {};
  if (v === 0) return { badge: 'None',    badgeType: 'up'      };
  if (v <= 5)  return { badge: `${v} open`, badgeType: 'neutral' };
  return              { badge: `${v} open`, badgeType: 'down'    };
}

// ── Severity/priority colours ─────────────────────────────────────────────────

const SEV_COLOR  = { high: '#DC2626', medium: '#D97706', low:  '#16A34A' };
const PRIO_COLOR = { HIGH: '#DC2626', MEDIUM: '#D97706', LOW:  '#16A34A' };

// ── Process tracker step ──────────────────────────────────────────────────────

function ProcessStep({ label, path, color, navigate }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      onClick={() => navigate(path)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        cursor: 'pointer',
        transform: hov ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.15s',
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: '50%', background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 0 6px ${color}22`,
      }}>
        <CheckCircle size={22} color="white" strokeWidth={2.5} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{label}</span>
      <span style={{ fontSize: 10, color: color, display: 'flex', alignItems: 'center', gap: 2 }}>
        Open <ArrowRight size={9} />
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExecutiveCockpit() {
  useEffect(() => { document.title = 'Executive Cockpit — WhirlCast'; }, []);
  const navigate = useNavigate();

  const [demKpis, setDemKpis]           = useState(null);
  const [supKpis, setSupKpis]           = useState(null);
  const [exceptions, setExceptions]     = useState([]);
  const [recommendations, setRecs]      = useState([]);
  const [branchData, setBranchData]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        const [demRes, supRes, excRes, recRes, filRes] = await Promise.all([
          fetch('/api/demand-planning/kpis'),
          fetch('/api/supply/kpis?weekStart=24&weekEnd=52'),
          fetch('/api/demand-planning/exceptions?acknowledged=0'),
          fetch('/api/supply/recommendations?weekStart=24&weekEnd=52'),
          fetch('/api/supply/filters'),
        ]);

        const [dem, sup, exc, rec, fil] = await Promise.all([
          demRes.json(), supRes.json(), excRes.json(), recRes.json(), filRes.json(),
        ]);

        if (cancelled) return;

        setDemKpis(dem.kpis || {});
        setSupKpis(sup.kpis || {});
        setExceptions((exc.exceptions || []).slice(0, 6));
        setRecs((rec.recommendations || []).slice(0, 5));

        const locs = (fil.locations || []);
        const locResults = await Promise.all(
          locs.map(loc =>
            fetch(`/api/demand-planning/kpis?locationId=${loc.location_id}`)
              .then(r => r.json())
              .then(d => ({
                name: loc.name.replace(/\s*\(.*\)/, '').trim(),
                value: Math.round(d.kpis?.totalForecastDemand?.value || 0),
              }))
              .catch(() => ({ name: loc.name, value: 0 }))
          )
        );
        if (!cancelled) setBranchData(locResults.sort((a, b) => b.value - a.value));
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 48, color: 'var(--text-3)', fontSize: 14, textAlign: 'center' }}>
        Loading Executive Cockpit…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 48, color: 'var(--red)', fontSize: 14 }}>
        Failed to load: {error}
      </div>
    );
  }

  const dk = demKpis || {};
  const sk = supKpis || {};

  const biasVal = dk.biasPct?.value;
  const biasFormatted = biasVal != null
    ? `${biasVal > 0 ? '+' : ''}${biasVal.toFixed(1)}%`
    : '--';

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1440, margin: '0 auto' }}>

      {/* ── Page header ───────────────────────────────────────── */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-1)' }}>
          Executive S&OP Cockpit
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
          Consolidated overview · Demand Planning + Supply Planning
        </p>
      </div>

      {/* ── 2-Step process tracker ────────────────────────────── */}
      <div style={{
        background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 14,
        padding: '20px 40px', marginBottom: 22,
        display: 'flex', alignItems: 'center', gap: 0,
      }}>
        <ProcessStep label="Demand Planning" path="/demand-planning" color="#3B82F6" navigate={navigate} />
        <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #3B82F6, #22C55E)', margin: '0 20px 20px' }} />
        <ProcessStep label="Supply Planning" path="/supply" color="#22C55E" navigate={navigate} />
      </div>

      {/* ── KPI tiles 4×2 ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        <KPICard
          label="Forecast Accuracy"
          value={fmtPct(dk.forecastAccuracyPct?.value)}
          subtitle="Demand Planning"
          accentColor="#3B82F6"
          icon="📈"
          {...bAccuracy(dk.forecastAccuracyPct?.value)}
        />
        <KPICard
          label="Bias %"
          value={biasFormatted}
          subtitle="Demand Planning"
          accentColor="#8B5CF6"
          icon="⚖️"
          {...bBias(biasVal)}
        />
        <KPICard
          label="Open Exceptions"
          value={fmtCount(dk.openExceptions?.value)}
          subtitle="Demand Planning"
          accentColor={dk.openExceptions?.value > 5 ? '#EF4444' : dk.openExceptions?.value > 0 ? '#F59E0B' : '#22C55E'}
          icon="⚠️"
          {...bExceptions(dk.openExceptions?.value)}
        />
        <KPICard
          label="Open Adjustments"
          value={fmtCount(dk.openPlannerAdjustments?.value)}
          subtitle="Demand Planning"
          accentColor="#64748B"
          icon="✏️"
        />
        <KPICard
          label="Service Level"
          value={fmtPct(sk.serviceLevel?.value)}
          subtitle="Supply Planning"
          accentColor="#22C55E"
          icon="🎯"
          {...bServiceLevel(sk.serviceLevel?.value)}
        />
        <KPICard
          label="Revenue at Risk"
          value={fmtInr(sk.revenueAtRisk?.value)}
          subtitle="Supply Planning"
          accentColor={sk.revenueAtRisk?.value > 0 ? '#EF4444' : '#22C55E'}
          icon="💰"
          {...bRevAtRisk(sk.revenueAtRisk?.value)}
        />
        <KPICard
          label="Capacity Utilization"
          value={fmtPct(sk.capacityUtilization?.value)}
          subtitle="Supply Planning"
          accentColor="#F59E0B"
          icon="🏭"
          {...bCapacity(sk.capacityUtilization?.value)}
        />
        <KPICard
          label="Revenue Forecast"
          value={fmtInr(dk.revenueForecast?.value)}
          subtitle="Demand Planning"
          accentColor="#0EA5E9"
          icon="📊"
        />
      </div>

      {/* ── Bottom 2-col section ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Left: Exceptions + Branch chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Exception alerts */}
          <div style={{
            background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Exception Alerts</span>
              <span
                role="button"
                tabIndex={0}
                onClick={() => navigate('/demand-planning')}
                onKeyDown={e => e.key === 'Enter' && navigate('/demand-planning')}
                style={{ fontSize: 11, color: '#3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
              >
                View all <ArrowRight size={10} />
              </span>
            </div>

            {exceptions.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>
                No open exceptions
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {exceptions.map(ex => (
                  <div key={ex.exceptionId} style={{
                    display: 'flex', gap: 10, padding: '10px 12px',
                    background: 'var(--bg)', borderRadius: 10,
                    borderLeft: `3px solid ${SEV_COLOR[ex.severity] || '#64748B'}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>
                        {ex.title}
                      </div>
                      <div style={{
                        fontSize: 11, color: 'var(--text-3)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {ex.sku} · {ex.locationName}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
                      padding: '3px 7px', borderRadius: 6, flexShrink: 0, alignSelf: 'flex-start',
                      background: `${SEV_COLOR[ex.severity] || '#64748B'}22`,
                      color: SEV_COLOR[ex.severity] || '#64748B',
                    }}>{ex.severity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Branch demand bar chart */}
          <div style={{
            background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 14 }}>
              Demand by Branch (Forecast Units)
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={branchData} margin={{ top: 4, right: 4, bottom: 30, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: 'var(--text-3)' }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--text-3)' }}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  width={36}
                />
                <Tooltip
                  formatter={v => [v.toLocaleString(), 'Forecast Units']}
                  contentStyle={{
                    fontSize: 12, background: 'var(--card)', border: '0.5px solid var(--border)',
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Recommended actions */}
        <div style={{
          background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Recommended Actions</span>
            <span
              role="button"
              tabIndex={0}
              onClick={() => navigate('/supply')}
              onKeyDown={e => e.key === 'Enter' && navigate('/supply')}
              style={{ fontSize: 11, color: '#22C55E', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              View all <ArrowRight size={10} />
            </span>
          </div>

          {recommendations.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>
              No active recommendations
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recommendations.map(rec => (
                <div key={rec.id} style={{
                  padding: '12px 14px', background: 'var(--bg)', borderRadius: 10,
                  borderLeft: `3px solid ${PRIO_COLOR[rec.priority] || '#64748B'}`,
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', gap: 8, marginBottom: 6,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.4 }}>
                      {rec.issue}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
                      padding: '2px 7px', borderRadius: 6, flexShrink: 0,
                      background: `${PRIO_COLOR[rec.priority] || '#64748B'}22`,
                      color: PRIO_COLOR[rec.priority] || '#64748B',
                    }}>{rec.priority}</span>
                  </div>

                  {(rec.recommendedActions || []).slice(0, 2).map((action, i) => (
                    <div key={i} style={{
                      fontSize: 11, color: 'var(--text-3)',
                      display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4,
                    }}>
                      <span style={{ color: 'var(--text-2)', flexShrink: 0, marginTop: 1 }}>→</span>
                      <span style={{ lineHeight: 1.4 }}>{action}</span>
                    </div>
                  ))}

                  {rec.impact && (
                    <div style={{
                      marginTop: 8, display: 'flex', gap: 8, alignItems: 'center',
                      fontSize: 10, color: 'var(--text-3)',
                    }}>
                      <span>SL: {rec.impact.before.serviceLevelPct?.toFixed(1)}%</span>
                      <span style={{ color: 'var(--text-3)' }}>→</span>
                      <span style={{ color: '#22C55E', fontWeight: 600 }}>
                        {rec.impact.after.serviceLevelPct?.toFixed(1)}%
                      </span>
                      <span style={{
                        marginLeft: 4, fontSize: 9, fontWeight: 700,
                        color: '#22C55E', background: '#22C55E22',
                        padding: '1px 5px', borderRadius: 4,
                      }}>
                        +{(rec.impact.after.serviceLevelPct - rec.impact.before.serviceLevelPct).toFixed(1)}pp
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
