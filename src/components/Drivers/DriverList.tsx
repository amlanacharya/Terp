import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { Driver, Vehicle } from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';

interface DriverFormState {
  driver_code: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  license_number: string;
  license_expiry: string;
  default_vehicle_id: string;
  night_halt_rate: string;
  ot_per_hour: string;
  is_active: boolean;
}

const initialForm: DriverFormState = {
  driver_code: '',
  name: '',
  phone: '',
  email: '',
  city: '',
  state: '',
  license_number: '',
  license_expiry: '',
  default_vehicle_id: '',
  night_halt_rate: '',
  ot_per_hour: '',
  is_active: true,
};

export function DriverList() {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [formState, setFormState] = useState<DriverFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager', 'operator'].includes(profile.role) : false;

  async function loadDrivers() {
    const [driverRows, vehicleRows] = await Promise.all([
      api.get<Driver[]>('/drivers'),
      api.get<Vehicle[]>('/vehicles'),
    ]);

    setDrivers(driverRows);
    setVehicles(vehicleRows);
  }

  useEffect(() => {
    async function hydrate() {
      try {
        await loadDrivers();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load drivers.');
      } finally {
        setLoading(false);
      }
    }

    void hydrate();
  }, []);

  function getVehicleLabel(vehicleId: string | null | undefined) {
    if (!vehicleId) {
      return '-';
    }

    const vehicle = vehicles.find((item) => item.id === vehicleId);
    return vehicle ? vehicle.vehicle_number : vehicleId;
  }

  function openCreate() {
    setEditingId(null);
    setFormState(initialForm);
    setIsModalOpen(true);
  }

  function startEdit(driver: Driver) {
    setEditingId(driver.id);
    setFormState({
      driver_code: driver.driver_code,
      name: driver.name,
      phone: driver.phone,
      email: driver.email ?? '',
      city: driver.city ?? '',
      state: driver.state ?? '',
      license_number: driver.license_number,
      license_expiry: driver.license_expiry?.slice(0, 10) ?? '',
      default_vehicle_id: driver.default_vehicle_id ?? '',
      night_halt_rate: driver.night_halt_rate == null ? '' : String(driver.night_halt_rate),
      ot_per_hour: driver.ot_per_hour == null ? '' : String(driver.ot_per_hour),
      is_active: driver.is_active,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingId(null);
    setFormState(initialForm);
    setIsModalOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        ...formState,
        email: formState.email || null,
        city: formState.city || null,
        state: formState.state || null,
        default_vehicle_id: formState.default_vehicle_id || null,
        night_halt_rate: formState.night_halt_rate === '' ? null : Number(formState.night_halt_rate),
        ot_per_hour: formState.ot_per_hour === '' ? null : Number(formState.ot_per_hour),
      };

      if (editingId) {
        await api.put(`/drivers/${editingId}`, payload);
      } else {
        await api.post('/drivers', payload);
      }

      await loadDrivers();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save driver.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeletingId(deleteTarget.id);
      setError('');
      await api.delete(`/drivers/${deleteTarget.id}`);
      if (editingId === deleteTarget.id) {
        closeModal();
      }
      setDeleteTarget(null);
      await loadDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete driver.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading drivers...</p>;
  }

  const selectableVehicles = vehicles.filter(
    (vehicle) => vehicle.is_active || vehicle.id === formState.default_vehicle_id
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Drivers</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Driver roster</h2>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
          >
            Add Driver
          </button>
        ) : null}
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      <div className="overflow-x-auto rounded-3xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Default Vehicle</th>
              <th className="px-4 py-3">Night Halt</th>
              <th className="px-4 py-3">OT/Hour</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3">Status</th>
              {canManage ? <th className="px-4 py-3">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {drivers.map((driver) => {
              const rowBusy = deletingId === driver.id;

              return (
                <tr key={driver.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{driver.driver_code}</td>
                  <td className="px-4 py-3">{driver.name}</td>
                  <td className="px-4 py-3">{driver.phone}</td>
                  <td className="px-4 py-3">
                    {driver.city ?? '-'}, {driver.state ?? '-'}
                  </td>
                  <td className="px-4 py-3">{getVehicleLabel(driver.default_vehicle_id)}</td>
                  <td className="px-4 py-3">{driver.night_halt_rate == null ? '-' : formatCurrency(driver.night_halt_rate)}</td>
                  <td className="px-4 py-3">{driver.ot_per_hour == null ? '-' : formatCurrency(driver.ot_per_hour)}</td>
                  <td className="px-4 py-3">{driver.license_expiry ? formatDate(driver.license_expiry) : '-'}</td>
                  <td className="px-4 py-3">{driver.is_active ? 'Active' : 'Inactive'}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={() => startEdit(driver)}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={() => setDeleteTarget(driver)}
                        className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={saving ? () => undefined : closeModal}
        title={editingId ? 'Edit Driver' : 'Add Driver'}
        size="lg"
        closeOnBackdrop={!saving}
        closeOnEsc={!saving}
      >
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-semibold text-slate-800">
            Driver Code
            <input
              value={formState.driver_code}
              onChange={(event) => setFormState((current) => ({ ...current, driver_code: event.target.value }))}
              placeholder="Driver code, e.g. DRV-001"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Driver Name
            <input
              value={formState.name}
              onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
              placeholder="Driver name, e.g. Suresh Patil"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Phone Number
            <input
              value={formState.phone}
              onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
              placeholder="Phone number, e.g. 9876543210"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Email
            <input
              value={formState.email}
              onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email, e.g. driver@company.com"
              type="email"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            City
            <input
              value={formState.city}
              onChange={(event) => setFormState((current) => ({ ...current, city: event.target.value }))}
              placeholder="City, e.g. Cuttack"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            State
            <input
              value={formState.state}
              onChange={(event) => setFormState((current) => ({ ...current, state: event.target.value }))}
              placeholder="State, e.g. Odisha"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            License Number
            <input
              value={formState.license_number}
              onChange={(event) => setFormState((current) => ({ ...current, license_number: event.target.value }))}
              placeholder="License number"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            License Expiry
            <input
              type="date"
              value={formState.license_expiry}
              onChange={(event) => setFormState((current) => ({ ...current, license_expiry: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Default Vehicle
            <select
              value={formState.default_vehicle_id}
              onChange={(event) => setFormState((current) => ({ ...current, default_vehicle_id: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            >
              <option value="">Select default vehicle</option>
              {selectableVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_number}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Night Halt Rate
            <input
              value={formState.night_halt_rate}
              onChange={(event) => setFormState((current) => ({ ...current, night_halt_rate: event.target.value }))}
              placeholder="e.g. 500"
              type="number"
              min="0"
              step="0.01"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            OT Per Hour
            <input
              value={formState.ot_per_hour}
              onChange={(event) => setFormState((current) => ({ ...current, ot_per_hour: event.target.value }))}
              placeholder="e.g. 150"
              type="number"
              min="0"
              step="0.01"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            />
          </label>
          <div className="lg:col-span-2 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingId ? 'Update Driver' : 'Create Driver'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Driver"
        message={deleteTarget ? `Delete driver ${deleteTarget.name}?` : ''}
        confirmLabel="Delete"
        loading={deleteTarget ? deletingId === deleteTarget.id : false}
      />
    </section>
  );
}
