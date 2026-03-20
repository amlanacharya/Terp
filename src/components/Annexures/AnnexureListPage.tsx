import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { Annexure, Customer } from '../../lib/types';

interface AnnexureListPageProps {
  onOpenTrip: (tripId: string) => void;
}

type BillingFilter = 'all' | 'billed' | 'unbilled';

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function AnnexureListPage({ onOpenTrip }: AnnexureListPageProps) {
  const monthRange = useMemo(() => getCurrentMonthRange(), []);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [annexures, setAnnexures] = useState<Annexure[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [dateFrom, setDateFrom] = useState(monthRange.start);
  const [dateTo, setDateTo] = useState(monthRange.end);
  const [billingFilter, setBillingFilter] = useState<BillingFilter>('unbilled');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadPage() {
    const params = new URLSearchParams();
    if (customerId) params.set('customer_id', customerId);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (billingFilter !== 'all') params.set('is_billed', billingFilter === 'billed' ? 'true' : 'false');

    const [customerRows, annexureRows] = await Promise.all([
      api.get<Customer[]>('/customers'),
      api.get<Annexure[]>(`/annexures${params.toString() ? `?${params.toString()}` : ''}`),
    ]);

    setCustomers(customerRows.filter((customer) => customer.is_active !== false));
    setAnnexures(annexureRows);
    setSelectedIds((current) => current.filter((id) => annexureRows.some((annexure) => annexure.id === id && !annexure.is_billed)));
  }

  useEffect(() => {
    async function hydrate() {
      try {
        setError('');
        await loadPage();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load annexures.');
      } finally {
        setLoading(false);
      }
    }

    void hydrate();
  }, [customerId, dateFrom, dateTo, billingFilter]);

  const selectedAnnexures = annexures.filter((annexure) => selectedIds.includes(annexure.id));
  const selectedCustomerIds = Array.from(new Set(selectedAnnexures.map((annexure) => annexure.customer.id)));
  const canBulkBill = selectedAnnexures.length > 0 && selectedCustomerIds.length === 1 && selectedAnnexures.every((annexure) => !annexure.is_billed);

  function toggleAnnexure(annexureId: string) {
    setSelectedIds((current) => current.includes(annexureId) ? current.filter((id) => id !== annexureId) : [...current, annexureId]);
  }

  async function handleBillSingle(annexure: Annexure) {
    setBilling(true);
    setError('');
    setNotice('');
    try {
      const invoice = await api.put<{ invoice_number: string }>(`/annexures/${annexure.id}/bill`, {});
      await loadPage();
      setNotice(`Invoice ${invoice.invoice_number} created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to bill annexure.');
    } finally {
      setBilling(false);
    }
  }

  async function handleBulkBill() {
    if (!canBulkBill) {
      return;
    }

    setBilling(true);
    setError('');
    setNotice('');
    try {
      const invoice = await api.post<{ invoice_number: string }>('/annexures/bulk-bill', { annexure_ids: selectedIds });
      setSelectedIds([]);
      await loadPage();
      setNotice(`Invoice ${invoice.invoice_number} created for selected annexures.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to bill selected annexures.');
    } finally {
      setBilling(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Annexures</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Annexure billing page</h2>
        </div>
        <button type="button" disabled={!canBulkBill || billing} onClick={() => void handleBulkBill()} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">{billing ? 'Billing...' : `Bill Selected (${selectedIds.length})`}</button>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 md:grid-cols-4">
        <label className="text-sm font-semibold text-slate-800">Customer<select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"><option value="">All customers</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-800">Date From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
        <label className="text-sm font-semibold text-slate-800">Date To<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
        <div className="text-sm font-semibold text-slate-800">Billing Status<div className="mt-2 flex rounded-2xl border border-slate-300 p-1">{(['unbilled', 'billed', 'all'] as BillingFilter[]).map((filter) => <button key={filter} type="button" onClick={() => setBillingFilter(filter)} className={`flex-1 rounded-xl px-3 py-2 text-sm ${billingFilter === filter ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{filter === 'all' ? 'All' : filter === 'billed' ? 'Billed' : 'Unbilled'}</button>)}</div></div>
      </div>

      {selectedIds.length > 1 && !canBulkBill ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Bulk billing requires all selected annexures to belong to the same customer.</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{notice}</div> : null}
      {loading ? <p className="text-sm text-slate-500">Loading annexures...</p> : null}

      {!loading ? (
        <div className="overflow-x-auto rounded-3xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Pick</th>
                <th className="px-4 py-3">Annexure</th>
                <th className="px-4 py-3">Parent Trip</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date Range</th>
                <th className="px-4 py-3">KM / Hours</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {annexures.map((annexure) => (
                <tr key={annexure.id}>
                  <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(annexure.id)} disabled={annexure.is_billed} onChange={() => toggleAnnexure(annexure.id)} /></td>
                  <td className="px-4 py-3 font-medium text-slate-900">{annexure.annexure_number}</td>
                  <td className="px-4 py-3"><button type="button" onClick={() => onOpenTrip(annexure.parent_trip.id)} className="text-left font-medium text-sky-700 underline-offset-4 hover:underline">{annexure.parent_trip.trip_number}</button></td>
                  <td className="px-4 py-3">{annexure.customer.name}</td>
                  <td className="px-4 py-3">{formatDate(annexure.start_date)} to {formatDate(annexure.end_date)}</td>
                  <td className="px-4 py-3">{annexure.total_km.toFixed(2)} km<div className="text-xs text-slate-500">{annexure.total_hours.toFixed(2)} hrs</div></td>
                  <td className="px-4 py-3">{formatCurrency(annexure.calculated_amount)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-medium ${annexure.is_billed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{annexure.is_billed ? 'Billed' : 'Unbilled'}</span></td>
                  <td className="px-4 py-3">{annexure.invoice_number ?? '-'}</td>
                  <td className="px-4 py-3">{!annexure.is_billed ? <button type="button" disabled={billing} onClick={() => void handleBillSingle(annexure)} className="rounded-xl border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-700 disabled:opacity-60">Bill</button> : null}</td>
                </tr>
              ))}
              {annexures.length === 0 ? <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-500">No annexures matched the selected filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
