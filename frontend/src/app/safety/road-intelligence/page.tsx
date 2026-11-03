"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  RoadSafetyIntelligenceResponse,
  RoadSafetyRiskLevel,
  RoadSafetyHotspotItem,
} from "@/lib/types";
import { Language } from "@/lib/i18n";
import { captureCurrentLocation } from "@/lib/location";
import EmergencyActionPlanModal from "@/components/EmergencyActionPlanModal";
import { Siren, CarFront, Bot, Check, Bell, Milestone, Bike } from "lucide-react";

// Preset Bangladesh High-Risk & Major Urban Locations
const PRESET_AREAS = [
  { name: "Dhanmondi 27, Dhaka", lat: 23.7461, lng: 90.3742 },
  { name: "Mirpur 10 Circle, Dhaka", lat: 23.8071, lng: 90.3686 },
  { name: "Kakoli Intersection, Banani", lat: 23.7937, lng: 90.4043 },
  { name: "Airport Road, Uttara", lat: 23.8341, lng: 90.4196 },
  { name: "Kanchpur Bridge, Narayanganj", lat: 23.7042, lng: 90.5098 },
  { name: "Agrabad, Chattogram", lat: 22.3168, lng: 91.7981 },
];

export default function RoadSafetyIntelligencePage() {
  const [lang, setLang] = useState<Language>("en");
  const [latitude, setLatitude] = useState<number>(23.7461);
  const [longitude, setLongitude] = useState<number>(90.3742);
  const [areaName, setAreaName] = useState<string>("Dhanmondi 27, Dhaka");
  const [radiusKm, setRadiusKm] = useState<number>(3.0);

  const [data, setData] = useState<RoadSafetyIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [locating, setLocating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Action plan modal state
  const [actionPlanOpen, setActionPlanOpen] = useState<boolean>(false);

  // Sync language
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = (localStorage.getItem("app_lang") as Language) || "en";
      setLang(saved);
      const handleLangChange = () => {
        const next = (localStorage.getItem("app_lang") as Language) || "en";
        setLang(next);
      };
      window.addEventListener("languagechange", handleLangChange);
      return () => window.removeEventListener("languagechange", handleLangChange);
    }
  }, []);

  const isBn = lang === "bn";

  const fetchRoadIntelligence = useCallback(
    async (lat: number, lng: number, radius: number, name?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<RoadSafetyIntelligenceResponse>(
          `/safety/road-intelligence?latitude=${lat}&longitude=${lng}&radius_km=${radius}&lang=${lang}` +
            (name ? `&area_name=${encodeURIComponent(name)}` : "")
        );
        setData(res);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load road safety intelligence");
      } finally {
        setLoading(false);
      }
    },
    [lang]
  );

  useEffect(() => {
    fetchRoadIntelligence(latitude, longitude, radiusKm, areaName);
  }, [fetchRoadIntelligence, latitude, longitude, radiusKm, areaName]);

  const handleDetectLocation = async () => {
    setLocating(true);
    try {
      const { coordinates, error } = await captureCurrentLocation();
      if (coordinates) {
        setLatitude(coordinates.latitude);
        setLongitude(coordinates.longitude);
        setAreaName(isBn ? "আমার বর্তমান অবস্থান" : "My Current Location");
        fetchRoadIntelligence(coordinates.latitude, coordinates.longitude, radiusKm, "My Current Location");
      } else {
        alert(isBn ? "লোকেশন নির্ণয় করা যায়নি। ব্রাউজারে জিপিএস পারমিশন দিন।" : (error?.message || "Could not determine location. Please allow GPS permissions."));
      }
    } catch {
      alert(isBn ? "লোকেশন নির্ণয় করা যায়নি। ব্রাউজারে জিপিএস পারমিশন দিন।" : "Could not determine location. Please allow GPS permissions.");
    } finally {
      setLocating(false);
    }
  };

  const getRiskBadgeColor = (level: RoadSafetyRiskLevel) => {
    switch (level) {
      case "Critical":
        return "bg-red-600 text-white border-red-700";
      case "High":
        return "bg-amber-600 text-white border-amber-700";
      case "Moderate":
        return "bg-yellow-500 text-zinc-950 border-yellow-600";
      case "Low":
      default:
        return "bg-emerald-600 text-white border-emerald-700";
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-20">
      {/* Hero Header */}
      <div className="bg-gradient-to-b from-blue-900 to-indigo-950 text-white border-b border-blue-800/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-xs font-semibold text-blue-200 mb-3">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                {isBn ? "এআই চালিত সড়ক নিরাপত্তা" : "AI-Powered Road Safety Intelligence"}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {isBn ? "সড়ক নিরাপত্তা ইন্টেলিজেন্স" : "Road Safety Intelligence"}
              </h1>
              <p className="mt-2 text-sm sm:text-base text-blue-100/80 max-w-2xl leading-relaxed">
                {isBn
                  ? "ঐতিহাসিক দুর্ঘটনা রিপোর্ট, যাচাইকৃত তথ্য ও ভৌগোলিক ঘনত্বের ওপর ভিত্তি করে বস্তুনিষ্ঠ ঝুঁকি নিরূপণ ও জীবনরক্ষাকারী সতর্কতা।"
                  : "Objective, location-grounded road safety assessment derived from historical accident reports, verified incidents, and geospatial density."}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={handleDetectLocation}
                disabled={locating}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center gap-2 disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${locating ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{locating ? (isBn ? "লোকেশন খোঁজা হচ্ছে..." : "Locating...") : (isBn ? "আমার লোকেশন স্ক্যান" : "Scan My Location")}</span>
              </button>

              <button
                onClick={() => setActionPlanOpen(true)}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition flex items-center gap-2"
              >
                <Siren className="h-4 w-4" />
                <span>{isBn ? "জরুরি প্রটোকল (৯৯৯)" : "Action Protocol (999)"}</span>
              </button>

              <Link
                href="/safety/safe-ride"
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white rounded-xl font-black text-xs sm:text-sm shadow-lg transition flex items-center gap-2"
              >
                <Bike className="h-4 w-4" />
                <span>{isBn ? "সেফ রাইড (হেলমেট ভেরিফিকেশন)" : "Safe Ride (Helmet Check)"}</span>
              </Link>

              <Link
                href={`/safety/road-intelligence/live-map?lat=${latitude}&lng=${longitude}&area=${encodeURIComponent(areaName)}`}
                className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-95 text-white rounded-xl font-black text-xs sm:text-sm shadow-lg transition flex items-center gap-2 ring-2 ring-cyan-400/40"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                <span>{isBn ? "৩ডি লাইভ ম্যাপ (Uber Mode)" : "3D Live Map (Uber Mode)"}</span>
              </Link>
            </div>
          </div>

          {/* Quick Preset Area Pills */}
          <div className="mt-6 pt-5 border-t border-blue-800/50 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-blue-200/70 font-semibold">{isBn ? "দ্রুত এলাকা নির্বাচন:" : "Quick Corridors:"}</span>
            {PRESET_AREAS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => {
                  setLatitude(preset.lat);
                  setLongitude(preset.lng);
                  setAreaName(preset.name);
                }}
                className={`px-3 py-1.5 rounded-lg border transition ${
                  areaName === preset.name
                    ? "bg-white text-blue-950 font-bold border-white shadow"
                    : "bg-blue-900/60 hover:bg-blue-800/80 text-blue-100 border-blue-700/60"
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Analysis Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Uber-Style 3D Live Map Feature Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-zinc-900 via-slate-900 to-zinc-950 border border-cyan-500/30 p-5 sm:p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>{isBn ? "নতুন ৩ডি লাইভ নেভিগেশন ম্যাপ" : "New 3D Live Navigation Map"}</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white">
                {isBn ? "উবার-স্টাইল ৩ডি রিয়েল-টাইম ড্রাইভিং ও ঝুঁকি ম্যাপ" : "Uber-Style 3D Real-Time Driving & Road Safety Map"}
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isBn
                  ? "চলন্ত অবস্থায় লাইভ জিপিএস ট্র্যাকিং, ৩ডি ভবনের ভিউ, রুট ঝুঁকি মূল্যায়ন এবং উচ্চ-ঝুঁকিপূর্ণ দুর্ঘটনা পয়েন্টে পৌঁছানোর আগেই সতর্কবার্তা পান।"
                  : "Live GPS motion tracking, 3D building perspective, road hazard route assessment, and automatic proximity warnings when approaching accident hotspots."}
              </p>
            </div>
            <Link
              href={`/safety/road-intelligence/live-map?lat=${latitude}&lng=${longitude}&area=${encodeURIComponent(areaName)}`}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-cyan-900/30 transition active:scale-95 flex items-center justify-center gap-2 shrink-0"
            >
              <CarFront className="h-4 w-4" />
              <span>{isBn ? "লাইভ ৩ডি ম্যাপ খুলুন →" : "Open 3D Live Map →"}</span>
            </Link>
          </div>
        </div>

        {/* Radius Selector & Coordinate Bar */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="font-bold text-zinc-500 dark:text-zinc-400">{isBn ? "বর্তমান কেন্দ্রবিন্দু:" : "Active Center:"}</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{areaName}</span>
            <span className="text-zinc-400 text-xs">({latitude.toFixed(4)}, {longitude.toFixed(4)})</span>
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="radius-select" className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
              {isBn ? "বিশ্লেষণ ব্যাসার্ধ:" : "Radius:"}
            </label>
            <select
              id="radius-select"
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="1.0">1.0 km</option>
              <option value="2.0">2.0 km</option>
              <option value="3.0">3.0 km (Standard)</option>
              <option value="5.0">5.0 km (Wide)</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-zinc-500">
              {isBn ? "সড়ক দুর্ঘটনা ডেটা ও ঝুঁকি বিশ্লেষণ চলছে..." : "Computing road safety intelligence from verified database..."}
            </p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl text-center space-y-2">
            <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => fetchRoadIntelligence(latitude, longitude, radiusKm, areaName)}
              className="px-4 py-2 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              {isBn ? "পুনরায় চেষ্টা করুন" : "Retry"}
            </button>
          </div>
        ) : data ? (
          <>
            {/* Top Grid: Risk Gauge + Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Risk Level Gauge Card */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {isBn ? "সড়ক ঝুঁকি স্তর" : "Road Risk Assessment"}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      {data.metrics.data_confidence}
                    </span>
                  </div>

                  <div className="mt-4 flex items-baseline gap-3">
                    <span className="text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                      {data.risk_score}
                    </span>
                    <span className="text-sm font-bold text-zinc-400">/ 100</span>
                  </div>

                  <div className="mt-3">
                    <span
                      className={`inline-block px-3.5 py-1.5 rounded-lg text-sm font-extrabold border shadow-sm ${getRiskBadgeColor(
                        data.risk_level
                      )}`}
                    >
                      {data.risk_level} Risk
                    </span>
                  </div>

                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2.5 rounded-full mt-5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        data.risk_level === "Critical"
                          ? "bg-red-600"
                          : data.risk_level === "High"
                          ? "bg-amber-500"
                          : data.risk_level === "Moderate"
                          ? "bg-yellow-400"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.max(5, data.risk_score)}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  {isBn
                    ? "ঝুঁকি স্কোরটি ঐতিহাসিক দুর্ঘটনা রিপোর্ট, সাম্প্রতিকতার মাত্রা এবং প্ল্যাটফর্মের ভেরিফিকেশনের ওপর ভিত্তি করে হিসাবকৃত।"
                    : "Calculated via verified incident recency, spatial cluster density, and corroboration ratio."}
                </p>
              </div>

              {/* Statistical Metrics Grid */}
              <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-4">
                    {isBn ? "ঐতিহাসিক দুর্ঘটনা পরিসংখ্যান (Statistical Evidence)" : "Historical Incident Evidence"}
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-100 dark:border-zinc-800">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 block">{isBn ? "মোট রিপোর্ট" : "Total Accidents"}</span>
                      <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1 block">
                        {data.metrics.total_accidents}
                      </span>
                    </div>

                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                      <span className="text-xs text-emerald-700 dark:text-emerald-400 block font-semibold">{isBn ? "সত্যায়িত" : "Verified Safe"}</span>
                      <span className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1 block">
                        {data.metrics.verified_accidents}
                      </span>
                    </div>

                    <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40">
                      <span className="text-xs text-blue-700 dark:text-blue-400 block font-semibold">{isBn ? "গত ৭ দিন" : "Past 7 Days"}</span>
                      <span className="text-2xl font-black text-blue-900 dark:text-blue-200 mt-1 block">
                        {data.metrics.recent_accidents_7d}
                      </span>
                    </div>

                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900/40">
                      <span className="text-xs text-amber-700 dark:text-amber-400 block font-semibold">{isBn ? "গত ৩০ দিন" : "Past 30 Days"}</span>
                      <span className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-1 block">
                        {data.metrics.recent_accidents_30d}
                      </span>
                    </div>
                  </div>

                  {/* Incident Density */}
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {isBn ? "দুর্ঘটনা ঘনত্ব:" : "Accident Density:"}{" "}
                      <strong className="text-zinc-900 dark:text-zinc-100">{data.metrics.accident_density_per_sq_km} / km²</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      {isBn ? "সংবেদনশীল পয়েন্ট:" : "Corroborated Hotspots:"}{" "}
                      <strong className="text-zinc-900 dark:text-zinc-100">{data.metrics.repeated_hotspots_count}</strong>
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">
                    {isBn ? "তথ্যসূত্র: নিরাপত্তা সিটিজেন ডাটাবেস" : "Source: Nirapotta Verified Incident DB"}
                  </span>
                  <Link
                    href={`/safety-map?lat=${latitude}&lng=${longitude}`}
                    className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <span>{isBn ? "ম্যাপে দেখুন" : "View on Live Map"}</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* AI Grounded Safety Explanation */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {isBn ? "এআই নিরাপত্তা বিশ্লেষণ ও সতর্কতা" : "AI Safety Analysis & Precautions"}
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  {data.explanation.data_source}
                </span>
              </div>

              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/40">
                {data.explanation.summary}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Contributing Factors */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {isBn ? "ঝুঁকি সৃষ্টির কারণসমূহ:" : "Contributing Factors:"}
                  </h4>
                  <ul className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    {data.explanation.contributing_factors.map((factor, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold">•</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Precautions */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {isBn ? "প্রয়োজনীয় সতর্কতা ও পরামর্শ:" : "Recommended Precautions:"}
                  </h4>
                  <ul className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    {data.explanation.precautions.map((prec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{prec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Nearby Safety Alerts */}
            {data.nearby_alerts && data.nearby_alerts.length > 0 && (
              <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-sm">
                  <Bell className="h-4 w-4" />
                  <span>{isBn ? "নিকটবর্তী সাম্প্রতিক দুর্ঘটনা অ্যালার্ট" : "Active Nearby Accident Alerts"}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.nearby_alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="bg-white dark:bg-zinc-900 border border-red-100 dark:border-red-900/30 rounded-xl p-3.5 flex flex-col justify-between shadow-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-300">
                            {alert.distance_text}
                          </span>
                          <span className="text-[11px] text-zinc-400">{alert.incident_date_text}</span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-2 line-clamp-1">
                          {alert.title}
                        </h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{alert.location_text}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                        <Link
                          href={alert.report_url}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <span>{isBn ? "বিস্তারিত রিপোর্ট" : "View Incident Report"}</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historical Accident Activity Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {isBn ? "ঐতিহাসিক দুর্ঘটনা ও বিপদের তালিকা" : "Historical Incident Log"}
                </h3>
                <span className="text-xs text-zinc-500">{data.history.length} records</span>
              </div>

              {data.history.length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">
                  {isBn ? "এই ব্যাসার্ধে কোনো দুর্ঘটনা রিপোর্ট নেই।" : "No historical accident reports found within this radius."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-semibold">
                        <th className="pb-2.5">{isBn ? "শিরোনাম" : "Title"}</th>
                        <th className="pb-2.5">{isBn ? "অবস্থান" : "Location"}</th>
                        <th className="pb-2.5">{isBn ? "দূরত্ব" : "Distance"}</th>
                        <th className="pb-2.5">{isBn ? "স্ট্যাটাস" : "Status"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {data.history.map((item) => (
                        <tr key={item.report_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="py-2.5 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                            <Link href={`/reports/${item.report_id}`} className="hover:text-blue-600">
                              {item.title}
                            </Link>
                          </td>
                          <td className="py-2.5 pr-4 text-zinc-500">{item.location_text}</td>
                          <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-400">
                            {item.distance_km ? `${item.distance_km} km` : "N/A"}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.is_verified
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                              }`}
                            >
                              {item.is_verified ? "Verified" : "Under Review"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Regional Highway Corridors */}
            {data.hotspots && data.hotspots.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Milestone className="h-4 w-4 text-emerald-600" />
                    <span>{isBn ? "আঞ্চলিক সড়ক করিডোর (ডেটাবেস রেকর্ড অনুযায়ী)" : "Regional Highway Corridors (DB Grounded)"}</span>
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {isBn
                      ? "পরিচিত মহাসড়ক করিডোর সমূহের নিকট প্ল্যাটফর্ম ব্যবহারকারীদের প্রকৃত রিপোর্টের পরিসংখ্যান"
                      : "Actual incident counts recorded in Nirapotta database around major regional highway corridors"}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.hotspots.map((spot, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{spot.area_name}</h4>
                        <span className="text-[11px] text-zinc-500 mt-0.5 block">
                          {spot.accident_count > 0
                            ? (isBn ? `${spot.accident_count}টি দুর্ঘটনা রেকর্ড (বিগত ৩০ দিনে ${spot.recent_count_30d}টি)` : `${spot.accident_count} reports in DB (${spot.recent_count_30d} in past 30d)`)
                            : (isBn ? "ডেটাবেসে কোনো দুর্ঘটনা রিপোর্ট নেই" : "0 accident reports in DB")}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          spot.accident_count > 0 ? getRiskBadgeColor(spot.risk_level) : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {spot.accident_count > 0 ? spot.risk_level : (isBn ? "স্বাভাবিক" : "Clear")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Emergency Action Plan Modal */}
      <EmergencyActionPlanModal
        isOpen={actionPlanOpen}
        onClose={() => setActionPlanOpen(false)}
        emergencyType="road_accident"
        details={areaName}
      />
    </div>
  );
}
