import PDFDocument from 'pdfkit';

type PdfDoc = InstanceType<typeof PDFDocument>;

const PAGE_MARGIN = 40;
const EXTERNAL_MIN_MOVEMENT_ROWS = 5;

export type DutySlipVariant = 'open_external' | 'closed_external' | 'internal';

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

export interface DutySlipExpense {
  expense_type: string;
  amount: number;
  description: string | null;
}

export interface DutySlipPdfData {
  trip_number: string;
  trip_date: string;
  status: string;
  duty_type: string | null;
  from_location: string;
  to_location: string;
  purpose: string | null;
  customer_name: string;
  customer_code: string;
  customer_address: string | null;
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
  expenses: DutySlipExpense[];
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

function formatGridTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value.slice(0, 5);
}

function formatGridNumber(value: number | null | undefined): string {
  if (value == null) {
    return '';
  }

  return Number(value).toFixed(Number.isInteger(Number(value)) ? 0 : 2);
}

function getExternalDutyLabel(dutySlip: DutySlipPdfData): string {
  if (dutySlip.purpose && dutySlip.purpose.trim().length > 0) {
    return dutySlip.purpose.trim();
  }

  if (dutySlip.duty_type && dutySlip.duty_type.trim().length > 0) {
    return dutySlip.duty_type.replace(/_/g, ' ');
  }

  return `${dutySlip.from_location} to ${dutySlip.to_location}`;
}

function createPdfBuffer(render: (doc: PdfDoc) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, compress: false });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    render(doc);
    doc.end();
  });
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

function drawLabelValue(doc: PdfDoc, x: number, y: number, label: string, value: string, width: number): number {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text(label, x, y, { width });
  const labelHeight = doc.heightOfString(label, { width });
  doc.font('Helvetica').fontSize(10).fillColor('#111827').text(value, x, y + labelHeight + 2, { width });
  const valueHeight = doc.heightOfString(value, { width });
  return Math.max(26, labelHeight + valueHeight + 10);
}

function drawInfoBox(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  title: string,
  rows: Array<{ label: string; value: string }>
): number {
  const innerWidth = width - 24;
  const rowHeights = rows.map((row) => {
    doc.font('Helvetica-Bold').fontSize(9);
    const labelHeight = doc.heightOfString(row.label, { width: innerWidth });
    doc.font('Helvetica').fontSize(10);
    const valueHeight = doc.heightOfString(row.value, { width: innerWidth });
    return Math.max(26, labelHeight + valueHeight + 10);
  });
  const contentHeight = Math.max(88, 36 + rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0));

  doc.save();
  doc.roundedRect(x, y, width, contentHeight, 8).lineWidth(1).stroke('#cbd5e1');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(title, x + 12, y + 10, {
    width: innerWidth,
  });
  doc.moveTo(x + 12, y + 28).lineTo(x + width - 12, y + 28).stroke('#e2e8f0');

  let rowY = y + 36;
  rows.forEach((row) => {
    rowY += drawLabelValue(doc, x + 12, rowY, row.label, row.value, innerWidth);
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
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
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

    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = drawTableHeader(doc, headers, widths, startX, doc.y);
    }

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
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  let y = drawTableHeader(doc, headers, widths, startX, doc.y);

  rows.forEach((row) => {
    const rowHeight = Math.max(22, doc.heightOfString(row.label, { width: widths[0] - 12 }) + 10);
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = drawTableHeader(doc, headers, widths, startX, doc.y);
    }

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

function renderInternalDutySlipContent(doc: PdfDoc, dutySlip: DutySlipPdfData, settings: Record<string, string>): void {
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
    doc.font('Helvetica').fontSize(10);
    const remarksBoxHeight = Math.max(40, doc.heightOfString(dutySlip.remarks, { width: pageWidth - 24 }) + 24);
    ensureSpace(doc, remarksBoxHeight + 12);
    const remarksY = doc.y;
    doc.roundedRect(left, remarksY, pageWidth, remarksBoxHeight, 8).stroke('#cbd5e1');
    doc.font('Helvetica').fontSize(10).fillColor('#111827').text(dutySlip.remarks, left + 12, remarksY + 12, {
      width: pageWidth - 24,
    });
    doc.y = remarksY + remarksBoxHeight + 8;
  }
  ensureSpace(doc, 40);
  doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Computer-generated duty slip', {
    align: 'center',
  });
}

