import React, { useState } from 'react';
import { Plus, Filter, Download, Upload } from 'lucide-react';
import EmployeeList from './EmployeeList';
import EmployeeFilters from './EmployeeFilters';
import AddEmployeeModal from './AddEmployeeModal';
import ImportModal from '../../ImportModal';
import { exportToCSV } from '../../../lib/export';
import { useEmployeesStore } from '../../../stores/employeesStore';
import { useAuth } from '../../../contexts/AuthContext';
import { importEmployees } from '../../../lib/import';

export default function EmployeesPage() {
  const { user } = useAuth();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({
    department: '',
    status: '',
    role: '',
  });

  const handleEmployeeAdded = () => {
    setLastRefresh(Date.now());
  };

  const handleImport = async (data: any[]) => {
    if (!user) throw new Error('User not authenticated');
    return await importEmployees(data, user.id);
  };

  const handleImportComplete = () => {
    setLastRefresh(Date.now());
  };

  const { items: employees, fetchEmployees } = useEmployeesStore();

  const handleExport = async () => {
    try {
      setExporting(true);
      await fetchEmployees();
      const filteredEmployees = employees.filter((employee) => {
        if (filters.department && employee.department !== filters.department) return false;
        if (filters.status && employee.status !== filters.status) return false;
        if (filters.role && employee.role !== filters.role) return false;
        return true;
      });

      const filename = `employees_${new Date().toISOString().split('T')[0]}.csv`;
      exportToCSV(filteredEmployees, filename);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Employees</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your employee roster, view details, and handle employee information.
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
              Import
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </button>
          </div>
        </div>

        {isFiltersOpen && (
          <div className="mt-4">
            <EmployeeFilters filters={filters} onFilterChange={setFilters} />
          </div>
        )}

        <div className="mt-4">
          <EmployeeList 
            filters={filters} 
            onRefresh={handleEmployeeAdded}
            lastRefresh={lastRefresh}
          />
        </div>
      </div>

      <AddEmployeeModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onEmployeeAdded={handleEmployeeAdded}
      />
      </div>
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          handleImportComplete();
        }}
        entityType="employees"
        entityName="Employees"
        onImport={handleImport}
      />
    </>
  );
}