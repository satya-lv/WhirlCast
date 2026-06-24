/**
 * DemandGrid — virtualized 52-week demand planning grid.
 *
 * Architecture mirrors supply/PlanningGrid (same react-window FixedSizeList +
 * FixedSizeGrid scroll-sync approach, same layout constants) but uses a
 * 2-level hierarchy: SKU → Location → 4 measure rows.
 * Supply Planning files are NOT imported or modified.
 *
 * Hierarchy:
 *   SKU (collapsed by default)
 *   └── Location (expands when SKU is open)
 *       ├── Actual Sales        (read-only)
 *       ├── System Forecast     (read-only)
 *       ├── Marketing Adj       (editable per persona)
 *       ├── Branch Adj          (editable per persona)
 *       ├── Category Adj        (editable per persona)
 *       └── Final Consensus     (read-only; = System + Mktg + Branch + Cat)
 */
import React, {
  useState, useMemo, useRef, useCallback, memo, forwardRef,
} from 'react';
import { FixedSizeList, FixedSizeGrid } from 'react-window';
import { ChevronRight, ChevronDown } from 'lucide-react';

// ── Constants (identical to PlanningGrid) ─────────────────────────────────────

const LEFT_W = 288;
const COL_W  = 72;
const ROW_H  = 32;
const HDR_H  = 34;
const TOOLBAR_H = 33;

// ── Measure definitions ───────────────────────────────────────────────────────

const DEMAND_MEASURES = [
  { key: 'actualSales',          label: 'Actual Sales',    fmt: 'int' },
  { key: 'systemForecast',       label: 'System Forecast', fmt: 'int' },
  { key: 'marketingAdjustment',  label: 'Marketing Adj',   fmt: 'int', editable: true },
  { key: 'branchAdjustment',     label: 'Branch Adj',      fmt: 'int', editable: true },
  { key: 'categoryAdjustment',   label: 'Category Adj',    fmt: 'int', editable: true },
  { key: 'finalConsensus',       label: 'Final Consensus', fmt: 'int' },
];

const PRIMARY_MEASURE = 'finalConsensus';

// ── Tree construction ─────────────────────────────────────────────────────────

function buildTree(apiRows) {
  const skuOrder = [];
  const locOrder = new Map();  // sku → [locationId]
  const locMeta  = new Map();  // locKey → { name, region, abcClass, xyzClass }
  const leafData = new Map();  // locKey → { [week]: { actualSales, systemForecast, marketingAdjustment, branchAdjustment, categoryAdjustment, finalConsensus } }
  const skuAgg   = new Map();  // sku → { [week]: { mk: summed value } }

  for (const row of apiRows) {
    const { sku, locationId, locationName, region, abcClass, xyzClass, cells = {} } = row;
    const locKey = `${sku}|${locationId}`;

    if (!skuOrder.includes(sku))                skuOrder.push(sku);
    if (!locOrder.has(sku))                     locOrder.set(sku, []);
    if (!locOrder.get(sku).includes(locationId)) locOrder.get(sku).push(locationId);

    locMeta.set(locKey, { name: locationName, region, abcClass, xyzClass });

    const wmap = {};
    for (const [wkStr, cell] of Object.entries(cells)) {
      const w = parseInt(wkStr, 10);
      wmap[w] = {
        actualSales:         cell.actualSales         ?? 0,
        systemForecast:      cell.systemForecast      ?? 0,
        marketingAdjustment: cell.marketingAdjustment ?? 0,
        branchAdjustment:    cell.branchAdjustment    ?? 0,
        categoryAdjustment:  cell.categoryAdjustment  ?? 0,
        finalConsensus:      cell.finalConsensus      ?? 0,
      };
    }
    leafData.set(locKey, wmap);
  }

  // Aggregate all demand measures up to SKU level (sum across locations)
  for (const sku of skuOrder) {
    const agg = {};
    for (const locId of (locOrder.get(sku) || [])) {
      const locKey = `${sku}|${locId}`;
      for (const [wStr, vals] of Object.entries(leafData.get(locKey) || {})) {
        const w = parseInt(wStr, 10);
        if (!agg[w]) agg[w] = { actualSales: 0, systemForecast: 0, marketingAdjustment: 0, branchAdjustment: 0, categoryAdjustment: 0, finalConsensus: 0 };
        agg[w].actualSales          += vals.actualSales;
        agg[w].systemForecast       += vals.systemForecast;
        agg[w].marketingAdjustment  += vals.marketingAdjustment;
        agg[w].branchAdjustment     += vals.branchAdjustment;
        agg[w].categoryAdjustment   += vals.categoryAdjustment;
        agg[w].finalConsensus       += vals.finalConsensus;
      }
    }
    skuAgg.set(sku, agg);
  }

  return { skuOrder, locOrder, locMeta, leafData, skuAgg };
}

