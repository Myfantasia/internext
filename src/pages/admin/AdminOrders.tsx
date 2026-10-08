import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShoppingCart, Search, Printer, ExternalLink } from 'lucide-react';
import { InvoiceModal } from '../../components/checkout/InvoiceModal';
import { useToast } from '../../context/ToastContext';
import { Order } from '../../types';
import { api, Modal, Field, kes, PageHeader, Pagination, EmptyState, ErrorState, LoadingBlock, useDebounced } from './adminUi';

const ORDER_STATUSES = ['Pending', 'Payment Pending', 'Processing', 'Packed', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded'];

const METHODS = [
  { id: 'cash', label: 'Cash', needsRef: false },
  { id: 'mpesa', label: 'M-Pesa (till / paybill)', needsRef: true },
  { id: 'card', label: 'Card (POS machine)', needsRef: true },
  { id: 'bank', label: 'Bank deposit / transfer', needsRef: true }
];

// Records money taken in person (pay on delivery, counter, or a bank deposit
// seen on the statement). The server confirms it once and issues the receipt.
const RecordPaymentModal: React.FC<{ order: Order; onClose: () => void; onDone: () => void }> = ({ order, onClose, onDone }) => {
  const { showToast } = useToast();
  const isBank = order.paymentMethod === 'Bank Transfer / RTGS';
  const [method, setMethod] = useState(isBank ? 'bank' : 'cash');
  const [amount, setAmount] = useState(String(order.total));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const needsRef = METHODS.find((m) => m.id === method)?.needsRef;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsRef && !reference.trim()) { showToast('Enter the transaction reference', 'error'); return; }
    setBusy(true);
    try {
      await api(`/api/payments/orders/${order.id}/record`, { method: 'POST', body: { method, amount: Number(amount), reference: reference.trim() || undefined, note: note.trim() || undefined } });
      showToast(`Payment recorded for ${order.orderNumber}. Receipt issued and emailed.`, 'success');
      onDone();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      size="medium"
      title={`Record payment · ${order.orderNumber}`}
      description={`${order.customer.name} · ${order.paymentMethod} · total ${kes(order.total)}`}
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" form="record-payment" disabled={busy} className="btn btn-primary">{busy ? 'Recording…' : 'Record payment & issue receipt'}</button>
      </>}
    >
      <form id="record-payment" onSubmit={submit} className="space-y-4">
        <Field label="How was it paid?" htmlFor="rp-method" required>
          <select id="rp-method" value={method} onChange={(e) => setMethod(e.target.value)} className="field-input">
            {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Amount received (KES)" htmlFor="rp-amount" required hint="Must cover the full order total.">
            <input id="rp-amount" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="field-input" required />
          </Field>
          <Field label={needsRef ? 'Transaction reference' : 'Reference (optional)'} htmlFor="rp-ref" required={needsRef} hint={method === 'mpesa' ? 'The M-Pesa code, e.g. SJK3H2L9QX' : method === 'card' ? 'POS slip / approval code' : method === 'bank' ? 'Reference on the bank statement' : 'Leave empty for cash'}>
            <input id="rp-ref" value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} className="field-input font-mono" maxLength={60} />
          </Field>
        </div>
        <Field label="Note (optional)" htmlFor="rp-note">
          <input id="rp-note" value={note} onChange={(e) => setNote(e.target.value)} className="field-input" maxLength={300} placeholder="e.g. Collected by rider Peter at the door" />
        </Field>
        {isBank && <p className="callout callout-info">If the customer reported this transfer, approve it under Payments → Bank transfers to verify instead.</p>}
      </form>
    </Modal>
  );
};

const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed', 'Pending (Cash On Delivery)', 'Refunded', 'Cancelled'];
const PAYMENT_METHODS = ['M-Pesa STK Push', 'Card (Visa / Mastercard)', 'Bank Transfer / RTGS', 'Cash on Delivery'];

interface OrdersPage { orders: Order[]; total: number; page: number; limit: number; totalPages: number; statusCounts: Record<string, number> }

