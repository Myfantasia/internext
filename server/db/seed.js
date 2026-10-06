#!/usr/bin/env node
// Seeds Postgres with the real Internext Business System catalog, company
// profile, delivery zones, and coupons. Safe to re-run — uses upserts on
// natural keys (slug/code) rather than blind inserts.
//
// This replaces the old JSON store's fictional "NexusTech" demo catalog
// (phones, gaming consoles) with the business's actual product/service
// lines, since migrating the fictional data into Postgres just to replace
// it in a later rebrand pass would be wasted, misleading work.

import 'dotenv/config';
import { db, rawSql } from './client.js';
import { categories, brands, products, companyProfile, deliveryZones, deliveryRateBands, stores, coupons } from './schema.js';
import { sql } from 'drizzle-orm';
import { PRODUCT_DETAILS } from '../data/productDetails.js';

const CATEGORIES = [
  { slug: 'brand-new-laptops', name: 'Brand New Laptops', kind: 'product', sortOrder: 1,
    description: 'Sealed, brand-new business and consumer laptops with full manufacturer warranty.' },
  { slug: 'ex-uk-laptops', name: 'Ex-UK Laptops', kind: 'product', sortOrder: 2,
    description: 'Grade-A refurbished ex-UK laptops — inspected, cleaned, and warrantied.' },
  { slug: 'desktop-computers', name: 'Desktop Computers', kind: 'product', sortOrder: 3,
    description: 'Business desktops and workstations, brand-new and refurbished.' },
  { slug: 'computer-accessories', name: 'Computer Accessories', kind: 'product', sortOrder: 4,
    description: 'Keyboards, mice, bags, monitors, chargers, and everyday computing accessories.' },
  { slug: 'computer-components', name: 'Computer Components', kind: 'product', sortOrder: 5,
    description: 'RAM, storage, power supplies, and internal upgrade parts.' },
  { slug: 'networking', name: 'Networking', kind: 'product', sortOrder: 6,
    description: 'Routers, switches, access points, and networking hardware.' },
  { slug: 'structured-cabling', name: 'Structured Cabling', kind: 'service', sortOrder: 7,
    description: 'Network planning, design, and structured cabling implementation for offices.' },
  { slug: 'cctv-surveillance', name: 'CCTV & Surveillance', kind: 'product', sortOrder: 8,
    description: 'CCTV camera kits, DVRs/NVRs, and surveillance installation.' },
  { slug: 'screen-replacement', name: 'Screen Replacement', kind: 'service', sortOrder: 9,
    description: 'Laptop and monitor screen replacement services.' },
  { slug: 'hardware-maintenance', name: 'Hardware Maintenance', kind: 'service', sortOrder: 10,
    description: 'Diagnostics, repair, and maintenance contracts for computer hardware.' },
  { slug: 'software-maintenance', name: 'Software Maintenance', kind: 'service', sortOrder: 11,
    description: 'OS installation, software setup, and system maintenance services.' },
  { slug: 'office-supplies', name: 'General Office Supplies', kind: 'product', sortOrder: 12,
    description: 'Printers, paper, ink/toner, and everyday office consumables.' }
];

const BRANDS = [
  { slug: 'hp', name: 'HP' },
  { slug: 'dell', name: 'Dell' },
  { slug: 'lenovo', name: 'Lenovo' },
  { slug: 'apple', name: 'Apple' },
  { slug: 'tp-link', name: 'TP-Link' },
  { slug: 'ubiquiti', name: 'Ubiquiti' },
  { slug: 'hikvision', name: 'Hikvision' },
  { slug: 'dahua', name: 'Dahua' },
  { slug: 'apc', name: 'APC' },
  { slug: 'kingston', name: 'Kingston' },
  { slug: 'logitech', name: 'Logitech' },
  { slug: 'canon', name: 'Canon' },
  { slug: 'internext', name: 'Internext Business System' }
];

