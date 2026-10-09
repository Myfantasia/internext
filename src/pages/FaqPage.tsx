import React, { useState } from 'react';
import { HelpCircle, ChevronDown, Search, ShieldCheck } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';

export const FaqPage: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [searchTerm, setSearchTerm] = useState('');

  const faqs = [
    {
      q: "What's the difference between Brand New and Ex-UK laptops?",
      a: "Brand New laptops are sealed, unused units with full manufacturer warranty. Ex-UK laptops are Grade-A used machines imported from the UK — each is inspected, cleaned, tested, and comes with a 3-6 month Internext warranty at a significantly lower price."
    },
    {
      q: "How does the M-Pesa STK Push payment work?",
      a: "When you select M-Pesa STK Push at checkout and click 'Place Order', an automated prompt is dispatched to your Safaricom phone. Enter your M-Pesa PIN to complete payment — your order and digital invoice are confirmed automatically."
    },
    {
      q: "Do you install and configure networking and CCTV equipment?",
      a: "Yes. Beyond selling equipment, our technicians handle structured cabling, network planning & design, full network implementation, and CCTV installation on-site for offices and homes."
    },
    {
      q: "Do you offer repair and maintenance services?",
      a: "Yes — laptop and monitor screen replacement, hardware diagnostics & repair, software setup & virus removal, and annual hardware/software maintenance contracts for businesses."
    },
    {
      q: "Can I collect my order in person?",
      a: "Yes — choose 'Free Pickup' at checkout to collect from our office at Princely House, 1st Floor, Moi Avenue, Nairobi."
    },
    {
      q: "How does the warranty claim process work?",
      a: "If your item develops a fault within the warranty period, bring it to our office with your invoice. We handle repair or replacement directly, or coordinate with the manufacturer's authorized service center where applicable."
    },
    {
      q: "Do you serve corporate/bulk office equipment orders?",
      a: "Yes — we regularly supply and set up laptops, desktops, networking, and CCTV for offices. Contact us for bulk procurement pricing and on-site deployment."
    }
  ];

  const filteredFaqs = faqs.filter(
    (f) =>
      f.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.a.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/faqs" />

      {/* Hero Header */}
      <div className="bg-[#070b18] border-b border-slate-800 py-12 px-3 sm:px-4 lg:px-5 text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-bold uppercase tracking-wider">
          <HelpCircle className="w-3.5 h-3.5" /> Frequently Asked Questions
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Got Questions? We Have Answers
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
          Find instant answers about delivery timelines, M-Pesa payments, warranty coverage, and device collection.
        </p>

        {/* Search */}
        <div className="max-w-md mx-auto pt-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search questions (e.g. M-Pesa, delivery, warranty)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 shadow-inner"
            />
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-5 py-12 flex-1 w-full space-y-4">
        {filteredFaqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-all shadow-lg"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-white text-sm hover:text-cyan-300 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-cyan-400 shrink-0 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 text-xs text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3 bg-slate-950/40">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </main>

      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};
