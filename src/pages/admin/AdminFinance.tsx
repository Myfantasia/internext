import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LineChart as LineChartIcon, RefreshCw, Table2, BarChart3, Info, Plus, Pencil, Trash2, Save, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LineChart, LinePoint, BarList, ChartTable } from '../../components/charts/Charts';
import {
  api, PageHeader, StatTile, Modal, Field, Pagination, ErrorState, LoadingBlock, EmptyState, useDebounced, kes, kesCompact, pct
} from './adminUi';

// Finance: revenue -> net revenue -> gross profit -> net profit, from real
// orders, cost prices and recorded expenses (server/repositories/financeRepo.js
// holds the definitions). Charts and KPIs follow the selected date range.

interface Totals {
  revenue: number; amountPaid: number; orders: number; averageOrder: number; refunds: number; refundCount: number; vat: number; netRevenue: number;
  cogs: number; cogsCoverage: number | null; grossProfit: number; grossMargin: number | null; expenses: number; netProfit: number; profitMargin: number | null;
}
interface Bucket { bucket: string; revenue: number; orders: number; vat: number; refunds: number; cogs: number; expenses: number; netRevenue: number; grossProfit: number; netProfit: number; profitMargin: number | null }
interface Overview {
  period: { from: string; to: string; previousFrom: string; previousTo: string; days: number; granularity: 'day' | 'week' | 'month' };
  current: Totals; previous: Totals;
  growth: { sales: number | null; netRevenue: number | null; orders: number | null; averageOrder: number | null; grossProfit: number | null; expenses: number | null; netProfit: number | null; cogs: number | null };
  series: Bucket[];
  previousRevenueSeries: { bucket: string; revenue: number }[];
  expenseBreakdown: { category: string; total: number; count: number; previous: number }[];
}

