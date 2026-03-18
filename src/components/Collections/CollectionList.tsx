import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { Collection, Invoice } from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager', 'accountant'].includes(profile.role) : false;
  const selectedInvoice = invoices.find((invoice) => invoice.id === formState.invoice_id) ?? null;
  const selectedDocumentIsCreditNote = selectedInvoice?.invoice_type === 'credit_note';

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

  function openCreate() {
    setFormState(initialForm);
    setIsModalOpen(true);
  }

  function closeModal() {
    setFormState(initialForm);
    setIsModalOpen(false);
  }

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
      await loadCollections();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record settlement.');
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
      await api.delete(`/collections/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadCollections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete settlement.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading collections...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Receipts & Refunds</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Settlement register</h2>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
          >
            Record Settlement
          </button>
        ) : null}
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Settlement</th>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Amount</th>
              {canManage ? <th className="px-4 py-3">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {collections.map((collection) => {
              const rowBusy = deletingId === collection.id;
              const isRefund = collection.invoice.invoice_type === 'credit_note';

              return (
                <tr key={collection.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div>{collection.collection_number}</div>
                    <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${isRefund ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {isRefund ? 'Refund' : 'Receipt'}
                    </div>
                  </td>
                  <td className="px-4 py-3">{collection.invoice.invoice_number}</td>
                  <td className="px-4 py-3">{collection.invoice.customer.name}</td>
                  <td className="px-4 py-3">{formatDate(collection.collection_date)}</td>
                  <td className="px-4 py-3">{collection.payment_mode}</td>
                  <td className="px-4 py-3">{formatCurrency(collection.amount)}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <button type="button" disabled={rowBusy} onClick={() => setDeleteTarget(collection)} className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-60">
                        Delete
                      </button>
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
        title={selectedDocumentIsCreditNote ? 'Record Refund' : 'Record Payment Receipt'}
        size="lg"
        closeOnBackdrop={!saving}
        closeOnEsc={!saving}
      >
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-semibold text-slate-800">
            {selectedDocumentIsCreditNote ? 'Refund Number' : 'Receipt Number'}
            <input
              value={formState.collection_number}
              onChange={(event) => setFormState((current) => ({ ...current, collection_number: event.target.value }))}
              placeholder={selectedDocumentIsCreditNote ? 'Refund number, e.g. RFND-00021' : 'Receipt number, e.g. RCPT-00021'}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            {selectedDocumentIsCreditNote ? 'Refund Date' : 'Receipt Date'}
            <input
              type="date"
              value={formState.collection_date}
              onChange={(event) => setFormState((current) => ({ ...current, collection_date: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-800 lg:col-span-2">
            Invoice / Credit Note
            <select
              value={formState.invoice_id}
              onChange={(event) => setFormState((current) => ({ ...current, invoice_id: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
              required
            >
              <option value="">Select document</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_type === 'credit_note' ? 'Credit Note' : 'Invoice'} {invoice.invoice_number} - {invoice.customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            {selectedDocumentIsCreditNote ? 'Amount Refunded' : 'Amount Received'}
            <input
              value={formState.amount}
              onChange={(event) => setFormState((current) => ({ ...current, amount: event.target.value }))}
              placeholder={selectedDocumentIsCreditNote ? 'Amount refunded in INR, e.g. 15000' : 'Amount received in INR, e.g. 15000'}
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
          <div className="lg:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} disabled={saving} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700 disabled:opacity-60">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Saving...' : selectedDocumentIsCreditNote ? 'Record Refund' : 'Record Payment'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Settlement"
        message={deleteTarget ? `Delete settlement ${deleteTarget.collection_number}?` : ''}
        confirmLabel="Delete"
        loading={deleteTarget ? deletingId === deleteTarget.id : false}
      />
    </section>
  );
}
