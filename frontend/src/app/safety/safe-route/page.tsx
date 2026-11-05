"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  SafeRouteAnalysisRequest,
  SafeRouteAnalysisResponse,
  NearbySafetyAlert,
  AccidentZoneItem,
  HelmetVerificationResponse,
} from "@/lib/types";
import { Language } from "@/lib/i18n";
import { captureCurrentLocation } from "@/lib/location";
import {
  Navigation,
  CarFront,
  AlertTriangle,
  Compass,
  LocateFixed,
  RotateCcw,
  Clock,
  X,
  Bike,
  CheckCircle2,
  Camera,
  Bot,
  ShieldCheck,
  Info,
  Zap,
  Layers,
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
  { nameEn: "Hatikumrul Roundabout (Sirajganj)", nameBn: "হাটিকুমরুল গোলচত্বর (সিরাজগঞ্জ)", lat: 24.4215, lng: 89.5518 },
  { nameEn: "Sherpur Highway Bypass (Bogura)", nameBn: "শেরপুর মহাসড়ক বাইপাস (বগুড়া)", lat: 24.6713, lng: 89.4182 },
];

export default function SafeRoutePage() {
  const [lang, setLang] = useState<Language>("en");
  const isBn = lang === "bn";

  // Coordinates & Names
  const [origin, setOrigin] = useState<LocationPreset>(ROUTE_PRESETS[0]);
  const [destination, setDestination] = useState<LocationPreset>(ROUTE_PRESETS[1]);
  const [isLocatingOrigin, setIsLocatingOrigin] = useState(false);

  // Agentic Route Preference: RECOMMENDED | FASTEST | SAFEST
  const [routePreference, setRoutePreference] = useState<"RECOMMENDED" | "FASTEST" | "SAFEST">("RECOMMENDED");

  // Vehicle Type & Safety Verification State
  const [vehicleType, setVehicleType] = useState<"MOTORCYCLE" | "CAR">("MOTORCYCLE");
  const [isSafetyConfirmed, setIsSafetyConfirmed] = useState(false);
  const [helmetToken, setHelmetToken] = useState<string | null>(null);
  const [helmetTokenExpiresAt, setHelmetTokenExpiresAt] = useState<number | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationWarning, setVerificationWarning] = useState<string | null>(null);
  const [routingNotice, setRoutingNotice] = useState<string | null>(null);

  // Camera Verification State (Mandatory for Motorcycle Ride Initiation)
  const [cameraActive, setCameraActive] = useState(false);
  const [isVerifyingCamera, setIsVerifyingCamera] = useState(false);
  const [cameraResult, setCameraResult] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Map & Visualizer State
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [is3DMode, setIs3DMode] = useState(true);

  // Active Route Option: "route_0", "route_1", etc.
  const [selectedRouteId, setSelectedRouteId] = useState<string>("route_0");
  const [osrmRoutesData, setOsrmRoutesData] = useState<any[]>([]);

  // Routing & Risk Analysis State
  const [isRouting, setIsRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeAnalysis, setRouteAnalysis] = useState<SafeRouteAnalysisResponse | null>(null);
  const [selectedHazard, setSelectedHazard] = useState<NearbySafetyAlert | null>(null);
  const [selectedAccidentZone, setSelectedAccidentZone] = useState<AccidentZoneItem | null>(null);

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

  // Initialize MapLibre GL JS with 3D buildings
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
        bearing: -15,
        antialias: true,
      });

      map.on("load", () => {
        if (!isMounted) return;
        setMapLoaded(true);

        // Add 3D Extrusion Layer for Buildings
        try {
          const layers = map.getStyle().layers;
          let labelLayerId: string | undefined;
          for (let i = 0; i < layers.length; i++) {
            if (layers[i].type === "symbol" && layers[i].layout?.["text-field"]) {
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
                minzoom: 13,
                paint: {
                  "fill-extrusion-color": [
                    "interpolate",
                    ["linear"],
                    ["get", "render_height"],
                    0, "#cbd5e1",
                    30, "#94a3b8",
                    60, "#64748b",
                    120, "#475569"
                  ],
                  "fill-extrusion-height": ["coalesce", ["get", "render_height"], 12],
                  "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                  "fill-extrusion-opacity": 0.55,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      bearing: next ? -15 : 0,
      duration: 800,
    });
  };

  // Draw accident-prone zones onto MapLibre map
  const renderAccidentZoneMarkers = useCallback((zones: AccidentZoneItem[]) => {
    const map = mapRef.current;
    const maplibregl = (window as any).maplibregl;
    if (!map || !maplibregl || !zones) return;

    // Remove existing zone markers from DOM
    const existing = document.querySelectorAll(".accident-zone-marker");
    existing.forEach((el) => el.remove());

    zones.forEach((zone) => {
      const el = document.createElement("div");
      el.className = "accident-zone-marker cursor-pointer select-none";

      const isCritical = zone.risk_level === "CRITICAL";
      const isHigh = zone.risk_level === "HIGH";
      const color = isCritical ? "#dc2626" : isHigh ? "#ea580c" : "#eab308";
      const pulseColor = isCritical ? "rgba(220, 38, 38, 0.4)" : "rgba(234, 88, 12, 0.4)";

      el.innerHTML = `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
          <span style="position: absolute; inset: -4px; border-radius: 9999px; background: ${pulseColor}; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <div style="
            position: relative;
            width: 26px;
            height: 26px;
            border-radius: 9999px;
            background: ${color};
            border: 2.5px solid #ffffff;
            box-shadow: 0 4px 10px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-weight: 900;
            font-size: 11px;
          ">
            !
          </div>
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedAccidentZone(zone);
        map.flyTo({
          center: [zone.longitude, zone.latitude],
          zoom: 15,
          pitch: is3DMode ? 55 : 0,
        });
      });

      new maplibregl.Marker({ element: el })
        .setLngLat([zone.longitude, zone.latitude])
        .addTo(map);
    });
  }, [is3DMode]);

  // Render polyline geometry on map for selected route and candidate alternatives
  const renderRouteGeometryOnMap = useCallback((activeIdx: number, allRoutes: any[]) => {
    const map = mapRef.current;
    if (!map || allRoutes.length === 0) return;

    const primary = allRoutes[activeIdx] || allRoutes[0];

    // Remove existing layers & sources safely
    for (let i = 0; i < 5; i++) {
      try {
        if (map.getLayer(`alt-route-line-${i}`)) map.removeLayer(`alt-route-line-${i}`);
        if (map.getSource(`alt-route-source-${i}`)) map.removeSource(`alt-route-source-${i}`);
      } catch {}
    }
    try {
      if (map.getLayer("safe-route-line")) map.removeLayer("safe-route-line");
      if (map.getLayer("safe-route-glow")) map.removeLayer("safe-route-glow");
      if (map.getSource("safe-route-source")) map.removeSource("safe-route-source");
    } catch {}

    // Add Candidate Alternatives in distinctive colors
    // Route 0: Emerald/Sky, Route 1: Cyan/Indigo, Route 2: Amber/Purple
    const altColors = ["#0284c7", "#6366f1", "#d97706", "#8b5cf6"];

    allRoutes.forEach((route, idx) => {
      if (idx !== activeIdx && route.geometry) {
        const color = altColors[idx % altColors.length];
        try {
          map.addSource(`alt-route-source-${idx}`, {
            type: "geojson",
            data: { type: "Feature", geometry: route.geometry },
          });
          map.addLayer({
            id: `alt-route-line-${idx}`,
            type: "line",
            source: `alt-route-source-${idx}`,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": color,
              "line-width": 4,
              "line-opacity": 0.55,
              "line-dasharray": [2, 2],
            },
          });
        } catch {}
      }
    });

    // Add Active Selected Route with vivid glow
    try {
      const activeColor = activeIdx === 0 ? "#10b981" : "#0284c7"; // Emerald for recommended, Sky for fastest

      map.addSource("safe-route-source", {
        type: "geojson",
        data: { type: "Feature", geometry: primary.geometry },
      });

      map.addLayer({
        id: "safe-route-glow",
        type: "line",
        source: "safe-route-source",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": activeColor,
          "line-width": 10,
          "line-opacity": 0.4,
        },
      });

      map.addLayer({
        id: "safe-route-line",
        type: "line",
        source: "safe-route-source",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": activeColor,
          "line-width": 5.5,
          "line-opacity": 0.95,
        },
      });

      // Fit map view to active route bounds
      const coords = primary.geometry.coordinates;
      const maplibregl = (window as any).maplibregl;
      if (maplibregl && coords && coords.length > 0) {
        const bounds = coords.reduce(
          (b: any, coord: number[]) => b.extend(coord),
          new maplibregl.LngLatBounds(coords[0], coords[0])
        );
        map.fitBounds(bounds, { padding: 90, maxZoom: 15.5 });
      }
    } catch {}
  }, []);

  // Calculate route alternatives using OSRM + Backend Agentic Road AI
  const calculateSafeRoute = useCallback(async () => {
    setIsRouting(true);
    setRouteError(null);
    setRouteAnalysis(null);
    setSelectedHazard(null);
    setSelectedAccidentZone(null);

    try {
      // 1. Fetch driving route with alternatives from configurable OSRM endpoint
      const osrmBase = (process.env.NEXT_PUBLIC_OSRM_URL || "https://router.project-osrm.org").replace(/\/$/, "");
      const osrmUrl = `${osrmBase}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&alternatives=true`;

      let routes: any[] = [];
      let isFallbackRoute = false;
      let routingWarningText: string | null = null;

      const controller = new AbortController();
      const timeoutTimer = setTimeout(() => controller.abort(), 7500);

      try {
        const osrmRes = await fetch(osrmUrl, { signal: controller.signal });
        clearTimeout(timeoutTimer);

        if (osrmRes.status === 429) {
          throw new Error(isBn ? "পাবলিক রাউটিং সার্ভারে রিকোয়েস্টের সীমা অতিক্রম করেছে (HTTP 429 Rate Limit)।" : "Public routing engine rate limit reached (HTTP 429).");
        }
        if (!osrmRes.ok) {
          throw new Error(`Routing engine HTTP error (${osrmRes.status}).`);
        }
        const osrmData = await osrmRes.json();
        if (osrmData.routes && osrmData.routes.length > 0) {
          routes = osrmData.routes;
        } else {
          throw new Error(isBn ? "কোনো উপযুক্ত সড়ক রুট পাওয়া যায়নি।" : "No viable road route found between selected points.");
        }
      } catch {
        clearTimeout(timeoutTimer);
        isFallbackRoute = true;
        routingWarningText = isBn
          ? "সড়ক নেভিগেশন ইঞ্জিন সাময়িকভাবে অনুপলব্ধ। সরাসরি ভৌগোলিক করিডোর প্রাক্কলন দেখানো হচ্ছে (এটি টার্ন-বাই-টার্ন সড়ক নেভিগেশন নয়)।"
          : "Routing engine unavailable or timed out. Evaluating hazards via direct corridor fallback (Note: This is an informational hazard scan, not turn-by-turn road navigation).";
      }

      setRoutingNotice(routingWarningText);

      let distanceKm: number | null = null;
      let durationMin: number | null = null;
      let waypoints: number[][] = [];
      let alternativeGeometries: any[] = [];

      if (!isFallbackRoute && routes.length > 0) {
        setOsrmRoutesData(routes);
        const primary = routes[0];
        distanceKm = Math.round((primary.distance / 1000) * 10) / 10;
        durationMin = Math.round(primary.duration / 60);

        // Render on MapLibre
        renderRouteGeometryOnMap(0, routes);

        // Prepare alternatives for backend comparison
        alternativeGeometries = routes.map((r: any) => ({
          distance_km: Math.round((r.distance / 1000) * 10) / 10,
          duration_minutes: Math.round(r.duration / 60),
          coordinates: r.geometry.coordinates,
          summary: r.legs?.[0]?.summary || undefined,
        }));
        waypoints = primary.geometry.coordinates.map((c: number[]) => [c[1], c[0]]); // [lat, lng]
      } else {
        // Fallback straight corridor between endpoints
        setOsrmRoutesData([]);
        const directGeometry = {
          coordinates: [
            [origin.lng, origin.lat],
            [destination.lng, destination.lat],
          ],
        };
        renderRouteGeometryOnMap(0, [{ geometry: directGeometry, distance: 0, duration: 0 }]);
        waypoints = [];
      }

      // 3. Call Backend Agentic Safe Route Evaluation
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
        vehicle_type: vehicleType,
        safety_confirmed: isSafetyConfirmed,
        preference: routePreference,
        alternative_geometries: alternativeGeometries,
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

      // Select default route according to recommendation or preference
      const recId = analysisResp.agentic_recommendation?.recommended_route_id || "route_0";
      setSelectedRouteId(recId);
      const matchIdx = parseInt(recId.replace("route_", ""), 10) || 0;
      if (routes.length > 0) {
        renderRouteGeometryOnMap(matchIdx, routes);
      }

      // Render accident zone markers if returned
      if (analysisResp.accident_zones_along_route) {
        renderAccidentZoneMarkers(analysisResp.accident_zones_along_route);
      }
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
  }, [origin, destination, vehicleType, isSafetyConfirmed, routePreference, isBn, lang, renderRouteGeometryOnMap, renderAccidentZoneMarkers]);

  // Recalculate route whenever endpoints or preference changes
  useEffect(() => {
    if (mapLoaded) {
      calculateSafeRoute();
    }
  }, [mapLoaded, calculateSafeRoute]);

  // Switch between route alternatives
  const handleSelectRouteOption = (routeId: string) => {
    setSelectedRouteId(routeId);
    const idx = parseInt(routeId.replace("route_", ""), 10) || 0;
    renderRouteGeometryOnMap(idx, osrmRoutesData);
  };

  // Start Driving Safety Check Handlers
  const handleInitiateDriving = () => {
    if (vehicleType === "MOTORCYCLE") {
      const now = Date.now();
      const isHelmetVerifiedValid = Boolean(
        helmetToken && helmetTokenExpiresAt && helmetTokenExpiresAt > now
      );
      if (!isHelmetVerifiedValid) {
        setIsSafetyConfirmed(false);
        const expired = Boolean(helmetTokenExpiresAt && helmetTokenExpiresAt <= now);
        setVerificationWarning(
          expired
            ? (isBn
                ? "হেলমেট যাচাইয়ের মেয়াদ (১২০ সেকেন্ড) শেষ হয়েছে। অনুগ্রহ করে ড্রাইভ শুরুর পূর্বে পুনরায় হেলমেট স্ক্যান করুন।"
                : "Helmet verification token has expired. Please re-scan your helmet before starting your ride.")
            : null
        );
        setShowVerificationModal(true);
      } else {
        alert(
          isBn
            ? "মোটরসাইকেল সেফ ড্রাইভ সক্রিয়। হেলমেট যাচাই নিশ্চিত হয়েছে। সাবধানে ড্রাইভ করুন এবং গতিসীমা মেনে চলুন।"
            : "Motorcycle Safe Ride active. Helmet verification confirmed. Ride carefully and obey speed limits."
        );
      }
    } else {
      // CAR
      if (!isSafetyConfirmed) {
        setVerificationWarning(null);
        setShowVerificationModal(true);
      } else {
        alert(
          isBn
            ? "গাড়ির সেফ ড্রাইভ সক্রিয়। সিটবেল্ট নিশ্চিত হয়েছে। নিরাপদ যাত্রা হোক।"
            : "Car safe driving mode active. Seatbelt compliance confirmed. Have a safe journey."
        );
      }
    }
  };

  const handleConfirmSafety = () => {
    if (vehicleType === "MOTORCYCLE") {
      setVerificationWarning(
        isBn
          ? "সতর্কতা: মোটরসাইকেল আরোহীদের জন্য ক্যামেরা দিয়ে হেলমেট যাচাই বাধ্যতামূলক। ম্যানুয়ালি বাইপাস করা নিষিদ্ধ।"
          : "Notice: Camera helmet verification is mandatory for motorcycle riders. Manual confirmation bypass is prohibited."
      );
      return;
    }

    setIsSafetyConfirmed(true);
    setShowVerificationModal(false);
    setVerificationWarning(null);
    setTimeout(() => {
      calculateSafeRoute();
    }, 100);
  };

  // Camera Verification (calls OpenCV /verify-helmet for motorcycle)
  const handleStartCamera = async () => {
    setCameraActive(true);
    setCameraResult(null);
    setVerificationWarning(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported in this browser environment.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setVerificationWarning(
        isBn
          ? "ক্যামেরা পারমিশন পাওয়া যায়নি বা ক্যামেরা অনুপলব্ধ। মোটরসাইকেল ড্রাইভ শুরুর জন্য ক্যামেরা এক্সেস প্রয়োজন।"
          : "Camera permission denied or camera device unavailable. Camera access is required for helmet verification before ride initiation."
      );
      setCameraActive(false);
    }
  };

  const handleCaptureFrame = async () => {
    if (!videoRef.current) return;
    setIsVerifyingCamera(true);
    setVerificationWarning(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 0.85);

        // Call backend OpenCV helmet verification
        const resp = await apiFetch<HelmetVerificationResponse>("/safe-ride/verify-helmet", {
          method: "POST",
          body: JSON.stringify({ image_base64: base64 }),
        });

        if (resp.is_verified && resp.verification_token) {
          setHelmetToken(resp.verification_token);
          const expTime = resp.expires_at ? new Date(resp.expires_at).getTime() : Date.now() + 120000;
          setHelmetTokenExpiresAt(expTime);
          setIsSafetyConfirmed(true);
          setCameraResult(
            isBn
              ? (resp.message_bn || "হেলমেট সফলভাবে শনাক্ত করা হয়েছে! (মেয়াদ: ১২০ সেকেন্ড)")
              : (resp.message_en || "Helmet verified successfully! (Token valid for 120s)")
          );
          setTimeout(() => {
            setShowVerificationModal(false);
            setCameraActive(false);
            calculateSafeRoute();
          }, 1200);
        } else {
          setHelmetToken(null);
          setHelmetTokenExpiresAt(null);
          setIsSafetyConfirmed(false);
          const failMsg = isBn
            ? (resp.message_bn || "হেলমেট শনাক্ত করা যায়নি। অনুগ্রহ করে হেলমেট পরিধান করে মুখমণ্ডল ক্যামেরার দিকে সোজা রেখে পুনরায় স্ক্যান করুন।")
            : (resp.message_en || "Helmet not detected. Please face the camera with your helmet properly worn and try again.");
          setCameraResult(failMsg);
          setVerificationWarning(failMsg);
        }
      }
    } catch (err: any) {
      setVerificationWarning(err?.message || "Failed to process image frame with detection engine.");
    } finally {
      setIsVerifyingCamera(false);
    }
  };

  const handleCloseVerificationModal = () => {
    setShowVerificationModal(false);
    setCameraActive(false);
    setVerificationWarning(null);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return "text-red-700 bg-red-100 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800";
      case "HIGH":
        return "text-orange-700 bg-orange-100 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800";
      case "MODERATE":
        return "text-amber-700 bg-amber-100 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
      case "LOW":
      default:
        return "text-emerald-700 bg-emerald-100 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
    }
  };

  const agenticRec = routeAnalysis?.agentic_recommendation;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Top Header Bar */}
      <div className="h-14 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/safety"
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition"
          >
            <span>←</span>
            <span className="hidden sm:inline">{isBn ? "নিরাপত্তা ড্যাশবোর্ড" : "Safety Hub"}</span>
          </Link>
          <div className="h-4 w-px bg-zinc-750" />
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-emerald-400" />
              <span>{isBn ? "এজেন্টিক সেফ রুট এআই" : "Agentic Safety Road AI"}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Vehicle Selector */}
          <div className="flex items-center bg-zinc-900 border border-zinc-750 p-0.5 rounded-xl">
            <button
              onClick={() => {
                setVehicleType("MOTORCYCLE");
                setIsSafetyConfirmed(false);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                vehicleType === "MOTORCYCLE" ? "bg-blue-600 text-white shadow-xs" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Bike className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Motorcycle</span>
            </button>
            <button
              onClick={() => {
                setVehicleType("CAR");
                setIsSafetyConfirmed(false);
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                vehicleType === "CAR" ? "bg-blue-600 text-white shadow-xs" : "text-zinc-400 hover:text-white"
              }`}
            >
              <CarFront className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Car</span>
            </button>
          </div>

          {/* 2D / 3D Toggle */}
          <button
            type="button"
            onClick={handleToggle3D}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              is3DMode
                ? "bg-cyan-600 text-white"
                : "bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-zinc-750"
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>{is3DMode ? "3D Buildings" : "2D Overhead"}</span>
          </button>
        </div>
      </div>

      {/* Main Viewport: Map with Floating Sidebar & Drawers */}
      <div className="flex-1 relative overflow-hidden flex flex-col md:flex-row">
        {/* Left Side: Route Controls, Agentic Decision & Road Risk Panel */}
        <div className="w-full md:w-96 lg:w-[460px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-r border-zinc-200 dark:border-zinc-800 z-20 flex flex-col h-full overflow-y-auto shadow-2xl">
          {/* Route Endpoints Card */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <Navigation className="h-3.5 w-3.5 text-blue-500" />
                <span>{isBn ? "রুট পরিকল্পনা" : "Route Endpoints"}</span>
              </span>
              <button
                type="button"
                onClick={calculateSafeRoute}
                disabled={isRouting}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <RotateCcw className={`h-3 w-3 ${isRouting ? "animate-spin" : ""}`} />
                <span>{isBn ? "পুনরায় হিসেব" : "Recalculate"}</span>
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
                  <LocateFixed className="h-3 w-3" />
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

            {/* Agentic Route Preference Selector */}
            <div className="pt-1">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                {isBn ? "এজেন্ট অগ্রাধিকার (অপ্টিমাইজেশন):" : "Agent Preference:"}
              </label>
              <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setRoutePreference("RECOMMENDED")}
                  className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                    routePreference === "RECOMMENDED"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <Bot className="h-3 w-3" />
                  <span>{isBn ? "ভারসাম্য" : "Balanced"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRoutePreference("FASTEST")}
                  className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                    routePreference === "FASTEST"
                      ? "bg-sky-600 text-white shadow-2xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <Zap className="h-3 w-3" />
                  <span>{isBn ? "দ্রুততম" : "Fastest"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRoutePreference("SAFEST")}
                  className={`py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                    routePreference === "SAFEST"
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <ShieldCheck className="h-3 w-3" />
                  <span>{isBn ? "নিরাপদ" : "Safest"}</span>
                </button>
              </div>
            </div>

            {/* Start Driving Action Button */}
            <button
              onClick={handleInitiateDriving}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-xs transition active:scale-95 cursor-pointer ${
                isSafetyConfirmed
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {isSafetyConfirmed ? (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>{isBn ? "ড্রাইভিং মোড সক্রিয় (নিরাপত্তা যাচাইকৃত)" : "Driving Mode Active (Safety Verified)"}</span>
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4" />
                  <span>{isBn ? "ড্রাইভ শুরু করুন (নিরাপত্তা যাচাই)" : "Start Driving (Safety Verification)"}</span>
                </>
              )}
            </button>
          </div>

          {/* Safety Evaluation Results & Agentic Road AI */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {/* Error Message */}
            {routeError && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3.5 text-xs text-red-800 dark:text-red-200 flex items-start gap-2.5"
              >
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span>{routeError}</span>
              </div>
            )}

            {/* Routing Notice / Corridor Fallback Disclosure */}
            {routingNotice && !routeError && (
              <div
                role="status"
                className="rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 shadow-xs"
              >
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{routingNotice}</span>
              </div>
            )}

            {/* AGENTIC AI ROUTE PLANNER DECISION PANEL */}
            {agenticRec && (
              <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/40 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-zinc-900 p-4 space-y-2.5 text-xs shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100 text-sm">
                        {isBn ? "এআই রুট সুপারিশ ও সিদ্ধান্ত" : "AI Route Decision"}
                      </h3>
                      <p className="text-[10px] text-zinc-500">
                        {agenticRec.confidence_assessment}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Tradeoff Optimized
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/80 dark:bg-zinc-800/80 border border-emerald-200/80 dark:border-emerald-900/60 space-y-1">
                  <p className="font-bold text-emerald-950 dark:text-emerald-200 text-xs">
                    {agenticRec.primary_reason}
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    {agenticRec.time_vs_safety_tradeoff}
                  </p>
                </div>
              </div>
            )}

            {/* AGENTIC MULTI-CANDIDATE ROUTE CARDS */}
            {agenticRec && agenticRec.candidates && agenticRec.candidates.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-sky-500" />
                    <span>{isBn ? "প্রস্তাবিত রুটসমূহ" : "Candidate Route Alternatives"}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {agenticRec.candidates.map((cand) => {
                    const isSelected = selectedRouteId === cand.route_id;
                    return (
                      <div
                        key={cand.route_id}
                        onClick={() => handleSelectRouteOption(cand.route_id)}
                        className={`p-3.5 rounded-2xl border transition cursor-pointer space-y-2 ${
                          isSelected
                            ? "border-emerald-500 ring-2 ring-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-xs"
                            : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 hover:border-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">
                              {cand.label}
                            </span>
                            {cand.is_recommended && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-600 text-white shadow-2xs">
                                AI Recommended
                              </span>
                            )}
                            {cand.is_fastest && !cand.is_recommended && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-sky-600 text-white shadow-2xs">
                                Fastest
                              </span>
                            )}
                            {cand.is_safest && !cand.is_recommended && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-600 text-white shadow-2xs">
                                Safest
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getRiskColor(cand.risk_level)}`}>
                            {cand.risk_level} (Score {cand.risk_score})
                          </span>
                        </div>

                        {/* Metrics Bar */}
                        <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">
                            {cand.distance_km} km
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>~{cand.duration_minutes} min</span>
                          </span>
                          {cand.accident_zones_count > 0 ? (
                            <>
                              <span>•</span>
                              <span className="text-red-600 font-bold flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                <span>{cand.accident_zones_count} Blackspot(s)</span>
                              </span>
                            </>
                          ) : (
                            <>
                              <span>•</span>
                              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3" />
                                <span>0 Blackspots</span>
                              </span>
                            </>
                          )}
                        </div>

                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                          {cand.tradeoff_rationale}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ROUTE COMPARISON TABLE */}
            {agenticRec && agenticRec.candidates && agenticRec.candidates.length > 1 && (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 p-3.5 space-y-2 text-xs">
                <span className="font-bold text-zinc-700 dark:text-zinc-300 block">
                  {isBn ? "রুট তুলনা সারণি:" : "Candidate Comparison Matrix:"}
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700 text-[10px] text-zinc-400 font-bold">
                        <th className="pb-1.5">Route</th>
                        <th className="pb-1.5">Distance</th>
                        <th className="pb-1.5">Duration</th>
                        <th className="pb-1.5">Risk Score</th>
                        <th className="pb-1.5">Blackspots</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-[11px]">
                      {agenticRec.candidates.map((c) => (
                        <tr
                          key={c.route_id}
                          onClick={() => handleSelectRouteOption(c.route_id)}
                          className={`cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                            selectedRouteId === c.route_id ? "font-black text-emerald-600 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          <td className="py-1.5 truncate max-w-[100px]">{c.label}</td>
                          <td className="py-1.5">{c.distance_km} km</td>
                          <td className="py-1.5">~{c.duration_minutes}m</td>
                          <td className="py-1.5">{c.risk_score}/100</td>
                          <td className="py-1.5">{c.accident_zones_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DOCUMENTED ACCIDENT-PRONE ZONES ALONG ROUTE */}
            {routeAnalysis?.accident_zones_along_route && routeAnalysis.accident_zones_along_route.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>{isBn ? "নথিভুক্ত দুর্ঘটনা ব্ল্যাকস্পট" : "Documented Accident Zones"} ({routeAnalysis.accident_zones_along_route.length})</span>
                  </span>
                </div>

                <div className="space-y-2">
                  {routeAnalysis.accident_zones_along_route.map((zone) => (
                    <div
                      key={zone.id}
                      onClick={() => {
                        setSelectedAccidentZone(zone);
                        if (mapRef.current) {
                          mapRef.current.flyTo({
                            center: [zone.longitude, zone.latitude],
                            zoom: 15.5,
                            pitch: is3DMode ? 55 : 0,
                          });
                        }
                      }}
                      className="p-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 hover:border-red-400 cursor-pointer transition space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-red-950 dark:text-red-100 truncate">
                          {zone.zone_name}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-600 text-white">
                          {zone.risk_level}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        {zone.road_name} • {zone.district}
                      </div>
                      {zone.accident_count && (
                        <div className="text-[10px] text-red-700 dark:text-red-300 font-semibold pt-0.5">
                          {zone.accident_count} accidents documented ({zone.observation_period})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nearby Verified Emergency Facilities */}
            {routeAnalysis?.emergency_services_along_route && routeAnalysis.emergency_services_along_route.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  {isBn ? "নিকটস্থ জরুরি সেবা" : "Emergency Units Near Route"}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {routeAnalysis.emergency_services_along_route.slice(0, 4).map((svc) => (
                    <div
                      key={svc.id}
                      className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 text-xs space-y-1"
                    >
                      <div className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {svc.name}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {svc.service_type} • {svc.distance_text}
                      </div>
                      {svc.phone_number && (
                        <a
                          href={`tel:${svc.phone_number}`}
                          className="inline-block text-[10px] font-bold text-emerald-600 hover:underline pt-0.5"
                        >
                          {svc.phone_number}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Map Container Viewport */}
        <div className="flex-1 relative h-full">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Floating Map Legend */}
          <div className="absolute bottom-6 right-6 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-lg text-[11px] space-y-1.5 hidden sm:block">
            <span className="font-bold text-zinc-500 uppercase tracking-wider block text-[10px]">
              Route Map Legend
            </span>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-6 rounded-full bg-emerald-500" />
              <span className="text-zinc-800 dark:text-zinc-200">AI Recommended</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-6 rounded-full bg-sky-500" />
              <span className="text-zinc-800 dark:text-zinc-200">Fastest Route</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-6 rounded-full bg-indigo-500" />
              <span className="text-zinc-800 dark:text-zinc-200">Safest Alternative</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center">!</span>
              <span className="text-zinc-800 dark:text-zinc-200">Accident Blackspot</span>
            </div>
          </div>

          {/* Selected Hazard Detail Popover */}
          {selectedHazard && (
            <div className="absolute top-4 left-4 z-30 max-w-sm w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-3xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-600 text-white">
                  Reported Hazard
                </span>
                <button
                  onClick={() => setSelectedHazard(null)}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs font-bold h-7 w-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h4 className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">
                {selectedHazard.title}
              </h4>
              <p className="text-xs text-zinc-500">
                {selectedHazard.location_text} • {selectedHazard.distance_text}
              </p>
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-xs">
                <span className="text-[10px] text-zinc-400">{selectedHazard.incident_date_text}</span>
                <Link
                  href={selectedHazard.report_url}
                  className="font-bold text-emerald-600 hover:underline inline-flex items-center gap-1"
                >
                  <span>View Details →</span>
                </Link>
              </div>
            </div>
          )}

          {/* Selected Accident Zone Detail Modal / Popover */}
          {selectedAccidentZone && (
            <div className="absolute top-4 right-4 z-30 max-w-sm w-85 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-3xl p-4.5 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-600 text-white">
                  {selectedAccidentZone.risk_level} Accident Blackspot
                </span>
                <button
                  onClick={() => setSelectedAccidentZone(null)}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs font-bold h-7 w-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                {selectedAccidentZone.zone_name}
              </h3>

              <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                <p><strong>Road:</strong> {selectedAccidentZone.road_name}</p>
                <p><strong>District:</strong> {selectedAccidentZone.district}, {selectedAccidentZone.division}</p>
                {selectedAccidentZone.accident_count && (
                  <p className="text-red-600 dark:text-red-400 font-bold">
                    <strong>{selectedAccidentZone.hazard_density_label || "Estimated Hazard Index"}:</strong> {selectedAccidentZone.accident_count} ({selectedAccidentZone.observation_period || "Historical Study Model"})
                  </p>
                )}
                <p className="text-[11px] text-zinc-500">
                  <strong>Source Review:</strong> {selectedAccidentZone.data_source}
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                  * Note: Estimated density based on historical corridor reviews. Not a live sensor stream or certified casualty census.
                </p>
                {selectedAccidentZone.description && (
                  <p className="text-[11px] pt-1 text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {selectedAccidentZone.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROAD AI SAFETY VERIFICATION MODAL (Mandatory Helmet Verification for Motorcycle) */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                    {isBn ? "রোড এআই নিরাপত্তা যাচাই" : "Road AI Safety Verification"}
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    {vehicleType === "MOTORCYCLE" ? "Motorcycle Rider Protocol (Mandatory)" : "Car Driver Protocol"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseVerificationModal}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs font-bold h-7 w-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {verificationWarning && (
              <div
                role="alert"
                className="rounded-2xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 flex items-start gap-2.5"
              >
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span>{verificationWarning}</span>
              </div>
            )}

            {/* Motorcycle Mandatory Camera Scanner */}
            {vehicleType === "MOTORCYCLE" ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-zinc-100 dark:bg-zinc-800 p-3 text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                    <Bike className="h-4 w-4 text-blue-600" />
                    <span>ক্যামেরা হেলমেট ডিটেকশন প্রোটোকল</span>
                  </p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    বাংলাদেশ সড়ক পরিবহন আইন অনুযায়ী মোটরসাইকেল চালকের হেলমেট পরিধান আইনিভাবে বাধ্যতামূলক। ড্রাইভ মোড চালুর জন্য ক্যামেরার সামনে মুখমণ্ডল ও হেলমেট স্ক্যান করুন।
                  </p>
                </div>

                <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-zinc-950 flex items-center justify-center border border-zinc-300 dark:border-zinc-700">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
                  />
                  {!cameraActive && (
                    <div className="text-center p-4 space-y-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400 mx-auto">
                        <Camera className="h-6 w-6" />
                      </div>
                      <p className="text-xs text-zinc-400">ক্যামেরা বর্তমানে বন্ধ রয়েছে</p>
                      <button
                        type="button"
                        onClick={handleStartCamera}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        ক্যামেরা চালু করুন
                      </button>
                    </div>
                  )}

                  {cameraActive && (
                    <div className="absolute inset-0 border-2 border-dashed border-emerald-400/60 pointer-events-none rounded-2xl flex items-center justify-center">
                      <span className="text-[10px] text-emerald-400 bg-black/50 px-2 py-0.5 rounded-full">
                        মাথা ফ্রেমের ভেতর রাখুন
                      </span>
                    </div>
                  )}
                </div>

                {cameraResult && (
                  <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200">
                    {cameraResult}
                  </div>
                )}

                {cameraActive && (
                  <button
                    type="button"
                    onClick={handleCaptureFrame}
                    disabled={isVerifyingCamera}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{isVerifyingCamera ? "যাচাই করা হচ্ছে..." : "হেলমেট যাচাই ও ড্রাইভ আনলক"}</span>
                  </button>
                )}
              </div>
            ) : (
              // CAR Driver Modal
              <div className="space-y-4">
                <div className="rounded-2xl bg-zinc-100 dark:bg-zinc-800 p-3 text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                    <CarFront className="h-4 w-4 text-blue-600" />
                    <span>সিটবেল্ট নিরাপত্তা কমপ্লায়েন্স</span>
                  </p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    নিরাপদ ড্রাইভিংয়ের জন্য সিটবেল্ট পরিধান নিশ্চিত করুন। গতি নিয়ন্ত্রণে রাখুন এবং মোবাইল ফোন ব্যবহার থেকে বিরত থাকুন।
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmSafety}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>আমি সিটবেল্ট বেঁধেছি (ড্রাইভ শুরু)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
