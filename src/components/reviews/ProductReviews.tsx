import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MessageSquarePlus, Pencil, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { navigate } from '../../utils/navigation';
import { Review, RatingSummary } from '../../types';
import { StarDisplay, StarRatingInput } from './StarRating';

interface Props {
  productId: string;
  productName: string;
  initialReviews: Review[];
  initialSummary?: RatingSummary | null;
}

export const ProductReviews: React.FC<Props> = ({ productId, productName, initialReviews, initialSummary }) => {
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [summary, setSummary] = useState<RatingSummary | null>(initialSummary || null);
  const [mine, setMine] = useState<Review | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const refresh = () => fetch(`/api/reviews?productId=${productId}`).then((r) => r.json()).then((d) => {
    if (d?.success) { setReviews(d.reviews); setSummary(d.summary); }
  }).catch(() => {});

  useEffect(() => { setReviews(initialReviews); setSummary(initialSummary || null); }, [productId]);

  // The signed-in customer's own review (any moderation status) for edit-in-place.
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'CUSTOMER') { setMine(null); return; }
    fetch('/api/reviews/mine').then((r) => r.json()).then((d) => {
      const own = (d.reviews || []).find((r: Review) => r.productId === productId) || null;
      setMine(own);
      if (new URLSearchParams(window.location.search).get('review') === 'edit' && own) openForm(own);
    }).catch(() => {});
  }, [isAuthenticated, productId]);

  const openForm = (existing: Review | null = mine) => {
    if (!isAuthenticated) {
      showToast('Please sign in to write a review.', 'info');
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setRating(existing?.rating || 0);
    setTitle(existing?.title || '');
    setComment(existing?.comment || '');
    setErrors({});
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!rating) errs.rating = 'Choose a star rating';
    if (comment.trim().length < 10) errs.comment = 'Please write at least 10 characters';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, rating, title: title.trim() || null, comment: comment.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || 'Your review could not be saved.', 'error');
        return;
      }
      setMine(data.review);
      setFormOpen(false);
      showToast(data.message, 'success');
      refresh();
    } catch {
      showToast('Unable to reach the server. Your review was not saved.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const count = summary?.count ?? reviews.length;
  const avg = summary?.average ?? 0;
  const canReview = !user || user.role === 'CUSTOMER';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 text-center space-y-2">
          <div className="text-4xl font-black text-white">{count ? avg.toFixed(1) : '—'}</div>
          <StarDisplay value={avg} size="w-5 h-5" />
          <p className="text-sm text-slate-400">{count} review{count === 1 ? '' : 's'}</p>
        </div>
        <div className="md:col-span-2 space-y-2" aria-label="Rating breakdown">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = summary?.distribution?.[star as 1] ?? 0;
            const pct = count ? (n / count) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-3 text-sm">
                <span className="w-12 text-slate-400 shrink-0">{star} star</span>
                <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                <span className="w-8 text-right text-slate-400 shrink-0">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      {canReview && !formOpen && (
        <div className="flex flex-wrap items-center gap-3">
          {mine ? (
            <>
              <button type="button" onClick={() => openForm(mine)} className="btn btn-secondary"><Pencil className="w-4 h-4" aria-hidden="true" />Edit your review</button>
              {mine.status === 'pending' && <span className="badge badge-warning">Your review is awaiting moderation</span>}
              {mine.status === 'rejected' && <span className="badge badge-danger">Your review was not published{mine.moderationNote ? `: ${mine.moderationNote}` : ''}</span>}
            </>
          ) : (
            <button type="button" onClick={() => openForm(null)} className="btn btn-primary"><MessageSquarePlus className="w-4 h-4" aria-hidden="true" />Write a review</button>
          )}
        </div>
      )}

      {formOpen && (
        <form onSubmit={submit} className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5 space-y-4" noValidate>
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-white">{mine ? 'Edit your review' : `Review ${productName}`}</h4>
            <button type="button" onClick={() => setFormOpen(false)} className="icon-button" aria-label="Close review form"><X className="w-4 h-4" /></button>
          </div>
          <StarRatingInput value={rating} onChange={setRating} error={errors.rating} />
          <div>
            <label htmlFor="rv-title" className="field-label">Headline <span className="font-normal text-slate-500">(optional)</span></label>
            <input id="rv-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="field-input" placeholder="Sum it up in a few words" />
          </div>
          <div>
            <label htmlFor="rv-comment" className="field-label">Your review <span className="text-rose-400">*</span></label>
            <textarea id="rv-comment" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} className={`field-input resize-y ${errors.comment ? 'field-input-error' : ''}`} placeholder="What did you like or dislike? How has it performed?" />
            {errors.comment ? <p className="field-error">{errors.comment}</p> : <p className="field-hint">{comment.length}/2000 · Posted as {user?.name}. Reviews are checked before they appear.</p>}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button type="button" onClick={() => setFormOpen(false)} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}{mine ? 'Save changes' : 'Submit review'}</button>
          </div>
        </form>
      )}

      {reviews.length === 0 ? (
        <p className="text-center py-8 text-sm text-slate-400">No reviews yet. Bought this? Be the first to review it.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <StarDisplay value={r.rating} size="w-4 h-4" />
                <time className="text-xs text-slate-500" dateTime={r.date}>{new Date(r.date).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</time>
              </div>
              {r.title && <h4 className="text-sm font-bold text-white">{r.title}</h4>}
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{r.comment}</p>
              <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span className="font-semibold text-slate-200">{r.userName}{r.userCity ? ` · ${r.userCity}` : ''}</span>
                {r.verifiedPurchase && <span className="badge badge-success"><CheckCircle2 className="w-3 h-3" aria-hidden="true" />Verified purchase</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
