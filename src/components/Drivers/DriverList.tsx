import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { Driver } from '../../lib/types';

interface DriverFormState {
  driver_code: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  license_number: string;
  license_expiry: string;
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
  is_active: true,
};

export function DriverList() {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [formState, setFormState] = useState<DriverFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager', 'operator'].includes(profile.role) : false;

  async function loadDrivers() {
    setDrivers(await api.get<Driver[]>('/drivers'));
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
      is_active: driver.is_active,
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
        email: formState.email || null,
        city: formState.city || null,
        state: formState.state || null,
      };

      if (editingId) {
        await api.put(`/drivers/${editingId}`, payload);
      } else {
        await api.post('/drivers', payload);
      }

      resetForm();
      await loadDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save driver.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading drivers...</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Drivers</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Driver roster</h2>
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {canManage ? (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-4">
          <input
            value={formState.driver_code}
            onChange={(event) => setFormState((current) => ({ ...current, driver_code: event.target.value }))}
            placeholder="Driver code"
            className="rounded-2xl border border-slate-300 px-4 py-3"
            required
          />
          <input
            value={formState.name}
            onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
            placeholder="Driver name"
            className="rounded-2xl border border-slate-300 px-4 py-3"
            required
          />
          <input
            value={formState.phone}
            onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
            placeholder="Phone"
            className="rounded-2xl border border-slate-300 px-4 py-3"
            required
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
          <input
            value={formState.license_number}
            onChange={(event) => setFormState((current) => ({ ...current, license_number: event.target.value }))}
            placeholder="License number"
            className="rounded-2xl border border-slate-300 px-4 py-3"
            required
          />
          <div className="flex gap-3">
            <input
              type="date"
              value={formState.license_expiry}
              onChange={(event) => setFormState((current) => ({ ...current, license_expiry: event.target.value }))}
              className="flex-1 rounded-2xl border border-slate-300 px-4 py-3"
              required
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
      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">License</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3">Status</th>
              {canManage ? <th className="px-4 py-3">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {drivers.map((driver) => (
              <tr key={driver.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{driver.driver_code}</td>
                <td className="px-4 py-3">{driver.name}</td>
                <td className="px-4 py-3">{driver.phone}</td>
                <td className="px-4 py-3">
                  {driver.city ?? '-'}, {driver.state ?? '-'}
                </td>
                <td className="px-4 py-3">{driver.license_number}</td>
                <td className="px-4 py-3">{formatDate(driver.license_expiry)}</td>
                <td className="px-4 py-3">{driver.is_active ? 'Active' : 'Inactive'}</td>
                {canManage ? (
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => startEdit(driver)}
                      className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Edit
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
