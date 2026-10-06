import React, { useEffect, useState } from 'react';
import { CreditCard, Smartphone, RefreshCw, AlertTriangle, Landmark, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { api, PageHeader, StatusBadge, LoadingBlock, EmptyState, Modal, Field, fmtDateTime, kes } from './adminUi';

const PROVIDER_LABEL: Record<string, string> = { mpesa: 'M-Pesa', stripe: 'Card', bank_transfer: 'Bank transfer', cash_on_delivery: 'Pay on delivery' };

interface Transfer {
  id: string; status: string; amount: number; reference: string; payerName: string | null; bankName: string | null;
  paidOn: string | null; failureReason: string | null; createdAt: string;
  order: { id: string; orderNumber: string; total: number; customerName: string; customerEmail: string; customerPhone: string | null; status: string; paymentStatus: string };
}

// Transfers customers reported ("I've paid"). Staff match each one to the bank
// statement, then approve (issues the receipt) or reject with a reason.
const BankTransferQueue: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const { showToast } = useToast();
  const [items, setItems] = useState<Transfer[] | null>(null);
  const [reviewing, setReviewing] = useState<{ t: Transfer; approve: boolean } | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api<{ transfers: Transfer[] }>('/api/payments/bank-transfers?status=pending').then((d) => setItems(d.transfers)).catch((e) => showToast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  const open = (t: Transfer, approve: boolean) => { setReviewing({ t, approve }); setAmount(String(t.amount)); setReason(''); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewing) return;
    setBusy(true);
    try {
      await api(`/api/payments/bank-transfers/${reviewing.t.id}/review`, {
        method: 'POST', body: reviewing.approve ? { approve: true, amountReceived: Number(amount) } : { approve: false, reason: reason.trim() }
      });
      showToast(reviewing.approve ? `Payment confirmed for ${reviewing.t.order.orderNumber}. Receipt issued.` : 'Transfer rejected. The customer was emailed.', 'success');
      setReviewing(null);
      load();
      onChanged();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="text-base font-bold text-white flex items-center gap-2"><Landmark className="w-4 h-4 text-cyan-400" />Bank transfers to verify {items && items.length > 0 && <span className="badge badge-warning">{items.length}</span>}</h3>
      {!items ? <LoadingBlock /> : items.length === 0 ? (
        <EmptyState title="No transfers waiting" text="When a customer reports a bank transfer, it appears here for you to check against the statement." />
      ) : (
        <div className="card overflow-hidden"><div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Reported</th><th>Order</th><th>Customer</th><th>Amount sent</th><th>Reference</th><th>Bank / payer</th><th className="text-right">Decision</th></tr></thead>
            <tbody>{items.map((t) => (
              <tr key={t.id}>
                <td className="text-xs whitespace-nowrap">{fmtDateTime(t.createdAt)}{t.paidOn && <div className="text-slate-500">paid {new Date(t.paidOn).toLocaleDateString('en-KE')}</div>}</td>
                <td className="whitespace-nowrap"><div className="font-mono text-xs text-cyan-400">{t.order.orderNumber}</div><div className="text-xs text-slate-400">due {kes(t.order.total)}</div></td>
                <td className="text-xs"><div className="text-slate-200">{t.order.customerName}</div><div className="text-slate-500 break-all">{t.order.customerPhone || t.order.customerEmail}</div></td>
                <td className={`whitespace-nowrap font-semibold ${t.amount < t.order.total ? 'text-rose-400' : ''}`}>{kes(t.amount)}{t.amount < t.order.total && <div className="text-xs font-normal">short by {kes(t.order.total - t.amount)}</div>}</td>
                <td className="font-mono text-xs break-all">{t.reference}</td>
                <td className="text-xs">{[t.bankName, t.payerName].filter(Boolean).join(' · ') || '—'}</td>
                <td className="text-right whitespace-nowrap">
                  <button type="button" onClick={() => open(t, true)} className="btn btn-primary btn-sm"><CheckCircle2 className="w-4 h-4" />Approve</button>{' '}
                  <button type="button" onClick={() => open(t, false)} className="btn btn-ghost btn-sm"><XCircle className="w-4 h-4" />Reject</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div></div>
      )}

      {reviewing && (
        <Modal
          size="medium"
          title={reviewing.approve ? `Confirm payment for ${reviewing.t.order.orderNumber}` : `Reject transfer ${reviewing.t.reference}`}
          description={reviewing.approve ? 'Only approve after you have seen this amount and reference on the bank statement.' : 'The customer is emailed this reason and can submit corrected details.'}
          onClose={() => setReviewing(null)}
          footer={<>
            <button type="button" onClick={() => setReviewing(null)} className="btn btn-secondary">Cancel</button>
            <button type="submit" form="review-form" disabled={busy} className={`btn ${reviewing.approve ? 'btn-primary' : 'btn-danger'}`}>{busy ? 'Saving…' : reviewing.approve ? 'Confirm payment' : 'Reject transfer'}</button>
          </>}
        >
          <form id="review-form" onSubmit={submit} className="space-y-4">
            {reviewing.approve ? (
              <Field label="Amount that reached the account (KES)" htmlFor="rv-amount" required hint={`Order total: ${kes(reviewing.t.order.total)}. Less than the total cannot be approved.`}>
                <input id="rv-amount" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="field-input" required />
              </Field>
            ) : (
              <Field label="Reason" htmlFor="rv-reason" required>
                <textarea id="rv-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="field-input" placeholder="e.g. No transfer with this reference reached our account yet." required />
              </Field>
            )}
          </form>
        </Modal>
      )}
    </section>
  );
};

interface Attempt {
  id: string; orderId: string; provider: string; status: string; amount: number; currency: string;
  reference: string | null; payerHint: string | null; failureReason: string | null; createdAt: string; completedAt: string | null;
}
interface Methods { mpesa: { available: boolean; mode: string | null }; card: { available: boolean; testMode: boolean } }

export const AdminPayments: React.FC = () => {
  const { showToast } = useToast();
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [methods, setMethods] = useState<Methods | null>(null);
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('');

  const load = () => {
    setAttempts(null);
    const qs = new URLSearchParams();
    if (provider) qs.set('provider', provider);
    if (status) qs.set('status', status);
    api<{ attempts: Attempt[] }>(`/api/payments?${qs}`).then((d) => setAttempts(d.attempts)).catch((e) => showToast(e.message, 'error'));
  };
  useEffect(() => { load(); }, [provider, status]);
  useEffect(() => { api<Methods>('/api/payments/methods').then(setMethods).catch(() => {}); }, []);

  const totals = (attempts || []).reduce((acc, a) => {
    if (a.status === 'succeeded') acc.paid += a.amount;
    if (a.status === 'pending') acc.pending += 1;
    if (a.status === 'failed' || a.status === 'cancelled') acc.failed += 1;
    return acc;
  }, { paid: 0, pending: 0, failed: 0 });

  return (
    <div className="space-y-6 animate-fadeInUp">
      <PageHeader
        icon={CreditCard}
        title="Payments & transactions"
        description="Every payment attempt. Online payments are marked paid only from a verified provider result (Daraja callback re-checked with Safaricom, or a signed Stripe webhook). Bank transfers are verified below; money collected on delivery is recorded from the Orders page."
        actions={<button type="button" onClick={load} className="btn btn-secondary"><RefreshCw className="w-4 h-4" />Refresh</button>}
      />

      {methods && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="card p-4 flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-sm"><div className="font-semibold text-white">M-Pesa (Daraja)</div><div className="text-slate-400">{methods.mpesa.available ? `Configured · mode: ${methods.mpesa.mode}` : 'Not configured — set the MPESA_* variables on the server.'}</div></div>
          </div>
          <div className="card p-4 flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-cyan-400 shrink-0" />
            <div className="text-sm"><div className="font-semibold text-white">Cards (Stripe Checkout)</div><div className="text-slate-400">{methods.card.available ? (methods.card.testMode ? 'Configured · TEST mode (no real charges)' : 'Configured · LIVE') : 'Not configured — set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.'}</div></div>
          </div>
          {methods.mpesa.mode === 'simulation' && (
            <div className="md:col-span-2 callout callout-warning"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>M-Pesa is in <strong>simulation</strong> mode: payments are faked for local testing. Never use this on a live store.</span></div>
          )}
        </div>
      )}

      <BankTransferQueue onChanged={load} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4"><div className="text-xs text-slate-400">Collected (listed)</div><div className="text-xl font-black text-white">{kes(totals.paid)}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-400">In progress</div><div className="text-xl font-black text-amber-300">{totals.pending}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-400">Failed / cancelled</div><div className="text-xl font-black text-rose-400">{totals.failed}</div></div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="field-input !w-auto" aria-label="Provider"><option value="">All providers</option><option value="mpesa">M-Pesa</option><option value="stripe">Card (Stripe)</option><option value="bank_transfer">Bank transfer</option><option value="cash_on_delivery">Pay on delivery</option></select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="field-input !w-auto" aria-label="Status"><option value="">All statuses</option>{['pending', 'succeeded', 'failed', 'cancelled', 'refunded'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </div>

      {!attempts ? <LoadingBlock /> : attempts.length === 0 ? <EmptyState title="No payment attempts match" /> : (
        <div className="card overflow-hidden"><div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Provider</th><th>Amount</th><th>Reference</th><th>Payer</th><th>Status</th><th>Order</th></tr></thead>
            <tbody>{attempts.map((a) => (
              <tr key={a.id}>
                <td className="text-xs whitespace-nowrap">{fmtDateTime(a.createdAt)}</td>
                <td className="whitespace-nowrap">{PROVIDER_LABEL[a.provider] || a.provider}</td>
                <td className="whitespace-nowrap font-semibold">{kes(a.amount)}</td>
                <td className="font-mono text-xs break-all">{a.reference || '—'}</td>
                <td className="font-mono text-xs">{a.payerHint || '—'}</td>
                <td><StatusBadge state={a.status} />{a.failureReason && <div className="text-xs text-slate-400 max-w-[220px] mt-1">{a.failureReason}</div>}</td>
                <td><a href={`/order-confirmation?orderNumber=${a.orderId}`} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:underline">View</a></td>
              </tr>
            ))}</tbody>
          </table>
        </div></div>
      )}
    </div>
  );
};
