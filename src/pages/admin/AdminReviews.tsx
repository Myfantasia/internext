import React, { useEffect, useState } from 'react';
import { Star, Check, X, Trash2, ShieldCheck } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Review } from '../../types';
import { StarDisplay } from '../../components/reviews/StarRating';
import { api, PageHeader, StatusBadge, LoadingBlock, EmptyState, fmtDateTime } from './adminUi';

const TABS = [['pending', 'Awaiting moderation'], ['approved', 'Published'], ['rejected', 'Rejected'], ['', 'All']] as const;

export const AdminReviews: React.FC = () => {
  const { showToast } = useToast();
  const { can } = useAuth();
  const canModerate = can('reviews:moderate');
  const [status, setStatus] = useState<string>('pending');
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setReviews(null);
    api<{ reviews: Review[] }>(`/api/reviews/moderation${status ? `?status=${status}` : ''}`).then((d) => setReviews(d.reviews)).catch((e) => showToast(e.message, 'error'));
  };
  useEffect(() => { load(); }, [status]);

  const moderate = async (r: Review, next: 'approved' | 'rejected') => {
    let note: string | undefined;
    if (next === 'rejected') {
      const input = window.prompt('Reason (shown to the customer):', 'Does not meet our review guidelines.');
      if (input === null) return;
      note = input.trim() || undefined;
    }
    setBusy(r.id);
    try {
      await api(`/api/reviews/${r.id}/moderation`, { method: 'PATCH', body: { status: next, note } });
      showToast(next === 'approved' ? 'Review published' : 'Review rejected', 'success');
      setReviews((list) => (list || []).filter((x) => status === '' || x.id !== r.id).map((x) => (x.id === r.id ? { ...x, status: next } : x)));
    } catch (e) { showToast((e as Error).message, 'error'); } finally { setBusy(null); }
  };

  const remove = async (r: Review) => {
    if (!window.confirm('Permanently delete this review?')) return;
    try { await api(`/api/reviews/${r.id}`, { method: 'DELETE' }); setReviews((list) => (list || []).filter((x) => x.id !== r.id)); }
    catch (e) { showToast((e as Error).message, 'error'); }
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <PageHeader icon={Star} title="Reviews" description="New and edited reviews wait here until approved. Only approved reviews appear on the store and count toward product ratings. 'Verified purchase' is set automatically when the reviewer has a paid order for the product." />

      <div className="flex gap-2 overflow-x-auto scrollbar-none" role="tablist">
        {TABS.map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={status === v} onClick={() => setStatus(v)} className={`btn btn-sm shrink-0 ${status === v ? 'btn-primary' : 'btn-secondary'}`}>{l}</button>)}
      </div>

      {!reviews ? <LoadingBlock /> : reviews.length === 0 ? (
        <EmptyState title={status === 'pending' ? 'Nothing waiting for moderation' : 'No reviews here'} />
      ) : (
        <ul className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {reviews.map((r) => (
            <li key={r.id} className="card p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <a href={`/products/${r.productSlug}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-cyan-400 hover:underline">{r.productName}</a>
                  <div className="flex items-center gap-2 mt-1"><StarDisplay value={r.rating} /><span className="text-xs text-slate-400">{fmtDateTime(r.date)}</span></div>
                </div>
                <StatusBadge state={r.status || 'approved'} />
              </div>
              {r.title && <p className="font-semibold text-white">{r.title}</p>}
              <p className="text-sm text-slate-300 whitespace-pre-line">{r.comment}</p>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs text-slate-400">
                <span>{r.userName}{r.userCity ? ` · ${r.userCity}` : ''}</span>
                {r.verifiedPurchase ? <span className="badge badge-success"><ShieldCheck className="w-3 h-3" />Verified purchase</span> : <span className="badge badge-neutral">Not a verified purchase</span>}
              </div>
              {r.moderationNote && <p className="text-xs text-slate-400">Note: {r.moderationNote}</p>}
              {canModerate && (
                <div className="flex flex-wrap gap-2">
                  {r.status !== 'approved' && <button type="button" disabled={busy === r.id} onClick={() => moderate(r, 'approved')} className="btn btn-primary btn-sm"><Check className="w-4 h-4" />Approve</button>}
                  {r.status !== 'rejected' && <button type="button" disabled={busy === r.id} onClick={() => moderate(r, 'rejected')} className="btn btn-secondary btn-sm"><X className="w-4 h-4" />Reject</button>}
                  <button type="button" onClick={() => remove(r)} className="btn btn-ghost btn-sm"><Trash2 className="w-4 h-4" />Delete</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
