import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Calendar,
  MapPin,
  Gift,
  AlertCircle,
  Loader2,
  CheckSquare,
  ChevronDown,
  ExternalLink,
  Users
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { navigate } from '../utils/navigation';

function redirectTarget(role: string): string {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('redirect');
  if (requested && requested.startsWith('/')) return requested;
  if (role === 'ADMIN') return '/admin';
  if (role === 'SALES_MANAGER') return '/admin';
  return '/customer/dashboard';
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(pass: string): string[] {
  const errors: string[] = [];
  if (pass.length < 10) errors.push('At least 10 characters');
  if (!/[A-Z]/.test(pass)) errors.push('One uppercase letter');
  if (!/[a-z]/.test(pass)) errors.push('One lowercase letter');
  if (!/[0-9]/.test(pass)) errors.push('One number');
  return errors;
}

export const AuthPage: React.FC = () => {
  const { login, register } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>(() => new URLSearchParams(window.location.search).has('ref') ? 'register' : 'login');

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDob, setRegDob] = useState('');
  const [regGender, setRegGender] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPwd, setRegConfirmPwd] = useState('');
  const [regReferral, setRegReferral] = useState(() => new URLSearchParams(window.location.search).get('ref')?.toUpperCase() || '');
  const [regTerms, setRegTerms] = useState(false);
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [showRegConfirmPwd, setShowRegConfirmPwd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateRegister = (): boolean => {
    const errs: Record<string, string> = {};
    if (regName.trim().length < 2) errs.name = 'Full name must be at least 2 characters';
    if (!validateEmail(regEmail)) errs.email = 'Enter a valid email address';
    if (regPhone.trim().length < 9) errs.phone = 'Enter a valid phone number (min 9 digits)';
    if (!regCity.trim()) errs.city = 'City/County is required';
    const pwdErrors = validatePassword(regPassword);
    if (pwdErrors.length > 0) errs.password = 'Password needs: ' + pwdErrors.join(', ');
    if (regPassword !== regConfirmPwd) errs.confirmPwd = 'Passwords do not match';
    if (!regTerms) errs.terms = 'You must accept the terms and conditions';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (mode === 'register' && !validateRegister()) return;

    setLoading(true);

    if (mode === 'login') {
      const result = await login(loginEmail, loginPassword);
      if (result.success) {
        showToast('Signed in successfully!', 'success');
        window.location.href = redirectTarget(result.user?.role || 'CUSTOMER');
      } else {
        setError(result.message || 'Invalid email or password');
      }
    } else {
      const result = await register(regName, regEmail, regPhone, regPassword, regReferral || undefined);
      if (result.success) {
        showToast('Account created! Please check your email to verify your account.', 'success');
        window.location.href = '/customer/dashboard';
      } else {
        setError(result.message || 'Unable to create account');
      }
    }
    setLoading(false);
  };

  const inputBase =
    'w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all';

  const inputError = (field: string) =>
    fieldErrors[field] ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : '';

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/auth" />

      <main className="flex-1 w-full px-4 py-10 flex flex-col justify-center">
        <div className="max-w-lg mx-auto w-full">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-7 sm:p-9 shadow-2xl space-y-7">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 mx-auto flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-black text-white">
                {mode === 'login' ? 'Welcome Back' : 'Create Your Account'}
              </h2>
              <p className="text-sm text-slate-400">
                {mode === 'login'
                  ? 'Sign in to access your orders, wishlist, and account'
                  : 'Join Internext Business System for faster checkout & order tracking'}
              </p>
            </div>

            {/* Mode Switch Tabs */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-sm font-bold gap-1">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setFieldErrors({}); }}
                className={`flex-1 py-2.5 rounded-lg transition-all ${
                  mode === 'login' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); setFieldErrors({}); }}
                className={`flex-1 py-2.5 rounded-lg transition-all ${
                  mode === 'register' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                }`}
              >
                Register
              </button>
            </div>

            {/* Global Error */}
            {error && (
              <div className="bg-rose-950/50 border border-rose-800/60 text-rose-300 text-sm rounded-xl px-4 py-3 flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Staff Notice */}
            {mode === 'login' && (
              <div className="bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Are you a staff member or admin?</span>
                </div>
                <a
                  href="/admin/login"
                  className="flex items-center gap-1 font-bold text-amber-400 hover:text-amber-300 whitespace-nowrap"
                >
                  Staff Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {mode === 'register' && (
              <div className="bg-slate-800/60 border border-slate-700/60 text-slate-400 text-xs rounded-xl px-4 py-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-slate-500" />
                <span>
                  <strong className="text-slate-300">Staff/Admin?</strong> Register with your administrator’s signup code, or complete the one-time setup if no administrator exists.{' '}
                  <a href="/admin/signup" className="text-cyan-400 underline">Open staff registration</a>
                </span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* ============== SIGN IN FIELDS ============== */}
              {mode === 'login' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-4" />
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={inputBase}
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-semibold text-slate-300">Password</label>
                      <a href="/auth/forgot-password" className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold">
                        Forgot password?
                      </a>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-4" />
                      <input
                        type={showLoginPwd ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••••"
                        className={`${inputBase} pr-11`}
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPwd((v) => !v)}
                        className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showLoginPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setRememberMe((v) => !v)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${
                        rememberMe ? 'bg-cyan-600 border-cyan-600' : 'border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      {rememberMe && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-slate-400 select-none">Keep me signed in</span>
                  </label>
                </>
              )}

              {/* ============== REGISTER FIELDS ============== */}
              {mode === 'register' && (
                <>
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">Full Name <span className="text-rose-400">*</span></label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-4" />
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. Dennis Mwangi"
                        className={`${inputBase} ${inputError('name')}`}
                        required
                        minLength={2}
                      />
                    </div>
                    {fieldErrors.name && <p className="text-rose-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.name}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">Email Address <span className="text-rose-400">*</span></label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-4" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={`${inputBase} ${inputError('email')}`}
                        required
                        autoComplete="email"
                      />
                    </div>
                    {fieldErrors.email && <p className="text-rose-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.email}</p>}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">Phone Number (Kenya) <span className="text-rose-400">*</span></label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-4" />
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+254 712 345 678"
                        className={`${inputBase} font-mono ${inputError('phone')}`}
                      />
                    </div>
                    {fieldErrors.phone && <p className="text-rose-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.phone}</p>}
                  </div>

                  {/* DOB + Gender row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-1.5">Date of Birth</label>
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-4" />
                        <input
                          type="date"
                          value={regDob}
                          onChange={(e) => setRegDob(e.target.value)}
                          className={inputBase}
                          max={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-1.5">Gender</label>
                      <div className="relative">
                        <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3.5 top-4 pointer-events-none" />
                        <select
                          value={regGender}
                          onChange={(e) => setRegGender(e.target.value)}
                          className={`${inputBase} pr-9 appearance-none cursor-pointer`}
                        >
                          <option value="">Select...</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* City/County */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">City / County <span className="text-rose-400">*</span></label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-4" />
                      <input
                        type="text"
                        value={regCity}
                        onChange={(e) => setRegCity(e.target.value)}
                        placeholder="e.g. Nairobi, Mombasa, Kisumu"
                        className={`${inputBase} ${inputError('city')}`}
                        required
                      />
                    </div>
                    {fieldErrors.city && <p className="text-rose-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.city}</p>}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">Password <span className="text-rose-400">*</span></label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-4" />
                      <input
                        type={showRegPwd ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min. 10 characters"
                        className={`${inputBase} pr-11 ${inputError('password')}`}
                        required
                        minLength={10}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPwd((v) => !v)}
                        className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showRegPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.password ? (
                      <p className="text-rose-400 text-xs mt-1.5 flex items-start gap-1"><AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />{fieldErrors.password}</p>
                    ) : (
                      <p className="text-slate-500 text-xs mt-1.5">Min. 10 chars with uppercase, lowercase, and a number</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">Confirm Password <span className="text-rose-400">*</span></label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-4" />
                      <input
                        type={showRegConfirmPwd ? 'text' : 'password'}
                        value={regConfirmPwd}
                        onChange={(e) => setRegConfirmPwd(e.target.value)}
                        placeholder="Re-enter your password"
                        className={`${inputBase} pr-11 ${inputError('confirmPwd')}`}
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPwd((v) => !v)}
                        className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showRegConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.confirmPwd && <p className="text-rose-400 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.confirmPwd}</p>}
                  </div>

                  {/* Referral Code (optional) */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1.5">Referral Code <span className="text-slate-500 font-normal">(optional)</span></label>
                    <div className="relative">
                      <Gift className="w-4 h-4 text-slate-500 absolute left-3.5 top-4" />
                      <input
                        type="text"
                        value={regReferral}
                        onChange={(e) => setRegReferral(e.target.value.toUpperCase())}
                        placeholder="e.g. REF-ABC123"
                        className={`${inputBase} font-mono tracking-wider`}
                      />
                    </div>
                  </div>

                  {/* Terms Checkbox */}
                  <div className={`p-3 rounded-xl border ${fieldErrors.terms ? 'border-rose-700 bg-rose-950/20' : 'border-slate-800 bg-slate-950/40'}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <div
                        onClick={() => setRegTerms((v) => !v)}
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                          regTerms ? 'bg-cyan-600 border-cyan-600' : `border-slate-600 hover:border-slate-500`
                        }`}
                      >
                        {regTerms && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm text-slate-300 leading-snug">
                        I agree to the{' '}
                        <a href="/policies/terms" className="text-cyan-400 underline hover:text-cyan-300">Terms & Conditions</a>{' '}
                        and{' '}
                        <a href="/policies/privacy" className="text-cyan-400 underline hover:text-cyan-300">Privacy Policy</a>
                      </span>
                    </label>
                    {fieldErrors.terms && <p className="text-rose-400 text-xs mt-1.5 ml-8 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fieldErrors.terms}</p>}
                  </div>
                </>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-60 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-cyan-600/30 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Please wait…</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Sign In to Account' : 'Create My Account'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};
