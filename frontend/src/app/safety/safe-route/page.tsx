"use client";

import React, { useEffect, useRef, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  SafeRouteAnalysisRequest,
  SafeRouteAnalysisResponse,
  RoadSafetyRiskLevel,
  NearbySafetyAlert,
} from "@/lib/types";
import { Language } from "@/lib/i18n";
import { captureCurrentLocation } from "@/lib/location";
import {
  Shield,
  Navigation,
  CarFront,
  PhoneCall,
  AlertTriangle,
  Layers,
  Compass,
  Info,
  ExternalLink,
  LocateFixed,
  RotateCcw,
  Clock,
  X,
  Phone,
} from "lucide-react";

interface LocationPreset {
  nameEn: string;
  nameBn: string;
  lat: number;
  lng: number;
}

const ROUTE_PRESETS: LocationPreset[] = [
  { nameEn: "Dhanmondi 27 Junction", nameBn: "ধানমন্ডি ২৭ মোড়", lat: 23.7461, lng: 90.3742 },
  { nameEn: "Farmgate Crossing (Tejgaon)", nameBn: "ফার্মগেট মোড় (তেজগাঁও)", lat: 23.7561, lng: 90.3872 },
  { nameEn: "Mirpur 10 Roundabout", nameBn: "মিরপুর ১০ গোলচত্বর", lat: 23.8071, lng: 90.3686 },
  { nameEn: "Shahbagh Intersection", nameBn: "শাহবাগ মোড়", lat: 23.7389, lng: 90.3957 },
  { nameEn: "Airport Road (Kuril - Uttara)", nameBn: "এয়ারপোর্ট রোড (কুড়িল - উত্তরা)", lat: 23.8341, lng: 90.4196 },
  { nameEn: "Gabtoli Bus Terminal", nameBn: "গাবতলী বাস টার্মিনাল", lat: 23.7806, lng: 90.3522 },
  { nameEn: "Jatrabari - Kanchpur Stretch", nameBn: "যাত্রাবাড়ী - কাঁচপুর মহাসড়ক", lat: 23.7042, lng: 90.5098 },
  { nameEn: "Agrabad Commercial Area, Ctg", nameBn: "আগ্রাবাদ বাণিজ্যিক এলাকা, চট্টগ্রাম", lat: 22.3168, lng: 91.7981 },
];

