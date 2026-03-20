import { FormEvent, useMemo, useEffect, useState } from 'react';
import { Pencil, Trash2, FileDown } from 'lucide-react';
import { api, downloadBlob } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { Owner, OwnerSettlement, Vehicle } from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';
import { IconBtn } from '../Layout/IconBtn';

interface OwnerSettlementFormState {
  settlement_number: string;
  owner_id: string;
  vehicle_id: string;
  period_from: string;
  period_to: string;
  total_trips: string;
  total_km: string;
  total_amount: string;
  tds_amount: string;
  other_deductions: string;
  net_amount: string;
  payment_mode: string;
  status: string;
}

const initialForm: OwnerSettlementFormState = {
  settlement_number: '',
  owner_id: '',
  vehicle_id: '',
  period_from: '',
  period_to: '',
  total_trips: '0',
  total_km: '0',
  total_amount: '0',
  tds_amount: '0',
  other_deductions: '0',
  net_amount: '0',
  payment_mode: 'bank_transfer',
  status: 'pending',
};

export function OwnerSettlements() {
  const { profile } = useAuth();
  const [settlements, setSettlements] = useState<OwnerSettlement[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [formState, setFormState] = useState<OwnerSettlementFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<OwnerSettlement | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OwnerSettlement | null>(null);
  const [showFieldHelp, setShowFieldHelp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [filterOwnerId, setFilterOwnerId] = useState('');
  const [filterVehicleId, setFilterVehicleId] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const canManage = profile ? ['admin', 'manager', 'accountant'].includes(profile.role) : false;

  const filteredSettlements = useMemo(() => {
    return settlements.filter((settlement) => {
      if (filterOwnerId && settlement.owner.id !== filterOwnerId) return false;
      if (filterVehicleId && settlement.vehicle?.id !== filterVehicleId) return false;
      if (filterStatus !== 'all' && settlement.status !== filterStatus) return false;
      return true;
    });
  }, [settlements, filterOwnerId, filterVehicleId, filterStatus]);

  async function loadPage() {
    const [settlementRows, ownerRows, vehicleRows] = await Promise.all([
      api.get<OwnerSettlement[]>('/settlements/owners'),
      api.get<Owner[]>('/owners'),
      api.get<Vehicle[]>('/vehicles'),
    ]);
    setSettlements(settlementRows);
    setOwners(ownerRows);
    setVehicles(vehicleRows);
  }

  useEffect(() => {
    async function hydrate() {
      try {
        await loadPage();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load owner settlements.');
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

  function startEdit(settlement: OwnerSettlement) {
    setEditingId(settlement.id);
    setFormState({
      settlement_number: settlement.settlement_number,
      owner_id: settlement.owner.id,
      vehicle_id: settlement.vehicle?.id ?? '',
      period_from: settlement.period_from?.slice(0, 10) ?? '',
      period_to: settlement.period_to?.slice(0, 10) ?? '',
      total_trips: String(settlement.total_trips),
      total_km: String(settlement.total_km),
      total_amount: String(settlement.total_amount),
      tds_amount: String(settlement.tds_amount ?? 0),
      other_deductions: String(settlement.other_deductions ?? 0),
      net_amount: String(settlement.net_amount),
      payment_mode: settlement.payment_mode ?? 'bank_transfer',
      status: settlement.status,
    });
    setViewingItem(null);
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
        vehicle_id: formState.vehicle_id || null,
        total_trips: Number(formState.total_trips),
        total_km: Number(formState.total_km),
        total_amount: Number(formState.total_amount),
        tds_amount: Number(formState.tds_amount),
        other_deductions: Number(formState.other_deductions),
        net_amount: Number(formState.net_amount),
      };

      if (editingId) {
        await api.put(`/settlements/owners/${editingId}`, payload);
      } else {
        await api.post('/settlements/owners', payload);
      }

      await loadPage();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save owner settlement.');
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
      await api.delete(`/settlements/owners/${deleteTarget.id}`);
      if (editingId === deleteTarget.id) {
        closeModal();
      }
      setDeleteTarget(null);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete owner settlement.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownloadPdf(settlement: OwnerSettlement) {
    try {
      setError('');
      const blob = await downloadBlob(`/settlements/owners/${settlement.id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${settlement.settlement_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download owner settlement PDF.');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading owner settlements...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Vendor Invoices</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Vendor billing summary</h2>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
          >
            Add Vendor Invoice
          </button>
        ) : null}
      </div>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {canManage ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Need help with these fields?</p>
              <p className="text-xs text-slate-500">Open the guide to see what each vendor billing field means.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowFieldHelp((current) => !current)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              {showFieldHelp ? 'Hide Info' : 'i Info'}
            </button>
          </div>
          {showFieldHelp ? (
            <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Vendor Invoice field guide</p>
              <p className="mt-2"><strong>Total trips:</strong> number of trips covered by this vendor bill.</p>
              <p><strong>Total KM:</strong> total distance covered by the vendor vehicle in this period.</p>
              <p><strong>Gross amount:</strong> bill value before deductions.</p>
              <p><strong>TDS amount:</strong> tax deducted at source from the vendor payment.</p>
              <p><strong>Other deductions:</strong> penalty, recovery, shortage, or any manual adjustment.</p>
              <p><strong>Net payable:</strong> final amount to pay after deductions.</p>
              <p className="mt-2 font-medium text-slate-900">Formula: Net payable = Gross amount - TDS - Other deductions</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <select
          value={filterOwnerId}
          onChange={(e) => setFilterOwnerId(e.target.value)}
          className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All Owners</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>{owner.name}</option>
          ))}
        </select>
        <select
          value={filterVehicleId}
          onChange={(e) => setFilterVehicleId(e.target.value)}
          className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All Vehicles</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_number}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="settled">Settled</option>
        </select>
        {(filterOwnerId || filterVehicleId || filterStatus !== 'all') ? (
          <button
            type="button"
            onClick={() => {
              setFilterOwnerId('');
              setFilterVehicleId('');
              setFilterStatus('all');
            }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Reset Filters
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
              <th className="px-4 py-3">Settlement #</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSettlements.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  {settlements.length === 0 ? 'No owner settlements yet.' : 'No settlements match the filters.'}
                </td>
              </tr>
            ) : null}
            {filteredSettlements.map((s, i) => (
              <tr
                key={s.id}
                className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setViewingItem(s)}
                    className="font-mono text-xs text-slate-500 hover:text-blue-600 hover:underline cursor-pointer text-left"
                  >
                    {s.settlement_number}
                  </button>
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {s.owner?.name ?? '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {s.vehicle?.vehicle_number ?? '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(s.period_from)} – {formatDate(s.period_to)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatCurrency(s.total_amount)}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {formatCurrency(s.net_amount)}
                </td>
                <td className="px-4 py-3 capitalize text-slate-600">
                  {s.status.replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {canManage ? (
                      <IconBtn icon={Pencil} label="Edit" onClick={() => startEdit(s)} disabled={deletingId === s.id} />
                    ) : null}
                    <IconBtn icon={FileDown} label="PDF" onClick={() => void handleDownloadPdf(s)} />
                    {canManage ? (
                      <IconBtn icon={Trash2} label="Delete" variant="danger" onClick={() => setDeleteTarget(s)} disabled={deletingId === s.id} />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!viewingItem && !editingId} onClose={() => setViewingItem(null)} title="View Vendor Invoice" size="lg">
        {viewingItem && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Settlement #</p>
              <p className="mt-1 text-slate-600">{viewingItem.settlement_number}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Owner/Vendor</p>
              <p className="mt-1 text-slate-600">{viewingItem.owner?.name ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Vehicle</p>
              <p className="mt-1 text-slate-600">{viewingItem.vehicle?.vehicle_number ?? '-'}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Period</p>
              <p className="mt-1 text-slate-600">{formatDate(viewingItem.period_from)} – {formatDate(viewingItem.period_to)}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Total Trips</p>
              <p className="mt-1 text-slate-600">{viewingItem.total_trips}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Total KM</p>
              <p className="mt-1 text-slate-600">{viewingItem.total_km}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Total Amount</p>
              <p className="mt-1 text-slate-600">{formatCurrency(viewingItem.total_amount)}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">TDS</p>
              <p className="mt-1 text-slate-600">{formatCurrency(viewingItem.tds_amount ?? 0)}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Other Deductions</p>
              <p className="mt-1 text-slate-600">{formatCurrency(viewingItem.other_deductions ?? 0)}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Net Amount</p>
              <p className="mt-1 text-slate-600 font-semibold">{formatCurrency(viewingItem.net_amount)}</p>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">Status</p>
              <p className="mt-1 text-slate-600">{viewingItem.status.replace(/_/g, ' ')}</p>
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
        title={editingId ? 'Edit Vendor Invoice' : 'Add Vendor Invoice'}
        size="xl"
        closeOnBackdrop={!saving}
        closeOnEsc={!saving}
      >
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-semibold text-slate-800">
            Vendor Invoice Number
            <input value={formState.settlement_number} onChange={(event) => setFormState((current) => ({ ...current, settlement_number: event.target.value }))} placeholder="e.g. VEN-0012" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Vendor
            <select value={formState.owner_id} onChange={(event) => setFormState((current) => ({ ...current, owner_id: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required>
              <option value="">Select vendor for this invoice</option>
              {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Vehicle
            <select value={formState.vehicle_id} onChange={(event) => setFormState((current) => ({ ...current, vehicle_id: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
              <option value="">Select vendor vehicle if applicable</option>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_number}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Period From
            <input type="date" value={formState.period_from} onChange={(event) => setFormState((current) => ({ ...current, period_from: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Period To
            <input type="date" value={formState.period_to} onChange={(event) => setFormState((current) => ({ ...current, period_to: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Payment Mode
            <select value={formState.payment_mode} onChange={(event) => setFormState((current) => ({ ...current, payment_mode: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Total Trips
            <input value={formState.total_trips} onChange={(event) => setFormState((current) => ({ ...current, total_trips: event.target.value }))} placeholder="e.g. 8" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Total KM
            <input value={formState.total_km} onChange={(event) => setFormState((current) => ({ ...current, total_km: event.target.value }))} placeholder="e.g. 2100" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Gross Amount
            <input value={formState.total_amount} onChange={(event) => setFormState((current) => ({ ...current, total_amount: event.target.value }))} placeholder="Bill amount before deductions" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            TDS Amount
            <input value={formState.tds_amount} onChange={(event) => setFormState((current) => ({ ...current, tds_amount: event.target.value }))} placeholder="Tax deducted at source" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Other Deductions
            <input value={formState.other_deductions} onChange={(event) => setFormState((current) => ({ ...current, other_deductions: event.target.value }))} placeholder="Recovery / penalty / manual adjustment" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Net Payable
            <input value={formState.net_amount} onChange={(event) => setFormState((current) => ({ ...current, net_amount: event.target.value }))} placeholder="Final amount payable to vendor" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Status
            <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <div className="xl:col-span-3 flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} disabled={saving} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700 disabled:opacity-60">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Saving...' : editingId ? 'Update Vendor Invoice' : 'Create Vendor Invoice'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Vendor Invoice"
        message={deleteTarget ? `Delete settlement ${deleteTarget.settlement_number}?` : ''}
        confirmLabel="Delete"
        loading={deleteTarget ? deletingId === deleteTarget.id : false}
      />
    </section>
  );
}
