import { RateCalculationResult, RateChart, TripDetail } from '../../lib/types';
import { TripCalculationBreakdown } from './TripCalculationBreakdown';

interface DutySlipRateTabProps {
  trip: TripDetail | null;
  calculation: RateCalculationResult | null;
  activeRateChart: RateChart | null;
}

export function DutySlipRateTab({ trip, calculation, activeRateChart }: DutySlipRateTabProps) {
  return <TripCalculationBreakdown trip={trip} calculation={calculation} activeRateChart={activeRateChart} />;
}
