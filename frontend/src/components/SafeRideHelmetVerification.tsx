"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Bike,
  HardHat,
  Camera,
  ShieldCheck,
  ShieldAlert,
  CircleAlert,
  Loader2,
  RefreshCw,
  X,
  MapPin,
  Play,
  CheckCircle2,
  Navigation,
} from "lucide-react";
import {
  Button,
  CameraPermissionDialog,
  HelmetVerificationStatus,
  SafeRideStatus,
} from "./ui";
import {
  HelmetDetectionStatus,
  HelmetVerificationResponse,
  ActiveSafeRideState,
} from "@/lib/types";
import { verifyHelmet, startSafeRide, stopSafeRide } from "@/lib/api";
import { watchLiveLocation, LivePosition } from "@/lib/location";

export interface SafeRideHelmetVerificationProps {
  isBn?: boolean;
  onEmergencySOS?: () => void;
  className?: string;
}

export const SafeRideHelmetVerification: React.FC<SafeRideHelmetVerificationProps> = ({
  isBn = false,
  onEmergencySOS,
  className = "",
}) => {
  // Safe Ride Workflow Phase: "LANDING" | "CAMERA_CHECK" | "VERIFIED" | "ACTIVE_RIDE"
  const [phase, setPhase] = useState<"LANDING" | "CAMERA_CHECK" | "VERIFIED" | "ACTIVE_RIDE">("LANDING");

  // Camera & Permission States
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Verification Data
  const [verificationStatus, setVerificationStatus] = useState<HelmetDetectionStatus | "DETECTING" | "IDLE">("IDLE");
  const [verificationResult, setVerificationResult] = useState<HelmetVerificationResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<Date | null>(null);
  const [remainingValiditySecs, setRemainingValiditySecs] = useState<number>(0);

  // Driving & Active Ride
  const [destinationText, setDestinationText] = useState("");
  const [activeRide, setActiveRide] = useState<ActiveSafeRideState | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Video and Stream refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const unwatchLocationRef = useRef<(() => void) | null>(null);
  const verificationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up camera stream
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Countdown timer for 120s verification token validity
  useEffect(() => {
    if (!tokenExpiresAt || phase !== "VERIFIED") return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((tokenExpiresAt.getTime() - Date.now()) / 1000));
      setRemainingValiditySecs(remaining);
      if (remaining <= 0) {
        // Token expired
        setVerificationStatus("UNCERTAIN");
        setVerificationResult(null);
        setPhase("LANDING");
        setErrorMessage(
          isBn
            ? "হেলমেট যাচাইয়ের মেয়াদ শেষ হয়েছে (১২০ সেকেন্ড)। অনুগ্রহ করে পুনরায় যাচাই করুন।"
            : "Helmet verification expired (120s window). Please re-verify before riding."
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [tokenExpiresAt, phase, isBn]);

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
      if (unwatchLocationRef.current) {
        unwatchLocationRef.current();
      }
      if (verificationTimerRef.current) {
        clearInterval(verificationTimerRef.current);
      }
    };
  }, [stopCameraStream]);

  // Initialize Camera
  const startCamera = async () => {
    setErrorMessage(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported on this device/browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
      setPhase("CAMERA_CHECK");
      setVerificationStatus("DETECTING");
      setShowPermissionDialog(false);

      // Trigger automatic frame capture after 1.2s to allow camera auto-exposure
      setTimeout(() => {
        captureAndVerifyFrame();
      }, 1200);
    } catch (err: unknown) {
      console.error("Camera access error:", err);
      const isDenied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      if (isDenied) {
        setPermissionDenied(true);
        setShowPermissionDialog(true);
      } else {
        setVerificationStatus("ERROR");
        setErrorMessage(
          isBn
            ? "ক্যামেরা চালু করা যায়নি। অনুগ্রহ করে ক্যামেরা সেটিংস পরীক্ষা করুন।"
            : "Could not open camera stream. Please check camera hardware and permissions."
        );
      }
    }
  };

  // User clicks "Start Ride" on Landing view
  const handleInitiateStartRide = async () => {
    setErrorMessage(null);
    setSuccessNotice(null);

    // Check if permission already available
    if (typeof navigator !== "undefined" && navigator.permissions && navigator.permissions.query) {
      try {
        const perm = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (perm.state === "granted") {
          startCamera();
          return;
        }
      } catch {
        // Fallback to permission dialog
      }
    }
    // Show permission dialog explaining why camera is required
    setShowPermissionDialog(true);
  };

  // Capture frame & analyze via backend
  const captureAndVerifyFrame = async () => {
    if (!videoRef.current || !streamRef.current) return;
    setIsAnalyzing(true);
    setVerificationStatus("DETECTING");
    setErrorMessage(null);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize 2D canvas context");

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Jpeg = canvas.toDataURL("image/jpeg", 0.85);

      const res = await verifyHelmet(base64Jpeg, currentCoords?.lat, currentCoords?.lng);
      setVerificationResult(res);
      setVerificationStatus(res.status);

      if (res.is_verified && res.verification_token) {
        // Successful verification!
        stopCameraStream();
        setPhase("VERIFIED");
        if (res.expires_at) {
          setTokenExpiresAt(new Date(res.expires_at));
        } else {
          setTokenExpiresAt(new Date(Date.now() + 120000));
        }
      } else {
        // Kept in camera check mode so user can adjust helmet and retry
        setErrorMessage(isBn ? res.message_bn : res.message_en);
      }
    } catch (err: unknown) {
      console.error("Helmet verification API error:", err);
      setVerificationStatus("ERROR");
      setErrorMessage(
        err instanceof Error ? err.message : "Verification service error. Please try again."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Cancel verification
  const handleCancelVerification = () => {
    stopCameraStream();
    setPhase("LANDING");
    setVerificationStatus("IDLE");
    setVerificationResult(null);
    setErrorMessage(null);
  };

  // Confirm Start Safe Ride (Only available after successful helmet verification)
  const handleConfirmStartRide = async () => {
    if (!verificationResult?.verification_token) {
      setErrorMessage("Valid helmet verification token required to start ride.");
      return;
    }

    try {
      const rideRes = await startSafeRide({
        verification_token: verificationResult.verification_token,
        destination_text: destinationText.trim() || undefined,
        start_latitude: currentCoords?.lat,
        start_longitude: currentCoords?.lng,
      });

      const activeState: ActiveSafeRideState = {
        ride_id: rideRes.ride_id,
        started_at: rideRes.started_at,
        destination_text: destinationText.trim() || undefined,
        start_latitude: rideRes.start_latitude,
        start_longitude: rideRes.start_longitude,
        current_latitude: currentCoords?.lat,
        current_longitude: currentCoords?.lng,
        speed_kmh: 0,
        helmet_verified: true,
        active: true,
      };

      setActiveRide(activeState);
      setPhase("ACTIVE_RIDE");
      setSuccessNotice(
        isBn
          ? "নিরাপদ রাইড সফলভাবে চালু হয়েছে। সাবধানে ড্রাইভ করুন!"
          : "Safe Ride started successfully. Drive safely and obey traffic rules!"
      );

      // Start live GPS tracking for this ride
      const unwatch = watchLiveLocation(
        (pos: LivePosition) => {
          setCurrentCoords({ lat: pos.latitude, lng: pos.longitude });
          setCurrentSpeedKmh(pos.speed || 0);
          setActiveRide((prev) =>
            prev
              ? {
                  ...prev,
                  current_latitude: pos.latitude,
                  current_longitude: pos.longitude,
                  speed_kmh: pos.speed ?? undefined,
                }
              : null
          );
        },
        (err) => {
          console.warn("Ride location watch warning:", err.message);
        },
        { enableHighAccuracy: true, timeoutMs: 10000, maximumAgeMs: 2000 }
      );
      unwatchLocationRef.current = unwatch;
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to start ride session.");
    }
  };

  // Stop active ride
  const handleStopRide = async () => {
    if (!activeRide) return;

    try {
      if (unwatchLocationRef.current) {
        unwatchLocationRef.current();
        unwatchLocationRef.current = null;
      }

      await stopSafeRide({
        ride_id: activeRide.ride_id,
        end_latitude: currentCoords?.lat,
        end_longitude: currentCoords?.lng,
      });

      setActiveRide(null);
      setPhase("LANDING");
      setVerificationStatus("IDLE");
      setVerificationResult(null);
      setTokenExpiresAt(null);
      setSuccessNotice(
        isBn
          ? "রাইড সফলভাবে সম্পন্ন হয়েছে। হেলমেট সুরক্ষা কমপ্লায়েন্স লগ করা হয়েছে।"
          : "Safe Ride completed successfully. Helmet safety compliance logged."
      );
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error stopping ride.");
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Permission Explanatory Dialog */}
      <CameraPermissionDialog
        isOpen={showPermissionDialog}
        onAllow={startCamera}
        onCancel={() => setShowPermissionDialog(false)}
        permissionDenied={permissionDenied}
        isBn={isBn}
      />

      {/* Alerts / Error Notices */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-4 flex items-start gap-3 text-xs text-red-800 dark:text-red-200"
        >
          <CircleAlert className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">{errorMessage}</div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {successNotice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-4 flex items-start gap-3 text-xs text-emerald-800 dark:text-emerald-200"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">{successNotice}</div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-500 hover:text-emerald-700"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* =========================================================================
          VIEW 1: LANDING & HELMET REQUIREMENT OVERVIEW
          ========================================================================= */}
      {phase === "LANDING" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          {/* Header Banner */}
          <div className="p-6 bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
                <Bike className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 text-[10px] font-bold tracking-wide uppercase">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {isBn ? "এআই হেলমেট সেফটি চেক" : "AI Helmet Safety Check"}
                </div>
                <h2 className="text-xl font-bold tracking-tight mt-1">
                  {isBn ? "নিরাপত্তা সেফ রাইড" : "Nirapotta Safe Ride"}
                </h2>
              </div>
            </div>
            <p className="text-xs text-slate-300 mt-3 leading-relaxed max-w-xl">
              {isBn
                ? "মোটরসাইকেল বা বাইক রাইড শুরুর পূর্বে এআই কম্পিউটার ভিশনের মাধ্যমে হেলমেট পরিধান নিশ্চিত করুন। হেলমেটহীন কোনো রাইড সক্রিয় করা হবে না।"
                : "Civic road safety compliance check: Computer vision verifies that the rider is wearing a helmet before a Safe Ride session can be initiated."}
            </p>
          </div>

          {/* Core Feature Cards */}
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                  <HardHat className="h-5 w-5" aria-hidden="true" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {isBn ? "১. হেলমেট ভেরিফিকেশন" : "1. Helmet Verification"}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isBn
                    ? "ক্যামেরার সামনে হেলমেট পরিহিত অবস্থায় ফ্রেম ক্যাপচার করুন।"
                    : "Position yourself in front of the camera with your helmet worn."}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {isBn ? "২. কম্পিউটার ভিশন যাচাই" : "2. CV Analysis"}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isBn
                    ? "ওপেনসিভি মডেল ক্র্যানিয়াল ডোম ও অবস্থান বিশ্লেষণ করে।"
                    : "OpenCV verifies the protective dome is situated on your head."}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                  <Navigation className="h-5 w-5" aria-hidden="true" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {isBn ? "৩. সুরক্ষিত রাইড ট্র্যাকিং" : "3. Safe Navigation"}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isBn
                    ? "যাচাই সফল হলেই কেবল রাইড ও জরুরি প্রটেকশন চালু হয়।"
                    : "Only verified riders may activate real-time safe tracking."}
                </p>
              </div>
            </div>

            {/* Destination Input (Optional) */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
              <label
                htmlFor="safe-ride-dest"
                className="block text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                {isBn ? "গন্তব্যস্থল (ঐচ্ছিক):" : "Destination (Optional):"}
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  id="safe-ride-dest"
                  type="text"
                  value={destinationText}
                  onChange={(e) => setDestinationText(e.target.value)}
                  placeholder={
                    isBn
                      ? "যেমন: ফার্মগেট, মিরপুর ১০, বিমানবন্দর সড়ক..."
                      : "e.g., Farmgate, Dhanmondi 27, Airport Road..."
                  }
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <HardHat className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
                <span>
                  {isBn
                    ? "রাইড শুরু করতে ক্যামেরা ভেরিফিকেশন সম্পন্ন করুন"
                    : "Camera verification required to unlock Safe Ride"}
                </span>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleInitiateStartRide}
                className="w-full sm:w-auto px-6 py-2.5 font-bold shadow-md"
              >
                <Camera className="h-4 w-4 mr-2" aria-hidden="true" />
                {isBn ? "রাইড শুরু করুন (হেলমেট চেক)" : "Start Ride (Helmet Check)"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: CAMERA HELMET VERIFICATION INTERFACE
          ========================================================================= */}
      {phase === "CAMERA_CHECK" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Camera className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {isBn ? "হেলমেট সুরক্ষা যাচাইকরণ" : "Helmet Safety Check"}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isBn
                    ? "অনুগ্রহ করে হেলমেট পরে ক্যামেরার ফ্রেমে সোজা তাকান"
                    : "Wear your helmet and position face & head clearly in the frame"}
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancelVerification}
              className="text-xs"
            >
              <X className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              {isBn ? "বাতিল করুন" : "Cancel"}
            </Button>
          </div>

          {/* Live Video Preview Box with Frame Overlay */}
          <div className="relative w-full max-w-lg mx-auto aspect-4/3 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 shadow-inner flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Subtle Minimal Cranial Frame Guide (Does not obstruct camera preview) */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              <div className="w-56 h-72 border-2 border-dashed border-white/60 rounded-3xl relative">
                {/* Upper Cranium / Helmet Guide Bracket */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-slate-900/80 text-[10px] font-semibold text-white/90 border border-white/30 backdrop-blur-xs flex items-center gap-1">
                  <HardHat className="h-3 w-3 text-amber-400" aria-hidden="true" />
                  <span>{isBn ? "হেলমেট পজিশন" : "Helmet Position"}</span>
                </div>
              </div>
            </div>

            {/* Analyzing Spinner Overlay */}
            {isAnalyzing && (
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center text-white space-y-2">
                <div className="flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-2" aria-hidden="true" />
                  <span className="text-xs font-semibold">
                    {isBn ? "কম্পিউটার ভিশন যাচাই চলছে..." : "Checking helmet compliance..."}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Verification Status Banner */}
          <HelmetVerificationStatus
            status={verificationStatus}
            isVerified={verificationResult?.is_verified || false}
            confidence={verificationResult?.confidence}
            message={isBn ? verificationResult?.message_bn : verificationResult?.message_en}
            isBn={isBn}
          />

          {/* Manual Retake / Re-check Controls */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={captureAndVerifyFrame}
              disabled={isAnalyzing}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isAnalyzing ? "animate-spin" : ""}`} aria-hidden="true" />
              {isBn ? "পুনরায় স্ক্যান করুন" : "Re-scan Frame"}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancelVerification}
              className="w-full sm:w-auto"
            >
              {isBn ? "যাচাই বন্ধ করুন" : "Stop Camera"}
            </Button>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: HELMET VERIFIED — EXPLICIT RIDE START CONFIRMATION
          ========================================================================= */}
      {phase === "VERIFIED" && verificationResult?.is_verified && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-slate-900 shadow-md p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {isBn ? "হেলমেট যাচাই সম্পন্ন হয়েছে" : "Helmet Successfully Verified"}
                </h3>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-semibold">
                  {remainingValiditySecs}s {isBn ? "বাকি" : "validity"}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {isBn
                  ? "আপনার সুরক্ষা হেলমেট সঠিকভাবে শনাক্ত করা হয়েছে। রাইড শুরু করতে নিচের বাটনে নিশ্চিত করুন।"
                  : "Your helmet is properly worn. Click Start Safe Ride to activate driving session tracking."}
              </p>
            </div>
          </div>

          {/* Destination reminder */}
          {destinationText && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
              <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
              <span className="font-medium">{isBn ? "নির্ধারিত গন্তব্য:" : "Destination:"}</span>
              <span className="truncate">{destinationText}</span>
            </div>
          )}

          {/* Start Ride Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancelVerification}
              className="w-full sm:w-auto"
            >
              {isBn ? "বাতিল করুন" : "Cancel"}
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={handleConfirmStartRide}
              className="w-full sm:w-auto px-8 py-2.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
            >
              <Play className="h-4 w-4 mr-2" aria-hidden="true" />
              {isBn ? "নিরাপদ রাইড শুরু করুন" : "Start Safe Ride"}
            </Button>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: ACTIVE SAFE RIDE HUD
          ========================================================================= */}
      {phase === "ACTIVE_RIDE" && activeRide && (
        <SafeRideStatus
          rideState={activeRide}
          onStopRide={handleStopRide}
          onTriggerEmergency={onEmergencySOS}
          isBn={isBn}
        />
      )}
    </div>
  );
};
