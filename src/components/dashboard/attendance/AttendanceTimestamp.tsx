import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export type TimestampEntry = {
  id: string;
  entry: 'IN' | 'OUT';
  timestamp: string;
  timing_status: 'OK' | 'OUTSIDE_SHIFT' | 'NO_SHIFT_ASSIGNED';
  shift_id: string;
  shift_name?: string;
};

type AttendanceTimestampProps = {
  isOpen: boolean;
  employeeId: string | null;
  date: string | null;
  onClose: () => void;
};

const timingStatusLabel: Record<
  TimestampEntry['timing_status'],
  string
> = {
  OK: 'Ok',
  OUTSIDE_SHIFT: 'Wrong Shift',
  NO_SHIFT_ASSIGNED: 'No Shift Assigned',
};

export default function AttendanceTimestamp({
  isOpen,
  employeeId,
  date,
  onClose,
}: AttendanceTimestampProps) {
  const [entries, setEntries] = useState<TimestampEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !employeeId || !date) return;

    const fetchEntries = async () => {
      setLoading(true);

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('attendance_timestamp')
        .select('*, shifts(name)')
        .eq('employee_id', employeeId)
        .gte('timestamp', startOfDay.toISOString())
        .lte('timestamp', endOfDay.toISOString())
        .order('timestamp', { ascending: true });

      if (error) {
        console.error(error);
        setEntries([]);
      } else {
        const mapped: TimestampEntry[] = (data || []).map((entry: any) => ({
          ...entry,
          shift_name: entry.shifts?.name ?? '',
        }));
        setEntries(mapped);
      }

      setLoading(false);
    };

    fetchEntries();
  }, [isOpen, employeeId, date]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-900"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold mb-4">
          Employee Timestamp Details
        </h2>

        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-center text-gray-500">No timestamps found</p>
        ) : (
          <table className="w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Entry</th>
                <th className="px-4 py-2 text-left">Timestamp</th>
                <th className="px-4 py-2 text-left">Assigned Shift</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2 font-medium">
                    {entry.entry}
                  </td>

                  <td className="px-4 py-2">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>

                  <td className="px-4 py-2">
                    {entry.shift_name || '-'}
                  </td>

                  <td className="px-4 py-2">
                    {timingStatusLabel[entry.timing_status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
