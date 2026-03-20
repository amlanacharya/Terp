import { FormEvent, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { Collection, Invoice } from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';
import { IconBtn } from '../Layout/IconBtn';

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
  const [viewingItem, setViewingItem] = useState<Collection | null>(null);
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
        collection_date: formState.collection_date,
        invoice_id: formState.invoice_id,
        amount: Number(formState.amount),
        payment_mode: formState.payment_mode,
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
        {canManage ? <button type="button" onClick={openCreate} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">Record Settlement</button> : null}
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
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setViewingItem(collection)}
                      className="font-medium text-slate-900 hover:text-blue-600 hover:underline cursor-pointer text-left"
                    >
                      {collection.collection_number}
                    </button>
                    <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${isRefund ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{isRefund ? 'Refund' : 'Receipt'}</div>
                  </td>
                  <td className="px-4 py-3">{collection.invoice.invoice_number}</td>
                  <td className="px-4 py-3">{collection.invoice.customer.name}</td>
                  <td className="px-4 py-3">{formatDate(collection.collection_date)}</td>
                  <td className="px-4 py-3">{collection.payment_mode}</td>
                  <td className="px-4 py-3">{formatCurrency(collection.amount)}</td>
                  {canManage ? <td className="px-4 py-3"><IconBtn icon={Trash2} label="Delete" variant="danger" onClick={() => setDeleteTarget(collection)} disabled={rowBusy} /></td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!viewingItem} onClose={() => setViewingItem(null)} title="View Collection" size="lg">
        {viewingItem && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Collection #</p>
              <p className="mt-1 text-slate-600">{viewingItem.collection_number}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Type</p>
              <p className="mt-1 text-slate-600">{viewingItem.invoice.invoice_type === 'credit_note' ? 'Refund' : 'Receipt'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Invoice #</p>
              <p className="mt-1 text-slate-600">{viewingItem.invoice.invoice_number}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Customer</p>
              <p className="mt-1 text-slate-600">{viewingItem.invoice.customer.name}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Collection Date</p>
              <p className="mt-1 text-slate-600">{formatDate(viewingItem.collection_date)}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Payment Mode</p>
              <p className="mt-1 text-slate-600">{viewingItem.payment_mode}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Amount</p>
              <p className="mt-1 text-slate-600 font-semibold">{formatCurrency(viewingItem.amount)}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Reference #</p>
              <p className="mt-1 text-slate-600">{viewingItem.reference_number ?? '-'}</p>
            </div>
            {viewingItem.bank_name && (
              <div className="text-sm">
                <p className="font-semibold text-slate-800">Bank Name</p>
                <p className="mt-1 text-slate-600">{viewingItem.bank_name}</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4 lg:col-span-2">
              <button onClick={() => setViewingItem(null)} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700">Close</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isModalOpen} onClose={saving ? () => undefined : closeModal} title={selectedDocumentIsCreditNote ? 'Record Refund' : 'Record Payment Receipt'} size="lg" closeOnBackdrop={!saving} closeOnEsc={!saving}>
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-semibold text-slate-800">{selectedDocumentIsCreditNote ? 'Refund Number' : 'Receipt Number'}<input value="Auto-generated on save" readOnly className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 font-normal text-slate-500" /></label>
          <label className="text-sm font-semibold text-slate-800">{selectedDocumentIsCreditNote ? 'Refund Date' : 'Receipt Date'}<input type="date" value={formState.collection_date} onChange={(event) => setFormState((current) => ({ ...current, collection_date: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
          <label className="text-sm font-semibold text-slate-800 lg:col-span-2">Invoice / Credit Note<select value={formState.invoice_id} onChange={(event) => setFormState((current) => ({ ...current, invoice_id: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required><option value="">Select document</option>{invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_type === 'credit_note' ? 'Credit Note' : 'Invoice'} {invoice.invoice_number} - {invoice.customer.name}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-800">{selectedDocumentIsCreditNote ? 'Amount Refunded' : 'Amount Received'}<input value={formState.amount} onChange={(event) => setFormState((current) => ({ ...current, amount: event.target.value }))} type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
          <label className="text-sm font-semibold text-slate-800">Payment Mode<select value={formState.payment_mode} onChange={(event) => setFormState((current) => ({ ...current, payment_mode: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="card">Card</option></select></label>
          <label className="text-sm font-semibold text-slate-800">Reference Number<input value={formState.reference_number} onChange={(event) => setFormState((current) => ({ ...current, reference_number: event.target.value }))} placeholder="UTR / cheque no. / transaction ref." className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">Bank Name<input value={formState.bank_name} onChange={(event) => setFormState((current) => ({ ...current, bank_name: event.target.value }))} placeholder="Bank name" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <div className="flex justify-end gap-3 pt-2 lg:col-span-2"><button type="button" onClick={closeModal} disabled={saving} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700 disabled:opacity-60">Cancel</button><button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Saving...' : selectedDocumentIsCreditNote ? 'Record Refund' : 'Record Payment'}</button></div>
        </form>
      </Modal>

      <ConfirmModal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} title="Delete Settlement" message={deleteTarget ? `Delete settlement ${deleteTarget.collection_number}?` : ''} confirmLabel="Delete" loading={deleteTarget ? deletingId === deleteTarget.id : false} />
    </section>
  );
}
