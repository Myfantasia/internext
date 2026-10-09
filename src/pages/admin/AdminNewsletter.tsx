import React, { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';

interface Subscriber {
  id: string;
  email: string;
  subscribedAt?: string;
}

export const AdminNewsletter: React.FC = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/subscribers')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.subscribers) setSubscribers(data.subscribers);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-bold text-white">Newsletter subscribers</h2>
        <p className="text-xs text-slate-400">Emails collected from the storefront footer and campaign forms</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
            <tr>
              <th className="p-3.5">Email</th>
              <th className="p-3.5">Subscribed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {!loading && subscribers.length === 0 && (
              <tr>
                <td colSpan={2} className="p-8 text-center text-slate-500">
                  <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No subscribers yet
                </td>
              </tr>
            )}
            {subscribers.map((s) => (
              <tr key={s.id} className="hover:bg-slate-800/40">
                <td className="p-3.5 font-bold text-white">{s.email}</td>
                <td className="p-3.5 text-slate-400 font-mono">
                  {s.subscribedAt ? new Date(s.subscribedAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
