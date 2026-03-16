import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { Customer, Driver, Trip, Vehicle } from '../../lib/types';

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

export function TripList() {
  const { profile } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [formState, setFormState] = useState<TripFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  function startEdit(trip: Trip) {
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
      <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-4">
        <input
          value={formState.trip_number}
          onChange={(event) => setFormState((current) => ({ ...current, trip_number: event.target.value }))}
          placeholder="Trip number"
          className="rounded-2xl border border-slate-300 px-4 py-3"
          required
        />
        <select
          value={formState.customer_id}
          onChange={(event) => setFormState((current) => ({ ...current, customer_id: event.target.value }))}
          className="rounded-2xl border border-slate-300 px-4 py-3"
          required
        >
          <option value="">Select customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        <select
          value={formState.driver_id}
          onChange={(event) => setFormState((current) => ({ ...current, driver_id: event.target.value }))}
          className="rounded-2xl border border-slate-300 px-4 py-3"
          required
        >
          <option value="">Select driver</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
        <select
          value={formState.vehicle_id}
          onChange={(event) => setFormState((current) => ({ ...current, vehicle_id: event.target.value }))}
          className="rounded-2xl border border-slate-300 px-4 py-3"
          required
        >
          <option value="">Select vehicle</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.vehicle_number}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={formState.trip_date}
          onChange={(event) => setFormState((current) => ({ ...current, trip_date: event.target.value }))}
          className="rounded-2xl border border-slate-300 px-4 py-3"
          required
        />
        <input
          value={formState.from_location}
          onChange={(event) => setFormState((current) => ({ ...current, from_location: event.target.value }))}
          placeholder="From"
          className="rounded-2xl border border-slate-300 px-4 py-3"
          required
        />
        <input
          value={formState.to_location}
          onChange={(event) => setFormState((current) => ({ ...current, to_location: event.target.value }))}
          placeholder="To"
          className="rounded-2xl border border-slate-300 px-4 py-3"
          required
        />
        <select
          value={formState.status}
          onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))}
          className="rounded-2xl border border-slate-300 px-4 py-3"
        >
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="flex gap-3">
          <input
            value={formState.trip_amount}
            onChange={(event) => setFormState((current) => ({ ...current, trip_amount: event.target.value }))}
            placeholder="Trip amount"
            type="number"
            min="0"
            className="flex-1 rounded-2xl border border-slate-300 px-4 py-3"
            required
          />
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
                  {canManage ? (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => startEdit(trip)}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        Edit
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="px-4 py-6 text-center text-slate-500">
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
