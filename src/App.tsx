import React, { useState, useEffect } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { CompareProvider } from './context/CompareContext';

// Customer Pages
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ComparePage } from './pages/ComparePage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { TrackOrderPage } from './pages/TrackOrderPage';
import { CustomerDashboardPage } from './pages/CustomerDashboardPage';
import { WishlistPage } from './pages/WishlistPage';
import { BlogPage } from './pages/BlogPage';
import { BlogPostPage } from './pages/BlogPostPage';
import { NewsPage } from './pages/NewsPage';
import { NewsArticlePage } from './pages/NewsArticlePage';
import { StoreLocatorPage } from './pages/StoreLocatorPage';
import { AboutUsPage } from './pages/AboutUsPage';
import { ContactUsPage } from './pages/ContactUsPage';
import { FaqPage } from './pages/FaqPage';
import { PolicyPages } from './pages/PolicyPages';
import { AuthPage } from './pages/AuthPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { AdminAuthPage } from './pages/AdminAuthPage';
import { StaffSignupPage } from './pages/StaffSignupPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Admin Page
import { AdminPage } from './pages/admin/AdminPage';
import { RequireRole } from './components/auth/RequireRole';

import { ThemeProvider } from './context/ThemeContext';
import { navigate, restoreScroll } from './utils/navigation';

export const App: React.FC = () => {
  const [currentLocation, setCurrentLocation] = useState(
    () => window.location.pathname + window.location.search
  );

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentLocation(window.location.pathname + window.location.search);
    };
    // Real Back/Forward (navigate() dispatches a synthetic popstate that is
    // not trusted, and handles its own scrolling).
    const handleHistoryMove = (e: PopStateEvent) => {
      if (e.isTrusted) restoreScroll();
    };

    const handleGlobalClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      const targetAttr = target.getAttribute('target');

      // Ignore external links, mailto, tel, whatsapp, anchors, or new tabs
      if (
        !href ||
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        targetAttr === '_blank'
      ) {
        return;
      }

      // Check if it's an internal SPA route
      if (href.startsWith('/')) {
        e.preventDefault();
        navigate(href);
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('popstate', handleHistoryMove);
    window.addEventListener('app:locationchange', handleLocationChange);
    document.addEventListener('click', handleGlobalClick);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('popstate', handleHistoryMove);
      window.removeEventListener('app:locationchange', handleLocationChange);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  // Simple clean client-side routing
  const renderRoute = () => {
    const pathname = window.location.pathname.toLowerCase();

    if (pathname === '/' || pathname === '') return <HomePage key={currentLocation} />;
    if (pathname.startsWith('/shop')) return <ShopPage key={currentLocation} />;
    if (pathname.startsWith('/products/')) return <ProductDetailPage key={currentLocation} />;
    if (pathname.startsWith('/compare')) return <ComparePage key={currentLocation} />;
    if (pathname.startsWith('/cart')) return <RequireRole allow={['CUSTOMER', 'ADMIN', 'SALES_MANAGER']} key={currentLocation}><CartPage /></RequireRole>;
    if (pathname.startsWith('/checkout')) return <RequireRole allow={['CUSTOMER', 'ADMIN', 'SALES_MANAGER']} key={currentLocation}><CheckoutPage /></RequireRole>;
    if (pathname.startsWith('/order-confirmation')) return <RequireRole allow={['CUSTOMER', 'ADMIN', 'SALES_MANAGER']} key={currentLocation}><OrderConfirmationPage /></RequireRole>;
    if (pathname.startsWith('/track-order') || pathname.startsWith('/track')) return <TrackOrderPage key={currentLocation} />;
    if (pathname.startsWith('/customer') || pathname.startsWith('/account')) {
      return (
        <RequireRole allow={['CUSTOMER', 'ADMIN', 'SALES_MANAGER']} key={currentLocation}>
          <CustomerDashboardPage />
        </RequireRole>
      );
    }
    if (pathname.startsWith('/wishlist')) return <WishlistPage key={currentLocation} />;
    if (pathname.startsWith('/news/')) return <NewsArticlePage key={currentLocation} />;
    if (pathname === '/news' || pathname.startsWith('/news?')) return <NewsPage key={currentLocation} />;
    if (pathname.startsWith('/blog/')) return <BlogPostPage key={currentLocation} />;
    if (pathname.startsWith('/blog')) return <BlogPage key={currentLocation} />;
    if (pathname.startsWith('/store-locator') || pathname.startsWith('/stores')) return <StoreLocatorPage key={currentLocation} />;
    if (pathname.startsWith('/about')) return <AboutUsPage key={currentLocation} />;
    if (pathname.startsWith('/contact')) return <ContactUsPage key={currentLocation} />;
    if (pathname.startsWith('/faqs') || pathname.startsWith('/faq')) return <FaqPage key={currentLocation} />;

    // Policies
    if (pathname.startsWith('/policies/delivery')) return <PolicyPages key={currentLocation} type="delivery" />;
    if (pathname.startsWith('/policies/warranty')) return <PolicyPages key={currentLocation} type="warranty" />;
    if (pathname.startsWith('/policies/returns')) return <PolicyPages key={currentLocation} type="returns" />;
    if (pathname.startsWith('/policies/terms')) return <PolicyPages key={currentLocation} type="terms" />;
    if (pathname.startsWith('/policies/privacy')) return <PolicyPages key={currentLocation} type="privacy" />;

    // Auth & Admin
    if (pathname.startsWith('/auth/forgot-password')) return <ForgotPasswordPage key={currentLocation} />;
    if (pathname.startsWith('/auth/reset-password')) return <ResetPasswordPage key={currentLocation} />;
    if (pathname.startsWith('/auth/verify-email')) return <VerifyEmailPage key={currentLocation} />;
    if (pathname.startsWith('/auth/accept-invite')) return <AcceptInvitePage key={currentLocation} />;
    if (pathname === '/admin/signup') return <StaffSignupPage key={currentLocation} />;
    if (pathname.startsWith('/auth') || pathname.startsWith('/login') || pathname.startsWith('/register')) return <AuthPage key={currentLocation} />;
    // Staff portal — must come before /admin to prevent catching /admin/login inside /admin
    if (pathname === '/admin/login' || pathname === '/admin/auth') return <AdminAuthPage key={currentLocation} />;
    if (pathname.startsWith('/admin')) {
      return (
        <RequireRole allow={['ADMIN', 'SALES_MANAGER']} key={currentLocation}>
          <AdminPage />
        </RequireRole>
      );
    }

    // Fallback: proper 404 page for all unknown routes
    return <NotFoundPage key={currentLocation} />;
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <StoreProvider>
            <CartProvider>
              <WishlistProvider>
                <CompareProvider>
                  {renderRoute()}
                </CompareProvider>
              </WishlistProvider>
            </CartProvider>
          </StoreProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};
