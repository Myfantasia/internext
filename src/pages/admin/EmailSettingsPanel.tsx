import React, { useState } from 'react';
import { Mail, Send, PlugZap, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { api } from './adminUi';

// SMTP is configured in the server .env (see .env.example → Email). This panel
// checks the connection and sends a branded test email to the signed-in admin.
export const EmailSettingsPanel: React.FC = () => {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<'check' | 'send' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const check = async () => {
    setBusy('check');
    try {
      const d = await api<{ provider: string; note?: string }>('/api/admin/email/status');
      setResult({ ok: true, text: d.provider === 'smtp' ? 'Connected and authenticated with the SMTP server.' : `Provider "${d.provider}" — ${d.note || 'emails are only printed to the server log.'}` });
    } catch (e) { setResult({ ok: false, text: (e as Error).message }); } finally { setBusy(null); }
  };
  const send = async () => {
    setBusy('send');
    try {
      const d = await api<{ sentTo: string; provider: string }>('/api/admin/email/test', { method: 'POST' });
      setResult({ ok: true, text: `Test email sent to ${d.sentTo} via ${d.provider}. Check the inbox (and spam folder).` });
      showToast('Test email sent', 'success');
    } catch (e) { setResult({ ok: false, text: (e as Error).message }); } finally { setBusy(null); }
  };

  return (
    <section className="mt-8 max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
      <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2"><Mail className="w-4 h-4" />Email delivery</h3>
      <p className="text-sm text-slate-400">Sender name, reply-to address, branding colours, logo and footer are set with the <code>EMAIL_*</code> variables in the server's <code>.env</code>; SMTP credentials with <code>SMTP_*</code>.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={check} disabled={!!busy} className="btn btn-secondary">{busy === 'check' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}Check connection</button>
        <button type="button" onClick={send} disabled={!!busy} className="btn btn-primary">{busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send me a test email</button>
      </div>
      {result && <p className={`callout ${result.ok ? 'callout-success' : 'callout-danger'}`} role="status">{result.text}</p>}
    </section>
  );
};
