import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Owner, Vehicle, VehicleCategory } from '../../lib/types';

interface VehicleFormState {
  vehicle_number: string;
  vehicle_type: string;
  vehicle_category_id: string;
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
  vehicle_category_id: '',
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
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [formState, setFormState] = useState<VehicleFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager', 'operator'].includes(profile.role) : false;

  async function loadVehicles() {
    const [vehicleRows, ownerRows, categoryRows] = await Promise.all([
      api.get<Vehicle[]>('/vehicles'),
      api.get<Owner[]>('/owners'),
      api.get<VehicleCategory[]>('/vehicle-categories'),
    ]);

    setVehicles(vehicleRows);
    setOwners(ownerRows);
    setCategories(categoryRows);
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
      vehicle_category_id: vehicle.vehicle_category?.id ?? '',
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
        vehicle_category_id: formState.vehicle_category_id || null,
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

  async function handleDelete(vehicle: Vehicle) {
    const confirmed = window.confirm(`Delete vehicle ${vehicle.vehicle_number}?`);
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await api.delete(`/vehicles/${vehicle.id}`);
      if (editingId === vehicle.id) {
        resetForm();
      }
      await loadVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete vehicle.');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading vehicles...</p>;
  }

  const visibleCategories = categories.filter(
    (category) => category.is_active || category.id === formState.vehicle_category_id
  );

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Vehicles</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Fleet master</h2>
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {canManage ? (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-4">
          <label className="text-sm font-semibold text-slate-800">
            Vehicle Number
            <input
              value={formState.vehicle_number}
              onChange={(event) => setFormState((current) => ({ ...current, vehicle_number: event.target.value }))}
              placeholder="Vehicle number, e.g. OD02AB1234"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Vehicle Type
            <select
              value={formState.vehicle_type}
              onChange={(event) => setFormState((current) => ({ ...current, vehicle_type: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            >
              <option value="bus">Bus</option>
              <option value="mini_bus">Mini bus</option>
              <option value="van">Van</option>
              <option value="car">Car</option>
              <option value="truck">Truck</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Vehicle Category
            <select
              value={formState.vehicle_category_id}
              onChange={(event) => setFormState((current) => ({ ...current, vehicle_category_id: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            >
              <option value="">Select GT vehicle category</option>
              {visibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}{category.is_active ? '' : ' (Inactive)'}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Make
            <input
              value={formState.make}
              onChange={(event) => setFormState((current) => ({ ...current, make: event.target.value }))}
              placeholder="Vehicle make, e.g. Toyota"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Model
            <input
              value={formState.model}
              onChange={(event) => setFormState((current) => ({ ...current, model: event.target.value }))}
              placeholder="Vehicle model, e.g. Innova"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Year
            <input
              value={formState.year}
              onChange={(event) => setFormState((current) => ({ ...current, year: event.target.value }))}
              placeholder="Year, e.g. 2023"
              type="number"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Seating Capacity
            <input
              value={formState.seating_capacity}
              onChange={(event) => setFormState((current) => ({ ...current, seating_capacity: event.target.value }))}
              placeholder="Seats, e.g. 7"
              type="number"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={formState.is_owned}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  is_owned: event.target.checked,
                  owner_id: event.target.checked ? '' : current.owner_id,
                }))
              }
            />
            Company-owned vehicle
          </label>
          <div className="flex gap-3 lg:col-span-2">
            <label className="flex-1 text-sm font-semibold text-slate-800">
              Vehicle Owner
              <select
                value={formState.owner_id}
                onChange={(event) => setFormState((current) => ({ ...current, owner_id: event.target.value }))}
                disabled={formState.is_owned}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal disabled:bg-slate-100"
              >
                <option value="">Select vehicle owner</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>{owner.name}</option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">
              {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700">
                Cancel
              </button>
            ) : null}
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
            {canManage ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(vehicle)}
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  Edit vehicle
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(vehicle)}
                  className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700"
                >
                  Delete
                </button>
              </div>
            ) : null}
            <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-slate-500">GT Category</dt>
                <dd>{vehicle.vehicle_category?.name ?? '-'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Vehicle Owner</dt>
                <dd>{vehicle.is_owned ? 'Company-owned' : vehicle.owner?.name ?? 'Not assigned'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Seating</dt>
                <dd>{vehicle.seating_capacity ?? '-'}</dd>
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
