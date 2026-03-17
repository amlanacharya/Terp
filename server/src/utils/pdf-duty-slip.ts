import PDFDocument from 'pdfkit';

type PdfDoc = InstanceType<typeof PDFDocument>;

export interface DutySlipPdfMetric {
  seq: number;
  start_date: string;
  start_time: string;
  start_km: number;
  end_date: string | null;
  end_time: string | null;
  end_km: number | null;
  segment_km: number | null;
  segment_hours: number | null;
}

export interface DutySlipPdfLineItem {
  label: string;
  amount: number;
}

export interface DutySlipPdfData {
  trip_number: string;
  trip_date: string;
  status: string;
  duty_type: string | null;
  from_location: string;
  to_location: string;
  customer_name: string;
  customer_code: string;
  customer_contact_person: string | null;
  customer_phone: string | null;
  booked_by: string | null;
  report_to: string | null;
  driver_name: string;
  driver_code: string;
  driver_phone: string | null;
  vehicle_number: string;
  vehicle_type: string;
  vehicle_category_name: string | null;
  rate_chart_name: string | null;
  package_label: string | null;
  fixed_route_label: string | null;
  total_km: number | null;
  total_hours: number | null;
  night_halts: number | null;
  advance_hirer: number;
  advance_travels: number;
  fuel_advance: number;
  cash_advance: number;
  calculated_amount: number | null;
  trip_amount: number;
  remarks: string | null;
  metrics: DutySlipPdfMetric[];
  line_items: DutySlipPdfLineItem[];
}

function formatCurrency(value: number | null | undefined): string {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN');
}

function formatHours(value: number | null | undefined): string {
  return value == null ? '-' : `${Number(value).toFixed(2)} hrs`;
}

function formatKm(value: number | null | undefined): string {
  return value == null ? '-' : `${Number(value).toFixed(2)} km`;
}

function ensureSpace(doc: PdfDoc, neededHeight: number): void {
  if (doc.y + neededHeight <= doc.page.height - doc.page.margins.bottom) {
    return;
  }

  doc.addPage();
}

function drawHeaderCard(doc: PdfDoc, title: string, settings: Record<string, string>): void {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const top = doc.y;

  doc.save();
  doc.roundedRect(left, top, width, 76, 10).fill('#0f172a');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text(settings.company_name || 'Travel ERP', left + 16, top + 14, {
    width: 260,
  });
  doc.font('Helvetica').fontSize(10).text(settings.company_address || '-', left + 16, top + 40, {
    width: 260,
  });
  doc.font('Helvetica-Bold').fontSize(18).text(title, left + width - 190, top + 22, {
    width: 170,
    align: 'right',
  });
  doc.restore();
  doc.y = top + 92;
}

function drawSectionTitle(doc: PdfDoc, title: string): void {
  ensureSpace(doc, 30);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;

  doc.save();
  doc.roundedRect(x, y, width, 22, 6).fill('#e2e8f0');
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text(title, x + 10, y + 6, {
    width: width - 20,
  });
  doc.restore();
  doc.moveDown(1.4);
}

function drawLabelValue(doc: PdfDoc, x: number, y: number, label: string, value: string, width: number): void {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text(label, x, y, { width });
  doc.font('Helvetica').fontSize(10).fillColor('#111827').text(value, x, y + 12, { width });
}

function drawInfoBox(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  title: string,
  rows: Array<{ label: string; value: string }>
): number {
  const contentHeight = Math.max(88, 18 + rows.length * 26);

  doc.save();
  doc.roundedRect(x, y, width, contentHeight, 8).lineWidth(1).stroke('#cbd5e1');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(title, x + 12, y + 10, {
    width: width - 24,
  });
  doc.moveTo(x + 12, y + 28).lineTo(x + width - 12, y + 28).stroke('#e2e8f0');

  let rowY = y + 36;
  rows.forEach((row) => {
    drawLabelValue(doc, x + 12, rowY, row.label, row.value, width - 24);
    rowY += 26;
  });
  doc.restore();

  return contentHeight;
}

