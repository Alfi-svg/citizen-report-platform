"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  PublicSafetyMapResponse,
  PublicMapIncidentPoint,
  PublicMapClusterPoint,
  CategoryResponse,
} from "@/lib/types";
import { translations, Language } from "@/lib/i18n";
import {
  captureCurrentLocation,
  openNativeAppSettings,
  openNativeLocationSettings,
} from "@/lib/location";
import { useBackClose } from "@/lib/useBackClose";
import { isAppActive } from "@/lib/appLifecycle";
import {
  MapPin,
  X,
  AlertTriangle,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  LocateFixed,
  Box,
  Map as MapIcon,
  List,
  RotateCcw,
} from "lucide-react";

export default function SafetyMapPage() {
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  const [data, setData] = useState<PublicSafetyMapResponse | null>(null);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync saved language
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

  // Filters & State
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"ALL" | "CLUSTERS" | "MISSING">("ALL");
  const [search, setSearch] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [mobileTab, setMobileTab] = useState<"MAP" | "LIST">("MAP");
  const [is3DMode, setIs3DMode] = useState<boolean>(true);

  // Selected marker or cluster for synchronized inspection
  const [selectedPoint, setSelectedPoint] = useState<PublicMapIncidentPoint | PublicMapClusterPoint | null>(null);

  // Android hardware back & browser popstate support for closing selected point
  useBackClose(Boolean(selectedPoint), () => setSelectedPoint(null), "safetyMapSelectedPoint");

  // Locate Me state
  const [locating, setLocating] = useState<boolean>(false);
  const [locationNotice, setLocationNotice] = useState<{
    message: string;
    action?: "app_settings" | "location_settings";
  } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);

  // Fetch categories
  useEffect(() => {
    apiFetch<CategoryResponse[]>("/categories")
      .then((cats) => setCategories(cats))
      .catch(() => {});
  }, []);

  // Debounce search state to prevent burst API calls on keystrokes
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch map data with real-time background sync
  const loadMapData = useCallback((isBackground = false) => {
    if (!isBackground) setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategory && selectedCategory !== "ALL") params.append("category_slug", selectedCategory);
    if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());

    if (dateFilter === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      params.append("from_date", d.toISOString());
    } else if (dateFilter === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      params.append("from_date", d.toISOString());
    } else if (dateFilter === "90d") {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      params.append("from_date", d.toISOString());
    }

    params.append("limit", "300");
    params.append("_t", Date.now().toString());

    apiFetch<PublicSafetyMapResponse>(`/safety/map?${params.toString()}`)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isBackground && err instanceof Error) setError(err.message);
      })
      .finally(() => {
        if (!isBackground) setLoading(false);
      });
  }, [selectedCategory, debouncedSearch, dateFilter]);

  useEffect(() => {
    loadMapData();
    // Real-time live polling every 8 seconds (paused when app is in background)
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible" && isAppActive()) {
        loadMapData(true);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [loadMapData]);

  // Filtered list of incidents for the right panel
  const filteredIncidents = React.useMemo(() => {
    if (!data) return [];
    let list = data.incidents;
    if (viewMode === "MISSING") {
      list = list.filter((i) => i.is_missing_person);
    } else if (viewMode === "CLUSTERS" && selectedPoint && "member_count" in selectedPoint) {
      list = list.filter((i) => i.cluster_id === selectedPoint.id || (i.cluster_title && i.cluster_title === selectedPoint.title));
    }
    return list;
  }, [data, viewMode, selectedPoint]);

  // Fly/pan map to incident coordinates
  const highlightAndFocusIncident = useCallback((incident: PublicMapIncidentPoint) => {
    setSelectedPoint(incident);
    setMobileTab("MAP");
    const map = mapInstanceRef.current;
    if (!map) return;

    if (map.flyTo) {
      // MapLibre
      map.flyTo({
        center: [incident.approximate_longitude, incident.approximate_latitude],
        zoom: Math.max(map.getZoom(), 14),
        pitch: is3DMode ? 50 : 0,
        essential: true,
      });
    } else if (map.setView) {
      // Leaflet
      map.setView([incident.approximate_latitude, incident.approximate_longitude], 14, { animate: true });
    }
  }, [is3DMode]);

  // Fly/pan map to cluster coordinates
  const highlightAndFocusCluster = useCallback((cluster: PublicMapClusterPoint) => {
    setSelectedPoint(cluster);
    setMobileTab("MAP");
    const map = mapInstanceRef.current;
    if (!map) return;

    if (map.flyTo) {
      map.flyTo({
        center: [cluster.approximate_longitude, cluster.approximate_latitude],
        zoom: Math.max(map.getZoom() + 2, 13.5),
        pitch: is3DMode ? 50 : 0,
        essential: true,
      });
    } else if (map.setView) {
      map.setView([cluster.approximate_latitude, cluster.approximate_longitude], 13.5, { animate: true });
    }
  }, [is3DMode]);

  // Clear existing markers
  const clearMapMarkers = useCallback(() => {
    markersRef.current.forEach((m) => {
      try {
        if (m.remove) m.remove();
      } catch {}
    });
    markersRef.current = [];
  }, []);

  // Render 3D and 2D markers onto map
  const renderMapMarkers = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !data) return;

    clearMapMarkers();

    const maplibregl = (window as any).maplibregl;
    const L = (window as any).L;

    // A. MAPLIBRE GL MARKER RENDERING (Vector 3D Map)
    if (maplibregl && map.getCanvas) {
      // 1. Clusters
      if (viewMode === "ALL" || viewMode === "CLUSTERS") {
        data.clusters.forEach((cluster) => {
          const el = document.createElement("div");
          el.className = "group cursor-pointer select-none";
          const count = cluster.member_count;
          const size = Math.min(52, Math.max(38, 36 + count * 1.5));

          el.innerHTML = `
            <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; items-center; justify-content: center;">
              <!-- 3D Radar Pulse Ring -->
              <span style="position: absolute; inset: -4px; border-radius: 9999px; background: rgba(234, 88, 12, 0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
              
              <!-- 3D Cylinder Cluster Body -->
              <div style="
                position: relative;
                width: 100%;
                height: 100%;
                border-radius: 9999px;
                background: linear-gradient(135deg, #f97316 0%, #c2410c 100%);
                color: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 900;
                font-size: ${count > 99 ? "11px" : "13px"};
                border: 3px solid #ffffff;
                box-shadow: 0 8px 16px -2px rgba(194, 65, 12, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.25);
                transform: translateY(${is3DMode ? "-6px" : "0px"});
                transition: transform 0.2s ease;
              ">
                ${count}
              </div>
            </div>
          `;

          el.addEventListener("click", (e) => {
            e.stopPropagation();
            highlightAndFocusCluster(cluster);
          });

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([cluster.approximate_longitude, cluster.approximate_latitude])
            .addTo(map);

          markersRef.current.push(marker);
        });
      }

      // 2. Individual Incidents
      if (viewMode === "ALL" || viewMode === "MISSING") {
        const incidents = viewMode === "MISSING"
          ? data.incidents.filter((i) => i.is_missing_person)
          : data.incidents;

        incidents.forEach((inc) => {
          const isMissing = inc.is_missing_person;
          const color = isMissing ? "#dc2626" : inc.cluster_id ? "#f59e0b" : "#059669";
          const halo = isMissing ? "rgba(220, 38, 38, 0.35)" : inc.cluster_id ? "rgba(245, 158, 11, 0.35)" : "rgba(5, 150, 105, 0.35)";

          const el = document.createElement("div");
          el.className = "cursor-pointer";
          el.innerHTML = `
            <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              <div style="
                width: 18px;
                height: 18px;
                border-radius: 9999px;
                background: ${color};
                border: 2.5px solid #ffffff;
                box-shadow: 0 0 0 3px ${halo}, 0 4px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                transform: translateY(${is3DMode ? "-4px" : "0px"});
              ">
                ${isMissing ? `<div style="width: 4px; height: 4px; background: white; border-radius: 9999px;"></div>` : ""}
              </div>
            </div>
          `;

          el.addEventListener("click", (e) => {
            e.stopPropagation();
            highlightAndFocusIncident(inc);
          });

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([inc.approximate_longitude, inc.approximate_latitude])
            .addTo(map);

          markersRef.current.push(marker);
        });
      }
      return;
    }

    // B. LEAFLET FALLBACK
    if (L && map.setView) {
      if (viewMode === "ALL" || viewMode === "CLUSTERS") {
        data.clusters.forEach((cluster) => {
          const clusterIcon = L.divIcon({
            className: "custom-cluster-icon",
            html: `<div style="
              width: 38px;
              height: 38px;
              background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
              color: white;
              border-radius: 9999px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 900;
              font-size: 13px;
              border: 3px solid #ffffff;
              box-shadow: 0 4px 10px rgba(0,0,0,0.35);
              cursor: pointer;
            ">${cluster.member_count}</div>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
          });

          const marker = L.marker([cluster.approximate_latitude, cluster.approximate_longitude], {
            icon: clusterIcon,
          });

          marker.on("click", () => highlightAndFocusCluster(cluster));
          marker.addTo(map);
          markersRef.current.push(marker);
        });
      }

      if (viewMode === "ALL" || viewMode === "MISSING") {
        const incidents = viewMode === "MISSING"
          ? data.incidents.filter((i) => i.is_missing_person)
          : data.incidents;

        incidents.forEach((inc) => {
          const isMissing = inc.is_missing_person;
          const color = isMissing ? "#dc2626" : inc.cluster_id ? "#f59e0b" : "#059669";
          const pointIcon = L.divIcon({
            className: "custom-point-icon",
            html: `<div style="width: 20px; height: 20px; border-radius: 50%; background: ${color}; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer;"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });

          const marker = L.marker([inc.approximate_latitude, inc.approximate_longitude], { icon: pointIcon });
          marker.on("click", () => highlightAndFocusIncident(inc));
          marker.addTo(map);
          markersRef.current.push(marker);
        });
      }
    }
  }, [data, viewMode, is3DMode, clearMapMarkers, highlightAndFocusCluster, highlightAndFocusIncident]);

  // Toggle 3D Perspective Mode
  const toggle3DMode = () => {
    const nextMode = !is3DMode;
    setIs3DMode(nextMode);
    const map = mapInstanceRef.current;
    if (map && map.easeTo) {
      map.easeTo({
        pitch: nextMode ? 52 : 0,
        bearing: nextMode ? -15 : 0,
        duration: 900,
      });
    }
  };

  // Initialize Map (MapLibre GL Vector with 3D buildings, Leaflet fallback)
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    // Load MapLibre stylesheet
    if (!document.getElementById("maplibre-gl-css")) {
      const link = document.createElement("link");
      link.id = "maplibre-gl-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
      document.head.appendChild(link);
    }

    const initMapLibre = () => {
      const maplibregl = (window as any).maplibregl;
      if (!maplibregl || !mapContainerRef.current || !isMounted) return;

      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
      }

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [90.4125, 23.8103], // Dhaka, Bangladesh
        zoom: 7.2,
        minZoom: 5.5,
        maxZoom: 18.5,
        pitch: is3DMode ? 52 : 0,
        bearing: is3DMode ? -15 : 0,
        antialias: true,
      });

      map.on("load", () => {
        if (!isMounted) return;
        mapInstanceRef.current = map;

        // Add 3D building extrusions
        try {
          if (!map.getLayer("3d-buildings")) {
            map.addLayer({
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
                  0, "#e2e8f0",
                  20, "#cbd5e1",
                  50, "#94a3b8",
                ],
                "fill-extrusion-height": ["get", "render_height"],
                "fill-extrusion-base": ["get", "render_min_height"],
                "fill-extrusion-opacity": 0.65,
              },
            });
          }
        } catch {}

        renderMapMarkers();
      });

      map.on("click", () => {
        setSelectedPoint(null);
      });
    };

    if (!(window as any).maplibregl) {
      const script = document.createElement("script");
      script.id = "maplibre-gl-js";
      script.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
      script.async = true;
      script.onload = () => {
        if (isMounted) initMapLibre();
      };
      document.body.appendChild(script);
    } else {
      initMapLibre();
    }

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers when data, filter, or 3D mode changes
  useEffect(() => {
    renderMapMarkers();
  }, [renderMapMarkers]);

  // Center on query parameters if present (e.g. from report details)
  useEffect(() => {
    if (typeof window === "undefined" || !data || !mapInstanceRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const qLat = params.get("lat");
    const qLng = params.get("lng");
    const qReportId = params.get("report_id");

    if (qLat && qLng) {
      const lat = parseFloat(qLat);
      const lng = parseFloat(qLng);
      if (!isNaN(lat) && !isNaN(lng)) {
        const map = mapInstanceRef.current;
        if (map.flyTo) {
          map.flyTo({ center: [lng, lat], zoom: 15, pitch: is3DMode ? 50 : 0 });
        } else if (map.setView) {
          map.setView([lat, lng], 15);
        }
      }
    }

    if (qReportId) {
      const matched = data.incidents.find((i) => i.id === qReportId);
      if (matched) {
        setSelectedPoint(matched);
      }
    }
  }, [data, is3DMode]);

  // Handle Privacy-Aware "Locate Me"
  const handleLocateMe = async () => {
    setLocating(true);
    setLocationNotice(null);
    const { coordinates, error: locError } = await captureCurrentLocation({
      timeoutMs: 12000,
      enableHighAccuracy: true,
    });
    setLocating(false);

    if (locError || !coordinates) {
      const isPermanent = locError?.code === "PERMANENTLY_DENIED";
      const isServicesDisabled = locError?.code === "SERVICES_DISABLED";

      let action: "app_settings" | "location_settings" | undefined;
      if (isPermanent && locError?.canOpenSettings) {
        action = "app_settings";
      } else if (isServicesDisabled && locError?.canOpenSettings) {
        action = "location_settings";
      }

      const msg = lang === "bn" ? locError?.messageBn : locError?.message;
      setLocationNotice({
        message: msg || (lang === "bn" ? "অবস্থান শনাক্ত করা সম্ভব হয়নি।" : "Could not determine location."),
        action,
      });
      setTimeout(() => setLocationNotice(null), 8000);
      return;
    }

    const { approximateLatitude, approximateLongitude } = coordinates;
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      try {
        userMarkerRef.current.remove();
      } catch {}
    }

    const maplibregl = (window as any).maplibregl;
    if (maplibregl && map.flyTo) {
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="position: relative; width: 28px; height: 28px; display: flex; items-center; justify-content: center;">
          <span style="position: absolute; inset: 0; border-radius: 9999px; background: rgba(16, 185, 129, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <span style="position: relative; width: 14px; height: 14px; border-radius: 9999px; background: #059669; border: 2.5px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></span>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([approximateLongitude, approximateLatitude])
        .addTo(map);

      userMarkerRef.current = marker;

      map.flyTo({
        center: [approximateLongitude, approximateLatitude],
        zoom: 14.5,
        pitch: is3DMode ? 50 : 0,
        essential: true,
      });
    }
  };

  const clearAllFilters = () => {
    setSelectedCategory("ALL");
    setDateFilter("");
    setSearch("");
    setViewMode("ALL");
    setSelectedPoint(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8 space-y-4">
      {/* ========================================================= */}
      {/* 1. Header Bar & Controls (Phase 3: Clean, No Duplicates)  */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xs shrink-0">
            <MapIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <span>{t.safety_map_title}</span>
              {data && (
                <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200/60 dark:border-emerald-900/60">
                  {data.total_incidents}
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
              {lang === "bn"
                ? "যাচাইকৃত হ্যাজার্ড ক্লাস্টার ও রিয়েল-টাইম ঘটনা গোয়েন্দা ড্যাশবোর্ড।"
                : "Verified incident clusters and real-time community safety intelligence dashboard."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh Map Data */}
          <button
            onClick={() => loadMapData(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 px-3 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shadow-2xs cursor-pointer"
            title={lang === "bn" ? "মানচিত্র ডেটা রিফ্রেশ করুন" : "Refresh Map Data"}
          >
            <RotateCcw className={`h-3.5 w-3.5 text-zinc-500 ${loading ? "animate-spin" : ""}`} />
            <span>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</span>
          </button>

          {/* 3D Perspective Mode Toggle */}
          <button
            onClick={toggle3DMode}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition shadow-2xs cursor-pointer ${
              is3DMode
                ? "border-cyan-600/50 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300"
                : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
            title="Toggle 3D Perspective & Building Extrusions"
          >
            <Box className="h-3.5 w-3.5" />
            <span>{is3DMode ? "3D Buildings" : "2D Flat"}</span>
          </button>

          {/* Locate Me Button */}
          <button
            onClick={handleLocateMe}
            disabled={locating}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-2 text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
            title="Locate Me on Map (~110m privacy protection)"
          >
            {locating ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <LocateFixed className="h-3.5 w-3.5" />
            )}
            <span>{t.locate_me}</span>
          </button>

          {/* Bilingual Language Switcher */}
          <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => {
                setLang("en");
                if (typeof window !== "undefined") localStorage.setItem("app_lang", "en");
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                lang === "en" ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => {
                setLang("bn");
                if (typeof window !== "undefined") localStorage.setItem("app_lang", "bn");
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                lang === "bn" ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              বাং
            </button>
          </div>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 p-3 border border-emerald-200/60 dark:border-emerald-900/50 text-xs text-emerald-800 dark:text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="leading-snug">{t.map_privacy_notice}</span>
        </div>
        {data && (
          <div className="flex items-center gap-3 font-bold text-[11px] shrink-0">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <span>{data.total_incidents} {lang === "bn" ? "যাচাইকৃত ঘটনা" : "Incidents"}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>{data.total_clusters} {lang === "bn" ? "ক্লাস্টার" : "3D Clusters"}</span>
            </span>
          </div>
        )}
      </div>

      {/* Location Notice / Error Alert */}
      {locationNotice && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
          <span>{locationNotice.message}</span>
          {locationNotice.action === "app_settings" && (
            <button
              onClick={() => openNativeAppSettings()}
              className="px-2.5 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 cursor-pointer text-xs"
            >
              Settings
            </button>
          )}
          {locationNotice.action === "location_settings" && (
            <button
              onClick={() => openNativeLocationSettings()}
              className="px-2.5 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 cursor-pointer text-xs"
            >
              Turn on GPS
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 p-3 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </span>
          <button
            onClick={() => loadMapData(false)}
            className="px-2.5 py-1 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 cursor-pointer text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Compact Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs text-xs">
        {/* Search Input */}
        <div className="sm:col-span-5 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            placeholder={lang === "bn" ? "শিরোনাম বা এলাকা দিয়ে খুঁজুন..." : "Search by incident or area..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-8.5 pr-8 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="sm:col-span-4">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">{t.all_categories}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Segmented Controls */}
        <div className="sm:col-span-3 flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setViewMode("ALL")}
            className={`flex-1 rounded-lg px-2 py-1.5 font-bold transition text-[11px] cursor-pointer ${
              viewMode === "ALL"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            {t.mode_all}
          </button>
          <button
            onClick={() => setViewMode("CLUSTERS")}
            className={`flex-1 rounded-lg px-2 py-1.5 font-bold transition text-[11px] cursor-pointer ${
              viewMode === "CLUSTERS"
                ? "bg-amber-600 text-white shadow-2xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-amber-600"
            }`}
          >
            {t.mode_clusters}
          </button>
          <button
            onClick={() => setViewMode("MISSING")}
            className={`flex-1 rounded-lg px-2 py-1.5 font-bold transition text-[11px] cursor-pointer ${
              viewMode === "MISSING"
                ? "bg-red-600 text-white shadow-2xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-red-600"
            }`}
          >
            {t.mode_missing}
          </button>
        </div>
      </div>

      {/* Mobile Tab Switcher (Visible only on small screens) */}
      <div className="lg:hidden flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200 dark:border-zinc-700">
        <button
          onClick={() => setMobileTab("MAP")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
            mobileTab === "MAP"
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <MapIcon className="h-4 w-4" />
          <span>{lang === "bn" ? "৩ডি ম্যাপ ভিউ" : "3D Safety Map"}</span>
        </button>
        <button
          onClick={() => setMobileTab("LIST")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
            mobileTab === "LIST"
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <List className="h-4 w-4" />
          <span>
            {lang === "bn" ? "ঘটনা গোয়েন্দা তথ্য" : "Incident Intelligence"} ({filteredIncidents.length})
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 2-PANEL RESPONSIVE INTELLIGENCE DASHBOARD (Phase 2)        */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ======================================================= */}
        {/* LEFT PANEL: 3D SAFETY MAP (lg:col-span-7)               */}
        {/* ======================================================= */}
        <div
          className={`lg:col-span-7 relative rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm bg-zinc-100 dark:bg-zinc-900 h-[520px] sm:h-[620px] lg:h-[720px] ${
            mobileTab === "LIST" ? "hidden lg:block" : "block"
          }`}
        >
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Loading Indicator */}
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xs">
              <div className="flex items-center gap-2.5 rounded-2xl bg-white dark:bg-zinc-800 px-5 py-3 shadow-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                <span>{t.map_loading}</span>
              </div>
            </div>
          )}

          {/* Map Legend Overlay */}
          <div className="absolute bottom-3 left-3 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-2xl p-2.5 border border-zinc-200/80 dark:border-zinc-800 text-[11px] space-y-1.5 shadow-sm pointer-events-auto">
            <div className="font-bold text-zinc-700 dark:text-zinc-300 text-[10px] uppercase tracking-wider">
              {lang === "bn" ? "ম্যাপ নির্দেশিকা" : "3D Map Legend"}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-600" />
              <span className="text-zinc-600 dark:text-zinc-400">{lang === "bn" ? "যাচাইকৃত ঘটনা" : "Verified Incident"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full bg-amber-500 font-bold text-[9px] text-white flex items-center justify-center">3</span>
              <span className="text-zinc-600 dark:text-zinc-400">{lang === "bn" ? "৩ডি ক্লাস্টার" : "3D Hazard Cluster"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-600" />
              <span className="text-zinc-600 dark:text-zinc-400">{lang === "bn" ? "নিখোঁজ ব্যক্তি" : "Missing Alert"}</span>
            </div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* RIGHT PANEL: INCIDENT INTELLIGENCE FEED (lg:col-span-5) */}
        {/* ======================================================= */}
        <div
          className={`lg:col-span-5 space-y-3.5 h-[520px] sm:h-[620px] lg:h-[720px] flex flex-col justify-between ${
            mobileTab === "MAP" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Panel Top Card: Synchronized Incident/Cluster Spotlight */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {selectedPoint ? (
              <div className="rounded-3xl border-2 border-emerald-500/50 bg-white dark:bg-zinc-900 p-4.5 shadow-md space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    "member_count" in selectedPoint
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                      : "is_missing_person" in selectedPoint && selectedPoint.is_missing_person
                      ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  }`}>
                    {"member_count" in selectedPoint
                      ? `Hazard Cluster (${selectedPoint.member_count} incidents)`
                      : "is_missing_person" in selectedPoint && selectedPoint.is_missing_person
                      ? "Missing Person Alert"
                      : "category_name" in selectedPoint
                      ? selectedPoint.category_name
                      : "Incident"}
                  </span>
                  <button
                    onClick={() => setSelectedPoint(null)}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs font-bold h-7 w-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <h3 className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 leading-snug">
                  {selectedPoint.title}
                </h3>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <span>{"location_text" in selectedPoint ? selectedPoint.location_text : selectedPoint.area || "Identified Region"}</span>
                </p>

                {"member_count" in selectedPoint ? (
                  <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <span>{selectedPoint.member_count} {t.cluster_reports_count}</span>
                    </p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      {lang === "bn"
                        ? "এই এলাকায় একাধিক নাগরিক রিপোর্ট অনুমোদিত হয়েছে। বিস্তারিত রিপোর্টগুলো নিচে প্রদর্শিত।"
                        : "Multiple citizen reports have been verified in this vicinity. Member reports are shown in the feed below."}
                    </p>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-zinc-400">
                      {new Date(selectedPoint.created_at).toLocaleDateString()}
                    </span>
                    <Link
                      href={
                        "is_missing_person" in selectedPoint && selectedPoint.is_missing_person && selectedPoint.missing_person_alert_id
                          ? `/missing-person/${selectedPoint.missing_person_alert_id}`
                          : `/reports/${selectedPoint.id}`
                      }
                      className="inline-flex items-center gap-1 font-bold text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400"
                    >
                      <span>{t.view_incident_detail}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            ) : null}

            {/* List Header */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {lang === "bn" ? "যাচাইকৃত ঘটনার তালিকা" : "Verified Incidents"} ({filteredIncidents.length})
              </span>
              {selectedPoint && (
                <button
                  onClick={() => setSelectedPoint(null)}
                  className="text-[11px] text-emerald-600 font-bold hover:underline"
                >
                  {lang === "bn" ? "সবগুলো দেখান" : "Show All"}
                </button>
              )}
            </div>

            {/* Incident Cards Feed */}
            {filteredIncidents.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-xs text-zinc-500 space-y-2">
                <p>{lang === "bn" ? "কোনো ঘটনার প্রতিবেদন খুঁজে পাওয়া যায়নি।" : "No incidents found matching the selected filters."}</p>
                <button
                  onClick={clearAllFilters}
                  className="px-3.5 py-1.5 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 cursor-pointer"
                >
                  {t.reset_map_filters}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredIncidents.map((inc) => {
                  const isSelected = selectedPoint && "id" in selectedPoint && selectedPoint.id === inc.id;
                  return (
                    <div
                      key={inc.id}
                      onClick={() => highlightAndFocusIncident(inc)}
                      className={`group rounded-2xl border p-3.5 transition cursor-pointer flex flex-col justify-between space-y-2 ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs"
                          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                          inc.is_missing_person
                            ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        }`}>
                          {inc.is_missing_person ? (lang === "bn" ? "নিখোঁজ ব্যক্তি" : "MISSING PERSON") : inc.category_name}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {new Date(inc.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight group-hover:text-emerald-600 transition">
                        {inc.title}
                      </h4>

                      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                        <span className="line-clamp-1 text-[11px] flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0 text-zinc-400" />
                          <span>{inc.location_text}</span>
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0 group-hover:translate-x-0.5 transition" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Area Safety Grounded Intelligence Summary */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 p-3.5 space-y-2 shrink-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">
                {lang === "bn" ? "এলাকা সুরক্ষা পর্যবেক্ষণ" : "Area Safety Summary"}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                {data ? `${data.total_incidents} Reports Verified` : "Syncing"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
              {lang === "bn"
                ? "রিপোর্ট না থাকা মানেই এলাকাটি সম্পূর্ণ নিরাপদ নয়। সমস্ত উপাত্ত প্ল্যাটফর্মের নিরীক্ষিত তথ্যের ওপর ভিত্তি করে প্রদর্শিত।"
                : "No reported incidents does not prove an area is hazard-free. Density is strictly calculated from moderation-reviewed civic submissions."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
