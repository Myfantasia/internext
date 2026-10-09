import React from 'react';
import { Zap, ShieldCheck, Award, Users, Target, CheckCircle2 } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';

export const AboutUsPage: React.FC = () => {
  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/about" />

      {/* Hero Header */}
      <div className="bg-[#070b18] border-b border-slate-800 py-12 sm:py-16 px-3 sm:px-4 lg:px-5 text-center space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-bold uppercase tracking-wider">
          <Zap className="w-3.5 h-3.5" /> About Internext Business System
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight max-w-2xl mx-auto">
          We Make Technology Happen
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
          Based in Nairobi, Internext Business System supplies brand new and Ex-UK laptops, computers, and desktop accessories, and delivers screen replacement, structured cabling, network planning &amp; implementation, CCTV surveillance, and hardware &amp; software maintenance for businesses across Kenya.
        </p>
      </div>

      <main className="max-w-[1520px] mx-auto px-3 sm:px-4 lg:px-5 py-12 flex-1 w-full space-y-12">
        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">100% Genuine Guarantee</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              We eliminate gray-market counterfeits. Every smartphone, laptop, and component is backed by official local manufacturer warranties honored across East Africa.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Speed & Reliability</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Same-day courier dispatch across Nairobi within 2 hours, instant Safaricom M-Pesa STK push integration, and insured 24-hour deliveries to all 47 counties in Kenya.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Expert Consultation</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Our hardware engineers advise on GPU thermal specs, RAM expansions, AI model workloads, and enterprise networking architecture at zero extra cost.
            </p>
          </div>
        </div>
      </main>

      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};
