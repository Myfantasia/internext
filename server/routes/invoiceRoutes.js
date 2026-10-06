import express from 'express';
import { db } from '../db/client.js';
import { findOrderByIdentifier, canAccessOrder } from '../repositories/ordersRepo.js';
import { findInvoiceByOrderId } from '../repositories/invoicesRepo.js';
import { getCompanyProfile } from '../repositories/companyProfileRepo.js';
import { streamInvoicePdf } from '../services/invoiceService.js';
import { requireAuth } from '../middleware/authorize.js';

const router = express.Router();

router.get('/orders/:id/invoice.pdf', requireAuth, async (req, res) => {
  const order = await findOrderByIdentifier(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  if (!canAccessOrder(req.user, order)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to view this invoice' });
  }

  const invoice = await findInvoiceByOrderId(order.id, db);
  if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found for this order' });

  const company = await getCompanyProfile();
  streamInvoicePdf(res, { order, invoice, company });
});

export default router;
