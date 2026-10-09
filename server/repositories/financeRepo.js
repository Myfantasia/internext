import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { expenses, orderItems, orders, products } from '../db/schema.js';

// Finance dashboard figures. One definition each, used for KPIs and charts:
//   revenue        paid orders (incl. later-refunded), by payment date (paid_at),
//                  VAT and delivery included — the money that came in
//   refunds        refunded orders, by the date the refund was recorded
//   VAT            VAT on orders still Paid (collected for KRA, not income)
//   net revenue    revenue − refunds − VAT
//   COGS           quantity × cost at time of sale (order_items.unit_cost,
//                  falling back to the product's cost price) on orders still Paid
//   gross profit   net revenue − COGS
//   expenses       recorded expenses, by the day they were incurred
//   net profit     gross profit − expenses;  profit margin = net profit ÷ net revenue
// COGS is only as complete as the cost prices entered; `cogsCoverage` reports
// the share of item sales that had a cost, so a low value is visible.

const TZ = 'Africa/Nairobi';
const PAID_OR_REFUNDED = inArray(orders.paymentStatus, ['Paid', 'Refunded']);

function parseDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : null;
}
const nairobiDay = (d) => d.toLocaleDateString('en-CA', { timeZone: TZ });
const dayStart = (day) => new Date(`${day}T00:00:00.000+03:00`);
const dayEnd = (day) => new Date(`${day}T23:59:59.999+03:00`);
const shiftDay = (day, n) => nairobiDay(new Date(dayStart(day).getTime() + n * 86400000 + 12 * 3600000));

// Calendar-day period in Nairobi time, plus the equally long period before it.
export function resolvePeriod({ from, to } = {}) {
  const today = nairobiDay(new Date());
  let a = parseDay(from) || shiftDay(today, -29);
  let b = parseDay(to) || today;
  if (a > b) [a, b] = [b, a];
  const days = Math.round((dayStart(b) - dayStart(a)) / 86400000) + 1;
  const prevTo = shiftDay(a, -1);
  const prevFrom = shiftDay(prevTo, -(days - 1));
  return { fromDay: a, toDay: b, prevFromDay: prevFrom, prevToDay: prevTo, days };
}

// day ≤ 62 days, week ≤ 400 days, otherwise month — keeps charts readable.
function granularityFor(days) {
  return days <= 62 ? 'day' : days <= 400 ? 'week' : 'month';
}

async function totals(fromDay, toDay, { salesChannel, storeId } = {}) {
  const from = dayStart(fromDay);
  const to = dayEnd(toDay);
  const conditions = [PAID_OR_REFUNDED, gte(orders.paidAt, from), lte(orders.paidAt, to)];
  if (salesChannel) conditions.push(eq(orders.salesChannel, salesChannel));
  if (storeId) conditions.push(eq(orders.storeId, storeId));
  
  const paidInRange = and(...conditions);
  
  const refundCond = [eq(orders.paymentStatus, 'Refunded'), gte(orders.updatedAt, from), lte(orders.updatedAt, to)];
  if (salesChannel) refundCond.push(eq(orders.salesChannel, salesChannel));
  if (storeId) refundCond.push(eq(orders.storeId, storeId));

  const cogsCond = [eq(orders.paymentStatus, 'Paid'), gte(orders.paidAt, from), lte(orders.paidAt, to)];
  if (salesChannel) cogsCond.push(eq(orders.salesChannel, salesChannel));
  if (storeId) cogsCond.push(eq(orders.storeId, storeId));

  const [[sales], [refunds], [cogs], [spent]] = await Promise.all([
    db.select({
      revenue: sql`coalesce(sum(${orders.total}), 0)::float`,
      amountPaid: sql`coalesce(sum(${orders.amountPaid}), 0)::float`,
      orders: sql`count(*)::int`,
      vat: sql`coalesce(sum(${orders.taxAmount}) filter (where ${orders.paymentStatus} = 'Paid'), 0)::float`
    }).from(orders).where(paidInRange),
    db.select({ total: sql`coalesce(sum(${orders.total}), 0)::float`, count: sql`count(*)::int` }).from(orders)
      .where(and(...refundCond)),
    db.select({
      cogs: sql`coalesce(sum(${orderItems.quantity} * coalesce(${orderItems.unitCost}, ${products.costPrice})), 0)::float`,
      itemSales: sql`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPrice}), 0)::float`,
      costedSales: sql`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPrice}) filter (where coalesce(${orderItems.unitCost}, ${products.costPrice}) is not null), 0)::float`
    }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).leftJoin(products, eq(orderItems.productId, products.id))
      .where(and(...cogsCond)),
    db.select({ total: sql`coalesce(sum(${expenses.amount}), 0)::float` }).from(expenses)
      .where(and(gte(expenses.spentOn, fromDay), lte(expenses.spentOn, toDay)))
  ]);
  const netRevenue = sales.revenue - refunds.total - sales.vat;
  const grossProfit = netRevenue - cogs.cogs;
  const netProfit = grossProfit - spent.total;
  return {
    revenue: sales.revenue,
    amountPaid: sales.amountPaid,
    orders: sales.orders,
    averageOrder: sales.orders ? sales.revenue / sales.orders : 0,
    refunds: refunds.total,
    refundCount: refunds.count,
    vat: sales.vat,
    netRevenue,
    cogs: cogs.cogs,
    cogsCoverage: cogs.itemSales > 0 ? cogs.costedSales / cogs.itemSales : null,
    grossProfit,
    grossMargin: netRevenue > 0 ? grossProfit / netRevenue : null,
    expenses: spent.total,
    netProfit,
    profitMargin: netRevenue > 0 ? netProfit / netRevenue : null
  };
}

