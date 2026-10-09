import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageCircle, Clock, CheckCircle2 } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

// The contact form opens a real support ticket, so every message lands in the
// staff Tickets inbox and gets a reference the customer can follow up on.
export const ContactUsPage: React.FC = () => {
  const { settings } = useStore();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(), message: message.trim(), category: 'Product Inquiry',
          customerName: user ? undefined : name.trim(), customerEmail: user ? undefined : email.trim(), customerPhone: user ? undefined : phone.trim() || undefined
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) { showToast(data?.message || 'Could not send your message. Please try again.', 'error'); return; }
      setSubmitted(data.ticket.ticketNumber);
      setSubject('');
      setMessage('');
    } catch {
      showToast('Could not reach the server. Please try again or WhatsApp us.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/contact" />

      {/* Hero Header */}
      <div className="bg-[#070b18] border-b border-slate-800 py-12 px-3 sm:px-4 lg:px-5 text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-bold uppercase tracking-wider">
          <Phone className="w-3.5 h-3.5" /> Customer Care & Support
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Get in Touch with Internext
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
          Have an inquiry about products, network installation, CCTV, bulk corporate procurement, or repair service? We're here to assist.
        </p>
      </div>

      <main className="max-w-[1520px] mx-auto px-3 sm:px-4 lg:px-5 py-12 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Contact Info (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl">
            <h3 className="text-lg font-bold text-white">Direct Communication Channels</h3>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Headquarters & Flagship Store:</div>
                  <p className="text-slate-400">{settings.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Phone Support:</div>
                  <p className="text-slate-400 font-mono">{settings.phone} / {settings.altPhone}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Email Addresses:</div>
                  <p className="text-slate-400">{settings.email} • {settings.supportEmail}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Operating Hours:</div>
                  <p className="text-slate-400">Monday - Saturday: 8:00 AM - 8:00 PM</p>
                  <p className="text-slate-400">Sunday: 10:00 AM - 5:00 PM</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <a
                href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Chat Instantly on WhatsApp</span>
              </a>
            </div>
          </div>
        </div>

        {/* Right: Message Form (7 Cols) */}
        <div className="lg:col-span-7">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            {submitted ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-500 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">Message received</h3>
                <p className="text-sm text-slate-300 max-w-sm mx-auto">
                  Your reference is <strong className="font-mono text-white">{submitted}</strong>. We usually reply within one business day{user ? ' — follow the conversation under My Account → Support.' : ` by email to ${email}.`}
                </p>
                {user && <a href="/customer/dashboard?tab=tickets" className="btn btn-primary btn-sm">View my tickets</a>}
                <button
                  type="button"
                  onClick={() => setSubmitted(null)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <h3 className="text-lg font-bold text-white">Send Us a Direct Message</h3>

                {user && (
                  <p className="text-sm text-slate-400">Sending as <strong className="text-white">{user.name}</strong> ({user.email}). Replies appear under My Account → Support.</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {!user && <>
                  <div>
                    <label className="block text-slate-400 mb-1">Your Full Name:</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Dennis Mwangi"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Email Address:</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. dennis@example.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Phone Number:</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 0712345678"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>

                  </>}
                  <div>
                    <label className="block text-slate-400 mb-1">Subject:</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Bulk quote for 10x MacBook Air"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Message Details:</label>
                  <textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide model specifications, quantity, or questions..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="disabled:opacity-60 px-8 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>{sending ? 'Sending…' : 'Send Inquiry'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};
