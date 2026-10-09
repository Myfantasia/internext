import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { navigate } from '../../utils/navigation';
import { Shield, AlertTriangle, ArrowRight, LayoutDashboard } from 'lucide-react';

interface RequireRoleProps {
  allow: UserRole[];
  children: React.ReactNode;
  adminPortal?: boolean;
}

// Frontend route guard — UX only. The real security boundary is the backend
// (server/middleware/authorize.js); this just avoids rendering/flashing a
// protected page shell for a user who isn't allowed to see it.
export const RequireRole: React.FC<RequireRoleProps> = ({ allow, children, adminPortal = false }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      // Admin routes → staff portal login; customer routes → /auth
      const isAdminRoute = allow.includes('ADMIN') || allow.includes('SALES_MANAGER');
      const loginPath = isAdminRoute ? '/admin/login' : '/auth';
      navigate(`${loginPath}?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [isLoading, isAuthenticated, user, allow]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Loading your account…</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Authenticated but wrong role — show a proper 403 page
  if (!allow.includes(user.role)) {
    const isAdminAttempt = allow.includes('ADMIN') || allow.includes('SALES_MANAGER');
    const dashboardPath =
      user.role === 'ADMIN' || user.role === 'SALES_MANAGER'
        ? '/admin'
        : '/customer/dashboard';
    const dashboardLabel =
      user.role === 'ADMIN'
        ? 'Administrator Dashboard'
        : user.role === 'SALES_MANAGER'
        ? 'Sales Manager Dashboard'
        : 'My Account';

    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-slate-950 text-slate-100 px-4 py-12">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Icon */}
          <div className="w-20 h-20 rounded-3xl bg-rose-950/60 border border-rose-700/50 text-rose-400 mx-auto flex items-center justify-center">
            {isAdminAttempt ? <Shield className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-white">Access Denied</h1>
            <p className="text-slate-400">
              You don&apos;t have permission to access this area.
            </p>
          </div>

          {/* User info card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">Signed in as</div>
            <div className="font-bold text-white">{user.name}</div>
            <div className="text-sm text-slate-400">{user.email}</div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300">
              Role: {user.role.replace('_', ' ')}
            </div>
          </div>

          {isAdminAttempt && (
            <div className="bg-amber-950/30 border border-amber-700/40 rounded-xl px-4 py-3 text-sm text-amber-300">
              <p>
                <strong>This area is restricted to administrators and sales managers.</strong> If you believe this is an error, please contact your system administrator.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate(dashboardPath)}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{dashboardLabel}</span>
            </button>
            <a
              href="/"
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-all"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Go to Store</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
