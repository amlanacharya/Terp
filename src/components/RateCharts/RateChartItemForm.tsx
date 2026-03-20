import { FormEvent, useEffect, useState } from 'react';
import { DutyType, RateChartItem, VehicleCategory } from '../../lib/types';

interface RateChartItemFormProps {
  initialItem?: RateChartItem | null;
  vehicleCategories: VehicleCategory[];
  defaultVehicleCategoryId?: string;
  defaultDutyType?: DutyType;
  saving: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
}

interface RateChartItemFormState {
  vehicle_category_id: string;
  duty_type: DutyType;
  package_code: string;
  package_label: string;
  sort_order: string;
  is_default: boolean;
  base_hours: string;
  base_km: string;
  base_amount: string;
  extra_km_rate: string;
  extra_hr_rate: string;
  fuel_divisor: string;
  fuel_price_per_unit: string;
  night_halt_rate: string;
  fixed_amount: string;
  use_higher_of_km_hr: boolean;
  per_km_rate: string;
  ot_rate: string;
  long_km_threshold: string;
  no_km_limit_cap_km: string;
  long_day_hours: string;
  long_night_halt_hours: string;
  notes: string;
}

const dutyTypeOptions: Array<{ value: DutyType; label: string }> = [
  { value: 'local', label: 'Local' },
  { value: 'outstation', label: 'Outstation' },
  { value: 'drop_pickup', label: 'Drop / Pickup' },
  { value: 'station_drop', label: 'Station Drop' },
  { value: 'long', label: 'Long' },
];

