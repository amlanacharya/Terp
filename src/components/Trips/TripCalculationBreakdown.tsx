import { formatCurrency } from '../../lib/format';
import { RateCalculationResult, RateChart, Trip } from '../../lib/types';

interface TripCalculationBreakdownProps {
  trip: Trip | null;
  calculation: RateCalculationResult | null;
  activeRateChart: RateChart | null;
}

function buildStoredLineItems(trip: Trip | null): Array<{ code: string; label: string; amount: number }> {
  if (!trip) {
    return [];
  }

  const candidates = [
    { code: 'BASE', label: 'Base Charge', amount: Number(trip.base_charge || 0) },
    { code: 'EXTRA_KM', label: 'Extra KM Charge', amount: Number(trip.extra_km_charge || 0) },
    { code: 'EXTRA_HR', label: 'Extra Hour Charge', amount: Number(trip.extra_hr_charge || 0) },
    { code: 'FUEL', label: 'Fuel Charge', amount: Number(trip.fuel_charge || 0) },
    { code: 'NIGHT_HALT', label: 'Night Halt Charge', amount: Number(trip.night_halt_charge || 0) },
    { code: 'FIXED_ROUTE', label: 'Fixed Route Charge', amount: Number(trip.fixed_route_charge || 0) },
    { code: 'OT', label: 'OT Charge', amount: Number(trip.ot_charge || 0) },
  ];

  return candidates.filter((item) => item.amount > 0);
}

function getSourceLabel(trip: Trip | null, calculation: RateCalculationResult | null): string {
  if (trip?.rate_chart_fixed_route) {
    return `${trip.rate_chart_fixed_route.from_location} -> ${trip.rate_chart_fixed_route.to_location}`;
  }

  if (trip?.rate_chart_item?.package_label) {
    return trip.rate_chart_item.package_label;
  }

  if (calculation?.package_label) {
    return calculation.package_label;
  }

  if (calculation?.applied_fixed_route_id) {
    return 'Fixed route match';
  }

  return 'No saved calculation source';
}

export function TripCalculationBreakdown({ trip, calculation, activeRateChart }: TripCalculationBreakdownProps) {
  const chartName = trip?.rate_chart?.name ?? activeRateChart?.name ?? 'Not available';
  const lineItems = calculation?.line_items ?? buildStoredLineItems(trip);
  const warnings = calculation?.warnings ?? [];
  const requestedDutyType = calculation?.requested_duty_type ?? trip?.duty_type ?? '-';
  const appliedDutyType = calculation?.applied_duty_type ?? (trip?.is_long_trip ? 'long' : trip?.duty_type) ?? '-';
  const calculatedAmount = calculation?.totals.final_amount ?? trip?.calculated_amount ?? null;
  const billedAmount = trip?.trip_amount ?? null;
  const hasManualOverride = calculatedAmount !== null && billedAmount !== null && Number(calculatedAmount) !== Number(billedAmount);

  if (!trip && !calculation) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        Save a trip and run calculation to see the GT breakdown.
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-sky-600">Calculation Snapshot</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">Rate breakdown</h3>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-2 text-right text-sm text-slate-700">
          <div>Chart</div>
          <div className="font-semibold text-slate-900">{chartName}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Requested</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{requestedDutyType}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Applied</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{appliedDutyType}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Source</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{getSourceLabel(trip, calculation)}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Charge Head</th>
              <th className="px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {lineItems.length > 0 ? (
              lineItems.map((item) => (
                <tr key={item.code}>
                  <td className="px-4 py-3 text-slate-700">{item.label}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(item.amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-500">
                  No calculation snapshot saved yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {warnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Calculated Amount</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {calculatedAmount == null ? '-' : formatCurrency(Number(calculatedAmount))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Billed Amount</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {billedAmount == null ? '-' : formatCurrency(Number(billedAmount))}
          </div>
          {hasManualOverride ? (
            <p className="mt-2 text-sm text-amber-700">Billed amount has been manually overridden from the last calculation.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
