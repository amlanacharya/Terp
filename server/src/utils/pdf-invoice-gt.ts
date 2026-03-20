import PDFDocument from 'pdfkit';
import { AnnexurePdfData, renderAnnexureContent } from './pdf-annexure';

type PdfDoc = InstanceType<typeof PDFDocument>;

export interface GtInvoicePdfItem {
  description: string;
  amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  annexure_number?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface GtInvoicePdfTaxComponent {
  component_name: string;
  tax_amount: number;
}

export interface GtInvoicePdfData {
  invoice_type: 'invoice' | 'credit_note';
  invoice_number: string;
  invoice_date: string;
  booking_date: string | null;
  duty_type_label: string | null;
  nature_of_journey: string | null;
  vehicle_number: string | null;
  vehicle_type_label: string | null;
  duty_slip_number: string | null;
  total_km: number | null;
  total_hours: number | null;
  payment_terms_days: number | null;
  interest_note: string | null;
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  customer_name: string;
  billing_address: string | null;
  customer_gstin: string | null;
  remarks: string | null;
  tax_components: GtInvoicePdfTaxComponent[];
  items: GtInvoicePdfItem[];
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

function ensureSpace(doc: PdfDoc, neededHeight: number): void {
  if (doc.y + neededHeight <= doc.page.height - doc.page.margins.bottom) {
    return;
  }

  doc.addPage();
}

function drawHeader(doc: PdfDoc, settings: Record<string, string>, invoiceType: GtInvoicePdfData['invoice_type']): void {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const top = doc.y;

  doc.save();
  doc.roundedRect(left, top, width, 72, 10).fill('#0f172a');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text(settings.company_name || 'Travel ERP', left + 16, top + 14, {
    width: 280,
  });
  doc.font('Helvetica').fontSize(10).text(settings.company_address || '-', left + 16, top + 40, {
    width: 280,
  });
  doc.font('Helvetica-Bold').fontSize(18).text(invoiceType === 'credit_note' ? 'GT CREDIT NOTE' : 'GT INVOICE', left + width - 190, top + 22, {
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
  const innerWidth = width - 24;
  const rowHeights = rows.map((row) => {
    doc.font('Helvetica-Bold').fontSize(9);
    const labelHeight = doc.heightOfString(row.label, { width: innerWidth });
    doc.font('Helvetica').fontSize(10);
    const valueHeight = doc.heightOfString(row.value, { width: innerWidth });
    return Math.max(24, labelHeight + valueHeight + 9);
  });
  const contentHeight = Math.max(108, 36 + rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0));

  doc.save();
  doc.roundedRect(x, y, width, contentHeight, 8).lineWidth(1).stroke('#cbd5e1');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(title, x + 12, y + 10, {
    width: innerWidth,
  });
  doc.moveTo(x + 12, y + 28).lineTo(x + width - 12, y + 28).stroke('#e2e8f0');

  let rowY = y + 36;
  rows.forEach((row, index) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text(row.label, x + 12, rowY, { width: innerWidth });
    const labelHeight = doc.heightOfString(row.label, { width: innerWidth });
    doc.font('Helvetica').fontSize(10).fillColor('#111827').text(row.value, x + 12, rowY + labelHeight + 2, {
      width: innerWidth,
    });
    rowY += rowHeights[index];
  });
  doc.restore();

  return contentHeight;
}

function drawTableHeader(doc: PdfDoc, headers: string[], widths: number[], startX: number, startY: number): number {
  const rowHeight = 22;
  let x = startX;

  doc.save();
  headers.forEach((header, index) => {
    doc.rect(x, startY, widths[index], rowHeight).fillAndStroke('#0f172a', '#0f172a');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text(header, x + 4, startY + 7, {
      width: widths[index] - 8,
      align: index === 1 ? 'left' : 'center',
    });
    x += widths[index];
  });
  doc.restore();

  return startY + rowHeight;
}

function drawItemTable(doc: PdfDoc, items: GtInvoicePdfItem[]): void {
  const startX = doc.page.margins.left;
  const widths = [26, 220, 90, 80, 90];
  const headers = ['#', 'Description', 'Annexure', 'Base', 'Total'];
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  let y = drawTableHeader(doc, headers, widths, startX, doc.y);

  items.forEach((item, index) => {
    const annexureText = item.annexure_number
      ? `${item.annexure_number}${item.start_date && item.end_date ? `\n${formatDate(item.start_date)} to ${formatDate(item.end_date)}` : ''}`
      : '-';
    const values = [
      String(index + 1),
      item.description,
      annexureText,
      formatCurrency(item.amount),
      formatCurrency(item.total_amount),
    ];

    const rowHeight = Math.max(
      26,
      doc.heightOfString(values[1], { width: widths[1] - 8 }) + 10,
      doc.heightOfString(values[2], { width: widths[2] - 8 }) + 10
    );

    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = drawTableHeader(doc, headers, widths, startX, doc.y);
    }

    let x = startX;
    values.forEach((value, cellIndex) => {
      doc.rect(x, y, widths[cellIndex], rowHeight).stroke('#cbd5e1');
      doc.font('Helvetica').fontSize(8).fillColor('#111827').text(value, x + 4, y + 6, {
        width: widths[cellIndex] - 8,
        align: cellIndex === 1 ? 'left' : 'center',
      });
      x += widths[cellIndex];
    });

    y += rowHeight;
  });

