import * as consoleProvider from './providers/console.js';
import * as smtpProvider from './providers/smtp.js';
import { layout, button, paragraph, muted, escapeHtml, htmlToText, brand } from './templates.js';

// Provider-agnostic email service. Callers use the named senders below (or
// sendEmail); EMAIL_PROVIDER picks the transport. Adding a provider (e.g. an
// HTTP API like Resend or SES) means adding a module with send()/verify() and
// registering it here — nothing else changes.
const PROVIDERS = {
  console: consoleProvider,
  smtp: smtpProvider
};

export function activeProviderName() {
  const key = (process.env.EMAIL_PROVIDER || (process.env.SMTP_HOST ? 'smtp' : 'console')).toLowerCase();
  return PROVIDERS[key] ? key : 'console';
}

function getProvider() {
  return PROVIDERS[activeProviderName()];
}

function fromHeader() {
  const name = process.env.EMAIL_FROM_NAME || brand().name;
  const address = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'no-reply@internextbusinesssystem.co.ke';
  // Legacy single-variable form: EMAIL_FROM="Name <address>"
  if (process.env.EMAIL_FROM && !process.env.EMAIL_FROM_ADDRESS) return process.env.EMAIL_FROM;
  return `"${name.replace(/"/g, '')}" <${address}>`;
}

const APP_URL = () => (process.env.APP_URL || 'http://localhost:5174').split(',')[0].trim().replace(/\/$/, '');

// sendEmail({ to, subject, heading, preheader, body, footerNote, replyTo, attachments, text })
export async function sendEmail({ to, subject, heading, preheader, body, footerNote, replyTo, attachments, text }) {
  const html = layout({ heading, preheader: preheader || subject, body, footerNote });
  return getProvider().send({
    from: fromHeader(),
    replyTo: replyTo || process.env.EMAIL_REPLY_TO || undefined,
    to,
    subject,
    html,
    text: text || htmlToText(html),
    attachments
  });
}

export async function verifyEmailTransport() {
  return { provider: activeProviderName(), ...(await getProvider().verify()) };
}

const money = (amount, currency = 'KES') =>
  `${currency} ${Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const greeting = (name) => paragraph(`Hi ${escapeHtml(String(name || '').split(' ')[0] || 'there')},`);

// --- Account ---------------------------------------------------------------

export async function sendVerificationEmail(to, verifyUrl, name) {
  return sendEmail({
    to,
    subject: `Verify your ${brand().name} account`,
    heading: 'Confirm your email address',
    preheader: 'One click to activate your account.',
    body: `${greeting(name)}${paragraph('Thanks for creating an account. Please confirm this is your email address.')}${button('Verify my email', verifyUrl)}`,
    footerNote: "This link expires in 24 hours. If you didn't create this account, you can ignore this email."
  });
}

export async function sendWelcomeEmail(to, name) {
  return sendEmail({
    to,
    subject: `Welcome to ${brand().name}`,
    heading: 'Welcome aboard',
    body: `${greeting(name)}${paragraph('Your account is ready. Sign in to track orders, save delivery details and earn referral rewards.')}${button('Sign in', `${APP_URL()}/auth`)}`
  });
}

export async function sendPasswordResetEmail(to, resetUrl, name) {
  return sendEmail({
    to,
    subject: `Reset your ${brand().name} password`,
    heading: 'Reset your password',
    preheader: 'Use this link within 30 minutes.',
    body: `${greeting(name)}${paragraph('We received a request to reset your password.')}${button('Choose a new password', resetUrl)}`,
    footerNote: "This link expires in 30 minutes. If you didn't request it, ignore this email — your password won't change."
  });
}

export async function sendSalesManagerInviteEmail(to, acceptUrl) {
  return sendEmail({
    to,
    subject: `You've been invited to join ${brand().name}`,
    heading: "You're invited",
    body: `${paragraph(`You've been invited to join <strong>${escapeHtml(brand().name)}</strong> as a Sales Manager.`)}${button('Accept invitation', acceptUrl)}`,
    footerNote: 'This invitation expires in 7 days. If you were not expecting it, you can ignore this email.'
  });
}

export async function sendStaffSignupCodeEmail(to, { code, role, expiresAt }) {
  const roleLabel = role === 'ADMIN' ? 'Administrator' : 'Sales Manager';
  return sendEmail({
    to,
    subject: `Your ${brand().name} staff signup code`,
    heading: 'Your staff signup code',
    body: `${paragraph(`An administrator created a <strong>${roleLabel}</strong> account invitation for this email address.`)}
      <div style="margin:18px 0;padding:16px;border-radius:10px;background:#f1f5f2;border:1px dashed #9db8a8;font-family:'Courier New',monospace;font-size:20px;font-weight:bold;letter-spacing:.08em;text-align:center;color:#0f172a;">${escapeHtml(code)}</div>
      ${paragraph('Open the staff registration page and enter this code together with this email address.')}
      ${button('Open staff registration', `${APP_URL()}/admin/signup`)}`,
    footerNote: `The code works once and expires ${expiresAt ? new Date(expiresAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }) : 'in 24 hours'}. Never share it.`
  });
}

