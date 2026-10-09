import React, { useState } from 'react';
import { Lock, User as UserIcon, ArrowRight, Briefcase } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { PasswordInput } from '../components/forms/PasswordInput';

export const AcceptInvitePage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setMessage('The two passwords do not match.'); return; }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, password })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setMessage('Your Sales Manager account is ready.');
      } else {
        setMessage(data.message || 'Unable to accept this invitation.');
      }
    } catch {
      setMessage('Unable to reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100">
        <Header currentPath="/auth/accept-invite" />
        <main className="flex-1 max-w-md mx-auto px-4 py-12 w-full flex flex-col justify-center text-center text-sm text-slate-400">
          Missing or invalid invitation link. Ask your administrator to resend the invite.
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100">
      <Header currentPath="/auth/accept-invite" />
      <main className="flex-1 max-w-md mx-auto px-4 py-12 w-full flex flex-col justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 mx-auto flex items-center justify-center">
              <Briefcase className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-white">Join as Sales Manager</h2>
            <p className="text-xs text-slate-400">Set your name and password to activate your account.</p>
          </div>

          {message && (
            <div className={`text-xs rounded-xl px-3.5 py-3 border ${success ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300' : 'bg-rose-950/50 border-rose-800/60 text-rose-300'}`}>
              {message}
            </div>
          )}

          {success ? (
            <a href="/auth" className="block w-full text-center py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs rounded-xl">
              Continue to sign in
            </a>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Full Name:</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                    required
                    minLength={2}
                  />
                </div>
              </div>
              <PasswordInput label="New password" toggleLabel="new password" value={password} onChange={(e) => setPassword(e.target.value)} hint="10+ characters with upper & lower case and a number" required minLength={10} autoComplete="new-password" />
              <PasswordInput label="Confirm password" toggleLabel="password confirmation" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={confirm && confirm !== password ? 'Passwords do not match' : undefined} required autoComplete="new-password" />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg"
              >
                <span>{loading ? 'Activating…' : 'Activate account'}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};
