import React, { useState, useEffect } from 'react';
import { AlertCircle, Download, FileText, Printer, ChevronDown } from 'lucide-react';
import { useReportsStore } from '../../../stores/reportsStore';
import ReportTable from './ReportTable';

interface TransactionReportProps {
  subtype: string;
  filters: {
    startDate: string;
    endDate: string;
    department: string;
    employee: string;
  };
}

export default function TransactionReport({ subtype, filters }: TransactionReportProps) {
  const { transactionReports, loading, error, fetchTransactionReport } = useReportsStore();
  const [columns, setColumns] = useState<string[]>([]);
  const [availableComponents, setAvailableComponents] = useState<string[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [showComponentDropdown, setShowComponentDropdown] = useState(false);

  const reportData = transactionReports[subtype]?.data || [];
  const summary = transactionReports[subtype]?.summary || {};

  useEffect(() => {
    fetchTransactionReport(subtype, filters);
  }, [subtype, filters, fetchTransactionReport]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.component-dropdown-container')) {
        setShowComponentDropdown(false);
      }
    };

    if (showComponentDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showComponentDropdown]);

  useEffect(() => {
    if (reportData.length > 0 && subtype === 'monthly') {
      const defaultColumns = ['employeeCode', 'name', 'department', 'payPeriod', 'earnings', 'deductions', 'netAmount', 'paymentDate', 'status'];

      const components = new Set<string>();
      reportData.forEach((row: any) => {
        if (row.salary_components && Array.isArray(row.salary_components)) {
          row.salary_components.forEach((comp: any) => {
            if (comp.name) {
              components.add(comp.name);
            }
          });
        }
        if (row.deduction_components && Array.isArray(row.deduction_components)) {
          row.deduction_components.forEach((comp: any) => {
            if (comp.name) {
              components.add(comp.name);
            }
          });
        }
      });

      const componentList = Array.from(components).sort();
      setAvailableComponents(componentList);

      const finalColumns = [...defaultColumns, ...selectedComponents.filter(comp => componentList.includes(comp))];
      setColumns(finalColumns);
    } else if (reportData.length > 0) {
      setColumns(Object.keys(reportData[0]));
    }
  }, [reportData, selectedComponents, subtype]);

  const getReportTitle = () => {
    switch (subtype) {
      case 'monthly':
        return 'Monthly Salary Report';
      case 'attendance':
        return 'Attendance Report';
      case 'leave':
        return 'Leave Balance Report';
      case 'overtime':
        return 'Overtime Report';
      case 'bonus':
        return 'Bonus Payment Report';
      case 'loan':
        return 'Loan/Advance Report';
      default:
        return 'Transaction Report';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
          </div>
        </div>
      </div>
    );
  }

  if (reportData.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No data available</h3>
        <p className="mt-1 text-sm text-gray-500">
          Try changing your filters or selecting a different report type.
        </p>
      </div>
    );
  }

  const handleComponentToggle = (componentName: string) => {
    setSelectedComponents(prev => {
      if (prev.includes(componentName)) {
        return prev.filter(c => c !== componentName);
      } else {
        return [...prev, componentName];
      }
    });
  };

  const handleSelectAllComponents = () => {
    if (selectedComponents.length === availableComponents.length) {
      setSelectedComponents([]);
    } else {
      setSelectedComponents([...availableComponents]);
    }
  };

  const enhancedReportData = reportData.map((row: any) => {
    if (subtype !== 'monthly') return row;

    const enhancedRow = { ...row };

    selectedComponents.forEach(compName => {
      let componentValue = 0;

      if (row.salary_components && Array.isArray(row.salary_components)) {
        const salaryComp = row.salary_components.find((c: any) => c.name === compName);
        if (salaryComp) {
          componentValue = salaryComp.amount || 0;
        }
      }

      if (componentValue === 0 && row.deduction_components && Array.isArray(row.deduction_components)) {
        const deductionComp = row.deduction_components.find((c: any) => c.name === compName);
        if (deductionComp) {
          componentValue = deductionComp.amount || 0;
        }
      }

      enhancedRow[compName] = componentValue;
    });

    return enhancedRow;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{getReportTitle()}</h2>
        <div className="flex space-x-2">
          {subtype === 'monthly' && availableComponents.length > 0 && (
            <div className="relative component-dropdown-container">
              <button
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                onClick={() => setShowComponentDropdown(!showComponentDropdown)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Select Components ({selectedComponents.length})
                <ChevronDown className="h-4 w-4 ml-1" />
              </button>

              {showComponentDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-10 border border-gray-200 max-h-96 overflow-y-auto">
                  <div className="p-2 border-b border-gray-200">
                    <button
                      onClick={handleSelectAllComponents}
                      className="w-full text-left px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-md"
                    >
                      {selectedComponents.length === availableComponents.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="p-2">
                    {availableComponents.map((component) => (
                      <label
                        key={component}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 rounded-md cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedComponents.includes(component)}
                          onChange={() => handleComponentToggle(component)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <span className="ml-3 text-sm text-gray-700">{component}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </button>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6 bg-gray-50">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Report Details
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Generated on {new Date().toLocaleString()} | 
            {filters.department ? ` Department: ${filters.department} |` : ''}
            {filters.startDate ? ` Period: ${filters.startDate} to ${filters.endDate}` : ''}
          </p>
        </div>
        
        <ReportTable data={enhancedReportData} columns={columns} />
        
        {/* Summary Section */}
        {Object.keys(summary).length > 0 && (
          <div className="px-4 py-5 sm:px-6 bg-gray-50 border-t border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Summary
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(summary).map(([key, value]) => (
                <div key={key} className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">
                      {typeof value === 'number' ? value.toLocaleString('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }) : value}
                    </dd>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}