import React, { useEffect, useState, useRef } from 'react';
import { Edit2, Trash2, MoreVertical } from 'lucide-react';
import { useEmployeesStore, type Employee } from '../../../stores/employeesStore';
import EditEmployeeModal from './EditEmployeeModal';

interface EmployeeListProps {
  filters: {
    department: string;
    status: string;
    role: string;
  };
  onRefresh: () => void;
  lastRefresh: number;
}

export default function EmployeeList({ filters, onRefresh, lastRefresh }: EmployeeListProps) {
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [actionMenuEmployee, setActionMenuEmployee] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const { items: employees, loading, error, fetchEmployees, deleteEmployee, updateEmployee } = useEmployeesStore();

  useEffect(() => {
    fetchEmployees();
  }, [lastRefresh, fetchEmployees]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setActionMenuEmployee(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleDelete = async (employeeId: string) => {
    try {
      await deleteEmployee(employeeId);
      onRefresh();
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete employee:', err);
    }
  };

  const handleStatusUpdate = async (employeeId: string, newStatus: string) => {
    try {
      await updateEmployee(employeeId, { status: newStatus as 'Active' | 'On Leave' | 'Terminated' });
      onRefresh();
      setActionMenuEmployee(null);
    } catch (err) {
      console.error('Failed to update employee status:', err);
    }
  };

  const handleEdit = async (employeeId: string, updates: Partial<Employee>) => {
    try {
      await updateEmployee(employeeId, updates);
      onRefresh();
    } catch (err) {
      throw err;
    }
  };

  const filteredEmployees = employees.filter((employee) => {
    if (filters.department && employee.department !== filters.department) return false;
    if (filters.status && employee.status !== filters.status) return false;
    if (filters.role && employee.role !== filters.role) return false;
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
                    Name
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Department
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Role
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Start Date
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <div className="flex items-center">
                        <div>
                          <div className="font-medium text-gray-900">{employee.name}</div>
                          <div className="text-gray-500">{employee.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {employee.department}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {employee.role}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          employee.status === 'Active'
                            ? 'bg-green-100 text-green-800'
                            : employee.status === 'On Leave'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {employee.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {new Date(employee.start_date).toLocaleDateString()}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="text-indigo-600 hover:text-indigo-900"
                          onClick={() => setEditingEmployee(employee)}
                          title="Edit employee"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="text-red-600 hover:text-red-900"
                          onClick={() => setShowDeleteConfirm(employee.id)}
                          title="Delete employee"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="relative" ref={actionMenuRef}>
                          <button
                            type="button"
                            className="text-gray-400 hover:text-gray-500"
                            onClick={() => setActionMenuEmployee(actionMenuEmployee === employee.id ? null : employee.id)}
                            title="More options"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          
                          {/* Action Menu Dropdown */}
                          {actionMenuEmployee === employee.id && (
                            <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                              <div className="px-4 py-2 text-xs text-gray-500">Status Update</div>
                              {['Active', 'On Leave', 'Terminated'].map((status) => (
                                <button
                                  key={status}
                                  className={`block w-full px-4 py-2 text-sm text-left ${
                                    employee.status === status
                                      ? 'bg-gray-100 text-gray-900'
                                      : 'text-gray-700 hover:bg-gray-50'
                                  }`}
                                  onClick={() => handleStatusUpdate(employee.id, status)}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSave={handleEdit}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle">&#8203;</span>
            <div className="relative inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">Delete Employee</h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete this employee? This action cannot be undone.
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