const TZ = 'Africa/Nairobi';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const shift = (day: string, n: number) => { const d = new Date(`${day}T12:00:00+03:00`); d.setUTCDate(d.getUTCDate() + n); return d.toLocaleDateString('en-CA', { timeZone: TZ }); };
const monday = (day: string) => shift(day, -((new Date(`${day}T12:00:00+03:00`).getUTCDay() + 6) % 7));
const nice = (day: string, g: string) => new Date(`${day}T12:00:00+03:00`).toLocaleDateString('en-KE', g === 'month' ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' });

// Every bucket in the range (zero-filled), the previous period aligned by position.
function buckets(o: Overview) {
  const g = o.period.granularity;
  const start = (d: string) => (g === 'week' ? monday(d) : g === 'month' ? `${d.slice(0, 7)}-01` : d);
  const next = (d: string) => (g === 'day' ? shift(d, 1) : g === 'week' ? shift(d, 7) : (() => { const [y, m] = d.split('-').map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`; })());
  const keys: string[] = [];
  for (let k = start(o.period.from); k <= o.period.to; k = next(k)) keys.push(k);
  const prevKeys: string[] = [];
  for (let k = start(o.period.previousFrom); prevKeys.length < keys.length; k = next(k)) prevKeys.push(k);
  return { keys, prevKeys };
}

const PRESETS = [['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['month', 'This month'], ['last-month', 'Last month'], ['year', 'This year']] as const;
function presetRange(key: string) {
  const t = today();
  const [y, m] = t.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (key === '7d') return { from: shift(t, -6), to: t };
  if (key === '90d') return { from: shift(t, -89), to: t };
  if (key === 'month') return { from: `${y}-${pad(m)}-01`, to: t };
  if (key === 'last-month') { const ly = m === 1 ? y - 1 : y; const lm = m === 1 ? 12 : m - 1; return { from: `${ly}-${pad(lm)}-01`, to: shift(`${y}-${pad(m)}-01`, -1) }; }
  if (key === 'year') return { from: `${y}-01-01`, to: t };
  return { from: shift(t, -29), to: t };
}

export const AdminFinance: React.FC<{ onNavigate?: (tab: string, params?: Record<string, string>) => void }> = () => {
  const { can } = useAuth();
  const [view, setView] = useState<'overview' | 'expenses' | 'channels'>('overview');
  const [preset, setPreset] = useState('30d');
  const [range, setRange] = useState(() => presetRange('30d'));

  return (
    <div className="space-y-5 animate-fadeInUp">
      <PageHeader icon={LineChartIcon} title="Finance" description="Revenue, costs and profit for the selected period, from paid orders, product cost prices and recorded expenses." />

      <div className="card p-3 flex flex-col lg:flex-row lg:items-center gap-3">
        {can('expenses:read') && (
          <div className="flex gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800 self-start" role="tablist" aria-label="Finance view">
            {(['overview', 'channels', 'expenses'] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-ghost'}`}>
                {v === 'overview' ? 'Overview' : v === 'channels' ? 'Online vs POS' : 'Expenses'}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none" role="group" aria-label="Period">
          {PRESETS.map(([k, l]) => <button key={k} type="button" onClick={() => { setPreset(k); setRange(presetRange(k)); }} aria-pressed={preset === k} className={`btn btn-sm shrink-0 ${preset === k ? 'btn-primary' : 'btn-ghost'}`}>{l}</button>)}
        </div>
        <div className="flex items-center gap-2 lg:ml-auto">
          <input type="date" value={range.from} max={range.to} onChange={(e) => { setPreset('custom'); setRange((r) => ({ ...r, from: e.target.value })); }} className="field-input !w-auto !py-1.5" aria-label="From date" />
          <span className="text-slate-500 text-sm">to</span>
          <input type="date" value={range.to} min={range.from} max={today()} onChange={(e) => { setPreset('custom'); setRange((r) => ({ ...r, to: e.target.value })); }} className="field-input !w-auto !py-1.5" aria-label="To date" />
        </div>
      </div>

      {view === 'overview' ? <FinanceOverview range={range} /> : view === 'channels' ? <ChannelSplit range={range} /> : <ExpensesPanel range={range} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Channel split: Online vs POS revenue comparison
// ---------------------------------------------------------------------------
interface ChannelTotals { online: Totals; pos: Totals }

const ChannelSplit: React.FC<{ range: { from: string; to: string } }> = ({ range }) => {
  const [data, setData] = useState<ChannelTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api<ChannelTotals>(`/api/admin/finance/channel-split?${new URLSearchParams(range)}`)); }
    catch (e: any) { setError(e.message || 'Could not load channel data'); }
    finally { setLoading(false); }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingBlock label="Calculating channel figures…" />;

  const { online, pos } = data;
  const totalRevenue = online.revenue + pos.revenue;
  const onlinePct = totalRevenue > 0 ? (online.revenue / totalRevenue) * 100 : 0;
  const posPct = totalRevenue > 0 ? (pos.revenue / totalRevenue) * 100 : 0;

  return (
    <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      {/* Split bar */}
      <section className="card card-pad space-y-3" aria-labelledby="split-h">
        <h3 id="split-h" className="text-base font-bold text-white">Revenue by channel</h3>
        <p className="text-xs text-slate-400">{range.from} to {range.to}</p>
        <div className="flex rounded-xl overflow-hidden h-5">
          <div className="bg-cyan-600 transition-all" style={{ width: `${onlinePct}%` }} title={`Online ${onlinePct.toFixed(1)}%`} />
          <div className="bg-violet-600 transition-all" style={{ width: `${posPct}%` }} title={`POS ${posPct.toFixed(1)}%`} />
        </div>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-cyan-600 shrink-0" />Online — {onlinePct.toFixed(1)}%</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-violet-600 shrink-0" />POS (In-Store) — {posPct.toFixed(1)}%</span>
        </div>
      </section>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {([['Online', online, 'cyan'] as const, ['POS (In-Store)', pos, 'violet'] as const]).map(([label, ch, color]) => (
          <section key={label} className={`card card-pad space-y-4 border-t-2 ${color === 'cyan' ? 'border-t-cyan-600' : 'border-t-violet-600'}`}>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">{label}</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Revenue" value={kesCompact(ch.revenue)} hint="Booked revenue" />
              <StatTile label="Cash collected" value={kesCompact(ch.amountPaid)} hint="Amount actually paid" />
              <StatTile label="Orders" value={ch.orders.toLocaleString()} hint={`Avg ${kesCompact(ch.averageOrder)}`} />
              <StatTile label="Net revenue" value={kesCompact(ch.netRevenue)} hint="After refunds & VAT" />
              <StatTile label="COGS" value={kesCompact(ch.cogs)} invert />
              <StatTile label="Gross profit" value={kesCompact(ch.grossProfit)} hint={ch.grossMargin != null ? `${pct(ch.grossMargin)} margin` : undefined} />
              <StatTile label="Net profit" value={kesCompact(ch.netProfit)} tone={ch.netProfit < 0 ? 'danger' : 'default'} />
              <StatTile label="Profit margin" value={pct(ch.profitMargin)} />
            </div>
          </section>
        ))}
      </div>
      <button type="button" onClick={load} disabled={loading} className="btn btn-ghost btn-sm"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
    </div>
  );
};

// ---------------------------------------------------------------------------
const FinanceOverview: React.FC<{ range: { from: string; to: string } }> = ({ range }) => {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tables, setTables] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await api<Overview>(`/api/admin/finance/overview?${new URLSearchParams(range)}`)); }
    catch (e: any) { setError(e.message || 'Could not load finance figures'); }
    finally { setLoading(false); }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  const chart = useMemo(() => {
    if (!data) return null;
    const { keys, prevKeys } = buckets(data);
    const g = data.period.granularity;
    const byKey = new Map(data.series.map((b) => [b.bucket, b]));
    const prev = new Map(data.previousRevenueSeries.map((b) => [b.bucket, b.revenue]));
    const rows = keys.map((k, i) => {
      const b = byKey.get(k);
      return {
        label: g === 'week' ? `w/c ${nice(k, g)}` : nice(k, g),
        revenue: b?.revenue || 0, previousRevenue: prev.get(prevKeys[i]) || 0, orders: b?.orders || 0,
        grossProfit: b?.grossProfit || 0, expenses: b?.expenses || 0, netProfit: b?.netProfit || 0, profitMargin: b?.profitMargin ?? null
      };
    });
    return { rows, g };
  }, [data]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data || !chart) return <LoadingBlock label="Calculating figures…" />;
  const c = data.current;
  const gr = data.growth;
  const hasActivity = c.revenue > 0 || c.expenses > 0 || data.previous.revenue > 0;
  const per = data.period.granularity;
  const toggle = (k: string) => setTables((t) => ({ ...t, [k]: !t[k] }));
  const TableToggle = ({ id }: { id: string }) => (
    <button type="button" onClick={() => toggle(id)} className="btn btn-ghost btn-sm shrink-0">{tables[id] ? <><BarChart3 className="w-4 h-4" />Chart</> : <><Table2 className="w-4 h-4" />Table</>}</button>
  );

  return (
    <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      <section className="space-y-3" aria-labelledby="kpi-h">
        <h3 id="kpi-h" className="sr-only">Key figures</h3>
        <p className="text-xs text-slate-400">{data.period.from} to {data.period.to} · changes compare with {data.period.previousFrom} to {data.period.previousTo}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          <StatTile label="Total revenue" value={kesCompact(c.revenue)} change={gr.sales} hint="Collected, incl. VAT & delivery" />
          <StatTile label="Net revenue" value={kesCompact(c.netRevenue)} change={gr.netRevenue} hint={`After ${kesCompact(c.refunds)} refunds and ${kesCompact(c.vat)} VAT`} />
          <StatTile label="Cost of goods sold" value={kesCompact(c.cogs)} change={gr.cogs} invert hint={c.cogsCoverage == null ? 'No sales' : c.cogsCoverage < 1 ? `Only ${pct(c.cogsCoverage, 0)} of sales have a cost price` : 'All sold items have a cost price'} tone={c.cogsCoverage != null && c.cogsCoverage < 1 ? 'warning' : 'default'} />
          <StatTile label="Gross profit" value={kesCompact(c.grossProfit)} change={gr.grossProfit} hint={c.grossMargin != null ? `${pct(c.grossMargin)} gross margin` : undefined} />
          <StatTile label="Expenses" value={kesCompact(c.expenses)} change={gr.expenses} invert hint={gr.expenses != null ? `Expense growth ${gr.expenses >= 0 ? '+' : ''}${pct(gr.expenses)}` : 'Recorded under Expenses'} />
          <StatTile label="Net profit" value={kesCompact(c.netProfit)} change={gr.netProfit} tone={c.netProfit < 0 ? 'danger' : 'default'} hint={c.netProfit < 0 ? 'Loss for the period' : undefined} />
          <StatTile label="Profit margin" value={pct(c.profitMargin)} hint={data.previous.profitMargin != null ? `Previous: ${pct(data.previous.profitMargin)}` : 'Net profit ÷ net revenue'} />
          <StatTile label="Total orders" value={c.orders.toLocaleString()} change={gr.orders} hint={`Average order ${kesCompact(c.averageOrder)}${gr.averageOrder != null ? ` (${gr.averageOrder >= 0 ? '+' : ''}${pct(gr.averageOrder)})` : ''}`} />
        </div>
        {c.cogsCoverage != null && c.cogsCoverage < 1 && (
          <p className="callout callout-warning text-xs"><Info className="w-4 h-4 shrink-0" /><span>Some sold products have no cost price, so cost of goods sold is understated and profit overstated. Add cost prices under Products for accurate figures.</span></p>
        )}
      </section>

      {!hasActivity ? (
        <EmptyState title="No financial data for this period" text="There are no paid orders or recorded expenses between these dates. Choose a longer period or record expenses." />
      ) : (
        <>
          <section className="card card-pad space-y-3 min-w-0" aria-labelledby="rev-h">
            <div className="flex items-start justify-between gap-2">
              <div><h3 id="rev-h" className="text-base font-bold text-white">Revenue over time</h3><p className="text-sm text-slate-400">Per {per}, compared with the same position in the previous period.</p></div>
              <TableToggle id="rev" />
            </div>
            {tables.rev
              ? <ChartTable caption="Revenue per period" columns={['Period', 'Revenue', 'Previous period', 'Orders']} rows={chart.rows.map((r) => [r.label, kes(r.revenue), kes(r.previousRevenue), r.orders])} />
              : <LineChart ariaLabel="Revenue over time versus previous period" format={kes} axisFormat={(n) => kesCompact(n).replace('KES ', '')}
                  series={[{ key: 'revenue', label: 'This period', color: 'var(--viz-1)', area: true }, { key: 'previousRevenue', label: 'Previous period', color: 'var(--viz-prev)', dashed: true }]}
                  points={chart.rows.map((r): LinePoint => ({ label: r.label, values: { revenue: r.revenue, previousRevenue: r.previousRevenue }, detail: `${r.orders} paid order${r.orders === 1 ? '' : 's'}` }))} />}
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section className="card card-pad space-y-3 min-w-0" aria-labelledby="pe-h">
              <div className="flex items-start justify-between gap-2">
                <div><h3 id="pe-h" className="text-base font-bold text-white">Profit vs expenses</h3><p className="text-sm text-slate-400">Gross profit earned against running costs, per {per}.</p></div>
                <TableToggle id="pe" />
              </div>
              {tables.pe
                ? <ChartTable caption="Profit versus expenses" columns={['Period', 'Gross profit', 'Expenses', 'Net profit']} rows={chart.rows.map((r) => [r.label, kes(r.grossProfit), kes(r.expenses), kes(r.netProfit)])} />
                : <LineChart ariaLabel="Gross profit versus expenses" format={kes} axisFormat={(n) => kesCompact(n).replace('KES ', '')}
                    series={[{ key: 'grossProfit', label: 'Gross profit', color: 'var(--viz-1)' }, { key: 'expenses', label: 'Expenses', color: 'var(--viz-2)' }]}
                    points={chart.rows.map((r): LinePoint => ({ label: r.label, values: { grossProfit: r.grossProfit, expenses: r.expenses }, detail: `Net profit ${kes(r.netProfit)}` }))} />}
            </section>

            <section className="card card-pad space-y-3 min-w-0" aria-labelledby="pm-h">
              <div className="flex items-start justify-between gap-2">
                <div><h3 id="pm-h" className="text-base font-bold text-white">Profit margin trend</h3><p className="text-sm text-slate-400">Net profit as a share of net revenue. Gaps mean no sales in that {per}.</p></div>
                <TableToggle id="pm" />
              </div>
              {tables.pm
                ? <ChartTable caption="Profit margin per period" columns={['Period', 'Profit margin', 'Net profit']} rows={chart.rows.map((r) => [r.label, pct(r.profitMargin), kes(r.netProfit)])} />
                : <LineChart ariaLabel="Profit margin over time" format={(n) => pct(n)} axisFormat={(n) => `${Math.round(n * 100)}%`}
                    series={[{ key: 'profitMargin', label: 'Profit margin', color: 'var(--viz-1)' }]}
                    points={chart.rows.map((r): LinePoint => ({ label: r.label, values: { profitMargin: r.profitMargin }, detail: `Net profit ${kes(r.netProfit)}` }))} />}
            </section>
          </div>

          <section className="card card-pad space-y-3" aria-labelledby="eb-h">
            <h3 id="eb-h" className="text-base font-bold text-white">Expense breakdown</h3>
            <BarList ariaLabel="Expenses by category" format={kesCompact} emptyText="No expenses recorded for this period."
              items={data.expenseBreakdown.map((e) => ({
                key: e.category, label: e.category, value: e.total,
                sub: `${e.count} entr${e.count === 1 ? 'y' : 'ies'}${e.previous > 0 ? ` · previous period ${kesCompact(e.previous)} (${e.total >= e.previous ? '+' : ''}${pct((e.total - e.previous) / e.previous, 0)})` : ''}`
              }))} />
          </section>
        </>
      )}
      <button type="button" onClick={load} disabled={loading} className="btn btn-ghost btn-sm"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh figures</button>
    </div>
  );
};

