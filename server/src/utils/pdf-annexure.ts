import PDFDocument from 'pdfkit';

type PdfDoc = InstanceType<typeof PDFDocument>;

export interface AnnexurePdfData {
  annexure_number: string;
  parent_trip_number: string;
  child_trip_number: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_type_label: string;
  vehicle_category_name: string | null;
  start_date: string;
  end_date: string;
  start_km: number;
  end_km: number;
  total_km: number;
  total_hours: number;
  night_halts: number;
  calculated_amount: number;
  is_billed: boolean;
  invoice_number: string | null;
}

function formatCurrency(value: number): string {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value: string | null | undefined): string {
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

function drawHeader(doc: PdfDoc, title: string, settings: Record<string, string>): void {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const top = doc.y;

  doc.save();
  doc.roundedRect(left, top, width, 72, 10).fill('#0f172a');
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

function drawInfoBox(
  doc: PdfDoc,
  x: number,
  y: number,
  width: number,
  title: string,
  rows: Array<{ label: string; value: string }>
): number {
  const contentHeight = Math.max(92, 18 + rows.length * 26);

  doc.save();
  doc.roundedRect(x, y, width, contentHeight, 8).lineWidth(1).stroke('#cbd5e1');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(title, x + 12, y + 10, {
    width: width - 24,
  });
  doc.moveTo(x + 12, y + 28).lineTo(x + width - 12, y + 28).stroke('#e2e8f0');

  let rowY = y + 36;
  rows.forEach((row) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text(row.label, x + 12, rowY, { width: width - 24 });
    doc.font('Helvetica').fontSize(10).fillColor('#111827').text(row.value, x + 12, rowY + 12, { width: width - 24 });
    rowY += 26;
  });
  doc.restore();

  return contentHeight;
}

export function buildAnnexurePdf(data: AnnexurePdfData, settings: Record<string, string>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, 'ANNEXURE', settings);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    const gap = 14;
    const boxWidth = (pageWidth - gap) / 2;
    const top = doc.y;

    const leftHeight = drawInfoBox(doc, left, top, boxWidth, 'Annexure Identity', [
      { label: 'Annexure Number', value: data.annexure_number },
      { label: 'Parent Duty Slip', value: data.parent_trip_number },
      { label: 'Child Duty Slip', value: data.child_trip_number },
      { label: 'Customer', value: data.customer_name },
    ]);
    const rightHeight = drawInfoBox(doc, left + boxWidth + gap, top, boxWidth, 'Vehicle And Billing', [
      { label: 'Vehicle Number', value: data.vehicle_number },
      { label: 'Vehicle Type', value: data.vehicle_type_label },
      { label: 'GT Category', value: data.vehicle_category_name || '-' },
      { label: 'Billed', value: data.is_billed ? 'Yes' : 'No' },
      { label: 'Invoice Number', value: data.invoice_number || '-' },
    ]);
    doc.y = top + Math.max(leftHeight, rightHeight) + 16;

    drawSectionTitle(doc, 'Usage Snapshot');
    const usageTop = doc.y;
    const usageHeight = drawInfoBox(doc, left, usageTop, pageWidth, 'Annexure Totals', [
      { label: 'Date Range', value: `${formatDate(data.start_date)} to ${formatDate(data.end_date)}` },
      { label: 'Start KM', value: String(Number(data.start_km).toFixed(2)) },
      { label: 'End KM', value: String(Number(data.end_km).toFixed(2)) },
      { label: 'Total KM', value: `${Number(data.total_km).toFixed(2)} km` },
      { label: 'Total Hours', value: `${Number(data.total_hours).toFixed(2)} hrs` },
      { label: 'Night Halts', value: String(data.night_halts) },
      { label: 'Calculated Amount', value: formatCurrency(data.calculated_amount) },
    ]);
    doc.y = usageTop + usageHeight + 18;

    ensureSpace(doc, 40);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Computer-generated annexure', {
      align: 'center',
    });
    doc.end();
  });
}
