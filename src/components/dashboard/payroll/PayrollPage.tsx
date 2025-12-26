import React, { useState } from 'react';
import { Plus, Filter, Download } from 'lucide-react';
import PayrollList from './PayrollList';
import PayrollFilters from './PayrollFilters';
import PayrollSummary from './PayrollSummary';
import AddPayProcessModal from './AddPayProcessModal';
import { exportToCSV } from '../../../lib/export';
import { usePayrollStore } from '../../../stores/payrollStore';

export default function PayrollPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    period_start: '',
    period_end: '',
    status: '',
  });

  const handlePayrollAdded = () => {
    setLastRefresh(Date.now());
  };

  const { items: payrollItems, fetchPayrollEntries } = usePayrollStore();

  const handleExport = async () => {
    try {
      setExporting(true);
      setExportError(null);
      await fetchPayrollEntries(filters.period_start, filters.period_end);
      const payrollData = payrollItems;
      
      if (!payrollData || payrollData.length === 0) {
        throw new Error('No payroll data available to export');
      }

      const filename = `payroll_${new Date().toISOString().split('T')[0]}.csv`;
      
      const formattedData = payrollData.map(entry => ({
        'Employee Name': entry.employee?.name,
        'Department': entry.employee?.department,
        'Period Start': new Date(entry.period_start).toLocaleDateString(),
        'Period End': new Date(entry.period_end).toLocaleDateString(),
        'Base Salary': entry.base_salary.toFixed(2),
        'Overtime Hours': entry.overtime_hours,
        'Overtime Amount': (entry.overtime_hours * entry.overtime_rate).toFixed(2),
        'Deductions': entry.deductions.toFixed(2),
        'Bonus': entry.bonus.toFixed(2),
        'Total Amount': entry.total_amount.toFixed(2),
        'Status': entry.status,
        'Payment Date': entry.payment_date ? new Date(entry.payment_date).toLocaleDateString() : 'N/A'
      }));

      await exportToCSV(formattedData, filename);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export data';
      setExportError(errorMessage);
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage payroll entries, process payments, and generate reports.
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
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Payroll Entry
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
            <PayrollFilters filters={filters} onFilterChange={setFilters} />
          </div>
        )}

        <div className="mt-4">
          <PayrollSummary 
            periodStart={filters.period_start} 
            periodEnd={filters.period_end} 
            lastRefresh={lastRefresh}
          />
        </div>

        <div className="mt-4">
          <PayrollList 
            filters={filters} 
            onRefresh={handlePayrollAdded}
            lastRefresh={lastRefresh}
          />
        </div>
      </div>

      <AddPayProcessModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onPayrollAdded={handlePayrollAdded}
      />
    </div>
  );
}