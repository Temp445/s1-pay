import React, { useEffect } from 'react';
import { DollarSign, Users, Clock, TrendingUp, Calendar, ClipboardList } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';

export default function StatisticsOverview() {
  const { statistics, loading, fetchStatistics } = useDashboardStore();

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  if (loading || !statistics) {
    return (
      <div>
        <h3 className="text-lg leading-6 font-medium text-gray-900">Dashboard Statistics</h3>
        <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="bg-white pt-5 px-4 pb-12 sm:pt-6 sm:px-6 rounded-lg overflow-hidden shadow animate-pulse">
              <div className="h-10 bg-gray-200 rounded mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  const stats = [
    {
      name: 'Total Employees',
      value: statistics.totalEmployees.toString(),
      icon: Users,
    },
    {
      name: 'Active Employees',
      value: statistics.activeEmployees.toString(),
      icon: Users,
    },
    {
      name: 'On Leave',
      value: statistics.onLeave.toString(),
      icon: Calendar,
    },
    {
      name: 'Pending Leave Requests',
      value: statistics.pendingLeaveRequests.toString(),
      icon: Clock,
    },
    {
      name: 'Today Attendance',
      value: `${statistics.todayAttendanceRate}%`,
      icon: ClipboardList,
    },
    {
      name: 'Monthly Attendance',
      value: `${statistics.currentMonthAttendanceRate}%`,
      icon: TrendingUp,
    },
  ];

  return (
    <div>
      <h3 className="text-lg leading-6 font-medium text-gray-900">Dashboard Statistics</h3>
      <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((item) => (
          <div
            key={item.name}
            className="relative bg-white pt-5 px-4 pb-12 sm:pt-6 sm:px-6 rounded-lg overflow-hidden shadow"
          >
            <dt>
              <div className="absolute bg-indigo-500 rounded-md p-3">
                <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <p className="ml-16 text-sm font-medium text-gray-500 truncate">{item.name}</p>
            </dt>
            <dd className="ml-16 pb-6 flex items-baseline sm:pb-7">
              <p className="text-2xl font-semibold text-gray-900">{item.value}</p>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
