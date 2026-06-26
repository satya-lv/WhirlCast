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
 * Hierarchy: SKU → Location → Plant → Production Line, each expandable.
 * Measure sub-rows appear under each Line row (3-4 per group).
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
      { key: 'forecastDemand',     label: 'Demand',      fmt: 'int' },
      { key: 'beginningInventory', label: 'Inventory',   fmt: 'int' },
      { key: 'plannedProduction',  label: 'Production',  fmt: 'int', editable: true },
      { key: 'shortageQty',        label: 'Gap',         fmt: 'int' },
      { key: 'gapVsSS',            label: 'Gap vs SS',   fmt: 'int' },
      { key: 'daysOfCover',        label: 'DoC (days)',  fmt: 'dec1', noAgg: true },
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

function buildTree(apiRows, measureDefs) {
  const measureKeys = measureDefs.map(m => m.key);
  const noAggKeys   = new Set(measureDefs.filter(m => m.noAgg).map(m => m.key));

  const skuOrder   = [];
  const locOrder   = new Map();   // sku → [locationId]
  const plantOrder = new Map();   // locKey → [plantId]
  const lineOrder  = new Map();   // plantKey → [lineId]
  const locMeta    = new Map();   // locKey → { name, region }
  const plantMeta  = new Map();   // plantKey → { name }
  const lineMeta   = new Map();   // lineKey → { name }
  const leafData   = new Map();   // lineKey → { [week]: { mk: value } }
  const lineApiRow = new Map();   // lineKey → original API row (for POST actions)

  for (const apiRow of apiRows) {
    const {
      sku, locationId, locationName, region,
      plantId, plantName,
      productionLineId, lineName,
      safetyStockWeeks = 0,
      cells = {},
    } = apiRow;

    const locKey   = `${sku}|${locationId}`;
    const plantKey = `${locKey}|${plantId}`;
    const lineKey  = `${plantKey}|${productionLineId}`;

    if (!skuOrder.includes(sku))                  skuOrder.push(sku);
    if (!locOrder.has(sku))                        locOrder.set(sku, []);
    if (!locOrder.get(sku).includes(locationId))   locOrder.get(sku).push(locationId);
    if (!plantOrder.has(locKey))                   plantOrder.set(locKey, []);
    if (!plantOrder.get(locKey).includes(plantId)) plantOrder.get(locKey).push(plantId);
    if (!lineOrder.has(plantKey))                  lineOrder.set(plantKey, []);
    if (!lineOrder.get(plantKey).includes(productionLineId))
      lineOrder.get(plantKey).push(productionLineId);

    locMeta.set(locKey,   { name: locationName, region });
    plantMeta.set(plantKey, { name: plantName });
    lineMeta.set(lineKey,   { name: lineName });
    lineApiRow.set(lineKey, apiRow);

    // Store leaf data keyed by week number
    const wmap = {};
    for (const [wkStr, cell] of Object.entries(cells)) {
      const w = parseInt(wkStr, 10);
      const vals = {};
      for (const mk of measureKeys) vals[mk] = cell[mk] ?? 0;
      // Derived measures — computed from raw cell fields, not present in API response
      if ('gapVsSS' in vals) {
        const fd = cell.forecastDemand ?? 0;
        const ei = cell.endingInventory ?? 0;
        vals.gapVsSS = ei - (safetyStockWeeks * fd);
      }
      if ('daysOfCover' in vals) {
        const fd = cell.forecastDemand ?? 0;
        const ei = cell.endingInventory ?? 0;
        vals.daysOfCover = fd > 0 ? (ei / fd) * 7 : null;
      }
      wmap[w] = vals;
    }
    leafData.set(lineKey, wmap);
  }

  // ── Aggregate upward ──────────────────────────────────────────────────────
  const plantAgg = new Map();  // plantKey → { week → { mk → sum } }
  const locAgg   = new Map();
  const skuAgg   = new Map();

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
    for (const locId of (locOrder.get(sku) || [])) {
      const locKey = `${sku}|${locId}`;
      for (const plantId of (plantOrder.get(locKey) || [])) {
        const plantKey = `${locKey}|${plantId}`;
        for (const lineId of (lineOrder.get(plantKey) || [])) {
          const lineKey = `${plantKey}|${lineId}`;
          for (const [wStr, vals] of Object.entries(leafData.get(lineKey) || {})) {
            const w = parseInt(wStr, 10);
            addTo(plantAgg, plantKey, w, vals);
            addTo(locAgg,   locKey,   w, vals);
            addTo(skuAgg,   sku,      w, vals);
          }
        }
      }
    }
  }

  return {
    skuOrder, locOrder, plantOrder, lineOrder,
    locMeta, plantMeta, lineMeta, lineApiRow,
    leafData, plantAgg, locAgg, skuAgg,
  };
}

