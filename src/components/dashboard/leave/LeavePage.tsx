import React, { useState, useEffect } from 'react';
import { Filter, Download, Plus, Search, Upload } from 'lucide-react';
import LeaveList from './LeaveList';
import LeaveFilters from './LeaveFilters';
import LeaveBalances from './LeaveBalances';
import AddLeaveRequestModal from './AddLeaveRequestModal';
import ImportModal from '../../ImportModal';
import { exportToCSV } from '../../../lib/export';
import { useLeaveStore } from '../../../stores/leaveStore';
import { useEmployeesStore, type Employee } from '../../../stores/employeesStore';
import { importLeaveTypes } from '../../../lib/import';

export default function LeavePage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    status: '',
    type: '',
  });

  const { items: employees, loading, error, fetchEmployees } = useEmployeesStore();
  const { leaveRequests, fetchLeaveRequests } = useLeaveStore();

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleLeaveAdded = () => {
    setLastRefresh(Date.now());
  };

  const handleImport = async (data: any[]) => {
    return await importLeaveTypes(data);
  };

  const handleImportComplete = () => {
    setLastRefresh(Date.now());
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setExportError(null);

      await fetchLeaveRequests(
        selectedEmployee?.id || '',
        filters.start_date ||
          new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1
          ).toISOString(),
        filters.end_date || new Date().toISOString()
      );

      if (!leaveRequests.items || leaveRequests.items.length === 0) {
        throw new Error('No leave data available to export');
      }

      const filename = `leave_requests_${
        new Date().toISOString().split('T')[0]
      }.csv`;

      const formattedData = leaveRequests.items.map((request) => ({
        'Start Date': new Date(request.start_date).toLocaleDateString(),
        'End Date': new Date(request.end_date).toLocaleDateString(),
        Type: request.leave_type.name,
        Reason: request.reason,
        Status: request.status,
        'Approved By': request.approved_by_user?.email || 'N/A',
        'Approved At': request.approved_at
          ? new Date(request.approved_at).toLocaleString()
          : 'N/A',
      }));

      await exportToCSV(formattedData, filename);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to export data';
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
            <h1 className="text-2xl font-semibold text-gray-900">
              Leave Management
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Request leave, view balances, and manage leave requests.
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
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Leave Types
            </button>
            {selectedEmployee && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                // disabled={ selectedEmployee === undefined || selectedEmployee === null }
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Request Leave
              </button>
            )}
          </div>
        </div>

        {/* Employee Selector */}
        <div className="mt-4">
          <label
            htmlFor="employee-select"
            className="block text-sm font-medium text-gray-700"
          >
            Select Employee
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <select
              id="employee-select"
              className="mt-1 block w-full pl-10 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={selectedEmployee?.id || ''}
              onChange={(e) => {
                const employee = employees.find(
                  (emp) => emp.id === e.target.value
                );
                setSelectedEmployee(employee || null);
                setLastRefresh(Date.now());
              }}
            >
              <option value="">Select Employee</option>
              {employees.filter((emp) => emp.status === 'Active').map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} - {employee.department} (
                  {employee.employee_code || 'No ID'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {exportError && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Export failed
                </h3>
                <div className="mt-2 text-sm text-red-700">{exportError}</div>
              </div>
            </div>
          </div>
        )}

        {isFiltersOpen && (
          <div className="mt-4">
            <LeaveFilters filters={filters} onFilterChange={setFilters} />
          </div>
        )}

        {selectedEmployee && (
          <div className="mt-4">
            <LeaveBalances
              employeeId={selectedEmployee.id}
              lastRefresh={lastRefresh}
            />
          </div>
        )}

        <div className="mt-4">
          <LeaveList
            employee={selectedEmployee || undefined}
            filters={filters}
            onRefresh={handleLeaveAdded}
            lastRefresh={lastRefresh}
          />
        </div>
      </div>

      {selectedEmployee && (
        <AddLeaveRequestModal
          employee={selectedEmployee}
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onLeaveAdded={handleLeaveAdded}
        />
      )}

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          handleImportComplete();
        }}
        entityType="leave_types"
        entityName="Leave Types"
        onImport={handleImport}
      />
    </div>
  );
}
