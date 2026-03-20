import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Owner, Vehicle, VehicleCategory } from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';
import { IconBtn } from '../Layout/IconBtn';

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
  const [viewingItem, setViewingItem] = useState<Vehicle | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterNumber, setFilterNumber] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterOwnerId, setFilterOwnerId] = useState('');

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

  function openCreate() {
    setEditingId(null);
    setFormState(initialForm);
    setIsModalOpen(true);
  }

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
    setViewingItem(null);
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

      await loadVehicles();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save vehicle.');
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
      await api.delete(`/vehicles/${deleteTarget.id}`);
      if (editingId === deleteTarget.id) {
        closeModal();
      }
      setDeleteTarget(null);
      await loadVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete vehicle.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(vehicle: Vehicle) {
    try {
      await api.put(`/vehicles/${vehicle.id}`, { ...vehicle, is_active: !vehicle.is_active });
      await loadVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status.');
    }
  }

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const displayName = `${v.make ?? ''} ${v.model ?? ''}`.toLowerCase();
      if (filterName && !displayName.includes(filterName.toLowerCase())) return false;
      if (filterNumber && !v.vehicle_number.toLowerCase().includes(filterNumber.toLowerCase())) return false;
      if (filterType && v.vehicle_type !== filterType) return false;
      if (filterOwnerId && v.owner?.id !== filterOwnerId) return false;
      return true;
    });
  }, [vehicles, filterName, filterNumber, filterType, filterOwnerId]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading vehicles...</p>;
  }

  const visibleCategories = categories.filter(
    (category) => category.is_active || category.id === formState.vehicle_category_id
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Vehicles</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Fleet master</h2>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
          >
            Add Vehicle
          </button>
        ) : null}
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <input
          type="text"
          placeholder="Search make/model..."
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Number..."
          value={filterNumber}
          onChange={(e) => setFilterNumber(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          {['bus', 'mini_bus', 'van', 'car', 'truck'].map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={filterOwnerId}
          onChange={(e) => setFilterOwnerId(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Owners</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVehicles.map((v, i) => (
              <tr key={v.id} className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setViewingItem(v)}
                    className="font-medium text-slate-900 hover:text-blue-600 hover:underline cursor-pointer text-left"
                  >
                    {v.make} {v.model}
                  </button>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{v.vehicle_number}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{v.vehicle_type.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-slate-600">{v.vehicle_category?.name ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{v.is_owned ? 'Company-owned' : v.owner?.name ?? '-'}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(v)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        v.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        v.is_active ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                  ) : (
                    <span className={v.is_active ? 'text-emerald-600' : 'text-slate-400'}>
                      {v.is_active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {canManage ? <IconBtn icon={Pencil} label="Edit" onClick={() => startEdit(v)} /> : null}
                    {canManage ? <IconBtn icon={Trash2} label="Delete" variant="danger" onClick={() => setDeleteTarget(v)} /> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!viewingItem && !editingId} onClose={() => setViewingItem(null)} title="View Vehicle" size="lg">
        {viewingItem && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Make</p>
              <p className="mt-1 text-slate-600">{viewingItem.make}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Model</p>
              <p className="mt-1 text-slate-600">{viewingItem.model}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Vehicle Number</p>
              <p className="mt-1 text-slate-600">{viewingItem.vehicle_number}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Vehicle Type</p>
              <p className="mt-1 text-slate-600">{viewingItem.vehicle_type.replace(/_/g, ' ')}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Category</p>
              <p className="mt-1 text-slate-600">{viewingItem.vehicle_category?.name ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Year</p>
              <p className="mt-1 text-slate-600">{viewingItem.year ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Seating Capacity</p>
              <p className="mt-1 text-slate-600">{viewingItem.seating_capacity ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Ownership</p>
              <p className="mt-1 text-slate-600">{viewingItem.is_owned ? 'Company-owned' : (viewingItem.owner?.name ?? '-')}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Status</p>
              <p className="mt-1 text-slate-600">{viewingItem.is_active ? 'Active' : 'Inactive'}</p>
            </div>
            <div className="flex justify-end gap-2 pt-4 lg:col-span-2">
              <button onClick={() => setViewingItem(null)} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700">Close</button>
              {canManage && (
                <button
                  onClick={() => startEdit(viewingItem)}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-white"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onClose={saving ? () => undefined : closeModal}
        title={editingId ? 'Edit Vehicle' : 'Add Vehicle'}
        size="lg"
        closeOnBackdrop={!saving}
        closeOnEsc={!saving}
      >
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
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
          <label className="text-sm font-semibold text-slate-800">
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
          <div className="lg:col-span-2 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700 disabled:opacity-60"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">
              {saving ? 'Saving...' : editingId ? 'Update Vehicle' : 'Create Vehicle'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Vehicle"
        message={deleteTarget ? `Delete vehicle ${deleteTarget.vehicle_number}?` : ''}
        confirmLabel="Delete"
        loading={deleteTarget ? deletingId === deleteTarget.id : false}
      />
    </section>
  );
}
