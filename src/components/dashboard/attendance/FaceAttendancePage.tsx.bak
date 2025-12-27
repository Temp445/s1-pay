import { useEffect, useRef, useState } from 'react';
import { useAttendanceStore } from '../../../stores/attendanceStore';
import { identifyFace, initFaceRecognition } from '../../../lib/faceRecognition';
import { supabase } from '../../../lib/supabase';
import { Camera } from 'lucide-react';
import { handleUnverifiedVisitor } from '../../../lib/visitorFaceCapture';
import { syncAttendanceLog } from '../../../lib/attendanceUtils';


type Status =
  | 'NO_FACE'
  | 'DETECTING'
  | 'NO_MATCH'
  | 'VERIFIED'
  | 'CAPTURED_SUCCESSFULLY';

type TimingStatus = 'OK' | 'OUTSIDE_SHIFT' | 'NO_SHIFT_ASSIGNED';

const FACE_LOST_THRESHOLD = 15;

/* ---------------- COMPONENT ---------------- */

export default function FaceAttendancePage() {
  const { fetchAttendanceRecords } = useAttendanceStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const lockedEmployeeRef = useRef<string | null>(null);
  const faceLostCounterRef = useRef(0);

  // ✅ NEW (presence-based tracking)
  const unverifiedFacePresentRef = useRef(false);
  const lastUnverifiedDescriptorRef = useRef<number[] | null>(null);

  const [status, setStatus] = useState<Status>('NO_FACE');
  const [verifiedEmployee, setVerifiedEmployee] =
    useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initFaceRecognition().catch(console.error);
    startCamera();
  }, []);

  const startCamera = async () => {
    if (!videoRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    recognizeLoop();
  };

  /* ---------------- FACE LOOP ---------------- */

  const recognizeLoop = async () => {
    if (!videoRef.current) return;

    try {
      const result = await identifyFace(videoRef.current);

      /* -------- NO FACE -------- */
      if (result.reason === 'NO_FACE_DETECTED') {
        faceLostCounterRef.current++;

        if (faceLostCounterRef.current > FACE_LOST_THRESHOLD) {
          lockedEmployeeRef.current = null;

          // ✅ Reset unverified presence ONLY when face is gone
          unverifiedFacePresentRef.current = false;
          lastUnverifiedDescriptorRef.current = null;

          setVerifiedEmployee(null);
          setStatus('NO_FACE');
        }

        requestAnimationFrame(recognizeLoop);
        return;
      }

      faceLostCounterRef.current = 0;

      /* -------- UNVERIFIED / VISITOR FACE -------- */
if (result.reason === 'UNVERIFIED_FACE') {
  try {
    const res = await handleUnverifiedVisitor({
      video: videoRef.current!,
      lastDescriptorRef: lastUnverifiedDescriptorRef,
      facePresentRef: unverifiedFacePresentRef,
    });

    if (res.success) {
      setStatus('CAPTURED_SUCCESSFULLY');
    }
  } catch (err) {
    console.error('Visitor capture failed:', err);
  }

  requestAnimationFrame(recognizeLoop);
  return;
}




      /* -------- VERIFIED FACE (UNCHANGED) -------- */
      if (result.matched && result.employeeId) {
        if (lockedEmployeeRef.current) {
          requestAnimationFrame(recognizeLoop);
          return;
        }

        lockedEmployeeRef.current = result.employeeId;
        setStatus('DETECTING');

        const { data } = await supabase
          .from('employees')
          .select('name')
          .eq('id', result.employeeId)
          .maybeSingle();

        handleSuccess({
          id: result.employeeId,
          name: data?.name || 'Employee',
        });
      }
    } catch (err) {
      console.error(err);
    }

    requestAnimationFrame(recognizeLoop);
  };

  /* ---------------- VERIFIED FLOW (UNCHANGED) ---------------- */

  const isOutsideShift = (start: string, end: string, now: Date) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const s = new Date(now); s.setHours(sh, sm, 0, 0);
    const e = new Date(now); e.setHours(eh, em, 0, 0);

    if (e <= s) {
      e.setDate(e.getDate() + 1);
      if (now < s) s.setDate(s.getDate() - 1);
    }

    return now < s || now > e;
  };

  const getLastEntry = async (
  employeeId: string,
  shiftId: string | null
) => {
  let query = supabase
    .from('attendance_timestamp')
    .select('entry')
    .eq('employee_id', employeeId)
    .order('timestamp', { ascending: false })
    .limit(1);

  if (shiftId === null) {
    query = query.is('shift_id', null); // ✅ IMPORTANT
  } else {
    query = query.eq('shift_id', shiftId);
  }

  const { data } = await query.maybeSingle();
  return data?.entry ?? null;
};


  const storeAttendanceTimestamp = async (
    employeeId: string,
    shiftId: string | null  ,
    entry: 'IN' | 'OUT',
    timingStatus: TimingStatus
  ) => {
    await supabase.from('attendance_timestamp').insert({
      employee_id: employeeId,
      shift_id: shiftId,
      entry,
      timing_status: timingStatus,
    });
  };

