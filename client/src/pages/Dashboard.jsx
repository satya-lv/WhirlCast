import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KPICard } from '../components/shared/KPICard';
import IndiaMap from '../components/shared/IndiaMap';
import { PageHeader } from '../components/shared/PageHeader';
import { toIndianNumber } from '../utils/helpers';
import { useIsMobile } from '../utils/useIsMobile';
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const DEFAULT_STEPS = [
  { label: 'Forecast Generated', sub: '14 May',           status: 'done' },
  { label: 'Forecast Compared',  sub: '14 May',           status: 'done' },
  { label: 'Forecast Finalized', sub: 'Baseline SARIMAX', status: 'done' },
  { label: 'Branch Overrides',   sub: '3 of 8 submitted', status: 'current' },
  { label: 'Sign-off',           sub: 'Locked',           status: 'pending' },
];

const SPARK_UNITS = [88000,92000,89000,95000,98000,102000,99000,105000,108000,112000,118000,124850];
const SPARK_ACC   = [91,89,92,88,86,87,88,85,87,86,88,87];

const STATIC_ACTIVITY = [
  { icon: '✅', text: 'Scenario 1 finalized by Priya Sharma',       time: '5h ago' },
  { icon: '🟡', text: '6 exceptions detected — 4 acknowledged',     time: '1d ago' },
  { icon: '✦',  text: 'Demand Sensing applied: Q2_Promo_Brief.pdf', time: '1d ago' },
  { icon: '✅', text: 'Forecast generated for Jun 2026 cycle',       time: '1d ago' },
];


const HIST_MONTHS = ["Jun'25","Jul'25","Aug'25","Sep'25","Oct'25","Nov'25","Dec'25","Jan'26","Feb'26","Mar'26","Apr'26","May'26"];
const FWD_MONTHS  = ["Jun'26","Jul'26","Aug'26","Sep'26","Oct'26","Nov'26"];
const TREND_ACTUALS = {
  All: [82400,79200,85600,91200,88300,103400,96700,84200,78900,87400,94600,102300],
  'Refrigerator': [18200,17500,19100,20400,19600,22800,21300,18600,17400,19300,20900,22600],
  'Washing Machine': [22100,21300,22900,24500,23700,27700,25900,22600,21200,23400,25300,27400],
  'Air Conditioner': [31400,30200,32700,34900,33800,39500,36900,32200,30200,33400,36200,39100],
  'Microwave': [6800,6500,7100,7600,7300,8700,8100,7000,6600,7300,7900,8500],
  'Induction':  [3900,3700,3800,4000,3900,4700,4500,3800,3600,3900,4300,4700],
};

const TREND_FORECAST = {
  All: [108500,115200,122800,118400,109600,101200],
  'Refrigerator': [23900,25400,27100,26100,24200,22300],
  'Washing Machine': [29100,30900,32900,31700,29400,27100],
  'Air Conditioner': [41400,44100,47000,45300,42000,38800],
  'Microwave': [9100,9700,10300,9900,9200,8500],
  'Induction':  [5000,5100,5500,5400,5000,4600],
};

const TREND_CATEGORIES = ['All','Refrigerator','Washing Machine','Air Conditioner','Microwave','Induction'];

