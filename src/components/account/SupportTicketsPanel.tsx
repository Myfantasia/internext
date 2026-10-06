import React, { useEffect, useState } from 'react';
import { LifeBuoy, Send, Loader2, Plus, ChevronDown, CheckCircle2, MessageSquare, Package, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Order, SupportTicket } from '../../types';

// Customer side of support: open a ticket (optionally about an order), follow
// the conversation, reply, and close it once sorted.

const CATEGORIES = ['Order & Delivery', 'Payment & Invoice', 'Product Inquiry', 'Warranty & Repairs', 'Returns & Refunds', 'Account & Login', 'Other'];

const STATUS_STYLE: Record<string, string> = {
  Open: 'badge-warning', 'In Progress': 'badge-info', Resolved: 'badge-success', Closed: 'badge-neutral'
};

const when = (v: string) => new Date(v).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });

export const SupportTicketsPanel: React.FC<{ orders: Order[]; onCountChange?: (n: number) => void }> = ({ orders, onCountChange }) => {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // New ticket
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [orderNumber, setOrderNumber] = useState('');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);

  // Replies, per ticket
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/tickets/mine', { cache: 'no-store' });
      const data = await res.json();
      const list: SupportTicket[] = data?.tickets || [];
      setTickets(list);
      if (!list.length) setShowForm(true);
    } catch {
      setTickets([]);
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (tickets) onCountChange?.(tickets.filter((t) => t.status !== 'Closed').length); }, [tickets]);

  const replace = (ticket: SupportTicket) => setTickets((prev) => [ticket, ...(prev || []).filter((t) => t.id !== ticket.id)]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 4 || message.trim().length < 2) { showToast('Add a subject and describe the issue', 'error'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), category, message: message.trim(), orderNumber: orderNumber || null })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) { showToast(data?.message || 'Could not open the ticket', 'error'); return; }
      replace(data.ticket);
      setOpenId(data.ticket.id);
      setShowForm(false);
      setSubject(''); setMessage(''); setOrderNumber('');
      showToast(`Ticket ${data.ticket.ticketNumber} opened — we'll reply by email and here.`, 'success');
    } finally {
      setCreating(false);
    }
  };

  const reply = async (ticket: SupportTicket) => {
    const text = (drafts[ticket.id] || '').trim();
    if (text.length < 2) return;
    setBusy(ticket.id);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) { showToast(data?.message || 'Could not send your reply', 'error'); return; }
      replace(data.ticket);
      setDrafts((d) => ({ ...d, [ticket.id]: '' }));
    } finally {
      setBusy(null);
    }
  };

  const close = async (ticket: SupportTicket) => {
    if (!window.confirm('Mark this ticket as solved and close it? You can reopen it by replying.')) return;
    setBusy(ticket.id);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/close`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (data?.success) { replace(data.ticket); showToast('Ticket closed. Glad we could help!', 'success'); }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5 animate-fadeInUp">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><LifeBuoy className="w-5 h-5 text-cyan-400" />Support tickets</h2>
          <p className="text-sm text-slate-400">Questions about an order, payment, warranty or a product? We reply here and by email, usually within one business day.</p>
        </div>
        {!showForm && <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary btn-sm shrink-0"><Plus className="w-4 h-4" />New ticket</button>}
      </div>

      {showForm && (
        <form onSubmit={create} className="card card-pad space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-white">Open a new ticket</h3>
            {!!tickets?.length && <button type="button" onClick={() => setShowForm(false)} className="icon-button" aria-label="Cancel"><X className="w-4 h-4" /></button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="t-category" className="field-label">What is it about?</label>
              <select id="t-category" value={category} onChange={(e) => setCategory(e.target.value)} className="field-input">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="t-order" className="field-label">Related order <span className="text-slate-500 font-normal">(optional)</span></label>
              <select id="t-order" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="field-input">
                <option value="">Not about a specific order</option>
                {orders.map((o) => <option key={o.id} value={o.orderNumber}>{o.orderNumber} · {new Date(o.createdAt).toLocaleDateString()} · {o.status}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="t-subject" className="field-label">Subject</label>
            <input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} placeholder="e.g. Laptop charger not working" className="field-input" required />
          </div>
          <div>
            <label htmlFor="t-message" className="field-label">Describe the issue</label>
            <textarea id="t-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} placeholder="Include model numbers, error messages, or what you've already tried." className="field-input" required />
          </div>
          <button type="submit" disabled={creating} className="btn btn-primary">{creating ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : <><Send className="w-4 h-4" />Submit ticket</>}</button>
        </form>
      )}

      {tickets === null ? (
        <div className="card card-pad flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" />Loading your tickets…</div>
      ) : tickets.length > 0 && (
        <ul className="space-y-3">
          {tickets.map((t) => {
            const open = openId === t.id;
            const closed = t.status === 'Closed';
            return (
              <li key={t.id} className="card overflow-hidden">
                <button type="button" onClick={() => setOpenId(open ? null : t.id)} aria-expanded={open} className="w-full text-left p-4 sm:p-5 flex items-start gap-3 hover:bg-slate-800/30 transition-colors">
                  <MessageSquare className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-400">{t.ticketNumber}</span>
                      <span className={`badge ${STATUS_STYLE[t.status] || 'badge-neutral'}`}>{t.status}</span>
                      {t.awaiting === 'customer' && !closed && t.messages.some((m) => m.sender === 'staff') && <span className="badge badge-success">New reply</span>}
                    </div>
                    <div className="font-semibold text-white break-words">{t.subject}</div>
                    <div className="text-xs text-slate-400 flex flex-wrap gap-x-3">
                      <span>{t.category}</span>
                      {t.orderNumber && <span className="inline-flex items-center gap-1"><Package className="w-3 h-3" />{t.orderNumber}</span>}
                      <span>Updated {when(t.lastMessageAt)}</span>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && (
                  <div className="border-t border-slate-800 p-4 sm:p-5 space-y-4">
                    <ol className="space-y-3 max-h-[28rem] overflow-y-auto overscroll-contain pr-1">
                      {t.messages.map((m) => (
                        <li key={m.id} className={`rounded-2xl p-3.5 text-sm ${m.sender === 'staff' ? 'bg-cyan-950/40 border border-cyan-800/40 sm:mr-10' : 'bg-slate-950 border border-slate-800 sm:ml-10'}`}>
                          <div className="flex items-center justify-between gap-3 text-xs mb-1">
                            <span className="font-bold text-slate-200">{m.sender === 'staff' ? `${m.senderName || 'Support team'} · Internext` : 'You'}</span>
                            <time className="text-slate-500">{when(m.timestamp)}</time>
                          </div>
                          <p className="text-slate-300 whitespace-pre-line break-words">{m.text}</p>
                        </li>
                      ))}
                    </ol>
                    <div className="space-y-2">
                      <label htmlFor={`reply-${t.id}`} className="field-label">{closed ? 'Reply to reopen this ticket' : 'Your reply'}</label>
                      <textarea id={`reply-${t.id}`} rows={3} value={drafts[t.id] || ''} onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))} maxLength={5000} className="field-input" placeholder="Type your message…" />
                      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
                        {!closed ? (
                          <button type="button" onClick={() => close(t)} disabled={busy === t.id} className="btn btn-ghost btn-sm"><CheckCircle2 className="w-4 h-4" />My issue is solved</button>
                        ) : <span />}
                        <button type="button" onClick={() => reply(t)} disabled={busy === t.id || (drafts[t.id] || '').trim().length < 2} className="btn btn-primary btn-sm">
                          {busy === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send reply
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
