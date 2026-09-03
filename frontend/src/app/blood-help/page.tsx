"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  PublicBloodRequest,
  BloodRequestPagination,
  BloodGroup,
  BloodDonorProfile,
} from "@/lib/types";
import { translations, Language } from "@/lib/i18n";
import { useAuth } from "@/context/AuthContext";
import DonorProfileModal from "@/components/DonorProfileModal";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const BD_DISTRICTS = [
  "All Districts", "Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Rangpur", "Mymensingh",
  "Gazipur", "Narayanganj", "Cumilla", "Bogura", "Cox's Bazar", "Noakhali", "Feni", "Brahmanbaria",
  "Jessore", "Kushtia", "Pabna", "Dinajpur", "Tangail", "Faridpur", "Jamalpur"
];

export default function BloodHelpPage() {
  const { isAuthenticated } = useAuth();
  const [lang, setLang] = useState<Language>("en");

  // Sync language with global storage & event
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

  // Request listing state
  const [requests, setRequests] = useState<PublicBloodRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("All Districts");
  const [selectedUrgency, setSelectedUrgency] = useState<string>("ALL");
  const [filterCompatibleOnly, setFilterCompatibleOnly] = useState(false);

  // Donor Modal & Profile
  const [isDonorModalOpen, setIsDonorModalOpen] = useState(false);
  const [myProfile, setMyProfile] = useState<BloodDonorProfile | null>(null);

  // Load donor profile if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      apiFetch<BloodDonorProfile | null>("/blood/donor-profile")
        .then((p) => setMyProfile(p))
        .catch(() => setMyProfile(null));
    } else {
      setMyProfile(null);
    }
  }, [isAuthenticated]);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);

    const query = new URLSearchParams();
    query.set("limit", "50");
    query.set("offset", "0");

    if (selectedGroup !== "ALL") {
      query.set("blood_group", selectedGroup);
    }
    if (selectedDistrict !== "All Districts") {
      query.set("district", selectedDistrict);
    }
    if (selectedUrgency !== "ALL") {
      query.set("urgency", selectedUrgency);
    }
    if (filterCompatibleOnly && myProfile?.blood_group) {
      query.set("compatible_with", myProfile.blood_group);
    }

    try {
      const data = await apiFetch<BloodRequestPagination>(`/blood/requests?${query.toString()}`);
      setRequests(data.items);
      setTotal(data.total);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [selectedGroup, selectedDistrict, selectedUrgency, filterCompatibleOnly, myProfile?.blood_group]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* ========================================================= */}
      {/* 1. Header & Civic Introduction */}
      {/* ========================================================= */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-10 shadow-2xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60">
              <span>🩸</span>
              <span>{lang === "bn" ? t.blood_help_bn : t.blood_help}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {lang === "bn" ? "জরুরি রক্ত সহায়তা নেটওয়ার্ক" : "Community Blood Help Network"}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {lang === "bn"
                ? "কমিউনিটি রক্তদাতাদের সাথে দ্রুত যোগাযোগ করুন এবং রোগীর জীবন বাঁচাতে পাশে থাকুন। কোনো ফি বা মধ্যস্বত্বভোগী নেই।"
                : "Find or offer emergency blood support directly through verified community donors. 100% volunteer-driven and privacy-protected."}
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/blood-help/request"
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-sm transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <span>🚨</span>
              <span>{lang === "bn" ? "রক্ত প্রয়োজন (আবেদন)" : "Need Blood"}</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsDonorModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-5 py-3 text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-750 transition cursor-pointer shadow-2xs"
            >
              <span>❤️</span>
              <span>
                {myProfile
                  ? myProfile.availability_status === "AVAILABLE"
                    ? "🟢 My Donor Status (Active)"
                    : "⚪ My Donor Status (Off)"
                  : lang === "bn"
                  ? "রক্তদাতা হন"
                  : "Become a Donor"}
              </span>
            </button>
          </div>
        </div>

        {/* Compatibility Match Notice if Donor */}
        {myProfile && (
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200">
              <span className="font-black text-sm bg-rose-600 text-white px-2 py-0.5 rounded-lg">
                {myProfile.blood_group}
              </span>
              <span>
                Logged in as registered donor in <strong>{myProfile.area}, {myProfile.district}</strong>.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFilterCompatibleOnly(!filterCompatibleOnly)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                filterCompatibleOnly
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "border border-rose-300 dark:border-rose-800 bg-white dark:bg-zinc-900 text-rose-700 dark:text-rose-300"
              }`}
            >
              {filterCompatibleOnly ? "✓ Showing Compatible for Me" : "Show Only Requests I Can Donate To"}
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. Interactive Filter Strip */}
      {/* ========================================================= */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4">
        {/* Blood Group Quick Pills */}
        <div>
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
            Filter by Blood Group
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedGroup("ALL")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer border ${
                selectedGroup === "ALL"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent shadow-2xs"
                  : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
              }`}
            >
              All Groups
            </button>
            {BLOOD_GROUPS.map((bg) => (
              <button
                type="button"
                key={bg}
                onClick={() => setSelectedGroup(bg)}
                className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer border ${
                  selectedGroup === bg
                    ? "bg-rose-600 text-white border-rose-600 shadow-2xs scale-105"
                    : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-rose-400"
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
              District
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
            >
              {BD_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
              Urgency Level
            </label>
            <select
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
            >
              <option value="ALL">All Urgencies</option>
              <option value="EMERGENCY">🚨 Emergency (Immediate)</option>
              <option value="URGENT">⚠️ Urgent (Within 24h)</option>
              <option value="NORMAL">ℹ️ Normal (Scheduled)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setSelectedGroup("ALL");
                setSelectedDistrict("All Districts");
                setSelectedUrgency("ALL");
                setFilterCompatibleOnly(false);
              }}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 p-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-750 transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. Active Requests Listing Grid */}
      {/* ========================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>🩸 Active Blood Requests</span>
            <span className="rounded-full bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 text-xs text-rose-700 dark:text-rose-400 font-bold border border-rose-200/60 dark:border-rose-900/60">
              {total}
            </span>
          </h2>
          <span className="text-xs text-zinc-400">
            Updated in real-time
          </span>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 animate-pulse shadow-2xs"
              >
                <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-1/3" />
                <div className="h-4 bg-zinc-100 dark:bg-zinc-800/60 rounded w-3/4" />
                <div className="h-10 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-3">
            <span className="text-3xl">🕊️</span>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
              No matching blood requests found
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              There are currently no active emergency requests matching your chosen filters. Check back soon or register as a donor.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="group rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs hover:border-rose-600 transition flex flex-col justify-between gap-4"
              >
                {/* Card Top: Blood Badge & Urgency */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center justify-center rounded-2xl bg-rose-600 text-white font-black text-base px-3 py-1.5 shadow-2xs">
                      {req.blood_group}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          req.urgency === "EMERGENCY"
                            ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-900/80"
                            : req.urgency === "URGENT"
                            ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/80"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        {req.urgency === "EMERGENCY" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                        )}
                        <span>{req.urgency}</span>
                      </span>

                      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                        {req.units_required} {req.units_required === 1 ? "Bag" : "Bags"}
                      </span>
                    </div>
                  </div>

                  {/* Hospital & Location */}
                  <div>
                    <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 group-hover:text-rose-600 transition line-clamp-1">
                      {req.hospital_name}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                      📍 {req.hospital_area}, {req.district}
                    </p>
                  </div>

                  {/* Incident Date & Time */}
                  <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-[11px] space-y-1">
                    <div className="flex justify-between text-zinc-600 dark:text-zinc-300">
                      <span className="text-zinc-400">Needed by:</span>
                      <span className="font-bold">
                        {new Date(req.required_date).toLocaleDateString()}{" "}
                        {req.required_time ? `• ${req.required_time}` : ""}
                      </span>
                    </div>
                    {req.response_count > 0 && (
                      <div className="flex justify-between text-emerald-600 font-semibold">
                        <span>Community Response:</span>
                        <span>{req.response_count} donor(s) responded</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-zinc-400">
                    Ref: {req.id.slice(0, 8)}
                  </span>
                  <Link
                    href={`/blood-help/${req.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-rose-600 dark:hover:bg-rose-600 text-white dark:text-zinc-900 dark:hover:text-white px-3.5 py-2 text-xs font-bold transition shadow-2xs"
                  >
                    <span>I Can Help</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Donor Modal */}
      <DonorProfileModal
        isOpen={isDonorModalOpen}
        onClose={() => setIsDonorModalOpen(false)}
        onUpdated={() => {
          if (isAuthenticated) {
            apiFetch<BloodDonorProfile | null>("/blood/donor-profile")
              .then((p) => setMyProfile(p))
              .catch(() => {});
          }
        }}
      />
    </div>
  );
}
