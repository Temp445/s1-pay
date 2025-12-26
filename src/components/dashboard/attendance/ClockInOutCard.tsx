import React, { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, AlertCircle, Camera, User } from 'lucide-react';
import { useAttendanceStore } from '../../../stores/attendanceStore';
import { useAuth } from '../../../contexts/AuthContext';
import type { Employee } from '../../../stores/employeesStore';
import { hasEnrolledFace } from '../../../lib/faceRecognition';
import FaceRecognitionModal from './FaceRecognitionModal';

interface ClockInOutCardProps {
  onAttendanceUpdated: () => void;
  shiftId: string;
  selectedEmployee?: Employee | null;
}

export default function ClockInOutCard({
  onAttendanceUpdated,
  shiftId,
  selectedEmployee,
}: ClockInOutCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [manualMode, setManualMode] = useState(false);
  const [manualDateTime, setManualDateTime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [manualTransientDateTime, setManualTransientDateTime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [manualReason, setManualReason] = useState('');
  const [todayRecord, setTodayRecord] = useState<{
    clock_in: string | null;
    clock_out: string | null;
  } | null>(null);
  const [settings, setSettings] = useState<{
    clock_in_start: string;
    clock_in_end: string;
    clock_out_start: string;
    clock_out_end: string;
    late_threshold_minutes: number;
    half_day_threshold_minutes: number;
  } | null>(null);
  const { user } = useAuth();
  const { fetchAttendanceRecords, getShiftAttendanceSettings, clockIn, clockOut } = useAttendanceStore();
  
  // Face recognition state
  const [isFaceRecognitionModalOpen, setIsFaceRecognitionModalOpen] = useState(false);
  const [faceRecognitionMode, setFaceRecognitionMode] = useState<'enroll' | 'verify'>('verify');
  const [hasFaceEnrolled, setHasFaceEnrolled] = useState(false);
  const [useFaceRecognition, setUseFaceRecognition] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadTodayRecord = async () => {
      if (!user || !selectedEmployee) return;

      try {
        const today = manualMode ? new Date(manualDateTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        await fetchAttendanceRecords(selectedEmployee?.id || '', today, today);

        // Get the records from store
        const records = useAttendanceStore.getState().items;
        setTodayRecord(records.length > 0 ? records[0] : null);

        // Load shift attendance settings
        const settingsData = await getShiftAttendanceSettings(shiftId, today);
        setSettings(settingsData);

        // Check if employee has enrolled face
        if (selectedEmployee) {
          const enrolled = await hasEnrolledFace(selectedEmployee.id);
          setHasFaceEnrolled(enrolled);
        }
      } catch (err) {
        console.error("Failed to load today's record:", err);
      }
    };

    loadTodayRecord();
  }, [user, selectedEmployee, shiftId, manualDateTime, manualMode]);

  const handleClockIn = async (manual: boolean = false, faceVerified: boolean = false) => {
    if (!user && !selectedEmployee) return;

    try {
      setLoading(true);
      setError(null);

      const employeeId = selectedEmployee?.id || user?.id;
      if (!employeeId) {
        throw new Error('No employee selected');
      }
      
      // If using face recognition but not manually overriding and not already verified
      if (useFaceRecognition && !manual && !faceVerified) {
        setIsFaceRecognitionModalOpen(true);
        setFaceRecognitionMode('verify');
        setLoading(false);
        return;
      }

      if (manual) {
        // Handle manual clock in with custom time and reason
        await clockIn(
          employeeId,
          shiftId,
          new Date(manualDateTime),
          manualReason,
          user?.id
        );
      } else {
        // Regular clock in with current time
        await clockIn(employeeId, shiftId, undefined, undefined, user?.id);
      }

      onAttendanceUpdated();
      if (manual) {
        setManualMode(false);
        setManualDateTime(new Date().toISOString().slice(0, 16));
        setManualReason('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clock in');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async (manual: boolean = false, faceVerified: boolean = false) => {
    if (!user && !selectedEmployee) return;

    try {
      setLoading(true);
      setError(null);

      const employeeId = selectedEmployee?.id;
      if (!employeeId) {
        throw new Error('No employee selected');
      }
      
      // If using face recognition but not manually overriding and not already verified
      if (useFaceRecognition && !manual && !faceVerified) {
        setIsFaceRecognitionModalOpen(true);
        setFaceRecognitionMode('verify');
        setLoading(false);
        return;
      }

      if (manual) {
        // Handle manual clock out with custom time and reason
        await clockOut(
          employeeId,
          shiftId,
          new Date(manualDateTime),
          manualReason
        );
      } else {
        // Regular clock out with current time
        await clockOut(employeeId, shiftId);
      }

      onAttendanceUpdated();
      if (manual) {
        setManualMode(false);
        setManualDateTime(new Date().toISOString().slice(0, 16));
        setManualReason('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clock out');
    } finally {
      setLoading(false);
    }
  };
  
  const handleFaceRecognitionSuccess = (verifiedEmployeeId?: string) => {
    // Close the modal
    setIsFaceRecognitionModalOpen(false);
    
    // If this was enrollment, update the state
    if (faceRecognitionMode === 'enroll') {
      setHasFaceEnrolled(true);
      return;
    }
    
    // For verification, check if the verified employee matches the selected employee
    if (verifiedEmployeeId && selectedEmployee && verifiedEmployeeId === selectedEmployee.id) {
      // Proceed with clock in/out
      if (!todayRecord?.clock_in) {
        handleClockIn(false, true);
      } else if (!todayRecord?.clock_out) {
        handleClockOut(false, true);
      }
    } else {
      setError('Face verification failed. Identity could not be confirmed.');
    }
  };

  const isWithinClockInWindow = () => {
    if (!settings) return false;
    const current = currentTime.getHours() * 60 + currentTime.getMinutes();
    const [startHour, startMin] = settings.clock_in_start
      .split(':')
      .map(Number);
    const [endHour, endMin] = settings.clock_in_end.split(':').map(Number);
    const start = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;
    return current >= start && current <= end;
  };

  const isWithinClockOutWindow = () => {
    if (!settings) return false;
    const current = currentTime.getHours() * 60 + currentTime.getMinutes();
    const [startHour, startMin] = settings.clock_out_start
      .split(':')
      .map(Number);
    const [endHour, endMin] = settings.clock_out_end.split(':').map(Number);
    const start = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;
    return current >= start && current <= end;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Clock className="h-6 w-6 text-indigo-600" />
            <h3 className="ml-2 text-lg font-medium text-gray-900">
              {currentTime.toLocaleTimeString()}
            </h3>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setManualMode(!manualMode)}
              className="text-sm text-indigo-600 hover:text-indigo-900"
            >
              {manualMode ? 'Live Mode' : 'Manual Mode'}
            </button>
            
            {/* Face recognition toggle */}
            <div className="flex items-center">
              <input
                id="use-face-recognition"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                checked={useFaceRecognition}
                onChange={(e) => setUseFaceRecognition(e.target.checked)}
              />
              <label htmlFor="use-face-recognition" className="ml-2 text-sm text-gray-700">
                Use Face Recognition
              </label>
            </div>
            
            {/* Face enrollment button */}
            {selectedEmployee && useFaceRecognition && (
              <button
                onClick={() => {
                  setFaceRecognitionMode('enroll');
                  setIsFaceRecognitionModalOpen(true);
                }}
                className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs rounded text-gray-700 bg-white hover:bg-gray-50"
              >
                <User className="h-3 w-3 mr-1" />
                {hasFaceEnrolled ? 'Update Face' : 'Enroll Face'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {manualMode ? (
          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="manual-datetime"
                className="block text-sm font-medium text-gray-700"
              >
                Date and Time
              </label>
              <input
                type="datetime-local"
                id="manual-datetime"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={manualTransientDateTime}
                onChange={(e) => setManualTransientDateTime(e.target.value)}
                onBlur={() => setManualDateTime(manualTransientDateTime)}
              />
            </div>
            <div>
              <label
                htmlFor="manual-reason"
                className="block text-sm font-medium text-gray-700"
              >
                Reason for Manual Entry
              </label>
              <textarea
                id="manual-reason"
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder="Please provide a reason for manual time entry"
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => handleClockIn(true)}
                disabled={
                  loading || !selectedEmployee || !!todayRecord?.clock_in
                }
                className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Manual Clock In
              </button>
              <button
                onClick={() => handleClockOut(true)}
                disabled={
                  loading ||
                  !selectedEmployee ||
                  !todayRecord?.clock_in ||
                  !!todayRecord?.clock_out
                }
                className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Manual Clock Out
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => handleClockIn(false)}
              disabled={
                loading ||
                !selectedEmployee ||
                !!todayRecord?.clock_in /*|| !isWithinClockInWindow()*/
              }
              className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {useFaceRecognition ? (
                <Camera className="h-4 w-4 mr-2" />
              ) : (
                <LogIn className="h-4 w-4 mr-2" />
              )}
              Clock In
            </button>
            <button
              onClick={() => handleClockOut(false)}
              disabled={
                loading ||
                !selectedEmployee ||
                !todayRecord?.clock_in ||
                !!todayRecord?.clock_out /*||
                !isWithinClockOutWindow()*/
              }
              className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {useFaceRecognition ? (
                <Camera className="h-4 w-4 mr-2" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Clock Out
            </button>
          </div>
        )}

        {settings && (
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-gray-500">
            <div>
              <p className="font-medium">Clock In Window:</p>
              <p>
                {settings.clock_in_start} - {settings.clock_in_end}
              </p>
            </div>
            <div>
              <p className="font-medium">Clock Out Window:</p>
              <p>
                {settings.clock_out_start} - {settings.clock_out_end}
              </p>
            </div>
          </div>
        )}

        {todayRecord && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Clock In</p>
              <p className="mt-1 text-lg text-gray-900">
                {todayRecord.clock_in
                  ? new Date(todayRecord.clock_in).toLocaleTimeString()
                  : 'Not clocked in'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Clock Out</p>
              <p className="mt-1 text-lg text-gray-900">
                {todayRecord.clock_out
                  ? new Date(todayRecord.clock_out).toLocaleTimeString()
                  : 'Not clocked out'}
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Face Recognition Modal */}
      {selectedEmployee && (
        <FaceRecognitionModal
          isOpen={isFaceRecognitionModalOpen}
          onClose={() => setIsFaceRecognitionModalOpen(false)}
          employeeId={selectedEmployee.id}
          mode={faceRecognitionMode}
          onSuccess={handleFaceRecognitionSuccess}
        />
      )}
    </div>
  );
}