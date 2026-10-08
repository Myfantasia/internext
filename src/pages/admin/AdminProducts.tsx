import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Package, Plus, Search, Edit2, Trash2, Download, Save, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { Product } from '../../types';
import { ImageUploadField } from '../../components/admin/ImageUploadField';
import { SpecsEditor, cleanSpecs, Specs } from '../../components/admin/SpecsEditor';
import { useAuth } from '../../context/AuthContext';
import { useCatalogLists } from './useCatalogLists';
import { CatalogEntityDrawer, CatalogKind } from './CatalogEntityPage';
import { Modal, Field, PageHeader, Pagination, EmptyState, ErrorState, LoadingBlock, useDebounced, api, kes } from './adminUi';

// Product list is paged, searched, filtered and sorted on the server
// (GET /api/products/admin), so the browser never loads the whole catalog.

type AdminProduct = Product & { available: number };
interface ListResponse {
  products: AdminProduct[]; total: number; page: number; limit: number; totalPages: number;
  counts: { all: number; active: number; inactive: number; out: number; low: number };
}
type StockFilter = '' | 'in' | 'low' | 'out';
type StatusFilter = 'all' | 'active' | 'inactive';

const SORTS = [
  ['updated-desc', 'Recently updated'], ['created-desc', 'Newest'], ['name-asc', 'Name A–Z'], ['name-desc', 'Name Z–A'],
  ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['stock-asc', 'Stock: lowest first'], ['stock-desc', 'Stock: highest first']
] as const;

const blankForm = () => ({
  name: '', brandId: '', categoryId: '', price: '' as number | '', compareAtPrice: '' as number | '', costPrice: '' as number | '',
  stock: 0 as number | '', reorderLevel: 4 as number | '', sku: 'PROD-' + Date.now().toString().slice(-6),
  condition: 'Brand New', warranty: '1 Year Manufacturer Warranty', thumbnail: '', shortSpecs: '', description: '',
  specs: {} as Specs, isFeatured: false, isNewArrival: false, isBestSeller: false, isActive: true
});
type FormState = ReturnType<typeof blankForm>;

// Filters can be preset from the URL, e.g. a category drawer's "View products".
function initialFilters() {
  const q = new URLSearchParams(window.location.search);
  const stock = q.get('stock');
  return { categoryId: q.get('categoryId') || '', brandId: q.get('brandId') || '', stock: (['in', 'low', 'out'].includes(stock || '') ? stock : '') as StockFilter, openNew: q.get('new') === '1' };
}

