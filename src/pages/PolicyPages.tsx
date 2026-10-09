import React from 'react';
import { ShieldCheck, Truck, RotateCcw, FileText, Lock } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';

interface PolicyPagesProps {
  type: 'delivery' | 'warranty' | 'returns' | 'terms' | 'privacy';
}

export const PolicyPages: React.FC<PolicyPagesProps> = ({ type }) => {
  const contentMap = {
    delivery: {
      icon: Truck,
      title: "Delivery & Regional Shipping Policy",
      subtitle: "Comprehensive logistics guidelines for Nairobi Metro and countrywide dispatch",
      body: (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white">1. Nairobi Metro Same-Day Delivery</h3>
          <p>Orders placed before 3:00 PM on business days are dispatched immediately via dedicated motorcycle riders and delivered within 2 to 4 hours. Delivery fee is KES 350 (Free for orders over KES 50,000).</p>

          <h3 className="text-base font-bold text-white">2. Countrywide Deliveries (All 47 Counties)</h3>
          <p>Deliveries outside Nairobi are handled via G4S Courier and Fargo Courier with full insurance coverage. Transit times are 24 hours to major hubs (Mombasa, Kisumu, Eldoret, Nakuru) and 48 hours for remote destinations.</p>

          <h3 className="text-base font-bold text-white">3. In-Store Collection (Click & Collect)</h3>
          <p>Free in-store pickup is available within 30 minutes of online checkout at our Nairobi CBD (Nexus Tower) and Westlands (Sarit Centre) locations.</p>
        </div>
      )
    },
    warranty: {
      icon: ShieldCheck,
      title: "Official Hardware Warranty Policy",
      subtitle: "Authenticity, factory seals and local repair protection terms",
      body: (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white">1. Genuine Product Guarantee</h3>
          <p>All brand-new sealed units sold by Internext Business System are 100% authentic and sourced through authorized distributors. Ex-UK laptops are inspected and warrantied separately (see below).</p>

          <h3 className="text-base font-bold text-white">2. Warranty Durations</h3>
          <p>• Brand New Laptops & Desktops: 1-Year Manufacturer Warranty.<br />• Ex-UK Laptops: 3 to 6 Months Internext Warranty.<br />• Networking & CCTV Equipment: 1 to 2 Years Manufacturer Warranty.<br />• Repair & Installation Services: 30 to 90 Day Workmanship Warranty.</p>

          <h3 className="text-base font-bold text-white">3. What is Covered</h3>
          <p>Manufacturer hardware defects, power supply failures, logic board errors, and factory screen malfunctions. Liquid damage and accidental drop damage are excluded unless specified.</p>
        </div>
      )
    },
    returns: {
      icon: RotateCcw,
      title: "Returns & Refund Policy",
      subtitle: "Hassle-free 7-day return and exchange guidelines",
      body: (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white">1. 7-Day Return Window</h3>
          <p>If you receive a product that is defective or does not match specifications, you can initiate a return within 7 calendar days of receipt.</p>

          <h3 className="text-base font-bold text-white">2. Condition for Return</h3>
          <p>The product must be returned with all original box accessories, manuals, and warranty cards intact.</p>

          <h3 className="text-base font-bold text-white">3. Refund Processing</h3>
          <p>Refunds are processed back to the original payment channel (M-Pesa or Card) within 24 to 48 hours following technical verification.</p>
        </div>
      )
    },
    terms: {
      icon: FileText,
      title: "Terms & Conditions",
      subtitle: "Standard operating and purchasing terms for Internext Business System",
      body: (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white">1. Overview</h3>
          <p>By accessing and purchasing from Internext Business System, you agree to abide by these Terms of Service in compliance with Kenyan consumer protection and electronic transaction laws.</p>

          <h3 className="text-base font-bold text-white">2. Pricing & Currency</h3>
          <p>All prices are listed in Kenyan Shillings (KES) and include 16% Value Added Tax (VAT). ETR tax invoices are issued with every completed order.</p>
        </div>
      )
    },
    privacy: {
      icon: Lock,
      title: "Privacy & Data Protection Policy",
      subtitle: "How we collect, protect, and handle customer data under the Kenya Data Protection Act 2019",
      body: (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white">1. Information We Collect</h3>
          <p>We collect name, phone number, email address, and delivery locations solely for order fulfillment, digital invoice generation, and courier tracking updates.</p>

          <h3 className="text-base font-bold text-white">2. Payment Data Security</h3>
          <p>We never store customer M-Pesa PINs or credit card security codes (CVV) on our servers. All transactions are securely routed through Safaricom Daraja API and licensed PCI-DSS payment gateways.</p>
        </div>
      )
    }
  };

  const current = contentMap[type] || contentMap.delivery;
  const Icon = current.icon;

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath={`/policies/${type}`} />

      {/* Hero Header */}
      <div className="bg-[#070b18] border-b border-slate-800 py-12 px-3 sm:px-4 lg:px-5 text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-bold uppercase tracking-wider">
          <Icon className="w-3.5 h-3.5" /> Legal & Customer Protection
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          {current.title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
          {current.subtitle}
        </p>
      </div>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-5 py-12 flex-1 w-full">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl text-slate-300 text-xs sm:text-sm leading-relaxed">
          {current.body}
        </div>
      </main>

      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};
