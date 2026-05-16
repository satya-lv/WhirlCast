import React, { useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

const GEO = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const DEFAULT_CITIES = [
  { name:'Mumbai',    coords:[72.88,19.07], status:'conflict' },
  { name:'New Delhi', coords:[77.21,28.61], status:'pending'  },
  { name:'Kolkata',   coords:[88.36,22.57], status:'pending'  },
  { name:'Chennai',   coords:[80.27,13.08], status:'pending'  },
  { name:'Bangalore', coords:[77.59,12.97], status:'clean'    },
  { name:'Hyderabad', coords:[78.49,17.39], status:'exceeded' },
  { name:'Pune',      coords:[73.86,18.52], status:'clean'    },
  { name:'Ahmedabad', coords:[72.57,23.02], status:'pending'  },
];

const COLORS = {
  clean:              '#22C55E',
  submitted_clean:    '#22C55E',
  conflict:           '#F59E0B',
  submitted_conflict: '#F59E0B',
  exceeded:           '#EF4444',
  submitted_exceeded: '#EF4444',
  warning:            '#F97316',
  pending:            '#4B5563',
  active:             '#3B82F6',
};

const LABELS = {
  clean:              'Submitted',
  submitted_clean:    'Submitted',
  conflict:           'Conflict',
  submitted_conflict: 'Conflict',
  exceeded:           'Exceeded',
  submitted_exceeded: 'Exceeded',
  warning:            'Watch',
  pending:            'Pending',
  active:             'Viewing',
};

const METRICS = {
  Mumbai:     { units:'12,450', acc:'88%', note:'Conflict flagged' },
  'New Delhi':{ units:'14,200', acc:'85%', note:'Not submitted' },
  Kolkata:    { units:'9,800',  acc:'81%', note:'2 conflicts pending' },
  Chennai:    { units:'11,200', acc:'79%', note:'Deviation +46.1%' },
  Bangalore:  { units:'10,600', acc:'89%', note:'Submitted ✓' },
  Hyderabad:  { units:'8,900',  acc:'83%', note:'Deviation +10.5%' },
  Pune:       { units:'7,400',  acc:'88%', note:'Submitted ✓' },
  Ahmedabad:  { units:'6,800',  acc:'86%', note:'Not submitted' },
};

export default function IndiaMap({ onBranchClick, branchData, activeBranch, statusMap, showAsFilter }) {
  const [hov, setHov] = useState(null);

  const cities = DEFAULT_CITIES.map(c => {
    let status = c.status;
    if (statusMap && statusMap[c.name]) status = statusMap[c.name];
    if (branchData) {
      const live = branchData.find(b => b.name === c.name);
      if (live) status = live.status;
    }
    return { ...c, status };
  });

  return (
    <div style={{ position:'relative', width:'100%' }}>
      <style>{`
        @keyframes mPulse { 0%{r:10;opacity:.6} 100%{r:22;opacity:0} }
        .mp { animation: mPulse 1.8s ease-out infinite; }
      `}</style>
      {showAsFilter && (
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', textAlign:'center', marginBottom:6 }}>
          {activeBranch ? `Filtering: ${activeBranch}` : 'Click a branch to filter'}
        </div>
      )}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center:[82,22], scale:900 }}
        viewBox="0 0 400 460"
        style={{ width:'100%', height:'auto' }}
      >
        <Geographies geography={GEO}>
          {({ geographies }) =>
            geographies
              .filter(g => g.properties.name === 'India')
              .map(geo => (
                <Geography key={geo.rsmKey} geography={geo}
                  fill="#1A2B4A" stroke="#3D6B9E" strokeWidth={1.2}
                  style={{
                    default:{ outline:'none' },
                    hover:  { outline:'none', fill:'#1F3461' },
                    pressed:{ outline:'none' },
                  }}
                />
              ))
          }
        </Geographies>

        {cities.map(city => {
          const col = COLORS[city.status] || COLORS.pending;
          const isHov = hov === city.name;
          const isActive = activeBranch === city.name;
          const pulse = city.status === 'conflict' || city.status === 'submitted_conflict'
                     || city.status === 'exceeded' || city.status === 'submitted_exceeded';
          const m = METRICS[city.name] || {};
          const dim = activeBranch && !isActive ? 0.35 : 1;

          return (
            <Marker key={city.name} coordinates={city.coords}
              onClick={() => onBranchClick && onBranchClick(city.name)}
              onMouseEnter={() => setHov(city.name)}
              onMouseLeave={() => setHov(null)}
              style={{ cursor:'pointer', opacity: dim, transition:'opacity 0.2s' }}
            >
              {pulse && <circle r="10" fill="none" stroke={col} strokeWidth="1.5" opacity="0" className="mp"/>}
              {isActive && <circle r="13" fill="none" stroke="white" strokeWidth="2"/>}
              <circle r="11" fill={col} opacity="0.18"/>
              <circle r={isHov ? 7 : 5.5} fill={col} stroke="white" strokeWidth="1.5"
                style={{ transition:'r 0.15s' }}/>
              <text textAnchor="middle" y={20}
                style={{
                  fontSize:8,
                  fill: isActive ? 'white' : 'rgba(255,255,255,0.75)',
                  fontWeight: isActive ? 700 : 500,
                  fontFamily:'DM Sans,sans-serif',
                  pointerEvents:'none',
                }}>
                {city.name}
              </text>
              {isHov && (
                <g transform="translate(10,-88)">
                  <rect width="128" height="90" rx="8" fill="white"
                    style={{ filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}/>
                  <text x="10" y="20" style={{ fontSize:10, fontWeight:700, fill:'#1A1A2E', fontFamily:'DM Sans,sans-serif' }}>{city.name}</text>
                  <text x="10" y="36" style={{ fontSize:9, fill:'#6B7280', fontFamily:'DM Sans,sans-serif' }}>Units: {m.units || '—'}</text>
                  <text x="10" y="50" style={{ fontSize:9, fill:'#6B7280', fontFamily:'DM Sans,sans-serif' }}>Accuracy: {m.acc || '—'}</text>
                  <text x="10" y="64" style={{ fontSize:9, fill:col, fontWeight:600, fontFamily:'DM Sans,sans-serif' }}>{m.note || LABELS[city.status] || 'Pending'}</text>
                  <text x="10" y="78" style={{ fontSize:8.5, fill:'#3B82F6', fontFamily:'DM Sans,sans-serif' }}>
                    {showAsFilter ? 'Click to filter →' : 'Click to view branch →'}
                  </text>
                </g>
              )}
            </Marker>
          );
        })}
      </ComposableMap>
    </div>
  );
}
