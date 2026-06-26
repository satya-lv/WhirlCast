/**
 * PlanningGrid — virtualized time-phased supply planning grid.
 *
 * Virtualization: react-window FixedSizeList (left frozen labels) +
 * FixedSizeGrid (right data columns), scroll-synced. Only visible
 * rows AND columns are in the DOM regardless of dataset size.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ [Corner]  │ W22  W23  W24  ... W52  (scrollable, frozen top)│
 *   ├─────────────────────────────────────────────────────────────┤
 *   │ [Labels]  │ Data cells (FixedSizeGrid)                      │
 *   │ (FixedSize│ col+row virtualized                             │
 *   │  List,    │                                                 │
 *   │  overflow:│                                                 │
 *   │  hidden)  │                                                 │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Hierarchy: SKU → Plant/Line (2 levels). Each plant/line row expands
 * to measure sub-rows. The intermediate Location grouping is removed —
 * location name appears as secondary text on the plant/line row.
 * Measure group selector (Demand / Supply / Constraints) is external.
 */
import React, {
  useState, useMemo, useRef, useCallback, memo, forwardRef, useLayoutEffect,
} from 'react';
import { FixedSizeList, FixedSizeGrid } from 'react-window';
import { ChevronRight, ChevronDown, Zap } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const LEFT_W  = 288;  // frozen label column width (px)
const COL_W   = 72;   // data column width per week (px)
const ROW_H   = 32;   // uniform row height (px) — required for FixedSizeGrid
const HDR_H   = 34;   // column-header strip height (px)

// ── Measure definitions ───────────────────────────────────────────────────────

export const MEASURE_GROUPS = {
  demand: {
    label: 'Demand',
    accentColor: 'var(--navy-accent)',
    bgLight: '#EFF6FF',
    measures: [
      { key: 'forecastDemand',  label: 'Fcst Demand',  fmt: 'int' },
      { key: 'customerOrders',  label: 'Cust Orders',  fmt: 'int' },
      { key: 'priorityDemand',  label: 'Priority Dem', fmt: 'int' },
    ],
  },
  supply: {
    label: 'Supply',
    accentColor: 'var(--green)',
    bgLight: '#F0FDF4',
    measures: [
      { key: 'forecastDemand',     label: 'Demand',     fmt: 'int' },
      { key: 'beginningInventory', label: 'Inventory',  fmt: 'int' },
      { key: 'plannedProduction',  label: 'Production', fmt: 'int', editable: true },
      { key: 'shortageQty',        label: 'Gap',        fmt: 'int' },
      { key: 'daysOfCover',        label: 'DoC (days)', fmt: 'dec1', noAgg: true },
    ],
  },
  constraints: {
    label: 'Constraints',
    accentColor: 'var(--amber)',
    bgLight: '#FFFBEB',
    measures: [
      { key: 'capacityRequired',     label: 'Cap Req (hrs)',  fmt: 'dec1' },
      { key: 'capacityAvailable',    label: 'Cap Avail (u)',  fmt: 'int',  noAgg: true },
      { key: 'shortageQty',          label: 'Shortage Qty',   fmt: 'int'  },
      { key: 'materialAvailability', label: 'Mat Cov (days)', fmt: 'dec1', noAgg: true },
    ],
  },
};

// ── Tree construction ─────────────────────────────────────────────────────────
//
// apiRows: array from /api/supply/grid — each row is one (sku × location)
// with cells nested as { [weekNumber]: { forecastDemand, ... } }
//
// Produces a 2-level tree: sku → leaf rows (one per location, labeled by plant+line).