// --- Orders & payments ---------------------------------------------------------

function itemsTable(order) {
  const rows = order.items.map((item) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b;">${escapeHtml(item.name)}${item.variantName ? ` <span style="color:#64748b;">(${escapeHtml(item.variantName)})</span>` : ''}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:center;color:#1e293b;">${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;color:#1e293b;">${money(item.price * item.quantity, order.currency)}</td>
    </tr>`).join('');
  const line = (label, value, strong = false) => `
    <tr><td colspan="2" style="padding:4px 0;font-size:13px;color:${strong ? '#0f172a' : '#475569'};${strong ? 'font-weight:bold;font-size:15px;' : ''}">${label}</td>
    <td style="padding:4px 0;font-size:13px;text-align:right;color:${strong ? '#0f172a' : '#475569'};${strong ? 'font-weight:bold;font-size:15px;' : ''}">${value}</td></tr>`;
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:8px 0 18px;">
      <tr style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">
        <th align="left" style="padding-bottom:6px;">Item</th><th style="padding-bottom:6px;">Qty</th><th align="right" style="padding-bottom:6px;">Amount</th>
      </tr>
      ${rows}
      ${line('Subtotal', money(order.subtotal, order.currency))}
      ${order.discountAmount > 0 ? line(`Discount${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ''}`, `−${money(order.discountAmount, order.currency)}`) : ''}
      ${line(`Delivery${order.deliveryMethod ? ` — ${escapeHtml(order.deliveryMethod)}` : ''}`, order.deliveryFee > 0 ? money(order.deliveryFee, order.currency) : 'Free')}
      ${line(`VAT (${order.taxRate ?? 16}%, included)`, money(order.taxAmount, order.currency))}
      ${line('Total', money(order.total, order.currency), true)}
    </table>`;
}

const orderUrl = (order) => `${APP_URL()}/order-confirmation?orderNumber=${encodeURIComponent(order.orderNumber)}`;

// How to pay an offline order — bank details, or what to have ready on delivery.
function paymentInstructionsHtml(instructions, order) {
  if (!instructions) return '';
  const row = (label, value) => (value ? `<tr><td style="padding:3px 12px 3px 0;color:#64748b;font-size:13px;">${label}</td><td style="padding:3px 0;font-size:13px;color:#0f172a;font-weight:bold;">${escapeHtml(value)}</td></tr>` : '');
  if (instructions.kind === 'bank_transfer') {
    const b = instructions.bank;
    const deadline = new Date(instructions.payBy).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' });
    return `
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin:6px 0 16px;background:#f8fafc;">
        <p style="margin:0 0 8px;font-weight:bold;color:#0f172a;">How to pay by bank transfer</p>
        ${b ? `<table role="presentation" cellspacing="0" cellpadding="0">
          ${row('Bank', b.bankName)}${row('Branch', b.branch)}${row('Account name', b.accountName)}${row('Account number', b.accountNumber)}${row('SWIFT', b.swiftCode)}
          ${row('Amount', money(instructions.amount, order.currency))}${row('Reference', instructions.reference)}
        </table>` : paragraph('Our bank details are on your tax invoice. Call us if you need them.')}
        ${b?.paybill ? paragraph(`Prefer M-Pesa? Pay Bill <strong>${escapeHtml(b.paybill)}</strong>, account <strong>${escapeHtml(b.paybillAccount || instructions.reference)}</strong>.`) : ''}
        ${paragraph(`Always quote <strong>${escapeHtml(instructions.reference)}</strong> as the reference. Your items are reserved until <strong>${escapeHtml(deadline)}</strong>. After paying, open your order and tap <strong>“I've paid”</strong> to send us the transaction reference — that gets your order moving fastest.`)}
      </div>`;
  }
  if (instructions.kind === 'cash_on_delivery') {
    return `
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin:6px 0 16px;background:#f8fafc;">
        <p style="margin:0 0 8px;font-weight:bold;color:#0f172a;">Pay on ${instructions.pickup ? 'collection' : 'delivery'}</p>
        ${paragraph(`Please have <strong>${money(instructions.amount, order.currency)}</strong> ready${instructions.pickup ? ' when you collect' : ' for the rider'}. You can pay cash${instructions.tillOrPaybill ? `, M-Pesa (till/paybill <strong>${escapeHtml(instructions.tillOrPaybill)}</strong>)` : ', M-Pesa'} or card, after inspecting your items.`)}
        ${paragraph('Prefer to skip cash? You can pay online any time from your order page. You get an official receipt either way.')}
      </div>`;
  }
  return '';
}

export async function sendOrderConfirmationEmail(order, { instructions } = {}) {
  const awaitingPayment = order.paymentStatus !== 'Paid' && order.paymentMethod !== 'Cash on Delivery';
  return sendEmail({
    to: order.customer.email,
    subject: `Order received — ${order.orderNumber}`,
    heading: awaitingPayment ? 'We have your order — payment pending' : 'Thank you for your order',
    preheader: `Order ${order.orderNumber}: ${money(order.total, order.currency)}`,
    body: `${greeting(order.customer.name)}
      ${paragraph(`We've received order <strong>${escapeHtml(order.orderNumber)}</strong>.${awaitingPayment ? ' It will be processed as soon as your payment is confirmed.' : ' It is now being prepared.'}`)}
      ${itemsTable(order)}
      ${paragraph(`<strong>Payment method:</strong> ${escapeHtml(order.paymentMethod)}`)}
      ${paymentInstructionsHtml(instructions, order)}
      ${button('View your order', orderUrl(order))}`,
    footerNote: 'Your tax invoice can be downloaded from your order page at any time.'
  });
}

export async function sendPaymentConfirmationEmail(order, receipt, { attachments } = {}) {
  return sendEmail({
    to: order.customer.email,
    subject: `Payment received — ${order.orderNumber}`,
    heading: 'Payment received',
    preheader: `Receipt ${receipt?.receiptNumber || ''} for ${money(order.total, order.currency)}`,
    body: `${greeting(order.customer.name)}
      ${paragraph(`We've received your payment of <strong>${money(receipt?.amount ?? order.total, order.currency)}</strong> for order <strong>${escapeHtml(order.orderNumber)}</strong>.`)}
      ${paragraph(`Receipt number: <strong>${escapeHtml(receipt?.receiptNumber || '—')}</strong>${order.paymentReference ? `<br/>Transaction reference: <strong>${escapeHtml(order.paymentReference)}</strong>` : ''}`)}
      ${paragraph('Your order is now being prepared for dispatch.')}
      ${button('Download receipt', `${APP_URL()}/api/orders/${order.id}/receipt.pdf`)}`,
    attachments
  });
}

export async function sendBankTransferReceivedEmail(order, { reference, amount }) {
  return sendEmail({
    to: order.customer.email,
    subject: `Transfer details received — ${order.orderNumber}`,
    heading: 'We are checking your transfer',
    body: `${greeting(order.customer.name)}
      ${paragraph(`Thanks — we've received your transfer details for order <strong>${escapeHtml(order.orderNumber)}</strong>: <strong>${money(amount, order.currency)}</strong>, reference <strong>${escapeHtml(String(reference).toUpperCase())}</strong>.`)}
      ${paragraph('Our team confirms transfers against the bank statement, usually within one business day (RTGS and same-bank transfers are often faster). You will get your receipt by email as soon as it is confirmed.')}
      ${button('View your order', orderUrl(order))}`
  });
}

export async function sendBankTransferRejectedEmail(order, reason) {
  return sendEmail({
    to: order.customer.email,
    subject: `We couldn't confirm your transfer — ${order.orderNumber}`,
    heading: 'Your transfer needs attention',
    body: `${greeting(order.customer.name)}
      ${paragraph(`We could not match your transfer for order <strong>${escapeHtml(order.orderNumber)}</strong> to our bank statement.`)}
      ${paragraph(`<strong>Reason:</strong> ${escapeHtml(reason)}`)}
      ${paragraph('Please check the reference and amount on your bank slip and submit the details again from your order page, or reply to this email with a copy of the slip.')}
      ${button('Update transfer details', orderUrl(order))}`
  });
}

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------
const ticketUrl = () => `${APP_URL()}/customer/dashboard?tab=tickets`;

