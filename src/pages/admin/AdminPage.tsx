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

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

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
      {activeTab === 'settings' && <AdminSettings />}
    </AdminLayout>
  );
};