function buildTree(apiRows, measureDefs) {
  const measureKeys = measureDefs.map(m => m.key);
  const noAggKeys   = new Set(measureDefs.filter(m => m.noAgg).map(m => m.key));

  const skuOrder  = [];
  const leafOrder = new Map();   // sku → [locationId]
  const leafMeta  = new Map();   // leafKey (sku|locId) → { plantName, lineName, locationName, region }
  const leafData  = new Map();   // leafKey → { [week]: { mk: value } }
  const lineApiRow = new Map();  // leafKey → original API row (for POST actions)

  for (const apiRow of apiRows) {
    const {
      sku, locationId, locationName, region,
      plantName, lineName,
      cells = {},
    } = apiRow;

    const leafKey = `${sku}|${locationId}`;

    if (!skuOrder.includes(sku))                    skuOrder.push(sku);
    if (!leafOrder.has(sku))                         leafOrder.set(sku, []);
    if (!leafOrder.get(sku).includes(locationId))    leafOrder.get(sku).push(locationId);

    leafMeta.set(leafKey, { plantName, lineName, locationName, region });
    lineApiRow.set(leafKey, apiRow);

    // Store leaf data keyed by week number
    const wmap = {};
    for (const [wkStr, cell] of Object.entries(cells)) {
      const w = parseInt(wkStr, 10);
      const vals = {};
      for (const mk of measureKeys) vals[mk] = cell[mk] ?? 0;
      if ('daysOfCover' in vals) {
        const fd = cell.forecastDemand ?? 0;
        const ei = cell.endingInventory ?? 0;
        vals.daysOfCover = fd > 0 ? (ei / fd) * 7 : null;
      }
      wmap[w] = vals;
    }
    leafData.set(leafKey, wmap);
  }

  // Aggregate leaf rows up to SKU level
  const skuAgg = new Map();

  const addTo = (mapRef, key, w, vals) => {
    if (!mapRef.has(key)) mapRef.set(key, {});
    if (!mapRef.get(key)[w]) mapRef.get(key)[w] = {};
    const target = mapRef.get(key)[w];
    for (const mk of measureKeys) {
      if (noAggKeys.has(mk)) continue;
      target[mk] = (target[mk] || 0) + (vals[mk] || 0);
    }
  };

  for (const sku of skuOrder) {
    for (const locId of (leafOrder.get(sku) || [])) {
      const leafKey = `${sku}|${locId}`;
      for (const [wStr, vals] of Object.entries(leafData.get(leafKey) || {})) {
        addTo(skuAgg, sku, parseInt(wStr, 10), vals);
      }
    }
  }

  return { skuOrder, leafOrder, leafMeta, leafData, lineApiRow, skuAgg };
}

// ── Flat row list ─────────────────────────────────────────────────────────────
//
// Produces the ordered array of virtual rows based on current expand state.
// Row types: 'sku' | 'plantline' | 'measure'

function buildFlatRows(tree, expandedSkus, expandedLeaves, measureDefs) {
  const { skuOrder, leafOrder, leafMeta } = tree;
  const result = [];

  for (const sku of skuOrder) {
    result.push({ type: 'sku', key: sku, sku });

    if (!expandedSkus.has(sku)) continue;

    for (const locId of (leafOrder.get(sku) || [])) {
      const leafKey = `${sku}|${locId}`;
      const meta    = leafMeta.get(leafKey) || {};
      result.push({
        type: 'plantline', key: leafKey, lineKey: leafKey,
        sku, locId,
        label:    `${meta.plantName || ''} · ${meta.lineName || ''}`,
        subLabel: meta.locationName || '',
      });

      if (!expandedLeaves.has(leafKey)) continue;

      for (const mDef of measureDefs) {
        result.push({
          type: 'measure',
          key: `${leafKey}|${mDef.key}`,
          lineKey: leafKey, sku, locId,
          measureKey: mDef.key,
          measureLabel: mDef.label,
          measureFmt: mDef.fmt,
          editable: !!mDef.editable,
        });
      }
    }
  }

  return result;
}

// ── Week label helper ─────────────────────────────────────────────────────────

function toRelWeekShort(w) {
  if (w < 24)   return `M${w}`;
  if (w === 24) return 'Now';
  return `+${w - 24}M`;
}

// ── Value helpers ─────────────────────────────────────────────────────────────

