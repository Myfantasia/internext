import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, Category, Brand, StoreSettings, DeliveryZone, StoreLocation } from '../types';

interface StoreContextType {
  products: Product[];
  categories: Category[];
  brands: Brand[];
  settings: StoreSettings;
  deliveryZones: DeliveryZone[];
  stores: StoreLocation[];
  currency: 'KES' | 'USD';
  setCurrency: (c: 'KES' | 'USD') => void;
  formatPrice: (amountInKes: number) => string;
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  refreshProducts: () => Promise<void>;
  /** Re-fetches products, categories and brands (after admin catalog edits). */
  refreshCatalog: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
}

const defaultSettings: StoreSettings = {
  storeName: "Internext Business System",
  tagline: "We Make Technology Happen",
  phone: "+254 722 664 457",
  altPhone: "+254 726 237 204",
  email: "info@internextbusinesssystem.co.ke",
  supportEmail: "info@internextbusinesssystem.co.ke",
  whatsappNumber: "+254722664457",
  address: "Princely House, 1st Floor, Moi Avenue, Nairobi, P.O. Box 16806-00100",
  currency: "KES",
  currencySymbol: "KES ",
  taxRate: 16,
  pricesIncludeTax: true,
  freeShippingThreshold: 50000,
  mpesaPaybill: "",
  mpesaAccountNo: "",
  mpesaTill: "",
  theme: {
    primaryColor: "#0b132b",
    secondaryColor: "#1c2541",
    accentColor: "#0284c7",
    highlightColor: "#06b6d4"
  },
  socialLinks: {
    facebook: "",
    instagram: "",
    twitter: "",
    tiktok: "",
    youtube: ""
  }
};

import {
  initialSettings,
  initialDeliveryZones,
  initialStores,
  initialCategories,
  initialBrands,
  initialProducts
} from '../data/mockData';

const StoreContext = createContext<StoreContextType | undefined>(undefined);
const normalizeDeliveryZones = (zones: DeliveryZone[]): DeliveryZone[] =>  zones.map((zone) => ({    ...zone,    fee: Number(zone.fee),    freeThreshold: zone.freeThreshold == null ? undefined : Number(zone.freeThreshold)  }));

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [brands, setBrands] = useState<Brand[]>(initialBrands);
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>(initialDeliveryZones);
  const [stores, setStores] = useState<StoreLocation[]>(initialStores);
  const [currency, setCurrency] = useState<'KES' | 'USD'>('KES');
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchInitialData = async () => {
    try {
      // Safe fetch helper that only parses JSON if response is valid JSON
      const safeFetchJson = async (url: string) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return await res.json();
          }
          return null;
        } catch {
          return null;
        }
      };

      const [prodData, catData, brandData, settingsData] = await Promise.all([
        safeFetchJson('/api/products?limit=100'),
        safeFetchJson('/api/categories'),
        safeFetchJson('/api/brands'),
        safeFetchJson('/api/admin/settings/public')
      ]);

      if (prodData && prodData.products && prodData.products.length > 0) setProducts(prodData.products);
      if (catData && catData.categories && catData.categories.length > 0) setCategories(catData.categories);
      if (brandData && brandData.brands && brandData.brands.length > 0) setBrands(brandData.brands);
      if (settingsData && settingsData.settings) setSettings(settingsData.settings);
      if (settingsData && settingsData.deliveryZones) setDeliveryZones(normalizeDeliveryZones(settingsData.deliveryZones));
      if (settingsData && settingsData.stores) setStores(settingsData.stores);
    } catch (err) {
      console.warn("Using embedded store catalog data");
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const refreshProducts = async () => {
    try {
      const res = await fetch('/api/products?limit=100');
      const data = await res.json();
      if (data.products) setProducts(data.products);
    } catch (e) {
      console.error("Failed to refresh products:", e);
    }
  };

  const refreshCatalog = async () => {
    try {
      const [prodRes, catRes, brandRes] = await Promise.all([
        fetch('/api/products?limit=100'), fetch('/api/categories'), fetch('/api/brands')
      ]);
      const [prodData, catData, brandData] = await Promise.all([prodRes.json(), catRes.json(), brandRes.json()]);
      if (prodData?.products) setProducts(prodData.products);
      if (catData?.categories) setCategories(catData.categories);
      if (brandData?.brands) setBrands(brandData.brands);
    } catch (e) {
      console.error('Failed to refresh catalog:', e);
    }
  };

  const refreshSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings/public');
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
      if (data.deliveryZones) setDeliveryZones(normalizeDeliveryZones(data.deliveryZones));
      if (data.stores) setStores(data.stores);
    } catch (e) {
      console.error("Failed to refresh settings:", e);
    }
  };

  const updateSettings = async (newSettings: Partial<StoreSettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updated })
      });
    } catch (e) {
      console.error("Failed to update settings:", e);
    }
  };

  // Price formatting helper
  const formatPrice = (amountInKes: number): string => {
    if (isNaN(amountInKes)) return "KES 0";
    if (currency === 'USD') {
      const usdAmount = amountInKes / 130; // approx exchange rate
      return `$${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `KES ${Math.round(amountInKes).toLocaleString('en-KE')}`;
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        categories,
        brands,
        settings,
        deliveryZones,
        stores,
        currency,
        setCurrency,
        formatPrice,
        loading,
        searchQuery,
        setSearchQuery,
        refreshProducts,
        refreshCatalog,
        refreshSettings,
        updateSettings
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};
