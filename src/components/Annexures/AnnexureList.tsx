import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api, downloadBlob } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { Annexure, Trip, TripDetail } from '../../lib/types';

interface AnnexureListProps {
  parentTrip?: TripDetail | null;
  embedded?: boolean;
  onOpenTrip?: (tripId: string) => void;
}

type SelectionMode = 'metric_rows' | 'date_range';

export function AnnexureList({ parentTrip = null, embedded = false, onOpenTrip }: AnnexureListProps) {
  const { profile } = useAuth();
  const [parentTrips, setParentTrips] = useState<Trip[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>(parentTrip?.id ?? '');
  const [selectedParent, setSelectedParent] = useState<TripDetail | null>(parentTrip);
  const [annexures, setAnnexures] = useState<Annexure[]>([]);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('metric_rows');
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
  const [annexureNumber, setAnnexureNumber] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [selectedAnnexureIds, setSelectedAnnexureIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(!embedded);
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canCreate = profile ? ['admin', 'manager', 'operator'].includes(profile.role) : false;
  const canBill = profile ? ['admin', 'manager', 'accountant', 'operator'].includes(profile.role) : false;

  async function loadParentTrips() {
    const trips = await api.get<Trip[]>('/trips');
    return trips.filter((trip) => !trip.parent_trip_id);
  }

  async function loadParentTripDetail(tripId: string) {
    return api.get<TripDetail>(`/trips/${tripId}`);
  }

  async function loadAnnexureRows(tripId: string) {
    return api.get<Annexure[]>(`/trips/${tripId}/annexures`);
  }

  async function refreshForTrip(tripId: string) {
    const [tripDetail, annexureRows] = await Promise.all([loadParentTripDetail(tripId), loadAnnexureRows(tripId)]);
    setSelectedParent(tripDetail);
    setAnnexures(annexureRows);
    setSelectedMetricIds([]);
    setSelectedAnnexureIds([]);
    if (!rangeStart) {
      setRangeStart(tripDetail.trip_date.slice(0, 10));
    }
    if (!rangeEnd) {
      setRangeEnd(tripDetail.trip_date.slice(0, 10));
    }
  }

  useEffect(() => {
    if (parentTrip) {
      setSelectedParentId(parentTrip.id);
      setSelectedParent(parentTrip);
      void loadAnnexureRows(parentTrip.id)
        .then((rows) => setAnnexures(rows))
        .catch((err: Error) => setError(err.message));
      return;
    }

    let isCancelled = false;
    setLoading(true);
    loadParentTrips()
      .then((rows) => {
        if (isCancelled) {
          return;
        }
        setParentTrips(rows);
        if (rows[0] && !selectedParentId) {
          setSelectedParentId(rows[0].id);
        }
      })
      .catch((err: Error) => {
        if (!isCancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [parentTrip]);

  useEffect(() => {
    if (parentTrip || !selectedParentId) {
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError('');
    refreshForTrip(selectedParentId)
      .catch((err: Error) => {
        if (!isCancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedParentId, parentTrip]);

  const allocatedMetricIds = useMemo(
    () => new Set(annexures.flatMap((annexure) => annexure.source_metric_ids ?? [])),
    [annexures]
  );

  const selectedMetrics = useMemo(() => {
    const metrics = selectedParent?.metrics ?? [];
    if (selectionMode === 'metric_rows') {
      return metrics.filter((metric) => selectedMetricIds.includes(metric.id));
    }
    if (!rangeStart || !rangeEnd) {
      return [];
    }
    return metrics.filter((metric) => metric.start_date >= rangeStart && (metric.end_date ?? metric.start_date) <= rangeEnd);
  }, [rangeEnd, rangeStart, selectedMetricIds, selectedParent?.metrics, selectionMode]);

  const selectedMetricTotals = useMemo(
    () => selectedMetrics.reduce(
      (totals, metric) => ({
        totalKm: totals.totalKm + (metric.segment_km ?? 0),
        totalHours: totals.totalHours + (metric.segment_hours ?? 0),
      }),
      { totalKm: 0, totalHours: 0 }
    ),
    [selectedMetrics]
  );

  async function handleCreateAnnexure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedParent?.id) {
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      await api.post(`/trips/${selectedParent.id}/annexures`, {
        annexure_number: annexureNumber || null,
        selection_mode: selectionMode,
        metric_ids: selectionMode === 'metric_rows' ? selectedMetricIds : undefined,
        start_date: selectionMode === 'date_range' ? rangeStart : undefined,
        end_date: selectionMode === 'date_range' ? rangeEnd : undefined,
      });
      await refreshForTrip(selectedParent.id);
      setAnnexureNumber('');
      setSelectedMetricIds([]);
      setNotice('Annexure created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create annexure.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAnnexure(annexure: Annexure) {
    if (!selectedParent?.id) {
      return;
    }
    if (!window.confirm(`Delete annexure ${annexure.annexure_number}?`)) {
      return;
    }

    try {
      setError('');
      setNotice('');
      await api.delete(`/annexures/${annexure.id}`);
      await refreshForTrip(selectedParent.id);
      setNotice('Annexure deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete annexure.');
    }
  }

  async function handleBillSingle(annexure: Annexure) {
    if (!selectedParent?.id) {
      return;
    }

    try {
      setBilling(true);
      setError('');
      setNotice('');
      const invoice = await api.put<{ invoice_number: string }>(`/annexures/${annexure.id}/bill`, {});
      await refreshForTrip(selectedParent.id);
      setNotice(`Invoice ${invoice.invoice_number} created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to bill annexure.');
    } finally {
      setBilling(false);
    }
  }

  async function handleBulkBill() {
    if (!selectedParent?.id || selectedAnnexureIds.length === 0) {
      return;
    }

    try {
      setBilling(true);
      setError('');
      setNotice('');
      const invoice = await api.post<{ invoice_number: string }>('/annexures/bulk-bill', {
        parent_trip_id: selectedParent.id,
        annexure_ids: selectedAnnexureIds,
      });
      await refreshForTrip(selectedParent.id);
      setNotice(`Invoice ${invoice.invoice_number} created for selected annexures.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to bill selected annexures.');
    } finally {
      setBilling(false);
    }
  }

  async function handleDownloadPdf(annexure: Annexure) {
    try {
      setError('');
      const blob = await downloadBlob(`/annexures/${annexure.id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${annexure.annexure_number}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download annexure PDF.');
    }
  }

  function toggleMetric(metricId: string) {
    setSelectedMetricIds((current) => current.includes(metricId)
      ? current.filter((id) => id !== metricId)
      : [...current, metricId]);
  }

  function toggleAnnexure(annexureId: string) {
    setSelectedAnnexureIds((current) => current.includes(annexureId)
      ? current.filter((id) => id !== annexureId)
      : [...current, annexureId]);
  }

  const title = embedded ? 'Annexure Panel' : 'Annexure Management';

  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-sky-600">Annexures</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h3>
        </div>
        {selectedParent ? (
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
            <div>Parent Duty Slip</div>
            <div className="font-semibold text-slate-900">{selectedParent.trip_number}</div>
          </div>
        ) : null}
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{notice}</div> : null}

      {!embedded ? (
        <label className="block text-sm font-semibold text-slate-800">
          Parent Trip
          <select value={selectedParentId} onChange={(event) => setSelectedParentId(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
            <option value="">Select parent trip</option>
            {parentTrips.map((trip) => (
              <option key={trip.id} value={trip.id}>{trip.trip_number} - {trip.customer.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">Loading annexures...</p> : null}
      {!loading && !selectedParent ? <p className="text-sm text-slate-500">Select a parent trip to manage annexures.</p> : null}
      {selectedParent?.parent_trip_id ? <p className="text-sm text-amber-700">Annexures are created only from parent trips, not annexure child trips.</p> : null}

      {selectedParent && !selectedParent.parent_trip_id ? (
        <>
          {canCreate ? (
            <form onSubmit={handleCreateAnnexure} className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 lg:grid-cols-4">
                <label className="text-sm font-semibold text-slate-800">
                  Annexure Number
                  <input value={annexureNumber} onChange={(event) => setAnnexureNumber(event.target.value)} placeholder={`${selectedParent.trip_number}/ANX-01`} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  Selection Mode
                  <select value={selectionMode} onChange={(event) => setSelectionMode(event.target.value as SelectionMode)} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
                    <option value="metric_rows">Metric rows</option>
                    <option value="date_range">Date range</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  Start Date
                  <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} disabled={selectionMode !== 'date_range'} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal disabled:bg-slate-100" />
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  End Date
                  <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} disabled={selectionMode !== 'date_range'} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal disabled:bg-slate-100" />
                </label>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Use</th>
                      <th className="px-4 py-3">Seq</th>
                      <th className="px-4 py-3">Start</th>
                      <th className="px-4 py-3">End</th>
                      <th className="px-4 py-3">KM</th>
                      <th className="px-4 py-3">Hours</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {selectedParent.metrics.map((metric) => {
                      const allocated = allocatedMetricIds.has(metric.id);
                      const withinRange = !rangeStart || !rangeEnd ? true : metric.start_date >= rangeStart && (metric.end_date ?? metric.start_date) <= rangeEnd;
                      const checked = selectionMode === 'metric_rows' ? selectedMetricIds.includes(metric.id) : withinRange;
                      return (
                        <tr key={metric.id} className={allocated ? 'bg-slate-50 text-slate-400' : ''}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={selectionMode !== 'metric_rows' || allocated}
                              onChange={() => toggleMetric(metric.id)}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{metric.seq}</td>
                          <td className="px-4 py-3">{metric.start_date} {metric.start_time}</td>
                          <td className="px-4 py-3">{metric.end_date ?? '-'} {metric.end_time ?? ''}</td>
                          <td className="px-4 py-3">{metric.segment_km?.toFixed(2) ?? '-'}</td>
                          <td className="px-4 py-3">{metric.segment_hours?.toFixed(2) ?? '-'}</td>
                          <td className="px-4 py-3">{allocated ? 'Allocated' : metric.is_complete ? 'Available' : 'Incomplete'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                <div>Selection preview: {selectedMetrics.length} rows, {selectedMetricTotals.totalKm.toFixed(2)} km, {selectedMetricTotals.totalHours.toFixed(2)} hrs</div>
                <button type="submit" disabled={saving || selectedMetrics.length === 0} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Creating...' : 'Create Annexure'}</button>
              </div>
            </form>
          ) : null}

          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Existing Annexures</p>
                <h4 className="mt-2 text-xl font-semibold text-slate-900">Billing units</h4>
              </div>
              {canBill ? (
                <button type="button" disabled={billing || selectedAnnexureIds.length === 0} onClick={() => void handleBulkBill()} className="rounded-2xl border border-sky-300 px-5 py-3 text-sm font-medium text-sky-700 disabled:opacity-60">
                  {billing ? 'Billing...' : `Bill Selected (${selectedAnnexureIds.length})`}
                </button>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Pick</th>
                    <th className="px-4 py-3">Annexure</th>
                    <th className="px-4 py-3">Range</th>
                    <th className="px-4 py-3">KM / Hrs</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {annexures.map((annexure) => (
                    <tr key={annexure.id}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedAnnexureIds.includes(annexure.id)} disabled={annexure.is_billed} onChange={() => toggleAnnexure(annexure.id)} />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{annexure.annexure_number}<div className="text-xs text-slate-500">Child: {annexure.child_trip.trip_number}</div></td>
                      <td className="px-4 py-3">{formatDate(annexure.start_date)} to {formatDate(annexure.end_date)}</td>
                      <td className="px-4 py-3">{annexure.total_km.toFixed(2)} km<div className="text-xs text-slate-500">{annexure.total_hours.toFixed(2)} hrs</div></td>
                      <td className="px-4 py-3">{formatCurrency(annexure.calculated_amount)}</td>
                      <td className="px-4 py-3">{annexure.invoice_number ?? (annexure.is_billed ? 'Linked' : '-')}</td>
                      <td className="px-4 py-3">
                        {onOpenTrip ? <button type="button" onClick={() => onOpenTrip(annexure.trip_id)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Open Trip</button> : null}
                        <button type="button" onClick={() => void handleDownloadPdf(annexure)} className="ml-2 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">PDF</button>
                        {!annexure.is_billed && canBill ? <button type="button" onClick={() => void handleBillSingle(annexure)} className="ml-2 rounded-xl border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-700">Bill</button> : null}
                        {!annexure.is_billed && canCreate ? <button type="button" onClick={() => void handleDeleteAnnexure(annexure)} className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">Delete</button> : null}
                      </td>
                    </tr>
                  ))}
                  {annexures.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">No annexures created for this parent trip.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
