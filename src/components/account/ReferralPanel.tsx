import React, { useEffect, useState } from 'react';
import { Gift, Copy, RefreshCw, Loader2, Clock, Users, CheckCircle2, Share2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface Summary {
  activeCode: { code: string; expiresAt: string } | null;
  codeTtlHours: number;
  totalReferrals: number;
  qualifiedReferrals: number;
  pendingReferrals: number;
  history: { name: string; status: 'pending' | 'qualified' | 'rejected'; joinedAt: string; qualifiedAt: string | null }[];
  rewards: { couponCode: string; programName: string; referralCount: number; discountType: string; discountValue: number | null; validUntil: string | null; status: 'available' | 'redeemed' | 'expired' }[];
  legacyRewardCodes: string[];
  programs: { id: string; name: string; description?: string | null; rewardModel: string; valueType: string; value: number; thresholdCount: number; tiers: { referrals: number; value: number }[]; endsAt: string | null; nextMilestone: { referrals: number; value: number } | null }[];
}

const fmtValue = (type: string, v: number) => (type === 'percentage' ? `${v}% off` : `KES ${Number(v).toLocaleString('en-KE')} off`);

function describeProgram(p: Summary['programs'][number]) {
  switch (p.rewardModel) {
    case 'one_time': return `${fmtValue(p.valueType, p.value)} once you reach ${p.thresholdCount} qualified referral${p.thresholdCount > 1 ? 's' : ''}.`;
    case 'per_referral': return `${fmtValue(p.valueType, p.value)} for every qualified referral.`;
    case 'recurring': return `${fmtValue(p.valueType, p.value)} for every ${p.thresholdCount} qualified referrals — keeps going.`;
    case 'tiered': return `Rewards grow as you refer more: ${p.tiers.map((t) => `${t.referrals} → ${fmtValue(p.valueType, t.value)}`).join(', ')}.`;
    default: return '';
  }
}

function useCountdown(target?: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!target) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [target]);
  if (!target) return null;
  const ms = Math.max(0, new Date(target).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return { ms, text: `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s` };
}

