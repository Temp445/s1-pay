import * as faceapi from 'face-api.js';
import { supabase } from './supabase';
import { getTenantId } from './tenantDb';

let modelsLoaded = false;
let faceDescriptors: { employeeId: string; descriptor: Float32Array }[] = [];

const ENROLLMENT_CAPTURES = 5;
const MIN_CAPTURES = 3;
const MATCH_THRESHOLD = 0.45;

/* ---------------- LOAD MODELS ---------------- */
export async function initFaceRecognition() {
  if (modelsLoaded) return;

  await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
  await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
  await faceapi.nets.faceRecognitionNet.loadFromUri('/models');

  await loadFaceDescriptors();
  modelsLoaded = true;
}

/* ---------------- LOAD DESCRIPTORS ---------------- */
async function loadFaceDescriptors() {
  const tenantId = await getTenantId();

  const { data, error } = await supabase
    .from('employee_face_data')
    .select('employee_id, face_descriptor')
    .eq('tenant_id', tenantId);

  if (error) throw error;

  faceDescriptors = data
    .map((item) => {
      try {
        const parsed = JSON.parse(item.face_descriptor);
        if (!Array.isArray(parsed) || parsed.length !== 128) return null;

        return {
          employeeId: item.employee_id,
          descriptor: new Float32Array(parsed),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as { employeeId: string; descriptor: Float32Array }[];

  console.log(`Loaded ${faceDescriptors.length} enrolled faces`);
}

/* ---------------- ENROLL FACE ---------------- */
export async function enrollFace(employeeId: string, video: HTMLVideoElement) {
  await initFaceRecognition();

  const descriptors: Float32Array[] = [];

  for (let i = 0; i < ENROLLMENT_CAPTURES; i++) {
    await new Promise((r) => setTimeout(r, 400));

    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detection) descriptors.push(detection.descriptor);
  }

  if (descriptors.length < MIN_CAPTURES) {
    throw new Error('Not enough clear face captures');
  }

  const averaged = averageDescriptors(descriptors);
  const tenantId = await getTenantId();

  const { data: existing } = await supabase
    .from('employee_face_data')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('employee_face_data')
      .update({
        face_descriptor: JSON.stringify(Array.from(averaged)),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId);
  } else {
    await supabase.from('employee_face_data').insert([
      {
        tenant_id: tenantId,
        employee_id: employeeId,
        face_descriptor: JSON.stringify(Array.from(averaged)),
        created_at: new Date().toISOString(),
      },
    ]);
  }

  faceDescriptors = faceDescriptors.filter(
    (fd) => fd.employeeId !== employeeId
  );
  faceDescriptors.push({ employeeId, descriptor: averaged });

  return true;
}

/* =====================================================
   🔐 LIVENESS DETECTION (ANTI PHOTO / MOBILE SPOOF)
   ===================================================== */

/* ---- Eye Aspect Ratio ---- */
function eyeAspectRatio(eye: faceapi.Point[]) {
  const dist = (a: faceapi.Point, b: faceapi.Point) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const A = dist(eye[1], eye[5]);
  const B = dist(eye[2], eye[4]);
  const C = dist(eye[0], eye[3]);

  return (A + B) / (2.0 * C);
}

/* ---- Blink Detection ---- */
async function detectBlink(video: HTMLVideoElement): Promise<boolean> {
  let lastEAR = null;
  let blinkDetected = false;

  for (let i = 0; i < 8; i++) {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();

    if (!detection) continue;

    const leftEye = detection.landmarks.getLeftEye();
    const rightEye = detection.landmarks.getRightEye();

    const ear =
      (eyeAspectRatio(leftEye) + eyeAspectRatio(rightEye)) / 2;

    if (lastEAR !== null && lastEAR > 0.25 && ear < 0.18) {
      blinkDetected = true;
      break;
    }

    lastEAR = ear;
    await new Promise((r) => setTimeout(r, 150));
  }

  return blinkDetected;
}

/* ---- Head Movement Detection ---- */
async function detectHeadMovement(video: HTMLVideoElement): Promise<boolean> {
  let lastX = null;
  let movement = 0;

  for (let i = 0; i < 6; i++) {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();

    if (!detection) continue;

    const nose = detection.landmarks.getNose()[3];

    if (lastX !== null) {
      movement += Math.abs(nose.x - lastX);
    }

    lastX = nose.x;
    await new Promise((r) => setTimeout(r, 200));
  }

  return movement > 15;
}

/* ---------------- VERIFY FACE ---------------- */
export async function verifyFace(
  video: HTMLVideoElement,
  employeeId: string
) {
  await initFaceRecognition();

  /* 🔒 LIVENESS CHECK */
  const blinkOk = await detectBlink(video);
  const moveOk = await detectHeadMovement(video);

  if (!blinkOk || !moveOk) {
    return {
      verified: false,
      reason: 'SPOOF_DETECTED',
    };
  }

  /* ⬇ EXISTING LOGIC (UNCHANGED) */
  const stored = faceDescriptors.find(
    (fd) => fd.employeeId === employeeId
  );

  if (!stored) {
    return { verified: false, reason: 'NOT_ENROLLED' };
  }

  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    return { verified: false, reason: 'NO_FACE_DETECTED' };
  }

  const distance = faceapi.euclideanDistance(
    detection.descriptor,
    stored.descriptor
  );

  const verified = distance < MATCH_THRESHOLD;

  return {
    verified,
    employeeId: verified ? employeeId : undefined,
    distance,
    confidence: Math.max(0, (1 - distance) * 100),
  };
}

/* ---------------- IDENTIFY FACE (1:N) ---------------- */
export async function identifyFace(video: HTMLVideoElement) {
  await initFaceRecognition();

  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    return {
      matched: false,
      employeeId: null,
      reason: 'NO_FACE_DETECTED',
      confidence: 0,
    };
  }

  let bestMatch: { employeeId: string; distance: number } | null = null;

  for (const fd of faceDescriptors) {
    const distance = faceapi.euclideanDistance(
      detection.descriptor,
      fd.descriptor
    );

    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = { employeeId: fd.employeeId, distance };
    }
  }

  if (!bestMatch || bestMatch.distance > MATCH_THRESHOLD) {
    return {
      matched: false,
      employeeId: null,
      reason: 'UNVERIFIED_FACE',
      confidence: 0,
    };
  }

  return {
    matched: true,
    employeeId: bestMatch.employeeId,
    distance: bestMatch.distance,
    confidence: Math.max(0, (1 - bestMatch.distance) * 100),
    reason: 'VERIFIED',
  };
}

/* ---------------- DELETE FACE ---------------- */
export async function deleteFaceData(employeeId: string) {
  const tenantId = await getTenantId();

  await supabase
    .from('employee_face_data')
    .delete()
    .eq('employee_id', employeeId)
    .eq('tenant_id', tenantId);

  faceDescriptors = faceDescriptors.filter(
    (fd) => fd.employeeId !== employeeId
  );

  return true;
}

/* ---------------- CHECK ENROLLMENT ---------------- */
export async function hasEnrolledFace(employeeId: string) {
  const tenantId = await getTenantId();

  const { data } = await supabase
    .from('employee_face_data')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('tenant_id', tenantId)
    .limit(1);

  return Array.isArray(data) && data.length > 0;
}

/* ---------------- AVERAGE DESCRIPTORS ---------------- */
function averageDescriptors(descriptors: Float32Array[]): Float32Array {
  const avg = new Float32Array(128);
  for (let i = 0; i < 128; i++) {
    avg[i] =
      descriptors.reduce((sum, d) => sum + d[i], 0) /
      descriptors.length;
  }
  return avg;
}
