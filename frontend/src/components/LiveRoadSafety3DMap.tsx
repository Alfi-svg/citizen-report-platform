"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  RoadSafetyIntelligenceResponse,
  RoadSafetyRiskLevel,
  NearbySafetyAlert,
  AccidentHistoryItem,
  RoadSafetyHotspotItem,
  RouteRiskEvaluationResponse,
} from "@/lib/types";
import {
  watchLiveLocation,
  LivePosition,
  captureCurrentLocation,
  LocationError,
  calculateBearingDegrees,
} from "@/lib/location";
import { Language } from "@/lib/i18n";
import { MapPin, X, Siren, TrafficCone, Shield, Check, Square, CarFront } from "lucide-react";

interface LiveRoadSafety3DMapProps {
  initialLatitude?: number;
  initialLongitude?: number;
  initialAreaName?: string;
  lang?: Language;
}

interface DestinationPreset {
  nameEn: string;
  nameBn: string;
  lat: number;
  lng: number;
}

const BD_DESTINATION_PRESETS: DestinationPreset[] = [
  { nameEn: "Gabtoli Bus Terminal (Mirpur)", nameBn: "গাবতলী বাস টার্মিনাল (মিরপুর)", lat: 23.7806, lng: 90.3522 },
  { nameEn: "Airport Road (Kuril - Uttara)", nameBn: "এয়ারপোর্ট রোড (কুড়িল - উত্তরা)", lat: 23.8341, lng: 90.4196 },
  { nameEn: "Farmgate Crossing (Tejgaon)", nameBn: "ফার্মগেট মোড় (তেজগাঁও)", lat: 23.7561, lng: 90.3872 },
  { nameEn: "Shahbagh Intersection", nameBn: "শাহবাগ মোড়", lat: 23.7389, lng: 90.3957 },
  { nameEn: "Jatrabari - Kanchpur Stretch", nameBn: "যাত্রাবাড়ী - কাঁচপুর মহাসড়ক", lat: 23.7042, lng: 90.5098 },
  { nameEn: "Chittagong Port Access Road", nameBn: "চট্টগ্রাম পোর্ট এক্সেস রোড", lat: 22.3168, lng: 91.7981 },
];

