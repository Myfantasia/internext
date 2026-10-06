import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CartItem, Product, ProductVariant, Coupon } from '../types';
import { useToast } from './ToastContext';
import { useStore } from './StoreContext';
import { useAuth } from './AuthContext';
import { navigate } from '../utils/navigation';

interface CartContextType {
  cart: CartItem[];
  cartCount: number;
  subtotal: number;
  /** Server-calculated promo discount for the current cart. */
  discountAmount: number;
  /** VAT portion of the goods total (prices include VAT). Delivery is priced at checkout. */
  taxAmount: number;
  taxRate: number;
  /** Goods total after discount, before delivery. */
  total: number;
  appliedCoupon: Coupon | null;
  addToCart: (product: Product, variant?: ProductVariant | null, quantity?: number) => void;
  removeFromCart: (productId: string, variantId?: string | null) => void;
  updateQuantity: (productId: string, variantId: string | null | undefined, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);


export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const { settings } = useStore();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [cart, setCart] = useState<CartItem[]>([]);


  // A cart belongs to the active authenticated profile only. Reset it before
  // loading whenever the signed-in account changes, so no badge or items leak
  // from a previous session into another customer account.
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setCart([]);
      setAppliedCoupon(null);
      setDiscountAmount(0);
      setIsCartDrawerOpen(false);
      return;
    }

    let cancelled = false;
    setCart([]);
    fetch('/api/cart')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setCart(data?.cart || []);
      })
      .catch(() => {
        if (!cancelled) setCart([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading, user?.id]);

  const addToCart = async (product: Product, variant?: ProductVariant | null, quantity: number = 1) => {
    if (!isAuthenticated) {
      showToast('Please sign in to add items to your cart.', 'info');
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    const variantId = variant?.id || null;
    const maxStock = variant?.stock !== undefined ? variant.stock : product.stock;

    if (maxStock <= 0) {
      showToast(`${product.name} is currently out of stock`, 'error');
      return;
    }

    if (isAuthenticated) {
      try {
        const res = await fetch('/api/cart/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id, variantId, quantity })
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.message || 'Unable to add item to cart', 'error');
          return;
        }
        setCart(data.cart);
        showToast(`Added ${product.name} to cart!`, 'success');
      } catch {
        showToast('Unable to reach the server. Please try again.', 'error');
      }
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id && item.variantId === variantId);
      if (existingIndex > -1) {
        const newQty = Math.min(prev[existingIndex].quantity + quantity, maxStock);
        const updated = [...prev];
        updated[existingIndex].quantity = newQty;
        showToast(`Updated ${product.name} quantity to ${newQty}`, 'success');
        return updated;
      }
      showToast(`Added ${product.name} to cart!`, 'success');
      return [
        ...prev,
        {
          productId: product.id,
          variantId,
          name: product.name,
          variantName: variant?.name || null,
          sku: variant?.sku || product.sku,
          price: variant?.price || product.price,
          compareAtPrice: product.compareAtPrice,
          quantity: Math.min(quantity, maxStock),
          thumbnail: product.thumbnail,
          stock: maxStock
        }
      ];
    });
  };

  const removeFromCart = async (productId: string, variantId?: string | null) => {
    if (isAuthenticated) {
      try {
        const res = await fetch('/api/cart/items', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, variantId: variantId || null })
        });
        const data = await res.json();
        if (res.ok) setCart(data.cart);
      } catch {
        showToast('Unable to reach the server. Please try again.', 'error');
        return;
      }
    } else {
      setCart((prev) => prev.filter((item) => !(item.productId === productId && item.variantId === (variantId || null))));
    }
    showToast('Item removed from cart', 'info');
  };

  const updateQuantity = async (productId: string, variantId: string | null | undefined, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }

    if (isAuthenticated) {
      try {
        const res = await fetch('/api/cart/items', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, variantId: variantId || null, quantity })
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.message || 'Unable to update quantity — not enough stock', 'error');
          return;
        }
        setCart(data.cart);
      } catch {
        showToast('Unable to reach the server. Please try again.', 'error');
      }
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId && item.variantId === (variantId || null)) {
          const clamped = Math.min(quantity, item.stock);
          return { ...item, quantity: clamped };
        }
        return item;
      })
    );
  };

  const clearCart = async () => {
    if (isAuthenticated) {
      try {
        await fetch('/api/cart', { method: 'DELETE' });
      } catch {
        // best-effort — local state still clears below
      }
    }
    setCart([]);
    setAppliedCoupon(null);
    setDiscountAmount(0);
  };

  // Calculations — display only. The server re-prices everything (items,
  // flash deals, promo code, delivery, VAT) when the order is created.
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxRate = Number(settings?.taxRate ?? 16);
  const total = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round((total * taxRate) / (100 + taxRate));

  const validateCoupon = async (code: string) => {
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.valid, data };
  };

  const applyCoupon = async (code: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { ok, data } = await validateCoupon(code);
      if (ok) {
        setAppliedCoupon({
          code: data.code,
          discountType: data.discountType,
          discountValue: data.discountValue,
          description: data.description,
          isActive: true
        });
        setDiscountAmount(Number(data.calculatedDiscount) || 0);
        showToast(`Promo code ${data.code} applied: -KES ${Math.round(data.calculatedDiscount).toLocaleString('en-KE')}`, 'success');
        return { success: true, message: 'Promo code applied' };
      }
      showToast(data.message || 'This promo code is not valid', 'error');
      return { success: false, message: data.message || 'This promo code is not valid' };
    } catch {
      showToast('Unable to reach the server. Please try again.', 'error');
      return { success: false, message: 'Unable to reach the server. Please try again.' };
    }
  };

  // Cart contents changed: re-check the promo code against the new cart.
  const cartSignature = cart.map((i) => `${i.productId}:${i.variantId || ''}:${i.quantity}`).join('|');
  useEffect(() => {
    if (!appliedCoupon || !cart.length) {
      if (!cart.length && appliedCoupon) { setAppliedCoupon(null); setDiscountAmount(0); }
      return;
    }
    let cancelled = false;
    validateCoupon(appliedCoupon.code).then(({ ok, data }) => {
      if (cancelled) return;
      if (ok) setDiscountAmount(Number(data.calculatedDiscount) || 0);
      else {
        setAppliedCoupon(null);
        setDiscountAmount(0);
        showToast(`Promo code removed: ${data.message || 'no longer valid for this cart'}`, 'warning');
      }
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature]);

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
    showToast('Coupon removed', 'info');
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        cartCount,
        subtotal,
        discountAmount,
        taxAmount,
        taxRate,
        total,
        appliedCoupon,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        applyCoupon,
        removeCoupon,
        isCartDrawerOpen,
        setIsCartDrawerOpen
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
