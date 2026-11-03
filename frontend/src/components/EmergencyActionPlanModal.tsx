"use client";

import React, { useEffect, useState } from "react";
import { EmergencyActionPlanResponse } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { useBackClose } from "@/lib/useBackClose";
import { Language } from "@/lib/i18n";

interface EmergencyActionPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  emergencyType: string;
  details?: string;
  initialPlan?: EmergencyActionPlanResponse | null;
}

const EMERGENCY_TYPES = [
  { id: "road_accident", labelEn: "Road Accident", labelBn: "সড়ক দুর্ঘটনা", icon: "🚗" },
  { id: "fire", labelEn: "Fire Hazard", labelBn: "অগ্নিকাণ্ড", icon: "🔥" },
  { id: "medical", labelEn: "Medical", labelBn: "চিকিৎসা জরুরি", icon: "🏥" },
  { id: "missing_person", labelEn: "Missing Person", labelBn: "নিখোঁজ ব্যক্তি", icon: "🔍" },
  { id: "blood_requirement", labelEn: "Blood Crisis", labelBn: "রক্তের সংকট", icon: "🩸" },
];

export default function EmergencyActionPlanModal({
  isOpen,
  onClose,
  emergencyType,
  details,
  initialPlan,
}: EmergencyActionPlanModalProps) {
  const [selectedType, setSelectedType] = useState<string>(emergencyType || "road_accident");
  const [plan, setPlan] = useState<EmergencyActionPlanResponse | null>(initialPlan || null);
  const [loading, setLoading] = useState<boolean>(!initialPlan);
  const [lang, setLang] = useState<Language>("en");

  // Keep selectedType updated if prop changes
  useEffect(() => {
    if (emergencyType) {
      setSelectedType(emergencyType);
    }
  }, [emergencyType]);

  // Sync language
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

  useBackClose(isOpen, onClose, "emergencyActionPlanModal");

  useEffect(() => {
    if (!isOpen) return;
    if (initialPlan && selectedType === emergencyType) {
      setPlan(initialPlan);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    apiFetch<EmergencyActionPlanResponse>("/safety/action-plan", {
      method: "POST",
      body: JSON.stringify({
        emergency_type: selectedType,
        details: details || "",
        lang,
      }),
    })
      .then((res) => {
        if (isMounted) {
          setPlan(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedType, details, initialPlan, lang, emergencyType]);

  if (!isOpen) return null;

  const isBn = lang === "bn";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center font-black text-lg">
              🚨
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">
                {plan?.title || (isBn ? "জরুরি করণীয় নির্দেশিকা" : "Emergency Action Protocol")}
              </h3>
              <p className="text-xs text-white/80">
                {isBn ? "জীবন রক্ষার্থে তাৎক্ষণিক পদক্ষেপ" : "Immediate life-saving safety steps"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
          {/* 999 Hotline Banner */}
          <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider block">
                {isBn ? "জাতীয় জরুরি সেবা" : "National Emergency Hotline"}
              </span>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                {isBn ? "পুলিশ, অ্যাম্বুলেন্স ও ফায়ার সার্ভিস" : "Police, Ambulance & Fire Service"}
              </p>
            </div>
            <a
              href="tel:999"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-sm rounded-lg shadow transition flex items-center gap-1.5 shrink-0"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.24 1.02l-2.21 2.2z" />
              </svg>
              <span>{isBn ? "কল ৯৯৯" : "Call 999"}</span>
            </a>
          </div>

          {/* Scenario Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {EMERGENCY_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedType(type.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  selectedType === type.id
                    ? "bg-red-600 text-white shadow-2xs"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                <span>{type.icon}</span>
                <span>{isBn ? type.labelBn : type.labelEn}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-8 text-center space-y-2">
              <div className="inline-block w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-zinc-500">{isBn ? "প্রটোকল প্রস্তুত করা হচ্ছে..." : "Loading safety steps..."}</p>
            </div>
          ) : plan ? (
            <>
              {/* Immediate Steps */}
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  {isBn ? "১. তাৎক্ষণিক পদক্ষেপ (Immediate Steps)" : "1. Immediate Steps"}
                </h4>
                <ul className="space-y-2">
                  {plan.immediate_steps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800">
                      <span className="h-5 w-5 rounded-full bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Precautions to Avoid */}
              <div>
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {isBn ? "২. যা পরিহার করবেন (Hazards & Precautions)" : "2. Hazards & What to Avoid"}
                </h4>
                <ul className="space-y-1.5">
                  {plan.precautions_to_avoid.map((prec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300">
                      <span className="text-amber-500 font-bold mt-0.5">⚠️</span>
                      <span>{prec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Follow-up / Recovery */}
              {plan.follow_up_steps && plan.follow_up_steps.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {isBn ? "৩. পরবর্তী করণীয় (Follow-up Steps)" : "3. Follow-up & Documentation"}
                  </h4>
                  <ul className="space-y-1.5">
                    {plan.follow_up_steps.map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300">
                        <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer */}
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic pt-2 border-t border-zinc-100 dark:border-zinc-800">
                {plan.disclaimer}
              </p>
            </>
          ) : (
            <p className="text-xs text-red-500 text-center py-4">
              {isBn ? "প্রটোকল লোড করা সম্ভব হয়নি।" : "Unable to load action protocol."}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/80 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 transition"
          >
            {isBn ? "বন্ধ করুন" : "Dismiss"}
          </button>
        </div>
      </div>
    </div>
  );
}