const IMG = {
  laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&auto=format&fit=crop&q=80',
  laptop2: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80',
  desktop: 'https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=800&auto=format&fit=crop&q=80',
  accessory: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
  keyboard: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
  monitor: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80',
  ram: 'https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=800&auto=format&fit=crop&q=80',
  router: 'https://images.unsplash.com/photo-1606904825846-647eb07f5be2?w=800&auto=format&fit=crop&q=80',
  switch: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
  cable: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80',
  cctv: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=800&auto=format&fit=crop&q=80',
  service: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&auto=format&fit=crop&q=80',
  printer: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=800&auto=format&fit=crop&q=80',
  paper: 'https://images.unsplash.com/photo-1568205612837-017257d2310a?w=800&auto=format&fit=crop&q=80',
  ups: 'https://images.unsplash.com/photo-1591405351990-4726e331f141?w=800&auto=format&fit=crop&q=80'
};

// [name, brandSlug, categorySlug, sku, price, compareAtPrice, stock, condition, warranty, shortSpecs, description, thumbnail, isFeatured]
const PRODUCTS = [
  ['HP ProBook 450 G10 Business Laptop', 'hp', 'brand-new-laptops', 'HP-PB450G10', 95000, 105000, 8, 'Brand New Sealed', '1 Year HP Warranty', 'Intel Core i5-1334U | 8GB RAM | 512GB SSD | 15.6" FHD', 'Reliable business laptop built for everyday productivity, with a full-size keyboard and all-day battery life.', IMG.laptop, true],
  ['Dell Latitude 5440 Business Laptop', 'dell', 'brand-new-laptops', 'DELL-LAT5440', 135000, 148000, 5, 'Brand New Sealed', '1 Year Dell ProSupport', 'Intel Core i7-1355U | 16GB RAM | 512GB SSD | 14" FHD', 'Premium business-class Latitude with enterprise security features and a lightweight chassis.', IMG.laptop2, true],
  ['Lenovo ThinkPad E14 Gen 5', 'lenovo', 'brand-new-laptops', 'LEN-E14G5', 88000, 96000, 10, 'Brand New Sealed', '1 Year Lenovo Warranty', 'Intel Core i5-1335U | 8GB RAM | 256GB SSD | 14" FHD', 'The legendary ThinkPad keyboard and durability, priced for everyday office use.', IMG.laptop, false],
  ['HP EliteBook 840 G9', 'hp', 'brand-new-laptops', 'HP-EB840G9', 145000, 158000, 4, 'Brand New Sealed', '1 Year HP Warranty', 'Intel Core i7-1265U | 16GB RAM | 512GB SSD | 14" FHD Touch', 'Premium executive ultrabook with a magnesium chassis and vivid touch display.', IMG.laptop2, true],
  ['HP EliteBook 840 G5 (Ex-UK)', 'hp', 'ex-uk-laptops', 'HP-EB840G5-UK', 42000, 52000, 12, 'Ex-UK Grade A', '6 Months Internext Warranty', 'Intel Core i5-8350U | 8GB RAM | 256GB SSD | 14" FHD', 'Inspected and cleaned ex-UK EliteBook — excellent cosmetic condition, fully tested.', IMG.laptop, true],
  ['Dell Latitude 7490 (Ex-UK)', 'dell', 'ex-uk-laptops', 'DELL-LAT7490-UK', 58000, 70000, 9, 'Ex-UK Grade A', '6 Months Internext Warranty', 'Intel Core i7-8650U | 16GB RAM | 512GB SSD | 14" FHD', 'High-spec ex-UK Latitude, ideal for demanding office multitasking at a fraction of new price.', IMG.laptop2, true],
  ['Lenovo ThinkPad T480 (Ex-UK)', 'lenovo', 'ex-uk-laptops', 'LEN-T480-UK', 39000, 48000, 14, 'Ex-UK Grade A', '6 Months Internext Warranty', 'Intel Core i5-8350U | 8GB RAM | 256GB SSD | 14" FHD', 'The most requested ex-UK ThinkPad — spill-resistant keyboard and legendary build quality.', IMG.laptop, false],
  ['HP ProBook 640 G4 (Ex-UK)', 'hp', 'ex-uk-laptops', 'HP-PB640G4-UK', 35000, 43000, 11, 'Ex-UK Grade B', '3 Months Internext Warranty', 'Intel Core i5-8250U | 8GB RAM | 500GB HDD | 14" HD', 'Budget-friendly ex-UK option for general office tasks and web-based work.', IMG.laptop2, false],
  ['HP EliteDesk 800 G4 SFF Desktop', 'hp', 'desktop-computers', 'HP-ED800G4', 55000, 62000, 6, 'Brand New Sealed', '1 Year HP Warranty', 'Intel Core i5-8500 | 8GB RAM | 256GB SSD | Small Form Factor', 'Compact, quiet office desktop that fits anywhere — full Windows 11 Pro support.', IMG.desktop, false],
  ['Dell OptiPlex 7080 Desktop', 'dell', 'desktop-computers', 'DELL-OP7080', 78000, 88000, 5, 'Brand New Sealed', '1 Year Dell Warranty', 'Intel Core i7-10700 | 16GB RAM | 512GB SSD | Micro Tower', 'Powerful workstation-class desktop for design, accounting, and multitasking teams.', IMG.desktop, true],
  ['Internext Custom Office Desktop', 'internext', 'desktop-computers', 'INX-OFFICE-I3', 38000, null, 15, 'Brand New', '1 Year Internext Warranty', 'Intel Core i3-10100 | 8GB RAM | 500GB HDD', 'Assembled and tested in-house — reliable, affordable desktops for general office use.', IMG.desktop, false],
  ['Logitech MK270 Wireless Combo', 'logitech', 'computer-accessories', 'LOG-MK270', 2800, 3200, 40, 'Brand New', '1 Year Logitech Warranty', 'Wireless Keyboard & Mouse Combo | 2.4GHz USB Receiver', 'Reliable wireless keyboard and mouse combo for everyday office use.', IMG.keyboard, false],
  ['HP 65W Universal Laptop Charger', 'hp', 'computer-accessories', 'HP-CHG65W', 1800, null, 60, 'Brand New', '6 Months Warranty', 'Universal 65W | Multiple Tips Included', 'Compatible replacement charger for most HP, Dell, and Lenovo ultrabooks.', IMG.accessory, false],
  ['Targus 15.6" Laptop Bag', 'internext', 'computer-accessories', 'TGT-BAG156', 3500, 4200, 25, 'Brand New', '—', 'Padded Laptop Compartment | Water-Resistant', 'Durable, padded laptop bag with organizer pockets for cables and accessories.', IMG.accessory, false],
  ['Dell 24" FHD Monitor', 'dell', 'computer-accessories', 'DELL-MON24', 18500, 21000, 10, 'Brand New Sealed', '1 Year Dell Warranty', '24" IPS FHD | HDMI & VGA', 'Crisp, color-accurate display ideal for office and light design work.', IMG.monitor, true],
  ['Kingston 8GB DDR4 RAM', 'kingston', 'computer-components', 'KGN-8GB-DDR4', 3200, null, 50, 'Brand New', 'Lifetime Kingston Warranty', '8GB DDR4 2666MHz', 'Reliable memory upgrade to speed up sluggish laptops and desktops.', IMG.ram, false],
  ['Crucial 480GB SATA SSD', 'internext', 'computer-components', 'CRU-480-SSD', 4800, 5500, 30, 'Brand New', '3 Year Warranty', '480GB SATA III 2.5"', 'Drop-in SSD upgrade — dramatically faster boot and load times over a hard disk.', IMG.ram, true],
  ['APC Back-UPS 650VA', 'apc', 'computer-components', 'APC-BU650', 6500, 7500, 20, 'Brand New Sealed', '1 Year APC Warranty', '650VA / 360W | Surge Protection', 'Keeps desktops and networking gear running through short power interruptions.', IMG.ups, false],
  ['TP-Link Archer C6 AC1200 Router', 'tp-link', 'networking', 'TPL-C6', 4500, 5200, 35, 'Brand New Sealed', '2 Year TP-Link Warranty', 'AC1200 Dual-Band | 4 Gigabit LAN Ports', 'Dependable dual-band router for home and small office WiFi coverage.', IMG.router, true],
  ['Ubiquiti UniFi AP AC Lite', 'ubiquiti', 'networking', 'UBQ-APACLITE', 12500, null, 18, 'Brand New Sealed', '1 Year Ubiquiti Warranty', '2x2 MIMO | PoE Powered', 'Enterprise-grade WiFi access point for offices needing reliable, managed coverage.', IMG.router, true],
  ['TP-Link 24-Port Gigabit Switch', 'tp-link', 'networking', 'TPL-SW24', 15000, 17500, 12, 'Brand New Sealed', '2 Year TP-Link Warranty', '24-Port 10/100/1000Mbps Unmanaged', 'High-capacity switch for growing office networks and structured cabling installs.', IMG.switch, false],
  ['Cat6 UTP Cable (305m Box)', 'internext', 'structured-cabling', 'CAB-CAT6-305', 8500, null, 25, 'Brand New', '—', '305m Box | Solid Copper Conductors', 'Bulk Cat6 cabling for structured cabling and network installation projects.', IMG.cable, false],
  ['Structured Cabling Installation (Per Point)', 'internext', 'structured-cabling', 'SVC-CABLE-POINT', 2500, null, 999, 'Service', '90-Day Workmanship Warranty', 'Per network/data point | Certified installation', 'Professional structured cabling installation, terminated and tested per point.', IMG.service, false],
  ['Network Planning & Design Consultation', 'internext', 'structured-cabling', 'SVC-NET-DESIGN', 15000, null, 999, 'Service', '—', 'Site survey included', 'On-site assessment and network design for new or expanding office spaces.', IMG.service, true],
  ['Full Network Implementation (Up to 20 Points)', 'internext', 'structured-cabling', 'SVC-NET-IMPL-20', 180000, null, 999, 'Service', '1 Year Workmanship Warranty', 'Planning, cabling, and equipment installation for a small office', 'End-to-end network implementation: planning, structured cabling, switches, and WiFi.', IMG.service, true],
  ['Hikvision 4-Channel HD CCTV Kit', 'hikvision', 'cctv-surveillance', 'HIK-4CH-KIT', 32000, 38000, 10, 'Brand New Sealed', '2 Year Hikvision Warranty', '4 Cameras + DVR + 1TB HDD', 'Complete entry-level CCTV kit with night vision cameras and a 1TB recorder.', IMG.cctv, true],
  ['Dahua 8-Channel IP CCTV Kit', 'dahua', 'cctv-surveillance', 'DAH-8CH-KIT', 68000, 78000, 6, 'Brand New Sealed', '2 Year Dahua Warranty', '8 IP Cameras + NVR + 2TB HDD', 'High-resolution IP surveillance kit for medium-sized offices and compounds.', IMG.cctv, true],
  ['Hikvision 2MP Dome Camera (Single)', 'hikvision', 'cctv-surveillance', 'HIK-2MP-DOME', 4500, null, 40, 'Brand New Sealed', '2 Year Hikvision Warranty', '2MP | Night Vision | IP66', 'Add-on dome camera compatible with most Hikvision DVR/NVR kits.', IMG.cctv, false],
  ['CCTV Installation & Setup (Per Camera)', 'internext', 'cctv-surveillance', 'SVC-CCTV-INSTALL', 3000, null, 999, 'Service', '90-Day Workmanship Warranty', 'Per camera | Includes cable run and configuration', 'Professional installation and configuration for CCTV camera systems.', IMG.service, false],
  ['Laptop Screen Replacement (13"-14")', 'internext', 'screen-replacement', 'SVC-SCR-1314', 6500, null, 999, 'Service', '90-Day Parts Warranty', 'Most brands supported', 'Genuine-compatible replacement screens fitted for 13"-14" laptops.', IMG.service, false],
  ['Laptop Screen Replacement (15"-17")', 'internext', 'screen-replacement', 'SVC-SCR-1517', 8500, null, 999, 'Service', '90-Day Parts Warranty', 'Most brands supported', 'Genuine-compatible replacement screens fitted for 15"-17" laptops.', IMG.service, true],
  ['Desktop Monitor Repair', 'internext', 'screen-replacement', 'SVC-MON-REPAIR', 3500, null, 999, 'Service', '30-Day Workmanship Warranty', 'Diagnostic included', 'Repair service for desktop monitors — backlight, panel, and power issues.', IMG.service, false],
  ['Computer Hardware Diagnostic & Repair', 'internext', 'hardware-maintenance', 'SVC-HW-DIAG', 2500, null, 999, 'Service', '30-Day Workmanship Warranty', 'Full diagnostic included', 'Fault-finding and repair for laptops and desktops — hardware issues of any kind.', IMG.service, false],
  ['Annual Hardware Maintenance Contract (Per Device)', 'internext', 'hardware-maintenance', 'SVC-HW-CONTRACT', 8000, null, 999, 'Service', '12-Month Contract', 'Quarterly checkups included', 'Scheduled preventive maintenance to keep office hardware running reliably all year.', IMG.service, true],
  ['OS Installation & Software Setup', 'internext', 'software-maintenance', 'SVC-SW-SETUP', 2000, null, 999, 'Service', '7-Day Support', 'Windows/Office activation included', 'Clean OS install and essential software setup for a fresh, fast computer.', IMG.service, false],
  ['Virus Removal & System Optimization', 'internext', 'software-maintenance', 'SVC-SW-CLEANUP', 1800, null, 999, 'Service', '7-Day Support', 'Full malware scan included', 'Removes malware and optimizes a slow or infected computer back to full speed.', IMG.service, false],
  ['Annual Software Maintenance Contract (Per Device)', 'internext', 'software-maintenance', 'SVC-SW-CONTRACT', 6000, null, 999, 'Service', '12-Month Contract', 'Remote support included', 'Ongoing software updates, patching, and remote support for the year.', IMG.service, true],
  ['HP LaserJet Pro M404dn Printer', 'hp', 'office-supplies', 'HP-M404DN', 32000, 36000, 8, 'Brand New Sealed', '1 Year HP Warranty', 'Monochrome Laser | Duplex | Network Ready', 'Fast, reliable office laser printer built for daily high-volume printing.', IMG.printer, true],
  ['A4 Copy Paper (Ream, 500 Sheets)', 'internext', 'office-supplies', 'OFF-A4-REAM', 650, null, 200, 'Brand New', '—', '80gsm | 500 Sheets', 'Everyday A4 printing paper for office use.', IMG.paper, false],
  ['Canon Ink Cartridge Set', 'canon', 'office-supplies', 'CAN-INK-SET', 3200, null, 45, 'Brand New Sealed', '—', 'Black + Tri-Color Set', 'Genuine-compatible ink cartridge set for Canon inkjet printers.', IMG.printer, false]
];

