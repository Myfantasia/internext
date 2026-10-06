import React, { useEffect, useRef, useState } from 'react';
import { Smartphone, CheckCircle2, AlertCircle, Loader2, RefreshCw, ShieldCheck, X, Clock } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Portal, useBodyScrollLock } from '../common/Overlay';

interface MpesaModalProps {
  orderId: string;
  orderNumber: string;
  phone: string;
  amount: number;
  onSuccess: (orderNumber: string) => void;
  onClose: () => void;
}

type Step = 'confirm' | 'sending' | 'waiting' | 'success' | 'failed';

const POLL_MS = 3000;
const GIVE_UP_MS = 3.5 * 60 * 1000;

// STK Push flow. The customer types their M-Pesa PIN on their PHONE only —
// this page never asks for it. Success is shown only after the server has
// confirmed the payment with Safaricom.
export const MpesaModal: React.FC<MpesaModalProps> = ({ orderId, orderNumber, phone, amount, onSuccess, onClose }) => {
  const { formatPrice } = useStore();
  useBodyScrollLock();
  const [step, setStep] = useState<Step>('confirm');
  const [payPhone, setPayPhone] = useState(phone);
  const [message, setMessage] = useState('');
  const [simulated, setSimulated] = useState(false);
  const pollRef = useRef<number | null>(null);
  const startedAt = useRef<number>(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  const stopPolling = () => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
    pollRef.current = null;
  };
  useEffect(() => () => stopPolling(), []);
  useEffect(() => { dialogRef.current?.focus(); }, []);

  const poll = async () => {
    try {
      const res = await fetch(`/api/payments/orders/${orderId}/status`, { cache: 'no-store' });
      const data = await res.json();
      if (data.paymentStatus === 'Paid') {
        setStep('success');
        stopPolling();
        window.setTimeout(() => onSuccess(orderNumber), 1500);
        return;
      }
      const attempt = data.attempt;
      if (attempt && ['failed', 'cancelled'].includes(attempt.status)) {
        setStep('failed');
        setMessage(attempt.failureReason || 'The M-Pesa payment was not completed.');
        stopPolling();
        return;
      }
    } catch {
      // transient network error — keep polling
    }
    if (Date.now() - startedAt.current > GIVE_UP_MS) {
      setStep('failed');
      setMessage("We haven't received confirmation from M-Pesa yet. If money left your account, don't pay again — it will reflect on your order shortly, or contact us with your M-Pesa message.");
      return;
    }
    pollRef.current = window.setTimeout(poll, POLL_MS);
  };

  const sendPrompt = async () => {
    setStep('sending');
    setMessage('');
    try {
      const res = await fetch(`/api/payments/orders/${orderId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'mpesa', phone: payPhone })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStep('failed');
        setMessage(data.message || 'We could not send the M-Pesa prompt.');
        return;
      }
      setSimulated(!!data.simulated);
      setMessage(data.customerMessage || '');
      setStep('waiting');
      startedAt.current = Date.now();
      pollRef.current = window.setTimeout(poll, POLL_MS);
    } catch {
      setStep('failed');
      setMessage('Unable to reach the server. Check your connection and try again.');
    }
  };

  return (
    <Portal>
    <div className="modal-backdrop" onKeyDown={(e) => { if (e.key === 'Escape' && step !== 'sending') onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="mpesa-title" className="modal-panel modal-medium outline-none !overflow-y-auto">
        <div className="bg-emerald-700 px-5 py-4 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 grid place-items-center"><Smartphone className="w-5 h-5" aria-hidden="true" /></div>
            <div>
              <h2 id="mpesa-title" className="font-black text-base text-white">Pay with M-Pesa</h2>
              <p className="text-xs text-emerald-100">Order {orderNumber} · {formatPrice(amount)}</p>
            </div>
          </div>
          {step !== 'sending' && (
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-emerald-50 hover:bg-white/15" aria-label="Close">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5" aria-live="polite">
          {step === 'confirm' && (
            <>
              <p className="text-sm text-slate-300">We'll send a payment request to this Safaricom number. Approve it on your phone by entering your M-Pesa PIN.</p>
              <div>
                <label htmlFor="mpesa-phone" className="field-label">M-Pesa phone number</label>
                <input id="mpesa-phone" type="tel" inputMode="tel" value={payPhone} onChange={(e) => setPayPhone(e.target.value)} className="field-input font-mono" autoComplete="tel" />
              </div>
              <div className="callout callout-info">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p>Never share your M-Pesa PIN. We will never ask for it on this website, by phone or by SMS.</p>
              </div>
              <button type="button" onClick={sendPrompt} className="btn btn-primary btn-lg w-full !bg-emerald-600 hover:!bg-emerald-500">
                Send payment request of {formatPrice(Math.ceil(amount))}
              </button>
            </>
          )}

          {step === 'sending' && (
            <div className="py-6 text-center space-y-3">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-emerald-400" aria-hidden="true" />
              <p className="text-sm text-slate-300">Contacting M-Pesa…</p>
            </div>
          )}

          {step === 'waiting' && (
            <div className="py-2 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-950/60 border border-emerald-800 grid place-items-center">
                <Smartphone className="w-8 h-8 text-emerald-400 animate-pulse" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-white">Check your phone</h3>
                <p className="text-sm text-slate-400 mt-1">Enter your M-Pesa PIN in the prompt on <span className="font-mono text-slate-200">{payPhone}</span> to approve {formatPrice(Math.ceil(amount))}.</p>
              </div>
              {simulated && <p className="callout callout-warning text-left">Development simulation: no real prompt is sent. The payment will confirm automatically in a few seconds.</p>}
              <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5"><Clock className="w-3.5 h-3.5" aria-hidden="true" />Waiting for confirmation from Safaricom…</p>
            </div>
          )}

          {step === 'success' && (
            <div className="py-4 text-center space-y-3">
              <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-400" aria-hidden="true" />
              <h3 className="font-bold text-white text-lg">Payment confirmed</h3>
              <p className="text-sm text-slate-400">Thank you! Opening your order…</p>
            </div>
          )}

          {step === 'failed' && (
            <div className="space-y-4">
              <div className="callout callout-danger" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p>{message}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={() => setStep('confirm')} className="btn btn-primary flex-1"><RefreshCw className="w-4 h-4" aria-hidden="true" /> Try again</button>
                <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Choose another method</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
};
