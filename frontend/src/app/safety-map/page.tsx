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
  const [isListView, setIsListView] = useState<boolean>(false);
  const [selectedPoint, setSelectedPoint] = useState<PublicMapIncidentPoint | PublicMapClusterPoint | null>(null);

  // Android hardware back & browser popstate support for closing selected marker panel
  useBackClose(Boolean(selectedPoint), () => setSelectedPoint(null), "safetyMapSelectedPoint");

  // Locate Me state
  const [locating, setLocating] = useState<boolean>(false);
  const [locationNotice, setLocationNotice] = useState<{
    message: string;
    action?: "app_settings" | "location_settings";
  } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const userLocationLayerRef = useRef<any>(null);

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

  // Render markers whenever data or viewMode changes
  const renderMarkers = useCallback(() => {
    const L = (window as any).L;
    if (!L || !markersLayerRef.current || !data) return;

    markersLayerRef.current.clearLayers();

    // 1. Render Clusters
    if (viewMode === "ALL" || viewMode === "CLUSTERS") {
      data.clusters.forEach((cluster) => {
        // High-contrast vector cluster badge with layered shadow
        const clusterIcon = L.divIcon({
          className: "custom-cluster-icon",
          html: `<div style="
            width: 42px;
            height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          ">
            <div style="
              background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
              color: white;
              border-radius: 9999px;
              width: 36px;
              height: 36px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 900;
              font-size: 13px;
              border: 3px solid #ffffff;
              box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.3), 0 4px 10px rgba(0, 0, 0, 0.35);
              letter-spacing: -0.5px;
            ">
              ${cluster.member_count}
            </div>
          </div>`,
          iconSize: [42, 42],
          iconAnchor: [21, 21],
        });

        const marker = L.marker([cluster.approximate_latitude, cluster.approximate_longitude], {
          icon: clusterIcon,
        });

        const popupContent = `
          <div style="font-family: inherit; font-size: 12px; max-width: 240px; padding: 4px;">
            <div style="display: flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 800; color: #ea580c; text-transform: uppercase;">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #ea580c;"></span>
              <span>${t.incident_cluster_badge}</span>
            </div>
            <div style="font-weight: 800; font-size: 13px; color: #18181b; margin-top: 2px; line-height: 1.3;">
              ${lang === "bn" && cluster.title_bn ? cluster.title_bn : cluster.title}
            </div>
            <div style="font-size: 11px; color: #71717a; margin-top: 4px;">
              <strong>${cluster.member_count}</strong> ${t.cluster_reports_count}.
            </div>
            ${cluster.area ? `<div style="font-size: 10px; color: #a1a1aa; margin-top: 2px;">📍 ${cluster.area}</div>` : ""}
            <div style="margin-top: 8px; border-top: 1px solid #f4f4f5; padding-top: 6px;">
              <span style="color: #ea580c; font-weight: 700; font-size: 11px;">
                ${lang === "bn" ? "বিস্তারিত দেখতে ট্যাপ করুন →" : "Tap for details →"}
              </span>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on("click", () => {
          setSelectedPoint(cluster);
          if (mapInstanceRef.current) {
            const currentZoom = mapInstanceRef.current.getZoom();
            const targetZoom = Math.max(currentZoom + 2, 13);
            mapInstanceRef.current.setView([cluster.approximate_latitude, cluster.approximate_longitude], targetZoom, {
              animate: true,
            });
          }
        });
        markersLayerRef.current.addLayer(marker);
      });
    }

    // 2. Render Incident Points
    if (viewMode === "ALL" || viewMode === "MISSING") {
      const incidentsToRender =
        viewMode === "MISSING"
          ? data.incidents.filter((i) => i.is_missing_person)
          : data.incidents;

      incidentsToRender.forEach((inc) => {
        const isMissing = inc.is_missing_person;
        const color = isMissing ? "#dc2626" : inc.cluster_id ? "#f59e0b" : "#059669";
        const ringColor = isMissing ? "rgba(220, 38, 38, 0.25)" : inc.cluster_id ? "rgba(245, 158, 11, 0.25)" : "rgba(5, 150, 105, 0.25)";

        // Mobile-accessible touch target: 38x38px with centered icon badge
        const pointIcon = L.divIcon({
          className: "custom-point-icon",
          html: `<div style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <div style="
              background: ${color};
              width: 18px;
              height: 18px;
              border-radius: 50%;
              border: 2.5px solid white;
              box-shadow: 0 0 0 3px ${ringColor}, 0 3px 6px rgba(0,0,0,0.35);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              ${isMissing ? `<div style="width: 4px; height: 4px; background: white; border-radius: 50%;"></div>` : ""}
            </div>
          </div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        const marker = L.marker([inc.approximate_latitude, inc.approximate_longitude], {
          icon: pointIcon,
        });

        const linkUrl = isMissing && inc.missing_person_alert_id
          ? `/missing-person/${inc.missing_person_alert_id}`
          : `/reports/${inc.id}`;

        const popupContent = `
          <div style="font-family: inherit; font-size: 12px; max-width: 250px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; gap: 4px;">
              <span style="font-size: 10px; font-weight: 800; color: ${color}; text-transform: uppercase;">
                ${isMissing ? (lang === "bn" ? "নিখোঁজ ব্যক্তি সতর্কতা" : "MISSING PERSON") : inc.category_name}
              </span>
              <span style="font-size: 9px; background: #ecfdf5; color: #059669; padding: 2px 6px; border-radius: 6px; font-weight: 800;">
                ✓ ${t.platform_reviewed}
              </span>
            </div>
            <div style="font-weight: 800; font-size: 13px; color: #18181b; margin-top: 2px; line-height: 1.3;">
              ${inc.title}
            </div>
            <div style="font-size: 11px; color: #71717a; margin-top: 4px;">
              📍 <strong>${inc.location_text}</strong>
            </div>
            ${inc.cluster_title ? `<div style="font-size: 10px; color: #d97706; margin-top: 2px; font-weight: 600;">🔗 ${lang === "bn" ? "সম্পর্কিত ক্লাস্টার:" : "Part of cluster:"} ${inc.cluster_title}</div>` : ""}
            <div style="margin-top: 8px; border-top: 1px solid #f4f4f5; padding-top: 6px;">
              <a href="${linkUrl}" style="color: #059669; font-weight: 700; font-size: 11px; text-decoration: none;">
                ${t.view_incident_detail} →
              </a>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on("click", () => {
          setSelectedPoint(inc);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.panTo([inc.approximate_latitude, inc.approximate_longitude]);
          }
        });
        markersLayerRef.current.addLayer(marker);
      });
    }
  }, [data, viewMode, lang, t]);

  // Leaflet dynamic injection & map initialization
  useEffect(() => {
    if (typeof window === "undefined" || isListView) return;

    // Check if Leaflet stylesheet is already in head
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const initLeafletMap = () => {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        // Center on Bangladesh
        const map = L.map(mapContainerRef.current, {
          center: [23.8103, 90.4125],
          zoom: 7.5,
          minZoom: 6,
          maxZoom: 18,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
        markersLayerRef.current = markersLayer;

        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 250);
      }

      renderMarkers();
    };

    if (!(window as any).L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => initLeafletMap();
      document.body.appendChild(script);
    } else {
      initLeafletMap();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isListView, renderMarkers]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

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
        mapInstanceRef.current.setView([lat, lng], 15);
      }
    }

    if (qReportId) {
      const matched = data.incidents.find((i) => i.id === qReportId);
      if (matched) {
        setSelectedPoint(matched);
      }
    }
  }, [data]);

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

    const { approximateLatitude, approximateLongitude, suggestedAreaName } = coordinates;
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    if (userLocationLayerRef.current) {
      map.removeLayer(userLocationLayerRef.current);
    }

    const userGroup = L.layerGroup();

    // 120m radius privacy circle (~110m 3-decimal grid buffer)
    const circle = L.circle([approximateLatitude, approximateLongitude], {
      radius: 120,
      color: "#059669",
      fillColor: "#10b981",
      fillOpacity: 0.18,
      weight: 2,
      dashArray: "4, 4",
    });

    const userIcon = L.divIcon({
      className: "custom-user-location-marker",
      html: `<div style="position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;">
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background-color: #10b981; opacity: 0.75; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <span style="position: relative; width: 14px; height: 14px; border-radius: 9999px; background-color: #059669; border: 2.5px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></span>
      </div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const marker = L.marker([approximateLatitude, approximateLongitude], { icon: userIcon });
    const popupHtml = `
      <div style="font-family: inherit; font-size: 12px; padding: 4px; min-width: 160px;">
        <div style="font-weight: 800; color: #059669; font-size: 13px;">
          🎯 ${lang === "bn" ? "আপনার আনুমানিক অবস্থান" : "Your Approximate Location"}
        </div>
        <div style="font-size: 11px; color: #4b5563; margin-top: 4px; line-height: 1.4;">
          ${suggestedAreaName ? `📍 <strong>${suggestedAreaName}</strong><br/>` : ""}
          <span style="font-size: 10px; color: #6b7280;">🔒 ~110m privacy buffer applied</span>
        </div>
      </div>
    `;
    marker.bindPopup(popupHtml);

    userGroup.addLayer(circle);
    userGroup.addLayer(marker);
    userGroup.addTo(map);
    userLocationLayerRef.current = userGroup;

    map.flyTo([approximateLatitude, approximateLongitude], 14, {
      animate: true,
      duration: 1.2,
    });

    setTimeout(() => {
      marker.openPopup();
    }, 1300);
  };

  const clearAllFilters = () => {
    setSelectedCategory("ALL");
    setDateFilter("");
    setSearch("");
    setViewMode("ALL");
  };

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8 space-y-4">
      {/* ========================================================= */}
      {/* 1. Sleek Header Bar & Bilingual Switcher */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <span>{t.safety_map_title}</span>
              {data && (
                <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200/60 dark:border-emerald-900/60">
                  {data.total_incidents}
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
              {t.safety_map_subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Live Sync Button */}
          <button
            onClick={() => loadMapData(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition shadow-2xs cursor-pointer"
            title="Refresh Live Data"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Sync</span>
          </button>

          {/* View Mode Toggle: Map vs List */}
          <button
            onClick={() => setIsListView(!isListView)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-750 transition cursor-pointer"
          >
            {isListView ? (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                </svg>
                <span>{t.map_view_toggle}</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                <span>{t.list_view_toggle}</span>
              </>
            )}
          </button>

          {/* Locate Me Action Button */}
          {!isListView && (
            <button
              onClick={handleLocateMe}
              disabled={locating}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-2 text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
              title="Locate Me on Map (~110m privacy protection)"
            >
              {locating ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>{lang === "bn" ? "খোঁজা হচ্ছে..." : "Locating..."}</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="7" />
                    <polyline points="12 1 12 5" />
                    <polyline points="12 19 12 23" />
                    <polyline points="1 12 5 12" />
                    <polyline points="19 12 23 12" />
                  </svg>
                  <span>{t.locate_me}</span>
                </>
              )}
            </button>
          )}

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

      {/* ========================================================= */}
      {/* 2. Privacy Notice Banner */}
      {/* ========================================================= */}
      <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 p-3 border border-emerald-200/60 dark:border-emerald-900/50 text-xs text-emerald-800 dark:text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
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
              <span>{data.total_clusters} {lang === "bn" ? "ক্লাস্টার" : "Clusters"}</span>
            </span>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 3. Compact Filter Bar */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs text-xs">
        {/* Search */}
        <div className="sm:col-span-4 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            placeholder={lang === "bn" ? "শিরোনাম বা এলাকা দিয়ে খুঁজুন..." : "Search by title or area..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pl-8.5 pr-8 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="sm:col-span-3">
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

        {/* Date Filter */}
        <div className="sm:col-span-2">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="">{lang === "bn" ? "সব সময়" : "All Time"}</option>
            <option value="7d">{lang === "bn" ? "গত ৭ দিন" : "Last 7 Days"}</option>
            <option value="30d">{lang === "bn" ? "গত ৩০ দিন" : "Last 30 Days"}</option>
            <option value="90d">{lang === "bn" ? "গত ৯০ দিন" : "Last 90 Days"}</option>
          </select>
        </div>

        {/* Map View Mode Segmented Controls */}
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

      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 p-3.5 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            onClick={() => loadMapData(false)}
            className="px-3 py-1 font-bold text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. Main Content: Map or List View */}
      {/* ========================================================= */}
      {isListView ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
              {lang === "bn" ? "যাচাইকৃত ঘটনার তালিকা" : "Verified Incident List"}
            </h2>
            <span className="text-xs text-zinc-500 font-medium">
              {data ? `${data.incidents.length} items` : ""}
            </span>
          </div>

          {!data || data.incidents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-xs text-zinc-500 space-y-3">
              <p>{lang === "bn" ? "কোনো ঘটনার প্রতিবেদন খুঁজে পাওয়া যায়নি।" : "No incidents found matching the selected filters."}</p>
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 cursor-pointer"
              >
                {t.reset_map_filters}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                        inc.is_missing_person ? "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300" : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                      }`}>
                        {inc.is_missing_person ? (lang === "bn" ? "নিখোঁজ ব্যক্তি" : "MISSING PERSON") : inc.category_name}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(inc.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2">
                      {inc.title}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                      <span>📍</span>
                      <span>{inc.location_text}</span>
                    </p>
                    {inc.cluster_title && (
                      <div className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                        <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#ea580c" }}></span>
                        <span>{inc.cluster_title}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                    <Link
                      href={inc.is_missing_person && inc.missing_person_alert_id ? `/missing-person/${inc.missing_person_alert_id}` : `/reports/${inc.id}`}
                      className="font-bold text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 inline-flex items-center gap-1"
                    >
                      <span>{t.view_incident_detail}</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="relative rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm bg-zinc-100 dark:bg-zinc-900 h-[calc(100vh-16rem)] min-h-[460px] sm:min-h-[560px] lg:min-h-[620px]">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Map Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xs">
              <div className="flex items-center gap-2.5 rounded-2xl bg-white dark:bg-zinc-800 px-5 py-3 shadow-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                <span>{t.map_loading}</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* Selected Point Responsive Bottom Sheet / Overlay Panel */}
          {/* ========================================================= */}
          {selectedPoint && (
            <div className="absolute bottom-20 sm:bottom-auto sm:top-4 left-3 right-3 sm:left-auto sm:right-4 z-30 sm:max-w-sm sm:w-85 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-3xl p-4.5 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    "member_count" in selectedPoint
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                      : "is_missing_person" in selectedPoint && selectedPoint.is_missing_person
                      ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  }`}>
                    {"member_count" in selectedPoint
                      ? `Cluster (${selectedPoint.member_count} reports)`
                      : "is_missing_person" in selectedPoint && selectedPoint.is_missing_person
                      ? "Missing Person"
                      : "category_name" in selectedPoint
                      ? selectedPoint.category_name
                      : "Incident"}
                  </span>
                  <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 px-1.5 py-0.5 rounded-md font-bold">
                    ✓ Verified
                  </span>
                </div>
                <button
                  onClick={() => setSelectedPoint(null)}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs font-bold h-9 w-9 flex items-center justify-center cursor-pointer rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  aria-label="Close details"
                >
                  ✕
                </button>
              </div>

              <h4 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug">
                {selectedPoint.title}
              </h4>

              <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                <p className="flex items-center gap-1.5">
                  <span className="shrink-0 text-zinc-400">📍</span>
                  <span className="line-clamp-1">
                    {"location_text" in selectedPoint ? selectedPoint.location_text : selectedPoint.area || "Approximate area"}
                  </span>
                </p>
                {"member_count" in selectedPoint && (
                  <p className="text-[11px] text-zinc-500">
                    {selectedPoint.member_count} {t.cluster_reports_count}.
                  </p>
                )}
                {"cluster_title" in selectedPoint && selectedPoint.cluster_title && (
                  <p className="text-[11px] text-amber-600 font-semibold">
                    🔗 Part of cluster: {selectedPoint.cluster_title}
                  </p>
                )}
              </div>

              {"id" in selectedPoint && (
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <Link
                    href={
                      "member_count" in selectedPoint
                        ? `/reports?cluster_id=${selectedPoint.id}`
                        : "is_missing_person" in selectedPoint && selectedPoint.is_missing_person && selectedPoint.missing_person_alert_id
                        ? `/missing-person/${selectedPoint.missing_person_alert_id}`
                        : `/reports/${selectedPoint.id}`
                    }
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 transition shadow-xs cursor-pointer text-center"
                  >
                    <span>
                      {"member_count" in selectedPoint
                        ? lang === "bn"
                          ? "ক্লাস্টারের রিপোর্টগুলো দেখুন"
                          : "View cluster reports"
                        : t.view_incident_detail}
                    </span>
                    <span>→</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Location Notice Banner */}
          {locationNotice && (
            <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 z-30 max-w-sm bg-amber-50 dark:bg-amber-950/90 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 rounded-2xl p-3 text-xs shadow-xl flex items-center justify-between gap-2.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="shrink-0">⚠️</span>
                <span className="leading-snug break-words">{locationNotice.message}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {locationNotice.action === "app_settings" && (
                  <button
                    type="button"
                    onClick={() => openNativeAppSettings()}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition cursor-pointer"
                  >
                    {lang === "bn" ? "সেটিংস" : "Settings"}
                  </button>
                )}
                {locationNotice.action === "location_settings" && (
                  <button
                    type="button"
                    onClick={() => openNativeLocationSettings()}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition cursor-pointer"
                  >
                    {lang === "bn" ? "GPS সেটিংস" : "GPS Settings"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLocationNotice(null)}
                  className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 p-1 font-bold min-h-[28px] min-w-[28px] flex items-center justify-center cursor-pointer"
                  aria-label="Dismiss notice"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Floating Map GPS Locate Button (Positioned above mobile nav) */}
          <button
            onClick={handleLocateMe}
            disabled={locating}
            aria-label="Locate me on map"
            className="absolute bottom-20 right-4 sm:bottom-4 sm:right-4 z-20 flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 shadow-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750 active:scale-95 transition disabled:opacity-50 cursor-pointer"
            title={lang === "bn" ? "আমার অবস্থান" : "Locate Me"}
          >
            {locating ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            ) : (
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="7" />
                <polyline points="12 1 12 5" />
                <polyline points="12 19 12 23" />
                <polyline points="1 12 5 12" />
                <polyline points="19 12 23 12" />
              </svg>
            )}
          </button>

          {/* Map Legend (Bottom-Left on Desktop, Clean Floating Card) */}
          <div className="absolute bottom-20 left-4 sm:bottom-4 sm:left-4 z-20 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-3 border border-zinc-200 dark:border-zinc-800 shadow-md text-[11px] space-y-1.5 hidden sm:block">
            <div className="font-extrabold text-zinc-800 dark:text-zinc-200 uppercase text-[9px] tracking-wider">
              {lang === "bn" ? "ম্যাপ নির্দেশিকা" : "Map Legend"}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-600 inline-block border border-white shadow-2xs" />
              <span className="text-zinc-700 dark:text-zinc-300">{lang === "bn" ? "যাচাইকৃত রিপোর্ট" : "Verified Report"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500 inline-block border border-white shadow-2xs" />
              <span className="text-zinc-700 dark:text-zinc-300">{lang === "bn" ? "ক্লাস্টার সদস্য রিপোর্ট" : "Related Cluster Member"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full bg-orange-600 inline-flex items-center justify-center border border-white shadow-2xs text-[8px] text-white font-black">
                #
              </span>
              <span className="text-zinc-700 dark:text-zinc-300">{lang === "bn" ? "ঘটনা ক্লাস্টার এলাকা" : "Incident Cluster Area"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-600 inline-block border border-white shadow-2xs" />
              <span className="text-zinc-700 dark:text-zinc-300">{lang === "bn" ? "নিখোঁজ ব্যক্তি সতর্কতা" : "Missing Person Alert"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
