"use client";

import React, { useState } from "react";
import { HospitalSummary, BloodInventoryItem } from "@/lib/types";
import {
  Phone,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Clock,
  Navigation,
  Droplet,
  ExternalLink,
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
  const [showAllGroups, setShowAllGroups] = useState(false);
  const isBn = lang === "bn";

  const isVerified = hospital.verification_status === "VERIFIED";

  // Safe standard date formatting (pure during render)
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
        };
      case "LOW_STOCK":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300",
          dot: "bg-amber-500",
          text: isBn ? `সীমিত স্টক (${units} ব্যাগ)` : `Low Stock (${units} Units)`,
        };
      case "OUT_OF_STOCK":
        return {
          bg: "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300",
          dot: "bg-rose-500",
          text: isBn ? "স্টক খালি (Out of Stock)" : "Out of Stock",
        };
      default:
        return {
          bg: "bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300",
          dot: "bg-zinc-400",
          text: isBn ? "অনিশ্চিত স্টক (Unknown)" : "Unknown Stock",
        };
    }
  };

  const mapUrl = hospital.latitude && hospital.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${hospital.latitude},${hospital.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hospital.name}, ${hospital.address}`)}`;

  const hasPhone = Boolean(hospital.emergency_phone && hospital.emergency_phone.trim() !== "");

  return (
    <div
      onClick={() => onSelectHospital?.(hospital)}
      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition space-y-3.5"
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

        {hospital.distance_km !== null && hospital.distance_km !== undefined && (
          <div className="px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 text-right shrink-0">
            <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">
              {hospital.distance_km}
            </span>
            <span className="text-[10px] text-zinc-500 font-bold ml-0.5">
              {isBn ? "কিমি" : "km"}
            </span>
          </div>
        )}
      </div>

      {/* Address & Location */}
      <div className="flex items-start gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
        <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
        <span className="line-clamp-2">
          {isBn && hospital.address_bn ? hospital.address_bn : hospital.address}
        </span>
      </div>

      {/* Matching Blood Inventory Banner */}
      {hospital.matching_inventory && (
        <div className="p-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-rose-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
              {hospital.matching_inventory.blood_group}
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${getStatusBadge(hospital.matching_inventory.availability_status, hospital.matching_inventory.available_units).dot}`} />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {getStatusBadge(hospital.matching_inventory.availability_status, hospital.matching_inventory.available_units).text}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                <span>{isBn ? "আপডেট:" : "Updated:"} {formatTime(hospital.matching_inventory.last_updated)}</span>
              </p>
            </div>
          </div>

          <span className="text-[10px] font-semibold text-zinc-500 hidden sm:inline">
            {isBn ? "ফোনে নিশ্চিত করুন" : "Confirm by phone"}
          </span>
        </div>
      )}

      {/* Quick Available Groups Overview */}
      {hospital.available_groups && hospital.available_groups.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className="text-zinc-500 font-semibold">{isBn ? "মজুদ গ্রুপ:" : "In Stock:"}</span>
          {hospital.available_groups.map((bg) => (
            <span
              key={bg}
              className={`px-1.5 py-0.5 rounded-md font-extrabold text-[11px] ${
                selectedBloodGroup && selectedBloodGroup.toUpperCase() === bg.toUpperCase()
                  ? "bg-rose-600 text-white ring-2 ring-rose-400"
                  : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
              }`}
            >
              {bg}
            </span>
          ))}
        </div>
      )}

      {/* Expandable Full Inventory Drawer */}
      {showAllGroups && (
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            {isBn ? "সকল গ্রুপের স্টক বিস্তারিত:" : "All Blood Group Inventories:"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {hospital.all_inventories.map((inv: BloodInventoryItem) => {
              const badge = getStatusBadge(inv.availability_status, inv.available_units);
              return (
                <div
                  key={inv.blood_group}
                  className={`p-2 rounded-xl border ${badge.bg} flex flex-col justify-between text-xs`}
                >
                  <div className="flex items-center justify-between font-black">
                    <span>{inv.blood_group}</span>
                    <span className="text-[10px] opacity-80">{inv.available_units} u</span>
                  </div>
                  <span className="text-[10px] font-medium truncate mt-0.5">
                    {inv.availability_status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowAllGroups(!showAllGroups);
          }}
          className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1 cursor-pointer"
        >
          <span>{showAllGroups ? (isBn ? "সংক্ষেপ" : "Hide Inventory") : (isBn ? "সকল গ্রুপ" : "All Groups")}</span>
          {showAllGroups ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Map Link */}
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Navigation className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
            <span className="hidden sm:inline">{isBn ? "ম্যাপ দেখুন" : "View Map"}</span>
            <ExternalLink className="h-3 w-3 opacity-60 sm:hidden" />
          </a>

          {/* Call Hospital */}
          {hasPhone ? (
            <a
              href={`tel:${hospital.emergency_phone}`}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition inline-flex items-center gap-1.5 shadow-2xs"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>{isBn ? "কল করুন" : "Call Hospital"}</span>
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-400 text-xs font-bold cursor-not-allowed inline-flex items-center gap-1"
            >
              <Phone className="h-3.5 w-3.5 opacity-50" />
              <span>{isBn ? "নম্বর অনুপলব্ধ" : "No Phone"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
