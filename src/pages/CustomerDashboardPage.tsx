import React, { useState, useEffect } from 'react';
import {
  Package,
  Heart,
  MapPin,
  HelpCircle,
  User as UserIcon,
  LogOut,
  Clock,
  Printer,
  ChevronRight,
  Plus,
  Send,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Gift,
  Copy,
  Star
} from 'lucide-react';
import { ReferralPanel } from '../components/account/ReferralPanel';
import { MyReviewsPanel } from '../components/account/MyReviewsPanel';
import { ProfilePanel } from '../components/account/ProfilePanel';
import { SupportTicketsPanel } from '../components/account/SupportTicketsPanel';
import { LocationPicker } from '../components/location/LocationPicker';
import { UserLocation } from '../types';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { InvoiceModal } from '../components/checkout/InvoiceModal';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { Order } from '../types';

export const CustomerDashboardPage: React.FC = () => {
  const { user, logout, updateProfile } = useAuth();
  const { formatPrice } = useStore();
  const { wishlist, removeFromWishlist } = useWishlist();
  const { showToast } = useToast();

  type Tab = 'orders' | 'wishlist' | 'addresses' | 'referrals' | 'reviews' | 'tickets' | 'settings';
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
    return t && ['orders', 'wishlist', 'addresses', 'referrals', 'reviews', 'tickets', 'settings'].includes(t) ? t : 'orders';
  });
  const [location, setLocation] = useState<UserLocation>(() => user?.location || { county: '', town: '', addressLine: '', lat: null, lng: null, source: 'manual' });
  const [savingLocation, setSavingLocation] = useState(false);
  const saveLocation = async () => {
    if (!location.county || !location.town?.trim()) { showToast('Choose your county and enter your town', 'error'); return; }
    setSavingLocation(true);
    const result = await updateProfile({ location });
    setSavingLocation(false);
    showToast(result.success ? 'Delivery location saved' : (result.message || 'Could not save location'), result.success ? 'success' : 'error');
  };
  const [orders, setOrders] = useState<Order[]>([]);
  const [openTicketCount, setOpenTicketCount] = useState<number | undefined>(undefined);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (user?.email) {
      // Fetch customer orders — scoped server-side to the authenticated
      // session (server/routes/orderRoutes.js), the URL segment is ignored
      // for non-staff requesters.
      fetch('/api/orders/mine')
        .then((res) => {
          if (!res.ok) return null;
          const ct = res.headers.get('content-type');
          return ct && ct.includes('application/json') ? res.json() : null;
        })
        .then((data) => {
          if (data && data.orders) setOrders(data.orders);
        })
        .catch(() => {});

    }
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/customer/dashboard" />

      {/* Hero Header */}
      <div className="bg-[#070b18] border-b border-slate-800 py-8 px-3 sm:px-4 lg:px-5">
        <div className="max-w-[1520px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={user?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'}
              alt={user?.name || 'Customer'}
              className="w-14 h-14 rounded-2xl object-cover ring-2 ring-cyan-500/50 shadow-lg"
            />
            <div>
              <div className="text-xs text-slate-400">Welcome Back,</div>
              <h1 className="text-xl sm:text-2xl font-black text-white">{user?.name || 'My account'}</h1>
              <div className="text-xs text-cyan-400 font-mono">{user?.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/shop"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Shop New Tech
            </a>
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-rose-400 border border-slate-800 rounded-xl text-xs font-bold transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Dashboard Layout */}
      <div className="max-w-[1520px] mx-auto px-3 sm:px-4 lg:px-5 py-8 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Navigation Sidebar */}
          <aside className="lg:col-span-3 space-y-2 lg:sticky lg:top-32 self-start">
            {/* Phones/tablets: a horizontally scrollable tab strip; desktop: a vertical menu. */}
            <nav aria-label="Account sections" className="bg-slate-900 border border-slate-800 rounded-3xl p-2 lg:p-3 flex gap-1 overflow-x-auto scrollbar-none lg:block lg:space-y-1 shadow-xl">
              {[
                { id: 'orders', label: 'My Orders & Deliveries', icon: Package, count: orders.length },
                { id: 'wishlist', label: 'Saved Wishlist', icon: Heart, count: wishlist.length },
                { id: 'addresses', label: 'Delivery Location', icon: MapPin },
                { id: 'referrals', label: 'Referrals & Rewards', icon: Gift },
                { id: 'reviews', label: 'My Reviews', icon: Star },
                { id: 'tickets', label: 'Support & Inquiries', icon: HelpCircle, count: openTicketCount },
                { id: 'settings', label: 'My Profile', icon: UserIcon }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`shrink-0 lg:w-full flex items-center justify-between gap-3 p-3 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </div>
                    {tab.count !== undefined && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right Main Content Panel */}
          <main className="lg:col-span-9 space-y-6">
            {/* TAB 1: ORDERS */}
            {activeTab === 'orders' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h2 className="text-lg font-bold text-white">Order History & Fulfillment</h2>
                  <span className="text-xs text-slate-400">{orders.length} total orders</span>
                </div>

                {orders.length === 0 ? (
                  <div className="py-16 text-center bg-slate-900/60 rounded-3xl border border-slate-800 p-8 space-y-3">
                    <Package className="w-12 h-12 text-slate-600 mx-auto" />
                    <h4 className="text-base font-bold text-white">No orders placed yet</h4>
                    <p className="text-xs text-slate-400">Your completed tech purchases will appear here with live tracking.</p>
                  </div>
                ) : (
                  orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl hover:border-slate-700 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800 text-xs">
                        <div>
                          <span className="font-mono font-black text-cyan-400 text-sm">{ord.orderNumber}</span>
                          <span className="text-slate-400 ml-2">Ordered on {new Date(ord.createdAt).toLocaleDateString()}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 font-bold border border-cyan-800">
                            {ord.status}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-bold border border-emerald-800">
                            {ord.paymentStatus}
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="divide-y divide-slate-800/80">
                        {ord.items.map((it, idx) => (
                          <div key={idx} className="py-3 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <img src={it.thumbnail} alt="" className="w-12 h-12 rounded-xl object-contain bg-slate-950 p-1 border border-slate-800" />
                              <div>
                                <h4 className="font-bold text-white">{it.name}</h4>
                                {it.variantName && <div className="text-cyan-400 text-[11px] font-mono">{it.variantName}</div>}
                                <div className="text-[10px] text-slate-400">Qty: {it.quantity}</div>
                              </div>
                            </div>
                            <div className="font-black text-emerald-400 text-sm">{formatPrice(it.price * it.quantity)}</div>
                          </div>
                        ))}
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="text-slate-400">Total Paid: </span>
                          <span className="font-black text-white text-sm">{formatPrice(ord.total)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceOrder(ord)}
                            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Invoice</span>
                          </button>

                          <a
                            href={`/track-order?orderNumber=${ord.orderNumber}`}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow"
                          >
                            <span>Live Tracking</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 2: WISHLIST */}
            {activeTab === 'wishlist' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h2 className="text-lg font-bold text-white">Saved Gadgets Wishlist</h2>
                  <span className="text-xs text-slate-400">{wishlist.length} saved units</span>
                </div>

                {wishlist.length === 0 ? (
                  <div className="py-16 text-center bg-slate-900/60 rounded-3xl border border-slate-800 p-8 space-y-3">
                    <Heart className="w-12 h-12 text-slate-600 mx-auto" />
                    <h4 className="text-base font-bold text-white">Your wishlist is empty</h4>
                    <a href="/shop" className="inline-block px-5 py-2 bg-cyan-600 text-white font-bold rounded-xl text-xs">
                      Explore Catalog
                    </a>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {wishlist.map((prod) => (
                      <div key={prod.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex gap-3 relative">
                        <img src={prod.thumbnail} alt="" className="w-20 h-20 rounded-xl object-contain bg-slate-950 p-1 border border-slate-800" />
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="text-[10px] text-cyan-400 font-bold uppercase">{prod.brand}</div>
                            <h4 className="text-xs font-bold text-white truncate">{prod.name}</h4>
                            <div className="text-xs font-black text-emerald-400 mt-1">{formatPrice(prod.price)}</div>
                          </div>
                          <div className="flex items-center justify-between pt-2">
                            <a
                              href={`/products/${prod.slug}`}
                              className="text-xs font-bold text-cyan-400 hover:underline"
                            >
                              View Product
                            </a>
                            <button
                              type="button"
                              onClick={() => removeFromWishlist(prod.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ADDRESSES */}
            {activeTab === 'addresses' && (
              <div className="space-y-4 animate-fadeInUp">
                <div className="pb-3 border-b border-slate-800">
                  <h2 className="text-lg font-bold text-white">Delivery location</h2>
                  <p className="text-sm text-slate-400">Used to pre-fill checkout and price delivery by distance.</p>
                </div>
                <div className="card card-pad space-y-5">
                  <LocationPicker value={location} onChange={setLocation} />
                  <button type="button" onClick={saveLocation} disabled={savingLocation} className="btn btn-primary">{savingLocation ? 'Saving…' : 'Save location'}</button>
                </div>
              </div>
            )}

            {activeTab === 'referrals' && <ReferralPanel />}
            {activeTab === 'reviews' && <MyReviewsPanel />}

            {/* TAB 4: SUPPORT TICKETS */}
            {activeTab === 'tickets' && <SupportTicketsPanel orders={orders} onCountChange={setOpenTicketCount} />}

            {/* TAB 5: PROFILE */}
            {activeTab === 'settings' && <ProfilePanel />}
          </main>
        </div>
      </div>

      {/* Invoice Modal */}
      {selectedInvoiceOrder && (
        <InvoiceModal order={selectedInvoiceOrder} onClose={() => setSelectedInvoiceOrder(null)} />
      )}

      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};
