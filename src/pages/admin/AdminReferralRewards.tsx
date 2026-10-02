import React, { useEffect, useState } from 'react';
import { Gift, Save, ShieldCheck } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

type RewardSettings = {
  referralsRequired: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  isActive: boolean;
};
const defaults: RewardSettings = { referralsRequired: 3, discountType: 'percentage', discountValue: 5, minOrderAmount: 0, maxDiscountAmount: null, isActive: false };

export const AdminReferralRewards: React.FC = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<RewardSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/referral-rewards').then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.settings) setSettings({
          referralsRequired: Number(data.settings.referralsRequired),
          discountType: data.settings.discountType,
          discountValue: Number(data.settings.discountValue),
          minOrderAmount: Number(data.settings.minOrderAmount || 0),
          maxDiscountAmount: data.settings.maxDiscountAmount == null ? null : Number(data.settings.maxDiscountAmount),
          isActive: !!data.settings.isActive
        });
      }).catch(() => showToast('Could not load referral rewards settings', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/referral-rewards', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not save the reward settings');
      showToast('Referral rewards settings saved', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save the reward settings', 'error');
    } finally { setSaving(false); }
  };

  const update = <K extends keyof RewardSettings>(key: K, value: RewardSettings[K]) => setSettings((prev) => ({ ...prev, [key]: value }));

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading referral rewards…</div>;
  return <div className="max-w-3xl space-y-6 animate-in fade-in duration-200">
    <div><div className="flex items-center gap-2"><Gift className="h-5 w-5 text-cyan-400" /><h2 className="text-xl font-bold text-white">Referral rewards</h2></div><p className="mt-1 text-sm text-slate-400">Choose how many successful referrals earn a discount coupon.</p></div>
    <form onSubmit={save} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
      <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <input type="checkbox" checked={settings.isActive} onChange={(e) => update('isActive', e.target.checked)} className="mt-1 accent-emerald-500" />
        <span><span className="block text-sm font-bold text-white">Enable referral rewards</span><span className="mt-1 block text-xs text-slate-400">Each reward is a private, one-use coupon issued after the referral milestone is reached.</span></span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-300">Verified referrals per reward</span><input type="number" min="1" max="1000" required value={settings.referralsRequired} onChange={(e) => update('referralsRequired', Number(e.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" /></label>
        <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-300">Reward type</span><select value={settings.discountType} onChange={(e) => update('discountType', e.target.value as RewardSettings['discountType'])} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"><option value="percentage">Percentage discount</option><option value="fixed">Fixed amount (KES)</option></select></label>
        <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-300">Discount {settings.discountType === 'percentage' ? '(%)' : '(KES)'}</span><input type="number" min="0.01" max={settings.discountType === 'percentage' ? 100 : 1000000} step="0.01" required value={settings.discountValue} onChange={(e) => update('discountValue', Number(e.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" /></label>
        <label className="space-y-1.5"><span className="text-xs font-semibold text-slate-300">Minimum order (KES)</span><input type="number" min="0" step="1" value={settings.minOrderAmount} onChange={(e) => update('minOrderAmount', Number(e.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" /></label>
        {settings.discountType === 'percentage' && <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-semibold text-slate-300">Maximum discount (KES, optional)</span><input type="number" min="0" step="1" value={settings.maxDiscountAmount ?? ''} onChange={(e) => update('maxDiscountAmount', e.target.value === '' ? null : Number(e.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" /></label>}
      </div>
      <div className="flex items-start gap-2 rounded-xl bg-emerald-950/30 p-3 text-xs leading-relaxed text-emerald-200"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>Only referred accounts with a verified email count toward rewards. Each issued coupon can be used once and expires after 90 days.</span></div>
      <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save reward settings'}</button>
    </form>
  </div>;
};
