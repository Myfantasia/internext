import React, { useState } from 'react';
import { Sparkles, ArrowRight, Smartphone, Laptop, Headphones, Flame } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ProductCard } from '../common/ProductCard';

export const FeaturedSection: React.FC = () => {
  const { products } = useStore();
  const [activeTab, setActiveTab] = useState<'featured' | 'bestsellers' | 'smartphones' | 'laptops' | 'accessories'>('featured');

  let displayedProducts = [...products];

  switch (activeTab) {
    case 'bestsellers':
      displayedProducts = products.filter((p) => p.isBestSeller);
      break;
    case 'smartphones':
      displayedProducts = products.filter((p) => p.category.toLowerCase().includes('smartphones') || p.category.toLowerCase().includes('phones'));
      break;
    case 'laptops':
      displayedProducts = products.filter((p) => p.category.toLowerCase().includes('laptops'));
      break;
    case 'accessories':
      displayedProducts = products.filter((p) => p.category.toLowerCase().includes('accessories'));
      break;
    case 'featured':
    default:
      displayedProducts = products.filter((p) => p.isFeatured);
      break;
  }

  const itemsToShow = displayedProducts.slice(0, 8);

  return (
    <section className="py-14 sm:py-20 bg-slate-950 px-3 sm:px-4 lg:px-5">
      <div className="max-w-[1520px] mx-auto">
        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-[.2em] mb-2">
              Curated Electronics
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Featured Flagships & Gear
            </h2>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            {[
              { id: 'featured', label: 'Top Featured' },
              { id: 'bestsellers', label: 'Best Sellers' },
              { id: 'smartphones', label: 'Smartphones' },
              { id: 'laptops', label: 'Laptops' },
              { id: 'accessories', label: 'Accessories' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
          {itemsToShow.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* View More Button */}
        <div className="text-center mt-10">
          <a
            href={`/shop?category=${activeTab === 'smartphones' ? 'smartphones' : activeTab === 'laptops' ? 'laptops' : activeTab === 'accessories' ? 'accessories' : ''}`}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-700 hover:border-cyan-500/50 transition-all shadow-lg"
          >
            <span>Explore All {activeTab.toUpperCase()} In Stock</span>
            <ArrowRight className="w-4 h-4 text-cyan-400" />
          </a>
        </div>
      </div>
    </section>
  );
};
