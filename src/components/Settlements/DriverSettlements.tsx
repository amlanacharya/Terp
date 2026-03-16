import { FormEvent, useEffect, useState } from 'react';
import { api, downloadBlob } from '../../lib/api';
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
  advances: string;
  deductions: string;
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
  advances: '0',
  deductions: '0',
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
  const [showFieldHelp, setShowFieldHelp] = useState(false);
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
      advances: String(settlement.advances ?? 0),
      deductions: String(settlement.deductions ?? 0),
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
        advances: Number(formState.advances),
        deductions: Number(formState.deductions),
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

  async function handleDelete(settlement: DriverSettlement) {
    const confirmed = window.confirm(`Delete settlement ${settlement.settlement_number}?`);
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await api.delete(`/settlements/drivers/${settlement.id}`);
      if (editingId === settlement.id) {
        resetForm();
      }
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete driver settlement.');
    }
  }

  async function handleDownloadPdf(settlement: DriverSettlement) {
    try {
      setError('');
      const blob = await downloadBlob(`/settlements/drivers/${settlement.id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${settlement.settlement_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download driver settlement PDF.');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading driver settlements...</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Salary Slips</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Driver payroll summary</h2>
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {canManage ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Need help with these fields?</p>
              <p className="text-xs text-slate-500">Open the guide to see what each payroll field means.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowFieldHelp((current) => !current)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              {showFieldHelp ? 'Hide Info' : 'i Info'}
            </button>
          </div>
          {showFieldHelp ? (
            <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Salary Slip field guide</p>
              <p className="mt-2"><strong>Total trips:</strong> number of completed trips in this salary period.</p>
              <p><strong>Total KM:</strong> total distance driven in this period.</p>
              <p><strong>Allowance:</strong> total earning before subtracting any advance or recovery.</p>
              <p><strong>Advances:</strong> money already paid to the driver earlier.</p>
              <p><strong>Deductions:</strong> penalties, recovery, damages, or any other amount to subtract now.</p>
              <p><strong>Net payable:</strong> final salary amount to be paid now.</p>
              <p className="mt-2 font-medium text-slate-900">Formula: Net payable = Allowance - Advances - Deductions</p>
            </div>
          ) : null}
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-4">
          <label className="text-sm font-semibold text-slate-800">
            Salary Slip Number
            <input value={formState.settlement_number} onChange={(event) => setFormState((current) => ({ ...current, settlement_number: event.target.value }))} placeholder="e.g. SAL-0007" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Driver
            <select value={formState.driver_id} onChange={(event) => setFormState((current) => ({ ...current, driver_id: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required>
              <option value="">Select driver for this salary slip</option>
              {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Period From
            <input type="date" value={formState.period_from} onChange={(event) => setFormState((current) => ({ ...current, period_from: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Period To
            <input type="date" value={formState.period_to} onChange={(event) => setFormState((current) => ({ ...current, period_to: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Total Trips
            <input value={formState.total_trips} onChange={(event) => setFormState((current) => ({ ...current, total_trips: event.target.value }))} placeholder="e.g. 14" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Total KM
            <input value={formState.total_km} onChange={(event) => setFormState((current) => ({ ...current, total_km: event.target.value }))} placeholder="e.g. 2850" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Allowance
            <input value={formState.total_allowance} onChange={(event) => setFormState((current) => ({ ...current, total_allowance: event.target.value }))} placeholder="Gross earning before cuts" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Advances
            <input value={formState.advances} onChange={(event) => setFormState((current) => ({ ...current, advances: event.target.value }))} placeholder="Amount already paid earlier" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Deductions
            <input value={formState.deductions} onChange={(event) => setFormState((current) => ({ ...current, deductions: event.target.value }))} placeholder="Penalty / recovery / other cut" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Net Payable
            <input value={formState.net_amount} onChange={(event) => setFormState((current) => ({ ...current, net_amount: event.target.value }))} placeholder="Final salary to pay now" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Payment Mode
            <select value={formState.payment_mode} onChange={(event) => setFormState((current) => ({ ...current, payment_mode: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
          </label>
          <div className="flex gap-3">
            <label className="flex-1 text-sm font-semibold text-slate-800">
              Status
              <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </select>
            </label>
            <button type="submit" disabled={saving} className="self-end rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update' : 'Add'}</button>
            {editingId ? <button type="button" onClick={resetForm} className="self-end rounded-2xl border border-slate-300 px-5 py-3 text-slate-700">Cancel</button> : null}
          </div>
        </form>
        </div>
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
            <div className="mt-3 flex gap-2">
              {canManage ? <button type="button" onClick={() => startEdit(settlement)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Edit settlement</button> : null}
              <button type="button" onClick={() => void handleDownloadPdf(settlement)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">PDF</button>
              {canManage ? <button type="button" onClick={() => void handleDelete(settlement)} className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">Delete</button> : null}
            </div>
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
                <dt className="font-medium text-slate-500">Advances</dt>
                <dd>{formatCurrency(settlement.advances)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Deductions</dt>
                <dd>{formatCurrency(settlement.deductions)}</dd>
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
