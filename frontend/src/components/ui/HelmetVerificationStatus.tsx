"use client";

import React from "react";
import {
  ShieldCheck,
  HardHat,
  TriangleAlert,
  User,
  CircleAlert,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { HelmetDetectionStatus } from "@/lib/types";

export interface HelmetVerificationStatusProps {
  status: HelmetDetectionStatus | "DETECTING" | "IDLE";
  isVerified: boolean;
  confidence?: number;
  message?: string;
  isBn?: boolean;
  className?: string;
}

export const HelmetVerificationStatus: React.FC<HelmetVerificationStatusProps> = ({
  status,
  isVerified,
  confidence,
  message,
  isBn = false,
  className = "",
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case "VERIFIED":
        return {
          icon: <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />,
          titleEn: "Helmet Verified",
          titleBn: "হেলমেট যাচাই সম্পন্ন",
          badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800",
          descEn: message || "Your helmet has been detected and is properly worn. You can now start your ride.",
          descBn: message || "আপনার হেলমেট সঠিকভাবে শনাক্ত করা হয়েছে। আপনি এখন নিরাপদ রাইড শুরু করতে পারেন।",
        };
      case "HELMET_NOT_WORN":
        return {
          icon: <TriangleAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />,
          titleEn: "Helmet Position Not Verified",
          titleBn: "হেলমেট যথাযথভাবে পরিহিত নয়",
          badgeClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800",
          descEn: message || "Helmet detected, but not properly worn on your head. Please wear it correctly.",
          descBn: message || "হেলমেট শনাক্ত হয়েছে কিন্তু মাথায় পরা নেই। অনুগ্রহ করে মাথায় সঠিকভাবে পরিধান করুন।",
        };
      case "HELMET_NOT_DETECTED":
        return {
          icon: <HardHat className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />,
          titleEn: "Helmet Not Detected",
          titleBn: "কোনো হেলমেট শনাক্ত করা যায়নি",
          badgeClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800",
          descEn: message || "Please wear your safety helmet before starting your Safe Ride.",
          descBn: message || "নিরাপদ রাইড শুরুর পূর্বে অনুগ্রহ করে আপনার সুরক্ষা হেলমেট পরিধান করুন।",
        };
      case "PERSON_NOT_DETECTED":
        return {
          icon: <User className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden="true" />,
          titleEn: "Person Not In Frame",
          titleBn: "ব্যক্তি ফ্রেমে অনুপস্থিত",
          badgeClass: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
          descEn: message || "Please position yourself clearly inside the camera frame.",
          descBn: message || "অনুগ্রহ করে ক্যামেরার ফ্রেমে মুখমণ্ডল ও শরীর স্পষ্টভাবে দৃশ্যমান রাখুন।",
        };
      case "UNCERTAIN":
        return {
          icon: <CircleAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />,
          titleEn: "Verification Unclear",
          titleBn: "যাচাইকরণ অস্পষ্ট",
          badgeClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800",
          descEn: message || "Could not clearly verify helmet due to lighting or camera angle. Please adjust and retry.",
          descBn: message || "আলোর ঘাটতি বা ক্যামেরার কোণের কারণে স্পষ্ট করা যায়নি। অনুগ্রহ করে আলো ঠিক করে পুনরায় চেষ্টা করুন।",
        };
      case "ERROR":
        return {
          icon: <CircleAlert className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />,
          titleEn: "Camera Error",
          titleBn: "ক্যামেরা সংক্রান্ত ত্রুটি",
          badgeClass: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800",
          descEn: message || "Unable to access camera or process frame. Check camera permissions.",
          descBn: message || "ক্যামেরা ফ্রেম লোড করা যায়নি। অনুগ্রহ করে অনুমতি পরীক্ষা করুন।",
        };
      case "DETECTING":
        return {
          icon: <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" aria-hidden="true" />,
          titleEn: "Checking Helmet...",
          titleBn: "হেলমেট যাচাই করা হচ্ছে...",
          badgeClass: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800",
          descEn: "Analyzing camera frame via OpenCV computer vision...",
          descBn: "কম্পিউটার ভিশনের মাধ্যমে ক্যামেরা ফ্রেম বিশ্লেষণ করা হচ্ছে...",
        };
      case "IDLE":
      default:
        return {
          icon: <HardHat className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden="true" />,
          titleEn: "Helmet Check Required",
          titleBn: "হেলমেট যাচাই আবশ্যক",
          badgeClass: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
          descEn: "Riders must wear a helmet before initiating a Nirapotta Safe Ride.",
          descBn: "নিরাপত্তা নিশ্চিত করতে রাইড শুরুর আগে হেলমেট পরিধান নিশ্চিত করতে হবে।",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border p-4 transition-all duration-150 ${config.badgeClass} ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{config.icon}</div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold tracking-tight">
              {isBn ? config.titleBn : config.titleEn}
            </h4>
            {confidence !== undefined && confidence > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/70 dark:bg-slate-900/70 border border-current/20">
                {Math.round(confidence * 100)}% {isBn ? "নিশ্চয়তা" : "confidence"}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed opacity-90">
            {isBn ? config.descBn : config.descEn}
          </p>
        </div>
      </div>
    </div>
  );
};
