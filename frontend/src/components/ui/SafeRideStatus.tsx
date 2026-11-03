"use client";

import React, { useState, useEffect } from "react";
import {
  Bike,
  ShieldCheck,
  Gauge,
  Clock,
  MapPin,
  Square,
  PhoneCall,
  AlertTriangle,
} from "lucide-react";
import { Button } from "./Button";
import { ActiveSafeRideState } from "@/lib/types";

export interface SafeRideStatusProps {
  rideState: ActiveSafeRideState;
  onStopRide: () => void;
  onTriggerEmergency?: () => void;
  isBn?: boolean;
  className?: string;
}

export const SafeRideStatus: React.FC<SafeRideStatusProps> = ({
  rideState,
  onStopRide,
  onTriggerEmergency,
  isBn = false,
  className = "",
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showConfirmStop, setShowConfirmStop] = useState(false);

  useEffect(() => {
    const startTime = new Date(rideState.started_at).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [rideState.started_at]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-900 shadow-md p-5 space-y-4 ${className}`}
    >
      {/* Header Badges */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <Bike className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {isBn ? "নিরাপদ রাইড সক্রিয়" : "Safe Ride Active"}
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ID: {rideState.ride_id}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>{isBn ? "হেলমেট যাচাইকৃত" : "Helmet Verified"}</span>
        </div>
      </div>

      {/* Ride Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isBn ? "সময় অতিবাহিত" : "Elapsed Time"}</span>
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
            {formatTime(elapsedSeconds)}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isBn ? "গতিবেগ" : "Live Speed"}</span>
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
            {rideState.speed_kmh !== undefined && rideState.speed_kmh !== null
              ? `${Math.round(rideState.speed_kmh)} km/h`
              : "0 km/h"}
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isBn ? "গন্তব্য" : "Destination"}</span>
          </div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
            {rideState.destination_text || (isBn ? "অনির্ধারিত" : "Not specified")}
          </div>
        </div>
      </div>

      {/* Stop & Emergency Actions */}
      <div className="flex items-center justify-between gap-3 pt-1">
        {showConfirmStop ? (
          <div className="flex items-center gap-2 w-full">
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              {isBn ? "রাইড সম্পন্ন করতে চান?" : "End safe ride now?"}
            </span>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setShowConfirmStop(false);
                onStopRide();
              }}
            >
              <Square className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              {isBn ? "হ্যাঁ, রাইড শেষ করুন" : "Confirm Stop"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowConfirmStop(false)}
            >
              {isBn ? "বাতিল" : "Cancel"}
            </Button>
          </div>
        ) : (
          <>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowConfirmStop(true)}
            >
              <Square className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              {isBn ? "রাইড শেষ করুন" : "Stop Ride"}
            </Button>

            {onTriggerEmergency && (
              <Button
                variant="outline"
                size="sm"
                onClick={onTriggerEmergency}
                className="text-red-600 hover:text-red-700 dark:text-red-400 border-red-200 dark:border-red-900"
              >
                <PhoneCall className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                {isBn ? "জরুরি সহায়তা (৯৯৯)" : "Emergency SOS (999)"}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
