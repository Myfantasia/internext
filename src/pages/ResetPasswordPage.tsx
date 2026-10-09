import React, { useState } from 'react';
import { Lock, ArrowRight, KeyRound } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

export const ResetPasswordPage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();
      setMessage(data.message);
      setSuccess(!!data.success);
    } catch {
      setMessage('Unable to reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100">
        <Header currentPath="/auth/reset-password" />
        <main className="flex-1 max-w-md mx-auto px-4 py-12 w-full flex flex-col justify-center text-center text-sm text-slate-400">
          Missing or invalid reset link. <a href="/auth/forgot-password" className="text-cyan-400 hover:underline">Request a new one</a>.
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100">
      <Header currentPath="/auth/reset-password" />
      <main className="flex-1 max-w-md mx-auto px-4 py-12 w-full flex flex-col justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 mx-auto flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-white">Set a new password</h2>
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
                <label className="block text-slate-300 font-bold mb-1">New Password:</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                    required
                    minLength={10}
                    autoComplete="new-password"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">At least 10 characters, with uppercase, lowercase, and a number.</p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg"
              >
                <span>{loading ? 'Updating…' : 'Update password'}</span>
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
