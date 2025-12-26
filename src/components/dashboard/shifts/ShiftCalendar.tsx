import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useShiftsStore, type ShiftAssignment } from '../../../stores/shiftsStore';
import ShiftCard from './ShiftCard';

interface ShiftCalendarProps {
  onShiftClick?: (shift: ShiftAssignment) => void;
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
}

export default function ShiftCalendar({ onShiftClick, selectedDate = new Date(), onDateChange }: ShiftCalendarProps) {
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const { assignments, fetchShiftAssignments } = useShiftsStore();
  const shifts = assignments.items || [];
  const loading = assignments.loading;
  const error = assignments.error;

  useEffect(() => {
    const startDate = format(startOfWeek(currentDate), 'yyyy-MM-dd');
    const endDate = format(addDays(startOfWeek(currentDate), 6), 'yyyy-MM-dd');
    fetchShiftAssignments(startDate, endDate);
  }, [currentDate, fetchShiftAssignments]);

  const handlePrevWeek = () => {
    const newDate = addDays(currentDate, -7);
    setCurrentDate(newDate);
    onDateChange?.(newDate);
  };

  const handleNextWeek = () => {
    const newDate = addDays(currentDate, 7);
    setCurrentDate(newDate);
    onDateChange?.(newDate);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate), i));

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
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Week of {format(startOfWeek(currentDate), 'MMM d, yyyy')}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={handlePrevWeek}
            className="p-2 rounded-md hover:bg-gray-100"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={handleNextWeek}
            className="p-2 rounded-md hover:bg-gray-100"
            aria-label="Next week"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={`min-h-[200px] bg-white p-2 ${
              isSameDay(day, new Date()) ? 'bg-blue-50' : ''
            }`}
          >
            <div className="text-sm font-medium text-gray-500 mb-2">
              {format(day, 'EEE')}
              <span className="ml-1 text-gray-900">{format(day, 'd')}</span>
            </div>
            <div className="space-y-2">
              {shifts
                .filter((shift) => isSameDay(parseISO(shift.schedule_date), day))
                .map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onClick={() => onShiftClick?.(shift)}
                    compact
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}