function drawExternalHeader(doc: PdfDoc, dutySlip: DutySlipPdfData, settings: Record<string, string>): void {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const top = doc.y;

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('DUTY SLIP', left, top, {
    width,
    align: 'center',
  });
  doc.font('Helvetica-Bold').fontSize(23).text(settings.company_name || 'Travel ERP', left, top + 16, {
    width,
    align: 'center',
  });
  doc.font('Helvetica').fontSize(10).text(settings.company_address || '-', left, top + 46, {
    width,
    align: 'center',
  });

  const metaY = top + 82;
  doc.font('Helvetica').fontSize(10).text(`Date: ${formatDate(dutySlip.trip_date)}`, left, metaY);
  doc.text(`No. ${dutySlip.trip_number}`, left + width - 170, metaY, {
    width: 170,
    align: 'right',
  });
  doc.moveTo(left, metaY + 18).lineTo(left + width, metaY + 18).stroke('#111827');
  doc.y = metaY + 26;
}

function drawExternalFieldLine(
  doc: PdfDoc,
  label: string,
  value: string,
  options?: { lineCount?: number; labelWidth?: number }
): void {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const lineCount = options?.lineCount ?? 1;
  const labelWidth = options?.labelWidth ?? 145;
  const y = doc.y;
  const lineHeight = 18;
  const height = lineCount * lineHeight;

  ensureSpace(doc, height + 10);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(label, left, y, { width: labelWidth });
  doc.font('Helvetica').fontSize(10).text(value || '', left + labelWidth, y, {
    width: width - labelWidth,
    lineGap: 2,
  });

  for (let index = 0; index < lineCount; index += 1) {
    const lineY = y + (index + 1) * lineHeight;
    doc.moveTo(left, lineY).lineTo(left + width, lineY).stroke('#111827');
  }

  doc.y = y + height + 8;
}

function drawExternalSplitRow(
  doc: PdfDoc,
  leftLabel: string,
  leftValue: string,
  rightLabel: string,
  rightValue: string
): void {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 18;
  const columnWidth = (width - gap) / 2;
  const y = doc.y;

  ensureSpace(doc, 28);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(leftLabel, left, y, { width: 90 });
  doc.font('Helvetica').text(leftValue || '', left + 90, y, { width: columnWidth - 90 });
  doc.font('Helvetica-Bold').text(rightLabel, left + columnWidth + gap, y, { width: 90 });
  doc.font('Helvetica').text(rightValue || '', left + columnWidth + gap + 90, y, { width: columnWidth - 90 });
  doc.moveTo(left, y + 18).lineTo(left + columnWidth, y + 18).stroke('#111827');
  doc.moveTo(left + columnWidth + gap, y + 18).lineTo(left + width, y + 18).stroke('#111827');
  doc.y = y + 24;
}

function drawExternalSectionLabel(doc: PdfDoc, label: string): void {
  ensureSpace(doc, 24);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(label, doc.page.margins.left, doc.y);
  doc.y += 6;
}

function drawExternalMovementGrid(doc: PdfDoc, metrics: DutySlipPdfMetric[], blank: boolean): void {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const ratios = [1.18, 1, 1.02, 1, 1.02, 1.18];
  const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
  const widths = ratios.map((ratio) => (width * ratio) / totalRatio);
  const headers = ['Starting\nDate', 'Starting\nTime', 'Starting\nKM', 'Closing\nTime', 'Closing\nKM', 'Closing\nDate'];
  const gridRows = blank
    ? []
    : [...metrics].sort((first, second) => first.seq - second.seq).map((metric) => ([
        formatDate(metric.start_date),
        formatGridTime(metric.start_time),
        formatGridNumber(metric.start_km),
        formatGridTime(metric.end_time),
        formatGridNumber(metric.end_km),
        metric.end_date ? formatDate(metric.end_date) : '',
      ]));
  const totalRows = Math.max(EXTERNAL_MIN_MOVEMENT_ROWS, gridRows.length || 0);
  const headerHeight = 28;
  const rowHeight = 24;

  ensureSpace(doc, headerHeight + totalRows * rowHeight + 12);
  let x = left;
  const headerY = doc.y;

  headers.forEach((header, index) => {
    doc.rect(x, headerY, widths[index], headerHeight).stroke('#111827');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#111827').text(header, x + 4, headerY + 6, {
      width: widths[index] - 8,
      align: 'center',
    });
    x += widths[index];
  });

  let y = headerY + headerHeight;
  for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
    const row = blank ? ['', '', '', '', '', ''] : gridRows[rowIndex] ?? ['', '', '', '', '', ''];
    x = left;

    row.forEach((value, index) => {
      doc.rect(x, y, widths[index], rowHeight).stroke('#111827');
      doc.font('Helvetica').fontSize(8.5).fillColor('#111827').text(value, x + 4, y + 7, {
        width: widths[index] - 8,
        align: index === 2 || index === 4 ? 'right' : 'center',
      });
      x += widths[index];
    });

    y += rowHeight;
  }

  doc.y = y + 10;
}

