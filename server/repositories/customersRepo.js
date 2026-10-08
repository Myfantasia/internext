import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { orders, orderItems, paymentAttempts, receipts, reviews, supportTickets, users, referralAttributions } from '../db/schema.js';
import { isUuid } from '../db/util.js';

// Staff view of customer accounts. Order figures are aggregated in SQL per
// page (never by loading every order into the app).

const OPEN_UNPAID = sql`${orders.paymentStatus} NOT IN ('Paid', 'Refunded', 'Cancelled') AND ${orders.status} <> 'Cancelled'`;

// Per-customer order totals, joined onto the users page.
const orderStats = db.select({
  userId: orders.userId,
  orderCount: sql`count(*)::int`.as('order_count'),
  paidCount: sql`count(*) filter (where ${orders.paymentStatus} = 'Paid')::int`.as('paid_count'),
  totalSpent: sql`coalesce(sum(${orders.total}) filter (where ${orders.paymentStatus} = 'Paid'), 0)::float`.as('total_spent'),
  outstanding: sql`coalesce(sum(${orders.total}) filter (where ${OPEN_UNPAID}), 0)::float`.as('outstanding'),
  lastOrderAt: sql`max(${orders.createdAt})`.as('last_order_at')
}).from(orders).where(sql`${orders.userId} IS NOT NULL`).groupBy(orders.userId).as('order_stats');

const SORTS = {
  newest: () => [desc(users.createdAt)],
  oldest: () => [asc(users.createdAt)],
  name: () => [asc(users.name)],
  spent: () => [desc(sql`coalesce(${orderStats.totalSpent}, 0)`)],
  orders: () => [desc(sql`coalesce(${orderStats.orderCount}, 0)`)],
  'last-order': () => [sql`${orderStats.lastOrderAt} DESC NULLS LAST`]
};

function customerConditions({ search, status, activity, registeredFrom, registeredTo }) {
  const conditions = [eq(users.role, 'CUSTOMER')];
  const q = String(search || '').trim().slice(0, 100);
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const digits = q.replace(/\D/g, '');
    const parts = [ilike(users.name, like), ilike(users.email, like)];
    // Phones are stored as 2547XXXXXXXX; "0712 345" should still match.
    if (digits.length >= 4) parts.push(ilike(users.phone, `%${digits.startsWith('0') ? digits.slice(1) : digits}%`));
    conditions.push(or(...parts));
  }
  if (status === 'active') conditions.push(eq(users.isActive, true));
  else if (status === 'inactive') conditions.push(eq(users.isActive, false));
  else if (status === 'unverified') conditions.push(isNull(users.emailVerifiedAt));
  if (activity === 'buyers') conditions.push(sql`coalesce(${orderStats.paidCount}, 0) > 0`);
  else if (activity === 'repeat') conditions.push(sql`coalesce(${orderStats.paidCount}, 0) > 1`);
  else if (activity === 'no-orders') conditions.push(sql`coalesce(${orderStats.orderCount}, 0) = 0`);
  else if (activity === 'owing') conditions.push(sql`coalesce(${orderStats.outstanding}, 0) > 0`);
  const from = registeredFrom ? new Date(registeredFrom) : null;
  const to = registeredTo ? new Date(registeredTo) : null;
  if (from && !Number.isNaN(from.getTime())) conditions.push(gte(users.createdAt, from));
  if (to && !Number.isNaN(to.getTime())) conditions.push(lte(users.createdAt, new Date(to.getTime() + 86399999)));
  return conditions;
}

export async function listCustomers(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(Math.max(5, parseInt(query.limit, 10) || 25), 100);
  const where = and(...customerConditions(query));
  const orderBy = (SORTS[query.sort] || SORTS.newest)();
  orderBy.push(asc(users.id));

  const base = () => db.select({
    id: users.id, name: users.name, email: users.email, phone: users.phone, isActive: users.isActive,
    emailVerifiedAt: users.emailVerifiedAt, county: users.county, town: users.town, createdAt: users.createdAt,
    orderCount: sql`coalesce(${orderStats.orderCount}, 0)::int`,
    paidCount: sql`coalesce(${orderStats.paidCount}, 0)::int`,
    totalSpent: sql`coalesce(${orderStats.totalSpent}, 0)::float`,
    outstanding: sql`coalesce(${orderStats.outstanding}, 0)::float`,
    lastOrderAt: orderStats.lastOrderAt
  }).from(users).leftJoin(orderStats, eq(orderStats.userId, users.id));

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [rows, [{ total }], [summary]] = await Promise.all([
    base().where(where).orderBy(...orderBy).limit(limit).offset((page - 1) * limit),
    db.select({ total: sql`count(*)::int` }).from(users).leftJoin(orderStats, eq(orderStats.userId, users.id)).where(where),
    db.select({
      customers: sql`count(*)::int`,
      active: sql`count(*) filter (where ${users.isActive})::int`,
      newThisMonth: sql`count(*) filter (where ${gte(users.createdAt, monthStart)})::int`,
      buyers: sql`count(*) filter (where coalesce(${orderStats.paidCount}, 0) > 0)::int`,
      repeat: sql`count(*) filter (where coalesce(${orderStats.paidCount}, 0) > 1)::int`
    }).from(users).leftJoin(orderStats, eq(orderStats.userId, users.id)).where(eq(users.role, 'CUSTOMER'))
  ]);

  return { customers: rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), summary };
}