export const ReferralPanel: React.FC = () => {
  const { showToast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = () => fetch('/api/auth/referrals', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.success) setSummary(d); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const countdown = useCountdown(summary?.activeCode?.expiresAt);
  const expired = countdown ? countdown.ms <= 0 : true;
  const code = summary?.activeCode && !expired ? summary.activeCode.code : null;
  const link = code ? `${window.location.origin}/auth?ref=${code}` : '';

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/auth/referrals/code', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not generate a code');
      showToast('New referral code ready — valid for 3 hours.', 'success');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not generate a code', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); showToast(`${what} copied`, 'success'); } catch { showToast('Copy failed — select and copy manually', 'error'); }
  };

  const share = async () => {
    if (navigator.share && link) {
      try { await navigator.share({ title: 'Join me on Internext', text: `Sign up with my code ${code}`, url: link }); } catch { /* dismissed */ }
    } else if (link) copy(link, 'Link');
  };

  if (loading) return <div className="card card-pad text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading referrals…</div>;
  if (!summary) return <div className="card card-pad text-sm text-slate-400">Referral information is unavailable right now.</div>;

  return (
    <div className="space-y-6">
      <section className="card card-pad space-y-5 aurora-bg">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-cyan-950 border border-cyan-800 grid place-items-center text-cyan-400 shrink-0"><Gift className="w-5 h-5" aria-hidden="true" /></div>
          <div>
            <h2 className="text-lg font-bold text-white">Refer friends, earn rewards</h2>
            <p className="text-sm text-slate-400">Generate a code and share it. Each code works for {summary.codeTtlHours} hours; a friend counts once they verify their email.</p>
          </div>
        </div>

        {code ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <code className="text-2xl font-black tracking-[0.15em] text-cyan-300 font-mono break-all">{code}</code>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => copy(code, 'Code')} className="btn btn-secondary btn-sm"><Copy className="w-4 h-4" aria-hidden="true" />Copy code</button>
                <button type="button" onClick={share} className="btn btn-secondary btn-sm"><Share2 className="w-4 h-4" aria-hidden="true" />Share link</button>
              </div>
            </div>
            <p className="text-xs text-amber-300 flex items-center gap-1.5" aria-live="polite"><Clock className="w-3.5 h-3.5" aria-hidden="true" />Expires in {countdown?.text}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">{summary.activeCode ? 'Your last code has expired.' : "You don't have an active referral code."}</p>
        )}

        <button type="button" onClick={generate} disabled={generating} className="btn btn-primary">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
          {code ? 'Generate a new code' : 'Generate referral code'}
        </button>
        {code && <p className="text-xs text-slate-500">Generating a new code immediately cancels the current one.</p>}
      </section>

      <section className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
        {[
          { label: 'Joined', value: summary.totalReferrals, icon: Users },
          { label: 'Qualified', value: summary.qualifiedReferrals, icon: CheckCircle2 },
          { label: 'Rewards', value: summary.rewards.length, icon: Gift }
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <s.icon className="w-4 h-4 mx-auto text-cyan-400" aria-hidden="true" />
            <div className="text-2xl font-black text-white mt-1">{s.value}</div>
            <div className="text-xs text-slate-400">{s.label}</div>
          </div>
        ))}
      </section>

      {summary.programs.length > 0 && (
        <section className="card card-pad space-y-3">
          <h3 className="font-bold text-white">Current reward programmes</h3>
          <ul className="space-y-3">
            {summary.programs.map((p) => (
              <li key={p.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="font-semibold text-white">{p.name}</div>
                {p.description && <p className="text-sm text-slate-400 mt-0.5">{p.description}</p>}
                <p className="text-sm text-slate-300 mt-1">{describeProgram(p)}</p>
                {p.nextMilestone && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Next reward at {p.nextMilestone.referrals} referrals</span>
                      <span>{summary.qualifiedReferrals}/{p.nextMilestone.referrals}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={p.nextMilestone.referrals} aria-valuenow={summary.qualifiedReferrals}>
                      <div className="h-full bg-cyan-600 rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, (summary.qualifiedReferrals / p.nextMilestone.referrals) * 100)}%` }} />
                    </div>
                  </div>
                )}
                {p.endsAt && <p className="text-xs text-slate-500 mt-2">Ends {new Date(p.endsAt).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card card-pad space-y-3">
        <h3 className="font-bold text-white">Your rewards</h3>
        {summary.rewards.length === 0 && summary.legacyRewardCodes.length === 0 ? (
          <p className="text-sm text-slate-400">No rewards yet. They appear here automatically as your referrals qualify.</p>
        ) : (
          <ul className="space-y-2">
            {summary.rewards.map((r) => (
              <li key={r.couponCode} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <div className="min-w-0">
                  <code className={`font-mono font-bold ${r.status === 'available' ? 'text-emerald-300' : 'text-slate-500 line-through'}`}>{r.couponCode}</code>
                  <div className="text-xs text-slate-400">{r.programName} · {r.discountValue != null ? fmtValue(r.discountType, r.discountValue) : ''}{r.validUntil ? ` · use by ${new Date(r.validUntil).toLocaleDateString('en-KE')}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${r.status === 'available' ? 'badge-success' : r.status === 'redeemed' ? 'badge-neutral' : 'badge-warning'}`}>{r.status}</span>
                  {r.status === 'available' && <button type="button" onClick={() => copy(r.couponCode, 'Promo code')} className="icon-button" aria-label={`Copy ${r.couponCode}`}><Copy className="w-4 h-4" /></button>}
                </div>
              </li>
            ))}
            {summary.legacyRewardCodes.map((c) => (
              <li key={c} className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm"><code className="font-mono text-slate-300">{c}</code> <span className="text-xs text-slate-500">(earlier reward)</span></li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">Reward codes are linked to your account and can only be used when you're signed in.</p>
      </section>

      <section className="card card-pad space-y-3">
        <h3 className="font-bold text-white">Referral history</h3>
        {summary.history.length === 0 ? (
          <p className="text-sm text-slate-400">Nobody has joined with your code yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Friend</th><th>Joined</th><th>Status</th></tr></thead>
              <tbody>
                {summary.history.map((h, i) => (
                  <tr key={i}>
                    <td className="font-semibold">{h.name}</td>
                    <td>{new Date(h.joinedAt).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</td>
                    <td>
                      <span className={`badge ${h.status === 'qualified' ? 'badge-success' : h.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                        {h.status === 'pending' ? 'Awaiting email verification' : h.status === 'qualified' ? 'Qualified' : 'Not eligible'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