// ── Flat row list ─────────────────────────────────────────────────────────────
//
// Produces the ordered array of virtual rows based on current expand state.
// Row types: 'sku' | 'location' | 'plant' | 'line' | 'measure'

function buildFlatRows(tree, expandedSkus, expandedLocs, expandedPlants, measureDefs) {
  const { skuOrder, locOrder, plantOrder, lineOrder, locMeta, plantMeta, lineMeta } = tree;
  const result = [];

  for (const sku of skuOrder) {
    result.push({ type: 'sku', key: sku, sku });

    if (!expandedSkus.has(sku)) continue;

    for (const locId of (locOrder.get(sku) || [])) {
      const locKey  = `${sku}|${locId}`;
      const locName = locMeta.get(locKey)?.name ?? `Loc ${locId}`;
      result.push({ type: 'location', key: locKey, label: locName, sku, locId });

      if (!expandedLocs.has(locKey)) continue;

      for (const plantId of (plantOrder.get(locKey) || [])) {
        const plantKey  = `${locKey}|${plantId}`;
        const plantName = plantMeta.get(plantKey)?.name ?? `Plant ${plantId}`;
        result.push({ type: 'plant', key: plantKey, label: plantName, sku, locId, plantId });

        if (!expandedPlants.has(plantKey)) continue;

        for (const lineId of (lineOrder.get(plantKey) || [])) {
          const lineKey  = `${plantKey}|${lineId}`;
          const lineName = lineMeta.get(lineKey)?.name ?? `Line ${lineId}`;
          result.push({ type: 'line', key: lineKey, label: lineName, sku, locId, plantId, lineId, lineKey });

          // Measure sub-rows — one per measure in the active group
          for (const mDef of measureDefs) {
            result.push({
              type: 'measure',
              key: `${lineKey}|${mDef.key}`,
              lineKey, sku, locId, plantId, lineId,
              measureKey: mDef.key,
              measureLabel: mDef.label,
              measureFmt: mDef.fmt,
              editable: !!mDef.editable,
            });
          }
        }
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
  if (row.type === 'plant')    return tree.plantAgg.get(row.key)?.[week]?.[primaryMeasureKey] ?? null;
  if (row.type === 'location') return tree.locAgg.get(row.key)?.[week]?.[primaryMeasureKey] ?? null;
  if (row.type === 'sku')      return tree.skuAgg.get(row.key)?.[week]?.[primaryMeasureKey] ?? null;
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
  sku:      { bg: 'var(--navy-accent)', fg: 'white',                    fw: 700, fs: 11 },
  location: { bg: '#1e3a5f',            fg: 'rgba(255,255,255,0.88)',   fw: 600, fs: 11 },
  plant:    { bg: 'var(--blue-bg)',     fg: 'var(--text-1)',            fw: 500, fs: 11 },
  line:     { bg: '#F5F7FA',            fg: 'var(--text-2)',            fw: 500, fs: 10 },
  measure:  { bg: 'white',              fg: 'var(--text-1)',            fw: 400, fs: 11 },
};

const INDENTS = { sku: 10, location: 22, plant: 36, line: 50, measure: 56 };

function getCellHighlight(measureKey, value) {
  if (measureKey === 'shortageQty' && value > 0)
    return value > 100 ? '#FEE2E2' : '#FEF3C7';
  if (measureKey === 'materialAvailability' && value != null) {
    if (value < 7)  return '#FEE2E2';
    if (value < 14) return '#FEF3C7';
  }
  if (measureKey === 'gapVsSS' && value != null && value < 0)
    return '#FEE2E2';
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
    flatRows, expandedSkus, expandedLocs, expandedPlants,
    toggleSku, toggleLoc, togglePlant, accentColor, onTakeAction,
  } = data;

  const row = flatRows[index];
  if (!row) return <div style={style} />;

  const rs      = ROW_STYLES[row.type] || ROW_STYLES.measure;
  const indent  = INDENTS[row.type] || 10;
  let label, chevron, onClick;

  if (row.type === 'sku') {
    const open = expandedSkus.has(row.key);
    onClick = () => toggleSku(row.key);
    label   = skuDisplayLabel(row.sku);
    chevron = open ? <ChevronDown size={11} /> : <ChevronRight size={11} />;
  } else if (row.type === 'location') {
    const open = expandedLocs.has(row.key);
    onClick = () => toggleLoc(row.key);
    label   = row.label;
    chevron = open ? <ChevronDown size={11} /> : <ChevronRight size={11} />;
  } else if (row.type === 'plant') {
    const open = expandedPlants.has(row.key);
    onClick = () => togglePlant(row.key);
    label   = row.label;
    chevron = open ? <ChevronDown size={11} /> : <ChevronRight size={11} />;
  } else if (row.type === 'line') {
    label = row.label;
  } else if (row.type === 'measure') {
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

  return (
    <div
      onClick={onClick}
      style={{
        ...style, background: rs.bg,
        display: 'flex', alignItems: 'center',
        paddingLeft: indent, paddingRight: 6,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none', overflow: 'hidden',
      }}
    >
      {chevron && (
        <span style={{ color: rs.fg, opacity: 0.6, flexShrink: 0, marginRight: 4, display: 'flex' }}>
          {chevron}
        </span>
      )}
      <span style={{
        fontSize: rs.fs, fontWeight: rs.fw, color: rs.fg,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        flex: 1,
      }}>
        {label}
      </span>
      {row.type === 'location' && onTakeAction && (
        <button
          onClick={e => { e.stopPropagation(); onTakeAction(row.sku, row.locId); }}
          title="Take Action"
          style={{
            flexShrink: 0, marginLeft: 4,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.28)',
            borderRadius: 4,
            padding: '2px 4px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            color: 'rgba(255,255,255,0.82)',
            lineHeight: 1,
          }}
        >
          <Zap size={11} />
        </button>
      )}
    </div>
  );
});

// ── Right cell — data value (or edit input) ───────────────────────────────────

const RightCell = memo(({ columnIndex, rowIndex, style, data }) => {
  const { flatRows, weeks, tree, primaryMeasureKey, onBeginEdit } = data;
  const row  = flatRows[rowIndex];
  const week = weeks[columnIndex];
  if (!row || !week) return <div style={style} />;

  const rs = ROW_STYLES[row.type] || ROW_STYLES.measure;

  // Determine value and formatting
  let value, fmt, highlight;
  if (row.type === 'measure') {
    value     = getMeasureValue(row, week, tree);
    fmt       = row.measureFmt;
    highlight = getCellHighlight(row.measureKey, value);
  } else if (row.type === 'line') {
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
  const cellKey = `${row.key}|w${week}`;

  const cellBg = highlight || rs.bg;
  const isEditable = row.type === 'measure' && row.editable && week >= 24;

  const textColor = row.type === 'sku'      ? 'white'
                  : row.type === 'location' ? 'rgba(255,255,255,0.85)'
                  : 'var(--text-1)';

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
        fontWeight: row.type === 'sku' ? 700 : row.type === 'location' ? 600 : 400,
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
//
// We keep the input as an absolute-positioned overlay rather than inside the
// grid cell. This avoids re-rendering all visible cells when the user types.

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
  const [expandedLocs,   setExpandedLocs]   = useState(() => new Set());
  const [expandedPlants, setExpandedPlants] = useState(() => new Set());

  // Editing state: null or { cellKey, row, week, currentValue, value, setValue, rect }
  const [editing, setEditing] = useState(null);

  const leftListRef  = useRef();
  const rightGridRef = useRef();
  const hdrScrollRef = useRef();

  const groupDef        = MEASURE_GROUPS[measureGroup] || MEASURE_GROUPS.demand;
  const measureDefs     = groupDef.measures;
  const primaryMeasureKey = measureDefs[0]?.key ?? null;
  const accentColor     = groupDef.accentColor;

  // ── Build tree (memoized) ──────────────────────────────────────────────────
  const tree = useMemo(() => {
    if (!rows.length || !measureDefs.length) return null;
    return buildTree(rows, measureDefs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, measureGroup]); // measureDefs is derived from measureGroup — intentionally omitted

  // ── Flatten to virtual rows (memoized) ────────────────────────────────────
  const flatRows = useMemo(() => {
    if (!tree) return [];
    return buildFlatRows(tree, expandedSkus, expandedLocs, expandedPlants, measureDefs);
  }, [tree, expandedSkus, expandedLocs, expandedPlants, measureDefs]);

  // ── Toggle handlers ────────────────────────────────────────────────────────
  const toggleSku = useCallback(key => {
    setExpandedSkus(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  }, []);
  const toggleLoc = useCallback(key => {
    setExpandedLocs(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  }, []);
  const togglePlant = useCallback(key => {
    setExpandedPlants(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  }, []);

  // ── Expand / collapse all ──────────────────────────────────────────────────
  const expandAll = useCallback(() => {
    if (!tree) return;
    setExpandedSkus(new Set(tree.skuOrder));
    const locs = new Set(), plants = new Set();
    for (const sku of tree.skuOrder) {
      for (const locId of (tree.locOrder.get(sku) || [])) {
        const lk = `${sku}|${locId}`;
        locs.add(lk);
        for (const plantId of (tree.plantOrder.get(lk) || [])) {
          plants.add(`${lk}|${plantId}`);
        }
      }
    }
    setExpandedLocs(locs);
    setExpandedPlants(plants);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpandedSkus(new Set());
    setExpandedLocs(new Set());
    setExpandedPlants(new Set());
  }, []);

  // ── Scroll sync ────────────────────────────────────────────────────────────
  const handleRightScroll = useCallback(({ scrollLeft, scrollTop }) => {
    if (leftListRef.current)   leftListRef.current.scrollTo(scrollTop);
    if (hdrScrollRef.current)  hdrScrollRef.current.scrollLeft = scrollLeft;
  }, []);

  // ── Edit flow ──────────────────────────────────────────────────────────────
  const handleBeginEdit = useCallback((cellKey, row, week, currentValue) => {
    if (!rightGridRef.current) return;

    const gridEl = rightGridRef.current._outerRef || rightGridRef.current;
    if (!gridEl || typeof gridEl.getBoundingClientRect !== 'function') return;

    const gridRect = gridEl.getBoundingClientRect();
    const colIndex = weeks.indexOf(week);
    const scrollLeft = rightGridRef.current.state?.scrollLeft || 0;
    const scrollTop  = rightGridRef.current.state?.scrollTop  || 0;

    // rowIndex via key lookup (avoids reference equality issues after flatRows rebuild)
    const rowIndex = flatRows.findIndex(r => r.key === row.key);

    const cellLeft = gridRect.left + (colIndex * COL_W) - scrollLeft;
    const cellTop  = gridRect.top  + (rowIndex * ROW_H) - scrollTop;

    setEditing({
      cellKey, row, week,
      currentValue,
      value: String(Math.round(currentValue || 0)),
      setValue: (v) => setEditing(prev => prev ? { ...prev, value: v } : prev),
      rect: {
        left: cellLeft, top: cellTop,
        width: COL_W, height: ROW_H,
      },
    });
  }, [weeks, flatRows]);

  const handleEditCommit = useCallback((newValue) => {
    if (!editing || isNaN(newValue)) { setEditing(null); return; }
    const delta = newValue - (editing.currentValue || 0);
    if (delta !== 0 && onCellEdit) {
      onCellEdit({
        row: editing.row,
        week: editing.week,
        newValue,
        delta,
      });
    }
    setEditing(null);
  }, [editing, onCellEdit]);

  const handleEditCancel = useCallback(() => {
    setEditing(null);
  }, []);

  // ── Item data (stable references to prevent unnecessary re-renders) ────────
  const leftData = useMemo(() => ({
    flatRows, expandedSkus, expandedLocs, expandedPlants,
    toggleSku, toggleLoc, togglePlant, accentColor, onTakeAction,
  }), [flatRows, expandedSkus, expandedLocs, expandedPlants,
       toggleSku, toggleLoc, togglePlant, accentColor, onTakeAction]);

  const rightData = useMemo(() => ({
    flatRows, weeks, tree, primaryMeasureKey, onBeginEdit: handleBeginEdit,
  }), [flatRows, weeks, tree, primaryMeasureKey, handleBeginEdit]);

  // ── Expose expand/collapse API via imperative handle (prop callbacks) ──────
  // (parent can call these via the props below)

  const dataH       = height - HDR_H;
  const rightW      = Math.max(60, width - LEFT_W - 2);
  const totalColsW  = weeks.length * COL_W;

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
        <span>{flatRows.length} rows visible · {weeks.length} months · {rows.length} SKU-locations</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={expandAll} style={btnStyle}>Expand All</button>
          <button onClick={collapseAll} style={btnStyle}>Collapse All</button>
        </div>
      </div>

      {/* Grid wrapper */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: height - 33, // subtract toolbar height
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
            SKU / Location / Line
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

      {/* Edit overlay — positioned outside grid to avoid re-render cascade */}
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

const btnStyle = {
  background: 'var(--blue-bg)', border: '1px solid var(--blue)',
  color: 'var(--blue)', borderRadius: 'var(--radius-sm)',
  padding: '2px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer',
};