// Structured specs are derived ONLY from each product's own listing line
// (shortSpecs) plus its condition/warranty — nothing is added that the shop
// hasn't stated. Admins can enrich specs from manufacturer datasheets in the
// product editor.
function specsFromListing(categorySlug, shortSpecs, { condition, warranty, brandName }) {
  const parts = String(shortSpecs || '').split('|').map((p) => p.trim()).filter(Boolean);
  const general = {};
  if (brandName && brandName !== 'Internext Business System') general.Brand = brandName;
  if (condition) general.Condition = condition;
  if (warranty && warranty !== '—') general.Warranty = warranty;

  const isComputer = ['brand-new-laptops', 'ex-uk-laptops', 'desktop-computers'].includes(categorySlug);
  if (!isComputer) {
    return Object.keys(general).length || parts.length
      ? { General: general, ...(parts.length ? { 'Key Features': Object.fromEntries(parts.map((p, i) => [`Feature ${i + 1}`, p])) } : {}) }
      : {};
  }

  const perf = {};
  const display = {};
  const other = {};
  for (const part of parts) {
    if (/\b(intel|amd|core|ryzen|celeron|pentium)\b/i.test(part)) perf.Processor = part;
    else if (/\bRAM\b/i.test(part)) perf.Memory = part.replace(/\s*RAM\b/i, '').trim();
    else if (/\b(SSD|HDD|NVMe|eMMC)\b/i.test(part)) perf.Storage = part;
    else if (/["”]|\binch\b/i.test(part)) display.Screen = part;
    else if (/form factor|tower/i.test(part)) other['Form Factor'] = part;
    else other[`Feature ${Object.keys(other).length + 1}`] = part;
  }
  return Object.fromEntries(Object.entries({ General: general, Performance: perf, Display: display, Other: other }).filter(([, v]) => Object.keys(v).length));
}

async function run() {
  console.log('Seeding company profile…');
  const existingProfile = await db.select().from(companyProfile).limit(1);
  const profileData = {
    name: 'Internext Business System',
    tagline: 'We Make Technology Happen',
    poBox: 'P.O. Box 16806-00100, Nairobi, Kenya',
    address: 'Princely House, 1st Floor, Moi Avenue, Nairobi',
    phonePrimary: '+254 722 664 457',
    phoneSecondary: '+254 726 237 204',
    email: 'info@internextbusinesssystem.co.ke',
    supportEmail: 'info@internextbusinesssystem.co.ke',
    whatsappNumber: '+254722664457',
    website: 'https://internextbusinesssystem.co.ke',
    socialLinks: {},
    currency: 'KES',
    currencySymbol: 'KES ',
    taxRate: '16',
    pricesIncludeTax: true,
    freeShippingThreshold: '50000',
    mpesaPaybill: '',
    mpesaAccountNo: '',
    mpesaTill: ''
  };
  if (existingProfile.length) {
    await db.update(companyProfile).set(profileData).where(sql`id = ${existingProfile[0].id}`);
  } else {
    await db.insert(companyProfile).values(profileData);
  }

  console.log('Seeding delivery options…');
  // Store pickup is a fixed option; everything else is priced by distance
  // bands below. Existing options are left alone so admin edits survive re-seeding.
  const existingOptions = await db.select().from(deliveryZones);
  if (!existingOptions.some((z) => z.kind === 'pickup')) {
    await db.insert(deliveryZones).values({
      name: 'Free Pickup — Princely House, Moi Avenue', kind: 'pickup', fee: '0', estimatedTime: 'Ready in 30 mins',
      description: 'Collect from our office on Moi Avenue, Nairobi CBD. Bring your order number.', sortOrder: 0
    });
  }

  console.log('Seeding delivery distance bands (starting values — adjust under Admin → Delivery Pricing)…');
  const existingBands = await db.select().from(deliveryRateBands);
  if (!existingBands.length) {
    await db.insert(deliveryRateBands).values([
      { name: 'Within 5 km', description: 'Nairobi CBD and immediate surroundings.', minKm: '0', maxKm: '5', fee: '300', freeThreshold: '50000', estimatedTime: '2-4 hours', sortOrder: 1 },
      { name: '5 - 15 km', description: 'Most Nairobi suburbs.', minKm: '5', maxKm: '15', fee: '500', freeThreshold: '60000', estimatedTime: 'Same day', sortOrder: 2 },
      { name: '15 - 40 km', description: 'Greater Nairobi and nearby towns.', minKm: '15', maxKm: '40', fee: '900', freeThreshold: '80000', estimatedTime: 'Same day / next morning', sortOrder: 3 },
      { name: '40 - 150 km', description: 'Neighbouring counties via courier.', minKm: '40', maxKm: '150', fee: '1200', estimatedTime: '1-2 days', sortOrder: 4 },
      { name: 'Over 150 km', description: 'Upcountry courier delivery.', minKm: '150', maxKm: null, fee: '1800', estimatedTime: '2-3 days', sortOrder: 5 }
    ]);
  }

  console.log('Seeding store location…');
  await db.delete(stores);
  await db.insert(stores).values([
    {
      name: 'Internext Business System — Head Office',
      address: 'Princely House, 1st Floor, Moi Avenue',
      city: 'Nairobi',
      phone: '+254 722 664 457',
      hours: 'Mon - Fri: 8:00 AM - 6:00 PM | Sat: 9:00 AM - 2:00 PM',
      services: ['Sales', 'CCTV & Network Installation', 'Hardware & Software Repair', 'Collection Point']
    }
  ]);

  console.log('Seeding coupons…');
  // Upsert by code — never delete: referral reward coupons live in this table too.
  for (const coupon of [
    { code: 'WELCOME5', discountType: 'percentage', discountValue: '5', minOrderAmount: '10000', maxDiscountAmount: '5000', perUserLimit: 1, isActive: true, description: '5% off your first order over KES 10,000 (once per customer)' },
    { code: 'BULK10', discountType: 'percentage', discountValue: '10', minOrderAmount: '100000', maxDiscountAmount: '20000', isActive: true, description: '10% off bulk office equipment orders over KES 100,000' }
  ]) {
    await db.insert(coupons).values(coupon).onConflictDoUpdate({ target: coupons.code, set: { description: coupon.description, perUserLimit: coupon.perUserLimit ?? null } });
  }

  console.log('Seeding categories…');
  const categoryIdBySlug = {};
  for (const cat of CATEGORIES) {
    const [row] = await db
      .insert(categories)
      .values(cat)
      .onConflictDoUpdate({ target: categories.slug, set: { name: cat.name, kind: cat.kind, description: cat.description, sortOrder: cat.sortOrder } })
      .returning();
    categoryIdBySlug[cat.slug] = row.id;
  }

  console.log('Seeding brands…');
  const brandIdBySlug = {};
  for (const b of BRANDS) {
    const [row] = await db
      .insert(brands)
      .values(b)
      .onConflictDoUpdate({ target: brands.slug, set: { name: b.name } })
      .returning();
    brandIdBySlug[b.slug] = row.id;
  }

  console.log('Seeding products…');
  for (const [name, brandSlug, categorySlug, sku, price, compareAtPrice, stock, condition, warranty, shortSpecs, description, thumbnailUrl, isFeatured] of PRODUCTS) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const details = PRODUCT_DETAILS[sku];
    const listingSpecs = specsFromListing(categorySlug, shortSpecs, { condition, warranty, brandName: BRANDS.find((b) => b.slug === brandSlug)?.name });
    const values = {
      name, slug, sku,
      brandId: brandIdBySlug[brandSlug] || null,
      categoryId: categoryIdBySlug[categorySlug],
      shortSpecs,
      description: details?.description || description,
      price: String(price),
      compareAtPrice: compareAtPrice ? String(compareAtPrice) : null,
      condition, warranty, stock,
      thumbnailUrl,
      images: [thumbnailUrl],
      specs: details ? { ...(listingSpecs.General ? { General: listingSpecs.General } : {}), ...details.specs } : listingSpecs,
      isFeatured: !!isFeatured
    };
    await db
      .insert(products)
      .values(values)
      .onConflictDoUpdate({
        target: products.sku,
        set: { name, slug, categoryId: values.categoryId, brandId: values.brandId, price: values.price, compareAtPrice: values.compareAtPrice, condition, warranty, shortSpecs, description: values.description, thumbnailUrl, images: values.images, specs: values.specs, isFeatured: values.isFeatured }
      });
  }

  console.log(`Done. Seeded ${CATEGORIES.length} categories, ${BRANDS.length} brands, ${PRODUCTS.length} products/services.`);
  await rawSql.end();
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
