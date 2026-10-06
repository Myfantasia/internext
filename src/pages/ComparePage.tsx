import React, { useState } from 'react';
import {
  Scale,
  X,
  Plus,
  ShoppingCart,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Trash2,
  Star
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { CartDrawer } from '../components/checkout/CartDrawer';
import { useCompare } from '../context/CompareContext';
import { useStore } from '../context/StoreContext';
import { useCart } from '../context/CartContext';
import { Product } from '../types';

export const ComparePage: React.FC = () => {
  const { compareList, removeFromCompare, clearCompare, addToCompare } = useCompare();
  const { products, formatPrice } = useStore();
  const { addToCart } = useCart();
  const [highlightDifferences, setHighlightDifferences] = useState<boolean>(false);
  const [searchPicker, setSearchPicker] = useState<string>('');

  const [onlyDifferences, setOnlyDifferences] = useState(false);

  // Suggest same-category products first — comparisons across categories are rarely meaningful.
  const primaryCategory = compareList[0]?.category;
  const availableToAdd = products
    .filter((p) => !compareList.some((c) => c.id === p.id))
    .sort((a, b) => Number(b.category === primaryCategory) - Number(a.category === primaryCategory));
  const mixedCategories = new Set(compareList.map((p) => p.category)).size > 1;

  // Rows: general facts, then every specification section/attribute present on
  // ANY compared product (category-aware by construction), skipping attributes
  // that none of them have.
  type Row =
    | { type: 'section'; key: string; label: string }
    | { type: 'row'; key: string; label: string; values: (string | null)[]; render?: (p: Product) => React.ReactNode; className?: string };
  const rows: Row[] = [];
  const effPrice = (p: Product) => p.flashDeal?.dealPrice ?? p.price;
  rows.push({ type: 'section', key: 's-overview', label: 'Overview' });
  rows.push({ type: 'row', key: 'price', label: 'Price', values: compareList.map((p) => String(effPrice(p))), className: 'font-black text-emerald-400', render: (p) => (
    <span>{formatPrice(effPrice(p))}{p.flashDeal && <span className="block text-[11px] font-normal text-amber-300">Flash deal · was {formatPrice(p.price)}</span>}</span>
  ) });
  rows.push({ type: 'row', key: 'brand', label: 'Brand', values: compareList.map((p) => p.brand || null) });
  rows.push({ type: 'row', key: 'category', label: 'Category', values: compareList.map((p) => p.category || null) });
  rows.push({ type: 'row', key: 'condition', label: 'Condition', values: compareList.map((p) => p.condition || null) });
  rows.push({ type: 'row', key: 'warranty', label: 'Warranty', values: compareList.map((p) => p.warranty || null) });
  rows.push({ type: 'row', key: 'stock', label: 'Availability', values: compareList.map((p) => (p.stock > 0 ? 'in' : 'out')), render: (p) => (
    p.stock > 0 ? <span className="text-emerald-400 font-semibold">{p.stock <= 5 ? `Only ${p.stock} left` : 'In stock'}</span> : <span className="text-rose-400 font-semibold">Out of stock</span>
  ) });
  rows.push({ type: 'row', key: 'rating', label: 'Customer rating', values: compareList.map((p) => String(p.rating)), render: (p) => (
    p.reviewsCount ? <span className="flex items-center gap-1 text-amber-400 font-bold"><Star className="w-3.5 h-3.5 fill-amber-400" />{Number(p.rating).toFixed(1)}<span className="text-slate-500 font-normal">({p.reviewsCount})</span></span> : <span className="text-slate-500">No reviews yet</span>
  ) });
  rows.push({ type: 'row', key: 'features', label: 'Key features', values: compareList.map((p) => p.shortSpecs || null), className: 'text-[12px] leading-relaxed', render: (p) => (
    p.shortSpecs ? <ul className="space-y-1">{p.shortSpecs.split('|').map((f) => f.trim()).filter(Boolean).map((f) => <li key={f}>• {f}</li>)}</ul> : <span className="text-slate-500">—</span>
  ) });

  const sectionOrder: string[] = [];
  const attrsBySection = new Map<string, string[]>();
  for (const p of compareList) {
    for (const [section, attrs] of Object.entries(p.specs || {})) {
      if (!attrs || !Object.keys(attrs).length) continue;
      if (!attrsBySection.has(section)) { attrsBySection.set(section, []); sectionOrder.push(section); }
      const list = attrsBySection.get(section)!;
      for (const key of Object.keys(attrs)) if (!list.includes(key)) list.push(key);
    }
  }
  for (const section of sectionOrder) {
    // "Brand/Condition/Warranty" already appear in Overview.
    const keys = attrsBySection.get(section)!.filter((k) => !(section === 'General' && ['Brand', 'Condition', 'Warranty'].includes(k)));
    if (!keys.length) continue;
    rows.push({ type: 'section', key: `s-${section}`, label: section });
    for (const key of keys) {
      rows.push({ type: 'row', key: `${section}-${key}`, label: key, values: compareList.map((p) => p.specs?.[section]?.[key] || null) });
    }
  }
  rows.push({ type: 'section', key: 's-description', label: 'Description' });
  rows.push({ type: 'row', key: 'description', label: 'Summary', values: compareList.map((p) => p.description || null), className: 'text-[12px] leading-relaxed text-slate-300', render: (p) => (
    p.description ? <span className="line-clamp-6">{p.description}</span> : <span className="text-slate-500">—</span>
  ) });

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/compare" />

      {/* Header */}
      <div className="bg-[#070b18] border-b border-slate-800 py-8 px-3 sm:px-4 lg:px-5">
        <div className="max-w-[1520px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <a href="/" className="hover:text-cyan-400">Home</a>
              <span>/</span>
              <a href="/shop" className="hover:text-cyan-400">Shop</a>
              <span>/</span>
              <span className="text-white font-medium">Product Comparison</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <Scale className="w-7 h-7 text-cyan-400" />
              <span>Side-by-Side Specification Matrix</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Comparing {compareList.length} of 4 maximum devices
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Highlight Differences toggle */}
            <label className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={highlightDifferences}
                onChange={(e) => setHighlightDifferences(e.target.checked)}
                className="rounded bg-slate-800 text-cyan-600 focus:ring-cyan-500"
              />
              <span>Highlight differences</span>
            </label>
            <label className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs cursor-pointer text-slate-300">
              <input type="checkbox" checked={onlyDifferences} onChange={(e) => setOnlyDifferences(e.target.checked)} className="accent-[var(--t-accent-600)]" />
              <span>Only show differences</span>
            </label>

            {compareList.length > 0 && (
              <button
                type="button"
                onClick={clearCompare}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-rose-400 border border-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="max-w-[1520px] mx-auto px-3 sm:px-4 lg:px-5 py-8 flex-1 w-full">
        {mixedCategories && (
          <div className="callout callout-warning mb-4"><span>You're comparing products from different categories, so some specifications only apply to one of them (shown as —).</span></div>
        )}
        {compareList.length > 1 && <p className="lg:hidden text-xs text-slate-400 mb-2">Swipe sideways to see every product. The specification names stay pinned on the left.</p>}
        <div className="table-scroll rounded-3xl">
        {compareList.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-slate-800 p-8 space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-500">
              <Scale className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">No products in comparison list</h3>
            <p className="text-xs text-slate-400">
              Select products across smartphones, laptops or components to compare specifications side-by-side.
            </p>
            <a
              href="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors"
            >
              <span>Explore Products</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="min-w-max bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
            <table className="w-full text-left border-collapse text-sm" aria-label="Product comparison">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80">
                  <th className="sticky left-0 z-20 bg-slate-950 p-4 w-40 sm:w-48 text-slate-400 font-bold uppercase tracking-wider text-xs">
                    Specification
                  </th>
                  {compareList.map((product) => (
                    <th key={product.id} scope="col" className="p-4 w-56 sm:w-64 min-w-[13rem] align-top">
                      <div className="relative space-y-3">
                        <button
                          type="button"
                          onClick={() => removeFromCompare(product.id)}
                          className="absolute -top-1 -right-1 p-1 rounded-md bg-slate-800 text-slate-400 hover:text-rose-400"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>

                        <img
                          src={product.thumbnail}
                          alt={product.name}
                          className="w-28 h-28 mx-auto object-contain rounded-xl bg-slate-950 p-2 border border-slate-800"
                        />

                        <div>
                          <div className="text-[10px] font-bold text-cyan-400 uppercase">{product.brand}</div>
                          <a
                            href={`/products/${product.slug}`}
                            className="font-bold text-white hover:text-cyan-300 line-clamp-2 leading-snug"
                          >
                            {product.name}
                          </a>
                        </div>

                        <div className="text-base font-black text-emerald-400">
                          {formatPrice(product.flashDeal?.dealPrice ?? product.price)}
                        </div>

                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          disabled={product.stock <= 0}
                          className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Add to Cart</span>
                        </button>
                      </div>
                    </th>
                  ))}

                  {/* Empty Slot if less than 4 */}
                  {compareList.length < 4 && (
                    <th className="p-4 w-64 bg-slate-950/40 border-l border-slate-800/80 align-middle text-center">
                      <div className="space-y-3 max-w-[200px] mx-auto">
                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-700 mx-auto flex items-center justify-center text-slate-500">
                          <Plus className="w-5 h-5" />
                        </div>
                        <div className="text-xs font-bold text-slate-300">Add Another Product</div>
                        <select
                          value={searchPicker}
                          onChange={(e) => {
                            const found = products.find((p) => p.id === e.target.value);
                            if (found) addToCompare(found);
                            setSearchPicker('');
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white"
                        >
                          <option value="">Select from catalog...</option>
                          {availableToAdd.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({formatPrice(p.price)})
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  if (row.type === 'section') {
                    return (
                      <tr key={row.key}>
                        <th scope="colgroup" colSpan={compareList.length + 1 + (compareList.length < 4 ? 1 : 0)} className="sticky left-0 px-4 pt-6 pb-2 text-left text-[11px] font-extrabold uppercase tracking-wider text-cyan-400 bg-slate-900">
                          {row.label}
                        </th>
                      </tr>
                    );
                  }
                  const differs = new Set(row.values.map((v) => (v ?? '').toLowerCase())).size > 1;
                  if (onlyDifferences && !differs) return null;
                  return (
                    <tr key={row.key} className={`border-t border-slate-800/80 ${highlightDifferences && differs ? 'bg-amber-950/20' : ''}`}>
                      <th scope="row" className="sticky left-0 z-10 p-4 w-40 sm:w-48 text-left font-semibold text-slate-400 bg-slate-950 align-top">{row.label}</th>
                      {row.values.map((v, i) => (
                        <td key={compareList[i].id} className={`p-4 align-top text-slate-200 ${row.className || ''}`}>
                          <span className="sr-only">{compareList[i].name}: </span>
                          {row.render ? row.render(compareList[i]) : v ?? <span className="text-slate-500">—</span>}
                        </td>
                      ))}
                      {compareList.length < 4 && <td className="bg-slate-950/20" />}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>

      <Footer />
      <FloatingWhatsApp />
      <CartDrawer />
    </div>
  );
};
