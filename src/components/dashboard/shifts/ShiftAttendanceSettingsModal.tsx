import React, { useState, useEffect } from 'react';
import { X, Clock, AlertCircle } from 'lucide-react';
import { type Shift } from '../../../stores/shiftsStore';
import { useAttendanceStore} from '../../../stores/attendanceStore';

interface ShiftAttendanceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift;
  onSettingsUpdated?: () => void;
}

interface FormData {
  clockInStartOffset: string;
  clockInEndOffset: string;
  clockOutStartOffset: string;
  clockOutEndOffset: string;
  lateThresholdMinutes: number;
  halfDayThresholdMinutes: number;
}

export default function ShiftAttendanceSettingsModal({
  isOpen,
  onClose,
  shift,
  onSettingsUpdated
}: ShiftAttendanceSettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    clockInStartOffset: '00:00',
    clockInEndOffset: '02:00',
    clockOutStartOffset: '-01:00',
    clockOutEndOffset: '01:00',
    lateThresholdMinutes: 15,
    halfDayThresholdMinutes: 240
  });

  // Focus trap refs
  const firstFocusableRef = React.useRef<HTMLButtonElement>(null);
  const lastFocusableRef = React.useRef<HTMLButtonElement>(null);
  const { getShiftAttendanceSettings, updateShiftAttendanceSettings } = useAttendanceStore();
  
  useEffect(() => {
    if (isOpen) {
      // Load current settings
      const loadSettings = async () => {
        try {
          setLoading(true);
          const today = new Date().toISOString().split('T')[0];
          const settings = await getShiftAttendanceSettings(shift.id, today);
          
          // Convert time offsets to form format
          setFormData({
            clockInStartOffset: formatTimeOffset(settings.clock_in_start),
            clockInEndOffset: formatTimeOffset(settings.clock_in_end),
            clockOutStartOffset: formatTimeOffset(settings.clock_out_start),
            clockOutEndOffset: formatTimeOffset(settings.clock_out_end),
            lateThresholdMinutes: settings.late_threshold_minutes,
            halfDayThresholdMinutes: settings.half_day_threshold_minutes
          });
          
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load settings');
        } finally {
          setLoading(false);
        }
      };

      loadSettings();
      firstFocusableRef.current?.focus();
    }
  }, [isOpen, shift.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate time offsets
      const timeOffsets = [
        formData.clockInStartOffset,
        formData.clockInEndOffset,
        formData.clockOutStartOffset,
        formData.clockOutEndOffset
      ];

      for (const offset of timeOffsets) {
        if (!isValidTimeOffset(offset)) {
          throw new Error('Invalid time offset format. Use HH:mm format with optional - prefix.');
        }
      }

      // Update settings
      await updateShiftAttendanceSettings(shift.id, {
        clock_in_start_offset: formData.clockInStartOffset,
        clock_in_end_offset: formData.clockInEndOffset,
        clock_out_start_offset: formData.clockOutStartOffset,
        clock_out_end_offset: formData.clockOutEndOffset,
        late_threshold_minutes: formData.lateThresholdMinutes,
        half_day_threshold_minutes: formData.halfDayThresholdMinutes
      });

      setSuccess(true);
      onSettingsUpdated?.();
      
      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstFocusableRef.current) {
        e.preventDefault();
        lastFocusableRef.current?.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusableRef.current) {
        e.preventDefault();
        firstFocusableRef.current?.focus();
      }
    }
  };

  const formatTimeOffset = (time: string): string => {
    // Convert time to offset format (HH:mm with optional - prefix)
    const [hours, minutes] = time.split(':');
    const totalMinutes = parseInt(hours) * 60 + parseInt(minutes);
    const sign = totalMinutes < 0 ? '-' : '';
    const absMinutes = Math.abs(totalMinutes);
    const h = Math.floor(absMinutes / 60).toString().padStart(2, '0');
    const m = (absMinutes % 60).toString().padStart(2, '0');
    return `${sign}${h}:${m}`;
  };

  const isValidTimeOffset = (offset: string): boolean => {
    const regex = /^-?\d{2}:\d{2}$/;
    return regex.test(offset);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-labelledby="shift-settings-title"
      aria-modal="true"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              ref={firstFocusableRef}
              type="button"
              className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3 
                id="shift-settings-title"
                className="text-lg leading-6 font-medium text-gray-900"
              >
                Attendance Settings for {shift.name}
              </h3>

              {error && (
                <div className="mt-2 rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">{error}</h3>
                    </div>
                  </div>
                </div>
              )}

              {success && (
                <div className="mt-2 rounded-md bg-green-50 p-4">
                  <div className="text-sm text-green-700">Settings updated successfully!</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                {/* <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="clockInStartOffset" className="block text-sm font-medium text-gray-700">
                      Clock In Start Offset
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Clock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="clockInStartOffset"
                        required
                        pattern="-?\d{2}:\d{2}"
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        value={formData.clockInStartOffset}
                        onChange={(e) => setFormData({ ...formData, clockInStartOffset: e.target.value })}
                        placeholder="00:00"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="clockInEndOffset" className="block text-sm font-medium text-gray-700">
                      Clock In End Offset
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Clock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="clockInEndOffset"
                        required
                        pattern="-?\d{2}:\d{2}"
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        value={formData.clockInEndOffset}
                        onChange={(e) => setFormData({ ...formData, clockInEndOffset: e.target.value })}
                        placeholder="02:00"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="clockOutStartOffset" className="block text-sm font-medium text-gray-700">
                      Clock Out Start Offset
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Clock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="clockOutStartOffset"
                        required
                        pattern="-?\d{2}:\d{2}"
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        value={formData.clockOutStartOffset}
                        onChange={(e) => setFormData({ ...formData, clockOutStartOffset: e.target.value })}
                        placeholder="-01:00"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="clockOutEndOffset" className="block text-sm font-medium text-gray-700">
                      Clock Out End Offset
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Clock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="clockOutEndOffset"
                        required
                        pattern="-?\d{2}:\d{2}"
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        value={formData.clockOutEndOffset}
                        onChange={(e) => setFormData({ ...formData, clockOutEndOffset: e.target.value })}
                        placeholder="01:00"
                      />
                    </div>
                  </div>
                </div> */}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="lateThreshold" className="block text-sm font-medium text-gray-700">
                      Late Threshold (minutes)
                    </label>
                    <input
                      type="number"
                      id="lateThreshold"
                      required
                      min="0"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={formData.lateThresholdMinutes}
                      onChange={(e) => setFormData({ ...formData, lateThresholdMinutes: parseInt(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label htmlFor="halfDayThreshold" className="block text-sm font-medium text-gray-700">
                      Half Day Threshold (minutes)
                    </label>
                    <input
                      type="number"
                      id="halfDayThreshold"
                      required
                      min="0"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={formData.halfDayThresholdMinutes}
                      onChange={(e) => setFormData({ ...formData, halfDayThresholdMinutes: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Settings'}
                  </button>
                  <button
                    type="button"
                    ref={lastFocusableRef}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}