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
  Copy
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { InvoiceModal } from '../components/checkout/InvoiceModal';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { Order, SupportTicket } from '../types';

export const CustomerDashboardPage: React.FC = () => {
  const { user, logout, updateProfile } = useAuth();
  const { formatPrice } = useStore();
  const { wishlist, removeFromWishlist } = useWishlist();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'orders' | 'wishlist' | 'addresses' | 'tickets' | 'settings'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [referralSummary, setReferralSummary] = useState<{ referralCode: string; totalReferrals: number; verifiedReferrals: number; rewards: { couponCode: string; referralCount: number; usedCount: number; validUntil: string | null }[] } | null>(null);

  useEffect(() => {
    setProfileName(user?.name || '');
    setProfilePhone(user?.phone || '');
  }, [user]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const result = await updateProfile({ name: profileName, phone: profilePhone });
    setSavingProfile(false);
    showToast(result.success ? 'Profile updated successfully!' : (result.message || 'Unable to update profile'), result.success ? 'success' : 'error');
  };

  // New Ticket Form State
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('Product Inquiry');
  const [ticketMessage, setTicketMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  useEffect(() => {
    if (user?.email) {
      fetch('/api/auth/referrals').then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data?.success) setReferralSummary(data); }).catch(() => {});
      // Fetch customer orders — scoped server-side to the authenticated
      // session (server/routes/orderRoutes.js), the URL segment is ignored
      // for non-staff requesters.
      fetch(`/api/orders/customer/${encodeURIComponent(user.email)}`)
        .then((res) => {
          if (!res.ok) return null;
          const ct = res.headers.get('content-type');
          return ct && ct.includes('application/json') ? res.json() : null;
        })
        .then((data) => {
          if (data && data.orders) setOrders(data.orders);
        })
        .catch(() => {});

      // Fetch this customer's own tickets (staff-only /api/tickets no longer
      // works here — /mine is scoped server-side to the authenticated session).
      fetch('/api/tickets/mine')
        .then((res) => {
          if (!res.ok) return null;
          const ct = res.headers.get('content-type');
          return ct && ct.includes('application/json') ? res.json() : null;
        })
        .then((data) => {
          if (data && data.tickets) {
            setTickets(data.tickets);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;

    try {
      setIsSubmittingTicket(true);
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: user?.name || 'Customer',
          customerEmail: user?.email || 'customer@gmail.com',
          customerPhone: user?.phone || '+254 700 000 000',
          subject: ticketSubject.trim(),
          category: ticketCategory,
          message: ticketMessage.trim()
        })
      });
      const data = await res.json();
      if (data.success && data.ticket) {
        setTickets([data.ticket, ...tickets]);
        showToast(`Support Ticket ${data.ticket.ticketNumber} created!`, 'success');
        setTicketSubject('');
        setTicketMessage('');
      }
    } catch (e) {
      showToast('Could not create support ticket', 'error');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

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
              <h1 className="text-xl sm:text-2xl font-black text-white">{user?.name || 'Dennis Mwangi'}</h1>
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
          <aside className="lg:col-span-3 space-y-2">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3 space-y-1 shadow-xl">
              {[
                { id: 'orders', label: 'My Orders & Deliveries', icon: Package, count: orders.length },
                { id: 'wishlist', label: 'Saved Wishlist', icon: Heart, count: wishlist.length },
                { id: 'addresses', label: 'Saved Addresses', icon: MapPin },
                { id: 'tickets', label: 'Support & Inquiries', icon: HelpCircle, count: tickets.length },
                { id: 'settings', label: 'Account Profile', icon: UserIcon }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all ${
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
            </div>
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
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h2 className="text-lg font-bold text-white">Saved Delivery Addresses</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl p-5 space-y-2 text-xs relative shadow-lg">
                    <span className="px-2 py-0.5 bg-cyan-950 text-cyan-400 font-bold rounded text-[10px] uppercase border border-cyan-800">
                      Default Shipping Address
                    </span>
                    <div className="font-bold text-white text-sm pt-1">Dennis Mwangi</div>
                    <div className="text-slate-300">Silverstone Towers, 4th Floor Apt 4B</div>
                    <div className="text-slate-300">Argwings Kodhek Road, Kilimani</div>
                    <div className="text-cyan-300 font-semibold">Nairobi County, Kenya</div>
                    <div className="text-slate-400 font-mono pt-1">+254 759 508 348</div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: SUPPORT TICKETS */}
            {activeTab === 'tickets' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h2 className="text-lg font-bold text-white">Support Inquiries & Tickets</h2>
                </div>

                {/* Create Ticket Form */}
                <form onSubmit={handleCreateTicket} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 text-xs">
                  <h3 className="font-bold text-white text-sm">Open a New Support Ticket</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Inquiry Category:</label>
                      <select
                        value={ticketCategory}
                        onChange={(e) => setTicketCategory(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                      >
                        <option value="Product Compatibility">Product Compatibility</option>
                        <option value="Order & Delivery Status">Order & Delivery Status</option>
                        <option value="Warranty Claim">Warranty Claim</option>
                        <option value="Custom PC Assembly">Custom PC Assembly</option>
                        <option value="Payment / M-Pesa Inquiry">Payment / M-Pesa Inquiry</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Subject:</label>
                      <input
                        type="text"
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        placeholder="e.g. Compatibility check for RTX 4090 PSU"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Message:</label>
                    <textarea
                      rows={3}
                      value={ticketMessage}
                      onChange={(e) => setTicketMessage(e.target.value)}
                      placeholder="Describe your inquiry in detail..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white resize-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingTicket}
                    className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl flex items-center gap-2 shadow"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Support Ticket</span>
                  </button>
                </form>

                {/* Existing Tickets List */}
                <div className="space-y-3">
                  {tickets.map((t) => (
                    <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-cyan-400">{t.ticketNumber}</span>
                          <span className="font-bold text-white">{t.subject}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-bold border border-emerald-800">
                          {t.status}
                        </span>
                      </div>

                      {/* Messages thread */}
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        {t.messages.map((m, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl ${
                              m.sender === 'staff' ? 'bg-cyan-950/50 border border-cyan-800/40 text-cyan-100' : 'bg-slate-950 text-slate-300'
                            }`}
                          >
                            <div className="font-bold text-[11px] mb-0.5">
                              {m.sender === 'staff' ? '👨‍💻 Internext Specialist' : '👤 You'}
                            </div>
                            <p>{m.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: PROFILE SETTINGS */}
            {activeTab === 'settings' && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 text-xs animate-in fade-in duration-200">
                <h3 className="text-base font-bold text-white">Account Settings & Security</h3>
                {referralSummary && <section className="rounded-2xl border border-cyan-800/40 bg-cyan-950/20 p-4 space-y-3">
                  <div className="flex items-center gap-2"><Gift className="w-4 h-4 text-cyan-400" /><h4 className="font-bold text-white">Your referral rewards</h4></div>
                  <p className="text-slate-400">Share your code. Rewards are based on verified referrals.</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 font-mono text-sm tracking-wider text-cyan-300">{referralSummary.referralCode}</code>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/auth?ref=${referralSummary.referralCode}`)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-slate-200" aria-label="Copy referral link"><Copy className="w-3.5 h-3.5" /> Copy link</button>
                    <span className="text-slate-400">{referralSummary.totalReferrals} joined · {referralSummary.verifiedReferrals} verified</span>
                  </div>
                  {referralSummary.rewards.length > 0 && <div className="space-y-1.5"><p className="font-semibold text-slate-300">Referral reward codes</p>{referralSummary.rewards.map((reward) => <div key={reward.couponCode} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/70 px-3 py-2"><code className={`font-mono ${reward.usedCount ? 'text-slate-500 line-through' : 'text-emerald-300'}`}>{reward.couponCode}</code><span className="text-slate-500">{reward.usedCount ? 'Redeemed' : `Earned at ${reward.referralCount} verified referrals`}</span></div>)}</div>}
                </section>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1">Full Name:</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Email Address:</label>
                    <input
                      type="email"
                      defaultValue={user?.email}
                      disabled
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-400 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Phone Number:</label>
                    <input
                      type="text"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Role Permission:</label>
                    <input
                      type="text"
                      defaultValue={user?.role}
                      disabled
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-cyan-400 uppercase font-bold cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl shadow transition-colors"
                  >
                    {savingProfile ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
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
