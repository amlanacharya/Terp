import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { DashboardStats } from '../../lib/types';

const statCards: Array<{ key: keyof DashboardStats; label: string; accent: string }> = [
  { key: 'trips', label: 'Trips', accent: 'bg-sky-100 text-sky-700' },
  { key: 'drivers', label: 'Drivers', accent: 'bg-emerald-100 text-emerald-700' },
  { key: 'vehicles', label: 'Vehicles', accent: 'bg-amber-100 text-amber-700' },
  { key: 'customers', label: 'Customers', accent: 'bg-violet-100 text-violet-700' },
  { key: 'invoices', label: 'Invoices', accent: 'bg-rose-100 text-rose-700' },
];

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        setStats(await api.get<DashboardStats>('/dashboard/stats'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load dashboard stats.');
      } finally {
        setLoading(false);
      }
    }

    void loadStats();
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading dashboard...</p>;
  }

  if (error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>;
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Overview</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Operations snapshot</h2>
        <p className="mt-2 text-slate-600">Counts are loaded from the local Express API.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <article key={card.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${card.accent}`}>
              {card.label}
            </span>
            <p className="mt-6 text-4xl font-semibold text-slate-900">{stats?.[card.key] ?? 0}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
