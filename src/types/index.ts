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
  location?: UserLocation | null;
  createdAt?: string;
}

export interface UserLocation {
  county: string;
  town: string;
  addressLine?: string | null;
  lat?: number | null;
  lng?: number | null;
  source?: 'gps' | 'map' | 'manual' | null;
}

export interface FlashDealInfo {
  id: string;
  title: string;
  description?: string | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  dealPrice: number;
  startsAt: string;
  endsAt: string;
  remaining: number | null;
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
  flashDeal?: FlashDealInfo | null;
  isActive?: boolean;
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
  flashDeal?: { id: string; title: string; endsAt: string } | null;
  quantity: number;
  thumbnail: string;
  stock: number;
}

export interface Coupon {
  id?: string;
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
  kind?: 'pickup' | 'fixed';
  description?: string | null;
  fee: number;
  estimatedTime: string;
  freeThreshold?: number;
  isActive?: boolean;
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
  shortDescription?: string | null;
  price: number;
  originalPrice?: number;
  flashDealId?: string | null;
  quantity: number;
  thumbnail: string;
}

export interface DeliveryQuote {
  mode: 'distance' | 'option';
  kind?: 'pickup' | 'fixed';
  optionId?: string;
  bandId?: string | null;
  label: string;
  fee: number;
  baseFee?: number;
  freeThreshold?: number | null;
  estimatedTime?: string | null;
  distanceKm: number | null;
  estimated: boolean;
  precision?: 'exact' | 'county';
}

export interface PaymentAttemptSummary {
  id: string;
  provider: 'mpesa' | 'stripe';
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded';
  reference?: string | null;
  failureReason?: string | null;
  createdAt: string;
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
  paymentStatus: 'Pending' | 'Paid' | 'Failed' | 'Refunded' | 'Pending (Cash On Delivery)' | 'Cancelled';
  paymentMethod: string;
  paymentReference?: string | null;
  paidAt?: string | null;
  latestPayment?: PaymentAttemptSummary | null;
  flashDealSavings?: number;
  taxRate?: number;
  deliveryMethod: string;
  deliveryAddress: {
    pickup?: boolean;
    county?: string;
    town?: string;
    street?: string;
    building?: string;
    deliveryNotes?: string;
    notes?: string;
  };
  deliveryQuote?: DeliveryQuote;
  deliveryDistanceKm?: number | null;
  userId?: string | null;
  /** Present when the viewer only has public tracking access. */
  limited?: boolean;
  itemCount?: number;
  trackingNumber?: string;
  timeline: OrderTimelineItem[];
  createdAt: string;
  /** How to pay an unpaid bank-transfer / pay-on-delivery order (owner & staff only). */
  paymentInstructions?: PaymentInstructions | null;
  /** A bank transfer the customer reported that staff have not reviewed yet. */
  pendingTransfer?: { id: string; reference: string; amount: number; paidOn: string | null; submittedAt: string } | null;
}

export interface BankDetails {
  bankName: string | null;
  branch: string | null;
  accountName: string | null;
  accountNumber: string;
  swiftCode: string | null;
  paybill: string | null;
  paybillAccount: string | null;
}

export type PaymentInstructions =
  | { kind: 'bank_transfer'; reference: string; amount: number; bank: BankDetails | null; holdHours: number; payBy: string }
  | { kind: 'cash_on_delivery'; amount: number; pickup: boolean; tillOrPaybill: string | null };

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
  status?: 'pending' | 'approved' | 'rejected';
  moderationNote?: string | null;
  productName?: string;
  productSlug?: string;
}

export interface RatingSummary {
  average: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
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

export type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export interface TicketMessage {
  id: string;
  sender: 'customer' | 'staff';
  senderName?: string | null;
  text: string;
  timestamp: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  orderNumber?: string | null;
  subject: string;
  category: string;
  priority: string;
  status: TicketStatus;
  assignedTo?: string | null;
  assignedToName?: string | null;
  /** Who should write next: staff when the customer spoke last. */
  awaiting: 'staff' | 'customer';
  lastMessageAt: string;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt?: string;
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
  kraPin?: string;
  receiptNotes?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankSwiftCode?: string;
  /** Hours an unpaid bank-transfer order keeps its stock reserved. */
  bankTransferHoldHours?: number;
  /** Largest order total allowed on pay on delivery (null = no cap). */
  codMaxOrderAmount?: number | null;
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
