import React, { useEffect, useState } from 'react';
import { Loader2, Trash2, Pencil, Star } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { StarDisplay } from '../reviews/StarRating';
import { Review } from '../../types';

const STATUS_BADGE: Record<string, { cls: string; text: string }> = {
  approved: { cls: 'badge-success', text: 'Published' },
  pending: { cls: 'badge-warning', text: 'Awaiting moderation' },
  rejected: { cls: 'badge-danger', text: 'Not published' }
};

export const MyReviewsPanel: React.FC = () => {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<Review[] | null>(null);

  const load = () => fetch('/api/reviews/mine', { cache: 'no-store' }).then((r) => r.json()).then((d) => setReviews(d.reviews || [])).catch(() => setReviews([]));
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!window.confirm('Delete this review?')) return;
    const res = await fetch(`/api/reviews/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Review deleted', 'success'); load(); } else showToast('Could not delete the review', 'error');
  };

  if (!reviews) return <div className="card card-pad text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading your reviews…</div>;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <h2 className="text-lg font-bold text-white">My reviews</h2>
      </div>
      {reviews.length === 0 ? (
        <div className="card card-pad text-center space-y-2">
          <Star className="w-8 h-8 mx-auto text-slate-500" aria-hidden="true" />
          <p className="text-sm text-slate-400">You haven't reviewed anything yet. Open any product you bought and use "Write a review".</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => {
            const badge = STATUS_BADGE[r.status || 'approved'];
            return (
              <li key={r.id} className="card p-5 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <a href={`/products/${r.productSlug}`} className="font-semibold text-white hover:underline">{r.productName}</a>
                    <div className="flex items-center gap-2 mt-1"><StarDisplay value={r.rating} />{r.verifiedPurchase && <span className="badge badge-success">Verified purchase</span>}</div>
                  </div>
                  <span className={`badge ${badge.cls}`}>{badge.text}</span>
                </div>
                {r.title && <p className="font-semibold text-slate-200">{r.title}</p>}
                <p className="text-sm text-slate-300 whitespace-pre-line">{r.comment}</p>
                {r.status === 'rejected' && r.moderationNote && <p className="callout callout-danger text-xs">Moderator note: {r.moderationNote}</p>}
                <div className="flex gap-2 pt-1">
                  <a href={`/products/${r.productSlug}?review=edit`} className="btn btn-ghost btn-sm"><Pencil className="w-4 h-4" aria-hidden="true" />Edit</a>
                  <button type="button" onClick={() => remove(r.id)} className="btn btn-ghost btn-sm"><Trash2 className="w-4 h-4" aria-hidden="true" />Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
