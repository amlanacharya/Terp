import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { Driver, DriverSettlement } from '../../lib/types';

interface DriverSettlementFormState {
  settlement_number: string;
  driver_id: string;
  period_from: string;
  period_to: string;
  total_trips: string;
  total_km: string;
  total_allowance: string;
  net_amount: string;
  payment_mode: string;
  status: string;
}

const initialForm: DriverSettlementFormState = {
  settlement_number: '',
  driver_id: '',
  period_from: '',
  period_to: '',
  total_trips: '0',
  total_km: '0',
  total_allowance: '0',
  net_amount: '0',
  payment_mode: 'bank_transfer',
  status: 'pending',
};

export function DriverSettlements() {
  const { profile } = useAuth();
  const [settlements, setSettlements] = useState<DriverSettlement[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [formState, setFormState] = useState<DriverSettlementFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager', 'accountant'].includes(profile.role) : false;

  async function loadPage() {
    const [settlementRows, driverRows] = await Promise.all([
      api.get<DriverSettlement[]>('/settlements/drivers'),
      api.get<Driver[]>('/drivers'),
    ]);
    setSettlements(settlementRows);
    setDrivers(driverRows);
  }

  useEffect(() => {
    async function hydrate() {
      try {
        await loadPage();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load driver settlements.');
      } finally {
        setLoading(false);
      }
    }

    void hydrate();
  }, []);

  function startEdit(settlement: DriverSettlement) {
    setEditingId(settlement.id);
    setFormState({
      settlement_number: settlement.settlement_number,
      driver_id: settlement.driver.id,
      period_from: settlement.period_from?.slice(0, 10) ?? '',
      period_to: settlement.period_to?.slice(0, 10) ?? '',
      total_trips: String(settlement.total_trips),
      total_km: String(settlement.total_km),
      total_allowance: String(settlement.total_allowance),
      net_amount: String(settlement.net_amount),
      payment_mode: settlement.payment_mode ?? 'bank_transfer',
      status: settlement.status,
    });
  }

  function resetForm() {
    setEditingId(null);
    setFormState(initialForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        ...formState,
        total_trips: Number(formState.total_trips),
        total_km: Number(formState.total_km),
        total_allowance: Number(formState.total_allowance),
        net_amount: Number(formState.net_amount),
      };

      if (editingId) {
        await api.put(`/settlements/drivers/${editingId}`, payload);
      } else {
        await api.post('/settlements/drivers', payload);
      }

      resetForm();
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save driver settlement.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading driver settlements...</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Driver Settlements</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Driver payout summary</h2>
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {canManage ? (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-4">
          <input value={formState.settlement_number} onChange={(event) => setFormState((current) => ({ ...current, settlement_number: event.target.value }))} placeholder="Settlement number" className="rounded-2xl border border-slate-300 px-4 py-3" required />
          <select value={formState.driver_id} onChange={(event) => setFormState((current) => ({ ...current, driver_id: event.target.value }))} className="rounded-2xl border border-slate-300 px-4 py-3" required>
            <option value="">Select driver</option>
            {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
          </select>
          <input type="date" value={formState.period_from} onChange={(event) => setFormState((current) => ({ ...current, period_from: event.target.value }))} className="rounded-2xl border border-slate-300 px-4 py-3" required />
          <input type="date" value={formState.period_to} onChange={(event) => setFormState((current) => ({ ...current, period_to: event.target.value }))} className="rounded-2xl border border-slate-300 px-4 py-3" required />
          <input value={formState.total_trips} onChange={(event) => setFormState((current) => ({ ...current, total_trips: event.target.value }))} placeholder="Trips" type="number" min="0" className="rounded-2xl border border-slate-300 px-4 py-3" />
          <input value={formState.total_km} onChange={(event) => setFormState((current) => ({ ...current, total_km: event.target.value }))} placeholder="Total km" type="number" min="0" className="rounded-2xl border border-slate-300 px-4 py-3" />
          <input value={formState.total_allowance} onChange={(event) => setFormState((current) => ({ ...current, total_allowance: event.target.value }))} placeholder="Allowance" type="number" min="0" className="rounded-2xl border border-slate-300 px-4 py-3" />
          <input value={formState.net_amount} onChange={(event) => setFormState((current) => ({ ...current, net_amount: event.target.value }))} placeholder="Net amount" type="number" min="0" className="rounded-2xl border border-slate-300 px-4 py-3" required />
          <select value={formState.payment_mode} onChange={(event) => setFormState((current) => ({ ...current, payment_mode: event.target.value }))} className="rounded-2xl border border-slate-300 px-4 py-3">
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
          </select>
          <div className="flex gap-3">
            <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))} className="flex-1 rounded-2xl border border-slate-300 px-4 py-3">
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
            </select>
            <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update' : 'Add'}</button>
            {editingId ? <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700">Cancel</button> : null}
          </div>
        </form>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {settlements.map((settlement) => (
          <article key={settlement.id} className="rounded-3xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{settlement.settlement_number}</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{settlement.driver.name}</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {settlement.status}
              </span>
            </div>
            {canManage ? <div className="mt-3"><button type="button" onClick={() => startEdit(settlement)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Edit settlement</button></div> : null}
            <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-slate-500">Period</dt>
                <dd>
                  {formatDate(settlement.period_from)} to {formatDate(settlement.period_to)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Trips</dt>
                <dd>{settlement.total_trips}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Allowance</dt>
                <dd>{formatCurrency(settlement.total_allowance)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Net amount</dt>
                <dd>{formatCurrency(settlement.net_amount)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
