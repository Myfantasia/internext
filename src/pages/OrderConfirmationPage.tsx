import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2, Clock, XCircle, ReceiptText, FileText, Truck, Smartphone, CreditCard, Loader2, AlertCircle, Store, Ban
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { MpesaModal } from '../components/checkout/MpesaModal';
import { OfflinePaymentPanel } from '../components/checkout/OfflinePaymentPanel';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { Order } from '../types';

const ONLINE = ['M-Pesa STK Push', 'Card (Visa / Mastercard)'];

type View = 'paid' | 'awaiting' | 'failed' | 'cancelled' | 'offline';

function viewFor(order: Order): View {
  if (order.paymentStatus === 'Paid') return 'paid';
  if (order.status === 'Cancelled') return 'cancelled';
  if (!ONLINE.includes(order.paymentMethod)) return 'offline';
  if (order.paymentStatus === 'Failed' || order.paymentStatus === 'Cancelled') return 'failed';
  return 'awaiting';
}

export const OrderConfirmationPage: React.FC = () => {
  const { formatPrice, settings } = useStore();
  const { showToast } = useToast();
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get('orderNumber') || '';
  const returnedFromCard = params.get('payment') === 'card' && !!params.get('session_id');
  const cardCancelled = params.get('cancelled') === '1';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showMpesa, setShowMpesa] = useState(false);
  const [busy, setBusy] = useState<'card' | 'cancel' | null>(null);
  const celebrated = useRef(false);
  const pollTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.order) { setNotFound(true); return null; }
    setOrder(data.order);
    return data.order as Order;
  }, [orderNumber]);

  // While an online payment is in flight, ask the server (which asks the
  // provider) until it settles.
  const pollPayment = useCallback(async (orderId: string, attempts = 0) => {
    try {
      const res = await fetch(`/api/payments/orders/${orderId}/status`, { cache: 'no-store' });
      const data = await res.json();
      if (data.paymentStatus === 'Paid' || ['failed', 'cancelled'].includes(data.attempt?.status)) {
        await load();
        return;
      }
    } catch { /* retry */ }
    if (attempts < 40) pollTimer.current = window.setTimeout(() => pollPayment(orderId, attempts + 1), 3000);
  }, [load]);

  useEffect(() => {
    if (!orderNumber) { setNotFound(true); setLoading(false); return; }
    load().then((o) => {
      if (o && !o.limited && viewFor(o) === 'awaiting' && (returnedFromCard || o.latestPayment?.status === 'pending')) pollPayment(o.id);
    }).finally(() => setLoading(false));
    return () => { if (pollTimer.current) window.clearTimeout(pollTimer.current); };
  }, [orderNumber]);

  useEffect(() => {
    if (order && viewFor(order) === 'paid' && !celebrated.current) {
      celebrated.current = true;
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) confetti({ particleCount: 120, spread: 80, origin: { y: 0.45 } });
    }
  }, [order]);

  const payByCard = async () => {
    if (!order) return;
    setBusy('card');
    const res = await fetch(`/api/payments/orders/${order.id}/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'stripe' })
    }).then((r) => r.json()).catch(() => null);
    setBusy(null);
    if (res?.redirectUrl) window.location.assign(res.redirectUrl);
    else showToast(res?.message || 'Card payment is unavailable right now.', 'error');
  };

  const cancelOrder = async () => {
    if (!order || !window.confirm('Cancel this order? Reserved items will be released.')) return;
    setBusy('cancel');
    const res = await fetch(`/api/orders/${order.id}/cancel`, { method: 'POST' }).then((r) => r.json()).catch(() => null);
    setBusy(null);
    if (res?.success) { setOrder(res.order); showToast('Order cancelled.', 'info'); }
    else showToast(res?.message || 'Could not cancel the order.', 'error');
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col bg-slate-950"><Header currentPath="/order-confirmation" />
        <main className="flex-1 grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" aria-label="Loading order" /></main>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100"><Header currentPath="/order-confirmation" />
        <main className="flex-1 grid place-items-center p-6 text-center">
          <div className="space-y-3 max-w-sm">
            <AlertCircle className="w-10 h-10 mx-auto text-amber-400" aria-hidden="true" />
            <h1 className="text-xl font-bold text-white">Order not found</h1>
            <p className="text-sm text-slate-400">Check the order number, or find it under My Account → Orders.</p>
            <a href="/customer/dashboard" className="btn btn-primary">Go to my account</a>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const view = viewFor(order);
  const hero: Record<View, { icon: React.ReactNode; tone: string; title: string; text: string }> = {
    paid: { icon: <CheckCircle2 className="w-10 h-10" />, tone: 'text-emerald-400 border-emerald-500 bg-emerald-950/70', title: 'Payment received — thank you!', text: `Order ${order.orderNumber} is confirmed and being prepared. Your receipt has been emailed to ${order.customer?.email || 'you'}.` },
    awaiting: { icon: <Clock className="w-10 h-10" />, tone: 'text-amber-400 border-amber-500 bg-amber-950/60', title: 'Order placed — waiting for payment', text: returnedFromCard ? 'Confirming your card payment with Stripe…' : 'Your items are reserved. Complete payment below to confirm the order.' },
    failed: { icon: <XCircle className="w-10 h-10" />, tone: 'text-rose-400 border-rose-500 bg-rose-950/60', title: 'Payment not completed', text: order.latestPayment?.failureReason || 'No money was taken. You can try again or use another method.' },
    cancelled: { icon: <Ban className="w-10 h-10" />, tone: 'text-slate-300 border-slate-600 bg-slate-800', title: 'Order cancelled', text: 'This order was cancelled and reserved stock released. If you paid, our team will contact you about a refund.' },
    offline: order.paymentMethod === 'Cash on Delivery'
      ? { icon: <CheckCircle2 className="w-10 h-10" />, tone: 'text-cyan-400 border-cyan-500 bg-cyan-950/60', title: 'Order confirmed', text: "We're preparing your order. Pay when it arrives — or pay online now if you prefer." }
      : order.pendingTransfer
        ? { icon: <Clock className="w-10 h-10" />, tone: 'text-cyan-400 border-cyan-500 bg-cyan-950/60', title: 'Checking your transfer', text: 'Thanks! We are matching your transfer to our bank statement. Your receipt will be emailed once it is confirmed.' }
        : { icon: <Clock className="w-10 h-10" />, tone: 'text-amber-400 border-amber-500 bg-amber-950/60', title: 'Order placed — awaiting your transfer', text: `Your items are reserved. Pay using the bank details below, quoting ${order.orderNumber}, then tell us you've paid.` }
  };
  const h = hero[view];
  const canPay = (view === 'awaiting' || view === 'failed') && !order.limited;
  const isPickup = order.deliveryAddress?.pickup || order.deliveryQuote?.kind === 'pickup';

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100">
      <Header currentPath="/order-confirmation" />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 sm:py-12 w-full space-y-6">
        {cardCancelled && view !== 'paid' && (
          <div className="callout callout-warning"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /><p>Card payment was cancelled — nothing was charged.</p></div>
        )}

        <section className="card card-pad text-center space-y-5 aurora-bg" aria-live="polite">
          <div className={`w-20 h-20 rounded-full border-2 mx-auto grid place-items-center ${h.tone}`} aria-hidden="true">{h.icon}</div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white">{h.title}</h1>
            <p className="text-sm text-slate-300 max-w-lg mx-auto">{h.text}</p>
          </div>
          <div className="inline-flex flex-wrap justify-center gap-x-6 gap-y-1 rounded-2xl border border-slate-800 bg-slate-950 px-5 py-3 text-sm">
            <span>Order <strong className="font-mono text-white">{order.orderNumber}</strong></span>
            {!order.limited && <span>Total <strong className="text-cyan-400">{formatPrice(order.total)}</strong></span>}
            {order.paymentReference && view === 'paid' && <span>Ref <strong className="font-mono text-white">{order.paymentReference}</strong></span>}
          </div>

          {canPay && (
            <div className="flex flex-col sm:flex-row justify-center gap-2 pt-1">
              <button type="button" onClick={() => setShowMpesa(true)} className="btn btn-primary !bg-emerald-600 hover:!bg-emerald-500"><Smartphone className="w-4 h-4" aria-hidden="true" />Pay with M-Pesa</button>
              <button type="button" onClick={payByCard} disabled={busy === 'card'} className="btn btn-secondary">
                {busy === 'card' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <CreditCard className="w-4 h-4" aria-hidden="true" />}Pay by card
              </button>
              <button type="button" onClick={cancelOrder} disabled={busy === 'cancel'} className="btn btn-ghost">Cancel order</button>
            </div>
          )}

          {!order.limited && (
            <div className="flex flex-wrap justify-center gap-2">
              {view === 'paid' && (
                <a href={`/api/orders/${order.id}/receipt.pdf`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><ReceiptText className="w-4 h-4" aria-hidden="true" />Receipt (PDF)</a>
              )}
              <a href={`/api/orders/${order.id}/invoice.pdf`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><FileText className="w-4 h-4" aria-hidden="true" />Tax invoice (PDF)</a>
              <a href={`/track-order?order=${encodeURIComponent(order.orderNumber)}`} className="btn btn-secondary btn-sm"><Truck className="w-4 h-4" aria-hidden="true" />Track order</a>
            </div>
          )}
        </section>

        {!order.limited && view === 'offline' && (
          <OfflinePaymentPanel order={order} onUpdated={load} onPayOnline={order.paymentMethod === 'Cash on Delivery' ? () => setShowMpesa(true) : undefined} />
        )}

        {!order.limited && (
          <section className="card card-pad space-y-6">
            <h2 className="text-lg font-bold text-white">Order details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-1 min-w-0">
                <div className="eyebrow">Customer</div>
                <div className="font-bold text-white">{order.customer.name}</div>
                <div className="text-slate-400 break-all">{order.customer.email}</div>
                <div className="text-slate-400 font-mono">{order.customer.phone}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-1 min-w-0">
                <div className="eyebrow">{isPickup ? 'Pickup' : 'Delivery'}</div>
                <div className="font-bold text-white flex items-center gap-1.5">{isPickup && <Store className="w-4 h-4 text-cyan-400" aria-hidden="true" />}{order.deliveryMethod}</div>
                {!isPickup && <div className="text-slate-300">{[order.deliveryAddress.building, order.deliveryAddress.street, order.deliveryAddress.town, order.deliveryAddress.county].filter(Boolean).join(', ')}</div>}
                {isPickup && <div className="text-slate-400">{settings.address}</div>}
                {order.deliveryDistanceKm != null && <div className="text-xs text-slate-500">~{order.deliveryDistanceKm} km from our office{order.deliveryQuote?.estimatedTime ? ` · ${order.deliveryQuote.estimatedTime}` : ''}</div>}
              </div>
            </div>

            <ul className="divide-y divide-slate-800">
              {order.items.map((item, idx) => (
                <li key={idx} className="py-3 flex items-center gap-3 text-sm">
                  <img src={item.thumbnail} alt="" className="w-12 h-12 rounded-xl object-contain bg-slate-950 p-1 border border-slate-800 shrink-0" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white">{item.name}</div>
                    {item.variantName && <div className="text-xs text-cyan-400">{item.variantName}</div>}
                    <div className="text-xs text-slate-400">
                      Qty {item.quantity} × {formatPrice(item.price)}
                      {item.originalPrice && item.originalPrice > item.price && <span className="ml-1.5 line-through text-slate-500">{formatPrice(item.originalPrice)}</span>}
                    </div>
                  </div>
                  <div className="font-bold text-white shrink-0">{formatPrice(item.price * item.quantity)}</div>
                </li>
              ))}
            </ul>

            <dl className="ml-auto max-w-sm space-y-2 text-sm border-t border-slate-800 pt-4">
              <div className="flex justify-between"><dt className="text-slate-400">Subtotal</dt><dd className="text-white">{formatPrice(order.subtotal)}</dd></div>
              {order.discountAmount > 0 && <div className="flex justify-between text-emerald-400"><dt>Promo{order.couponCode ? ` (${order.couponCode})` : ''}</dt><dd>−{formatPrice(order.discountAmount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-slate-400">Delivery</dt><dd className="text-white">{order.deliveryFee === 0 ? 'Free' : formatPrice(order.deliveryFee)}</dd></div>
              <div className="flex justify-between text-xs"><dt className="text-slate-400">VAT ({order.taxRate ?? 16}%, included)</dt><dd className="text-slate-300">{formatPrice(order.taxAmount)}</dd></div>
              <div className="flex justify-between text-lg font-black border-t border-slate-800 pt-2"><dt className="text-white">Total</dt><dd className="text-cyan-400">{formatPrice(order.total)}</dd></div>
              <div className="flex justify-between text-xs"><dt className="text-slate-400">Payment</dt><dd className="text-slate-300">{order.paymentMethod} · {order.paymentStatus}</dd></div>
            </dl>
          </section>
        )}
      </main>

      {showMpesa && (
        <MpesaModal
          orderId={order.id}
          orderNumber={order.orderNumber}
          phone={order.customer.phone}
          amount={order.total}
          onSuccess={() => { setShowMpesa(false); load(); }}
          onClose={() => { setShowMpesa(false); load(); }}
        />
      )}
      <Footer />
    </div>
  );
};
