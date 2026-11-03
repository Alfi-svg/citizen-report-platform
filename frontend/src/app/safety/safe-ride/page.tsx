"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bike,
  ShieldCheck,
  MapPin,
  CarFront,
  HardHat,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { SafeRideHelmetVerification } from "@/components/SafeRideHelmetVerification";
import EmergencyCallModal from "@/components/EmergencyCallModal";

export default function SafeRidePage() {
  const [isBn, setIsBn] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16">
      {/* Top Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Bike className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{isBn ? "নিরাপত্তা সেফ রাইড" : "Nirapotta Safe Ride"}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  AI Helmet Check
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isBn
                  ? "স্মার্ট হেলমেট শনাক্তকরণ ও রিয়েল-টাইম রাইড সুরক্ষা"
                  : "Smart helmet detection & live safe navigation"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBn(!isBn)}
              className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition"
              aria-label="Toggle language"
            >
              {isBn ? "English" : "বাংলা"}
            </button>

            <Link
              href="/safety/road-intelligence/live-map"
              className="text-xs px-3 py-1 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold hover:opacity-90 transition flex items-center gap-1.5"
            >
              <CarFront className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isBn ? "৩ডি লাইভ ম্যাপ" : "3D Live Map"}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <SafeRideHelmetVerification
          isBn={isBn}
          onEmergencySOS={() => setShowEmergencyModal(true)}
        />

        {/* Quick Reference Bottom Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Link
            href="/safety/road-intelligence/live-map"
            className="group block p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700 transition space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition flex items-center gap-1.5">
                <CarFront className="h-4 w-4 text-blue-600" aria-hidden="true" />
                {isBn ? "৩ডি রোড সেফটি লাইভ ম্যাপ" : "3D Road Safety Live Map"}
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition" aria-hidden="true" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isBn
                ? "হাইওয়ে ও শহরের সড়ক দুর্ঘটনার ঝুঁকি হিটম্যাপ এবং ৩ডি ট্র্যাকিং দেখুন।"
                : "Explore highway corridors, incident heatmaps, and 3D buildings."}
            </p>
          </Link>

          <Link
            href="/guard"
            className="group block p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-red-300 dark:hover:border-red-700 transition space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-red-600 transition flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-red-600" aria-hidden="true" />
                {isBn ? "নিরাপত্তা গার্ড / এসওএস" : "Nirapotta Guard / SOS"}
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition" aria-hidden="true" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isBn
                ? "বিশ্বস্ত পরিচিতদের তাৎক্ষণিক অবস্থান ও জরুরি বিপদ সংকেত প্রেরণ।"
                : "Broadcast emergency distress signals to trusted emergency contacts."}
            </p>
          </Link>
        </div>
      </main>

      {/* Emergency Call Dialog */}
      <EmergencyCallModal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
      />
    </div>
  );
}