export const AdminProducts: React.FC = () => {
  const { refreshProducts, refreshCatalog } = useStore();
  const { categories, brands } = useCatalogLists();
  const { showToast } = useToast();
  const { can } = useAuth();
  const canCreate = can('products:create');
  const canEditAll = can('products:create'); // sales managers may only change price & stock
  const canDelete = can('products:delete');
  const preset = useRef(initialFilters());

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [categoryId, setCategoryId] = useState(preset.current.categoryId);
  const [brandId, setBrandId] = useState(preset.current.brandId);
  const [stock, setStock] = useState<StockFilter>(preset.current.stock);
  // Category/brand detail opened from a name in the table.
  const [entityView, setEntityView] = useState<{ kind: CatalogKind; id: string } | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState('updated-desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSeq = useRef(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormState>(blankForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  const query = useCallback((p = page, l = limit) => {
    const qs = new URLSearchParams({ page: String(p), limit: String(l), sort: debouncedSearch && sort === 'updated-desc' ? '' : sort, status });
    if (debouncedSearch.trim()) qs.set('search', debouncedSearch.trim());
    if (categoryId) qs.set('categoryId', categoryId);
    if (brandId) qs.set('brandId', brandId);
    if (stock) qs.set('stock', stock);
    return qs;
  }, [page, limit, debouncedSearch, sort, status, categoryId, brandId, stock]);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    try {
      const res = await api<ListResponse>(`/api/products/admin?${query()}`);
      if (seq !== requestSeq.current) return; // a newer search/page already started
      if (res.page > 1 && res.page > res.totalPages) { setPage(res.totalPages); return; }
      setData(res);
    } catch (e: any) {
      if (seq === requestSeq.current) setError(e.message || 'Could not load products');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);
  // Any new search or filter starts again from page 1.
  useEffect(() => { setPage(1); }, [debouncedSearch, categoryId, brandId, stock, status, sort, limit]);

  const openCreate = useCallback(() => {
    setEditingProduct(null);
    setFormData({ ...blankForm(), categoryId: categoryId || categories[0]?.id || '', brandId: brandId || '' });
    setFormErrors({});
    setIsModalOpen(true);
  }, [categoryId, brandId, categories]);

  useEffect(() => {
    if (preset.current.openNew && canCreate && categories.length) { preset.current.openNew = false; openCreate(); }
  }, [categories.length, canCreate, openCreate]);

  const openEdit = (p: AdminProduct) => {
    setEditingProduct(p);
    setFormData({
      name: p.name, brandId: p.brandId || '', categoryId: p.categoryId || '', price: p.price, compareAtPrice: p.compareAtPrice ?? '',
      costPrice: p.costPrice ?? '', stock: p.stock, reorderLevel: p.reorderLevel ?? 4, sku: p.sku, condition: p.condition || '',
      warranty: p.warranty || '', thumbnail: p.thumbnail || '', shortSpecs: p.shortSpecs || '', description: p.description || '',
      specs: (p.specs || {}) as Specs, isFeatured: !!p.isFeatured, isNewArrival: !!p.isNewArrival, isBestSeller: !!p.isBestSeller, isActive: p.isActive !== false
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormData((f) => ({ ...f, [key]: value }));
    if (formErrors[key as string]) setFormErrors((e) => { const next = { ...e }; delete next[key as string]; return next; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (formData.name.trim().length < 2) e.name = 'Enter the product name';
    if (!/^[A-Za-z0-9._\-/]{2,60}$/.test(formData.sku.trim())) e.sku = 'Use 2–60 letters, numbers, . _ - or /';
    if (!formData.categoryId) e.categoryId = 'Choose a category';
    if (formData.price === '' || Number(formData.price) < 0) e.price = 'Enter the selling price';
    if (formData.compareAtPrice !== '' && Number(formData.compareAtPrice) > 0 && Number(formData.compareAtPrice) <= Number(formData.price)) e.compareAtPrice = 'The "was" price must be higher than the selling price';
    if (formData.costPrice !== '' && Number(formData.costPrice) < 0) e.costPrice = 'Cost cannot be negative';
    if (formData.stock === '' || Number(formData.stock) < 0 || !Number.isInteger(Number(formData.stock))) e.stock = 'Enter a whole number, 0 or more';
    if (!formData.thumbnail) e.thumbnail = 'Upload a product image';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const payload = () => ({
    name: formData.name.trim(), sku: formData.sku.trim(), categoryId: formData.categoryId, brandId: formData.brandId || null,
    price: Number(formData.price), compareAtPrice: formData.compareAtPrice === '' || Number(formData.compareAtPrice) === 0 ? null : Number(formData.compareAtPrice),
    costPrice: formData.costPrice === '' ? null : Number(formData.costPrice), stock: Number(formData.stock), reorderLevel: formData.reorderLevel === '' ? 4 : Number(formData.reorderLevel),
    condition: formData.condition, warranty: formData.warranty, thumbnail: formData.thumbnail, images: formData.thumbnail ? [formData.thumbnail] : [],
    shortSpecs: formData.shortSpecs, description: formData.description, specs: cleanSpecs(formData.specs),
    isFeatured: formData.isFeatured, isNewArrival: formData.isNewArrival, isBestSeller: formData.isBestSeller, isActive: formData.isActive
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!validate()) { showToast('Please fix the highlighted fields', 'error'); return; }
    setSaving(true);
    try {
      const res = await api<{ product: Product }>(editingProduct ? `/api/products/${editingProduct.id}` : '/api/products', { method: editingProduct ? 'PUT' : 'POST', body: payload() });
      showToast(editingProduct ? `${res.product.name} updated` : `${res.product.name} added to the catalog`, 'success');
      setIsModalOpen(false);
      load();
      refreshCatalog();
    } catch (err: any) {
      // Keep everything typed; show the server's reason (e.g. duplicate SKU).
      const message = err.message || 'Could not save the product';
      if (/sku/i.test(message)) setFormErrors((f) => ({ ...f, sku: message }));
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: AdminProduct) => {
    try {
      await api(`/api/products/${p.id}`, { method: 'PUT', body: { isActive: p.isActive === false } });
      showToast(p.isActive === false ? `${p.name} is visible in the store` : `${p.name} is hidden from the store`, 'success');
      load();
      refreshProducts();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (p: AdminProduct) => {
    if (!window.confirm(`Delete "${p.name}" from the catalog? Products that appear on past orders can't be deleted — hide them instead.`)) return;
    try {
      const res = await api<{ deactivated?: boolean; message?: string }>(`/api/products/${p.id}`, { method: 'DELETE' });
      showToast(res.deactivated ? (res.message || 'Hidden from the store (it has order history)') : 'Product deleted', 'success');
      load();
      refreshProducts();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Exports every product matching the current filters, page by page.
  const handleExport = async () => {
    setExporting(true);
    try {
      const rows: AdminProduct[] = [];
      for (let p = 1; p <= 50; p += 1) {
        const res = await api<ListResponse>(`/api/products/admin?${query(p, 100)}`);
        rows.push(...res.products);
        if (p >= res.totalPages) break;
      }
      const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = ['ID,Name,SKU,Brand,Category,Price,Cost,Stock,Available,Reorder level,Condition,Warranty,Active']
        .concat(rows.map((p) => [p.id, p.name, p.sku, p.brand, p.category, p.price, p.costPrice ?? '', p.stock, p.available, p.reorderLevel, p.condition, p.warranty, p.isActive !== false ? 'yes' : 'no'].map(cell).join(',')))
        .join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = Object.assign(document.createElement('a'), { href: url, download: `internext-products-${new Date().toISOString().slice(0, 10)}.csv` });
      link.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${rows.length} products`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const counts = data?.counts;
  const chips: { key: string; label: string; count?: number; active: boolean; onClick: () => void }[] = [
    { key: 'all', label: 'All', count: counts?.all, active: status === 'all' && !stock, onClick: () => { setStatus('all'); setStock(''); } },
    { key: 'active', label: 'Active', count: counts?.active, active: status === 'active' && !stock, onClick: () => { setStatus('active'); setStock(''); } },
    { key: 'inactive', label: 'Hidden', count: counts?.inactive, active: status === 'inactive', onClick: () => { setStatus('inactive'); setStock(''); } },
    { key: 'low', label: 'Low stock', count: counts?.low, active: stock === 'low', onClick: () => { setStock('low'); setStatus('all'); } },
    { key: 'out', label: 'Out of stock', count: counts?.out, active: stock === 'out', onClick: () => { setStock('out'); setStatus('all'); } }
  ];
  const filtersActive = !!(debouncedSearch || categoryId || brandId || stock || status !== 'all');
  const clearFilters = () => { setSearch(''); setCategoryId(''); setBrandId(''); setStock(''); setStatus('all'); };

  const stockBadge = (p: AdminProduct) => {
    if (p.available <= 0) return <span className="badge badge-danger">Out of stock</span>;
    if (p.stock <= (p.reorderLevel ?? 4)) return <span className="badge badge-warning">Low · {p.available}</span>;
    return <span className="badge badge-success">{p.available} available</span>;
  };

  const rowActions = (p: AdminProduct) => (
    <div className="flex items-center justify-end gap-1">
      <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="icon-button" title="Edit" aria-label={`Edit ${p.name}`}><Edit2 className="w-4 h-4" /></button>
      {canEditAll && <button type="button" onClick={(e) => { e.stopPropagation(); toggleActive(p); }} className="icon-button" title={p.isActive === false ? 'Show in store' : 'Hide from store'} aria-label={p.isActive === false ? `Show ${p.name}` : `Hide ${p.name}`}>{p.isActive === false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>}
      <a href={`/products/${p.slug}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="icon-button" title="View in store" aria-label={`View ${p.name} in store`}><ExternalLink className="w-4 h-4" /></a>
      {canDelete && <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(p); }} className="icon-button hover:!text-rose-400" title="Delete" aria-label={`Delete ${p.name}`}><Trash2 className="w-4 h-4" /></button>}
    </div>
  );

  const err = (k: string) => formErrors[k] ? <p className="field-error">{formErrors[k]}</p> : null;
  const inputCls = (k: string, extra = '') => `field-input ${extra} ${formErrors[k] ? 'field-input-error' : ''}`;
  const priceOnly = !canEditAll && !!editingProduct;

  return (
    <div className="space-y-5 animate-fadeInUp">
      <PageHeader
        icon={Package}
        title="Products"
        description="Search, filter and manage the catalog. Hidden products stay on past orders but disappear from the store."
        actions={<>
          <button type="button" onClick={handleExport} disabled={exporting || !data?.total} className="btn btn-secondary"><Download className="w-4 h-4" />{exporting ? 'Exporting…' : 'Export CSV'}</button>
          {canCreate && <button type="button" onClick={openCreate} className="btn btn-primary"><Plus className="w-4 h-4" />Add product</button>}
        </>}
      />

      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, SKU, brand or specs…" className="field-input pl-10" aria-label="Search products" />
          </div>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="field-input md:col-span-2" aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="field-input md:col-span-2" aria-label="Brand">
            <option value="">All brands</option>
            <option value="none">No brand</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="field-input md:col-span-3" aria-label="Sort by">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button key={c.key} type="button" onClick={c.onClick} aria-pressed={c.active} className={`btn btn-sm ${c.active ? 'btn-primary' : 'btn-ghost'}`}>
              {c.label}{c.count != null && <span className="opacity-75 tabular-nums">{c.count}</span>}
            </button>
          ))}
          {filtersActive && <button type="button" onClick={clearFilters} className="btn btn-sm btn-ghost text-cyan-400 ml-auto">Clear filters</button>}
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : !data && loading ? <LoadingBlock label="Loading products…" /> : data && data.total === 0 ? (
        <EmptyState
          title={filtersActive ? 'No products match these filters' : 'No products yet'}
          text={filtersActive ? 'Try a different search or clear the filters.' : 'Add your first product to start selling.'}
          action={filtersActive ? <button type="button" onClick={clearFilters} className="btn btn-secondary btn-sm">Clear filters</button> : canCreate ? <button type="button" onClick={openCreate} className="btn btn-primary btn-sm"><Plus className="w-4 h-4" />Add product</button> : undefined}
        />
      ) : data && (
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          {/* Phones: cards */}
          <ul className="md:hidden space-y-3">
            {data.products.map((p) => (
              <li key={p.id} className="card p-3 flex gap-3" onClick={() => openEdit(p)}>
                <img src={p.thumbnail} alt="" className="w-16 h-16 rounded-xl object-contain bg-slate-950 p-1 border border-slate-800 shrink-0" loading="lazy" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-semibold text-white text-sm line-clamp-2">{p.name}</div>
                  <div className="text-xs text-slate-400 truncate">
                    <span className="font-mono">{p.sku}</span>
                    {p.categoryId && <> · <button type="button" onClick={(e) => { e.stopPropagation(); setEntityView({ kind: 'category', id: p.categoryId! }); }} className="hover:text-cyan-400 underline-offset-2 hover:underline">{p.category}</button></>}
                    {p.brandId && <> · <button type="button" onClick={(e) => { e.stopPropagation(); setEntityView({ kind: 'brand', id: p.brandId! }); }} className="hover:text-cyan-400 underline-offset-2 hover:underline">{p.brand}</button></>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-white text-sm">{kes(p.price)}</span>{stockBadge(p)}{p.isActive === false && <span className="badge badge-neutral">Hidden</span>}</div>
                  {rowActions(p)}
                </div>
              </li>
            ))}
          </ul>

          {/* Tablet & desktop: table */}
          <div className="hidden md:block card overflow-hidden">
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Product</th><th>Category / brand</th><th className="text-right">Price</th><th>Stock</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {data.products.map((p) => (
                    <tr key={p.id} onClick={() => openEdit(p)} className="cursor-pointer">
                      <td className="max-w-[22rem]">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={p.thumbnail} alt="" className="w-11 h-11 rounded-lg object-contain bg-slate-950 p-1 border border-slate-800 shrink-0" loading="lazy" />
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate" title={p.name}>{p.name}</div>
                            <div className="text-xs text-slate-500 font-mono truncate">{p.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs">
                        {p.categoryId ? <button type="button" onClick={(e) => { e.stopPropagation(); setEntityView({ kind: 'category', id: p.categoryId! }); }} className="block text-slate-200 hover:text-cyan-400 hover:underline text-left">{p.category}</button> : <div className="text-slate-500">—</div>}
                        {p.brandId ? <button type="button" onClick={(e) => { e.stopPropagation(); setEntityView({ kind: 'brand', id: p.brandId! }); }} className="block text-slate-400 hover:text-cyan-400 hover:underline text-left">{p.brand}</button> : <div className="text-slate-500">No brand</div>}
                      </td>
                      <td className="text-right whitespace-nowrap tabular-nums"><div className="font-semibold text-white">{kes(p.price)}</div>{p.compareAtPrice ? <div className="text-xs text-slate-500 line-through">{kes(p.compareAtPrice)}</div> : null}</td>
                      <td className="whitespace-nowrap">{stockBadge(p)}{p.reservedStock ? <div className="text-[11px] text-slate-500 mt-1">{p.reservedStock} held by orders</div> : null}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {p.isActive === false ? <span className="badge badge-neutral">Hidden</span> : <span className="badge badge-success">Live</span>}
                          {p.isFeatured && <span className="badge badge-info">Featured</span>}
                          {p.isBestSeller && <span className="badge badge-info">Best seller</span>}
                        </div>
                      </td>
                      <td className="text-right">{rowActions(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={limit} noun="products" onPage={setPage} onLimit={setLimit} busy={loading} />
        </div>
      )}

      {entityView && (() => {
        const entity = (entityView.kind === 'category' ? categories : brands).find((e) => e.id === entityView.id);
        return entity ? (
          <CatalogEntityDrawer
            kind={entityView.kind} entity={entity} onClose={() => setEntityView(null)}
            // We are already on Products: apply the filter here instead of navigating.
            onNavigate={(_tab, params = {}) => {
              setEntityView(null);
              setCategoryId(params.categoryId || '');
              setBrandId(params.brandId || '');
              setStock((params.stock as StockFilter) || '');
              setStatus('all');
              if (params.new) {
                setEditingProduct(null);
                setFormData({ ...blankForm(), categoryId: params.categoryId || categories[0]?.id || '', brandId: params.brandId || '' });
                setFormErrors({});
                setIsModalOpen(true);
              }
            }}
          />
        ) : null;
      })()}

      {isModalOpen && (
        <Modal
          layout="split"
          title={editingProduct ? `Edit ${editingProduct.name}` : 'Add product'}
          description={priceOnly ? 'Sales managers can update price, stock and reorder level.' : 'Prices include VAT. Flash-deal discounts are set under Marketing → Flash Deals.'}
          onClose={() => setIsModalOpen(false)}
          footer={<>
            {Object.keys(formErrors).length > 0 && <p className="text-sm text-rose-400 sm:mr-auto self-center" role="alert">{Object.keys(formErrors).length} field{Object.keys(formErrors).length > 1 ? 's need' : ' needs'} attention</p>}
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" form="product-form" disabled={saving} className="btn btn-primary"><Save className="w-4 h-4" />{saving ? 'Saving…' : editingProduct ? 'Save changes' : 'Add product'}</button>
          </>}
        >
          <form id="product-form" onSubmit={handleSave} noValidate className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:h-full">
            <fieldset disabled={priceOnly} className="lg:col-span-3 split-col space-y-6 min-w-0">
              <section className="space-y-4">
                <h4 className="eyebrow">Basic information</h4>
                <Field label="Product name" htmlFor="p-name" required>
                  <input id="p-name" value={formData.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. HP ProBook 450 G10 Business Laptop" className={inputCls('name')} maxLength={200} aria-invalid={!!formErrors.name} />
                  {err('name')}
                </Field>
                <Field label="Key features (one line)" htmlFor="p-short" hint="Separate with | — shown on product cards, e.g. Intel Core i5-1334U | 8GB RAM | 512GB SSD">
                  <input id="p-short" value={formData.shortSpecs} onChange={(e) => set('shortSpecs', e.target.value)} className="field-input" maxLength={300} />
                </Field>
                <Field label="Description" htmlFor="p-desc" hint="What it is, who it suits and what's in the box. Leave a blank line between paragraphs.">
                  <textarea id="p-desc" rows={6} value={formData.description} onChange={(e) => set('description', e.target.value)} className="field-input leading-relaxed" maxLength={10000} />
                </Field>
              </section>
              <section className="space-y-3">
                <h4 className="eyebrow">Specifications</h4>
                <SpecsEditor value={formData.specs} onChange={(specs) => set('specs', specs)} />
              </section>
            </fieldset>

            <div className="lg:col-span-2 split-col space-y-6 min-w-0">
              <fieldset disabled={priceOnly} className="space-y-4">
                <h4 className="eyebrow">Image</h4>
                <ImageUploadField value={formData.thumbnail} onChange={(url) => set('thumbnail', url)} label="Product image" hint="JPG, PNG, WebP or GIF up to 4 MB" />
                {err('thumbnail')}
                <h4 className="eyebrow pt-2">Brand & category</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Category" htmlFor="p-cat" required>
                    <select id="p-cat" value={formData.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={inputCls('categoryId')}>
                      <option value="">Choose…</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {err('categoryId')}
                  </Field>
                  <Field label="Brand" htmlFor="p-brand">
                    <select id="p-brand" value={formData.brandId} onChange={(e) => set('brandId', e.target.value)} className="field-input">
                      <option value="">No brand</option>
                      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Condition" htmlFor="p-cond">
                    <input id="p-cond" list="conditions" value={formData.condition} onChange={(e) => set('condition', e.target.value)} className="field-input" />
                    <datalist id="conditions"><option value="Brand New Sealed" /><option value="Brand New" /><option value="Ex-UK Grade A" /><option value="Ex-UK Grade B" /><option value="Refurbished" /><option value="Service" /></datalist>
                  </Field>
                  <Field label="Warranty" htmlFor="p-war"><input id="p-war" value={formData.warranty} onChange={(e) => set('warranty', e.target.value)} className="field-input" /></Field>
                </div>
              </fieldset>

              <section className="space-y-4">
                <h4 className="eyebrow">Pricing</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Selling price (KES)" htmlFor="p-price" required>
                    <input id="p-price" type="number" inputMode="decimal" min="0" value={formData.price} onChange={(e) => set('price', e.target.value === '' ? '' : Number(e.target.value))} className={inputCls('price', 'font-mono')} />
                    {err('price')}
                  </Field>
                  <Field label="Was price (KES)" htmlFor="p-was" hint="Optional strike-through.">
                    <input id="p-was" type="number" inputMode="decimal" min="0" value={formData.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value === '' ? '' : Number(e.target.value))} className={inputCls('compareAtPrice', 'font-mono')} />
                    {err('compareAtPrice')}
                  </Field>
                  <Field label="Cost price (KES)" htmlFor="p-cost" hint="Private. Used for margin on the finance dashboard.">
                    <input id="p-cost" type="number" inputMode="decimal" min="0" value={formData.costPrice} disabled={priceOnly} onChange={(e) => set('costPrice', e.target.value === '' ? '' : Number(e.target.value))} className={inputCls('costPrice', 'font-mono')} />
                    {err('costPrice')}
                  </Field>
                  {formData.costPrice !== '' && Number(formData.price) > 0 && (
                    <div className="text-xs text-slate-400 self-end pb-3">Margin: <strong className="text-slate-200">{kes(Number(formData.price) - Number(formData.costPrice))}</strong> ({(((Number(formData.price) - Number(formData.costPrice)) / Number(formData.price)) * 100).toFixed(1)}%)</div>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="eyebrow">Inventory</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="SKU" htmlFor="p-sku" required>
                    <input id="p-sku" value={formData.sku} disabled={priceOnly} onChange={(e) => set('sku', e.target.value)} className={inputCls('sku', 'font-mono')} />
                    {err('sku')}
                  </Field>
                  <Field label="Stock on hand" htmlFor="p-stock" required>
                    <input id="p-stock" type="number" inputMode="numeric" min="0" step="1" value={formData.stock} onChange={(e) => set('stock', e.target.value === '' ? '' : Number(e.target.value))} className={inputCls('stock', 'font-mono')} />
                    {err('stock')}
                  </Field>
                  <Field label="Reorder level" htmlFor="p-reorder" hint="Flagged as low stock at or below this.">
                    <input id="p-reorder" type="number" inputMode="numeric" min="0" step="1" value={formData.reorderLevel} onChange={(e) => set('reorderLevel', e.target.value === '' ? '' : Number(e.target.value))} className="field-input font-mono" />
                  </Field>
                </div>
              </section>

              <fieldset disabled={priceOnly} className="space-y-2">
                <legend className="eyebrow mb-2">Visibility & merchandising</legend>
                {([['isActive', 'Visible in the store'], ['isFeatured', 'Featured on the home page'], ['isNewArrival', 'New arrival'], ['isBestSeller', 'Best seller']] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={!!formData[key]} onChange={(e) => set(key, e.target.checked)} className="h-4 w-4 accent-[var(--t-accent-600)]" />{label}
                  </label>
                ))}
              </fieldset>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