function drawTableHeader(
  doc: PdfDoc,
  headers: string[],
  widths: number[],
  startX: number,
  startY: number
): number {
  const rowHeight = 22;
  let x = startX;

  doc.save();
  headers.forEach((header, index) => {
    doc.rect(x, startY, widths[index], rowHeight).fillAndStroke('#0f172a', '#0f172a');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text(header, x + 4, startY + 7, {
      width: widths[index] - 8,
      align: index === 0 ? 'center' : 'left',
    });
    x += widths[index];
  });
  doc.restore();

  return startY + rowHeight;
}

function drawMetricsTable(doc: PdfDoc, metrics: DutySlipPdfMetric[]): void {
  if (metrics.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#475569').text('No travel metrics captured for this trip.');
    doc.moveDown();
    return;
  }

  const startX = doc.page.margins.left;
  const widths = [28, 102, 66, 102, 66, 60, 60];
  const headers = ['#', 'Start', 'Start KM', 'End', 'End KM', 'Seg KM', 'Seg Hrs'];
  let y = drawTableHeader(doc, headers, widths, startX, doc.y);

  metrics.forEach((metric) => {
    const startText = `${formatDate(metric.start_date)} ${metric.start_time}`;
    const endText = metric.end_date && metric.end_time ? `${formatDate(metric.end_date)} ${metric.end_time}` : 'Open';
    const values = [
      String(metric.seq),
      startText,
      formatKm(metric.start_km),
      endText,
      formatKm(metric.end_km),
      formatKm(metric.segment_km),
      metric.segment_hours == null ? '-' : metric.segment_hours.toFixed(2),
    ];

    const rowHeight = Math.max(
      22,
      doc.heightOfString(values[1], { width: widths[1] - 8 }) + 10,
      doc.heightOfString(values[3], { width: widths[3] - 8 }) + 10
    );

    ensureSpace(doc, rowHeight + 20);

    let x = startX;
    values.forEach((value, index) => {
      doc.rect(x, y, widths[index], rowHeight).stroke('#cbd5e1');
      doc.font('Helvetica').fontSize(8).fillColor('#111827').text(value, x + 4, y + 6, {
        width: widths[index] - 8,
        align: index === 0 ? 'center' : 'left',
      });
      x += widths[index];
    });

    y += rowHeight;
  });

  doc.y = y + 12;
}

function drawAmountTable(doc: PdfDoc, lineItems: DutySlipPdfLineItem[]): void {
  const rows = lineItems.length > 0 ? lineItems : [{ label: 'No calculation snapshot', amount: 0 }];
  const startX = doc.page.margins.left;
  const widths = [280, 150];
  const headers = ['Charge Head', 'Amount'];
  let y = drawTableHeader(doc, headers, widths, startX, doc.y);

  rows.forEach((row) => {
    const rowHeight = 22;
    ensureSpace(doc, rowHeight + 20);

    doc.rect(startX, y, widths[0], rowHeight).stroke('#cbd5e1');
    doc.rect(startX + widths[0], y, widths[1], rowHeight).stroke('#cbd5e1');
    doc.font('Helvetica').fontSize(9).fillColor('#111827').text(row.label, startX + 6, y + 6, {
      width: widths[0] - 12,
    });
    doc.text(formatCurrency(row.amount), startX + widths[0] + 6, y + 6, {
      width: widths[1] - 12,
      align: 'right',
    });
    y += rowHeight;
  });

  doc.y = y + 12;
}