function getMeasureValue(row, week, tree) {
  if (row.type === 'measure')
    return tree.leafData.get(row.lineKey)?.[week]?.[row.measureKey] ?? null;
  return null;
}

function getAggValue(row, week, primaryMeasureKey, tree) {
  if (!primaryMeasureKey) return null;
  if (row.type === 'sku') return tree.skuAgg.get(row.key)?.[week]?.[primaryMeasureKey] ?? null;
  return null;
}

function formatVal(v, fmt) {
  if (v == null || v === '') return '—';
  if (typeof v !== 'number') return String(v);
  if (fmt === 'int')  return Math.round(v).toLocaleString('en-IN');
  if (fmt === 'dec1') return v.toFixed(1);
  return String(v);
}

function skuDisplayLabel(sku) {
  return sku.replace(/_/g, ' ');
}

// ── Row styling ───────────────────────────────────────────────────────────────

const ROW_STYLES = {
  sku:       { bg: 'var(--navy-accent)', fg: 'white',          fw: 700, fs: 11 },
  plantline: { bg: 'var(--blue-bg)',     fg: 'var(--text-1)',  fw: 500, fs: 11 },
  measure:   { bg: 'white',              fg: 'var(--text-1)',  fw: 400, fs: 11 },
};

const INDENTS = { sku: 10, plantline: 22, measure: 34 };

function getCellHighlight(measureKey, value) {
  if (measureKey === 'shortageQty' && value > 0)
    return value > 100 ? '#FEE2E2' : '#FEF3C7';
  if (measureKey === 'materialAvailability' && value != null) {
    if (value < 7)  return '#FEE2E2';
    if (value < 14) return '#FEF3C7';
  }
  if (measureKey === 'daysOfCover' && value != null) {
    if (value < 7)  return '#FEE2E2';
    if (value < 14) return '#FEF3C7';
    if (value > 90) return '#EFF6FF';
  }
  return null;
}

// ── NoScrollOuter — hides scrollbar on the frozen left FixedSizeList ─────────

const NoScrollOuter = forwardRef(({ style, ...rest }, ref) => (
  <div ref={ref} style={{ ...style, overflow: 'hidden' }} {...rest} />
));

// ── Left cell — frozen row label ──────────────────────────────────────────────

const LeftCell = memo(({ index, style, data }) => {
  const {
    flatRows, expandedSkus, expandedLeaves,
    toggleSku, toggleLeaf, accentColor, onTakeAction,
  } = data;

  const row = flatRows[index];
  if (!row) return <div style={style} />;

  const rs     = ROW_STYLES[row.type] || ROW_STYLES.measure;
  const indent = INDENTS[row.type] || 10;

  if (row.type === 'measure') {
    return (
      <div style={{
        ...style, background: rs.bg,
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        paddingRight: 8, overflow: 'hidden',
      }}>
        <div style={{
          width: 3, alignSelf: 'stretch', background: accentColor, opacity: 0.6,
          marginLeft: indent, marginRight: 8, flexShrink: 0,
        }} />
        <span style={{ fontSize: 10, color: 'var(--text-3)', fontStyle: 'italic',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.measureLabel}
        </span>
      </div>
    );
  }

  if (row.type === 'sku') {
    const open = expandedSkus.has(row.key);
    return (
      <div
        onClick={() => toggleSku(row.key)}
        style={{
          ...style, background: rs.bg,
          display: 'flex', alignItems: 'center',
          paddingLeft: indent, paddingRight: 6,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          cursor: 'pointer', userSelect: 'none', overflow: 'hidden',
        }}
      >
        <span style={{ color: rs.fg, opacity: 0.6, flexShrink: 0, marginRight: 4, display: 'flex' }}>
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
        <span style={{
          fontSize: rs.fs, fontWeight: rs.fw, color: rs.fg,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
        }}>
          {skuDisplayLabel(row.sku)}
        </span>
      </div>
    );
  }

  // plantline row — two-line label: plant·line (primary) + city (secondary)
  if (row.type === 'plantline') {
    const open = expandedLeaves.has(row.key);
    return (
      <div
        onClick={() => toggleLeaf(row.key)}
        style={{
          ...style, background: rs.bg,
          display: 'flex', alignItems: 'center',
          paddingLeft: indent, paddingRight: 6,
          borderBottom: '1px solid var(--border)',
          cursor: 'pointer', userSelect: 'none', overflow: 'hidden',
        }}
      >
        <span style={{ color: rs.fg, opacity: 0.6, flexShrink: 0, marginRight: 4, display: 'flex' }}>
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 500, color: rs.fg,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {row.label}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--text-3)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            lineHeight: 1.2,
          }}>
            {row.subLabel}
          </div>
        </div>
        {onTakeAction && (
          <button
            onClick={e => { e.stopPropagation(); onTakeAction(row.sku, row.locId); }}
            title="Take Action"
            style={{
              flexShrink: 0, marginLeft: 4,
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: 4,
              padding: '2px 4px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              color: 'var(--navy-accent)',
              lineHeight: 1,
            }}
          >
            <Zap size={11} />
          </button>
        )}
      </div>
    );
  }

  return <div style={style} />;
});

