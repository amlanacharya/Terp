import { Fragment, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { arrayToCsv, CsvColumn, downloadCsv } from '../../lib/csv-export';
import { formatCurrency, formatDate } from '../../lib/format';
import {
  CollectionRegisterEntry,
  CollectionRegisterResponse,
  CustomerOutstanding,
  CustomerProfitabilityReport,
  DriverSettlementReport,
  OwnerSettlementReport,
  ReportSummary,
} from '../../lib/types';

type ReportTab = 'customer-outstanding' | 'vendor-invoices' | 'salary-slips' | 'payment-receipts' | 'profitability';

const tabLabels: Record<ReportTab, string> = {
  'customer-outstanding': 'Customer Outstanding',
  'vendor-invoices': 'Vendor Invoices',
  'salary-slips': 'Salary Slips',
  'payment-receipts': 'Payment Receipts',
  profitability: 'Customer Profitability',
};

function buildQueryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}

export function Reports() {
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [customerOutstanding, setCustomerOutstanding] = useState<CustomerOutstanding[]>([]);
  const [ownerSettlementReport, setOwnerSettlementReport] = useState<OwnerSettlementReport[]>([]);
  const [driverSettlementReport, setDriverSettlementReport] = useState<DriverSettlementReport[]>([]);
  const [collectionRegister, setCollectionRegister] = useState<CollectionRegisterResponse | null>(null);
  const [customerProfitability, setCustomerProfitability] = useState<CustomerProfitabilityReport[]>([]);
  const [activeTab, setActiveTab] = useState<ReportTab>('customer-outstanding');
  const [expandedOwners, setExpandedOwners] = useState<string[]>([]);
  const [expandedDrivers, setExpandedDrivers] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentModeFilter, setPaymentModeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true);
        setError('');

        const commonDateQuery = buildQueryString({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        });
        const statusDateQuery = buildQueryString({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          status: statusFilter || undefined,
        });
        const collectionQuery = buildQueryString({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          payment_mode: paymentModeFilter || undefined,
        });

        const [
          reportSummary,
          outstandingRows,
          ownerRows,
          driverRows,
          collectionRows,
          profitabilityRows,
        ] = await Promise.all([
          api.get<ReportSummary>('/reports'),
          api.get<CustomerOutstanding[]>('/reports/customer-outstanding'),
          api.get<OwnerSettlementReport[]>(`/reports/owner-settlements${statusDateQuery}`),
          api.get<DriverSettlementReport[]>(`/reports/driver-settlements${statusDateQuery}`),
          api.get<CollectionRegisterResponse>(`/reports/collections${collectionQuery}`),
          api.get<CustomerProfitabilityReport[]>(`/reports/customer-profitability${commonDateQuery}`),
        ]);

        setReport(reportSummary);
        setCustomerOutstanding(outstandingRows);
        setOwnerSettlementReport(ownerRows);
        setDriverSettlementReport(driverRows);
        setCollectionRegister(collectionRows);
        setCustomerProfitability(profitabilityRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load reports.');
      } finally {
        setLoading(false);
      }
    }

    void loadReport();
  }, [dateFrom, dateTo, statusFilter, paymentModeFilter]);

  function toggleOwner(ownerId: string) {
    setExpandedOwners((current) =>
      current.includes(ownerId) ? current.filter((id) => id !== ownerId) : [...current, ownerId]
    );
  }

  function toggleDriver(driverId: string) {
    setExpandedDrivers((current) =>
      current.includes(driverId) ? current.filter((id) => id !== driverId) : [...current, driverId]
    );
  }

  function exportCurrentTab() {
    try {
      let csv = '';
      let filename = '';

      if (activeTab === 'customer-outstanding') {
        const columns: CsvColumn<CustomerOutstanding>[] = [
          { key: 'customer_name', header: 'Customer Name', value: (row) => row.customer_name },
          { key: 'customer_code', header: 'Customer Code', value: (row) => row.customer_code },
          { key: 'invoice_count', header: 'Invoice Count', value: (row) => row.invoice_count },
          { key: 'invoiced_amount', header: 'Invoiced Amount', value: (row) => row.invoiced_amount },
          { key: 'collected_amount', header: 'Collected Amount', value: (row) => row.collected_amount },
          { key: 'outstanding_amount', header: 'Outstanding Amount', value: (row) => row.outstanding_amount },
        ];
        csv = arrayToCsv(customerOutstanding, columns);
        filename = 'customer-outstanding.csv';
      } else if (activeTab === 'vendor-invoices') {
        const columns: CsvColumn<OwnerSettlementReport>[] = [
          { key: 'owner_name', header: 'Owner Name', value: (row) => row.owner_name },
          { key: 'vehicles', header: 'Vehicle(s)', value: (row) => row.vehicles.join(', ') },
          { key: 'total_trips', header: 'Total Trips', value: (row) => row.total_trips },
          { key: 'total_km', header: 'Total KM', value: (row) => row.total_km },
          { key: 'gross_amount', header: 'Gross Amount', value: (row) => row.gross_amount },
          { key: 'tds_amount', header: 'TDS', value: (row) => row.tds_amount },
          { key: 'other_deductions', header: 'Deductions', value: (row) => row.other_deductions },
          { key: 'net_paid', header: 'Net Paid', value: (row) => row.net_paid },
          { key: 'payment_modes', header: 'Payment Mode', value: (row) => row.payment_modes.join(', ') },
          { key: 'reference_numbers', header: 'Reference', value: (row) => row.reference_numbers.join(', ') },
        ];
        csv = arrayToCsv(ownerSettlementReport, columns);
        filename = 'vendor-invoices-report.csv';
      } else if (activeTab === 'salary-slips') {
        const columns: CsvColumn<DriverSettlementReport>[] = [
          { key: 'driver_name', header: 'Driver Name', value: (row) => row.driver_name },
          { key: 'total_trips', header: 'Total Trips', value: (row) => row.total_trips },
          { key: 'total_km', header: 'Total KM', value: (row) => row.total_km },
          { key: 'total_allowance', header: 'Allowance', value: (row) => row.total_allowance },
          { key: 'advances', header: 'Advances', value: (row) => row.advances },
          { key: 'deductions', header: 'Deductions', value: (row) => row.deductions },
          { key: 'net_paid', header: 'Net Paid', value: (row) => row.net_paid },
          { key: 'payment_modes', header: 'Payment Mode', value: (row) => row.payment_modes.join(', ') },
          { key: 'reference_numbers', header: 'Reference', value: (row) => row.reference_numbers.join(', ') },
        ];
        csv = arrayToCsv(driverSettlementReport, columns);
        filename = 'salary-slip-report.csv';
      } else if (activeTab === 'payment-receipts') {
        const columns: CsvColumn<CollectionRegisterEntry>[] = [
          { key: 'collection_number', header: 'Collection #', value: (row) => row.collection_number },
          { key: 'collection_date', header: 'Date', value: (row) => row.collection_date },
          { key: 'invoice_number', header: 'Invoice #', value: (row) => row.invoice_number },
          { key: 'customer_name', header: 'Customer', value: (row) => row.customer_name },
          { key: 'amount', header: 'Amount', value: (row) => row.amount },
          { key: 'payment_mode', header: 'Payment Mode', value: (row) => row.payment_mode },
          { key: 'bank_name', header: 'Bank Name', value: (row) => row.bank_name },
          { key: 'reference_number', header: 'Reference #', value: (row) => row.reference_number },
          { key: 'remarks', header: 'Remarks', value: (row) => row.remarks },
        ];
        csv = arrayToCsv(collectionRegister?.entries ?? [], columns);
        filename = 'payment-receipts.csv';
      } else {
        const columns: CsvColumn<CustomerProfitabilityReport>[] = [
          { key: 'customer_name', header: 'Customer Name', value: (row) => row.customer_name },
          { key: 'total_invoiced', header: 'Total Invoiced', value: (row) => row.total_invoiced },
          { key: 'total_collected', header: 'Total Collected', value: (row) => row.total_collected },
          { key: 'outstanding', header: 'Outstanding', value: (row) => row.outstanding },
          { key: 'total_expenses', header: 'Total Expenses', value: (row) => row.total_expenses },
          { key: 'net_income', header: 'Net Income', value: (row) => row.net_income },
        ];
        csv = arrayToCsv(customerProfitability, columns);
        filename = 'customer-profitability.csv';
      }

      downloadCsv(csv, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export CSV.');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading reports...</p>;
  }

  if (error && !report) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>;
  }

  if (!report) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
        No report data available.
      </div>
    );
  }

  const showDateFilter = activeTab !== 'customer-outstanding';
  const showStatusFilter = activeTab === 'vendor-invoices' || activeTab === 'salary-slips';
  const showPaymentModeFilter = activeTab === 'payment-receipts';

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Reports</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">MIS and financial reporting</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {showDateFilter ? (
            <>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                From Date
                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                To Date
                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-normal normal-case tracking-normal text-slate-900" />
              </label>
            </>
          ) : null}
          {showStatusFilter ? (
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
              Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-normal normal-case tracking-normal text-slate-900">
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </select>
            </label>
          ) : null}
          {showPaymentModeFilter ? (
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
              Payment Mode
              <select value={paymentModeFilter} onChange={(event) => setPaymentModeFilter(event.target.value)} className="mt-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-normal normal-case tracking-normal text-slate-900">
                <option value="">All payment modes</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
            </label>
          ) : null}
          <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter(''); setPaymentModeFilter(''); }} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700">
            Reset filters
          </button>
          <button type="button" onClick={exportCurrentTab} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white">
            Export CSV
          </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Invoice value</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(report.invoiceValue)}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Collected value</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(report.collectedValue)}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Outstanding</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(report.outstandingValue)}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm text-slate-500">Salary slips</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(report.driverSettlementValue)}</p>
        </article>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(tabLabels) as ReportTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-2xl px-4 py-2 text-sm ${
              activeTab === tab ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-700'
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'customer-outstanding' ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Invoices</th>
                <th className="px-4 py-3">Invoiced</th>
                <th className="px-4 py-3">Collected</th>
                <th className="px-4 py-3">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customerOutstanding.map((row) => (
                <tr key={row.customer_id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{row.customer_name}</div>
                    <div className="text-xs text-slate-500">{row.customer_code}</div>
                  </td>
                  <td className="px-4 py-3">{row.invoice_count}</td>
                  <td className="px-4 py-3">{formatCurrency(row.invoiced_amount)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.collected_amount)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.outstanding_amount)}</td>
                </tr>
              ))}
              {customerOutstanding.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No outstanding customer balances.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === 'vendor-invoices' ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Vehicles</th>
                <th className="px-4 py-3">Trips</th>
                <th className="px-4 py-3">KM</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">TDS</th>
                <th className="px-4 py-3">Deductions</th>
                <th className="px-4 py-3">Net Paid</th>
                <th className="px-4 py-3">Payments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ownerSettlementReport.map((row) => (
                <Fragment key={row.owner_id}>
                  <tr key={row.owner_id}>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => toggleOwner(row.owner_id)} className="font-medium text-slate-900">
                        {expandedOwners.includes(row.owner_id) ? 'Hide' : 'Show'} {row.owner_name}
                      </button>
                      <div className="text-xs text-slate-500">{row.owner_code}</div>
                    </td>
                    <td className="px-4 py-3">{row.vehicles.join(', ') || '-'}</td>
                    <td className="px-4 py-3">{row.total_trips}</td>
                    <td className="px-4 py-3">{row.total_km.toFixed(2)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.gross_amount)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.tds_amount)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.other_deductions)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.net_paid)}</td>
                    <td className="px-4 py-3">{row.payment_modes.join(', ') || '-'}</td>
                  </tr>
                  {expandedOwners.includes(row.owner_id)
                    ? row.settlements.map((settlement) => (
                        <tr key={settlement.id} className="bg-slate-50">
                          <td className="px-8 py-3 text-slate-700">{settlement.settlement_number}</td>
                          <td className="px-4 py-3 text-slate-700">{settlement.vehicle_number ?? '-'}</td>
                          <td className="px-4 py-3 text-slate-700">{settlement.total_trips}</td>
                          <td className="px-4 py-3 text-slate-700">{settlement.total_km.toFixed(2)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatCurrency(settlement.gross_amount)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatCurrency(settlement.tds_amount)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatCurrency(settlement.other_deductions)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatCurrency(settlement.net_paid)}</td>
                          <td className="px-4 py-3 text-slate-700">
                            <div>{settlement.payment_mode ?? '-'}</div>
                            <div className="text-xs text-slate-500">{settlement.reference_number ?? '-'}</div>
                            <div className="text-xs text-slate-500">{formatDate(settlement.period_from)} to {formatDate(settlement.period_to)}</div>
                          </td>
                        </tr>
                      ))
                    : null}
                </Fragment>
              ))}
              {ownerSettlementReport.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-slate-500">No vendor invoice records for the selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === 'salary-slips' ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Trips</th>
                <th className="px-4 py-3">KM</th>
                <th className="px-4 py-3">Allowance</th>
                <th className="px-4 py-3">Advances</th>
                <th className="px-4 py-3">Deductions</th>
                <th className="px-4 py-3">Net Paid</th>
                <th className="px-4 py-3">Payments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {driverSettlementReport.map((row) => (
                <Fragment key={row.driver_id}>
                  <tr key={row.driver_id}>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => toggleDriver(row.driver_id)} className="font-medium text-slate-900">
                        {expandedDrivers.includes(row.driver_id) ? 'Hide' : 'Show'} {row.driver_name}
                      </button>
                      <div className="text-xs text-slate-500">{row.driver_code}</div>
                    </td>
                    <td className="px-4 py-3">{row.total_trips}</td>
                    <td className="px-4 py-3">{row.total_km.toFixed(2)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.total_allowance)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.advances)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.deductions)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.net_paid)}</td>
                    <td className="px-4 py-3">{row.payment_modes.join(', ') || '-'}</td>
                  </tr>
                  {expandedDrivers.includes(row.driver_id)
                    ? row.settlements.map((settlement) => (
                        <tr key={settlement.id} className="bg-slate-50">
                          <td className="px-8 py-3 text-slate-700">{settlement.settlement_number}</td>
                          <td className="px-4 py-3 text-slate-700">{settlement.total_trips}</td>
                          <td className="px-4 py-3 text-slate-700">{settlement.total_km.toFixed(2)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatCurrency(settlement.total_allowance)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatCurrency(settlement.advances)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatCurrency(settlement.deductions)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatCurrency(settlement.net_paid)}</td>
                          <td className="px-4 py-3 text-slate-700">
                            <div>{settlement.payment_mode ?? '-'}</div>
                            <div className="text-xs text-slate-500">{settlement.reference_number ?? '-'}</div>
                            <div className="text-xs text-slate-500">{formatDate(settlement.period_from)} to {formatDate(settlement.period_to)}</div>
                          </td>
                        </tr>
                      ))
                    : null}
                </Fragment>
              ))}
              {driverSettlementReport.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">No salary slip records for the selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === 'payment-receipts' ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 bg-white text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Collection #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment Mode</th>
                  <th className="px-4 py-3">Bank</th>
                  <th className="px-4 py-3">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {collectionRegister?.entries.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.collection_number}</td>
                    <td className="px-4 py-3">{formatDate(row.collection_date)}</td>
                    <td className="px-4 py-3">{row.invoice_number}</td>
                    <td className="px-4 py-3">{row.customer_name}</td>
                    <td className="px-4 py-3">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-3">{row.payment_mode}</td>
                    <td className="px-4 py-3">{row.bank_name ?? '-'}</td>
                    <td className="px-4 py-3">{row.reference_number ?? '-'}</td>
                  </tr>
                ))}
                {!collectionRegister || collectionRegister.entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-500">No payment receipts for the selected filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-3xl border border-slate-200 p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total collected</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(collectionRegister?.totals.total_collected)}</p>
            </article>
            {collectionRegister?.totals.by_mode.map((modeRow) => (
              <article key={modeRow.payment_mode} className="rounded-3xl border border-slate-200 p-5 shadow-sm">
                <p className="text-sm text-slate-500">{modeRow.payment_mode}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{formatCurrency(modeRow.total_amount)}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'profitability' ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Invoiced</th>
                <th className="px-4 py-3">Collected</th>
                <th className="px-4 py-3">Outstanding</th>
                <th className="px-4 py-3">Expenses</th>
                <th className="px-4 py-3">Net Income</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customerProfitability.map((row) => (
                <tr key={row.customer_id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{row.customer_name}</div>
                    <div className="text-xs text-slate-500">{row.customer_code}</div>
                  </td>
                  <td className="px-4 py-3">{formatCurrency(row.total_invoiced)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.total_collected)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.outstanding)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.total_expenses)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.net_income)}</td>
                </tr>
              ))}
              {customerProfitability.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">No customer profitability rows for the selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
