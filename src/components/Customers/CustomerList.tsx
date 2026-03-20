import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Customer, InvoicePdfMode } from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';
import { IconBtn } from '../Layout/IconBtn';

interface CustomerFormState {
  customer_code: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  pan: string;
  sac_code: string;
  vendor_code: string;
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
  address: '',
  city: '',
  state: '',
  pincode: '',
  gstin: '',
  pan: '',
  sac_code: '',
  vendor_code: '',
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

export function CustomerList() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formState, setFormState] = useState<CustomerFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterCity, setFilterCity] = useState('');

  const canManage = profile ? ['admin', 'manager'].includes(profile.role) : false;
  const filteredCustomers = useMemo(
    () => {
      let result = showInactive ? customers : customers.filter((customer) => customer.is_active !== false);
      if (filterName) {
        result = result.filter((c) => c.name.toLowerCase().includes(filterName.toLowerCase()));
      }
      if (filterCity) {
        result = result.filter((c) => (c.city ?? '').toLowerCase().includes(filterCity.toLowerCase()));
      }
      return result;
    },
    [customers, showInactive, filterName, filterCity]
  );

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
    setViewingItem(null);
    setEditingId(customer.id);
    setFormState({
      customer_code: customer.customer_code,
      name: customer.name,
      contact_person: customer.contact_person ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
      city: customer.city ?? '',
      state: customer.state ?? '',
      pincode: customer.pincode ?? '',
      gstin: customer.gstin ?? '',
      pan: customer.pan ?? '',
      sac_code: customer.sac_code ?? '',
      vendor_code: customer.vendor_code ?? '',
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

    const normalizedPan = formState.pan.trim().toUpperCase();
    if (normalizedPan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalizedPan)) {
      setError('Customer PAN must be in AAAAA9999A format.');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        name: formState.name,
        contact_person: formState.contact_person || null,
        phone: formState.phone || null,
        email: formState.email || null,
        address: formState.address || null,
        city: formState.city || null,
        state: formState.state || null,
        pincode: formState.pincode || null,
        gstin: formState.gstin.trim().toUpperCase() || null,
        pan: normalizedPan || null,
        sac_code: formState.sac_code || null,
        vendor_code: formState.vendor_code || null,
        credit_limit: Number(formState.credit_limit),
        credit_days: Number(formState.credit_days),
        default_duty_start_time: formState.default_duty_start_time || null,
        default_duty_end_time: formState.default_duty_end_time || null,
        default_duty_hours: formState.default_duty_hours === '' ? null : Number(formState.default_duty_hours),
        invoice_pdf_mode: formState.invoice_pdf_mode,
        is_active: formState.is_active,
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

  async function handleToggleActive(customer: Customer) {
    try {
      setError('');
      await api.put(`/customers/${customer.id}`, { ...customer, is_active: !customer.is_active });
      await loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status.');
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
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            Include Inactive
          </label>
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
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <input
          type="text"
          placeholder="Search name..."
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Search city..."
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c, i) => (
              <tr key={c.id} className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.customer_code}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setViewingItem(c)}
                    className="font-medium text-slate-900 hover:text-blue-600 hover:underline cursor-pointer text-left"
                  >
                    {c.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">{c.contact_person ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{c.phone ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{c.city ?? '-'}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(c)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        c.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        c.is_active ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                  ) : (
                    <span className={c.is_active ? 'text-emerald-600' : 'text-slate-400'}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {canManage ? <IconBtn icon={Pencil} label="Edit" onClick={() => startEdit(c)} /> : null}
                    {canManage ? <IconBtn icon={Trash2} label="Delete" variant="danger" onClick={() => setDeleteTarget(c)} /> : null}
                  </div>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">No customers match the current filter.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!viewingItem && !editingId} onClose={() => setViewingItem(null)} title="View Customer" size="lg">
        {viewingItem && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Customer Code</p>
              <p className="mt-1 text-slate-600">{viewingItem.customer_code}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Customer Name</p>
              <p className="mt-1 text-slate-600">{viewingItem.name}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Contact Person</p>
              <p className="mt-1 text-slate-600">{viewingItem.contact_person ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Phone</p>
              <p className="mt-1 text-slate-600">{viewingItem.phone ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Email</p>
              <p className="mt-1 text-slate-600">{viewingItem.email ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">City</p>
              <p className="mt-1 text-slate-600">{viewingItem.city ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">State</p>
              <p className="mt-1 text-slate-600">{viewingItem.state ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">GST Number</p>
              <p className="mt-1 text-slate-600">{viewingItem.gstin ?? '-'}</p>
            </div>
            <div className="text-sm lg:col-span-2">
              <p className="font-semibold text-slate-800">Address</p>
              <p className="mt-1 text-slate-600">{viewingItem.address ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Credit Limit</p>
              <p className="mt-1 text-slate-600">{viewingItem.credit_limit ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Status</p>
              <p className="mt-1 text-slate-600">{viewingItem.is_active ? 'Active' : 'Inactive'}</p>
            </div>
            <div className="flex justify-end gap-2 pt-4 lg:col-span-2">
              <button onClick={() => setViewingItem(null)} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700">Close</button>
              {canManage && (
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
            <input value={editingId ? formState.customer_code : 'Auto-generated on save'} readOnly className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 font-normal text-slate-500" />
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
            GST Number
            <input value={formState.gstin} onChange={(event) => setFormState((current) => ({ ...current, gstin: event.target.value.toUpperCase() }))} maxLength={15} placeholder="GSTIN, e.g. 21ABCDE1234F1Z5" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Customer PAN
            <input value={formState.pan} onChange={(event) => setFormState((current) => ({ ...current, pan: event.target.value.toUpperCase() }))} maxLength={10} placeholder="PAN, e.g. ABCDE1234F" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            SAC Code
            <input value={formState.sac_code} onChange={(event) => setFormState((current) => ({ ...current, sac_code: event.target.value }))} placeholder="SAC code, e.g. 996411" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800 lg:col-span-2">
            Address
            <textarea value={formState.address} onChange={(event) => setFormState((current) => ({ ...current, address: event.target.value }))} rows={3} placeholder="Billing address" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
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
            Pincode
            <input value={formState.pincode} onChange={(event) => setFormState((current) => ({ ...current, pincode: event.target.value }))} placeholder="Pincode" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Vendor Code
            <input value={formState.vendor_code} onChange={(event) => setFormState((current) => ({ ...current, vendor_code: event.target.value }))} placeholder="Ledger / vendor code" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
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
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 lg:col-span-2">
            <input type="checkbox" checked={formState.is_active} onChange={(event) => setFormState((current) => ({ ...current, is_active: event.target.checked }))} />
            Active customer
          </label>
          <div className="flex justify-end gap-3 pt-2 lg:col-span-2">
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