function drawTotalsBox(
  doc: PdfDoc,
  rows: Array<{ label: string; value: string; emphasized?: boolean }>
): void {
  ensureSpace(doc, 140);
  const boxWidth = 240;
  const x = doc.page.width - doc.page.margins.right - boxWidth;
  const y = doc.y;
  const height = 20 + rows.length * 20;

  doc.save();
  doc.roundedRect(x, y, boxWidth, height, 8).lineWidth(1).stroke('#cbd5e1');

  let rowY = y + 12;
  rows.forEach((row, index) => {
    if (index > 0) {
      doc.moveTo(x + 12, rowY - 6).lineTo(x + boxWidth - 12, rowY - 6).stroke('#e2e8f0');
    }

    doc
      .font(row.emphasized ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(row.emphasized ? 11 : 10)
      .fillColor('#0f172a')
      .text(row.label, x + 12, rowY, { width: 110 });
    doc.text(row.value, x + 118, rowY, {
      width: boxWidth - 130,
      align: 'right',
    });
    rowY += 20;
  });
  doc.restore();
  doc.y = y + height + 12;
}

export function buildDutySlipPdf(
  dutySlip: DutySlipPdfData,
  settings: Record<string, string>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeaderCard(doc, 'DUTY SLIP', settings);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    const boxGap = 14;
    const boxWidth = (pageWidth - boxGap) / 2;
    const top = doc.y;

    const partyHeight = drawInfoBox(doc, left, top, boxWidth, 'Trip Party', [
      { label: 'Customer', value: `${dutySlip.customer_name} (${dutySlip.customer_code})` },
      { label: 'Contact', value: dutySlip.customer_contact_person || '-' },
      { label: 'Phone', value: dutySlip.customer_phone || '-' },
      { label: 'Booked By', value: dutySlip.booked_by || '-' },
      { label: 'Report To', value: dutySlip.report_to || '-' },
    ]);
    const tripHeight = drawInfoBox(doc, left + boxWidth + boxGap, top, boxWidth, 'Duty Summary', [
      { label: 'Trip Number', value: dutySlip.trip_number },
      { label: 'Trip Date', value: formatDate(dutySlip.trip_date) },
      { label: 'Duty Type', value: dutySlip.duty_type || '-' },
      { label: 'Status', value: dutySlip.status },
      { label: 'Route', value: `${dutySlip.from_location} -> ${dutySlip.to_location}` },
    ]);
    doc.y = top + Math.max(partyHeight, tripHeight) + 16;

    const assetTop = doc.y;
    const assetHeight = drawInfoBox(doc, left, assetTop, boxWidth, 'Vehicle And Driver', [
      { label: 'Vehicle', value: dutySlip.vehicle_number },
      { label: 'Vehicle Type', value: dutySlip.vehicle_type },
      { label: 'GT Category', value: dutySlip.vehicle_category_name || '-' },
      { label: 'Driver', value: `${dutySlip.driver_name} (${dutySlip.driver_code})` },
      { label: 'Driver Phone', value: dutySlip.driver_phone || '-' },
    ]);
    const rateHeight = drawInfoBox(doc, left + boxWidth + boxGap, assetTop, boxWidth, 'Rate Source', [
      { label: 'Rate Chart', value: dutySlip.rate_chart_name || '-' },
      { label: 'Package', value: dutySlip.package_label || '-' },
      { label: 'Fixed Route', value: dutySlip.fixed_route_label || '-' },
      { label: 'Total KM', value: formatKm(dutySlip.total_km) },
      { label: 'Total Hours', value: formatHours(dutySlip.total_hours) },
      { label: 'Night Halts', value: dutySlip.night_halts == null ? '-' : String(dutySlip.night_halts) },
    ]);
    doc.y = assetTop + Math.max(assetHeight, rateHeight) + 16;

    drawSectionTitle(doc, 'Travel Metrics');
    drawMetricsTable(doc, dutySlip.metrics);

    drawSectionTitle(doc, 'Advances');
    drawTotalsBox(doc, [
      { label: 'Advance Hirer', value: formatCurrency(dutySlip.advance_hirer) },
      { label: 'Advance Travels', value: formatCurrency(dutySlip.advance_travels) },
      { label: 'Fuel Advance', value: formatCurrency(dutySlip.fuel_advance) },
      { label: 'Cash Advance', value: formatCurrency(dutySlip.cash_advance) },
    ]);

    drawSectionTitle(doc, 'Rate Breakdown');
    drawAmountTable(doc, dutySlip.line_items);
    drawTotalsBox(doc, [
      { label: 'Calculated Amount', value: formatCurrency(dutySlip.calculated_amount) },
      { label: 'Final Billed Amount', value: formatCurrency(dutySlip.trip_amount), emphasized: true },
    ]);

    if (dutySlip.remarks) {
      drawSectionTitle(doc, 'Remarks');
      ensureSpace(doc, 60);
      doc.roundedRect(left, doc.y, pageWidth, 56, 8).stroke('#cbd5e1');
      doc.font('Helvetica').fontSize(10).fillColor('#111827').text(dutySlip.remarks, left + 12, doc.y + 12, {
        width: pageWidth - 24,
      });
      doc.y += 70;
    }

    ensureSpace(doc, 40);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Computer-generated duty slip', {
      align: 'center',
    });
    doc.end();
  });
}
