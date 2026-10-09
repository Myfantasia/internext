import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

export const VerifyEmailPage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
      .then((res) => res.json())
      .then((data) => {
        setStatus(data.success ? 'success' : 'error');
        setMessage(data.message);
      })
      .catch(() => {
        setStatus('error');
        setMessage('Unable to reach the server. Please try again.');
      });
  }, [token]);

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100">
      <Header currentPath="/auth/verify-email" />
      <main className="flex-1 max-w-md mx-auto px-4 py-12 w-full flex flex-col justify-center text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-4">
          {status === 'loading' && <Loader2 className="w-10 h-10 text-cyan-400 mx-auto animate-spin" />}
          {status === 'success' && <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />}
          {status === 'error' && <XCircle className="w-10 h-10 text-rose-400 mx-auto" />}
          <h2 className="text-lg font-black text-white">
            {status === 'loading' ? 'Verifying your email…' : status === 'success' ? 'Email verified' : 'Verification failed'}
          </h2>
          {message && <p className="text-xs text-slate-400">{message}</p>}
          <a href="/customer/dashboard" className="inline-block mt-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs">
            Go to my account
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
};
