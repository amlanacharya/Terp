import { describe, expect, it } from 'vitest';
import {
  buildClosedExternalDutySlipPdf,
  buildDutySlipPdf,
  buildOpenExternalDutySlipPdf,
} from './pdf-duty-slip';

function countPages(buffer: Buffer): number {
  return (buffer.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
}

function containsPdfText(buffer: Buffer, value: string): boolean {
  const pdfText = buffer.toString('latin1').toLowerCase();
  const hexValue = Buffer.from(value, 'latin1').toString('hex').toLowerCase();
  return pdfText.includes(hexValue);
}

const settings = {
  company_name: 'Gayatri Travels',
  company_address: 'Janpath, Bhubaneswar, Odisha - 751022',
};

const dutySlipData = {
  trip_number: 'GT-TRP-2001',
  trip_date: '2026-03-18',
  status: 'completed',
  duty_type: 'outstation',
  from_location: 'MCL HQ',
  to_location: 'Talcher Mine',
  purpose: 'Mine duty movement',
  customer_name: 'MCL Mining Division',
  customer_code: 'GT-CUST-MCL',
  customer_address: 'MCL Area Office, Sambalpur',
  customer_contact_person: 'Deepak Bhoi',
  customer_phone: '+91-9234567805',
  booked_by: 'Dispatch Desk',
  report_to: 'Mine Admin',
  driver_name: 'Suresh Nayak',
  driver_code: 'GTDRV001',
  driver_phone: '+91-9876543210',
  vehicle_number: 'OD02AB1234',
  vehicle_type: 'car',
  vehicle_category_name: 'CRYSTA',
  rate_chart_name: 'MCL FY26 Chart',
  package_label: '8 HR / 80 KM',
  fixed_route_label: null,
  total_km: 250,
  total_hours: 7,
  night_halts: 0,
  advance_hirer: 500,
  advance_travels: 300,
  fuel_advance: 200,
  cash_advance: 100,
  calculated_amount: 6000,
  trip_amount: 6300,
  remarks: 'Carry gate pass copy.',
  metrics: [
    {
      seq: 1,
      start_date: '2026-03-18',
      start_time: '06:30',
      start_km: 70000,
      end_date: '2026-03-18',
      end_time: '10:15',
      end_km: 70120,
      segment_km: 120,
      segment_hours: 3.75,
    },
    {
      seq: 2,
      start_date: '2026-03-18',
      start_time: '11:00',
      start_km: 70120,
      end_date: '2026-03-18',
      end_time: '14:15',
      end_km: 70250,
      segment_km: 130,
      segment_hours: 3.25,
    },
  ],
  expenses: [
    {
      expense_type: 'fuel',
      amount: 900,
      description: 'Fuel top-up before return',
    },
    {
      expense_type: 'toll',
      amount: 120,
      description: 'Talcher entry toll',
    },
  ],
  line_items: [
    { label: 'Base Charge', amount: 5400 },
    { label: 'Extra KM Charge', amount: 600 },
  ],
};

describe('duty slip PDF builders', () => {
  it('buildOpenExternalDutySlipPdf omits internal billing labels', async () => {
    const pdf = await buildOpenExternalDutySlipPdf(dutySlipData, settings);

    expect(countPages(pdf)).toBeGreaterThan(0);
    expect(containsPdfText(pdf, 'NAME & ADDRESS OF HIRER')).toBe(true);
    expect(containsPdfText(pdf, 'Calculated Amount')).toBe(false);
    expect(containsPdfText(pdf, 'Final Billed Amount')).toBe(false);
    expect(containsPdfText(pdf, 'Rate Source')).toBe(false);
  });

  it('buildClosedExternalDutySlipPdf includes expense content without billing labels', async () => {
    const pdf = await buildClosedExternalDutySlipPdf(dutySlipData, settings);

    expect(countPages(pdf)).toBeGreaterThan(0);
    expect(containsPdfText(pdf, 'TRIP COSTS INCURRED')).toBe(true);
    expect(containsPdfText(pdf, 'Calculated Amount')).toBe(false);
    expect(containsPdfText(pdf, 'Final Billed Amount')).toBe(false);
  });

  it('buildDutySlipPdf keeps calculation labels for the internal variant', async () => {
    const pdf = await buildDutySlipPdf(dutySlipData, settings, 'internal');

    expect(countPages(pdf)).toBeGreaterThan(0);
    expect(containsPdfText(pdf, 'Calculated Amount')).toBe(true);
    expect(containsPdfText(pdf, 'Final Billed Amount')).toBe(true);
  });
});



