import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertTriangle,
  Briefcase,
  ExternalLink,
  Loader2,
  CheckCircle2,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const AdminAuthPage: React.FC = () => {
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loggedInRole, setLoggedInRole] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      const role = result.user?.role;
      if (role === 'ADMIN' || role === 'SALES_MANAGER') {
        setLoggedInRole(role);
        showToast(`Welcome back! Signing you in as ${role === 'ADMIN' ? 'Administrator' : 'Sales Manager'}…`, 'success');
        setTimeout(() => {
          window.location.href = '/admin';
        }, 1200);
      } else {
        // Authenticated but not staff — reject
        setError('Access denied. This portal is for authorized staff only. Please use the customer sign-in.');
      }
    } else {
      setError(result.message || 'Access denied. Invalid credentials or insufficient permissions.');
    }

    setLoading(false);
  };

  const inputBase =
    'w-full bg-slate-950 border border-slate-700 rounded-xl pl-11 pr-11 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all';

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-amber-600 selection:text-white">
      {/* Minimal top bar */}
      <header className="bg-[#070b18] border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
          <Shield className="w-5 h-5 text-amber-400" />
          <span className="font-black text-sm tracking-tight">Internext Business System</span>
        </a>
        <a
          href="/"
          className="text-xs text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1.5"
        >
          <ExternalLink className="w-3 h-3" />
          <span className="hidden sm:inline">Back to Storefront</span>
        </a>
      </header>

      <main className="flex-1 flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          {/* Warning Banner */}
          <div className="bg-amber-950/40 border border-amber-700/50 rounded-2xl px-5 py-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-bold text-sm">Restricted Access</p>
              <p className="text-amber-400/80 text-xs mt-0.5 leading-relaxed">
                This portal is for authorized staff only. All sign-in attempts are logged and monitored.
                Unauthorized access attempts may result in account suspension.
              </p>
            </div>
          </div>

          {/* Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-7 sm:p-9 shadow-2xl space-y-7">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-amber-950/60 border border-amber-700/50 text-amber-400 mx-auto flex items-center justify-center shadow-lg">
                <Briefcase className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-black text-white">Staff Portal</h1>
              <p className="text-sm text-slate-400">
                Authorized personnel — Administrators & Sales Managers
              </p>
            </div>

            {/* Role Success Banner */}
            {loggedInRole && (
              <div className="bg-emerald-950/60 border border-emerald-700/50 rounded-xl px-4 py-3.5 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-emerald-300 font-bold text-sm">
                    {loggedInRole === 'ADMIN' ? '🛡️ Administrator' : '📊 Sales Manager'} Access Granted
                  </p>
                  <p className="text-emerald-400/80 text-xs mt-0.5">Redirecting to dashboard…</p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-rose-950/50 border border-rose-800/60 text-rose-300 text-sm rounded-xl px-4 py-3 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            {!loggedInRole && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Work Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-4" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="staff@internextbusinesssystem.co.ke"
                      className={inputBase}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-4" />
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••"
                      className={inputBase}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setRememberMe((v) => !v)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${
                      rememberMe ? 'bg-amber-500 border-amber-500' : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    {rememberMe && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-slate-400 select-none">Keep me signed in on this device</span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-60 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-amber-600/30 transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authenticating…</span>
                    </>
                  ) : (
                    <>
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Access Staff Dashboard</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Footer note */}
            <div className="pt-4 border-t border-slate-800 text-center space-y-2">
              <p className="text-xs text-slate-500">
                Not a staff member?{' '}
                <a href="/auth" className="text-cyan-400 hover:text-cyan-300 font-semibold">
                  Shop & sign in here →
                </a>
              </p>
              <p className="text-[10px] text-slate-600">
                Need access? <a href="/admin/signup" className="text-cyan-400 hover:text-cyan-300">Register with a staff code</a> or contact your system administrator.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
