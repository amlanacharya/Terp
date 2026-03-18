import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { VehicleCategory } from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';

interface VehicleCategoryFormState {
  name: string;
  description: string;
  is_active: boolean;
}

const initialForm: VehicleCategoryFormState = {
  name: '',
  description: '',
  is_active: true,
};

export function VehicleCategoryList() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [formState, setFormState] = useState<VehicleCategoryFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VehicleCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager', 'operator'].includes(profile.role) : false;

  async function loadCategories() {
    setCategories(await api.get<VehicleCategory[]>('/vehicle-categories'));
  }

  useEffect(() => {
    async function hydrate() {
      try {
        await loadCategories();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load vehicle categories.');
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

  function startEdit(category: VehicleCategory) {
    setEditingId(category.id);
    setFormState({
      name: category.name,
      description: category.description ?? '',
      is_active: category.is_active,
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
        description: formState.description || null,
      };

      if (editingId) {
        await api.put(`/vehicle-categories/${editingId}`, payload);
      } else {
        await api.post('/vehicle-categories', payload);
      }

      await loadCategories();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save vehicle category.');
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
      await api.delete(`/vehicle-categories/${deleteTarget.id}`);
      if (editingId === deleteTarget.id) {
        closeModal();
      }
      setDeleteTarget(null);
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete vehicle category.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading vehicle categories...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Vehicle Categories</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">GT vehicle category master</h2>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
          >
            Add Category
          </button>
        ) : null}
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {categories.map((category) => {
          const rowBusy = deletingId === category.id;

          return (
            <article key={category.id} className="rounded-3xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">GT Category</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">{category.name}</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {category.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="mt-4 text-sm text-slate-600">{category.description || 'No description added.'}</p>
              <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-slate-500">Linked Vehicles</dt>
                  <dd>{category.vehicle_count ?? 0}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Status</dt>
                  <dd>{category.is_active ? 'Ready to use' : 'Hidden from new assignments'}</dd>
                </div>
              </dl>
              {canManage ? (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => startEdit(category)}
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60"
                  >
                    Edit category
                  </button>
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => setDeleteTarget(category)}
                    className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={saving ? () => undefined : closeModal}
        title={editingId ? 'Edit Vehicle Category' : 'Add Vehicle Category'}
        size="md"
        closeOnBackdrop={!saving}
        closeOnEsc={!saving}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-800">
            Category Name
            <input
              value={formState.name}
              onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. CRYSTA"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            />
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            Description
            <input
              value={formState.description}
              onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
              placeholder="Short notes for operators"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={formState.is_active}
              onChange={(event) => setFormState((current) => ({ ...current, is_active: event.target.checked }))}
            />
            Active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} disabled={saving} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700 disabled:opacity-60">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update Category' : 'Create Category'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Vehicle Category"
        message={deleteTarget ? `Delete vehicle category ${deleteTarget.name}?` : ''}
        confirmLabel="Delete"
        loading={deleteTarget ? deletingId === deleteTarget.id : false}
      />
    </section>
  );
}
