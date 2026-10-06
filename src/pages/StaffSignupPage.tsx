import React, { useEffect, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, KeyRound, Loader2, Mail, Phone, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PasswordInput } from '../components/forms/PasswordInput';
import { navigate } from '../utils/navigation';

export const StaffSignupPage: React.FC = () => {
  const { registerStaff } = useAuth();
  const [firstAdminAvailable, setFirstAdminAvailable] = useState<boolean | null>(null);
  const [bootstrapEmailRequired, setBootstrapEmailRequired] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/staff-signup-status')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        setFirstAdminAvailable(data?.success ? !!data.firstAdminAvailable : false);
        setBootstrapEmailRequired(!!data?.bootstrapEmailRequired);
      })
      .catch(() => { setFirstAdminAvailable(false); setBootstrapEmailRequired(true); });
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Use at least 10 characters, including uppercase, lowercase, and a number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    if (!firstAdminAvailable && !invitationCode.trim()) {
      setError('Enter the single-use signup code provided by an administrator.');
      return;
    }
    setLoading(true);
    const result = await registerStaff(name.trim(), email.trim(), phone.trim(), password, invitationCode.trim() || undefined);
    setLoading(false);
    if (!result.success) { setError(result.message || 'Unable to create this staff account.'); return; }
    // Accounts are created signed-out: the new staff member signs in explicitly.
    try { sessionStorage.setItem('ibs-registered-email', email.trim()); } catch { /* storage unavailable */ }
    navigate('/admin/login?registered=1');
  };

  return <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
    <header className="border-b border-slate-800 bg-slate-900 px-4 py-4 flex items-center justify-between">
      <a href="/" className="font-bold text-white">Internext Business System</a>
      <a href="/admin/login" className="text-sm text-cyan-400 hover:text-cyan-300">Staff sign in</a>
    </header>
    <main className="flex-1 grid place-items-center p-4 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-9 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-cyan-800/60 bg-cyan-950/70 text-cyan-300"><BriefcaseBusiness className="h-7 w-7" /></div>
          <h1 className="text-2xl font-bold text-white">Staff registration</h1>
          {firstAdminAvailable === null ? <p className="text-sm text-slate-400">Checking administrator setup…</p> : bootstrapEmailRequired
            ? <p className="text-sm text-amber-300">First-admin setup needs the server owner to set ADMIN_EMAIL before registration can continue.</p>
            : firstAdminAvailable
              ? <p className="text-sm text-slate-400">Create the first administrator account. No signup code is needed; the email must match the server’s ADMIN_EMAIL setting.</p>
              : <p className="text-sm text-slate-400">Staff registration is invitation-only. Ask an administrator for your email-bound, single-use code.</p>}
        </div>
        {error && <div role="alert" className="rounded-xl border border-rose-800/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{error}</div>}
        {firstAdminAvailable !== null && !bootstrapEmailRequired && <form onSubmit={handleSubmit} className="space-y-4">
          {firstAdminAvailable === false && <div className="relative"><KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" /><input value={invitationCode} onChange={(e) => setInvitationCode(e.target.value.toUpperCase())} className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 font-mono text-sm tracking-wider text-white" placeholder="IBS-XXXX-XXXX-XXXX" required autoComplete="one-time-code" /></div>}
          <div className="relative"><UserRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" /><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white" placeholder="Full name" minLength={2} required /></div>
          <div className="relative"><Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white" placeholder="Work email" required autoComplete="email" /></div>
          <div className="relative"><Phone className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" /><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white" placeholder="Phone (optional, e.g. 0712 345 678)" autoComplete="tel" /></div>
          <PasswordInput
            label="New password"
            toggleLabel="new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 10 characters"
            hint="10+ characters with upper & lower case and a number"
            required
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm password"
            toggleLabel="password confirmation"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter the password"
            error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}
            required
            autoComplete="new-password"
          />
          <button type="submit" disabled={loading || firstAdminAvailable === null} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3.5 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-50">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</> : <>Create staff account <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>}
        {firstAdminAvailable && <p className="text-xs leading-relaxed text-amber-300/80">The no-code setup closes as soon as the first administrator is created. A verification email will be sent to the address above.</p>}
      </section>
    </main>
  </div>;
};
