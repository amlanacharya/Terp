import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Owner } from '../../lib/types';

interface OwnerFormState {
  code: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  gstin: string;
  is_active: boolean;
}

const initialForm: OwnerFormState = {
  code: '',
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  city: '',
  state: '',
  gstin: '',
  is_active: true,
};

export function OwnerList() {
  const { profile } = useAuth();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [formState, setFormState] = useState<OwnerFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager'].includes(profile.role) : false;

  async function loadOwners() {
    setOwners(await api.get<Owner[]>('/owners'));
  }

  useEffect(() => {
    async function hydrate() {
      try {
        await loadOwners();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load owners.');
      } finally {
        setLoading(false);
      }
    }

    void hydrate();
  }, []);

  function startEdit(owner: Owner) {
    setEditingId(owner.id);
    setFormState({
      code: owner.code,
      name: owner.name,
      contact_person: owner.contact_person ?? '',
      phone: owner.phone ?? '',
      email: owner.email ?? '',
      city: owner.city ?? '',
      state: owner.state ?? '',
      gstin: owner.gstin ?? '',
      is_active: owner.is_active,
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
        contact_person: formState.contact_person || null,
        phone: formState.phone || null,
        email: formState.email || null,
        city: formState.city || null,
        state: formState.state || null,
        gstin: formState.gstin || null,
      };

      if (editingId) {
        await api.put(`/owners/${editingId}`, payload);
      } else {
        await api.post('/owners', payload);
      }

      resetForm();
      await loadOwners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save owner.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading owners...</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Owners</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Owner and vendor master</h2>
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {canManage ? (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-4">
          <input
            value={formState.code}
            onChange={(event) => setFormState((current) => ({ ...current, code: event.target.value }))}
            placeholder="Owner code"
            className="rounded-2xl border border-slate-300 px-4 py-3"
            required
          />
          <input
            value={formState.name}
            onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
            placeholder="Owner name"
            className="rounded-2xl border border-slate-300 px-4 py-3"
            required
          />
          <input
            value={formState.contact_person}
            onChange={(event) => setFormState((current) => ({ ...current, contact_person: event.target.value }))}
            placeholder="Contact person"
            className="rounded-2xl border border-slate-300 px-4 py-3"
          />
          <input
            value={formState.phone}
            onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
            placeholder="Phone"
            className="rounded-2xl border border-slate-300 px-4 py-3"
          />
          <input
            value={formState.email}
            onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
            placeholder="Email"
            type="email"
            className="rounded-2xl border border-slate-300 px-4 py-3"
          />
          <input
            value={formState.city}
            onChange={(event) => setFormState((current) => ({ ...current, city: event.target.value }))}
            placeholder="City"
            className="rounded-2xl border border-slate-300 px-4 py-3"
          />
          <input
            value={formState.state}
            onChange={(event) => setFormState((current) => ({ ...current, state: event.target.value }))}
            placeholder="State"
            className="rounded-2xl border border-slate-300 px-4 py-3"
          />
          <div className="flex gap-3">
            <input
              value={formState.gstin}
              onChange={(event) => setFormState((current) => ({ ...current, gstin: event.target.value }))}
              placeholder="GSTIN"
              className="flex-1 rounded-2xl border border-slate-300 px-4 py-3"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
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
      <div className="grid gap-4 xl:grid-cols-2">
        {owners.map((owner) => (
          <article key={owner.id} className="rounded-3xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{owner.code}</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{owner.name}</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {owner.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            {canManage ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => startEdit(owner)}
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  Edit owner
                </button>
              </div>
            ) : null}
            <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-slate-500">Contact</dt>
                <dd>{owner.contact_person ?? '-'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Phone</dt>
                <dd>{owner.phone ?? '-'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Location</dt>
                <dd>
                  {owner.city ?? '-'}, {owner.state ?? '-'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">GSTIN</dt>
                <dd>{owner.gstin ?? '-'}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
