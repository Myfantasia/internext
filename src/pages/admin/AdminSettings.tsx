import React, { useState } from 'react';
import { Settings, Save, Shield, Smartphone, DollarSign, Palette, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { EmailSettingsPanel } from './EmailSettingsPanel';

export const AdminSettings: React.FC = () => {
  const { settings, updateSettings, formatPrice } = useStore();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({ ...settings });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings(formData);
      showToast('Store settings updated successfully!', 'success');
    } catch {
      showToast('Failed to save settings', 'error');
    }
    setIsSaving(false);
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl animate-in fade-in duration-200 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Store Identity & Gateway Settings</h2>
          <p className="text-slate-400">Business details shown on the store, invoices and receipts. Payment API keys (M-Pesa Daraja, Stripe) and SMTP passwords live in the server's .env file, never in the database</p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition-all self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>Save Store Settings</span>
        </button>
      </div>

      {/* 1. STORE IDENTITY */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider text-cyan-400">
          1. Store Identity & Physical Headquarters
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 mb-1 font-bold">Store Name:</label>
            <input
              type="text"
              value={formData.storeName}
              onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-bold">Brand Tagline:</label>
            <input
              type="text"
              value={formData.tagline}
              onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-bold">Primary Phone:</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-bold">WhatsApp Hotline:</label>
            <input
              type="text"
              value={formData.whatsappNumber}
              onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-400 mb-1 font-bold">Physical Store Address:</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
            />
          </div>
        </div>
      </div>

      {/* 2. SAFARICOM M-PESA DARAJA GATEWAY */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-sm">
          <Smartphone className="w-4 h-4" />
          <span>2. Safaricom M-Pesa STK Push Gateway (Daraja API)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 mb-1 font-bold">Paybill / Till Number:</label>
            <input
              type="text"
              value={formData.mpesaPaybill}
              onChange={(e) => setFormData({ ...formData, mpesaPaybill: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-bold">Account Reference Prefix:</label>
            <input
              type="text"
              value={formData.mpesaAccountNo}
              onChange={(e) => setFormData({ ...formData, mpesaAccountNo: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
            />
          </div>
        </div>

        <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-[11px]">
          ✓ Real-time STK Push simulation and verification callbacks are enabled for demo transactions.
        </div>
      </div>

      {/* 3. TAX & SHIPPING POLICIES */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider text-cyan-400">
          3. Shipping Thresholds & Tax Rates
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 mb-1 font-bold">Free Courier Shipping Threshold (KES):</label>
            <input
              type="number"
              value={formData.freeShippingThreshold}
              onChange={(e) => setFormData({ ...formData, freeShippingThreshold: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-bold">Kenya VAT Tax Rate (%):</label>
            <input
              type="number"
              value={formData.taxRate}
              onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
            />
          </div>
        </div>
        <p className="text-slate-500">Delivery fees are now set per distance under Sales → Delivery Pricing. The free-shipping threshold here is kept for older pages only.</p>
      </div>

      {/* BANK TRANSFER & PAY ON DELIVERY */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400">Bank transfer & pay on delivery</h3>
        <p className="text-slate-400">These bank details are shown to customers who choose bank transfer — on their order page, invoice and confirmation email.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="bank-name" className="field-label">Bank</label>
            <input id="bank-name" value={formData.bankName || ''} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} className="field-input" placeholder="e.g. Equity Bank Kenya" />
          </div>
          <div>
            <label htmlFor="bank-branch" className="field-label">Branch</label>
            <input id="bank-branch" value={formData.bankBranch || ''} onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })} className="field-input" placeholder="e.g. Moi Avenue" />
          </div>
          <div>
            <label htmlFor="bank-acc-name" className="field-label">Account name</label>
            <input id="bank-acc-name" value={formData.bankAccountName || ''} onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })} className="field-input" placeholder="Internext Business System Ltd" />
          </div>
          <div>
            <label htmlFor="bank-acc-no" className="field-label">Account number</label>
            <input id="bank-acc-no" value={formData.bankAccountNumber || ''} onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })} className="field-input font-mono" />
            <p className="field-hint">Leave empty to hide bank details (customers will be asked to call).</p>
          </div>
          <div>
            <label htmlFor="bank-swift" className="field-label">SWIFT / BIC</label>
            <input id="bank-swift" value={formData.bankSwiftCode || ''} onChange={(e) => setFormData({ ...formData, bankSwiftCode: e.target.value.toUpperCase() })} className="field-input font-mono" maxLength={20} />
          </div>
          <div>
            <label htmlFor="bank-hold" className="field-label">Reserve stock for unpaid transfers (hours)</label>
            <input id="bank-hold" type="number" min={6} max={168} value={formData.bankTransferHoldHours ?? 48} onChange={(e) => setFormData({ ...formData, bankTransferHoldHours: Number(e.target.value) })} className="field-input" />
            <p className="field-hint">After this, unpaid bank-transfer orders are cancelled — unless the customer has reported a transfer awaiting your review.</p>
          </div>
          <div>
            <label htmlFor="cod-cap" className="field-label">Pay on delivery: maximum order total (KES)</label>
            <input id="cod-cap" type="number" min={0} value={formData.codMaxOrderAmount ?? ''} onChange={(e) => setFormData({ ...formData, codMaxOrderAmount: e.target.value === '' ? null : Number(e.target.value) })} className="field-input" placeholder="No limit" />
            <p className="field-hint">Larger orders must be paid upfront. Customers can also have only one unpaid pay-on-delivery order at a time.</p>
          </div>
        </div>
      </div>

      {/* RECEIPTS & TAX DOCUMENTS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400">Receipts & tax invoices</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="kra-pin" className="field-label">KRA PIN</label>
            <input id="kra-pin" value={formData.kraPin || ''} onChange={(e) => setFormData({ ...formData, kraPin: e.target.value.toUpperCase() })} className="field-input font-mono" placeholder="P051234567X" maxLength={20} />
            <p className="field-hint">Printed on every invoice and receipt. Leave empty to omit.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="receipt-notes" className="field-label">Terms & notes on receipts</label>
            <textarea id="receipt-notes" rows={4} value={formData.receiptNotes || ''} onChange={(e) => setFormData({ ...formData, receiptNotes: e.target.value })} className="field-input" maxLength={2000} placeholder="One note per line. Leave empty to use the built-in returns/warranty notes." />
            <p className="field-hint">One note per line, e.g. bank details for transfers or your returns policy.</p>
          </div>
        </div>
      </div>
    </form>
    <EmailSettingsPanel />
    </>
  );
};
