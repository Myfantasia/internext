import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useServerClock } from '../../utils/serverClock';

// Countdown to a deal's end. Uses the server's clock offset (see
// utils/serverClock) so a visitor's wrong device time can't show a wrong
// countdown. Shows days when more than 24h remain.
export const DealCountdown: React.FC<{ endsAt: string; compact?: boolean; onExpire?: () => void }> = ({ endsAt, compact = false, onExpire }) => {
  const now = useServerClock();
  const ms = Math.max(0, new Date(endsAt).getTime() - now);
  const [expired, setExpired] = useState(ms <= 0);

  useEffect(() => {
    if (ms <= 0 && !expired) {
      setExpired(true);
      onExpire?.();
    }
  }, [ms, expired, onExpire]);

  if (ms <= 0) return <span className="badge badge-neutral">Deal ended</span>;

  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  const units = [
    ...(days > 0 ? [{ v: days, l: 'Days' }] : []),
    { v: hours, l: 'Hrs' },
    { v: mins, l: 'Min' },
    ...(days > 0 ? [] : [{ v: secs, l: 'Sec' }])
  ];

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 font-mono" aria-label={`Ends in ${days ? `${days} days ` : ''}${hours} hours ${mins} minutes`}>
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        {days > 0 ? `${days}d ` : ''}{String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}{days > 0 ? '' : `:${String(secs).padStart(2, '0')}`}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5" role="timer" aria-label={`Ends in ${days ? `${days} days ` : ''}${hours} hours ${mins} minutes`}>
      {units.map((u, i) => (
        <React.Fragment key={u.l}>
          {i > 0 && <span className="text-amber-400 font-bold" aria-hidden="true">:</span>}
          <div className="rounded-xl border border-amber-500/30 bg-slate-950 px-2.5 py-1.5 min-w-[46px] text-center" aria-hidden="true">
            <div key={u.v} className="countdown-digit text-lg font-black text-amber-400 font-mono leading-tight">{String(u.v).padStart(2, '0')}</div>
            <div className="text-[9px] text-slate-400 uppercase">{u.l}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};