// ---------------------------------------------------------------------------
interface Expense { id: string; spentOn: string; category: string; description: string; amount: number; paymentMethod: string | null; reference: string | null; createdByName: string | null }
interface ExpensePage { expenses: Expense[]; total: number; sum: number; page: number; limit: number; totalPages: number; categories: string[] }

const ExpensesPanel: React.FC<{ range: { from: string; to: string } }> = ({ range }) => {
  const { can } = useAuth();
  const { showToast } = useToast();
  const canWrite = can('expenses:write');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ExpensePage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ ...range, page: String(page), limit: '25' });
    if (category) qs.set('category', category);
    if (q.trim()) qs.set('search', q.trim());
    try { setData(await api<ExpensePage>(`/api/admin/expenses?${qs}`)); }
    catch (e: any) { setError(e.message || 'Could not load expenses'); }
    finally { setLoading(false); }
  }, [range, category, q, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [range, category, q]);

  const remove = async (e: Expense) => {
    if (!window.confirm(`Delete "${e.description}" (${kes(e.amount)})?`)) return;
    try { await api(`/api/admin/expenses/${e.id}`, { method: 'DELETE' }); showToast('Expense deleted', 'success'); load(); }
    catch (err: any) { showToast(err.message, 'error'); }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description or reference…" className="field-input pl-10" aria-label="Search expenses" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="field-input md:!w-56" aria-label="Category">
          <option value="">All categories</option>{(data?.categories || []).map((c) => <option key={c}>{c}</option>)}
        </select>
        {canWrite && <button type="button" onClick={() => setEditing('new')} className="btn btn-primary shrink-0"><Plus className="w-4 h-4" />Record expense</button>}
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : !data ? <LoadingBlock label="Loading expenses…" /> : data.total === 0 ? (
        <EmptyState title="No expenses in this period" text="Record rent, salaries, utilities and other running costs so profit can be calculated. Stock purchases are not entered here — they are counted through product cost prices." action={canWrite ? <button type="button" onClick={() => setEditing('new')} className="btn btn-primary btn-sm"><Plus className="w-4 h-4" />Record expense</button> : undefined} />
      ) : (
        <div className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <p className="text-sm text-slate-400">Total for the filtered period: <strong className="text-white">{kes(data.sum)}</strong></p>
          <div className="card overflow-hidden">
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="text-right">Amount</th><th>Paid via</th>{canWrite && <th className="text-right">Actions</th>}</tr></thead>
                <tbody>{data.expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-xs">{new Date(`${e.spentOn}T12:00:00+03:00`).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="text-xs whitespace-nowrap">{e.category}</td>
                    <td className="max-w-[20rem]"><div className="truncate text-slate-200" title={e.description}>{e.description}</div>{e.reference && <div className="text-xs text-slate-500 font-mono truncate">{e.reference}</div>}</td>
                    <td className="text-right tabular-nums font-semibold whitespace-nowrap">{kes(e.amount)}</td>
                    <td className="text-xs">{e.paymentMethod || '—'}</td>
                    {canWrite && <td className="text-right whitespace-nowrap">
                      <button type="button" onClick={() => setEditing(e)} className="icon-button" aria-label={`Edit ${e.description}`}><Pencil className="w-4 h-4" /></button>
                      <button type="button" onClick={() => remove(e)} className="icon-button hover:!text-rose-400" aria-label={`Delete ${e.description}`}><Trash2 className="w-4 h-4" /></button>
                    </td>}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} noun="expenses" onPage={setPage} busy={loading} />
        </div>
      )}

      {editing && <ExpenseForm expense={editing === 'new' ? null : editing} categories={data?.categories || []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
};

const ExpenseForm: React.FC<{ expense: Expense | null; categories: string[]; onClose: () => void; onSaved: () => void }> = ({ expense, categories, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    spentOn: expense?.spentOn || today(), category: expense?.category || '', description: expense?.description || '',
    amount: expense ? String(expense.amount) : '', paymentMethod: expense?.paymentMethod || '', reference: expense?.reference || ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const errs: Record<string, string> = {};
    if (!form.spentOn) errs.spentOn = 'Choose the date';
    else if (form.spentOn > today()) errs.spentOn = 'The date cannot be in the future';
    if (!form.category) errs.category = 'Choose a category';
    if (form.description.trim().length < 2) errs.description = 'Describe the expense';
    if (!(Number(form.amount) > 0)) errs.amount = 'Enter an amount greater than zero';
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    setServerError('');
    try {
      await api(expense ? `/api/admin/expenses/${expense.id}` : '/api/admin/expenses', { method: expense ? 'PUT' : 'POST', body: { ...form, amount: Number(form.amount) } });
      showToast(expense ? 'Expense updated' : 'Expense recorded', 'success');
      onSaved();
    } catch (err: any) {
      setServerError(err.message || 'Could not save the expense');
    } finally {
      setSaving(false);
    }
  };
  const fe = (k: string) => (errors[k] ? <p className="field-error">{errors[k]}</p> : null);

  return (
    <Modal size="medium" title={expense ? 'Edit expense' : 'Record expense'} description="Running costs only — stock purchases are counted through product cost prices." onClose={onClose}
      footer={<><button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button><button type="submit" form="expense-form" disabled={saving} className="btn btn-primary"><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save'}</button></>}>
      <form id="expense-form" onSubmit={submit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {serverError && <div className="sm:col-span-2 callout callout-danger" role="alert">{serverError}</div>}
        <Field label="Date" htmlFor="ex-date" required><input id="ex-date" type="date" max={today()} value={form.spentOn} onChange={(e) => set('spentOn', e.target.value)} className={`field-input ${errors.spentOn ? 'field-input-error' : ''}`} />{fe('spentOn')}</Field>
        <Field label="Amount (KES)" htmlFor="ex-amount" required><input id="ex-amount" type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} className={`field-input font-mono ${errors.amount ? 'field-input-error' : ''}`} />{fe('amount')}</Field>
        <Field label="Category" htmlFor="ex-cat" required className="sm:col-span-2">
          <select id="ex-cat" value={form.category} onChange={(e) => set('category', e.target.value)} className={`field-input ${errors.category ? 'field-input-error' : ''}`}><option value="">Choose…</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>{fe('category')}
        </Field>
        <Field label="Description" htmlFor="ex-desc" required className="sm:col-span-2"><input id="ex-desc" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={300} placeholder="e.g. October rent — Princely House" className={`field-input ${errors.description ? 'field-input-error' : ''}`} />{fe('description')}</Field>
        <Field label="Paid via" htmlFor="ex-method"><input id="ex-method" list="ex-methods" value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)} maxLength={60} className="field-input" /><datalist id="ex-methods"><option value="M-Pesa" /><option value="Bank transfer" /><option value="Cash" /><option value="Card" /><option value="Cheque" /></datalist></Field>
        <Field label="Reference" htmlFor="ex-ref" hint="Receipt, invoice or M-Pesa code"><input id="ex-ref" value={form.reference} onChange={(e) => set('reference', e.target.value)} maxLength={100} className="field-input font-mono" /></Field>
      </form>
    </Modal>
  );
};
