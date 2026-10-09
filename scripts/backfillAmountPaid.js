import { db } from '../server/db/client.js';
import { orders } from '../server/db/schema.js';
import { eq, sql } from 'drizzle-orm';

async function run() {
  console.log('Backfilling amount_paid for historically Paid orders...');
  try {
    const result = await db.update(orders)
      .set({ amountPaid: orders.total })
      .where(eq(orders.paymentStatus, 'Paid'));
      
    console.log(`Successfully backfilled amount_paid.`);
  } catch (err) {
    console.error('Error during backfill:', err);
  } finally {
    process.exit(0);
  }
}

run();
