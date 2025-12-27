import { useEffect, useRef, useState } from 'react';
import { useAttendanceStore } from '../../../stores/attendanceStore';
import { identifyFace, initFaceRecognition } from '../../../lib/faceRecognition';
import { supabase } from '../../../lib/supabase';
import { Camera, AlertTriangle, UserCheck, ShieldAlert } from 'lucide-react'; // Import icons
import { handleUnverifiedVisitor } from '../../../lib/visitorFaceCapture';
import { syncAttendanceLog } from '../../../lib/attendanceUtils';

type Status =
  | 'NO_FACE'
  | 'DETECTING'
  | 'NO_MATCH'
  | 'VERIFIED'
  | 'CAPTURED_SUCCESSFULLY'
  | 'SPOOF_ALERT'; // New Status

type TimingStatus = 'OK' | 'OUTSIDE_SHIFT' | 'NO_SHIFT_ASSIGNED';

const FACE_LOST_THRESHOLD = 15;

export default function FaceAttendancePage() {
  const { fetchAttendanceRecords } = useAttendanceStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const lockedEmployeeRef = useRef<string | null>(null);
  const faceLostCounterRef = useRef(0);

  const unverifiedFacePresentRef = useRef(false);
  const lastUnverifiedDescriptorRef = useRef<number[] | null>(null);

  const [status, setStatus] = useState<Status>('NO_FACE');
  
  // ✅ NEW: Alert message state for feedback
  const [alertMessage, setAlertMessage] = useState<string>(''); 
  
  const [verifiedEmployee, setVerifiedEmployee] =
    useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initFaceRecognition().catch(console.error);
    startCamera();
  }, []);

  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      recognizeLoop();
    } catch (e) {
      console.error("Camera failed", e);
    }
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
          unverifiedFacePresentRef.current = false;
          lastUnverifiedDescriptorRef.current = null;
          setVerifiedEmployee(null);
          setStatus('NO_FACE');
          setAlertMessage(''); // Clear alerts
        }
        requestAnimationFrame(recognizeLoop);
        return;
      }

      faceLostCounterRef.current = 0;

      /* -------- HANDLING SPOOF / LIVENESS ALERTS -------- */
      if (result.reason === 'SPOOF_DETECTED_LIVENESS') {
         setStatus('SPOOF_ALERT');
         setAlertMessage('Please blink or turn your head slightly');
         requestAnimationFrame(recognizeLoop);
         return;
      }
      
      if (result.reason === 'SPOOF_DETECTED_SURFACE') {
         setStatus('SPOOF_ALERT');
         setAlertMessage('No photos or screens allowed. Real face only.');
         requestAnimationFrame(recognizeLoop);
         return;
      }
      
      if (result.reason === 'MULTIPLE_FACES_DETECTED') {
         setStatus('SPOOF_ALERT');
         setAlertMessage('Only one person allowed in frame.');
         requestAnimationFrame(recognizeLoop);
         return;
      }

      /* -------- UNVERIFIED / VISITOR FACE -------- */
      if (result.reason === 'UNVERIFIED_FACE') {
        try {
          // If we were showing an alert, clear it as we are processing
          setAlertMessage(''); 
          const res = await handleUnverifiedVisitor({
            video: videoRef.current!,
            lastDescriptorRef: lastUnverifiedDescriptorRef,
            facePresentRef: unverifiedFacePresentRef,
          });

          if (res.success) {
            setStatus('CAPTURED_SUCCESSFULLY');
          } else {
             setStatus('NO_MATCH'); // Or keep detecting
          }
        } catch (err) {
          console.error('Visitor capture failed:', err);
        }
        requestAnimationFrame(recognizeLoop);
        return;
      }

      /* -------- VERIFIED FACE -------- */
      if (result.matched && result.employeeId) {
        if (lockedEmployeeRef.current) {
          requestAnimationFrame(recognizeLoop);
          return;
        }

        lockedEmployeeRef.current = result.employeeId;
        setStatus('DETECTING');
        setAlertMessage(''); // Clear any previous alerts

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
      requestAnimationFrame(recognizeLoop);
    }
    
    // Continue loop if not returned above
    requestAnimationFrame(recognizeLoop);
  };

  /* ---------------- LOGIC (Helpers) ---------------- */
  // ... isOutsideShift, getLastEntry, storeAttendanceTimestamp remain unchanged ...

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

  const getLastEntry = async (employeeId: string, shiftId: string | null) => {
    let query = supabase.from('attendance_timestamp').select('entry').eq('employee_id', employeeId).order('timestamp', { ascending: false }).limit(1);
    if (shiftId === null) query = query.is('shift_id', null);
    else query = query.eq('shift_id', shiftId);
    const { data } = await query.maybeSingle();
    return data?.entry ?? null;
  };

  const storeAttendanceTimestamp = async (employeeId: string, shiftId: string | null, entry: 'IN' | 'OUT', timingStatus: TimingStatus) => {
    await supabase.from('attendance_timestamp').insert({ employee_id: employeeId, shift_id: shiftId, entry, timing_status: timingStatus });
  };

  const handleSuccess = async (employee: { id: string; name: string }) => {
    if (loading) return;
    setVerifiedEmployee(employee);
    setLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      await fetchAttendanceRecords(employee.id, today, today);
      const { data: shifts } = await supabase.from('shift_assignments').select(`shift_id, shifts(start_time, end_time)`).eq('employee_id', employee.id).eq('schedule_date', today);
      let shiftId: string | null = null;
      let timingStatus: TimingStatus = 'NO_SHIFT_ASSIGNED';

      if (shifts?.length) {
        const currentShift = shifts.find((s) => !isOutsideShift(s.shifts.start_time, s.shifts.end_time, now));
        if (currentShift) { shiftId = currentShift.shift_id; timingStatus = 'OK'; }
        else { shiftId = shifts[0].shift_id; timingStatus = 'OUTSIDE_SHIFT'; }
      }

      const lastEntry = await getLastEntry(employee.id, shiftId);
      const nextEntry = lastEntry === 'IN' ? 'OUT' : 'IN';
      await storeAttendanceTimestamp(employee.id, shiftId, nextEntry, timingStatus);
      await syncAttendanceLog(employee.id);
      setStatus('VERIFIED');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */

  // Helper to determine border color
  const getBorderColor = () => {
      switch(status) {
          case 'VERIFIED': return 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]';
          case 'DETECTING': return 'border-blue-500 animate-pulse';
          case 'CAPTURED_SUCCESSFULLY': return 'border-yellow-400';
          case 'SPOOF_ALERT': return 'border-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)]';
          default: return 'border-gray-300';
      }
  }

  return (
    <div className="flex flex-col items-center justify-center mt-16">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
        <h2 className="text-center text-2xl font-bold mb-6">Face Attendance</h2>

        <div className="flex justify-center mb-6">
          <div className={`relative w-72 h-72 rounded-full overflow-hidden border-4 transition-all duration-300 ${getBorderColor()}`}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
            />

            {/* Overlay for Alert Messages inside the circle */}
            {status === 'SPOOF_ALERT' && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white p-4 text-center backdrop-blur-sm">
                   <AlertTriangle className="w-10 h-10 mb-2 text-red-400" />
                   <p className="font-bold text-sm">{alertMessage}</p>
               </div>
            )}

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
            <p className="text-gray-600 text-sm">Please look into the camera</p>
          )}

          {status === 'DETECTING' && (
            <p className="text-blue-600 font-medium animate-pulse">Detecting face...</p>
          )}
          
          {status === 'SPOOF_ALERT' && (
             <div className="text-red-600 font-semibold flex items-center justify-center gap-2">
                 <ShieldAlert className="w-5 h-5"/>
                 <span>{alertMessage}</span>
             </div>
          )}

          {status === 'CAPTURED_SUCCESSFULLY' && (
            <p className="text-yellow-600 font-medium">Visitor captured successfully</p>
          )}

          {status === 'VERIFIED' && verifiedEmployee && (
            <div className="bg-green-50 p-4 rounded-xl border border-green-200 flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-full">
                  <UserCheck className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-left">
                  <p className="font-semibold text-green-700 text-lg">{verifiedEmployee.name}</p>
                  <p className="text-xs text-green-600">{new Date().toLocaleTimeString()}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}