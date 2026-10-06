import React, { useState, useEffect } from 'react';
import {
  Search,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Printer,
  ShieldCheck,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { InvoiceModal } from '../components/checkout/InvoiceModal';
import { useStore } from '../context/StoreContext';
import { Order } from '../types';

function deliveryEstimate(order: Order) {
  const isPickup = /pickup/i.test(order.deliveryMethod);
  const method = order.deliveryMethod.toLowerCase();
  const hours = isPickup ? 0.5 : method.includes('cbd') ? 4 : method.includes('suburb') ? 24 : 48;
  const readyAt = new Date(new Date(order.createdAt).getTime() + hours * 60 * 60 * 1000);
  const minutesRemaining = Math.max(0, Math.ceil((readyAt.getTime() - Date.now()) / 60000));
  return isPickup
    ? minutesRemaining > 0 ? `Pickup ready in about ${minutesRemaining} minutes` : "Ready for collection now"
    : `Estimated arrival window: ${order.deliveryMethod} — from ${readyAt.toLocaleString("en-KE")}`;
}

export const TrackOrderPage: React.FC = () => {
  const { formatPrice } = useStore();
  const urlParams = new URLSearchParams(window.location.search);
  const initialOrderNo = urlParams.get('orderNumber') || urlParams.get('order') || '';

  const [searchQuery, setSearchQuery] = useState<string>(initialOrderNo);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isInvoiceOpen, setIsInvoiceOpen] = useState<boolean>(false);

  const fetchOrder = (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');

    fetch(`/api/orders/${encodeURIComponent(query.trim())}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.order) {
          setOrder(data.order);
        } else {
          setOrder(null);
          setError(`No order found matching "${query}". Please verify your order number (e.g. ORD-2026-000101).`);
        }
      })
      .catch(() => {
        setError('Error connecting to tracking service.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (initialOrderNo) {
      fetchOrder(initialOrderNo);
    }
  }, [initialOrderNo]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrder(searchQuery);
  };

  const steps = [
    { title: 'Order Placed', desc: 'Received in system' },
    { title: 'Payment Confirmed', desc: 'M-Pesa / Card verified' },
    { title: 'Order Processed', desc: 'Packed at Kimathi Hub' },
    { title: 'Package Dispatched', desc: 'Handed to courier rider' },
    { title: 'Out for Delivery', desc: 'Arriving at destination' },
    { title: 'Delivered', desc: 'Customer signed receipt' }
  ];

  const getStepStatus = (stepTitle: string) => {
    if (!order) return 'upcoming';
    const timelineEntry = order.timeline.find(t => t.status.toLowerCase().includes(stepTitle.toLowerCase()));
    if (timelineEntry) return 'completed';

    // Current state check
    if (order.status.toLowerCase().includes(stepTitle.toLowerCase())) return 'current';
    return 'upcoming';
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/track-order" />

      {/* Hero Header */}
      <div className="bg-[#070b18] border-b border-slate-800 py-12 px-3 sm:px-4 lg:px-5">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-bold uppercase tracking-wider">
            <Truck className="w-3.5 h-3.5" /> Real-Time Regional Tracking
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Track Your Tech Order Live
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Enter your 6-digit Order Reference (e.g. <strong className="text-cyan-400 font-mono">ORD-2026-000101</strong>) or Customer Phone Number to inspect live dispatch status and courier rider details.
          </p>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2 max-w-lg mx-auto pt-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter Order Number (e.g. ORD-2026-000101)"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 uppercase font-mono focus:outline-none focus:border-cyan-500 shadow-inner"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-2xl flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition-all"
            >
              <Search className="w-4 h-4" />
              <span>Track Order</span>
            </button>
          </form>

          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 max-w-lg mx-auto">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tracking Result View */}
      {order && (
        <main className="flex-1 max-w-4xl mx-auto px-3 sm:px-4 lg:px-5 py-10 w-full space-y-8 animate-in fade-in duration-300">
          {/* Status Header Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-white font-mono">{order.orderNumber}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 font-bold text-xs border border-cyan-800">
                  {order.status}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-bold text-xs border border-emerald-800">
                  {order.paymentStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Ordered on {new Date(order.createdAt).toLocaleDateString()} • Payment Ref: <strong className="text-white font-mono">{order.paymentReference || 'Pending'}</strong>
              </p>
            </div>

            {!order.limited && <button
              type="button"
              onClick={() => setIsInvoiceOpen(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>View Invoice</span>
            </button>}
          </div>

          {/* Step Fulfillment Timeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <h3 className="text-base font-bold text-white">Live Fulfillment Timeline</h3>

            <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {order.timeline.map((entry, idx) => (
                <div key={idx} className="relative group">
                  {/* Step Bullet */}
                  <div className="absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-lg ring-4 ring-slate-900">
                    ✓
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                      <span className="font-bold text-white text-sm">{entry.status}</span>
                      <span className="text-slate-400 font-mono text-[11px]">{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                      {entry.note}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pickup location & delivery estimate */}
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white">Pickup point & delivery estimate</h3>
                <p className="text-xs text-slate-400 mt-1">Your order is prepared and dispatched from our Nairobi pickup hub.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                <Clock className="w-4 h-4" /> {deliveryEstimate(order)}
              </span>
            </div>
            <div className="rounded-2xl overflow-hidden border border-slate-700 bg-slate-950">
              <iframe
                title="Internext pickup location map"
                src="https://www.openstreetmap.org/export/embed.html?bbox=36.806%2C-1.296%2C36.83%2C-1.275&layer=mapnik&marker=-1.2864%2C36.8172"
                className="w-full h-64 border-0"
                loading="lazy"
              />
            </div>
            <div className="flex items-start gap-2 text-xs text-slate-300">
              <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span><strong className="text-white">Pickup hub:</strong> Princely House, Moi Avenue, Nairobi. We will update the timeline when your courier is dispatched.</span>
            </div>
          </section>

          {/* Items & Destination Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="font-bold text-white text-sm">Delivery Destination:</h4>
              <div className="text-slate-300 space-y-1">
                {order.deliveryAddress?.building && <div>{order.deliveryAddress.building}</div>}
                {order.deliveryAddress?.street && <div>{order.deliveryAddress.street}</div>}
                <div className="font-bold text-white">{order.deliveryAddress.town}, {order.deliveryAddress.county}</div>
              </div>
              <div className="text-cyan-400 font-semibold pt-2 border-t border-slate-800">
                Method: {order.deliveryMethod}
              </div>
            </div>

            {order.limited ? (
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="font-bold text-white text-sm">Order contents</h4>
              <p className="text-slate-300">{order.itemCount} item(s). Sign in as the account that placed this order to see items, totals and invoices.</p>
              <a href={`/auth?redirect=${encodeURIComponent(`/order-confirmation?orderNumber=${order.orderNumber}`)}`} className="btn btn-secondary btn-sm">Sign in for full details</a>
            </div>
            ) : (
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
              <h4 className="font-bold text-white text-sm">Order Items ({order.items.length}):</h4>
              <div className="divide-y divide-slate-800">
                {order.items.map((it, idx) => (
                  <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between">
                    <div className="font-semibold text-white truncate max-w-[200px]">{it.name}</div>
                    <div className="text-emerald-400 font-bold">{formatPrice(it.price * it.quantity)}</div>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between font-black text-sm text-white">
                <span>Total:</span>
                <span className="text-cyan-400">{formatPrice(order.total)}</span>
              </div>
            </div>
            )}
          </div>
        </main>
      )}

      {/* Invoice Modal */}
      {isInvoiceOpen && order && !order.limited && (
        <InvoiceModal order={order} onClose={() => setIsInvoiceOpen(false)} />
      )}

      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};