// Orders are paged, searched, filtered and sorted on the server (GET /api/orders).
export const AdminOrders: React.FC = () => {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [data, setData] = useState<OrdersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const seq = useRef(0);

  const fetchOrders = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ page: String(page), limit: String(limit), sort });
    if (q.trim()) qs.set('search', q.trim());
    if (status) qs.set('status', status);
    if (paymentStatus) qs.set('paymentStatus', paymentStatus);
    if (paymentMethod) qs.set('paymentMethod', paymentMethod);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    try {
      const res = await api<OrdersPage>(`/api/orders?${qs}`);
      if (mine === seq.current) setData(res);
    } catch (e: any) {
      if (mine === seq.current) setError(e.message || 'Could not load orders');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [q, status, paymentStatus, paymentMethod, from, to, sort, page, limit]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { setPage(1); }, [q, status, paymentStatus, paymentMethod, from, to, sort, limit]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      await api(`/api/orders/${orderId}/status`, { method: 'PUT', body: { status: newStatus, note: `Status changed to ${newStatus}` } });
      showToast(`Order status updated to ${newStatus}`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Could not update the status', 'error');
    }
    fetchOrders();
  };

  const counts = data?.statusCounts || {};
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const tabs = ['', 'Payment Pending', 'Processing', 'Packed', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled'];
  const filtersActive = !!(q || status || paymentStatus || paymentMethod || from || to);
  const clear = () => { setSearch(''); setStatus(''); setPaymentStatus(''); setPaymentMethod(''); setFrom(''); setTo(''); };
  const payBadge = (o: Order) => <span className={`badge ${o.paymentStatus === 'Paid' ? 'badge-success' : o.paymentStatus === 'Refunded' ? 'badge-info' : o.paymentStatus === 'Cancelled' || o.paymentStatus === 'Failed' ? 'badge-danger' : 'badge-warning'}`}>{o.paymentStatus}</span>;
  const statusSelect = (o: Order) => (
    <select value={o.status} onClick={(e) => e.stopPropagation()} onChange={(e) => handleUpdateStatus(o.id, e.target.value)} className="field-input !py-1.5 !w-auto text-sm" aria-label={`Status of ${o.orderNumber}`}>
      {ORDER_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
    </select>
  );
  const actions = (o: Order) => (
    <div className="flex items-center justify-end gap-1">
      {o.paymentStatus !== 'Paid' && o.status !== 'Cancelled' && <button type="button" onClick={() => setPayingOrder(o)} className="btn btn-sm btn-ghost text-emerald-400">Record payment</button>}
      <button type="button" onClick={() => setSelectedInvoiceOrder(o)} className="icon-button" title="Invoice" aria-label={`Invoice for ${o.orderNumber}`}><Printer className="w-4 h-4" /></button>
      <a href={`/track-order?order=${encodeURIComponent(o.orderNumber)}`} target="_blank" rel="noreferrer" className="icon-button" title="Tracking page" aria-label={`Tracking for ${o.orderNumber}`}><ExternalLink className="w-4 h-4" /></a>
    </div>
  );

  return (
    <div className="space-y-5 animate-fadeInUp">
      <PageHeader icon={ShoppingCart} title="Orders" description="Search, filter and update orders. Bank-transfer orders can only be packed once the transfer is verified under Payments." />

      <div className="card p-4 space-y-3">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1" role="tablist" aria-label="Order status">
          {tabs.map((t) => (
            <button key={t || 'all'} type="button" role="tab" aria-selected={status === t} onClick={() => setStatus(t)} className={`btn btn-sm shrink-0 ${status === t ? 'btn-primary' : 'btn-ghost'}`}>
              {t || 'All'}<span className="opacity-70 tabular-nums">{t ? counts[t] || 0 : allCount}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order no., customer, phone or payment ref…" className="field-input pl-10" aria-label="Search orders" />
          </div>
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="field-input md:col-span-3" aria-label="Payment status">
            <option value="">Any payment status</option>{PAYMENT_STATUSES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="field-input md:col-span-3" aria-label="Payment method">
            <option value="">Any payment method</option>{PAYMENT_METHODS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="field-input md:col-span-2" aria-label="Sort">
            <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="total-desc">Highest total</option><option value="total-asc">Lowest total</option>
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">Placed from<input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="field-input mt-1 !py-1.5" /></label>
          <label className="text-xs text-slate-400">to<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="field-input mt-1 !py-1.5" /></label>
          {filtersActive && <button type="button" onClick={clear} className="btn btn-ghost btn-sm text-cyan-400 ml-auto">Clear filters</button>}
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={fetchOrders} /> : !data ? <LoadingBlock label="Loading orders…" /> : data.total === 0 ? (
        <EmptyState title={filtersActive ? 'No orders match these filters' : 'No orders yet'} text={filtersActive ? 'Try a different search or clear the filters.' : 'New orders appear here as soon as customers check out.'} action={filtersActive ? <button type="button" onClick={clear} className="btn btn-secondary btn-sm">Clear filters</button> : undefined} />
      ) : (
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          <ul className="md:hidden space-y-3">
            {data.orders.map((o) => (
              <li key={o.id} className="card p-4 space-y-2">
                <div className="flex items-center justify-between gap-2"><span className="font-mono text-sm font-bold text-cyan-400">{o.orderNumber}</span><span className="font-bold text-white tabular-nums">{kes(o.total)}</span></div>
                <div className="text-sm text-slate-200 truncate">{o.customer.name}</div>
                <div className="text-xs text-slate-400">{new Date(o.createdAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })} · {o.items.length} item{o.items.length === 1 ? '' : 's'}</div>
                <div className="flex flex-wrap items-center gap-2">{payBadge(o)}<span className="text-xs text-slate-400">{o.paymentMethod}</span></div>
                <div className="flex flex-wrap items-center justify-between gap-2">{statusSelect(o)}{actions(o)}</div>
              </li>
            ))}
          </ul>
          <div className="hidden md:block card overflow-hidden">
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Order</th><th>Customer</th><th className="text-right">Total</th><th>Payment</th><th>Fulfilment</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id}>
                      <td className="whitespace-nowrap"><div className="font-mono font-bold text-cyan-400">{o.orderNumber}</div><div className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</div></td>
                      <td className="max-w-[16rem]"><div className="font-semibold text-white truncate">{o.customer.name}</div><div className="text-xs text-slate-500 font-mono truncate">{o.customer.phone}</div><div className="text-xs text-slate-400 truncate">{o.deliveryAddress?.pickup ? 'Store pickup' : [o.deliveryAddress?.town, o.deliveryAddress?.county].filter(Boolean).join(', ')}</div></td>
                      <td className="text-right whitespace-nowrap tabular-nums"><div className="font-semibold text-white">{kes(o.total)}</div><div className="text-xs text-slate-500">{o.items.length} item{o.items.length === 1 ? '' : 's'}</div></td>
                      <td><div className="space-y-1">{payBadge(o)}<div className="text-xs text-slate-400">{o.paymentMethod}</div>{o.paymentReference && <div className="text-[11px] text-slate-500 font-mono break-all">Ref {o.paymentReference}</div>}</div></td>
                      <td>{statusSelect(o)}{o.paymentMethod === 'Bank Transfer / RTGS' && o.paymentStatus !== 'Paid' && o.status !== 'Cancelled' && <div className="text-[11px] text-amber-400 mt-1">Ships after the transfer is verified</div>}</td>
                      <td className="text-right">{actions(o)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={limit} noun="orders" onPage={setPage} onLimit={setLimit} busy={loading} />
        </div>
      )}

      {payingOrder && (
        <RecordPaymentModal order={payingOrder} onClose={() => setPayingOrder(null)} onDone={() => { setPayingOrder(null); fetchOrders(); }} />
      )}
      {selectedInvoiceOrder && (
        <InvoiceModal order={selectedInvoiceOrder} onClose={() => setSelectedInvoiceOrder(null)} />
      )}
    </div>
  );
};
