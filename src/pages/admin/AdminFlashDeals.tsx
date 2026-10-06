import React, { useEffect, useMemo, useState } from 'react';
import { Zap, Plus, Pencil, Archive, Power, Search } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useStore } from '../../context/StoreContext';
import { api, PageHeader, Modal, Field, Toggle, StatusBadge, LoadingBlock, EmptyState, toLocalInput, fromLocalInput, fmtDateTime, kes } from './adminUi';

interface Deal {
  id: string;
  productId: string;
  title: string;
  description: string | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  startsAt: string;
  endsAt: string;
  quantityLimit: number | null;
  quantitySold: number;
  remaining: number | null;
  isActive: boolean;
  state: string;
  dealPrice: number | null;
  product: { id: string; name: string; sku: string; thumbnail: string; price: number; stock: number } | null;
}

const blank = () => {
  const start = new Date(Date.now() + 5 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { productId: '', title: '', description: '', discountType: 'percentage' as 'percentage' | 'fixed', discountValue: 10, startsAt: toLocalInput(start), endsAt: toLocalInput(end), quantityLimit: '' as number | '', isActive: true };
};

const FILTERS = ['all', 'active', 'scheduled', 'expired', 'inactive', 'sold_out'] as const;

export const AdminFlashDeals: React.FC = () => {
  const { showToast } = useToast();
  const { products, formatPrice } = useStore();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [editing, setEditing] = useState<Deal | null>(null);
  const [form, setForm] = useState(blank());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productQuery, setProductQuery] = useState('');

  const load = () => api<{ deals: Deal[] }>('/api/flash-deals/admin').then((d) => setDeals(d.deals)).catch((e) => showToast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  const selectedProduct = products.find((p) => p.id === form.productId);
  const previewPrice = selectedProduct
    ? Math.max(0, Math.round(form.discountType === 'percentage' ? selectedProduct.price * (1 - Number(form.discountValue) / 100) : selectedProduct.price - Number(form.discountValue)))
    : null;
  const productOptions = useMemo(() => {
    const q = productQuery.toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 60);
  }, [products, productQuery]);

  const startCreate = () => { setEditing(null); setForm(blank()); setProductQuery(''); setOpen(true); };
  const startEdit = (d: Deal) => {
    setEditing(d);
    setForm({ productId: d.productId, title: d.title, description: d.description || '', discountType: d.discountType, discountValue: d.discountValue, startsAt: toLocalInput(d.startsAt), endsAt: toLocalInput(d.endsAt), quantityLimit: d.quantityLimit ?? '', isActive: d.isActive });
    setProductQuery('');
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, startsAt: fromLocalInput(form.startsAt), endsAt: fromLocalInput(form.endsAt), quantityLimit: form.quantityLimit === '' ? null : Number(form.quantityLimit), discountValue: Number(form.discountValue) };
      await api(editing ? `/api/flash-deals/${editing.id}` : '/api/flash-deals', { method: editing ? 'PUT' : 'POST', body });
      showToast(editing ? 'Deal updated' : 'Deal created', 'success');
      setOpen(false);
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (d: Deal) => {
    try { await api(`/api/flash-deals/${d.id}/status`, { method: 'PATCH', body: { isActive: !d.isActive } }); load(); }
    catch (err) { showToast((err as Error).message, 'error'); }
  };
  const archive = async (d: Deal) => {
    if (!window.confirm(`Archive "${d.title}"? It will stop immediately and move out of this list.`)) return;
    try { await api(`/api/flash-deals/${d.id}`, { method: 'DELETE' }); showToast('Deal archived', 'success'); load(); }
    catch (err) { showToast((err as Error).message, 'error'); }
  };

  const visible = (deals || []).filter((d) => filter === 'all' || d.state === filter);

  return (
    <div className="space-y-6 animate-fadeInUp">
      <PageHeader
        icon={Zap}
        title="Flash deals"
        description="Time-limited discounts on individual products. Live deals appear on the home page and are applied automatically in the cart and at checkout."
        actions={<button type="button" onClick={startCreate} className="btn btn-primary"><Plus className="w-4 h-4" />New flash deal</button>}
      />

      <div className="flex gap-2 overflow-x-auto scrollbar-none" role="tablist" aria-label="Filter deals">
        {FILTERS.map((f) => {
          const n = f === 'all' ? deals?.length ?? 0 : (deals || []).filter((d) => d.state === f).length;
          return (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`btn btn-sm shrink-0 ${filter === f ? 'btn-primary' : 'btn-secondary'}`}>
              {f.replace('_', ' ')} <span className="opacity-70">({n})</span>
            </button>
          );
        })}
      </div>

      {!deals ? <LoadingBlock /> : visible.length === 0 ? (
        <EmptyState title="No deals here" text="Create a deal to discount a product for a limited time." action={<button type="button" onClick={startCreate} className="btn btn-primary btn-sm"><Plus className="w-4 h-4" />New flash deal</button>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Deal</th><th>Price</th><th>Window</th><th>Sold</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {visible.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="flex items-center gap-3 min-w-[220px]">
                        {d.product?.thumbnail && <img src={d.product.thumbnail} alt="" className="w-10 h-10 rounded-lg object-contain bg-slate-950 border border-slate-800" />}
                        <div className="min-w-0"><div className="font-semibold text-white">{d.title}</div><div className="text-xs text-slate-400 truncate">{d.product?.name}</div></div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap"><div className="font-bold text-emerald-400">{kes(d.dealPrice)}</div><div className="text-xs text-slate-500 line-through">{kes(d.product?.price)}</div><div className="text-xs text-slate-400">{d.discountType === 'percentage' ? `${d.discountValue}% off` : `${kes(d.discountValue)} off`}</div></td>
                    <td className="whitespace-nowrap text-xs"><div>{fmtDateTime(d.startsAt)}</div><div className="text-slate-400">to {fmtDateTime(d.endsAt)}</div></td>
                    <td className="whitespace-nowrap">{d.quantitySold}{d.quantityLimit != null ? ` / ${d.quantityLimit}` : ''}</td>
                    <td><StatusBadge state={d.state} /></td>
                    <td className="text-right whitespace-nowrap">
                      <button type="button" onClick={() => startEdit(d)} className="icon-button" aria-label={`Edit ${d.title}`}><Pencil className="w-4 h-4" /></button>
                      <button type="button" onClick={() => toggle(d)} className="icon-button" aria-label={d.isActive ? `Deactivate ${d.title}` : `Activate ${d.title}`} title={d.isActive ? 'Deactivate' : 'Activate'}><Power className={`w-4 h-4 ${d.isActive ? 'text-emerald-400' : ''}`} /></button>
                      <button type="button" onClick={() => archive(d)} className="icon-button" aria-label={`Archive ${d.title}`}><Archive className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && (
        <Modal
          title={editing ? 'Edit flash deal' : 'New flash deal'}
          description="Times are in your local time zone. The storefront countdown follows the server clock."
          onClose={() => setOpen(false)}
          footer={<>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" form="deal-form" disabled={saving || !form.productId} className="btn btn-primary">{saving ? 'Saving…' : editing ? 'Save changes' : 'Create deal'}</button>
          </>}
        >
          <form id="deal-form" onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Product" required className="md:col-span-2" hint="Search by name or SKU. A product can only have one active deal at a time.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Filter products" className="field-input pl-9" aria-label="Filter products" />
                </div>
                <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, title: form.title || (products.find((p) => p.id === e.target.value)?.name ? `${products.find((p) => p.id === e.target.value)!.name} flash deal` : '') })} className="field-input" required aria-label="Product">
                  <option value="">Choose a product…</option>
                  {productOptions.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.price)}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Deal title" htmlFor="deal-title" required hint="Shown on the product page and the deals strip.">
              <input id="deal-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="field-input" maxLength={120} required />
            </Field>
            <Field label="Description" htmlFor="deal-desc" hint="Optional — e.g. why it's discounted or what's included.">
              <input id="deal-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="field-input" maxLength={1000} />
            </Field>
            <Field label="Discount type" htmlFor="deal-type">
              <select id="deal-type" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as any })} className="field-input">
                <option value="percentage">Percentage off</option>
                <option value="fixed">Fixed amount off (KES)</option>
              </select>
            </Field>
            <Field label={form.discountType === 'percentage' ? 'Discount (%)' : 'Discount (KES)'} htmlFor="deal-value" required>
              <input id="deal-value" type="number" min="0.01" step="0.01" max={form.discountType === 'percentage' ? 99 : undefined} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} className="field-input" required />
            </Field>
            <Field label="Starts" htmlFor="deal-start" required>
              <input id="deal-start" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="field-input" required />
            </Field>
            <Field label="Ends" htmlFor="deal-end" required>
              <input id="deal-end" type="datetime-local" value={form.endsAt} min={form.startsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="field-input" required />
            </Field>
            <Field label="Quantity at this price" htmlFor="deal-qty" hint={`Leave empty for no limit.${editing ? ` Already sold: ${editing.quantitySold}.` : ''}`}>
              <input id="deal-qty" type="number" min={editing?.quantitySold || 1} value={form.quantityLimit} onChange={(e) => setForm({ ...form, quantityLimit: e.target.value === '' ? '' : Number(e.target.value) })} className="field-input" placeholder="Unlimited" />
            </Field>
            <div className="self-end"><Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Active" description="Inactive deals never apply, even inside their window." /></div>
            {selectedProduct && previewPrice != null && (
              <div className="md:col-span-2 callout callout-info">
                <span>Price preview: <strong>{formatPrice(selectedProduct.price)}</strong> → <strong>{formatPrice(previewPrice)}</strong> (customers save {formatPrice(selectedProduct.price - previewPrice)}). Stock on hand: {selectedProduct.stock}.</span>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
};
