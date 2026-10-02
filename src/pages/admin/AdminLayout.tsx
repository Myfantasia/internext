import React from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Boxes,
  Tag,
  Users,
  Star,
  HelpCircle,
  FileText,
  Settings as SettingsIcon,
  ExternalLink,
  LogOut,
  Sun,
  Moon,
  FolderTree,
  Award,
  Newspaper,
  Mail,
  UserPlus,
  Gift
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Logo } from '../../components/common/Logo';

interface AdminLayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
}

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }]
  },
  {
    label: 'Catalog',
    items: [
      { id: 'products', label: 'Products', icon: Package },
      { id: 'categories', label: 'Categories', icon: FolderTree },
      { id: 'brands', label: 'Brands', icon: Award },
      { id: 'inventory', label: 'Inventory', icon: Boxes }
    ]
  },
  {
    label: 'Commerce',
    items: [
      { id: 'orders', label: 'Orders', icon: ShoppingCart },
      { id: 'customers', label: 'Customers', icon: Users }
    ]
  },
  {
    label: 'Marketing & Content',
    items: [
      { id: 'coupons', label: 'Promotions', icon: Tag },
      { id: 'referrals', label: 'Referral Rewards', icon: Gift, adminOnly: true },
      { id: 'blog', label: 'Blog', icon: Newspaper, adminOnly: true },
      { id: 'reviews', label: 'Reviews', icon: Star },
      { id: 'newsletter', label: 'Newsletter', icon: Mail, adminOnly: true }
    ]
  },
  {
    label: 'Support',
    items: [{ id: 'support', label: 'Tickets', icon: HelpCircle }]
  },
  {
    label: 'Administration',
    items: [
      { id: 'staff', label: 'Staff Invites', icon: UserPlus, adminOnly: true },
      { id: 'audit', label: 'Audit Logs', icon: FileText, adminOnly: true },
      { id: 'settings', label: 'Store Settings', icon: SettingsIcon, adminOnly: true }
    ]
  }
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({ activeTab, setActiveTab, children }) => {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || isAdmin)
  })).filter((group) => group.items.length > 0);

  const flatItems = groups.flatMap((g) => g.items);
  const activeItem = flatItems.find((item) => item.id === activeTab);

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 hidden md:flex">
        <div className="p-5 border-b border-slate-800 space-y-3">
          <a href="/" className="flex items-center gap-2.5">
            <Logo size={32} titleClassName="text-white text-sm" taglineClassName="text-cyan-400 !text-[9px]" />
          </a>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2.5">
            <img
              src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'}
              alt=""
              className="w-7 h-7 rounded-lg object-cover ring-1 ring-cyan-500"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{user?.name || 'Super Admin'}</div>
              <div className="text-[10px] text-amber-400 font-mono uppercase">{user?.role?.replace('_', ' ')}</div>
            </div>
          </div>
        </div>

        <nav className="p-3 overflow-y-auto flex-1 space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2 text-xs">
          <a
            href="/"
            className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-colors"
          >
            <span>Live Storefront</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 text-rose-400 hover:bg-rose-950/30 rounded-xl font-bold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-lg px-3 py-2 max-w-[180px]"
              >
                {groups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="hidden md:block min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Admin console</div>
              <div className="text-sm font-bold text-white truncate">{activeItem?.label || 'Dashboard'}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline font-bold">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-cyan-400" />
                  <span className="hidden sm:inline font-bold">Dark</span>
                </>
              )}
            </button>

            <span className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>API & M-Pesa Online</span>
            </span>

            <a
              href="/"
              className="px-3 py-1.5 bg-slate-800 hover:bg-cyan-600 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors"
            >
              <span>Storefront</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </header>

        <main className="p-6 sm:p-8 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};
