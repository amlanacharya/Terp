import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Driver, Vehicle } from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';

interface DriverFormState {
  driver_code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  license_number: string;
  license_expiry: string;
  pan: string;
  aadhar_number: string;
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
  address: '',
  city: '',
  state: '',
  license_number: '',
  license_expiry: '',
  pan: '',
  aadhar_number: '',
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
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterPhone, setFilterPhone] = useState('');

  const canManage = profile ? ['admin', 'manager', 'operator'].includes(profile.role) : false;

  const filteredDrivers = useMemo(() => {
    let result = showInactive ? drivers : drivers.filter((driver) => driver.is_active !== false);
    if (filterName) {
      result = result.filter((d) => d.name.toLowerCase().includes(filterName.toLowerCase()));
    }
    if (filterPhone) {
      result = result.filter((d) => (d.phone ?? '').includes(filterPhone));
    }
    return result;
  }, [drivers, showInactive, filterName, filterPhone]);

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
      address: driver.address ?? '',
      city: driver.city ?? '',
      state: driver.state ?? '',
      license_number: driver.license_number,
      license_expiry: driver.license_expiry?.slice(0, 10) ?? '',
      pan: driver.pan ?? '',
      aadhar_number: driver.aadhar_number ?? '',
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

    if (formState.aadhar_number && !/^[0-9]{12}$/.test(formState.aadhar_number)) {
      setError('Aadhaar number must be exactly 12 digits.');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        name: formState.name,
        phone: formState.phone,
        email: formState.email || null,
        address: formState.address || null,
        city: formState.city || null,
        state: formState.state || null,
        license_number: formState.license_number,
        license_expiry: formState.license_expiry,
        pan: formState.pan || null,
        aadhar_number: formState.aadhar_number || null,
        default_vehicle_id: formState.default_vehicle_id || null,
        night_halt_rate: formState.night_halt_rate === '' ? null : Number(formState.night_halt_rate),
        ot_per_hour: formState.ot_per_hour === '' ? null : Number(formState.ot_per_hour),
        is_active: formState.is_active,
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

  async function handleToggleActive(driver: Driver) {
    try {
      setError('');
      await api.put(`/drivers/${driver.id}`, { ...driver, is_active: !driver.is_active });
      await loadDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status.');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading drivers...</p>;
  }

  const selectableVehicles = vehicles.filter((vehicle) => vehicle.is_active || vehicle.id === formState.default_vehicle_id);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Drivers</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Driver roster</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />Include Inactive</label>
          {canManage ? <button type="button" onClick={openCreate} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">Add Driver</button> : null}
        </div>
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <input
          type="text"
          placeholder="Search name..."
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="tel"
          placeholder="Phone..."
          value={filterPhone}
          onChange={(e) => setFilterPhone(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">License #</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDrivers.map((d, i) => (
              <tr key={d.id} className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.driver_code}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{d.name}</td>
                <td className="px-4 py-3 text-slate-600">{d.phone ?? '-'}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.license_number ?? '-'}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(d)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        d.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        d.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  ) : (
                    <span className={d.is_active ? 'text-emerald-600' : 'text-slate-400'}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {canManage ? <button type="button" onClick={() => startEdit(d)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700">Edit</button> : null}
                    {canManage ? <button type="button" onClick={() => setDeleteTarget(d)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700">Delete</button> : null}
                  </div>
                </td>
              </tr>
            ))}
            {filteredDrivers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No drivers match the current filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={saving ? () => undefined : closeModal} title={editingId ? 'Edit Driver' : 'Add Driver'} size="lg" closeOnBackdrop={!saving} closeOnEsc={!saving}>
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-semibold text-slate-800">Driver Code<input value={editingId ? formState.driver_code : 'Auto-generated on save'} readOnly className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 font-normal text-slate-500" /></label>
          <label className="text-sm font-semibold text-slate-800">Driver Name<input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
          <label className="text-sm font-semibold text-slate-800">Phone Number<input value={formState.phone} onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
          <label className="text-sm font-semibold text-slate-800">Email<input value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} type="email" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800 lg:col-span-2">Address<textarea value={formState.address} onChange={(event) => setFormState((current) => ({ ...current, address: event.target.value }))} rows={3} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">City<input value={formState.city} onChange={(event) => setFormState((current) => ({ ...current, city: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">State<input value={formState.state} onChange={(event) => setFormState((current) => ({ ...current, state: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">License Number<input value={formState.license_number} onChange={(event) => setFormState((current) => ({ ...current, license_number: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
          <label className="text-sm font-semibold text-slate-800">License Expiry<input type="date" value={formState.license_expiry} onChange={(event) => setFormState((current) => ({ ...current, license_expiry: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
          <label className="text-sm font-semibold text-slate-800">PAN<input value={formState.pan} onChange={(event) => setFormState((current) => ({ ...current, pan: event.target.value.toUpperCase() }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">Aadhaar Number<input value={formState.aadhar_number} onChange={(event) => setFormState((current) => ({ ...current, aadhar_number: event.target.value }))} maxLength={12} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">Default Vehicle<select value={formState.default_vehicle_id} onChange={(event) => setFormState((current) => ({ ...current, default_vehicle_id: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"><option value="">Select default vehicle</option>{selectableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_number}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-800">Night Halt Rate<input value={formState.night_halt_rate} onChange={(event) => setFormState((current) => ({ ...current, night_halt_rate: event.target.value }))} type="number" min="0" step="0.01" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">OT Per Hour<input value={formState.ot_per_hour} onChange={(event) => setFormState((current) => ({ ...current, ot_per_hour: event.target.value }))} type="number" min="0" step="0.01" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 lg:col-span-2"><input type="checkbox" checked={formState.is_active} onChange={(event) => setFormState((current) => ({ ...current, is_active: event.target.checked }))} />Active driver</label>
          <div className="flex justify-end gap-3 pt-2 lg:col-span-2"><button type="button" onClick={closeModal} disabled={saving} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700 disabled:opacity-60">Cancel</button><button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update Driver' : 'Create Driver'}</button></div>
        </form>
      </Modal>

      <ConfirmModal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} title="Delete Driver" message={deleteTarget ? `Delete driver ${deleteTarget.name}?` : ''} confirmLabel="Delete" loading={deleteTarget ? deletingId === deleteTarget.id : false} />
    </section>
  );
}
