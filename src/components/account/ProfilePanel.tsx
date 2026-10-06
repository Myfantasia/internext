import React, { useEffect, useRef, useState } from 'react';
import {
  Camera, Loader2, Mail, Phone, UserRound, ShieldCheck, BadgeCheck, AlertTriangle, KeyRound, LogOut, Trash2, Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PasswordInput } from '../forms/PasswordInput';

// One "My profile" page for every account type — customers in My Account,
// admins and sales managers in the staff console. Everything here acts on the
// signed-in user only; the server scopes each call to the session.

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Administrator', SALES_MANAGER: 'Sales Manager', CUSTOMER: 'Customer' };

const validKenyanPhone = (phone: string) => /^(?:254|0)?[17]\d{8}$/.test(phone.replace(/\D/g, ''));
// 254712345678 -> 0712 345 678 for display/editing.
const displayPhone = (phone?: string | null) => {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  const local = d.startsWith('254') ? `0${d.slice(3)}` : d;
  return local.length === 10 ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : phone;
};
const initials = (name?: string) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');

function passwordProblems(pass: string): string[] {
  const errors: string[] = [];
  if (pass.length < 10) errors.push('at least 10 characters');
  if (!/[A-Z]/.test(pass)) errors.push('an uppercase letter');
  if (!/[a-z]/.test(pass)) errors.push('a lowercase letter');
  if (!/[0-9]/.test(pass)) errors.push('a number');
  return errors;
}

const Section: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; description?: string; children: React.ReactNode }> = ({ icon: Icon, title, description, children }) => (
  <section className="card card-pad space-y-5">
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 grid place-items-center shrink-0"><Icon className="w-4 h-4" /></div>
      <div className="min-w-0">
        <h3 className="text-base font-bold text-white">{title}</h3>
        {description && <p className="text-sm text-slate-400 mt-0.5">{description}</p>}
      </div>
    </div>
    {children}
  </section>
);