function drawExternalExpensesTable(doc: PdfDoc, expenses: DutySlipExpense[]): void {
  drawExternalSectionLabel(doc, 'TRIP COSTS INCURRED');

  if (expenses.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#111827').text('No recorded expenses.', doc.page.margins.left, doc.y + 4);
    doc.y += 20;
    return;
  }

  const left = doc.page.margins.left;
  const widths = [120, 265, 130];
  const headers = ['Expense Type', 'Description', 'Amount'];
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  let y = drawTableHeader(doc, headers, widths, left, doc.y);
  let totalAmount = 0;

  expenses.forEach((expense) => {
    const description = expense.description && expense.description.trim().length > 0 ? expense.description : '-';
    const rowHeight = Math.max(24, doc.heightOfString(description, { width: widths[1] - 10 }) + 10);
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = drawTableHeader(doc, headers, widths, left, doc.y);
    }

    doc.rect(left, y, widths[0], rowHeight).stroke('#cbd5e1');
    doc.rect(left + widths[0], y, widths[1], rowHeight).stroke('#cbd5e1');
    doc.rect(left + widths[0] + widths[1], y, widths[2], rowHeight).stroke('#cbd5e1');
    doc.font('Helvetica').fontSize(9).fillColor('#111827').text(expense.expense_type.replace(/_/g, ' '), left + 6, y + 7, {
      width: widths[0] - 12,
    });
    doc.text(description, left + widths[0] + 6, y + 7, {
      width: widths[1] - 12,
    });
    doc.text(formatCurrency(expense.amount), left + widths[0] + widths[1] + 6, y + 7, {
      width: widths[2] - 12,
      align: 'right',
    });
    y += rowHeight;
    totalAmount += Number(expense.amount || 0);
  });

  const totalHeight = 24;
  if (y + totalHeight > bottomLimit) {
    doc.addPage();
    y = drawTableHeader(doc, headers, widths, left, doc.y);
  }
  doc.rect(left, y, widths[0] + widths[1], totalHeight).stroke('#111827');
  doc.rect(left + widths[0] + widths[1], y, widths[2], totalHeight).stroke('#111827');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text('Total Incurred', left + 6, y + 7, {
    width: widths[0] + widths[1] - 12,
    align: 'right',
  });
  doc.text(formatCurrency(totalAmount), left + widths[0] + widths[1] + 6, y + 7, {
    width: widths[2] - 12,
    align: 'right',
  });
  doc.y = y + totalHeight + 10;
}

function drawExternalAdvancesTable(doc: PdfDoc, dutySlip: DutySlipPdfData): void {
  drawExternalSectionLabel(doc, 'ADV. PAID');

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const firstColWidth = 120;
  const otherColWidth = (width - firstColWidth) / 2;
  const headers = ['ADV. PAID', 'HIRER', 'TRAVELS'];
  const values = ['', formatCurrency(dutySlip.advance_hirer), formatCurrency(dutySlip.advance_travels)];
  const widths = [firstColWidth, otherColWidth, otherColWidth];
  const headerHeight = 22;
  const rowHeight = 24;

  ensureSpace(doc, headerHeight + rowHeight + 12);
  let x = left;
  const y = doc.y;

  headers.forEach((header, index) => {
    doc.rect(x, y, widths[index], headerHeight).stroke('#111827');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(header, x + 4, y + 6, {
      width: widths[index] - 8,
      align: 'center',
    });
    x += widths[index];
  });

  x = left;
  values.forEach((value, index) => {
    doc.rect(x, y + headerHeight, widths[index], rowHeight).stroke('#111827');
    doc.font('Helvetica').fontSize(9).fillColor('#111827').text(value, x + 4, y + headerHeight + 7, {
      width: widths[index] - 8,
      align: 'center',
    });
    x += widths[index];
  });

  doc.y = y + headerHeight + rowHeight + 10;
}

function drawExternalRemarks(doc: PdfDoc, remarks: string | null): void {
  if (!remarks) {
    return;
  }

  const labelWidth = 90;
  const valueWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right - labelWidth;
  doc.font('Helvetica').fontSize(10);
  const textHeight = doc.heightOfString(remarks, { width: valueWidth, lineGap: 2 });
  const lineCount = Math.max(1, Math.ceil(textHeight / 18));
  drawExternalFieldLine(doc, 'REMARKS', remarks, { labelWidth, lineCount });
}

