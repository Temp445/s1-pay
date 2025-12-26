import React, { useState } from 'react';
import { Filter, Download, FileText, Users, Calendar, IndianRupee, Briefcase } from 'lucide-react';
import ReportFilters from './ReportFilters'; 
import EmployeeMasterReport from './EmployeeMasterReport';
import TransactionReport from './TransactionReport';
import StatutoryReport from './StatutoryReport';
import { exportToPDF, exportToExcel } from '../../../lib/export';
import { useReportsStore } from '../../../stores/reportsStore';

type ReportType = 'employee' | 'transaction' | 'statutory';
type ReportSubtype = 
  // Employee master report subtypes
  | 'basic' | 'salary' | 'tax' | 'bank' | 'department'
  // Transaction report subtypes
  | 'monthly' | 'attendance' | 'leave' | 'overtime' | 'bonus' | 'loan'
  // Statutory report subtypes
  | 'taxDeduction' | 'providentFund' | 'insurance' | 'professionalTax';

export default function ReportsPage() {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('employee');
  const [reportSubtype, setReportSubtype] = useState<ReportSubtype>('basic');
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [exportError, setExportError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    department: '',
    employee: '',
  });

  const handleExport = async () => {
    try {
      setExporting(true);
      setExportError(null);
      
      // Get report data based on type and subtype
      let reportData;
      let filename;
      
      switch (reportType) {
        case 'employee':
          reportData = await getEmployeeMasterReportData(reportSubtype, filters);
          filename = `employee_${reportSubtype}_report_${new Date().toISOString().split('T')[0]}`;
          break;
        case 'transaction':
          reportData = await getTransactionReportData(reportSubtype, filters);
          filename = `transaction_${reportSubtype}_report_${new Date().toISOString().split('T')[0]}`;
          break;
        case 'statutory':
          reportData = await getStatutoryReportData(reportSubtype, filters);
          filename = `statutory_${reportSubtype}_report_${new Date().toISOString().split('T')[0]}`;
          break;
      }
      
      if (!reportData || reportData.length === 0) {
        throw new Error('No data available for the selected report');
      }
      
      // Export based on selected format
      if (exportFormat === 'pdf') {
        await exportToPDF(reportData, filename);
      } else {
        await exportToExcel(reportData, filename);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export report';
      setExportError(errorMessage);
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  const {
    employeeMasterReports,
    transactionReports,
    statutoryReports,
    fetchEmployeeMasterReport,
    fetchTransactionReport,
    fetchStatutoryReport,
  } = useReportsStore();

  const getEmployeeMasterReportData = async (subtype: ReportSubtype, filters: any) => {
    await fetchEmployeeMasterReport(subtype, filters);
    return employeeMasterReports[subtype]?.data || [];
  };

  const getTransactionReportData = async (subtype: ReportSubtype, filters: any) => {
    await fetchTransactionReport(subtype, filters);
    return transactionReports[subtype]?.data || [];
  };

  const getStatutoryReportData = async (subtype: ReportSubtype, filters: any) => {
    await fetchStatutoryReport(subtype, filters);
    return statutoryReports[subtype]?.data || [];
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
            <p className="mt-1 text-sm text-gray-500">
              Generate and export comprehensive payroll reports.
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            <div className="relative">
              <select
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 appearance-none pr-8"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'excel')}
              >
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export Report'}
            </button>
          </div>
        </div>

        {exportError && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Export failed</h3>
                <div className="mt-2 text-sm text-red-700">
                  {exportError}
                </div>
              </div>
            </div>
          </div>
        )}

        {isFiltersOpen && (
          <div className="mt-4">
            <ReportFilters filters={filters} onFilterChange={setFilters} />
          </div>
        )}

        <div className="mt-6">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${
                    reportType === 'employee'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setReportType('employee');
                    setReportSubtype('basic');
                  }}
                >
                  <Users className="h-5 w-5 inline-block mr-2" />
                  Employee Master
                </button>
                <button
                  className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${
                    reportType === 'transaction'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setReportType('transaction');
                    setReportSubtype('monthly');
                  }}
                >
                  <IndianRupee className="h-5 w-5 inline-block mr-2" />
                  Transaction
                </button>
                <button
                  className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm ${
                    reportType === 'statutory'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setReportType('statutory');
                    setReportSubtype('taxDeduction');
                  }}
                >
                  <Briefcase className="h-5 w-5 inline-block mr-2" />
                  Statutory
                </button>
              </nav>
            </div>

            <div className="p-4 border-b border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {reportType === 'employee' && (
                  <>
                    <button
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        reportSubtype === 'basic'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setReportSubtype('basic')}
                    >
                      Basic Information
                    </button>
                    <button
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        reportSubtype === 'salary'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setReportSubtype('salary')}
                    >
                      Salary Structure
                    </button>
                    <button
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        reportSubtype === 'tax'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setReportSubtype('tax')}
                    >
                      Tax Declarations
                    </button>
                    <button
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        reportSubtype === 'department'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setReportSubtype('department')}
                    >
                      Department/Designation
                    </button>
                  </>
                )}

                {reportType === 'transaction' && (
                  <>
                    <button
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        reportSubtype === 'monthly'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setReportSubtype('monthly')}
                    >
                      Monthly Salary
                    </button>
                    <button
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        reportSubtype === 'attendance'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setReportSubtype('attendance')}
                    >
                      Attendance
                    </button>
                    <button
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        reportSubtype === 'leave'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setReportSubtype('leave')}
                    >
                      Leave Balances
                    </button>
                    <button
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        reportSubtype === 'overtime'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setReportSubtype('overtime')}
                    >
                      Overtime
                    </button>
                  </>
                )}

                {reportType === 'statutory' && (
                  <>
                    <button
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        reportSubtype === 'taxDeduction'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setReportSubtype('taxDeduction')}
                    >
                      Tax Deduction
                    </button>
                    <button
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        reportSubtype === 'providentFund'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setReportSubtype('providentFund')}
                    >
                      Provident Fund
                    </button>
                    <button
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        reportSubtype === 'insurance'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setReportSubtype('insurance')}
                    >
                      Insurance
                    </button>
                    <button
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        reportSubtype === 'professionalTax'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setReportSubtype('professionalTax')}
                    >
                      Professional Tax
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="p-6">
              {reportType === 'employee' && (
                <EmployeeMasterReport subtype={reportSubtype} filters={filters} />
              )}
              
              {reportType === 'transaction' && (
                <TransactionReport subtype={reportSubtype} filters={filters} />
              )}
              
              {reportType === 'statutory' && (
                <StatutoryReport subtype={reportSubtype} filters={filters} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}