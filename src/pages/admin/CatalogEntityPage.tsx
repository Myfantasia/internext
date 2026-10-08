import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Search, Pencil, Trash2, Package, ExternalLink, FolderTree, Award, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { ImageUploadField } from '../../components/admin/ImageUploadField';
import { useCatalogLists, AdminCategory, AdminBrand } from './useCatalogLists';
import {
  api, Modal, Field, PageHeader, Drawer, StatTile, Pagination, EmptyState, ErrorState, LoadingBlock, useDebounced, kes, kesCompact
} from './adminUi';

// Categories and Brands share one implementation: list -> detail drawer ->
// products -> actions (edit / delete). The drawer is also opened from the
// Products table when a category or brand name is clicked.

export type CatalogKind = 'category' | 'brand';
type Entity = AdminCategory | AdminBrand;
export type Navigate = (tab: string, params?: Record<string, string>) => void;

const CONFIG = {
  category: { title: 'Categories', noun: 'category', icon: FolderTree, api: '/api/categories', permission: 'categories:write', filterParam: 'categoryId' },
  brand: { title: 'Brands', noun: 'brand', icon: Award, api: '/api/brands', permission: 'brands:write', filterParam: 'brandId' }
} as const;

interface Insights {
  inventory: { totalProducts: number; activeProducts: number; inStock: number; outOfStock: number; lowStock: number; inventoryValue: number; avgPrice: number; minPrice: number; maxPrice: number };
  sales: { unitsSold: number; revenue30: number; revenuePrev30: number; revenueChange: number | null };
}

const imageOf = (e: Entity) => ('imageUrl' in e ? e.imageUrl : undefined) || ('logoUrl' in e ? e.logoUrl : undefined) || null;
const countOf = (e: Entity) => ('productCount' in e && e.productCount != null ? e.productCount : ('count' in e ? e.count : 0)) || 0;

