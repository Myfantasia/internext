import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  listTickets, listTicketsForUser, findTicketByIdentifier, createTicket, addTicketMessage, updateTicket, canAccessTicket, ticketCounts,
  TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES
} from '../repositories/ticketsRepo.js';
import { findOrderByIdentifier, canAccessOrder } from '../repositories/ordersRepo.js';
import { getCompanyProfile } from '../repositories/companyProfileRepo.js';
import { logAudit } from '../repositories/auditLogsRepo.js';
import { requireAuth, requirePermission } from '../middleware/authorize.js';
import { formatZodError } from '../schemas/authSchemas.js';
import { normalizeKenyanPhone } from '../services/location.js';
import { sendTicketCreatedEmail, sendTicketReplyEmail, sendTicketStaffAlertEmail } from '../services/email/index.js';

const router = express.Router();
const STAFF_ROLES = ['ADMIN', 'SALES_MANAGER'];
const isStaff = (user) => !!user && STAFF_ROLES.includes(user.role);

const ticketLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many support requests. Please try again later.' } });
const replyLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many messages. Please wait a few minutes.' } });

const messageText = z.string().trim().min(2, 'Write a message').max(5000);

const createSchema = z.object({
  subject: z.string().trim().min(4, 'Add a short subject').max(150),
  category: z.enum(TICKET_CATEGORIES).default('Other'),
  priority: z.enum(TICKET_PRIORITIES).default('Normal'),
  message: messageText,
  orderNumber: z.string().trim().max(40).optional().nullable(),
  // Only used for guests (e.g. the Contact page); signed-in users' details come from their account.
  customerName: z.string().trim().min(2).max(120).optional(),
  customerEmail: z.string().trim().toLowerCase().email().max(200).optional(),
  customerPhone: z.string().trim().max(30).optional()
});

async function supportInbox() {
  const company = await getCompanyProfile();
  return company?.supportEmail || company?.email || null;
}

function alertStaff(ticket, opts) {
  supportInbox()
    .then((to) => to && sendTicketStaffAlertEmail(to, ticket, opts))
    .catch((e) => console.error('Failed to send ticket alert:', e));
}

// Staff: all tickets, filterable.
router.get('/', requirePermission('tickets:read'), async (req, res) => {
  const tickets = await listTickets({
    status: req.query.status ? String(req.query.status) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
    awaiting: req.query.awaiting === 'staff' ? 'staff' : undefined
  });
  res.json({ success: true, tickets, counts: await ticketCounts() });
});

// Customer: their own tickets (by account, plus guest tickets with their email).
router.get('/mine', requireAuth, async (req, res) => {
  res.json({ success: true, tickets: await listTicketsForUser(req.user), categories: TICKET_CATEGORIES });
});

// Anyone can open a ticket; signed-in customers' identity comes from the session.
router.post('/', ticketLimiter, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const data = parsed.data;

  let customer;
  if (req.user) {
    customer = { name: req.user.name, email: req.user.email, phone: req.user.phone || null, userId: req.user.id };
  } else {
    if (!data.customerName || !data.customerEmail) {
      return res.status(400).json({ success: false, message: 'Enter your name and email so we can reply.' });
    }
    customer = { name: data.customerName, email: data.customerEmail, phone: normalizeKenyanPhone(data.customerPhone) || data.customerPhone || null, userId: null };
  }

  // Linking an order is only allowed for an order the requester owns.
  let orderNumber = null;
  if (data.orderNumber) {
    const order = await findOrderByIdentifier(data.orderNumber.toUpperCase());
    if (!order || (req.user && !canAccessOrder(req.user, order)) || (!req.user && order.customer.email.toLowerCase() !== customer.email)) {
      return res.status(400).json({ success: false, message: 'We could not find that order on your account. Check the order number.' });
    }
    orderNumber = order.orderNumber;
  }

  const ticket = await createTicket({
    userId: customer.userId, customerName: customer.name, customerEmail: customer.email, customerPhone: customer.phone,
    subject: data.subject, category: data.category, priority: data.priority, message: data.message, orderNumber
  });

  await logAudit({ actorId: customer.userId, actorName: customer.name, action: 'TICKET_CREATED', entity: 'Support', entityId: ticket.id, newValue: ticket.ticketNumber, ip: req.ip });
  sendTicketCreatedEmail(ticket).catch((e) => console.error('Failed to send ticket confirmation:', e));
  alertStaff(ticket, { isReply: false, text: data.message });
  res.status(201).json({ success: true, ticket });
});