const change = (now, before) => (before > 0 ? (now - before) / before : null);

export async function getFinanceOverview(query = {}) {
  const p = resolvePeriod(query);
  const granularity = granularityFor(p.days);
  const from = dayStart(p.fromDay);
  const to = dayEnd(p.toDay);
  const { salesChannel, storeId } = query;

  // Bucket labels are YYYY-MM-DD of the day/week(Monday)/month start, in Nairobi time.
  const orderBucket = (column) => sql`to_char(date_trunc(${sql.raw(`'${granularity}'`)}, ${column} AT TIME ZONE ${sql.raw(`'${TZ}'`)}), 'YYYY-MM-DD')`;
  const expenseBucket = sql`to_char(date_trunc(${sql.raw(`'${granularity}'`)}, ${expenses.spentOn}::timestamp), 'YYYY-MM-DD')`;

  const conditions = [PAID_OR_REFUNDED, gte(orders.paidAt, from), lte(orders.paidAt, to)];
  if (salesChannel) conditions.push(eq(orders.salesChannel, salesChannel));
  if (storeId) conditions.push(eq(orders.storeId, storeId));

  const prevConditions = [PAID_OR_REFUNDED, gte(orders.paidAt, dayStart(p.prevFromDay)), lte(orders.paidAt, dayEnd(p.prevToDay))];
  if (salesChannel) prevConditions.push(eq(orders.salesChannel, salesChannel));
  if (storeId) prevConditions.push(eq(orders.storeId, storeId));

  const refundCond = [eq(orders.paymentStatus, 'Refunded'), gte(orders.updatedAt, from), lte(orders.updatedAt, to)];
  if (salesChannel) refundCond.push(eq(orders.salesChannel, salesChannel));
  if (storeId) refundCond.push(eq(orders.storeId, storeId));

  const cogsCond = [eq(orders.paymentStatus, 'Paid'), gte(orders.paidAt, from), lte(orders.paidAt, to)];
  if (salesChannel) cogsCond.push(eq(orders.salesChannel, salesChannel));
  if (storeId) cogsCond.push(eq(orders.storeId, storeId));

  const [current, previous, revenueSeries, prevRevenueSeries, refundSeries, cogsSeries, expenseSeries, expenseByCategory, prevExpenseByCategory] = await Promise.all([
    totals(p.fromDay, p.toDay, { salesChannel, storeId }),
    totals(p.prevFromDay, p.prevToDay, { salesChannel, storeId }),
    db.select({
      bucket: orderBucket(orders.paidAt), revenue: sql`coalesce(sum(${orders.total}), 0)::float`, amountPaid: sql`coalesce(sum(${orders.amountPaid}), 0)::float`, orders: sql`count(*)::int`,
      vat: sql`coalesce(sum(${orders.taxAmount}) filter (where ${orders.paymentStatus} = 'Paid'), 0)::float`
    }).from(orders).where(and(...conditions)).groupBy(sql`1`).orderBy(sql`1`),
    db.select({ bucket: orderBucket(orders.paidAt), revenue: sql`coalesce(sum(${orders.total}), 0)::float` })
      .from(orders).where(and(...prevConditions)).groupBy(sql`1`).orderBy(sql`1`),
    db.select({ bucket: orderBucket(orders.updatedAt), refunds: sql`coalesce(sum(${orders.total}), 0)::float` })
      .from(orders).where(and(...refundCond)).groupBy(sql`1`),
    db.select({ bucket: orderBucket(orders.paidAt), cogs: sql`coalesce(sum(${orderItems.quantity} * coalesce(${orderItems.unitCost}, ${products.costPrice})), 0)::float` })
      .from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).leftJoin(products, eq(orderItems.productId, products.id))
      .where(and(...cogsCond)).groupBy(sql`1`),
    db.select({ bucket: expenseBucket, expenses: sql`coalesce(sum(${expenses.amount}), 0)::float` })
      .from(expenses).where(and(gte(expenses.spentOn, p.fromDay), lte(expenses.spentOn, p.toDay))).groupBy(sql`1`),
    db.select({ category: expenses.category, total: sql`coalesce(sum(${expenses.amount}), 0)::float`, count: sql`count(*)::int` })
      .from(expenses).where(and(gte(expenses.spentOn, p.fromDay), lte(expenses.spentOn, p.toDay))).groupBy(expenses.category).orderBy(sql`2 desc`),
    db.select({ category: expenses.category, total: sql`coalesce(sum(${expenses.amount}), 0)::float` })
      .from(expenses).where(and(gte(expenses.spentOn, p.prevFromDay), lte(expenses.spentOn, p.prevToDay))).groupBy(expenses.category)
  ]);

  // One row per bucket with every measure, so the charts share one x-axis.
  const byBucket = new Map();
  const row = (b) => {
    if (!byBucket.has(b)) byBucket.set(b, { bucket: b, revenue: 0, amountPaid: 0, orders: 0, vat: 0, refunds: 0, cogs: 0, expenses: 0 });
    return byBucket.get(b);
  };
  revenueSeries.forEach((r) => Object.assign(row(r.bucket), { revenue: r.revenue, amountPaid: r.amountPaid, orders: r.orders, vat: r.vat }));
  refundSeries.forEach((r) => { row(r.bucket).refunds = r.refunds; });
  cogsSeries.forEach((r) => { row(r.bucket).cogs = r.cogs; });
  expenseSeries.forEach((r) => { row(r.bucket).expenses = r.expenses; });
  const series = [...byBucket.values()].sort((x, y) => x.bucket.localeCompare(y.bucket)).map((r) => {
    const netRevenue = r.revenue - r.refunds - r.vat;
    const grossProfit = netRevenue - r.cogs;
    const netProfit = grossProfit - r.expenses;
    return { ...r, netRevenue, grossProfit, netProfit, profitMargin: netRevenue > 0 ? netProfit / netRevenue : null };
  });

  const prevByCategory = new Map(prevExpenseByCategory.map((r) => [r.category, r.total]));
  return {
    period: { from: p.fromDay, to: p.toDay, previousFrom: p.prevFromDay, previousTo: p.prevToDay, days: p.days, granularity },
    current,
    previous,
    growth: {
      sales: change(current.revenue, previous.revenue),
      amountPaid: change(current.amountPaid, previous.amountPaid),
      netRevenue: change(current.netRevenue, previous.netRevenue),
      orders: change(current.orders, previous.orders),
      averageOrder: change(current.averageOrder, previous.averageOrder),
      grossProfit: previous.grossProfit > 0 ? change(current.grossProfit, previous.grossProfit) : null,
      expenses: change(current.expenses, previous.expenses),
      netProfit: previous.netProfit > 0 ? change(current.netProfit, previous.netProfit) : null,
      cogs: change(current.cogs, previous.cogs)
    },
    series,
    previousRevenueSeries: prevRevenueSeries,
    expenseBreakdown: expenseByCategory.map((r) => ({ ...r, previous: prevByCategory.get(r.category) || 0 }))
  };
}
