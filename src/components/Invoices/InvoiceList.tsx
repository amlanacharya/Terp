import { FormEvent, Fragment, useEffect, useState } from 'react';
import { FileDown, Pencil, Trash2, Clock, Ban, XCircle } from 'lucide-react';
import { api, downloadBlob } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { Customer, FinancialLedgerEntry, Invoice, InvoicePdfMode, TaxPreviewResponse } from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';
import { IconBtn } from '../Layout/IconBtn';
import { OverflowMenu } from '../Layout/OverflowMenu';

type InvoicePdfDownloadMode = 'default' | InvoicePdfMode;

interface InvoiceListProps {
  onNavigateToTrip?: (tripId: string) => void;
}

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
}

const initialForm: InvoiceFormState = {
  invoice_number: '',
  invoice_date: '',
  customer_id: '',
  subtotal: '',
  cgst_amount: '0.00',
  sgst_amount: '0.00',
  igst_amount: '0.00',
  total_amount: '0.00',
  due_date: '',
  payment_status: 'pending',
};

function roundCurrency(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function formatTaxScope(scope: TaxPreviewResponse['applies_to']): string {
  return scope === 'inter_state' ? 'Inter-State' : 'Intra-State';
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateTimeFormatter.format(parsed);
}

function formatLedgerEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    invoice_issued: 'Invoice Issued',
    invoice_deleted: 'Invoice Deleted',
    payment_received: 'Payment Received',
    payment_amended: 'Payment Amended',
    payment_reversed: 'Payment Reversed',
    refund_paid: 'Refund Paid',
    refund_amended: 'Refund Amended',
    refund_reversed: 'Refund Reversed',
    invoice_voided: 'Invoice Voided',
    credit_note_issued: 'Credit Note Issued',
    credit_note_applied: 'Credit Note Applied',
    write_off: 'Write Off',
  };

  return labels[eventType] ?? eventType.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function getLedgerDotClass(entry: FinancialLedgerEntry): string {
  if (entry.event_type.startsWith('refund_')) {
    return 'bg-amber-500';
  }
  if (entry.event_type === 'credit_note_issued') {
    return 'bg-orange-500';
  }
  return entry.direction === 'AR_INCREASE' ? 'bg-rose-500' : 'bg-emerald-500';
}

function getLedgerDirectionLabel(entry: FinancialLedgerEntry): string {
  switch (entry.event_type) {
    case 'payment_received':
      return 'Cash Inflow';
    case 'payment_amended':
      return entry.direction === 'AR_INCREASE' ? 'Amendment Reversal' : 'Amended Receipt';
    case 'payment_reversed':
      return 'Receipt Reversed';
    case 'refund_paid':
      return 'Cash Outflow';
    case 'refund_amended':
      return entry.direction === 'AR_DECREASE' ? 'Amendment Reversal' : 'Amended Refund';
    case 'refund_reversed':
      return 'Refund Reversed';
    case 'credit_note_issued':
      return 'Customer Credit Raised';
    case 'invoice_deleted':
    case 'write_off':
      return 'AR Reduced';
    case 'invoice_issued':
      return 'AR Raised';
    case 'invoice_voided':
      return 'Memo';
    default:
      return entry.direction === 'AR_INCREASE' ? 'AR Raised' : 'AR Reduced';
  }
}

function PaymentStatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    partial: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
  };
  const cls = classes[status] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function InvoiceLifecycleBadge({ invoice }: { invoice: Invoice }) {
  if (invoice.invoice_type === 'credit_note') {
    return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Credit Note</span>;
  }
  if (invoice.invoice_status === 'void') {
    return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">Void</span>;
  }
  if (invoice.invoice_status === 'written_off') {
    return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Written Off</span>;
  }
  return null;
}

