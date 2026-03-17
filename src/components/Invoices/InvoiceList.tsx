import { FormEvent, useEffect, useState } from 'react';
import { api, downloadBlob } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { Customer, GstRate, Invoice } from '../../lib/types';

interface InvoiceFormState {
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  subtotal: string;
  cgst_amount: string;
  sgst_amount: string;
  igst_amount: string;
  total_amount: string;
  due_date: string;
  payment_status: string;
  is_inter_state: boolean;
}

const initialForm: InvoiceFormState = {
  invoice_number: '',
  invoice_date: '',
  customer_id: '',
  subtotal: '',
  cgst_amount: '0',
  sgst_amount: '0',
  igst_amount: '0',
  total_amount: '0',
  due_date: '',
  payment_status: 'pending',
  is_inter_state: false,
};

function roundCurrency(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function InvoiceList() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [gstRates, setGstRates] = useState<GstRate[]>([]);
  const [formState, setFormState] = useState<InvoiceFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager', 'accountant'].includes(profile.role) : false;

  async function loadInvoices() {
    const [invoiceRows, customerRows, gstRateRows] = await Promise.all([
      api.get<Invoice[]>('/invoices'),
      api.get<Customer[]>('/customers'),
      api.get<GstRate[]>('/gst/rates'),
    ]);
    setInvoices(invoiceRows);
    setCustomers(customerRows);
    setGstRates(gstRateRows);
  }

  function applyGst(subtotalInput: string, isInterState: boolean) {
    const subtotal = Number(subtotalInput || 0);
    const primaryRate = gstRates[0];
    const cgstRate = Number(primaryRate?.cgst_rate ?? 2.5);
    const sgstRate = Number(primaryRate?.sgst_rate ?? 2.5);
    const igstRate = Number(primaryRate?.igst_rate ?? 5);
    const cgstAmount = isInterState ? 0 : (subtotal * cgstRate) / 100;
    const sgstAmount = isInterState ? 0 : (subtotal * sgstRate) / 100;
    const igstAmount = isInterState ? (subtotal * igstRate) / 100 : 0;
    const totalAmount = subtotal + cgstAmount + sgstAmount + igstAmount;

    setFormState((current) => ({
      ...current,
      subtotal: subtotalInput,
      cgst_amount: roundCurrency(cgstAmount),
      sgst_amount: roundCurrency(sgstAmount),
      igst_amount: roundCurrency(igstAmount),
      total_amount: roundCurrency(totalAmount),
    }));
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
    if (invoice.source_type && invoice.source_type !== 'manual') {
      return;
    }

    setEditingId(invoice.id);
    setFormState({
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date?.slice(0, 10) ?? '',
      customer_id: invoice.customer.id,
      subtotal: String(invoice.subtotal),
      cgst_amount: String(invoice.cgst_amount ?? 0),
      sgst_amount: String(invoice.sgst_amount ?? 0),
      igst_amount: String(invoice.igst_amount ?? 0),
      total_amount: String(invoice.total_amount),
      due_date: invoice.due_date?.slice(0, 10) ?? '',
      payment_status: invoice.payment_status,
      is_inter_state: Number(invoice.igst_amount ?? 0) > 0,
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
        cgst_amount: Number(formState.cgst_amount),
        sgst_amount: Number(formState.sgst_amount),
        igst_amount: Number(formState.igst_amount),
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

  async function handleDelete(invoice: Invoice) {
    const confirmed = window.confirm(`Delete invoice ${invoice.invoice_number}?`);
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await api.delete(`/invoices/${invoice.id}`);
      if (editingId === invoice.id) {
        resetForm();
      }
      await loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete invoice.');
    }
  }

  async function handleDownloadPdf(invoice: Invoice) {
    try {
      setError('');
      const blob = await downloadBlob(`/invoices/${invoice.id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download invoice PDF.');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading invoices...</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Customer Invoices</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Customer billing register</h2>
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {canManage ? <p className="text-sm text-slate-500">Use this form only for legacy manual invoices. GT trip and annexure invoices should be created from the Trips or Annexures screens.</p> : null}
      {canManage ? (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-4">
          <label className="text-sm font-semibold text-slate-800">
            Invoice Number
            <input value={formState.invoice_number} onChange={(event) => setFormState((current) => ({ ...current, invoice_number: event.target.value }))} placeholder="Invoice number, e.g. INV-00045" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Invoice Date
            <input type="date" value={formState.invoice_date} onChange={(event) => setFormState((current) => ({ ...current, invoice_date: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Customer
            <select value={formState.customer_id} onChange={(event) => setFormState((current) => ({ ...current, customer_id: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required>
              <option value="">Select billed customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Subtotal
            <input value={formState.subtotal} onChange={(event) => applyGst(event.target.value, formState.is_inter_state)} placeholder="Subtotal in INR, e.g. 25000" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={formState.is_inter_state}
              onChange={(event) => {
                const checked = event.target.checked;
                setFormState((current) => ({ ...current, is_inter_state: checked }));
                applyGst(formState.subtotal, checked);
              }}
            />
            Inter-state invoice
          </label>
          <label className="text-sm font-semibold text-slate-800">
            CGST
            <input value={formState.cgst_amount} readOnly className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            SGST
            <input value={formState.sgst_amount} readOnly className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            IGST
            <input value={formState.igst_amount} readOnly className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Grand Total
            <input value={formState.total_amount} readOnly className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Due Date
            <input type="date" value={formState.due_date} onChange={(event) => setFormState((current) => ({ ...current, due_date: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Payment Status
            <select value={formState.payment_status} onChange={(event) => setFormState((current) => ({ ...current, payment_status: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
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
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Duty Slip</th>
              <th className="px-4 py-3">Journey</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">PDF</th>
              {canManage ? <th className="px-4 py-3">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{invoice.invoice_number}</td>
                <td className="px-4 py-3">{invoice.customer.name}</td>
                <td className="px-4 py-3">{invoice.source_type ?? 'manual'}</td>
                <td className="px-4 py-3">{invoice.duty_slip_number ?? '-'}</td>
                <td className="px-4 py-3">{invoice.nature_of_journey ?? invoice.duty_type_label ?? '-'}</td>
                <td className="px-4 py-3">{formatDate(invoice.invoice_date)}</td>
                <td className="px-4 py-3">{formatDate(invoice.due_date)}</td>
                <td className="px-4 py-3">{invoice.payment_status}</td>
                <td className="px-4 py-3">{formatCurrency(invoice.total_amount)}</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => void handleDownloadPdf(invoice)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                    PDF
                  </button>
                </td>
                {canManage ? (
                  <td className="px-4 py-3">
                    {invoice.source_type === 'manual' || !invoice.source_type ? <button type="button" onClick={() => startEdit(invoice)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Edit</button> : null}
                    <button type="button" onClick={() => void handleDelete(invoice)} className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">Delete</button>
                  </td>
                ) : null}
              </tr>
            ))}
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 11 : 10} className="px-4 py-6 text-center text-slate-500">
                  No invoices available.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