// ---------------------------------------------------------------------------
export const CatalogEntityPage: React.FC<{ kind: CatalogKind; onNavigate?: Navigate }> = ({ kind, onNavigate }) => {
  const cfg = CONFIG[kind];
  const { can } = useAuth();
  const canWrite = can(cfg.permission);
  const { refreshCatalog } = useStore();
  const { categories, brands, loading, error, reload } = useCatalogLists();
  const items: Entity[] = kind === 'category' ? categories : brands;
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entity | 'new' | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((e) => e.name.toLowerCase().includes(q)) : items;
  }, [items, search]);
  const opened = items.find((e) => e.id === openId) || null;
  const afterChange = () => { reload(); refreshCatalog(); };
  const Icon = cfg.icon;

  return (
    <div className="space-y-5 animate-fadeInUp">
      <PageHeader
        icon={Icon}
        title={cfg.title}
        description={`Click a ${cfg.noun} to see its products and figures, and to edit or delete it.`}
        actions={canWrite ? <button type="button" onClick={() => setEditing('new')} className="btn btn-primary"><Plus className="w-4 h-4" />New {cfg.noun}</button> : undefined}
      />

      <div className="card p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${cfg.title.toLowerCase()}…`} className="field-input pl-10" aria-label={`Search ${cfg.title.toLowerCase()}`} />
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <LoadingBlock /> : visible.length === 0 ? (
        <EmptyState
          title={items.length ? `No ${cfg.title.toLowerCase()} match "${search}"` : `No ${cfg.title.toLowerCase()} yet`}
          text={items.length ? 'Try a different search.' : `Create your first ${cfg.noun} to organise the catalog.`}
          action={!items.length && canWrite ? <button type="button" onClick={() => setEditing('new')} className="btn btn-primary btn-sm"><Plus className="w-4 h-4" />New {cfg.noun}</button> : undefined}
        />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {visible.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => setOpenId(e.id)} className="card w-full p-4 text-left flex items-center gap-3 hover:border-cyan-700 hover:bg-slate-800/30 transition-colors">
                {imageOf(e)
                  ? <img src={imageOf(e)!} alt="" className="w-12 h-12 rounded-xl object-contain bg-slate-950 p-1 border border-slate-800 shrink-0" loading="lazy" />
                  : <span className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 grid place-items-center text-sm font-black text-cyan-300 shrink-0" aria-hidden="true">{e.name.slice(0, 2).toUpperCase()}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-white truncate">{e.name}</span>
                  <span className="block text-xs text-slate-400">{countOf(e)} live product{countOf(e) === 1 ? '' : 's'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {opened && (
        <CatalogEntityDrawer kind={kind} entity={opened} onClose={() => setOpenId(null)} onEdit={() => setEditing(opened)}
          onDeleted={() => { setOpenId(null); afterChange(); }} onNavigate={onNavigate} />
      )}
      {editing && (
        <EntityForm kind={kind} entity={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(id) => { setEditing(null); afterChange(); if (id) setOpenId(id); }} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
export const CatalogEntityDrawer: React.FC<{
  kind: CatalogKind; entity: Entity; onClose: () => void; onEdit?: () => void; onDeleted?: () => void; onNavigate?: Navigate;
}> = ({ kind, entity, onClose, onEdit, onDeleted, onNavigate }) => {
  const cfg = CONFIG[kind];
  const { can } = useAuth();
  const { showToast } = useToast();
  const canWrite = can(cfg.permission);
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = () => { setError(''); api<Insights>(`${cfg.api}/${entity.id}/insights`).then(setData).catch((e) => setError(e.message || 'Could not load details')); };
  useEffect(() => { setData(null); load(); }, [entity.id]);

  const goToProducts = (extra: Record<string, string> = {}) => onNavigate?.('products', { [cfg.filterParam]: entity.id, ...extra });

  const remove = async () => {
    const warning = kind === 'brand' && data?.inventory.totalProducts
      ? `Delete the brand "${entity.name}"? Its ${data.inventory.totalProducts} product(s) stay in the catalog without a brand.`
      : `Delete the ${cfg.noun} "${entity.name}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    setDeleting(true);
    try {
      await api(`${cfg.api}/${entity.id}`, { method: 'DELETE' });
      showToast(`${entity.name} deleted`, 'success');
      onDeleted?.();
    } catch (e: any) {
      showToast(e.message || 'Could not delete', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const inv = data?.inventory;
  return (
    <Drawer
      title={entity.name}
      subtitle={<span className="capitalize">{cfg.noun}{'kind' in entity && entity.kind === 'service' ? ' · services' : ''}</span>}
      onClose={onClose}
      footer={<>
        {canWrite && onDeleted && <button type="button" onClick={remove} disabled={deleting || (kind === 'category' && !!inv?.totalProducts)} title={kind === 'category' && inv?.totalProducts ? 'Move or delete its products first' : undefined} className="btn btn-ghost hover:!text-rose-400 sm:mr-auto"><Trash2 className="w-4 h-4" />Delete</button>}
        {canWrite && onEdit && <button type="button" onClick={onEdit} className="btn btn-secondary"><Pencil className="w-4 h-4" />Edit</button>}
        {onNavigate && can('products:create') && <button type="button" onClick={() => goToProducts({ new: '1' })} className="btn btn-secondary"><Plus className="w-4 h-4" />Add product</button>}
        {onNavigate && <button type="button" onClick={() => goToProducts()} className="btn btn-primary"><Package className="w-4 h-4" />Open in Products</button>}
      </>}
    >
      <section className="flex gap-4 items-start">
        {imageOf(entity) && <img src={imageOf(entity)!} alt="" className="w-20 h-20 rounded-2xl object-contain bg-slate-950 p-2 border border-slate-800 shrink-0" />}
        <p className="text-sm text-slate-300 leading-relaxed">{entity.description || <span className="text-slate-500">No description yet.</span>}</p>
      </section>

      {error ? <ErrorState message={error} onRetry={load} /> : !data || !inv ? <LoadingBlock label="Loading figures…" /> : (
        <>
          {kind === 'category' && inv.totalProducts > 0 && canWrite && (
            <p className="callout callout-info text-xs"><AlertTriangle className="w-4 h-4 shrink-0" />A category can be deleted only when it has no products.</p>
          )}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Figures">
            <StatTile label="Products" value={inv.totalProducts} hint={`${inv.activeProducts} live in the store`} />
            <StatTile label="In stock" value={inv.inStock} hint={inv.lowStock ? `${inv.lowStock} running low` : undefined} tone={inv.lowStock ? 'warning' : 'default'} onClick={inv.lowStock && onNavigate ? () => goToProducts({ stock: 'low' }) : undefined} />
            <StatTile label="Out of stock" value={inv.outOfStock} tone={inv.outOfStock ? 'danger' : 'default'} onClick={inv.outOfStock && onNavigate ? () => goToProducts({ stock: 'out' }) : undefined} />
            <StatTile label="Stock value" value={kesCompact(inv.inventoryValue)} hint="At selling price" />
            <StatTile label="Average price" value={kesCompact(inv.avgPrice)} hint={inv.totalProducts ? `${kesCompact(inv.minPrice)} – ${kesCompact(inv.maxPrice)}` : undefined} />
            <StatTile label="Sales, last 30 days" value={kesCompact(data.sales.revenue30)} change={data.sales.revenueChange} />
            <StatTile label="Units sold (all time)" value={data.sales.unitsSold.toLocaleString()} />
          </section>
          <EntityProducts kind={kind} entityId={entity.id} />
        </>
      )}
    </Drawer>
  );
};

// Products in this category/brand — same endpoint, search and paging as the Products page.
const EntityProducts: React.FC<{ kind: CatalogKind; entityId: string }> = ({ kind, entityId }) => {
  const cfg = CONFIG[kind];
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [stock, setStock] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<{ products: any[]; total: number; page: number; totalPages: number; limit: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { setPage(1); }, [q, stock]);
  useEffect(() => {
    let live = true;
    const qs = new URLSearchParams({ [cfg.filterParam]: entityId, page: String(page), limit: '10', sort: 'name-asc', status: 'all' });
    if (q.trim()) qs.set('search', q.trim());
    if (stock) qs.set('stock', stock);
    api<any>(`/api/products/admin?${qs}`).then((d) => { if (live) { setRes(d); setError(''); } }).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [entityId, q, stock, page]);

  return (
    <section className="space-y-3" aria-labelledby="ep-h">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <h4 id="ep-h" className="eyebrow flex items-center gap-1.5"><Package className="w-3.5 h-3.5" />Products</h4>
        <div className="flex gap-2">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="field-input !py-1.5 sm:!w-48" aria-label="Search products" />
          <select value={stock} onChange={(e) => setStock(e.target.value)} className="field-input !py-1.5 !w-auto" aria-label="Stock filter">
            <option value="">All stock</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option>
          </select>
        </div>
      </div>
      {error ? <ErrorState message={error} /> : !res ? <LoadingBlock /> : res.total === 0 ? (
        <p className="text-sm text-slate-400 py-2">{q || stock ? 'No products match.' : `No products in this ${cfg.noun} yet.`}</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {res.products.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-2.5 text-sm">
                <img src={p.thumbnail} alt="" className="w-9 h-9 rounded-lg object-contain bg-slate-950 shrink-0" loading="lazy" />
                <span className="min-w-0 flex-1">
                  <span className="block text-slate-200 truncate" title={p.name}>{p.name}</span>
                  <span className="block text-xs text-slate-500 font-mono truncate">{p.sku}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block tabular-nums text-white">{kes(p.price)}</span>
                  <span className={`block text-xs ${p.available <= 0 ? 'text-rose-400' : p.stock <= p.reorderLevel ? 'text-amber-400' : 'text-slate-500'}`}>{p.available <= 0 ? 'Out of stock' : `${p.available} available`}{p.isActive === false ? ' · hidden' : ''}</span>
                </span>
                <a href={`/products/${p.slug}`} target="_blank" rel="noreferrer" className="icon-button shrink-0" aria-label={`View ${p.name} in store`}><ExternalLink className="w-4 h-4" /></a>
              </li>
            ))}
          </ul>
          <Pagination page={res.page} totalPages={res.totalPages} total={res.total} limit={res.limit} noun="products" onPage={setPage} />
        </>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------
const EntityForm: React.FC<{ kind: CatalogKind; entity: Entity | null; onClose: () => void; onSaved: (id?: string) => void }> = ({ kind, entity, onClose, onSaved }) => {
  const cfg = CONFIG[kind];
  const { showToast } = useToast();
  const [name, setName] = useState(entity?.name || '');
  const [description, setDescription] = useState(entity?.description || '');
  const [image, setImage] = useState((entity && imageOf(entity)) || '');
  const [categoryKind, setCategoryKind] = useState<'product' | 'service'>((entity && 'kind' in entity && entity.kind) || 'product');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (name.trim().length < 2) { setError(`Enter a ${cfg.noun} name (at least 2 characters)`); return; }
    setSaving(true);
    setError('');
    const body = kind === 'category'
      ? { name: name.trim(), description: description.trim(), imageUrl: image, kind: categoryKind }
      : { name: name.trim(), description: description.trim(), logoUrl: image };
    try {
      const res = await api<any>(entity ? `${cfg.api}/${entity.id}` : cfg.api, { method: entity ? 'PUT' : 'POST', body });
      showToast(entity ? `${name.trim()} updated` : `${name.trim()} created`, 'success');
      onSaved(res?.[cfg.noun]?.id);
    } catch (err: any) {
      setError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal size="medium" title={entity ? `Edit ${entity.name}` : `New ${cfg.noun}`} onClose={onClose}
      footer={<><button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button><button type="submit" form="entity-form" disabled={saving} className="btn btn-primary"><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save'}</button></>}>
      <form id="entity-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && <div className="callout callout-danger" role="alert"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
        <Field label="Name" htmlFor="ent-name" required><input id="ent-name" value={name} onChange={(e) => setName(e.target.value)} className="field-input" maxLength={120} autoFocus /></Field>
        {kind === 'category' && (
          <Field label="Type" htmlFor="ent-kind" hint="Services (installation, repairs) are shown with booking wording.">
            <select id="ent-kind" value={categoryKind} onChange={(e) => setCategoryKind(e.target.value as 'product' | 'service')} className="field-input"><option value="product">Products</option><option value="service">Services</option></select>
          </Field>
        )}
        <Field label="Description" htmlFor="ent-desc" hint="Shown on the store page."><textarea id="ent-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="field-input" maxLength={1000} /></Field>
        <ImageUploadField value={image} onChange={setImage} label={kind === 'category' ? 'Cover image (optional)' : 'Logo (optional)'} />
      </form>
    </Modal>
  );
};
