import { FormEvent, useEffect, useState } from 'react';
import { api, downloadBlob } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import {
  Customer,
  Driver,
  RateCalculationResult,
  Trip,
  TripCalculationResponse,
  TripDetail,
  TripExpense,
  TripTravelMetric,
  Vehicle,
  VehicleCategory,
} from '../../lib/types';
import { DutySlipForm } from './DutySlipForm';
import { TripCalculationBreakdown } from './TripCalculationBreakdown';

interface ExpenseFormState {
  expense_type: string;
  amount: string;
  description: string;
  receipt_number: string;
}

const initialExpenseForm: ExpenseFormState = {
  expense_type: 'fuel',
  amount: '',
  description: '',
  receipt_number: '',
};

export function TripList() {
  const { profile } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<TripDetail | null>(null);
  const [activeCalculation, setActiveCalculation] = useState<RateCalculationResult | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(initialExpenseForm);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metricSaving, setMetricSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager', 'operator'].includes(profile.role) : false;

  async function loadTrips(filter: string) {
    const path = filter === 'all' ? '/trips' : `/trips?status=${encodeURIComponent(filter)}`;
    return api.get<Trip[]>(path);
  }

  async function hydratePage(filter: string) {
    try {
      setLoading(true);
      setError('');
      const [tripRows, customerRows, driverRows, vehicleRows, vehicleCategoryRows] = await Promise.all([
        loadTrips(filter),
        api.get<Customer[]>('/customers'),
        api.get<Driver[]>('/drivers'),
        api.get<Vehicle[]>('/vehicles'),
        api.get<VehicleCategory[]>('/vehicle-categories'),
      ]);
      setTrips(tripRows);
      setCustomers(customerRows);
      setDrivers(driverRows);
      setVehicles(vehicleRows);
      setVehicleCategories(vehicleCategoryRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trips.');
    } finally {
      setLoading(false);
    }
  }

  async function loadTripDetail(tripId: string) {
    return api.get<TripDetail>(`/trips/${tripId}`);
  }

  async function refreshSelectedTrip(tripId: string) {
    const detail = await loadTripDetail(tripId);
    setSelectedTrip(detail);
    return detail;
  }

  useEffect(() => {
    void hydratePage(statusFilter);
  }, [statusFilter]);

  function resetSelection() {
    setSelectedTrip(null);
    setActiveCalculation(null);
    setEditingExpenseId(null);
    setExpenseForm(initialExpenseForm);
  }

  async function startEdit(trip: Trip) {
    try {
      setError('');
      setSelectedTrip(await loadTripDetail(trip.id));
      setActiveCalculation(null);
      setEditingExpenseId(null);
      setExpenseForm(initialExpenseForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trip detail.');
    }
  }

  async function handleSaveTrip(payload: Record<string, unknown>, tripId?: string) {
    setSaving(true);
    setError('');

    try {
      const savedTrip = tripId
        ? await api.put<TripDetail>(`/trips/${tripId}`, payload)
        : await api.post<TripDetail>('/trips', payload);
      setSelectedTrip(savedTrip);
      setActiveCalculation(null);
      setTrips(await loadTrips(statusFilter));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save trip.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMetric(action: Promise<TripTravelMetric[]>, tripId: string) {
    setMetricSaving(true);
    setError('');

    try {
      await action;
      await Promise.all([refreshSelectedTrip(tripId), loadTrips(statusFilter).then(setTrips)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save travel metric.');
    } finally {
      setMetricSaving(false);
    }
  }

  async function handleCalculate(tripId: string, payload: { package_code?: string | null; force_sync_trip_amount?: boolean }) {
    setCalculating(true);
    setError('');

    try {
      const response = await api.post<TripCalculationResponse>(`/trips/${tripId}/calculate`, payload);
      setSelectedTrip(response.trip);
      setActiveCalculation(response.calculation);
      setTrips(await loadTrips(statusFilter));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to calculate trip.');
    } finally {
      setCalculating(false);
    }
  }

  async function handleDownloadPdf(tripId: string) {
    try {
      setError('');
      const blob = await downloadBlob(`/trips/${tripId}/duty-slip-pdf`);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${selectedTrip?.trip_number ?? tripId}-duty-slip.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download duty slip PDF.');
    }
  }

  async function handleDelete(trip: Trip) {
    const confirmed = window.confirm(`Delete trip ${trip.trip_number}?`);
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await api.delete(`/trips/${trip.id}`);
      if (selectedTrip?.id === trip.id) {
        resetSelection();
      }
      setTrips(await loadTrips(statusFilter));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete trip.');
    }
  }

  async function handleExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTrip?.id) {
      return;
    }

    setExpenseSaving(true);
    setError('');

    try {
      const payload = {
        ...expenseForm,
        amount: Number(expenseForm.amount),
        description: expenseForm.description || null,
        receipt_number: expenseForm.receipt_number || null,
      };

      if (editingExpenseId) {
        await api.put(`/trips/${selectedTrip.id}/expenses/${editingExpenseId}`, payload);
      } else {
        await api.post(`/trips/${selectedTrip.id}/expenses`, payload);
      }

      setEditingExpenseId(null);
      setExpenseForm(initialExpenseForm);
      await Promise.all([refreshSelectedTrip(selectedTrip.id), loadTrips(statusFilter).then(setTrips)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save trip expense.');
    } finally {
      setExpenseSaving(false);
    }
  }

  function startExpenseEdit(expense: TripExpense) {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      expense_type: expense.expense_type,
      amount: String(expense.amount),
      description: expense.description ?? '',
      receipt_number: expense.receipt_number ?? '',
    });
  }

  async function handleDeleteExpense(expense: TripExpense) {
    if (!selectedTrip?.id) {
      return;
    }

    const confirmed = window.confirm(`Delete ${expense.expense_type} expense?`);
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await api.delete(`/trips/${selectedTrip.id}/expenses/${expense.id}`);
      if (editingExpenseId === expense.id) {
        setEditingExpenseId(null);
        setExpenseForm(initialExpenseForm);
      }
      await Promise.all([refreshSelectedTrip(selectedTrip.id), loadTrips(statusFilter).then(setTrips)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete trip expense.');
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Trips</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Trip operations</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-600">Status filter<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-2 block rounded-2xl border border-slate-300 px-4 py-2"><option value="all">All</option><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
          {canManage ? <button type="button" onClick={resetSelection} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700">New GT Trip</button> : null}
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}

      {canManage ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
          <DutySlipForm
            trip={selectedTrip}
            customers={customers}
            drivers={drivers}
            vehicles={vehicles}
            vehicleCategories={vehicleCategories}
            saving={saving}
            metricSaving={metricSaving}
            calculating={calculating}
            onSave={handleSaveTrip}
            onAddMetric={(tripId, payload) => handleSaveMetric(api.post<TripTravelMetric[]>(`/trips/${tripId}/travel-metrics`, payload), tripId)}
            onUpdateMetric={(tripId, metricId, payload) => handleSaveMetric(api.put<TripTravelMetric[]>(`/trips/${tripId}/travel-metrics/${metricId}`, payload), tripId)}
            onDeleteMetric={(tripId, metricId) => handleSaveMetric(api.delete<TripTravelMetric[]>(`/trips/${tripId}/travel-metrics/${metricId}`), tripId)}
            onCalculate={handleCalculate}
            onDownloadPdf={handleDownloadPdf}
            activeCalculation={activeCalculation}
          />
          <div className="space-y-6">
            <TripCalculationBreakdown trip={selectedTrip} calculation={activeCalculation} activeRateChart={null} />

            {selectedTrip ? (
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Expenses</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">Trip expenses</h3>
                </div>
                <form onSubmit={handleExpenseSubmit} className="grid gap-4 lg:grid-cols-4">
                  <label className="text-sm font-semibold text-slate-800">Expense Type<select value={expenseForm.expense_type} onChange={(event) => setExpenseForm((current) => ({ ...current, expense_type: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"><option value="fuel">Fuel expense</option><option value="toll">Toll expense</option><option value="parking">Parking expense</option><option value="food">Food expense</option><option value="other">Other expense</option></select></label>
                  <label className="text-sm font-semibold text-slate-800">Expense Amount<input value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))} type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
                  <label className="text-sm font-semibold text-slate-800">Receipt Reference<input value={expenseForm.receipt_number} onChange={(event) => setExpenseForm((current) => ({ ...current, receipt_number: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
                  <div className="flex gap-3"><label className="flex-1 text-sm font-semibold text-slate-800">Description<input value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label><button type="submit" disabled={expenseSaving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{expenseSaving ? 'Saving...' : editingExpenseId ? 'Update' : 'Add'}</button>{editingExpenseId ? <button type="button" onClick={() => { setEditingExpenseId(null); setExpenseForm(initialExpenseForm); }} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700">Cancel</button> : null}</div>
                </form>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Receipt</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100 bg-white">{selectedTrip.expenses.map((expense) => <tr key={expense.id}><td className="px-4 py-3">{expense.expense_type}</td><td className="px-4 py-3">{formatCurrency(expense.amount)}</td><td className="px-4 py-3">{expense.receipt_number ?? '-'}</td><td className="px-4 py-3">{expense.description ?? '-'}</td><td className="px-4 py-3"><button type="button" onClick={() => startExpenseEdit(expense)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Edit</button><button type="button" onClick={() => void handleDeleteExpense(expense)} className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">Delete</button></td></tr>)}{selectedTrip.expenses.length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No expenses recorded for this trip.</td></tr> : null}</tbody></table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading trips...</p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-4 py-3">Trip</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Duty</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Route</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Billed</th><th className="px-4 py-3">Calculated</th><th className="px-4 py-3">Expenses</th>{canManage ? <th className="px-4 py-3">Action</th> : null}</tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">{trips.map((trip) => <tr key={trip.id}><td className="px-4 py-3 font-medium text-slate-900">{trip.trip_number}<div className="text-xs text-slate-500">{trip.vehicle_category?.name ?? 'No GT category'}</div></td><td className="px-4 py-3">{trip.customer.name}</td><td className="px-4 py-3">{trip.duty_type ?? 'manual'}{trip.is_long_trip ? <div className="text-xs text-amber-700">Long pricing</div> : null}</td><td className="px-4 py-3">{trip.vehicle.vehicle_number}<div className="text-xs text-slate-500">{trip.driver.name}</div></td><td className="px-4 py-3">{formatDate(trip.trip_date)}</td><td className="px-4 py-3">{trip.from_location} to {trip.to_location}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{trip.status}</span></td><td className="px-4 py-3">{formatCurrency(trip.trip_amount)}</td><td className="px-4 py-3">{trip.calculated_amount == null ? '-' : formatCurrency(trip.calculated_amount)}</td><td className="px-4 py-3">{formatCurrency(trip.total_expenses)}</td>{canManage ? <td className="px-4 py-3"><button type="button" onClick={() => void startEdit(trip)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Edit</button><button type="button" onClick={() => void handleDelete(trip)} className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">Delete</button></td> : null}</tr>)}{trips.length === 0 ? <tr><td colSpan={canManage ? 11 : 10} className="px-4 py-6 text-center text-slate-500">No trips found for this filter.</td></tr> : null}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

