import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ShieldCheck, Lock, Truck, CreditCard, Smartphone, Building, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft,
  Tag, MapPin, Loader2, Store, Banknote, Info, Zap
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { MpesaModal } from '../components/checkout/MpesaModal';
import { LocationPicker } from '../components/location/LocationPicker';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { navigate } from '../utils/navigation';
import { DeliveryQuote, UserLocation } from '../types';

type PaymentKey = 'mpesa' | 'card' | 'bank_transfer' | 'cash_on_delivery';
type DeliveryChoice = { mode: 'distance' } | { mode: 'option'; optionId: string };

interface DeliveryOption { id: string; name: string; kind: 'pickup' | 'fixed'; description?: string | null; fee: number; freeThreshold?: number | null; estimatedTime?: string | null }
interface Summary {
  items: { productId: string; variantId: string | null; name: string; variantName: string | null; quantity: number; unitPrice: number; originalUnitPrice: number; lineTotal: number; hasFlashDeal: boolean; thumbnail: string }[];
  subtotal: number; flashDealSavings: number; discountAmount: number;
  coupon: { code: string; description?: string } | null; couponError: string | null;
  delivery: DeliveryQuote | null; deliveryError: { message: string; code: string } | null; deliveryFee: number;
  taxRate: number; pricesIncludeTax: boolean; taxAmount: number; total: number;
}

const STEPS = ['Contact', 'Delivery', 'Payment', 'Review'] as const;
const DRAFT_KEY = 'ibs-checkout-draft';

const PAYMENT_META: Record<PaymentKey, { title: string; blurb: string; icon: React.ComponentType<{ className?: string }>; tag: string }> = {
  mpesa: { title: 'M-Pesa', blurb: 'Get a payment prompt on your phone and approve it with your M-Pesa PIN.', icon: Smartphone, tag: 'Instant' },
  card: { title: 'Visa / Mastercard', blurb: "Pay on Stripe's secure page. Your card details never touch our servers.", icon: CreditCard, tag: 'Card' },
  bank_transfer: { title: 'Bank transfer / RTGS', blurb: "We reserve your items, show our bank details, and ship once your transfer is verified. Tap “I've paid” after sending.", icon: Building, tag: 'Business' },
  cash_on_delivery: { title: 'Pay on delivery', blurb: 'Inspect first, then pay the rider by cash, M-Pesa or card. You get an official receipt. Pickup or nearby pinned addresses.', icon: Banknote, tag: 'Local' }
};

function loadDraft() {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
}

