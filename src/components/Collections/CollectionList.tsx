import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { Collection, Invoice } from '../../lib/types';

interface CollectionFormState {
  collection_number: string;
  collection_date: string;
  invoice_id: string;
  amount: string;
  payment_mode: string;
  reference_number: string;
  bank_name: string;
}

const initialForm: CollectionFormState = {
  collection_number: '',
  collection_date: '',
  invoice_id: '',
  amount: '',
  payment_mode: 'bank_transfer',
  reference_number: '',
  bank_name: '',
};

export function CollectionList() {
  const { profile } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [formState, setFormState] = useState<CollectionFormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager', 'accountant'].includes(profile.role) : false;

  async function loadCollections() {
    setCollections(await api.get<Collection[]>('/collections'));
  }

  useEffect(() => {
    async function hydrate() {
      try {
        const [collectionRows, invoiceRows] = await Promise.all([
          api.get<Collection[]>('/collections'),
          api.get<Invoice[]>('/invoices'),
        ]);
        setCollections(collectionRows);
        setInvoices(invoiceRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load collections.');
      } finally {
        setLoading(false);
      }
    }

    void hydrate();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api.post('/collections', {
        ...formState,
        amount: Number(formState.amount),
        reference_number: formState.reference_number || null,
        bank_name: formState.bank_name || null,
      });
      setFormState(initialForm);
      await loadCollections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record collection.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(collection: Collection) {
    const confirmed = window.confirm(`Delete collection ${collection.collection_number}?`);
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await api.delete(`/collections/${collection.id}`);
      await loadCollections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete collection.');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading collections...</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Payment Receipts</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Receipt register</h2>
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {canManage ? (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-4">
          <label className="text-sm font-semibold text-slate-800">
            Receipt Number
            <input
              value={formState.collection_number}
              onChange={(event) => setFormState((current) => ({ ...current, collection_number: event.target.value }))}
              placeholder="Receipt number, e.g. RCPT-00021"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Receipt Date
            <input
              type="date"
              value={formState.collection_date}
              onChange={(event) => setFormState((current) => ({ ...current, collection_date: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              placeholder="Receipt date"
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Customer Invoice
            <select
              value={formState.invoice_id}
              onChange={(event) => setFormState((current) => ({ ...current, invoice_id: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            >
              <option value="">Select invoice to receive payment against</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} - {invoice.customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Amount Received
            <input
              value={formState.amount}
              onChange={(event) => setFormState((current) => ({ ...current, amount: event.target.value }))}
              placeholder="Amount received in INR, e.g. 15000"
              type="number"
              min="0"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Payment Mode
            <select
              value={formState.payment_mode}
              onChange={(event) => setFormState((current) => ({ ...current, payment_mode: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            >
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Reference Number
            <input
              value={formState.reference_number}
              onChange={(event) => setFormState((current) => ({ ...current, reference_number: event.target.value }))}
              placeholder="UTR / cheque no. / transaction ref."
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Bank Name
            <input
              value={formState.bank_name}
              onChange={(event) => setFormState((current) => ({ ...current, bank_name: event.target.value }))}
              placeholder="Bank name, e.g. HDFC Bank"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Record payment'}
          </button>
        </form>
      ) : null}
      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Collection</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Amount</th>
              {canManage ? <th className="px-4 py-3">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {collections.map((collection) => (
              <tr key={collection.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{collection.collection_number}</td>
                <td className="px-4 py-3">{collection.invoice.invoice_number}</td>
                <td className="px-4 py-3">{collection.invoice.customer.name}</td>
                <td className="px-4 py-3">{formatDate(collection.collection_date)}</td>
                <td className="px-4 py-3">{collection.payment_mode}</td>
                <td className="px-4 py-3">{formatCurrency(collection.amount)}</td>
                {canManage ? (
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => void handleDelete(collection)} className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">
                      Delete
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
