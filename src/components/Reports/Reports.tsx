import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { ReportSummary } from '../../lib/types';

export function Reports() {
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadReport() {
      try {
        setReport(await api.get<ReportSummary>('/reports'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load reports.');
      } finally {
        setLoading(false);
      }
    }

    void loadReport();
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading reports...</p>;
  }

  if (error && !report) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>;
  }

  if (!report) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
        No report data available.
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Reports</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Financial and operational summary</h2>
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Invoice value</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(report.invoiceValue)}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Collected value</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(report.collectedValue)}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Outstanding</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(report.outstandingValue)}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Driver settlements</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(report.driverSettlementValue)}</p>
        </article>
      </div>
      <div className="rounded-3xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Trips by status</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {report.tripsByStatus.map((row) => (
            <div key={row.status} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{row.status}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{row.count}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
