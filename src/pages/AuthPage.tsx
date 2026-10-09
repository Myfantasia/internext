import React, { useState } from 'react';
import {
  Mail,
  User as UserIcon,
  Phone,
  ArrowRight,
  ShieldCheck,
  Gift,
  AlertCircle,
  Loader2,
  ExternalLink,
  Users,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { PasswordInput } from '../components/forms/PasswordInput';
import { LocationPicker } from '../components/location/LocationPicker';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { navigate } from '../utils/navigation';
import { safeReturnPath } from '../utils/session';
import { UserLocation } from '../types';

function redirectTarget(role: string): string {
  const fallback = role === 'ADMIN' || role === 'SALES_MANAGER' ? '/admin' : '/customer/dashboard';
  return safeReturnPath(new URLSearchParams(window.location.search).get('redirect'), fallback);
}

const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validKenyanPhone = (phone: string) => /^(?:254|0)?[17]\d{8}$/.test(phone.replace(/\D/g, ''));

function passwordProblems(pass: string): string[] {
  const errors: string[] = [];
  if (pass.length < 10) errors.push('at least 10 characters');
  if (!/[A-Z]/.test(pass)) errors.push('an uppercase letter');
  if (!/[a-z]/.test(pass)) errors.push('a lowercase letter');
  if (!/[0-9]/.test(pass)) errors.push('a number');
  return errors;
}

const REGISTERED_EMAIL_KEY = 'ibs-registered-email';

export const AuthPage: React.FC = () => {
  const { login, register } = useAuth();
  const { showToast } = useToast();
  const params = new URLSearchParams(window.location.search);

  const [mode, setMode] = useState<'login' | 'register'>(() => (params.has('ref') || window.location.pathname.startsWith('/register') ? 'register' : 'login'));
  const [notice, setNotice] = useState<'registered' | 'expired' | null>(() =>
    params.get('registered') === '1' ? 'registered' : params.get('reason') === 'expired' ? 'expired' : null
  );

  // Login
  const [loginEmail, setLoginEmail] = useState(() => {
    try { return sessionStorage.getItem(REGISTERED_EMAIL_KEY) || ''; } catch { return ''; }
  });
  const [loginPassword, setLoginPassword] = useState('');

  // Register
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPwd, setRegConfirmPwd] = useState('');
  const [regReferral, setRegReferral] = useState(() => params.get('ref')?.toUpperCase() || '');
  const [regTerms, setRegTerms] = useState(false);
  const [location, setLocation] = useState<UserLocation>({ county: '', town: '', addressLine: '', lat: null, lng: null, source: 'manual' });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Set when a staff account tries to sign in here: staff use the staff portal only.
  const [staffRedirect, setStaffRedirect] = useState(false);

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setError('');
    setFieldErrors({});
    setStaffRedirect(false);
    if (next === 'register') setNotice(null);
  };

  const validateRegister = (): boolean => {
    const errs: Record<string, string> = {};
    if (regName.trim().length < 2) errs.name = 'Enter your full name';
    if (!validateEmail(regEmail)) errs.email = 'Enter a valid email address';
    if (!validKenyanPhone(regPhone)) errs.phone = 'Enter a Kenyan mobile number, e.g. 0712 345 678';
    if (!location.county) errs.county = 'Choose your county';
    if (!location.town || location.town.trim().length < 2) errs.town = 'Enter your town or area';
    const pwd = passwordProblems(regPassword);
    if (pwd.length) errs.password = `Password needs ${pwd.join(', ')}`;
    if (regPassword !== regConfirmPwd) errs.confirmPwd = 'Passwords do not match';
    if (!regTerms) errs.terms = 'Please accept the terms to continue';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (mode === 'register') {
      if (!validateRegister()) {
        setError('Please fix the highlighted fields.');
        return;
      }
      setLoading(true);
      const result = await register({
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        password: regPassword,
        referralCode: regReferral.trim() || undefined,
        location: { ...location, town: location.town.trim(), addressLine: location.addressLine?.trim() || null }
      });
      setLoading(false);
      if (!result.success) {
        // A duplicate email/phone points at the exact field to change.
        if (result.field === 'email' || result.field === 'phone') setFieldErrors({ [result.field]: result.message || '' });
        setError(result.message || 'Unable to create account');
        return;
      }
      // Registration never signs in: send the customer to the login form,
      // with their email pre-filled and a clear confirmation.
      try { sessionStorage.setItem(REGISTERED_EMAIL_KEY, regEmail.trim()); } catch { /* storage unavailable */ }
      setLoginEmail(regEmail.trim());
      setLoginPassword('');
      setRegPassword('');
      setRegConfirmPwd('');
      setMode('login');
      setNotice('registered');
      navigate(`/auth?registered=1${params.get('redirect') ? `&redirect=${encodeURIComponent(params.get('redirect')!)}` : ''}`);
      return;
    }

    setLoading(true);
    const result = await login(loginEmail.trim(), loginPassword, 'store');
    setLoading(false);
    if (result.code === 'USE_STAFF_PORTAL') {
      setError('');
      setStaffRedirect(true);
      return;
    }
    if (result.success) {
      try { sessionStorage.removeItem(REGISTERED_EMAIL_KEY); } catch { /* ignore */ }
      showToast('Signed in successfully. For your security, sessions last 3 hours.', 'success');
      navigate(redirectTarget(result.user?.role || 'CUSTOMER'));
    } else {
      setError(result.message || 'Invalid email or password');
    }
  };

  const iconInput = 'field-input pl-10';

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100">
      <Header currentPath="/auth" />

      <main className="flex-1 w-full px-4 py-8 sm:py-12">
        <div className={`mx-auto w-full ${mode === 'register' ? 'max-w-2xl' : 'max-w-md'} transition-[max-width] duration-300`}>
          <div className="card card-pad shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 mx-auto flex items-center justify-center">
                <ShieldCheck className="w-7 h-7" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-black text-white">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
              <p className="text-sm text-slate-400">
                {mode === 'login' ? 'Sign in to view orders, track deliveries and earn referral rewards.' : 'Faster checkout, order tracking and accurate delivery pricing.'}
              </p>
            </div>

            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-sm font-bold gap-1" role="tablist" aria-label="Sign in or register">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-2.5 rounded-lg transition-colors ${mode === m ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-100'}`}
                >
                  {m === 'login' ? 'Sign in' : 'Register'}
                </button>
              ))}
            </div>

            {notice === 'registered' && mode === 'login' && (
              <div className="callout callout-success" role="status">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p><strong>Account created.</strong> Sign in below to continue. We've also emailed you a link to verify your address.</p>
              </div>
            )}
            {notice === 'expired' && mode === 'login' && (
              <div className="callout callout-warning" role="status">
                <Clock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p><strong>Your session expired.</strong> For your security, sign-ins last 3 hours. Please sign in again to continue where you left off.</p>
              </div>
            )}

            {staffRedirect && mode === 'login' && (
              <div className="callout callout-warning flex-col sm:flex-row sm:items-center justify-between gap-3" role="alert">
                <p><strong>This is a staff account.</strong> Staff members sign in through the Staff Portal, not the customer sign-in.</p>
                <a href={`/admin/login${loginEmail ? `?email=${encodeURIComponent(loginEmail.trim())}` : ''}`} className="btn btn-primary btn-sm shrink-0">Go to Staff Portal</a>
              </div>
            )}

            {error && (
              <div className="callout callout-danger" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            {mode === 'login' && (
              <div className="callout callout-warning justify-between flex-wrap">
                <span className="flex items-center gap-2"><Users className="w-4 h-4 shrink-0" aria-hidden="true" />Staff member or admin?</span>
                <a href="/admin/login" className="flex items-center gap-1 font-bold underline-offset-2 hover:underline">Staff portal <ExternalLink className="w-3 h-3" aria-hidden="true" /></a>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {mode === 'login' && (
                <>
                  <div>
                    <label htmlFor="login-email" className="field-label">Email address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                      <input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@example.com" className={iconInput} required autoComplete="email" />
                    </div>
                  </div>
                  <div>
                    <PasswordInput
                      label="Password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Your password"
                      required
                      autoComplete="current-password"
                    />
                    <div className="mt-2 flex justify-end">
                      <a href="/auth/forgot-password" className="text-xs font-semibold text-cyan-400 hover:underline">Forgot password?</a>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" aria-hidden="true" />You'll stay signed in for up to 3 hours.</p>
                </>
              )}

              {mode === 'register' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label htmlFor="reg-name" className="field-label">Full name <span className="text-rose-400">*</span></label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input id="reg-name" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="e.g. Wanjiku Kamau" className={`${iconInput} ${fieldErrors.name ? 'field-input-error' : ''}`} aria-invalid={!!fieldErrors.name} autoComplete="name" required />
                      </div>
                      {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
                    </div>
                    <div>
                      <label htmlFor="reg-email" className="field-label">Email address <span className="text-rose-400">*</span></label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input id="reg-email" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="you@example.com" className={`${iconInput} ${fieldErrors.email ? 'field-input-error' : ''}`} aria-invalid={!!fieldErrors.email} autoComplete="email" required />
                      </div>
                      {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
                    </div>
                    <div>
                      <label htmlFor="reg-phone" className="field-label">Mobile number <span className="text-rose-400">*</span></label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input id="reg-phone" type="tel" inputMode="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="0712 345 678" className={`${iconInput} font-mono ${fieldErrors.phone ? 'field-input-error' : ''}`} aria-invalid={!!fieldErrors.phone} autoComplete="tel" required />
                      </div>
                      {fieldErrors.phone ? <p className="field-error">{fieldErrors.phone}</p> : <p className="field-hint">Used for M-Pesa payments and rider calls.</p>}
                    </div>
                  </div>

                  <div className="pt-1">
                    <h2 className="text-sm font-bold text-white mb-3">Delivery location</h2>
                    <LocationPicker
                      value={location}
                      onChange={setLocation}
                      errors={{ county: fieldErrors.county, town: fieldErrors.town }}
                      purpose="We use your location only to price and route deliveries (distance from our Nairobi office). You can change it at checkout or in your account."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PasswordInput
                      label="Password"
                      toggleLabel="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="At least 10 characters"
                      error={fieldErrors.password}
                      hint="10+ characters with upper & lower case and a number"
                      required
                      autoComplete="new-password"
                    />
                    <PasswordInput
                      label="Confirm password"
                      toggleLabel="password confirmation"
                      value={regConfirmPwd}
                      onChange={(e) => setRegConfirmPwd(e.target.value)}
                      placeholder="Re-enter your password"
                      error={fieldErrors.confirmPwd}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-ref" className="field-label">Referral code <span className="font-normal text-slate-500">(optional)</span></label>
                    <div className="relative">
                      <Gift className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                      <input id="reg-ref" value={regReferral} onChange={(e) => setRegReferral(e.target.value.toUpperCase())} placeholder="IN-XXXXXXXX" className={`${iconInput} font-mono tracking-wider`} autoComplete="off" />
                    </div>
                    <p className="field-hint">Referral codes are valid for 3 hours after your friend generates them.</p>
                  </div>

                  <div className={`rounded-xl border p-3 ${fieldErrors.terms ? 'border-rose-700 bg-rose-950/20' : 'border-slate-800 bg-slate-950/40'}`}>
                    <label className="flex items-start gap-3 cursor-pointer text-sm text-slate-300">
                      <input type="checkbox" checked={regTerms} onChange={(e) => setRegTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--t-accent-600)]" />
                      <span>
                        I agree to the <a href="/policies/terms" className="text-cyan-400 underline">Terms &amp; Conditions</a> and <a href="/policies/privacy" className="text-cyan-400 underline">Privacy Policy</a>
                      </span>
                    </label>
                    {fieldErrors.terms && <p className="field-error ml-7">{fieldErrors.terms}</p>}
                  </div>

                  <p className="text-xs text-slate-500">
                    Joining as staff? Use the <a href="/admin/signup" className="text-cyan-400 underline">staff registration</a> page with the code from your administrator.
                  </p>
                </>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Please wait…</> : <>{mode === 'login' ? 'Sign in' : 'Create my account'} <ArrowRight className="w-4 h-4" aria-hidden="true" /></>}
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
