import React, { useState } from 'react';
import { Mail, ArrowRight, KeyRound } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setMessage(data.message || 'If an account exists for that email, a reset link has been sent.');
    } catch {
      setMessage('Unable to reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100">
      <Header currentPath="/auth/forgot-password" />
      <main className="flex-1 max-w-md mx-auto px-4 py-12 w-full flex flex-col justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 mx-auto flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-white">Reset your password</h2>
            <p className="text-xs text-slate-400">Enter your email and we'll send you a reset link.</p>
          </div>

          {message ? (
            <div className="bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs rounded-xl px-3.5 py-3">
              {message}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Email Address:</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg"
              >
                <span>{loading ? 'Sending…' : 'Send reset link'}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}

          <div className="text-center text-xs text-slate-400">
            <a href="/auth" className="text-cyan-400 hover:underline font-semibold">Back to sign in</a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};
