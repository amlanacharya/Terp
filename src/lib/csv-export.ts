export interface CsvColumn<T> {
  key: string;
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCsvValue(value: string | number | null | undefined): string {
  const normalized = String(value ?? '');
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

export function arrayToCsv<T>(data: T[], columns: CsvColumn<T>[]): string {
  const headerRow = columns.map((column) => escapeCsvValue(column.header)).join(',');
  const dataRows = data.map((row) =>
    columns.map((column) => escapeCsvValue(column.value(row))).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

export function downloadCsv(csvString: string, filename: string): void {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
