import React, { useState, useEffect, useRef } from 'react';
import { useBodyScrollLock } from '../common/Overlay';
import {
  Zap,
  Phone,
  MessageCircle,
  MapPin,
  Heart,
  Scale,
  ShoppingCart,
  User as UserIcon,
  ChevronDown,
  Menu,
  X,
  Shield,
  Layers,
  Sparkles,
  Flame,
  Search,
  ExternalLink,
  Lock,
  LogOut,
  Package,
  Settings as SettingsIcon,
  HelpCircle,
  Sun,
  Moon
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useCompare } from '../../context/CompareContext';
import { useTheme } from '../../context/ThemeContext';
import { SearchBar } from '../common/SearchBar';
import { MegaMenu } from './MegaMenu';
import { Logo } from '../common/Logo';
import { navigate } from '../../utils/navigation';

interface HeaderProps {
  currentPath?: string;
}

export const Header: React.FC<HeaderProps> = ({ currentPath = '/' }) => {
  const { settings, currency, setCurrency, formatPrice } = useStore();
  const { user, isAuthenticated, isAdmin, isStaff, logout } = useAuth();
  const { cartCount, subtotal, setIsCartDrawerOpen } = useCart();
  const { wishlistCount } = useWishlist();
  const { compareCount, setIsDrawerOpen: setIsCompareDrawerOpen } = useCompare();
  const { theme, toggleTheme } = useTheme();

  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  useBodyScrollLock(isMobileMenuOpen);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);

  const megaMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (megaMenuRef.current && !megaMenuRef.current.contains(e.target as Node)) {
        setIsMegaMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full transition-all duration-200">
      {/* 1. TOP ANNOUNCEMENT & UTILITY BAR */}
      <div className="bg-[#070b18] text-slate-400 text-xs border-b border-slate-800/80 py-1.5 px-3 sm:px-4 lg:px-5">
        <div className="max-w-[1520px] mx-auto flex items-center justify-between gap-4">
          {/* Left Promo message */}
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 font-bold text-[10px] tracking-wider uppercase shrink-0 border border-cyan-800/40">
              <Zap className="w-3 h-3 text-cyan-400" /> KENYA FAST DISPATCH
            </span>
            <p className="truncate text-slate-300">
              Same-day delivery across Nairobi on orders placed before 3PM | Genuine Hardware &amp; Manufacturer Warranties
            </p>
          </div>

          {/* Right Utility Actions */}
          <div className="flex items-center gap-4 shrink-0 font-medium">
            {/* Phone & WhatsApp */}
            <a
              href={`tel:${settings.phone}`}
              className="hidden lg:flex items-center gap-1.5 hover:text-cyan-400 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-cyan-400" />
              <span>{settings.phone}</span>
            </a>

            <a
              href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}?text=Hello%20Internext%20Business%20System,%20I%20have%20an%20inquiry.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp Us</span>
            </a>

            <a
              href="/store-locator"
              className="hidden md:flex items-center gap-1.5 hover:text-cyan-400 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span>Nairobi & Mombasa Stores</span>
            </a>

            {/* Currency Switcher */}
            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setCurrency('KES')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  currency === 'KES' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                KES
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  currency === 'USD' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                USD
              </button>
            </div>

            {/* Theme Switcher Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700/80 text-[11px] font-bold text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 transition-all cursor-pointer"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              )}
            </button>

            {/* Admin/Sales Manager Command Center Quick Link */}
            {isStaff ? (
              <a
                href="/admin"
                className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-md text-[11px] font-bold hover:bg-amber-500/30 transition-colors"
              >
                <Shield className="w-3 h-3 text-amber-400" />
                <span>{isAdmin ? 'Admin Portal' : 'Sales Portal'}</span>
              </a>
            ) : (
              <a
                href="/auth"
                className="hidden lg:flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Lock className="w-3 h-3" />
                <span>Staff Portal</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER BAR */}
      <div className={`bg-[#0b132b] border-b border-slate-800 transition-shadow duration-200 ${isScrolled ? 'shadow-xl' : ''}`}>
        <div className="max-w-[1520px] mx-auto px-3 sm:px-4 lg:px-5 py-3 flex items-center justify-between gap-4 md:gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <a href="/" className="group">
              <Logo size={38} className="group-hover:scale-[1.02] transition-transform" />
            </a>
          </div>

          {/* Live Search Bar (Desktop Center) */}
          <div className="hidden lg:block flex-1 max-w-2xl mx-2">
            <SearchBar />
          </div>

          {/* Right Action Icons: Compare, Wishlist, Cart, Account */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Quick Theme Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 text-slate-300 hover:text-cyan-400 hover:bg-slate-800/80 rounded-xl transition-all flex items-center justify-center group cursor-pointer"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400 group-hover:scale-110 group-hover:rotate-45 transition-transform" />
              ) : (
                <Moon className="w-5 h-5 text-cyan-500 group-hover:scale-110 group-hover:-rotate-12 transition-transform" />
              )}
            </button>

            {/* Compare Button */}
            <button
              type="button"
              onClick={() => setIsCompareDrawerOpen(true)}
              className="relative p-2.5 text-slate-300 hover:text-cyan-400 hover:bg-slate-800/80 rounded-xl transition-all flex items-center gap-1.5 group"
              title="Compare Products"
            >
              <Scale className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="hidden xl:inline text-xs font-semibold">Compare</span>
              {compareCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-[#0b132b]">
                  {compareCount}
                </span>
              )}
            </button>

            {/* Wishlist Button */}
            <a
              href="/wishlist"
              className="relative p-2.5 text-slate-300 hover:text-rose-400 hover:bg-slate-800/80 rounded-xl transition-all flex items-center gap-1.5 group"
              title="Saved Wishlist"
            >
              <Heart className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="hidden xl:inline text-xs font-semibold">Wishlist</span>
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-[#0b132b]">
                  {wishlistCount}
                </span>
              )}
            </a>

            {/* Shopping Cart Drawer Trigger */}
            <button
              type="button"
              onClick={() => isAuthenticated ? setIsCartDrawerOpen(true) : navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`)}
              className="flex items-center gap-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white p-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-cyan-600/25 transition-all group"
            >
              <div className="relative">
                <ShoppingCart className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-500 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center shadow">
                    {cartCount}
                  </span>
                )}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-[10px] text-cyan-200 uppercase font-medium leading-none">{user ? `${user.name.split(' ')[0]}s cart` : 'Sign in to shop'}</div>
                <div className="text-xs font-bold leading-tight">{formatPrice(subtotal)}</div>
              </div>
            </button>

            {/* User Account / Profile Dropdown */}
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 transition-all text-xs"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-7 h-7 rounded-lg object-cover ring-1 ring-cyan-500/50"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <div className="font-semibold text-white truncate max-w-[100px]">
                    {user ? user.name.split(' ')[0] : 'Sign In'}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-none">
                    {user ? (isStaff ? 'Staff' : 'Account') : 'My Portal'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-slate-800">
                  <div className="p-3">
                    {user ? (
                      <div>
                        <div className="text-xs text-slate-400">Signed in as</div>
                        <div className="text-sm font-bold text-white truncate">{user.name}</div>
                        <div className="text-xs text-cyan-400 font-mono truncate">{user.email}</div>
                        <div className="mt-2 inline-block px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 uppercase border border-slate-700">
                          Role: {user.role.replace('_', ' ')}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-center">
                        <div className="text-sm font-bold text-white">Welcome to Internext Business System</div>
                        <p className="text-xs text-slate-400">Track orders, manage wishlist and save addresses</p>
                        <a
                          href="/auth"
                          className="block w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-colors"
                        >
                          Sign In / Register
                        </a>
                      </div>
                    )}
                  </div>

                  {user && (
                    <div className="py-2 space-y-1 text-xs">
                      <a
                        href="/customer/dashboard"
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <Package className="w-4 h-4 text-cyan-400" />
                        <span>My Orders & Timeline</span>
                      </a>
                      <a
                        href="/wishlist"
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <Heart className="w-4 h-4 text-rose-400" />
                        <span>Saved Wishlist</span>
                      </a>
                      <a
                        href="/customer/dashboard"
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <MapPin className="w-4 h-4 text-amber-400" />
                        <span>Saved Addresses</span>
                      </a>
                      <a
                        href="/contact"
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <HelpCircle className="w-4 h-4 text-emerald-400" />
                        <span>Support & Tickets</span>
                      </a>

                      {isStaff && (
                        <div className="pt-2 border-t border-slate-800">
                          <a
                            href="/admin"
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900 border border-cyan-800/40 font-bold transition-colors"
                          >
                            <Shield className="w-4 h-4 text-cyan-400" />
                            <span>{isAdmin ? 'Executive Admin Dashboard' : 'Sales Dashboard'}</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {user && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Search Bar Row */}
        <div className="lg:hidden px-4 pb-3">
          <SearchBar />
        </div>
      </div>

      {/* 3. NAVIGATION BAR & MEGA MENU TRIGGER */}
      <div className="hidden lg:block bg-[#070b18] border-b border-slate-800/80">
        <div className="max-w-[1520px] mx-auto px-3 sm:px-4 lg:px-5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Mega Menu Toggle Button */}
            <div ref={megaMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsMegaMenuOpen(!isMegaMenuOpen)}
                className={`flex items-center gap-2.5 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all border-r border-slate-800 ${
                  isMegaMenuOpen
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-900 text-cyan-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>All Categories</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMegaMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Mega Menu Overlay */}
              {isMegaMenuOpen && (
                <div className="absolute top-full left-0 w-[960px] max-w-[calc(100vw-2rem)] z-50">
                  <MegaMenu onClose={() => setIsMegaMenuOpen(false)} />
                </div>
              )}
            </div>

            {/* Direct Category Links */}
            <nav className="flex items-center gap-1 text-xs font-semibold text-slate-300">
              <a
                href="/shop?category=brand-new-laptops"
                className="px-3 py-3 hover:text-cyan-400 hover:bg-slate-900/60 rounded-md transition-colors"
              >
                Brand New Laptops
              </a>
              <a
                href="/shop?category=ex-uk-laptops"
                className="px-3 py-3 hover:text-cyan-400 hover:bg-slate-900/60 rounded-md transition-colors"
              >
                Ex-UK Laptops
              </a>
              <a
                href="/shop?category=desktop-computers"
                className="px-3 py-3 hover:text-cyan-400 hover:bg-slate-900/60 rounded-md transition-colors"
              >
                Desktop PCs
              </a>
              <a
                href="/shop?category=networking"
                className="px-3 py-3 hover:text-cyan-400 hover:bg-slate-900/60 rounded-md transition-colors"
              >
                Networking
              </a>
              <a
                href="/shop?category=cctv-surveillance"
                className="px-3 py-3 hover:text-cyan-400 hover:bg-slate-900/60 rounded-md transition-colors"
              >
                CCTV
              </a>
              <a
                href="/shop?category=structured-cabling"
                className="px-3 py-3 hover:text-cyan-400 hover:bg-slate-900/60 rounded-md transition-colors"
              >
                Structured Cabling
              </a>
              <a
                href="/shop?category=hardware-maintenance"
                className="px-3 py-3 hover:text-cyan-400 hover:bg-slate-900/60 rounded-md transition-colors"
              >
                Repairs & Maintenance
              </a>
              <a
                href="/shop?category=office-supplies"
                className="px-3 py-3 hover:text-cyan-400 hover:bg-slate-900/60 rounded-md transition-colors"
              >
                Office Supplies
              </a>
            </nav>
          </div>

          {/* Quick Highlight Pills (Flash Deals & Blog) */}
          <div className="flex items-center gap-3 text-xs">
            <a
              href="/shop?flashDeal=true"
              className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-bold px-2.5 py-1 rounded-full bg-amber-950/40 border border-amber-500/30 transition-colors"
            >
              <Flame className="w-3.5 h-3.5 animate-pulse" />
              <span>Flash Deals</span>
            </a>
            <a
              href="/news"
              className="flex items-center gap-1.5 text-slate-300 hover:text-cyan-300 font-semibold px-2 py-1 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tech News & Guides</span>
            </a>
          </div>
        </div>
      </div>

      {/* 4. MOBILE NAVIGATION DRAWER */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-[110px] bg-slate-950/95 backdrop-blur-md z-50 p-4 overflow-y-auto overscroll-contain space-y-4 animate-in slide-in-from-left duration-200">
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3 py-1">
              Shop Categories
            </div>
            {[
              { label: 'All Products & Services', href: '/shop' },
              { label: 'Brand New Laptops', href: '/shop?category=brand-new-laptops' },
              { label: 'Ex-UK Laptops', href: '/shop?category=ex-uk-laptops' },
              { label: 'Desktop Computers', href: '/shop?category=desktop-computers' },
              { label: 'Computer Accessories', href: '/shop?category=computer-accessories' },
              { label: 'Computer Components', href: '/shop?category=computer-components' },
              { label: 'Networking', href: '/shop?category=networking' },
              { label: 'Structured Cabling', href: '/shop?category=structured-cabling' },
              { label: 'CCTV & Surveillance', href: '/shop?category=cctv-surveillance' },
              { label: 'Screen Replacement', href: '/shop?category=screen-replacement' },
              { label: 'Hardware Maintenance', href: '/shop?category=hardware-maintenance' },
              { label: 'Software Maintenance', href: '/shop?category=software-maintenance' },
              { label: 'Office Supplies', href: '/shop?category=office-supplies' }
            ].map((link, idx) => (
              <a
                key={idx}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:text-cyan-400 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-3">
              Customer Center
            </div>
            <a
              href="/track-order"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm text-slate-300 hover:text-white"
            >
              Track Your Order
            </a>
            <a
              href="/store-locator"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm text-slate-300 hover:text-white"
            >
              Store Locations & Hours
            </a>
            <a
              href="/news"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm text-slate-300 hover:text-white"
            >
              Tech News & Guides
            </a>
            <a
              href="/blog"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm text-slate-300 hover:text-white"
            >
              Buying Guides & Reviews
            </a>
            <a
              href="/contact"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm text-slate-300 hover:text-white"
            >
              Contact Support
            </a>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between px-3">
            <span className="text-xs font-bold text-slate-300">Display Appearance</span>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-200 hover:text-cyan-400"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-cyan-400" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800 flex gap-2">
            <a
              href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Chat</span>
            </a>
            <a
              href={`tel:${settings.phone}`}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" />
              <span>Call Us</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
