import React, { useState } from 'react';
import {
  X,
  Star,
  CheckCircle2,
  ShieldCheck,
  Truck,
  ShoppingCart,
  Heart,
  Scale,
  ExternalLink,
  MessageCircle,
  ChevronRight
} from 'lucide-react';
import { Product, ProductVariant } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useCompare } from '../../context/CompareContext';
import { Portal, useBodyScrollLock, useEscapeKey } from './Overlay';

interface QuickViewModalProps {
  product: Product;
  onClose: () => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({ product, onClose }) => {
  const { formatPrice, settings } = useStore();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { isComparing, addToCompare } = useCompare();

  const [selectedImage, setSelectedImage] = useState<string>(product.thumbnail || product.images[0]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants && product.variants.length > 0 ? product.variants[0] : null
  );
  const [quantity, setQuantity] = useState<number>(1);
  useBodyScrollLock();
  useEscapeKey(onClose);

  const activePrice = selectedVariant ? selectedVariant.price : product.price;
  const activeStock = selectedVariant ? selectedVariant.stock : product.stock;
  const activeSku = selectedVariant ? selectedVariant.sku : product.sku;

  const handleAddToCart = () => {
    addToCart(product, selectedVariant, quantity);
    onClose();
  };

  const isSaved = isInWishlist(product.id);
  const isCompared = isComparing(product.id);

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 sm:p-8">
          {/* Left: Gallery */}
          <div className="space-y-4">
            <div className="relative h-72 sm:h-80 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
              <img
                src={selectedImage}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Thumbnail selector */}
            {product.images && product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className={`w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border-2 shrink-0 transition-all ${
                      selectedImage === img ? 'border-cyan-500 scale-105' : 'border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Info & Actions */}
          <div className="flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/50 text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                  {product.brand}
                </span>
                <span className="text-xs text-slate-400">{product.category}</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
                {product.name}
              </h2>

              <div className="text-xs text-slate-400 font-mono mt-1">
                SKU: <span className="text-slate-200">{activeSku}</span>
              </div>

              {/* Rating & In Stock */}
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-500/30">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>{product.rating.toFixed(1)}</span>
                  <span className="text-slate-400">({product.reviewsCount} reviews)</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{activeStock > 0 ? `${activeStock} Units Available` : 'Out of Stock'}</span>
                </div>
              </div>

              {/* Price */}
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-2xl sm:text-3xl font-black text-white">
                  {formatPrice(activePrice)}
                </span>
                {product.compareAtPrice && (
                  <span className="text-sm text-slate-500 line-through">
                    {formatPrice(product.compareAtPrice)}
                  </span>
                )}
              </div>

              {/* Short Specs / Description */}
              <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                {product.shortSpecs || product.description}
              </p>

              {/* Variants Selector */}
              {product.variants && product.variants.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Select Configuration / Variant:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {product.variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariant(v)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                          selectedVariant?.id === v.id
                            ? 'bg-cyan-950/60 border-cyan-500 text-white font-bold ring-1 ring-cyan-500'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="truncate">{v.name}</div>
                        <div className="text-emerald-400 font-extrabold mt-0.5">{formatPrice(v.price)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quantity & Add to Cart */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-sm"
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-white">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(activeStock, quantity + 1))}
                    className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-sm"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={activeStock <= 0}
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30 transition-all"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Add {quantity > 1 ? `(${quantity})` : ''} to Cart</span>
                </button>
              </div>

              {/* Utility buttons */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                      isSaved ? 'bg-rose-950/60 border-rose-500 text-rose-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-rose-400' : ''}`} />
                    <span>{isSaved ? 'Saved' : 'Wishlist'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => addToCompare(product)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                      isCompared ? 'bg-cyan-950/60 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Compare</span>
                  </button>
                </div>

                <a
                  href={`/products/${product.slug}`}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-bold transition-colors"
                >
                  <span>Full Details & Specs</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
};
