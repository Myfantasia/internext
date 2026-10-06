import React, { useEffect, useState } from 'react';
import { Gift, Plus, Pencil, Power, Trash2, Users, CheckCircle2, Ticket, Clock } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { api, PageHeader, Modal, Field, Toggle, StatusBadge, LoadingBlock, EmptyState, toLocalInput, fromLocalInput, fmtDateTime } from './adminUi';

type Model = 'one_time' | 'per_referral' | 'recurring' | 'tiered';
interface Program {
  id: string; name: string; description: string | null; rewardModel: Model; valueType: 'percentage' | 'fixed'; value: number;
  thresholdCount: number; tiers: { referrals: number; value: number }[]; maxRewardsPerUser: number | null; minOrderAmount: number;
  maxDiscountAmount: number | null; couponValidDays: number; startsAt: string | null; endsAt: string | null; isActive: boolean; rewardsIssued: number;
}
interface Stats { attributions: Record<string, number>; rewardsIssued: number; rewardsRedeemed: number; activeCodes: number }

const MODELS: { value: Model; label: string; help: string }[] = [
  { value: 'one_time', label: 'One-time reward', help: 'A single reward when the customer reaches the referral count.' },
  { value: 'per_referral', label: 'Reward per referral', help: 'A reward for every qualified referral.' },
  { value: 'recurring', label: 'Recurring (long-term)', help: 'A reward every N referrals, for as long as the programme runs.' },
  { value: 'tiered', label: 'Progressive tiers / milestones', help: 'Bigger rewards at higher referral counts, e.g. 3 → 5%, 10 → 10%.' }
];

const blank = () => ({
  name: '', description: '', rewardModel: 'one_time' as Model, valueType: 'percentage' as 'percentage' | 'fixed', value: 5, thresholdCount: 3,
  tiers: [{ referrals: 3, value: 5 }, { referrals: 10, value: 10 }], maxRewardsPerUser: '' as number | '', minOrderAmount: 0,
  maxDiscountAmount: '' as number | '', couponValidDays: 30, startsAt: '', endsAt: '', isActive: true
});

function programState(p: Program) {
  const now = Date.now();
  if (!p.isActive) return 'inactive';
  if (p.endsAt && new Date(p.endsAt).getTime() <= now) return 'expired';
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return 'scheduled';
  return 'active';
}

function conditions(p: Program) {
  const v = (n: number) => (p.valueType === 'percentage' ? `${n}%` : `KES ${n.toLocaleString('en-KE')}`);
  const base = {
    one_time: `${v(p.value)} once at ${p.thresholdCount} referrals`,
    per_referral: `${v(p.value)} for each referral`,
    recurring: `${v(p.value)} every ${p.thresholdCount} referrals`,
    tiered: p.tiers.map((t) => `${t.referrals} → ${v(t.value)}`).join(' · ')
  }[p.rewardModel];
  const extras = [
    p.maxRewardsPerUser ? `max ${p.maxRewardsPerUser} per customer` : null,
    p.minOrderAmount ? `min order KES ${p.minOrderAmount.toLocaleString('en-KE')}` : null,
    p.maxDiscountAmount ? `cap KES ${p.maxDiscountAmount.toLocaleString('en-KE')}` : null,
    `code valid ${p.couponValidDays} days`
  ].filter(Boolean);
  return `${base}; ${extras.join(', ')}`;
}

