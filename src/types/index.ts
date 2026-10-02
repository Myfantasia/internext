export type UserRole = 'ADMIN' | 'SALES_MANAGER' | 'CUSTOMER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  addresses?: Address[];
  isActive?: boolean;
  emailVerifiedAt?: string | null;
  referralCode?: string;
  createdAt?: string;
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  county: string;
  town: string;
  street: string;
  building?: string;
  isDefault?: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  storage?: string;
  ram?: string;
  color?: string;
  image?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  brandId?: string;
  category: string;
  categoryId?: string;
  subcategory?: string;
  sku: string;
  shortSpecs: string;
  price: number;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  rating: number;
  reviewsCount: number;
  stock: number;
  reservedStock?: number;
  reorderLevel?: number;
  condition: string;
  warranty: string;
  isFeatured?: boolean;
  isFlashDeal?: boolean;
  flashDealEnds?: string;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  thumbnail: string;
  images: string[];
  description: string;
  variants?: ProductVariant[];
  specs?: Record<string, Record<string, string>>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description: string;
  image: string;
  productCount: number;
  subcategories?: string[];
}

export interface Brand {
  id: string;
  name: string;
  logo: string;
  count: number;
}

export interface CartItem {
  productId: string;
  variantId?: string | null;
  name: string;
  variantName?: string | null;
  sku: string;
  price: number;
  compareAtPrice?: number | null;
  quantity: number;
  thumbnail: string;
  stock: number;
}

export interface Coupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  validFrom?: string;
  validUntil?: string;
  usageLimit?: number;
  usedCount?: number;
  isActive: boolean;
  description?: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  estimatedTime: string;
  freeThreshold?: number;
}

export interface StoreLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  hours: string;
  services: string[];
  coordinates?: { lat: number; lng: number };
}

export interface OrderItem {
  productId: string;
  variantId?: string | null;
  name: string;
  variantName?: string | null;
  sku: string;
  price: number;
  quantity: number;
  thumbnail: string;
}

export interface OrderTimelineItem {
  status: string;
  timestamp: string;
  note: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  couponCode?: string | null;
  deliveryFee: number;
  taxAmount: number;
  total: number;
  currency: string;
  status: 'Pending' | 'Payment Pending' | 'Processing' | 'Packed' | 'Dispatched' | 'Out for Delivery' | 'Delivered' | 'Cancelled' | 'Returned' | 'Refunded';
  paymentStatus: 'Pending' | 'Paid' | 'Failed' | 'Refunded' | 'Pending (Cash On Delivery)';
  paymentMethod: string;
  paymentReference?: string | null;
  paymentDetails?: any;
  deliveryMethod: string;
  deliveryAddress: {
    county?: string;
    town?: string;
    street?: string;
    building?: string;
    deliveryNotes?: string;
  };
  trackingNumber?: string;
  timeline: OrderTimelineItem[];
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  userName: string;
  userCity: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  verifiedPurchase: boolean;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  author: string;
  date: string;
  readTime: string;
  image: string;
  excerpt: string;
  content: string;
  tags: string[];
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  previousValue: string | null;
  newValue: string | null;
  ip: string | null;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subject: string;
  category: string;
  priority: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  assignedTo: string;
  messages: Array<{
    sender: 'customer' | 'staff';
    text: string;
    staffName?: string;
    timestamp: string;
  }>;
  createdAt: string;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  phone: string;
  altPhone: string;
  email: string;
  supportEmail: string;
  whatsappNumber: string;
  address: string;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  pricesIncludeTax: boolean;
  freeShippingThreshold: number;
  mpesaPaybill: string;
  mpesaAccountNo: string;
  mpesaTill: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    highlightColor: string;
  };
  socialLinks: {
    facebook: string;
    instagram: string;
    twitter: string;
    tiktok: string;
    youtube: string;
  };
}
