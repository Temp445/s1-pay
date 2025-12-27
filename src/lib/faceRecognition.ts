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
  // Load models (ensure paths are correct for your public folder)
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
}

/* ---------------- ENROLL FACE ---------------- */
export async function enrollFace(employeeId: string, video: HTMLVideoElement) {
  await initFaceRecognition();
  const descriptors: Float32Array[] = [];

  for (let i = 0; i < ENROLLMENT_CAPTURES; i++) {
    await new Promise((r) => setTimeout(r, 200)); // Reduced delay slightly
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detection) descriptors.push(detection.descriptor);
  }

  if (descriptors.length < MIN_CAPTURES) {
    throw new Error('Not enough clear face captures. Please hold still.');
  }

  const averaged = averageDescriptors(descriptors);
  const tenantId = await getTenantId();

  // Upsert Logic
  const { data: existing } = await supabase
    .from('employee_face_data')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  const payload = {
    face_descriptor: JSON.stringify(Array.from(averaged)),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase
      .from('employee_face_data')
      .update(payload)
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId);
  } else {
    await supabase.from('employee_face_data').insert([
      {
        ...payload,
        tenant_id: tenantId,
        employee_id: employeeId,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  // Update local memory
  faceDescriptors = faceDescriptors.filter((fd) => fd.employeeId !== employeeId);
  faceDescriptors.push({ employeeId, descriptor: averaged });

  return true;
}

/* =====================================================
   🔐 OPTIMIZED ANTI-SPOOFING (LIVENESS CHECKS)
   ===================================================== */

async function checkLiveness(video: HTMLVideoElement): Promise<{ alive: boolean; reason?: string }> {
    let blinkDetected = false;
    let headRotationDetected = false;
    
    let lastEAR = -1;
    let yawVariances: number[] = [];

    // OPTIMIZATION: Reduced iterations and delay. 
    // Faster check: 8 checks * 60ms = ~480ms (vs previous ~2000ms)
    const iterations = 8; 
    
    for (let i = 0; i < iterations; i++) {
        const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })) // Smaller input size for speed
            .withFaceLandmarks();

        if (!detection) {
            await new Promise((r) => setTimeout(r, 50));
            continue;
        }

        const landmarks = detection.landmarks;

        // --- 1. BLINK DETECTION ---
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const ear = (getEAR(leftEye) + getEAR(rightEye)) / 2;

        // Thresholds slightly adjusted for sensitivity
        if (lastEAR > 0.25 && ear < 0.20) {
            blinkDetected = true;
        }
        lastEAR = ear;

        // --- 2. 3D ROTATION (YAW) DETECTION ---
        const nose = landmarks.getNose()[3];
        const leftEyeOuter = landmarks.getLeftEye()[0];
        const rightEyeOuter = landmarks.getRightEye()[3];

        const distL = Math.abs(nose.x - leftEyeOuter.x);
        const distR = Math.abs(rightEyeOuter.x - nose.x);
        
        if (distR > 0) {
            const yawRatio = distL / distR;
            yawVariances.push(yawRatio);
        }

        // FAIL FAST: If we detected life signs early, return immediately
        if (blinkDetected) return { alive: true };
        
        if (yawVariances.length > 3) {
             const variance = calculateVariance(yawVariances);
             // Lowered threshold slightly for faster acceptance
             if (variance > 0.008) { 
                 headRotationDetected = true;
                 return { alive: true }; 
             }
        }

        // Reduced delay
        await new Promise((r) => setTimeout(r, 60));
    }

    return { alive: false, reason: 'SPOOF_DETECTED_LIVENESS' };
}

/* ---- HELPER: EYE ASPECT RATIO ---- */
function getEAR(eye: faceapi.Point[]) {
  const dist = (a: faceapi.Point, b: faceapi.Point) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  return (dist(eye[1], eye[5]) + dist(eye[2], eye[4])) / (2.0 * dist(eye[0], eye[3]));
}

/* ---- HELPER: VARIANCE CALCULATION ---- */
function calculateVariance(array: number[]) {
    const mean = array.reduce((a, b) => a + b, 0) / array.length;
    return array.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / array.length;
}

/* ---- SINGLE FACE CHECK ---- */
async function ensureSingleFace(video: HTMLVideoElement) {
  const detections = await faceapi.detectAllFaces(
    video,
    new faceapi.TinyFaceDetectorOptions()
  );

  if (detections.length === 0) return { ok: false, reason: 'NO_FACE_DETECTED' };
  if (detections.length > 1) return { ok: false, reason: 'MULTIPLE_FACES_DETECTED' };
  return { ok: true };
}