// Everything staff need on one customer: profile, money, orders, payments,
// support. Guest orders placed with the same email before sign-up are included.
export async function getCustomerDetail(id) {
  if (!isUuid(id)) return null;
  const [user] = await db.select().from(users).where(and(eq(users.id, id), eq(users.role, 'CUSTOMER'))).limit(1);
  if (!user) return null;

  const ownOrders = or(eq(orders.userId, user.id), and(isNull(orders.userId), ilike(orders.customerEmail, user.email)));

  const [orderRows, [stats], ticketRows, [reviewStats], [referralStats]] = await Promise.all([
    db.select({
      id: orders.id, orderNumber: orders.orderNumber, createdAt: orders.createdAt, paidAt: orders.paidAt, total: orders.total,
      status: orders.status, paymentStatus: orders.paymentStatus, paymentMethod: orders.paymentMethod, paymentReference: orders.paymentReference,
      deliveryMethod: orders.deliveryMethod,
      itemCount: sql`(select coalesce(sum(${orderItems.quantity}), 0)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`
    }).from(orders).where(ownOrders).orderBy(desc(orders.createdAt)).limit(100),
    db.select({
      orderCount: sql`count(*)::int`,
      paidCount: sql`count(*) filter (where ${orders.paymentStatus} = 'Paid')::int`,
      totalSpent: sql`coalesce(sum(${orders.total}) filter (where ${orders.paymentStatus} = 'Paid'), 0)::float`,
      outstanding: sql`coalesce(sum(${orders.total}) filter (where ${OPEN_UNPAID}), 0)::float`,
      refunded: sql`coalesce(sum(${orders.total}) filter (where ${orders.paymentStatus} = 'Refunded'), 0)::float`,
      cancelled: sql`count(*) filter (where ${orders.status} = 'Cancelled')::int`,
      firstOrderAt: sql`min(${orders.createdAt})`,
      lastOrderAt: sql`max(${orders.createdAt})`
    }).from(orders).where(ownOrders),
    db.select({ id: supportTickets.id, ticketNumber: supportTickets.ticketNumber, subject: supportTickets.subject, status: supportTickets.status, updatedAt: supportTickets.updatedAt })
      .from(supportTickets).where(or(eq(supportTickets.userId, user.id), ilike(supportTickets.customerEmail, user.email)))
      .orderBy(desc(supportTickets.updatedAt)).limit(20),
    db.select({ count: sql`count(*)::int`, avgRating: sql`coalesce(avg(${reviews.rating}), 0)::float` }).from(reviews).where(eq(reviews.userId, user.id)),
    db.select({ referred: sql`count(*)::int`, qualified: sql`count(*) filter (where ${referralAttributions.status} = 'qualified')::int` })
      .from(referralAttributions).where(eq(referralAttributions.referrerId, user.id))
  ]);

  const orderIds = orderRows.map((o) => o.id);
  const numberById = new Map(orderRows.map((o) => [o.id, o.orderNumber]));
  const [attemptRows, receiptRows] = orderIds.length ? await Promise.all([
    db.select().from(paymentAttempts).where(inArray(paymentAttempts.orderId, orderIds)).orderBy(desc(paymentAttempts.createdAt)).limit(50),
    db.select().from(receipts).where(inArray(receipts.orderId, orderIds)).orderBy(desc(receipts.issuedAt)).limit(50)
  ]) : [[], []];

  return {
    customer: {
      id: user.id, name: user.name, email: user.email, phone: user.phone, isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt, avatar: user.avatarUrl, createdAt: user.createdAt,
      location: user.county ? { county: user.county, town: user.town, addressLine: user.addressLine } : null
    },
    stats: { ...stats, averageOrderValue: stats.paidCount ? stats.totalSpent / stats.paidCount : 0, reviews: reviewStats.count, avgRating: reviewStats.avgRating, ...referralStats },
    orders: orderRows.map((o) => ({ ...o, total: Number(o.total) })),
    payments: attemptRows.map((a) => ({
      id: a.id, orderId: a.orderId, orderNumber: numberById.get(a.orderId), provider: a.provider, status: a.status,
      amount: Number(a.amount), reference: a.providerReference, failureReason: a.failureReason, createdAt: a.createdAt
    })),
    receipts: receiptRows.map((r) => ({
      id: r.id, receiptNumber: r.receiptNumber, orderId: r.orderId, orderNumber: numberById.get(r.orderId),
      amount: Number(r.amount), paymentMethod: r.paymentMethod, issuedAt: r.issuedAt
    })),
    tickets: ticketRows
  };
}
