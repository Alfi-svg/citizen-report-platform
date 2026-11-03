"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import LiveRoadSafety3DMap from "@/components/LiveRoadSafety3DMap";
import { Language } from "@/lib/i18n";
import { Shield, Map } from "lucide-react";

function LiveMapInner() {
  const searchParams = useSearchParams();
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const areaParam = searchParams.get("area");

  const initialLat = latParam ? parseFloat(latParam) : 23.7461;
  const initialLng = lngParam ? parseFloat(lngParam) : 90.3742;
  const initialArea = areaParam || "Dhanmondi, Dhaka";

  const [lang, setLang] = useState<Language>("en");

  // Sync language with app_lang
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

  const isBn = lang === "bn";

  return (
    <div className="relative w-full min-h-screen bg-zinc-950 flex flex-col">
      {/* Top Banner Bar */}
      <div className="h-14 sm:h-16 px-4 bg-zinc-950/95 border-b border-zinc-800 flex items-center justify-between text-white shrink-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/safety/road-intelligence"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold transition text-zinc-300 hover:text-white"
          >
            <span>←</span>
            <span>{isBn ? "ড্যাশবোর্ড" : "Dashboard"}</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
              <span>{isBn ? "সড়ক নিরাপত্তা ৩ডি লাইভ ম্যাপ" : "Road Safety 3D Live Map"}</span>
              <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded-full bg-cyan-600 text-white">
                Uber Mode
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/safety"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition px-2.5 py-1 rounded-lg hover:bg-zinc-800"
          >
            <Shield className="h-3.5 w-3.5" />
            <span>{isBn ? "নিরাপত্তা কেন্দ্র" : "Safety Hub"}</span>
          </Link>
          <Link
            href="/safety-map"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition px-2.5 py-1 rounded-lg hover:bg-zinc-800"
          >
            <Map className="h-3.5 w-3.5" />
            <span>{isBn ? "কমিউনিটি ম্যাপ" : "Safety Map"}</span>
          </Link>
        </div>
      </div>

      {/* 3D Map Viewport */}
      <div className="flex-1 relative">
        <LiveRoadSafety3DMap
          initialLatitude={initialLat}
          initialLongitude={initialLng}
          initialAreaName={initialArea}
          lang={lang}
        />
      </div>
    </div>
  );
}

export default function RoadSafetyLiveMapPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-zinc-950 flex items-center justify-center text-white">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-zinc-400 font-bold">Loading 3D Live Map...</span>
          </div>
        </div>
      }
    >
      <LiveMapInner />
    </Suspense>
  );
}
