import React, { useState, useEffect } from 'react';
import {
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  ShoppingCart,
  Heart,
  Scale,
  MessageCircle,
  Share2,
  CheckCircle2,
  Lock,
  ChevronRight,
  Package,
  Layers,
  Sparkles,
  Zap,
  Plus,
  Minus,
  Check
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { CompareDrawer } from '../components/common/CompareDrawer';
import { CartDrawer } from '../components/checkout/CartDrawer';
import { ProductCard } from '../components/common/ProductCard';
import { useStore } from '../context/StoreContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useCompare } from '../context/CompareContext';
import { useToast } from '../context/ToastContext';
import { Product, ProductVariant, Review, RatingSummary } from '../types';
import { ProductReviews } from '../components/reviews/ProductReviews';
import { StarDisplay } from '../components/reviews/StarRating';
import { DealCountdown } from '../components/common/DealCountdown';

import { initialProducts, initialReviews } from '../data/mockData';

export const ProductDetailPage: React.FC = () => {
  const { formatPrice, settings, products } = useStore();
  const { addToCart, setIsCartDrawerOpen } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { isComparing, addToCompare } = useCompare();
  const { showToast } = useToast();

  // Extract slug from URL path e.g. /products/apple-iphone-16-pro-max
  const pathParts = window.location.pathname.split('/');
  const slug = pathParts[pathParts.length - 1] || 'apple-iphone-16-pro-max';

  // Immediate lookup from catalog
  const catalogList = (products && products.length > 0) ? products : initialProducts;
  const initialFound = catalogList.find((p) => p.slug === slug || p.id === slug) || catalogList[0];

  const [product, setProduct] = useState<Product | null>(initialFound || null);
  const [related, setRelated] = useState<Product[]>(() => {
    if (!initialFound) return [];
    return catalogList.filter((p) => p.id !== initialFound.id && p.category === initialFound.category).slice(0, 4);
  });
  const [reviews, setReviews] = useState<Review[]>(() => {
    if (!initialFound) return [];
    return initialReviews.filter((r) => r.productId === initialFound.id);
  });
  const [loading, setLoading] = useState<boolean>(!initialFound);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  const [bundleProduct, setBundleProduct] = useState<Product | null>(null);
  const [includeBundle, setIncludeBundle] = useState(true);

  // Gallery state
  const [selectedImage, setSelectedImage] = useState<string>(
    initialFound ? (initialFound.thumbnail || initialFound.images[0]) : ''
  );
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    initialFound && initialFound.variants && initialFound.variants.length > 0 ? initialFound.variants[0] : null
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'specs' | 'description' | 'reviews' | 'warranty'>(() =>
    new URLSearchParams(window.location.search).get('review') === 'edit' ? 'reviews' : 'description');

  // Review submission modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newTitle, setNewTitle] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserCity, setNewUserCity] = useState('Nairobi');

  // Bundle Add-on items
  const [includeCharger, setIncludeCharger] = useState(true);

  // Pair with a different-category, in-stock related item (e.g. a laptop + an accessory).
  useEffect(() => {
    if (!product) return;
    const candidate = related.find((r) => r.category !== product.category && r.stock > 0) || related.find((r) => r.stock > 0) || null;
    setBundleProduct(candidate);
  }, [related, product?.id]);

  useEffect(() => {
    // Background live update if API exists
    fetch(`/api/products/${slug}`)
      .then((res) => {
        if (!res.ok) return null;
        const ct = res.headers.get('content-type');
        return ct && ct.includes('application/json') ? res.json() : null;
      })
      .then((data) => {
        if (data && data.success && data.product) {
          setProduct(data.product);
          setSelectedImage(data.product.thumbnail || data.product.images[0]);
          if (data.product.variants && data.product.variants.length > 0) {
            setSelectedVariant(data.product.variants[0]);
          }
          if (data.related) setRelated(data.related);
          if (data.reviews) setReviews(data.reviews);
          if (data.ratingSummary) setRatingSummary(data.ratingSummary);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Header currentPath="/products" />
        <div className="flex-1 flex items-center justify-center p-20">
          <div className="flex flex-col items-center gap-3 text-cyan-400">
            <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold uppercase tracking-wider">Loading Genuine Tech Specs...</span>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Header currentPath="/products" />
        <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">Product Not Found</h2>
          <p className="text-xs text-slate-400">The requested gadget might have been updated or moved.</p>
          <a href="/shop" className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-xs">
            Return to Shop
          </a>
        </div>
        <Footer />
      </div>
    );
  }

  // A live flash deal applies its discount to the base or variant price
  // (the server applies the same rule at checkout).
  const basePrice = selectedVariant ? selectedVariant.price : product.price;
  const deal = product.flashDeal && new Date(product.flashDeal.endsAt).getTime() > Date.now() ? product.flashDeal : null;
  const activePrice = deal
    ? Math.max(0, Math.round(deal.discountType === 'percentage' ? basePrice * (1 - deal.discountValue / 100) : basePrice - deal.discountValue))
    : basePrice;
  const wasPrice = deal ? basePrice : product.compareAtPrice && product.compareAtPrice > basePrice ? product.compareAtPrice : null;
  const specSections = Object.entries(product.specs || {}).filter(([, attrs]) => attrs && Object.keys(attrs).length > 0);
  const activeStock = selectedVariant ? selectedVariant.stock : product.stock;
  const activeSku = selectedVariant ? selectedVariant.sku : product.sku;

  const discountPercent = wasPrice && wasPrice > activePrice ? Math.round(((wasPrice - activePrice) / wasPrice) * 100) : 0;

  const isSaved = isInWishlist(product.id);
  const isCompared = isComparing(product.id);

  const handleAddToCart = () => {
    addToCart(product, selectedVariant, quantity);
  };

  const handleBuyNow = () => {
    addToCart(product, selectedVariant, quantity);
    window.location.href = '/checkout';
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out ${product.name} on ${settings.storeName}!`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Product link copied to clipboard!', 'success');
    }
  };

  // WhatsApp prefilled message
  const whatsappUrl = `https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Hello ${settings.storeName}, I am interested in ${product.name} [SKU: ${activeSku}] priced at ${formatPrice(activePrice)}. Is it currently available?`
  )}`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/products" />

      {/* Breadcrumb Bar */}
      <div className="bg-[#070b18] border-b border-slate-800 py-3.5 px-3 sm:px-4 lg:px-5">
        <div className="max-w-[1520px] mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400 truncate">
            <a href="/" className="hover:text-cyan-400">Home</a>
            <span>/</span>
            <a href="/shop" className="hover:text-cyan-400">Shop</a>
            <span>/</span>
            <a href={`/shop?category=${product.categoryId || product.category.toLowerCase()}`} className="hover:text-cyan-400 capitalize">
              {product.category}
            </a>
            <span>/</span>
            <span className="text-white font-medium truncate max-w-[200px] sm:max-w-xs">{product.name}</span>
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 font-semibold"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      {/* Main Showcase Grid */}
      <div className="max-w-[1520px] mx-auto px-3 sm:px-4 lg:px-5 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* ======================================================== */}
          {/* LEFT: MULTI-IMAGE GALLERY (5 Cols) */}
          {/* ======================================================== */}
          <div className="lg:col-span-6 space-y-4">
            {/* Main Stage Image */}
            <div className="relative h-80 sm:h-[450px] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 p-6 flex items-center justify-center group shadow-2xl">
              <img
                src={selectedImage}
                alt={product.name}
                className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500"
              />

              {discountPercent > 0 && (
                <span className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-rose-600 text-white font-black text-xs uppercase tracking-wider shadow-lg">
                  {discountPercent}% OFF
                </span>
              )}

              {product.isFlashDeal && (
                <span className="absolute top-4 right-4 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Flash Deal
                </span>
              )}
            </div>

            {/* Thumbnails list */}
            {product.images && product.images.length > 0 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className={`w-20 h-20 rounded-2xl overflow-hidden bg-slate-900 border-2 p-2 shrink-0 transition-all ${
                      selectedImage === img
                        ? 'border-cyan-500 ring-2 ring-cyan-500/30 scale-105'
                        : 'border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* RIGHT: BUY BOX & SPECS SELECTOR (6 Cols) */}
          {/* ======================================================== */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              {/* Brand & Stock Pill */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  {product.brand}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  SKU: <strong className="text-slate-200">{activeSku}</strong>
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight">
                {product.name}
              </h1>

              {/* Rating & Warranty */}
              <div className="flex flex-wrap items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 bg-amber-950/40 border border-amber-500/30 px-3 py-1 rounded-xl text-amber-400 text-xs font-bold">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>{product.rating.toFixed(1)} Rating</span>
                  <span className="text-slate-400 font-normal">({product.reviewsCount} customer reviews)</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{activeStock > 0 ? (activeStock <= 5 ? `Only ${activeStock} left in stock` : 'In stock') : 'Out of stock'}</span>
                </div>
              </div>

              {/* Price Display */}
              {deal && (
                <div className="mt-5 rounded-2xl border border-amber-600/40 bg-amber-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="eyebrow !text-amber-400 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" aria-hidden="true" />Flash deal</div>
                    <div className="font-bold text-white">{deal.title}</div>
                    {deal.remaining != null && <div className="text-xs text-amber-300">{deal.remaining} left at this price</div>}
                  </div>
                  <DealCountdown endsAt={deal.endsAt} />
                </div>
              )}

              <div className="mt-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-0.5">{deal ? 'Deal price' : 'Price'}</div>
                  <div className="text-3xl sm:text-4xl font-black text-white">{formatPrice(activePrice)}</div>
                  {wasPrice && wasPrice > activePrice && (
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span className="line-through">{formatPrice(wasPrice)}</span>
                      <span className="text-emerald-400 font-bold">Save {formatPrice(wasPrice - activePrice)}</span>
                    </div>
                  )}
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <div className="font-semibold text-slate-300">{settings.taxRate}% VAT included</div>
                  <div>Tax invoice with every order</div>
                </div>
              </div>

              {(product.reviewsCount ?? 0) > 0 && (
                <button type="button" onClick={() => { setActiveTab('reviews'); document.getElementById('product-tabs')?.scrollIntoView({ behavior: 'smooth' }); }} className="mt-3 inline-flex items-center gap-2 text-sm text-slate-300 hover:underline">
                  <StarDisplay value={Number(product.rating) || 0} /> {Number(product.rating).toFixed(1)} · {product.reviewsCount} review{product.reviewsCount === 1 ? '' : 's'}
                </button>
              )}
            </div>

            {/* Variants Picker (Storage / RAM / Colors) */}
            {product.variants && product.variants.length > 0 && (
              <div className="space-y-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Select Model Configuration:</span>
                  <span className="text-cyan-400 font-normal">
                    {selectedVariant ? selectedVariant.name : 'Choose one'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariant(variant)}
                      className={`p-3 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                        selectedVariant?.id === variant.id
                          ? 'bg-cyan-950/80 border-cyan-500 text-white font-bold ring-1 ring-cyan-500'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{variant.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {variant.stock > 0 ? `${variant.stock} available` : 'Sold out'}
                        </div>
                      </div>
                      <div className="text-emerald-400 font-black text-sm">
                        {formatPrice(variant.price)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add to Cart & Buy Now Buttons */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {/* Quantity adjuster */}
                <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-sm transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-sm font-black text-white font-mono">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(activeStock, quantity + 1))}
                    className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Add to Cart Button */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={activeStock <= 0}
                  className="flex-1 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-cyan-600/30 transition-all active:scale-98"
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>Add to Cart</span>
                </button>
              </div>

              {/* Buy Now Direct Button */}
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={activeStock <= 0}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30 transition-all"
              >
                <Zap className="w-5 h-5" />
                <span>Buy Now with M-Pesa / Card</span>
              </button>

              {/* Action utilities */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => toggleWishlist(product)}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-colors ${
                    isSaved ? 'bg-rose-950/80 border-rose-500 text-rose-400' : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-400' : ''}`} />
                  <span>{isSaved ? 'Saved' : 'Wishlist'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => addToCompare(product)}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-colors ${
                    isCompared ? 'bg-cyan-950/80 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <Scale className="w-4 h-4" />
                  <span>Compare</span>
                </button>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900 flex items-center justify-center gap-2 font-bold transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Trust Assurance Grid */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Warranty Included</div>
                  <div className="text-slate-400 text-[11px]">{product.warranty}</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Truck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Fast Dispatch</div>
                  <div className="text-slate-400 text-[11px]">Same-Day Nairobi • 24h Countrywide</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Frequently bought together — a real in-stock catalog item only */}
        {bundleProduct && (
          <section className="mt-16 card card-pad space-y-6" aria-labelledby="bundle-title">
            <div className="eyebrow flex items-center gap-2"><Sparkles className="w-4 h-4" aria-hidden="true" />Pairs well with</div>
            <h2 id="bundle-title" className="section-title">Frequently bought together</h2>
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
              <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800 flex-1 min-w-0">
                <img src={product.thumbnail} alt="" className="w-16 h-16 rounded-xl object-contain bg-slate-900 p-1 shrink-0" />
                <div className="min-w-0"><div className="text-sm font-bold text-white line-clamp-1">{product.name}</div><div className="text-emerald-400 font-extrabold text-sm">{formatPrice(activePrice)}</div></div>
              </div>
              <span className="text-slate-500 font-bold text-xl text-center" aria-hidden="true">+</span>
              <label className="flex items-center gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800 flex-1 min-w-0 cursor-pointer">
                <input type="checkbox" checked={includeBundle} onChange={(e) => setIncludeBundle(e.target.checked)} className="w-4 h-4 accent-[var(--t-accent-600)] shrink-0" />
                <img src={bundleProduct.thumbnail} alt="" className="w-16 h-16 rounded-xl object-contain bg-slate-900 p-1 shrink-0" />
                <div className="min-w-0"><div className="text-sm font-bold text-white line-clamp-1">{bundleProduct.name}</div><div className="text-emerald-400 font-extrabold text-sm">{formatPrice(bundleProduct.flashDeal?.dealPrice ?? bundleProduct.price)}</div></div>
              </label>
              <div className="p-4 rounded-2xl bg-cyan-950/60 border border-cyan-800/60 text-center md:w-64 space-y-2">
                <div className="text-xs text-slate-300">Together</div>
                <div className="text-xl font-black text-white">{formatPrice(activePrice + (includeBundle ? (bundleProduct.flashDeal?.dealPrice ?? bundleProduct.price) : 0))}</div>
                <button
                  type="button"
                  onClick={async () => {
                    await addToCart(product, selectedVariant, 1);
                    if (includeBundle) await addToCart(bundleProduct, null, 1);
                    setIsCartDrawerOpen(true);
                  }}
                  disabled={activeStock <= 0}
                  className="btn btn-primary w-full"
                >
                  {includeBundle ? 'Add both to cart' : 'Add to cart'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* SPECIFICATIONS & REVIEWS TABS */}
        {/* ======================================================== */}
        <section id="product-tabs" className="mt-16 space-y-6 scroll-mt-24" aria-label="Product information">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto scrollbar-none" role="tablist">
            {[
              { id: 'description', label: 'Overview' },
              { id: 'specs', label: 'Specifications' },
              { id: 'reviews', label: `Reviews (${ratingSummary?.count ?? reviews.length})` },
              { id: 'warranty', label: 'Warranty & returns' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shrink-0 ${activeTab === tab.id ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'description' && (
            <div className="card card-pad space-y-5 animate-fadeInUp" role="tabpanel">
              <h2 className="text-xl font-bold text-white">About this product</h2>
              {product.description ? (
                <div className="space-y-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-3xl">
                  {product.description.split(/\n{2,}/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}
                </div>
              ) : (
                <p className="text-sm text-slate-400">A detailed description is coming soon. See the Specifications tab, or ask us on WhatsApp.</p>
              )}
              {product.shortSpecs && (
                <div>
                  <h3 className="eyebrow mb-2">Key features</h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {product.shortSpecs.split('|').map((f) => f.trim()).filter(Boolean).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-200"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {[['Brand', product.brand], ['Condition', product.condition], ['Warranty', product.warranty], ['SKU', activeSku]].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 min-w-0"><dt className="text-xs text-slate-500">{k}</dt><dd className="font-semibold text-white break-words">{v}</dd></div>
                ))}
              </dl>
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="card card-pad space-y-6 animate-fadeInUp" role="tabpanel">
              <h2 className="text-xl font-bold text-white">Specifications</h2>
              {specSections.length ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {specSections.map(([section, attrs]) => (
                    <div key={section} className="rounded-2xl border border-slate-800 overflow-hidden">
                      <h3 className="px-4 py-2.5 bg-slate-950 text-xs font-extrabold text-cyan-400 uppercase tracking-wider">{section}</h3>
                      <dl className="divide-y divide-slate-800">
                        {Object.entries(attrs).map(([k, v]) => (
                          <div key={k} className="grid grid-cols-1 sm:grid-cols-5 gap-1 sm:gap-3 px-4 py-2.5 text-sm">
                            <dt className="sm:col-span-2 text-slate-400">{k}</dt>
                            <dd className="sm:col-span-3 text-white font-medium break-words">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">{product.shortSpecs || 'Detailed specifications have not been published for this item yet.'}</p>
              )}
              <p className="text-xs text-slate-500">Specifications are from the manufacturer or our product listing. If a detail matters for your purchase, confirm with our team before ordering.</p>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="card card-pad animate-fadeInUp" role="tabpanel">
              <h2 className="text-xl font-bold text-white mb-4">Customer reviews</h2>
              <ProductReviews productId={product.id} productName={product.name} initialReviews={reviews} initialSummary={ratingSummary} />
            </div>
          )}

          {activeTab === 'warranty' && (
            <div className="card card-pad space-y-3 text-sm text-slate-300 leading-relaxed animate-fadeInUp" role="tabpanel">
              <h2 className="text-xl font-bold text-white">Warranty & returns</h2>
              <p>This item is covered by <strong className="text-white">{product.warranty || 'our standard warranty'}</strong>. For warranty service bring the item and your receipt to {settings.address}, or call {settings.phone}.</p>
              <p>Unused items in original packaging can be returned within 7 days — see our <a href="/policies/returns" className="text-cyan-400 underline">returns policy</a> and <a href="/policies/warranty" className="text-cyan-400 underline">warranty policy</a>.</p>
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* RELATED PRODUCTS */}
        {/* ======================================================== */}
        {related.length > 0 && (
          <div className="mt-16 space-y-6">
            <h3 className="text-xl sm:text-2xl font-extrabold text-white">
              Customers Also Explored
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {related.map((prod) => (
                <ProductCard key={prod.id} product={prod} />
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
      <FloatingWhatsApp productContext={product.name} />
      <CompareDrawer />
      <CartDrawer />
    </div>
  );
};
