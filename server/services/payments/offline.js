import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { orders, orderStatusHistory, paymentAttempts } from '../../db/schema.js';
import { cancelUnpaidOrder, findOrderByIdentifier, PAYMENT_METHODS } from '../../repositories/ordersRepo.js';
import { getCompanyProfile } from '../../repositories/companyProfileRepo.js';
import { logAudit } from '../../repositories/auditLogsRepo.js';
import { settleAttempt, PaymentError } from './index.js';

// ---------------------------------------------------------------------------
// Bank transfer
//   1. Checkout: the order is created "Payment Pending" with stock held for
//      company.bankTransferHoldHours (default 48h). The order page, invoice
//      and confirmation email show our bank details and the reference to quote
//      (the order number).
//   2. Customer pays at their bank / app, then submits the transaction
//      reference, amount and date ("I've paid") — a pending attempt.
//   3. Staff check the bank statement and Approve (order Paid, receipt issued,
//      stock committed) or Reject with a reason the customer sees.
//   An order with submitted details is never auto-cancelled while it waits.
//
// Pay on delivery
//   Allowed for store pickup or pinned addresses within the rider radius, up
//   to company.codMaxOrderAmount, one open pay-on-delivery order per customer.
//   The customer may prepay by M-Pesa/card at any time; otherwise the rider or
//   counter collects cash / M-Pesa / card and staff record it here, which
//   issues the receipt.
// ---------------------------------------------------------------------------

export const BANK_LABEL = PAYMENT_METHODS.bank_transfer.label;
export const COD_LABEL = PAYMENT_METHODS.cash_on_delivery.label;

export function bankDetails(company) {
  if (!company?.bankAccountNumber) return null;
  return {
    bankName: company.bankName || null,
    branch: company.bankBranch || null,
    accountName: company.bankAccountName || company.name || null,
    accountNumber: company.bankAccountNumber,
    swiftCode: company.bankSwiftCode || null,
    // M-Pesa Paybill is a common alternative for business customers.
    paybill: company.mpesaPaybill || null,
    paybillAccount: company.mpesaAccountNo || null
  };
}

// What the customer should do next for an unpaid offline order.
export function paymentInstructions(order, company) {
  if (!order || order.paymentStatus === 'Paid' || order.status === 'Cancelled') return null;
  if (order.paymentMethod === BANK_LABEL) {
    const holdHours = Number(company?.bankTransferHoldHours || 48);
    return {
      kind: 'bank_transfer',
      reference: order.orderNumber,
      amount: order.total,
      bank: bankDetails(company),
      holdHours,
      payBy: new Date(new Date(order.createdAt).getTime() + holdHours * 3600 * 1000).toISOString()
    };
  }
  if (order.paymentMethod === COD_LABEL) {
    return {
      kind: 'cash_on_delivery',
      amount: order.total,
      pickup: !!(order.deliveryAddress?.pickup || order.deliveryQuote?.kind === 'pickup'),
      tillOrPaybill: company?.mpesaTill || company?.mpesaPaybill || null
    };
  }
  return null;
}

export async function pendingBankSubmission(orderId) {
  const [row] = await db.select().from(paymentAttempts).where(and(
    eq(paymentAttempts.orderId, orderId), eq(paymentAttempts.provider, 'bank_transfer'), eq(paymentAttempts.status, 'pending')
  )).orderBy(desc(paymentAttempts.createdAt)).limit(1);
  return row || null;
}

function isUniqueViolation(err) {
  return err?.code === '23505' || err?.cause?.code === '23505';
}