function drawExternalSignatureBlock(doc: PdfDoc, settings: Record<string, string>): void {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const footerLines = [
    'PLEASE MENTION TOTAL KMS / MOST URGENT',
    'FULL SIGNATURE OF THE CLIENT',
  ];

  ensureSpace(doc, 90);
  footerLines.forEach((line) => {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(line, left, doc.y, {
      width,
      align: 'center',
    });
    doc.y += 2;
  });

  doc.y += 8;
  const labelY = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).text(`For ${(settings.company_name || 'Travel ERP').toUpperCase()}`, left, labelY, {
    width: width / 2,
  });
  doc.text('Signature of the Hirer', left + width / 2, labelY, {
    width: width / 2,
    align: 'right',
  });
  doc.moveTo(left, labelY + 22).lineTo(left + 170, labelY + 22).stroke('#111827');
  doc.moveTo(left + width - 170, labelY + 22).lineTo(left + width, labelY + 22).stroke('#111827');
  doc.y = labelY + 28;

  doc.font('Helvetica').fontSize(8.5).fillColor('#334155').text('N.B.: Time and Kilometre will be charged from office to office.', left, doc.y, {
    width,
    align: 'left',
  });
  doc.y += 12;
  doc.font('Helvetica').fontSize(8.5).fillColor('#64748b').text('Computer-generated duty slip', left, doc.y, {
    width,
    align: 'center',
  });
}

function renderExternalDutySlipCommon(doc: PdfDoc, dutySlip: DutySlipPdfData, settings: Record<string, string>, blankMovement: boolean): void {
  drawExternalHeader(doc, dutySlip, settings);
  drawExternalFieldLine(
    doc,
    'NAME & ADDRESS OF HIRER',
    [dutySlip.customer_name, dutySlip.customer_address].filter(Boolean).join(', '),
    { lineCount: 2, labelWidth: 165 }
  );
  drawExternalFieldLine(doc, 'BOOKED BY', dutySlip.booked_by || '-', { labelWidth: 95 });
  drawExternalFieldLine(doc, 'REPORT TO', dutySlip.report_to || '-', { labelWidth: 95 });
  drawExternalFieldLine(doc, 'NATURE OF DUTY', getExternalDutyLabel(dutySlip), { labelWidth: 125 });
  drawExternalSplitRow(doc, 'CAR NO.', dutySlip.vehicle_number, "Driver's Name", dutySlip.driver_name);
  drawExternalSectionLabel(doc, 'MOVEMENT RECORD');
  drawExternalMovementGrid(doc, dutySlip.metrics, blankMovement);
}

export function buildInternalDutySlipPdf(
  dutySlip: DutySlipPdfData,
  settings: Record<string, string>
): Promise<Buffer> {
  return createPdfBuffer((doc) => {
    renderInternalDutySlipContent(doc, dutySlip, settings);
  });
}

export function buildOpenExternalDutySlipPdf(
  dutySlip: DutySlipPdfData,
  settings: Record<string, string>
): Promise<Buffer> {
  return createPdfBuffer((doc) => {
    renderExternalDutySlipCommon(doc, dutySlip, settings, true);
    drawExternalAdvancesTable(doc, dutySlip);
    drawExternalRemarks(doc, dutySlip.remarks);
    drawExternalSignatureBlock(doc, settings);
  });
}

export function buildClosedExternalDutySlipPdf(
  dutySlip: DutySlipPdfData,
  settings: Record<string, string>
): Promise<Buffer> {
  return createPdfBuffer((doc) => {
    renderExternalDutySlipCommon(doc, dutySlip, settings, false);
    drawExternalExpensesTable(doc, dutySlip.expenses);
    drawExternalAdvancesTable(doc, dutySlip);
    drawExternalRemarks(doc, dutySlip.remarks);
    drawExternalSignatureBlock(doc, settings);
  });
}

export function buildDutySlipPdf(
  dutySlip: DutySlipPdfData,
  settings: Record<string, string>,
  variant: DutySlipVariant
): Promise<Buffer> {
  if (variant === 'open_external') {
    return buildOpenExternalDutySlipPdf(dutySlip, settings);
  }

  if (variant === 'closed_external') {
    return buildClosedExternalDutySlipPdf(dutySlip, settings);
  }

  return buildInternalDutySlipPdf(dutySlip, settings);
}
