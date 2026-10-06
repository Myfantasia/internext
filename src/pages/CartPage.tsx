import React, { useState } from 'react';
import {
  ShoppingCart,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Tag,
  Truck,
  Plus,
  Minus,
  RotateCcw,
  Sparkles,
  MapPin,
  Lock
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { CompareDrawer } from '../components/common/CompareDrawer';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';

export const CartPage: React.FC = () => {
  const {
    cart,
    cartCount,
    subtotal,
    discountAmount,
    taxAmount,
    taxRate,
    total,
    appliedCoupon,
    updateQuantity,
    removeFromCart,
    clearCart,
    applyCoupon,
    removeCoupon
  } = useCart();

  const { formatPrice, settings } = useStore();
  const [couponInput, setCouponInput] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setIsApplyingCoupon(true);
    await applyCoupon(couponInput.trim());
    setIsApplyingCoupon(false);
    setCouponInput('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/cart" />

      {/* Header */}
      <div className="bg-[#070b18] border-b border-slate-800 py-8 px-3 sm:px-4 lg:px-5">
        <div className="max-w-[1520px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <a href="/" className="hover:text-cyan-400">Home</a>
              <span>/</span>
              <span className="text-white font-medium">Shopping Cart</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <ShoppingCart className="w-7 h-7 text-cyan-400" />
              <span>Review Your Shopping Cart ({cartCount} items)</span>
            </h1>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-rose-400 border border-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Trash2 className="w-4 h-4" />
              <span>Empty Entire Cart</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1520px] mx-auto px-3 sm:px-4 lg:px-5 py-8 flex-1 w-full">
        {cart.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-slate-800 p-8 space-y-4 max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-500">
              <ShoppingCart className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-white">Your Shopping Cart is Empty</h3>
            <p className="text-xs text-slate-400">
              Explore our wide inventory of smartphones, laptops, custom gaming PCs, and GaN chargers with official warranties.
            </p>
            <a
              href="/shop"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-xl shadow-cyan-600/30 transition-all"
            >
              <span>Explore Products Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Cart Items (8 Cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl divide-y divide-slate-800/80">
                {cart.map((item, idx) => (
                  <div
                    key={`${item.productId}-${item.variantId || idx}`}
                    className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <img
                        src={item.thumbnail}
                        alt={item.name}
                        className="w-20 h-20 rounded-2xl object-contain bg-slate-950 p-2 border border-slate-800 shrink-0"
                      />
                      <div className="space-y-1 min-w-0">
                        <a
                          href={`/products/${item.sku.toLowerCase()}`}
                          className="text-sm font-bold text-white hover:text-cyan-300 transition-colors line-clamp-1"
                        >
                          {item.name}
                        </a>
                        {item.variantName && (
                          <div className="text-xs text-cyan-400 font-mono">{item.variantName}</div>
                        )}
                        <div className="text-xs text-slate-400 font-mono">SKU: {item.sku}</div>
                        <div className="text-sm font-black text-emerald-400 sm:hidden">
                          {formatPrice(item.price)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                      {/* Price (desktop) */}
                      <div className="hidden sm:block text-right">
                        <div className="text-sm font-black text-white">{formatPrice(item.price)}</div>
                        {item.compareAtPrice && (
                          <div className="text-xs text-slate-500 line-through">
                            {formatPrice(item.compareAtPrice)}
                          </div>
                        )}
                      </div>

                      {/* Quantity Selector */}
                      <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-xs"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-10 text-center text-xs font-bold text-white font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Line Subtotal */}
                      <div className="text-right min-w-[100px]">
                        <div className="text-xs text-slate-400">Subtotal:</div>
                        <div className="text-sm font-black text-emerald-400">
                          {formatPrice(item.price * item.quantity)}
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.productId, item.variantId)}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Continue Shopping Link */}
              <div className="flex items-center justify-between text-xs pt-2">
                <a
                  href="/shop"
                  className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-bold"
                >
                  <span>← Continue Browsing Tech Store</span>
                </a>
              </div>
            </div>

            {/* Right: Order Summary & Shipping Zone (4 Cols) */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
                <h3 className="text-base font-extrabold text-white">Order Summary</h3>

                {/* Delivery is priced from the customer's location at checkout */}
                <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
                  <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Delivery is calculated at checkout from your delivery location (distance from our Nairobi office). Free store pickup is also available.</span>
                </div>

                {/* Promo Voucher Code */}
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <Tag className="w-4 h-4" />
                      <span>Voucher {appliedCoupon.code} Applied</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-slate-400 hover:text-rose-400 font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Coupon Code (e.g. TECH2026)"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 uppercase focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="submit"
                      disabled={isApplyingCoupon || !couponInput.trim()}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold rounded-xl text-xs border border-slate-700 transition-colors"
                    >
                      Apply
                    </button>
                  </form>
                )}

                {/* Cost Breakdown */}
                <div className="space-y-2.5 pt-3 border-t border-slate-800 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span>Items Subtotal:</span>
                    <span className="font-bold text-white">{formatPrice(subtotal)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span>Voucher Discount:</span>
                      <span>-{formatPrice(discountAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Delivery:</span>
                    <span className="font-semibold text-slate-400">Calculated at checkout</span>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>VAT ({taxRate}% included):</span>
                    <span>{formatPrice(taxAmount)}</span>
                  </div>

                  <div className="flex justify-between text-lg font-black text-white pt-3 border-t border-slate-800">
                    <span>Total before delivery:</span>
                    <span className="text-cyan-400">{formatPrice(total)}</span>
                  </div>
                </div>

                {/* Proceed Button */}
                <div className="space-y-3 pt-2">
                  <a
                    href="/checkout"
                    className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-cyan-600/30 transition-all hover:scale-[1.02]"
                  >
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="w-5 h-5" />
                  </a>

                  <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>256-Bit SSL Encrypted Safaricom Checkout</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
      <FloatingWhatsApp />
      <CompareDrawer />
    </div>
  );
};
