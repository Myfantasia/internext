import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
// layout="split": on wide screens the body is two independently scrolling
// columns (children use className="split-col"); on narrow screens it stacks
// and scrolls as one.
export const Modal: React.FC<{ title: string; description?: string; onClose: () => void; children: React.ReactNode; size?: 'medium' | 'wide'; footer?: React.ReactNode; layout?: 'default' | 'split' }> = ({ title, description, onClose, children, size = 'wide', footer, layout = 'default' }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useEscapeKey(onClose);
  useBodyScrollLock();
  // Header and footer stay put; only the body scrolls, so the title and the
  // Save button are always visible however long the form is.
  return (
    <Portal>
      <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`modal-panel ${size === 'wide' ? 'modal-wide' : 'modal-medium'} ${layout === 'split' ? 'modal-split' : ''} outline-none`}>
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

// ---------------------------------------------------------------------------
// Shared list/detail building blocks (products, categories, brands, customers,
// finance). One implementation each so every screen pages, drills down and
// scrolls the same way.
// ---------------------------------------------------------------------------

// Value that settles `delay` ms after the last change — for search boxes.
export function useDebounced<T>(value: T, delay = 350): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return settled;
}

const pageWindow = (page: number, totalPages: number): (number | '…')[] => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) out.push('…'); out.push(p); });
  return out;
};

export const Pagination: React.FC<{
  page: number; totalPages: number; total: number; limit: number; noun?: string;
  onPage: (page: number) => void; onLimit?: (limit: number) => void; busy?: boolean;
}> = ({ page, totalPages, total, limit, noun = 'items', onPage, onLimit, busy }) => {
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(total, page * limit);
  return (
    <nav aria-label="Pagination" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
      <p className="text-slate-400" aria-live="polite">
        {total === 0 ? `No ${noun}` : <>Showing <strong className="text-slate-200">{first.toLocaleString()}–{last.toLocaleString()}</strong> of <strong className="text-slate-200">{total.toLocaleString()}</strong> {noun}</>}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {onLimit && (
          <label className="flex items-center gap-2 text-slate-400">
            <span className="hidden sm:inline">Per page</span>
            <select value={limit} onChange={(e) => onLimit(Number(e.target.value))} className="field-input !w-auto !py-1.5" aria-label="Items per page">
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        <button type="button" onClick={() => onPage(page - 1)} disabled={busy || page <= 1} className="btn btn-secondary btn-sm" aria-label="Previous page"><ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Previous</span></button>
        <div className="hidden md:flex items-center gap-1">
          {pageWindow(page, totalPages).map((p, i) => p === '…'
            ? <span key={`gap-${i}`} className="px-1 text-slate-500">…</span>
            : <button key={p} type="button" onClick={() => onPage(p)} disabled={busy} aria-current={p === page ? 'page' : undefined} className={`btn btn-sm !min-w-9 !px-2 ${p === page ? 'btn-primary' : 'btn-ghost'}`}>{p}</button>)}
        </div>
        <span className="md:hidden text-slate-400">Page {page} / {totalPages}</span>
        <button type="button" onClick={() => onPage(page + 1)} disabled={busy || page >= totalPages} className="btn btn-secondary btn-sm" aria-label="Next page"><span className="hidden sm:inline">Next</span><ChevronRight className="w-4 h-4" /></button>
      </div>
    </nav>
  );
};

// Side panel for record details: header and footer stay put, the body scrolls
// on its own (the page behind is locked). Full-screen on phones.
export const Drawer: React.FC<{
  title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode;
  footer?: React.ReactNode; actions?: React.ReactNode; width?: 'md' | 'lg' | 'xl';
}> = ({ title, subtitle, onClose, children, footer, actions, width = 'lg' }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useEscapeKey(onClose);
  useBodyScrollLock();
  return (
    <Portal>
      <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <aside ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="drawer-title" className={`drawer-panel drawer-${width} outline-none`}>
          <header className="modal-head flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-800">
            <div className="min-w-0">
              <h3 id="drawer-title" className="text-lg font-bold text-white break-words">{title}</h3>
              {subtitle && <div className="text-sm text-slate-400 mt-0.5">{subtitle}</div>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {actions}
              <button type="button" onClick={onClose} className="icon-button" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
          </header>
          <div className="modal-body px-5 sm:px-6 py-5 space-y-6">{children}</div>
          {footer && <footer className="modal-foot px-5 sm:px-6 py-3 border-t border-slate-800 flex flex-wrap justify-end gap-2">{footer}</footer>}
        </aside>
      </div>
    </Portal>
  );
};

// A figure with context. Clickable tiles drill down into the records behind it.
export const StatTile: React.FC<{
  label: string; value: React.ReactNode; hint?: React.ReactNode; change?: number | null;
  /** true when a rise is bad news (refunds, overdue) */ invert?: boolean; onClick?: () => void; tone?: 'default' | 'warning' | 'danger';
}> = ({ label, value, hint, change, invert, onClick, tone = 'default' }) => {
  const Tag = onClick ? 'button' : 'div';
  const good = change != null && (invert ? change < 0 : change > 0);
  const toneClass = tone === 'danger' ? 'border-rose-800/60' : tone === 'warning' ? 'border-amber-700/60' : 'border-slate-800';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`card p-4 text-left min-w-0 ${toneClass} ${onClick ? 'hover:border-cyan-700 hover:bg-slate-800/30 transition-colors cursor-pointer group' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-slate-400">{label}</span>
        {onClick && <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0" aria-hidden="true" />}
      </div>
      <div className="mt-1 text-xl sm:text-2xl font-black text-white tabular-nums break-words">{value}</div>
      {change != null && Number.isFinite(change) && (
        <div className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${good ? 'text-emerald-400' : change === 0 ? 'text-slate-400' : 'text-rose-400'}`}>
          {change >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" /> : <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />}
          {`${change >= 0 ? '+' : ''}${(change * 100).toFixed(1)}%`}<span className="font-normal text-slate-500">vs previous period</span>
        </div>
      )}
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </Tag>
  );
};

// Inline error with a retry button for failed loads.
export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="card card-pad flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <p className="text-sm text-rose-300">{message}</p>
    {onRetry && <button type="button" onClick={onRetry} className="btn btn-secondary btn-sm shrink-0">Try again</button>}
  </div>
);

export const kesCompact = (n?: number | null) => {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `KES ${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `KES ${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `KES ${(n / 1e3).toFixed(1)}K`;
  return kes(n);
};
export const pct = (n?: number | null, digits = 1) => (n == null || !Number.isFinite(n) ? '—' : `${(n * 100).toFixed(digits)}%`);
