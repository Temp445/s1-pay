import React, { useState, useEffect } from "react";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import {
  useShiftsStore,
  type ShiftAssignment,
} from "../../../stores/shiftsStore";

const formatTime = (time?: string | null) => {
  if (!time) return "—";
  return time.slice(0, 5); // "10:00:00" → "10:00"
};

interface ShiftCalendarProps {
  onShiftClick?: (shift: ShiftAssignment) => void;
  selectedDate?: Date;
  focusedDate?: Date | null;
  onClearFocus?: () => void;
}

type DrillDownState = {
  date: Date;
  shiftId: string;
} | null;

export default function ShiftCalendar({
  onShiftClick,
  selectedDate = new Date(),
  focusedDate,
  onClearFocus,
}: ShiftCalendarProps) {
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [drillDown, setDrillDown] = useState<DrillDownState>(null);

  const { assignments, fetchShiftAssignments } = useShiftsStore();
  const shifts = assignments.items || [];

  /* ---------- SYNC CURRENT DATE WITH FOCUS ---------- */
  useEffect(() => {
    if (focusedDate) {
      setCurrentDate(focusedDate);
    }
  }, [focusedDate]);

  /* ---------- FETCH SHIFTS ---------- */
  useEffect(() => {
    const startDate = format(startOfWeek(currentDate), "yyyy-MM-dd");
    const endDate = format(addDays(startOfWeek(currentDate), 6), "yyyy-MM-dd");
    fetchShiftAssignments(startDate, endDate);
  }, [currentDate, fetchShiftAssignments]);

  /* ---------- DAYS TO RENDER ---------- */
  const weekDays = focusedDate
    ? [focusedDate]
    : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate), i));

  /* ---------- GROUP BY SHIFT ---------- */
  const groupByShift = (day: Date) => {
    const dayShifts = shifts.filter((s) =>
      isSameDay(parseISO(s.schedule_date), day)
    );

    return Object.values(
      dayShifts.reduce<Record<string, ShiftAssignment[]>>((acc, s) => {
        if (!acc[s.shift_id]) acc[s.shift_id] = [];
        acc[s.shift_id].push(s);
        return acc;
      }, {})
    );
  };

  /* ---------- DRILLDOWN VIEW ---------- */
  if (drillDown) {
    const filtered = shifts.filter(
      (s) =>
        isSameDay(parseISO(s.schedule_date), drillDown.date) &&
        s.shift_id === drillDown.shiftId
    );

    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center gap-3">
          {drillDown && (
            <button
              onClick={() => {
                setDrillDown(null);
                onClearFocus?.();
              }}
              className="text-sm text-indigo-600"
            >
              <ArrowLeft />
            </button>
          )}

          <h2 className="text-lg font-semibold">
            {format(drillDown.date, "EEEE, MMM d yyyy")}
          </h2>
        </div>

        <div className="grid grid-cols-4 px-4 py-2 bg-gray-50 text-sm font-medium text-gray-600">
          <div>Employee</div>
          <div>Shift</div>
          <div>Timing</div>
          <div>Status</div>
        </div>

        <div className="divide-y">
          {filtered.map((shift) => (
            <div
              key={shift.id}
              onClick={() => onShiftClick?.(shift)}
              className="grid grid-cols-4 px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer"
            >
              <div>{shift.employee?.name ?? "—"}</div>
              <div>{shift.shift?.name}</div>
              <div className="text-gray-500">
                {shift.shift?.start_time} – {shift.shift?.end_time}
              </div>
              <div>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    shift.status === "scheduled"
                      ? "bg-blue-100 text-blue-800"
                      : shift.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : shift.status === "in_progress"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {shift.status
                    .split("_")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ---------- WEEK / DAY VIEW ---------- */
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Week of {format(startOfWeek(currentDate), "MMM d, yyyy")}
        </h2>

        <div className="flex space-x-2">
          <button onClick={() => setCurrentDate(addDays(currentDate, -7))}>
            <ChevronLeft />
          </button>
          <button onClick={() => setCurrentDate(addDays(currentDate, 7))}>
            <ChevronRight />
          </button>
        </div>
      </div>

      <div
        className={`grid gap-px bg-gray-200 ${
          focusedDate ? "grid-cols-1" : "grid-cols-7"
        }`}
      >
        {weekDays.map((day) => {
          const grouped = groupByShift(day);

          return (
            <div key={day.toISOString()} className="bg-white p-1 min-h-[180px]">
              <div className="text-sm font-medium text-gray-600 mb-2">
                {format(day, "EEE d")}
              </div>

              {grouped.map((group) => {
                const base = group[0];

                return (
                  <button
                    key={base.shift_id}
                    onClick={() => {
                      setDrillDown({ date: day, shiftId: base.shift_id });
                      onShiftClick?.(base);
                    }}
                    className="group w-full text-left mb-3 p-1 rounded-lg border border-gray-200 bg-white transition-all duration-200 hover:border-blue-300 hover:shadow-md active:scale-[0.98]"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {base.shift?.name}
                        </div>

                        <div className="flex items-center text-xs font-medium text-gray-500">
                          {formatTime(base.shift?.start_time)} –{" "}
                          {formatTime(base.shift?.end_time)}
                        </div>

                        <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 mt-1">
                          {group.length} Assigned
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
