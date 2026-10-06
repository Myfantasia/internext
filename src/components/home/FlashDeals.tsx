import React, { useEffect, useState } from 'react';
import { Flame, ArrowRight } from 'lucide-react';
import { ProductCard } from '../common/ProductCard';
import { DealCountdown } from '../common/DealCountdown';
import { syncServerClock } from '../../utils/serverClock';
import { Product } from '../../types';

interface LiveDeal {
  id: string;
  title: string;
  endsAt: string;
  remaining: number | null;
  product: Product;
}

// Shows the deals an admin scheduled under Admin → Flash Deals. Hidden when
// none are live. Each card carries its own server-synchronised countdown.
export const FlashDeals: React.FC = () => {
  const [deals, setDeals] = useState<LiveDeal[]>([]);

  const load = () => fetch('/api/flash-deals?limit=8', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d?.success) return;
      syncServerClock(d.serverTime);
      setDeals(d.deals || []);
    })
    .catch(() => {});

  useEffect(() => { load(); }, []);

  if (!deals.length) return null;
  const soonest = deals.reduce((a, b) => (new Date(a.endsAt) < new Date(b.endsAt) ? a : b));

  return (
    <section className="py-12 sm:py-16 border-y border-slate-800/80 px-4 lg:px-5 aurora-bg" aria-labelledby="flash-deals-title">
      <div className="max-w-[1520px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="space-y-1">
            <div className="eyebrow !text-amber-400 flex items-center gap-1.5"><Flame className="w-4 h-4" aria-hidden="true" />Limited-time prices</div>
            <h2 id="flash-deals-title" className="section-title">Flash deals</h2>
            <p className="text-sm text-slate-400">Prices apply automatically at checkout while the deal is live and stock lasts.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase">Next deal ends in</span>
            <DealCountdown endsAt={soonest.endsAt} onExpire={load} />
          </div>
        </div>

        <div className="snap-row">
          {deals.map((deal) => (
            <div key={deal.id} className="space-y-2 min-w-0 reveal-on-scroll">
              <ProductCard product={deal.product} />
              <div className="flex items-center justify-between gap-2 px-1 text-xs">
                <DealCountdown endsAt={deal.endsAt} compact onExpire={load} />
                {deal.remaining != null && <span className="text-amber-300 font-semibold">{deal.remaining} left</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-right">
          <a href="/shop?flashDeal=true" className="inline-flex items-center gap-1.5 text-sm font-bold text-cyan-400 hover:underline">All deals <ArrowRight className="w-4 h-4" aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
};