export const CheckoutPage: React.FC = () => {
  const { cart, appliedCoupon, applyCoupon, removeCoupon, clearCart } = useCart();
  const { user } = useAuth();
  const { formatPrice, settings } = useStore();
  const { showToast } = useToast();
  const draft = useMemo(loadDraft, []);
  const cancelledCard = new URLSearchParams(window.location.search).get('cancelled') === '1';

  const [step, setStep] = useState<number>(draft?.step ?? 0);
  const [maxStep, setMaxStep] = useState<number>(draft?.maxStep ?? 0);
  const [contact, setContact] = useState(draft?.contact ?? { name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
  const [location, setLocation] = useState<UserLocation>(draft?.location ?? {
    county: user?.location?.county || '', town: user?.location?.town || '', addressLine: user?.location?.addressLine || '',
    lat: user?.location?.lat ?? null, lng: user?.location?.lng ?? null, source: user?.location?.source || 'manual'
  });
  const [building, setBuilding] = useState<string>(draft?.building ?? '');
  const [notes, setNotes] = useState<string>(draft?.notes ?? '');
  const [deliveryChoice, setDeliveryChoice] = useState<DeliveryChoice>(draft?.deliveryChoice ?? { mode: 'distance' });
  const [paymentMethod, setPaymentMethod] = useState<PaymentKey>(draft?.paymentMethod ?? 'mpesa');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [options, setOptions] = useState<DeliveryOption[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  // Why the server could not price the cart (e.g. empty cart, unavailable item).
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [codMaxKm, setCodMaxKm] = useState(40);
  const [providers, setProviders] = useState<{ mpesa: boolean; card: boolean; cardTest?: boolean; mpesaMode?: string | null }>({ mpesa: true, card: true });
  const [couponInput, setCouponInput] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [mpesaOrder, setMpesaOrder] = useState<{ id: string; orderNumber: string; total: number } | null>(null);

  // Persist progress so going back, refreshing or a brief network blip does not lose details.
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, maxStep, contact, location, building, notes, deliveryChoice, paymentMethod }));
    } catch { /* storage unavailable */ }
  }, [step, maxStep, contact, location, building, notes, deliveryChoice, paymentMethod]);

  useEffect(() => {
    fetch('/api/delivery/config').then((r) => r.json()).then((d) => { if (d?.success) setOptions(d.options || []); }).catch(() => {});
    fetch('/api/payments/methods').then((r) => r.json()).then((d) => {
      if (d?.success) setProviders({ mpesa: !!d.mpesa?.available, card: !!d.card?.available, cardTest: !!d.card?.testMode, mpesaMode: d.mpesa?.mode });
    }).catch(() => {});
  }, []);

  const deliveryRequest = useMemo(() => (
    deliveryChoice.mode === 'option'
      ? { mode: 'option' as const, optionId: deliveryChoice.optionId }
      : { mode: 'distance' as const, county: location.county || undefined, coordinates: location.lat != null && location.lng != null ? { lat: location.lat, lng: location.lng } : null }
  ), [deliveryChoice, location.county, location.lat, location.lng]);

  // Server-side pricing preview: items, flash deals, promo code, delivery, VAT.
  const previewSeq = useRef(0);
  const refreshSummary = useCallback(async () => {
    const seq = ++previewSeq.current;
    setSummaryLoading(true);
    try {
      const hasDeliveryInput = deliveryRequest.mode === 'option' || !!deliveryRequest.county;
      const res = await fetch('/api/orders/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponCode: appliedCoupon?.code || null, delivery: hasDeliveryInput ? deliveryRequest : null })
      });
      const data = await res.json().catch(() => null);
      if (seq !== previewSeq.current) return;
      if (data?.success) {
        setSummary(data.summary);
        setSummaryError(null);
        setCodMaxKm(data.cashOnDeliveryMaxKm ?? 40);
      } else {
        setSummaryError(data?.message || `We couldn't price your order (error ${res.status}). Please refresh the page.`);
        if (res.status !== 429) console.error('[checkout] preview failed', res.status, data);
      }
    } catch {
      if (seq === previewSeq.current) setSummaryError('Could not reach the server to price your order. Check your connection and try again.');
    } finally {
      if (seq === previewSeq.current) setSummaryLoading(false);
    }
  }, [deliveryRequest, appliedCoupon?.code]);

  const cartSignature = cart.map((i) => `${i.productId}:${i.variantId}:${i.quantity}`).join('|');
  useEffect(() => {
    const t = window.setTimeout(refreshSummary, 250);
    return () => window.clearTimeout(t);
  }, [refreshSummary, cartSignature]);

  const quote = summary?.delivery || null;
  const isPickup = deliveryChoice.mode === 'option' && options.find((o) => o.id === deliveryChoice.optionId)?.kind === 'pickup';
  const codAllowed = !!quote && (quote.mode === 'option' ? quote.kind === 'pickup' : quote.distanceKm != null && quote.distanceKm <= codMaxKm && !quote.estimated);
  const methodAvailable = (key: PaymentKey) => (key === 'mpesa' ? providers.mpesa : key === 'card' ? providers.card : key === 'cash_on_delivery' ? codAllowed : true);

  useEffect(() => {
    if (!methodAvailable(paymentMethod)) {
      const first = (Object.keys(PAYMENT_META) as PaymentKey[]).find(methodAvailable);
      if (first) setPaymentMethod(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codAllowed, providers.mpesa, providers.card]);

  // ── Validation per step ───────────────────────────────────────────────
  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (contact.name.trim().length < 2) e.name = 'Enter your full name';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) e.email = 'Enter a valid email address';
      if (!/^(?:254|0)?[17]\d{8}$/.test(contact.phone.replace(/\D/g, ''))) e.phone = 'Enter a Kenyan mobile number, e.g. 0712 345 678';
    }
    if (s === 1) {
      if (!isPickup) {
        if (!location.county) e.county = 'Choose your county';
        if (!location.town || location.town.trim().length < 2) e.town = 'Enter your town or area';
        if (!location.addressLine || location.addressLine.trim().length < 2) e.addressLine = 'Enter your street or road';
      }
      if (summary?.deliveryError) e.delivery = summary.deliveryError.message;
      else if (summaryError) e.delivery = summaryError;
      else if (!quote) e.delivery = 'Choose how you would like to receive your order';
    }
    if (s === 2 && !methodAvailable(paymentMethod)) e.payment = 'Choose an available payment method';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goTo = (target: number) => {
    if (target > step && !validate(step)) return;
    setStep(target);
    setMaxStep((m) => Math.max(m, target));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Coupon ────────────────────────────────────────────────────────────
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setCouponBusy(true);
    const result = await applyCoupon(couponInput.trim().toUpperCase());
    setCouponBusy(false);
    if (result.success) setCouponInput('');
  };

  // ── Place order ───────────────────────────────────────────────────────
  const finishAndGo = (orderNumber: string, extra = '') => {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    clearCart();
    navigate(`/order-confirmation?orderNumber=${encodeURIComponent(orderNumber)}${extra}`);
  };

  const placeOrder = async () => {
    if (![0, 1, 2].every((s) => validate(s))) {
      setOrderError('Please complete the highlighted details first.');
      return;
    }
    setOrderError('');
    setPlacing(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: contact,
          couponCode: appliedCoupon?.code || null,
          delivery: deliveryRequest,
          address: isPickup ? { notes } : {
            county: location.county, town: location.town, street: location.addressLine, building, notes,
            lat: location.lat ?? null, lng: location.lng ?? null
          },
          paymentMethod
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOrderError(data.message || 'We could not place your order. Please try again.');
        if (data.code === 'COUPON_INVALID') removeCoupon();
        refreshSummary();
        return;
      }
      const order = data.order;
      if (paymentMethod === 'mpesa') {
        setMpesaOrder({ id: order.id, orderNumber: order.orderNumber, total: order.total });
        return;
      }
      if (paymentMethod === 'card') {
        const pay = await fetch(`/api/payments/orders/${order.id}/start`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'stripe' })
        }).then((r) => r.json()).catch(() => null);
        if (pay?.redirectUrl) {
          try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
          clearCart();
          window.location.assign(pay.redirectUrl);
          return;
        }
        showToast(pay?.message || 'Card payment could not start. You can retry from your order page.', 'error');
        finishAndGo(order.orderNumber, '&payment=card&retry=1');
        return;
      }
      showToast(`Order ${order.orderNumber} placed.`, 'success');
      finishAndGo(order.orderNumber);
    } catch {
      setOrderError('Unable to reach the server. Check your connection and try again — nothing has been charged.');
    } finally {
      setPlacing(false);
    }
  };

  if (cart.length === 0 && !mpesaOrder) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Header currentPath="/checkout" />
        <main className="flex-1 grid place-items-center p-8 text-center">
          <div className="space-y-4 max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 mx-auto grid place-items-center text-slate-400"><ShieldCheck className="w-8 h-8" aria-hidden="true" /></div>
            <h1 className="text-xl font-bold text-white">Your cart is empty</h1>
            <p className="text-sm text-slate-400">Add products to your cart before checking out.</p>
            <a href="/shop" className="btn btn-primary">Explore products</a>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const FieldError = ({ name }: { name: string }) => (errors[name] ? <p className="field-error" role="alert">{errors[name]}</p> : null);

  const SummaryCard = (
    <div className="card card-pad space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-white">Order summary</h2>
        {summaryLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" aria-label="Updating totals" />}
      </div>

      <ul className="space-y-3 max-h-64 overflow-y-auto pr-1" aria-label="Items">
        {(summary?.items || cart.map((c) => ({ ...c, unitPrice: c.price, originalUnitPrice: c.compareAtPrice || c.price, lineTotal: c.price * c.quantity, hasFlashDeal: !!c.flashDeal }))).map((item, idx) => (
          <li key={idx} className="flex items-center gap-3">
            <img src={item.thumbnail} alt="" className="w-11 h-11 rounded-lg object-contain bg-slate-800 border border-slate-700 shrink-0" loading="lazy" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{item.name}</div>
              <div className="text-xs text-slate-400">
                Qty {item.quantity} × {formatPrice(item.unitPrice)}
                {item.hasFlashDeal && <span className="ml-1.5 badge badge-warning"><Zap className="w-3 h-3" aria-hidden="true" />Deal</span>}
              </div>
            </div>
            <div className="text-sm font-bold text-white shrink-0">{formatPrice(item.lineTotal)}</div>
          </li>
        ))}
      </ul>

      {appliedCoupon ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-800/50 bg-emerald-950/40 px-3 py-2 text-sm">
          <span className="font-bold text-emerald-300 flex items-center gap-1.5"><Tag className="w-4 h-4" aria-hidden="true" />{appliedCoupon.code}</span>
          <button type="button" onClick={removeCoupon} className="text-xs font-semibold text-slate-400 hover:text-rose-400">Remove</button>
        </div>
      ) : (
        <form onSubmit={handleApplyCoupon} className="flex gap-2">
          <label htmlFor="coupon" className="sr-only">Promo code</label>
          <input id="coupon" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Promo code" className="field-input font-mono tracking-wider !py-2.5" autoComplete="off" />
          <button type="submit" disabled={couponBusy || !couponInput.trim()} className="btn btn-secondary shrink-0">
            {couponBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : 'Apply'}
          </button>
        </form>
      )}

      <dl className="space-y-2 text-sm border-t border-slate-800 pt-4">
        <div className="flex justify-between gap-4"><dt className="text-slate-400">Subtotal</dt><dd className="font-semibold text-white">{formatPrice(summary?.subtotal ?? 0)}</dd></div>
        {(summary?.flashDealSavings ?? 0) > 0 && (
          <div className="flex justify-between gap-4 text-xs"><dt className="text-slate-400">Flash-deal savings (included)</dt><dd className="text-emerald-400">−{formatPrice(summary!.flashDealSavings)}</dd></div>
        )}
        {(summary?.discountAmount ?? 0) > 0 && (
          <div className="flex justify-between gap-4"><dt className="text-emerald-400">Promo ({summary?.coupon?.code})</dt><dd className="font-semibold text-emerald-400">−{formatPrice(summary!.discountAmount)}</dd></div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-slate-400">
            Delivery
            {quote && <span className="block text-xs text-slate-500">{quote.label}{quote.distanceKm != null ? ` · ~${quote.distanceKm} km${quote.estimated ? ' (est.)' : ''}` : ''}</span>}
          </dt>
          <dd className="font-semibold text-white text-right">{quote ? (quote.fee === 0 ? <span className="text-emerald-400">Free</span> : formatPrice(quote.fee)) : <span className="text-slate-500 font-normal">Choose at step 2</span>}</dd>
        </div>
        <div className="flex justify-between gap-4 text-xs"><dt className="text-slate-400">VAT ({summary?.taxRate ?? settings.taxRate}%{summary?.pricesIncludeTax !== false ? ', included' : ''})</dt><dd className="text-slate-300">{formatPrice(summary?.taxAmount ?? 0)}</dd></div>
        <div className="flex justify-between gap-4 border-t border-slate-800 pt-3 text-lg font-black">
          <dt className="text-white">Total</dt><dd className="text-cyan-400">{formatPrice(summary?.total ?? 0)}</dd>
        </div>
      </dl>

      <ul className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
        <li className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />Official warranty on every item</li>
        <li className="flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />Totals are confirmed by our server when you order</li>
      </ul>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header currentPath="/checkout" />

      {/* Stepper */}
      <nav aria-label="Checkout progress" className="border-b border-slate-800 bg-slate-900/60">
        <ol className="max-w-3xl mx-auto flex items-center px-4 py-4 sm:py-5">
          {STEPS.map((label, i) => {
            const done = i < step || (i <= maxStep && i !== step && i < maxStep);
            const current = i === step;
            const reachable = i <= maxStep;
            return (
              <li key={label} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
                <button
                  type="button"
                  onClick={() => reachable && setStep(i)}
                  disabled={!reachable}
                  aria-current={current ? 'step' : undefined}
                  className={`flex items-center gap-2 text-xs sm:text-sm font-bold ${current ? 'text-cyan-400' : done ? 'text-emerald-400 hover:underline' : 'text-slate-500'}`}
                >
                  <span className={`w-8 h-8 rounded-full grid place-items-center text-xs font-black shrink-0 ${current ? 'bg-cyan-600 text-white ring-4 ring-cyan-600/20' : done ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {done ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : i + 1}
                  </span>
                  <span className={current ? '' : 'hidden sm:inline'}>{label}</span>
                </button>
                {i < STEPS.length - 1 && <span className={`flex-1 h-0.5 mx-2 sm:mx-3 rounded ${i < maxStep ? 'bg-emerald-600' : 'bg-slate-800'}`} aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>

      <main className="w-full max-w-[1320px] mx-auto px-4 lg:px-6 py-6 sm:py-8 flex-1">
        {cancelledCard && (
          <div className="callout callout-warning mb-5"><Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /><p>Card payment was cancelled. Nothing was charged.</p></div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <section className="lg:col-span-7 xl:col-span-8 card card-pad space-y-6 min-w-0">
            {/* STEP 1 — CONTACT */}
            {step === 0 && (
              <div className="space-y-5 animate-fadeInUp">
                <header className="border-b border-slate-800 pb-4">
                  <h1 className="text-xl font-bold text-white">Contact details</h1>
                  <p className="text-sm text-slate-400 mt-1">Where we send order updates, your receipt and rider calls.</p>
                </header>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="c-name" className="field-label">Full name <span className="text-rose-400">*</span></label>
                    <input id="c-name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className={`field-input ${errors.name ? 'field-input-error' : ''}`} autoComplete="name" />
                    <FieldError name="name" />
                  </div>
                  <div>
                    <label htmlFor="c-email" className="field-label">Email <span className="text-rose-400">*</span></label>
                    <input id="c-email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className={`field-input ${errors.email ? 'field-input-error' : ''}`} autoComplete="email" />
                    <FieldError name="email" />
                  </div>
                  <div>
                    <label htmlFor="c-phone" className="field-label">Mobile number <span className="text-rose-400">*</span></label>
                    <input id="c-phone" type="tel" inputMode="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="0712 345 678" className={`field-input font-mono ${errors.phone ? 'field-input-error' : ''}`} autoComplete="tel" />
                    {errors.phone ? <FieldError name="phone" /> : <p className="field-hint">For M-Pesa and the delivery rider.</p>}
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button type="button" onClick={() => goTo(1)} className="btn btn-primary btn-lg w-full sm:w-auto">Continue to delivery <ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
                </div>
              </div>
            )}

            {/* STEP 2 — DELIVERY */}
            {step === 1 && (
              <div className="space-y-6 animate-fadeInUp">
                <header className="border-b border-slate-800 pb-4">
                  <h1 className="text-xl font-bold text-white">Delivery</h1>
                  <p className="text-sm text-slate-400 mt-1">Delivery is priced by distance from our office on Moi Avenue, Nairobi. Or collect for free.</p>
                </header>

                <div className="space-y-3" role="radiogroup" aria-label="Delivery method">
                  <label className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${deliveryChoice.mode === 'distance' ? 'border-cyan-500 bg-cyan-950/40 ring-1 ring-cyan-500' : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'}`}>
                    <input type="radio" name="delivery" className="mt-1 accent-[var(--t-accent-600)]" checked={deliveryChoice.mode === 'distance'} onChange={() => setDeliveryChoice({ mode: 'distance' })} />
                    <span className="flex-1 min-w-0">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-white flex items-center gap-1.5"><Truck className="w-4 h-4 text-cyan-400" aria-hidden="true" />Deliver to my address</span>
                        {deliveryChoice.mode === 'distance' && quote?.mode === 'distance' && (
                          <span className="font-black text-white">{quote.fee === 0 ? <span className="text-emerald-400">Free</span> : formatPrice(quote.fee)}</span>
                        )}
                      </span>
                      <span className="block text-xs text-slate-400 mt-1">
                        {deliveryChoice.mode === 'distance' && quote?.mode === 'distance'
                          ? `${quote.label} · about ${quote.distanceKm} km away${quote.estimatedTime ? ` · ${quote.estimatedTime}` : ''}`
                          : 'Price depends on how far you are from our office.'}
                      </span>
                      {deliveryChoice.mode === 'distance' && quote?.mode === 'distance' && quote.estimated && (
                        <span className="mt-2 block text-xs text-amber-300">Estimated from your county. Pin your exact location below for an exact price.</span>
                      )}
                      {deliveryChoice.mode === 'distance' && quote?.mode === 'distance' && quote.baseFee! > 0 && quote.fee === 0 && (
                        <span className="mt-2 block text-xs text-emerald-400">Free delivery applied for this order value.</span>
                      )}
                    </span>
                  </label>

                  {options.map((o) => {
                    const selected = deliveryChoice.mode === 'option' && deliveryChoice.optionId === o.id;
                    const Icon = o.kind === 'pickup' ? Store : Truck;
                    return (
                      <label key={o.id} className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${selected ? 'border-cyan-500 bg-cyan-950/40 ring-1 ring-cyan-500' : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'}`}>
                        <input type="radio" name="delivery" className="mt-1 accent-[var(--t-accent-600)]" checked={selected} onChange={() => setDeliveryChoice({ mode: 'option', optionId: o.id })} />
                        <span className="flex-1 min-w-0">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-white flex items-center gap-1.5"><Icon className="w-4 h-4 text-cyan-400" aria-hidden="true" />{o.name}</span>
                            <span className="font-black text-white">{o.fee === 0 ? <span className="text-emerald-400">Free</span> : formatPrice(o.fee)}</span>
                          </span>
                          {(o.description || o.estimatedTime) && <span className="block text-xs text-slate-400 mt-1">{[o.description, o.estimatedTime].filter(Boolean).join(' · ')}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {errors.delivery && (
                  <div className="callout callout-danger" role="alert"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /><p>{errors.delivery}</p></div>
                )}
                {!errors.delivery && summary?.deliveryError && deliveryChoice.mode === 'distance' && location.county && (
                  <div className="callout callout-warning"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /><p>{summary.deliveryError.message}</p></div>
                )}

                {!isPickup && (
                  <div className="space-y-4">
                    <h2 className="text-sm font-bold text-white flex items-center gap-1.5"><MapPin className="w-4 h-4 text-cyan-400" aria-hidden="true" />Delivery address</h2>
                    <LocationPicker
                      value={location}
                      onChange={setLocation}
                      addressLabel="Street / road"
                      requireAddressLine
                      errors={{ county: errors.county, town: errors.town, addressLine: errors.addressLine }}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="d-building" className="field-label">Building, floor & door</label>
                        <input id="d-building" value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="e.g. Silverstone Towers, 4th floor, Apt 4B" className="field-input" />
                      </div>
                      <div>
                        <label htmlFor="d-notes" className="field-label">Notes for the rider</label>
                        <input id="d-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Call on arrival, leave with security" className="field-input" maxLength={500} />
                      </div>
                    </div>
                  </div>
                )}
                {isPickup && (
                  <div>
                    <label htmlFor="p-notes" className="field-label">Pickup notes <span className="font-normal text-slate-500">(optional)</span></label>
                    <input id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Collecting on Saturday morning" className="field-input" maxLength={500} />
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-2">
                  <button type="button" onClick={() => setStep(0)} className="btn btn-secondary"><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back</button>
                  <button type="button" onClick={() => goTo(2)} className="btn btn-primary btn-lg">Continue to payment <ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
                </div>
              </div>
            )}

            {/* STEP 3 — PAYMENT */}
            {step === 2 && (
              <div className="space-y-5 animate-fadeInUp">
                <header className="border-b border-slate-800 pb-4">
                  <h1 className="text-xl font-bold text-white">Payment method</h1>
                  <p className="text-sm text-slate-400 mt-1">All amounts are in Kenya Shillings. You'll pay after reviewing your order.</p>
                </header>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Payment method">
                  {(Object.keys(PAYMENT_META) as PaymentKey[]).map((key) => {
                    const meta = PAYMENT_META[key];
                    const available = methodAvailable(key);
                    const selected = paymentMethod === key;
                    const Icon = meta.icon;
                    const reason = !available
                      ? key === 'cash_on_delivery' ? `Only for store pickup or pinned addresses within ${codMaxKm} km.` : 'Temporarily unavailable.'
                      : null;
                    return (
                      <label key={key} className={`rounded-2xl border p-4 space-y-2 transition-colors ${available ? 'cursor-pointer' : 'opacity-55 cursor-not-allowed'} ${selected ? 'border-cyan-500 bg-cyan-950/40 ring-1 ring-cyan-500' : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'}`}>
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-bold text-white">
                            <input type="radio" name="payment" className="accent-[var(--t-accent-600)]" checked={selected} disabled={!available} onChange={() => setPaymentMethod(key)} />
                            <Icon className="w-5 h-5 text-cyan-400" aria-hidden="true" />{meta.title}
                          </span>
                          <span className="badge badge-neutral">{meta.tag}</span>
                        </span>
                        <span className="block text-xs text-slate-400 leading-relaxed">{reason || meta.blurb}</span>
                        {key === 'card' && available && providers.cardTest && <span className="block text-[11px] text-amber-300">Test mode: use Stripe test cards (e.g. 4242 4242 4242 4242).</span>}
                      </label>
                    );
                  })}
                </div>
                {errors.payment && <p className="field-error">{errors.payment}</p>}
                <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-2">
                  <button type="button" onClick={() => setStep(1)} className="btn btn-secondary"><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back</button>
                  <button type="button" onClick={() => goTo(3)} className="btn btn-primary btn-lg">Review order <ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
                </div>
              </div>
            )}

            {/* STEP 4 — REVIEW */}
            {step === 3 && (
              <div className="space-y-6 animate-fadeInUp">
                <header className="border-b border-slate-800 pb-4">
                  <h1 className="text-xl font-bold text-white">Review & place order</h1>
                  <p className="text-sm text-slate-400 mt-1">Check everything below. You can edit any section.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-1 min-w-0">
                    <div className="flex items-center justify-between"><span className="eyebrow">Contact</span><button type="button" onClick={() => setStep(0)} className="text-xs font-semibold text-cyan-400 hover:underline">Edit</button></div>
                    <p className="font-bold text-white truncate">{contact.name}</p>
                    <p className="text-sm text-slate-400 truncate">{contact.email}</p>
                    <p className="text-sm text-slate-400 font-mono">{contact.phone}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-1 min-w-0">
                    <div className="flex items-center justify-between"><span className="eyebrow">Delivery</span><button type="button" onClick={() => setStep(1)} className="text-xs font-semibold text-cyan-400 hover:underline">Edit</button></div>
                    <p className="font-bold text-white">{quote?.label || '—'}</p>
                    {!isPickup && <p className="text-sm text-slate-400">{[building, location.addressLine, location.town, location.county].filter(Boolean).join(', ')}</p>}
                    {quote?.distanceKm != null && <p className="text-xs text-slate-500">~{quote.distanceKm} km{quote.estimated ? ' (estimated)' : ''}{quote.estimatedTime ? ` · ${quote.estimatedTime}` : ''}</p>}
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-1 min-w-0">
                    <div className="flex items-center justify-between"><span className="eyebrow">Payment</span><button type="button" onClick={() => setStep(2)} className="text-xs font-semibold text-cyan-400 hover:underline">Edit</button></div>
                    <p className="font-bold text-white">{PAYMENT_META[paymentMethod].title}</p>
                    <p className="text-xs text-slate-400">{paymentMethod === 'mpesa' ? 'A prompt will be sent to your phone.' : paymentMethod === 'card' ? "You'll be taken to Stripe's secure page." : paymentMethod === 'bank_transfer' ? "Next you'll see our bank details and the reference to quote." : 'Pay by cash, M-Pesa or card when your order arrives.'}</p>
                  </div>
                </div>

                {orderError && (
                  <div className="callout callout-danger" role="alert"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /><p>{orderError}</p></div>
                )}

                <div className="space-y-3">
                  <button type="button" onClick={placeOrder} disabled={placing || summaryLoading || !summary} className="btn btn-primary btn-lg w-full !text-base">
                    {placing ? <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Placing order…</> : <><Lock className="w-5 h-5" aria-hidden="true" /> Place order · {formatPrice(summary?.total ?? 0)}</>}
                  </button>
                  <p className="text-xs text-slate-400 text-center">By placing your order you agree to our <a href="/policies/terms" className="underline">terms</a>, <a href="/policies/delivery" className="underline">delivery</a> and <a href="/policies/warranty" className="underline">warranty</a> policies.</p>
                  <button type="button" onClick={() => setStep(2)} className="btn btn-ghost w-full sm:w-auto"><ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back</button>
                </div>
              </div>
            )}
          </section>

          <aside className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 min-w-0" aria-label="Order summary">
            {SummaryCard}
          </aside>
        </div>
      </main>

      {/* Phones: total always visible */}
      {summary && (
        <div className="lg:hidden sticky bottom-0 z-30 border-t border-slate-800 bg-slate-900/95 backdrop-blur px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-slate-400">Total{quote ? '' : ' (before delivery)'}</span>
          <span className="font-black text-cyan-400 text-base">{formatPrice(summary.total)}</span>
        </div>
      )}

      {mpesaOrder && (
        <MpesaModal
          orderId={mpesaOrder.id}
          orderNumber={mpesaOrder.orderNumber}
          phone={contact.phone}
          amount={mpesaOrder.total}
          onSuccess={(orderNumber) => finishAndGo(orderNumber)}
          onClose={() => finishAndGo(mpesaOrder.orderNumber, '&payment=mpesa&retry=1')}
        />
      )}

      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};
