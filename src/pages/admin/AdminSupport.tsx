import React, { useEffect, useState } from 'react';
import { HelpCircle, Send, Search, RefreshCw, Package, UserCheck, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { SupportTicket } from '../../types';
import { api, PageHeader, LoadingBlock, EmptyState, fmtDateTime } from './adminUi';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'] as const;
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
const STATUS_STYLE: Record<string, string> = { Open: 'badge-warning', 'In Progress': 'badge-info', Resolved: 'badge-success', Closed: 'badge-neutral' };
const PRIORITY_STYLE: Record<string, string> = { Urgent: 'badge-danger', High: 'badge-warning', Normal: 'badge-neutral', Low: 'badge-neutral' };

export const AdminSupport: React.FC = () => {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>('needs-reply');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [replyStatus, setReplyStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const qs = new URLSearchParams();
    if (filter === 'needs-reply') qs.set('awaiting', 'staff');
    else if (filter !== 'all') qs.set('status', filter);
    if (search.trim()) qs.set('search', search.trim());
    try {
      const data = await api<{ tickets: SupportTicket[]; counts: Record<string, number> }>(`/api/tickets?${qs}`);
      // "Needs reply" hides closed tickets the customer happened to write last on.
      const list = filter === 'needs-reply' ? data.tickets.filter((t) => t.status !== 'Closed') : data.tickets;
      setTickets(list);
      setCounts(data.counts || {});
      if (!selectedId || !list.some((t) => t.id === selectedId)) setSelectedId(list[0]?.id || null);
    } catch (e: any) {
      showToast(e.message, 'error');
      setTickets([]);
    }
  };
  useEffect(() => { setTickets(null); load(); }, [filter]);

  const selected = tickets?.find((t) => t.id === selectedId) || null;
  const replaceTicket = (t: SupportTicket) => setTickets((prev) => (prev || []).map((x) => (x.id === t.id ? t : x)));

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || reply.trim().length < 2) return;
    setBusy(true);
    try {
      const data = await api<{ ticket: SupportTicket }>(`/api/tickets/${selected.id}/reply`, { method: 'POST', body: { text: reply.trim(), status: replyStatus || undefined } });
      replaceTicket(data.ticket);
      setReply('');
      setReplyStatus('');
      showToast('Reply sent — the customer was emailed.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const patch = async (body: Record<string, unknown>) => {
    if (!selected) return;
    try {
      const data = await api<{ ticket: SupportTicket }>(`/api/tickets/${selected.id}`, { method: 'PATCH', body });
      replaceTicket(data.ticket);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const tabs = [
    { id: 'needs-reply', label: 'Needs reply' },
    ...STATUSES.map((s) => ({ id: s, label: `${s}${counts[s] ? ` (${counts[s]})` : ''}` })),
    { id: 'all', label: 'All' }
  ];

  return (
    <div className="space-y-6 animate-fadeInUp">
      <PageHeader
        icon={HelpCircle}
        title="Support tickets"
        description="Tickets from My Account and the Contact page. Replies are emailed to the customer and appear in their account."
        actions={<button type="button" onClick={load} className="btn btn-secondary"><RefreshCw className="w-4 h-4" />Refresh</button>}
      />

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setFilter(t.id)} className={`btn btn-sm shrink-0 ${filter === t.id ? 'btn-primary' : 'btn-ghost'}`}>{t.label}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="relative lg:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ticket, customer, email or order…" className="field-input pl-10" />
        </form>
      </div>

      {!tickets ? <LoadingBlock /> : tickets.length === 0 ? (
        <EmptyState title={filter === 'needs-reply' ? 'All caught up' : 'No tickets here'} text={filter === 'needs-reply' ? 'No customer is waiting for a reply.' : undefined} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <ul className="lg:col-span-5 card p-2 space-y-1 lg:max-h-[calc(100dvh-14rem)] overflow-y-auto overscroll-contain lg:sticky lg:top-20">
            {tickets.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setSelectedId(t.id)} aria-current={t.id === selectedId} className={`w-full text-left p-3 rounded-2xl border transition-colors space-y-1 ${t.id === selectedId ? 'border-cyan-600 bg-cyan-950/40' : 'border-transparent hover:bg-slate-800/50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-cyan-400">{t.ticketNumber}</span>
                    <span className={`badge ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                  </div>
                  <div className="font-semibold text-sm text-white truncate">{t.subject}</div>
                  <div className="text-xs text-slate-400 flex justify-between gap-2">
                    <span className="truncate">{t.customerName}</span>
                    <span className="shrink-0">{fmtDateTime(t.lastMessageAt)}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {t.awaiting === 'staff' && t.status !== 'Closed' && <span className="badge badge-danger">Awaiting reply</span>}
                    {t.priority !== 'Normal' && <span className={`badge ${PRIORITY_STYLE[t.priority] || 'badge-neutral'}`}>{t.priority}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <section className="lg:col-span-7 card flex flex-col">
              <div className="p-5 border-b border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-cyan-400">{selected.ticketNumber}</span>
                  <span className="badge badge-neutral">{selected.category}</span>
                  {selected.orderNumber && <a href={`/track-order?order=${encodeURIComponent(selected.orderNumber)}`} target="_blank" rel="noreferrer" className="badge badge-info"><Package className="w-3 h-3" />{selected.orderNumber}</a>}
                </div>
                <h3 className="text-lg font-bold text-white break-words">{selected.subject}</h3>
                <p className="text-sm text-slate-400 break-all">{selected.customerName} · {selected.customerEmail}{selected.customerPhone ? ` · ${selected.customerPhone}` : ''}{!selected.userId && ' · guest'}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="text-xs text-slate-400">Status
                    <select value={selected.status} onChange={(e) => patch({ status: e.target.value })} className="field-input mt-1">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                  </label>
                  <label className="text-xs text-slate-400">Priority
                    <select value={selected.priority} onChange={(e) => patch({ priority: e.target.value })} className="field-input mt-1">{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
                  </label>
                  <div className="text-xs text-slate-400">Assigned to
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-slate-200 truncate">{selected.assignedToName || 'Nobody'}</span>
                      <button type="button" onClick={() => patch({ assignToMe: true })} className="btn btn-ghost btn-sm" title="Assign to me"><UserCheck className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              </div>

              <ol className="p-5 space-y-3 max-h-[28rem] overflow-y-auto overscroll-contain">
                {selected.messages.map((m) => (
                  <li key={m.id} className={`rounded-2xl p-3.5 text-sm ${m.sender === 'staff' ? 'bg-cyan-950/40 border border-cyan-800/40 sm:ml-10' : 'bg-slate-950 border border-slate-800 sm:mr-10'}`}>
                    <div className="flex justify-between gap-3 text-xs mb-1">
                      <span className="font-bold text-slate-200">{m.sender === 'staff' ? `${m.senderName || 'Staff'} (staff)` : selected.customerName}</span>
                      <time className="text-slate-500">{fmtDateTime(m.timestamp)}</time>
                    </div>
                    <p className="text-slate-300 whitespace-pre-line break-words">{m.text}</p>
                  </li>
                ))}
              </ol>

              <form onSubmit={sendReply} className="p-5 border-t border-slate-800 space-y-3">
                <textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={5000} placeholder="Write a reply to the customer…" className="field-input" aria-label="Reply" />
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                  <select value={replyStatus} onChange={(e) => setReplyStatus(e.target.value)} className="field-input sm:!w-56" aria-label="Status after reply">
                    <option value="">Status: keep / In Progress</option>
                    <option value="Resolved">Reply & mark Resolved</option>
                    <option value="Closed">Reply & Close</option>
                  </select>
                  <button type="submit" disabled={busy || reply.trim().length < 2} className="btn btn-primary">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send reply</button>
                </div>
              </form>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
