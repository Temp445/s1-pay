import React, { useState, useEffect } from 'react';
import { useLeaveStore } from '../../../stores/leaveStore';

interface LeaveFiltersProps {
  filters: {
    start_date: string;
    end_date: string;
    status: string;
    type: string;
  };
  onFilterChange: (filters: { start_date: string; end_date: string; status: string; type: string }) => void;
}

const statuses = ['Pending', 'Approved', 'Rejected', 'Cancelled'];

export default function LeaveFilters({ filters, onFilterChange }: LeaveFiltersProps) {
  const { leaveTypes, fetchLeaveTypes } = useLeaveStore();
  const leaveTypesData = leaveTypes.items || [];
  const loading = leaveTypes.loading;

  useEffect(() => {
    fetchLeaveTypes();
  }, [fetchLeaveTypes]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-10 bg-gray-200 animate-pulse rounded-md"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div>
        <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
          Start Date
        </label>
        <input
          type="date"
          id="start_date"
          name="start_date"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={filters.start_date}
          onChange={(e) => onFilterChange({ ...filters, start_date: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
          End Date
        </label>
        <input
          type="date"
          id="end_date"
          name="end_date"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={filters.end_date}
          onChange={(e) => onFilterChange({ ...filters, end_date: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700">
          Leave Type
        </label>
        <select
          id="type"
          name="type"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          value={filters.type}
          onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
        >
          <option value="">All Types</option>
          {leaveTypesData.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
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