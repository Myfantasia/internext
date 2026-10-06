import express from 'express';
import { db } from '../db/client.js';
import { findOrderByIdentifier, canAccessOrder } from '../repositories/ordersRepo.js';
import { findReceiptByOrderId } from '../repositories/receiptsRepo.js';
import { getCompanyProfile } from '../repositories/companyProfileRepo.js';
import { streamReceiptPdf } from '../services/receiptService.js';
import { requireAuth } from '../middleware/authorize.js';

const router = express.Router();

router.get('/orders/:id/receipt.pdf', requireAuth, async (req, res) => {
  const order = await findOrderByIdentifier(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  if (!canAccessOrder(req.user, order)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to view this receipt' });
  }

  const receipt = await findReceiptByOrderId(order.id, db);
  if (!receipt) {
    // Correctly reflects business reality: no confirmed payment yet, so no
    // receipt exists — an order alone is never treated as "paid".
    return res.status(404).json({ success: false, message: 'No receipt yet — payment has not been confirmed for this order' });
  }

  const company = await getCompanyProfile();
  streamReceiptPdf(res, { order, receipt, company });
});

export default router;