// ── Right cell — data value (or edit input) ───────────────────────────────────

const RightCell = memo(({ columnIndex, rowIndex, style, data }) => {
  const { flatRows, weeks, tree, primaryMeasureKey, onBeginEdit } = data;
  const row  = flatRows[rowIndex];
  const week = weeks[columnIndex];
  if (!row || !week) return <div style={style} />;

  const rs = ROW_STYLES[row.type] || ROW_STYLES.measure;

  let value, fmt, highlight;
  if (row.type === 'measure') {
    value     = getMeasureValue(row, week, tree);
    fmt       = row.measureFmt;
    highlight = getCellHighlight(row.measureKey, value);
  } else if (row.type === 'plantline') {
    return (
      <div style={{
        ...style, background: rs.bg,
        borderBottom: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
      }} />
    );
  } else {
    value = getAggValue(row, week, primaryMeasureKey, tree);
    fmt   = 'int';
  }

  const displayStr = formatVal(value, fmt);
  const cellKey    = `${row.key}|w${week}`;
  const cellBg     = highlight || rs.bg;
  const isEditable = row.type === 'measure' && row.editable && week >= 24;

  const textColor = row.type === 'sku' ? 'white' : 'var(--text-1)';

  return (
    <div
      style={{
        ...style,
        background: cellBg,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        paddingRight: 8, paddingLeft: 4,
        borderBottom: '1px solid var(--border)',
        borderRight: '1px solid rgba(0,0,0,0.04)',
        fontSize: rs.fs,
        fontWeight: row.type === 'sku' ? 700 : 400,
        color: highlight ? 'var(--text-1)' : textColor,
        cursor: isEditable ? 'cell' : 'default',
        userSelect: 'none',
      }}
      onDoubleClick={() => isEditable && onBeginEdit(cellKey, row, week, value)}
    >
      {displayStr}
    </div>
  );
});

// ── Edit overlay — rendered outside the virtualized grid ─────────────────────

