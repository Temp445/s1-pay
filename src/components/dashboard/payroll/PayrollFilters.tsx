import React from 'react';

interface PayrollFiltersProps {
  filters: {
    period_start: string;
    period_end: string;
    status: string;
  };
  onFilterChange: (filters: { period_start: string; period_end: string; status: string }) => void;
}

const statuses = ['Draft', 'Pending', 'Approved', 'Paid'];

export default function PayrollFilters({ filters, onFilterChange }: PayrollFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <label htmlFor="period_start" className="block text-sm font-medium text-gray-700">
          Period Start
        </label>
        <input
          type="date"
          id="period_start"
          name="period_start"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={filters.period_start}
          onChange={(e) => onFilterChange({ ...filters, period_start: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor="period_end" className="block text-sm font-medium text-gray-700">
          Period End
        </label>
        <input
          type="date"
          id="period_end"
          name="period_end"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={filters.period_end}
          onChange={(e) => onFilterChange({ ...filters, period_end: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700">
          Status
        </label>
        <select
          id="status"
          name="status"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={filters.status}
          onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}