export default function LiveRoadSafety3DMap({
  initialLatitude = 23.7461,
  initialLongitude = 90.3742,
  initialAreaName = "Dhanmondi, Dhaka",
  lang = "en",
}: LiveRoadSafety3DMapProps) {
  const isBn = lang === "bn";
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const unwatchLocationRef = useRef<(() => void) | null>(null);
  const lastAlertTimesRef = useRef<Map<string, number>>(new Map());

  // Location & Navigation State
  const [currentPos, setCurrentPos] = useState<LivePosition>({
    latitude: initialLatitude,
    longitude: initialLongitude,
    accuracy: 15,
    heading: 0,
    speed: 0,
    timestamp: Date.now(),
  });
  const [isDriving, setIsDriving] = useState<boolean>(false);
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Layer Toggles
  const [showRiskHeatmap, setShowRiskHeatmap] = useState<boolean>(true);
  const [showTraffic, setShowTraffic] = useState<boolean>(false);
  const [trafficNotice, setTrafficNotice] = useState<string | null>(null);

  // Road Safety Data
  const [roadData, setRoadData] = useState<RoadSafetyIntelligenceResponse | null>(null);
  const [loadingRoadData, setLoadingRoadData] = useState<boolean>(false);
  const [selectedIncident, setSelectedIncident] = useState<AccidentHistoryItem | NearbySafetyAlert | null>(null);

  // Proximity Driving Alerts
  const [activeDriverAlert, setActiveDriverAlert] = useState<NearbySafetyAlert | null>(null);

  // Routing State
  const [destination, setDestination] = useState<DestinationPreset | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showPresets, setShowPresets] = useState<boolean>(false);
  const [isRouting, setIsRouting] = useState<boolean>(false);
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    durationMin: number;
    geometry: any;
  } | null>(null);
  const [routeRisk, setRouteRisk] = useState<RouteRiskEvaluationResponse | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Play subtle safety audio alert chime
  const playAlertChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

  // 1. Fetch Road Safety Intelligence Data around coordinates
  const fetchRoadData = useCallback(async (lat: number, lng: number) => {
    setLoadingRoadData(true);
    try {
      const res = await apiFetch<RoadSafetyIntelligenceResponse>(
        `/safety/road-intelligence?latitude=${lat}&longitude=${lng}&radius_km=12.0&lang=${lang}`
      );
      setRoadData(res);
    } catch (err: unknown) {
      console.warn("Could not load road safety intelligence data:", err);
    } finally {
      setLoadingRoadData(false);
    }
  }, [lang]);

  // Load road safety data on mount
  useEffect(() => {
    fetchRoadData(initialLatitude, initialLongitude);
  }, [fetchRoadData, initialLatitude, initialLongitude]);

  // 2. Initialize MapLibre GL JS
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    // Inject MapLibre CSS if not already present
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

      // Clean up previous map instance if exists
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
      }

      // Initialize MapLibre map with 3D OpenFreeMap vector style
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [currentPos.longitude, currentPos.latitude],
        zoom: 15.5,
        pitch: is3DMode ? 55 : 0,
        bearing: currentPos.heading || 0,
        antialias: true,
        maxPitch: 80,
      });

      map.on("load", () => {
        if (!isMounted) return;
        setMapLoaded(true);

        // Add 3D building extrusions
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
                    0, "#2d333b",
                    30, "#22272e",
                    60, "#1c2128"
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
                  "fill-extrusion-opacity": 0.75,
                },
              },
              labelLayerId
            );
          }
        } catch {}

        // Add User Location Marker
        const el = document.createElement("div");
        el.className = "user-location-marker relative flex items-center justify-center";
        el.innerHTML = `
          <div class="absolute h-10 w-10 rounded-full bg-cyan-500/25 animate-ping"></div>
          <div class="h-6 w-6 rounded-full bg-cyan-600 border-2 border-white shadow-xl flex items-center justify-center">
            <div class="h-2 w-2 rounded-full bg-white"></div>
          </div>
          <div class="user-heading-cone absolute -top-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[14px] border-b-cyan-500/80 transition-transform duration-300"></div>
        `;

        const marker = new maplibregl.Marker({ element: el, rotationAlignment: "map" })
          .setLngLat([currentPos.longitude, currentPos.latitude])
          .addTo(map);

        userMarkerRef.current = marker;
      });

      mapRef.current = map;
    };

    // Load MapLibre JS script if not present
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
  }, []);

  // 3. Update User Marker & Camera when Location Changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    // Update marker coordinates & rotation
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([currentPos.longitude, currentPos.latitude]);
      const cone = userMarkerRef.current.getElement().querySelector(".user-heading-cone");
      if (cone && currentPos.heading !== null) {
        cone.style.transform = `rotate(${currentPos.heading}deg)`;
      }
    }

    // Follow user if driving mode is active
    if (isDriving) {
      map.easeTo({
        center: [currentPos.longitude, currentPos.latitude],
        zoom: 16.5,
        pitch: is3DMode ? 58 : 0,
        bearing: currentPos.heading || 0,
        duration: 1000,
        essential: true,
      });

      // Check proximity alerts against road hazards (within 500m)
      if (roadData?.nearby_alerts) {
        const now = Date.now();
        for (const alert of roadData.nearby_alerts) {
          if (alert.latitude && alert.longitude) {
            const d = calculateBearingDegrees(
              currentPos.latitude,
              currentPos.longitude,
              alert.latitude,
              alert.longitude
            );
            // approximate Euclidean distance in meters
            const latDiff = (currentPos.latitude - alert.latitude) * 111000;
            const lngDiff = (currentPos.longitude - alert.longitude) * 111000 * Math.cos(currentPos.latitude * Math.PI / 180);
            const distM = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

            if (distM <= 500) {
              const lastAlert = lastAlertTimesRef.current.get(alert.id) || 0;
              // 3-minute cooldown per zone to prevent spamming while driving
              if (now - lastAlert >= 180000) {
                lastAlertTimesRef.current.set(alert.id, now);
                setActiveDriverAlert(alert);
                playAlertChime();
                break;
              }
            }
          }
        }
      }
    }
  }, [currentPos, isDriving, is3DMode, mapLoaded, roadData, playAlertChime]);

  // 4. Render Incident Markers & Risk Heatmap Zones
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !roadData) return;
    const map = mapRef.current;
    const maplibregl = (window as any).maplibregl;
    if (!maplibregl) return;

    // Remove existing incident layer/sources if present
    const cleanLayers = ["accident-heatmap", "accident-risk-circles", "accident-corridor-circles"];
    for (const l of cleanLayers) {
      if (map.getLayer(l)) map.removeLayer(l);
    }
    const cleanSources = ["accident-incidents-source", "corridors-source"];
    for (const s of cleanSources) {
      if (map.getSource(s)) map.removeSource(s);
    }

    if (!showRiskHeatmap) return;

    // 1. Prepare GeoJSON for incidents with coordinates
    const incidentFeatures = roadData.history
      .filter((h) => h.latitude && h.longitude)
      .map((h) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [h.longitude, h.latitude],
        },
        properties: {
          id: h.report_id,
          title: h.title,
          location_text: h.location_text,
          is_verified: h.is_verified,
          severity: h.severity,
          risk_level: roadData.risk_level,
        },
      }));

    if (incidentFeatures.length > 0) {
      map.addSource("accident-incidents-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: incidentFeatures,
        },
      });

      // Add soft risk aura circles around accident points
      map.addLayer({
        id: "accident-risk-circles",
        type: "circle",
        source: "accident-incidents-source",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 8,
            15, 24,
            18, 50,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "severity"], "High"], "#ef4444", // Red for High
            ["==", ["get", "is_verified"], true], "#f59e0b", // Yellow/Orange for verified
            "#10b981", // Green for standard
          ],
          "circle-opacity": 0.45,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-blur": 0.3,
        },
      });

      // Marker click listener
      map.on("click", "accident-risk-circles", (e: any) => {
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          const match = roadData.history.find((h) => h.report_id === props.id);
          if (match) setSelectedIncident(match);
        }
      });

      map.on("mouseenter", "accident-risk-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "accident-risk-circles", () => {
        map.getCanvas().style.cursor = "";
      });
    }

    // 2. Prepare Regional Corridors source
    const corridorFeatures = roadData.hotspots.map((spot) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [spot.longitude, spot.latitude],
      },
      properties: {
        area_name: spot.area_name,
        accident_count: spot.accident_count,
        risk_level: spot.risk_level,
      },
    }));

    if (corridorFeatures.length > 0) {
      map.addSource("corridors-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: corridorFeatures,
        },
      });

      map.addLayer({
        id: "accident-corridor-circles",
        type: "circle",
        source: "corridors-source",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 15,
            15, 45,
            18, 90,
          ],
          "circle-color": [
            "match",
            ["get", "risk_level"],
            "Critical", "#dc2626",
            "High", "#ea580c",
            "Moderate", "#eab308",
            "#16a34a",
          ],
          "circle-opacity": 0.3,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
      });
    }
  }, [mapLoaded, roadData, showRiskHeatmap]);

  // 5. Handle Start Driving / Stop Tracking
  const handleToggleDriving = () => {
    if (isDriving) {
      // Stop tracking
      if (unwatchLocationRef.current) {
        unwatchLocationRef.current();
        unwatchLocationRef.current = null;
      }
      setIsDriving(false);
      setActiveDriverAlert(null);
    } else {
      // Start Driving
      setLocationError(null);
      const unwatch = watchLiveLocation(
        (pos) => {
          setCurrentPos(pos);
        },
        (err) => {
          setLocationError(err.message);
          setIsDriving(false);
        },
        { enableHighAccuracy: true }
      );
      unwatchLocationRef.current = unwatch;
      setIsDriving(true);
      setIs3DMode(true);

      // Pitch camera into driving perspective
      if (mapRef.current) {
        mapRef.current.easeTo({
          pitch: 58,
          zoom: 16.5,
          duration: 1200,
        });
      }
    }
  };

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => {
      if (unwatchLocationRef.current) {
        unwatchLocationRef.current();
        unwatchLocationRef.current = null;
      }
    };
  }, []);

  // 6. Handle 2D / 3D Toggle
  const handleToggle3D = () => {
    if (!mapRef.current) return;
    const nextMode = !is3DMode;
    setIs3DMode(nextMode);
    mapRef.current.easeTo({
      pitch: nextMode ? 58 : 0,
      duration: 800,
    });
  };

  // Recenter to Current User Position
  const handleRecenter = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [currentPos.longitude, currentPos.latitude],
      zoom: isDriving ? 16.5 : 15.5,
      pitch: is3DMode ? 55 : 0,
      bearing: currentPos.heading || 0,
      speed: 1.2,
    });
  };

  // 7. Handle Traffic Toggle with honest data availability notice
  const handleToggleTraffic = () => {
    if (!showTraffic) {
      // Check if external traffic tiles are configured
      const trafficTile = process.env.NEXT_PUBLIC_TRAFFIC_TILE_URL;
      if (!trafficTile) {
        setTrafficNotice(
          isBn
            ? "লাইভ ট্রাফিক ডেটা অনুপলব্ধ: লাইভ ট্রাফিক ফ্লো প্রদর্শনের জন্য এক্সটার্নাল ট্রাফিক প্রোভাইডার এপিআই কী প্রয়োজন। ভুল তথ্য পরিহার করতে সাধারণ সড়ককে ট্রাফিক জ্যাম হিসেবে দেখানো হচ্ছে না।"
            : "Traffic data unavailable: Real-time traffic flow visualization requires an external traffic provider API key. Static roads are not falsely labeled as live traffic."
        );
        setShowTraffic(false);
        return;
      }
      setShowTraffic(true);
      setTrafficNotice(null);
    } else {
      setShowTraffic(false);
      setTrafficNotice(null);
    }
  };

  // 8. Handle Destination Selection & Route Planning via OSRM + Backend Risk
  const handleSelectDestination = async (dest: DestinationPreset) => {
    setDestination(dest);
    setShowPresets(false);
    setIsRouting(true);
    setRouteError(null);
    setRouteInfo(null);
    setRouteRisk(null);

    try {
      // 1. Fetch road route from Open Source Routing Machine (OSRM)
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${currentPos.longitude},${currentPos.latitude};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
      const res = await fetch(osrmUrl);
      if (!res.ok) throw new Error("Public route engine unreachable.");
      const routeData = await res.json();

      if (!routeData.routes || routeData.routes.length === 0) {
        throw new Error(isBn ? "কোনো উপযুক্ত সড়ক রুট পাওয়া যায়নি।" : "No viable road route found.");
      }

      const primaryRoute = routeData.routes[0];
      const distKm = Math.round((primaryRoute.distance / 1000) * 10) / 10;
      const durationMin = Math.round(primaryRoute.duration / 60);

      setRouteInfo({
        distanceKm: distKm,
        durationMin,
        geometry: primaryRoute.geometry,
      });

      // 2. Render route polyline on map
      if (mapRef.current) {
        const map = mapRef.current;
        if (map.getLayer("planned-route-line")) map.removeLayer("planned-route-line");
        if (map.getLayer("planned-route-casing")) map.removeLayer("planned-route-casing");
        if (map.getSource("planned-route-source")) map.removeSource("planned-route-source");

        map.addSource("planned-route-source", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: primaryRoute.geometry,
          },
        });

        // Glow casing
        map.addLayer({
          id: "planned-route-casing",
          type: "line",
          source: "planned-route-source",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#0284c7",
            "line-width": 8,
            "line-opacity": 0.4,
          },
        });

        // Main bright blue route line
        map.addLayer({
          id: "planned-route-line",
          type: "line",
          source: "planned-route-source",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#38bdf8",
            "line-width": 5,
            "line-opacity": 0.95,
          },
        });

        // Fit bounds to encompass current location & destination
        const coords = primaryRoute.geometry.coordinates;
        const maplibregl = (window as any).maplibregl;
        const bounds = coords.reduce(
          (b: any, coord: number[]) => b.extend(coord),
          new maplibregl.LngLatBounds(coords[0], coords[0])
        );
        map.fitBounds(bounds, { padding: 80, maxZoom: 15.5 });
      }

      // 3. Evaluate road risk along the route via backend endpoint
      const waypoints = primaryRoute.geometry.coordinates.map((c: number[]) => [c[1], c[0]]); // [lat, lng]
      const riskResp = await apiFetch<RouteRiskEvaluationResponse>(
        "/safety/road-intelligence/route-risk",
        {
          method: "POST",
          body: JSON.stringify({ waypoints, lang }),
        }
      );
      setRouteRisk(riskResp);
    } catch (err: unknown) {
      setRouteError(err instanceof Error ? err.message : "Route calculation error.");
    } finally {
      setIsRouting(false);
    }
  };

  const clearRoute = () => {
    setDestination(null);
    setRouteInfo(null);
    setRouteRisk(null);
    setRouteError(null);
    if (mapRef.current) {
      const map = mapRef.current;
      if (map.getLayer("planned-route-line")) map.removeLayer("planned-route-line");
      if (map.getLayer("planned-route-casing")) map.removeLayer("planned-route-casing");
      if (map.getSource("planned-route-source")) map.removeSource("planned-route-source");
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)] min-h-[500px] overflow-hidden bg-zinc-950 text-white select-none">
      {/* 1. Map Canvas */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* 2. Top Floating Header & Destination Search */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-col items-center gap-2 max-w-xl mx-auto pointer-events-none">
        {/* Navigation Search Bar */}
        <div className="w-full bg-zinc-900/90 backdrop-blur-md border border-zinc-700/80 rounded-2xl shadow-2xl p-2.5 flex items-center gap-2.5 pointer-events-auto">
          <div className="h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 text-emerald-400 font-black">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              placeholder={isBn ? "গন্তব্য অনুসন্ধান করুন বা নির্বাচন করুন..." : "Where to? Search or pick destination..."}
              value={destination ? (isBn ? destination.nameBn : destination.nameEn) : searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDestination(null);
                setShowPresets(true);
              }}
              onFocus={() => setShowPresets(true)}
              className="w-full bg-transparent text-sm font-semibold text-white placeholder-zinc-400 focus:outline-none"
            />
          </div>
          {destination ? (
            <button
              onClick={clearRoute}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              title="Clear Route"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition"
            >
              {isBn ? "পছন্দসমূহ" : "Presets"}
            </button>
          )}
        </div>

        {/* Destination Presets Dropdown */}
        {showPresets && !destination && (
          <div className="w-full bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-2xl shadow-2xl p-2 space-y-1 max-h-56 overflow-y-auto pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-150">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 block pt-1">
              {isBn ? "জনপ্রিয় পরিবহন কেন্দ্র ও মহাসড়ক" : "Popular Corridors & Transport Hubs"}
            </span>
            {BD_DESTINATION_PRESETS.map((dest, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectDestination(dest)}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-emerald-400 transition flex items-center justify-between"
              >
                <span>{isBn ? dest.nameBn : dest.nameEn}</span>
                <span className="text-zinc-500 text-[10px]">→</span>
              </button>
            ))}
          </div>
        )}

        {/* Live Proximity Driver Alert Banner */}
        {activeDriverAlert && (
          <div className="w-full bg-red-650/95 border-2 border-red-500 text-white rounded-2xl shadow-2xl p-3 flex items-start justify-between gap-3 pointer-events-auto animate-bounce duration-1000">
            <div className="flex items-center gap-2.5">
              <Siren className="h-6 w-6 text-red-300 animate-pulse shrink-0" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-red-200">
                  {isBn ? "সতর্কতা: উচ্চ-ঝুঁকিপূর্ণ দুর্ঘটনা পয়েন্ট" : "Driver Warning: High-Risk Accident Zone"}
                </h4>
                <p className="text-xs font-bold mt-0.5 leading-snug">
                  {activeDriverAlert.title}
                </p>
                <span className="text-[11px] text-red-100 mt-0.5 block">
                  {activeDriverAlert.distance_text} • {activeDriverAlert.alert_reason}
                </span>
              </div>
            </div>
            <button
              onClick={() => setActiveDriverAlert(null)}
              className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Traffic Unavailable Notice Pill */}
        {trafficNotice && (
          <div className="bg-zinc-900/95 border border-amber-500/50 text-amber-300 text-xs px-3.5 py-2 rounded-xl shadow-lg flex items-center justify-between gap-3 pointer-events-auto">
            <span>{trafficNotice}</span>
            <button onClick={() => setTrafficNotice(null)} className="text-zinc-400 hover:text-white font-bold">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Location Error Notice */}
        {locationError && (
          <div className="bg-red-950/90 border border-red-500/50 text-red-300 text-xs px-3.5 py-2 rounded-xl shadow-lg flex items-center justify-between gap-3 pointer-events-auto">
            <span>{locationError}</span>
            <button onClick={() => setLocationError(null)} className="text-zinc-400 hover:text-white font-bold">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* 3. Floating Right-Side Map Controls */}
      <div className="absolute right-4 top-20 z-20 flex flex-col gap-2.5">
        {/* 2D / 3D Pitch Toggle */}
        <button
          type="button"
          onClick={handleToggle3D}
          className={`h-11 w-11 rounded-2xl backdrop-blur-md border shadow-xl flex flex-col items-center justify-center transition active:scale-95 cursor-pointer ${
            is3DMode
              ? "bg-cyan-600 border-cyan-400 text-white font-black"
              : "bg-zinc-900/85 border-zinc-700 text-zinc-300 hover:text-white"
          }`}
          title={is3DMode ? "Switch to 2D Top-Down View" : "Switch to 3D Perspective View"}
        >
          <span className="text-xs font-black">{is3DMode ? "3D" : "2D"}</span>
        </button>

        {/* Recenter to User Location */}
        <button
          type="button"
          onClick={handleRecenter}
          className="h-11 w-11 rounded-2xl bg-zinc-900/85 hover:bg-zinc-800 backdrop-blur-md border border-zinc-700 shadow-xl flex items-center justify-center text-zinc-200 hover:text-white transition active:scale-95 cursor-pointer"
          title="Recenter Map"
        >
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>

        {/* Traffic Layer Toggle */}
        <button
          type="button"
          onClick={handleToggleTraffic}
          className={`h-11 w-11 rounded-2xl backdrop-blur-md border shadow-xl flex items-center justify-center transition active:scale-95 cursor-pointer ${
            showTraffic
              ? "bg-amber-600 border-amber-400 text-white"
              : "bg-zinc-900/85 border-zinc-700 text-zinc-300 hover:text-white"
          }`}
          title="Traffic Layer Toggle"
        >
          <TrafficCone className="h-5 w-5" />
        </button>

        {/* Accident Risk Heatmap Toggle */}
        <button
          type="button"
          onClick={() => setShowRiskHeatmap(!showRiskHeatmap)}
          className={`h-11 w-11 rounded-2xl backdrop-blur-md border shadow-xl flex items-center justify-center transition active:scale-95 cursor-pointer ${
            showRiskHeatmap
              ? "bg-rose-600 border-rose-400 text-white"
              : "bg-zinc-900/85 border-zinc-700 text-zinc-300 hover:text-white"
          }`}
          title="Accident Risk Heatmap Toggle"
        >
          <Shield className="h-5 w-5" />
        </button>

        {/* National 999 Hotline Quick Dial */}
        <a
          href="tel:999"
          className="h-11 w-11 rounded-2xl bg-red-600 hover:bg-red-500 border border-red-400 shadow-xl flex items-center justify-center text-white transition active:scale-95 cursor-pointer"
          title="Emergency 999"
        >
          <span className="text-xs font-black">999</span>
        </a>
      </div>

      {/* 4. Speedometer Floating Widget (Active when Driving) */}
      {isDriving && (
        <div className="absolute left-4 top-20 z-20 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-2xl p-3 shadow-xl flex items-center gap-3">
          <div className="text-center">
            <span className="text-2xl font-black text-cyan-400 leading-none block">
              {currentPos.speed !== null ? currentPos.speed : "--"}
            </span>
            <span className="text-[10px] font-bold text-zinc-400 uppercase">km/h</span>
          </div>
          <div className="h-8 w-[1px] bg-zinc-700" />
          <div className="space-y-0.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{isBn ? "লাইভ ট্র্যাকিং সক্রিয়" : "Live GPS Active"}</span>
            </span>
            <span className="text-[10px] text-zinc-400 block">
              {isBn ? "গতি ও ঝুঁকি স্ক্যানিং" : "Speed & Risk Scanning"}
            </span>
          </div>
        </div>
      )}

      {/* 5. Bottom Driving & Route Assessment Sheet */}
      <div className="absolute bottom-4 left-4 right-4 z-20 max-w-xl mx-auto flex flex-col gap-2">
        {/* Planned Route Assessment Card */}
        {routeInfo && (
          <div className="bg-zinc-900/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-4 shadow-2xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  {isBn ? "পরিকল্পিত ড্রাইভিং রুট" : "Driving Route Plan"}
                </span>
                <h3 className="text-sm font-black text-white">
                  {destination ? (isBn ? destination.nameBn : destination.nameEn) : "Selected Destination"}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-cyan-300">
                  {routeInfo.distanceKm} km
                </span>
                <span className="text-xs text-zinc-400 block">
                  ~{routeInfo.durationMin} min
                </span>
              </div>
            </div>

            {/* Route Risk Evaluation */}
            {routeRisk ? (
              <div className="p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/80 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-zinc-300">
                    {isBn ? "রুট নিরাপত্তা ঝুঁকি:" : "Route Risk Level:"}{" "}
                  </span>
                  <span
                    className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                      routeRisk.route_risk_level === "Critical"
                        ? "bg-red-950 text-red-300 border border-red-700"
                        : routeRisk.route_risk_level === "High"
                        ? "bg-orange-950 text-orange-300 border border-orange-700"
                        : routeRisk.route_risk_level === "Moderate"
                        ? "bg-amber-950 text-amber-300 border border-amber-700"
                        : "bg-emerald-950 text-emerald-300 border border-emerald-700"
                    }`}
                  >
                    {routeRisk.route_risk_level} (Score {routeRisk.route_risk_score}/100)
                  </span>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {routeRisk.safety_advisory}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-rose-400 block">
                    {routeRisk.total_hazards_count}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {isBn ? "ঝুঁকি স্পট" : "Hazard spots"}
                  </span>
                </div>
              </div>
            ) : isRouting ? (
              <p className="text-xs text-zinc-400 italic">
                {isBn ? "রুটের নিরাপত্তা ঝুঁকি স্ক্যান করা হচ্ছে..." : "Evaluating route safety risks..."}
              </p>
            ) : null}
          </div>
        )}

        {/* Selected Incident Details Drawer */}
        {selectedIncident && (
          <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-2xl p-4 shadow-2xl space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
                  {isBn ? "সড়ক দুর্ঘটনা ও ঝুঁকি রেকর্ড" : "Accident & Road Hazard Record"}
                </span>
                <h4 className="text-sm font-bold text-white mt-0.5">{selectedIncident.title}</h4>
                <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{selectedIncident.location_text}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="pt-2 flex items-center justify-between border-t border-zinc-800 text-xs">
              <span className="text-zinc-500 flex items-center gap-1">
                {(selectedIncident as any).is_verified ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span>Verified by Platform</span>
                  </>
                ) : (
                  "Under Citizen Review"
                )}
              </span>
              <Link
                href={`/reports/${selectedIncident.report_id}`}
                className="text-cyan-400 font-bold hover:underline"
              >
                {isBn ? "বিস্তারিত রিপোর্ট →" : "View Full Report →"}
              </Link>
            </div>
          </div>
        )}

        {/* Bottom Control Bar: Start Driving / Stop Tracking */}
        <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Link
              href="/safety/road-intelligence"
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              title="Back to Dashboard"
            >
              ←
            </Link>
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                {isBn ? "সড়ক নিরাপত্তা ৩ডি লাইভ ম্যাপ" : "Road Safety 3D Live Map"}
              </span>
              <span className="text-xs font-bold text-white">
                {roadData?.risk_level ? `${roadData.risk_level} Regional Risk` : "Live Hazard Engine"}
              </span>
            </div>
          </div>

          {/* Start Driving / Stop Tracking Button */}
          <button
            type="button"
            onClick={handleToggleDriving}
            className={`px-5 py-3 rounded-xl font-black text-xs sm:text-sm tracking-wide shadow-xl transition active:scale-95 flex items-center gap-2 cursor-pointer ${
              isDriving
                ? "bg-red-600 hover:bg-red-500 text-white shadow-red-900/30"
                : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/30"
            }`}
          >
            {isDriving ? <Square className="h-4 w-4 fill-current" /> : <CarFront className="h-4 w-4" />}
            <span>
              {isDriving
                ? (isBn ? "ট্র্যাকিং বন্ধ করুন" : "Stop Tracking")
                : (isBn ? "ড্রাইভিং শুরু করুন" : "Start Driving")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