/* ---- SCREEN / PHOTO SPOOF DETECTION (TEXTURE) ---- */
async function detectSpoofSurface(video: HTMLVideoElement): Promise<boolean> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth / 2; // Reduce resolution for speed
  canvas.height = video.videoHeight / 2;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const frame1 = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  // Reduced delay from 150ms to 50ms
  await new Promise((r) => setTimeout(r, 50));

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const frame2 = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let diff = 0;
  // Optimize: Check every 4th pixel instead of 2nd
  for (let i = 0; i < frame1.length; i += 16) { 
    const g1 = (frame1[i] + frame1[i + 1] + frame1[i + 2]) / 3;
    const g2 = (frame2[i] + frame2[i + 1] + frame2[i + 2]) / 3;
    diff += Math.abs(g1 - g2);
  }

  const avgDiff = diff / (frame1.length / 16);

  // If extremely static, it's a photo
  if (avgDiff < 0.6) {
    return true; 
  }

  return false;
}

/* ---------------- IDENTIFY FACE (Unchanged Logic, just timing optimized) ---------------- */
export async function identifyFace(video: HTMLVideoElement) {
  await initFaceRecognition();

  // 1. Basic Checks
  const single = await ensureSingleFace(video);
  if (!single.ok) {
    return { matched: false, employeeId: null, reason: single.reason, confidence: 0 };
  }

  // 2. Texture/Surface Check (Optimized)
  if (await detectSpoofSurface(video)) {
    return { matched: false, employeeId: null, reason: 'SPOOF_DETECTED_SURFACE', confidence: 0 };
  }

  // 3. Active Liveness (Optimized)
  const liveness = await checkLiveness(video);
  if (!liveness.alive) {
     return { matched: false, employeeId: null, reason: 'SPOOF_DETECTED_LIVENESS', confidence: 0 };
  }

  // 4. Identification Logic
  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    return { matched: false, employeeId: null, reason: 'NO_FACE_DETECTED', confidence: 0 };
  }

  let bestMatch: { employeeId: string; distance: number } | null = null;

  for (const fd of faceDescriptors) {
    const distance = faceapi.euclideanDistance(detection.descriptor, fd.descriptor);

    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = { employeeId: fd.employeeId, distance };
    }
  }

  if (!bestMatch || bestMatch.distance > MATCH_THRESHOLD) {
    return { matched: false, employeeId: null, reason: 'UNVERIFIED_FACE', confidence: 0 };
  }

  return {
    matched: true,
    employeeId: bestMatch.employeeId,
    distance: bestMatch.distance,
    confidence: Math.max(0, (1 - bestMatch.distance) * 100),
    reason: 'VERIFIED',
  };
}

// ... verifyFace, deleteFaceData, hasEnrolledFace, averageDescriptors remain unchanged ...
// Included verifyFace just to prevent import errors if used elsewhere, using same optimized logic
export async function verifyFace(video: HTMLVideoElement, employeeId: string) {
    await initFaceRecognition();
    const single = await ensureSingleFace(video);
    if (!single.ok) return { verified: false, reason: single.reason };
  
    if (await detectSpoofSurface(video)) return { verified: false, reason: 'SPOOF_DETECTED_SURFACE' };
  
    const liveness = await checkLiveness(video);
    if (!liveness.alive) return { verified: false, reason: liveness.reason || 'SPOOF_DETECTED_LIVENESS' };
  
    const stored = faceDescriptors.find((fd) => fd.employeeId === employeeId);
    if (!stored) return { verified: false, reason: 'NOT_ENROLLED' };
  
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
  
    if (!detection) return { verified: false, reason: 'NO_FACE_DETECTED' };
  
    const distance = faceapi.euclideanDistance(detection.descriptor, stored.descriptor);
    const verified = distance < MATCH_THRESHOLD;
  
    return {
      verified,
      employeeId: verified ? employeeId : undefined,
      distance,
      confidence: Math.max(0, (1 - distance) * 100),
    };
  }

function averageDescriptors(descriptors: Float32Array[]): Float32Array {
    const avg = new Float32Array(128);
    for (let i = 0; i < 128; i++) {
      avg[i] = descriptors.reduce((sum, d) => sum + d[i], 0) / descriptors.length;
    }
    return avg;
  }

  /* ---------------- DELETE FACE ---------------- */
export async function deleteFaceData(employeeId: string) {
  const tenantId = await getTenantId();
  await supabase
    .from('employee_face_data')
    .delete()
    .eq('employee_id', employeeId)
    .eq('tenant_id', tenantId);

  faceDescriptors = faceDescriptors.filter((fd) => fd.employeeId !== employeeId);
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

