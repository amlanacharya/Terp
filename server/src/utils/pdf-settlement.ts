import PDFDocument from 'pdfkit';

type PdfDoc = InstanceType<typeof PDFDocument>;

interface SettlementTripRow {
  trip_number: string;
  trip_date: string;
  from_location: string;
  to_location: string;
  trip_amount: number;
}

interface DriverSettlementPdfData {
  settlement_number: string;
  period_from: string;
  period_to: string;
  total_trips: number;
  total_km: number;
  total_allowance: number;
  advances: number;
  deductions: number;
  net_amount: number;
  payment_mode: string | null;
  reference_number: string | null;
  status: string;
  driver_name: string;
  driver_code: string;
  driver_phone: string | null;
  bank_name: string | null;
  bank_account: string | null;
  ifsc_code: string | null;
  trips: SettlementTripRow[];
}

interface OwnerSettlementPdfData {
  settlement_number: string;
  period_from: string;
  period_to: string;
  total_trips: number;
  total_km: number;
  total_amount: number;
  tds_amount: number;
  other_deductions: number;
  net_amount: number;
  payment_mode: string | null;
  reference_number: string | null;
  status: string;
  owner_name: string;
  owner_code: string;
  owner_phone: string | null;
  bank_name: string | null;
  bank_account: string | null;
  ifsc_code: string | null;
  vehicle_number: string | null;
  trips: SettlementTripRow[];
}

function formatCurrency(value: number): string {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN');
}

function ensureSpace(doc: PdfDoc, neededHeight: number): void {
  if (doc.y + neededHeight <= doc.page.height - doc.page.margins.bottom) {
    return;
  }

  doc.addPage();
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
  const contentHeight = Math.max(76, 36 + rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0));

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
      align: index === 2 ? 'left' : 'center',
    });
    x += widths[index];
  });
  doc.restore();

  return startY + rowHeight;
}

function drawTripsTable(doc: PdfDoc, trips: SettlementTripRow[]): void {
  if (trips.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#475569').text('No trips found for this settlement period.');
    doc.moveDown();
    return;
  }

  const startX = doc.page.margins.left;
  const widths = [86, 70, 220, 99];
  const headers = ['Trip No', 'Date', 'Route', 'Amount'];
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  let y = drawTableHeader(doc, headers, widths, startX, doc.y);

  trips.forEach((trip) => {
    const routeText = `${trip.from_location} to ${trip.to_location}`;
    const rowHeight = Math.max(
      22,
      doc.heightOfString(routeText, { width: widths[2] - 8, align: 'left' }) + 10
    );

    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = drawTableHeader(doc, headers, widths, startX, doc.y);
    }

    const values = [
      trip.trip_number,
      formatDate(trip.trip_date),
      routeText,
      formatCurrency(trip.trip_amount),
    ];

    let x = startX;
    values.forEach((value, index) => {
      doc.rect(x, y, widths[index], rowHeight).stroke('#cbd5e1');
      doc.font('Helvetica').fontSize(8).fillColor('#111827').text(value, x + 4, y + 6, {
        width: widths[index] - 8,
        align: index === 2 ? 'left' : 'center',
      });
      x += widths[index];
    });
    y += rowHeight;
  });

  doc.y = y + 12;
}

