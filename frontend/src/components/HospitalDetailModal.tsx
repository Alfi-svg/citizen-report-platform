"use client";

import React, { useEffect, useState } from "react";
import { HospitalSummary, BloodInventoryItem } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import {
  X,
  Phone,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Navigation,
  Clock,
  Droplet,
  ExternalLink,
  Building2,
  AlertCircle,
} from "lucide-react";

interface HospitalDetailModalProps {
  hospital: HospitalSummary | null;
  isOpen: boolean;
  onClose: () => void;
  lang?: "en" | "bn";
  userCoords?: { lat: number; lng: number } | null;
}

export default function HospitalDetailModal({
  hospital,
  isOpen,
  onClose,
  lang = "en",
  userCoords,
}: HospitalDetailModalProps) {
  const isBn = lang === "bn";
  const [detailedInventories, setDetailedInventories] = useState<BloodInventoryItem[]>([]);

  useEffect(() => {
    if (!isOpen || !hospital) return;

    setDetailedInventories(hospital.all_inventories || []);

    // Fetch fresh detailed hospital inventory from backend
    const fetchFresh = async () => {
      try {
        const query = userCoords ? `?lat=${userCoords.lat}&lng=${userCoords.lng}` : "";
        const data = await apiFetch<{
          hospital: HospitalSummary;
          inventories: BloodInventoryItem[];
        }>(`/blood/hospitals/${hospital.id}${query}`);
        if (data && data.inventories) {
          setDetailedInventories(data.inventories);
        }
      } catch {
        // Fallback to hospital.all_inventories
      }
    };

    fetchFresh();
  }, [isOpen, hospital, userCoords]);

  if (!isOpen || !hospital) return null;

  const isVerified = hospital.verification_status === "VERIFIED";

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
          text: isBn ? "স্টক খালি (Out of Stock)" : "Out of Stock (0 Units)",
        };
      default:
        return {
          bg: "bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300",
          dot: "bg-zinc-400",
          text: isBn ? "স্টক তথ্য অনুপলব্ধ" : "Blood Stock Unavailable",
        };
    }
  };

  const mapUrl = hospital.google_maps_url || (hospital.latitude && hospital.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${hospital.latitude},${hospital.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hospital.name}, ${hospital.address}`)}`);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
      >
        {/* Top Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60">
                <Building2 className="h-3.5 w-3.5" />
                <span>{hospital.hospital_type || (isBn ? "হাসপাতাল ও ব্লাড ব্যাংক" : "Hospital & Blood Bank")}</span>
              </span>

              {isVerified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{isBn ? "যাচাইকৃত হাসপাতাল" : "Verified Hospital"}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  <ShieldAlert className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{isBn ? "অযাচাইকৃত হাসপাতাল" : "Unverified Hospital"}</span>
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              {isBn && hospital.name_bn ? hospital.name_bn : hospital.name}
            </h2>

            {hospital.blood_bank_name && (
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <Droplet className="h-4 w-4" />
                <span>{hospital.blood_bank_name}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Quick Metrics Bar: Location & Distance & Emergency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Address */}
            <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-850/50 space-y-1">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                <span>{isBn ? "অবস্থান ও এলাকা" : "Location & Area"}</span>
              </span>
              <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                {isBn && hospital.address_bn ? hospital.address_bn : hospital.address}
              </p>
              <p className="text-[11px] text-zinc-500 font-semibold">
                {hospital.area}, {hospital.district}
              </p>
            </div>

            {/* Distance & Travel Time */}
            <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-850/50 space-y-1">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <Navigation className="h-3.5 w-3.5 text-sky-500" />
                <span>{isBn ? "দূরত্ব ও আনুমানিক সময়" : "Distance & Travel"}</span>
              </span>
              {hospital.distance_type === "ROAD" && hospital.road_distance_km !== null ? (
                <div>
                  <p className="text-sm font-black text-sky-600 dark:text-sky-400">
                    {hospital.road_distance_km} {isBn ? "কিমি (সড়ক দূরত্ব)" : "km (Road Distance)"}
                  </p>
                  {hospital.estimated_travel_minutes && (
                    <p className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{isBn ? `ড্রাইভিং সময়: ~${hospital.estimated_travel_minutes} মিনিট` : `Est. Drive: ~${hospital.estimated_travel_minutes} mins`}</span>
                    </p>
                  )}
                </div>
              ) : hospital.distance_km !== null && hospital.distance_km !== undefined ? (
                <div>
                  <p className="text-sm font-black text-zinc-800 dark:text-zinc-200">
                    {hospital.distance_km} {isBn ? "কিমি (সরাসরি রৈখিক)" : "km (Straight-line)"}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {isBn ? "সড়ক নেভিগেশনের জন্য ম্যাপ দেখুন" : "View map for driving route"}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 font-medium">
                  {isBn ? "দূরত্ব অনুপলব্ধ (লোকেশন দিন)" : "Distance unavailable (set location)"}
                </p>
              )}
            </div>

            {/* Emergency Hotline */}
            <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-850/50 space-y-1">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-emerald-500" />
                <span>{isBn ? "জরুরি যোগাযোগ" : "Emergency Contact"}</span>
              </span>
              <a
                href={`tel:${hospital.emergency_phone}`}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline block truncate"
              >
                {hospital.emergency_phone}
              </a>
              {hospital.alternate_phone && (
                <p className="text-[11px] text-zinc-500 truncate">
                  {isBn ? "বিকল্প:" : "Alt:"} {hospital.alternate_phone}
                </p>
              )}
            </div>
          </div>

          {/* Blood Stock Inventory Grid (All 8 Groups) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Droplet className="h-4 w-4 text-rose-600" />
                  <span>{isBn ? "সকল গ্রুপের রক্ত মজুদ তালিকা (৮টি গ্রুপ)" : "Blood Stock Availability (All 8 Groups)"}</span>
                </h3>
                <p className="text-xs text-zinc-500">
                  {isBn ? "অনুমোদিত হাসপাতাল রেকর্ড ও স্টাফ আপডেটের ভিত্তিতে সংকলিত" : "Grounded in verified hospital inventory records"}
                </p>
              </div>

              {hospital.last_inventory_update && (
                <span className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1 shrink-0">
                  <Clock className="h-3 w-3" />
                  <span>
                    {isBn ? "সর্বশেষ আপডেট: " : "Updated: "}
                    {new Date(hospital.last_inventory_update).toLocaleDateString(isBn ? "bn-BD" : "en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </span>
              )}
            </div>

            {/* Grid of 8 Blood Groups */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {detailedInventories.map((inv) => {
                const badge = getStatusBadge(inv.availability_status, inv.available_units);
                return (
                  <div
                    key={inv.blood_group}
                    className={`p-3 rounded-2xl border ${badge.bg} flex flex-col justify-between space-y-2`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black text-zinc-900 dark:text-zinc-100">
                        {inv.blood_group}
                      </span>
                      <span className={`h-2.5 w-2.5 rounded-full ${badge.dot}`} />
                    </div>

                    <div>
                      {inv.availability_status === "UNKNOWN" ? (
                        <p className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                          {isBn ? "তথ্য অনুপলব্ধ" : "Stock Unavailable"}
                        </p>
                      ) : (
                        <p className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100">
                          {inv.available_units} {isBn ? "ব্যাগ" : "Units"}
                        </p>
                      )}

                      <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                        {inv.is_verified
                          ? (isBn ? "স্টাফ যাচাইকৃত" : "Staff Verified")
                          : inv.is_baseline_demo
                          ? (isBn ? "ডেমো বেসলাইন" : "Baseline Demo")
                          : (isBn ? "অনিশ্চিত" : "Unverified")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Critical Disclosure Notice */}
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 p-3 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {isBn
                  ? "জরুরি বিজ্ঞপ্তি: হাসপাতালে রক্ত সংগ্রহে যাওয়ার পূর্বে সরাসরি সংশ্লিষ্ট ব্লাড ব্যাংকে ফোন দিয়ে বর্তমান রিজার্ভ ও ক্রস-ম্যাচিং সক্ষমতা যাচাই করে নিন।"
                  : "Emergency Notice: Always call the hospital blood bank directly to confirm live reserve units and donor cross-matching capacity before dispatching."}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-zinc-500">
            <span>{isBn ? "জরুরি হেল্পলাইন: ৯৯৯" : "National Emergency: 999"}</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition inline-flex items-center gap-1.5 shadow-2xs"
            >
              <Navigation className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
              <span>{isBn ? "গুগল ম্যাপে দিকনির্দেশনা" : "Google Maps Directions"}</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>

            {hospital.emergency_phone && (
              <a
                href={`tel:${hospital.emergency_phone}`}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>{isBn ? "সরাসরি কল করুন" : "Call Hospital"}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
