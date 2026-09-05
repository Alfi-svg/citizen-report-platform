"use client";

import React, { useEffect, useState } from "react";
import { useBackClose } from "@/lib/useBackClose";
import { translations, Language } from "@/lib/i18n";
import { launchEmergencyDialer, sanitizePhoneNumber, BANGLADESH_EMERGENCY_HOTLINES } from "@/lib/emergency";

export interface EmergencyCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNumber?: string;
  serviceTitle?: string;
  lang?: Language;
}

export default function EmergencyCallModal({
  isOpen,
  onClose,
  targetNumber = "999",
  serviceTitle,
  lang: propLang,
}: EmergencyCallModalProps) {
  const [currentLang, setCurrentLang] = useState<Language>(propLang || "en");
  const [hasLaunched, setHasLaunched] = useState(false);

  // Sync language with app state or localStorage
  useEffect(() => {
    if (propLang) {
      setCurrentLang(propLang);
    } else if (typeof window !== "undefined") {
      const saved = (localStorage.getItem("app_lang") as Language) || "en";
      setCurrentLang(saved);
      const handleLang = () => {
        const next = (localStorage.getItem("app_lang") as Language) || "en";
        setCurrentLang(next);
      };
      window.addEventListener("languagechange", handleLang);
      return () => window.removeEventListener("languagechange", handleLang);
    }
  }, [propLang]);

  // Reset launched state on open
  useEffect(() => {
    if (isOpen) {
      setHasLaunched(false);
    }
  }, [isOpen]);

  // Android hardware back button & browser back navigation support
  useBackClose(isOpen, onClose, "emergencyCallModal");

  // Escape key support
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const t = translations[currentLang] || translations.en;
  const cleanNumber = sanitizePhoneNumber(targetNumber);
  const knownHotline = BANGLADESH_EMERGENCY_HOTLINES[cleanNumber];

  const displayName =
    serviceTitle ||
    (knownHotline
      ? currentLang === "bn"
        ? knownHotline.nameBn
        : knownHotline.nameEn
      : currentLang === "bn"
      ? `জরুরি হটলাইন — ${cleanNumber}`
      : `Emergency Hotline — ${cleanNumber}`);

  const handleConfirmCall = () => {
    setHasLaunched(true);
    // Trigger the dialer with prefilled number. Requires zero dangerous permissions.
    launchEmergencyDialer(cleanNumber);
    // Keep modal state intact or close gracefully
    setTimeout(() => {
      onClose();
    }, 400);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="emergency-modal-title"
      aria-describedby="emergency-modal-desc"
    >
      {/* Backdrop tap to close */}
      <div
        className="fixed inset-0"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-red-200 dark:border-red-900/80 bg-white dark:bg-zinc-900 p-6 sm:p-7 shadow-2xl z-10 space-y-5 animate-in zoom-in-95 duration-150">
        {/* Top Decorative / Close */}
        <div className="flex items-start justify-between">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60">
            <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
            <span>🚨 {t.emergency_modal_badge}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Big Alert Icon & Hotline Number */}
        <div className="flex flex-col items-center text-center space-y-2 pt-1">
          <div className="h-16 w-16 rounded-3xl bg-red-600 text-white flex items-center justify-center text-3xl shadow-lg shadow-red-600/30">
            📞
          </div>
          <div className="text-3xl sm:text-4xl font-black text-red-600 dark:text-red-400 tracking-tight">
            {cleanNumber}
          </div>
          <h2
            id="emergency-modal-title"
            className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 leading-snug"
          >
            {cleanNumber === "999" ? t.emergency_modal_heading : displayName}
          </h2>
        </div>

        {/* Clarification & Safety Copy */}
        <div id="emergency-modal-desc" className="space-y-2 text-center">
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
            {cleanNumber === "999"
              ? t.emergency_modal_body
              : currentLang === "bn"
              ? `আপনি ${displayName} নম্বরে সরাসরি কল করতে যাচ্ছেন।`
              : `You are about to call ${displayName}.`}
          </p>

          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/40 p-3 text-left">
            <p className="text-[11px] sm:text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed">
              ⚠️ <span className="font-semibold">{t.emergency_modal_disclaimer}</span>
            </p>
          </div>
        </div>

        {/* Confirmation Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          {/* Cancel button */}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200 transition active:scale-98 text-center flex items-center justify-center"
          >
            {t.emergency_modal_cancel_btn}
          </button>

          {/* Confirm & Call button */}
          <button
            type="button"
            onClick={handleConfirmCall}
            disabled={hasLaunched}
            className="min-h-[48px] px-4 py-3 rounded-2xl bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-75 text-white text-xs sm:text-sm font-black shadow-md shadow-red-600/30 transition active:scale-98 text-center flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>📞</span>
            <span>
              {hasLaunched
                ? currentLang === "bn"
                  ? "সংযোগ করা হচ্ছে..."
                  : "Connecting..."
                : cleanNumber === "999"
                ? t.emergency_modal_call_btn
                : currentLang === "bn"
                ? `${cleanNumber} কল করুন`
                : `Call ${cleanNumber}`}
            </span>
          </button>
        </div>

        {/* Fallback direct tel link for browser accessibility & device compatibility */}
        <div className="text-center pt-1">
          <a
            href={`tel:${cleanNumber}`}
            className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline underline-offset-2"
            onClick={() => {
              setTimeout(() => onClose(), 400);
            }}
          >
            {currentLang === "bn"
              ? "ডায়ালার ওপেন না হলে এখানে ট্যাপ করুন"
              : "Tap here if dialer did not open automatically"}
          </a>
        </div>
      </div>
    </div>
  );
}