const handleSuccess = async (employee: { id: string; name: string }) => {
  if (loading) return;
  setVerifiedEmployee(employee);
  setLoading(true);

  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    await fetchAttendanceRecords(employee.id, today, today);

    const { data: shifts } = await supabase
      .from('shift_assignments')
      .select(`shift_id, shifts(start_time, end_time)`)
      .eq('employee_id', employee.id)
      .eq('schedule_date', today);

    let shiftId: string | null = null;
    let timingStatus: TimingStatus = 'NO_SHIFT_ASSIGNED';

    if (shifts?.length) {
      const currentShift = shifts.find((s) =>
        !isOutsideShift(s.shifts.start_time, s.shifts.end_time, now)
      );

      if (currentShift) {
        shiftId = currentShift.shift_id;
        timingStatus = 'OK';
      } else {
        shiftId = shifts[0].shift_id;
        timingStatus = 'OUTSIDE_SHIFT';
      }
    }

    // ✅ WORKS FOR BOTH shiftId = null AND shiftId = uuid
    const lastEntry = await getLastEntry(employee.id, shiftId);
    const nextEntry = lastEntry === 'IN' ? 'OUT' : 'IN';

    await storeAttendanceTimestamp(
      employee.id,
      shiftId,              // null allowed
      nextEntry,
      timingStatus          
    );

      await syncAttendanceLog(employee.id);

    setStatus('VERIFIED');
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};

  /* ---------------- UI ---------------- */

  return (
  <div className="flex flex-col items-center justify-center mt-16">
    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
      <h2 className="text-center text-2xl font-bold mb-6">
        Face Attendance
      </h2>

      <div className="flex justify-center mb-6">
        <div
          className={`relative w-72 h-72 rounded-full overflow-hidden border-4 transition-all duration-300
            ${
              status === 'VERIFIED'
                ? 'border-green-500 '
                : status === 'DETECTING'
                ? 'border-blue-500 animate-pulse'
                : status === 'CAPTURED_SUCCESSFULLY'
                ? 'border-yellow-400'
                : 'border-gray-300'
            }`}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Overlay when no face */}
          {status === 'NO_FACE' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Camera className="w-14 h-14 text-gray-300 animate-pulse" />
            </div>
          )}
        </div>
      </div>

      <div className="text-center min-h-[110px] space-y-3">
        {status === 'NO_FACE' && (
          <p className="text-gray-600 text-sm">
            Please look into the camera
          </p>
        )}

        {status === 'DETECTING' && (
          <p className="text-blue-600 font-medium animate-pulse">
            Detecting face…
          </p>
        )}

        {status === 'CAPTURED_SUCCESSFULLY' && (
          <p className="text-yellow-600 font-medium">
            Visitor captured successfully
          </p>
        )}

        {status === 'VERIFIED' && verifiedEmployee && (
          <div className="bg-green-50 p-4 rounded-xl border border-green-200">
            <p className="font-semibold text-green-700 text-lg">
              {verifiedEmployee.name}
            </p>
            <p className="text-xs text-green-600">
              {new Date().toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </div>
  </div>
);

}
