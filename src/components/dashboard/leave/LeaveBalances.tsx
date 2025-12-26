import React, { useEffect } from 'react';
import { Calendar, AlertCircle } from 'lucide-react';
import { useLeaveStore, type LeaveBalance } from '../../../stores/leaveStore';
import { useAuth } from '../../../contexts/AuthContext';

interface LeaveBalancesProps {
  employeeId: string;
  lastRefresh: number;
}

export default function LeaveBalances({
  employeeId,
  lastRefresh,
}: LeaveBalancesProps) {
  const { user } = useAuth();
  const { leaveBalances, fetchLeaveBalances } = useLeaveStore();
  const balances = leaveBalances.items || [];
  const loading = leaveBalances.loading;
  const error = leaveBalances.error;

  useEffect(() => {
    if (!user) return;

    const currentYear = new Date().getFullYear();
    fetchLeaveBalances(employeeId, currentYear);
  }, [user, lastRefresh, employeeId, fetchLeaveBalances]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, index) => (
          <div
            key={index}
            className="bg-white rounded-lg p-6 shadow animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        ))}
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
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {balances.map((balance) => (
        <div
          key={balance.id}
          className="relative bg-white pt-5 px-4 pb-12 sm:pt-6 sm:px-6 rounded-lg overflow-hidden shadow"
        >
          <dt>
            <div className="absolute rounded-md p-3 bg-indigo-500">
              <Calendar className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <p className="ml-16 text-sm font-medium text-gray-500 truncate">
              {balance.leave_types.name}
            </p>
          </dt>
          <dd className="ml-16 pb-6 flex items-baseline sm:pb-7">
            <p className="text-2xl font-semibold text-gray-900">
              {balance.total_days - balance.used_days}
            </p>
            <p className="ml-2 flex items-baseline text-sm text-gray-500">
              of {balance.total_days} days
            </p>
            <div className="absolute bottom-0 inset-x-0 bg-gray-50 px-4 py-4 sm:px-6">
              <div className="text-sm">
                <span className="font-medium text-gray-500">
                  Used: {balance.used_days} days
                </span>
              </div>
            </div>
          </dd>
        </div>
      ))}
    </div>
  );
}
