import React, { useEffect } from 'react';
import { IndianRupee, Users, Clock, TrendingUp } from 'lucide-react';
import { usePayrollStore, PayrollSummary as PayrollSummaryType } from '../../../stores/payrollStore';

interface PayrollSummaryProps {
  periodStart: string;
  periodEnd: string;
  lastRefresh: number;
}

export default function PayrollSummary({ periodStart, periodEnd, lastRefresh }: PayrollSummaryProps) {
  const { summary, summaryLoading: loading, summaryError: error, fetchPayrollSummary } = usePayrollStore();

  useEffect(() => {
    fetchPayrollSummary(
      periodStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      periodEnd || new Date().toISOString()
    );
  }, [periodStart, periodEnd, lastRefresh, fetchPayrollSummary]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg p-6 shadow animate-pulse">
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
        <div className="text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (!summary) return null;

  const stats = [
    {
      name: 'Total Payroll',
      value: `₹${summary.total_payroll.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: IndianRupee,
    },
    {
      name: 'Total Employees',
      value: summary.total_employees.toString(),
      icon: Users,
    },
    {
      name: 'Total Overtime',
      value: `₹${summary.total_overtime.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: Clock,
    },
    {
      name: 'Total Bonus',
      value: `₹${summary.total_bonus.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
    </div>
  );
}