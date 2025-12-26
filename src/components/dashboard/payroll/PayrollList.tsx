import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { PayrollEntry, usePayrollStore } from '../../../stores/payrollStore';

interface PayrollListProps {
  filters: {
    period_start: string;
    period_end: string;
    status: string;
  };
  onRefresh: () => void;
  lastRefresh: number;
}

export default function PayrollList({ filters, onRefresh, lastRefresh }: PayrollListProps) {
  const { items: entries, loading, error, fetchPayrollEntries, updatePayrollEntry, deletePayrollEntry } = usePayrollStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchPayrollEntries(filters.period_start, filters.period_end);
  }, [filters, lastRefresh, fetchPayrollEntries]);

  const handleDelete = async (id: string) => {
    try {
      await deletePayrollEntry(id);
      onRefresh();
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete payroll entry:', err);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: PayrollEntry['status']) => {
    try {
      await updatePayrollEntry(id, {
        status: newStatus,
        payment_date: newStatus === 'Paid' ? new Date().toISOString() : null
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to update payroll status:', err);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    if (filters.status && entry.status !== filters.status) return false;
    return true;
  });

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
        <div className="text-sm text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col">
      <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                    Employee
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Period
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Base Salary
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Total Amount
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <div className="flex items-center">
                        <div>
                          <div className="font-medium text-gray-900">{entry.employee?.name}</div>
                          <div className="text-gray-500">{entry.employee?.department}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div>{new Date(entry.period_start).toLocaleDateString()}</div>
                      <div>{new Date(entry.period_end).toLocaleDateString()}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    ₹{entry.base_salary.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">
                    ₹{entry.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          entry.status === 'Paid'
                            ? 'bg-green-100 text-green-800'
                            : entry.status === 'Pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : entry.status === 'Approved'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center justify-end gap-2">
                        {entry.status !== 'Paid' && (
                          <>
                            <button
                              type="button"
                              className="text-green-600 hover:text-green-900"
                              onClick={() => handleStatusUpdate(entry.id, 'Approved')}
                              title="Approve"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="text-red-600 hover:text-red-900"
                              onClick={() => handleStatusUpdate(entry.id, 'Paid')}
                              title="Mark as Paid"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="text-red-600 hover:text-red-900"
                          onClick={() => setShowDeleteConfirm(entry.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>
            <div className="relative inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">Delete Payroll Entry</h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete this payroll entry? This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => handleDelete(showDeleteConfirm)}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => setShowDeleteConfirm(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}