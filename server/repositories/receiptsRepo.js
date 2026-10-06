import { eq, sql } from 'drizzle-orm';
import { receipts, payments } from '../db/schema.js';

function receiptNumberFor(seq) {
  const year = new Date().getFullYear();
  return `RCT-${year}-${String(seq).padStart(6, '0')}`;
}

// Receipts are only ever created here — i.e. only when a payment is actually
// confirmed (see ordersRepo.confirmOrderPayment). Creating an order never
// implies payment was received.
export async function createReceiptForPayment(tx, order, { amount, paymentMethod, provider, providerReference, rawPayload }) {
  const [payment] = await tx
    .insert(payments)
    .values({
      orderId: order.id,
      provider: provider || paymentMethod || 'manual',
      amount: String(amount),
      status: 'COMPLETED',
      providerReference,
      rawPayload: rawPayload || null
    })
    .returning();

  const [{ seq }] = await tx.execute(sql`select nextval('receipt_number_seq')::bigint as seq`);
  const [receipt] = await tx
    .insert(receipts)
    .values({
      receiptNumber: receiptNumberFor(seq),
      orderId: order.id,
      paymentId: payment.id,
      amount: String(amount),
      paymentMethod: paymentMethod || 'M-Pesa'
    })
    .returning();
  // Re-confirmation of an already-receipted order is prevented upstream
  // (confirmOrderPayment locks the order row and exits if already Paid).

  return { receipt, payment };
}

export async function findReceiptByOrderId(orderId, database) {
  const [row] = await database.select().from(receipts).where(eq(receipts.orderId, orderId)).limit(1);
  return row || null;
}
