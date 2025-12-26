import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Check, AlertCircle, RefreshCw, User } from 'lucide-react';
import { initFaceRecognition, enrollFace, verifyFace, hasEnrolledFace } from '../../../lib/faceRecognition';

interface FaceRecognitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  mode: 'enroll' | 'verify';
  onSuccess: (employeeId?: string) => void;
}

export default function FaceRecognitionModal({
  isOpen,
  onClose,
  employeeId,
  mode,
  onSuccess
}: FaceRecognitionModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [processingFace, setProcessingFace] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
    confidence?: number;
  } | null>(null);
  const [hasEnrolled, setHasEnrolled] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setVerificationResult(null);
      setProcessingFace(false);
    } else {
      stopCamera(); // Stop camera when modal closes
    }
  }, [isOpen, employeeId]);

  // Initialize face recognition and check enrollment
  useEffect(() => {
    if (!isOpen) return;

    const initialize = async () => {
      try {
        setLoading(true);
        setError(null);
        await initFaceRecognition();

        if (employeeId) {
          const enrolled = await hasEnrolledFace(employeeId);
          setHasEnrolled(enrolled);

          if (mode === 'verify' && !enrolled) {
            setError('No face data found for this employee. Please enroll first.');
          }
        }

        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize face recognition';
        setError(errorMessage);
        console.error('Face recognition init error:', err);
        setLoading(false);
      }
    };

    initialize();
  }, [isOpen, employeeId, mode]);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen && !loading && !cameraActive) {
      startCamera();
    }
  }, [isOpen, loading]);

  const startCamera = async () => {
    try {
      setCameraActive(false);
      setCameraPermissionDenied(false);
      setError(null);
      setVerificationResult(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraPermissionDenied(true);
      setError('Camera access denied. Please allow camera access and try again.');
    }
  };

  const stopCamera = () => {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach(track => {
      track.stop();
    });
    streamRef.current = null;
  }
  if (videoRef.current) {
    videoRef.current.srcObject = null;
  }
  setCameraActive(false);
};


  const handleEnrollFace = async () => {
    if (!videoRef.current || !cameraActive) return;

    try {
      setProcessingFace(true);
      setError(null);

      const success = await enrollFace(employeeId, videoRef.current);

      if (success) {
        setVerificationResult({
          success: true,
          message: 'Face enrolled successfully!'
        });
        setHasEnrolled(true);

        stopCamera(); // Stop camera after success
        setTimeout(() => onSuccess(employeeId), 1500);
      } else {
        setError('Failed to enroll face. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll face');
    } finally {
      setProcessingFace(false);
    }
  };

  const handleVerifyFace = async () => {
    if (!videoRef.current || !cameraActive) return;

    try {
      setProcessingFace(true);
      setError(null);

      const result = await verifyFace(videoRef.current, employeeId);

      if (result.verified && result.employeeId) {
        setVerificationResult({
          success: true,
          message: 'Face verified successfully!',
          confidence: result.confidence
        });

        stopCamera(); // Stop camera after success
        setTimeout(() => onSuccess(result.employeeId), 1500);
      } else {
        setVerificationResult({
          success: false,
          message: result.reason === 'NOT_ENROLLED' 
            ? 'Employee has not enrolled a face yet.' 
            : 'Face verification failed. Please try again.'
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify face');
    } finally {
      setProcessingFace(false);
    }
  };

  if (!isOpen) return null;


  const handleClose = () => {
  stopCamera(); // Stop the camera immediately
  setVerificationResult(null); 
  setProcessingFace(false);   // Reset processing state
  onClose();                  // Close modal
};


  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              type="button"
              className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={handleClose}
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {mode === 'enroll' ? 'Enroll Face' : 'Verify Face'}
              </h3>

              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  {mode === 'enroll'
                    ? 'Position your face in the center of the frame and follow the instructions.'
                    : 'Look directly at the camera for face verification.'}
                </p>
              </div>

              {loading ? (
                <div className="mt-6 flex justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
              ) : error ? (
                <div className="mt-4 rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">{error}</h3>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <div className="relative">
                    <div className="w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        autoPlay
                        playsInline
                        muted
                      />

                      {/* Face guide */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-64 h-64 border-2 border-dashed border-indigo-500 rounded-full opacity-50"></div>
                      </div>

                      {/* Processing overlay */}
                      {processingFace && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                          <p className="mt-4 text-white font-medium">
                            {mode === 'enroll' ? 'Enrolling face...' : 'Verifying face...'}
                          </p>
                        </div>
                      )}

                      {/* Success/failure overlay */}
                      {verificationResult && (
                        <div className={`absolute inset-0 ${verificationResult.success ? 'bg-green-500' : 'bg-red-500'} bg-opacity-75 flex flex-col items-center justify-center`}>
                          {verificationResult.success ? (
                            <Check className="h-16 w-16 text-white" />
                          ) : (
                            <X className="h-16 w-16 text-white" />
                          )}
                          <p className="mt-4 text-white font-medium text-lg">
                            {verificationResult.message}
                          </p>
                          {verificationResult.confidence && (
                            <p className="text-white text-sm">
                              Confidence: {verificationResult.confidence?.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Camera refresh */}
                    <div className="absolute bottom-4 right-4">
                      <button
                        type="button"
                        className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        onClick={startCamera}
                        disabled={processingFace}
                      >
                        <RefreshCw className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="mt-5 sm:mt-6 flex justify-center">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                      onClick={mode === 'enroll' ? handleEnrollFace : handleVerifyFace}
                      disabled={!cameraActive || processingFace || (!!verificationResult && verificationResult.success)}
                    >
                      {mode === 'enroll' ? (
                        <>
                          <User className="h-4 w-4 mr-2" />
                          {hasEnrolled ? 'Update Face Data' : 'Enroll Face'}
                        </>
                      ) : (
                        <>
                          <Camera className="h-4 w-4 mr-2" />
                          Verify Face
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
