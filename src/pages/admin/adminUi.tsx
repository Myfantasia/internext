import React, { useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Portal, useBodyScrollLock, useEscapeKey } from '../../components/common/Overlay';

// Shared building blocks for admin pages so every section looks and behaves the same.

export async function api<T = any>(url: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) throw new Error(data?.message || `Request failed (${res.status})`);
  return data as T;
}

export const PageHeader: React.FC<{ title: string; description?: string; icon?: React.ComponentType<{ className?: string }>; actions?: React.ReactNode }> = ({ title, description, icon: Icon, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
    <div className="min-w-0">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">{Icon && <Icon className="w-5 h-5 text-cyan-400 shrink-0" />}{title}</h2>
      {description && <p className="text-sm text-slate-400 mt-1 max-w-3xl">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
  </div>
);

// Wide modal on desktop, bottom sheet on phones; Esc closes, focus moves in.
export const Modal: React.FC<{ title: string; description?: string; onClose: () => void; children: React.ReactNode; size?: 'medium' | 'wide'; footer?: React.ReactNode }> = ({ title, description, onClose, children, size = 'wide', footer }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useEscapeKey(onClose);
  useBodyScrollLock();
  // Header and footer stay put; only the body scrolls, so the title and the
  // Save button are always visible however long the form is.
  return (
    <Portal>
      <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`modal-panel ${size === 'wide' ? 'modal-wide' : 'modal-medium'} outline-none`}>
          <div className="modal-head flex items-start justify-between gap-4 px-5 sm:px-7 py-4 border-b border-slate-800">
            <div className="min-w-0">
              <h3 id="modal-title" className="text-lg font-bold text-white">{title}</h3>
              {description && <p className="text-sm text-slate-400 mt-0.5">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="icon-button shrink-0" aria-label="Close"><X className="w-5 h-5" /></button>
          </div>
          <div className="modal-body px-5 sm:px-7 py-5">{children}</div>
          {footer && <div className="modal-foot px-5 sm:px-7 py-4 border-t border-slate-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
};

export const Field: React.FC<{ label: string; htmlFor?: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode }> = ({ label, htmlFor, hint, required, className = '', children }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="field-label">{label}{required && <span className="text-rose-400"> *</span>}</label>
    {children}
    {hint && <p className="field-hint">{hint}</p>}
  </div>
);

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }> = ({ checked, onChange, label, description }) => (
  <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--t-accent-600)]" />
    <span><span className="block text-sm font-semibold text-white">{label}</span>{description && <span className="block text-xs text-slate-400 mt-0.5">{description}</span>}</span>
  </label>
);

const STATE_STYLES: Record<string, string> = {
  active: 'badge-success', approved: 'badge-success', published: 'badge-success', succeeded: 'badge-success', qualified: 'badge-success', paid: 'badge-success',
  scheduled: 'badge-info', pending: 'badge-warning', draft: 'badge-warning', reserved: 'badge-warning',
  expired: 'badge-neutral', inactive: 'badge-neutral', archived: 'badge-neutral', released: 'badge-neutral', exhausted: 'badge-neutral', cancelled: 'badge-neutral',
  sold_out: 'badge-danger', rejected: 'badge-danger', failed: 'badge-danger', refunded: 'badge-info', redeemed: 'badge-success'
};
export const StatusBadge: React.FC<{ state: string }> = ({ state }) => (
  <span className={`badge ${STATE_STYLES[state] || 'badge-neutral'}`}>{state.replace(/_/g, ' ')}</span>
);

export const LoadingBlock: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="card card-pad flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" />{label}</div>
);

export const EmptyState: React.FC<{ title: string; text?: string; action?: React.ReactNode }> = ({ title, text, action }) => (
  <div className="card card-pad text-center space-y-2">
    <p className="font-semibold text-slate-200">{title}</p>
    {text && <p className="text-sm text-slate-400 max-w-md mx-auto">{text}</p>}
    {action}
  </div>
);

// <input type="datetime-local"> works in local time without a zone.
export function toLocalInput(value?: string | Date | null) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}
export const fmtDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const kes = (n?: number | null) => (n == null ? '—' : `KES ${Number(n).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`);
