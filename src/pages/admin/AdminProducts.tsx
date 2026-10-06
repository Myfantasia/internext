import React, { useState } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Download,
  Upload,
  Sparkles,
  CheckCircle2,
  X,
  Layers,
  Save,
  AlertTriangle
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { Product } from '../../types';
import { ImageUploadField } from '../../components/admin/ImageUploadField';
import { SpecsEditor, cleanSpecs, Specs } from '../../components/admin/SpecsEditor';
import { Modal, Field } from './adminUi';

export const AdminProducts: React.FC = () => {
  const { products, categories, brands, formatPrice, refreshProducts } = useStore();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    brand: 'Apple',
    category: 'Smartphones',
    price: 150000,
    compareAtPrice: 175000,
    stock: 10,
    sku: 'IPH16-128-BLK',
    condition: 'Brand New',
    warranty: '1 Year Apple Care Kenya Warranty',
    thumbnail: '',
    shortSpecs: '6.3" Super Retina XDR • A18 Pro • 128GB NVMe • 48MP Triple Fusion Camera',
    description: '',
    specs: {} as Specs,
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: false
  });

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      brand: brands[0]?.name || '',
      category: categories[0]?.name || '',
      price: 0,
      compareAtPrice: 0,
      stock: 0,
      sku: 'PROD-' + Date.now().toString().slice(-6),
      condition: 'Brand New',
      warranty: '1 Year Manufacturer Warranty',
      thumbnail: '',
      shortSpecs: '',
      description: '',
      specs: {} as Specs,
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: p.price,
      compareAtPrice: p.compareAtPrice || 0,
      stock: p.stock,
      sku: p.sku,
      condition: p.condition,
      warranty: p.warranty,
      thumbnail: p.thumbnail,
      shortSpecs: p.shortSpecs || '',
      description: p.description || '',
      specs: (p.specs || {}) as Specs,
      isFeatured: !!p.isFeatured,
      isNewArrival: !!p.isNewArrival,
      isBestSeller: !!p.isBestSeller
    });
    setIsModalOpen(true);
  };

  const payload = () => ({
    ...formData,
    compareAtPrice: formData.compareAtPrice ? formData.compareAtPrice : null,
    specs: cleanSpecs(formData.specs),
    images: formData.thumbnail ? [formData.thumbnail] : []
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.sku.trim()) {
      showToast('Please provide product title and SKU', 'error');
      return;
    }
    if (!formData.thumbnail) {
      showToast('Please upload a product image', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingProduct) {
        const res = await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload())
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Product ${data.product.name} updated!`, 'success');
          refreshProducts();
          setIsModalOpen(false);
        } else {
          showToast(data.message || 'Could not update product', 'error');
        }
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload())
        });
        const data = await res.json();
        if (data.success) {
          showToast(`New product ${data.product.name} added to catalog!`, 'success');
          refreshProducts();
          setIsModalOpen(false);
        } else {
          showToast(data.message || 'Could not add product', 'error');
        }
      }
    } catch (e) {
      showToast('Error saving product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from the catalog?`)) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Product deleted from inventory', 'success');
        refreshProducts();
      }
    } catch (e) {
      showToast('Error deleting product', 'error');
    }
  };

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'ID,Name,Brand,Category,SKU,Price,Stock,Condition,Warranty\n' +
      products
        .map(
          (p) =>
            `"${p.id}","${p.name.replace(/"/g, '""')}","${p.brand}","${p.category}","${p.sku}",${p.price},${p.stock},"${p.condition}","${p.warranty}"`
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `internext_products_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Catalog CSV exported successfully!', 'success');
  };

  const filteredProducts = products.filter((p) => {
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterLowStock && p.stock > 5) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Product Catalog & Hardware Inventory</h2>
          <p className="text-xs text-slate-400">Manage tech models, variants, pricing, and stock levels</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, SKU, or manufacturer..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Categories ({products.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3 flex items-center">
          <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-300">
            <input
              type="checkbox"
              checked={filterLowStock}
              onChange={(e) => setFilterLowStock(e.target.checked)}
              className="rounded bg-slate-800 text-cyan-600 focus:ring-cyan-500"
            />
            <span className="flex items-center gap-1 text-rose-400 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" /> Low Stock Only (≤ 5)
            </span>
          </label>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3.5">Product & SKU</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Brand</th>
                <th className="p-3.5">Stock</th>
                <th className="p-3.5">Price</th>
                <th className="p-3.5">Status Badges</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredProducts.map((prod) => (
                <tr key={prod.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <img
                        src={prod.thumbnail}
                        alt=""
                        className="w-12 h-12 rounded-xl object-contain bg-slate-950 p-1 border border-slate-800 shrink-0"
                      />
                      <div className="min-w-0 max-w-xs">
                        <div className="font-bold text-white truncate">{prod.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">SKU: {prod.sku}</div>
                      </div>
                    </div>
                  </td>

                  <td className="p-3.5 text-slate-300">{prod.category}</td>
                  <td className="p-3.5 font-bold text-cyan-400">{prod.brand}</td>

                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] font-mono ${
                        prod.stock > 10
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : prod.stock > 0
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {prod.stock} units
                    </span>
                  </td>

                  <td className="p-3.5 font-black text-white font-mono">{formatPrice(prod.price)}</td>

                  <td className="p-3.5">
                    <div className="flex flex-wrap gap-1">
                      {prod.isFeatured && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[9px] font-bold">Featured</span>
                      )}
                      {prod.isFlashDeal && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 text-[9px] font-bold">Flash Deal</span>
                      )}
                      {prod.isBestSeller && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-400 text-[9px] font-bold">Best Seller</span>
                      )}
                    </div>
                  </td>

                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(prod)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-colors"
                        title="Edit Product"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(prod.id, prod.name)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 transition-colors"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT PRODUCT MODAL */}
      {isModalOpen && (
        <Modal
          title={editingProduct ? `Edit ${editingProduct.name}` : 'Add product'}
          description="Prices include VAT. Flash-deal discounts are set under Marketing → Flash Deals."
          onClose={() => setIsModalOpen(false)}
          footer={<>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" form="product-form" disabled={saving} className="btn btn-primary"><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save product'}</button>
          </>}
        >
          <form id="product-form" onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-4">
              <Field label="Product name" htmlFor="p-name" required>
                <input id="p-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. HP ProBook 450 G10 Business Laptop" className="field-input" required maxLength={200} />
              </Field>
              <Field label="Key features (one line)" htmlFor="p-short" hint="Separate with | — shown on product cards and in comparisons, e.g. Intel Core i5-1334U | 8GB RAM | 512GB SSD">
                <input id="p-short" value={formData.shortSpecs} onChange={(e) => setFormData({ ...formData, shortSpecs: e.target.value })} className="field-input" maxLength={300} />
              </Field>
              <Field label="Description" htmlFor="p-desc" hint="What it is, who it suits and what's in the box. Leave a blank line between paragraphs. Avoid claims you can't back up.">
                <textarea id="p-desc" rows={7} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="field-input leading-relaxed" maxLength={10000} />
              </Field>
              <div>
                <span className="field-label">Specifications</span>
                <SpecsEditor value={formData.specs} onChange={(specs) => setFormData({ ...formData, specs })} />
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <ImageUploadField value={formData.thumbnail} onChange={(url) => setFormData({ ...formData, thumbnail: url })} label="Product image" hint="JPG, PNG, WebP or GIF up to 8 MB" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Brand" htmlFor="p-brand">
                  <select id="p-brand" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="field-input">
                    {brands.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </Field>
                <Field label="Category" htmlFor="p-cat">
                  <select id="p-cat" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="field-input">
                    {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Price (KES)" htmlFor="p-price" required><input id="p-price" type="number" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} className="field-input font-mono" required /></Field>
                <Field label="Was price (KES)" htmlFor="p-was" hint="Optional strike-through."><input id="p-was" type="number" min="0" value={formData.compareAtPrice || ''} onChange={(e) => setFormData({ ...formData, compareAtPrice: Number(e.target.value) })} className="field-input font-mono" /></Field>
                <Field label="SKU" htmlFor="p-sku" required><input id="p-sku" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} className="field-input font-mono" required /></Field>
                <Field label="Stock" htmlFor="p-stock" required><input id="p-stock" type="number" min="0" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })} className="field-input font-mono" required /></Field>
                <Field label="Condition" htmlFor="p-cond"><input id="p-cond" list="conditions" value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value })} className="field-input" /><datalist id="conditions"><option value="Brand New Sealed" /><option value="Brand New" /><option value="Ex-UK Grade A" /><option value="Ex-UK Grade B" /><option value="Refurbished" /><option value="Service" /></datalist></Field>
                <Field label="Warranty" htmlFor="p-war"><input id="p-war" value={formData.warranty} onChange={(e) => setFormData({ ...formData, warranty: e.target.value })} className="field-input" /></Field>
              </div>
              <fieldset className="space-y-2">
                <legend className="field-label">Merchandising</legend>
                {([['isFeatured', 'Featured on the home page'], ['isNewArrival', 'New arrival'], ['isBestSeller', 'Best seller']] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={!!(formData as any)[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })} className="h-4 w-4 accent-[var(--t-accent-600)]" />{label}
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
