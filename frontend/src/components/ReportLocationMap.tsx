"use client";

import React, { useEffect, useRef, useState } from "react";

interface ReportLocationMapProps {
  latitude: number;
  longitude: number;
  interactive?: boolean;
  onLocationChange?: (lat: number, lng: number) => void;
  className?: string;
  height?: string;
  showCircle?: boolean;
  caption?: string;
}

export default function ReportLocationMap({
  latitude,
  longitude,
  interactive = true,
  onLocationChange,
  className = "",
  height = "160px",
  showCircle = true,
  caption,
}: ReportLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    // 1. Inject Leaflet CSS if missing
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

      // Clean up previous map if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initialize map instance
      // Note: scrollWheelZoom is disabled so page scrolling on phones is not trapped
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 14,
        minZoom: 6,
        maxZoom: 18,
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Add compact zoom control in top-right
      L.control.zoom({ position: "topright" }).addTo(map);

      // Privacy-preserving 120m circle buffer (~110m 3-decimal fuzzing representation)
      if (showCircle) {
        const circle = L.circle([latitude, longitude], {
          radius: 120,
          color: "#059669",
          fillColor: "#10b981",
          fillOpacity: 0.18,
          weight: 1.5,
          dashArray: "4, 4",
        }).addTo(map);
        circleRef.current = circle;
      }

      // Marker Icon with 38x38px hit area and high-contrast ring
      const pinIcon = L.divIcon({
        className: "custom-preview-pin",
        html: `<div style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <div style="background: #059669; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.25), 0 3px 8px rgba(0,0,0,0.35);"></div>
        </div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker([latitude, longitude], {
        icon: pinIcon,
        draggable: interactive,
      }).addTo(map);
      markerRef.current = marker;

      // Handle interactive drag or click to adjust location
      if (interactive && onLocationChange) {
        map.on("click", (e: any) => {
          const newLat = Math.round(e.latlng.lat * 1000) / 1000;
          const newLng = Math.round(e.latlng.lng * 1000) / 1000;
          marker.setLatLng([newLat, newLng]);
          if (circleRef.current) circleRef.current.setLatLng([newLat, newLng]);
          map.panTo([newLat, newLng]);
          onLocationChange(newLat, newLng);
        });

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          const newLat = Math.round(pos.lat * 1000) / 1000;
          const newLng = Math.round(pos.lng * 1000) / 1000;
          if (circleRef.current) circleRef.current.setLatLng([newLat, newLng]);
          onLocationChange(newLat, newLng);
        });
      }

      mapInstanceRef.current = map;
      setMapLoaded(true);

      // Trigger size invalidation after render
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map position when latitude or longitude props change externally
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (markerRef.current) markerRef.current.setLatLng([latitude, longitude]);
    if (circleRef.current) circleRef.current.setLatLng([latitude, longitude]);
    map.panTo([latitude, longitude]);
  }, [latitude, longitude, mapLoaded]);

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div
        className="relative w-full rounded-2xl overflow-hidden border border-emerald-200 dark:border-emerald-800/60 bg-zinc-100 dark:bg-zinc-800 shadow-xs"
        style={{ height }}
      >
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {!mapLoaded && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-[11px] text-zinc-500 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping mr-2" />
            Loading map preview...
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 px-1">
        <span className="inline-flex items-center gap-1.5">
          <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>~110m privacy grid applied</span>
        </span>
        {interactive && (
          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
            {caption || "Tap map to adjust pin position"}
          </span>
        )}
      </div>
    </div>
  );
}