function drawTotalsBox(
  doc: PdfDoc,
  rows: Array<{ label: string; value: string; emphasized?: boolean }>
): void {
  ensureSpace(doc, 120);
  const boxWidth = 230;
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

function drawHeaderCard(doc: PdfDoc, title: string, settings: Record<string, string>): void {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const top = doc.y;

  doc.save();
  doc.roundedRect(left, top, width, 72, 10).fill('#0f172a');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text(settings.company_name || 'Travel ERP', left + 16, top + 14, {
    width: 260,
  });
  doc.font('Helvetica').fontSize(10).text(settings.company_address || '-', left + 16, top + 38, {
    width: 260,
  });
  doc.font('Helvetica-Bold').fontSize(18).text(title, left + width - 200, top + 18, {
    width: 180,
    align: 'right',
  });
  doc.restore();
  doc.y = top + 88;
}

export function buildDriverSettlementPdf(
  settlement: DriverSettlementPdfData,
  settings: Record<string, string>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeaderCard(doc, 'SALARY SLIP', settings);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    const boxGap = 14;
    const boxWidth = (pageWidth - boxGap) / 2;
    const top = doc.y;

    const leftHeight = drawInfoBox(doc, left, top, boxWidth, 'Driver Details', [
      { label: 'Driver Name', value: settlement.driver_name },
      { label: 'Driver Code', value: settlement.driver_code },
      { label: 'Phone', value: settlement.driver_phone || '-' },
      { label: 'Status', value: settlement.status },
    ]);
    const rightHeight = drawInfoBox(doc, left + boxWidth + boxGap, top, boxWidth, 'Slip Details', [
      { label: 'Salary Slip No', value: settlement.settlement_number },
      { label: 'Period From', value: formatDate(settlement.period_from) },
      { label: 'Period To', value: formatDate(settlement.period_to) },
      { label: 'Payment Mode', value: settlement.payment_mode || '-' },
      { label: 'Reference No', value: settlement.reference_number || '-' },
    ]);
    doc.y = top + Math.max(leftHeight, rightHeight) + 16;

    drawSectionTitle(doc, 'Trip Summary');
    drawTripsTable(doc, settlement.trips);

    drawSectionTitle(doc, 'Payroll Summary');
    drawTotalsBox(doc, [
      { label: 'Total Trips', value: String(settlement.total_trips) },
      { label: 'Total KM', value: settlement.total_km.toFixed(2) },
      { label: 'Allowance', value: formatCurrency(settlement.total_allowance) },
      { label: 'Advances', value: formatCurrency(settlement.advances) },
      { label: 'Deductions', value: formatCurrency(settlement.deductions) },
      { label: 'Net Payable', value: formatCurrency(settlement.net_amount), emphasized: true },
    ]);

    drawSectionTitle(doc, 'Bank Details');
    const bankTop = doc.y;
    const bankBoxHeight = drawInfoBox(doc, left, bankTop, pageWidth, 'Transfer Information', [
      { label: 'Bank Name', value: settlement.bank_name || '-' },
      { label: 'Account Number', value: settlement.bank_account || '-' },
      { label: 'IFSC Code', value: settlement.ifsc_code || '-' },
    ]);
    doc.y = bankTop + bankBoxHeight + 12;

    ensureSpace(doc, 40);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Computer-generated salary slip', {
      align: 'center',
    });
    doc.end();
  });
}

export function buildOwnerSettlementPdf(
  settlement: OwnerSettlementPdfData,
  settings: Record<string, string>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeaderCard(doc, 'VENDOR INVOICE', settings);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    const boxGap = 14;
    const boxWidth = (pageWidth - boxGap) / 2;
    const top = doc.y;

    const leftHeight = drawInfoBox(doc, left, top, boxWidth, 'Vendor Details', [
      { label: 'Vendor Name', value: settlement.owner_name },
      { label: 'Vendor Code', value: settlement.owner_code },
      { label: 'Phone', value: settlement.owner_phone || '-' },
      { label: 'Vehicle', value: settlement.vehicle_number || '-' },
    ]);
    const rightHeight = drawInfoBox(doc, left + boxWidth + boxGap, top, boxWidth, 'Invoice Details', [
      { label: 'Vendor Invoice No', value: settlement.settlement_number },
      { label: 'Period From', value: formatDate(settlement.period_from) },
      { label: 'Period To', value: formatDate(settlement.period_to) },
      { label: 'Payment Mode', value: settlement.payment_mode || '-' },
      { label: 'Reference No', value: settlement.reference_number || '-' },
      { label: 'Status', value: settlement.status },
    ]);
    doc.y = top + Math.max(leftHeight, rightHeight) + 16;

    drawSectionTitle(doc, 'Trip Summary');
    drawTripsTable(doc, settlement.trips);

    drawSectionTitle(doc, 'Settlement Summary');
    drawTotalsBox(doc, [
      { label: 'Total Trips', value: String(settlement.total_trips) },
      { label: 'Total KM', value: settlement.total_km.toFixed(2) },
      { label: 'Gross Amount', value: formatCurrency(settlement.total_amount) },
      { label: 'TDS', value: formatCurrency(settlement.tds_amount) },
      { label: 'Other Deductions', value: formatCurrency(settlement.other_deductions) },
      { label: 'Net Payable', value: formatCurrency(settlement.net_amount), emphasized: true },
    ]);

    drawSectionTitle(doc, 'Bank Details');
    const bankTop = doc.y;
    const bankBoxHeight = drawInfoBox(doc, left, bankTop, pageWidth, 'Transfer Information', [
      { label: 'Bank Name', value: settlement.bank_name || '-' },
      { label: 'Account Number', value: settlement.bank_account || '-' },
      { label: 'IFSC Code', value: settlement.ifsc_code || '-' },
    ]);
    doc.y = bankTop + bankBoxHeight + 12;

    ensureSpace(doc, 40);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Computer-generated vendor invoice', {
      align: 'center',
    });
    doc.end();
  });
}
