"use client";

import React from "react";
import { Camera, ShieldCheck, HardHat, AlertCircle, X } from "lucide-react";
import { Button } from "./Button";

export interface CameraPermissionDialogProps {
  isOpen: boolean;
  onAllow: () => void;
  onCancel: () => void;
  permissionDenied?: boolean;
  isBn?: boolean;
}

export const CameraPermissionDialog: React.FC<CameraPermissionDialogProps> = ({
  isOpen,
  onAllow,
  onCancel,
  permissionDenied = false,
  isBn = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-permission-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Camera className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h3
              id="camera-permission-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              {isBn ? "ক্যামেরা অনুমতির প্রয়োজন" : "Camera Permission Required"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isBn ? "নিরাপদ রাইড হেলমেট সুরক্ষা যাচাই" : "Nirapotta Safe Ride Helmet Verification"}
            </p>
          </div>
        </div>

        {permissionDenied ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{isBn ? "ক্যামেরা ব্যবহারের অনুমতি বাতিল করা হয়েছে" : "Camera Access Blocked"}</span>
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              {isBn
                ? "ব্রাউজার বা ডিভাইসের সেটিংস থেকে ক্যামেরা ব্যবহারের অনুমতি চালু করুন এবং পুনরায় চেষ্টা করুন।"
                : "Please open your browser or application device settings, allow camera access for Nirapotta, and try again."}
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              {isBn
                ? "মোটরসাইকেল বা বাইক রাইড শুরুর পূর্বে চালক হেলমেট পরিধান করেছেন কি না তা নিশ্চিত করতে ক্যামেরা অ্যাক্সেস প্রয়োজন।"
                : "To ensure rider safety under civic road traffic standards, Nirapotta verifies that a safety helmet is worn before activating a Safe Ride session."}
            </p>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                <span>{isBn ? "গোপনীয়তা সুরক্ষা:" : "Privacy Assurance:"}</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                {isBn
                  ? "ক্যামেরা কেবল হেলমেট যাচাইকালে কয়েক সেকেন্ডের জন্য সক্রিয় হয়। কোনো ভিডিও বা ছবি স্থায়ীভাবে সংরক্ষণ করা হয় না।"
                  : "The camera is used solely during helmet verification. Frames are evaluated in-memory and discarded. No continuous recording or private video storage occurs."}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {isBn ? "বাতিল করুন" : "Cancel"}
          </Button>
          {!permissionDenied && (
            <Button variant="primary" size="sm" onClick={onAllow}>
              <Camera className="h-4 w-4 mr-1.5" aria-hidden="true" />
              {isBn ? "ক্যামেরা চালু করুন" : "Allow Camera"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
