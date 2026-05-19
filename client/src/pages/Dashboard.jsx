import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KPICard } from '../components/shared/KPICard';
import IndiaMap from '../components/shared/IndiaMap';
import { PageHeader } from '../components/shared/PageHeader';
import { toIndianNumber } from '../utils/helpers';
import { useIsMobile } from '../utils/useIsMobile';

const DEFAULT_STEPS = [
  { label: 'Forecast Generated', sub: '14 May',           status: 'done' },
  { label: 'Scenarios Compared', sub: '14 May',           status: 'done' },
  { label: 'Scenario Finalized', sub: 'Baseline SARIMAX', status: 'done' },
  { label: 'Branch Overrides',   sub: '3 of 8 submitted', status: 'current' },
  { label: 'Sign-off',           sub: 'Locked',           status: 'pending' },
];

const SPARK_UNITS = [88000,92000,89000,95000,98000,102000,99000,105000,108000,112000,118000,124850];
const SPARK_ACC   = [91,89,92,88,86,87,88,85,87,86,88,87];
const SPARK_REV   = [118,122,119,126,130,135,132,138,141,144,146,148];

const ACTIVITY = [
  { icon: '🔴', text: 'Holly (Kolkata) submitted overrides — 2 conflicts flagged', time: '2h ago' },
  { icon: '✅', text: 'Scenario 1 finalized by Priya Sharma',                      time: '5h ago' },
  { icon: '🟡', text: '6 exceptions detected — 4 acknowledged',                    time: '1d ago' },
  { icon: '✦',  text: 'Demand Sensing applied: Q2_Promo_Brief.pdf',                time: '1d ago' },
  { icon: '✅', text: 'Forecast generated for May 2026 cycle',                     time: '1d ago' },
];


export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [cycleSteps, setCycleSteps] = useState(DEFAULT_STEPS);
  const [kpis, setKpis] = useState(null);
  const [liveBranches, setLiveBranches] = useState([]);
  const [liveSummary, setLiveSummary] = useState(null);

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
        .catch(() => {});
    };
    fetchLive();
    const id = setInterval(fetchLive, 15000);
    return () => clearInterval(id);
  }, []);

  const handleBranchClick = (branch) => {
    navigate(`/collaboration?branch=${encodeURIComponent(branch)}`);
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: 'calc(100vh - 52px)', padding: isMobile ? '16px' : '24px', paddingBottom: isMobile ? 80 : undefined }}>

      <PageHeader title="Dashboard"
        subtitle="May 2026 Demand Planning Cycle — Whirlpool India"
        helpText="This dashboard shows the live status of the May 2026 forecast cycle. Monitor branch override submissions, review KPIs, and navigate to any stage of the planning workflow."/>

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
            May 2026 Forecast Cycle · 5 branches haven't submitted overrides yet · Deadline in 5 days
          </p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 20px', textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Your next action</div>
          <button onClick={() => navigate('/collaboration')}
            style={{ background: '#E31837', color: 'white', border: 'none', borderRadius: 8,
              padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            → Go to Collaboration Suite
          </button>
        </div>
      </div>

      {/* Cycle Stepper */}
      <div className="fade-up-1" style={{
        background: 'var(--card)', borderRadius: 16, padding: '18px 24px',
        marginBottom: 20, boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase',
          color: 'var(--text-2)', marginBottom: 16 }}>May 2026 Cycle Progress</div>
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
        <KPICard label="Forecasted Units"      value={liveSummary ? toIndianNumber(liveSummary.total_units) : kpis ? toIndianNumber(kpis.totalUnits) : '1,24,850'} badge="↑ 8.2% vs last cycle" badgeType="up" spark={SPARK_UNITS} accentColor="var(--navy-accent)" icon="📦"/>
        <KPICard label="Avg Forecast Accuracy" value={kpis ? `${kpis.accuracy}%` : '87.3%'}                   badge="↓ 1.2% · Target 90%"  badgeType="down" spark={SPARK_ACC}   accentColor="#D97706"            icon="🎯"/>
        <KPICard label="Pending Overrides"     value={liveSummary ? `${8 - liveSummary.branches_submitted} branches` : kpis ? `${kpis.pendingBranches} branches` : '5 branches'} badge={liveSummary ? `${liveSummary.conflicts_pending} conflicts` : 'Due 20-May-2026'} badgeType="warn" accentColor="#F59E0B" icon="⏳"/>
        <KPICard label="Predicted Revenue"     value="₹148.2 Cr"                                               badge="↑ 11.4% vs last cycle" badgeType="up"   spark={SPARK_REV}  accentColor="var(--red)"         icon="₹"/>
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
                const sc = { clean:'#22C55E', submitted_clean:'#22C55E', conflict:'#F59E0B', submitted_conflict:'#F59E0B', exceeded:'#EF4444', submitted_exceeded:'#EF4444', pending:'#6B7280' };
                const sl = { clean:'Submitted', submitted_clean:'Submitted', conflict:'Conflict', submitted_conflict:'Conflict', exceeded:'Exceeded', submitted_exceeded:'Exceeded', pending:'Pending' };
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
              {liveBranches.length > 0 && (() => {
                const submitted = liveBranches.filter(b => b.status !== 'pending').length;
                const conflicts = liveBranches.filter(b => b.status === 'submitted_conflict' || b.status === 'conflict').length;
                const pending   = liveBranches.filter(b => b.status === 'pending').length;
                return (
                  <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
                    {submitted > 0 && <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.55)' }}>{submitted} submitted</span>}
                    {pending > 0   && <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.55)' }}>{pending} pending</span>}
                    {conflicts > 0 && <span style={{ fontSize:10, padding:'3px 9px', borderRadius:20, background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.55)' }}>{conflicts} conflict</span>}
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
            {ACTIVITY.map((a, i) => (
              <div key={i} style={{ display:'flex', gap:10, padding:'8px 0',
                borderBottom: i < ACTIVITY.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                <span style={{ fontSize:14, flexShrink:0 }}>{a.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:'var(--text-1)', lineHeight:1.4 }}>{a.text}</div>
                  <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:'var(--card)', borderRadius:16, padding:'18px 20px',
            boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)', marginBottom:12 }}>Quick Actions</div>
            {[
              { label:'→ Collaboration Suite',      path:'/collaboration',  color:'var(--navy-accent)', outline:false },
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