export default function Dashboard() {
  useEffect(() => { document.title = 'WhirlCast — Dashboard'; }, []);
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [cycleSteps, setCycleSteps] = useState(DEFAULT_STEPS);
  const [kpis, setKpis] = useState(null);
  const [liveBranches, setLiveBranches] = useState([]);
  const [liveSummary, setLiveSummary] = useState(null);
  const [trendCategory, setTrendCategory] = useState('All');
  const [trendTimeRange, setTrendTimeRange] = useState('12M');

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => {
        if (d.cycleSteps) {
          setCycleSteps(d.cycleSteps.map(s => ({
            label: s.label,
            sub: s.note || s.date || '',
            status: s.status === 'active' ? 'current' : s.status,
          })));
        }
        if (d.kpis) setKpis(d.kpis);
        if (d.branches) {
          setLiveBranches(d.branches.map(b => ({ name: b.name, status: b.status })));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchLive = () => {
      fetch('/api/forecast/live-summary')
        .then(r => r.json())
        .then(d => {
          setLiveSummary(d);
          if (d.branch_statuses) {
            setLiveBranches(Object.entries(d.branch_statuses).map(([name, status]) => ({ name, status })));
          }
          const activeIdx =
            d.cycle_status === 'signed_off' ? 5 :
            d.cycle_status === 'resolved' || d.cycle_status === 'closed' ? 4 :
            d.cycle_status === 'overrides_pending' ? 3 : 3;
          setCycleSteps(DEFAULT_STEPS.map((s, i) => ({
            ...s,
            status: i < activeIdx ? 'done' : i === activeIdx ? 'current' : 'pending',
            sub: i === 3 ? `${d.branches_submitted} of 8 submitted` : s.sub,
          })));
        })
        .catch(err => console.error('live-summary fetch failed:', err));
    };
    fetchLive();
    const id = setInterval(fetchLive, 5000);
    return () => clearInterval(id);
  }, []);

  const handleBranchClick = (branch) => {
    navigate(`/collaboration?branch=${encodeURIComponent(branch)}`);
  };

  const trendChartData = (() => {
    const actuals = (TREND_ACTUALS[trendCategory] || TREND_ACTUALS['All']);
    const forecast = (TREND_FORECAST[trendCategory] || TREND_FORECAST['All']);
    const n = trendTimeRange === '6M' ? 6 : trendTimeRange === '9M' ? 9 : 12;
    const startHist = HIST_MONTHS.length - n;
    return [
      ...HIST_MONTHS.slice(startHist).map((m, i) => ({
        month: m, Actual: actuals[startHist + i], type: 'hist',
      })),
      ...FWD_MONTHS.map((m, i) => ({
        month: m, 'AI Forecast': forecast[i], type: 'fwd',
      })),
    ];
  })();

  return (
    <div style={{ background: 'var(--bg)', minHeight: 'calc(100vh - 52px)', padding: isMobile ? '16px' : '24px', paddingBottom: isMobile ? 80 : undefined }}>

      <PageHeader title="Dashboard"
        subtitle="Jun 2026 Demand Planning Cycle — Whirlpool India"
        helpText="This dashboard shows the live status of the Jun 2026 forecast cycle. Monitor branch override submissions, review KPIs, and navigate to any stage of the planning workflow."/>

      {/* Greeting banner */}
      <div className="fade-up" style={{
        background: 'var(--navy)', borderRadius: 16, padding: isMobile ? '16px' : '20px 24px',
        marginBottom: 16, display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: 12,
      }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 }}>
            Good morning, {user?.name?.split(' ')[0]} 👋
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            Jun 2026 Forecast Cycle ·{' '}
            {(() => {
              const submitted = liveSummary?.branches_submitted ?? (kpis != null ? (8 - kpis.pendingBranches) : null);
              if (submitted === null) return '…loading';
              const pending = 8 - submitted;
              if (pending === 0) return 'All branches have submitted overrides';
              return `${pending} ${pending === 1 ? "branch hasn't" : "branches haven't"} submitted overrides yet`;
            })()}
            {' '}· Deadline in 5 days
          </p>
        </div>
      </div>

      {/* Cycle Stepper */}
      <div className="fade-up-1" style={{
        background: 'var(--card)', borderRadius: 16, padding: '18px 24px',
        marginBottom: 20, boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase',
          color: 'var(--text-2)', marginBottom: 16 }}>Jun 2026 Cycle Progress</div>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {cycleSteps.map((step, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {i < cycleSteps.length - 1 && (
                <div style={{
                  position: 'absolute', top: 14, left: '50%', width: '100%', height: 2,
                  background: step.status === 'done' ? '#16A34A' : '#E5E7EB', zIndex: 0,
                }}/>
              )}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', zIndex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: step.status === 'done'    ? '#16A34A' :
                            step.status === 'current' ? 'var(--navy-accent)' : '#F0F4F8',
                color: step.status === 'pending' ? '#9CA3AF' : 'white',
                border: step.status === 'pending' ? '1.5px solid #D1D5DB' : 'none',
              }}>
                {step.status === 'done' ? '✓' : i + 1}
              </div>
              <div style={{ textAlign: 'center', marginTop: 6 }}>
                <div style={{ fontSize: 11, fontWeight: step.status === 'current' ? 700 : 500,
                  color: step.status === 'pending' ? 'var(--text-3)' : 'var(--text-1)' }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 10, color: step.status === 'current' ? '#D97706' : 'var(--text-3)', marginTop: 2 }}>
                  {step.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <KPICard label="Forecasted Units"      subtitle="Branch × SKU level · 6-month horizon" value={liveSummary ? toIndianNumber(liveSummary.total_units) : kpis ? toIndianNumber(kpis.totalUnits) : '1,24,850'} badge="↑ 8.2% vs last cycle" badgeType="up" spark={SPARK_UNITS} accentColor="var(--navy-accent)" icon="📦"/>
        <KPICard label="Avg Forecast Accuracy" subtitle="Based on last 3 cycles · MAPE method" value={liveSummary ? `${liveSummary.avg_accuracy}%` : kpis ? `${kpis.accuracy}%` : '87.3%'} badge="↓ 1.2% · Target 90%" badgeType="down" spark={SPARK_ACC} accentColor="#D97706" icon="🎯"/>
        <KPICard label="Pending Overrides"     value={liveSummary ? `${liveSummary.branches_total - liveSummary.branches_submitted} branches` : kpis ? `${kpis.pendingBranches} branches` : '5 branches'} badge={liveSummary ? `${liveSummary.branches_submitted} of 8 submitted` : 'Due 20-Jun-2026'} badgeType="warn" accentColor="#F59E0B" icon="⏳"/>
        <KPICard label="Unresolved Conflicts"  value={liveSummary ? `${liveSummary.conflicts_count}` : '1'}    badge={liveSummary ? (liveSummary.conflicts_count === 0 ? 'All clear' : `${liveSummary.conflicts_count} flagged`) : 'Loading...'} badgeType={liveSummary?.conflicts_count === 0 ? 'up' : 'warn'} accentColor="#EF4444" icon="⚠️"/>
      </div>

      {/* Map + Activity */}
      <div className="fade-up-3" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: 16 }}>

        {/* India Map Card */}
        <div style={{ background: 'var(--navy)', borderRadius: 16, padding: '20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 4 }}>Branch Status Map</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>
            Click a branch to view or submit overrides
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1.2 }}>
              <IndiaMap onBranchClick={handleBranchClick} branchData={liveBranches.length > 0 ? liveBranches : undefined}/>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>Branches</div>
              {(liveBranches.length > 0 ? liveBranches : [
                {name:'Bangalore',status:'clean'},{name:'Pune',status:'clean'},
                {name:'Mumbai',status:'conflict'},{name:'Hyderabad',status:'exceeded'},
                {name:'New Delhi',status:'pending'},{name:'Kolkata',status:'pending'},
                {name:'Chennai',status:'pending'},{name:'Ahmedabad',status:'pending'},
              ]).map(({ name, status }) => {
                const sc = { submitted:'#F59E0B', exceeded:'#EF4444', pending:'#6B7280', clean:'#22C55E', submitted_clean:'#22C55E', conflict:'#F59E0B', submitted_conflict:'#F59E0B', submitted_exceeded:'#EF4444' };
                const sl = { submitted:'Submitted', exceeded:'Exceeded', pending:'Pending', clean:'Submitted', submitted_clean:'Submitted', conflict:'Conflict', submitted_conflict:'Conflict', submitted_exceeded:'Exceeded' };
                const color = sc[status] || '#6B7280';
                const label = sl[status] || 'Pending';
                return (
                  <div key={name} onClick={() => handleBranchClick(name)}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'6px 0', borderBottom:'0.5px solid rgba(255,255,255,0.05)', cursor:'pointer' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'rgba(255,255,255,0.7)' }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:color }}/>
                      {name}
                    </div>
                    <span style={{
                      fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:600,
                      background: label==='Submitted' ? 'rgba(34,197,94,0.15)' :
                                  label==='Conflict'  ? 'rgba(245,158,11,0.15)' :
                                  label==='Exceeded'  ? 'rgba(239,68,68,0.15)' : 'rgba(107,114,128,0.15)',
                      color,
                    }}>{label}</span>
                  </div>
                );
              })}
              {liveSummary && (() => {
                const submitted = liveSummary.branches_submitted;
                const pending   = liveSummary.branches_total - liveSummary.branches_submitted;
                const conflicts = liveSummary.conflicts_count;
                return (
                  <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
                    {submitted > 0 && <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.55)' }}>{submitted} submitted</span>}
                    {pending > 0   && <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.55)' }}>{pending} pending</span>}
                    {conflicts > 0 && <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.55)' }}>{conflicts} conflicts</span>}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Activity Feed + Quick Actions */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background:'var(--card)', borderRadius:16, padding:'18px 20px',
            boxShadow:'var(--shadow-sm)', flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--text-1)' }}>Cycle Activity</span>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#22C55E',
                boxShadow:'0 0 6px #22C55E' }}/>
            </div>
            {(() => {
              const liveItems = liveSummary?.branch_statuses
                ? Object.entries(liveSummary.branch_statuses)
                    .filter(([, s]) => s !== 'pending')
                    .map(([branch, status]) => ({
                      icon: status === 'conflict' ? '🔴' : '✅',
                      text: status === 'conflict'
                        ? `${branch} submitted overrides — conflict flagged`
                        : `${branch} submitted overrides — clean`,
                      time: 'today',
                    }))
                : [];
              const allItems = [...liveItems, ...STATIC_ACTIVITY].slice(0, 6);
              return allItems.map((a, i) => (
                <div key={i} style={{ display:'flex', gap:10, padding:'8px 0',
                  borderBottom: i < allItems.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize:14, flexShrink:0 }}>{a.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, color:'var(--text-1)', lineHeight:1.4 }}>{a.text}</div>
                    <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>{a.time}</div>
                  </div>
                </div>
              ));
            })()}
          </div>
          <div style={{ background:'var(--card)', borderRadius:16, padding:'18px 20px',
            boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)', marginBottom:12 }}>Quick Actions</div>
            {[
              { label:'⚡ Generate Forecast',        path:'/workbench',      color:'var(--navy-accent)', outline:false },
              { label:'↗ View Forecasting Report',  path:'/report',         color:'transparent',        outline:true  },
              { label:'✦ Run Demand Sensing',        path:'/demand-sensing', color:'#7C3AED',            outline:false },
            ].map(btn => (
              <button key={btn.label} onClick={() => navigate(btn.path)}
                style={{
                  display:'block', width:'100%', marginBottom:8,
                  background: btn.outline ? 'transparent' : btn.color,
                  color: btn.outline ? 'var(--text-1)' : 'white',
                  border: btn.outline ? '0.5px solid var(--border)' : 'none',
                  borderRadius:10, padding:'10px 16px', fontSize:13, fontWeight:600,
                  cursor:'pointer', textAlign:'left', transition:'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                {btn.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Forecast vs Actual Trend */}
      <div className="fade-up-4" style={{ background:'var(--card)', borderRadius:16, padding:'20px', marginTop:16, boxShadow:'var(--shadow-sm)', border:'0.5px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
          <div>
            <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:'var(--text-1)' }}>Forecast vs Actual Trend</h3>
            <p style={{ margin:'3px 0 0', fontSize:11, color:'var(--text-3)' }}>Historical actuals through May 2026 · AI forecast Jun–Nov 2026</p>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <span style={{ fontSize:9, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Category</span>
              <select value={trendCategory} onChange={e => setTrendCategory(e.target.value)}
                style={{ padding:'5px 8px', border:'0.5px solid var(--border)', borderRadius:7, fontSize:11, color:'var(--text-1)', background:'var(--card)', fontFamily:'DM Sans,Inter,sans-serif', outline:'none' }}>
                {TREND_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <span style={{ fontSize:9, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>History</span>
              <select value={trendTimeRange} onChange={e => setTrendTimeRange(e.target.value)}
                style={{ padding:'5px 8px', border:'0.5px solid var(--border)', borderRadius:7, fontSize:11, color:'var(--text-1)', background:'var(--card)', fontFamily:'DM Sans,Inter,sans-serif', outline:'none' }}>
                <option value="6M">Last 6M</option>
                <option value="9M">Last 9M</option>
                <option value="12M">Full Year</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:16, marginBottom:10 }}>
          <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-2)' }}>
            <span style={{ width:24, height:2, background:'#1B3A6B', display:'inline-block', borderRadius:2 }}/> Actual
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-2)' }}>
            <span style={{ width:24, height:2, background:'#E31837', display:'inline-block', borderRadius:2, borderTop:'2px dashed #E31837' }}/> AI Forecast
          </span>
          <span style={{ background:'rgba(227,24,55,0.08)', color:'#E31837', borderRadius:8, padding:'2px 8px', fontSize:10, fontWeight:600 }}>
            ↑ {trendCategory === 'All' ? '6.1' : trendCategory === 'Air Conditioner' ? '6.5' : '5.8'}% vs LY
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={trendChartData} margin={{ top:5, right:16, left:0, bottom:5 }}>
            <defs>
              <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1B3A6B" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#1B3A6B" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="fcstGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E31837" stopOpacity={0.12}/>
                <stop offset="95%" stopColor="#E31837" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
            <XAxis dataKey="month" tick={{ fontSize:10, fill:'var(--text-3)' }}/>
            <YAxis tick={{ fontSize:10, fill:'var(--text-3)' }} tickFormatter={v => (v/1000).toFixed(0)+'k'}/>
            <Tooltip
              contentStyle={{ background:'var(--card)', borderRadius:8, border:'0.5px solid var(--border)', fontSize:12 }}
              formatter={(v, name) => [v?.toLocaleString('en-IN'), name]}
            />
            <Legend iconType="line" wrapperStyle={{ fontSize:11 }}/>
            <ReferenceLine x="Jun'26" stroke="#9CA3AF" strokeDasharray="4 2" label={{ value:'Forecast →', position:'top', fontSize:9, fill:'#9CA3AF' }}/>
            <Area type="monotone" dataKey="Actual" stroke="#1B3A6B" strokeWidth={2} fill="url(#actGrad)" dot={false} connectNulls/>
            <Area type="monotone" dataKey="AI Forecast" stroke="#E31837" strokeWidth={2} strokeDasharray="5 3" fill="url(#fcstGrad)" dot={false} connectNulls/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Live data indicator */}
      <div style={{
        position: 'fixed', bottom: isMobile ? 76 : 20, right: 20, zIndex: 50,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--card)', borderRadius: 20, padding: '5px 11px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)', border: '0.5px solid var(--border)',
        fontSize: 11, color: 'var(--text-2)',
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E',
          boxShadow: '0 0 0 3px rgba(34,197,94,0.25)' }}/>
        Live data
      </div>
    </div>
  );
}
