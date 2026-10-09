import React from 'react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { CompareDrawer } from '../components/common/CompareDrawer';
import { CartDrawer } from '../components/checkout/CartDrawer';
import { HeroSlider } from '../components/home/HeroSlider';
import { CategoryGrid } from '../components/home/CategoryGrid';
import { FlashDeals } from '../components/home/FlashDeals';
import { FeaturedSection } from '../components/home/FeaturedSection';
import { BrandShowcase } from '../components/home/BrandShowcase';
import { PromoBanners } from '../components/home/PromoBanners';
import { BuyingGuidesGrid } from '../components/home/BuyingGuidesGrid';
import { ReviewsCarousel } from '../components/home/ReviewsCarousel';
import { TrustSection } from '../components/home/TrustSection';

export const HomePage: React.FC = () => {
  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/" />
      
      <main className="flex-1">
        <HeroSlider />
        <CategoryGrid />
        <FlashDeals />
        <FeaturedSection />
        <PromoBanners />
        <BrandShowcase />
        <BuyingGuidesGrid />
        <ReviewsCarousel />
        <TrustSection />
      </main>

      <Footer />
      <FloatingWhatsApp />
      <CompareDrawer />
      <CartDrawer />
    </div>
  );
};
