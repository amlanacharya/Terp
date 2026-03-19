import { useEffect, useState } from 'react';
import { api, downloadBlob } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import {
  Customer,
  Driver,
  RateCalculationResult,
  Trip,
  TripCalculationResponse,
  TripDetail,
  TripSaveResponse,
  TripTravelMetric,
  Vehicle,
  VehicleCategory,
} from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';
import { DutySlipForm } from './DutySlipForm';

interface TripListProps {
  openTripId?: string | null;
  openTripInEditor?: boolean;
  onOpenTripHandled?: () => void;
}

type DutySlipPdfDownloadVariant = 'open_external' | 'closed_external' | 'internal';

export function TripList({ openTripId = null, openTripInEditor = false, onOpenTripHandled }: TripListProps) {
  const { profile } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<TripDetail | null>(null);
  const [editingTrip, setEditingTrip] = useState<TripDetail | null>(null);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [activeCalculation, setActiveCalculation] = useState<RateCalculationResult | null>(null);
  const [deleteTripTarget, setDeleteTripTarget] = useState<Trip | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metricSaving, setMetricSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [billing, setBilling] = useState(false);
  const [tripDeleting, setTripDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canManage = profile ? ['admin', 'manager', 'operator'].includes(profile.role) : false;

  async function loadTrips(filter: string) {
    const path = filter === 'all' ? '/trips' : `/trips?status=${encodeURIComponent(filter)}`;
    return api.get<Trip[]>(path);
  }

  async function loadTripDetail(tripId: string) {
    return api.get<TripDetail>(`/trips/${tripId}`);
  }

  async function hydratePage(filter: string) {
    try {
      setLoading(true);
      setError('');
      const [tripRows, customerRows, driverRows, vehicleRows, vehicleCategoryRows] = await Promise.all([
        loadTrips(filter),
        api.get<Customer[]>('/customers'),
        api.get<Driver[]>('/drivers'),
        api.get<Vehicle[]>('/vehicles'),
        api.get<VehicleCategory[]>('/vehicle-categories'),
      ]);
      setTrips(tripRows);
      setCustomers(customerRows);
      setDrivers(driverRows);
      setVehicles(vehicleRows);
      setVehicleCategories(vehicleCategoryRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trips.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void hydratePage(statusFilter);
  }, [statusFilter]);

  async function refreshTripData(tripId: string) {
    const [detail, tripRows] = await Promise.all([loadTripDetail(tripId), loadTrips(statusFilter)]);
    setTrips(tripRows);
    setSelectedTrip((current) => current?.id === tripId ? detail : current);
    setEditingTrip((current) => current?.id === tripId ? detail : current);
    return detail;
  }

  async function refreshEditingTrip() {
    if (!editingTrip?.id) {
      return;
    }

    await refreshTripData(editingTrip.id);
  }

  async function openTripById(tripId: string) {
    try {
      setError('');
      setNotice('');
      const detail = await loadTripDetail(tripId);
      setSelectedTrip(detail);
      return detail;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trip detail.');
      return null;
    }
  }

  useEffect(() => {
    if (!openTripId) {
      return;
    }

    const openRequestedTrip = async () => {
      const detail = await openTripById(openTripId);
      if (detail && openTripInEditor) {
        setEditingTrip(detail);
        setIsTripModalOpen(true);
      }
    };

    void openRequestedTrip().finally(() => {
      onOpenTripHandled?.();
    });
  }, [openTripId, openTripInEditor, onOpenTripHandled]);

  function openCreateTrip() {
    setError('');
    setNotice('');
    setActiveCalculation(null);
    setEditingTrip(null);
    setIsTripModalOpen(true);
  }

  function closeTripModal() {
    setEditingTrip(null);
    setIsTripModalOpen(false);
    setActiveCalculation(null);
  }

  async function startEdit(tripRow: Trip) {
    try {
      setError('');
      setNotice('');
      const detail = await loadTripDetail(tripRow.id);
      setSelectedTrip(detail);
      setEditingTrip(detail);
      setActiveCalculation(null);
      setIsTripModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trip detail.');
    }
  }

  async function handleSaveTrip(payload: Record<string, unknown>, tripId?: string) {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      let savedTrip: TripDetail;
      let warning: string | null | undefined;

      if (tripId) {
        savedTrip = await api.put<TripDetail>(`/trips/${tripId}`, payload);
      } else {
        const createdTrip = await api.post<TripSaveResponse>('/trips', payload);
        savedTrip = createdTrip;
        warning = createdTrip.warning;
      }

      setSelectedTrip(savedTrip);
      setEditingTrip(savedTrip);
      setIsTripModalOpen(true);
      setActiveCalculation(null);
      setTrips(await loadTrips(statusFilter));
      const baseNotice = tripId ? 'Trip updated.' : 'Trip created.';
      setNotice(warning ? `${baseNotice} ${warning}` : baseNotice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save trip.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMetric(action: Promise<TripTravelMetric[]>, tripId: string) {
    setMetricSaving(true);
    setError('');

    try {
      await action;
      await refreshTripData(tripId);
      setActiveCalculation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save travel metric.');
    } finally {
      setMetricSaving(false);
    }
  }

  async function handleCalculate(tripId: string, payload: { package_code?: string | null; force_sync_trip_amount?: boolean }) {
    setCalculating(true);
    setError('');
    setNotice('');

    try {
      const response = await api.post<TripCalculationResponse>(`/trips/${tripId}/calculate`, payload);
      setSelectedTrip(response.trip);
      setEditingTrip((current) => current?.id === tripId ? response.trip : current);
      setActiveCalculation(response.calculation);
      setTrips(await loadTrips(statusFilter));
      setNotice('Trip calculated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to calculate trip.');
    } finally {
      setCalculating(false);
    }
  }

  async function handleDirectBill(tripId: string) {
    setBilling(true);
    setError('');
    setNotice('');

    try {
      const invoice = await api.post<{ invoice_number: string }>(`/trips/${tripId}/bill`, {});
      await refreshTripData(tripId);
      setNotice(`Invoice ${invoice.invoice_number} created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to bill trip.');
    } finally {
      setBilling(false);
    }
  }

  async function handleDownloadPdf(tripId: string, variant?: DutySlipPdfDownloadVariant) {
    try {
      setError('');
      const tripForFilename = editingTrip?.id === tripId
        ? editingTrip
        : selectedTrip?.id === tripId
          ? selectedTrip
          : null;
      const query = variant ? `?variant=${encodeURIComponent(variant)}` : '';
      const blob = await downloadBlob(`/trips/${tripId}/duty-slip-pdf${query}`);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const effectiveVariant = variant ?? (tripForFilename?.status === 'completed' ? 'closed_external' : 'open_external');
      const suffix = effectiveVariant === 'internal'
        ? 'duty-slip-internal'
        : effectiveVariant === 'closed_external'
          ? 'duty-slip-external-closed'
          : 'duty-slip-external-open';
      anchor.href = url;
      anchor.download = `${tripForFilename?.trip_number ?? tripId}-${suffix}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download duty slip PDF.');
    }
  }

  async function handleDeleteTripConfirm() {
    if (!deleteTripTarget) {
      return;
    }

    setTripDeleting(true);
    setError('');
    setNotice('');

    try {
      await api.delete(`/trips/${deleteTripTarget.id}`);
      if (selectedTrip?.id === deleteTripTarget.id) {
        setSelectedTrip(null);
      }
      if (editingTrip?.id === deleteTripTarget.id) {
        closeTripModal();
      }
      setDeleteTripTarget(null);
      setTrips(await loadTrips(statusFilter));
      setNotice('Trip deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete trip.');
    } finally {
      setTripDeleting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading trips...</p>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Trips</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Duty slip operations</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-600">
            Status filter
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-2 block rounded-2xl border border-slate-300 px-4 py-2">
              <option value="all">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          {canManage ? <button type="button" onClick={openCreateTrip} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700">New Duty Slip</button> : null}
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{notice}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Parent Duty Slips</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Live duty slip register</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Trip</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Billing</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {trips.map((tripRow) => {
                  const billingLabel = tripRow.parent_trip_id
                    ? 'Child'
                    : tripRow.direct_invoice_id
                      ? 'Direct billed'
                      : Number(tripRow.billed_annexure_count ?? 0) > 0
                        ? `${tripRow.billed_annexure_count}/${tripRow.annexure_count ?? 0} annexures billed`
                        : Number(tripRow.annexure_count ?? 0) > 0
                          ? `${tripRow.annexure_count} annexures`
                          : 'Pending';

                  return (
                    <tr key={tripRow.id} className={selectedTrip?.id === tripRow.id ? 'bg-sky-50/70' : ''}>
                      <td className="px-4 py-3"><button type="button" onClick={() => void openTripById(tripRow.id)} className="text-left font-medium text-slate-900 underline-offset-4 hover:underline">{tripRow.trip_number}</button></td>
                      <td className="px-4 py-3 text-slate-700">{tripRow.customer.name}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(tripRow.trip_date)}</td>
                      <td className="px-4 py-3 text-slate-700">{tripRow.from_location} to {tripRow.to_location}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{tripRow.status}</span></td>
                      <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(tripRow.trip_amount)}</td>
                      <td className="px-4 py-3 text-slate-600">{billingLabel}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => void openTripById(tripRow.id)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Open</button>
                          {canManage ? <button type="button" onClick={() => void startEdit(tripRow)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Edit</button> : null}
                          {canManage ? <button type="button" onClick={() => setDeleteTripTarget(tripRow)} className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">Delete</button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {trips.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No parent duty slips matched the current filter.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-sky-600">Selected Trip</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedTrip?.trip_number ?? 'No trip selected'}</h3>
            <p className="mt-1 text-sm text-slate-500">{selectedTrip ? selectedTrip.customer.name : 'Open a duty slip from the list to review billing status and edit it.'}</p>
          </div>

          {selectedTrip ? (
            <>
              <dl className="grid gap-4 text-sm text-slate-600 md:grid-cols-2">
                <div>
                  <dt className="font-medium text-slate-500">Trip Date</dt>
                  <dd>{formatDate(selectedTrip.trip_date)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Duty Type</dt>
                  <dd>{selectedTrip.duty_type ?? '-'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Vehicle</dt>
                  <dd>{selectedTrip.vehicle.vehicle_number}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Driver</dt>
                  <dd>{selectedTrip.driver.name}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Route</dt>
                  <dd>{selectedTrip.from_location} to {selectedTrip.to_location}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Status</dt>
                  <dd>{selectedTrip.status}</dd>
                </div>
              </dl>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Trip Amount
                  <div className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(selectedTrip.trip_amount)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Calculated Amount
                  <div className="mt-1 text-lg font-semibold text-slate-900">{selectedTrip.calculated_amount == null ? '-' : formatCurrency(Number(selectedTrip.calculated_amount))}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Direct Invoice
                  <div className="mt-1 font-semibold text-slate-900">{selectedTrip.direct_invoice_id ? 'Created' : 'Not billed'}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Annexures
                  <div className="mt-1 font-semibold text-slate-900">{selectedTrip.billed_annexure_count ?? 0} / {selectedTrip.annexure_count ?? 0} billed</div>
                </div>
              </div>

              {selectedTrip.parent_trip ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">This trip is linked to parent trip {selectedTrip.parent_trip.trip_number}. Billing is controlled from the parent duty slip.</div> : null}

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => void handleDownloadPdf(selectedTrip.id)} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700">Duty Slip PDF</button>
                <button type="button" onClick={() => void handleDownloadPdf(selectedTrip.id, 'internal')} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700">Internal PDF</button>
                {canManage ? <button type="button" onClick={() => void startEdit(selectedTrip)} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">Edit Duty Slip</button> : null}
                {canManage && !selectedTrip.parent_trip && !selectedTrip.direct_invoice_id && Number(selectedTrip.annexure_count ?? 0) === 0 ? <button type="button" disabled={billing || Number(selectedTrip.trip_amount ?? 0) <= 0} onClick={() => void handleDirectBill(selectedTrip.id)} className="rounded-2xl border border-sky-300 px-5 py-3 text-sm font-medium text-sky-700 disabled:opacity-60">{billing ? 'Billing...' : 'Bill Trip'}</button> : null}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">Open a duty slip to review it or launch the tabbed editor.</div>
          )}
        </section>
      </div>

      {canManage ? (
        <Modal
          isOpen={isTripModalOpen}
          onClose={saving || metricSaving || calculating ? () => undefined : closeTripModal}
          title={editingTrip ? `Edit ${editingTrip.trip_number}` : 'New Duty Slip'}
          size="xl"
          closeOnBackdrop={!saving && !metricSaving && !calculating}
          closeOnEsc={!saving && !metricSaving && !calculating}
        >
          <DutySlipForm
            trip={editingTrip}
            customers={customers}
            drivers={drivers}
            vehicles={vehicles}
            vehicleCategories={vehicleCategories}
            saving={saving}
            metricSaving={metricSaving}
            calculating={calculating}
            canManage={canManage}
            onSave={handleSaveTrip}
            onAddMetric={(tripId, payload) => handleSaveMetric(api.post<TripTravelMetric[]>(`/trips/${tripId}/travel-metrics`, payload), tripId)}
            onUpdateMetric={(tripId, metricId, payload) => handleSaveMetric(api.put<TripTravelMetric[]>(`/trips/${tripId}/travel-metrics/${metricId}`, payload), tripId)}
            onDeleteMetric={(tripId, metricId) => handleSaveMetric(api.delete<TripTravelMetric[]>(`/trips/${tripId}/travel-metrics/${metricId}`), tripId)}
            onCalculate={handleCalculate}
            onDownloadPdf={handleDownloadPdf}
            onRefreshTrip={refreshEditingTrip}
            activeCalculation={activeCalculation}
          />
        </Modal>
      ) : null}

      <ConfirmModal
        isOpen={deleteTripTarget !== null}
        onClose={() => setDeleteTripTarget(null)}
        onConfirm={handleDeleteTripConfirm}
        title="Delete Trip"
        message={deleteTripTarget ? `Delete duty slip ${deleteTripTarget.trip_number}?` : ''}
        confirmLabel="Delete"
        loading={tripDeleting}
      />
    </section>
  );
}

