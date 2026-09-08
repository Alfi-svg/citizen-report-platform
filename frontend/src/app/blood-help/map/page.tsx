"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  PublicBloodMapPoint,
  PublicBloodMapResponse,
  BloodGroup,
} from "@/lib/types";
import { translations, Language } from "@/lib/i18n";
import { useAuth } from "@/context/AuthContext";
import {
  captureCurrentLocation,
  openNativeAppSettings,
  openNativeLocationSettings,
} from "@/lib/location";
import { useBackClose } from "@/lib/useBackClose";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const BD_DISTRICTS = [
  "All Districts", "Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Rangpur", "Mymensingh",
  "Gazipur", "Narayanganj", "Cumilla", "Bogura", "Cox's Bazar", "Noakhali", "Feni", "Brahmanbaria",
  "Jessore", "Kushtia", "Pabna", "Dinajpur", "Tangail", "Faridpur", "Jamalpur"
];

export default function BloodHelpMapPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [lang, setLang] = useState<Language>("en");

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

  const t = translations[lang];

  // Map state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const userCircleRef = useRef<any>(null);

  const [requests, setRequests] = useState<PublicBloodMapPoint[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<PublicBloodMapPoint | null>(null);

  // Filters
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("All Districts");
  const [selectedUrgency, setSelectedUrgency] = useState<string>("ALL");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<{
    message: string;
    action?: "app_settings" | "location_settings";
  } | null>(null);

  // Response Modal ("I Can Help")
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const [responsePhone, setResponsePhone] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [responseSuccess, setResponseSuccess] = useState<string | null>(null);

  // Android back-button support for modal and bottom sheet
  useBackClose(isResponseModalOpen, () => setIsResponseModalOpen(false), "bloodMapResponseModal");
  useBackClose(Boolean(selectedPoint && !isResponseModalOpen), () => setSelectedPoint(null), "bloodMapSelectedPoint");

  // Load Map Data
  const loadMapData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const query = new URLSearchParams();
    query.set("limit", "150");

    if (selectedGroup !== "ALL") query.set("blood_group", selectedGroup);
    if (selectedDistrict !== "All Districts") query.set("district", selectedDistrict);
    if (selectedUrgency !== "ALL") query.set("urgency", selectedUrgency);

    if (userCoords) {
      query.set("nearby_lat", userCoords.lat.toString());
      query.set("nearby_lng", userCoords.lng.toString());
      query.set("radius_km", "60.0");
    }

    try {
      const data = await apiFetch<PublicBloodMapResponse>(`/blood/map?${query.toString()}`);
      setRequests(data.requests);
      setTotal(data.total);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, selectedDistrict, selectedUrgency, userCoords]);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const initMap = () => {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Default centered on Dhaka
      const map = L.map(mapContainerRef.current, {
        center: [23.8103, 90.4125],
        zoom: 11,
        minZoom: 6,
        maxZoom: 18,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      // Check query parameters for deep linking (?id=...&lat=...&lng=...)
      const params = new URLSearchParams(window.location.search);
      const qLat = params.get("lat");
      const qLng = params.get("lng");
      if (qLat && qLng) {
        const lat = parseFloat(qLat);
        const lng = parseFloat(qLng);
        if (!isNaN(lat) && !isNaN(lng)) {
          map.setView([lat, lng], 14);
        }
      }

      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    };

    if (!(window as any).L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => initMap();
      document.body.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Render Markers
  const renderMarkers = useCallback(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    requests.forEach((req) => {
      const isEmergency = req.urgency === "EMERGENCY";
      const isUrgent = req.urgency === "URGENT";

      const dotColor = isEmergency ? "#e11d48" : isUrgent ? "#d97706" : "#475569";

      // Mobile-accessible touch target (38x38px outer container)
      const bloodIcon = L.divIcon({
        className: "custom-blood-marker",
        html: `<div style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <div style="
            display: flex;
            align-items: center;
            gap: 2px;
            background: white;
            color: #18181b;
            padding: 3px 6px;
            border-radius: 9999px;
            border: 2px solid ${dotColor};
            box-shadow: 0 3px 6px rgba(0,0,0,0.25);
            font-size: 11px;
            font-weight: 900;
            line-height: 1;
          ">
            <span style="font-size: 12px;">🩸</span>
            <span>${req.blood_group}</span>
          </div>
        </div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker([req.approximate_latitude, req.approximate_longitude], {
        icon: bloodIcon,
        title: `${req.blood_group} - ${req.hospital_name}`,
      });

      marker.on("click", () => {
        setSelectedPoint(req);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([req.approximate_latitude, req.approximate_longitude]);
        }
      });

      markersLayerRef.current.addLayer(marker);
    });

    // Check if a specific request_id was in query param to auto-select
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qId = params.get("id");
      if (qId) {
        const matched = requests.find((r) => r.id === qId);
        if (matched) {
          setSelectedPoint(matched);
          mapInstanceRef.current.panTo([matched.approximate_latitude, matched.approximate_longitude]);
        }
      }
    }
  }, [requests]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  // Handle Privacy-Safe "Near Me" Location
  const handleLocateMe = async () => {
    setLocating(true);
    setLocationNotice(null);

    const result = await captureCurrentLocation({ timeoutMs: 10000 });
    setLocating(false);

    if (result.error) {
      const isPermanent = result.error.code === "PERMANENTLY_DENIED";
      const isServicesDisabled = result.error.code === "SERVICES_DISABLED";

      let action: "app_settings" | "location_settings" | undefined;
      if (isPermanent && result.error.canOpenSettings) {
        action = "app_settings";
      } else if (isServicesDisabled && result.error.canOpenSettings) {
        action = "location_settings";
      }

      const msg = lang === "bn" ? result.error.messageBn : result.error.message;
      setLocationNotice({
        message: msg,
        action,
      });
      return;
    }

    if (result.coordinates && mapInstanceRef.current) {
      const L = (window as any).L;
      const { approximateLatitude: lat, approximateLongitude: lng } = result.coordinates;
      setUserCoords({ lat, lng });

      // Clean old user marker
      if (userMarkerRef.current) mapInstanceRef.current.removeLayer(userMarkerRef.current);
      if (userCircleRef.current) mapInstanceRef.current.removeLayer(userCircleRef.current);

      // User location marker
      const userIcon = L.divIcon({
        className: "user-gps-marker",
        html: `<div style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
          <div style="background: #2563eb; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(37,99,235,0.8);"></div>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(mapInstanceRef.current);
      userMarkerRef.current = userMarker;

      // Privacy Buffer circle (~120m)
      const privacyCircle = L.circle([lat, lng], {
        radius: 120,
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
        weight: 1.5,
        dashArray: "4, 4",
      }).addTo(mapInstanceRef.current);
      userCircleRef.current = privacyCircle;

      mapInstanceRef.current.setView([lat, lng], 13);
    }
  };

  // Handle volunteer response submission ("I Can Help")
  const handleVolunteerResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoint) return;

    if (!isAuthenticated) {
      router.push(`/login?redirect=/blood-help/map?id=${selectedPoint.id}`);
      return;
    }

    setSubmittingResponse(true);
    setError(null);

    try {
      await apiFetch(`/blood/requests/${selectedPoint.id}/respond`, {
        method: "POST",
        body: JSON.stringify({
          message: responseMessage.trim() || undefined,
          contact_phone: responsePhone.trim() || undefined,
        }),
      });
      setIsResponseModalOpen(false);
      setResponseSuccess(
        lang === "bn"
          ? "ধন্যবাদ! আপনার সহায়তা বার্তা আবেদনকারীর কাছে পাঠানো হয়েছে।"
          : "Thank you! Your willingness to donate has been sent to the requester."
      );
      loadMapData();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSubmittingResponse(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] flex flex-col bg-zinc-100 dark:bg-zinc-950 overflow-hidden">
      {/* ========================================================= */}
      {/* 1. Header Toolbar & Quick Filters */}
      {/* ========================================================= */}
      <div className="z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-3 py-2.5 sm:px-6 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-600 text-white text-sm shadow-2xs">
              🩸
            </span>
            <div>
              <h1 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>{lang === "bn" ? t.blood_map_title : "Blood Request Map"}</span>
                <span className="rounded-full bg-rose-50 dark:bg-rose-950/60 px-2 py-0.2 text-[10px] text-rose-700 dark:text-rose-400 font-bold border border-rose-200/60 dark:border-rose-900/60">
                  {total}
                </span>
              </h1>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                {lang === "bn" ? t.blood_map_privacy_notice : "All locations are approximate (~110m privacy protection)."}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Near Me Button */}
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={locating}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition cursor-pointer shadow-2xs disabled:opacity-60"
            >
              <span>{locating ? "⏳" : "📍"}</span>
              <span className="hidden xs:inline">{lang === "bn" ? "আমার কাছে" : "Near Me"}</span>
            </button>

            {/* Switch to List View */}
            <Link
              href="/blood-help"
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-2xs"
            >
              <span>📋</span>
              <span className="hidden xs:inline">{lang === "bn" ? "তালিকা ভিউ" : "List View"}</span>
            </Link>
          </div>
        </div>

        {/* Filter Pills & Dropdowns */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          {/* Blood Group Pills */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedGroup("ALL")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer border ${
                selectedGroup === "ALL"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent shadow-2xs"
                  : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
              }`}
            >
              All
            </button>
            {BLOOD_GROUPS.map((bg) => (
              <button
                type="button"
                key={bg}
                onClick={() => setSelectedGroup(bg)}
                className={`rounded-lg px-2 py-1 text-[11px] font-black transition cursor-pointer border ${
                  selectedGroup === bg
                    ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                    : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {bg}
              </button>
            ))}
          </div>

          {/* District Dropdown */}
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-[11px] text-zinc-800 dark:text-zinc-200 shrink-0 focus:outline-none focus:ring-1 focus:ring-rose-500"
          >
            {BD_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Urgency Dropdown */}
          <select
            value={selectedUrgency}
            onChange={(e) => setSelectedUrgency(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-[11px] text-zinc-800 dark:text-zinc-200 shrink-0 focus:outline-none focus:ring-1 focus:ring-rose-500"
          >
            <option value="ALL">All Urgencies</option>
            <option value="EMERGENCY">🚨 Emergency</option>
            <option value="URGENT">⚠️ Urgent</option>
            <option value="NORMAL">ℹ️ Normal</option>
          </select>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-2 border border-red-200 dark:border-red-900 text-[11px] text-red-800 dark:text-red-200 flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-600 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Non-intrusive Location Notice if denied or error */}
        {locationNotice && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-2.5 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="shrink-0">⚠️</span>
              <span className="break-words leading-relaxed">{typeof locationNotice === "string" ? locationNotice : locationNotice.message}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {typeof locationNotice !== "string" && locationNotice.action === "app_settings" && (
                <button
                  type="button"
                  onClick={() => openNativeAppSettings()}
                  className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition cursor-pointer"
                >
                  {lang === "bn" ? "সেটিংস" : "Settings"}
                </button>
              )}
              {typeof locationNotice !== "string" && locationNotice.action === "location_settings" && (
                <button
                  type="button"
                  onClick={() => openNativeLocationSettings()}
                  className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition cursor-pointer"
                >
                  {lang === "bn" ? "GPS সেটিংস" : "GPS Settings"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setLocationNotice(null)}
                className="text-amber-600 font-bold ml-1 cursor-pointer p-1"
                aria-label="Dismiss notice"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {responseSuccess && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2 border border-emerald-200 dark:border-emerald-900 text-[11px] text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
            <span>✓ {responseSuccess}</span>
            <button
              onClick={() => setResponseSuccess(null)}
              className="text-emerald-600 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. Map Canvas Container */}
      {/* ========================================================= */}
      <div className="relative flex-1 w-full h-full">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Loading Spinner Overlay */}
        {loading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-full px-4 py-1.5 border border-zinc-200 dark:border-zinc-800 shadow-md text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
            <span>Loading blood requests...</span>
          </div>
        )}

        {/* Empty State Overlay */}
        {!loading && requests.length === 0 && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 max-w-xs bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-lg text-center space-y-1">
            <span className="text-xl">🕊️</span>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              No matching blood requests
            </h3>
            <p className="text-[10px] text-zinc-500">
              No active blood requests match your selected filters. Try choosing &quot;All Districts&quot; or &quot;All Groups&quot;.
            </p>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. Selected Marker Bottom Sheet / Responsive Card */}
        {/* ========================================================= */}
        {selectedPoint && (
          <div className="absolute bottom-16 sm:bottom-auto sm:top-4 left-3 right-3 sm:left-auto sm:right-4 z-30 sm:max-w-sm sm:w-85 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-3">
            {/* Header: Blood Group, Urgency & Close Button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center rounded-xl bg-rose-600 text-white font-black text-sm px-2.5 py-1 shadow-2xs">
                  {selectedPoint.blood_group}
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    selectedPoint.urgency === "EMERGENCY"
                      ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-900/80"
                      : selectedPoint.urgency === "URGENT"
                      ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/80"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  {selectedPoint.urgency === "EMERGENCY" && (
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                  )}
                  <span>{selectedPoint.urgency}</span>
                </span>

                <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                  {selectedPoint.units_required} {selectedPoint.units_required === 1 ? "Bag" : "Bags"}
                </span>
              </div>

              <button
                onClick={() => setSelectedPoint(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs font-bold min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            {/* Hospital & Location */}
            <div>
              <h3 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-zinc-100 line-clamp-1">
                {selectedPoint.hospital_name}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
                <span>📍</span>
                <span>{selectedPoint.hospital_area}, {selectedPoint.district}</span>
                {selectedPoint.distance_km !== undefined && selectedPoint.distance_km !== null && (
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    • {selectedPoint.distance_km} km away
                  </span>
                )}
              </p>
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 mt-0.5">
                <span>🛡️</span>
                <span>Approximate location (~110m privacy buffer)</span>
              </span>
            </div>

            {/* Required Date & Response Count */}
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 text-[11px] space-y-1">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-300">
                <span className="text-zinc-400">Needed by:</span>
                <span className="font-bold">
                  {new Date(selectedPoint.required_date).toLocaleDateString()}{" "}
                  {selectedPoint.required_time ? `• ${selectedPoint.required_time}` : ""}
                </span>
              </div>
              {selectedPoint.response_count > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Community Response:</span>
                  <span>{selectedPoint.response_count} donor(s) responded</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsResponseModalOpen(true)}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 px-3 transition shadow-xs cursor-pointer text-center"
              >
                ❤️ I Can Help
              </button>

              <Link
                href={`/blood-help/${selectedPoint.id}`}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 text-xs font-bold py-2 px-3 transition shadow-2xs text-center"
              >
                Details →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 4. Volunteer Response Modal ("I Can Help") */}
      {/* ========================================================= */}
      {isResponseModalOpen && selectedPoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-600 text-white text-sm">
                  ❤️
                </span>
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                    Respond to Blood Request
                  </h3>
                  <span className="text-[11px] text-zinc-500">
                    {selectedPoint.blood_group} for {selectedPoint.hospital_name}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResponseModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVolunteerResponse} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Contact Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={responsePhone}
                  onChange={(e) => setResponsePhone(e.target.value)}
                  placeholder="e.g. 017XXXXXXXX"
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Message for Requester (Optional)
                </label>
                <textarea
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  rows={3}
                  placeholder="I can arrive at the hospital by 3 PM..."
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/60 text-[10px] text-rose-800 dark:text-rose-300">
                🔒 Blood donations are 100% voluntary. Never pay money for blood donations.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResponseModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResponse}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-2 text-xs font-bold text-white transition shadow-sm disabled:opacity-60 cursor-pointer"
                >
                  {submittingResponse ? "Submitting..." : "Send Response"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
