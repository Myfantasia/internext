import React from 'react';
import { Heart, ShoppingCart, Trash2, ArrowRight, Star } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { CompareDrawer } from '../components/common/CompareDrawer';
import { CartDrawer } from '../components/checkout/CartDrawer';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';

export const WishlistPage: React.FC = () => {
  const { wishlist, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart, setIsCartDrawerOpen } = useCart();
  const { formatPrice } = useStore();

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/wishlist" />

      <div className="bg-[#070b18] border-b border-slate-800 py-8 px-3 sm:px-4 lg:px-5">
        <div className="max-w-[1520px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <a href="/" className="hover:text-cyan-400">Home</a>
              <span>/</span>
              <span className="text-white font-medium">Saved Wishlist</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Heart className="w-7 h-7 text-rose-500 fill-rose-500" />
              <span>Saved Gadgets & Wishlist ({wishlist.length})</span>
            </h1>
          </div>

          {wishlist.length > 0 && (
            <button
              type="button"
              onClick={clearWishlist}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-rose-400 border border-slate-800 rounded-xl text-xs font-bold transition-colors"
            >
              Clear Entire Wishlist
            </button>
          )}
        </div>
      </div>

      <main className="max-w-[1520px] mx-auto px-3 sm:px-4 lg:px-5 py-8 flex-1 w-full">
        {wishlist.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-slate-800 p-8 space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-500">
              <Heart className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Your wishlist is currently empty</h3>
            <p className="text-xs text-slate-400">
              Save products while browsing to keep track of pricing changes, flash discounts, or purchase later.
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {wishlist.map((prod) => (
              <div
                key={prod.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative group hover:border-cyan-500/50 transition-all shadow-xl"
              >
                <div className="relative w-full h-48 rounded-xl overflow-hidden bg-slate-950 p-2">
                  <img src={prod.thumbnail} alt={prod.name} className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => removeFromWishlist(prod.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 text-rose-400 hover:bg-rose-950"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-cyan-400 uppercase">{prod.brand}</div>
                  <a href={`/products/${prod.slug}`} className="font-bold text-white hover:text-cyan-300 line-clamp-2 text-xs">
                    {prod.name}
                  </a>
                  <div className="text-sm font-black text-emerald-400 pt-1">
                    {formatPrice(prod.price)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    addToCart(prod);
                    setIsCartDrawerOpen(true);
                  }}
                  disabled={prod.stock <= 0}
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Move to Cart</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
      <FloatingWhatsApp />
      <CompareDrawer />
      <CartDrawer />
    </div>
  );
};
