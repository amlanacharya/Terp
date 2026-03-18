import { FormEvent, useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '../../lib/format';
import { DutyType, RateChart, RateChartFixedRoute, RateChartItem, VehicleCategory } from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { RateChartItemForm } from './RateChartItemForm';

interface RateChartDetailProps {
  rateChart: RateChart | null;
  vehicleCategories: VehicleCategory[];
  canManage: boolean;
  itemSaving: boolean;
  routeSaving: boolean;
  onSaveItem: (payload: Record<string, unknown>, itemId?: string) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onSaveFixedRoute: (payload: Record<string, unknown>, routeId?: string) => Promise<void>;
  onDeleteFixedRoute: (routeId: string) => Promise<void>;
}

interface FixedRouteFormState {
  vehicle_category_id: string;
  duty_type: DutyType;
  from_location: string;
  to_location: string;
  fixed_amount: string;
  description: string;
}

const dutyTypeOptions: Array<{ value: DutyType; label: string }> = [
  { value: 'local', label: 'Local' },
  { value: 'outstation', label: 'Outstation' },
  { value: 'drop_pickup', label: 'Drop / Pickup' },
  { value: 'station_drop', label: 'Station Drop' },
  { value: 'long', label: 'Long' },
];

function toDisplayValue(value: number | null | undefined): string {
  return value == null ? '-' : String(value);
}

function buildFixedRouteState(route: RateChartFixedRoute | null | undefined): FixedRouteFormState {
  if (!route) {
    return {
      vehicle_category_id: '',
      duty_type: 'local',
      from_location: '',
      to_location: '',
      fixed_amount: '',
      description: '',
    };
  }

  return {
    vehicle_category_id: route.vehicle_category_id,
    duty_type: route.duty_type,
    from_location: route.from_location,
    to_location: route.to_location,
    fixed_amount: String(route.fixed_amount),
    description: route.description ?? '',
  };
}

export function RateChartDetail({
  rateChart,
  vehicleCategories,
  canManage,
  itemSaving,
  routeSaving,
  onSaveItem,
  onDeleteItem,
  onSaveFixedRoute,
  onDeleteFixedRoute,
}: RateChartDetailProps) {
  const [editingItem, setEditingItem] = useState<RateChartItem | null>(null);
  const [editingRoute, setEditingRoute] = useState<RateChartFixedRoute | null>(null);
  const [itemDeleteTarget, setItemDeleteTarget] = useState<RateChartItem | null>(null);
  const [routeDeleteTarget, setRouteDeleteTarget] = useState<RateChartFixedRoute | null>(null);
  const [fixedRouteState, setFixedRouteState] = useState<FixedRouteFormState>(buildFixedRouteState(null));

  useEffect(() => {
    setEditingItem(null);
    setEditingRoute(null);
    setItemDeleteTarget(null);
    setRouteDeleteTarget(null);
    setFixedRouteState(buildFixedRouteState(null));
  }, [rateChart?.id]);

  useEffect(() => {
    setFixedRouteState(buildFixedRouteState(editingRoute));
  }, [editingRoute]);

  if (!rateChart) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        Select a rate chart to maintain packages and fixed routes.
      </section>
    );
  }

  const categoryIds = Array.from(
    new Set([
      ...rateChart.items.map((item) => item.vehicle_category_id),
      ...rateChart.fixed_routes.map((route) => route.vehicle_category_id),
    ])
  );
  const visibleCategories = vehicleCategories
    .filter((category) => categoryIds.includes(category.id))
    .sort((left, right) => left.name.localeCompare(right.name));

  async function handleFixedRouteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSaveFixedRoute(
      {
        vehicle_category_id: fixedRouteState.vehicle_category_id,
        duty_type: fixedRouteState.duty_type,
        from_location: fixedRouteState.from_location,
        to_location: fixedRouteState.to_location,
        fixed_amount: Number(fixedRouteState.fixed_amount),
        description: fixedRouteState.description || null,
      },
      editingRoute?.id
    );

    setEditingRoute(null);
    setFixedRouteState(buildFixedRouteState(null));
  }

  function handleItemDelete(item: RateChartItem) {
    setItemDeleteTarget(item);
  }

  async function handleItemDeleteConfirm() {
    if (!itemDeleteTarget) {
      return;
    }

    await onDeleteItem(itemDeleteTarget.id);
    if (editingItem?.id === itemDeleteTarget.id) {
      setEditingItem(null);
    }
    setItemDeleteTarget(null);
  }

  function handleFixedRouteDelete(route: RateChartFixedRoute) {
    setRouteDeleteTarget(route);
  }

  async function handleFixedRouteDeleteConfirm() {
    if (!routeDeleteTarget) {
      return;
    }

    await onDeleteFixedRoute(routeDeleteTarget.id);
    if (editingRoute?.id === routeDeleteTarget.id) {
      setEditingRoute(null);
      setFixedRouteState(buildFixedRouteState(null));
    }
    setRouteDeleteTarget(null);
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm uppercase tracking-[0.25em] text-sky-600">Selected Rate Chart</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold text-slate-900">{rateChart.name}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {rateChart.customer.name} ({rateChart.customer.customer_code})
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {rateChart.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <dl className="mt-5 grid gap-4 text-sm text-slate-600 md:grid-cols-4">
          <div>
            <dt className="font-medium text-slate-500">Effective From</dt>
            <dd>{formatDate(rateChart.effective_from)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Effective To</dt>
            <dd>{rateChart.effective_to ? formatDate(rateChart.effective_to) : 'Open-ended'}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Packages</dt>
            <dd>{rateChart.items.length}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Fixed Routes</dt>
            <dd>{rateChart.fixed_routes.length}</dd>
          </div>
        </dl>
        {rateChart.notes ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">{rateChart.notes}</p> : null}
      </div>

      {canManage ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-lg font-semibold text-slate-900">{editingItem ? 'Edit Package' : 'Add Package'}</h4>
              {editingItem ? (
                <button type="button" onClick={() => setEditingItem(null)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                  Clear selection
                </button>
              ) : null}
            </div>
            <RateChartItemForm
              initialItem={editingItem}
              vehicleCategories={vehicleCategories}
              saving={itemSaving}
              onSubmit={async (payload) => {
                await onSaveItem(payload, editingItem?.id);
                setEditingItem(null);
              }}
              onCancel={editingItem ? () => setEditingItem(null) : undefined}
            />
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-lg font-semibold text-slate-900">{editingRoute ? 'Edit Fixed Route' : 'Add Fixed Route'}</h4>
              {editingRoute ? (
                <button type="button" onClick={() => setEditingRoute(null)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                  Clear selection
                </button>
              ) : null}
            </div>
            <form onSubmit={handleFixedRouteSubmit} className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="text-sm font-semibold text-slate-800">
                  Vehicle Category
                  <select value={fixedRouteState.vehicle_category_id} onChange={(event) => setFixedRouteState((current) => ({ ...current, vehicle_category_id: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required>
                    <option value="">Select category</option>
                    {vehicleCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  Duty Type
                  <select value={fixedRouteState.duty_type} onChange={(event) => setFixedRouteState((current) => ({ ...current, duty_type: event.target.value as DutyType }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
                    {dutyTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="text-sm font-semibold text-slate-800">
                  From Location
                  <input value={fixedRouteState.from_location} onChange={(event) => setFixedRouteState((current) => ({ ...current, from_location: event.target.value }))} placeholder="e.g. TSM" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  To Location
                  <input value={fixedRouteState.to_location} onChange={(event) => setFixedRouteState((current) => ({ ...current, to_location: event.target.value }))} placeholder="e.g. BBSR" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="text-sm font-semibold text-slate-800">
                  Fixed Amount
                  <input type="number" min="0" step="0.01" value={fixedRouteState.fixed_amount} onChange={(event) => setFixedRouteState((current) => ({ ...current, fixed_amount: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  Description
                  <input value={fixedRouteState.description} onChange={(event) => setFixedRouteState((current) => ({ ...current, description: event.target.value }))} placeholder="Optional note" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
                </label>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={routeSaving} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
                  {routeSaving ? 'Saving...' : editingRoute ? 'Update Fixed Route' : 'Add Fixed Route'}
                </button>
                {editingRoute ? (
                  <button type="button" onClick={() => setEditingRoute(null)} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700">
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {visibleCategories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          No packages or fixed routes are configured on this chart yet.
        </div>
      ) : null}

      {visibleCategories.map((category) => (
        <article key={category.id} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Vehicle Category</p>
              <h4 className="mt-1 text-xl font-semibold text-slate-900">{category.name}</h4>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {category.is_active ? 'Active category' : 'Inactive category'}
            </span>
          </div>
          {dutyTypeOptions.map((option) => {
            const groupItems = rateChart.items.filter(
              (item) => item.vehicle_category_id === category.id && item.duty_type === option.value
            );
            const groupRoutes = rateChart.fixed_routes.filter(
              (route) => route.vehicle_category_id === category.id && route.duty_type === option.value
            );

            if (groupItems.length === 0 && groupRoutes.length === 0) {
              return null;
            }

            return (
              <section key={option.value} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h5 className="text-lg font-semibold text-slate-900">{option.label}</h5>
                  <div className="flex gap-2 text-xs text-slate-500">
                    <span>{groupItems.length} packages</span>
                    <span>{groupRoutes.length} routes</span>
                  </div>
                </div>
                {groupItems.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-slate-600">
                        <tr>
                          <th className="px-4 py-3">Package</th>
                          <th className="px-4 py-3">Base</th>
                          <th className="px-4 py-3">Extras</th>
                          <th className="px-4 py-3">Long / Fixed</th>
                          {canManage ? <th className="px-4 py-3">Action</th> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {groupItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{item.package_label}</div>
                              <div className="text-xs text-slate-500">{item.package_code}{item.is_default ? ' - default' : ''}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <div>{toDisplayValue(item.base_hours)} hr / {toDisplayValue(item.base_km)} km</div>
                              <div className="text-xs text-slate-500">{formatCurrency(item.base_amount ?? item.fixed_amount ?? 0)}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <div>KM {formatCurrency(item.extra_km_rate ?? 0)}</div>
                              <div>HR {formatCurrency(item.extra_hr_rate ?? 0)}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <div>Per KM {formatCurrency(item.per_km_rate ?? 0)}</div>
                              <div className="text-xs text-slate-500">Threshold {toDisplayValue(item.long_km_threshold)}</div>
                            </td>
                            {canManage ? (
                              <td className="px-4 py-3">
                                <button type="button" onClick={() => setEditingItem(item)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Edit</button>
                                <button type="button" onClick={() => handleItemDelete(item)} className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">Delete</button>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {groupRoutes.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {groupRoutes.map((route) => (
                      <div key={route.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">{route.from_location}{' -> '}{route.to_location}</div>
                            <div className="mt-1 text-xs text-slate-500">{route.description ?? 'No description'}</div>
                          </div>
                          <div className="text-right text-slate-900">{formatCurrency(route.fixed_amount)}</div>
                        </div>
                        {canManage ? (
                          <div className="mt-3 flex gap-2">
                            <button type="button" onClick={() => setEditingRoute(route)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Edit route</button>
                            <button type="button" onClick={() => handleFixedRouteDelete(route)} className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">Delete</button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </article>
      ))}

      <ConfirmModal
        isOpen={itemDeleteTarget !== null}
        onClose={() => setItemDeleteTarget(null)}
        onConfirm={handleItemDeleteConfirm}
        title="Delete Package"
        message={itemDeleteTarget ? `Delete package ${itemDeleteTarget.package_label}?` : ''}
        confirmLabel="Delete"
        loading={itemSaving}
      />

      <ConfirmModal
        isOpen={routeDeleteTarget !== null}
        onClose={() => setRouteDeleteTarget(null)}
        onConfirm={handleFixedRouteDeleteConfirm}
        title="Delete Fixed Route"
        message={routeDeleteTarget ? `Delete fixed route ${routeDeleteTarget.from_location} -> ${routeDeleteTarget.to_location}?` : ''}
        confirmLabel="Delete"
        loading={routeSaving}
      />
    </section>
  );
}