export const ProfilePanel: React.FC = () => {
  const { user, updateProfile, changePassword, changeEmail, logoutAllDevices, sessionExpiresAt } = useAuth();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  // Personal details
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(displayPhone(user?.phone));
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [savingDetails, setSavingDetails] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Email
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setPhone(displayPhone(user?.phone));
  }, [user?.name, user?.phone]);

  if (!user) return null;
  const isCustomer = user.role === 'CUSTOMER';
  const detailsChanged = name.trim() !== (user.name || '') || phone.replace(/\D/g, '') !== displayPhone(user.phone).replace(/\D/g, '');

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = 'Enter your full name';
    if (phone.trim() ? !validKenyanPhone(phone) : isCustomer) errs.phone = 'Enter a Kenyan mobile number, e.g. 0712 345 678';
    setDetailErrors(errs);
    if (Object.keys(errs).length) return;
    setSavingDetails(true);
    const result = await updateProfile({ name: name.trim(), phone: phone.trim() });
    setSavingDetails(false);
    if (result.success) showToast('Profile updated', 'success');
    else {
      if (result.field === 'phone') setDetailErrors({ phone: result.message || '' });
      showToast(result.message || 'Could not update your profile', 'error');
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith('image/')) { showToast('Choose a JPG, PNG, WebP or GIF image', 'error'); return; }
    if (file.size > 3 * 1024 * 1024) { showToast('Profile photos must be 3 MB or smaller', 'error'); return; }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('image', file);
      const res = await fetch('/api/uploads/avatar', { method: 'POST', body });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) { showToast(data?.message || 'Upload failed', 'error'); return; }
      const result = await updateProfile({ avatar: data.url });
      showToast(result.success ? 'Profile photo updated' : (result.message || 'Could not save photo'), result.success ? 'success' : 'error');
    } catch {
      showToast('Could not upload the photo. Check your connection.', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAvatar = async () => {
    const result = await updateProfile({ avatar: '' });
    showToast(result.success ? 'Profile photo removed' : (result.message || 'Could not remove photo'), result.success ? 'info' : 'error');
  };

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) { setEmailError('Enter a valid email address'); return; }
    if (!emailPassword) { setEmailError('Enter your current password to confirm'); return; }
    setSavingEmail(true);
    const result = await changeEmail(newEmail.trim(), emailPassword);
    setSavingEmail(false);
    if (result.success) {
      showToast(result.message || 'Email updated', 'success');
      setNewEmail('');
      setEmailPassword('');
    } else setEmailError(result.message || 'Could not change your email');
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.current = 'Enter your current password';
    const problems = passwordProblems(newPassword);
    if (problems.length) errs.next = `Use ${problems.join(', ')}`;
    if (newPassword !== confirmPassword) errs.confirm = 'Passwords do not match';
    setPasswordErrors(errs);
    if (Object.keys(errs).length) return;
    setSavingPassword(true);
    const result = await changePassword(currentPassword, newPassword);
    setSavingPassword(false);
    if (result.success) {
      showToast(result.message || 'Password changed', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else setPasswordErrors({ current: result.message || 'Could not change password' });
  };

  const signOutEverywhere = async () => {
    if (!window.confirm('Sign out on every device, including this one?')) return;
    await logoutAllDevices();
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Identity card */}
      <section className="card card-pad flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="relative shrink-0 self-start">
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-24 h-24 rounded-3xl object-cover ring-2 ring-cyan-500/40" />
          ) : (
            <div className="w-24 h-24 rounded-3xl bg-cyan-950/60 border border-cyan-800/50 grid place-items-center text-2xl font-black text-cyan-300" aria-hidden="true">{initials(user.name)}</div>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white grid place-items-center shadow-lg" aria-label="Change profile photo">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); }} />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 className="text-xl font-black text-white break-words">{user.name}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="badge badge-info">{ROLE_LABEL[user.role] || user.role}</span>
            {user.emailVerifiedAt
              ? <span className="badge badge-success"><BadgeCheck className="w-3 h-3" />Email verified</span>
              : <span className="badge badge-warning"><AlertTriangle className="w-3 h-3" />Email not verified</span>}
          </div>
          <p className="text-sm text-slate-400 break-all">{user.email}{user.phone ? ` · ${displayPhone(user.phone)}` : ''}</p>
          {user.createdAt && <p className="text-xs text-slate-500">Member since {new Date(user.createdAt).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}</p>}
        </div>
        {user.avatar && (
          <button type="button" onClick={removeAvatar} className="btn btn-ghost btn-sm self-start sm:self-center"><Trash2 className="w-4 h-4" />Remove photo</button>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Section icon={UserRound} title="Personal details" description={isCustomer ? 'Your name and phone appear on orders, invoices and delivery.' : 'Shown to colleagues in audit logs and on staff replies.'}>
          <form onSubmit={saveDetails} className="space-y-4" noValidate>
            <div>
              <label htmlFor="profile-name" className="field-label">Full name</label>
              <div className="relative">
                <UserRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} className={`field-input pl-10 ${detailErrors.name ? 'field-input-error' : ''}`} autoComplete="name" />
              </div>
              {detailErrors.name && <p className="field-error">{detailErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="profile-phone" className="field-label">Mobile number{isCustomer && <span className="text-rose-400"> *</span>}</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input id="profile-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" className={`field-input pl-10 font-mono ${detailErrors.phone ? 'field-input-error' : ''}`} autoComplete="tel" />
              </div>
              {detailErrors.phone ? <p className="field-error">{detailErrors.phone}</p> : <p className="field-hint">Each phone number can belong to only one account.{isCustomer ? ' Used for M-Pesa prompts and rider calls.' : ''}</p>}
            </div>
            <button type="submit" disabled={savingDetails || !detailsChanged} className="btn btn-primary">{savingDetails ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Save details'}</button>
          </form>
        </Section>

        <Section icon={Mail} title="Email address" description="You sign in with this address. Changing it requires your password and a new verification.">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm flex items-center justify-between gap-3">
            <span className="text-slate-200 break-all">{user.email}</span>
            {user.emailVerifiedAt ? <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-label="Verified" /> : <span className="text-xs text-amber-400 shrink-0">Unverified</span>}
          </div>
          <form onSubmit={saveEmail} className="space-y-4" noValidate>
            <div>
              <label htmlFor="profile-new-email" className="field-label">New email</label>
              <input id="profile-new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@example.com" className="field-input" autoComplete="email" />
            </div>
            <PasswordInput label="Current password" toggleLabel="current password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} autoComplete="current-password" />
            {emailError && <p className="field-error" role="alert">{emailError}</p>}
            <button type="submit" disabled={savingEmail || !newEmail} className="btn btn-secondary">{savingEmail ? <><Loader2 className="w-4 h-4 animate-spin" />Updating…</> : 'Change email'}</button>
          </form>
        </Section>

        <Section icon={KeyRound} title="Password" description="Changing your password signs you out on every other device.">
          <form onSubmit={savePassword} className="space-y-4" noValidate>
            <PasswordInput label="Current password" toggleLabel="current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} error={passwordErrors.current} autoComplete="current-password" />
            <PasswordInput label="New password" toggleLabel="new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} error={passwordErrors.next} hint="10+ characters with upper & lower case and a number" autoComplete="new-password" />
            <PasswordInput label="Confirm new password" toggleLabel="password confirmation" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={passwordErrors.confirm} autoComplete="new-password" />
            <button type="submit" disabled={savingPassword} className="btn btn-secondary">{savingPassword ? <><Loader2 className="w-4 h-4 animate-spin" />Changing…</> : 'Change password'}</button>
          </form>
        </Section>

        <Section icon={ShieldCheck} title="Sign-in & security" description="For your security, every sign-in lasts at most 3 hours.">
          {sessionExpiresAt && (
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>This session ends at <strong className="text-white">{sessionExpiresAt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</strong>.</span>
            </div>
          )}
          <p className="text-sm text-slate-400">Lost a phone or used a shared computer? Sign out everywhere, then sign in again here.</p>
          <button type="button" onClick={signOutEverywhere} className="btn btn-danger"><LogOut className="w-4 h-4" />Sign out of all devices</button>
        </Section>
      </div>
    </div>
  );
};
