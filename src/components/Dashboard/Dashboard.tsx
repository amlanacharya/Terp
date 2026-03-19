import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { DashboardStats } from '../../lib/types';

const statCards: Array<{ key: 'trips' | 'drivers' | 'vehicles' | 'customers' | 'invoices'; label: string; accent: string }> = [
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
        <p className="mt-2 text-slate-600">Operational counts and receivable visibility are loaded from the local Express API.</p>
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

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Invoiced</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(stats?.invoicedAmount)}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Collected</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(stats?.collectedAmount)}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Outstanding</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(stats?.outstandingAmount)}</p>
        </article>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Recent Outstanding Invoices</h3>
        </div>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {stats?.recentOutstandingInvoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{invoice.invoice_number}</td>
                <td className="px-4 py-3">{invoice.customer.name}</td>
                <td className="px-4 py-3">{formatDate(invoice.invoice_date)}</td>
                <td className="px-4 py-3">{formatDate(invoice.due_date)}</td>
                <td className="px-4 py-3">{invoice.payment_status}</td>
                <td className="px-4 py-3">{formatCurrency(invoice.total_amount)}</td>
              </tr>
            ))}
            {stats && stats.recentOutstandingInvoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No outstanding invoices.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