  doc.y = y + 12;
}

function drawTotalsBox(doc: PdfDoc, data: GtInvoicePdfData): void {
  ensureSpace(doc, 140);
  const boxWidth = 240;
  const x = doc.page.width - doc.page.margins.right - boxWidth;
  const y = doc.y;
  const taxRows: Array<{ label: string; value: string; emphasized?: boolean }> = data.tax_components.length > 0
    ? data.tax_components.map((component) => ({
        label: component.component_name,
        value: formatCurrency(component.tax_amount),
      }))
    : [
        { label: 'CGST', value: formatCurrency(data.cgst_amount) },
        { label: 'SGST', value: formatCurrency(data.sgst_amount) },
        { label: 'IGST', value: formatCurrency(data.igst_amount) },
      ];
  const rows: Array<{ label: string; value: string; emphasized?: boolean }> = [
    { label: 'Subtotal', value: formatCurrency(data.subtotal) },
    ...taxRows,
    { label: 'Grand Total', value: formatCurrency(data.total_amount), emphasized: true },
  ];
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

function createPdfBuffer(render: (doc: PdfDoc) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    render(doc);
    doc.end();
  });
}

export function numberToWords(value: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(number: number): string {
    if (number === 0) {
      return 'Zero';
    }
    if (number < 20) {
      return ones[number];
    }
    if (number < 100) {
      return `${tens[Math.floor(number / 10)]}${number % 10 ? ` ${ones[number % 10]}` : ''}`.trim();
    }
    if (number < 1000) {
      return `${ones[Math.floor(number / 100)]} Hundred${number % 100 ? ` ${convert(number % 100)}` : ''}`.trim();
    }
    if (number < 100000) {
      return `${convert(Math.floor(number / 1000))} Thousand${number % 1000 ? ` ${convert(number % 1000)}` : ''}`.trim();
    }
    if (number < 10000000) {
      return `${convert(Math.floor(number / 100000))} Lakh${number % 100000 ? ` ${convert(number % 100000)}` : ''}`.trim();
    }

    return `${convert(Math.floor(number / 10000000))} Crore${number % 10000000 ? ` ${convert(number % 10000000)}` : ''}`.trim();
  }

  const rupees = Math.floor(value);
  const paise = Math.round((value - rupees) * 100);
  const rupeeWords = convert(rupees);
  const paiseWords = paise > 0 ? ` and ${convert(paise)} Paise` : '';
  return `${rupeeWords} Rupees${paiseWords} Only`;
}