function EditOverlay({ editing, onCommit, onCancel }) {
  const inputRef = useRef();

  useLayoutEffect(() => {
    if (inputRef.current) inputRef.current.select();
  }, []);

  if (!editing) return null;

  const { rect, value, setValue } = editing;

  return (
    <div style={{
      position: 'fixed',
      left: rect.left, top: rect.top,
      width: rect.width, height: rect.height,
      zIndex: 100,
      background: 'white',
      border: '2px solid var(--blue)',
      borderRadius: 3,
      display: 'flex', alignItems: 'center',
    }}>
      <input
        ref={inputRef}
        type="number"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={() => onCommit(parseFloat(value))}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.target.blur(); }
          if (e.key === 'Escape') onCancel();
        }}
        style={{
          width: '100%', height: '100%', border: 'none',
          fontSize: 11, textAlign: 'right', padding: '0 6px',
          background: 'transparent', outline: 'none',
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

// ── PlanningGrid ──────────────────────────────────────────────────────────────

export default function PlanningGrid({
  rows       = [],
  weeks      = [],
  measureGroup = 'demand',
  onCellEdit,
  onTakeAction,
  loading    = false,
  height     = 500,
  width      = 900,
}) {
  const [expandedSkus,   setExpandedSkus]   = useState(() => new Set());
  const [expandedLeaves, setExpandedLeaves] = useState(() => new Set());

  const [editing, setEditing] = useState(null);

  const leftListRef  = useRef();
  const rightGridRef = useRef();
  const hdrScrollRef = useRef();

  const groupDef          = MEASURE_GROUPS[measureGroup] || MEASURE_GROUPS.demand;
  const measureDefs       = groupDef.measures;
  const primaryMeasureKey = measureDefs[0]?.key ?? null;
  const accentColor       = groupDef.accentColor;

  // ── Build tree (memoized) ──────────────────────────────────────────────────
  const tree = useMemo(() => {
    if (!rows.length || !measureDefs.length) return null;
    return buildTree(rows, measureDefs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, measureGroup]);

  // ── Flatten to virtual rows (memoized) ────────────────────────────────────
  const flatRows = useMemo(() => {
    if (!tree) return [];
    return buildFlatRows(tree, expandedSkus, expandedLeaves, measureDefs);
  }, [tree, expandedSkus, expandedLeaves, measureDefs]);

  // ── Toggle handlers ────────────────────────────────────────────────────────
  const toggleSku = useCallback(key => {
    setExpandedSkus(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  }, []);
  const toggleLeaf = useCallback(key => {
    setExpandedLeaves(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  }, []);

  // ── Expand / collapse all ──────────────────────────────────────────────────
  const expandAll = useCallback(() => {
    if (!tree) return;
    setExpandedSkus(new Set(tree.skuOrder));
    const leaves = new Set();
    for (const sku of tree.skuOrder) {
      for (const locId of (tree.leafOrder.get(sku) || [])) {
        leaves.add(`${sku}|${locId}`);
      }
    }
    setExpandedLeaves(leaves);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpandedSkus(new Set());
    setExpandedLeaves(new Set());
  }, []);

  // ── Scroll sync ────────────────────────────────────────────────────────────
  const handleRightScroll = useCallback(({ scrollLeft, scrollTop }) => {
    if (leftListRef.current)  leftListRef.current.scrollTo(scrollTop);
    if (hdrScrollRef.current) hdrScrollRef.current.scrollLeft = scrollLeft;
  }, []);

  // ── Edit flow ──────────────────────────────────────────────────────────────
  const handleBeginEdit = useCallback((cellKey, row, week, currentValue) => {
    if (!rightGridRef.current) return;

    const gridEl = rightGridRef.current._outerRef || rightGridRef.current;
    if (!gridEl || typeof gridEl.getBoundingClientRect !== 'function') return;

    const gridRect  = gridEl.getBoundingClientRect();
    const colIndex  = weeks.indexOf(week);
    const scrollLeft = rightGridRef.current.state?.scrollLeft || 0;
    const scrollTop  = rightGridRef.current.state?.scrollTop  || 0;
    const rowIndex   = flatRows.findIndex(r => r.key === row.key);

    const cellLeft = gridRect.left + (colIndex * COL_W) - scrollLeft;
    const cellTop  = gridRect.top  + (rowIndex * ROW_H) - scrollTop;

    setEditing({
      cellKey, row, week,
      currentValue,
      value: String(Math.round(currentValue || 0)),
      setValue: (v) => setEditing(prev => prev ? { ...prev, value: v } : prev),
      rect: { left: cellLeft, top: cellTop, width: COL_W, height: ROW_H },
    });
  }, [weeks, flatRows]);

  const handleEditCommit = useCallback((newValue) => {
    if (!editing || isNaN(newValue)) { setEditing(null); return; }
    const delta = newValue - (editing.currentValue || 0);
    if (delta !== 0 && onCellEdit) {
      onCellEdit({ row: editing.row, week: editing.week, newValue, delta });
    }
    setEditing(null);
  }, [editing, onCellEdit]);

  const handleEditCancel = useCallback(() => { setEditing(null); }, []);

  // ── Item data (stable references) ─────────────────────────────────────────
  const leftData = useMemo(() => ({
    flatRows, expandedSkus, expandedLeaves,
    toggleSku, toggleLeaf, accentColor, onTakeAction,
  }), [flatRows, expandedSkus, expandedLeaves, toggleSku, toggleLeaf, accentColor, onTakeAction]);

  const rightData = useMemo(() => ({
    flatRows, weeks, tree, primaryMeasureKey, onBeginEdit: handleBeginEdit,
  }), [flatRows, weeks, tree, primaryMeasureKey, handleBeginEdit]);

  const dataH      = height - HDR_H;
  const rightW     = Math.max(60, width - LEFT_W - 2);
  const totalColsW = weeks.length * COL_W;

  // ── Loading / empty states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height, color: 'var(--text-3)', fontSize: 13 }}>
        <span style={{ marginRight: 8, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
        Loading planning data…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height, color: 'var(--text-3)', fontSize: 13 }}>
        No planning data for current filters.
      </div>
    );
  }

  const btnStyle = {
    fontSize: 10, padding: '3px 8px', borderRadius: 4,
    background: 'var(--bg)', border: '1px solid var(--border)',
    cursor: 'pointer', color: 'var(--text-2)',
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar: row count + expand/collapse */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px',
        background: 'var(--card)', borderBottom: '1px solid var(--border)',
        fontSize: 11, color: 'var(--text-3)',
      }}>
        <span>{flatRows.length} rows visible · {weeks.length} months · {rows.length} SKU-plants</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={expandAll}   style={btnStyle}>Expand All</button>
          <button onClick={collapseAll} style={btnStyle}>Collapse All</button>
        </div>
      </div>

      {/* Grid wrapper */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: height - 33,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        position: 'relative',
      }}>

        {/* ── Column header row ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', height: HDR_H, flexShrink: 0,
          borderBottom: '2px solid var(--border)',
          background: '#F8FAFC',
        }}>
          {/* Corner label */}
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
              background: groupDef.accentColor === 'var(--navy-accent)' ? 'var(--navy-accent)' : groupDef.accentColor,
              color: 'white', fontSize: 9, fontWeight: 700,
              padding: '1px 6px', borderRadius: 4, marginRight: 6,
            }}>
              {groupDef.label.toUpperCase()}
            </span>
            SKU / Plant / Line
          </div>

          {/* Week header strip — horizontally synced with right grid */}
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
                  color: w === 24 ? 'white' : 'var(--text-2)',
                  background: w === 24 ? 'var(--navy-accent)' : 'transparent',
                  borderRight: '1px solid var(--border)',
                }}>
                  {toRelWeekShort(w)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Grid body ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* Left frozen labels */}
          <div style={{
            width: LEFT_W, flexShrink: 0,
            borderRight: '2px solid var(--border)',
            background: 'var(--card)',
          }}>
            <FixedSizeList
              ref={leftListRef}
              outerElementType={NoScrollOuter}
              height={dataH - 33}
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
              height={dataH - 33}
              width={rightW}
              columnCount={weeks.length}
              columnWidth={COL_W}
              rowCount={flatRows.length}
              rowHeight={ROW_H}
              onScroll={handleRightScroll}
              itemData={rightData}
            >
              {RightCell}
            </FixedSizeGrid>
          </div>
        </div>
      </div>

      {/* Edit overlay */}
      {editing && (
        <EditOverlay
          editing={editing}
          onCommit={handleEditCommit}
          onCancel={handleEditCancel}
        />
      )}
    </>
  );
}
