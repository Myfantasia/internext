import React, { useState } from 'react';
import { Landmark, Copy, Check, Clock, Loader2, Send, Banknote, Smartphone, CreditCard, Hourglass } from 'lucide-react';
import { Order } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';

// Shown on the order page for unpaid bank-transfer and pay-on-delivery orders:
// exactly how to pay, and (bank) a form to report the transfer so staff can
// verify it quickly.

const CopyValue: React.FC<{ label: string; value: string | null | undefined; mono?: boolean }> = ({ label, value, mono = true }) => {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-800 last:border-0">
      <dt className="text-xs text-slate-400 shrink-0">{label}</dt>
      <dd className="flex items-center gap-2 min-w-0">
        <span className={`text-sm text-white font-semibold break-all text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
        <button type="button" onClick={copy} className="icon-button !w-7 !h-7 shrink-0" aria-label={`Copy ${label}`}>{copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
      </dd>
    </div>
  );
};

const today = () => new Date().toISOString().slice(0, 10);

export const OfflinePaymentPanel: React.FC<{ order: Order; onUpdated: () => void; onPayOnline?: () => void }> = ({ order, onUpdated, onPayOnline }) => {
  const { formatPrice, settings } = useStore();
  const { showToast } = useToast();
  const ins = order.paymentInstructions;
  const [showForm, setShowForm] = useState(false);
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState(String(order.total));
  const [paidOn, setPaidOn] = useState(today());
  const [bankName, setBankName] = useState('');
  const [payerName, setPayerName] = useState(order.customer.name);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!ins) return null;

  if (ins.kind === 'cash_on_delivery') {
    return (
      <section className="card card-pad space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><Banknote className="w-5 h-5 text-cyan-400" />Pay on {ins.pickup ? 'collection' : 'delivery'}</h2>
        <p className="text-sm text-slate-300">
          Have <strong className="text-white">{formatPrice(ins.amount)}</strong> ready {ins.pickup ? 'when you collect from our store' : 'when the rider arrives'}. Inspect your items first, then pay by:
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <li className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex items-center gap-2"><Banknote className="w-4 h-4 text-emerald-400" />Cash</li>
          <li className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex items-center gap-2"><Smartphone className="w-4 h-4 text-emerald-400" />M-Pesa{ins.tillOrPaybill ? ` · ${ins.tillOrPaybill}` : ''}</li>
          <li className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-400" />Card (POS)</li>
        </ul>
        <p className="text-xs text-slate-400">You'll get an official receipt by email as soon as payment is recorded. Keep your phone on: the rider calls before arriving.</p>
        {onPayOnline && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-cyan-900/60 bg-cyan-950/30 p-3">
            <span className="text-sm text-slate-200">Prefer not to handle cash? Pay now and the rider only hands over your order.</span>
            <button type="button" onClick={onPayOnline} className="btn btn-primary btn-sm shrink-0"><Smartphone className="w-4 h-4" />Pay now with M-Pesa</button>
          </div>
        )}
      </section>
    );
  }

  const bank = ins.bank;
  const deadline = new Date(ins.payBy);
  const pending = order.pendingTransfer;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (reference.trim().length < 4) { setError('Enter the transaction reference from your bank slip or app.'); return; }
    if (!(Number(amount) > 0)) { setError('Enter the amount you sent.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/payments/orders/${order.id}/bank-transfer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: reference.trim(), amount: Number(amount), paidOn, bankName: bankName.trim() || undefined, payerName: payerName.trim() || undefined })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) { setError(data?.message || 'Could not send your transfer details.'); return; }
      showToast(data.message || 'Transfer details sent.', 'success');
      setShowForm(false);
      onUpdated();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card-pad space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><Landmark className="w-5 h-5 text-cyan-400" />Pay by bank transfer</h2>
        <span className="badge badge-warning self-start"><Clock className="w-3 h-3" />Reserved until {deadline.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-3">
          <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
            <li>Send exactly <strong className="text-white">{formatPrice(ins.amount)}</strong> from your bank, bank app or RTGS/EFT.</li>
            <li>Use <strong className="font-mono text-white">{ins.reference}</strong> as the payment reference/narration.</li>
            <li>Tap <strong className="text-white">“I've paid”</strong> and enter the transaction reference from your slip.</li>
          </ol>
          <p className="text-xs text-slate-400">We dispatch as soon as the money reflects (same bank or RTGS: usually same day; EFT: 1–2 business days). Unpaid orders are released after {ins.holdHours} hours.</p>
        </div>
        {bank ? (
          <dl className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-1">
            <CopyValue label="Bank" value={bank.bankName} mono={false} />
            <CopyValue label="Branch" value={bank.branch} mono={false} />
            <CopyValue label="Account name" value={bank.accountName} mono={false} />
            <CopyValue label="Account number" value={bank.accountNumber} />
            <CopyValue label="SWIFT" value={bank.swiftCode} />
            <CopyValue label="Reference" value={ins.reference} />
            {bank.paybill && <CopyValue label="Or M-Pesa Pay Bill" value={`${bank.paybill} · Acc ${bank.paybillAccount || ins.reference}`} />}
          </dl>
        ) : (
          <div className="callout callout-warning">Our bank details are on your tax invoice (PDF). If they're missing, call {settings.phone} and we'll share them.</div>
        )}
      </div>

      {pending ? (
        <div className="callout callout-info items-center">
          <Hourglass className="w-4 h-4 shrink-0" />
          <p>We received your transfer details — <strong>{formatPrice(pending.amount)}</strong>, ref <strong className="font-mono">{pending.reference}</strong>. Our team is checking the bank statement and will email your receipt once it's confirmed.
            {' '}<button type="button" onClick={() => setShowForm(true)} className="underline font-semibold">Correct the details</button></p>
        </div>
      ) : order.paymentStatus === 'Failed' && order.latestPayment?.failureReason ? (
        <div className="callout callout-danger"><p>{order.latestPayment.failureReason} Please check your slip and submit the details again.</p></div>
      ) : null}

      {!pending && !showForm && (
        <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary"><Send className="w-4 h-4" />I've paid — send transfer details</button>
      )}

      {showForm && (
        <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bt-ref" className="field-label">Transaction reference <span className="text-rose-400">*</span></label>
              <input id="bt-ref" value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} maxLength={40} className="field-input font-mono" placeholder="e.g. FT26278ABC12" />
            </div>
            <div>
              <label htmlFor="bt-amount" className="field-label">Amount sent (KES) <span className="text-rose-400">*</span></label>
              <input id="bt-amount" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="field-input" />
            </div>
            <div>
              <label htmlFor="bt-date" className="field-label">Date paid <span className="text-rose-400">*</span></label>
              <input id="bt-date" type="date" max={today()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="field-input" />
            </div>
            <div>
              <label htmlFor="bt-bank" className="field-label">Your bank</label>
              <input id="bt-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={80} className="field-input" placeholder="e.g. Equity, KCB, Co-op" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="bt-payer" className="field-label">Name on the paying account</label>
              <input id="bt-payer" value={payerName} onChange={(e) => setPayerName(e.target.value)} maxLength={120} className="field-input" />
              <p className="field-hint">Helps us match company or third-party payments.</p>
            </div>
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={busy} className="btn btn-primary">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send for verification</button>
          </div>
        </form>
      )}
    </section>
  );
};
