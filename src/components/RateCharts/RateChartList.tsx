import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Copy, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import {
  Customer,
  RateChart,
  RateChartSummary,
  VehicleCategory,
} from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';
import { IconBtn } from '../Layout/IconBtn';
import { Pagination, usePaginationState } from '../Layout/Pagination';
import { RateChartDetail } from './RateChartDetail';
import { ChartFormState, RateChartEditor } from './RateChartEditor';

const initialChartForm: ChartFormState = {
  customer_id: '',
  name: '',
  effective_from: '',
  effective_to: '',
  is_active: true,
  notes: '',
};

function buildChartFormState(chart: RateChart | null): ChartFormState {
  if (!chart) {
    return initialChartForm;
  }

  return {
    customer_id: chart.customer_id,
    name: chart.name,
    effective_from: chart.effective_from,
    effective_to: chart.effective_to ?? '',
    is_active: chart.is_active,
    notes: chart.notes ?? '',
  };
}

function buildDuplicateFormState(chart: RateChart | null): ChartFormState {
  if (!chart) {
    return { ...initialChartForm, is_active: false };
  }

  return {
    customer_id: chart.customer_id,
    name: `${chart.name} Copy`,
    effective_from: chart.effective_from,
    effective_to: chart.effective_to ?? '',
    is_active: false,
    notes: chart.notes ?? '',
  };
}