// Step 2: the customer tells us they've paid.
export async function submitBankTransfer({ order, user, reference, amount, paidOn, payerName, bankName, ip }) {
  if (order.paymentMethod !== BANK_LABEL) throw new PaymentError('This order is not set to bank transfer.', 400, 'WRONG_METHOD');
  if (order.paymentStatus === 'Paid') throw new PaymentError('This order has already been paid.', 409, 'ALREADY_PAID');
  if (order.status === 'Cancelled') throw new PaymentError('This order was cancelled. Please place a new order.', 409, 'ORDER_CANCELLED');

  const cleanRef = String(reference).trim().toUpperCase().replace(/\s+/g, '');
  const existing = await pendingBankSubmission(order.id);
  try {
    const [attempt] = await db.transaction(async (tx) => {
      // A corrected submission replaces the one still waiting for review.
      if (existing) {
        await tx.update(paymentAttempts).set({ status: 'cancelled', failureReason: 'Replaced by a newer submission from the customer.', completedAt: new Date(), updatedAt: new Date() })
          .where(eq(paymentAttempts.id, existing.id));
      }
      const inserted = await tx.insert(paymentAttempts).values({
        orderId: order.id,
        userId: user.id,
        provider: 'bank_transfer',
        amount: String(amount),
        currency: order.currency || 'KES',
        providerReference: cleanRef,
        payerHint: payerName ? String(payerName).slice(0, 80) : null,
        rawResponse: { submittedBy: 'customer', paidOn, bankName: bankName || null, payerName: payerName || null, declaredAmount: amount }
      }).returning();
      await tx.update(orders).set({ paymentStatus: 'Pending', updatedAt: new Date() }).where(eq(orders.id, order.id));
      await tx.insert(orderStatusHistory).values({
        orderId: order.id, status: 'Transfer Submitted',
        note: `Customer reported a bank transfer of KES ${Number(amount).toLocaleString('en-KE')} (ref ${cleanRef}). Awaiting verification.`,
        changedBy: user.id
      });
      return inserted;
    });
    await logAudit({ actorId: user.id, actorName: user.name, action: 'BANK_TRANSFER_SUBMITTED', entity: 'Order', entityId: order.id, newValue: cleanRef, ip });
    return attempt;
  } catch (err) {
    if (isUniqueViolation(err)) throw new PaymentError('This transaction reference has already been submitted. Check the reference on your bank slip.', 409, 'DUPLICATE_REFERENCE');
    throw err;
  }
}

// Step 3: staff decide.
export async function reviewBankTransfer({ attemptId, approve, amountReceived, reason, staff, ip }) {
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, attemptId)).limit(1);
  if (!attempt || attempt.provider !== 'bank_transfer') throw new PaymentError('Transfer not found.', 404, 'NOT_FOUND');
  if (attempt.status !== 'pending') throw new PaymentError('This transfer has already been reviewed.', 409, 'ALREADY_REVIEWED');

  const result = await settleAttempt({
    provider: 'bank_transfer',
    attemptId,
    outcome: approve ? 'succeeded' : 'failed',
    reference: attempt.providerReference,
    amount: approve ? Number(amountReceived ?? attempt.amount) : undefined,
    reason: approve ? undefined : `Bank transfer not verified: ${reason}`,
    raw: { ...(attempt.rawResponse || {}), reviewedBy: staff.id, reviewedAt: new Date().toISOString(), amountReceived: amountReceived ?? null },
    actor: staff
  });
  if (result.mismatch) {
    throw new PaymentError(`The amount received (KES ${Number(amountReceived).toLocaleString('en-KE')}) is less than the order total. Ask the customer to pay the balance, then approve a new submission.`, 409, 'AMOUNT_MISMATCH');
  }
  await logAudit({
    actorId: staff.id, actorName: staff.name, action: approve ? 'BANK_TRANSFER_APPROVED' : 'BANK_TRANSFER_REJECTED', entity: 'Order',
    entityId: attempt.orderId, newValue: approve ? `${attempt.providerReference} · KES ${amountReceived ?? attempt.amount}` : reason, ip
  });
  return result.order || findOrderByIdentifier(attempt.orderId);
}

// Pay on delivery (or any offline payment staff take in person).
export const COLLECTION_METHODS = {
  cash: 'Cash',
  mpesa: 'M-Pesa (till/paybill)',
  card: 'Card (POS)',
  bank: 'Bank deposit'
};

