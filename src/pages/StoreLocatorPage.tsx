import React from 'react';
import { MapPin, Phone, Clock, ShieldCheck, Navigation, ArrowRight } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { useStore } from '../context/StoreContext';

export const StoreLocatorPage: React.FC = () => {
  const { stores } = useStore();

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/store-locator" />

      {/* Hero Header */}
      <div className="bg-[#070b18] border-b border-slate-800 py-12 px-3 sm:px-4 lg:px-5">
        <div className="max-w-4xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-bold uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Physical Tech Experience Stores
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Internext Store Locator & Collection Points
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
            Visit our retail showrooms in Nairobi CBD, Westlands, and Mombasa for in-person product demonstrations, device trade-ins, custom PC assembly, and free online order collection.
          </p>
        </div>
      </div>

      <main className="max-w-[1520px] mx-auto px-3 sm:px-4 lg:px-5 py-12 flex-1 w-full space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stores.map((store) => (
            <div
              key={store.id}
              className="bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xl group transition-all duration-200 hover:-translate-y-1"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
                  <MapPin className="w-6 h-6" />
                </div>

                <div>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">{store.city} Branch</span>
                  <h3 className="text-lg font-bold text-white mt-1 leading-snug">{store.name}</h3>
                </div>

                <div className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                  <div className="flex items-start gap-2.5">
                    <Navigation className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{store.address}</span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-cyan-400 shrink-0" />
                    <a href={`tel:${store.phone}`} className="text-white font-mono hover:text-cyan-400">
                      {store.phone}
                    </a>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{store.hours}</span>
                  </div>
                </div>

                {/* Available Services */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Available In-Store Services:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {store.services.map((srv, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-slate-950 text-slate-300 text-[10px] border border-slate-800">
                        ✓ {srv}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(store.address + ', ' + store.city + ', Kenya')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-slate-800 hover:bg-cyan-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Open in Google Maps</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};
