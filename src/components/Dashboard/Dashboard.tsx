import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { DashboardStats, PageKey, SystemSetting } from '../../lib/types';

const statusFormatter = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const statCards: Array<{
  key: 'trips' | 'drivers' | 'vehicles' | 'customers' | 'invoices';
  label: string;
  accent: string;
  tone: string;
}> = [
  {
    key: 'trips',
    label: 'Duty Slips',
    accent: 'text-cyan-200',
    tone: 'from-cyan-500/20 via-cyan-500/10 to-transparent',
  },
  {
    key: 'drivers',
    label: 'Drivers',
    accent: 'text-emerald-200',
    tone: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
  },
  {
    key: 'vehicles',
    label: 'Vehicles',
    accent: 'text-amber-200',
    tone: 'from-amber-500/20 via-amber-500/10 to-transparent',
  },
  {
    key: 'customers',
    label: 'Customers',
    accent: 'text-fuchsia-200',
    tone: 'from-fuchsia-500/20 via-fuchsia-500/10 to-transparent',
  },
  {
    key: 'invoices',
    label: 'Invoices',
    accent: 'text-rose-200',
    tone: 'from-rose-500/20 via-rose-500/10 to-transparent',
  },
];

interface DashboardProps {
  onNavigate: (page: PageKey) => void;
}

function getStatusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes('overdue')) {
    return 'bg-rose-500/15 text-rose-200 ring-1 ring-inset ring-rose-400/30';
  }

  if (normalized.includes('partial')) {
    return 'bg-amber-500/15 text-amber-100 ring-1 ring-inset ring-amber-400/30';
  }

  if (normalized.includes('paid')) {
    return 'bg-emerald-500/15 text-emerald-100 ring-1 ring-inset ring-emerald-400/30';
  }

  return 'bg-slate-500/15 text-slate-200 ring-1 ring-inset ring-white/10';
}