export function InvoiceList({ onNavigateToTrip }: InvoiceListProps) {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [preview, setPreview] = useState<TaxPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [formState, setFormState] = useState<InvoiceFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<Invoice | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [showVoided, setShowVoided] = useState(false);
  const [voidModal, setVoidModal] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [writeOffModal, setWriteOffModal] = useState<Invoice | null>(null);
  const [writeOffReason, setWriteOffReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [openPdfMenuId, setOpenPdfMenuId] = useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [ledgerByInvoiceId, setLedgerByInvoiceId] = useState<Record<string, FinancialLedgerEntry[]>>({});
  const [loadingLedgerId, setLoadingLedgerId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloadLoading, setBulkDownloadLoading] = useState(false);

  const canManage = profile ? ['admin', 'manager', 'accountant'].includes(profile.role) : false;
  const canVoid = profile ? ['admin', 'manager'].includes(profile.role) : false;
  const canWriteOff = profile?.role === 'admin';

  async function loadInvoices(includeVoid = false) {
    const params = includeVoid ? '?include_void=true' : '';
    const [invoiceRows, customerRows] = await Promise.all([
      api.get<Invoice[]>(`/invoices${params}`),
      api.get<Customer[]>('/customers'),
    ]);
    setInvoices(invoiceRows);
    setCustomers(customerRows);
  }

  function syncLegacyFields(subtotalInput: string, nextPreview: TaxPreviewResponse | null) {
    const subtotal = Number(subtotalInput || 0);

    if (!nextPreview) {
      setFormState((current) => ({
        ...current,
        cgst_amount: '0.00',
        sgst_amount: '0.00',
        igst_amount: '0.00',
        total_amount: roundCurrency(subtotal),
      }));
      return;
    }

    setFormState((current) => ({
      ...current,
      cgst_amount: roundCurrency(nextPreview.legacy.cgst_amount),
      sgst_amount: roundCurrency(nextPreview.legacy.sgst_amount),
      igst_amount: roundCurrency(nextPreview.legacy.igst_amount),
      total_amount: roundCurrency(nextPreview.total_amount),
    }));
  }

  useEffect(() => {
    async function hydrate() {
      try {
        await loadInvoices(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load invoices.');
      } finally {
        setLoading(false);
      }
    }

    void hydrate();
  }, []);

  useEffect(() => {
    async function loadPreview() {
      const subtotal = Number(formState.subtotal || 0);
      if (!formState.customer_id || !Number.isFinite(subtotal) || subtotal < 0) {
        setPreview(null);
        syncLegacyFields(formState.subtotal, null);
        return;
      }

      try {
        setPreviewLoading(true);
        const nextPreview = await api.post<TaxPreviewResponse>('/tax-components/preview', {
          customer_id: formState.customer_id,
          items: [{ taxable_base: subtotal }],
        });
        setPreview(nextPreview);
        syncLegacyFields(formState.subtotal, nextPreview);
      } catch (err) {
        setPreview(null);
        syncLegacyFields(formState.subtotal, null);
        setError(err instanceof Error ? err.message : 'Unable to preview tax components.');
      } finally {
        setPreviewLoading(false);
      }
    }

    if (isFormModalOpen) {
      void loadPreview();
    }
  }, [formState.customer_id, formState.subtotal, isFormModalOpen]);

  function openCreate() {
    setEditingId(null);
    setPreview(null);
    setFormState(initialForm);
    setIsFormModalOpen(true);
  }

  function startEdit(invoice: Invoice) {
    if (invoice.invoice_status !== 'active' || (invoice.source_type && invoice.source_type !== 'manual')) {
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
    });
    setViewingItem(null);
    setIsFormModalOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setPreview(null);
    setFormState(initialForm);
    setIsFormModalOpen(false);
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
      await loadInvoices(showVoided);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save invoice.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(invoice: Invoice) {
    setDeleteTarget(invoice);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeletingId(deleteTarget.id);
      setError('');
      await api.delete(`/invoices/${deleteTarget.id}`);
      if (editingId === deleteTarget.id) {
        resetForm();
      }
      setDeleteTarget(null);
      await loadInvoices(showVoided);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete invoice.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleVoidConfirm() {
    if (!voidModal || !voidReason.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const result = await api.post<{ invoice: Invoice; credit_note: Invoice | null }>(
        `/invoices/${voidModal.id}/void`,
        { reason: voidReason.trim() }
      );
      setVoidModal(null);
      setVoidReason('');
      if (result.credit_note) {
        setSuccessMessage(`Invoice voided. Credit note ${result.credit_note.invoice_number} auto-issued.`);
      } else {
        setSuccessMessage('Invoice voided successfully.');
      }
      if (editingId === voidModal.id) resetForm();
      invalidateLedger(voidModal.id);
      await loadInvoices(showVoided);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to void invoice.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleWriteOffConfirm() {
    if (!writeOffModal || !writeOffReason.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/invoices/${writeOffModal.id}/write-off`, { reason: writeOffReason.trim() });
      setWriteOffModal(null);
      setWriteOffReason('');
      setSuccessMessage('Invoice marked as written off.');
      invalidateLedger(writeOffModal.id);
      await loadInvoices(showVoided);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to write off invoice.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkOverdue() {
    setActionLoading(true);
    setError('');
    try {
      const result = await api.post<{ count: number }>('/invoices/mark-overdue', {});
      setSuccessMessage(`${result.count} invoice${result.count !== 1 ? 's' : ''} marked as overdue.`);
      await loadInvoices(showVoided);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark overdue invoices.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleToggleShowVoided() {
    const next = !showVoided;
    setShowVoided(next);
    try {
      await loadInvoices(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load invoices.');
    }
  }

  async function handleDownloadPdf(invoice: Invoice, mode: InvoicePdfDownloadMode = 'default') {
    setPdfLoadingId(invoice.id);
    setOpenPdfMenuId(null);
    try {
      setError('');
      const params = new URLSearchParams();
      if (mode !== 'default') {
        params.set('mode', mode);
      }
      const suffix = params.toString();
      const blob = await downloadBlob(`/invoices/${invoice.id}/pdf${suffix ? `?${suffix}` : ''}`);
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
    } finally {
      setPdfLoadingId((current) => (current === invoice.id ? null : current));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((inv) => inv.id)));
    }
  }

  async function handleBulkDownload() {
    setBulkDownloadLoading(true);
    setError('');
    try {
      for (const id of selectedIds) {
        try {
          const blob = await downloadBlob(`/invoices/${id}/pdf`);
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const invoice = invoices.find((inv) => inv.id === id);
          link.download = invoice ? `${invoice.invoice_number}.pdf` : `invoice-${id}.pdf`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
        } catch (err) {
          console.error('Failed to download invoice', id, err);
        }
      }
      setSelectedIds(new Set());
      setSuccessMessage(`Downloaded ${selectedIds.size} invoice${selectedIds.size !== 1 ? 's' : ''}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download invoices.');
    } finally {
      setBulkDownloadLoading(false);
    }
  }

  async function handleMarkOverdueSingle(invoiceId: string) {
    setActionLoading(true);
    setError('');
    try {
      await api.put(`/invoices/${invoiceId}`, { payment_status: 'overdue' });
      setSuccessMessage('Invoice marked as overdue.');
      await loadInvoices(showVoided);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark invoice overdue.');
    } finally {
      setActionLoading(false);
    }
  }


  function invalidateLedger(invoiceId: string) {
    setExpandedInvoiceId((current) => (current === invoiceId ? null : current));
    setLedgerByInvoiceId((current) => {
      const next = { ...current };
      delete next[invoiceId];
      return next;
    });
  }

  async function handleToggleLedger(invoiceId: string) {
    if (expandedInvoiceId === invoiceId) {
      setExpandedInvoiceId(null);
      return;
    }

    setExpandedInvoiceId(invoiceId);
    if (ledgerByInvoiceId[invoiceId] || loadingLedgerId === invoiceId) {
      return;
    }

    try {
      setLoadingLedgerId(invoiceId);
      const rows = await api.get<FinancialLedgerEntry[]>(`/invoices/${invoiceId}/ledger`);
      setLedgerByInvoiceId((current) => ({ ...current, [invoiceId]: rows }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load financial history.');
    } finally {
      setLoadingLedgerId((current) => (current === invoiceId ? null : current));
    }
  }
  if (loading) {
    return <p className="text-sm text-slate-500">Loading invoices...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Customer Invoices</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Customer billing register</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Add Manual Invoice
            </button>
          ) : null}
          {canVoid ? (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => void handleMarkOverdue()}
              className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 disabled:opacity-60"
            >
              Mark Overdue
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleToggleShowVoided()}
            className={`rounded-2xl border px-4 py-2 text-sm font-medium ${showVoided ? 'border-slate-400 bg-slate-100 text-slate-700' : 'border-slate-300 text-slate-600'}`}
          >
            {showVoided ? 'Hide Voided' : 'Show Voided'}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {successMessage ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
          {successMessage}
          <button type="button" onClick={() => setSuccessMessage('')} className="ml-3 text-xs underline">Dismiss</button>
        </div>
      ) : null}

      {canManage ? <p className="text-sm text-slate-500">Use this form only for legacy manual invoices. GT trip and annexure invoices should be created from the Trips or Annexures screens.</p> : null}

      {selectedIds.size > 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2">
          <span className="text-sm text-sky-700">{selectedIds.size} selected</span>
          <button
            type="button"
            disabled={bulkDownloadLoading}
            onClick={() => void handleBulkDownload()}
            className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            {bulkDownloadLoading ? 'Downloading...' : 'Download Selected PDFs'}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-slate-500"
          >
            Clear
          </button>
        </div>
      ) : null}

      <Modal isOpen={!!viewingItem && !editingId} onClose={() => setViewingItem(null)} title="View Invoice" size="lg">
        {viewingItem && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Invoice #</p>
              <p className="mt-1 text-slate-600">{viewingItem.invoice_number}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Date</p>
              <p className="mt-1 text-slate-600">{formatDate(viewingItem.invoice_date)}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Customer</p>
              <p className="mt-1 text-slate-600">{viewingItem.customer.name}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Source</p>
              <p className="mt-1 text-slate-600">{viewingItem.source_type ?? 'manual'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Subtotal</p>
              <p className="mt-1 text-slate-600">{formatCurrency(viewingItem.subtotal)}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">CGST</p>
              <p className="mt-1 text-slate-600">{formatCurrency(viewingItem.cgst_amount ?? 0)}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">SGST</p>
              <p className="mt-1 text-slate-600">{formatCurrency(viewingItem.sgst_amount ?? 0)}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">IGST</p>
              <p className="mt-1 text-slate-600">{formatCurrency(viewingItem.igst_amount ?? 0)}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Total Amount</p>
              <p className="mt-1 text-slate-600 font-semibold">{formatCurrency(viewingItem.total_amount)}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Due Date</p>
              <p className="mt-1 text-slate-600">{formatDate(viewingItem.due_date)}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Payment Status</p>
              <p className="mt-1 text-slate-600">{viewingItem.payment_status}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Invoice Status</p>
              <p className="mt-1 text-slate-600">{viewingItem.invoice_status}</p>
            </div>
            <div className="flex justify-end gap-2 pt-4 lg:col-span-2">
              <button onClick={() => setViewingItem(null)} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700">Close</button>
              {viewingItem.invoice_status === 'active' && (!viewingItem.source_type || viewingItem.source_type === 'manual') && viewingItem.invoice_type !== 'credit_note' && (
                <button
                  onClick={() => startEdit(viewingItem)}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-white"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isFormModalOpen}
        onClose={saving ? () => undefined : resetForm}
        title={editingId ? 'Edit Manual Invoice' : 'Add Manual Invoice'}
        size="lg"
        closeOnBackdrop={!saving}
        closeOnEsc={!saving}
      >
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
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
            <input value={formState.subtotal} onChange={(event) => setFormState((current) => ({ ...current, subtotal: event.target.value }))} placeholder="Subtotal in INR, e.g. 25000" type="number" min="0" step="0.01" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Tax Preview</p>
                <p className="mt-1 text-sm text-slate-700">
                  {preview ? `Scope: ${formatTaxScope(preview.applies_to)}` : 'Select a customer and subtotal to resolve tax components.'}
                </p>
              </div>
              {previewLoading ? <p className="text-sm text-slate-500">Resolving tax preview...</p> : null}
            </div>
            {preview ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {preview.tax_components.map((component) => (
                  <div key={`${component.component_code}-${component.sort_order}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{component.component_code}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{component.component_name}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {component.is_percentage ? `${component.rate ?? 0}% of ${formatCurrency(component.taxable_base)}` : `Flat ${formatCurrency(component.flat_amount ?? 0)}`}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(component.tax_amount)}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
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
          <div className="lg:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={resetForm} disabled={saving} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700 disabled:opacity-60">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update Manual Invoice' : 'Create Manual Invoice'}</button>
          </div>
        </form>
      </Modal>

      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === invoices.length && invoices.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Duty Slip</th>
              <th className="px-4 py-3">Journey</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Amount</th>
              {canManage ? <th className="px-4 py-3">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {invoices.map((invoice) => {
              const isActive = invoice.invoice_status === 'active';
              const isManualInvoice = !invoice.source_type || invoice.source_type === 'manual';
              const canEditInvoice = isManualInvoice && isActive && invoice.invoice_type !== 'credit_note';
              const canVoidInvoice = canVoid && isActive && invoice.invoice_type === 'invoice';
              const canWriteOffInvoice = canWriteOff && isActive && invoice.invoice_type === 'invoice'
                && ['pending', 'partial', 'overdue'].includes(invoice.payment_status);
              const hasAnnexurePdfOptions = Number(invoice.annexure_item_count ?? 0) > 0;
              const pdfBusy = actionLoading || pdfLoadingId === invoice.id;
              const historyBusy = loadingLedgerId === invoice.id;
              const historyOpen = expandedInvoiceId === invoice.id;
              const ledgerEntries = ledgerByInvoiceId[invoice.id] ?? [];
              const rowClass = !isActive ? 'opacity-60' : '';

              return (
                <Fragment key={invoice.id}>
                  <tr className={rowClass}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(invoice.id)}
                        onChange={() => toggleSelect(invoice.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setViewingItem(invoice)}
                        className="font-medium text-slate-900 hover:text-blue-600 hover:underline cursor-pointer text-left"
                      >
                        {invoice.invoice_number}
                      </button>
                      <InvoiceLifecycleBadge invoice={invoice} />
                      <button
                        type="button"
                        onClick={() => void handleToggleLedger(invoice.id)}
                        className="mt-2 text-xs font-medium text-sky-700 hover:text-sky-800"
                      >
                        {historyOpen ? 'Hide Financial History' : historyBusy ? 'Loading History...' : 'Financial History'}
                      </button>
                    </td>
                    <td className="px-4 py-3">{invoice.customer.name}</td>
                    <td className="px-4 py-3">{invoice.source_type ?? 'manual'}</td>
                    <td className="px-4 py-3">
                      {invoice.duty_slip_number && invoice.trip_id && onNavigateToTrip ? (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => onNavigateToTrip(invoice.trip_id!)}
                            className="text-xs text-sky-600 hover:text-sky-700 hover:underline"
                          >
                            DS: {invoice.duty_slip_number} ↗
                          </button>
                        </div>
                      ) : invoice.duty_slip_number ? (
                        <div className="mt-1">
                          <span className="text-xs text-sky-600">DS: {invoice.duty_slip_number}</span>
                        </div>
                      ) : null}
                      {!invoice.duty_slip_number ? <span className="text-slate-400">-</span> : null}
                    </td>
                    <td className="px-4 py-3">{invoice.nature_of_journey ?? invoice.duty_type_label ?? '-'}</td>
                    <td className="px-4 py-3">{formatDate(invoice.invoice_date)}</td>
                    <td className="px-4 py-3">{formatDate(invoice.due_date)}</td>
                    <td className="px-4 py-3">
                      {isActive ? <PaymentStatusBadge status={invoice.payment_status} /> : null}
                      {invoice.voided_at ? <div className="mt-1 text-xs text-slate-500">on {formatDate(invoice.voided_at)}</div> : null}
                      {invoice.void_reason ? <div className="text-xs text-slate-400">{invoice.void_reason}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium text-slate-900">{formatCurrency(invoice.total_amount)}</div>
                      {invoice.invoice_type === 'credit_note' ? (
                        <>
                          {invoice.payment_status === 'partial' ? (
                            <div className="mt-0.5 text-xs">
                              <span className="text-amber-600">{formatCurrency(invoice.collected_amount)} refunded</span>{' '}
                              <span className="text-slate-500">{formatCurrency(invoice.outstanding_amount)} credit pending</span>
                            </div>
                          ) : null}
                          {invoice.payment_status === 'completed' ? (
                            <div className="mt-0.5 text-xs text-amber-600">Fully refunded</div>
                          ) : null}
                          {invoice.payment_status === 'pending' ? (
                            <div className="mt-0.5 text-xs text-slate-400">No refund recorded</div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {invoice.payment_status === 'partial' ? (
                            <div className="mt-0.5 text-xs">
                              <span className="text-emerald-600">{formatCurrency(invoice.collected_amount)} collected</span>{' '}
                              <span className="text-rose-600">{formatCurrency(invoice.outstanding_amount)} due</span>
                            </div>
                          ) : null}
                          {invoice.payment_status === 'completed' ? (
                            <div className="mt-0.5 text-xs text-emerald-600">Fully collected</div>
                          ) : null}
                          {(invoice.payment_status === 'pending' || invoice.payment_status === 'overdue') ? (
                            <div className="mt-0.5 text-xs text-slate-400">Nothing collected</div>
                          ) : null}
                        </>
                      )}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {hasAnnexurePdfOptions ? (
                            <div className="relative inline-block text-left">
                              <button
                                type="button"
                                disabled={pdfBusy}
                                onClick={() => setOpenPdfMenuId((current) => (current === invoice.id ? null : invoice.id))}
                                title="Download PDF"
                                className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <FileDown size={15} />
                              </button>
                              {openPdfMenuId === invoice.id ? (
                                <div className="absolute right-0 z-10 mt-2 min-w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                                  <button type="button" disabled={pdfBusy} onClick={() => void handleDownloadPdf(invoice)} className="block w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                                    Customer Default
                                  </button>
                                  <button type="button" disabled={pdfBusy} onClick={() => void handleDownloadPdf(invoice, 'invoice_only')} className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                                    Invoice Only
                                  </button>
                                  <button type="button" disabled={pdfBusy} onClick={() => void handleDownloadPdf(invoice, 'invoice_with_annexures')} className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                                    Invoice + Annexures
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={pdfBusy}
                              onClick={() => void handleDownloadPdf(invoice)}
                              title="Download PDF"
                              className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <FileDown size={15} />
                            </button>
                          )}
                          {canEditInvoice ? (
                            <IconBtn icon={Pencil} label="Edit" onClick={() => startEdit(invoice)} />
                          ) : null}
                          {canEditInvoice ? (
                            <IconBtn icon={Trash2} label="Delete" variant="danger" onClick={() => void handleDelete(invoice)} />
                          ) : null}
                          {(canVoidInvoice || canWriteOffInvoice || (actionLoading === false && invoice.payment_status !== 'overdue')) ? (
                            <OverflowMenu
                              items={[
                                {
                                  label: 'Mark Overdue',
                                  icon: Clock,
                                  onClick: () => void handleMarkOverdueSingle(invoice.id),
                                  disabled: actionLoading || invoice.payment_status === 'overdue',
                                  variant: 'warning',
                                },
                                ...(canVoidInvoice ? [{
                                  label: 'Void',
                                  icon: Ban,
                                  onClick: () => { setVoidModal(invoice); setVoidReason(''); },
                                  variant: 'warning' as const,
                                }] : []),
                                ...(canWriteOffInvoice ? [{
                                  label: 'Write Off',
                                  icon: XCircle,
                                  onClick: () => { setWriteOffModal(invoice); setWriteOffReason(''); },
                                  variant: 'danger' as const,
                                }] : []),
                              ]}
                            />
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                  {historyOpen ? (
                    <tr className="bg-slate-50/70">
                      <td colSpan={canManage ? 12 : 11} className="px-4 py-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">Financial History</h3>
                            <span className="text-xs text-slate-500">{ledgerEntries.length} event{ledgerEntries.length === 1 ? '' : 's'}</span>
                          </div>
                          {historyBusy ? (
                            <p className="mt-3 text-sm text-slate-500">Loading financial history...</p>
                          ) : ledgerEntries.length === 0 ? (
                            <p className="mt-3 text-sm text-slate-500">No financial events recorded yet.</p>
                          ) : (
                            <div className="mt-4 space-y-3">
                              {ledgerEntries.map((entry) => (
                                <div key={entry.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                                  <div className={`mt-1 h-2.5 w-2.5 rounded-full ${getLedgerDotClass(entry)}`} />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{formatLedgerEventLabel(entry.event_type)}</span>
                                      <span className="font-semibold text-slate-900">{formatCurrency(entry.amount)}</span>
                                      <span className={`font-medium ${entry.direction === 'AR_INCREASE' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {getLedgerDirectionLabel(entry)}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-sm text-slate-700">{entry.description}</p>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {formatDateTime(entry.created_at)}
                                      {entry.performed_by_name ? ` by ${entry.performed_by_name}` : ''}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 12 : 11} className="px-4 py-6 text-center text-slate-500">
                  No invoices available.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Invoice"
        message={deleteTarget ? `Delete invoice ${deleteTarget.invoice_number}?` : ''}
        confirmLabel="Delete"
        loading={deleteTarget ? deletingId === deleteTarget.id : false}
      />

      {/* Void Modal */}
      {voidModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Void Invoice</h3>
            <p className="mt-2 text-sm text-slate-600">
              Invoice <strong>{voidModal.invoice_number}</strong> ({formatCurrency(voidModal.total_amount)}) will be permanently cancelled.
            </p>
            <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
              If this invoice has recorded collections, a credit note will be automatically issued to offset them.
            </p>
            <label className="mt-4 block text-sm font-semibold text-slate-800">
              Reason <span className="font-normal text-slate-500">(required)</span>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={3}
                placeholder="Billing error, duplicate invoice, customer request..."
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-normal"
              />
            </label>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={actionLoading || !voidReason.trim()}
                onClick={() => void handleVoidConfirm()}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm text-white disabled:opacity-60"
              >
                {actionLoading ? 'Voiding...' : 'Void Invoice'}
              </button>
              <button
                type="button"
                onClick={() => { setVoidModal(null); setVoidReason(''); }}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Write-off Modal */}
      {writeOffModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Write Off Invoice</h3>
            <p className="mt-2 text-sm text-slate-600">
              Invoice <strong>{writeOffModal.invoice_number}</strong> will be marked as uncollectable bad debt.
            </p>
            <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
              Outstanding balance of {formatCurrency(writeOffModal.outstanding_amount)} will be written off. This does not unlink trips or annexures.
            </p>
            <label className="mt-4 block text-sm font-semibold text-slate-800">
              Reason <span className="font-normal text-slate-500">(required)</span>
              <textarea
                value={writeOffReason}
                onChange={(e) => setWriteOffReason(e.target.value)}
                rows={3}
                placeholder="Bad debt, customer insolvency, uncontactable..."
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-normal"
              />
            </label>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={actionLoading || !writeOffReason.trim()}
                onClick={() => void handleWriteOffConfirm()}
                className="rounded-2xl bg-red-700 px-5 py-3 text-sm text-white disabled:opacity-60"
              >
                {actionLoading ? 'Writing off...' : 'Write Off'}
              </button>
              <button
                type="button"
                onClick={() => { setWriteOffModal(null); setWriteOffReason(''); }}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}





