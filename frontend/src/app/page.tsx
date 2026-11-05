"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { translations, Language } from "@/lib/i18n";
import EmergencyCallModal from "@/components/EmergencyCallModal";
import { Capacitor } from "@capacitor/core";
import {
  Shield,
  HeartPulse,
  FileText,
  Map as MapIcon,
  Navigation,
  Users,
  BarChart3,
  PhoneCall,
  AlertTriangle,
  ArrowRight,
  Download,
  Bike,
  Plus,
} from "lucide-react";

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  // Language state synchronized with app_lang
  const [lang, setLang] = useState<Language>("en");
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

  const t = translations[lang];

  // Emergency Call Dialog State
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);

  // Active Blood Requests Counter (for dynamic badge on Blood Help card)
  const [bloodCount, setBloodCount] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiFetch<{ total: number }>("/blood/requests?limit=1&status=OPEN")
      .then((res) => {
        if (isMounted && res && typeof res.total === "number") {
          setBloodCount(res.total);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-10 sm:space-y-14 pb-24 sm:pb-16">
      {/* =================================================================== */}
      {/* 1. HERO SECTION                                                     */}
      {/* =================================================================== */}
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        {/* Background Image with Dark Emerald Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/brand/bangladesh-hero-bg.jpg"
            alt="Bangladesh National Monument and Heritage"
            fill
            className="object-cover object-center opacity-30"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/85 to-emerald-950/70" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 mx-auto max-w-5xl px-4 py-12 sm:py-20 text-center space-y-6">
          {/* Official Buildathon Sticker */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-gradient-to-r from-emerald-600/30 via-emerald-500/20 to-teal-600/30 text-emerald-200 border border-emerald-400/40 shadow-sm backdrop-blur-xs">
              <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="tracking-wide">
                Built For Ostad Presents YUNet AIgnite Buildathon 2026
              </span>
            </div>
          </div>

          {/* White Card Emblem Frame */}
          <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 relative rounded-2xl overflow-hidden shadow-xl border-2 border-emerald-500/40 bg-white p-1">
            <Image
              src="/brand/logo-sm.jpg"
              alt="NIRAPOTTA Emblem"
              fill
              className="object-contain p-1"
              priority
            />
          </div>

          {/* Headline */}
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight max-w-3xl mx-auto leading-tight">
            {lang === "bn"
              ? "নাগরিক নিরাপত্তা ও জরুরি সমন্বয় প্ল্যাটফর্ম"
              : "Citizen Safety & Emergency Coordination Platform"}
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            {lang === "bn"
              ? "জরুরি রিপোর্ট, রক্ত সহায়তা, নিরাপদ রুট নেভিগেশন, নিরাপত্তা মানচিত্র ও নিখোঁজ ব্যক্তি অনুসন্ধানের একটি সমন্বিত ও নির্ভরযোগ্য জাতীয় নেটওয়ার্ক।"
              : "Report civic hazards, locate nearby hospitals, access 3D safe routing, track hazard maps, and coordinate community emergency response across Bangladesh."}
          </p>

          {/* CTA Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/reports/create"
              className="w-full sm:w-auto justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 text-xs sm:text-sm font-bold shadow-lg shadow-emerald-700/30 transition active:scale-95 flex items-center gap-2 min-h-[44px]"
            >
              <Plus className="h-4 w-4" />
              <span>{lang === "bn" ? "রিপোর্ট জমা দিন" : "Report an Incident"}</span>
            </Link>

            <Link
              href="/safety"
              className="w-full sm:w-auto justify-center rounded-xl bg-red-600 hover:bg-red-500 text-white px-5 py-3 text-xs sm:text-sm font-bold shadow-lg shadow-red-700/30 transition active:scale-95 flex items-center gap-2 min-h-[44px]"
            >
              <PhoneCall className="h-4 w-4" />
              <span>{lang === "bn" ? "জরুরি সাহায্য ও ৯৯৯" : "Find Emergency Help"}</span>
            </Link>

            <Link
              href="/safety-map"
              className="w-full sm:w-auto justify-center rounded-xl border border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 px-5 py-3 text-xs sm:text-sm font-semibold transition backdrop-blur-xs flex items-center gap-2 min-h-[44px]"
            >
              <MapIcon className="h-4 w-4 text-zinc-400" />
              <span>{lang === "bn" ? "নিরাপত্তা মানচিত্র" : "Safety Map"}</span>
            </Link>

            {!isNative && (
              <a
                href="/nirapotta.apk"
                download="nirapotta.apk"
                className="w-full sm:w-auto justify-center rounded-xl border border-emerald-600/50 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 px-4 py-3 text-xs sm:text-sm font-semibold transition backdrop-blur-xs flex items-center gap-1.5 shadow-xs min-h-[44px]"
                title={lang === "bn" ? "অ্যান্ড্রয়েড অ্যাপ ডাউনলোড করুন" : "Download Android App (APK)"}
              >
                <Download className="h-4 w-4" />
                <span>{lang === "bn" ? "অ্যাপ ডাউনলোড (APK)" : "Download APK"}</span>
              </a>
            )}
          </div>

          {/* Logged in state */}
          {isAuthenticated && user && (
            <p className="text-xs text-zinc-400 pt-1">
              {lang === "bn" ? "স্বাগতম, " : "Logged in as "}
              <span className="text-zinc-200 font-bold">{user.full_name || user.username}</span>
              {" • "}
              <Link href="/dashboard" className="text-emerald-400 hover:underline inline-flex items-center gap-1">
                {lang === "bn" ? "ড্যাশবোর্ড খুলুন" : "Open Citizen Dashboard"}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-14">
        {/* =================================================================== */}
        {/* 2. CIVIC SAFETY PILLARS: Blood Help & Nirapotta Guard               */}
        {/* =================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Pillar A: Blood Help & AI Hospital Finder */}
          <div className="relative overflow-hidden rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-gradient-to-br from-rose-50/70 via-white to-rose-50/30 dark:from-rose-950/40 dark:via-zinc-900 dark:to-zinc-950 p-6 sm:p-7 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <HeartPulse className="h-3.5 w-3.5" />
                  <span>{t.home_blood_cta_title || "Blood Help & Hospital AI"}</span>
                </div>
                {bloodCount !== null && bloodCount > 0 && (
                  <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full">
                    {bloodCount} {lang === "bn" ? "সক্রিয় অনুরোধ" : "Active Requests"}
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                  {lang === "bn"
                    ? "জরুরি রক্ত ও নিকটস্থ হাসপাতাল সহকারী"
                    : "Emergency Blood & Nearby Hospital Assistant"}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                  {lang === "bn"
                    ? "রক্তের প্রয়োজনে তাৎক্ষণিক অনুরোধ জমা দিন, অনুদানকারীদের সাথে যোগাযোগ করুন এবং এআই সহকারীর মাধ্যমে যাচাইকৃত হাসপাতালের স্টক ও হেল্পলাইন খুঁজুন।"
                    : "Request urgent blood units, match with verified community donors, or find nearby hospitals and stock status via conversational Blood AI."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <Link
                href="/blood-help/blood-ai"
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition active:scale-95"
              >
                <HeartPulse className="h-4 w-4" />
                <span>{lang === "bn" ? "ব্লাড এআই সহকারী" : "Blood AI Assistant"}</span>
              </Link>
              <Link
                href="/blood-help"
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-zinc-900 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-3.5 py-2.5 text-xs font-semibold transition"
              >
                <span>{lang === "bn" ? "রক্ত সহায়তা পোর্টাল" : "Blood Portal"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Pillar B: Nirapotta Guard - Emergency SOS */}
          <div className="relative overflow-hidden rounded-3xl border border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-zinc-950 p-6 sm:p-7 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <Shield className="h-3.5 w-3.5" />
                <span>{lang === "bn" ? "নিরাপত্তা গার্ড" : "Nirapotta Guard"}</span>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                  {lang === "bn"
                    ? "ব্যক্তিগত নিরাপত্তা ও তাৎক্ষণিক জরুরি অ্যালার্ট"
                    : "Personal Safety & Instant Emergency SOS"}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                  {lang === "bn"
                    ? "এক ক্লিকে আপনার বিশ্বস্ত জরুরি পরিচিতি এবং প্ল্যাটফর্মে সরাসরি লাইভ লোকেশন সহ তাৎক্ষণিক বিপদ সংকেত প্রেরণ করুন।"
                    : "Send instant distress alerts with your live GPS location to trusted emergency contacts and community responders in seconds."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <Link
                href="/guard"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition active:scale-95"
              >
                <Shield className="h-4 w-4" />
                <span>{lang === "bn" ? "গার্ড সক্রিয় করুন" : "Open Nirapotta Guard"}</span>
              </Link>
              <Link
                href="/safety"
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-zinc-900 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 px-3.5 py-2.5 text-xs font-semibold transition"
              >
                <span>{lang === "bn" ? "জরুরি সেবা ডিরেক্টরি" : "Emergency Directory"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 3. DEDICATED FEATURE DIRECTORY (Unified, Clean Navigation Grid)     */}
        {/* =================================================================== */}
        <section className="space-y-4">
          <div className="border-b border-zinc-100 dark:border-zinc-800/80 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {lang === "bn" ? "প্ল্যাটফর্ম সেবা ও ফিচারসমূহ" : "Platform Services & Dedicated Sections"}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {lang === "bn"
                  ? "নির্দিষ্ট সেকশন থেকে বিস্তারিত তথ্য, ম্যাপ ও সেবা ব্যবহার করুন।"
                  : "Navigate directly to specialized modules for reports, routing, transparency, and search."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {/* Card 1: Reports Section */}
            <Link
              href="/reports"
              className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 transition shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition shadow-2xs">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight group-hover:text-emerald-600 transition">
                  {lang === "bn" ? "নাগরিক রিপোর্ট ফিড" : "Incident Reports"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                  {lang === "bn" ? "যাচাইকৃত রিপোর্ট, ফিল্টার ও এআই অ্যানালাইসিস।" : "Verified reports, search filters, and AI intelligence."}
                </p>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-3">
                <span>{lang === "bn" ? "রিপোর্ট ব্রাউজ করুন" : "Browse Reports"}</span>
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>

            {/* Card 2: Safety Map */}
            <Link
              href="/safety-map"
              className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 hover:border-blue-500/60 dark:hover:border-blue-500/60 transition shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition shadow-2xs">
                  <MapIcon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight group-hover:text-blue-600 transition">
                  {lang === "bn" ? "নিরাপত্তা মানচিত্র" : "Safety Map"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                  {lang === "bn" ? "ইন্টারেক্টিভ হ্যাজার্ড ম্যাপ ও ক্লাস্টার।" : "Interactive hazard clusters & incident markers."}
                </p>
              </div>
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 pt-3">
                <span>{lang === "bn" ? "ম্যাপ খুলুন" : "Explore Map"}</span>
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>

            {/* Card 3: Road Safety & Safe Route */}
            <Link
              href="/safety/safe-route"
              className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 hover:border-cyan-500/60 dark:hover:border-cyan-500/60 transition shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition shadow-2xs">
                  <Navigation className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight group-hover:text-cyan-600 transition">
                  {lang === "bn" ? "সেফ রুট ও ৩ডি ম্যাপ" : "Safe Route & 3D Map"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                  {lang === "bn" ? "দুর্ঘটনা জোন পর্যবেক্ষণ ও নিরাপদ ড্রাইভিং রুট।" : "Accident-prone zone overlays and shortest vs safest route."}
                </p>
              </div>
              <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1 pt-3">
                <span>{lang === "bn" ? "রুট পরিকল্পনা" : "Plan Safe Route"}</span>
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>

            {/* Card 4: Safe Ride Helmet Verification */}
            <Link
              href="/safety/safe-ride"
              className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 hover:border-indigo-500/60 dark:hover:border-indigo-500/60 transition shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition shadow-2xs">
                  <Bike className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight group-hover:text-indigo-600 transition">
                  {lang === "bn" ? "সেফ রাইড হেলমেট এআই" : "Safe Ride System"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                  {lang === "bn" ? "মোটরসাইকেল হেলমেট স্ক্যান ও রাইড ট্র্যাকিং।" : "Camera helmet verification and active ride tracking."}
                </p>
              </div>
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 pt-3">
                <span>{lang === "bn" ? "রাইড শুরু করুন" : "Start Safe Ride"}</span>
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>

            {/* Card 5: Missing Person Section */}
            <Link
              href="/missing-person"
              className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 hover:border-amber-500/60 dark:hover:border-amber-500/60 transition shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-amber-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition shadow-2xs">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight group-hover:text-amber-600 transition">
                  {lang === "bn" ? "নিখোঁজ ব্যক্তি সন্ধান" : "Missing Persons"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                  {lang === "bn" ? "সক্রিয় অ্যালার্ট ব্রাউজ করুন ও সন্ধান দিন।" : "Community missing alerts, details, and sighting reports."}
                </p>
              </div>
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 pt-3">
                <span>{lang === "bn" ? "অ্যালার্ট ব্রাউজ করুন" : "View Missing Alerts"}</span>
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>

            {/* Card 6: Platform Transparency */}
            <Link
              href="/transparency"
              className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 hover:border-purple-500/60 dark:hover:border-purple-500/60 transition shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition shadow-2xs">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight group-hover:text-purple-600 transition">
                  {lang === "bn" ? "স্বচ্ছতা ও অ্যানালিটিক্স" : "Transparency Portal"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                  {lang === "bn" ? "যাচাইকরণ হিসেব, বাৎসরিক চার্ট ও অডিট।" : "Public metrics, monthly resolution charts, and audit reports."}
                </p>
              </div>
              <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 pt-3">
                <span>{lang === "bn" ? "পরিসংখ্যান দেখুন" : "View Transparency"}</span>
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>

            {/* Card 7: Safety Directory */}
            <Link
              href="/safety"
              className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 hover:border-red-500/60 dark:hover:border-red-500/60 transition shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-red-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition shadow-2xs">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight group-hover:text-red-600 transition">
                  {lang === "bn" ? "জরুরি সেবা কেন্দ্র" : "Safety Navigator"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                  {lang === "bn" ? "নিকটস্থ পুলিশ, ফায়ার সার্ভিস ও অ্যাম্বুলেন্স।" : "Nearest police stations, fire brigades, and hospitals."}
                </p>
              </div>
              <span className="text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1 pt-3">
                <span>{lang === "bn" ? "সেবা খুঁজুন" : "Find Services"}</span>
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>

            {/* Card 8: Blood Help Portal */}
            <Link
              href="/blood-help"
              className="group rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 hover:border-rose-500/60 dark:hover:border-rose-500/60 transition shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-rose-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition shadow-2xs">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-tight group-hover:text-rose-600 transition">
                  {lang === "bn" ? "রক্ত সহায়তা ও অনুদান" : "Blood Help Portal"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">
                  {lang === "bn" ? "জরুরি রক্তের আবেদন ও দাতা নেটওয়ার্ক।" : "Donor network, open blood requests, and hospital stock."}
                </p>
              </div>
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 pt-3">
                <span>{lang === "bn" ? "রক্ত পোর্টাল" : "Open Portal"}</span>
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 4. HOW CITIZEN REPORTS ARE VERIFIED (Pipeline)                      */}
        {/* =================================================================== */}
        <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-10 shadow-2xs space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {lang === "bn" ? "কীভাবে নাগরিক রিপোর্ট যাচাই করা হয়" : "How Citizen Reports Are Verified"}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {lang === "bn"
                ? "প্রত্যেকটি রিপোর্ট জনসাধারণের সামনে প্রকাশের আগে কঠোরভাবে নিরীক্ষা করা হয়।"
                : "Every report on this platform undergoes rigorous checks before public publication."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-5 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <div className="h-8 w-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "প্রমাণ জমা" : "Evidence Submission"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {lang === "bn"
                  ? "নাগরিকরা ছবি, ভিডিও বা নথি সহযোগে ঘটনার স্থান ও সময়ের সুনির্দিষ্ট বিবরণ দেন।"
                  : "Citizens submit factual incident details accompanied by photos, videos, or documents."}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-5 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <div className="h-8 w-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "মডারেশন নিরীক্ষা" : "Moderation Review"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {lang === "bn"
                  ? "মডারেটর দল বিভ্রান্তিকর বা ক্ষতিকারক তথ্য প্রতিহত করতে প্রমাণ যাচাই করেন।"
                  : "Authorized moderators audit the report for authenticity and community guideline compliance."}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-5 space-y-2 border border-zinc-100 dark:border-zinc-800">
              <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "সুরক্ষিত প্রকাশ" : "Safe Publication"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {lang === "bn"
                  ? "অনুমোদিত রিপোর্টগুলো গোপনীয়তা বজায় রেখে ফিড, ম্যাপ এবং অ্যালার্ট সিস্টেমে প্রকাশিত হয়।"
                  : "Approved reports appear on the public feed, community safety map, and civic transparency dashboard with full location privacy."}
              </p>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 5. EMERGENCY 999 SECTION                                           */}
        {/* =================================================================== */}
        <section className="rounded-3xl border border-red-200 dark:border-red-950/80 bg-red-50/60 dark:bg-red-950/20 p-5 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xs">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="h-12 w-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-2xs mx-auto sm:mx-0">
              <PhoneCall className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-black text-red-950 dark:text-red-100 leading-tight">
                {lang === "bn" ? "জরুরি সাহায্য প্রয়োজন?" : "Need Immediate Emergency Assistance?"}
              </h3>
              <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed">
                {lang === "bn"
                  ? "পুলিশ, ফায়ার সার্ভিস বা অ্যাম্বুলেন্সের জন্য জাতীয় জরুরি সেবা ৯৯৯ নম্বরে বিনামূল্যে কল করুন।"
                  : "Call National Emergency Service 999 24/7 toll-free for Police, Fire Service, and Ambulance."}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setEmergencyModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold shadow-2xs transition w-full sm:w-auto min-h-[48px] cursor-pointer"
            >
              <PhoneCall className="h-4 w-4" />
              <span>{lang === "bn" ? "কল ৯৯৯" : "Call 999"}</span>
            </button>
            <Link
              href="/safety"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-red-300 dark:border-red-900 bg-white dark:bg-zinc-900 text-red-700 dark:text-red-300 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/40 transition w-full sm:w-auto min-h-[48px]"
            >
              <span>{lang === "bn" ? "কাছাকাছি সেবা খুঁজুন" : "Find Units Near Me"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>

      {/* Emergency Call Confirmation Modal */}
      <EmergencyCallModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        targetNumber="999"
        lang={lang}
      />
    </div>
  );
}