export async function recordCollectedPayment({ order, method, amount, reference, note, staff, ip }) {
  if (order.paymentStatus === 'Paid') throw new PaymentError('This order has already been paid.', 409, 'ALREADY_PAID');
  if (!COLLECTION_METHODS[method]) throw new PaymentError('Choose how the payment was received.', 400, 'BAD_METHOD');
  if (method !== 'cash' && !reference) throw new PaymentError('Enter the M-Pesa code, POS slip or deposit reference.', 400, 'REFERENCE_REQUIRED');

  const provider = order.paymentMethod === BANK_LABEL ? 'bank_transfer' : 'cash_on_delivery';
  // Cash has no external reference; make one that is unique and traceable.
  const ref = reference ? String(reference).trim().toUpperCase().replace(/\s+/g, '') : `CASH-${order.orderNumber}-${Date.now().toString(36).toUpperCase()}`;
  let attempt;
  try {
    [attempt] = await db.insert(paymentAttempts).values({
      orderId: order.id,
      userId: staff.id,
      provider,
      amount: String(amount),
      currency: order.currency || 'KES',
      providerReference: ref,
      rawResponse: { submittedBy: 'staff', method, methodLabel: COLLECTION_METHODS[method], note: note || null }
    }).returning();
  } catch (err) {
    if (isUniqueViolation(err)) throw new PaymentError('This reference has already been used for another payment.', 409, 'DUPLICATE_REFERENCE');
    throw err;
  }

  const result = await settleAttempt({
    provider, attemptId: attempt.id, outcome: 'succeeded', reference: ref, amount: Number(amount),
    raw: { method, collectedBy: staff.id, note: note || null }, actor: staff
  });
  if (result.mismatch) {
    throw new PaymentError(`KES ${Number(amount).toLocaleString('en-KE')} is less than the order total of KES ${Number(order.total).toLocaleString('en-KE')}. Collect the full amount before recording.`, 409, 'AMOUNT_MISMATCH');
  }
  await logAudit({ actorId: staff.id, actorName: staff.name, action: 'PAYMENT_COLLECTED', entity: 'Order', entityId: order.id, newValue: `${COLLECTION_METHODS[method]} · ${ref}`, ip });
  return result.order;
}

// Releases stock held by bank-transfer orders nobody paid for. Orders with
// transfer details awaiting staff review are left alone.
export async function expireStaleBankTransferOrders() {
  const company = await getCompanyProfile();
  const hours = Number(company?.bankTransferHoldHours || 48);
  const cutoff = new Date(Date.now() - hours * 3600 * 1000);
  const stale = await db.select({ id: orders.id }).from(orders).where(and(
    eq(orders.paymentMethod, BANK_LABEL),
    eq(orders.status, 'Payment Pending'),
    inArray(orders.paymentStatus, ['Pending', 'Failed']),
    lt(orders.createdAt, cutoff),
    sql`NOT EXISTS (SELECT 1 FROM ${paymentAttempts} pa WHERE pa.order_id = ${orders.id} AND pa.provider = 'bank_transfer' AND pa.status = 'pending')`
  )).limit(100);
  let expired = 0;
  for (const { id } of stale) {
    try {
      await cancelUnpaidOrder(id, { note: `Automatically cancelled: no bank transfer received within ${hours} hours.` });
      expired += 1;
    } catch {
      // changed concurrently — skip
    }
  }
  return expired;
}

export async function listBankSubmissions({ status = 'pending', limit = 100 } = {}) {
  const rows = await db.select({ attempt: paymentAttempts, order: orders }).from(paymentAttempts)
    .innerJoin(orders, eq(orders.id, paymentAttempts.orderId))
    .where(and(eq(paymentAttempts.provider, 'bank_transfer'), status ? eq(paymentAttempts.status, status) : undefined))
    .orderBy(status === 'pending' ? paymentAttempts.createdAt : desc(paymentAttempts.createdAt))
    .limit(Math.min(Number(limit) || 100, 300));
  return rows.map(({ attempt, order }) => ({
    id: attempt.id,
    status: attempt.status,
    amount: Number(attempt.amount),
    reference: attempt.providerReference,
    payerName: attempt.rawResponse?.payerName || attempt.payerHint || null,
    bankName: attempt.rawResponse?.bankName || null,
    paidOn: attempt.rawResponse?.paidOn || null,
    failureReason: attempt.failureReason,
    createdAt: attempt.createdAt,
    order: {
      id: order.id, orderNumber: order.orderNumber, total: Number(order.total), customerName: order.customerName,
      customerEmail: order.customerEmail, customerPhone: order.customerPhone, status: order.status, paymentStatus: order.paymentStatus
    }
  }));
}
