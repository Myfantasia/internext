import React, { useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { AdminDashboard } from './AdminDashboard';
import { AdminProducts } from './AdminProducts';
import { AdminOrders } from './AdminOrders';
import { AdminInventory } from './AdminInventory';
import { AdminCoupons } from './AdminCoupons';
import { AdminCustomers } from './AdminCustomers';
import { AdminReviews } from './AdminReviews';
import { AdminSupport } from './AdminSupport';
import { AdminAuditLogs } from './AdminAuditLogs';
import { AdminSettings } from './AdminSettings';
import { AdminCategories } from './AdminCategories';
import { AdminBrands } from './AdminBrands';
import { AdminBlog } from './AdminBlog';
import { AdminNewsletter } from './AdminNewsletter';
import { AdminStaff } from './AdminStaff';
import { AdminReferralRewards } from './AdminReferralRewards';
import { AdminFlashDeals } from './AdminFlashDeals';
import { AdminDelivery } from './AdminDelivery';
import { AdminNews } from './AdminNews';
import { AdminPayments } from './AdminPayments';
import { AdminFinance } from './AdminFinance';
import { AdminPOS } from './AdminPOS';
import { ProfilePanel } from '../../components/account/ProfilePanel';
import { useAuth } from '../../context/AuthContext';

export const AdminPage: React.FC = () => {
  const { isAdmin } = useAuth();
  // Keep the open section in the URL (?tab=…) so refresh and Back work, and
  // so a login redirect returns to the same section.
  const [activeTab, setActiveTabState] = useState<string>(() => new URLSearchParams(window.location.search).get('tab') || 'dashboard');
  // Remounts the section on every navigation so URL presets are re-read.
  const [visit, setVisit] = useState(0);
  // `params` travel in the URL so the opened section can pre-filter itself,
  // e.g. openTab('products', { categoryId }) from a category's detail panel.
  const setActiveTab = (tab: string, params?: Record<string, string>) => {
    const qs = new URLSearchParams(tab === 'dashboard' ? {} : { tab, ...(params || {}) }).toString();
    window.history.replaceState({}, '', qs ? `/admin?${qs}` : '/admin');
    setActiveTabState(tab);
    setVisit((v) => v + 1);
    // Each section opens at its top, not wherever the previous one was scrolled to.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  };

  return (
    <AdminLayout activeTab={activeTab} setActiveTab={(tab) => setActiveTab(tab)}>
      <React.Fragment key={visit}>
      {activeTab === 'dashboard' && <AdminDashboard onNavigate={setActiveTab} />}
      {activeTab === 'products' && <AdminProducts />}
      {activeTab === 'categories' && <AdminCategories onNavigate={setActiveTab} />}
      {activeTab === 'brands' && <AdminBrands onNavigate={setActiveTab} />}
      {activeTab === 'orders' && <AdminOrders />}
      {activeTab === 'inventory' && <AdminInventory />}
      {activeTab === 'coupons' && <AdminCoupons />}
      {activeTab === 'referrals' && <AdminReferralRewards />}
      {activeTab === 'customers' && <AdminCustomers onNavigate={setActiveTab} />}
      {activeTab === 'reviews' && <AdminReviews />}
      {activeTab === 'blog' && <AdminBlog />}
      {activeTab === 'newsletter' && <AdminNewsletter />}
      {activeTab === 'support' && <AdminSupport />}
      {activeTab === 'staff' && <AdminStaff />}
      {activeTab === 'audit' && <AdminAuditLogs />}
      {activeTab === 'settings' && isAdmin && <AdminSettings />}
      {activeTab === 'flash-deals' && <AdminFlashDeals />}
      {activeTab === 'delivery' && <AdminDelivery />}
      {activeTab === 'news' && <AdminNews />}
      {activeTab === 'payments' && <AdminPayments />}
      {activeTab === 'profile' && <ProfilePanel />}
      {activeTab === 'finance' && <AdminFinance onNavigate={setActiveTab} />}
      {activeTab === 'pos' && <AdminPOS />}
      </React.Fragment>
    </AdminLayout>
  );
};
