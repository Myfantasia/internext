import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Search,
  Printer,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  ChevronRight,
  Filter,
  Zap,
  Edit2
} from 'lucide-react';
import { InvoiceModal } from '../../components/checkout/InvoiceModal';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { Order } from '../../types';
import { api, Modal, Field, kes } from './adminUi';

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

export const AdminOrders: React.FC = () => {
  const { formatPrice } = useStore();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);

  const fetchOrders = () => {
    setLoading(true);
    fetch('/api/orders')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) setOrders(data.orders || []);
        else showToast(data?.message || 'Could not load orders', 'error');
      })
      .catch(() => showToast('Could not reach the server to load orders', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (orderId: string, newStatus: string, note?: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          note: note || `Order status transitioned to ${newStatus} by Staff Specialist`
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Order status updated to ${newStatus}`, 'success');
      } else {
        showToast(data.message || 'Could not update the status', 'error');
      }
      fetchOrders();
    } catch (e) {
      showToast('Error updating status', 'error');
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filterStatus !== 'All' && o.status !== filterStatus) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.phone.includes(q) ||
        (o.paymentReference && o.paymentReference.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Order Management & Fulfillment Queue</h2>
          <p className="text-xs text-slate-400">Process dispatch status, verify M-Pesa receipts, and generate invoices</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-cyan-400 font-bold">
            {orders.length} Total Orders
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 sm:pb-0">
          {['All', 'Payment Pending', 'Processing', 'Packed', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                filterStatus === st
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search order number or phone..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3.5">Order Ref</th>
                <th className="p-3.5">Customer & Contact</th>
                <th className="p-3.5">Items & Amount</th>
                <th className="p-3.5">Payment</th>
                <th className="p-3.5">Fulfillment Stage</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredOrders.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 align-top">
                    <div className="font-mono font-bold text-cyan-400">{ord.orderNumber}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{new Date(ord.createdAt).toLocaleDateString()}</div>
                  </td>

                  <td className="p-3.5 align-top">
                    <div className="font-bold text-white">{ord.customer.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{ord.customer.phone}</div>
                    <div className="text-[11px] text-cyan-300 mt-0.5">{ord.deliveryAddress.town}, {ord.deliveryAddress.county}</div>
                  </td>

                  <td className="p-3.5 align-top">
                    <div className="font-black text-white font-mono">{formatPrice(ord.total)}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{ord.items.length} items ({ord.deliveryMethod})</div>
                  </td>

                  <td className="p-3.5 align-top">
                    <div className="space-y-1">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          ord.paymentStatus === 'Paid'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {ord.paymentStatus}
                      </span>
                      {ord.paymentReference && (
                        <div className="text-[10px] text-slate-400 font-mono">Ref: {ord.paymentReference}</div>
                      )}
                      {ord.paymentStatus !== 'Paid' && ord.status !== 'Cancelled' && (
                        <button
                          type="button"
                          onClick={() => setPayingOrder(ord)}
                          className="block text-[10px] text-emerald-400 hover:underline font-bold"
                        >
                          + Record payment
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="p-3.5 align-top">
                    <select
                      value={ord.status}
                      onChange={(e) => handleUpdateStatus(ord.id, e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white font-bold cursor-pointer focus:border-cyan-500"
                    >
                      {ORDER_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                    {ord.paymentMethod === 'Bank Transfer / RTGS' && ord.paymentStatus !== 'Paid' && ord.status !== 'Cancelled' && (
                      <div className="text-[10px] text-amber-400 mt-1">Ships after the transfer is verified</div>
                    )}
                  </td>

                  <td className="p-3.5 text-right align-top">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceOrder(ord)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Invoice</span>
                      </button>

                      <a
                        href={`/track-order?orderNumber=${ord.orderNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-800 text-cyan-400 hover:bg-slate-700"
                        title="Live Tracking Link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {payingOrder && (
        <RecordPaymentModal order={payingOrder} onClose={() => setPayingOrder(null)} onDone={() => { setPayingOrder(null); fetchOrders(); }} />
      )}

      {/* Printable Invoice Modal */}
      {selectedInvoiceOrder && (
        <InvoiceModal order={selectedInvoiceOrder} onClose={() => setSelectedInvoiceOrder(null)} />
      )}
    </div>
  );
};
