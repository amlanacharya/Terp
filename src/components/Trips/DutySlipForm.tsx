import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { ConfirmModal } from '../Layout/ConfirmModal';
import {
  Customer,
  Driver,
  DutyType,
  RateCalculationResult,
  RateChart,
  TripDetail,
  TripTravelMetric,
  Vehicle,
  VehicleCategory,
} from '../../lib/types';
import { DutySlipAnnexuresTab } from './DutySlipAnnexuresTab';
import { DutySlipExpensesTab } from './DutySlipExpensesTab';
import { DutySlipRateTab } from './DutySlipRateTab';

type DutySlipPdfDownloadVariant = 'open_external' | 'closed_external' | 'internal';
type DutySlipTabKey = 'details' | 'charges' | 'rate' | 'expenses' | 'annexures';

interface DutySlipFormProps {
  trip: TripDetail | null;
  customers: Customer[];
  drivers: Driver[];
  vehicles: Vehicle[];
  vehicleCategories: VehicleCategory[];
  saving: boolean;
  metricSaving: boolean;
  calculating: boolean;
  canManage: boolean;
  onSave: (payload: Record<string, unknown>, tripId?: string) => Promise<void>;
  onAddMetric: (tripId: string, payload: Record<string, unknown>) => Promise<void>;
  onUpdateMetric: (tripId: string, metricId: string, payload: Record<string, unknown>) => Promise<void>;
  onDeleteMetric: (tripId: string, metricId: string) => Promise<void>;
  onCalculate: (tripId: string, payload: { package_code?: string | null; force_sync_trip_amount?: boolean }) => Promise<void>;
  onDownloadPdf: (tripId: string, variant?: DutySlipPdfDownloadVariant) => Promise<void>;
  onRefreshTrip: () => Promise<void>;
  activeCalculation: RateCalculationResult | null;
}

interface DutySlipFormState {
  trip_number: string;
  customer_id: string;
  vehicle_id: string;
  driver_id: string;
  trip_date: string;
  duty_type: '' | DutyType;
  booked_by: string;
  report_to: string;
  vehicle_category_id: string;
  package_code: string;
  from_location: string;
  to_location: string;
  purpose: string;
  passengers: string;
  status: string;
  trip_amount: string;
  night_halts: string;
  advance_hirer: string;
  advance_travels: string;
  fuel_advance: string;
  cash_advance: string;
  driver_allowance: string;
  toll_charges: string;
  parking_charges: string;
  other_charges: string;
  remarks: string;
}

interface MetricFormState {
  seq: string;
  start_date: string;
  start_time: string;
  start_km: string;
  end_date: string;
  end_time: string;
  end_km: string;
}

const dutyTypeOptions: Array<{ value: DutyType; label: string }> = [
  { value: 'local', label: 'Local' },
  { value: 'outstation', label: 'Outstation' },
  { value: 'drop_pickup', label: 'Drop / Pickup' },
  { value: 'station_drop', label: 'Station Drop' },
  { value: 'long', label: 'Long' },
];

const tabs: Array<{ key: DutySlipTabKey; label: string }> = [
  { key: 'details', label: 'Details' },
  { key: 'charges', label: 'Charges' },
  { key: 'rate', label: 'Rate Breakdown' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'annexures', label: 'Annexures' },
];

function toStringValue(value: unknown, fallback = ''): string {
  return value === null || value === undefined ? fallback : String(value);
}

