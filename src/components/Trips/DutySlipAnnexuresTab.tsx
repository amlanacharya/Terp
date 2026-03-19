import { TripDetail } from '../../lib/types';
import { AnnexureList } from '../Annexures/AnnexureList';

interface DutySlipAnnexuresTabProps {
  parentTrip: TripDetail;
  onRefresh: () => Promise<void>;
}

export function DutySlipAnnexuresTab({ parentTrip, onRefresh }: DutySlipAnnexuresTabProps) {
  if (parentTrip.parent_trip_id) {
    return <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Annexures are managed from the parent duty slip only.</p>;
  }

  return <AnnexureList parentTrip={parentTrip} embedded onChange={onRefresh} />;
}