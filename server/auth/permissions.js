// Centralized RBAC capability map. The backend is the only authority on this —
// the frontend mirror (src/auth/permissions.ts) is for hiding UI only.
//
// Convention: "<resource>:<action>". "_own" suffix means scoped to the
// requester's own records (enforced in the route handler, not just here).

export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  SALES_MANAGER: 'SALES_MANAGER',
  CUSTOMER: 'CUSTOMER'
});

const ADMIN_PERMISSIONS = [
  'users:read', 'users:create', 'users:update', 'users:deactivate',
  'roles:assign', 'roles:revoke',
  'invites:create', 'invites:read', 'invites:revoke',
  'products:read', 'products:create', 'products:update', 'products:delete',
  'categories:read', 'categories:write',
  'brands:read', 'brands:write',
  'inventory:read', 'inventory:update',
  'orders:read', 'orders:update_status', 'orders:cancel',
  'coupons:read', 'coupons:write',
  'invoices:read', 'invoices:create',
  'receipts:read', 'receipts:create',
  'reports:read',
  'settings:read', 'settings:update',
  'audit_logs:read',
  'reviews:read', 'reviews:moderate',
  'tickets:read', 'tickets:respond',
  'customers:read',
  'blog:write',
  'newsletter:read',
  'payments:read', 'payments:refund',
  'flash_deals:read', 'flash_deals:write',
  'delivery:read', 'delivery:write',
  'referrals:read', 'referrals:write',
  'news:read', 'news:write'
];

const SALES_MANAGER_PERMISSIONS = [
  'products:read', 'products:update', // stock/price adjustments, not create/delete
  'categories:read',
  'brands:read',
  'inventory:read', 'inventory:update',
  'orders:read', 'orders:update_status', 'orders:cancel',
  'coupons:read',
  'invoices:read', 'invoices:create',
  'receipts:read', 'receipts:create',
  'reports:read',
  'reviews:read',
  'tickets:read', 'tickets:respond',
  'customers:read',
  'payments:read',
  'flash_deals:read',
  'delivery:read',
  'news:read', 'news:write',
  'orders:read_own', 'invoices:read_own', 'receipts:read_own',
  'cart:manage_own', 'profile:read_own', 'profile:update_own'
];

const CUSTOMER_PERMISSIONS = [
  'products:read', 'categories:read', 'brands:read',
  'orders:create', 'orders:read_own',
  'invoices:read_own', 'receipts:read_own',
  'tickets:create', 'tickets:read_own',
  'reviews:read', 'reviews:create', 'reviews:update_own',
  'referrals:use',
  'cart:manage_own', 'profile:read_own', 'profile:update_own'
];

export const PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: ADMIN_PERMISSIONS,
  [ROLES.SALES_MANAGER]: SALES_MANAGER_PERMISSIONS,
  [ROLES.CUSTOMER]: CUSTOMER_PERMISSIONS
});

export function can(role, permission) {
  if (!role || !permission) return false;
  const granted = PERMISSIONS[role];
  return Array.isArray(granted) && granted.includes(permission);
}

export function isValidRole(role) {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, role);
}
