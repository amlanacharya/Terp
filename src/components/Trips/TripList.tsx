import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
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
import { IconBtn } from '../Layout/IconBtn';
import { Pagination, usePaginationState } from '../Layout/Pagination';
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
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterDriverId, setFilterDriverId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metricSaving, setMetricSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [billing, setBilling] = useState(false);
  const [tripDeleting, setTripDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const { currentPage, setCurrentPage, pageSize, handlePageSizeChange } = usePaginationState('trips');

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

  const visibleTrips = useMemo(
    () =>
      trips.filter((trip) => {
        const normalizedTripDate = trip.trip_date.slice(0, 10);

        if (filterCustomerId && trip.customer_id !== filterCustomerId) {
          return false;
        }
        if (filterDriverId && trip.driver_id !== filterDriverId) {
          return false;
        }
        if (dateFrom && normalizedTripDate < dateFrom) {
          return false;
        }
        if (dateTo && normalizedTripDate > dateTo) {
          return false;
        }

        return true;
      }),
    [dateFrom, dateTo, filterCustomerId, filterDriverId, trips]
  );

  const paginatedTrips = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return visibleTrips.slice(start, start + pageSize);
  }, [visibleTrips, currentPage, pageSize]);

  const visibleCustomers = useMemo(
    () => customers.filter((customer) => trips.some((trip) => trip.customer_id === customer.id) || customer.id === filterCustomerId),
    [customers, filterCustomerId, trips]
  );
  const visibleDrivers = useMemo(
    () => drivers.filter((driver) => trips.some((trip) => trip.driver_id === driver.id) || driver.id === filterDriverId),
    [drivers, filterDriverId, trips]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCustomerId, filterDriverId, dateFrom, dateTo]);

  function clearFilters() {
    setFilterCustomerId('');
    setFilterDriverId('');
    setDateFrom('');
    setDateTo('');
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCustomerId, filterDriverId, dateFrom, dateTo, setCurrentPage]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading trips...</p>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Duty Slips</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Live duty slip register</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-600">
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-2 block rounded-2xl border border-slate-300 px-4 py-2">
              <option value="all">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Customer
            <select value={filterCustomerId} onChange={(event) => setFilterCustomerId(event.target.value)} className="mt-2 block rounded-2xl border border-slate-300 px-4 py-2">
              <option value="">All customers</option>
              {visibleCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Driver
            <select value={filterDriverId} onChange={(event) => setFilterDriverId(event.target.value)} className="mt-2 block rounded-2xl border border-slate-300 px-4 py-2">
              <option value="">All drivers</option>
              {visibleDrivers.map((driver) => (
                <option key={driver.id} value={driver.id}>{driver.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Date From
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-2 block rounded-2xl border border-slate-300 px-4 py-2" />
          </label>
          <label className="text-sm text-slate-600">
            Date To
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-2 block rounded-2xl border border-slate-300 px-4 py-2" />
          </label>
          <button type="button" onClick={clearFilters} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700">
            Clear Filters
          </button>
          {canManage ? <button type="button" onClick={openCreateTrip} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">New Duty Slip</button> : null}
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{notice}</div> : null}

      {selectedTrip ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-sky-600">Selected Duty Slip</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedTrip.trip_number}</h3>
              <p className="mt-1 text-sm text-slate-500">{selectedTrip.customer.name} - {selectedTrip.from_location} to {selectedTrip.to_location}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void handleDownloadPdf(selectedTrip.id)} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Duty Slip PDF</button>
              <button type="button" onClick={() => void handleDownloadPdf(selectedTrip.id, 'internal')} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Internal PDF</button>
              {canManage ? <button type="button" onClick={() => void startEdit(selectedTrip)} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Edit Duty Slip</button> : null}
              {canManage && !selectedTrip.parent_trip && !selectedTrip.direct_invoice_id && Number(selectedTrip.annexure_count ?? 0) === 0 ? <button type="button" disabled={billing || Number(selectedTrip.trip_amount ?? 0) <= 0} onClick={() => void handleDirectBill(selectedTrip.id)} className="rounded-2xl border border-sky-300 px-4 py-2 text-sm font-medium text-sky-700 disabled:opacity-60">{billing ? 'Billing...' : 'Bill Trip'}</button> : null}
              <button type="button" onClick={() => setSelectedTrip(null)} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Clear</button>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Trip Date
              <div className="mt-1 font-semibold text-slate-900">{formatDate(selectedTrip.trip_date)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Driver
              <div className="mt-1 font-semibold text-slate-900">{selectedTrip.driver.name}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Vehicle
              <div className="mt-1 font-semibold text-slate-900">{selectedTrip.vehicle.vehicle_number}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Status
              <div className="mt-1 font-semibold text-slate-900">{selectedTrip.status}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Trip Amount
              <div className="mt-1 font-semibold text-slate-900">{formatCurrency(selectedTrip.trip_amount)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Annexures
              <div className="mt-1 font-semibold text-slate-900">{selectedTrip.billed_annexure_count ?? 0} / {selectedTrip.annexure_count ?? 0} billed</div>
            </div>
          </div>
          {selectedTrip.parent_trip ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">This trip is linked to parent trip {selectedTrip.parent_trip.trip_number}. Billing is controlled from the parent duty slip.</div> : null}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Duty Slips</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Duty Slip Register</h3>
          </div>
          <div className="text-sm text-slate-500">Showing {visibleTrips.length} of {trips.length} duty slips</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Trip</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedTrips.map((tripRow) => {
                return (
                  <tr key={tripRow.id} className={selectedTrip?.id === tripRow.id ? 'bg-sky-50/70' : ''}>
                    <td className="px-4 py-3"><button type="button" onClick={() => void openTripById(tripRow.id)} className="text-left font-medium text-slate-900 underline-offset-4 hover:underline">{tripRow.trip_number}</button></td>
                    <td className="px-4 py-3 text-slate-700">{tripRow.customer.name}</td>
                    <td className="px-4 py-3 text-slate-700">{tripRow.driver.name}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(tripRow.trip_date)}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{tripRow.status}</span></td>
                    <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(tripRow.trip_amount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <IconBtn icon={Eye} label="Open" onClick={() => void openTripById(tripRow.id)} />
                        {canManage ? <IconBtn icon={Pencil} label="Edit" onClick={() => void startEdit(tripRow)} /> : null}
                        {canManage ? <IconBtn icon={Trash2} label="Delete" variant="danger" onClick={() => setDeleteTripTarget(tripRow)} /> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedTrips.length === 0 && visibleTrips.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No parent duty slips matched the current filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <Pagination
          totalItems={visibleTrips.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </section>

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
