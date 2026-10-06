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
import { ProfilePanel } from '../../components/account/ProfilePanel';
import { useAuth } from '../../context/AuthContext';

export const AdminPage: React.FC = () => {
  const { isAdmin } = useAuth();
  // Keep the open section in the URL (?tab=…) so refresh and Back work, and
  // so a login redirect returns to the same section.
  const [activeTab, setActiveTabState] = useState<string>(() => new URLSearchParams(window.location.search).get('tab') || 'dashboard');
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    window.history.replaceState({}, '', tab === 'dashboard' ? '/admin' : `/admin?tab=${encodeURIComponent(tab)}`);
    // Each section opens at its top, not wherever the previous one was scrolled to.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  };

  return (
    <AdminLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && <AdminDashboard onNavigate={setActiveTab} />}
      {activeTab === 'products' && <AdminProducts />}
      {activeTab === 'categories' && <AdminCategories />}
      {activeTab === 'brands' && <AdminBrands />}
      {activeTab === 'orders' && <AdminOrders />}
      {activeTab === 'inventory' && <AdminInventory />}
      {activeTab === 'coupons' && <AdminCoupons />}
      {activeTab === 'referrals' && <AdminReferralRewards />}
      {activeTab === 'customers' && <AdminCustomers />}
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
    </AdminLayout>
  );
};