function toInputValue(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

function buildFormState(
  item: RateChartItem | null | undefined,
  defaultVehicleCategoryId: string,
  defaultDutyType: DutyType
): RateChartItemFormState {
  if (!item) {
    return {
      vehicle_category_id: defaultVehicleCategoryId,
      duty_type: defaultDutyType,
      package_code: '',
      package_label: '',
      sort_order: '0',
      is_default: false,
      base_hours: '',
      base_km: '',
      base_amount: '',
      extra_km_rate: '',
      extra_hr_rate: '',
      fuel_divisor: '',
      fuel_price_per_unit: '',
      night_halt_rate: '',
      fixed_amount: '',
      use_higher_of_km_hr: false,
      per_km_rate: '',
      ot_rate: '',
      long_km_threshold: '',
      no_km_limit_cap_km: '',
      long_day_hours: '',
      long_night_halt_hours: '',
      notes: '',
    };
  }

  return {
    vehicle_category_id: item.vehicle_category_id,
    duty_type: item.duty_type,
    package_code: item.package_code,
    package_label: item.package_label,
    sort_order: String(item.sort_order ?? 0),
    is_default: item.is_default,
    base_hours: toInputValue(item.base_hours),
    base_km: toInputValue(item.base_km),
    base_amount: toInputValue(item.base_amount),
    extra_km_rate: toInputValue(item.extra_km_rate),
    extra_hr_rate: toInputValue(item.extra_hr_rate),
    fuel_divisor: toInputValue(item.fuel_divisor),
    fuel_price_per_unit: toInputValue(item.fuel_price_per_unit),
    night_halt_rate: toInputValue(item.night_halt_rate),
    fixed_amount: toInputValue(item.fixed_amount),
    use_higher_of_km_hr: item.use_higher_of_km_hr,
    per_km_rate: toInputValue(item.per_km_rate),
    ot_rate: toInputValue(item.ot_rate),
    long_km_threshold: toInputValue(item.long_km_threshold),
    no_km_limit_cap_km: toInputValue(item.no_km_limit_cap_km),
    long_day_hours: toInputValue(item.long_day_hours),
    long_night_halt_hours: toInputValue(item.long_night_halt_hours),
    notes: item.notes ?? '',
  };
}

function parseOptionalNumber(value: string): number | null {
  return value === '' ? null : Number(value);
}

export function RateChartItemForm({
  initialItem,
  vehicleCategories,
  defaultVehicleCategoryId = '',
  defaultDutyType = 'local',
  saving,
  onSubmit,
  onCancel,
}: RateChartItemFormProps) {
  const [formState, setFormState] = useState<RateChartItemFormState>(
    buildFormState(initialItem, defaultVehicleCategoryId, defaultDutyType)
  );

  useEffect(() => {
    setFormState(buildFormState(initialItem, defaultVehicleCategoryId, defaultDutyType));
  }, [defaultDutyType, defaultVehicleCategoryId, initialItem]);

  const isLongDuty = formState.duty_type === 'long';
  const isFixedDuty = formState.duty_type === 'drop_pickup' || formState.duty_type === 'station_drop';
  const isPackageDuty = formState.duty_type === 'local' || formState.duty_type === 'outstation';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      vehicle_category_id: formState.vehicle_category_id,
      duty_type: formState.duty_type,
      package_code: formState.package_code,
      package_label: formState.package_label,
      sort_order: Number(formState.sort_order || 0),
      is_default: formState.is_default,
      base_hours: parseOptionalNumber(formState.base_hours),
      base_km: parseOptionalNumber(formState.base_km),
      base_amount: parseOptionalNumber(formState.base_amount),
      extra_km_rate: parseOptionalNumber(formState.extra_km_rate),
      extra_hr_rate: parseOptionalNumber(formState.extra_hr_rate),
      fuel_divisor: parseOptionalNumber(formState.fuel_divisor),
      fuel_price_per_unit: parseOptionalNumber(formState.fuel_price_per_unit),
      night_halt_rate: parseOptionalNumber(formState.night_halt_rate),
      fixed_amount: parseOptionalNumber(formState.fixed_amount),
      use_higher_of_km_hr: formState.use_higher_of_km_hr,
      per_km_rate: parseOptionalNumber(formState.per_km_rate),
      ot_rate: parseOptionalNumber(formState.ot_rate),
      long_km_threshold: parseOptionalNumber(formState.long_km_threshold),
      no_km_limit_cap_km: parseOptionalNumber(formState.no_km_limit_cap_km),
      long_day_hours: parseOptionalNumber(formState.long_day_hours),
      long_night_halt_hours: parseOptionalNumber(formState.long_night_halt_hours),
      notes: formState.notes || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="grid gap-4 lg:grid-cols-4">
        <label className="text-sm font-semibold text-slate-800">
          Vehicle Category
          <select
            value={formState.vehicle_category_id}
            onChange={(event) => setFormState((current) => ({ ...current, vehicle_category_id: event.target.value }))}
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            required
          >
            <option value="">Select category</option>
            {vehicleCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Duty Type
          <select
            value={formState.duty_type}
            onChange={(event) => setFormState((current) => ({ ...current, duty_type: event.target.value as DutyType }))}
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
          >
            {dutyTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Package Code
          <input
            value={formState.package_code}
            onChange={(event) => setFormState((current) => ({ ...current, package_code: event.target.value.toUpperCase() }))}
            placeholder="e.g. 8HR80KM"
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            required
          />
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Package Label
          <input
            value={formState.package_label}
            onChange={(event) => setFormState((current) => ({ ...current, package_label: event.target.value }))}
            placeholder="e.g. 8 HR / 80 KM"
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
            required
          />
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        <label className="text-sm font-semibold text-slate-800">
          Sort Order
          <input
            type="number"
            min="0"
            value={formState.sort_order}
            onChange={(event) => setFormState((current) => ({ ...current, sort_order: event.target.value }))}
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"
          />
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 lg:mt-7">
          <input
            type="checkbox"
            checked={formState.is_default}
            onChange={(event) => setFormState((current) => ({ ...current, is_default: event.target.checked }))}
          />
          Default package
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 lg:mt-7 lg:col-span-2">
          <input
            type="checkbox"
            checked={formState.use_higher_of_km_hr}
            onChange={(event) => setFormState((current) => ({ ...current, use_higher_of_km_hr: event.target.checked }))}
          />
          Use higher of extra KM or extra hour charge
        </label>
      </div>
      {(isPackageDuty || isFixedDuty) ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="text-sm font-semibold text-slate-800">
            Base Hours
            <input type="number" min="0" step="0.25" value={formState.base_hours} onChange={(event) => setFormState((current) => ({ ...current, base_hours: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Base KM
            <input type="number" min="0" step="0.1" value={formState.base_km} onChange={(event) => setFormState((current) => ({ ...current, base_km: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            {isFixedDuty ? 'Fixed Amount' : 'Base Amount'}
            <input type="number" min="0" step="0.01" value={isFixedDuty ? formState.fixed_amount : formState.base_amount} onChange={(event) => setFormState((current) => ({ ...current, [isFixedDuty ? 'fixed_amount' : 'base_amount']: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
        </div>
      ) : null}
      {isPackageDuty ? (
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="text-sm font-semibold text-slate-800">
            Extra KM Rate
            <input type="number" min="0" step="0.01" value={formState.extra_km_rate} onChange={(event) => setFormState((current) => ({ ...current, extra_km_rate: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Extra Hour Rate
            <input type="number" min="0" step="0.01" value={formState.extra_hr_rate} onChange={(event) => setFormState((current) => ({ ...current, extra_hr_rate: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Fuel Divisor
            <input type="number" min="0" step="0.0001" value={formState.fuel_divisor} onChange={(event) => setFormState((current) => ({ ...current, fuel_divisor: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Fuel Price / Unit
            <input type="number" min="0" step="0.0001" value={formState.fuel_price_per_unit} onChange={(event) => setFormState((current) => ({ ...current, fuel_price_per_unit: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-4">
        <label className="text-sm font-semibold text-slate-800">
          Night Halt Rate
          <input type="number" min="0" step="0.01" value={formState.night_halt_rate} onChange={(event) => setFormState((current) => ({ ...current, night_halt_rate: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
        </label>
        {isFixedDuty ? (
          <label className="text-sm font-semibold text-slate-800">
            Alternate Base Amount
            <input type="number" min="0" step="0.01" value={formState.base_amount} onChange={(event) => setFormState((current) => ({ ...current, base_amount: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
        ) : null}
        {isLongDuty ? (
          <>
            <label className="text-sm font-semibold text-slate-800">
              Per KM Rate
              <input type="number" min="0" step="0.01" value={formState.per_km_rate} onChange={(event) => setFormState((current) => ({ ...current, per_km_rate: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              OT Rate
              <input type="number" min="0" step="0.01" value={formState.ot_rate} onChange={(event) => setFormState((current) => ({ ...current, ot_rate: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Long Day Hours
              <input type="number" min="0" step="0.25" value={formState.long_day_hours} onChange={(event) => setFormState((current) => ({ ...current, long_day_hours: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Long Night Halt Hours
              <input type="number" min="0" step="0.25" value={formState.long_night_halt_hours} onChange={(event) => setFormState((current) => ({ ...current, long_night_halt_hours: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
            </label>
          </>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="text-sm font-semibold text-slate-800">
          Long KM Threshold
          <input type="number" min="0" step="0.1" value={formState.long_km_threshold} onChange={(event) => setFormState((current) => ({ ...current, long_km_threshold: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
        </label>
        <label className="text-sm font-semibold text-slate-800">
          No KM Limit Cap KM
          <input type="number" min="0" step="0.1" value={formState.no_km_limit_cap_km} onChange={(event) => setFormState((current) => ({ ...current, no_km_limit_cap_km: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          <span className="mt-1 block text-xs font-normal text-slate-500">Stored for GT configuration. Billing meaning is pending confirmation.</span>
        </label>
        <label className="text-sm font-semibold text-slate-800">
          Fixed Amount
          <input type="number" min="0" step="0.01" value={formState.fixed_amount} onChange={(event) => setFormState((current) => ({ ...current, fixed_amount: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-800">
        Notes
        <textarea value={formState.notes} onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Internal notes about this package" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
          {saving ? 'Saving...' : initialItem ? 'Update Package' : 'Add Package'}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