export async function sendTicketCreatedEmail(ticket) {
  return sendEmail({
    to: ticket.customerEmail,
    subject: `[${ticket.ticketNumber}] We received your request`,
    heading: 'We have your support request',
    body: `${greeting(ticket.customerName)}
      ${paragraph(`Your ticket <strong>${escapeHtml(ticket.ticketNumber)}</strong> — “${escapeHtml(ticket.subject)}” — is open. Our team usually replies within one business day.`)}
      ${paragraph('You can follow the conversation and reply from your account.')}
      ${button('View my tickets', ticketUrl())}`
  });
}

export async function sendTicketReplyEmail(ticket, text) {
  return sendEmail({
    to: ticket.customerEmail,
    subject: `[${ticket.ticketNumber}] New reply: ${ticket.subject}`,
    heading: 'You have a reply from our support team',
    body: `${greeting(ticket.customerName)}
      <div style="border-left:3px solid #2f7a57;padding:8px 14px;margin:8px 0 16px;background:#f8fafc;color:#1e293b;font-size:14px;white-space:pre-line;">${escapeHtml(text)}</div>
      ${paragraph(`Ticket status: <strong>${escapeHtml(ticket.status)}</strong>`)}
      ${button('Reply', ticketUrl())}`
  });
}

// Heads-up to the support inbox for new tickets and customer replies.
export async function sendTicketStaffAlertEmail(to, ticket, { isReply, text }) {
  return sendEmail({
    to,
    subject: `[${ticket.ticketNumber}] ${isReply ? 'Customer replied' : 'New ticket'}: ${ticket.subject}`,
    heading: isReply ? 'A customer replied to a ticket' : 'New support ticket',
    body: `${paragraph(`<strong>${escapeHtml(ticket.customerName)}</strong> (${escapeHtml(ticket.customerEmail)}) · ${escapeHtml(ticket.category || '')} · Priority ${escapeHtml(ticket.priority || 'Normal')}${ticket.orderNumber ? ` · Order ${escapeHtml(ticket.orderNumber)}` : ''}`)}
      <div style="border-left:3px solid #b45309;padding:8px 14px;margin:8px 0 16px;background:#f8fafc;color:#1e293b;font-size:14px;white-space:pre-line;">${escapeHtml(text)}</div>
      ${button('Open in admin', `${APP_URL()}/admin?tab=support`)}`
  });
}

