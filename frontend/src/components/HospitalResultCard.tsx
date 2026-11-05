"use client";

import React from "react";
import { HospitalSummary, BloodInventoryItem } from "@/lib/types";
import {
  Phone,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Navigation,
  Droplet,
  ExternalLink,
  Info,
} from "lucide-react";

interface HospitalResultCardProps {
  hospital: HospitalSummary;
  selectedBloodGroup?: string | null;
  lang?: "en" | "bn";
  onSelectHospital?: (hospital: HospitalSummary) => void;
}

export default function HospitalResultCard({
  hospital,
  selectedBloodGroup,
  lang = "en",
  onSelectHospital,
}: HospitalResultCardProps) {
  const isBn = lang === "bn";

  const isVerified = hospital.verification_status === "VERIFIED";

  // Safe date formatting
  const formatTime = (ts?: string | null) => {
    if (!ts) return isBn ? "যাচাই প্রক্রিয়াধীন" : "Pending update";
    try {
      const d = new Date(ts);
      return d.toLocaleDateString(isBn ? "bn-BD" : "en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  const getStatusBadge = (status: string, units: number) => {
    switch (status) {
      case "AVAILABLE":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300",
          dot: "bg-emerald-500",
          text: isBn ? `${units} ব্যাগ উপলব্ধ (Available)` : `${units} Units Available`,
          chip: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        };
      case "LOW_STOCK":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300",
          dot: "bg-amber-500",
          text: isBn ? `সীমিত স্টক (${units} ব্যাগ)` : `Low Stock (${units} Units)`,
          chip: "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        };
      case "OUT_OF_STOCK":
        return {
          bg: "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300",
          dot: "bg-rose-500",
          text: isBn ? "স্টক খালি" : "Out of Stock",
          chip: "bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
        };
      default:
        return {
          bg: "bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300",
          dot: "bg-zinc-400",
          text: isBn ? "স্টক তথ্য অনুপলব্ধ" : "Stock Unavailable",
          chip: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
        };
    }
  };

  const mapUrl = hospital.google_maps_url || (hospital.latitude && hospital.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${hospital.latitude},${hospital.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hospital.name}, ${hospital.address}`)}`);

  const hasPhone = Boolean(hospital.emergency_phone && hospital.emergency_phone.trim() !== "");

  return (
    <div
      onClick={() => onSelectHospital?.(hospital)}
      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition space-y-3.5 cursor-pointer"
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {isBn && hospital.name_bn ? hospital.name_bn : hospital.name}
            </h3>
            {isVerified ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 shrink-0">
                <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span>{isBn ? "যাচাইকৃত হাসপাতাল" : "Verified Hospital"}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                <ShieldAlert className="h-3 w-3 text-zinc-500" />
                <span>{isBn ? "অযাচাইকৃত" : "Unverified"}</span>
              </span>
            )}
          </div>

          {hospital.blood_bank_name && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
              <Droplet className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{hospital.blood_bank_name}</span>
            </p>
          )}
        </div>

        {/* Distance Badge */}
        {hospital.distance_type === "ROAD" && hospital.road_distance_km !== null ? (
          <div className="px-2.5 py-1 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-right shrink-0">
            <div className="flex items-baseline justify-end gap-0.5">
              <span className="text-xs font-black text-sky-700 dark:text-sky-300">
                {hospital.road_distance_km}
              </span>
              <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">
                {isBn ? "কিমি (সড়ক)" : "km (road)"}
              </span>
            </div>
            {hospital.estimated_travel_minutes && (
              <p className="text-[10px] text-zinc-500 font-medium">
                ~{hospital.estimated_travel_minutes} {isBn ? "মিনিট ড্রাইভ" : "mins drive"}
              </p>
            )}
          </div>
        ) : hospital.distance_km !== null && hospital.distance_km !== undefined ? (
          <div className="px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 text-right shrink-0">
            <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">
              {hospital.distance_km}
            </span>
            <span className="text-[10px] text-zinc-500 font-bold ml-0.5">
              {isBn ? "কিমি" : "km"}
            </span>
            <p className="text-[9px] text-zinc-400">
              {isBn ? "রৈখিক দূরত্ব" : "straight-line"}
            </p>
          </div>
        ) : (
          <div className="px-2 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 text-right shrink-0">
            <span className="text-[10px] text-zinc-500 font-bold">
              {isBn ? "দূরত্ব অনুপলব্ধ" : "Distance N/A"}
            </span>
          </div>
        )}
      </div>

      {/* Address & Location */}
      <div className="flex items-start gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-400" />
        <span className="line-clamp-1">
          {isBn && hospital.address_bn ? hospital.address_bn : hospital.address} ({hospital.area}, {hospital.district})
        </span>
      </div>

      {/* Matching Blood Inventory Highlight */}
      {hospital.matching_inventory && (
        <div className="p-2.5 rounded-xl border bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-rose-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
              {hospital.matching_inventory.blood_group}
            </span>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`h-2 w-2 rounded-full ${getStatusBadge(hospital.matching_inventory.availability_status, hospital.matching_inventory.available_units).dot}`} />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {getStatusBadge(hospital.matching_inventory.availability_status, hospital.matching_inventory.available_units).text}
                </span>
                {hospital.matching_inventory.is_verified ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                    {isBn ? "স্টাফ যাচাইকৃত" : "Staff Verified"}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                    {isBn ? "বেসলাইন ডেমো স্টক" : "Baseline Demo Stock"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <span className="text-[10px] font-semibold text-zinc-500 hidden sm:inline">
            {isBn ? "সরাসরি নিশ্চিত করুন" : "Confirm with hospital"}
          </span>
        </div>
      )}

      {/* Blood Groups Grid (Overview of All 8 Groups) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span className="font-bold flex items-center gap-1">
            <Droplet className="h-3 w-3 text-rose-500" />
            <span>{isBn ? "রক্তের গ্রুপ স্টক সারসংক্ষেপ:" : "Blood Stock Inventory:"}</span>
          </span>
          {hospital.last_inventory_update && (
            <span className="text-[10px] flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              <span>{formatTime(hospital.last_inventory_update)}</span>
            </span>
          )}
        </div>

        {/* 8 Blood Groups Pill Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
          {hospital.all_inventories.map((inv: BloodInventoryItem) => {
            const isMatch = selectedBloodGroup && selectedBloodGroup.toUpperCase() === inv.blood_group.toUpperCase();
            const badge = getStatusBadge(inv.availability_status, inv.available_units);
            return (
              <div
                key={inv.blood_group}
                className={`p-1.5 rounded-xl border text-center transition flex flex-col justify-between ${
                  isMatch ? "ring-2 ring-rose-500 border-rose-300 dark:border-rose-700 bg-rose-50/70 dark:bg-rose-950/50" : badge.bg
                }`}
              >
                <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                  {inv.blood_group}
                </span>
                <span className="text-[10px] font-extrabold mt-0.5">
                  {inv.availability_status === "UNKNOWN"
                    ? (isBn ? "অনুপলব্ধ" : "N/A")
                    : `${inv.available_units} u`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onSelectHospital?.(hospital)}
          className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 inline-flex items-center gap-1 cursor-pointer"
        >
          <Info className="h-3.5 w-3.5" />
          <span>{isBn ? "বিস্তারিত ও স্টক দেখুন" : "View Details & Stock"}</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Map Directions Link */}
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Navigation className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
            <span className="hidden sm:inline">{isBn ? "ম্যাপ" : "Directions"}</span>
            <ExternalLink className="h-3 w-3 opacity-60 sm:hidden" />
          </a>

          {/* Direct Phone Call */}
          {hasPhone ? (
            <a
              href={`tel:${hospital.emergency_phone}`}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition inline-flex items-center gap-1.5 shadow-2xs"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>{isBn ? "কল করুন" : "Call"}</span>
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-400 text-xs font-bold cursor-not-allowed inline-flex items-center gap-1"
            >
              <Phone className="h-3.5 w-3.5 opacity-50" />
              <span>{isBn ? "নম্বর নেই" : "No Phone"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
