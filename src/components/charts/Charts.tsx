import React, { useEffect, useRef, useState } from 'react';

// Small, dependency-free SVG charts for the admin dashboards.
// Conventions (see the dataviz guidance): one y-axis only, 2px lines, 4px
// rounded bar ends, recessive grid, hover/focus tooltips, colour never the only
// carrier of meaning (legends with values, direct labels, table view).

export type Formatter = (n: number) => string;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

// "Nice" ticks covering [min, max] (min may be negative, e.g. a loss).
function niceTicks(min: number, max: number, count = 4) {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max, lo === 0 ? 1 : 0);
  const raw = (hi - lo) / count || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) || raw;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

// --------------------------------------------------------------------------
// LineChart — one or more measures of the SAME unit over time on one y-axis
// (never two scales). 2px lines, optional soft area on the first series,
// dashed lines for reference series, a zero line when values go negative,
// and a crosshair tooltip listing every series at the hovered point.
// --------------------------------------------------------------------------
export interface LineSeries { key: string; label: string; color: string; dashed?: boolean; area?: boolean }
export interface LinePoint { label: string; values: Record<string, number | null>; detail?: string }

export const LineChart: React.FC<{
  points: LinePoint[]; series: LineSeries[]; format: Formatter; axisFormat?: Formatter; height?: number; ariaLabel: string;
}> = ({ points, series, format, axisFormat = format, height = 240, ariaLabel }) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 12, bottom: 28, left: 60 };
  const w = Math.max(10, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const all = points.flatMap((p) => series.map((s) => p.values[s.key]).filter((v): v is number => v != null && Number.isFinite(v)));
  const ticks = niceTicks(all.length ? Math.min(...all) : 0, all.length ? Math.max(...all) : 1);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const x = (i: number) => (points.length <= 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v: number) => h - ((v - lo) / (hi - lo || 1)) * h;
  const path = (key: string) => {
    let d = '';
    points.forEach((p, i) => {
      const v = p.values[key];
      if (v == null || !Number.isFinite(v)) return;
      d += `${d ? ' L' : 'M'}${x(i)},${y(v)}`;
    });
    return d;
  };
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(w / 70))));
  const pick = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !points.length) return;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(((clientX - box.left - pad.left) / w) * (points.length - 1)))));
  };
  const hp = hover != null ? points[hover] : null;
  const areaSeries = series.find((s) => s.area);

  return (
    <div className="viz relative w-full min-w-0" ref={ref}>
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mb-2">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className={`w-4 ${s.dashed ? 'border-t-2 border-dashed' : 'h-0.5 rounded'}`} style={s.dashed ? { borderColor: s.color } : { background: s.color }} aria-hidden="true" />{s.label}
            </span>
          ))}
        </div>
      )}
      <svg
        width={width} height={height} role="img" aria-label={ariaLabel} className="block touch-pan-y max-w-full"
        onMouseMove={(e) => pick(e.clientX)} onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => pick(e.touches[0].clientX)} onTouchMove={(e) => pick(e.touches[0].clientX)}
      >
        <g transform={`translate(${pad.left},${pad.top})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={w} y1={y(t)} y2={y(t)} stroke={t === 0 && lo < 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} />
              <text x={-8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--viz-axis)">{axisFormat(t)}</text>
            </g>
          ))}
          {points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) && (
            <text key={i} x={x(i)} y={h + 18} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--viz-axis)">{p.label}</text>
          ))}
          {areaSeries && points.length > 1 && path(areaSeries.key) && (
            <path d={`${path(areaSeries.key)} L${x(points.length - 1)},${y(Math.max(lo, 0))} L${x(0)},${y(Math.max(lo, 0))} Z`} fill={areaSeries.color} opacity={0.12} />
          )}
          {series.map((s) => (
            <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 4' : undefined} />
          ))}
          {points.length === 1 && series.map((s) => points[0].values[s.key] != null && <circle key={s.key} cx={x(0)} cy={y(points[0].values[s.key] as number)} r={4} fill={s.color} />)}
          {hp && hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={0} y2={h} stroke="var(--viz-axis)" strokeDasharray="3 3" />
              {series.map((s) => hp.values[s.key] != null && <circle key={s.key} cx={x(hover)} cy={y(hp.values[s.key] as number)} r={4.5} fill={s.color} stroke="var(--t-slate-900)" strokeWidth={2} />)}
            </g>
          )}
        </g>
      </svg>
      {hp && hover != null && (
        <div className="viz-tooltip" style={{ left: Math.min(width - 180, Math.max(0, pad.left + x(hover) + 10)), top: series.length > 1 ? 28 : 8 }}>
          <div className="font-semibold text-white mb-1">{hp.label}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: s.color }} aria-hidden="true" />{s.label}</span>
              <strong className="text-white tabular-nums">{hp.values[s.key] == null ? '—' : format(hp.values[s.key] as number)}</strong>
            </div>
          ))}
          {hp.detail && <div className="text-slate-400 mt-1">{hp.detail}</div>}
        </div>
      )}
    </div>
  );
};

// --------------------------------------------------------------------------
// BarList — ranked magnitudes (revenue by category, payment methods…).
// One hue, sorted, value + share printed beside every bar; rows can drill down.
// --------------------------------------------------------------------------
export interface BarItem { key: string; label: string; value: number; sub?: string }

export const BarList: React.FC<{ items: BarItem[]; format: Formatter; onSelect?: (item: BarItem) => void; showShare?: boolean; emptyText?: string; ariaLabel: string }> = ({ items, format, onSelect, showShare = true, emptyText = 'No data for this period.', ariaLabel }) => {
  const total = items.reduce((s, i) => s + i.value, 0);
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length || total === 0) return <p className="text-sm text-slate-400 py-4">{emptyText}</p>;
  return (
    <ul className="viz space-y-2.5" aria-label={ariaLabel}>
      {items.map((item) => {
        const Row = onSelect ? 'button' : 'div';
        return (
          <li key={item.key}>
            <Row
              {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(item) } : {})}
              className={`w-full text-left group ${onSelect ? 'rounded-lg focus-visible:outline-2 -mx-1 px-1 py-0.5 hover:bg-slate-800/40' : ''}`}
              title={`${item.label}: ${format(item.value)}${showShare ? ` (${((item.value / total) * 100).toFixed(1)}%)` : ''}`}
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-slate-200 truncate min-w-0">{item.label}</span>
                <span className="shrink-0 tabular-nums text-white font-semibold">{format(item.value)}{showShare && <span className="text-slate-500 font-normal ml-1.5">{((item.value / total) * 100).toFixed(0)}%</span>}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-800/70 overflow-hidden">
                <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: 'var(--viz-1)' }} />
              </div>
              {item.sub && <div className="text-xs text-slate-500 mt-0.5">{item.sub}</div>}
            </Row>
          </li>
        );
      })}
    </ul>
  );
};

// Accessible table equivalent of a chart (toggle beside the chart).
export const ChartTable: React.FC<{ caption: string; columns: string[]; rows: (string | number)[][] }> = ({ caption, columns, rows }) => (
  <div className="table-scroll max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-slate-800">
    <table className="data-table">
      <caption className="sr-only">{caption}</caption>
      <thead className="sticky top-0"><tr>{columns.map((c, i) => <th key={c} className={i ? 'text-right' : ''}>{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={j ? 'text-right tabular-nums' : ''}>{v}</td>)}</tr>)}</tbody>
    </table>
  </div>
);
