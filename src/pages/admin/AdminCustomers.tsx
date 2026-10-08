import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Users, Search, Mail, Phone, MapPin, ShoppingBag, CreditCard, LifeBuoy, Power, BadgeCheck, AlertTriangle, ReceiptText, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { InvoiceModal } from '../../components/checkout/InvoiceModal';
import { Order } from '../../types';
import {
  api, PageHeader, Pagination, Drawer, StatTile, EmptyState, ErrorState, LoadingBlock, StatusBadge, useDebounced, kes, kesCompact, fmtDateTime
} from './adminUi';

// Customers are listed, searched, filtered, sorted and paged on the server
// (GET /api/admin/customers); a row opens the full profile in a drawer.

interface CustomerRow {
  id: string; name: string; email: string; phone: string | null; isActive: boolean; emailVerifiedAt: string | null;
  county: string | null; town: string | null; createdAt: string;
  orderCount: number; paidCount: number; totalSpent: number; outstanding: number; lastOrderAt: string | null;
}
interface ListResponse {
  customers: CustomerRow[]; total: number; page: number; limit: number; totalPages: number;
  summary: { customers: number; active: number; newThisMonth: number; buyers: number; repeat: number };
}

const phoneDisplay = (p?: string | null) => (p ? (p.startsWith('254') ? `0${p.slice(3, 6)} ${p.slice(6, 9)} ${p.slice(9)}` : p) : '—');
const shortDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export const AdminCustomers: React.FC<{ onNavigate?: (tab: string, params?: Record<string, string>) => void }> = () => {
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [status, setStatus] = useState('');
  const [activity, setActivity] = useState('');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ page: String(page), limit: String(limit), sort });
    if (q.trim()) qs.set('search', q.trim());
    if (status) qs.set('status', status);
    if (activity) qs.set('activity', activity);
    if (registeredFrom) qs.set('registeredFrom', registeredFrom);
    if (registeredTo) qs.set('registeredTo', registeredTo);
    try {
      const res = await api<ListResponse>(`/api/admin/customers?${qs}`);
      if (mine === seq.current) setData(res);
    } catch (e: any) {
      if (mine === seq.current) setError(e.message || 'Could not load customers');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [q, status, activity, registeredFrom, registeredTo, sort, page, limit]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, status, activity, registeredFrom, registeredTo, sort, limit]);

  const filtersActive = !!(q || status || activity || registeredFrom || registeredTo);
  const clear = () => { setSearch(''); setStatus(''); setActivity(''); setRegisteredFrom(''); setRegisteredTo(''); };
  const s = data?.summary;

  return (
    <div className="space-y-5 animate-fadeInUp">
      <PageHeader icon={Users} title="Customers" description="Every registered customer, with their orders and payments. Click a customer for the full profile." />

      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatTile label="Customers" value={s.customers.toLocaleString()} hint={`${s.active.toLocaleString()} active`} />
          <StatTile label="New this month" value={s.newThisMonth.toLocaleString()} />
          <StatTile label="Have bought" value={s.buyers.toLocaleString()} hint={s.customers ? `${Math.round((s.buyers / s.customers) * 100)}% of customers` : undefined} onClick={() => setActivity('buyers')} />
          <StatTile label="Repeat buyers" value={s.repeat.toLocaleString()} hint={s.buyers ? `${Math.round((s.repeat / s.buyers) * 100)}% of buyers` : undefined} onClick={() => setActivity('repeat')} />
          <StatTile label="Never ordered" value={(s.customers - s.buyers).toLocaleString()} onClick={() => setActivity('no-orders')} />
        </div>
      )}

      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or phone…" className="field-input pl-10" aria-label="Search customers" />
          </div>
          <select value={activity} onChange={(e) => setActivity(e.target.value)} className="field-input md:col-span-2" aria-label="Purchase history">
            <option value="">All purchase history</option><option value="buyers">Have bought</option><option value="repeat">Repeat buyers</option><option value="no-orders">Never ordered</option><option value="owing">Owe money</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="field-input md:col-span-2" aria-label="Account status">
            <option value="">Any status</option><option value="active">Active</option><option value="inactive">Deactivated</option><option value="unverified">Email not verified</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="field-input md:col-span-4" aria-label="Sort by">
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option>
            <option value="spent">Highest spend</option><option value="orders">Most orders</option><option value="last-order">Most recent order</option>
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">Registered from<input type="date" value={registeredFrom} max={registeredTo || undefined} onChange={(e) => setRegisteredFrom(e.target.value)} className="field-input mt-1 !py-1.5" /></label>
          <label className="text-xs text-slate-400">to<input type="date" value={registeredTo} min={registeredFrom || undefined} onChange={(e) => setRegisteredTo(e.target.value)} className="field-input mt-1 !py-1.5" /></label>
          {filtersActive && <button type="button" onClick={clear} className="btn btn-ghost btn-sm text-cyan-400 ml-auto">Clear filters</button>}
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : !data ? <LoadingBlock label="Loading customers…" /> : data.total === 0 ? (
        <EmptyState title={filtersActive ? 'No customers match these filters' : 'No customers yet'} text={filtersActive ? 'Try a different search or clear the filters.' : 'Customers appear here as soon as they register.'} action={filtersActive ? <button type="button" onClick={clear} className="btn btn-secondary btn-sm">Clear filters</button> : undefined} />
      ) : (
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          <ul className="md:hidden space-y-3">
            {data.customers.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setOpenId(c.id)} className="card p-4 w-full text-left space-y-1">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold text-white truncate">{c.name}</span>{!c.isActive && <span className="badge badge-neutral">Deactivated</span>}</div>
                  <div className="text-xs text-slate-400 truncate">{c.email} · {phoneDisplay(c.phone)}</div>
                  <div className="text-xs text-slate-300">{c.paidCount} paid order{c.paidCount === 1 ? '' : 's'} · <strong className="text-white">{kes(c.totalSpent)}</strong>{c.outstanding > 0 && <span className="text-amber-400"> · owes {kes(c.outstanding)}</span>}</div>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden md:block card overflow-hidden">
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Customer</th><th>Contact</th><th>Location</th><th className="text-right">Orders</th><th className="text-right">Total spent</th><th>Last order</th><th>Status</th></tr></thead>
                <tbody>
                  {data.customers.map((c) => (
                    <tr key={c.id} onClick={() => setOpenId(c.id)} className="cursor-pointer" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(c.id); }}>
                      <td className="max-w-[16rem]"><div className="font-semibold text-white truncate">{c.name}</div><div className="text-xs text-slate-500">Joined {shortDate(c.createdAt)}</div></td>
                      <td className="max-w-[16rem] text-xs"><div className="truncate text-slate-200" title={c.email}>{c.email}</div><div className="text-slate-500 font-mono">{phoneDisplay(c.phone)}</div></td>
                      <td className="text-xs text-slate-300">{[c.town, c.county].filter(Boolean).join(', ') || '—'}</td>
                      <td className="text-right tabular-nums">{c.paidCount}<span className="text-slate-500">/{c.orderCount}</span></td>
                      <td className="text-right tabular-nums whitespace-nowrap"><div className="font-semibold text-white">{kes(c.totalSpent)}</div>{c.outstanding > 0 && <div className="text-xs text-amber-400">owes {kes(c.outstanding)}</div>}</td>
                      <td className="text-xs whitespace-nowrap">{shortDate(c.lastOrderAt)}</td>
                      <td><div className="flex flex-wrap gap-1">{c.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-neutral">Deactivated</span>}{!c.emailVerifiedAt && <span className="badge badge-warning">Unverified</span>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={limit} noun="customers" onPage={setPage} onLimit={setLimit} busy={loading} />
        </div>
      )}

      {openId && <CustomerDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
interface Detail {
  customer: { id: string; name: string; email: string; phone: string | null; isActive: boolean; emailVerifiedAt: string | null; avatar: string | null; createdAt: string; location: { county: string; town: string; addressLine: string | null } | null };
  stats: { orderCount: number; paidCount: number; totalSpent: number; outstanding: number; refunded: number; cancelled: number; firstOrderAt: string | null; lastOrderAt: string | null; averageOrderValue: number; reviews: number; avgRating: number; referred: number; qualified: number };
  orders: { id: string; orderNumber: string; createdAt: string; paidAt: string | null; total: number; status: string; paymentStatus: string; paymentMethod: string | null; itemCount: number }[];
  payments: { id: string; orderNumber: string; provider: string; status: string; amount: number; reference: string | null; failureReason: string | null; createdAt: string }[];
  receipts: { id: string; receiptNumber: string; orderId: string; orderNumber: string; amount: number; paymentMethod: string | null; issuedAt: string }[];
  tickets: { id: string; ticketNumber: string; subject: string; status: string; updatedAt: string }[];
}

const PROVIDER_LABEL: Record<string, string> = { mpesa: 'M-Pesa', stripe: 'Card', bank_transfer: 'Bank transfer', cash_on_delivery: 'Pay on delivery' };
const TABS = [['orders', 'Orders', ShoppingBag], ['payments', 'Payments', CreditCard], ['support', 'Support', LifeBuoy]] as const;

const CustomerDrawer: React.FC<{ id: string; onClose: () => void; onChanged: () => void }> = ({ id, onClose, onChanged }) => {
  const { can } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('orders');
  const [invoice, setInvoice] = useState<Order | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => { setError(''); api<Detail>(`/api/admin/customers/${id}`).then(setData).catch((e) => setError(e.message || 'Could not load customer')); };
  useEffect(() => { setData(null); load(); }, [id]);

  // Order -> full order (items, totals) in the invoice view.
  const openOrder = async (orderId: string) => {
    setOpening(orderId);
    try {
      const res = await api<{ order: Order }>(`/api/orders/${orderId}`);
      setInvoice(res.order);
    } catch (e: any) {
      showToast(e.message || 'Could not open the order', 'error');
    } finally {
      setOpening(null);
    }
  };

  const toggleActive = async () => {
    if (!data) return;
    const next = !data.customer.isActive;
    if (!next && !window.confirm(`Deactivate ${data.customer.name}? They will be signed out everywhere and unable to sign in. Their orders and history are kept.`)) return;
    setBusy(true);
    try {
      await api(`/api/admin/customers/${id}/status`, { method: 'PATCH', body: { isActive: next } });
      showToast(next ? 'Account reactivated' : 'Account deactivated and signed out', 'success');
      load();
      onChanged();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const c = data?.customer;
  const st = data?.stats;

  return (
    <>
      <Drawer
        width="xl"
        title={c?.name || 'Customer'}
        subtitle={c && <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">ID {c.id.slice(0, 8)}</span>
          {c.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-neutral">Deactivated</span>}
          {c.emailVerifiedAt ? <span className="badge badge-success"><BadgeCheck className="w-3 h-3" />Email verified</span> : <span className="badge badge-warning"><AlertTriangle className="w-3 h-3" />Email not verified</span>}
        </span>}
        onClose={onClose}
        footer={c && <>
          {can('users:deactivate') && <button type="button" onClick={toggleActive} disabled={busy} className={`btn ${c.isActive ? 'btn-danger' : 'btn-secondary'} sm:mr-auto`}><Power className="w-4 h-4" />{c.isActive ? 'Deactivate account' : 'Reactivate account'}</button>}
          <a href={`mailto:${c.email}`} className="btn btn-secondary"><Mail className="w-4 h-4" />Email</a>
          {c.phone && <a href={`tel:+${c.phone}`} className="btn btn-secondary"><Phone className="w-4 h-4" />Call</a>}
        </>}
      >
        {error ? <ErrorState message={error} onRetry={load} /> : !data || !c || !st ? <LoadingBlock label="Loading profile…" /> : (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-4 space-y-2 text-sm md:col-span-1">
                <h4 className="eyebrow">Contact</h4>
                <div className="flex items-center gap-2 min-w-0"><Mail className="w-4 h-4 text-slate-500 shrink-0" /><a href={`mailto:${c.email}`} className="text-slate-200 hover:text-cyan-400 truncate">{c.email}</a></div>
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-500 shrink-0" /><span className="font-mono text-slate-200">{phoneDisplay(c.phone)}</span></div>
                <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" /><span className="text-slate-300">{c.location ? [c.location.addressLine, c.location.town, c.location.county].filter(Boolean).join(', ') : 'No delivery location saved'}</span></div>
                <p className="text-xs text-slate-500 pt-1">Customer since {shortDate(c.createdAt)}</p>
              </div>
              <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-3 gap-3">
                <StatTile label="Total spent" value={kesCompact(st.totalSpent)} hint={`${st.paidCount} paid order${st.paidCount === 1 ? '' : 's'}`} />
                <StatTile label="Average order" value={kesCompact(st.averageOrderValue)} />
                <StatTile label="Outstanding" value={kesCompact(st.outstanding)} tone={st.outstanding > 0 ? 'warning' : 'default'} hint="Unpaid open orders" />
                <StatTile label="Orders placed" value={st.orderCount} hint={st.cancelled ? `${st.cancelled} cancelled` : undefined} />
                <StatTile label="Last order" value={st.lastOrderAt ? shortDate(st.lastOrderAt) : '—'} hint={st.firstOrderAt ? `First: ${shortDate(st.firstOrderAt)}` : 'No orders yet'} />
                <StatTile label="Reviews · referrals" value={`${st.reviews} · ${st.referred}`} hint={st.reviews ? `Avg rating ${st.avgRating.toFixed(1)}★` : undefined} />
              </div>
            </section>

            <div role="tablist" aria-label="Customer history" className="flex gap-1 border-b border-slate-800">
              {TABS.map(([key, label, Icon]) => (
                <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px flex items-center gap-1.5 ${tab === key ? 'border-cyan-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                  <Icon className="w-4 h-4" />{label}<span className="text-xs text-slate-500">{key === 'orders' ? data.orders.length : key === 'payments' ? data.payments.length : data.tickets.length}</span>
                </button>
              ))}
            </div>

            {tab === 'orders' && (data.orders.length === 0 ? <p className="text-sm text-slate-400">No orders yet.</p> : (
              <div className="table-scroll rounded-xl border border-slate-800">
                <table className="data-table">
                  <thead><tr><th>Order</th><th>Date</th><th className="text-right">Items</th><th className="text-right">Total</th><th>Payment</th><th>Status</th></tr></thead>
                  <tbody>{data.orders.map((o) => (
                    <tr key={o.id} onClick={() => openOrder(o.id)} className="cursor-pointer">
                      <td className="font-mono text-xs text-cyan-400 whitespace-nowrap">{opening === o.id && <Loader2 className="w-3 h-3 animate-spin inline mr-1" />}{o.orderNumber}</td>
                      <td className="text-xs whitespace-nowrap">{shortDate(o.createdAt)}</td>
                      <td className="text-right tabular-nums">{o.itemCount}</td>
                      <td className="text-right tabular-nums whitespace-nowrap font-semibold">{kes(o.total)}</td>
                      <td className="text-xs"><div>{o.paymentMethod || '—'}</div><div className={o.paymentStatus === 'Paid' ? 'text-emerald-400' : 'text-amber-400'}>{o.paymentStatus}</div></td>
                      <td className="text-xs">{o.status}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ))}

            {tab === 'payments' && (
              <div className="space-y-5">
                <div>
                  <h4 className="eyebrow mb-2 flex items-center gap-1.5"><ReceiptText className="w-3.5 h-3.5" />Receipts (confirmed payments)</h4>
                  {data.receipts.length === 0 ? <p className="text-sm text-slate-400">No confirmed payments yet.</p> : (
                    <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
                      {data.receipts.map((r) => (
                        <li key={r.id} className="p-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <span className="font-mono text-xs text-slate-300">{r.receiptNumber}</span>
                          <button type="button" onClick={() => openOrder(r.orderId)} className="font-mono text-xs text-cyan-400 hover:underline">{r.orderNumber}</button>
                          <span className="text-xs text-slate-400">{r.paymentMethod}</span>
                          <span className="text-xs text-slate-500">{fmtDateTime(r.issuedAt)}</span>
                          <span className="ml-auto tabular-nums font-semibold text-white">{kes(r.amount)}</span>
                          <a href={`/api/orders/${r.orderId}/receipt.pdf`} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:underline">PDF</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4 className="eyebrow mb-2">All payment attempts</h4>
                  {data.payments.length === 0 ? <p className="text-sm text-slate-400">No payment attempts.</p> : (
                    <div className="table-scroll rounded-xl border border-slate-800">
                      <table className="data-table">
                        <thead><tr><th>Date</th><th>Order</th><th>Method</th><th className="text-right">Amount</th><th>Reference</th><th>Result</th></tr></thead>
                        <tbody>{data.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="text-xs whitespace-nowrap">{fmtDateTime(p.createdAt)}</td>
                            <td className="font-mono text-xs">{p.orderNumber}</td>
                            <td className="text-xs">{PROVIDER_LABEL[p.provider] || p.provider}</td>
                            <td className="text-right tabular-nums">{kes(p.amount)}</td>
                            <td className="font-mono text-xs break-all">{p.reference || '—'}</td>
                            <td><StatusBadge state={p.status} />{p.failureReason && <div className="text-xs text-slate-400 mt-1 max-w-[14rem]">{p.failureReason}</div>}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'support' && (data.tickets.length === 0 ? <p className="text-sm text-slate-400">No support tickets.</p> : (
              <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
                {data.tickets.map((t) => (
                  <li key={t.id} className="p-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-mono text-xs text-cyan-400">{t.ticketNumber}</span>
                    <span className="text-slate-200 min-w-0 flex-1 truncate">{t.subject}</span>
                    <span className="badge badge-neutral">{t.status}</span>
                    <span className="text-xs text-slate-500">{shortDate(t.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            ))}
          </>
        )}
      </Drawer>
      {invoice && <InvoiceModal order={invoice} onClose={() => setInvoice(null)} />}
    </>
  );
};
