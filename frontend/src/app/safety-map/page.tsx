"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  PublicSafetyMapResponse,
  PublicMapIncidentPoint,
  PublicMapClusterPoint,
  CategoryResponse,
} from "@/lib/types";
import { translations, Language } from "@/lib/i18n";

export default function SafetyMapPage() {
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  const [data, setData] = useState<PublicSafetyMapResponse | null>(null);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [viewMode, setViewMode] = useState<"ALL" | "CLUSTERS" | "MISSING">("ALL");
  const [search, setSearch] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [isListView, setIsListView] = useState<boolean>(false);
  const [selectedPoint, setSelectedPoint] = useState<PublicMapIncidentPoint | PublicMapClusterPoint | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  // Fetch categories
  useEffect(() => {
    apiFetch<CategoryResponse[]>("/categories")
      .then((cats) => setCategories(cats))
      .catch(() => {});
  }, []);

  // Fetch map data with real-time background sync
  const loadMapData = (isBackground = false) => {
    if (!isBackground) setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategory) params.append("category_slug", selectedCategory);
    if (search.trim()) params.append("search", search.trim());

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
  };

  useEffect(() => {
    loadMapData();
    // Real-time live polling every 8 seconds
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadMapData(true);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedCategory, search, dateFilter]);

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
  }, [isListView]);

  // Render markers whenever data or viewMode changes
  const renderMarkers = () => {
    const L = (window as any).L;
    if (!L || !markersLayerRef.current || !data) return;

    markersLayerRef.current.clearLayers();

    // 1. Render Clusters
    if (viewMode === "ALL" || viewMode === "CLUSTERS") {
      data.clusters.forEach((cluster) => {
        const clusterIcon = L.divIcon({
          className: "custom-cluster-icon",
          html: `<div style="background: #ea580c; color: white; border-radius: 9999px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);">
            ${cluster.member_count}
          </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([cluster.approximate_latitude, cluster.approximate_longitude], {
          icon: clusterIcon,
        });

        const popupContent = `
          <div style="font-family: inherit; font-size: 12px; max-width: 240px; padding: 4px;">
            <div style="font-size: 10px; font-weight: 800; color: #ea580c; text-transform: uppercase;">
              🔶 ${t.incident_cluster_badge}
            </div>
            <div style="font-weight: 800; font-size: 13px; color: #18181b; margin-top: 2px;">
              ${lang === "bn" && cluster.title_bn ? cluster.title_bn : cluster.title}
            </div>
            <div style="font-size: 11px; color: #71717a; margin-top: 4px;">
              <strong>${cluster.member_count}</strong> ${t.cluster_reports_count}.
            </div>
            ${cluster.area ? `<div style="font-size: 10px; color: #a1a1aa; margin-top: 2px;">📍 ${cluster.area}</div>` : ""}
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on("click", () => setSelectedPoint(cluster));
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

        const pointIcon = L.divIcon({
          className: "custom-point-icon",
          html: `<div style="background: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const marker = L.marker([inc.approximate_latitude, inc.approximate_longitude], {
          icon: pointIcon,
        });

        const linkUrl = isMissing && inc.missing_person_alert_id
          ? `/missing-person/${inc.missing_person_alert_id}`
          : `/reports/${inc.id}`;

        const popupContent = `
          <div style="font-family: inherit; font-size: 12px; max-width: 250px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
              <span style="font-size: 10px; font-weight: 700; color: ${color}; text-transform: uppercase;">
                ${isMissing ? "🚨 MISSING PERSON" : inc.category_name}
              </span>
              <span style="font-size: 9px; background: #ecfdf5; color: #059669; padding: 2px 6px; border-radius: 4px; font-weight: 700;">
                ✓ ${t.platform_reviewed}
              </span>
            </div>
            <div style="font-weight: 700; font-size: 13px; color: #18181b; margin-top: 2px;">
              ${inc.title}
            </div>
            <div style="font-size: 11px; color: #71717a; margin-top: 4px;">
              📍 <strong>${inc.location_text}</strong>
            </div>
            ${inc.cluster_title ? `<div style="font-size: 10px; color: #d97706; margin-top: 2px;">🔗 Part of: ${inc.cluster_title}</div>` : ""}
            <div style="margin-top: 8px; border-top: 1px solid #f4f4f5; padding-top: 6px;">
              <a href="${linkUrl}" style="color: #059669; font-weight: 700; font-size: 11px; text-decoration: none;">
                ${t.view_incident_detail} →
              </a>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on("click", () => setSelectedPoint(inc));
        markersLayerRef.current.addLayer(marker);
      });
    }
  };

  useEffect(() => {
    renderMarkers();
  }, [data, viewMode, lang]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header & Bilingual Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white text-xl font-bold shadow-xs">
            🗺️
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {t.safety_map_title}
            </h1>
            <p className="text-xs text-zinc-500">
              {t.safety_map_subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadMapData(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition shadow-xs"
            title="Refresh Live Data"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Live Sync</span>
          </button>

          {/* View Mode Toggle: Map vs List */}
          <button
            onClick={() => setIsListView(!isListView)}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 shadow-xs hover:bg-zinc-50 transition"
          >
            {isListView ? `🗺️ ${t.map_view_toggle}` : `📋 ${t.list_view_toggle}`}
          </button>

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
      </div>

      {/* Privacy Notice Banner */}
      <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 p-3.5 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
        <span>{t.map_privacy_notice}</span>
        {data && (
          <span className="font-bold text-[11px] shrink-0 ml-2">
            📍 {data.total_incidents} Incidents • 🔶 {data.total_clusters} Clusters
          </span>
        )}
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm text-xs">
        {/* Search */}
        <div className="sm:col-span-4">
          <input
            type="text"
            placeholder={lang === "bn" ? "শিরোনাম বা এলাকা দিয়ে খুঁজুন..." : "Search by title or area..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Category Filter */}
        <div className="sm:col-span-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">{t.all_categories}</option>
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
            className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">All Time</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>

        {/* Map View Mode Toggle */}
        <div className="sm:col-span-3 flex gap-1.5">
          <button
            onClick={() => setViewMode("ALL")}
            className={`flex-1 rounded-2xl px-2.5 py-2 font-bold transition ${
              viewMode === "ALL"
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {t.mode_all}
          </button>
          <button
            onClick={() => setViewMode("CLUSTERS")}
            className={`flex-1 rounded-2xl px-2.5 py-2 font-bold transition ${
              viewMode === "CLUSTERS"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            🔶 {t.mode_clusters}
          </button>
          <button
            onClick={() => setViewMode("MISSING")}
            className={`flex-1 rounded-2xl px-2.5 py-2 font-bold transition ${
              viewMode === "MISSING"
                ? "bg-red-600 text-white shadow-xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            🚨 {t.mode_missing}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Main Content: Map or List View */}
      {isListView ? (
        <div className="space-y-4">
          <h2 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
            {lang === "bn" ? "যাচাইকৃত ঘটনার তালিকা" : "Verified Incident List"}
          </h2>

          {!data || data.incidents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-xs text-zinc-500">
              No incidents found matching the selected filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                        inc.is_missing_person ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {inc.is_missing_person ? "🚨 MISSING PERSON" : inc.category_name}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(inc.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                      {inc.title}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      📍 {inc.location_text}
                    </p>
                    {inc.cluster_title && (
                      <div className="text-[11px] text-amber-600 font-semibold">
                        🔶 {inc.cluster_title}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                    <Link
                      href={inc.is_missing_person && inc.missing_person_alert_id ? `/missing-person/${inc.missing_person_alert_id}` : `/reports/${inc.id}`}
                      className="font-bold text-emerald-600 hover:underline"
                    >
                      {t.view_incident_detail} →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="relative rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm bg-zinc-100 dark:bg-zinc-900 h-[65vh] min-h-[480px]">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xs">
              <div className="flex items-center gap-2 rounded-2xl bg-white dark:bg-zinc-800 px-5 py-3 shadow-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                <span>{t.map_loading}</span>
              </div>
            </div>
          )}

          {/* Selected Point Compact Floating Panel */}
          {selectedPoint && (
            <div className="absolute top-4 right-4 z-20 max-w-sm w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {"report_count" in selectedPoint
                    ? `🔶 Incident Cluster (${selectedPoint.report_count} reports)`
                    : "is_missing_person" in selectedPoint && selectedPoint.is_missing_person
                    ? "🚨 Missing Person"
                    : "category_name" in selectedPoint
                    ? selectedPoint.category_name
                    : "Incident"}
                </span>
                <button
                  onClick={() => setSelectedPoint(null)}
                  className="text-zinc-400 hover:text-zinc-600 text-xs font-bold p-1 cursor-pointer"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                {selectedPoint.title}
              </h4>

              <p className="text-xs text-zinc-500">
                📍 {"location_text" in selectedPoint ? selectedPoint.location_text : selectedPoint.area || "Approximate area"}
              </p>

              {"id" in selectedPoint && (
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <Link
                    href={
                      "is_missing_person" in selectedPoint && selectedPoint.is_missing_person && selectedPoint.missing_person_alert_id
                        ? `/missing-person/${selectedPoint.missing_person_alert_id}`
                        : `/reports/${selectedPoint.id}`
                    }
                    className="text-xs font-bold text-emerald-600 hover:underline"
                  >
                    {t.view_incident_detail} →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Map Legend */}
          <div className="absolute bottom-4 left-4 z-20 rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-3 border border-zinc-200 dark:border-zinc-800 shadow-md text-[11px] space-y-1.5 hidden sm:block">
            <div className="font-extrabold text-zinc-800 dark:text-zinc-200 uppercase text-[9px]">Legend</div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-600 inline-block border border-white" />
              <span>Verified Report</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500 inline-block border border-white" />
              <span>Related Report Member</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-orange-600 inline-block border border-white font-bold text-[8px] text-white flex items-center justify-center">🔶</span>
              <span>Incident Cluster Area</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-600 inline-block border border-white" />
              <span>Missing Person Alert</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