function toNumberOrNull(value: string): number | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const numericValue = Number(trimmedValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toIntegerOrNull(value: string): number | null {
  const numericValue = toNumberOrNull(value);
  return numericValue === null ? null : Math.trunc(numericValue);
}

function buildFormState(trip: TripDetail | null): DutySlipFormState {
  return {
    trip_number: trip?.trip_number ?? '',
    customer_id: trip?.customer_id ?? '',
    vehicle_id: trip?.vehicle_id ?? '',
    driver_id: trip?.driver_id ?? '',
    trip_date: trip?.trip_date?.slice(0, 10) ?? '',
    duty_type: trip?.duty_type ?? '',
    booked_by: trip?.booked_by ?? '',
    report_to: trip?.report_to ?? '',
    vehicle_category_id: trip?.vehicle_category_id ?? '',
    package_code: trip?.rate_chart_item?.package_code ?? '',
    from_location: trip?.from_location ?? '',
    to_location: trip?.to_location ?? '',
    purpose: trip?.purpose ?? '',
    passengers: toStringValue(trip?.passengers),
    status: trip?.status ?? 'scheduled',
    trip_amount: trip ? toStringValue(trip.trip_amount, '0') : '',
    night_halts: toStringValue(trip?.night_halts),
    advance_hirer: toStringValue(trip?.advance_hirer, '0'),
    advance_travels: toStringValue(trip?.advance_travels, '0'),
    fuel_advance: toStringValue(trip?.fuel_advance, '0'),
    cash_advance: toStringValue(trip?.cash_advance, '0'),
    driver_allowance: toStringValue(trip?.driver_allowance, '0'),
    toll_charges: toStringValue(trip?.toll_charges, '0'),
    parking_charges: toStringValue(trip?.parking_charges, '0'),
    other_charges: toStringValue(trip?.other_charges, '0'),
    remarks: trip?.remarks ?? '',
  };
}

function buildMetricFormState(trip: TripDetail | null, metric?: TripTravelMetric | null): MetricFormState {
  const nextSeq = trip?.metrics.length ? Math.max(...trip.metrics.map((item) => item.seq)) + 1 : 1;

  return {
    seq: toStringValue(metric?.seq, String(nextSeq)),
    start_date: metric?.start_date ?? trip?.trip_date?.slice(0, 10) ?? '',
    start_time: metric?.start_time ?? '',
    start_km: toStringValue(metric?.start_km),
    end_date: metric?.end_date ?? '',
    end_time: metric?.end_time ?? '',
    end_km: toStringValue(metric?.end_km),
  };
}

function formatMetricHours(value: number | null): string {
  return value == null ? '-' : `${value.toFixed(2)} hrs`;
}

function formatMetricKm(value: number | null): string {
  return value == null ? '-' : `${value.toFixed(2)} km`;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm font-semibold text-slate-800">
      {label}
      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal text-slate-600">{value}</div>
    </div>
  );
}