// ── Flat row list ─────────────────────────────────────────────────────────────

function buildFlatRows(tree, expandedSkus, expandedLocs) {
  const { skuOrder, locOrder, locMeta } = tree;
  const result = [];

  for (const sku of skuOrder) {
    result.push({ type: 'sku', key: sku, sku });
    if (!expandedSkus.has(sku)) continue;

    for (const locId of (locOrder.get(sku) || [])) {
      const locKey = `${sku}|${locId}`;
      const meta   = locMeta.get(locKey) || {};
      result.push({
        type: 'location', key: locKey, locKey,
        sku, locationId: locId, name: meta.name,
        region: meta.region, abcClass: meta.abcClass, xyzClass: meta.xyzClass,
      });
      if (!expandedLocs.has(locKey)) continue;

      for (const m of DEMAND_MEASURES) {
        result.push({
          type: 'measure', key: `${locKey}|${m.key}`,
          locKey, sku, locationId: locId,
          measureKey: m.key, measureLabel: m.label,
          measureFmt: m.fmt, editable: !!m.editable,
        });
      }
    }
  }

  return result;
}

// ── Week label helper ─────────────────────────────────────────────────────────

function toRelWeekShort(w) {
  if (w < 24)   return `W${w}`;
  if (w === 24) return 'Now';
  return `+${w - 24}w`;
}

// ── Value helpers ─────────────────────────────────────────────────────────────

function formatVal(v, fmt) {
  if (v == null || v === '') return '—';
  if (typeof v !== 'number') return String(v);
  if (fmt === 'int')  return Math.round(v).toLocaleString('en-IN');
  if (fmt === 'dec1') return v.toFixed(1);
  return String(v);
}

function skuDisplayLabel(sku) { return sku.replace(/_/g, ' '); }

// ── Row styling (same colors as PlanningGrid) ─────────────────────────────────

const ROW_STYLES = {
  sku:      { bg: 'var(--navy-accent)', fg: 'white',                  fw: 700, fs: 11 },
  location: { bg: '#1e3a5f',            fg: 'rgba(255,255,255,0.88)', fw: 600, fs: 11 },
  measure:  { bg: 'white',              fg: 'var(--text-1)',           fw: 400, fs: 11 },
};

const INDENTS = { sku: 10, location: 22, measure: 32 };

function getCellHighlight(measureKey, value, week, editableFrom) {
  if (measureKey === 'marketingAdjustment' || measureKey === 'branchAdjustment' || measureKey === 'categoryAdjustment') {
    if (week < editableFrom) return '#F8FAFC';
    if (value > 0)  return '#DCFCE7';
    if (value < 0)  return '#FEF9C3';
  }
  return null;
}

function isEditableForPersona(measureKey, personaRole) {
  if (!personaRole || personaRole === 'demand_planner') return true;
  if (personaRole === 'branch_manager')   return measureKey === 'branchAdjustment';
  if (personaRole === 'category_manager') return measureKey === 'categoryAdjustment';
  return true;
}

// ── NoScrollOuter (same pattern as PlanningGrid) ──────────────────────────────

const NoScrollOuter = forwardRef(({ style, ...rest }, ref) => (
  <div ref={ref} style={{ ...style, overflow: 'hidden' }} {...rest} />
));

// ── Left cell ─────────────────────────────────────────────────────────────────

