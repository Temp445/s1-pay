import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useShiftsStore, type Shift } from '../../../stores/shiftsStore';

interface EditShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftUpdated: () => void;
  shift: Shift | null;
}

export default function EditShiftModal({
  isOpen,
  onClose,
  onShiftUpdated,
  shift,
}: EditShiftModalProps) {
  const { updateShift } = useShiftsStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_time: '',
    end_time: '',
    break_duration: '00:30:00',
    shift_type: 'morning' as 'morning' | 'afternoon' | 'night',
    is_active: true,
  });

  /* ---------------- PREFILL DATA ---------------- */
  useEffect(() => {
    if (!shift) return;

    setFormData({
      name: shift.name,
      description: shift.description || '',
      start_time: shift.start_time.slice(0, 5), // HH:mm
      end_time: shift.end_time.slice(0, 5),     // HH:mm
      break_duration: shift.break_duration,
      shift_type: shift.shift_type,
      is_active: shift.is_active,
    });
  }, [shift]);

  const validateTimeFormat = (time: string) => {
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  };

  const formatTimeForSubmission = (time: string) => `${time}:00`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift) return;

    setLoading(true);
    setError(null);

    try {
      if (
        !validateTimeFormat(formData.start_time) ||
        !validateTimeFormat(formData.end_time)
      ) {
        throw new Error('Please enter valid times in HH:mm format');
      }

      await updateShift(shift.id, {
        name: formData.name,
        description: formData.description,
        start_time: formatTimeForSubmission(formData.start_time),
        end_time: formatTimeForSubmission(formData.end_time),
        break_duration: formData.break_duration,
        shift_type: formData.shift_type,
        is_active: formData.is_active,
      });

      onShiftUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update shift');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !shift) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X />
        </button>

        <h3 className="text-lg font-semibold mb-4">Edit Shift</h3>

        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium">Shift Name</label>
            <input
              required
              className="mt-1 w-full rounded border px-3 py-2"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Description</label>
            <textarea
              rows={3}
              className="mt-1 w-full rounded border px-3 py-2"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Start Time</label>
              <input
                type="time"
                required
                className="mt-1 w-full rounded border px-3 py-2"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium">End Time</label>
              <input
                type="time"
                required
                className="mt-1 w-full rounded border px-3 py-2"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">Break Duration</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={formData.break_duration}
              onChange={(e) =>
                setFormData({ ...formData, break_duration: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Shift Type</label>
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={formData.shift_type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  shift_type: e.target.value as any,
                })
              }
            >
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="night">Night</option>
            </select>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Update Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
