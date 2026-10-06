import React, { useState, useEffect, useMemo } from 'react';
import {
  Filter,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Search,
  X,
  RotateCcw,
  ArrowUpDown
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { CompareDrawer } from '../components/common/CompareDrawer';
import { CartDrawer } from '../components/checkout/CartDrawer';
import { useBodyScrollLock } from '../components/common/Overlay';
import { ProductCard } from '../components/common/ProductCard';
import { useStore } from '../context/StoreContext';
import { Product } from '../types';

function matchesCategory(p: Product, slug: string, categories: ReturnType<typeof useStore>['categories']): boolean {
  if (!slug) return true;
  const queryCat = slug.toLowerCase();
  const productCat = p.category.toLowerCase();
  const catObj = categories.find((c) => c.slug === slug);
  const catNameMatch = catObj ? catObj.name.toLowerCase() === productCat : false;

  return (
    productCat === queryCat ||
    productCat.includes(queryCat) ||
    queryCat.includes(productCat) ||
    catNameMatch ||
    (queryCat === 'smartphones' && (productCat.includes('phone') || productCat.includes('smartphone'))) ||
    (queryCat === 'laptops' && (productCat.includes('laptop') || productCat.includes('notebook') || productCat.includes('macbook'))) ||
    (queryCat === 'computers' && (productCat.includes('computer') || productCat.includes('desktop') || productCat.includes('pc') || productCat.includes('workstation') || productCat.includes('all-in-one'))) ||
    (queryCat === 'tablets' && (productCat.includes('tablet') || productCat.includes('ipad'))) ||
    (queryCat === 'accessories' && (productCat.includes('accessor') || productCat.includes('headphone') || productCat.includes('audio') || productCat.includes('charger') || productCat.includes('power'))) ||
    (queryCat === 'components' && (productCat.includes('component') || productCat.includes('gpu') || productCat.includes('cpu') || productCat.includes('ram') || productCat.includes('hardware'))) ||
    (queryCat === 'networking' && (productCat.includes('network') || productCat.includes('router') || productCat.includes('switch') || productCat.includes('wifi'))) ||
    (queryCat === 'gaming' && (productCat.includes('gaming') || productCat.includes('console') || productCat.includes('playstation') || productCat.includes('xbox'))) ||
    (!!p.categoryId && p.categoryId.toLowerCase().includes(queryCat)) ||
    (!!p.subcategory && p.subcategory.toLowerCase().includes(queryCat))
  );
}

export const ShopPage: React.FC = () => {
  const { products, categories, brands, formatPrice } = useStore();

  const urlParams = new URLSearchParams(window.location.search);
  const initialCategory = urlParams.get('category') || '';
  const initialBrand = urlParams.get('brand') || '';
  const initialSearch = urlParams.get('search') || '';
  const initialFlashDeal = urlParams.get('flashDeal') === 'true';
  const initialNewArrival = urlParams.get('newArrival') === 'true';

  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(initialBrand ? [initialBrand] : []);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(800000);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState('');
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [flashDeal, setFlashDeal] = useState(initialFlashDeal);
  const [newArrival, setNewArrival] = useState(initialNewArrival);
  const [sortBy, setSortBy] = useState('featured');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  useBodyScrollLock(isMobileFilterOpen);

  useEffect(() => {
    const syncWithUrl = () => {
      const p = new URLSearchParams(window.location.search);
      const cat = p.get('category');
      const br = p.get('brand');
      const q = p.get('search');
      const fd = p.get('flashDeal');
      const na = p.get('newArrival');
      const maxP = p.get('maxPrice');
      const minP = p.get('minPrice');
      const cond = p.get('condition');

      if (cat !== null) setSelectedCategory(cat);
      if (br !== null) setSelectedBrands(br ? [br] : []);
      if (q !== null) setSearchTerm(q);
      if (fd !== null) setFlashDeal(fd === 'true');
      if (na !== null) setNewArrival(na === 'true');
      if (maxP !== null) setMaxPrice(Number(maxP));
      if (minP !== null) setMinPrice(Number(minP));
      if (cond !== null) setSelectedCondition(cond);
    };

    syncWithUrl();
    window.addEventListener('popstate', syncWithUrl);
    window.addEventListener('app:locationchange', syncWithUrl);
    return () => {
      window.removeEventListener('popstate', syncWithUrl);
      window.removeEventListener('app:locationchange', syncWithUrl);
    };
  }, []);

  const handleBrandToggle = (brandName: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brandName) ? prev.filter((b) => b !== brandName) : [...prev, brandName]
    );
  };

  const handleResetFilters = () => {
    setSelectedCategory('');
    setSelectedBrands([]);
    setMinPrice(0);
    setMaxPrice(800000);
    setOnlyInStock(false);
    setSelectedCondition('');
    setSearchTerm('');
    setFlashDeal(false);
    setNewArrival(false);
    setSortBy('featured');
    window.history.pushState({}, '', '/shop');
  };

  const setCategory = (slug: string) => {
    setSelectedCategory(slug);
    const url = slug ? `/shop?category=${encodeURIComponent(slug)}` : '/shop';
    window.history.pushState({}, '', url);
  };

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (selectedCategory && !matchesCategory(p, selectedCategory, categories)) return false;
        if (selectedBrands.length > 0 && !selectedBrands.some((b) => b.toLowerCase() === p.brand.toLowerCase())) return false;
        if (p.price < minPrice || p.price > maxPrice) return false;
        if (onlyInStock && p.stock <= 0) return false;
        if (selectedCondition && !p.condition.toLowerCase().includes(selectedCondition.toLowerCase())) return false;
        if (flashDeal && !p.isFlashDeal) return false;
        if (newArrival && !p.isNewArrival) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          if (
            !p.name.toLowerCase().includes(q) &&
            !p.brand.toLowerCase().includes(q) &&
            !p.shortSpecs.toLowerCase().includes(q) &&
            !p.sku.toLowerCase().includes(q) &&
            !p.description.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'price-asc': return a.price - b.price;
          case 'price-desc': return b.price - a.price;
          case 'rating': return b.rating - a.rating;
          case 'newest': return (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0);
          case 'discount': {
            const dA = a.compareAtPrice ? (a.compareAtPrice - a.price) / a.compareAtPrice : 0;
            const dB = b.compareAtPrice ? (b.compareAtPrice - b.price) / b.compareAtPrice : 0;
            return dB - dA;
          }
          default: return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
        }
      });
  }, [products, selectedCategory, categories, selectedBrands, minPrice, maxPrice, onlyInStock, selectedCondition, searchTerm, flashDeal, newArrival, sortBy]);

  const getCategoryCount = (slug: string) =>
    products.filter((p) => matchesCategory(p, slug, categories)).length;

  const activeCategoryObj = categories.find((c) => c.slug === selectedCategory);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/shop" />

      {/* Page Header & Breadcrumb */}
      <div className="bg-[#070b18] border-b border-slate-800 py-6 px-3 sm:px-4 lg:px-5">
        <div className="max-w-[1520px] mx-auto space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <a href="/" className="hover:text-cyan-400 transition-colors">Home</a>
            <span>/</span>
            <a href="/shop" className="hover:text-cyan-400 transition-colors">Shop</a>
            {selectedCategory && (
              <>
                <span>/</span>
                <span className="text-cyan-400 capitalize">{activeCategoryObj?.name || selectedCategory}</span>
              </>
            )}
            {searchTerm && (
              <>
                <span>/</span>
                <span className="text-white">Search: &ldquo;{searchTerm}&rdquo;</span>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {activeCategoryObj
                  ? activeCategoryObj.name
                  : searchTerm
                  ? `Results for &ldquo;${searchTerm}&rdquo;`
                  : 'All Electronics & Hardware'}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Showing <strong className="text-white">{filteredProducts.length}</strong> products with local warranty
              </p>

              {/* Category pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-3 pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setCategory('')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
                    selectedCategory === ''
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                  }`}
                >
                  All ({getCategoryCount('')})
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.slug)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
                      selectedCategory.toLowerCase() === c.slug.toLowerCase() ||
                      selectedCategory.toLowerCase() === c.name.toLowerCase()
                        ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {c.name} ({getCategoryCount(c.slug)})
                  </button>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(true)}
                className="lg:hidden flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 hover:border-slate-600 transition-all"
              >
                <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                <span>Filters</span>
              </button>

              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400 hidden sm:inline">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="featured" className="bg-slate-900">Featured First</option>
                  <option value="price-asc" className="bg-slate-900">Price: Low to High</option>
                  <option value="price-desc" className="bg-slate-900">Price: High to Low</option>
                  <option value="rating" className="bg-slate-900">Top Rated</option>
                  <option value="newest" className="bg-slate-900">Newest First</option>
                  <option value="discount" className="bg-slate-900">Biggest Discount</option>
                </select>
              </div>

              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setViewLayout('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${viewLayout === 'grid' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewLayout('list')}
                  className={`p-1.5 rounded-lg transition-colors ${viewLayout === 'list' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1520px] mx-auto px-3 sm:px-4 lg:px-5 py-8 flex-1 w-full">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-72 shrink-0 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-cyan-400" /> Filters
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Reset All
              </button>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Categories</h3>
              <div className="space-y-1 text-sm">
                <button
                  type="button"
                  onClick={() => setCategory('')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between ${
                    selectedCategory === '' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <span>All Categories</span>
                  <span className="font-mono text-xs opacity-75">{getCategoryCount('')}</span>
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.slug)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between ${
                      selectedCategory === cat.slug ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className="font-mono text-xs opacity-75">{getCategoryCount(cat.slug)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Price Range (KES)</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono text-cyan-400 font-bold">
                  <span>{formatPrice(minPrice)}</span>
                  <span>{formatPrice(maxPrice)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={800000}
                  step={5000}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Brands */}
            <div className="space-y-2 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Brands</h3>
              <div className="max-h-48 overflow-y-auto space-y-1.5 text-sm pr-1">
                {brands.map((b) => (
                  <label key={b.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 cursor-pointer text-slate-300 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(b.name)}
                        onChange={() => handleBrandToggle(b.name)}
                        className="rounded bg-slate-800 border-slate-700 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span>{b.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">({b.count})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Availability & Condition */}
            <div className="space-y-2 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Availability</h3>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-900 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={onlyInStock}
                    onChange={(e) => setOnlyInStock(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-600"
                  />
                  <span>In Stock Only</span>
                </label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {['Brand New', 'Refurbished'].map((cond) => (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => setSelectedCondition(selectedCondition === cond ? '' : cond)}
                      className={`p-2 rounded-xl border text-xs font-semibold transition-colors ${
                        selectedCondition === cond
                          ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {cond === 'Refurbished' ? 'Refurbished A+' : cond}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Product Catalog */}
          <main className="flex-1 min-w-0">
            {/* Active Filters */}
            {(selectedCategory || selectedBrands.length > 0 || searchTerm || onlyInStock || selectedCondition || flashDeal || newArrival) && (
              <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-400 font-semibold">Active Filters:</span>
                {selectedCategory && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs">
                    <span>Category: {activeCategoryObj?.name || selectedCategory}</span>
                    <button type="button" onClick={() => setCategory('')}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {selectedBrands.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs">
                    <span>{b}</span>
                    <button type="button" onClick={() => handleBrandToggle(b)}><X className="w-3 h-3" /></button>
                  </span>
                ))}
                {flashDeal && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950 text-rose-300 border border-rose-800 text-xs">
                    Flash Deals <button type="button" onClick={() => setFlashDeal(false)}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {newArrival && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 text-xs">
                    New Arrivals <button type="button" onClick={() => setNewArrival(false)}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {onlyInStock && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs">
                    In Stock Only <button type="button" onClick={() => setOnlyInStock(false)}><X className="w-3 h-3" /></button>
                  </span>
                )}
                {searchTerm && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-white border border-slate-700 text-xs">
                    &ldquo;{searchTerm}&rdquo; <button type="button" onClick={() => setSearchTerm('')}><X className="w-3 h-3" /></button>
                  </span>
                )}
                <button type="button" onClick={handleResetFilters} className="text-xs text-rose-400 hover:underline font-bold ml-auto">Clear All</button>
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <div className="py-20 text-center space-y-4 bg-slate-900/40 rounded-3xl border border-slate-800 p-8">
                <div className="w-16 h-16 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-500">
                  <Search className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">No matching products found</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                  Try broadening your search, clearing brand filters, or adjusting the price range.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold transition-colors"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className={viewLayout === 'grid' ? 'grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5 xl:gap-6' : 'space-y-4'}>
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} layout={viewLayout} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {isMobileFilterOpen && (
        <div className="lg:hidden fixed inset-0 z-50 overflow-hidden">
          <div onClick={() => setIsMobileFilterOpen(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
          <div className="absolute inset-y-0 right-0 flex pl-10">
            <div className="w-screen max-w-sm bg-slate-900 p-6 flex flex-col overflow-y-auto overscroll-contain space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <h3 className="font-extrabold text-base text-white">Filter Products</h3>
                <button type="button" onClick={() => setIsMobileFilterOpen(false)} className="p-2 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="font-bold text-slate-300 uppercase text-xs tracking-wider">Categories</div>
                <div className="space-y-1">
                  <button type="button" onClick={() => { setCategory(''); setIsMobileFilterOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl ${selectedCategory === '' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'}`}>
                    All ({getCategoryCount('')})
                  </button>
                  {categories.map((c) => (
                    <button key={c.id} type="button" onClick={() => { setCategory(c.slug); setIsMobileFilterOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl ${selectedCategory === c.slug ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'}`}>
                      {c.name} ({getCategoryCount(c.slug)})
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="font-bold text-slate-300 uppercase text-xs tracking-wider">Brands</div>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {brands.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-slate-300 p-1">
                      <input type="checkbox" checked={selectedBrands.includes(b.name)} onChange={() => handleBrandToggle(b.name)} className="rounded bg-slate-800 text-cyan-600" />
                      <span>{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex gap-3">
                <button type="button" onClick={handleResetFilters} className="flex-1 py-3 border border-slate-700 text-slate-300 font-bold rounded-xl text-sm hover:bg-slate-800 transition-all">
                  Reset
                </button>
                <button type="button" onClick={() => setIsMobileFilterOpen(false)} className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-sm transition-all">
                  Show {filteredProducts.length} Products
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
      <FloatingWhatsApp />
      <CompareDrawer />
      <CartDrawer />
    </div>
  );
};
