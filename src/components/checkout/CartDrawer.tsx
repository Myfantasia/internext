import React, { useState } from 'react';
import {
  X,
  ShoppingCart,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Tag,
  Truck,
  Plus,
  Minus,
  Sparkles
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useStore } from '../../context/StoreContext';
import { Portal, useBodyScrollLock, useEscapeKey } from '../common/Overlay';

export const CartDrawer: React.FC = () => {
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
    removeCoupon,
    isCartDrawerOpen,
    setIsCartDrawerOpen
  } = useCart();

  const { formatPrice, settings } = useStore();
  const [couponInput, setCouponInput] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  useBodyScrollLock(isCartDrawerOpen);
  useEscapeKey(() => setIsCartDrawerOpen(false), isCartDrawerOpen);

  if (!isCartDrawerOpen) return null;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setIsApplyingCoupon(true);
    await applyCoupon(couponInput.trim());
    setIsApplyingCoupon(false);
    setCouponInput('');
  };

  const freeDeliveryRemaining = Math.max(0, (settings.freeShippingThreshold || 50000) - subtotal);
  const freeDeliveryProgress = Math.min(100, Math.round((subtotal / (settings.freeShippingThreshold || 50000)) * 100));

  return (
    <Portal>
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartDrawerOpen(false)}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Shopping Cart</h3>
                <p className="text-xs text-slate-400">{cartCount} items in cart</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                  title="Clear Cart"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Free Shipping Progress Indicator */}
          <div className="p-4 bg-slate-950/70 border-b border-slate-800/80 text-xs">
            <div className="flex items-center justify-between mb-1.5 font-semibold">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Truck className="w-4 h-4 text-cyan-400" />
                {freeDeliveryRemaining > 0 ? (
                  <span>Add <strong className="text-cyan-300">{formatPrice(freeDeliveryRemaining)}</strong> for FREE Nairobi courier</span>
                ) : (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> You've unlocked FREE courier delivery!
                  </span>
                )}
              </span>
              <span className="text-slate-400 font-mono">{freeDeliveryProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${freeDeliveryProgress}%` }}
              />
            </div>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 divide-y divide-slate-800/60">
            {cart.length === 0 ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-800/60 mx-auto flex items-center justify-center text-slate-500">
                  <ShoppingCart className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">Your cart is empty</h4>
                  <p className="text-xs text-slate-400">Looks like you haven't added any tech products yet.</p>
                </div>
                <a
                  href="/shop"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-600/30"
                >
                  <span>Start Browsing Catalog</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={`${item.productId}-${item.variantId || idx}`} className="pt-4 first:pt-0 flex gap-3">
                  <img
                    src={item.thumbnail}
                    alt={item.name}
                    className="w-16 h-16 rounded-xl object-cover bg-slate-950 border border-slate-800 shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                      {item.variantName && (
                        <div className="text-[11px] text-cyan-400 font-mono truncate">{item.variantName}</div>
                      )}
                      <div className="text-xs font-extrabold text-emerald-400 mt-1">
                        {formatPrice(item.price)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                          className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-700 text-white flex items-center justify-center text-xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-white font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                          className="w-6 h-6 rounded bg-slate-900 hover:bg-slate-700 text-white flex items-center justify-center text-xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.productId, item.variantId)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout Breakdown */}
          {cart.length > 0 && (
            <div className="p-5 bg-slate-950 border-t border-slate-800 space-y-4">
              {/* Promo Coupon Form */}
              {appliedCoupon ? (
                <div className="flex items-center justify-between p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <Tag className="w-4 h-4" />
                    <span>Coupon {appliedCoupon.code} Applied</span>
                  </div>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="text-slate-400 hover:text-rose-400 text-xs font-semibold"
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
                    placeholder="Promo / Voucher Code (e.g. TECH2026)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 uppercase focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={isApplyingCoupon || !couponInput.trim()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-400 font-bold rounded-xl text-xs border border-slate-700 transition-colors"
                  >
                    Apply
                  </button>
                </form>
              )}

              {/* Subtotals */}
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-bold text-white">{formatPrice(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount:</span>
                    <span className="font-bold">-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Delivery:</span>
                  <span className="font-semibold text-slate-400">At checkout</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>VAT ({taxRate}% included):</span>
                  <span>{formatPrice(taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                  <span>Total before delivery:</span>
                  <span className="text-cyan-400">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Checkout Action Button */}
              <div className="space-y-2">
                <a
                  href="/checkout"
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-cyan-600/30 transition-all active:scale-98"
                >
                  <span>Proceed to Secure Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Encrypted Safaricom M-Pesa & Card Checkout</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
};
