import { eq, ilike, desc, and, or, sql, inArray } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '../db/client.js';
import { supportTickets, ticketMessages, users } from '../db/schema.js';
import { isUuid } from '../db/util.js';

export const TICKET_CATEGORIES = [
  'Order & Delivery', 'Payment & Invoice', 'Product Inquiry', 'Warranty & Repairs', 'Returns & Refunds', 'Account & Login', 'Other'
];
export const TICKET_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
export const TICKET_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

// TKT-261005-7F3K: date + 4 random characters; retried on the rare clash.
function newTicketNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = Array.from(randomBytes(4), (b) => alphabet[b % alphabet.length]).join('');
  return `TKT-${ymd}-${rand}`;
}

// The JSON contract the frontend speaks (src/types SupportTicket).
function toApiMessage(m) {
  return { id: m.id, sender: m.senderRole, senderName: m.senderName, text: m.message, timestamp: m.createdAt };
}

async function withMessages(rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const messages = await db.select().from(ticketMessages).where(inArray(ticketMessages.ticketId, ids)).orderBy(ticketMessages.createdAt);
  const assigneeIds = [...new Set(rows.map((r) => r.assignedTo).filter(Boolean))];
  const assignees = assigneeIds.length
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, assigneeIds))
    : [];
  const names = new Map(assignees.map((a) => [a.id, a.name]));
  return rows.map((t) => {
    const thread = messages.filter((m) => m.ticketId === t.id).map(toApiMessage);
    const last = thread[thread.length - 1];
    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      userId: t.userId,
      customerName: t.customerName,
      customerEmail: t.customerEmail,
      customerPhone: t.customerPhone,
      orderNumber: t.orderNumber,
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      status: t.status,
      assignedTo: t.assignedTo,
      assignedToName: t.assignedTo ? names.get(t.assignedTo) || null : null,
      // Whose turn it is: staff should answer when the customer spoke last.
      awaiting: last?.sender === 'customer' ? 'staff' : 'customer',
      lastMessageAt: last?.timestamp || t.updatedAt,
      messages: thread,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    };
  });
}

export async function listTickets({ status, search, awaiting } = {}) {
  const conditions = [];
  if (status && TICKET_STATUSES.includes(status)) conditions.push(eq(supportTickets.status, status));
  if (search) {
    const q = `%${String(search).slice(0, 100)}%`;
    conditions.push(or(
      ilike(supportTickets.ticketNumber, q), ilike(supportTickets.subject, q), ilike(supportTickets.customerName, q),
      ilike(supportTickets.customerEmail, q), ilike(supportTickets.orderNumber, q)
    ));
  }
  const rows = await db.select().from(supportTickets)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(supportTickets.updatedAt)).limit(300);
  const tickets = await withMessages(rows);
  return awaiting ? tickets.filter((t) => t.awaiting === awaiting) : tickets;
}

// A customer's tickets: linked to their account, or opened as a guest with
// the same email before they signed up.
// Guest tickets are matched by email only once the account's email is
// verified — otherwise anyone could claim them by typing that address.
export async function listTicketsForUser(user) {
  const byAccount = eq(supportTickets.userId, user.id);
  const byVerifiedEmail = user.emailVerified ? and(sql`${supportTickets.userId} IS NULL`, ilike(supportTickets.customerEmail, user.email)) : null;
  const rows = await db.select().from(supportTickets)
    .where(byVerifiedEmail ? or(byAccount, byVerifiedEmail) : byAccount)
    .orderBy(desc(supportTickets.updatedAt)).limit(200);
  return withMessages(rows);
}

export async function findTicketByIdentifier(identifier) {
  const condition = isUuid(identifier)
    ? or(eq(supportTickets.id, identifier), eq(supportTickets.ticketNumber, identifier))
    : eq(supportTickets.ticketNumber, identifier);
  const rows = await db.select().from(supportTickets).where(condition).limit(1);
  const [ticket] = await withMessages(rows);
  return ticket || null;
}

export function canAccessTicket(user, ticket) {
  if (!user || !ticket) return false;
  if (user.role === 'ADMIN' || user.role === 'SALES_MANAGER') return true;
  if (ticket.userId) return ticket.userId === user.id;
  return !!user.emailVerified && ticket.customerEmail?.toLowerCase() === user.email.toLowerCase();
}

export async function createTicket({ userId, customerName, customerEmail, customerPhone, subject, category, priority, message, orderNumber }) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const id = await db.transaction(async (tx) => {
        const [ticket] = await tx.insert(supportTickets).values({
          ticketNumber: newTicketNumber(),
          userId: userId || null,
          customerName,
          customerEmail,
          customerPhone: customerPhone || null,
          orderNumber: orderNumber || null,
          subject,
          category: category || 'Other',
          priority: priority || 'Normal',
          status: 'Open'
        }).returning({ id: supportTickets.id });
        await tx.insert(ticketMessages).values({ ticketId: ticket.id, senderRole: 'customer', senderId: userId || null, senderName: customerName, message });
        return ticket.id;
      });
      return findTicketByIdentifier(id);
    } catch (err) {
      const code = err?.code || err?.cause?.code;
      if (code === '23505' && attempt < 3) continue; // ticket number clash — draw another
      throw err;
    }
  }
  return null;
}

// Adds a message. A customer writing on a Resolved/Closed ticket reopens it;
// a staff reply on an Open ticket moves it to In Progress unless told otherwise.
export async function addTicketMessage(ticketId, { text, senderRole, senderId, senderName, status }) {
  return db.transaction(async (tx) => {
    const [ticket] = await tx.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1).for('update');
    if (!ticket) return null;
    await tx.insert(ticketMessages).values({ ticketId, senderRole, senderId: senderId || null, senderName, message: text });
    let next = status || ticket.status;
    if (!status && senderRole === 'customer' && ['Resolved', 'Closed'].includes(ticket.status)) next = 'Open';
    if (!status && senderRole === 'staff' && ticket.status === 'Open') next = 'In Progress';
    await tx.update(supportTickets).set({ status: next, updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
    return true;
  }).then((ok) => (ok ? findTicketByIdentifier(ticketId) : null));
}

export async function updateTicket(ticketId, { status, priority, assignedTo }) {
  const patch = { updatedAt: new Date() };
  if (status) patch.status = status;
  if (priority) patch.priority = priority;
  if (assignedTo !== undefined) patch.assignedTo = assignedTo || null;
  const [row] = await db.update(supportTickets).set(patch).where(eq(supportTickets.id, ticketId)).returning({ id: supportTickets.id });
  return row ? findTicketByIdentifier(row.id) : null;
}

export async function ticketCounts() {
  const rows = await db.select({ status: supportTickets.status, n: sql`count(*)::int` }).from(supportTickets).groupBy(supportTickets.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}
