import React, { useEffect, useState } from 'react';
import { Calendar, AlertCircle, Check, X } from 'lucide-react';
import { useLeaveStore, type LeaveRequest } from '../../../stores/leaveStore';
import { useAuth } from '../../../contexts/AuthContext';
import type { Employee } from '../../../stores/employeesStore';

interface LeaveListProps {
  employee?: Employee;
  filters: {
    start_date: string;
    end_date: string;
    status: string;
    type: string;
  };
  onRefresh: () => void;
  lastRefresh: number;
}

export default function LeaveList({
  employee,
  filters,
  onRefresh,
  lastRefresh,
}: LeaveListProps) {
  const { user } = useAuth();
  const { leaveRequests, fetchLeaveRequests, updateLeaveRequestStatus } = useLeaveStore();
  const requests = leaveRequests.items || [];
  const loading = leaveRequests.loading;
  const error = leaveRequests.error;

  useEffect(() => {
    if (!user) return;

    fetchLeaveRequests(
      employee?.id ?? '',
      filters.start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      filters.end_date || new Date().toISOString()
    );
  }, [employee, lastRefresh, user, filters.start_date, filters.end_date, fetchLeaveRequests]);

  const handleStatusUpdate = async (
    requestId: string,
    newStatus: 'Approved' | 'Rejected' | 'Cancelled'
  ) => {
    try {
      await updateLeaveRequestStatus(requestId, newStatus);
      onRefresh();
    } catch (err) {
      console.error('Failed to update request status:', err);
    }
  };

  const filteredRequests = requests.filter((request) => {
    if (filters.status && request.status !== filters.status) return false;
    if (filters.type && request.leave_type_id !== filters.type) return false;
    if (
      filters.start_date &&
      new Date(request.start_date) < new Date(filters.start_date)
    )
      return false;
    if (
      filters.end_date &&
      new Date(request.end_date) > new Date(filters.end_date)
    )
      return false;
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
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {filteredRequests.map((request) => (
          <li key={request.id}>
            <div className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <p className="ml-2 text-sm font-medium text-gray-900">
                    {request.employee_name} {':'} {request.leave_type.name}
                  </p>
                </div>
                <div className="ml-2 flex-shrink-0">
                  <span
                    className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                      request.status === 'Approved'
                        ? 'bg-green-100 text-green-800'
                        : request.status === 'Rejected'
                        ? 'bg-red-100 text-red-800'
                        : request.status === 'Cancelled'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {request.status}
                  </span>
                </div>
              </div>
              <div className="mt-2 sm:flex sm:justify-between">
                <div className="sm:flex">
                  <p className="flex items-center text-sm text-gray-500">
                    From: {new Date(request.start_date).toLocaleDateString()}
                  </p>
                  <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                    To: {new Date(request.end_date).toLocaleDateString()}
                  </p>
                </div>
                {request.status === 'Pending' && (
                  <div className="mt-2 flex items-center text-sm sm:mt-0">
                    <button
                      onClick={() => handleStatusUpdate(request.id, 'Approved')}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(request.id, 'Rejected')}
                      className="ml-3 inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  <span className="font-medium">Reason:</span> {request.reason}
                </p>
              </div>
              {request.approved_by && (
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Approved by:</span>{' '}
                    {request.approved_by_user?.email}
                    {request.approved_at && (
                      <span className="ml-2">
                        on {new Date(request.approved_at).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
