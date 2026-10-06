import React, { useId, useState } from 'react';
import { Star } from 'lucide-react';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

// Read-only stars (supports halves via a clipped overlay).
export const StarDisplay: React.FC<{ value: number; size?: string; className?: string; label?: string }> = ({ value, size = 'w-4 h-4', className = '', label }) => (
  <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={label || `${value.toFixed(1)} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => {
      const fill = Math.max(0, Math.min(1, value - (i - 1)));
      return (
        <span key={i} className={`relative inline-block ${size}`} aria-hidden="true">
          <Star className={`${size} text-slate-600`} />
          {fill > 0 && (
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={`${size} fill-amber-400 text-amber-400`} />
            </span>
          )}
        </span>
      );
    })}
  </span>
);

// Accessible 1–5 star input: a radio group (arrow keys work natively), hover
// preview, large touch targets, and a text label for the chosen value.
export const StarRatingInput: React.FC<{ value: number; onChange: (v: number) => void; error?: string; label?: string }> = ({ value, onChange, error, label = 'Your rating' }) => {
  const [hover, setHover] = useState(0);
  const name = useId();
  const shown = hover || value;
  return (
    <fieldset>
      <legend className="field-label">{label} <span className="text-rose-400">*</span></legend>
      <div className="flex flex-wrap items-center gap-3">
        <div className="star-input" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <label key={i} className="cursor-pointer rounded-lg p-1 focus-within:outline focus-within:outline-2 focus-within:outline-[var(--t-accent)]" onMouseEnter={() => setHover(i)}>
              <input type="radio" name={name} value={i} checked={value === i} onChange={() => onChange(i)} className="sr-only" aria-label={`${i} star${i > 1 ? 's' : ''} — ${LABELS[i]}`} />
              <Star className={`w-8 h-8 transition-transform ${i <= shown ? 'fill-amber-400 text-amber-400' : 'text-slate-500'} ${hover === i ? 'scale-110' : ''}`} aria-hidden="true" />
            </label>
          ))}
        </div>
        <span className="text-sm font-semibold text-slate-300 min-w-[6rem]" aria-live="polite">{shown ? LABELS[shown] : 'Tap to rate'}</span>
      </div>
      {error && <p className="field-error">{error}</p>}
    </fieldset>
  );
};
