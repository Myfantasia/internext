import React, { useState } from 'react';
import {
  Heart,
  Scale,
  Eye,
  ShoppingCart,
  Star,
  CheckCircle2,
  Sparkles,
  Flame,
  ShieldCheck
} from 'lucide-react';
import { Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useCompare } from '../../context/CompareContext';
import { QuickViewModal } from './QuickViewModal';

interface ProductCardProps {
  product: Product;
  layout?: 'grid' | 'list';
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, layout = 'grid' }) => {
  const { formatPrice } = useStore();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { isComparing, addToCompare } = useCompare();

  const [isQuickViewOpen, setIsQuickViewOpen] = useState<boolean>(false);

  // Live flash-deal price (server-computed) takes precedence over list price.
  const displayPrice = product.flashDeal?.dealPrice ?? product.price;
  const wasPrice = product.flashDeal ? product.price : product.compareAtPrice && product.compareAtPrice > product.price ? product.compareAtPrice : null;
  const discountPercent = wasPrice && wasPrice > displayPrice ? Math.round(((wasPrice - displayPrice) / wasPrice) * 100) : 0;

  const isSaved = isInWishlist(product.id);
  const isCompared = isComparing(product.id);

  if (layout === 'list') {
    return (
    <div className="bg-slate-900 border border-slate-800 hover:border-emerald-700/40 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row gap-5 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-950/20 group">
        {/* Thumbnail */}
        <div className="relative w-full md:w-56 h-48 md:h-auto min-h-44 rounded-2xl overflow-hidden bg-slate-950 shrink-0 border border-slate-800">
          <img
            src={product.thumbnail}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          />
          {discountPercent > 0 && (
            <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-rose-600 text-white font-extrabold text-[11px] tracking-wider shadow">
              {discountPercent}% OFF
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                {product.brand} • {product.category}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">SKU: {product.sku}</span>
            </div>

            <a href={`/products/${product.slug}`} className="block">
              <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-300 transition-colors leading-snug">
                {product.name}
              </h3>
            </a>

            <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
              {product.shortSpecs || product.description}
            </p>

            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center text-amber-400 text-xs font-bold gap-1 bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-500/30">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{product.rating.toFixed(1)}</span>
                <span className="text-slate-400 font-normal">({product.reviewsCount})</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{product.stock > 0 ? `${product.stock} In Stock` : 'Out of Stock'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-800/80 mt-4">
            <div>
              <div className="text-lg sm:text-xl font-extrabold text-white">
                {formatPrice(displayPrice)}
              </div>
              {wasPrice && (
                <div className="text-xs text-slate-500 line-through">
                  {formatPrice(wasPrice)}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleWishlist(product)}
                className={`p-2.5 rounded-xl border transition-colors ${
                  isSaved
                    ? 'bg-rose-950/80 border-rose-500/50 text-rose-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="Save to Wishlist"
              >
                <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-400' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => addToCompare(product)}
                className={`p-2.5 rounded-xl border transition-colors ${
                  isCompared
                    ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="Compare Specifications"
              >
                <Scale className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsQuickViewOpen(true)}
                className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                title="Quick Preview"
              >
                <Eye className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Add to Cart</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick View Modal */}
        {isQuickViewOpen && (
          <QuickViewModal product={product} onClose={() => setIsQuickViewOpen(false)} />
        )}
      </div>
    );
  }

  // Default Grid Layout
  return (
    <div className="product-card bg-slate-900 border border-slate-800/90 rounded-3xl p-3.5 sm:p-4 flex flex-col justify-between group relative overflow-hidden min-w-0">
      {/* Top badges */}
      <div className="flex items-center justify-between gap-1 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {discountPercent > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-[10px] tracking-wider uppercase shadow">
              {discountPercent}% OFF
            </span>
          )}
          {product.isFlashDeal && (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[10px] flex items-center gap-1">
              <Flame className="w-2.5 h-2.5 animate-pulse text-amber-400" /> Deal
            </span>
          )}
          {product.isNewArrival && (
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-emerald-400" /> New
            </span>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => toggleWishlist(product)}
            aria-label={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
            aria-pressed={isSaved}
            className={`p-2 rounded-xl transition-colors ${
              isSaved ? 'text-rose-500 bg-rose-950/60' : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
            }`}
            title="Save to Wishlist"
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-500' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => addToCompare(product)}
            aria-label={isCompared ? 'Remove from compare' : 'Add to compare'}
            aria-pressed={isCompared}
            className={`p-2 rounded-xl transition-colors ${
              isCompared ? 'text-cyan-400 bg-cyan-950/60' : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800'
            }`}
            title="Add to Compare"
          >
            <Scale className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsQuickViewOpen(true)}
            aria-label="Quick view"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Quick View"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Product Image */}
      <a href={`/products/${product.slug}`} className="block relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 mb-4 border border-slate-800/80">
        <img
          src={product.thumbnail}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          loading="lazy"
        />
      </a>

      {/* Brand & Title */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-[.16em] mb-1.5">
            {product.brand}
          </div>
          <a href={`/products/${product.slug}`}>
            <h3 className="text-[15px] font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2 leading-snug min-h-[2.7rem]">
              {product.name}
            </h3>
          </a>

          {/* Short Specs Pill */}
          <div className="mt-2.5 text-[10px] text-slate-400 line-clamp-1 bg-slate-950/50 px-2.5 py-1.5 rounded-lg border border-slate-800/70">
            {product.shortSpecs || product.description}
          </div>

          {/* Rating */}
          <div className="flex items-center justify-between gap-2 mt-2.5">
            <div className="flex items-center gap-1 text-xs text-amber-400 font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>{product.rating.toFixed(1)}</span>
              <span className="text-slate-500 font-normal text-[10px]">({product.reviewsCount})</span>
            </div>
            <div className="text-[11px] text-slate-400">
              {product.stock > 0 ? (
                <span className="text-emerald-400 font-medium">In Stock</span>
              ) : (
                <span className="text-rose-400">Out of Stock</span>
              )}
            </div>
          </div>
        </div>

        {/* Pricing & Add to Cart */}
        <div className="pt-3.5 border-t border-slate-800/80 mt-3.5 flex items-center justify-between gap-2">
          <div>
            <div className="text-base font-extrabold text-white">
              {formatPrice(displayPrice)}
            </div>
            {wasPrice && (
              <div className="text-[11px] text-slate-500 line-through">
                {formatPrice(wasPrice)}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => addToCart(product)}
            disabled={product.stock <= 0}
            className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 transition-all active:scale-95"
            title="Add to Shopping Cart"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>

      {/* Quick View Modal */}
      {isQuickViewOpen && (
        <QuickViewModal product={product} onClose={() => setIsQuickViewOpen(false)} />
      )}
    </div>
  );
};
