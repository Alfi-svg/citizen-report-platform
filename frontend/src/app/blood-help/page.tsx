"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  PublicBloodRequest,
  BloodRequestPagination,
  BloodGroup,
  BloodDonorProfile,
  HospitalSummary,
  HospitalListResponse,
} from "@/lib/types";
import { translations, Language } from "@/lib/i18n";
import { useAuth } from "@/context/AuthContext";
import DonorProfileModal from "@/components/DonorProfileModal";
import AIBloodSearchCard from "@/components/AIBloodSearchCard";
import HospitalResultCard from "@/components/HospitalResultCard";
import HospitalDetailModal from "@/components/HospitalDetailModal";
import {
  Droplets,
  AlertTriangle,
  Map,
  Heart,
  Check,
  MapPin,
  Bot,
  Building2,
  Search,
  Navigation,
  RotateCcw,
  ArrowUpDown,
} from "lucide-react";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const BD_DISTRICTS = [
  "All Districts", "Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Rangpur", "Mymensingh",
  "Gazipur", "Narayanganj", "Cumilla", "Bogura", "Cox's Bazar", "Noakhali", "Feni", "Brahmanbaria",
  "Jessore", "Kushtia", "Pabna", "Dinajpur", "Tangail", "Faridpur", "Jamalpur"
];

