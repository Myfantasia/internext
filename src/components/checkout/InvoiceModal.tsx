import React from 'react';
import { Printer, Download, X, Zap, CheckCircle2, ReceiptText } from 'lucide-react';
import { Order } from '../../types';
import { useStore } from '../../context/StoreContext';
import { Portal, useBodyScrollLock, useEscapeKey } from '../common/Overlay';

interface InvoiceModalProps {
  order: Order;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, onClose }) => {
  const { formatPrice, settings } = useStore();
  useBodyScrollLock();
  useEscapeKey(onClose);
  const isPickup = !!(order.deliveryAddress?.pickup || order.deliveryQuote?.kind === 'pickup');
  const unpaid = order.paymentStatus !== 'Paid' && order.status !== 'Cancelled';
  const isBank = order.paymentMethod?.startsWith('Bank Transfer');

  const handlePrint = () => {
    window.print();
  };

  return (
    <Portal>
    <div className="print-overlay fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto overscroll-contain">
      <div className="bg-white text-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative my-8 print:m-0 print:p-0 print:shadow-none print:w-full print:max-w-none">
        {/* Top Action Bar (hidden on print) */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2 font-bold text-slate-700 text-xs uppercase tracking-wider">
            <span>Official Tax Invoice</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">{order.paymentStatus}</span>
          </div>
          <div className="flex items-center gap-2">
            {order.paymentStatus === 'Paid' && (
              <a href={`/api/orders/${order.id}/receipt.pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors">
                <ReceiptText className="w-4 h-4" />
                <span>Payment Receipt</span>
              </a>
            )}
            <a href={`/api/orders/${order.id}/invoice.pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors">
              <Download className="w-4 h-4" />
              <span>Official PDF Invoice</span>
            </a>
            <button type="button" onClick={handlePrint} className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors">
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Printable Area */}
        <div className="pt-6 space-y-6 text-xs">
          {/* Header & Logo */}
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 text-slate-950">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm">
                  ⚡
                </div>
                <span className="text-xl font-black tracking-tight">{settings.storeName}</span>
              </div>
              <div className="text-slate-500 mt-1 text-[11px] leading-relaxed max-w-xs">
                {settings.address} <br />
                Phone: {settings.phone} | Email: {settings.email}
              </div>
            </div>

            <div className="text-right">
              <div className="text-base font-black text-blue-600 font-mono">{order.orderNumber}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Date: {new Date(order.createdAt).toLocaleDateString()}
              </div>
              <div className="text-[11px] text-slate-500">
                Payment Ref: <strong className="text-slate-900 font-mono">{order.paymentReference || 'PENDING'}</strong>
              </div>
            </div>
          </div>

          {/* Billed To / Shipping Address */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Billed / Delivered To:
              </div>
              <div className="font-bold text-slate-900 text-sm">{order.customer.name}</div>
              <div className="text-slate-600 text-[11px]">{order.customer.phone}</div>
              <div className="text-slate-600 text-[11px]">{order.customer.email}</div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Destination & Delivery:
              </div>
              <div className="text-slate-800 text-[11px]">
                {order.deliveryAddress.building && `${order.deliveryAddress.building}, `}
                {order.deliveryAddress.street && `${order.deliveryAddress.street}, `}
                <strong>{order.deliveryAddress.town || 'Nairobi'}, {order.deliveryAddress.county || 'Nairobi'}</strong>
              </div>
              <div className="text-[11px] text-blue-600 font-semibold mt-0.5">
                Method: {order.deliveryMethod}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Item Description & SKU</th>
                  <th className="p-3 text-center w-16">Qty</th>
                  <th className="p-3 text-right w-28">Unit Price</th>
                  <th className="p-3 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {order.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      {item.variantName && (
                        <div className="text-[11px] text-slate-500">{item.variantName}</div>
                      )}
                      <div className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</div>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-800">{item.quantity}</td>
                    <td className="p-3 text-right text-slate-700">{formatPrice(item.price)}</td>
                    <td className="p-3 text-right font-black text-slate-900">
                      {formatPrice(item.price * item.quantity)}
                    </td>
                  </tr>
                ))}
                {/* Delivery is billed as its own line. */}
                <tr>
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{isPickup ? 'Store pickup' : `Delivery — ${order.deliveryMethod || 'Courier'}`}</div>
                    <div className="text-[11px] text-slate-500">
                      {isPickup ? 'Collect from our store with your order number.' : [
                        order.deliveryDistanceKm != null ? `Approx. ${order.deliveryDistanceKm} km from our office${order.deliveryQuote?.estimated ? ' (estimate)' : ''}` : null,
                        [order.deliveryAddress.town, order.deliveryAddress.county].filter(Boolean).join(', ') || null
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-800">1</td>
                  <td className="p-3 text-right text-slate-700">{order.deliveryFee > 0 ? formatPrice(order.deliveryFee) : 'Free'}</td>
                  <td className="p-3 text-right font-black text-slate-900">{order.deliveryFee > 0 ? formatPrice(order.deliveryFee) : 'Free'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Items subtotal:</span>
                <span className="font-bold text-slate-900">{formatPrice(order.subtotal)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Coupon Discount:</span>
                  <span>-{formatPrice(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Delivery / Courier Fee:</span>
                <span className="font-bold text-slate-900">
                  {order.deliveryFee === 0 ? 'FREE' : formatPrice(order.deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>VAT (16% Included):</span>
                <span>{formatPrice(order.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-950 pt-2 border-t border-slate-300">
                <span>Total Paid:</span>
                <span className="text-blue-700">{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* How to pay (unpaid offline orders) */}
          {unpaid && isBank && (
            <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50 text-[11px] text-slate-700 space-y-1">
              <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">How to pay — bank transfer</div>
              {settings.bankAccountNumber ? (
                <>
                  {settings.bankName && <div>Bank: <strong>{settings.bankName}{settings.bankBranch ? `, ${settings.bankBranch}` : ''}</strong></div>}
                  <div>Account name: <strong>{settings.bankAccountName || settings.storeName}</strong></div>
                  <div>Account number: <strong className="font-mono">{settings.bankAccountNumber}</strong>{settings.bankSwiftCode && <> · SWIFT <strong className="font-mono">{settings.bankSwiftCode}</strong></>}</div>
                </>
              ) : <div>Call {settings.phone} for our bank details.</div>}
              <div>Reference: <strong className="font-mono">{order.orderNumber}</strong> · Amount: <strong>{formatPrice(order.total)}</strong></div>
              <div>After paying, open your order and tap “I've paid” to send us the transaction reference.</div>
            </div>
          )}
          {unpaid && order.paymentMethod === 'Cash on Delivery' && (
            <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50 text-[11px] text-slate-700">
              <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Pay on delivery</div>
              Amount to pay on {isPickup ? 'collection' : 'delivery'}: <strong>{formatPrice(order.total)}</strong> — cash, M-Pesa or card.
            </div>
          )}

          {/* Footer Note */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1 text-center">
            <p className="font-bold text-slate-800">Thank you for choosing {settings.storeName}!</p>
            <p>For warranty support or technical service, present this invoice or contact us at {settings.supportEmail}.</p>
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
};
