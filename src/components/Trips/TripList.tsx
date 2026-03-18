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
import { AnnexureList } from '../Annexures/AnnexureList';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';

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
  const [editingTrip, setEditingTrip] = useState<TripDetail | null>(null);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [activeCalculation, setActiveCalculation] = useState<RateCalculationResult | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(initialExpenseForm);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [deleteTripTarget, setDeleteTripTarget] = useState<Trip | null>(null);
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<TripExpense | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metricSaving, setMetricSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [billing, setBilling] = useState(false);
  const [tripDeleting, setTripDeleting] = useState(false);
  const [expenseDeleting, setExpenseDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
    setEditingTrip(null);
    setIsTripModalOpen(false);
    setActiveCalculation(null);
    setEditingExpenseId(null);
    setExpenseForm(initialExpenseForm);
    setDeleteExpenseTarget(null);
    setNotice('');
    setError('');
  }

  function openCreateTrip() {
    setError('');
    setNotice('');
    setEditingTrip(null);
    setIsTripModalOpen(true);
  }

  function closeTripModal() {
    setEditingTrip(null);
    setIsTripModalOpen(false);
  }

  async function openTripById(tripId: string) {
    try {
      setError('');
      setNotice('');
      setSelectedTrip(await loadTripDetail(tripId));
      setActiveCalculation(null);
      setEditingExpenseId(null);
      setExpenseForm(initialExpenseForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trip detail.');
    }
  }

  async function startEdit(trip: Trip) {
    try {
      setError('');
      setNotice('');
      const detail = await loadTripDetail(trip.id);
      setSelectedTrip(detail);
      setEditingTrip(detail);
      setActiveCalculation(null);
      setEditingExpenseId(null);
      setExpenseForm(initialExpenseForm);
      setIsTripModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trip detail.');
    }
  }

  async function handleSaveTrip(payload: Record<string, unknown>, tripId?: string) {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const savedTrip = tripId
        ? await api.put<TripDetail>(`/trips/${tripId}`, payload)
        : await api.post<TripDetail>('/trips', payload);
      setSelectedTrip(savedTrip);
      setEditingTrip(null);
      setIsTripModalOpen(false);
      setActiveCalculation(null);
      setTrips(await loadTrips(statusFilter));
      setNotice(tripId ? 'Trip updated.' : 'Trip created.');
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
      const [detail, tripRows] = await Promise.all([loadTripDetail(tripId), loadTrips(statusFilter)]);
      setSelectedTrip(detail);
      if (editingTrip?.id === tripId) {
        setEditingTrip(detail);
      }
      setActiveCalculation(null);
      setTrips(tripRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save travel metric.');
    } finally {
      setMetricSaving(false);
    }
  }

  async function handleCalculate(tripId: string, payload: { package_code?: string | null; force_sync_trip_amount?: boolean }) {
    setCalculating(true);
    setError('');
    setNotice('');

    try {
      const response = await api.post<TripCalculationResponse>(`/trips/${tripId}/calculate`, payload);
      setSelectedTrip(response.trip);
      if (editingTrip?.id === tripId) {
        setEditingTrip(response.trip);
      }
      setActiveCalculation(response.calculation);
      setTrips(await loadTrips(statusFilter));
      setNotice('Trip calculated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to calculate trip.');
    } finally {
      setCalculating(false);
    }
  }

  async function handleDirectBill(tripId: string) {
    setBilling(true);
    setError('');
    setNotice('');

    try {
      const invoice = await api.post<{ invoice_number: string }>(`/trips/${tripId}/bill`, {});
      const [detail, tripRows] = await Promise.all([refreshSelectedTrip(tripId), loadTrips(statusFilter)]);
      setTrips(tripRows);
      if (editingTrip?.id === tripId) {
        setEditingTrip(detail);
      }
      setNotice(`Invoice ${invoice.invoice_number} created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to bill trip.');
    } finally {
      setBilling(false);
    }
  }

  async function handleDownloadPdf(tripId: string) {
    try {
      setError('');
      const blob = await downloadBlob(`/trips/${tripId}/duty-slip-pdf`);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const tripForFilename = editingTrip?.id === tripId
        ? editingTrip
        : selectedTrip?.id === tripId
          ? selectedTrip
          : null;
      anchor.href = url;
      anchor.download = `${tripForFilename?.trip_number ?? tripId}-duty-slip.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download duty slip PDF.');
    }
  }

  function handleDeleteTrip(trip: Trip) {
    setDeleteTripTarget(trip);
  }

  async function handleDeleteTripConfirm() {
    if (!deleteTripTarget) {
      return;
    }

    setTripDeleting(true);
    setError('');
    setNotice('');

    try {
      await api.delete(`/trips/${deleteTripTarget.id}`);
      if (selectedTrip?.id === deleteTripTarget.id) {
        resetSelection();
      } else if (editingTrip?.id === deleteTripTarget.id) {
        closeTripModal();
      }
      setDeleteTripTarget(null);
      setTrips(await loadTrips(statusFilter));
      setNotice('Trip deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete trip.');
    } finally {
      setTripDeleting(false);
    }
  }

  async function handleExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTrip?.id) {
      return;
    }

    setExpenseSaving(true);
    setError('');
    setNotice('');

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
      const [detail, tripRows] = await Promise.all([refreshSelectedTrip(selectedTrip.id), loadTrips(statusFilter)]);
      setTrips(tripRows);
      if (editingTrip?.id === selectedTrip.id) {
        setEditingTrip(detail);
      }
      setNotice(editingExpenseId ? 'Expense updated.' : 'Expense added.');
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

  function handleDeleteExpense(expense: TripExpense) {
    setDeleteExpenseTarget(expense);
  }

  async function handleDeleteExpenseConfirm() {
    if (!selectedTrip?.id || !deleteExpenseTarget) {
      return;
    }

    const tripId = selectedTrip.id;
    setExpenseDeleting(true);
    setError('');
    setNotice('');

    try {
      await api.delete(`/trips/${tripId}/expenses/${deleteExpenseTarget.id}`);
      if (editingExpenseId === deleteExpenseTarget.id) {
        setEditingExpenseId(null);
        setExpenseForm(initialExpenseForm);
      }
      const [detail, tripRows] = await Promise.all([refreshSelectedTrip(tripId), loadTrips(statusFilter)]);
      setTrips(tripRows);
      if (editingTrip?.id === tripId) {
        setEditingTrip(detail);
      }
      setDeleteExpenseTarget(null);
      setNotice('Expense deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete trip expense.');
    } finally {
      setExpenseDeleting(false);
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
          <label className="text-sm text-slate-600">
            Status filter
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-2 block rounded-2xl border border-slate-300 px-4 py-2"
            >
              <option value="all">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          {canManage ? (
            <button
              type="button"
              onClick={openCreateTrip}
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700"
            >
              New GT Trip
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{notice}</div> : null}

      {selectedTrip ? (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-sky-600">Selected Trip</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedTrip.trip_number}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedTrip.customer.name}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownloadPdf(selectedTrip.id)}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700"
                >
                  Duty Slip PDF
                </button>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTrip(selectedTrip);
                      setIsTripModalOpen(true);
                    }}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
                  >
                    Edit Trip
                  </button>
                ) : null}
              </div>
            </div>
            <dl className="mt-5 grid gap-4 text-sm text-slate-600 md:grid-cols-4">
              <div>
                <dt className="font-medium text-slate-500">Trip Date</dt>
                <dd>{formatDate(selectedTrip.trip_date)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Vehicle</dt>
                <dd>{selectedTrip.vehicle.vehicle_number}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Driver</dt>
                <dd>{selectedTrip.driver.name}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Status</dt>
                <dd>{selectedTrip.status}</dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <TripCalculationBreakdown trip={selectedTrip} calculation={activeCalculation} activeRateChart={null} />

            <div className="space-y-6">
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Billing</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">GT billing status</h3>
                </div>

                {selectedTrip.parent_trip ? (
                  <p className="text-sm text-slate-600">
                    This is an annexure child trip under <span className="font-semibold text-slate-900">{selectedTrip.parent_trip.trip_number}</span>. Bill it from the parent trip annexure panel.
                  </p>
                ) : (
                  <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      Direct Invoice
                      <div className="mt-1 font-semibold text-slate-900">{selectedTrip.direct_invoice_id ? 'Created' : 'Not billed'}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      Annexures
                      <div className="mt-1 font-semibold text-slate-900">{selectedTrip.annexure_count ?? 0}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      Billed Annexures
                      <div className="mt-1 font-semibold text-slate-900">{selectedTrip.billed_annexure_count ?? 0}</div>
                    </div>
                  </div>
                )}

                {canManage && !selectedTrip.parent_trip && !selectedTrip.direct_invoice_id && Number(selectedTrip.annexure_count ?? 0) === 0 ? (
                  <button
                    type="button"
                    disabled={billing || Number(selectedTrip.trip_amount ?? 0) <= 0}
                    onClick={() => void handleDirectBill(selectedTrip.id)}
                    className="rounded-2xl border border-sky-300 px-5 py-3 text-sm font-medium text-sky-700 disabled:opacity-60"
                  >
                    {billing ? 'Billing...' : 'Bill Trip'}
                  </button>
                ) : null}
              </div>

              {!selectedTrip.parent_trip ? (
                <AnnexureList parentTrip={selectedTrip} embedded onOpenTrip={(tripId) => { void openTripById(tripId); }} />
              ) : null}

              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Expenses</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">Trip expenses</h3>
                </div>
                {canManage ? (
                  <form onSubmit={handleExpenseSubmit} className="grid gap-4 lg:grid-cols-4">
                    <label className="text-sm font-semibold text-slate-800">
                      Expense Type
                      <select
                        value={expenseForm.expense_type}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, expense_type: event.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
                      >
                        <option value="fuel">Fuel expense</option>
                        <option value="toll">Toll expense</option>
                        <option value="parking">Parking expense</option>
                        <option value="food">Food expense</option>
                        <option value="other">Other expense</option>
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-800">
                      Expense Amount
                      <input
                        value={expenseForm.amount}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))}
                        type="number"
                        min="0"
                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
                        required
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-800">
                      Receipt Reference
                      <input
                        value={expenseForm.receipt_number}
                        onChange={(event) => setExpenseForm((current) => ({ ...current, receipt_number: event.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
                      />
                    </label>
                    <div className="flex gap-3">
                      <label className="flex-1 text-sm font-semibold text-slate-800">
                        Description
                        <input
                          value={expenseForm.description}
                          onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))}
                          className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
                        />
                      </label>
                      <button type="submit" disabled={expenseSaving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">
                        {expenseSaving ? 'Saving...' : editingExpenseId ? 'Update' : 'Add'}
                      </button>
                      {editingExpenseId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExpenseId(null);
                            setExpenseForm(initialExpenseForm);
                          }}
                          className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </form>
                ) : null}
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Receipt</th>
                        <th className="px-4 py-3">Description</th>
                        {canManage ? <th className="px-4 py-3">Action</th> : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedTrip.expenses.map((expense) => (
                        <tr key={expense.id}>
                          <td className="px-4 py-3">{expense.expense_type}</td>
                          <td className="px-4 py-3">{formatCurrency(expense.amount)}</td>
                          <td className="px-4 py-3">{expense.receipt_number ?? '-'}</td>
                          <td className="px-4 py-3">{expense.description ?? '-'}</td>
                          {canManage ? (
                            <td className="px-4 py-3">
                              <button type="button" onClick={() => startExpenseEdit(expense)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                                Edit
                              </button>
                              <button type="button" onClick={() => handleDeleteExpense(expense)} className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">
                                Delete
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                      {selectedTrip.expenses.length === 0 ? (
                        <tr>
                          <td colSpan={canManage ? 5 : 4} className="px-4 py-6 text-center text-slate-500">
                            No expenses recorded for this trip.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          Open a trip to review calculation, billing, annexures, and expenses.
        </div>
      )}

      {canManage ? (
        <Modal
          isOpen={isTripModalOpen}
          onClose={saving || metricSaving || calculating ? () => undefined : closeTripModal}
          title={editingTrip ? `Edit ${editingTrip.trip_number}` : 'New GT Trip'}
          size="xl"
          closeOnBackdrop={!saving && !metricSaving && !calculating}
          closeOnEsc={!saving && !metricSaving && !calculating}
        >
          <DutySlipForm
            trip={editingTrip}
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
            activeCalculation={editingTrip?.id === selectedTrip?.id ? activeCalculation : null}
          />
        </Modal>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading trips...</p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Trip</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Duty</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Billed</th>
                <th className="px-4 py-3">Calculated</th>
                <th className="px-4 py-3">Expenses</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {trips.map((trip) => (
                <tr key={trip.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {trip.trip_number}
                    <div className="text-xs text-slate-500">{trip.vehicle_category?.name ?? 'No GT category'}</div>
                  </td>
                  <td className="px-4 py-3">{trip.customer.name}</td>
                  <td className="px-4 py-3">
                    {trip.duty_type ?? 'manual'}
                    {trip.is_long_trip ? <div className="text-xs text-amber-700">Long pricing</div> : null}
                    {trip.parent_trip_id ? <div className="text-xs text-slate-500">Annexure child</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    {trip.vehicle.vehicle_number}
                    <div className="text-xs text-slate-500">{trip.driver.name}</div>
                  </td>
                  <td className="px-4 py-3">{formatDate(trip.trip_date)}</td>
                  <td className="px-4 py-3">{trip.from_location} to {trip.to_location}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{trip.status}</span>
                  </td>
                  <td className="px-4 py-3">{formatCurrency(trip.trip_amount)}</td>
                  <td className="px-4 py-3">{trip.calculated_amount == null ? '-' : formatCurrency(trip.calculated_amount)}</td>
                  <td className="px-4 py-3">{formatCurrency(trip.total_expenses ?? 0)}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => void openTripById(trip.id)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                      {selectedTrip?.id === trip.id ? 'Refresh' : 'Open'}
                    </button>
                    {canManage ? (
                      <>
                        <button type="button" onClick={() => void startEdit(trip)} className="ml-2 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDeleteTrip(trip)} className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">
                          Delete
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-slate-500">
                    No trips found for this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteTripTarget !== null}
        onClose={() => setDeleteTripTarget(null)}
        onConfirm={handleDeleteTripConfirm}
        title="Delete Trip"
        message={deleteTripTarget ? `Delete trip ${deleteTripTarget.trip_number}?` : ''}
        confirmLabel="Delete"
        loading={tripDeleting}
      />

      <ConfirmModal
        isOpen={deleteExpenseTarget !== null}
        onClose={() => setDeleteExpenseTarget(null)}
        onConfirm={handleDeleteExpenseConfirm}
        title="Delete Expense"
        message={deleteExpenseTarget ? `Delete ${deleteExpenseTarget.expense_type} expense?` : ''}
        confirmLabel="Delete"
        loading={expenseDeleting}
      />
    </section>
  );
}