function BloodHelpContent() {
  const { isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
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

  const isBn = lang === "bn";
  const t = translations[lang];

  // Primary Tab Switcher: "hospitals" vs "requests"
  const initialTab = searchParams.get("tab") === "requests" ? "requests" : "hospitals";
  const [activeTab, setActiveTab] = useState<"hospitals" | "requests">(initialTab);

  // =========================================================
  // PART 1: Hospital & Blood Stock Finder State
  // =========================================================
  const [hospitals, setHospitals] = useState<HospitalSummary[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const [hospitalError, setHospitalError] = useState<string | null>(null);

  // Hospital Filters
  const [hospSearch, setHospSearch] = useState<string>("");
  const [hospBloodGroup, setHospBloodGroup] = useState<string>("ALL");
  const [hospDistrict, setHospDistrict] = useState<string>("All Districts");
  const [hospSortBy, setHospSortBy] = useState<string>("distance");
  const [hospVerifiedOnly, setHospVerifiedOnly] = useState<boolean>(false);

  // Geolocation for Distance Calculation
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  // Detail Modal State
  const [selectedHospitalForModal, setSelectedHospitalForModal] = useState<HospitalSummary | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // =========================================================
  // PART 2: Citizen Blood Requests & Donor State
  // =========================================================
  const [requests, setRequests] = useState<PublicBloodRequest[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Request Filters
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("All Districts");
  const [selectedUrgency, setSelectedUrgency] = useState<string>("ALL");
  const [filterCompatibleOnly, setFilterCompatibleOnly] = useState(false);

  // Donor Profile Modal
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

  // Request HTML5 Geolocation
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationNotice(isBn ? "ব্রাউজার লোকেশন সমর্থন করে না" : "Geolocation not supported");
      return;
    }
    setIsLocating(true);
    setLocationNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        setIsLocating(false);
        setLocationNotice(isBn ? "বর্তমান অবস্থান যুক্ত হয়েছে" : "Current GPS location active");
      },
      () => {
        setIsLocating(false);
        setLocationNotice(isBn ? "লোকেশন অনুমতি মেলেনি (ম্যানুয়ালি জেলা বাছুন)" : "GPS denied (select district)");
      },
      { timeout: 9000, enableHighAccuracy: true }
    );
  };

  // Load Hospitals & Blood Inventory from Backend
  const loadHospitals = useCallback(async () => {
    setLoadingHospitals(true);
    setHospitalError(null);

    const query = new URLSearchParams();
    query.set("limit", "40");

    if (userCoords) {
      query.set("lat", userCoords.lat.toString());
      query.set("lng", userCoords.lng.toString());
      query.set("radius_km", "50.0");
    }

    if (hospDistrict !== "All Districts") {
      query.set("district", hospDistrict);
    }

    if (hospBloodGroup !== "ALL") {
      query.set("blood_group", hospBloodGroup);
    }

    if (hospSearch.trim()) {
      query.set("q", hospSearch.trim());
    }

    if (hospVerifiedOnly) {
      query.set("verified_only", "true");
    }

    if (hospSortBy) {
      query.set("sort_by", hospSortBy);
    }

    try {
      const data = await apiFetch<HospitalListResponse>(`/blood/hospitals/nearby?${query.toString()}`);
      setHospitals(data.items);
    } catch (err: unknown) {
      setHospitalError(err instanceof Error ? err.message : "Failed to load hospitals and blood stock");
    } finally {
      setLoadingHospitals(false);
    }
  }, [userCoords, hospDistrict, hospBloodGroup, hospSearch, hospVerifiedOnly, hospSortBy]);

  useEffect(() => {
    if (activeTab === "hospitals") {
      loadHospitals();
    }
  }, [activeTab, loadHospitals]);

  // Load Citizen Blood Requests
  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    setRequestError(null);

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
      setTotalRequests(data.total);
    } catch (err: unknown) {
      if (err instanceof Error) setRequestError(err.message);
    } finally {
      setLoadingRequests(false);
    }
  }, [selectedGroup, selectedDistrict, selectedUrgency, filterCompatibleOnly, myProfile]);

  useEffect(() => {
    if (activeTab === "requests") {
      loadRequests();
    }
  }, [activeTab, loadRequests]);

  const handleOpenDetailModal = (hosp: HospitalSummary) => {
    setSelectedHospitalForModal(hosp);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* ========================================================= */}
      {/* 1. Header & Civic Introduction */}
      {/* ========================================================= */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-10 shadow-2xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60">
              <Droplets className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              <span>{lang === "bn" ? t.blood_help_bn : t.blood_help}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {lang === "bn" ? "হাসপাতাল রক্তের স্টক ও জরুরি রক্ত সহায়তা নেটওয়ার্ক" : "Hospital Blood Stock Finder & Community Blood Help"}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {lang === "bn"
                ? "নিকটস্থ হাসপাতাল ও ব্লাড ব্যাংকের লাইভ রক্তের গ্রুপ স্টক, জরুরি ফোন নম্বর ও ড্রাইভিং দূরত্ব জানুন। কমিউনিটি রক্তদাতাদের সাথে মধ্যস্বত্বভোগীহীন সরাসরি যোগাযোগ করুন।"
                : "Search verified hospital blood banks, available blood units by group, travel distance, and emergency contacts across Bangladesh. 100% volunteer-driven and privacy-protected."}
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/blood-help/blood-ai"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 px-5 py-3 text-xs sm:text-sm font-black text-white shadow-sm transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <Bot className="h-4 w-4" />
              <span>{lang === "bn" ? "ব্লাড এআই সহকারী" : "Blood AI Assistant"}</span>
            </Link>

            <Link
              href="/blood-help/request"
              className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-5 py-3 text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300 transition cursor-pointer shadow-2xs"
            >
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span>{lang === "bn" ? "রক্ত প্রয়োজন (আবেদন)" : "Need Blood"}</span>
            </Link>

            <Link
              href="/blood-help/map"
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-5 py-3 text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-750 transition cursor-pointer shadow-2xs"
            >
              <Map className="h-4 w-4" />
              <span>{lang === "bn" ? "মানচিত্র ভিউ" : "Map View"}</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsDonorModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-5 py-3 text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-750 transition cursor-pointer shadow-2xs"
            >
              <Heart className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <span>
                {myProfile
                  ? myProfile.availability_status === "AVAILABLE"
                    ? "My Donor Status (Active)"
                    : "My Donor Status (Off)"
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
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                filterCompatibleOnly
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "border border-rose-300 dark:border-rose-800 bg-white dark:bg-zinc-900 text-rose-700 dark:text-rose-300"
              }`}
            >
              {filterCompatibleOnly ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Showing Compatible for Me</span>
                </>
              ) : (
                <span>Show Only Requests I Can Donate To</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. Top-Level Section Tabs */}
      {/* ========================================================= */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 gap-4 sm:gap-6 text-sm font-black">
        <button
          type="button"
          onClick={() => setActiveTab("hospitals")}
          className={`pb-3.5 flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === "hospitals"
              ? "border-rose-600 text-rose-600 dark:text-rose-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>{isBn ? "হাসপাতাল ও রক্তের স্টক ফাইন্ডার" : "Hospital & Blood Stock Finder"}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300">
            {hospitals.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          className={`pb-3.5 flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === "requests"
              ? "border-rose-600 text-rose-600 dark:text-rose-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <Droplets className="h-4 w-4" />
          <span>{isBn ? "নাগরিক রক্ত আবেদন ও ডোনার" : "Citizen Blood Requests & Donors"}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {totalRequests}
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: Hospital & Blood Stock Finder */}
      {/* ========================================================= */}
      {activeTab === "hospitals" && (
        <div className="space-y-6">
          {/* Controls & Filter Panel */}
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-2xs space-y-4">
            {/* Search Input & District & GPS Button */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Text Search */}
              <div className="md:col-span-5 relative">
                <Search className="h-4 w-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={hospSearch}
                  onChange={(e) => setHospSearch(e.target.value)}
                  placeholder={isBn ? "হাসপাতাল নাম, ব্লাড ব্যাংক বা এলাকা লিখুন..." : "Search hospital name, blood bank, or area..."}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* District Dropdown */}
              <div className="md:col-span-4">
                <select
                  value={hospDistrict}
                  onChange={(e) => setHospDistrict(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                >
                  {BD_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* GPS Location Button */}
              <div className="md:col-span-3">
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={isLocating}
                  className={`w-full py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs ${
                    userCoords
                      ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                      : "border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  <Navigation className={`h-3.5 w-3.5 ${isLocating ? "animate-spin" : "text-sky-600"}`} />
                  <span>
                    {isLocating
                      ? (isBn ? "লোকেশন খোঁজা হচ্ছে..." : "Locating...")
                      : userCoords
                      ? (isBn ? "জিপিএস সক্রিয় (নিকটস্থ)" : "GPS Active (Nearby)")
                      : (isBn ? "আমার লোকেশন দিন" : "Use My Location")}
                  </span>
                </button>
              </div>
            </div>

            {locationNotice && (
              <p className="text-[11px] text-zinc-500 font-medium">
                {locationNotice}
              </p>
            )}

            {/* Blood Group Quick Select Pills */}
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                {isBn ? "রক্তের গ্রুপ অনুযায়ী হাসপাতাল খুঁজুন:" : "Filter Hospitals by Blood Group Stock:"}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setHospBloodGroup("ALL")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer border ${
                    hospBloodGroup === "ALL"
                      ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                      : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300"
                  }`}
                >
                  {isBn ? "সকল গ্রুপ" : "All Groups"}
                </button>
                {BLOOD_GROUPS.map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setHospBloodGroup(bg)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer border ${
                      hospBloodGroup === bg
                        ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                        : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300"
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            {/* Sorting & Verification Toggle Row */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400" />
                <span className="font-bold text-zinc-500">{isBn ? "সাজান:" : "Sort by:"}</span>
                <select
                  value={hospSortBy}
                  onChange={(e) => setHospSortBy(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                >
                  <option value="distance">{isBn ? "নিকটতম দূরত্ব (Nearest)" : "Nearest Distance"}</option>
                  <option value="travel_time">{isBn ? "স্বল্পতম ড্রাইভিং সময় (Shortest Travel)" : "Shortest Travel Time"}</option>
                  <option value="stock">{isBn ? "সর্বোচ্চ রক্ত মজুদ (Highest Stock)" : "Highest Blood Stock"}</option>
                  <option value="verified">{isBn ? "যাচাইকৃত হাসপাতাল প্রথমে" : "Verified Hospitals First"}</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-zinc-700 dark:text-zinc-300 select-none">
                  <input
                    type="checkbox"
                    checked={hospVerifiedOnly}
                    onChange={(e) => setHospVerifiedOnly(e.target.checked)}
                    className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
                  />
                  <span>{isBn ? "শুধুমাত্র যাচাইকৃত হাসপাতাল" : "Verified Only"}</span>
                </label>

                {(hospSearch || hospBloodGroup !== "ALL" || hospDistrict !== "All Districts" || hospVerifiedOnly) && (
                  <button
                    type="button"
                    onClick={() => {
                      setHospSearch("");
                      setHospBloodGroup("ALL");
                      setHospDistrict("All Districts");
                      setHospVerifiedOnly(false);
                      setHospSortBy("distance");
                    }}
                    className="text-xs text-rose-600 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>{isBn ? "ফিল্টার মুছুন" : "Reset"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {hospitalError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{hospitalError}</span>
              </div>
              <button
                type="button"
                onClick={loadHospitals}
                className="px-3 py-1 rounded-xl bg-rose-600 text-white font-bold text-xs"
              >
                {isBn ? "পুনরায় চেষ্টা করুন" : "Retry"}
              </button>
            </div>
          )}

          {/* Hospital Results Grid */}
          {loadingHospitals ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 animate-pulse shadow-2xs"
                >
                  <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-1/2" />
                  <div className="h-4 bg-zinc-100 dark:bg-zinc-800/60 rounded w-3/4" />
                  <div className="h-14 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl" />
                </div>
              ))}
            </div>
          ) : hospitals.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-3 bg-white/50 dark:bg-zinc-900/50">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mx-auto">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                {isBn ? "কোনো হাসপাতাল পাওয়া যায়নি" : "No hospitals matching your filter"}
              </h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                {isBn
                  ? "নির্বাচিত জেলা বা সার্চ শর্তে কোনো হাসপাতাল মেলেনি। জেলা পরিবর্তন করুন অথবা ফিল্টার রিসেট করুন।"
                  : "No hospitals found matching the current search parameters. Try expanding your search district or resetting blood group filters."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setHospSearch("");
                  setHospBloodGroup("ALL");
                  setHospDistrict("All Districts");
                  setHospVerifiedOnly(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs"
              >
                {isBn ? "সকল হাসপাতাল দেখুন" : "View All Hospitals"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hospitals.map((hosp) => (
                <HospitalResultCard
                  key={hosp.id}
                  hospital={hosp}
                  selectedBloodGroup={hospBloodGroup !== "ALL" ? hospBloodGroup : null}
                  lang={lang}
                  onSelectHospital={handleOpenDetailModal}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: Citizen Blood Requests & Donors */}
      {/* ========================================================= */}
      {activeTab === "requests" && (
        <div className="space-y-6">
          {/* AI Natural Language Search Card */}
          <AIBloodSearchCard lang={lang} />

          {/* Interactive Filter Strip */}
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
                      ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                      : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300"
                  }`}
                >
                  All
                </button>
                {BLOOD_GROUPS.map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setSelectedGroup(bg)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer border ${
                      selectedGroup === bg
                        ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                        : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300"
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            {/* Dropdowns: District & Urgency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  District
                </label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                >
                  {BD_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Urgency Level
                </label>
                <select
                  value={selectedUrgency}
                  onChange={(e) => setSelectedUrgency(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 px-3 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                >
                  <option value="ALL">All Urgencies</option>
                  <option value="EMERGENCY">Emergency (Immediate)</option>
                  <option value="URGENT">Urgent (Within 24h)</option>
                  <option value="ROUTINE">Standard Routine</option>
                </select>
              </div>
            </div>
          </div>

          {/* Requests Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>{lang === "bn" ? "সক্রিয় রক্তের আবেদন" : "Active Emergency Requests"}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-extrabold">
                  {totalRequests}
                </span>
              </h2>
            </div>

            {requestError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 mb-4 flex items-center justify-between">
                <span>{requestError}</span>
                <button
                  type="button"
                  onClick={loadRequests}
                  className="font-bold underline cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {loadingRequests ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
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
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mx-auto">
                  <Droplets className="h-6 w-6" />
                </div>
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
                    className="group rounded-3xl border border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 shadow-2xs hover:border-rose-500/60 hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-4"
                  >
                    {/* Card Top: Blood Badge & Urgency */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-rose-600 to-red-700 text-white font-black text-base px-3.5 py-1.5 shadow-sm shadow-rose-600/30">
                          {req.blood_group}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border backdrop-blur-xs ${
                              req.urgency === "EMERGENCY"
                                ? "bg-rose-50/80 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-900/80 shadow-2xs shadow-rose-500/20"
                                : req.urgency === "URGENT"
                                ? "bg-amber-50/80 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/80"
                                : "bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                            }`}
                          >
                            {req.urgency === "EMERGENCY" && (
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                            )}
                            <span>{req.urgency}</span>
                          </span>

                          <span className="rounded-full bg-zinc-100/80 dark:bg-zinc-800/80 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-zinc-500">
                            {req.units_required} {req.units_required === 1 ? "Bag" : "Bags"}
                          </span>
                        </div>
                      </div>

                      {/* Hospital & Location */}
                      <div>
                        <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 group-hover:text-rose-600 transition line-clamp-1">
                          {req.hospital_name}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          <span>{req.hospital_area}, {req.district}</span>
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
        </div>
      )}

      {/* Hospital Detail Modal */}
      <HospitalDetailModal
        hospital={selectedHospitalForModal}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedHospitalForModal(null);
        }}
        lang={lang}
        userCoords={userCoords}
      />

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

export default function BloodHelpPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500 font-semibold">Loading Blood Help Network...</div>}>
      <BloodHelpContent />
    </Suspense>
  );
}