export const AdminReferralRewards: React.FC = () => {
  const { showToast } = useToast();
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState(blank());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => api<{ programs: Program[]; stats: Stats }>('/api/admin/referral-programs')
    .then((d) => { setPrograms(d.programs); setStats(d.stats); }).catch((e) => showToast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(blank()); setOpen(true); };
  const openEdit = (p: Program) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || '', rewardModel: p.rewardModel, valueType: p.valueType, value: p.value, thresholdCount: p.thresholdCount,
      tiers: p.tiers.length ? p.tiers : blank().tiers, maxRewardsPerUser: p.maxRewardsPerUser ?? '', minOrderAmount: p.minOrderAmount,
      maxDiscountAmount: p.maxDiscountAmount ?? '', couponValidDays: p.couponValidDays, startsAt: toLocalInput(p.startsAt), endsAt: toLocalInput(p.endsAt), isActive: p.isActive
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        maxRewardsPerUser: form.maxRewardsPerUser === '' ? null : Number(form.maxRewardsPerUser),
        maxDiscountAmount: form.maxDiscountAmount === '' ? null : Number(form.maxDiscountAmount),
        startsAt: fromLocalInput(form.startsAt),
        endsAt: fromLocalInput(form.endsAt)
      };
      await api(editing ? `/api/admin/referral-programs/${editing.id}` : '/api/admin/referral-programs', { method: editing ? 'PUT' : 'POST', body });
      showToast(editing ? 'Reward updated' : 'Reward created — customers who already qualify will receive it automatically.', 'success');
      setOpen(false);
      load();
    } catch (err) { showToast((err as Error).message, 'error'); } finally { setSaving(false); }
  };

  const toggle = async (p: Program) => {
    try { await api(`/api/admin/referral-programs/${p.id}/status`, { method: 'PATCH', body: { isActive: !p.isActive } }); load(); }
    catch (err) { showToast((err as Error).message, 'error'); }
  };

  const setTier = (i: number, key: 'referrals' | 'value', v: number) => setForm({ ...form, tiers: form.tiers.map((t, j) => (j === i ? { ...t, [key]: v } : t)) });
  const unit = form.valueType === 'percentage' ? '%' : 'KES';

  return (
    <div className="space-y-6 animate-fadeInUp">
      <PageHeader
        icon={Gift}
        title="Referral rewards"
        description="Customers share 3-hour referral codes. A referral qualifies when the new customer verifies their email; rewards are issued as single-use promo codes tied to the referrer's account."
        actions={<button type="button" onClick={openCreate} className="btn btn-primary"><Plus className="w-4 h-4" />Add reward</button>}
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Qualified referrals', value: stats.attributions.qualified || 0, icon: CheckCircle2 },
            { label: 'Awaiting verification', value: stats.attributions.pending || 0, icon: Users },
            { label: 'Rewards issued / redeemed', value: `${stats.rewardsIssued} / ${stats.rewardsRedeemed}`, icon: Ticket },
            { label: 'Live referral codes', value: stats.activeCodes, icon: Clock }
          ].map((s) => (
            <div key={s.label} className="card p-4"><s.icon className="w-4 h-4 text-cyan-400" /><div className="text-2xl font-black text-white mt-1">{s.value}</div><div className="text-xs text-slate-400">{s.label}</div></div>
          ))}
        </div>
      )}

      {!programs ? <LoadingBlock /> : programs.length === 0 ? (
        <EmptyState title="No reward programmes yet" text="Add a reward to start rewarding customers for referrals." action={<button type="button" onClick={openCreate} className="btn btn-primary btn-sm"><Plus className="w-4 h-4" />Add reward</button>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Reward</th><th>Type</th><th>Conditions</th><th>Window</th><th>Issued</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {programs.map((p) => (
                  <tr key={p.id}>
                    <td className="min-w-[180px]"><div className="font-semibold text-white">{p.name}</div>{p.description && <div className="text-xs text-slate-400">{p.description}</div>}</td>
                    <td className="whitespace-nowrap">{MODELS.find((m) => m.value === p.rewardModel)?.label}</td>
                    <td className="text-xs min-w-[220px]">{conditions(p)}</td>
                    <td className="text-xs whitespace-nowrap">{p.startsAt || p.endsAt ? <>{fmtDateTime(p.startsAt)}<br />to {fmtDateTime(p.endsAt)}</> : 'Always'}</td>
                    <td>{p.rewardsIssued}</td>
                    <td><StatusBadge state={programState(p)} /></td>
                    <td className="text-right whitespace-nowrap">
                      <button type="button" className="icon-button" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}><Pencil className="w-4 h-4" /></button>
                      <button type="button" className="icon-button" onClick={() => toggle(p)} aria-label={p.isActive ? `Deactivate ${p.name}` : `Activate ${p.name}`} title={p.isActive ? 'Deactivate' : 'Activate'}><Power className={`w-4 h-4 ${p.isActive ? 'text-emerald-400' : ''}`} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && (
        <Modal
          title={editing ? `Edit reward: ${editing.name}` : 'Add reward'}
          description="Rewards are issued automatically as referrals qualify. Changing a reward does not affect codes already issued."
          onClose={() => setOpen(false)}
          footer={<><button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">Cancel</button><button type="submit" form="reward-form" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : editing ? 'Save reward' : 'Create reward'}</button></>}
        >
          <form id="reward-form" onSubmit={save} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Field label="Reward name" htmlFor="r-name" required><input id="r-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field-input" placeholder="e.g. Refer 3 friends, get 5% off" required /></Field>
              <Field label="Description" htmlFor="r-desc" hint="Shown to customers on their Referrals page."><textarea id="r-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="field-input" /></Field>
              <fieldset className="space-y-2">
                <legend className="field-label">Reward type <span className="text-rose-400">*</span></legend>
                {MODELS.map((m) => (
                  <label key={m.value} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${form.rewardModel === m.value ? 'border-cyan-500 bg-cyan-950/30' : 'border-slate-800 bg-slate-950/40'}`}>
                    <input type="radio" name="model" checked={form.rewardModel === m.value} onChange={() => setForm({ ...form, rewardModel: m.value })} className="mt-1 accent-[var(--t-accent-600)]" />
                    <span><span className="block text-sm font-semibold text-white">{m.label}</span><span className="block text-xs text-slate-400">{m.help}</span></span>
                  </label>
                ))}
              </fieldset>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Reward value type" htmlFor="r-vt">
                  <select id="r-vt" value={form.valueType} onChange={(e) => setForm({ ...form, valueType: e.target.value as any })} className="field-input"><option value="percentage">Percentage off</option><option value="fixed">Fixed amount (KES)</option></select>
                </Field>
                {form.rewardModel !== 'tiered' && (
                  <Field label={`Reward (${unit})`} htmlFor="r-val" required><input id="r-val" type="number" min="0.01" step="0.01" max={form.valueType === 'percentage' ? 100 : undefined} value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="field-input" required /></Field>
                )}
                {(form.rewardModel === 'one_time' || form.rewardModel === 'recurring') && (
                  <Field label={form.rewardModel === 'one_time' ? 'Referrals needed' : 'Every N referrals'} htmlFor="r-th" required className="col-span-2 sm:col-span-1">
                    <input id="r-th" type="number" min="1" value={form.thresholdCount} onChange={(e) => setForm({ ...form, thresholdCount: Number(e.target.value) })} className="field-input" required />
                  </Field>
                )}
              </div>

              {form.rewardModel === 'tiered' && (
                <div className="space-y-2">
                  <span className="field-label">Tiers</span>
                  {form.tiers.map((t, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <input type="number" min="1" value={t.referrals} onChange={(e) => setTier(i, 'referrals', Number(e.target.value))} className="field-input" aria-label={`Tier ${i + 1} referrals`} placeholder="Referrals" />
                      <input type="number" min="0.01" step="0.01" value={t.value} onChange={(e) => setTier(i, 'value', Number(e.target.value))} className="field-input" aria-label={`Tier ${i + 1} reward ${unit}`} placeholder={unit} />
                      <button type="button" onClick={() => setForm({ ...form, tiers: form.tiers.filter((_, j) => j !== i) })} className="icon-button" aria-label={`Remove tier ${i + 1}`} disabled={form.tiers.length <= 1}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <p className="field-hint">Left: referrals reached · Right: reward ({unit}). One reward is issued per tier reached.</p>
                  <button type="button" onClick={() => setForm({ ...form, tiers: [...form.tiers, { referrals: (form.tiers.at(-1)?.referrals || 0) + 5, value: (form.tiers.at(-1)?.value || 5) + 5 }] })} className="btn btn-secondary btn-sm"><Plus className="w-4 h-4" />Add tier</button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Min order (KES)" htmlFor="r-min"><input id="r-min" type="number" min="0" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: Number(e.target.value) })} className="field-input" /></Field>
                <Field label="Max discount (KES)" htmlFor="r-cap" hint="Caps % rewards."><input id="r-cap" type="number" min="1" value={form.maxDiscountAmount} onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value === '' ? '' : Number(e.target.value) })} className="field-input" placeholder="No cap" /></Field>
                <Field label="Code valid for (days)" htmlFor="r-days"><input id="r-days" type="number" min="1" max="365" value={form.couponValidDays} onChange={(e) => setForm({ ...form, couponValidDays: Number(e.target.value) })} className="field-input" /></Field>
                <Field label="Max rewards per customer" htmlFor="r-maxu"><input id="r-maxu" type="number" min="1" value={form.maxRewardsPerUser} onChange={(e) => setForm({ ...form, maxRewardsPerUser: e.target.value === '' ? '' : Number(e.target.value) })} className="field-input" placeholder="Unlimited" /></Field>
                <Field label="Starts" htmlFor="r-start" hint="Only referrals qualifying after this count."><input id="r-start" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="field-input" /></Field>
                <Field label="Ends" htmlFor="r-end"><input id="r-end" type="datetime-local" value={form.endsAt} min={form.startsAt || undefined} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="field-input" /></Field>
              </div>
              <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="Active" description="Inactive programmes issue nothing." />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