async function loadTicket(req, res) {
  const ticket = await findTicketByIdentifier(String(req.params.id).slice(0, 64));
  if (!ticket || !canAccessTicket(req.user, ticket)) {
    res.status(404).json({ success: false, message: 'Ticket not found' });
    return null;
  }
  return ticket;
}

router.get('/:id', requireAuth, async (req, res) => {
  const ticket = await loadTicket(req, res);
  if (ticket) res.json({ success: true, ticket });
});

// The customer adds to their own ticket (reopens it if it was resolved/closed).
router.post('/:id/messages', requireAuth, replyLimiter, async (req, res) => {
  const parsed = z.object({ text: messageText }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const ticket = await loadTicket(req, res);
  if (!ticket) return;
  if (isStaff(req.user)) return res.status(400).json({ success: false, message: 'Staff reply from the admin console.' });
  const updated = await addTicketMessage(ticket.id, { text: parsed.data.text, senderRole: 'customer', senderId: req.user.id, senderName: req.user.name });
  alertStaff(updated, { isReply: true, text: parsed.data.text });
  res.json({ success: true, ticket: updated });
});

// The customer marks their issue as solved.
router.post('/:id/close', requireAuth, async (req, res) => {
  const ticket = await loadTicket(req, res);
  if (!ticket) return;
  const updated = await updateTicket(ticket.id, { status: 'Closed' });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'TICKET_CLOSED', entity: 'Support', entityId: ticket.id, ip: req.ip });
  res.json({ success: true, ticket: updated });
});

// Staff reply (optionally changing the status in the same step).
const staffReplySchema = z.object({
  text: messageText,
  status: z.enum(TICKET_STATUSES).optional()
});
router.post('/:id/reply', requirePermission('tickets:respond'), replyLimiter, async (req, res) => {
  const parsed = staffReplySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const ticket = await findTicketByIdentifier(String(req.params.id).slice(0, 64));
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
  const updated = await addTicketMessage(ticket.id, {
    text: parsed.data.text, senderRole: 'staff', senderId: req.user.id, senderName: req.user.name, status: parsed.data.status
  });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'TICKET_REPLY', entity: 'Support', entityId: ticket.id, newValue: updated.status, ip: req.ip });
  sendTicketReplyEmail(updated, parsed.data.text).catch((e) => console.error('Failed to send ticket reply email:', e));
  res.json({ success: true, ticket: updated });
});

// Staff: status, priority and assignment.
const staffUpdateSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignToMe: z.boolean().optional(),
  unassign: z.boolean().optional()
});
router.patch('/:id', requirePermission('tickets:respond'), async (req, res) => {
  const parsed = staffUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: formatZodError(parsed.error) });
  const ticket = await findTicketByIdentifier(String(req.params.id).slice(0, 64));
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
  const { status, priority, assignToMe, unassign } = parsed.data;
  const updated = await updateTicket(ticket.id, {
    status, priority, assignedTo: assignToMe ? req.user.id : unassign ? null : undefined
  });
  await logAudit({ actorId: req.user.id, actorName: req.user.name, action: 'TICKET_UPDATED', entity: 'Support', entityId: ticket.id, newValue: JSON.stringify(parsed.data), ip: req.ip });
  res.json({ success: true, ticket: updated });
});

export default router;
