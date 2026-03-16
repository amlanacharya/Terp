import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { Customer, Driver, Trip, TripExpense, Vehicle } from '../../lib/types';

interface TripFormState {
  trip_number: string;
  customer_id: string;
  driver_id: string;
  vehicle_id: string;
  trip_date: string;
  from_location: string;
  to_location: string;
  trip_amount: string;
  status: string;
}

interface ExpenseFormState {
  expense_type: string;
  amount: string;
  description: string;
  receipt_number: string;
}

const initialForm: TripFormState = {
  trip_number: '',
  customer_id: '',
  driver_id: '',
  vehicle_id: '',
  trip_date: '',
  from_location: '',
  to_location: '',
  trip_amount: '',
  status: 'scheduled',
};

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
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(initialExpenseForm);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [formState, setFormState] = useState<TripFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager', 'operator'].includes(profile.role) : false;

  async function loadTrips(filter: string) {
    const path = filter === 'all' ? '/trips' : `/trips?status=${encodeURIComponent(filter)}`;
    return api.get<Trip[]>(path);
  }

  async function loadExpenses(tripId: string) {
    setExpenses(await api.get<TripExpense[]>(`/trips/${tripId}/expenses`));
  }

  async function hydratePage(filter: string) {
    try {
      setLoading(true);
      setError('');
      const [tripRows, customerRows, driverRows, vehicleRows] = await Promise.all([
        loadTrips(filter),
        api.get<Customer[]>('/customers'),
        api.get<Driver[]>('/drivers'),
        api.get<Vehicle[]>('/vehicles'),
      ]);
      setTrips(tripRows);
      setCustomers(customerRows);
      setDrivers(driverRows);
      setVehicles(vehicleRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trips.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void hydratePage(statusFilter);
  }, [statusFilter]);

  async function startEdit(trip: Trip) {
    setEditingId(trip.id);
    setFormState({
      trip_number: trip.trip_number,
      customer_id: trip.customer.id,
      driver_id: trip.driver.id,
      vehicle_id: trip.vehicle.id,
      trip_date: trip.trip_date?.slice(0, 10) ?? '',
      from_location: trip.from_location,
      to_location: trip.to_location,
      trip_amount: String(trip.trip_amount),
      status: trip.status,
    });
    setEditingExpenseId(null);
    setExpenseForm(initialExpenseForm);

    try {
      setError('');
      await loadExpenses(trip.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trip expenses.');
    }
  }

  function resetForm() {
    setEditingId(null);
    setFormState(initialForm);
    setExpenses([]);
    setEditingExpenseId(null);
    setExpenseForm(initialExpenseForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        ...formState,
        trip_amount: Number(formState.trip_amount),
      };

      if (editingId) {
        await api.put(`/trips/${editingId}`, payload);
      } else {
        await api.post('/trips', payload);
      }

      resetForm();
      setTrips(await loadTrips(statusFilter));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save trip.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) {
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
        await api.put(`/trips/${editingId}/expenses/${editingExpenseId}`, payload);
      } else {
        await api.post(`/trips/${editingId}/expenses`, payload);
      }

      setEditingExpenseId(null);
      setExpenseForm(initialExpenseForm);
      await Promise.all([loadExpenses(editingId), hydratePage(statusFilter)]);
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

  async function handleDelete(trip: Trip) {
    const confirmed = window.confirm(`Delete trip ${trip.trip_number}?`);
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await api.delete(`/trips/${trip.id}`);
      if (editingId === trip.id) {
        resetForm();
      }
      setTrips(await loadTrips(statusFilter));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete trip.');
    }
  }

  async function handleDeleteExpense(expense: TripExpense) {
    if (!editingId) {
      return;
    }

    const confirmed = window.confirm(`Delete ${expense.expense_type} expense?`);
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await api.delete(`/trips/${editingId}/expenses/${expense.id}`);
      if (editingExpenseId === expense.id) {
        setEditingExpenseId(null);
        setExpenseForm(initialExpenseForm);
      }
      await Promise.all([loadExpenses(editingId), hydratePage(statusFilter)]);
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
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}

      {canManage ? (
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-4">
            <label className="text-sm font-semibold text-slate-800">
              Trip Number
              <input
                value={formState.trip_number}
                onChange={(event) => setFormState((current) => ({ ...current, trip_number: event.target.value }))}
                placeholder="Trip number, e.g. TRP-00012"
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
                required
              />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Customer
              <select
                value={formState.customer_id}
                onChange={(event) => setFormState((current) => ({ ...current, customer_id: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
                required
              >
                <option value="">Select customer account</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Driver
              <select
                value={formState.driver_id}
                onChange={(event) => setFormState((current) => ({ ...current, driver_id: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
                required
              >
                <option value="">Select assigned driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Vehicle
              <select
                value={formState.vehicle_id}
                onChange={(event) => setFormState((current) => ({ ...current, vehicle_id: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
                required
              >
                <option value="">Select assigned vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicle_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Trip Date
              <input
                type="date"
                value={formState.trip_date}
                onChange={(event) => setFormState((current) => ({ ...current, trip_date: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
                required
              />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              From Location
              <input
                value={formState.from_location}
                onChange={(event) => setFormState((current) => ({ ...current, from_location: event.target.value }))}
                placeholder="From location, e.g. Mumbai Airport"
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
                required
              />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              To Location
              <input
                value={formState.to_location}
                onChange={(event) => setFormState((current) => ({ ...current, to_location: event.target.value }))}
                placeholder="To location, e.g. Pune Station"
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
                required
              />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Trip Status
              <select
                value={formState.status}
                onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              >
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <div className="flex gap-3">
              <label className="flex-1 text-sm font-semibold text-slate-800">
                Trip Amount
                <input
                  value={formState.trip_amount}
                  onChange={(event) => setFormState((current) => ({ ...current, trip_amount: event.target.value }))}
                  placeholder="Trip amount in INR, e.g. 18500"
                  type="number"
                  min="0"
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          {editingId ? (
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Expenses</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">Trip expenses</h3>
              </div>
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
                    placeholder="Expense amount in INR, e.g. 1500"
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
                    placeholder="Receipt number, bill no., or UTR"
                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
                  />
                </label>
                <div className="flex gap-3">
                  <label className="flex-1 text-sm font-semibold text-slate-800">
                    Description
                    <input
                      value={expenseForm.description}
                      onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Expense note, e.g. diesel refill at Pune"
                      className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
                    />
                  </label>
                  <button type="submit" disabled={expenseSaving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">
                    {expenseSaving ? 'Saving...' : editingExpenseId ? 'Update' : 'Add'}
                  </button>
                  {editingExpenseId ? (
                    <button type="button" onClick={() => { setEditingExpenseId(null); setExpenseForm(initialExpenseForm); }} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700">
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Receipt</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {expenses.map((expense) => (
                      <tr key={expense.id}>
                        <td className="px-4 py-3">{expense.expense_type}</td>
                        <td className="px-4 py-3">{formatCurrency(expense.amount)}</td>
                        <td className="px-4 py-3">{expense.receipt_number ?? '-'}</td>
                        <td className="px-4 py-3">{expense.description ?? '-'}</td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => startExpenseEdit(expense)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                            Edit
                          </button>
                          <button type="button" onClick={() => void handleDeleteExpense(expense)} className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {expenses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                          No expenses recorded for this trip.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
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
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Expenses</th>
                {canManage ? <th className="px-4 py-3">Action</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {trips.map((trip) => (
                <tr key={trip.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{trip.trip_number}</td>
                  <td className="px-4 py-3">{trip.customer.name}</td>
                  <td className="px-4 py-3">{trip.driver.name}</td>
                  <td className="px-4 py-3">{trip.vehicle.vehicle_number}</td>
                  <td className="px-4 py-3">{formatDate(trip.trip_date)}</td>
                  <td className="px-4 py-3">
                    {trip.from_location} to {trip.to_location}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {trip.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatCurrency(trip.trip_amount)}</td>
                  <td className="px-4 py-3">{formatCurrency(trip.total_expenses)}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void startEdit(trip)}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(trip)}
                        className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700"
                      >
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 10 : 9} className="px-4 py-6 text-center text-slate-500">
                    No trips found for this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
