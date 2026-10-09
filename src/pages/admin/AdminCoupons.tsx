import React, { useEffect, useState } from 'react';
import { Tag, Plus, Pencil, Power, Trash2, History } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { api, PageHeader, Modal, Field, Toggle, StatusBadge, LoadingBlock, EmptyState, toLocalInput, fromLocalInput, fmtDateTime, kes } from './adminUi';

interface Coupon {
  id: string; code: string; description: string | null; discountType: 'percentage' | 'fixed'; discountValue: number;
  minOrderAmount: number; maxDiscountAmount: number | null; validFrom: string | null; validUntil: string | null;
  usageLimit: number | null; perUserLimit: number | null; usedCount: number; reservedCount: number;
  eligibleProductIds: string[]; eligibleCategoryIds: string[]; stackWithFlashDeals: boolean; isActive: boolean; state: string; source: string;
}
interface Redemption { id: string; status: string; discountAmount: number; createdAt: string; orderNumber: string; orderTotal: number; customerName: string | null; customerEmail: string | null }

type ExpiryMode = 'none' | 'duration' | 'date';
const blank = () => ({
  code: '', description: '', discountType: 'percentage' as 'percentage' | 'fixed', discountValue: 10, minOrderAmount: 0, maxDiscountAmount: '' as number | '',
  validFrom: '', expiryMode: 'duration' as ExpiryMode, durationValue: 7, durationUnit: 'days' as 'hours' | 'days' | 'weeks', validUntil: '',
  usageLimit: '' as number | '', perUserLimit: 1 as number | '', eligibleCategoryIds: [] as string[], stackWithFlashDeals: false, isActive: true
});

function randomCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export const AdminCoupons: React.FC = () => {
  const { showToast } = useToast();
  const { categories } = useStore();
  const { can } = useAuth();
  const canWrite = can('coupons:write');
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [showReferral, setShowReferral] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState(blank());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ coupon: Coupon; rows: Redemption[] | null } | null>(null);

  const load = () => api<{ coupons: Coupon[] }>(`/api/coupons?includeReferral=${showReferral}`).then((d) => setCoupons(d.coupons)).catch((e) => showToast(e.message, 'error'));
  useEffect(() => { load(); }, [showReferral]);

  const openCreate = () => { setEditing(null); setForm(blank()); setOpen(true); };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      ...blank(), code: c.code, description: c.description || '', discountType: c.discountType, discountValue: c.discountValue, minOrderAmount: c.minOrderAmount,
      maxDiscountAmount: c.maxDiscountAmount ?? '', validFrom: toLocalInput(c.validFrom), expiryMode: c.validUntil ? 'date' : 'none', validUntil: toLocalInput(c.validUntil),
      usageLimit: c.usageLimit ?? '', perUserLimit: c.perUserLimit ?? '', eligibleCategoryIds: c.eligibleCategoryIds || [], stackWithFlashDeals: c.stackWithFlashDeals, isActive: c.isActive
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: any = {
        code: form.code, description: form.description || null, discountType: form.discountType, discountValue: Number(form.discountValue),
        minOrderAmount: Number(form.minOrderAmount) || 0, maxDiscountAmount: form.maxDiscountAmount === '' ? null : Number(form.maxDiscountAmount),
        validFrom: fromLocalInput(form.validFrom), usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
        perUserLimit: form.perUserLimit === '' ? null : Number(form.perUserLimit), eligibleCategoryIds: form.eligibleCategoryIds,
        eligibleProductIds: editing?.eligibleProductIds || [], stackWithFlashDeals: form.stackWithFlashDeals, isActive: form.isActive
      };
      if (form.expiryMode === 'duration') body.duration = { value: Number(form.durationValue), unit: form.durationUnit };
      if (form.expiryMode === 'date') body.validUntil = fromLocalInput(form.validUntil);
      await api(editing ? `/api/coupons/${editing.id}` : '/api/coupons', { method: editing ? 'PUT' : 'POST', body });
      showToast(editing ? 'Promo code updated' : `Promo code ${form.code.toUpperCase()} created`, 'success');
      setOpen(false);
      load();
    } catch (err) { showToast((err as Error).message, 'error'); } finally { setSaving(false); }
  };

  const toggle = async (c: Coupon) => {
    try { await api(`/api/coupons/${c.id}/status`, { method: 'PATCH', body: { isActive: !c.isActive } }); load(); }
    catch (err) { showToast((err as Error).message, 'error'); }
  };
  const remove = async (c: Coupon) => {
    if (!window.confirm(`Delete ${c.code}? Codes that were already used are deactivated instead, to keep order history.`)) return;
    try { const d = await api<{ message: string }>(`/api/coupons/${c.id}`, { method: 'DELETE' }); showToast(d.message, 'success'); load(); }
    catch (err) { showToast((err as Error).message, 'error'); }
  };
  const openHistory = async (c: Coupon) => {
    setHistory({ coupon: c, rows: null });
    try { const d = await api<{ redemptions: Redemption[] }>(`/api/coupons/${c.id}/redemptions`); setHistory({ coupon: c, rows: d.redemptions }); }
    catch (err) { showToast((err as Error).message, 'error'); setHistory(null); }
  };

  const expiryPreview = () => {
    if (form.expiryMode === 'none') return 'Never expires';
    if (form.expiryMode === 'date') return form.validUntil ? `Expires ${fmtDateTime(fromLocalInput(form.validUntil))}` : 'Choose a date';
    const ms = { hours: 3_600_000, days: 86_400_000, weeks: 604_800_000 }[form.durationUnit] * Number(form.durationValue || 0);
    const start = form.validFrom ? new Date(form.validFrom).getTime() : Date.now();
    return `Expires ${fmtDateTime(new Date(start + ms).toISOString())}`;
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <PageHeader
        icon={Tag}
        title="Promo codes"
        description="Every code is checked on the server at checkout: active status, dates, minimum order, eligible items, total and per-customer limits. A use is reserved when an order is placed and counted once it is paid."
        actions={canWrite && <button type="button" onClick={openCreate} className="btn btn-primary"><Plus className="w-4 h-4" />New promo code</button>}
      />
      <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={showReferral} onChange={(e) => setShowReferral(e.target.checked)} className="accent-[var(--t-accent-600)]" />Include referral reward codes</label>

      {!coupons ? <LoadingBlock /> : coupons.length === 0 ? (
        <EmptyState title="No promo codes yet" action={canWrite && <button type="button" onClick={openCreate} className="btn btn-primary btn-sm"><Plus className="w-4 h-4" />New promo code</button>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Code</th><th>Discount</th><th>Rules</th><th>Validity</th><th>Used</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td className="min-w-[160px]"><code className="font-mono font-bold text-white">{c.code}</code>{c.source === 'referral' && <span className="ml-2 badge badge-info">referral</span>}{c.description && <div className="text-xs text-slate-400 max-w-xs">{c.description}</div>}</td>
                    <td className="whitespace-nowrap font-semibold">{c.discountType === 'percentage' ? `${c.discountValue}%` : kes(c.discountValue)}{c.maxDiscountAmount ? <div className="text-xs text-slate-400">max {kes(c.maxDiscountAmount)}</div> : null}</td>
                    <td className="text-xs min-w-[180px]">
                      {c.minOrderAmount > 0 && <div>Min order {kes(c.minOrderAmount)}</div>}
                      {c.perUserLimit && <div>{c.perUserLimit} per customer</div>}
                      {c.eligibleCategoryIds.length > 0 && <div>{c.eligibleCategoryIds.length} categor{c.eligibleCategoryIds.length === 1 ? 'y' : 'ies'} only</div>}
                      <div>{c.stackWithFlashDeals ? 'Stacks with flash deals' : 'Excludes flash-deal items'}</div>
                    </td>
                    <td className="text-xs whitespace-nowrap">{c.validFrom ? <div>From {fmtDateTime(c.validFrom)}</div> : null}<div>{c.validUntil ? `Until ${fmtDateTime(c.validUntil)}` : 'No expiry'}</div></td>
                    <td className="whitespace-nowrap">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}{c.reservedCount ? <div className="text-xs text-amber-300">+{c.reservedCount} pending</div> : null}</td>
                    <td><StatusBadge state={c.state} /></td>
                    <td className="text-right whitespace-nowrap">
                      <button type="button" className="icon-button" onClick={() => openHistory(c)} aria-label={`Redemption history for ${c.code}`} title="History"><History className="w-4 h-4" /></button>
                      {canWrite && <>
                        <button type="button" className="icon-button" onClick={() => openEdit(c)} aria-label={`Edit ${c.code}`}><Pencil className="w-4 h-4" /></button>
                        <button type="button" className="icon-button" onClick={() => toggle(c)} aria-label={c.isActive ? `Deactivate ${c.code}` : `Activate ${c.code}`} title={c.isActive ? 'Deactivate' : 'Activate'}><Power className={`w-4 h-4 ${c.isActive ? 'text-emerald-400' : ''}`} /></button>
                        <button type="button" className="icon-button" onClick={() => remove(c)} aria-label={`Delete ${c.code}`}><Trash2 className="w-4 h-4" /></button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && (
        <Modal title={editing ? `Edit ${editing.code}` : 'New promo code'} onClose={() => setOpen(false)}
          footer={<><button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">Cancel</button><button type="submit" form="coupon-form" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save promo code'}</button></>}>
          <form id="coupon-form" onSubmit={save} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Field label="Code" htmlFor="c-code" required hint="Letters, numbers, - and _. Customers type this at checkout.">
                <div className="flex gap-2">
                  <input id="c-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="field-input font-mono tracking-wider" maxLength={40} required />
                  <button type="button" className="btn btn-secondary shrink-0" onClick={() => setForm({ ...form, code: randomCode() })}>Generate</button>
                </div>
              </Field>
              <Field label="Description" htmlFor="c-desc" hint="Shown to the customer when the code is applied."><input id="c-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="field-input" maxLength={500} /></Field>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                <Field label="Discount type" htmlFor="c-type"><select id="c-type" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as any })} className="field-input"><option value="percentage">Percentage</option><option value="fixed">Fixed (KES)</option></select></Field>
                <Field label={form.discountType === 'percentage' ? 'Discount (%)' : 'Discount (KES)'} htmlFor="c-val" required><input id="c-val" type="number" min="0.01" step="0.01" max={form.discountType === 'percentage' ? 100 : undefined} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} className="field-input" required /></Field>
                <Field label="Minimum order (KES)" htmlFor="c-min"><input id="c-min" type="number" min="0" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: Number(e.target.value) })} className="field-input" /></Field>
                <Field label="Maximum discount (KES)" htmlFor="c-max"><input id="c-max" type="number" min="1" value={form.maxDiscountAmount} onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value === '' ? '' : Number(e.target.value) })} className="field-input" placeholder="No cap" /></Field>
                <Field label="Total uses allowed" htmlFor="c-lim"><input id="c-lim" type="number" min="1" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value === '' ? '' : Number(e.target.value) })} className="field-input" placeholder="Unlimited" /></Field>
                <Field label="Uses per customer" htmlFor="c-per"><input id="c-per" type="number" min="1" value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value === '' ? '' : Number(e.target.value) })} className="field-input" placeholder="Unlimited" /></Field>
              </div>
            </div>
            <div className="space-y-4">
              <Field label="Starts" htmlFor="c-from" hint="Empty = immediately."><input id="c-from" type="datetime-local" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} className="field-input" /></Field>
              <fieldset className="space-y-2">
                <legend className="field-label">Expiry</legend>
                <div className="flex flex-wrap gap-2" role="radiogroup">
                  {([['duration', 'After a duration'], ['date', 'On a date'], ['none', 'Never']] as const).map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={form.expiryMode === v} onClick={() => setForm({ ...form, expiryMode: v })} className={`btn btn-sm ${form.expiryMode === v ? 'btn-primary' : 'btn-secondary'}`}>{l}</button>
                  ))}
                </div>
                {form.expiryMode === 'duration' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" min="1" value={form.durationValue} onChange={(e) => setForm({ ...form, durationValue: Number(e.target.value) })} className="field-input" aria-label="Duration" />
                    <select value={form.durationUnit} onChange={(e) => setForm({ ...form, durationUnit: e.target.value as any })} className="field-input" aria-label="Duration unit"><option value="hours">hours</option><option value="days">days</option><option value="weeks">weeks</option></select>
                  </div>
                )}
                {form.expiryMode === 'date' && <input type="datetime-local" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="field-input" aria-label="Expiry date" />}
                <p className="field-hint">{expiryPreview()}</p>
              </fieldset>
              <Field label="Only for these categories" hint="Leave all unticked to apply to the whole cart.">
                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50 p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2 text-sm text-slate-300 p-1 rounded hover:bg-slate-800/50">
                      <input type="checkbox" checked={form.eligibleCategoryIds.includes(cat.id)} onChange={(e) => setForm({ ...form, eligibleCategoryIds: e.target.checked ? [...form.eligibleCategoryIds, cat.id] : form.eligibleCategoryIds.filter((id) => id !== cat.id) })} className="accent-[var(--t-accent-600)]" />
                      {cat.name}
                    </label>
                  ))}
                </div>
              </Field>
              <Toggle checked={form.stackWithFlashDeals} onChange={(v) => setForm({ ...form, stackWithFlashDeals: v })} label="Also discount flash-deal items" description="Off: items already on a flash deal are excluded from this code." />
              <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Active" />
            </div>
          </form>
        </Modal>
      )}

      {history && (
        <Modal title={`Redemptions: ${history.coupon.code}`} onClose={() => setHistory(null)} size="medium">
          {!history.rows ? <LoadingBlock /> : history.rows.length === 0 ? <p className="text-sm text-slate-400">This code has not been used yet.</p> : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Order</th><th>Customer</th><th>Discount</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>{history.rows.map((r) => (
                  <tr key={r.id}><td className="font-mono">{r.orderNumber}</td><td>{r.customerName}<div className="text-xs text-slate-400">{r.customerEmail}</div></td><td>{kes(r.discountAmount)}</td><td><StatusBadge state={r.status} /></td><td className="text-xs whitespace-nowrap">{fmtDateTime(r.createdAt)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
