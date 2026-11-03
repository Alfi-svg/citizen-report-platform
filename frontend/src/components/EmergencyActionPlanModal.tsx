"use client";

import React, { useEffect, useState } from "react";
import {
  CarFront,
  Flame,
  HeartPulse,
  Search,
  Droplet,
  Siren,
  TriangleAlert,
  CheckCircle2,
  X,
  PhoneCall,
} from "lucide-react";
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
  {
    id: "road_accident",
    labelEn: "Road Accident",
    labelBn: "সড়ক দুর্ঘটনা",
    icon: <CarFront className="h-4 w-4" aria-hidden="true" />,
  },
  {
    id: "fire",
    labelEn: "Fire Hazard",
    labelBn: "অগ্নিকাণ্ড",
    icon: <Flame className="h-4 w-4" aria-hidden="true" />,
  },
  {
    id: "medical",
    labelEn: "Medical",
    labelBn: "চিকিৎসা জরুরি",
    icon: <HeartPulse className="h-4 w-4" aria-hidden="true" />,
  },
  {
    id: "missing_person",
    labelEn: "Missing Person",
    labelBn: "নিখোঁজ ব্যক্তি",
    icon: <Search className="h-4 w-4" aria-hidden="true" />,
  },
  {
    id: "blood_requirement",
    labelEn: "Blood Crisis",
    labelBn: "রক্তের সংকট",
    icon: <Droplet className="h-4 w-4" aria-hidden="true" />,
  },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Siren className="h-5 w-5" aria-hidden="true" />
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
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-700 dark:text-slate-300">
          {/* 999 Hotline Banner */}
          <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider block">
                {isBn ? "জাতীয় জরুরি সেবা" : "National Emergency Hotline"}
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {isBn ? "পুলিশ, অ্যাম্বুলেন্স ও ফায়ার সার্ভিস" : "Police, Ambulance & Fire Service"}
              </p>
            </div>
            <a
              href="tel:999"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-sm rounded-lg shadow-xs transition flex items-center gap-1.5 shrink-0"
            >
              <PhoneCall className="w-4 h-4" aria-hidden="true" />
              <span>{isBn ? "কল ৯৯৯" : "Call 999"}</span>
            </a>
          </div>

          {/* Scenario Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {EMERGENCY_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedType(type.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  selectedType === type.id
                    ? "bg-red-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
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
              <p className="text-xs text-slate-500">{isBn ? "প্রটোকল প্রস্তুত করা হচ্ছে..." : "Loading safety steps..."}</p>
            </div>
          ) : plan ? (
            <>
              {/* Immediate Steps */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  {isBn ? "১. তাৎক্ষণিক পদক্ষেপ" : "1. Immediate Steps"}
                </h4>
                <ul className="space-y-2">
                  {plan.immediate_steps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
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
                  {isBn ? "২. যা পরিহার করবেন (সতর্কতা)" : "2. Hazards & What to Avoid"}
                </h4>
                <ul className="space-y-1.5">
                  {plan.precautions_to_avoid.map((prec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                      <TriangleAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
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
                    {isBn ? "৩. পরবর্তী করণীয়" : "3. Follow-up & Documentation"}
                  </h4>
                  <ul className="space-y-1.5">
                    {plan.follow_up_steps.map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer */}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-2 border-t border-slate-100 dark:border-slate-800">
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
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition"
          >
            {isBn ? "বন্ধ করুন" : "Dismiss"}
          </button>
        </div>
      </div>
    </div>
  );
}