const SHIPPING_MESSAGES = {
  Packed: 'Your order has been packed and is waiting for the courier.',
  Dispatched: 'Your order is on its way.',
  'Out for Delivery': 'Your order is out for delivery today. Please keep your phone close so the rider can reach you.',
  Delivered: 'Your order has been delivered. We hope you enjoy it!',
  Cancelled: 'Your order has been cancelled. If you paid, our team will contact you about your refund.',
  Refunded: 'Your refund has been processed.'
};

export async function sendOrderStatusUpdateEmail(order, note) {
  return sendEmail({
    to: order.customer.email,
    subject: `Order ${order.orderNumber}: ${order.status}`,
    heading: `Your order is ${order.status.toLowerCase()}`,
    body: `${greeting(order.customer.name)}
      ${paragraph(SHIPPING_MESSAGES[order.status] || `The status of order <strong>${escapeHtml(order.orderNumber)}</strong> is now <strong>${escapeHtml(order.status)}</strong>.`)}
      ${note ? paragraph(`<em>${escapeHtml(note)}</em>`) : ''}
      ${order.trackingNumber ? paragraph(`Tracking reference: <strong>${escapeHtml(order.trackingNumber)}</strong>`) : ''}
      ${button('Track your order', `${APP_URL()}/track-order?order=${encodeURIComponent(order.orderNumber)}`)}`
  });
}

export async function sendLowStockAlertEmail(to, products) {
  const rows = products.map((p) => `<li style="margin-bottom:4px;">${escapeHtml(p.name)} (SKU: ${escapeHtml(p.sku)}) — <strong>${p.stock}</strong> left</li>`).join('');
  return sendEmail({
    to,
    subject: `Low stock alert — ${products.length} item(s) need reordering`,
    heading: 'Low stock alert',
    body: `${paragraph('These items are at or below their reorder level:')}<ul style="font-size:14px;color:#334155;padding-left:18px;">${rows}</ul>${button('Open inventory', `${APP_URL()}/admin`)}`
  });
}

// Marketing / announcements. Only send to customers who opted in
// (newsletter subscribers) — Kenya's Data Protection Act requires consent.
export async function sendPromotionalEmail(to, { subject, heading, message, ctaLabel, ctaUrl }) {
  return sendEmail({
    to,
    subject,
    heading,
    body: `${paragraph(escapeHtml(message).replace(/\n/g, '<br/>'))}${ctaLabel && ctaUrl ? button(ctaLabel, ctaUrl) : ''}`,
    footerNote: `You are receiving this because you subscribed to ${escapeHtml(brand().name)} updates. Reply "unsubscribe" to stop receiving these emails.`
  });
}

export async function sendTestEmail(to) {
  return sendEmail({
    to,
    subject: `${brand().name}: test email`,
    heading: 'Email delivery is working',
    body: `${paragraph(`This is a test message sent through the <strong>${activeProviderName()}</strong> email provider at ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })} (Nairobi time).`)}${muted('If you can read this, sender name, reply-to and branding are configured.')}`
  });
}
