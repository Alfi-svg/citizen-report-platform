"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { AreaReference, NearbyEmergencyServicesResult, NearbyServiceResponse } from "@/lib/types";
import { translations, Language } from "@/lib/i18n";

export default function SafetyCenterPage() {
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

  // Geolocation & Data State
  const [areas, setAreas] = useState<AreaReference[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [result, setResult] = useState<NearbyEmergencyServicesResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [activeLocationName, setActiveLocationName] = useState<string>("");
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>("ALL");

  // Fetch preconfigured manual areas on mount
  useEffect(() => {
    let isMounted = true;
    apiFetch<AreaReference[]>("/safety/services/areas")
      .then((data) => {
        if (isMounted) setAreas(data);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch nearby services for given lat/lng
  const fetchNearbyServices = async (lat: number, lng: number, locationLabel?: string) => {
    setLoading(true);
    setGeoError(null);
    setPermissionDenied(false);
    try {
      const data = await apiFetch<NearbyEmergencyServicesResult>(
        `/safety/services/nearby?latitude=${lat}&longitude=${lng}&radius_km=25.0`
      );
      setResult(data);
      if (locationLabel) {
        setActiveLocationName(locationLabel);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setGeoError(err.message);
      } else {
        setGeoError(lang === "bn" ? "জরুরি সেবা সংক্রান্ত তথ্য পেতে সমস্যা হচ্ছে।" : "An unexpected error occurred fetching emergency services.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Request browser geolocation ONLY on explicit citizen click
  const handleUseCurrentLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGeoError(t.error_unavailable);
      return;
    }

    setLoading(true);
    setGeoError(null);
    setPermissionDenied(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setActiveLocationName(lang === "bn" ? "আপনার বর্তমান অবস্থান (GPS)" : "Your Current Location (GPS)");
        setSelectedAreaId("");
        fetchNearbyServices(latitude, longitude);
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionDenied(true);
          setGeoError(t.permission_denied_desc);
        } else {
          setGeoError(t.error_unavailable);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle manual area selection
  const handleAreaSelect = (areaId: string) => {
    setSelectedAreaId(areaId);
    const selected = areas.find((a) => a.id === areaId);
    if (selected) {
      const label = lang === "bn" ? `${selected.name_bn}, ${selected.district_bn}` : `${selected.name}, ${selected.district}`;
      setActiveLocationName(label);
      fetchNearbyServices(selected.latitude, selected.longitude, label);
    }
  };

  // Filter nearby units
  const filteredNearbyServices = result?.nearby_services.filter((s) => {
    if (selectedServiceFilter === "ALL") return true;
    if (selectedServiceFilter === "POLICE_STATION") return s.service_type === "POLICE_STATION";
    if (selectedServiceFilter === "POLICE_BOX") return s.service_type === "POLICE_BOX";
    if (selectedServiceFilter === "FIRE_SERVICE") return s.service_type === "FIRE_SERVICE";
    if (selectedServiceFilter === "OTHER") {
      return s.service_type !== "POLICE_STATION" && s.service_type !== "POLICE_BOX" && s.service_type !== "FIRE_SERVICE";
    }
    return true;
  }) || [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* 1. SAFETY CENTER HEADER */}
      <div className="space-y-2 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-900/60 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
              <span>{lang === "bn" ? "জরুরি ও নাগরিক সুরক্ষা হাব" : "Civic Safety & Emergency Hub"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {lang === "bn" ? "নিরাপত্তা কেন্দ্র ও নেভিগেটর" : "Safety Center & Navigator"}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
              {lang === "bn"
                ? "নিকটস্থ পুলিশ স্টেশন, পুলিশ বক্স ও জরুরি সেবা খুঁজুন, সুরক্ষা ম্যাপ পর্যবেক্ষণ করুন এবং জরুরি হটলাইনে সরাসরি যোগাযোগ করুন।"
                : "Find nearby police stations, police boxes, and emergency services, explore the interactive safety map, and access 24/7 verified civic hotlines."}
            </p>
          </div>

          <Link
            href="/safety-map"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-xs font-bold text-zinc-800 dark:text-zinc-200 shadow-2xs transition self-start sm:self-auto shrink-0"
          >
            <span>🗺️</span>
            <span>{lang === "bn" ? "সেফটি ম্যাপ দেখুন" : "Explore Safety Map"}</span>
          </Link>
        </div>
      </div>

      {/* 2. NATIONAL EMERGENCY HELP (999 & CIVIC HELPLINES) */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {lang === "bn" ? "জরুরি জাতীয় হটলাইন" : "National Emergency Hotlines"}
        </h2>

        {/* Primary 999 Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-red-600 to-red-700 p-6 sm:p-8 text-white shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-1.5 max-w-lg">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-red-800/60 px-3 py-0.5 text-[11px] font-bold tracking-wider uppercase text-red-100">
                <span>🇧🇩</span> {lang === "bn" ? t.national_emergency_title : "National Emergency Service"}
              </div>
              <h3 className="text-3xl sm:text-4xl font-black tracking-tight">
                999
              </h3>
              <p className="text-xs sm:text-sm text-red-100 leading-relaxed">
                {lang === "bn"
                  ? "পুলিশ, ফায়ার সার্ভিস ও অ্যাম্বুলেন্সের জন্য ২৪/৭ সার্বক্ষণিক টোল-ফ্রি জাতীয় হটলাইন।"
                  : "24/7 Toll-Free National Emergency Helpline for Police, Fire Service, and Ambulance across Bangladesh."}
              </p>
            </div>

            <a
              href="tel:999"
              className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-white px-8 py-4 text-base font-black text-red-600 shadow-md hover:bg-red-50 active:scale-95 transition text-center shrink-0"
            >
              <span className="text-xl">📞</span>
              <span>{t.emergency_call_999}</span>
            </a>
          </div>
        </div>

        {/* Secondary Civic Hotlines */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href="tel:109"
            className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-red-400 dark:hover:border-red-800 transition shadow-2xs group"
          >
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                {lang === "bn" ? "নারী ও শিশু সুরক্ষা" : "Women & Children Helpline"}
              </span>
              <span className="text-base font-black text-zinc-900 dark:text-zinc-100 mt-0.5 block group-hover:text-red-600 transition">
                109
              </span>
            </div>
            <span className="h-8 w-8 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-sm">
              📞
            </span>
          </a>

          <a
            href="tel:333"
            className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-400 dark:hover:border-blue-800 transition shadow-2xs group"
          >
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                {lang === "bn" ? "জাতীয় তথ্য ও দুর্যোগ সেবা" : "National Info & Disaster"}
              </span>
              <span className="text-base font-black text-zinc-900 dark:text-zinc-100 mt-0.5 block group-hover:text-blue-600 transition">
                333
              </span>
            </div>
            <span className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
              📞
            </span>
          </a>

          <a
            href="tel:106"
            className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-400 dark:hover:border-emerald-800 transition shadow-2xs group"
          >
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                {lang === "bn" ? "দুর্নীতি দমন কমিশন হটলাইন" : "Anti-Corruption Hotline"}
              </span>
              <span className="text-base font-black text-zinc-900 dark:text-zinc-100 mt-0.5 block group-hover:text-emerald-600 transition">
                106
              </span>
            </div>
            <span className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
              📞
            </span>
          </a>
        </div>
      </section>

      {/* 3. CIVIC SAFETY TOOLS STRIP (Clean, Compact, No Heavy Card Clutter) */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-400 font-semibold">{lang === "bn" ? "অন্যান্য সুরক্ষা টুলস:" : "Related Safety Tools:"}</span>
        <Link
          href="/safety-map"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-emerald-500 text-xs font-semibold shadow-2xs transition"
        >
          <span>🗺️</span>
          <span>{lang === "bn" ? "লাইভ সেফটি ম্যাপ" : "Safety Map"}</span>
        </Link>
        <Link
          href="/missing-person"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-amber-500 text-xs font-semibold shadow-2xs transition"
        >
          <span>🔍</span>
          <span>{lang === "bn" ? "নিখোঁজ ব্যক্তি সন্ধান" : "Missing Persons"}</span>
        </Link>
        <Link
          href="/blood-help"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-rose-500 text-xs font-semibold shadow-2xs transition"
        >
          <span>🩸</span>
          <span>{lang === "bn" ? "রক্ত সহায়তা" : "Blood Help"}</span>
        </Link>
      </div>

      {/* 4. FIND HELP NEAR ME (SAFETY NAVIGATOR) */}
      <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {activeLocationName ? (
                <span className="flex items-center gap-2">
                  <span>📍</span>
                  <span>{lang === "bn" ? "নির্বাচিত এলাকা:" : "Selected Area:"}</span>
                  <strong className="text-emerald-700 dark:text-emerald-400">{activeLocationName}</strong>
                </span>
              ) : (
                <span>{lang === "bn" ? "কাছাকাছি সাহায্য খুঁজুন (সেফটি নেভিগেটর)" : "Find Help Near Me (Safety Navigator)"}</span>
              )}
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-xl">
              {t.privacy_notice}
            </p>
          </div>

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 px-5 py-3 text-xs font-bold text-white shadow-2xs transition self-start sm:self-auto shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>{t.locating}</span>
              </>
            ) : (
              <>
                <span>🎯</span>
                <span>{t.find_near_me}</span>
              </>
            )}
          </button>
        </div>

        {/* Location Permission Denied / Error State */}
        {geoError && (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-bold">
              ⚠️ {permissionDenied ? t.permission_denied_title : (lang === "bn" ? "অবস্থান শনাক্তকরণ সতর্কতা" : "Location Access Notice")}:
            </p>
            <p>{geoError}</p>
          </div>
        )}

        {/* Manual Area Fallback Selector */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              {t.quick_select_title}
            </label>
            {selectedAreaId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedAreaId("");
                  setActiveLocationName("");
                  setResult(null);
                }}
                className="text-xs text-red-600 hover:underline font-bold"
              >
                {lang === "bn" ? "রিসেট করুন" : "Reset Area"}
              </button>
            )}
          </div>

          {/* Quick Select Buttons */}
          <div className="flex flex-wrap gap-2">
            {areas.slice(0, 8).map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => handleAreaSelect(area.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition select-none ${
                  selectedAreaId === area.id
                    ? "bg-emerald-700 text-white shadow-2xs font-bold"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {lang === "bn" ? area.name_bn : area.name}
              </button>
            ))}
          </div>

          {/* Full Dropdown for all areas */}
          <div className="pt-1">
            <select
              value={selectedAreaId}
              onChange={(e) => handleAreaSelect(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              <option value="">-- {t.select_area_placeholder} --</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {lang === "bn" ? `${a.name_bn} (${a.district_bn})` : `${a.name} (${a.district})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 5. LOADING STATE (SKELETON) */}
      {loading && (
        <div className="space-y-4">
          <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-48 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 animate-pulse"
              >
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
                <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3" />
                <div className="h-4 bg-zinc-100 dark:bg-zinc-800/60 rounded w-1/2" />
                <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-xl w-full pt-2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. EMERGENCY SERVICES RESULTS */}
      {!loading && result && (
        <section className="space-y-6">
          {/* Warning Banner if directory has unverified contacts */}
          {result.warning_message && (
            <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-3">
              <span className="text-lg">⚠️</span>
              <span>{t.contact_unverified_warning}</span>
            </div>
          )}

          {/* Results Summary Bar & Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {lang === "bn" ? "নিকটবর্তী সেবা কেন্দ্রসমূহ" : "Emergency Units Found"} ({result.total_found})
              </h3>
              <p className="text-[11px] text-zinc-400">
                {lang === "bn"
                  ? `${activeLocationName} এর ২৫ কিলোমিটার ব্যাসার্ধের মধ্যে অনুসন্ধানকৃত`
                  : `Located within 25 km radius of ${activeLocationName}`}
              </p>
            </div>

            {/* Service Type Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
              {[
                { key: "ALL", label: lang === "bn" ? "সকল" : "All Units" },
                { key: "POLICE_STATION", label: lang === "bn" ? "থানা" : "Police Stations" },
                { key: "POLICE_BOX", label: lang === "bn" ? "পুলিশ বক্স" : "Police Boxes" },
                { key: "FIRE_SERVICE", label: lang === "bn" ? "ফায়ার সার্ভিস" : "Fire Service" },
                { key: "OTHER", label: lang === "bn" ? "অন্যান্য" : "Other" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedServiceFilter(tab.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition select-none ${
                    selectedServiceFilter === tab.key
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs font-bold"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nearest Police Station Card */}
          {result.nearest_police_station && (selectedServiceFilter === "ALL" || selectedServiceFilter === "POLICE_STATION") && (
            <div className="rounded-3xl border-2 border-emerald-600/40 bg-white dark:bg-zinc-900 p-6 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60">
                    <span>🚓</span> {t.nearest_police}
                  </span>
                  {result.nearest_police_station.verification_status === "VERIFIED" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                      ✓ {t.status_verified}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                      ⚠️ {t.contact_unverified_warning}
                    </span>
                  )}
                </div>
                <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-extrabold text-zinc-900 dark:text-zinc-100">
                  📍 {result.nearest_police_station.distance_formatted}
                </div>
              </div>

              <div>
                <h4 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-100">
                  {lang === "bn" && result.nearest_police_station.name_bn
                    ? result.nearest_police_station.name_bn
                    : result.nearest_police_station.name}
                </h4>
                <p className="text-xs text-zinc-500 mt-1">
                  {lang === "bn" && result.nearest_police_station.address_bn
                    ? result.nearest_police_station.address_bn
                    : result.nearest_police_station.address}
                </p>
              </div>

              {/* Source & Freshness Metadata */}
              <div className="text-[11px] text-zinc-500 flex flex-wrap items-center gap-2">
                <span>{t.source_label}: {result.nearest_police_station.source}</span>
                {result.nearest_police_station.source_url && (
                  <a
                    href={result.nearest_police_station.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    ↗
                  </a>
                )}
                {result.nearest_police_station.last_verified_at && (
                  <span>• {t.last_verified}: {new Date(result.nearest_police_station.last_verified_at).toLocaleDateString()}</span>
                )}
                {result.nearest_police_station.is_fresh === false && (
                  <span className="text-amber-600 dark:text-amber-400">({t.status_outdated})</span>
                )}
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href={`tel:${result.nearest_police_station.phone}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-5 py-2.5 text-xs font-bold text-white shadow-2xs transition active:scale-95"
                >
                  <span>📞</span>
                  <span>{t.call_now}: {result.nearest_police_station.phone}</span>
                </a>
                <a
                  href={result.nearest_police_station.directions_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition"
                >
                  <span>🗺️</span>
                  <span>{t.get_directions}</span>
                </a>
              </div>
            </div>
          )}

          {/* Nearest Police Box Card */}
          {result.nearest_police_box && (selectedServiceFilter === "ALL" || selectedServiceFilter === "POLICE_BOX") && (
            <div className="rounded-3xl border border-blue-200 dark:border-blue-900/50 bg-white dark:bg-zinc-900 p-6 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 px-3 py-1 text-xs font-bold text-blue-800 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
                    <span>👮‍♂️</span> {t.nearest_police_box}
                  </span>
                  {result.nearest_police_box.verification_status === "VERIFIED" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                      ✓ {t.status_verified}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                      ⚠️ {t.contact_unverified_warning}
                    </span>
                  )}
                </div>
                <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-extrabold text-zinc-900 dark:text-zinc-100">
                  📍 {result.nearest_police_box.distance_formatted}
                </div>
              </div>

              <div>
                <h4 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {lang === "bn" && result.nearest_police_box.name_bn
                    ? result.nearest_police_box.name_bn
                    : result.nearest_police_box.name}
                </h4>
                <p className="text-xs text-zinc-500 mt-1">
                  {lang === "bn" && result.nearest_police_box.address_bn
                    ? result.nearest_police_box.address_bn
                    : result.nearest_police_box.address}
                </p>
              </div>

              {/* Source & Freshness */}
              <div className="text-[11px] text-zinc-500 flex flex-wrap items-center gap-2">
                <span>{t.source_label}: {result.nearest_police_box.source}</span>
                {result.nearest_police_box.source_url && (
                  <a
                    href={result.nearest_police_box.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    ↗
                  </a>
                )}
                {result.nearest_police_box.last_verified_at && (
                  <span>• {t.last_verified}: {new Date(result.nearest_police_box.last_verified_at).toLocaleDateString()}</span>
                )}
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href={`tel:${result.nearest_police_box.phone}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-2xs transition active:scale-95"
                >
                  <span>📞</span>
                  <span>{t.call_now}: {result.nearest_police_box.phone}</span>
                </a>
                <a
                  href={result.nearest_police_box.directions_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition"
                >
                  <span>🗺️</span>
                  <span>{t.get_directions}</span>
                </a>
              </div>
            </div>
          )}

          {/* All Other Nearby Emergency Units Grid */}
          {filteredNearbyServices.length > 0 ? (
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                {t.all_nearby} ({filteredNearbyServices.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredNearbyServices.map((s: NearbyServiceResponse) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-2xs hover:border-emerald-600/40 transition"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-500 uppercase tracking-wider text-[10px]">
                          {s.service_type === "POLICE_STATION" ? "🚓 Police" : s.service_type === "POLICE_BOX" ? "👮‍♂️ Police Box" : s.service_type === "FIRE_SERVICE" ? "🚒 Fire" : "🚑 Emergency"}
                        </span>
                        {s.verification_status === "VERIFIED" ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold">
                            ✓ {t.status_verified}
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold">
                            ⚠️ {t.status_unverified}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                        {s.distance_formatted}
                      </span>
                    </div>

                    <div>
                      <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {lang === "bn" && s.name_bn ? s.name_bn : s.name}
                      </h5>
                      <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                        {lang === "bn" && s.address_bn ? s.address_bn : s.address}
                      </p>
                    </div>

                    <div className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                      <span>{s.source}</span>
                      {s.last_verified_at && (
                        <span>• {new Date(s.last_verified_at).toLocaleDateString()}</span>
                      )}
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800">
                      <a
                        href={`tel:${s.phone}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                      >
                        <span>📞</span> {s.phone}
                      </a>
                      <a
                        href={s.directions_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      >
                        {t.get_directions} →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-zinc-500 space-y-2">
              <p>{t.no_results}</p>
            </div>
          )}
        </section>
      )}

      {/* 7. SAFETY INFORMATION & PRIVACY BEST PRACTICES */}
      <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-6 sm:p-8 space-y-4 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <span>🛡️</span>
          <span>{lang === "bn" ? "নাগরিক সুরক্ষা ও প্ল্যাটফর্ম নির্দেশিকা" : "Civic Safety & Platform Guidelines"}</span>
        </h3>
        <p>
          {lang === "bn"
            ? "বাংলাদেশ সিটিজেন রিপোর্ট প্ল্যাটফর্মের সেফটি নেভিগেটর নাগরিকদের জরুরি মুহূর্তে দ্রুততম সময়ে নির্ভরযোগ্য আইন প্রয়োগকারী সংস্থা ও ফায়ার সার্ভিসের সাথে যুক্ত করতে সাহায্য করে। প্রদত্ত প্রতিটি তথ্য প্রশাসনিকভাবে যাচাই করা হয় এবং সরকারি ডাটাবেস অনুযায়ী হালনাগাদ রাখা হয়।"
            : "The Citizen Safety Navigator connects citizens with verified law enforcement stations, police boxes, and fire services in real time. All listed contact points are regularly cross-checked with official registries to ensure data integrity and civic reliability."}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-[11px]">
          <div className="p-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
            <strong className="text-zinc-900 dark:text-zinc-100 block mb-1">
              🔒 {lang === "bn" ? "প্রাইভেসি নিশ্চয়তা" : "Zero-Tracking Guarantee"}
            </strong>
            <span>
              {lang === "bn"
                ? "আপনার ব্রাউজারের জিপিএস লোকেশন কখনোই সংরক্ষণ বা শেয়ার করা হয় না। কেবল নিকটস্থ কেন্দ্র নির্ণয়ে ব্যবহৃত হয়।"
                : "Your GPS coordinate is used strictly on-demand to compute Euclidean distance to emergency units. No tracking history is saved."}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
            <strong className="text-zinc-900 dark:text-zinc-100 block mb-1">
              ⚠️ {lang === "bn" ? "তাত্ক্ষণিক বিপদ" : "Immediate Danger"}
            </strong>
            <span>
              {lang === "bn"
                ? "জীবনহানি বা গুরুতর অপরাধের আশঙ্কায় সরাসরি জাতীয় জরুরি সেবা ৯৯৯-এ কল করার অনুরোধ করা হচ্ছে।"
                : "In life-threatening situations or ongoing crimes, immediately dial 999 for instant police, fire, or medical dispatch."}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
