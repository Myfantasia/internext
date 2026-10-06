import PDFDocument from 'pdfkit';

// Business documents (tax invoice + payment receipt) share one A4 layout.
// Receipts exist only for confirmed payments (see receiptsRepo) — the
// renderer never claims payment on its own.

const C = {
  brand: '#1f4d3a',
  accent: '#2f7a57',
  ink: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  line: '#dfe5e1',
  panel: '#f4f7f5',
  paid: '#15803d',
  due: '#b45309'
};
const PAGE = { left: 40, right: 555, width: 515 };

function money(amount, currency = 'KES') {
  return `${currency} ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function nairobiDateTime(date) {
  return new Date(date).toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

function companyInfo(company) {
  return {
    name: company?.name || 'Internext Business System',
    tagline: company?.tagline || 'We Make Technology Happen',
    address: company?.address || 'Princely House, 1st Floor, Moi Avenue, Nairobi',
    poBox: company?.poBox || 'P.O. Box 16806-00100, Nairobi, Kenya',
    phones: [company?.phonePrimary || '+254 722 664 457', company?.phoneSecondary].filter(Boolean).join(' / '),
    email: company?.email || 'info@internextbusinesssystem.co.ke',
    supportEmail: company?.supportEmail || company?.email || 'info@internextbusinesssystem.co.ke',
    website: company?.website || 'internextbusinesssystem.co.ke',
    kraPin: company?.kraPin || null,
    notes: company?.receiptNotes || null
  };
}

function drawHeader(doc, co, { title, number, date, orderNumber, stamp }) {
  doc.rect(0, 0, doc.page.width, 8).fill(C.brand);

  doc.font('Helvetica-Bold').fontSize(17).fillColor(C.brand).text(co.name, PAGE.left, 30, { width: 300 });
  doc.font('Helvetica').fontSize(7.5).fillColor(C.accent).text(co.tagline.toUpperCase(), PAGE.left, doc.y + 1, { width: 300, characterSpacing: 0.8 });
  doc.moveDown(0.5).font('Helvetica').fontSize(8.5).fillColor(C.body);
  [co.address, co.poBox, `Tel: ${co.phones}`, `Email: ${co.email}`, co.website, co.kraPin ? `KRA PIN: ${co.kraPin}` : null]
    .filter(Boolean)
    .forEach((line) => doc.text(line, PAGE.left, doc.y, { width: 300 }));
  const leftBottom = doc.y;

  doc.font('Helvetica-Bold').fontSize(19).fillColor(C.ink).text(title, 330, 30, { width: 225, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(C.body);
  const meta = [[`${title.includes('RECEIPT') ? 'Receipt' : 'Invoice'} No.`, number], ['Date', nairobiDateTime(date)], ['Order No.', orderNumber]];
  let y = 58;
  for (const [label, value] of meta) {
    doc.fillColor(C.muted).text(label, 330, y, { width: 95, align: 'right' });
    doc.fillColor(C.ink).font('Helvetica-Bold').text(value, 430, y, { width: 125, align: 'right' });
    doc.font('Helvetica');
    y += 14;
  }
  if (stamp) {
    const w = 110;
    doc.roundedRect(PAGE.right - w, y + 4, w, 22, 4).lineWidth(1.2).strokeColor(stamp.color).stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(stamp.color).text(stamp.text, PAGE.right - w, y + 10, { width: w, align: 'center' });
    y += 30;
  }

  const bottom = Math.max(leftBottom, y) + 10;
  doc.moveTo(PAGE.left, bottom).lineTo(PAGE.right, bottom).lineWidth(1).strokeColor(C.line).stroke();
  return bottom + 12;
}

function panel(doc, x, y, w, title, lines) {
  const startY = y;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.accent).text(title.toUpperCase(), x + 10, y + 9, { width: w - 20, characterSpacing: 0.6 });
  let cy = doc.y + 3;
  doc.font('Helvetica').fontSize(9).fillColor(C.ink);
  for (const [i, line] of lines.filter(Boolean).entries()) {
    doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fillColor(i === 0 ? C.ink : C.body).text(line, x + 10, cy, { width: w - 20 });
    cy = doc.y + 1;
  }
  const h = cy - startY + 8;
  doc.save().roundedRect(x, startY, w, h, 6).lineWidth(0.8).strokeColor(C.line).stroke().restore();
  return startY + h;
}

function deliveryLines(order) {
  const a = order.deliveryAddress || {};
  const q = order.deliveryQuote || {};
  if (a.pickup || q.kind === 'pickup') return [order.deliveryMethod || 'Store pickup', 'Collect from our office — bring your order number.'];
  return [
    order.deliveryMethod || 'Delivery',
    [a.building, a.street].filter(Boolean).join(', '),
    [a.town, a.county].filter(Boolean).join(', '),
    order.deliveryDistanceKm != null ? `Approx. ${order.deliveryDistanceKm} km from our office${q.estimated ? ' (estimate)' : ''}` : null,
    a.deliveryNotes ? `Notes: ${a.deliveryNotes}` : null
  ];
}

const COLS = { n: 40, item: 62, sku: 300, qty: 372, unit: 402, amount: 480 };

function tableHeader(doc, y) {
  doc.rect(PAGE.left, y, PAGE.width, 20).fill(C.panel);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.body);
  doc.text('#', COLS.n + 4, y + 6, { width: 18 });
  doc.text('Product', COLS.item, y + 6, { width: 230 });
  doc.text('SKU', COLS.sku, y + 6, { width: 70 });
  doc.text('Qty', COLS.qty, y + 6, { width: 26, align: 'right' });
  doc.text('Unit price', COLS.unit, y + 6, { width: 74, align: 'right' });
  doc.text('Amount', COLS.amount, y + 6, { width: 75, align: 'right' });
  return y + 26;
}

function drawItems(doc, order, y) {
  y = tableHeader(doc, y);
  order.items.forEach((item, index) => {
    const name = item.variantName ? `${item.name} — ${item.variantName}` : item.name;
    const desc = item.shortDescription || '';
    const nameH = doc.font('Helvetica-Bold').fontSize(9).heightOfString(name, { width: 230 });
    const descH = desc ? doc.font('Helvetica').fontSize(7.5).heightOfString(desc, { width: 230 }) : 0;
    const discounted = item.originalPrice != null && item.originalPrice > item.price;
    const rowH = Math.max(nameH + descH + 6, discounted ? 26 : 16) + 6;

    if (y + rowH > doc.page.height - 120) {
      doc.addPage();
      y = tableHeader(doc, 40);
    }

    doc.font('Helvetica').fontSize(9).fillColor(C.muted).text(String(index + 1), COLS.n + 4, y, { width: 18 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.ink).text(name, COLS.item, y, { width: 230 });
    if (desc) doc.font('Helvetica').fontSize(7.5).fillColor(C.muted).text(desc, COLS.item, doc.y + 1, { width: 230 });
    doc.font('Helvetica').fontSize(8).fillColor(C.body).text(item.sku || '—', COLS.sku, y, { width: 70 });
    doc.fontSize(9).fillColor(C.ink).text(String(item.quantity), COLS.qty, y, { width: 26, align: 'right' });
    doc.text(money(item.price, order.currency), COLS.unit, y, { width: 74, align: 'right' });
    if (discounted) {
      doc.fontSize(7).fillColor(C.muted).text(`was ${money(item.originalPrice, order.currency)}`, COLS.unit - 10, y + 11, { width: 84, align: 'right' });
    }
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.ink).text(money(item.price * item.quantity, order.currency), COLS.amount, y, { width: 75, align: 'right' });

    y += rowH;
    doc.moveTo(PAGE.left, y - 3).lineTo(PAGE.right, y - 3).lineWidth(0.5).strokeColor(C.line).stroke();
  });

  // Delivery is a billable line like any item, so the invoice shows what the
  // customer pays for it (or that it was free) and how it was priced.
  const q = order.deliveryQuote || {};
  const pickup = order.deliveryAddress?.pickup || q.kind === 'pickup';
  const deliveryName = pickup ? `Store pickup${order.deliveryMethod && order.deliveryMethod !== 'Store pickup' ? ` — ${order.deliveryMethod}` : ''}` : `Delivery — ${order.deliveryMethod || 'Courier'}`;
  const deliveryDesc = pickup
    ? 'Collect from our store with your order number.'
    : [order.deliveryDistanceKm != null ? `Approx. ${order.deliveryDistanceKm} km from our office${q.estimated ? ' (estimate)' : ''}` : null,
      [order.deliveryAddress?.town, order.deliveryAddress?.county].filter(Boolean).join(', ') || null,
      q.baseFee > 0 && order.deliveryFee === 0 ? `Free-delivery offer applied (normally ${money(q.baseFee, order.currency)})` : null].filter(Boolean).join(' · ');
  const descH = deliveryDesc ? doc.font('Helvetica').fontSize(7.5).heightOfString(deliveryDesc, { width: 230 }) : 0;
  const rowH = Math.max(16 + descH, 16) + 6;
  if (y + rowH > doc.page.height - 120) {
    doc.addPage();
    y = tableHeader(doc, 40);
  }
  doc.font('Helvetica').fontSize(9).fillColor(C.muted).text(String(order.items.length + 1), COLS.n + 4, y, { width: 18 });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.ink).text(deliveryName, COLS.item, y, { width: 230 });
  if (deliveryDesc) doc.font('Helvetica').fontSize(7.5).fillColor(C.muted).text(deliveryDesc, COLS.item, doc.y + 1, { width: 230 });
  doc.font('Helvetica').fontSize(8).fillColor(C.body).text(pickup ? 'PICKUP' : 'DELIVERY', COLS.sku, y, { width: 70 });
  doc.fontSize(9).fillColor(C.ink).text('1', COLS.qty, y, { width: 26, align: 'right' });
  const fee = order.deliveryFee > 0 ? money(order.deliveryFee, order.currency) : 'Free';
  doc.text(fee, COLS.unit, y, { width: 74, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.ink).text(fee, COLS.amount, y, { width: 75, align: 'right' });
  y += rowH;
  doc.moveTo(PAGE.left, y - 3).lineTo(PAGE.right, y - 3).lineWidth(0.5).strokeColor(C.line).stroke();
  return y + 6;
}

// "How to pay" box on unpaid invoices for bank transfer / pay on delivery.
function drawPaymentInstructions(doc, order, company, y) {
  if (order.paymentStatus === 'Paid' || order.status === 'Cancelled') return y;
  const method = order.paymentMethod || '';
  let lines = null;
  if (method.startsWith('Bank Transfer')) {
    const b = company || {};
    lines = b.bankAccountNumber ? [
      'How to pay — bank transfer',
      [b.bankName, b.bankBranch].filter(Boolean).join(', ') || null,
      `Account name: ${b.bankAccountName || b.name || '—'}`,
      `Account number: ${b.bankAccountNumber}${b.bankSwiftCode ? `   ·   SWIFT: ${b.bankSwiftCode}` : ''}`,
      `Reference: ${order.orderNumber}   ·   Amount: ${money(order.total, order.currency)}`,
      b.mpesaPaybill ? `Or M-Pesa Pay Bill ${b.mpesaPaybill}, account ${b.mpesaAccountNo || order.orderNumber}` : null,
      "After paying, open your order online and tap \"I've paid\" to send us the transaction reference. Goods ship once funds clear."
    ] : ['How to pay — bank transfer', `Call us for our bank details. Quote ${order.orderNumber} as the reference.`];
  } else if (method === 'Cash on Delivery') {
    lines = [
      'Pay on delivery',
      `Amount to pay on ${order.deliveryAddress?.pickup ? 'collection' : 'delivery'}: ${money(order.total, order.currency)}`,
      `Accepted: cash, M-Pesa${company?.mpesaTill || company?.mpesaPaybill ? ` (${company.mpesaTill || company.mpesaPaybill})` : ''} or card. A receipt is issued when payment is recorded.`
    ];
  }
  if (!lines) return y;
  if (y > doc.page.height - 200) {
    doc.addPage();
    y = 40;
  }
  return panel(doc, PAGE.left, y, PAGE.width, 'Payment instructions', lines) + 10;
}

function drawTotals(doc, order, y, { amountPaid }) {
  if (y > doc.page.height - 230) {
    doc.addPage();
    y = 40;
  }
  const x = 330;
  const rows = [['Items subtotal', money(order.subtotal, order.currency)]];
  if (order.flashDealSavings > 0) rows.push(['Flash-deal savings (already applied)', money(order.flashDealSavings, order.currency)]);
  if (order.discountAmount > 0) rows.push([`Promo discount${order.couponCode ? ` (${order.couponCode})` : ''}`, `- ${money(order.discountAmount, order.currency)}`]);
  rows.push([`Delivery${order.deliveryMethod ? ` — ${order.deliveryMethod}` : ''}`, order.deliveryFee > 0 ? money(order.deliveryFee, order.currency) : 'Free']);
  rows.push([`VAT ${order.taxRate ?? 16}% (included in prices)`, money(order.taxAmount, order.currency)]);

  doc.fontSize(9);
  for (const [label, value] of rows) {
    doc.font('Helvetica').fillColor(C.body).text(label, x, y, { width: 140 });
    const labelBottom = doc.y;
    doc.fillColor(C.ink).text(value, 470, y, { width: 85, align: 'right' });
    y = Math.max(labelBottom, doc.y) + 4;
  }
  doc.moveTo(x, y).lineTo(PAGE.right, y).lineWidth(1).strokeColor(C.ink).stroke();
  y += 8;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.brand).text('TOTAL', x, y, { width: 120 });
  doc.text(money(order.total, order.currency), 440, y, { width: 115, align: 'right' });
  y += 20;

  if (amountPaid != null) {
    const balance = Math.max(0, Number(order.total) - Number(amountPaid));
    doc.font('Helvetica').fontSize(9).fillColor(C.body).text('Amount paid', x, y, { width: 120 });
    doc.font('Helvetica-Bold').fillColor(C.paid).text(money(amountPaid, order.currency), 440, y, { width: 115, align: 'right' });
    y += 14;
    doc.font('Helvetica').fillColor(C.body).text('Balance due', x, y, { width: 120 });
    doc.font('Helvetica-Bold').fillColor(balance > 0 ? C.due : C.ink).text(money(balance, order.currency), 440, y, { width: 115, align: 'right' });
    y += 16;
  }
  return y;
}

function drawNotes(doc, co, y, { kind }) {
  if (y > doc.page.height - 170) {
    doc.addPage();
    y = 40;
  }
  y += 8;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.ink).text('Terms & notes', PAGE.left, y);
  const defaults = [
    'Prices are in Kenya Shillings and include VAT where stated.',
    'Warranty terms are as listed for each product; keep this document as proof of purchase.',
    'Goods may be returned in original condition within 7 days per our Returns Policy. Services are non-returnable once rendered.',
    kind === 'invoice'
      ? 'This tax invoice documents the amount owed. A payment receipt is issued only once payment is confirmed.'
      : 'This receipt confirms payment received for the order referenced above.'
  ];
  const notes = co.notes ? co.notes.split('\n').filter(Boolean) : defaults;
  doc.font('Helvetica').fontSize(7.8).fillColor(C.body);
  for (const note of notes) doc.text(`•  ${note}`, PAGE.left, doc.y + 2, { width: PAGE.width });

  doc.moveDown(0.8).font('Helvetica').fontSize(8).fillColor(C.muted)
    .text(`Questions? Call ${co.phones} or email ${co.supportEmail}. Quote your order number for faster help.`, PAGE.left, doc.y, { width: PAGE.width });
}

function drawFooters(doc, co, label) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // Writing inside the bottom margin would make PDFKit start a new page.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 34;
    doc.moveTo(PAGE.left, y - 6).lineTo(PAGE.right, y - 6).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font('Helvetica').fontSize(7).fillColor(C.muted)
      .text(`${co.name} · ${label} · Computer-generated document, valid without signature.`, PAGE.left, y, { width: 400, lineBreak: false })
      .text(`Page ${i - range.start + 1} of ${range.count}`, 455, y, { width: 100, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottomMargin;
  }
}

function render(doc, { order, company, kind, number, date, payment }) {
  const co = companyInfo(company);
  const isReceipt = kind === 'receipt';
  const paid = order.paymentStatus === 'Paid';
  let y = drawHeader(doc, co, {
    title: isReceipt ? 'PAYMENT RECEIPT' : 'TAX INVOICE',
    number,
    date,
    orderNumber: order.orderNumber,
    stamp: isReceipt || paid ? { text: 'PAID', color: C.paid } : { text: 'PAYMENT DUE', color: C.due }
  });

  const half = (PAGE.width - 12) / 2;
  const custBottom = panel(doc, PAGE.left, y, half, 'Billed to', [order.customer.name, order.customer.email, order.customer.phone]);
  const delBottom = panel(doc, PAGE.left + half + 12, y, half, 'Delivery', deliveryLines(order));
  y = Math.max(custBottom, delBottom) + 10;

  y = panel(doc, PAGE.left, y, PAGE.width, 'Payment', [
    `${order.paymentMethod || '—'} · Status: ${order.paymentStatus}`,
    payment?.reference || order.paymentReference ? `Transaction reference: ${payment?.reference || order.paymentReference}` : null,
    order.paidAt ? `Paid on: ${nairobiDateTime(order.paidAt)}` : null,
    isReceipt && payment?.receiptNumber ? `Receipt: ${payment.receiptNumber}` : null
  ]) + 14;

  y = drawItems(doc, order, y);
  y = drawTotals(doc, order, y, { amountPaid: isReceipt ? payment?.amount ?? order.total : (paid ? order.total : 0) });
  if (!isReceipt) y = drawPaymentInstructions(doc, order, company, y + 4);
  drawNotes(doc, co, y, { kind });
  drawFooters(doc, co, isReceipt ? `Receipt ${number}` : `Invoice ${number}`);
}

function newDoc(title) {
  return new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: title, Author: 'Internext Business System' } });
}

export function streamInvoicePdf(res, { order, invoice, company }) {
  const doc = newDoc(`Tax Invoice ${invoice.invoiceNumber}`);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);
  render(doc, { order, company, kind: 'invoice', number: invoice.invoiceNumber, date: invoice.issuedAt });
  doc.end();
}

export function streamReceiptPdf(res, { order, receipt, company }) {
  const doc = newDoc(`Receipt ${receipt.receiptNumber}`);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${receipt.receiptNumber}.pdf"`);
  doc.pipe(res);
  render(doc, {
    order, company, kind: 'receipt', number: receipt.receiptNumber, date: receipt.issuedAt,
    payment: { amount: Number(receipt.amount), reference: order.paymentReference, receiptNumber: receipt.receiptNumber }
  });
  doc.end();
}

// In-memory PDF (for email attachments).
export function receiptPdfBuffer({ order, receipt, company }) {
  return new Promise((resolve, reject) => {
    const doc = newDoc(`Receipt ${receipt.receiptNumber}`);
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    render(doc, {
      order, company, kind: 'receipt', number: receipt.receiptNumber, date: receipt.issuedAt,
      payment: { amount: Number(receipt.amount), reference: order.paymentReference, receiptNumber: receipt.receiptNumber }
    });
    doc.end();
  });
}
