import { formatCurrency, formatDate } from '../../lib/format';
import { DutyType, RateChart, VehicleCategory } from '../../lib/types';

interface RateChartDetailProps {
  rateChart: RateChart | null;
  vehicleCategories: VehicleCategory[];
  canManage: boolean;
  onOpenEditor: () => void;
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

export function RateChartDetail({ rateChart, vehicleCategories, canManage, onOpenEditor }: RateChartDetailProps) {
  if (!rateChart) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        Select a rate chart to review coverage and then open its workspace.
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

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-sky-600">Selected Rate Chart</p>
            <h3 className="mt-3 text-2xl font-semibold text-slate-900">{rateChart.name}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {rateChart.customer.name} ({rateChart.customer.customer_code})
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {rateChart.is_active ? 'Active' : 'Inactive'}
            </span>
            {canManage ? (
              <button
                type="button"
                onClick={onOpenEditor}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Open Workspace
              </button>
            ) : null}
          </div>
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
                  <div className="flex gap-3 text-xs text-slate-500">
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
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {groupItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{item.package_label}</div>
                              <div className="text-xs text-slate-500">
                                {item.package_code}
                                {item.is_default ? ' - default' : ''}
                              </div>
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
                            <div className="font-medium text-slate-900">{route.from_location} {' -> '} {route.to_location}</div>
                            <div className="mt-1 text-xs text-slate-500">{route.description ?? 'No description'}</div>
                          </div>
                          <div className="text-right text-slate-900">{formatCurrency(route.fixed_amount)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </article>
      ))}
    </section>
  );
}