export function renderGtInvoiceContent(doc: PdfDoc, data: GtInvoicePdfData, settings: Record<string, string>): void {
  drawHeader(doc, settings, data.invoice_type);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;
  const gap = 14;
  const boxWidth = (pageWidth - gap) / 2;
  const top = doc.y;

  const leftHeight = drawInfoBox(doc, left, top, boxWidth, 'Bill To', [
    { label: 'Customer', value: data.customer_name },
    { label: 'Billing Address', value: data.billing_address || '-' },
    { label: 'Customer GSTIN', value: data.customer_gstin || '-' },
    { label: 'Booking Date (BD)', value: formatDate(data.booking_date) },
    { label: 'Duty Type (DT)', value: data.duty_type_label || '-' },
  ]);
  const rightHeight = drawInfoBox(doc, left + boxWidth + gap, top, boxWidth, 'Invoice Snapshot', [
    { label: 'Invoice Number', value: data.invoice_number },
    { label: 'Invoice Date', value: formatDate(data.invoice_date) },
    { label: 'Duty Slip Number', value: data.duty_slip_number || '-' },
    { label: 'Nature Of Journey', value: data.nature_of_journey || '-' },
    { label: 'Vehicle Number', value: data.vehicle_number || '-' },
    { label: 'Vehicle Type', value: data.vehicle_type_label || '-' },
    { label: 'Total KM / Hours', value: `${data.total_km == null ? '-' : data.total_km.toFixed(2)} km / ${data.total_hours == null ? '-' : data.total_hours.toFixed(2)} hrs` },
  ]);
  doc.y = top + Math.max(leftHeight, rightHeight) + 16;

  drawSectionTitle(doc, 'Invoice Schedule');
  drawItemTable(doc, data.items);

  drawTotalsBox(doc, data);

  drawSectionTitle(doc, 'Amount In Words');
  const amountText = numberToWords(data.total_amount);
  doc.font('Helvetica-Bold').fontSize(11);
  const amountBoxHeight = Math.max(44, doc.heightOfString(amountText, { width: pageWidth - 24 }) + 28);
  ensureSpace(doc, amountBoxHeight + 8);
  const amountY = doc.y;
  doc.roundedRect(left, amountY, pageWidth, amountBoxHeight, 8).stroke('#cbd5e1');
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(amountText, left + 12, amountY + 14, {
    width: pageWidth - 24,
  });
  doc.y = amountY + amountBoxHeight + 8;

  drawSectionTitle(doc, 'Notes');
  const noteLines = [
    `Payment terms: ${data.payment_terms_days ?? 0} day(s)`,
    `Interest note: ${data.interest_note || '-'}`,
  ];
  if (data.remarks) {
    noteLines.push(`Remarks: ${data.remarks}`);
  }
  doc.font('Helvetica').fontSize(10);
  const noteHeights = noteLines.map((line) => doc.heightOfString(line, { width: pageWidth - 24 }));
  const notesHeight = Math.max(64, 24 + noteHeights.reduce((sum, height) => sum + height, 0) + ((noteLines.length - 1) * 6));
  ensureSpace(doc, notesHeight + 8);
  const sectionY = doc.y;
  doc.roundedRect(left, sectionY, pageWidth, notesHeight, 8).stroke('#cbd5e1');
  let textY = sectionY + 12;
  noteLines.forEach((line, index) => {
    doc.font('Helvetica').fontSize(10).fillColor('#111827').text(line, left + 12, textY, {
      width: pageWidth - 24,
    });
    textY += noteHeights[index] + 6;
  });
  doc.y = sectionY + notesHeight + 8;

  if (settings.bank_name || settings.bank_account || settings.bank_ifsc) {
    drawSectionTitle(doc, 'Bank Details');
    const bankTop = doc.y;
    const bankBoxHeight = drawInfoBox(doc, left, bankTop, pageWidth, 'Payment Information', [
      { label: 'Bank Name', value: settings.bank_name || '-' },
      { label: 'Account Number', value: settings.bank_account || '-' },
      { label: 'IFSC Code', value: settings.bank_ifsc || '-' },
    ]);
    doc.y = bankTop + bankBoxHeight + 12;
  }

  ensureSpace(doc, 40);
  doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Computer-generated GT invoice', {
    align: 'center',
  });
}

export function buildGtInvoicePdf(data: GtInvoicePdfData, settings: Record<string, string>): Promise<Buffer> {
  return createPdfBuffer((doc) => {
    renderGtInvoiceContent(doc, data, settings);
  });
}

export function buildGtInvoiceWithAnnexuresPdf(
  data: GtInvoicePdfData,
  annexures: AnnexurePdfData[],
  settings: Record<string, string>
): Promise<Buffer> {
  return createPdfBuffer((doc) => {
    renderGtInvoiceContent(doc, data, settings);

    for (const annexure of annexures) {
      doc.addPage();
      renderAnnexureContent(doc, annexure, settings);
    }
  });
}
