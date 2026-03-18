import PDFDocument from 'pdfkit';

type PdfDoc = InstanceType<typeof PDFDocument>;

interface InvoicePdfItem {
  description: string;
  hsn_code: string | null;
  quantity: number;
  rate: number;
  amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

interface InvoicePdfTaxComponent {
  component_name: string;
  tax_amount: number;
}

interface InvoicePdfData {
  invoice_type: 'invoice' | 'credit_note';
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  customer_name: string;
  billing_address: string | null;
  customer_gstin: string | null;
  tax_components: InvoicePdfTaxComponent[];
  items: InvoicePdfItem[];
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
  const contentHeight = Math.max(76, 18 + rows.length * 26);

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
      align: index === 1 ? 'left' : 'center',
    });
    x += widths[index];
  });
  doc.restore();

  return startY + rowHeight;
}

function drawInvoiceTable(doc: PdfDoc, items: InvoicePdfItem[]): void {
  const startX = doc.page.margins.left;
  const widths = [24, 158, 42, 36, 58, 60, 54, 63];
  const headers = ['#', 'Description', 'HSN', 'Qty', 'Rate', 'Amount', 'GST', 'Total'];
  let y = drawTableHeader(doc, headers, widths, startX, doc.y);

  items.forEach((item, index) => {
    const gstValue = item.cgst_amount + item.sgst_amount + item.igst_amount;
    const values = [
      String(index + 1),
      item.description,
      item.hsn_code || '-',
      String(Number(item.quantity)),
      formatCurrency(item.rate),
      formatCurrency(item.amount),
      formatCurrency(gstValue),
      formatCurrency(item.total_amount),
    ];

    const rowHeight = Math.max(
      22,
      doc.heightOfString(values[1], { width: widths[1] - 8, align: 'left' }) + 10
    );

    ensureSpace(doc, rowHeight + 20);

    let x = startX;
    values.forEach((value, cellIndex) => {
      doc.rect(x, y, widths[cellIndex], rowHeight).stroke('#cbd5e1');
      doc.font(cellIndex === 1 ? 'Helvetica' : 'Helvetica').fontSize(8).fillColor('#111827').text(
        value,
        x + 4,
        y + 6,
        {
          width: widths[cellIndex] - 8,
          align: cellIndex === 1 ? 'left' : 'center',
        }
      );
      x += widths[cellIndex];
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
  const boxWidth = 220;
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
      .text(row.label, x + 12, rowY, { width: 100 });
    doc.text(row.value, x + 110, rowY, {
      width: boxWidth - 122,
      align: 'right',
    });
    rowY += 20;
  });
  doc.restore();
  doc.y = y + height + 12;
}

export function buildInvoicePdf(
  invoice: InvoicePdfData,
  settings: Record<string, string>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    const top = doc.y;

    doc.save();
    doc.roundedRect(left, top, pageWidth, 72, 10).fill('#0f172a');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text(settings.company_name || 'Travel ERP', left + 16, top + 14, {
      width: 260,
    });
    doc.font('Helvetica').fontSize(10).text(settings.company_address || '-', left + 16, top + 38, {
      width: 260,
    });
    doc.font('Helvetica-Bold').fontSize(18).text(invoice.invoice_type === 'credit_note' ? 'CREDIT NOTE' : 'TAX INVOICE', left + pageWidth - 180, top + 18, {
      width: 160,
      align: 'right',
    });
    doc.restore();
    doc.y = top + 88;

    const boxGap = 14;
    const boxWidth = (pageWidth - boxGap) / 2;
    const infoTop = doc.y;
    const leftHeight = drawInfoBox(doc, left, infoTop, boxWidth, 'Bill To', [
      { label: 'Customer Name', value: invoice.customer_name },
      { label: 'Billing Address', value: invoice.billing_address || '-' },
      { label: 'Customer GSTIN', value: invoice.customer_gstin || '-' },
    ]);
    const rightHeight = drawInfoBox(doc, left + boxWidth + boxGap, infoTop, boxWidth, 'Invoice Details', [
      { label: 'Invoice Number', value: invoice.invoice_number },
      { label: 'Invoice Date', value: formatDate(invoice.invoice_date) },
      { label: 'Due Date', value: formatDate(invoice.due_date) },
      { label: 'Company GSTIN', value: settings.company_gstin || '-' },
      { label: 'Company PAN', value: settings.company_pan || '-' },
    ]);
    doc.y = infoTop + Math.max(leftHeight, rightHeight) + 16;

    drawSectionTitle(doc, 'Line Items');

    const items =
      invoice.items.length > 0
        ? invoice.items
        : [
            {
              description: 'Transport service',
              hsn_code: '9964',
              quantity: 1,
              rate: invoice.subtotal,
              amount: invoice.subtotal,
              cgst_amount: invoice.cgst_amount,
              sgst_amount: invoice.sgst_amount,
              igst_amount: invoice.igst_amount,
              total_amount: invoice.total_amount,
            },
          ];

    drawInvoiceTable(doc, items);

    const taxRows = invoice.tax_components.length > 0
      ? invoice.tax_components.map((component) => ({
          label: component.component_name,
          value: formatCurrency(component.tax_amount),
        }))
      : [
          { label: 'CGST', value: formatCurrency(invoice.cgst_amount) },
          { label: 'SGST', value: formatCurrency(invoice.sgst_amount) },
          { label: 'IGST', value: formatCurrency(invoice.igst_amount) },
        ];

    drawTotalsBox(doc, [
      { label: 'Subtotal', value: formatCurrency(invoice.subtotal) },
      ...taxRows,
      { label: 'Grand Total', value: formatCurrency(invoice.total_amount), emphasized: true },
    ]);

    if (settings.bank_name || settings.bank_account || settings.bank_ifsc) {
      drawSectionTitle(doc, 'Bank Details');
      const bankTop = doc.y;
      drawInfoBox(doc, left, bankTop, pageWidth, 'Payment Information', [
        { label: 'Bank Name', value: settings.bank_name || '-' },
        { label: 'Account Number', value: settings.bank_account || '-' },
        { label: 'IFSC Code', value: settings.bank_ifsc || '-' },
      ]);
      doc.y = bankTop + 92;
    }

    ensureSpace(doc, 40);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Computer-generated invoice', {
      align: 'center',
    });
    doc.end();
  });
}
