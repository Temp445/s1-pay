import React, { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  getDay,
  addDays,
  subMonths,
  addMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type Holiday } from '../../../stores/holidaysStore';

interface HolidayCalendarProps {
  holidays: Holiday[];
  onDateClick?: (date: Date) => void;
  selectedDate?: Date;
}

export default function HolidayCalendar({
  holidays,
  onDateClick,
  selectedDate
}: HolidayCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Derive month range and all days in month
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Build full calendar days including previous month blanks
  const calendarDays = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDay = getDay(monthStart); // 0 (Sun) - 6 (Sat)
    const paddedDays: Date[] = [];

    // Add previous month days to fill start of grid
    for (let i = 0; i < startDay; i++) {
      paddedDays.push(addDays(monthStart, i - startDay));
    }

    return [...paddedDays, ...days];
  }, [monthStart, monthEnd]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // const getHolidaysForDate = (date: Date) =>
  //   holidays.filter((holiday) => isSameDay(new Date(holiday.date), date));

  const getHolidaysForDate = (date: Date) => {
  if (!Array.isArray(holidays)) return [];
  return holidays.filter((holiday) => {
    if (!holiday || !holiday.date) return false;
    const holidayDate = new Date(holiday.date);
    return !isNaN(holidayDate.getTime()) && isSameDay(holidayDate, date);
  });
};

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b">
        <h2 className="text-lg font-semibold text-gray-900">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-md hover:bg-gray-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-md hover:bg-gray-100"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="bg-gray-50 py-2 text-center text-sm font-medium text-gray-500"
          >
            {day}
          </div>
        ))}

        {/* Dates grid */}
        {calendarDays.map((date, idx) => {
          const dateHolidays = getHolidaysForDate(date);
          const isCurrentMonth =
            date.getMonth() === currentDate.getMonth();
          const selected = selectedDate && isSameDay(date, selectedDate);
          const today = isToday(date);

          return (
            <div
              key={date.getTime()} // ✅ local-safe key (fixes timezone bug)
              onClick={() => onDateClick?.(date)}
              className={`min-h-[100px] p-2 border border-gray-100 cursor-pointer
                ${isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-300'}
                ${today ? 'bg-blue-50 border-blue-300' : ''}
                ${selected ? 'ring-2 ring-indigo-500' : ''}
                hover:bg-gray-100 transition`}
            >
              <div
                className={`font-medium ${
                  isCurrentMonth ? 'text-gray-700' : 'text-gray-400'
                }`}
              >
                {format(date, 'd')}
              </div>

              <div className="mt-1 space-y-1">
                {dateHolidays.map((holiday) => (
                  <div
                    key={holiday.id}
                    className={`text-xs p-1 rounded ${
                      holiday.holiday_type === 'public'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {holiday.name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
