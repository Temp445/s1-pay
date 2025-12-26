import React, { useState, useEffect } from 'react';
import { AlertCircle, Download, FileText, Printer } from 'lucide-react';
import { useReportsStore } from '../../../stores/reportsStore';
import ReportTable from './ReportTable';

interface EmployeeMasterReportProps {
  subtype: string;
  filters: {
    startDate: string;
    endDate: string;
    department: string;
    employee: string;
  };
}

export default function EmployeeMasterReport({ subtype, filters }: EmployeeMasterReportProps) {
  const { employeeMasterReports, loading, error, fetchEmployeeMasterReport } = useReportsStore();
  const [columns, setColumns] = useState<string[]>([]);

  const reportData = employeeMasterReports[subtype]?.data || [];

  useEffect(() => {
    fetchEmployeeMasterReport(subtype, filters);
  }, [subtype, filters, fetchEmployeeMasterReport]);

  useEffect(() => {
    if (reportData.length > 0) {
      setColumns(Object.keys(reportData[0]));
    }
  }, [reportData]);

  const getReportTitle = () => {
    switch (subtype) {
      case 'basic':
        return 'Employee Basic Information Report';
      case 'salary':
        return 'Employee Salary Structure Report';
      case 'tax':
        return 'Employee Tax Declaration Report';
      case 'bank':
        return 'Employee Bank Account Report';
      case 'department':
        return 'Department/Designation Report';
      default:
        return 'Employee Master Report';
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{getReportTitle()}</h2>
        <div className="flex space-x-2">
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
        
        <ReportTable data={reportData} columns={columns} />
      </div>
    </div>
  );
}