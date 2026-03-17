import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { TaxApplicationScope, TaxComponent } from '../../lib/types';

interface TaxComponentFormState {
  component_code: string;
  name: string;
  mode: 'percentage' | 'flat';
  rate: string;
  flat_amount: string;
  applies_to: TaxApplicationScope;
  hsn_code: string;
  sort_order: string;
  is_active: boolean;
}

const initialForm: TaxComponentFormState = {
  component_code: '',
  name: '',
  mode: 'percentage',
  rate: '',
  flat_amount: '',
  applies_to: 'all',
  hsn_code: '',
  sort_order: '0',
  is_active: true,
};

export function TaxComponentList() {
  const [components, setComponents] = useState<TaxComponent[]>([]);
  const [formState, setFormState] = useState<TaxComponentFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadComponents() {
    const rows = await api.get<TaxComponent[]>('/tax-components?include_inactive=true');
    setComponents(rows);
  }

  useEffect(() => {
    async function hydrate() {
      try {
        await loadComponents();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load tax components.');
      } finally {
        setLoading(false);
      }
    }

    void hydrate();
  }, []);

  function resetForm() {
    setEditingId(null);
    setFormState(initialForm);
  }

  function startEdit(component: TaxComponent) {
    setEditingId(component.id);
    setFormState({
      component_code: component.component_code,
      name: component.name,
      mode: component.is_percentage ? 'percentage' : 'flat',
      rate: component.rate == null ? '' : String(component.rate),
      flat_amount: component.flat_amount == null ? '' : String(component.flat_amount),
      applies_to: component.applies_to,
      hsn_code: component.hsn_code ?? '',
      sort_order: String(component.sort_order),
      is_active: component.is_active,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        component_code: formState.component_code,
        name: formState.name,
        is_percentage: formState.mode === 'percentage',
        rate: formState.mode === 'percentage' ? Number(formState.rate) : null,
        flat_amount: formState.mode === 'flat' ? Number(formState.flat_amount) : null,
        applies_to: formState.applies_to,
        hsn_code: formState.hsn_code || null,
        sort_order: Number(formState.sort_order || 0),
        is_active: formState.is_active,
      };

      if (editingId) {
        await api.put(`/tax-components/${editingId}`, payload);
      } else {
        await api.post('/tax-components', payload);
      }

      await loadComponents();
      resetForm();
      setNotice(editingId ? 'Tax component updated.' : 'Tax component created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save tax component.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(component: TaxComponent) {
    if (!window.confirm(`Delete tax component ${component.component_code}?`)) {
      return;
    }

    try {
      setError('');
      setNotice('');
      await api.delete(`/tax-components/${component.id}`);
      if (editingId === component.id) {
        resetForm();
      }
      await loadComponents();
      setNotice('Tax component deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete tax component.');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading tax components...</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Tax Config</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Dynamic tax components</h2>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{notice}</div> : null}

      <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-4">
        <label className="text-sm font-semibold text-slate-800">
          Component Code
          <input
            value={formState.component_code}
            onChange={(event) => setFormState((current) => ({ ...current, component_code: event.target.value.toUpperCase() }))}
            placeholder="CGST"
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            required
          />
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Display Name
          <input
            value={formState.name}
            onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
            placeholder="Central GST"
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            required
          />
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Mode
          <select
            value={formState.mode}
            onChange={(event) => setFormState((current) => ({ ...current, mode: event.target.value as 'percentage' | 'flat' }))}
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
          >
            <option value="percentage">Percentage</option>
            <option value="flat">Flat Amount</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Scope
          <select
            value={formState.applies_to}
            onChange={(event) => setFormState((current) => ({ ...current, applies_to: event.target.value as TaxApplicationScope }))}
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
          >
            <option value="all">All</option>
            <option value="intra_state">Intra-State</option>
            <option value="inter_state">Inter-State</option>
          </select>
        </label>
        {formState.mode === 'percentage' ? (
          <label className="text-sm font-semibold text-slate-800">
            Rate (%)
            <input
              type="number"
              min="0"
              step="0.0001"
              value={formState.rate}
              onChange={(event) => setFormState((current) => ({ ...current, rate: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            />
          </label>
        ) : (
          <label className="text-sm font-semibold text-slate-800">
            Flat Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={formState.flat_amount}
              onChange={(event) => setFormState((current) => ({ ...current, flat_amount: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            />
          </label>
        )}
        <label className="text-sm font-semibold text-slate-800">
          HSN Code
          <input
            value={formState.hsn_code}
            onChange={(event) => setFormState((current) => ({ ...current, hsn_code: event.target.value }))}
            placeholder="9964 or blank"
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Sort Order
          <input
            type="number"
            value={formState.sort_order}
            onChange={(event) => setFormState((current) => ({ ...current, sort_order: event.target.value }))}
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
        <div className="flex gap-3">
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

      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">HSN</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {components.map((component) => (
              <tr key={component.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{component.component_code}</td>
                <td className="px-4 py-3">{component.name}</td>
                <td className="px-4 py-3">{component.is_percentage ? 'Percentage' : 'Flat'}</td>
                <td className="px-4 py-3">{component.is_percentage ? `${component.rate ?? 0}%` : `Rs. ${component.flat_amount ?? 0}`}</td>
                <td className="px-4 py-3">{component.applies_to}</td>
                <td className="px-4 py-3">{component.hsn_code ?? 'All'}</td>
                <td className="px-4 py-3">{component.sort_order}</td>
                <td className="px-4 py-3">{component.is_active ? 'Active' : 'Inactive'}</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => startEdit(component)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                    Edit
                  </button>
                  <button type="button" onClick={() => void handleDelete(component)} className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {components.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  No tax components configured.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
