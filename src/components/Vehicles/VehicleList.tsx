import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Owner, Vehicle } from '../../lib/types';

interface VehicleFormState {
  vehicle_number: string;
  vehicle_type: string;
  make: string;
  model: string;
  year: string;
  seating_capacity: string;
  owner_id: string;
  is_owned: boolean;
  is_active: boolean;
}

const initialForm: VehicleFormState = {
  vehicle_number: '',
  vehicle_type: 'bus',
  make: '',
  model: '',
  year: '',
  seating_capacity: '',
  owner_id: '',
  is_owned: false,
  is_active: true,
};

export function VehicleList() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [formState, setFormState] = useState<VehicleFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager', 'operator'].includes(profile.role) : false;

  async function loadVehicles() {
    const [vehicleRows, ownerRows] = await Promise.all([
      api.get<Vehicle[]>('/vehicles'),
      api.get<Owner[]>('/owners'),
    ]);
    setVehicles(vehicleRows);
    setOwners(ownerRows);
  }

  useEffect(() => {
    async function hydrate() {
      try {
        await loadVehicles();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load vehicles.');
      } finally {
        setLoading(false);
      }
    }

    void hydrate();
  }, []);

  function startEdit(vehicle: Vehicle) {
    setEditingId(vehicle.id);
    setFormState({
      vehicle_number: vehicle.vehicle_number,
      vehicle_type: vehicle.vehicle_type,
      make: vehicle.make ?? '',
      model: vehicle.model ?? '',
      year: vehicle.year ? String(vehicle.year) : '',
      seating_capacity: vehicle.seating_capacity ? String(vehicle.seating_capacity) : '',
      owner_id: vehicle.owner?.id ?? '',
      is_owned: vehicle.is_owned,
      is_active: vehicle.is_active,
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
        make: formState.make || null,
        model: formState.model || null,
        year: formState.year ? Number(formState.year) : null,
        seating_capacity: formState.seating_capacity ? Number(formState.seating_capacity) : null,
        owner_id: formState.is_owned ? null : formState.owner_id || null,
      };

      if (editingId) {
        await api.put(`/vehicles/${editingId}`, payload);
      } else {
        await api.post('/vehicles', payload);
      }

      resetForm();
      await loadVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save vehicle.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading vehicles...</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Vehicles</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Fleet master</h2>
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {canManage ? (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-4">
          <input value={formState.vehicle_number} onChange={(event) => setFormState((current) => ({ ...current, vehicle_number: event.target.value }))} placeholder="Vehicle number" className="rounded-2xl border border-slate-300 px-4 py-3" required />
          <select value={formState.vehicle_type} onChange={(event) => setFormState((current) => ({ ...current, vehicle_type: event.target.value }))} className="rounded-2xl border border-slate-300 px-4 py-3">
            <option value="bus">Bus</option>
            <option value="mini_bus">Mini bus</option>
            <option value="van">Van</option>
            <option value="car">Car</option>
            <option value="truck">Truck</option>
          </select>
          <input value={formState.make} onChange={(event) => setFormState((current) => ({ ...current, make: event.target.value }))} placeholder="Make" className="rounded-2xl border border-slate-300 px-4 py-3" />
          <input value={formState.model} onChange={(event) => setFormState((current) => ({ ...current, model: event.target.value }))} placeholder="Model" className="rounded-2xl border border-slate-300 px-4 py-3" />
          <input value={formState.year} onChange={(event) => setFormState((current) => ({ ...current, year: event.target.value }))} placeholder="Year" type="number" className="rounded-2xl border border-slate-300 px-4 py-3" />
          <input value={formState.seating_capacity} onChange={(event) => setFormState((current) => ({ ...current, seating_capacity: event.target.value }))} placeholder="Seating capacity" type="number" className="rounded-2xl border border-slate-300 px-4 py-3" />
          <label className="flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" checked={formState.is_owned} onChange={(event) => setFormState((current) => ({ ...current, is_owned: event.target.checked, owner_id: event.target.checked ? '' : current.owner_id }))} />
            Company-owned vehicle
          </label>
          <div className="flex gap-3">
            <select value={formState.owner_id} onChange={(event) => setFormState((current) => ({ ...current, owner_id: event.target.value }))} disabled={formState.is_owned} className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 disabled:bg-slate-100">
              <option value="">Select owner/vendor</option>
              {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
            </select>
            <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update' : 'Add'}</button>
            {editingId ? <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700">Cancel</button> : null}
          </div>
        </form>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {vehicles.map((vehicle) => (
          <article key={vehicle.id} className="rounded-3xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">{vehicle.vehicle_number}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {vehicle.make ?? 'Unknown make'} {vehicle.model ?? ''}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {vehicle.vehicle_type}
              </span>
            </div>
            {canManage ? <div className="mt-3"><button type="button" onClick={() => startEdit(vehicle)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Edit vehicle</button></div> : null}
            <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-slate-500">Seating</dt>
                <dd>{vehicle.seating_capacity ?? '-'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Ownership</dt>
                <dd>{vehicle.is_owned ? 'Owned' : vehicle.owner?.name ?? 'Vendor vehicle'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Year</dt>
                <dd>{vehicle.year ?? '-'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Status</dt>
                <dd>{vehicle.is_active ? 'Active' : 'Inactive'}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