function SafeRouteContent() {
  const [lang, setLang] = useState<Language>("en");
  const isBn = lang === "bn";

  // Coordinates & Names
  const [origin, setOrigin] = useState<LocationPreset>(ROUTE_PRESETS[0]);
  const [destination, setDestination] = useState<LocationPreset>(ROUTE_PRESETS[1]);
  const [isLocatingOrigin, setIsLocatingOrigin] = useState(false);

  // Map & Visualizer State
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [is3DMode, setIs3DMode] = useState(true);

  // Routing & Risk Analysis State
  const [isRouting, setIsRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeAnalysis, setRouteAnalysis] = useState<SafeRouteAnalysisResponse | null>(null);
  const [selectedHazard, setSelectedHazard] = useState<NearbySafetyAlert | null>(null);

  // Sync language with localStorage
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

  // Initialize MapLibre GL JS
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;
    let isMounted = true;

    if (!document.getElementById("maplibre-gl-css")) {
      const link = document.createElement("link");
      link.id = "maplibre-gl-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
      document.head.appendChild(link);
    }

    const initMap = () => {
      if (!isMounted || !mapContainerRef.current) return;
      const maplibregl = (window as any).maplibregl;
      if (!maplibregl) return;

      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
      }

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [origin.lng, origin.lat],
        zoom: 13.5,
        pitch: is3DMode ? 55 : 0,
        antialias: true,
      });

      map.on("load", () => {
        if (!isMounted) return;
        setMapLoaded(true);

        // Add 3D Extrusion Layer
        try {
          const layers = map.getStyle().layers;
          let labelLayerId;
          for (let i = 0; i < layers.length; i++) {
            if (layers[i].type === "symbol" && layers[i].layout && layers[i].layout["text-field"]) {
              labelLayerId = layers[i].id;
              break;
            }
          }

          if (!map.getLayer("3d-buildings")) {
            map.addLayer(
              {
                id: "3d-buildings",
                source: "openmaptiles",
                "source-layer": "building",
                type: "fill-extrusion",
                minzoom: 14,
                paint: {
                  "fill-extrusion-color": [
                    "interpolate",
                    ["linear"],
                    ["get", "render_height"],
                    0, "#27272a",
                    30, "#18181b",
                    60, "#09090b"
                  ],
                  "fill-extrusion-height": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    14, 0,
                    14.5, ["get", "render_height"]
                  ],
                  "fill-extrusion-base": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    14, 0,
                    14.5, ["get", "render_min_height"]
                  ],
                  "fill-extrusion-opacity": 0.8,
                },
              },
              labelLayerId
            );
          }
        } catch {}
      });

      mapRef.current = map;
    };

    if (!(window as any).maplibregl) {
      const script = document.createElement("script");
      script.id = "maplibre-gl-js";
      script.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
      script.async = true;
      script.onload = () => initMap();
      document.body.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      isMounted = false;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Map container mounts once on initial render
  }, []);

  // Request browser geolocation for Origin
  const handleDetectCurrentLocation = async () => {
    setIsLocatingOrigin(true);
    try {
      const { coordinates, error } = await captureCurrentLocation();
      if (coordinates) {
        const detected: LocationPreset = {
          nameEn: "My Current Location",
          nameBn: "আমার বর্তমান অবস্থান",
          lat: coordinates.latitude,
          lng: coordinates.longitude,
        };
        setOrigin(detected);
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [coordinates.longitude, coordinates.latitude],
            zoom: 14.5,
          });
        }
      } else {
        alert(
          isBn
            ? "বর্তমান অবস্থান নির্ণয় করা যায়নি। অনুগ্রহ করে জিপিএস পারমিশন দিন।"
            : (error?.message || "Could not detect location. Please check browser GPS permissions.")
        );
      }
    } catch {
      alert(
        isBn
          ? "লোকেশন পারমিশন মেলেনি।"
          : "Location permission was denied or unavailable."
      );
    } finally {
      setIsLocatingOrigin(false);
    }
  };

  // Toggle 2D / 3D mode
  const handleToggle3D = () => {
    if (!mapRef.current) return;
    const next = !is3DMode;
    setIs3DMode(next);
    mapRef.current.easeTo({
      pitch: next ? 55 : 0,
      duration: 800,
    });
  };

  // Calculate route using OSRM + Backend Safe Route Intelligence
  const calculateSafeRoute = useCallback(async () => {
    setIsRouting(true);
    setRouteError(null);
    setRouteAnalysis(null);
    setSelectedHazard(null);

    try {
      // 1. Fetch driving route from OSRM public router
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
      const osrmRes = await fetch(osrmUrl);
      if (!osrmRes.ok) {
        throw new Error("Public routing service temporarily unreachable.");
      }

      const osrmData = await osrmRes.json();
      if (!osrmData.routes || osrmData.routes.length === 0) {
        throw new Error(
          isBn ? "কোনো উপযুক্ত সড়ক রুট পাওয়া যায়নি।" : "No viable road route found between selected points."
        );
      }

      const primary = osrmData.routes[0];
      const distanceKm = Math.round((primary.distance / 1000) * 10) / 10;
      const durationMin = Math.round(primary.duration / 60);

      // 2. Render route polyline on MapLibre map
      if (mapRef.current) {
        const map = mapRef.current;
        if (map.getLayer("safe-route-line")) map.removeLayer("safe-route-line");
        if (map.getLayer("safe-route-glow")) map.removeLayer("safe-route-glow");
        if (map.getSource("safe-route-source")) map.removeSource("safe-route-source");

        map.addSource("safe-route-source", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: primary.geometry,
          },
        });

        map.addLayer({
          id: "safe-route-glow",
          type: "line",
          source: "safe-route-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#0284c7",
            "line-width": 9,
            "line-opacity": 0.35,
          },
        });

        map.addLayer({
          id: "safe-route-line",
          type: "line",
          source: "safe-route-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#38bdf8",
            "line-width": 5,
            "line-opacity": 0.95,
          },
        });

        // Fit map view to route bounds
        const coords = primary.geometry.coordinates;
        const maplibregl = (window as any).maplibregl;
        if (maplibregl && coords.length > 0) {
          const bounds = coords.reduce(
            (b: any, coord: number[]) => b.extend(coord),
            new maplibregl.LngLatBounds(coords[0], coords[0])
          );
          map.fitBounds(bounds, { padding: 90, maxZoom: 15.5 });
        }
      }

      // 3. Call Nirapotta Backend Safe Route Evaluation
      const waypoints = primary.geometry.coordinates.map((c: number[]) => [c[1], c[0]]); // [lat, lng]
      const payload: SafeRouteAnalysisRequest = {
        origin_latitude: origin.lat,
        origin_longitude: origin.lng,
        destination_latitude: destination.lat,
        destination_longitude: destination.lng,
        origin_name: isBn ? origin.nameBn : origin.nameEn,
        destination_name: isBn ? destination.nameBn : destination.nameEn,
        waypoints,
        route_distance_km: distanceKm,
        route_duration_minutes: durationMin,
        lang,
      };

      const analysisResp = await apiFetch<SafeRouteAnalysisResponse>(
        "/safety/safe-route/analyze",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      setRouteAnalysis(analysisResp);
    } catch (err: any) {
      setRouteError(
        err?.message ||
          (isBn
            ? "রুট সংক্রান্ত তথ্য লোড করা যায়নি। অনুগ্রহ করে পয়েন্ট পরিবর্তন করুন।"
            : "Failed to calculate route and safety intelligence. Please try different endpoints.")
      );
    } finally {
      setIsRouting(false);
    }
  }, [origin, destination, isBn, lang]);

  // Recalculate route whenever endpoints change
  useEffect(() => {
    if (mapLoaded) {
      calculateSafeRoute();
    }
  }, [mapLoaded, calculateSafeRoute]);

  const getRiskColor = (level: RoadSafetyRiskLevel) => {
    switch (level) {
      case "Critical":
        return "text-red-700 bg-red-100 dark:bg-red-950/70 border-red-300 dark:border-red-900";
      case "High":
        return "text-orange-700 bg-orange-100 dark:bg-orange-950/70 border-orange-300 dark:border-orange-900";
      case "Moderate":
        return "text-amber-700 bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-900";
      default:
        return "text-emerald-700 bg-emerald-100 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-900";
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top Bar Header */}
      <div className="h-14 sm:h-16 px-4 bg-zinc-950/95 border-b border-zinc-800 flex items-center justify-between text-white shrink-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/safety"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 text-xs font-bold transition text-zinc-300 hover:text-white"
          >
            <span>←</span>
            <span>{isBn ? "নিরাপত্তা কেন্দ্র" : "Safety Hub"}</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
              <span>{isBn ? "সেফ রুট ও ৩ডি ম্যাপ" : "Safe Route & 3D Safety Map"}</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                Phase F
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 2D / 3D Toggle */}
          <button
            type="button"
            onClick={handleToggle3D}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              is3DMode
                ? "bg-cyan-600 text-white"
                : "bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-zinc-700"
            }`}
          >
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{is3DMode ? "3D Buildings" : "2D Overhead"}</span>
          </button>

          <Link
            href="/safety-map"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition px-2.5 py-1.5 rounded-xl hover:bg-zinc-800"
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isBn ? "কমিউনিটি ম্যাপ" : "Community Map"}</span>
          </Link>
        </div>
      </div>

      {/* Main Viewport: Map with Floating Sidebar & Drawers */}
      <div className="flex-1 relative overflow-hidden flex flex-col md:flex-row">
        {/* Left Side: Route Controls & Safety Analysis Panel */}
        <div className="w-full md:w-96 lg:w-[420px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-r border-zinc-200 dark:border-zinc-800 z-20 flex flex-col h-full overflow-y-auto shadow-2xl">
          {/* Route Selector Card */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <Navigation className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
                <span>{isBn ? "রুট পরিকল্পনা" : "Route Endpoints"}</span>
              </span>
              <button
                type="button"
                onClick={calculateSafeRoute}
                disabled={isRouting}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <RotateCcw className={`h-3 w-3 ${isRouting ? "animate-spin" : ""}`} aria-hidden="true" />
                <span>{isBn ? "রিফ্রেশ" : "Recalculate"}</span>
              </button>
            </div>

            {/* Origin */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span>{isBn ? "যাত্রা শুরু (উৎস):" : "Origin:"}</span>
                </label>
                <button
                  type="button"
                  onClick={handleDetectCurrentLocation}
                  disabled={isLocatingOrigin}
                  className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <LocateFixed className="h-3 w-3" aria-hidden="true" />
                  <span>{isLocatingOrigin ? "Detecting..." : isBn ? "আমার লোকেশন" : "My Location"}</span>
                </button>
              </div>
              <select
                value={origin.nameEn}
                onChange={(e) => {
                  const found = ROUTE_PRESETS.find((p) => p.nameEn === e.target.value);
                  if (found) setOrigin(found);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                {origin.nameEn === "My Current Location" && (
                  <option value="My Current Location">My Current Location (GPS)</option>
                )}
                {ROUTE_PRESETS.map((p) => (
                  <option key={p.nameEn} value={p.nameEn}>
                    {isBn ? p.nameBn : p.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span>{isBn ? "গন্তব্য:" : "Destination:"}</span>
              </label>
              <select
                value={destination.nameEn}
                onChange={(e) => {
                  const found = ROUTE_PRESETS.find((p) => p.nameEn === e.target.value);
                  if (found) setDestination(found);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                {ROUTE_PRESETS.map((p) => (
                  <option key={p.nameEn} value={p.nameEn}>
                    {isBn ? p.nameBn : p.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Safety Evaluation Results */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {/* Error Message */}
            {routeError && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3.5 text-xs text-red-800 dark:text-red-200 flex items-start gap-2.5"
              >
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{routeError}</span>
              </div>
            )}

            {/* Fallback Corridor Notice */}
            {routeAnalysis?.is_fallback && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 p-3 space-y-1 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
                  <span>
                    {isBn
                      ? "সরাসরি করিডোর প্রাক্কলন (রোড নেভিগেশন নয়)"
                      : "Direct Corridor Estimation (Not Road Navigation)"}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                  {routeAnalysis.fallback_notice ||
                    (isBn
                      ? "বাস্তব সড়ক রুট পাওয়া যায়নি; আনুমানিক রৈখিক করিডোর দেখানো হচ্ছে।"
                      : "Turn-by-turn road geometry is unavailable. A straight-line geographic corridor is displayed for hazard awareness only. Do not use for driving navigation.")}
                </p>
              </div>
            )}

            {/* Route Score & Travel Metrics */}
            {routeAnalysis && (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CarFront className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      {routeAnalysis.route_distance_km ? `${routeAnalysis.route_distance_km} km` : "N/A"}
                    </span>
                    <span className="text-zinc-400">•</span>
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      <span>{routeAnalysis.route_duration_minutes ? `~${routeAnalysis.route_duration_minutes} min` : "N/A"}</span>
                    </span>
                  </div>

                  <span
                    className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border ${getRiskColor(
                      routeAnalysis.route_risk_level
                    )}`}
                  >
                    {routeAnalysis.route_risk_level} Risk
                  </span>
                </div>

                {/* Score Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>Route Risk Score</span>
                    <span className="font-bold">{routeAnalysis.route_risk_score} / 100</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        routeAnalysis.route_risk_score >= 70
                          ? "bg-red-600"
                          : routeAnalysis.route_risk_score >= 45
                          ? "bg-orange-500"
                          : routeAnalysis.route_risk_score >= 20
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.max(5, routeAnalysis.route_risk_score)}%` }}
                    />
                  </div>
                </div>

                {/* Grounded Advisory */}
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed pt-1">
                  {routeAnalysis.safety_advisory}
                </p>
              </div>
            )}

            {/* AI Interpretation Box */}
            {routeAnalysis?.ai_interpretation && (
              <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200">
                  <Shield className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                  <span>{isBn ? "এআই নিরাপত্তা বিশ্লেষণ" : "Safety Assessment"}</span>
                </div>
                <p className="text-zinc-700 dark:text-zinc-300 text-[11px] leading-relaxed">
                  {routeAnalysis.ai_interpretation}
                </p>
              </div>
            )}

            {/* Hazards Along Route Section */}
            {routeAnalysis && routeAnalysis.hazards_along_route.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    {isBn ? "রুটের আশপাশের ঘটনা" : "Hazards Along Corridor"} (
                    {routeAnalysis.hazards_along_route.length})
                  </span>
                </div>

                <div className="space-y-2">
                  {routeAnalysis.hazards_along_route.map((hazard) => (
                    <div
                      key={hazard.id}
                      onClick={() => {
                        setSelectedHazard(hazard);
                        if (mapRef.current) {
                          mapRef.current.flyTo({
                            center: [hazard.longitude, hazard.latitude],
                            zoom: 16,
                          });
                        }
                      }}
                      className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-600 bg-white dark:bg-zinc-800/60 cursor-pointer transition space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {hazard.title}
                        </span>
                        <span className="text-[10px] text-amber-600 font-semibold shrink-0">
                          {hazard.distance_text}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 flex items-center justify-between">
                        <span className="truncate">{hazard.location_text}</span>
                        <span>{hazard.incident_date_text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Emergency Services Along Route */}
            {routeAnalysis && routeAnalysis.emergency_services_along_route.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                  {isBn ? "জরুরি সেবা (নিকটবর্তী)" : "Emergency Services Near Route"} (
                  {routeAnalysis.emergency_services_along_route.length})
                </span>

                <div className="space-y-2">
                  {routeAnalysis.emergency_services_along_route.map((svc) => (
                    <div
                      key={svc.id}
                      className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/60 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 block truncate">
                          {svc.name}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {svc.service_type} • {svc.distance_text}
                        </span>
                      </div>
                      {svc.phone_number && (
                        <a
                          href={`tel:${svc.phone_number}`}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shrink-0 inline-flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" aria-hidden="true" />
                          <span>Call</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Limitations Disclosure */}
            {routeAnalysis?.data_limitations && (
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-500 space-y-1">
                <span className="font-bold text-zinc-700 dark:text-zinc-300 block flex items-center gap-1">
                  <Info className="h-3 w-3" aria-hidden="true" />
                  <span>Coverage Limitations:</span>
                </span>
                <p>{routeAnalysis.data_limitations}</p>
              </div>
            )}
          </div>

          {/* Emergency 999 Hotline Banner */}
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border-t border-red-200 dark:border-red-900/60 flex items-center justify-between text-xs text-red-800 dark:text-red-200 shrink-0">
            <span className="text-[11px]">
              {isBn ? "তাৎক্ষণিক বিপদে ডায়াল করুন:" : "In immediate life danger, call:"}
            </span>
            <a
              href="tel:999"
              className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs"
            >
              <PhoneCall className="h-3 w-3" aria-hidden="true" />
              <span>999</span>
            </a>
          </div>
        </div>

        {/* Right Side: Map Canvas */}
        <div className="flex-1 relative h-full">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Map Floating Controls */}
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleToggle3D}
              title={is3DMode ? "Switch to 2D flat mode" : "Switch to 3D buildings"}
              className="p-2.5 rounded-xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-emerald-500 shadow-md transition cursor-pointer"
            >
              <Compass className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (mapRef.current) {
                  mapRef.current.flyTo({
                    center: [origin.lng, origin.lat],
                    zoom: 14,
                  });
                }
              }}
              title="Center on Origin"
              className="p-2.5 rounded-xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-blue-500 shadow-md transition cursor-pointer"
            >
              <LocateFixed className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Selected Incident Drawer / Popup */}
          {selectedHazard && (
            <div className="absolute bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-80 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 p-4 shadow-2xl z-20 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-600 flex items-center gap-1 text-[11px]">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Approved Incident Alert</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedHazard(null)}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <h4 className="font-bold text-zinc-900 dark:text-zinc-100">
                {selectedHazard.title}
              </h4>
              <p className="text-[11px] text-zinc-500">
                {selectedHazard.location_text} • {selectedHazard.distance_text}
              </p>

              <div className="pt-2">
                <Link
                  href={selectedHazard.report_url}
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold hover:underline text-xs"
                >
                  <span>View Full Report</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SafeRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-zinc-950 flex items-center justify-center text-white">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="text-xs text-zinc-400">Loading Safe Route & Safety Map...</p>
          </div>
        </div>
      }
    >
      <SafeRouteContent />
    </Suspense>
  );
}
