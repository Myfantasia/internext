import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ShoppingCart, Search, X, Plus, Minus, Trash2, CheckCircle2, Printer,
  Store, User, Banknote, CreditCard, Smartphone, ChevronDown, RefreshCw,
  Package, AlertTriangle, Receipt, Tag
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api, PageHeader, LoadingBlock, ErrorState, EmptyState, kes, useDebounced, Field, Modal } from './adminUi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Store { id: string; name: string; city?: string }
interface ProductVariant { id: string; name: string; price: string; sku?: string; stock?: number }
interface Product {
  id: string; name: string; sku?: string; price: string; thumbnailUrl?: string;
  stock: number; categoryName?: string; variants?: ProductVariant[]; costPrice?: string;
}
interface CartLine {
  productId: string; variantId: string | null; name: string; variantName: string | null;
  sku: string | null; price: number; quantity: number; thumbnailUrl?: string; maxStock: number;
}
interface PosOrder {
  id: string; orderNumber: string; total: number; amountPaid: number; paymentMethod: string;
  customerName: string; items?: { name: string; variantName?: string; quantity: number; unitPrice: number }[];
  paidAt?: string; receipt?: { receiptNumber: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PAYMENT_METHODS = [
  { key: 'M-Pesa', label: 'M-Pesa', icon: Smartphone },
  { key: 'Cash', label: 'Cash', icon: Banknote },
  { key: 'Card', label: 'Card (Tap/Chip)', icon: CreditCard },
  { key: 'Bank Transfer', label: 'Bank Transfer', icon: CreditCard },
];

// ---------------------------------------------------------------------------
// POS Component
// ---------------------------------------------------------------------------
export const AdminPOS: React.FC = () => {
  const { can } = useAuth();
  const { showToast } = useToast();

  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState('');
  const [storesLoading, setStoresLoading] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const debouncedSearch = useDebounced(productSearch, 300);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
  const [couponCode, setCouponCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('M-Pesa');
  const [amountTendered, setAmountTendered] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<PosOrder | null>(null);
  const [selectingVariant, setSelectingVariant] = useState<Product | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // load stores
  useEffect(() => {
    api<{ settings: { storeName: string }; stores: { id: string; name: string; city?: string }[] }>('/api/admin/settings/public')
      .then(d => {
        setStores(d.stores || []);
        if (d.stores?.length === 1) setStoreId(d.stores[0].id);
      })
      .catch(() => showToast('Could not load stores', 'error'))
      .finally(() => setStoresLoading(false));
  }, []);

  // load products
  const loadProducts = useCallback(async () => {
    if (!storeId) return;
    setProductsLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '48', page: '1' });
      if (debouncedSearch.trim()) qs.set('search', debouncedSearch.trim());
      const data = await api<{ products: Product[] }>(`/api/admin/products?${qs}`);
      setProducts(data.products || []);
    } catch { /* silent */ }
    finally { setProductsLoading(false); }
  }, [storeId, debouncedSearch]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // Cart helpers
  const cartTotal = cart.reduce((s, l) => s + l.price * l.quantity, 0);
  const change = Number(amountTendered) - cartTotal;

  const addToCart = (product: Product, variant?: ProductVariant) => {
    const variantId = variant?.id || null;
    const price = parseFloat(variant?.price || product.price);
    const maxStock = variant?.stock ?? product.stock;
    const name = product.name;
    const variantName = variant?.name || null;
    const sku = variant?.sku || product.sku || null;
    const thumbnailUrl = product.thumbnailUrl;

    setCart(prev => {
      const existing = prev.find(l => l.productId === product.id && l.variantId === variantId);
      if (existing) {
        if (existing.quantity >= existing.maxStock) {
          showToast(`Only ${existing.maxStock} in stock`, 'error'); return prev;
        }
        return prev.map(l => l === existing ? { ...l, quantity: l.quantity + 1 } : l);
      }
      if (maxStock === 0) { showToast('Out of stock at this branch', 'error'); return prev; }
      return [...prev, { productId: product.id, variantId, name, variantName, sku, price, quantity: 1, thumbnailUrl, maxStock }];
    });
    setSelectingVariant(null);
    searchRef.current?.focus();
  };

  const setQty = (idx: number, qty: number) => {
    setCart(prev => {
      const line = prev[idx];
      if (qty > line.maxStock) { showToast(`Only ${line.maxStock} in stock`, 'error'); return prev; }
      if (qty <= 0) return prev.filter((_, i) => i !== idx);
      return prev.map((l, i) => i === idx ? { ...l, quantity: qty } : l);
    });
  };

  const clearCart = () => {
    setCart([]);
    setCustomer({ name: '', email: '', phone: '' });
    setCouponCode('');
    setAmountTendered('');
  };

  const handleCheckout = async () => {
    if (!storeId) { showToast('Select a store first', 'error'); return; }
    if (!cart.length) { showToast('Cart is empty', 'error'); return; }
    const paid = Number(amountTendered);
    if (paid < cartTotal) { showToast('Amount tendered is less than total', 'error'); return; }

    setCheckoutLoading(true);
    try {
      const result = await api<{ order: PosOrder; receipt?: any }>('/api/admin/pos/checkout', {
        method: 'POST',
        body: {
          storeId,
          customer: customer.name || customer.phone || customer.email ? customer : undefined,
          items: cart.map(l => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
          paymentMethod,
          amountPaid: paid,
          couponCode: couponCode.trim() || undefined,
        }
      });
      setCompletedOrder(result.order);
      clearCart();
      showToast(`Sale complete — ${result.order.orderNumber}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Checkout failed', 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (storesLoading) return <LoadingBlock label="Loading stores…" />;

  if (!stores.length) return (
    <EmptyState
      title="No stores configured"
      text="Add at least one physical store location under Settings before using the POS."
    />
  );

  return (
    <div className="space-y-5 animate-fadeInUp">
      <PageHeader
        icon={ShoppingCart}
        title="Point of Sale"
        description="Process in-store sales. Every transaction is instantly reconciled with inventory and finance."
      />

      {/* Store selector */}
      {stores.length > 1 && (
        <div className="card p-3 flex items-center gap-3">
          <Store className="w-4 h-4 text-cyan-400 shrink-0" />
          <label htmlFor="pos-store" className="text-sm font-semibold text-slate-300 shrink-0">Branch:</label>
          <select
            id="pos-store"
            value={storeId}
            onChange={e => { setStoreId(e.target.value); setCart([]); }}
            className="field-input !py-1.5"
          >
            <option value="">— select store —</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ''}</option>)}
          </select>
        </div>
      )}

      {storeId && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* ---- Product grid (left) ---- */}
          <div className="lg:col-span-3 space-y-3">
            {/* Search */}
            <div className="card p-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Search products or scan barcode…"
                className="bg-transparent flex-1 text-sm text-white placeholder:text-slate-500 outline-none"
                aria-label="Search products"
              />
              {productSearch && (
                <button type="button" onClick={() => setProductSearch('')} className="icon-button">
                  <X className="w-4 h-4" />
                </button>
              )}
              <button type="button" onClick={loadProducts} className="icon-button" aria-label="Refresh products">
                <RefreshCw className={`w-4 h-4 ${productsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Product grid */}
            {productsLoading ? <LoadingBlock label="Loading products…" /> : (
              products.length === 0 ? (
                <EmptyState title="No products found" text="Try a different search term." />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {products.map(p => (
                    <ProductCard key={p.id} product={p} onAdd={() => {
                      if (p.variants && p.variants.length > 0) {
                        setSelectingVariant(p);
                      } else {
                        addToCart(p);
                      }
                    }} />
                  ))}
                </div>
              )
            )}
          </div>

          {/* ---- Cart (right) ---- */}
          <div className="lg:col-span-2 space-y-3 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overscroll-contain">
            {/* Customer (optional) */}
            <div className="card p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <User className="w-3.5 h-3.5" />
                <span>Customer (optional)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2">
                <input
                  type="text" value={customer.name} onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))}
                  placeholder="Name (Walk-in)" className="field-input !py-1.5 text-sm" aria-label="Customer name"
                />
                <input
                  type="tel" value={customer.phone} onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))}
                  placeholder="Phone" className="field-input !py-1.5 text-sm" aria-label="Phone"
                />
                <input
                  type="email" value={customer.email} onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))}
                  placeholder="Email" className="field-input !py-1.5 text-sm" aria-label="Email"
                />
              </div>
            </div>

            {/* Cart lines */}
            <div className="card overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Cart</span>
                {cart.length > 0 && (
                  <button type="button" onClick={clearCart} className="btn btn-ghost btn-sm text-rose-400">
                    <Trash2 className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>
              {cart.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <ShoppingCart className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Cart is empty. Tap a product to add it.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50 max-h-80 overflow-y-auto">
                  {cart.map((line, idx) => (
                    <div key={`${line.productId}-${line.variantId}`} className="flex items-center gap-2 px-3 py-2">
                      {line.thumbnailUrl ? (
                        <img src={line.thumbnailUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0 bg-slate-800" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-800 grid place-items-center shrink-0">
                          <Package className="w-4 h-4 text-slate-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{line.name}</div>
                        {line.variantName && <div className="text-xs text-slate-400 truncate">{line.variantName}</div>}
                        <div className="text-xs text-cyan-400 font-mono">{kes(line.price)}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => setQty(idx, line.quantity - 1)} className="icon-button w-6 h-6 text-xs" aria-label="Decrease">
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number" min={1} max={line.maxStock} value={line.quantity}
                          onChange={e => setQty(idx, Number(e.target.value))}
                          className="w-10 text-center bg-slate-800 border border-slate-700 rounded text-xs text-white py-0.5"
                          aria-label="Quantity"
                        />
                        <button type="button" onClick={() => setQty(idx, line.quantity + 1)} className="icon-button w-6 h-6 text-xs" aria-label="Increase">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={() => setQty(idx, 0)} className="icon-button w-6 h-6 text-rose-400" aria-label="Remove">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-xs font-bold text-white tabular-nums shrink-0 w-20 text-right">
                        {kes(line.price * line.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Coupon */}
            <div className="card p-3 flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <input
                type="text" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Promo code (optional)" maxLength={30}
                className="bg-transparent flex-1 text-sm text-white placeholder:text-slate-500 outline-none font-mono"
                aria-label="Coupon code"
              />
              {couponCode && <button type="button" onClick={() => setCouponCode('')} className="icon-button"><X className="w-3.5 h-3.5" /></button>}
            </div>

            {/* Payment method */}
            <div className="card p-3 space-y-2">
              <span className="text-xs font-semibold text-slate-400">Payment method</span>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => {
                  const Icon = m.icon;
                  const active = paymentMethod === m.key;
                  return (
                    <button
                      key={m.key} type="button"
                      onClick={() => setPaymentMethod(m.key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${active ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-600/20' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'}`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Total + Tender */}
            <div className="card p-3 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Subtotal</span>
                <span className="font-mono text-white">{kes(cartTotal)}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between items-center">
                <span className="text-base font-black text-white">TOTAL</span>
                <span className="text-xl font-black text-cyan-400 tabular-nums">{kes(cartTotal)}</span>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="pos-tender" className="text-xs font-semibold text-slate-400">Amount tendered</label>
                <input
                  id="pos-tender" type="number" inputMode="decimal" min={cartTotal} step="1"
                  value={amountTendered} onChange={e => setAmountTendered(e.target.value)}
                  placeholder={kes(cartTotal)}
                  className="field-input font-mono text-right text-lg"
                  aria-label="Amount tendered"
                />
                {Number(amountTendered) > 0 && change >= 0 && (
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-slate-400">Change</span>
                    <span className="text-emerald-400 tabular-nums">{kes(change)}</span>
                  </div>
                )}
                {Number(amountTendered) > 0 && change < 0 && (
                  <div className="flex items-center gap-1 text-xs text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Amount is {kes(Math.abs(change))} short</span>
                  </div>
                )}
              </div>
            </div>

            {/* Checkout button */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={checkoutLoading || !cart.length || !Number(amountTendered) || Number(amountTendered) < cartTotal}
              className="btn btn-primary w-full py-4 text-base font-black tracking-wide"
              id="pos-charge-btn"
            >
              {checkoutLoading ? (
                <><RefreshCw className="w-5 h-5 animate-spin" /> Processing…</>
              ) : (
                <><CheckCircle2 className="w-5 h-5" /> Charge {kes(cartTotal)}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Variant picker modal */}
      {selectingVariant && (
        <VariantPicker product={selectingVariant} onSelect={v => addToCart(selectingVariant, v)} onClose={() => setSelectingVariant(null)} />
      )}

      {/* Receipt modal */}
      {completedOrder && (
        <ReceiptModal order={completedOrder} onClose={() => setCompletedOrder(null)} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Product card
// ---------------------------------------------------------------------------
const ProductCard: React.FC<{ product: Product; onAdd: () => void }> = ({ product, onAdd }) => {
  const outOfStock = product.stock <= 0 && !(product.variants?.some(v => (v.stock ?? 0) > 0));
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={outOfStock}
      className={`card p-2 text-left flex flex-col gap-1 transition-all group ${outOfStock ? 'opacity-40 cursor-not-allowed' : 'hover:border-cyan-700 hover:shadow-lg hover:shadow-cyan-600/10 hover:-translate-y-0.5 active:scale-95'}`}
      aria-label={`Add ${product.name} to cart`}
    >
      <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-800 mb-1 relative">
        {product.thumbnailUrl ? (
          <img src={product.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Package className="w-8 h-8 text-slate-600" />
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-slate-900/70 grid place-items-center">
            <span className="text-xs font-black text-rose-400 bg-slate-900/80 px-2 py-0.5 rounded">OUT OF STOCK</span>
          </div>
        )}
        {product.variants && product.variants.length > 0 && !outOfStock && (
          <div className="absolute bottom-1 right-1 bg-slate-900/80 rounded px-1 text-[10px] text-slate-300 flex items-center gap-0.5">
            <ChevronDown className="w-3 h-3" />{product.variants.length} vars
          </div>
        )}
      </div>
      <div className="text-xs font-semibold text-white leading-tight line-clamp-2">{product.name}</div>
      <div className="text-xs font-black text-cyan-400 tabular-nums">{kes(parseFloat(product.price))}</div>
      {product.categoryName && <div className="text-[10px] text-slate-500 truncate">{product.categoryName}</div>}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Variant picker
// ---------------------------------------------------------------------------
const VariantPicker: React.FC<{ product: Product; onSelect: (v: ProductVariant) => void; onClose: () => void }> = ({ product, onSelect, onClose }) => (
  <Modal title={product.name} description="Select a variant to add to cart" onClose={onClose} size="medium"
    footer={<button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>}
  >
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {product.variants?.map(v => {
        const outOfStock = (v.stock ?? 0) <= 0;
        return (
          <button
            key={v.id} type="button" onClick={() => onSelect(v)} disabled={outOfStock}
            className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-all ${outOfStock ? 'opacity-40 cursor-not-allowed border-slate-800' : 'border-slate-700 hover:border-cyan-600 hover:bg-cyan-950/20'}`}
          >
            <div>
              <div className="text-sm font-semibold text-white">{v.name}</div>
              {v.sku && <div className="text-xs text-slate-500 font-mono">{v.sku}</div>}
              {outOfStock && <div className="text-xs text-rose-400">Out of stock</div>}
            </div>
            <div className="text-sm font-black text-cyan-400 tabular-nums shrink-0">{kes(parseFloat(v.price))}</div>
          </button>
        );
      })}
    </div>
  </Modal>
);

// ---------------------------------------------------------------------------
// Receipt modal (thermal-printer friendly)
// ---------------------------------------------------------------------------
const ReceiptModal: React.FC<{ order: PosOrder; onClose: () => void }> = ({ order, onClose }) => {
  const handlePrint = () => window.print();

  return (
    <Modal title="Sale Complete" description="Print or close this receipt." onClose={onClose} size="medium"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-secondary">New Sale</button>
          <button type="button" onClick={handlePrint} className="btn btn-primary"><Printer className="w-4 h-4" />Print Receipt</button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-1 mb-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-400" />
        <p className="text-lg font-black text-white">{kes(order.amountPaid)} collected</p>
        <p className="text-sm text-slate-400">{order.orderNumber} · {order.paymentMethod}</p>
        {Number(order.amountPaid) > Number(order.total) && (
          <div className="text-emerald-400 text-sm font-semibold">
            Change: {kes(Number(order.amountPaid) - Number(order.total))}
          </div>
        )}
      </div>

      {/* Printable receipt area */}
      <div id="pos-receipt" className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-2 print:bg-white print:text-black print:border-none">
        <div className="text-center space-y-0.5">
          <div className="font-black text-sm text-white print:text-black">RECEIPT</div>
          <div className="text-slate-400 print:text-gray-600">{order.orderNumber}</div>
          <div className="text-slate-400 print:text-gray-600">
            {new Date(order.paidAt || Date.now()).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        </div>
        <div className="border-t border-dashed border-slate-700 print:border-gray-400 pt-2">
          <div className="text-slate-400 print:text-gray-600">Customer: <span className="text-white print:text-black">{order.customerName}</span></div>
          <div className="text-slate-400 print:text-gray-600">Payment: <span className="text-white print:text-black">{order.paymentMethod}</span></div>
        </div>
        {order.items && order.items.length > 0 && (
          <div className="border-t border-dashed border-slate-700 print:border-gray-400 pt-2 space-y-1">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="text-slate-200 print:text-black truncate">{item.name}{item.variantName ? ` (${item.variantName})` : ''} × {item.quantity}</span>
                <span className="tabular-nums text-white print:text-black shrink-0">{kes(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-dashed border-slate-700 print:border-gray-400 pt-2 space-y-1">
          <div className="flex justify-between font-black text-sm text-white print:text-black">
            <span>TOTAL</span><span>{kes(order.total)}</span>
          </div>
          <div className="flex justify-between text-slate-400 print:text-gray-600">
            <span>Paid</span><span>{kes(order.amountPaid)}</span>
          </div>
          {Number(order.amountPaid) > Number(order.total) && (
            <div className="flex justify-between text-emerald-400 print:text-green-700">
              <span>Change</span><span>{kes(Number(order.amountPaid) - Number(order.total))}</span>
            </div>
          )}
        </div>
        <div className="text-center text-slate-500 print:text-gray-500 pt-1">
          Thank you for your purchase!
        </div>
      </div>
    </Modal>
  );
};
