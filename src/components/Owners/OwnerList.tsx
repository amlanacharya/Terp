import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Owner } from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';
import { IconBtn } from '../Layout/IconBtn';

interface OwnerFormState {
  code: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  pan: string;
  aadhar_number: string;
  bank_name: string;
  bank_account: string;
  ifsc_code: string;
  is_active: boolean;
}

const initialForm: OwnerFormState = {
  code: '',
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  gstin: '',
  pan: '',
  aadhar_number: '',
  bank_name: '',
  bank_account: '',
  ifsc_code: '',
  is_active: true,
};

export function OwnerList() {
  const { profile } = useAuth();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [formState, setFormState] = useState<OwnerFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<Owner | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Owner | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterCity, setFilterCity] = useState('');

  const canManage = profile ? ['admin', 'manager'].includes(profile.role) : false;

  const filteredOwners = useMemo(() => {
    let result = showInactive ? owners : owners.filter((owner) => owner.is_active !== false);
    if (filterName) {
      result = result.filter((o) => o.name.toLowerCase().includes(filterName.toLowerCase()));
    }
    if (filterCity) {
      result = result.filter((o) => (o.city ?? '').toLowerCase().includes(filterCity.toLowerCase()));
    }
    return result;
  }, [owners, showInactive, filterName, filterCity]);

  async function loadOwners() {
    setOwners(await api.get<Owner[]>('/owners'));
  }

  async function handleToggleActive(owner: Owner) {
    try {
      await api.put(`/owners/${owner.id}`, { ...owner, is_active: !owner.is_active });
      await loadOwners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status.');
    }
  }

  useEffect(() => {
    async function hydrate() {
      try {
        await loadOwners();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load vehicle owners.');
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

  function startEdit(owner: Owner) {
    setViewingItem(null);
    setEditingId(owner.id);
    setFormState({
      code: owner.code,
      name: owner.name,
      contact_person: owner.contact_person ?? '',
      phone: owner.phone ?? '',
      email: owner.email ?? '',
      address: owner.address ?? '',
      city: owner.city ?? '',
      state: owner.state ?? '',
      pincode: owner.pincode ?? '',
      gstin: owner.gstin ?? '',
      pan: owner.pan ?? '',
      aadhar_number: owner.aadhar_number ?? '',
      bank_name: owner.bank_name ?? '',
      bank_account: owner.bank_account ?? '',
      ifsc_code: owner.ifsc_code ?? '',
      is_active: owner.is_active,
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
        contact_person: formState.contact_person || null,
        phone: formState.phone || null,
        email: formState.email || null,
        address: formState.address || null,
        city: formState.city || null,
        state: formState.state || null,
        pincode: formState.pincode || null,
        gstin: formState.gstin || null,
        pan: formState.pan || null,
        aadhar_number: formState.aadhar_number || null,
        bank_name: formState.bank_name || null,
        bank_account: formState.bank_account || null,
        ifsc_code: formState.ifsc_code || null,
        is_active: formState.is_active,
      };

      if (editingId) {
        await api.put(`/owners/${editingId}`, payload);
      } else {
        await api.post('/owners', payload);
      }

      await loadOwners();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save vehicle owner.');
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
      await api.delete(`/owners/${deleteTarget.id}`);
      if (editingId === deleteTarget.id) {
        closeModal();
      }
      setDeleteTarget(null);
      await loadOwners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete vehicle owner.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading vehicle owners...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Vehicle Owners</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Vehicle owner master</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            Include Inactive
          </label>
          {canManage ? <button type="button" onClick={openCreate} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">Add Vehicle Owner</button> : null}
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
          type="text"
          placeholder="Search city..."
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
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
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOwners.map((owner, i) => (
              <tr key={owner.id} className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{owner.code}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setViewingItem(owner)}
                    className="font-medium text-slate-900 hover:text-blue-600 hover:underline cursor-pointer text-left"
                  >
                    {owner.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">{owner.contact_person ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{owner.phone ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{owner.city ?? '-'}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(owner)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        owner.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          owner.is_active ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  ) : (
                    <span className={owner.is_active ? 'text-emerald-600' : 'text-slate-400'}>
                      {owner.is_active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {canManage ? <IconBtn icon={Pencil} label="Edit" onClick={() => startEdit(owner)} /> : null}
                    {canManage ? <IconBtn icon={Trash2} label="Delete" variant="danger" onClick={() => setDeleteTarget(owner)} /> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!viewingItem && !editingId} onClose={() => setViewingItem(null)} title="View Vehicle Owner" size="lg">
        {viewingItem && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Owner Code</p>
              <p className="mt-1 text-slate-600">{viewingItem.code}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Owner Name</p>
              <p className="mt-1 text-slate-600">{viewingItem.name}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Phone</p>
              <p className="mt-1 text-slate-600">{viewingItem.phone ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Email</p>
              <p className="mt-1 text-slate-600">{viewingItem.email ?? '-'}</p>
            </div>
            <div className="text-sm lg:col-span-2">
              <p className="font-semibold text-slate-800">Address</p>
              <p className="mt-1 text-slate-600">{viewingItem.address ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">City</p>
              <p className="mt-1 text-slate-600">{viewingItem.city ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">State</p>
              <p className="mt-1 text-slate-600">{viewingItem.state ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Aadhaar Number</p>
              <p className="mt-1 text-slate-600">{viewingItem.aadhar_number ?? '-'}</p>
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

      <Modal isOpen={isModalOpen} onClose={saving ? () => undefined : closeModal} title={editingId ? 'Edit Vehicle Owner' : 'Add Vehicle Owner'} size="lg" closeOnBackdrop={!saving} closeOnEsc={!saving}>
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-semibold text-slate-800">Owner Code<input value={editingId ? formState.code : 'Auto-generated on save'} readOnly className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 font-normal text-slate-500" /></label>
          <label className="text-sm font-semibold text-slate-800">Owner Name<input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
          <label className="text-sm font-semibold text-slate-800">Contact Person<input value={formState.contact_person} onChange={(event) => setFormState((current) => ({ ...current, contact_person: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">Phone Number<input value={formState.phone} onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">Email<input value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} type="email" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">GSTIN<input value={formState.gstin} onChange={(event) => setFormState((current) => ({ ...current, gstin: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">PAN<input value={formState.pan} onChange={(event) => setFormState((current) => ({ ...current, pan: event.target.value.toUpperCase() }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">Aadhaar Number<input value={formState.aadhar_number} onChange={(event) => setFormState((current) => ({ ...current, aadhar_number: event.target.value }))} maxLength={12} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800 lg:col-span-2">Address<textarea value={formState.address} onChange={(event) => setFormState((current) => ({ ...current, address: event.target.value }))} rows={3} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">City<input value={formState.city} onChange={(event) => setFormState((current) => ({ ...current, city: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">State<input value={formState.state} onChange={(event) => setFormState((current) => ({ ...current, state: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">Pincode<input value={formState.pincode} onChange={(event) => setFormState((current) => ({ ...current, pincode: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">Bank Name<input value={formState.bank_name} onChange={(event) => setFormState((current) => ({ ...current, bank_name: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">Bank Account<input value={formState.bank_account} onChange={(event) => setFormState((current) => ({ ...current, bank_account: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">IFSC Code<input value={formState.ifsc_code} onChange={(event) => setFormState((current) => ({ ...current, ifsc_code: event.target.value.toUpperCase() }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 lg:col-span-2"><input type="checkbox" checked={formState.is_active} onChange={(event) => setFormState((current) => ({ ...current, is_active: event.target.checked }))} />Active vehicle owner</label>
          <div className="flex justify-end gap-3 pt-2 lg:col-span-2"><button type="button" onClick={closeModal} disabled={saving} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700 disabled:opacity-60">Cancel</button><button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update Vehicle Owner' : 'Create Vehicle Owner'}</button></div>
        </form>
      </Modal>

      <ConfirmModal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} title="Delete Vehicle Owner" message={deleteTarget ? `Delete vehicle owner ${deleteTarget.name}?` : ''} confirmLabel="Delete" loading={deleteTarget ? deletingId === deleteTarget.id : false} />
    </section>
  );
}
