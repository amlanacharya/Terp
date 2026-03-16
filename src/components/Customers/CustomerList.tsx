import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { Customer } from '../../lib/types';

interface CustomerFormState {
  customer_code: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  credit_limit: string;
  credit_days: string;
  is_active: boolean;
}

const initialForm: CustomerFormState = {
  customer_code: '',
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  city: '',
  state: '',
  credit_limit: '0',
  credit_days: '0',
  is_active: true,
};

export function CustomerList() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formState, setFormState] = useState<CustomerFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager'].includes(profile.role) : false;

  async function loadCustomers() {
    setCustomers(await api.get<Customer[]>('/customers'));
  }

  useEffect(() => {
    async function hydrate() {
      try {
        await loadCustomers();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load customers.');
      } finally {
        setLoading(false);
      }
    }

    void hydrate();
  }, []);

  function startEdit(customer: Customer) {
    setEditingId(customer.id);
    setFormState({
      customer_code: customer.customer_code,
      name: customer.name,
      contact_person: customer.contact_person ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      city: customer.city ?? '',
      state: customer.state ?? '',
      credit_limit: String(customer.credit_limit ?? 0),
      credit_days: String(customer.credit_days ?? 0),
      is_active: customer.is_active,
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
        credit_limit: Number(formState.credit_limit),
        credit_days: Number(formState.credit_days),
      };

      if (editingId) {
        await api.put(`/customers/${editingId}`, payload);
      } else {
        await api.post('/customers', payload);
      }

      resetForm();
      await loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save customer.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customer: Customer) {
    const confirmed = window.confirm(`Delete customer ${customer.name}?`);
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await api.delete(`/customers/${customer.id}`);
      if (editingId === customer.id) {
        resetForm();
      }
      await loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete customer.');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading customers...</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Customers</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Customer accounts</h2>
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {canManage ? (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-4">
          <input value={formState.customer_code} onChange={(event) => setFormState((current) => ({ ...current, customer_code: event.target.value }))} placeholder="Customer code" className="rounded-2xl border border-slate-300 px-4 py-3" required />
          <input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} placeholder="Customer name" className="rounded-2xl border border-slate-300 px-4 py-3" required />
          <input value={formState.contact_person} onChange={(event) => setFormState((current) => ({ ...current, contact_person: event.target.value }))} placeholder="Contact person" className="rounded-2xl border border-slate-300 px-4 py-3" />
          <input value={formState.phone} onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" className="rounded-2xl border border-slate-300 px-4 py-3" />
          <input value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} placeholder="Email" type="email" className="rounded-2xl border border-slate-300 px-4 py-3" />
          <input value={formState.city} onChange={(event) => setFormState((current) => ({ ...current, city: event.target.value }))} placeholder="City" className="rounded-2xl border border-slate-300 px-4 py-3" />
          <input value={formState.state} onChange={(event) => setFormState((current) => ({ ...current, state: event.target.value }))} placeholder="State" className="rounded-2xl border border-slate-300 px-4 py-3" />
          <div className="flex gap-3">
            <input value={formState.credit_limit} onChange={(event) => setFormState((current) => ({ ...current, credit_limit: event.target.value }))} placeholder="Credit limit" type="number" min="0" className="flex-1 rounded-2xl border border-slate-300 px-4 py-3" />
            <input value={formState.credit_days} onChange={(event) => setFormState((current) => ({ ...current, credit_days: event.target.value }))} placeholder="Days" type="number" min="0" className="w-28 rounded-2xl border border-slate-300 px-4 py-3" />
            <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update' : 'Add'}</button>
            {editingId ? <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700">Cancel</button> : null}
          </div>
        </form>
      ) : null}
      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Credit Limit</th>
              <th className="px-4 py-3">Credit Days</th>
              {canManage ? <th className="px-4 py-3">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{customer.customer_code}</td>
                <td className="px-4 py-3">{customer.name}</td>
                <td className="px-4 py-3">
                  <div>{customer.contact_person ?? '-'}</div>
                  <div className="text-xs text-slate-500">{customer.phone ?? '-'}</div>
                </td>
                <td className="px-4 py-3">
                  {customer.city ?? '-'}, {customer.state ?? '-'}
                </td>
                <td className="px-4 py-3">{formatCurrency(customer.credit_limit)}</td>
                <td className="px-4 py-3">{customer.credit_days}</td>
                {canManage ? (
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => startEdit(customer)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Edit</button>
                    <button type="button" onClick={() => void handleDelete(customer)} className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">Delete</button>
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
