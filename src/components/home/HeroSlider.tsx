import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';

interface Slide {
  id: number;
  badge: string;
  badgeColor: string;
  heading: string;
  highlight: string;
  description: string;
  primaryCtaText: string;
  primaryCtaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
  image: string;
  priceTag?: string;
}

export const HeroSlider: React.FC = () => {
  const { formatPrice } = useStore();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: Slide[] = [
    {
      id: 1,
      badge: "BRAND NEW & EX-UK",
      badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
      heading: "Business Laptops for Every Budget",
      highlight: "HP, Dell & Lenovo Laptops",
      description: "Brand new sealed business laptops, or Grade-A Ex-UK refurbished machines — inspected, cleaned, and warrantied. Same-day delivery across Nairobi.",
      primaryCtaText: "Shop Brand New Laptops",
      primaryCtaLink: "/shop?category=brand-new-laptops",
      secondaryCtaText: "Shop Ex-UK Laptops",
      secondaryCtaLink: "/shop?category=ex-uk-laptops",
      image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1000&auto=format&fit=crop&q=80",
      priceTag: "From KES 35,000"
    },
    {
      id: 2,
      badge: "NETWORKING & CABLING",
      badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
      heading: "Complete Office Network Solutions",
      highlight: "Planning, Cabling & Implementation",
      description: "Structured cabling, network planning and design, routers, switches, and enterprise access points — installed and supported by our own technicians.",
      primaryCtaText: "Get a Network Quote",
      primaryCtaLink: "/products/network-planning-design-consultation",
      secondaryCtaText: "Shop Networking Gear",
      secondaryCtaLink: "/shop?category=networking",
      image: "https://images.unsplash.com/photo-1606904825846-647eb07f5be2?w=1000&auto=format&fit=crop&q=80",
      priceTag: "From KES 2,500/point"
    },
    {
      id: 3,
      badge: "SECURITY SOLUTIONS",
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      heading: "Protect Your Premises",
      highlight: "CCTV & Surveillance Kits",
      description: "Hikvision and Dahua CCTV kits with professional installation — from single cameras to full multi-camera coverage for offices and compounds.",
      primaryCtaText: "Shop CCTV Kits",
      primaryCtaLink: "/shop?category=cctv-surveillance",
      secondaryCtaText: "Repairs & Maintenance",
      secondaryCtaLink: "/shop?category=hardware-maintenance",
      image: "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=1000&auto=format&fit=crop&q=80",
      priceTag: "From KES 32,000"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[currentSlide];

  return (
    <div className="relative bg-[#070b18] overflow-hidden border-b border-slate-800">
      {/* Background glow effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-[1520px] mx-auto px-3 sm:px-4 lg:px-5 py-10 sm:py-16 lg:py-20 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Content */}
          <div key={slide.id} className="lg:col-span-7 space-y-5 text-center lg:text-left animate-fadeInUp">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider backdrop-blur-md transition-all duration-300">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${slide.badgeColor}`}>
                <Zap className="w-3 h-3 fill-current" /> {slide.badge}
              </span>
              {slide.priceTag && (
                <span className="text-emerald-400 font-extrabold">{slide.priceTag}</span>
              )}
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
              {slide.heading} <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                {slide.highlight}
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
              {slide.description}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
              <a
                href={slide.primaryCtaLink}
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-cyan-600/30 transition-all hover:scale-105"
              >
                <span>{slide.primaryCtaText}</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href={slide.secondaryCtaLink}
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-sm rounded-xl border border-slate-700 transition-all text-center"
              >
                {slide.secondaryCtaText}
              </a>
            </div>

            {/* Micro Guarantees */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 pt-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Same-Day Nairobi Dispatch</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Official Warranty Guaranteed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>M-Pesa STK Push Instant</span>
              </div>
            </div>
          </div>

          {/* Right Hero Image Card */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Card Container */}
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-tr from-slate-900 to-slate-800 border-2 border-slate-700/80 p-3 shadow-2xl shadow-cyan-950/40 group">
                <div className="relative h-72 sm:h-96 rounded-2xl overflow-hidden bg-slate-950">
                  <img
                    key={slide.id}
                    src={slide.image}
                    alt={slide.highlight}
                    className="hero-slide-image w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />

                  {/* Floating Price Tag */}
                  {slide.priceTag && (
                    <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-700 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Starting Price</div>
                        <div className="text-sm sm:text-base font-extrabold text-white">{slide.priceTag}</div>
                      </div>
                      <a
                        href={slide.primaryCtaLink}
                        className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                      >
                        <span>View</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Navigation Dots & Arrows */}
        <div className="flex items-center justify-between pt-8 mt-6 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentSlide === idx ? 'w-8 bg-cyan-500' : 'w-2 bg-slate-700 hover:bg-slate-600'
                }`}
                title={`Go to slide ${idx + 1}`}
                aria-label={`Go to slide ${idx + 1}`}
                aria-current={currentSlide === idx ? 'true' : undefined}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Previous Slide"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Next Slide"
              aria-label="Next slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
