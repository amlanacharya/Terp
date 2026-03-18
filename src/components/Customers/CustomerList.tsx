import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { Customer, InvoicePdfMode } from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';

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
  default_duty_start_time: string;
  default_duty_end_time: string;
  default_duty_hours: string;
  invoice_pdf_mode: InvoicePdfMode;
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
  default_duty_start_time: '',
  default_duty_end_time: '',
  default_duty_hours: '',
  invoice_pdf_mode: 'invoice_with_annexures',
  is_active: true,
};

function toTimeInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '';
}

function formatDutyTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '-';
}

function formatInvoicePdfMode(value: InvoicePdfMode): string {
  return value === 'invoice_with_annexures' ? 'Invoice + Annexures' : 'Invoice Only';
}

export function CustomerList() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formState, setFormState] = useState<CustomerFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  function openCreate() {
    setEditingId(null);
    setFormState(initialForm);
    setIsModalOpen(true);
  }

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
      default_duty_start_time: toTimeInputValue(customer.default_duty_start_time),
      default_duty_end_time: toTimeInputValue(customer.default_duty_end_time),
      default_duty_hours: customer.default_duty_hours == null ? '' : String(customer.default_duty_hours),
      invoice_pdf_mode: customer.invoice_pdf_mode,
      is_active: customer.is_active,
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
        contact_person: formState.contact_person || null,
        phone: formState.phone || null,
        email: formState.email || null,
        city: formState.city || null,
        state: formState.state || null,
        credit_limit: Number(formState.credit_limit),
        credit_days: Number(formState.credit_days),
        default_duty_start_time: formState.default_duty_start_time || null,
        default_duty_end_time: formState.default_duty_end_time || null,
        default_duty_hours: formState.default_duty_hours === '' ? null : Number(formState.default_duty_hours),
      };

      if (editingId) {
        await api.put(`/customers/${editingId}`, payload);
      } else {
        await api.post('/customers', payload);
      }

      await loadCustomers();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save customer.');
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
      await api.delete(`/customers/${deleteTarget.id}`);
      if (editingId === deleteTarget.id) {
        closeModal();
      }
      setDeleteTarget(null);
      await loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete customer.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading customers...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Customers</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Customer accounts</h2>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
          >
            Add Customer
          </button>
        ) : null}
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      <div className="overflow-x-auto rounded-3xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Credit Limit</th>
              <th className="px-4 py-3">Credit Days</th>
              <th className="px-4 py-3">Duty Defaults</th>
              <th className="px-4 py-3">Invoice PDF</th>
              {canManage ? <th className="px-4 py-3">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {customers.map((customer) => {
              const rowBusy = deletingId === customer.id;

              return (
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
                  <td className="px-4 py-3">
                    <div>
                      {customer.default_duty_start_time || customer.default_duty_end_time
                        ? `${formatDutyTime(customer.default_duty_start_time)} to ${formatDutyTime(customer.default_duty_end_time)}`
                        : '-'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {customer.default_duty_hours == null ? 'Hours not set' : `${customer.default_duty_hours} hrs`}
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatInvoicePdfMode(customer.invoice_pdf_mode)}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <button type="button" disabled={rowBusy} onClick={() => startEdit(customer)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60">Edit</button>
                      <button type="button" disabled={rowBusy} onClick={() => setDeleteTarget(customer)} className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-60">Delete</button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={saving ? () => undefined : closeModal}
        title={editingId ? 'Edit Customer' : 'Add Customer'}
        size="lg"
        closeOnBackdrop={!saving}
        closeOnEsc={!saving}
      >
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-semibold text-slate-800">
            Customer Code
            <input value={formState.customer_code} onChange={(event) => setFormState((current) => ({ ...current, customer_code: event.target.value }))} placeholder="Customer code, e.g. CUST-001" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Customer Name
            <input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} placeholder="Customer name, e.g. Acme Logistics" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Contact Person
            <input value={formState.contact_person} onChange={(event) => setFormState((current) => ({ ...current, contact_person: event.target.value }))} placeholder="Contact person, e.g. Rajesh Shah" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Phone Number
            <input value={formState.phone} onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number, e.g. 9876543210" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Billing Email
            <input value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} placeholder="Billing email, e.g. accounts@client.com" type="email" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            City
            <input value={formState.city} onChange={(event) => setFormState((current) => ({ ...current, city: event.target.value }))} placeholder="City, e.g. Bhubaneswar" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            State
            <input value={formState.state} onChange={(event) => setFormState((current) => ({ ...current, state: event.target.value }))} placeholder="State, e.g. Odisha" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Credit Limit
            <input value={formState.credit_limit} onChange={(event) => setFormState((current) => ({ ...current, credit_limit: event.target.value }))} placeholder="Credit limit in INR" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Credit Days
            <input value={formState.credit_days} onChange={(event) => setFormState((current) => ({ ...current, credit_days: event.target.value }))} placeholder="Days, e.g. 30" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Default Duty Start Time
            <input type="time" value={formState.default_duty_start_time} onChange={(event) => setFormState((current) => ({ ...current, default_duty_start_time: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Default Duty End Time
            <input type="time" value={formState.default_duty_end_time} onChange={(event) => setFormState((current) => ({ ...current, default_duty_end_time: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Default Duty Hours
            <input value={formState.default_duty_hours} onChange={(event) => setFormState((current) => ({ ...current, default_duty_hours: event.target.value }))} placeholder="e.g. 8.5" type="number" min="0" step="0.25" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Annexure Invoice PDF
            <select value={formState.invoice_pdf_mode} onChange={(event) => setFormState((current) => ({ ...current, invoice_pdf_mode: event.target.value as InvoicePdfMode }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
              <option value="invoice_with_annexures">Invoice + Annexures</option>
              <option value="invoice_only">Invoice Only</option>
            </select>
          </label>
          <div className="lg:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} disabled={saving} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700 disabled:opacity-60">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update Customer' : 'Create Customer'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Customer"
        message={deleteTarget ? `Delete customer ${deleteTarget.name}?` : ''}
        confirmLabel="Delete"
        loading={deleteTarget ? deletingId === deleteTarget.id : false}
      />
    </section>
  );
}
