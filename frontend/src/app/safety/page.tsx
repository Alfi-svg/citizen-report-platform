"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { AreaReference, NearbyEmergencyServicesResult } from "@/lib/types";
import { translations, Language } from "@/lib/i18n";

export default function SafetyNavigatorPage() {
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  // Geolocation & Data State
  const [areas, setAreas] = useState<AreaReference[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [result, setResult] = useState<NearbyEmergencyServicesResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [activeLocationName, setActiveLocationName] = useState<string>("");

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
        setGeoError("An unexpected error occurred fetching emergency services.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Request browser geolocation on explicit user click
  const handleUseCurrentLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGeoError(t.error_unavailable);
      return;
    }

    setLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setActiveLocationName(lang === "bn" ? "আপনার বর্তমান অবস্থান" : "Your Current Location");
        fetchNearbyServices(latitude, longitude);
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Top Bar: Title & Language Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white text-lg font-bold shadow-sm">
            🚨
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {t.safety_navigator}
            </h1>
            <p className="text-xs text-zinc-500">
              {lang === "bn" ? "বাংলাদেশ জরুরি পুলিশ ও সুরক্ষা সেবা" : "Bangladesh Emergency Police & Safety Services"}
            </p>
          </div>
        </div>

        {/* Bilingual Language Switcher */}
        <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setLang("en")}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
              lang === "en" ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLang("bn")}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
              lang === "bn" ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            বাংলা
          </button>
        </div>
      </div>

      {/* 1. NATIONAL EMERGENCY BANNER (999) - HIGH PRIORITY MOBILE FIRST */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-600 to-red-700 p-6 sm:p-8 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-1.5 max-w-lg">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-red-800/60 px-3 py-0.5 text-[11px] font-bold tracking-wider uppercase text-red-100">
              <span>🇧🇩</span> {lang === "bn" ? t.national_emergency_title : "National Emergency Service"}
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              999
            </h2>
            <p className="text-xs sm:text-sm text-red-100 leading-relaxed">
              {lang === "bn" ? t.national_emergency_desc : "24/7 Toll-Free National Emergency Helpline for Police, Fire Service, and Ambulance."}
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
      </section>

      {/* 2. LOCATION ACCESS & MANUAL SELECTOR */}
      <section className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {activeLocationName ? (
                <span className="flex items-center gap-2">
                  <span>📍</span> {lang === "bn" ? "নির্বাচিত এলাকা:" : "Selected Area:"}{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400">{activeLocationName}</strong>
                </span>
              ) : (
                lang === "bn" ? "নিকটস্থ পুলিশ স্টেশন ও পুলিশ বক্স খুঁজুন" : "Find Your Nearest Police Station & Police Box"
              )}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {t.privacy_notice}
            </p>
          </div>

          <button
            onClick={handleUseCurrentLocation}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-6 py-3 text-xs font-bold text-white shadow-sm transition active:scale-95 shrink-0 disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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

        {/* Error Alert */}
        {geoError && (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
            <strong>⚠️ {lang === "bn" ? "সতর্কবার্তা" : "Notice"}:</strong> {geoError}
          </div>
        )}

        {/* Manual Area Quick Selector */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {t.quick_select_title}
          </label>
          <div className="flex flex-wrap gap-2">
            {areas.slice(0, 8).map((area) => (
              <button
                key={area.id}
                onClick={() => handleAreaSelect(area.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedAreaId === area.id
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {lang === "bn" ? area.name_bn : area.name}
              </button>
            ))}
          </div>

          {/* Full Dropdown for all areas */}
          <div className="pt-2">
            <select
              value={selectedAreaId}
              onChange={(e) => handleAreaSelect(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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

      {/* 3. EMERGENCY SERVICES RESULTS */}
      {result && (
        <section className="space-y-6">
          {/* Nearest Police Station Card */}
          {result.nearest_police_station && (
            <div className="rounded-3xl border-2 border-emerald-500/40 bg-white dark:bg-zinc-900 p-6 shadow-md relative overflow-hidden">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <span>🚓</span> {t.nearest_police}
                </div>
                <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-extrabold text-zinc-900 dark:text-zinc-100">
                  📍 {result.nearest_police_station.distance_formatted}
                </div>
              </div>

              <h3 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-zinc-100">
                {lang === "bn" && result.nearest_police_station.name_bn
                  ? result.nearest_police_station.name_bn
                  : result.nearest_police_station.name}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                {lang === "bn" && result.nearest_police_station.address_bn
                  ? result.nearest_police_station.address_bn
                  : result.nearest_police_station.address}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a
                  href={`tel:${result.nearest_police_station.phone}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95"
                >
                  <span>📞</span>
                  <span>{t.call_now}: {result.nearest_police_station.phone}</span>
                </a>
                <a
                  href={result.nearest_police_station.directions_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition"
                >
                  <span>🗺️</span>
                  <span>{t.get_directions}</span>
                </a>
              </div>
            </div>
          )}

          {/* Nearest Police Box Card */}
          {result.nearest_police_box && (
            <div className="rounded-3xl border border-blue-200 dark:border-blue-900/50 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-950/60 px-3 py-1 text-xs font-bold text-blue-800 dark:text-blue-300">
                  <span>👮‍♂️</span> {t.nearest_police_box}
                </div>
                <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-extrabold text-zinc-900 dark:text-zinc-100">
                  📍 {result.nearest_police_box.distance_formatted}
                </div>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {lang === "bn" && result.nearest_police_box.name_bn
                  ? result.nearest_police_box.name_bn
                  : result.nearest_police_box.name}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                {lang === "bn" && result.nearest_police_box.address_bn
                  ? result.nearest_police_box.address_bn
                  : result.nearest_police_box.address}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a
                  href={`tel:${result.nearest_police_box.phone}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
                >
                  <span>📞</span>
                  <span>{t.call_now}: {result.nearest_police_box.phone}</span>
                </a>
                <a
                  href={result.nearest_police_box.directions_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition"
                >
                  <span>🗺️</span>
                  <span>{t.get_directions}</span>
                </a>
              </div>
            </div>
          )}

          {/* All Other Nearby Emergency Units Grid */}
          {result.nearby_services.length > 0 && (
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>🛡️</span> {t.all_nearby} ({result.nearby_services.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.nearby_services.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-500 uppercase tracking-wider text-[10px]">
                        {s.service_type.replace("_", " ")}
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {s.distance_formatted}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {lang === "bn" && s.name_bn ? s.name_bn : s.name}
                    </h4>
                    <p className="text-[11px] text-zinc-500 line-clamp-1">
                      {lang === "bn" && s.address_bn ? s.address_bn : s.address}
                    </p>
                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800">
                      <a
                        href={`tel:${s.phone}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
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
          )}
        </section>
      )}
    </div>
  );
}