export function RateChartList() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
  const [rateCharts, setRateCharts] = useState<RateChartSummary[]>([]);
  const [selectedChart, setSelectedChart] = useState<RateChart | null>(null);
  const [chartFormState, setChartFormState] = useState<ChartFormState>(initialChartForm);
  const [duplicateFormState, setDuplicateFormState] = useState<ChartFormState>({ ...initialChartForm, is_active: false });
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RateChartSummary | null>(null);
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [chartSaving, setChartSaving] = useState(false);
  const [duplicateSaving, setDuplicateSaving] = useState(false);
  const [itemSaving, setItemSaving] = useState(false);
  const [routeSaving, setRouteSaving] = useState(false);
  const [chartDeleting, setChartDeleting] = useState(false);
  const [error, setError] = useState('');
  const { currentPage, setCurrentPage, pageSize, handlePageSizeChange } = usePaginationState('rate-charts');

  const canManage = profile ? ['admin', 'manager', 'operator'].includes(profile.role) : false;

  async function loadLists() {
    const [customerRows, categoryRows, chartRows] = await Promise.all([
      api.get<Customer[]>('/customers'),
      api.get<VehicleCategory[]>('/vehicle-categories'),
      api.get<RateChartSummary[]>('/rate-charts'),
    ]);

    setCustomers(customerRows);
    setVehicleCategories(categoryRows);
    setRateCharts(chartRows);
  }

  async function loadChartDetail(chartId: string) {
    const chart = await api.get<RateChart>(`/rate-charts/${chartId}`);
    setSelectedChart(chart);
    setDuplicateFormState(buildDuplicateFormState(chart));
    return chart;
  }

  async function handleToggleActive(chart: RateChartSummary) {
    try {
      await api.put(`/rate-charts/${chart.id}`, { is_active: !chart.is_active });
      await loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status.');
    }
  }

  function startEdit(chart: RateChartSummary) {
    void loadChartDetail(chart.id).then(() => {
      startChartEdit();
    });
  }

  function handleDuplicate(chart: RateChartSummary) {
    void loadChartDetail(chart.id).then(() => {
      openDuplicateModal();
    });
  }

  useEffect(() => {
    async function hydrate() {
      try {
        await loadLists();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load rate charts.');
      } finally {
        setLoading(false);
      }
    }

    void hydrate();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCustomerId]);

  function openCreateChart() {
    setError('');
    setEditingChartId(null);
    setChartFormState(initialChartForm);
    setIsChartModalOpen(true);
  }

  function closeChartModal() {
    if (chartSaving) {
      return;
    }

    setEditingChartId(null);
    setChartFormState(initialChartForm);
    setIsChartModalOpen(false);
  }

  function startChartEdit() {
    if (!selectedChart) {
      return;
    }

    setError('');
    setEditingChartId(selectedChart.id);
    setChartFormState(buildChartFormState(selectedChart));
    setIsChartModalOpen(true);
  }

  function openDuplicateModal() {
    if (!selectedChart) {
      return;
    }

    setError('');
    setDuplicateFormState(buildDuplicateFormState(selectedChart));
    setIsDuplicateModalOpen(true);
  }

  function closeDuplicateModal() {
    setIsDuplicateModalOpen(false);
    setDuplicateFormState(buildDuplicateFormState(selectedChart));
  }

  async function refreshAfterChartChange(chart: RateChart | null) {
    await loadLists();

    if (chart) {
      setSelectedChart(chart);
      setDuplicateFormState(buildDuplicateFormState(chart));
    } else {
      setSelectedChart(null);
      setDuplicateFormState({ ...initialChartForm, is_active: false });
    }
  }

  async function handleChartSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChartSaving(true);
    setError('');

    try {
      const payload = {
        customer_id: chartFormState.customer_id,
        name: chartFormState.name,
        effective_from: chartFormState.effective_from,
        effective_to: chartFormState.effective_to || null,
        is_active: chartFormState.is_active,
        notes: chartFormState.notes || null,
      };

      const chart = editingChartId
        ? await api.put<RateChart>(`/rate-charts/${editingChartId}`, payload)
        : await api.post<RateChart>('/rate-charts', payload);

      await refreshAfterChartChange(chart);
      setEditingChartId(chart.id);
      setChartFormState(buildChartFormState(chart));
      setIsChartModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save rate chart.');
    } finally {
      setChartSaving(false);
    }
  }

  async function handleDuplicateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChart) {
      return;
    }

    setDuplicateSaving(true);
    setError('');

    try {
      const duplicatedChart = await api.post<RateChart>(`/rate-charts/${selectedChart.id}/duplicate`, {
        customer_id: duplicateFormState.customer_id,
        name: duplicateFormState.name,
        effective_from: duplicateFormState.effective_from,
        effective_to: duplicateFormState.effective_to || null,
        is_active: duplicateFormState.is_active,
        notes: duplicateFormState.notes || null,
      });

      await refreshAfterChartChange(duplicatedChart);
      closeDuplicateModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to duplicate rate chart.');
    } finally {
      setDuplicateSaving(false);
    }
  }

  async function handleDeleteChartConfirm() {
    if (!deleteTarget) {
      return;
    }

    setChartDeleting(true);
    setError('');

    try {
      await api.delete(`/rate-charts/${deleteTarget.id}`);
      const shouldClearSelection = selectedChart?.id === deleteTarget.id;
      setDeleteTarget(null);
      await refreshAfterChartChange(shouldClearSelection ? null : selectedChart);
      if (shouldClearSelection) {
        setEditingChartId(null);
        setChartFormState(initialChartForm);
        setIsChartModalOpen(false);
        setIsDuplicateModalOpen(false);
        setDuplicateFormState({ ...initialChartForm, is_active: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete rate chart.');
    } finally {
      setChartDeleting(false);
    }
  }

  async function handleSaveItem(payload: Record<string, unknown>, itemId?: string) {
    setItemSaving(true);
    setError('');

    try {
      const chart = itemId
        ? await api.put<RateChart>(`/rate-chart-items/${itemId}`, payload)
        : await api.post<RateChart>(`/rate-charts/${selectedChart?.id}/items`, payload);

      await refreshAfterChartChange(chart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save package.');
      throw err;
    } finally {
      setItemSaving(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    setItemSaving(true);
    setError('');

    try {
      const chart = await api.delete<RateChart>(`/rate-chart-items/${itemId}`);
      await refreshAfterChartChange(chart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete package.');
    } finally {
      setItemSaving(false);
    }
  }

  async function handleSaveFixedRoute(payload: Record<string, unknown>, routeId?: string) {
    setRouteSaving(true);
    setError('');

    try {
      const chart = routeId
        ? await api.put<RateChart>(`/rate-chart-fixed-routes/${routeId}`, payload)
        : await api.post<RateChart>(`/rate-charts/${selectedChart?.id}/fixed-routes`, payload);

      await refreshAfterChartChange(chart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save fixed route.');
      throw err;
    } finally {
      setRouteSaving(false);
    }
  }

  async function handleDeleteFixedRoute(routeId: string) {
    setRouteSaving(true);
    setError('');

    try {
      const chart = await api.delete<RateChart>(`/rate-chart-fixed-routes/${routeId}`);
      await refreshAfterChartChange(chart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete fixed route.');
    } finally {
      setRouteSaving(false);
    }
  }

  const filteredCharts = useMemo(
    () => (filterCustomerId ? rateCharts.filter((chart) => chart.customer.id === filterCustomerId) : rateCharts),
    [filterCustomerId, rateCharts]
  );

  const visibleCharts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCharts.slice(start, start + pageSize);
  }, [filteredCharts, currentPage, pageSize]);

  const workspaceChart = editingChartId && selectedChart?.id === editingChartId ? selectedChart : null;

  if (loading) {
    return <p className="text-sm text-slate-500">Loading rate charts...</p>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Rate Charts</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Customer pricing master</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Maintain GT packages like `8HR/80KM`, `10HR/100KM`, and route-specific prices under each customer chart.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openCreateChart} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">
              Add Rate Chart
            </button>
            <button type="button" disabled={!selectedChart} onClick={startChartEdit} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 disabled:opacity-60">
              Open Workspace
            </button>
            <button type="button" disabled={!selectedChart} onClick={openDuplicateModal} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 disabled:opacity-60">
              Duplicate Chart
            </button>
          </div>
        ) : null}
      </div>
      {error && !isChartModalOpen ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}

      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="text-sm font-semibold text-slate-800">
            Filter By Customer
            <select value={filterCustomerId} onChange={(event) => setFilterCustomerId(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
              <option value="">All customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Effective From</th>
                <th className="px-4 py-3">Effective To</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleCharts.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No rate charts yet.</td></tr>
              ) : null}
              {paginatedCharts.map((chart, i) => (
                <tr key={chart.id} className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void loadChartDetail(chart.id)}
                      className="font-medium text-slate-900 hover:text-blue-600 hover:underline cursor-pointer text-left"
                    >
                      {chart.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{chart.customer?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(chart.effective_from)}</td>
                  <td className="px-4 py-3 text-slate-600">{chart.effective_to ? formatDate(chart.effective_to) : '—'}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(chart)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          chart.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          chart.is_active ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                    ) : (
                      <span className={chart.is_active ? 'text-emerald-600' : 'text-slate-400'}>
                        {chart.is_active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {canManage ? (
                        <IconBtn icon={Pencil} label="Edit" onClick={() => startEdit(chart)} />
                      ) : null}
                      <IconBtn icon={Eye} label="View" onClick={() => void loadChartDetail(chart.id)} />
                      {canManage ? (
                        <IconBtn icon={Copy} label="Duplicate" onClick={() => handleDuplicate(chart)} />
                      ) : null}
                      {canManage ? (
                        <IconBtn icon={Trash2} label="Delete" variant="danger" onClick={() => setDeleteTarget(chart)} />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={filteredCharts.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
        />

        {selectedChart ? (
          <RateChartDetail
            rateChart={selectedChart}
            vehicleCategories={vehicleCategories}
            canManage={canManage}
            onOpenEditor={startChartEdit}
          />
        ) : null}
      </div>

      {canManage ? (
        <Modal
          isOpen={isChartModalOpen}
          onClose={closeChartModal}
          title={workspaceChart ? 'Rate Chart Workspace' : 'Create Rate Chart'}
          size="xl"
          closeOnBackdrop={!chartSaving}
          closeOnEsc={!chartSaving}
        >
          <RateChartEditor
            isOpen={isChartModalOpen}
            rateChart={workspaceChart}
            chartFormState={chartFormState}
            setChartFormState={setChartFormState}
            customers={customers}
            vehicleCategories={vehicleCategories}
            canManage={canManage}
            chartSaving={chartSaving}
            itemSaving={itemSaving}
            routeSaving={routeSaving}
            error={error}
            onSaveChart={handleChartSubmit}
            onSaveItem={handleSaveItem}
            onDeleteItem={handleDeleteItem}
            onSaveFixedRoute={handleSaveFixedRoute}
            onDeleteFixedRoute={handleDeleteFixedRoute}
            onClose={closeChartModal}
          />
        </Modal>
      ) : null}

      {canManage && selectedChart ? (
        <Modal
          isOpen={isDuplicateModalOpen}
          onClose={duplicateSaving ? () => undefined : closeDuplicateModal}
          title="Duplicate Rate Chart"
          size="xl"
          closeOnBackdrop={!duplicateSaving}
          closeOnEsc={!duplicateSaving}
        >
          <form onSubmit={handleDuplicateSubmit} className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-3">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Duplicate Chart</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">Copy {selectedChart.name} into a new effective window</h3>
            </div>
            <label className="text-sm font-semibold text-slate-800">
              Target Customer
              <select value={duplicateFormState.customer_id} onChange={(event) => setDuplicateFormState((current) => ({ ...current, customer_id: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required>
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-800">
              New Chart Name
              <input value={duplicateFormState.name} onChange={(event) => setDuplicateFormState((current) => ({ ...current, name: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 lg:mt-7">
              <input type="checkbox" checked={duplicateFormState.is_active} onChange={(event) => setDuplicateFormState((current) => ({ ...current, is_active: event.target.checked }))} />
              Make duplicate active
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Effective From
              <input type="date" value={duplicateFormState.effective_from} onChange={(event) => setDuplicateFormState((current) => ({ ...current, effective_from: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Effective To
              <input type="date" value={duplicateFormState.effective_to} onChange={(event) => setDuplicateFormState((current) => ({ ...current, effective_to: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
            </label>
            <div className="hidden lg:block" />
            <label className="text-sm font-semibold text-slate-800 lg:col-span-3">
              Notes
              <textarea value={duplicateFormState.notes} onChange={(event) => setDuplicateFormState((current) => ({ ...current, notes: event.target.value }))} rows={2} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
            </label>
            <div className="flex flex-wrap gap-3 lg:col-span-3">
              <button type="submit" disabled={duplicateSaving} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
                {duplicateSaving ? 'Duplicating...' : 'Duplicate Chart'}
              </button>
              <button type="button" onClick={closeDuplicateModal} disabled={duplicateSaving} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 disabled:opacity-60">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteChartConfirm}
        title="Delete Rate Chart"
        message={deleteTarget ? `Delete rate chart ${deleteTarget.name}?` : ''}
        confirmLabel="Delete"
        loading={chartDeleting}
      />
    </section>
  );
}