function getCompanyName(settings: SystemSetting[]): string {
  return settings.find((setting) => setting.setting_key === 'company_name')?.setting_value || 'Travel ERP';
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [companyName, setCompanyName] = useState('Travel ERP');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const [statsResponse, settingsResponse] = await Promise.all([
          api.get<DashboardStats>('/dashboard/stats'),
          api.get<SystemSetting[]>('/settings'),
        ]);
        setStats(statsResponse);
        setCompanyName(getCompanyName(settingsResponse));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load dashboard stats.');
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  if (loading) {
    return (
      <section className="rounded-[32px] border border-slate-200 bg-white/80 p-8 shadow-sm backdrop-blur">
        <p className="text-sm font-medium text-slate-500">Loading dashboard...</p>
      </section>
    );
  }

  if (error) {
    return <div className="rounded-[32px] border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">{error}</div>;
  }

  const invoicedAmount = stats?.invoicedAmount ?? 0;
  const collectedAmount = stats?.collectedAmount ?? 0;
  const outstandingAmount = stats?.outstandingAmount ?? 0;
  const totalReceivableBase = Math.max(invoicedAmount, collectedAmount + outstandingAmount, 1);
  const collectionRate = Math.round((collectedAmount / totalReceivableBase) * 100);
  const outstandingRate = Math.round((outstandingAmount / totalReceivableBase) * 100);
  const priorityInvoices = stats?.recentOutstandingInvoices.slice(0, 3) ?? [];
  const overdueInvoices = stats?.recentOutstandingInvoices.filter((invoice) => invoice.payment_status.toLowerCase().includes('overdue')).length ?? 0;
  const liveStatusLine = `${statusFormatter.format(new Date())} | ${stats?.trips ?? 0} duty slips | ${overdueInvoices} overdue invoices`;

  return (
    <section className="relative overflow-hidden rounded-[36px] bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.2),_transparent_26%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,23,42,0.92))]" />
      <div className="absolute -left-20 top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

      <div className="relative space-y-8 p-6 lg:p-8 xl:p-10">
        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.85fr]">
          <article className="rounded-[30px] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/80">Fleet Ops Command Centre</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white lg:text-5xl">SyncView</h2>
                <p className="mt-4 text-sm font-medium text-slate-300 lg:text-base">Welcome {companyName} | {liveStatusLine}</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/60 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Collection Efficiency</p>
                <p className="mt-2 text-4xl font-semibold text-white">{collectionRate}%</p>
                <p className="mt-1 text-xs uppercase tracking-[0.24em] text-emerald-200">Live</p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/80">Revenue Captured</p>
                <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(invoicedAmount)}</p>
              </div>
              <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-100/80">Cash Realized</p>
                <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(collectedAmount)}</p>
              </div>
              <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-amber-100/80">Receivable Risk</p>
                <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(outstandingAmount)}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[30px] border border-white/10 bg-slate-900/70 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Receivables Mix</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Collection health</h3>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-2 text-right">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Outstanding</p>
                <p className="mt-1 text-2xl font-semibold text-amber-100">{outstandingRate}%</p>
              </div>
            </div>

            <div className="mt-6 h-4 overflow-hidden rounded-full bg-white/10">
              <div className="flex h-full">
                <div className="h-full bg-emerald-400" style={{ width: `${collectionRate}%` }} />
                <div className="h-full bg-amber-400" style={{ width: `${Math.max(0, 100 - collectionRate)}%` }} />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-300">Collected</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{formatCurrency(collectedAmount)}</p>
                  </div>
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-100">
                    Healthy cash
                  </span>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-300">Outstanding</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{formatCurrency(outstandingAmount)}</p>
                  </div>
                  <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-100">
                    Follow-up queue
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Quick Actions</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => onNavigate('trips')}
                  className="group relative overflow-hidden rounded-[20px] border border-cyan-300/30 bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 px-4 py-3.5 text-left shadow-[0_10px_24px_rgba(14,165,233,0.26)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(14,165,233,0.36)]"
                >
                  <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/15 blur-2xl" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-cyan-50/85">Primary</p>
                      <p className="mt-1.5 text-sm font-semibold text-white">Duty Slips</p>
                      
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('invoices')}
                  className="group relative overflow-hidden rounded-[20px] border border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-500 via-rose-500 to-orange-500 px-4 py-3.5 text-left shadow-[0_10px_24px_rgba(236,72,153,0.24)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(236,72,153,0.34)]"
                >
                  <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/15 blur-2xl" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-rose-50/85">Priority</p>
                      <p className="mt-1.5 text-sm font-semibold text-white">Invoices</p>
                      
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('collections')}
                  className="group relative overflow-hidden rounded-[20px] border border-emerald-300/30 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 px-4 py-3.5 text-left shadow-[0_10px_24px_rgba(16,185,129,0.24)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(16,185,129,0.34)]"
                >
                  <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/15 blur-2xl" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-emerald-50/85">Cashflow</p>
                      <p className="mt-1.5 text-sm font-semibold text-white">Invoices</p>
                      
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </article>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {statCards.map((card) => (
            <article
              key={card.key}
              className="relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/55 p-5 backdrop-blur-xl"
            >
              <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${card.tone}`} />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{card.label}</p>
                    <p className="mt-4 text-4xl font-semibold text-white">{stats?.[card.key] ?? 0}</p>
                  </div>
                  <span className={`text-xs font-medium uppercase tracking-[0.24em] ${card.accent}`}>Live</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
          <article className="rounded-[30px] border border-white/10 bg-white/6 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Attention Center</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Priority receivables</h3>
              </div>
              <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-rose-100">
                {priorityInvoices.length} invoices flagged
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {priorityInvoices.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-5 text-sm text-slate-300">
                  No outstanding invoices. Collections are fully caught up.
                </div>
              ) : (
                priorityInvoices.map((invoice, index) => (
                  <div key={invoice.id} className="rounded-3xl border border-white/10 bg-slate-900/55 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Priority {index + 1}</p>
                        <h4 className="mt-2 text-lg font-semibold text-white">{invoice.invoice_number}</h4>
                        <p className="mt-1 text-sm text-slate-300">{invoice.customer.name}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] ${getStatusTone(invoice.payment_status)}`}>
                        {invoice.payment_status}
                      </span>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Invoice Date</p>
                        <p className="mt-2 text-sm text-slate-200">{formatDate(invoice.invoice_date)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Due Date</p>
                        <p className="mt-2 text-sm text-slate-200">{formatDate(invoice.due_date)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Amount</p>
                        <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(invoice.total_amount)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="overflow-hidden rounded-[30px] border border-white/10 bg-slate-900/65 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Detailed Queue</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Recent outstanding invoices</h3>
              </div>
              <div className="rounded-2xl bg-white/5 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Open items</p>
                <p className="mt-1 text-2xl font-semibold text-white">{stats?.recentOutstandingInvoices.length ?? 0}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Invoice</th>
                    <th className="px-6 py-4 font-medium">Customer</th>
                    <th className="px-6 py-4 font-medium">Invoice Date</th>
                    <th className="px-6 py-4 font-medium">Due Date</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {stats?.recentOutstandingInvoices.map((invoice) => (
                    <tr key={invoice.id} className="transition hover:bg-white/5">
                      <td className="px-6 py-4 font-medium text-white">{invoice.invoice_number}</td>
                      <td className="px-6 py-4 text-slate-300">{invoice.customer.name}</td>
                      <td className="px-6 py-4 text-slate-300">{formatDate(invoice.invoice_date)}</td>
                      <td className="px-6 py-4 text-slate-300">{formatDate(invoice.due_date)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] ${getStatusTone(invoice.payment_status)}`}>
                          {invoice.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-white">{formatCurrency(invoice.total_amount)}</td>
                    </tr>
                  ))}
                  {stats && stats.recentOutstandingInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                        No outstanding invoices in the current queue.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}