export function DutySlipForm({
  trip,
  customers,
  drivers,
  vehicles,
  vehicleCategories,
  saving,
  metricSaving,
  calculating,
  canManage,
  onSave,
  onAddMetric,
  onUpdateMetric,
  onDeleteMetric,
  onCalculate,
  onDownloadPdf,
  onRefreshTrip,
  activeCalculation,
}: DutySlipFormProps) {
  const [formState, setFormState] = useState<DutySlipFormState>(() => buildFormState(trip));
  const [metricState, setMetricState] = useState<MetricFormState>(() => buildMetricFormState(trip));
  const [activeTab, setActiveTab] = useState<DutySlipTabKey>('details');
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null);
  const [metricDeleteTarget, setMetricDeleteTarget] = useState<TripTravelMetric | null>(null);
  const [activeRateChart, setActiveRateChart] = useState<RateChart | null>(null);
  const [loadingRateChart, setLoadingRateChart] = useState(false);
  const [rateChartError, setRateChartError] = useState('');
  const [syncTripAmount, setSyncTripAmount] = useState(true);

  useEffect(() => {
    setFormState(buildFormState(trip));
    setActiveTab('details');
    const shouldSync = trip?.calculated_amount == null
      ? Number(trip?.trip_amount ?? 0) === 0
      : Number(trip?.trip_amount ?? 0) === Number(trip.calculated_amount);
    setSyncTripAmount(shouldSync);
  }, [trip?.id]);

  useEffect(() => {
    setMetricState(buildMetricFormState(trip));
    setEditingMetricId(null);
  }, [trip?.id, trip?.metrics.length]);

  useEffect(() => {
    if (!formState.customer_id || !formState.trip_date) {
      setActiveRateChart(null);
      setRateChartError('');
      return;
    }

    let isCancelled = false;
    setLoadingRateChart(true);
    setRateChartError('');

    api
      .get<RateChart>(`/customers/${formState.customer_id}/rate-chart?date=${encodeURIComponent(formState.trip_date)}`)
      .then((chart) => {
        if (isCancelled) {
          return;
        }
        setActiveRateChart(chart);
      })
      .catch((error: Error) => {
        if (isCancelled) {
          return;
        }
        setActiveRateChart(null);
        setRateChartError(error.message);
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingRateChart(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [formState.customer_id, formState.trip_date]);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === formState.vehicle_id) ?? null,
    [formState.vehicle_id, vehicles]
  );
  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === formState.driver_id) ?? null,
    [drivers, formState.driver_id]
  );
  const driverDefaultVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedDriver?.default_vehicle_id) ?? null,
    [selectedDriver?.default_vehicle_id, vehicles]
  );
  const vehicleMappedCategory = selectedVehicle?.vehicle_category ?? null;
  const hasMappedVehicleCategory = Boolean(vehicleMappedCategory?.id);
  const totalMetricKm = (trip?.metrics ?? []).reduce((sum, metric) => sum + (metric.segment_km ?? 0), 0);
  const totalMetricHours = (trip?.metrics ?? []).reduce((sum, metric) => sum + (metric.segment_hours ?? 0), 0);
  const hasIncompleteMetrics = (trip?.metrics ?? []).some((metric) => !metric.is_complete);
  const tripExists = Boolean(trip?.id);

  const availableCustomers = useMemo(
    () => customers.filter((customer) => customer.is_active !== false || customer.id === formState.customer_id),
    [customers, formState.customer_id]
  );
  const availableVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.is_active !== false || vehicle.id === formState.vehicle_id),
    [vehicles, formState.vehicle_id]
  );
  const availableDrivers = useMemo(
    () => drivers.filter((driver) => driver.is_active !== false || driver.id === formState.driver_id),
    [drivers, formState.driver_id]
  );

  const packageOptions = useMemo(() => {
    if (!activeRateChart || !formState.vehicle_category_id || !formState.duty_type) {
      return [];
    }

    return activeRateChart.items.filter(
      (item) => item.vehicle_category_id === formState.vehicle_category_id && item.duty_type === formState.duty_type
    );
  }, [activeRateChart, formState.vehicle_category_id, formState.duty_type]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSave(
      {
        customer_id: formState.customer_id,
        vehicle_id: formState.vehicle_id,
        driver_id: formState.driver_id,
        trip_date: formState.trip_date,
        duty_type: formState.duty_type || null,
        booked_by: formState.booked_by || null,
        report_to: formState.report_to || null,
        vehicle_category_id: formState.vehicle_category_id || null,
        from_location: formState.from_location,
        to_location: formState.to_location,
        purpose: formState.purpose || null,
        passengers: toIntegerOrNull(formState.passengers),
        status: formState.status,
        trip_amount: Number(formState.trip_amount || 0),
        night_halts: toIntegerOrNull(formState.night_halts),
        advance_hirer: Number(formState.advance_hirer || 0),
        advance_travels: Number(formState.advance_travels || 0),
        fuel_advance: Number(formState.fuel_advance || 0),
        cash_advance: Number(formState.cash_advance || 0),
        driver_allowance: Number(formState.driver_allowance || 0),
        toll_charges: Number(formState.toll_charges || 0),
        parking_charges: Number(formState.parking_charges || 0),
        other_charges: Number(formState.other_charges || 0),
        remarks: formState.remarks || null,
      },
      trip?.id
    );
  }

  async function handleMetricSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trip?.id) {
      return;
    }

    const payload = {
      seq: Number(metricState.seq),
      start_date: metricState.start_date,
      start_time: metricState.start_time,
      start_km: Number(metricState.start_km),
      end_date: metricState.end_date || null,
      end_time: metricState.end_time || null,
      end_km: metricState.end_km ? Number(metricState.end_km) : null,
    };

    if (editingMetricId) {
      await onUpdateMetric(trip.id, editingMetricId, payload);
    } else {
      await onAddMetric(trip.id, payload);
    }
  }

  async function handleDeleteMetricConfirm() {
    if (!trip?.id || !metricDeleteTarget) {
      return;
    }

    await onDeleteMetric(trip.id, metricDeleteTarget.id);
    setMetricDeleteTarget(null);
  }

  function renderPrimaryActions() {
    return (
      <div className="flex flex-wrap gap-3">
        {canManage ? (
          <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
            {saving ? 'Saving...' : trip ? 'Update Duty Slip' : 'Create Duty Slip'}
          </button>
        ) : null}
        {trip?.id ? (
          <>
            {canManage ? (
              <label className="flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={syncTripAmount} onChange={(event) => setSyncTripAmount(event.target.checked)} />
                Sync billed amount on calculate
              </label>
            ) : null}
            {canManage ? (
              <button
                type="button"
                disabled={calculating || hasIncompleteMetrics || !trip.metrics.length}
                onClick={() => void onCalculate(trip.id, { package_code: formState.package_code || null, force_sync_trip_amount: syncTripAmount })}
                className="rounded-2xl border border-sky-300 px-5 py-3 text-sm font-medium text-sky-700 disabled:opacity-60"
              >
                {calculating ? 'Calculating...' : 'Calculate'}
              </button>
            ) : null}
            <button type="button" onClick={() => void onDownloadPdf(trip.id)} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700">Duty Slip PDF</button>
            <button type="button" onClick={() => void onDownloadPdf(trip.id, 'internal')} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700">Internal PDF</button>
          </>
        ) : null}
      </div>
    );
  }

  function renderMetricSection() {
    return (
      <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Travel Metrics</p>
            <h4 className="mt-2 text-xl font-semibold text-slate-900">Movement rows</h4>
          </div>
          <div className="text-right text-sm text-slate-600">
            <div>Total KM: <span className="font-semibold text-slate-900">{formatMetricKm(totalMetricKm)}</span></div>
            <div>Total Hours: <span className="font-semibold text-slate-900">{formatMetricHours(totalMetricHours)}</span></div>
          </div>
        </div>

        {trip?.id ? (
          <form onSubmit={handleMetricSubmit} className="grid gap-4 lg:grid-cols-4">
            <label className="text-sm font-semibold text-slate-800">Seq<input type="number" min="1" step="1" value={metricState.seq} onChange={(event) => setMetricState((current) => ({ ...current, seq: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
            <label className="text-sm font-semibold text-slate-800">Start Date<input type="date" value={metricState.start_date} onChange={(event) => setMetricState((current) => ({ ...current, start_date: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
            <label className="text-sm font-semibold text-slate-800">Start Time<input type="time" value={metricState.start_time} onChange={(event) => setMetricState((current) => ({ ...current, start_time: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
            <label className="text-sm font-semibold text-slate-800">Start KM<input type="number" min="0" step="0.01" value={metricState.start_km} onChange={(event) => setMetricState((current) => ({ ...current, start_km: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
            <label className="text-sm font-semibold text-slate-800">End Date<input type="date" value={metricState.end_date} onChange={(event) => setMetricState((current) => ({ ...current, end_date: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-800">End Time<input type="time" value={metricState.end_time} onChange={(event) => setMetricState((current) => ({ ...current, end_time: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-800">End KM<input type="number" min="0" step="0.01" value={metricState.end_km} onChange={(event) => setMetricState((current) => ({ ...current, end_km: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <div className="flex gap-3 self-end">
              {canManage ? <button type="submit" disabled={metricSaving} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">{metricSaving ? 'Saving...' : editingMetricId ? 'Update Row' : 'Add Row'}</button> : null}
              {editingMetricId ? <button type="button" onClick={() => { setEditingMetricId(null); setMetricState(buildMetricFormState(trip)); }} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700">Cancel</button> : null}
            </div>
          </form>
        ) : (
          <p className="text-sm text-slate-500">Create the duty slip first, then add travel metrics and run calculation.</p>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-4 py-3">Seq</th><th className="px-4 py-3">Start</th><th className="px-4 py-3">End</th><th className="px-4 py-3">Segment KM</th><th className="px-4 py-3">Segment Hours</th>{canManage ? <th className="px-4 py-3">Action</th> : null}</tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {(trip?.metrics ?? []).map((metric) => (
                <tr key={metric.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{metric.seq}</td>
                  <td className="px-4 py-3 text-slate-600">{metric.start_date} {metric.start_time}<div className="text-xs text-slate-500">KM {metric.start_km}</div></td>
                  <td className="px-4 py-3 text-slate-600">{metric.end_date && metric.end_time ? `${metric.end_date} ${metric.end_time}` : 'Open'}<div className="text-xs text-slate-500">KM {metric.end_km ?? '-'}</div></td>
                  <td className="px-4 py-3 text-slate-600">{formatMetricKm(metric.segment_km)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatMetricHours(metric.segment_hours)}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => { setEditingMetricId(metric.id); setMetricState(buildMetricFormState(trip, metric)); }} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Edit</button>
                      <button type="button" onClick={() => setMetricDeleteTarget(metric)} className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">Delete</button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!(trip?.metrics.length) ? <tr><td colSpan={canManage ? 6 : 5} className="px-4 py-6 text-center text-slate-500">No travel metrics added yet.</td></tr> : null}
            </tbody>
          </table>
        </div>

        {hasIncompleteMetrics ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Complete all metric rows before running calculation.</div> : null}
        {activeCalculation ? <p className="text-sm text-slate-500">Latest calculation: {formatCurrency(activeCalculation.totals.final_amount)}</p> : null}
      </section>
    );
  }

  function renderDetailsTab() {
    return (
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="text-sm font-semibold text-slate-800">Duty Slip Number<input value={trip ? formState.trip_number : 'Auto-generated on save'} readOnly className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 font-normal text-slate-500" /></label>
          <label className="text-sm font-semibold text-slate-800">Trip Date<input type="date" value={formState.trip_date} onChange={(event) => setFormState((current) => ({ ...current, trip_date: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
          <label className="text-sm font-semibold text-slate-800">Status<select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
          <label className="text-sm font-semibold text-slate-800">Duty Type<select value={formState.duty_type} onChange={(event) => setFormState((current) => ({ ...current, duty_type: event.target.value as DutyType | '' }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"><option value="">Select duty type</option>{dutyTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-800">Customer<select value={formState.customer_id} onChange={(event) => setFormState((current) => ({ ...current, customer_id: event.target.value, package_code: '' }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required><option value="">Select customer</option>{availableCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.is_active === false ? ' (Inactive)' : ''}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-800">Vehicle<select value={formState.vehicle_id} onChange={(event) => { const nextVehicleId = event.target.value; const nextVehicle = vehicles.find((vehicle) => vehicle.id === nextVehicleId) ?? null; setFormState((current) => ({ ...current, vehicle_id: nextVehicleId, vehicle_category_id: nextVehicle?.vehicle_category?.id ?? '', package_code: '' })); }} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required><option value="">Select vehicle</option>{availableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_number}{vehicle.is_active === false ? ' (Inactive)' : ''}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-800">Driver<select value={formState.driver_id} onChange={(event) => setFormState((current) => ({ ...current, driver_id: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required><option value="">Select driver</option>{availableDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}{driver.is_active === false ? ' (Inactive)' : ''}</option>)}</select></label>
          {hasMappedVehicleCategory ? (
            <ReadOnlyField label="GT Category" value={vehicleMappedCategory?.name ?? 'Not mapped'} />
          ) : (
            <label className="text-sm font-semibold text-slate-800">GT Category<select value={formState.vehicle_category_id} onChange={(event) => setFormState((current) => ({ ...current, vehicle_category_id: event.target.value, package_code: '' }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"><option value="">Not mapped</option>{vehicleCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          )}
          <ReadOnlyField label="Vehicle Brand" value={selectedVehicle?.make ?? '-'} />
          <ReadOnlyField label="Vehicle Model" value={selectedVehicle?.model ?? '-'} />
          <ReadOnlyField label="Driver Default Vehicle" value={driverDefaultVehicle?.vehicle_number ?? '-'} />
          <label className="text-sm font-semibold text-slate-800">Booked By<input value={formState.booked_by} onChange={(event) => setFormState((current) => ({ ...current, booked_by: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">Report To<input value={formState.report_to} onChange={(event) => setFormState((current) => ({ ...current, report_to: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">From Location<input value={formState.from_location} onChange={(event) => setFormState((current) => ({ ...current, from_location: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
          <label className="text-sm font-semibold text-slate-800">To Location<input value={formState.to_location} onChange={(event) => setFormState((current) => ({ ...current, to_location: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
          <label className="text-sm font-semibold text-slate-800">Passengers<input type="number" min="0" step="1" value={formState.passengers} onChange={(event) => setFormState((current) => ({ ...current, passengers: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">Purpose<input value={formState.purpose} onChange={(event) => setFormState((current) => ({ ...current, purpose: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
        </div>

        <label className="block text-sm font-semibold text-slate-800">Remarks<textarea value={formState.remarks} onChange={(event) => setFormState((current) => ({ ...current, remarks: event.target.value }))} rows={3} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>

        {renderPrimaryActions()}
      </form>
    );
  }

  function renderChargesTab() {
    return (
      <div className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="text-sm font-semibold text-slate-800">Package<select value={formState.package_code} onChange={(event) => setFormState((current) => ({ ...current, package_code: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"><option value="">Use default / fixed route</option>{packageOptions.map((item) => <option key={item.id} value={item.package_code}>{item.package_label}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-800">Trip Amount<input type="number" min="0" step="0.01" value={formState.trip_amount} onChange={(event) => setFormState((current) => ({ ...current, trip_amount: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-800">Night Halts<input type="number" min="0" step="1" value={formState.night_halts} onChange={(event) => setFormState((current) => ({ ...current, night_halts: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <ReadOnlyField label="Calculated Amount" value={trip?.calculated_amount == null ? '-' : formatCurrency(Number(trip.calculated_amount))} />
            <label className="text-sm font-semibold text-slate-800">Advance Hirer<input type="number" min="0" step="0.01" value={formState.advance_hirer} onChange={(event) => setFormState((current) => ({ ...current, advance_hirer: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-800">Advance Travels<input type="number" min="0" step="0.01" value={formState.advance_travels} onChange={(event) => setFormState((current) => ({ ...current, advance_travels: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-800">Fuel Advance<input type="number" min="0" step="0.01" value={formState.fuel_advance} onChange={(event) => setFormState((current) => ({ ...current, fuel_advance: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-800">Cash Advance<input type="number" min="0" step="0.01" value={formState.cash_advance} onChange={(event) => setFormState((current) => ({ ...current, cash_advance: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-800">Driver Allowance<input type="number" min="0" step="0.01" value={formState.driver_allowance} onChange={(event) => setFormState((current) => ({ ...current, driver_allowance: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-800">Toll Charges<input type="number" min="0" step="0.01" value={formState.toll_charges} onChange={(event) => setFormState((current) => ({ ...current, toll_charges: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-800">Parking Charges<input type="number" min="0" step="0.01" value={formState.parking_charges} onChange={(event) => setFormState((current) => ({ ...current, parking_charges: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
            <label className="text-sm font-semibold text-slate-800">Other Charges<input type="number" min="0" step="0.01" value={formState.other_charges} onChange={(event) => setFormState((current) => ({ ...current, other_charges: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          </div>

          {renderPrimaryActions()}
        </form>

        {renderMetricSection()}
      </div>
    );
  }

  function renderSavedTripGuard(message: string) {
    return <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">{message}</div>;
  }

  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-sky-600">Duty Slip</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">{trip ? `Edit ${trip.trip_number}` : 'Create GT duty slip'}</h3>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          <div>Active chart</div>
          <div className="font-semibold text-slate-900">{loadingRateChart ? 'Loading...' : activeRateChart?.name ?? 'Not found'}</div>
        </div>
      </div>

      {rateChartError && rateChartError !== 'No active rate chart found for this customer and date.' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{rateChartError}</div>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
        {tabs.map((tab) => {
          const disabled = !tripExists && (tab.key === 'rate' || tab.key === 'expenses' || tab.key === 'annexures');
          return (
            <button
              key={tab.key}
              type="button"
              disabled={disabled}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === tab.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white'} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'details' ? renderDetailsTab() : null}
      {activeTab === 'charges' ? renderChargesTab() : null}
      {activeTab === 'rate' ? (trip ? <DutySlipRateTab trip={trip} calculation={activeCalculation} activeRateChart={activeRateChart} /> : renderSavedTripGuard('Save the duty slip before reviewing the GT rate breakdown.')) : null}
      {activeTab === 'expenses' ? (trip?.id ? <DutySlipExpensesTab tripId={trip.id} expenses={trip.expenses} canManage={canManage} onRefresh={onRefreshTrip} /> : renderSavedTripGuard('Save the duty slip before adding trip expenses.')) : null}
      {activeTab === 'annexures' ? (trip ? <DutySlipAnnexuresTab parentTrip={trip} onRefresh={onRefreshTrip} /> : renderSavedTripGuard('Save the duty slip before working with annexures.')) : null}

      <ConfirmModal
        isOpen={metricDeleteTarget !== null}
        onClose={() => setMetricDeleteTarget(null)}
        onConfirm={handleDeleteMetricConfirm}
        title="Delete Metric Row"
        message={metricDeleteTarget ? `Delete metric row ${metricDeleteTarget.seq}?` : ''}
        confirmLabel="Delete"
        loading={metricSaving}
      />
    </section>
  );
}
