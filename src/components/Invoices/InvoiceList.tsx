import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { Customer, Invoice } from '../../lib/types';

interface InvoiceFormState {
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  subtotal: string;
  total_amount: string;
  due_date: string;
  payment_status: string;
}

const initialForm: InvoiceFormState = {
  invoice_number: '',
  invoice_date: '',
  customer_id: '',
  subtotal: '',
  total_amount: '',
  due_date: '',
  payment_status: 'pending',
};

export function InvoiceList() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formState, setFormState] = useState<InvoiceFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager', 'accountant'].includes(profile.role) : false;

  async function loadInvoices() {
    const [invoiceRows, customerRows] = await Promise.all([
      api.get<Invoice[]>('/invoices'),
      api.get<Customer[]>('/customers'),
    ]);
    setInvoices(invoiceRows);
    setCustomers(customerRows);
  }

  useEffect(() => {
    async function hydrate() {
      try {
        await loadInvoices();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load invoices.');
      } finally {
        setLoading(false);
      }
    }

    void hydrate();
  }, []);

  function startEdit(invoice: Invoice) {
    setEditingId(invoice.id);
    setFormState({
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date?.slice(0, 10) ?? '',
      customer_id: invoice.customer.id,
      subtotal: String(invoice.subtotal),
      total_amount: String(invoice.total_amount),
      due_date: invoice.due_date?.slice(0, 10) ?? '',
      payment_status: invoice.payment_status,
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
        subtotal: Number(formState.subtotal),
        total_amount: Number(formState.total_amount),
        due_date: formState.due_date || null,
      };

      if (editingId) {
        await api.put(`/invoices/${editingId}`, payload);
      } else {
        await api.post('/invoices', payload);
      }

      resetForm();
      await loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save invoice.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading invoices...</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Invoices</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Billing register</h2>
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {canManage ? (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-4">
          <input value={formState.invoice_number} onChange={(event) => setFormState((current) => ({ ...current, invoice_number: event.target.value }))} placeholder="Invoice number" className="rounded-2xl border border-slate-300 px-4 py-3" required />
          <input type="date" value={formState.invoice_date} onChange={(event) => setFormState((current) => ({ ...current, invoice_date: event.target.value }))} className="rounded-2xl border border-slate-300 px-4 py-3" required />
          <select value={formState.customer_id} onChange={(event) => setFormState((current) => ({ ...current, customer_id: event.target.value }))} className="rounded-2xl border border-slate-300 px-4 py-3" required>
            <option value="">Select customer</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
          <input value={formState.subtotal} onChange={(event) => setFormState((current) => ({ ...current, subtotal: event.target.value }))} placeholder="Subtotal" type="number" min="0" className="rounded-2xl border border-slate-300 px-4 py-3" required />
          <input value={formState.total_amount} onChange={(event) => setFormState((current) => ({ ...current, total_amount: event.target.value }))} placeholder="Total amount" type="number" min="0" className="rounded-2xl border border-slate-300 px-4 py-3" required />
          <input type="date" value={formState.due_date} onChange={(event) => setFormState((current) => ({ ...current, due_date: event.target.value }))} className="rounded-2xl border border-slate-300 px-4 py-3" />
          <select value={formState.payment_status} onChange={(event) => setFormState((current) => ({ ...current, payment_status: event.target.value }))} className="rounded-2xl border border-slate-300 px-4 py-3">
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update' : 'Add'}</button>
            {editingId ? <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700">Cancel</button> : null}
          </div>
        </form>
      ) : null}
      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Amount</th>
              {canManage ? <th className="px-4 py-3">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{invoice.invoice_number}</td>
                <td className="px-4 py-3">{invoice.customer.name}</td>
                <td className="px-4 py-3">{formatDate(invoice.invoice_date)}</td>
                <td className="px-4 py-3">{formatDate(invoice.due_date)}</td>
                <td className="px-4 py-3">{invoice.payment_status}</td>
                <td className="px-4 py-3">{formatCurrency(invoice.total_amount)}</td>
                {canManage ? <td className="px-4 py-3"><button type="button" onClick={() => startEdit(invoice)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Edit</button></td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
