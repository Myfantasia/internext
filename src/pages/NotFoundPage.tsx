import React from 'react';
import { ShoppingBag, Home, Search, ArrowLeft } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100">
      <Header currentPath="/404" />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        {/* Giant 404 */}
        <div className="relative mb-8">
          <div className="text-[10rem] sm:text-[14rem] font-black leading-none text-slate-800 select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Search className="w-16 h-16 sm:w-24 sm:h-24 text-cyan-500/60" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3 max-w-md">
          <h1 className="text-2xl sm:text-3xl font-black text-white">Page Not Found</h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist, has been moved, or the link may be broken.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-10">
          <a
            href="/"
            className="flex items-center gap-2.5 px-6 py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-600/25"
          >
            <Home className="w-4 h-4" />
            <span>Go to Homepage</span>
          </a>
          <a
            href="/shop"
            className="flex items-center gap-2.5 px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 hover:border-slate-600 transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Browse Shop</span>
          </a>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex items-center gap-2.5 px-6 py-3.5 text-slate-400 hover:text-white font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        </div>

        {/* Popular Links */}
        <div className="mt-12 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Popular Pages</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { label: 'Laptops', href: '/shop?category=laptops' },
              { label: 'Smartphones', href: '/shop?category=smartphones' },
              { label: 'Accessories', href: '/shop?category=accessories' },
              { label: 'Flash Deals', href: '/shop?flashDeal=true' },
              { label: 'New Arrivals', href: '/shop?newArrival=true' },
              { label: 'Contact Us', href: '/contact' },
              { label: 'Track Order', href: '/track-order' }
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:text-cyan-300 text-slate-400 rounded-xl text-sm font-medium transition-all"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