const LeftCell = memo(function LeftCell({ index, style, data }) {
  const { flatRows, expandedSkus, expandedLocs, onToggleSku, onToggleLoc } = data;
  const row    = flatRows[index];
  const s      = ROW_STYLES[row.type] || ROW_STYLES.measure;
  const indent = INDENTS[row.type] ?? 10;

  let label, canExpand, isExpanded, onToggle;
  if (row.type === 'sku') {
    label      = skuDisplayLabel(row.sku);
    canExpand  = true;
    isExpanded = expandedSkus.has(row.sku);
    onToggle   = () => onToggleSku(row.sku);
  } else if (row.type === 'location') {
    label      = row.name || `Loc ${row.locationId}`;
    canExpand  = true;
    isExpanded = expandedLocs.has(row.locKey);
    onToggle   = () => onToggleLoc(row.locKey);
  } else {
    label = row.measureLabel;
  }

  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div
      onClick={canExpand ? onToggle : undefined}
      style={{
        ...style,
        width: LEFT_W,
        background: s.bg,
        color: s.fg,
        fontWeight: s.fw,
        fontSize: s.fs,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: indent,
        boxSizing: 'border-box',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        cursor: canExpand ? 'pointer' : 'default',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {canExpand && (
        <Chevron size={10} strokeWidth={2.5} style={{ flexShrink: 0, marginRight: 5, opacity: 0.8 }} />
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  );
});

// ── Right cell ────────────────────────────────────────────────────────────────

const RightCell = memo(function RightCell({ columnIndex, rowIndex, style, data }) {
  const { flatRows, weeks, tree, editableFrom, onBeginEdit, personaRole } = data;
  const row  = flatRows[rowIndex];
  const week = weeks[columnIndex];

  let value = null;
  if (row.type === 'measure') {
    value = tree.leafData.get(row.locKey)?.[week]?.[row.measureKey] ?? null;
  } else if (row.type === 'location') {
    value = tree.leafData.get(row.locKey)?.[week]?.[PRIMARY_MEASURE] ?? null;
  } else if (row.type === 'sku') {
    value = tree.skuAgg.get(row.sku)?.[week]?.[PRIMARY_MEASURE] ?? null;
  }

  const s         = ROW_STYLES[row.type] || ROW_STYLES.measure;
  const highlight = row.type === 'measure'
    ? getCellHighlight(row.measureKey, value, week, editableFrom)
    : null;
  const isEditable = row.type === 'measure' && row.editable && week >= editableFrom
    && isEditableForPersona(row.measureKey, personaRole);
  const displayStr = row.type === 'measure' && row.measureKey === 'actualSales' && week >= 24
    ? '—'
    : formatVal(value, row.measureFmt || 'int');

  return (
    <div
      onDoubleClick={isEditable ? () => onBeginEdit(row, week, value) : undefined}
      style={{
        ...style,
        background: highlight || s.bg,
        color: s.fg,
        fontWeight: s.fw,
        fontSize: s.fs,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 8,
        boxSizing: 'border-box',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        borderRight:  '1px solid rgba(0,0,0,0.04)',
        cursor: isEditable ? 'cell' : 'default',
      }}
    >
      {displayStr}
    </div>
  );
});

// ── EditOverlay ───────────────────────────────────────────────────────────────

function EditOverlay({ editing, onCommit, onCancel }) {
  const [val, setVal] = React.useState(String(Math.round(editing.currentValue || 0)));
  const inputRef = React.useRef();
  React.useEffect(() => { inputRef.current?.select(); }, []);

  const commit = () => {
    const n = parseFloat(val.replace(/,/g, ''));
    if (!isNaN(n)) onCommit(n);
    else onCancel();
  };

  return (
    <div style={{
      position: 'fixed',
      top:  editing.rect.top,
      left: editing.rect.left,
      width: COL_W, height: ROW_H,
      zIndex: 200,
      boxShadow: '0 2px 12px rgba(0,0,0,0.22)',
      background: 'white',
      border: '2px solid var(--navy-accent)',
      borderRadius: 4,
      display: 'flex', alignItems: 'center',
    }}>
      <input
        ref={inputRef}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter')  { e.preventDefault(); commit(); }
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={commit}
        style={{
          width: '100%', border: 'none', outline: 'none',
          fontSize: 11, fontWeight: 600,
          textAlign: 'right', paddingRight: 6,
          background: 'transparent',
        }}
      />
    </div>
  );
}

// ── Toolbar button style ──────────────────────────────────────────────────────

const btnStyle = {
  padding: '3px 10px', fontSize: 11, borderRadius: 6,
  border: '0.5px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text-2)', cursor: 'pointer',
};

// ── DemandGrid ────────────────────────────────────────────────────────────────

export default function DemandGrid({
  rows = [],
  weeks = [],
  editableFrom = 24,
  onCellEdit,
  loading = false,
  height = 500,
  width = 900,
  showHistory = false,
  onToggleHistory,
  personaRole = null,
}) {
  const [expandedSkus, setExpandedSkus] = useState(new Set());
  const [expandedLocs, setExpandedLocs] = useState(new Set());
  const [editing,      setEditing]      = useState(null);

  const leftListRef  = useRef();
  const rightGridRef = useRef();
  const hdrScrollRef = useRef();

  const tree = useMemo(() => {
    if (!rows.length) return { skuOrder: [], locOrder: new Map(), locMeta: new Map(), leafData: new Map(), skuAgg: new Map() };
    return buildTree(rows);
  }, [rows]);

  const flatRows = useMemo(
    () => buildFlatRows(tree, expandedSkus, expandedLocs),
    [tree, expandedSkus, expandedLocs],
  );

  const toggleSku = useCallback(sku => {
    setExpandedSkus(prev => { const s = new Set(prev); s.has(sku) ? s.delete(sku) : s.add(sku); return s; });
  }, []);

  const toggleLoc = useCallback(locKey => {
    setExpandedLocs(prev => { const s = new Set(prev); s.has(locKey) ? s.delete(locKey) : s.add(locKey); return s; });
  }, []);

  const expandAll = useCallback(() => {
    if (!tree.skuOrder.length) return;
    setExpandedSkus(new Set(tree.skuOrder));
    const locs = new Set();
    for (const sku of tree.skuOrder) {
      for (const locId of (tree.locOrder.get(sku) || [])) locs.add(`${sku}|${locId}`);
    }
    setExpandedLocs(locs);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpandedSkus(new Set());
    setExpandedLocs(new Set());
  }, []);

  const handleRightScroll = useCallback(({ scrollLeft, scrollTop }) => {
    if (leftListRef.current)  leftListRef.current.scrollTo(scrollTop);
    if (hdrScrollRef.current) hdrScrollRef.current.scrollLeft = scrollLeft;
  }, []);

  const handleBeginEdit = useCallback((row, week, currentValue) => {
    if (!rightGridRef.current) return;
    const gridEl = rightGridRef.current._outerRef || rightGridRef.current;
    if (!gridEl || typeof gridEl.getBoundingClientRect !== 'function') return;
    const gridRect  = gridEl.getBoundingClientRect();
    const colIndex  = weeks.indexOf(week);
    const rowIndex  = flatRows.findIndex(r => r.key === row.key);
    const scrollLeft = rightGridRef.current.state?.scrollLeft || 0;
    const scrollTop  = rightGridRef.current.state?.scrollTop  || 0;
    setEditing({
      row, week, currentValue,
      rect: {
        left:   gridRect.left + colIndex * COL_W - scrollLeft,
        top:    gridRect.top  + rowIndex * ROW_H - scrollTop,
        width:  COL_W,
        height: ROW_H,
      },
    });
  }, [weeks, flatRows]);

  const handleEditCommit = useCallback((newValue) => {
    if (!editing || isNaN(newValue)) { setEditing(null); return; }
    onCellEdit?.({ row: editing.row, week: editing.week, newValue });
    setEditing(null);
  }, [editing, onCellEdit]);

  const leftData = useMemo(() => ({
    flatRows, expandedSkus, expandedLocs, onToggleSku: toggleSku, onToggleLoc: toggleLoc,
  }), [flatRows, expandedSkus, expandedLocs, toggleSku, toggleLoc]);

  const rightData = useMemo(() => ({
    flatRows, weeks, tree, editableFrom, onBeginEdit: handleBeginEdit, personaRole,
  }), [flatRows, weeks, tree, editableFrom, handleBeginEdit, personaRole]);

  const totalColsW = weeks.length * COL_W;
  const dataH      = height - HDR_H - TOOLBAR_H;
  const rightW     = Math.max(60, width - LEFT_W - 2);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height, color: 'var(--text-3)', fontSize: 13 }}>
        <span style={{ marginRight: 8, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
        Loading demand data…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height, color: 'var(--text-3)', fontSize: 13 }}>
        No demand data for current filters.
      </div>
    );
  }

  return (
    <>
      {editing && (
        <EditOverlay
          editing={editing}
          onCommit={handleEditCommit}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px',
        background: 'var(--card)', borderBottom: '1px solid var(--border)',
        fontSize: 11, color: 'var(--text-3)', flexShrink: 0,
        height: TOOLBAR_H, boxSizing: 'border-box',
      }}>
        <span>{flatRows.length} rows visible · {weeks.length} weeks · {rows.length} SKU-locations</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {onToggleHistory && (
            <button
              onClick={onToggleHistory}
              style={{
                ...btnStyle,
                background: showHistory ? 'var(--navy-accent)' : 'var(--bg)',
                color: showHistory ? 'white' : 'var(--text-2)',
                border: showHistory ? '0.5px solid var(--navy-accent)' : '0.5px solid var(--border)',
              }}
            >
              {showHistory ? 'Hide History' : 'Show History'}
            </button>
          )}
          <button onClick={expandAll}   style={btnStyle}>Expand All</button>
          <button onClick={collapseAll} style={btnStyle}>Collapse All</button>
        </span>
      </div>

      {/* Grid wrapper */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: height - TOOLBAR_H,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Column header row */}
        <div style={{
          display: 'flex', height: HDR_H, flexShrink: 0,
          borderBottom: '2px solid var(--border)',
          background: '#F8FAFC',
        }}>
          {/* Corner */}
          <div style={{
            width: LEFT_W, flexShrink: 0,
            display: 'flex', alignItems: 'center',
            paddingLeft: 12, paddingRight: 8,
            borderRight: '2px solid var(--border)',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.6px',
            color: 'var(--text-3)', textTransform: 'uppercase',
          }}>
            <span style={{
              display: 'inline-block',
              background: 'var(--navy-accent)',
              color: 'white', fontSize: 9, fontWeight: 700,
              padding: '1px 6px', borderRadius: 4, marginRight: 6,
            }}>
              DEMAND
            </span>
            SKU / Location
          </div>

          {/* Week header strip — synced with data grid via hdrScrollRef */}
          <div
            ref={hdrScrollRef}
            style={{ flex: 1, overflow: 'hidden', display: 'flex', minWidth: 0 }}
          >
            <div style={{ display: 'flex', width: totalColsW, flexShrink: 0 }}>
              {weeks.map(w => (
                <div key={w} style={{
                  width: COL_W, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
                  color: w === 24 ? 'white' : w >= editableFrom ? 'var(--navy-accent)' : 'var(--text-3)',
                  background: w === 24 ? 'var(--navy-accent)' : w >= editableFrom ? '#EFF6FF' : '#F8FAFC',
                  borderRight: '1px solid var(--border)',
                }}>
                  {toRelWeekShort(w)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Grid body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Left frozen labels */}
          <div style={{ width: LEFT_W, flexShrink: 0, borderRight: '2px solid var(--border)' }}>
            <FixedSizeList
              ref={leftListRef}
              outerElementType={NoScrollOuter}
              height={dataH}
              width={LEFT_W}
              itemCount={flatRows.length}
              itemSize={ROW_H}
              itemData={leftData}
            >
              {LeftCell}
            </FixedSizeList>
          </div>

          {/* Right scrollable data grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <FixedSizeGrid
              ref={rightGridRef}
              height={dataH}
              width={rightW}
              columnCount={weeks.length}
              columnWidth={COL_W}
              rowCount={flatRows.length}
              rowHeight={ROW_H}
              itemData={rightData}
              onScroll={handleRightScroll}
            >
              {RightCell}
            </FixedSizeGrid>
          </div>
        </div>
      </div>
    </>
  );
}
