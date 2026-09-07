"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { translations, Language } from "@/lib/i18n";
import EmergencyCallModal from "@/components/EmergencyCallModal";
import { captureCurrentLocation } from "@/lib/location";

interface TrustedContactItem {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  is_confirmed: boolean;
  display_order: number;
}

interface GuardSettingsItem {
  alerts_enabled: boolean;
  share_location: boolean;
  custom_message: string | null;
}

interface RecipientItem {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  delivery_status: "SENT" | "DELIVERED" | "FAILED" | "PENDING_SMS_GATEWAY";
  delivery_notes: string | null;
  delivered_at: string | null;
}

interface EmergencySessionItem {
  id: string;
  status: "ACTIVE" | "RESOLVED" | "CANCELLED";
  message: string;
  latitude: number | null;
  longitude: number | null;
  location_address: string | null;
  location_shared: boolean;
  is_test: boolean;
  created_at: string;
  resolved_at: string | null;
  recipients: RecipientItem[];
}

interface HistoryItem {
  id: string;
  status: "ACTIVE" | "RESOLVED" | "CANCELLED";
  message: string;
  location_shared: boolean;
  is_test: boolean;
  recipient_count: number;
  created_at: string;
  resolved_at: string | null;
}

export default function GuardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Language state
  const [lang, setLang] = useState<Language>("en");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = (localStorage.getItem("app_lang") as Language) || "en";
      setLang(saved);
      const handleLang = () => {
        const next = (localStorage.getItem("app_lang") as Language) || "en";
        setLang(next);
      };
      window.addEventListener("languagechange", handleLang);
      return () => window.removeEventListener("languagechange", handleLang);
    }
  }, []);

  const t = translations[lang];

  // Core Guard Data
  const [contacts, setContacts] = useState<TrustedContactItem[]>([]);
  const [settings, setSettings] = useState<GuardSettingsItem | null>(null);
  const [activeSession, setActiveSession] = useState<EmergencySessionItem | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 999 Emergency Modal
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);

  // Emergency Trigger & Countdown Modal
  const [countdownModalOpen, setCountdownModalOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isTestMode, setIsTestMode] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // "I'm Safe" Confirmation Modal
  const [safeModalOpen, setSafeModalOpen] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Contact CRUD Modal
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<TrustedContactItem | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactRelation, setContactRelation] = useState("Family");
  const [contactConfirmed, setContactConfirmed] = useState(true);
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Settings Modal / State
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [shareLocationSetting, setShareLocationSetting] = useState(false);
  const [customMsgSetting, setCustomMsgSetting] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Fetch initial data
  const refreshGuardData = async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const [cData, sData, aData, hData] = await Promise.all([
        apiFetch<TrustedContactItem[]>("/guard/contacts").catch(() => []),
        apiFetch<GuardSettingsItem>("/guard/settings").catch(() => null),
        apiFetch<EmergencySessionItem | null>("/guard/session/active").catch(() => null),
        apiFetch<{ items: HistoryItem[]; total: number }>("/guard/history").catch(() => ({
          items: [],
          total: 0,
        })),
      ]);

      setContacts(cData || []);
      if (sData) {
        setSettings(sData);
        setShareLocationSetting(sData.share_location);
        setCustomMsgSetting(sData.custom_message || "");
      }
      setActiveSession(aData || null);
      setHistory(hData.items || []);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshGuardData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Countdown timer logic for Emergency trigger
  useEffect(() => {
    if (countdownModalOpen) {
      setCountdown(5);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleDispatchEmergency(isTestMode);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdownModalOpen, isTestMode]);

  const handleCancelCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdownModalOpen(false);
    setIsTestMode(false);
  };

  const handleImmediateSend = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    handleDispatchEmergency(isTestMode);
  };

  const handleDispatchEmergency = async (testMode: boolean) => {
    setCountdownModalOpen(false);
    setTriggering(true);
    setError(null);

    let lat: number | undefined = undefined;
    let lng: number | undefined = undefined;

    // Capture location if enabled in settings
    if (settings?.share_location) {
      try {
        const { coordinates } = await captureCurrentLocation({
          enableHighAccuracy: true,
          timeoutMs: 6000,
        });
        if (coordinates) {
          lat = coordinates.approximateLatitude;
          lng = coordinates.approximateLongitude;
        }
      } catch {
        // Graceful fallback: alert still sends without location
      }
    }

    try {
      const session = await apiFetch<EmergencySessionItem>("/guard/session/start", {
        method: "POST",
        body: JSON.stringify({
          message: settings?.custom_message || "I need help. Please contact me as soon as possible.",
          latitude: lat,
          longitude: lng,
          share_location: settings?.share_location || false,
          is_test: testMode,
        }),
      });
      setActiveSession(session);
      await refreshGuardData();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setTriggering(false);
      setIsTestMode(false);
    }
  };

  const handleConfirmSafe = async () => {
    if (!activeSession) return;
    setResolving(true);
    try {
      await apiFetch<EmergencySessionItem>(`/guard/session/${activeSession.id}/resolve`, {
        method: "POST",
      });
      setSafeModalOpen(false);
      await refreshGuardData();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setResolving(false);
    }
  };

  // Contacts CRUD
  const openAddContactModal = () => {
    setEditingContact(null);
    setContactName("");
    setContactPhone("");
    setContactRelation("Family");
    setContactConfirmed(true);
    setContactError(null);
    setContactModalOpen(true);
  };

  const openEditContactModal = (c: TrustedContactItem) => {
    setEditingContact(c);
    setContactName(c.name);
    setContactPhone(c.phone);
    setContactRelation(c.relationship);
    setContactConfirmed(c.is_confirmed);
    setContactError(null);
    setContactModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) {
      setContactError(lang === "bn" ? "নাম ও ফোন নম্বর দিন।" : "Please provide name and phone number.");
      return;
    }
    setSavingContact(true);
    setContactError(null);

    try {
      if (editingContact) {
        await apiFetch(`/guard/contacts/${editingContact.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: contactName.trim(),
            phone: contactPhone.trim(),
            relationship: contactRelation,
            is_confirmed: contactConfirmed,
          }),
        });
      } else {
        await apiFetch("/guard/contacts", {
          method: "POST",
          body: JSON.stringify({
            name: contactName.trim(),
            phone: contactPhone.trim(),
            relationship: contactRelation,
            is_confirmed: contactConfirmed,
          }),
        });
      }
      setContactModalOpen(false);
      await refreshGuardData();
    } catch (err: unknown) {
      if (err instanceof Error) setContactError(err.message);
    } finally {
      setSavingContact(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm(lang === "bn" ? "এই বিশ্বস্ত ব্যক্তিকে মুছে ফেলতে চান?" : "Delete this trusted contact?")) {
      return;
    }
    try {
      await apiFetch(`/guard/contacts/${contactId}`, { method: "DELETE" });
      await refreshGuardData();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const updated = await apiFetch<GuardSettingsItem>("/guard/settings", {
        method: "PUT",
        body: JSON.stringify({
          share_location: shareLocationSetting,
          custom_message: customMsgSetting.trim() || null,
        }),
      });
      setSettings(updated);
      setSettingsModalOpen(false);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-5">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-3xl shadow-lg">
          🛡️
        </div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
          {t.guard_title}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {lang === "bn"
            ? "নিরাপত্তা গার্ডের মাধ্যমে জরুরি সতর্কতা পাঠাতে ও বিশ্বস্ত সদস্য সেট করতে লগইন করুন।"
            : "Sign in to configure trusted contacts and trigger rapid emergency alerts with Nirapotta Guard."}
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 text-sm shadow-lg shadow-emerald-700/30 transition active:scale-95"
        >
          {lang === "bn" ? "লগইন করুন" : "Sign In to Access"}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* =================================================================== */}
      {/* 1. HERO & GUARD HEADER                                             */}
      {/* =================================================================== */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 via-zinc-900/60 to-zinc-950/90 p-6 sm:p-8 backdrop-blur-md shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>🛡️ {t.guard_title}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {t.guard_tagline}
            </h1>
            <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
              ⚠️ {t.guard_disclaimer}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition min-h-[44px]"
            >
              <span>⚙️</span>
              <span>{t.guard_settings_title}</span>
            </button>

            <button
              type="button"
              onClick={() => setEmergencyModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-xs font-black shadow-lg shadow-red-700/20 transition min-h-[44px]"
            >
              <span>📞</span>
              <span>{t.guard_call_999_btn}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Global Error Banner */}
      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-950/40 p-4 text-xs text-red-300 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-200 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. ACTIVE EMERGENCY SESSION (If active)                             */}
      {/* =================================================================== */}
      {activeSession && (
        <section className="relative overflow-hidden rounded-3xl border-2 border-red-500 bg-gradient-to-br from-red-950/60 via-zinc-900 to-zinc-950 p-6 sm:p-7 shadow-2xl space-y-5 animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-red-500 text-white shadow-md shadow-red-500/50">
                <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                <span>🚨 {t.guard_active_title}</span>
                {activeSession.is_test && <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">[TEST]</span>}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {t.guard_alert_sent_to} {activeSession.recipients.length} {t.guard_contacts_label}
              </h2>
              <p className="text-xs text-zinc-300">
                {activeSession.message}
              </p>
              {activeSession.location_shared && activeSession.latitude && (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                  <span>📍</span>
                  <span>
                    {lang === "bn" ? "আনুমানিক অবস্থান শেয়ার করা হয়েছে:" : "Approximate location shared:"}{" "}
                    {activeSession.latitude}, {activeSession.longitude} (~110m)
                  </span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSafeModalOpen(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-sm shadow-xl shadow-emerald-600/40 transition active:scale-95 min-h-[48px]"
              >
                <span>🟢</span>
                <span>{t.guard_im_safe_btn}</span>
              </button>

              <button
                type="button"
                onClick={() => setEmergencyModalOpen(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl border border-red-500/50 bg-red-950/40 hover:bg-red-900/60 text-red-200 font-bold text-sm transition min-h-[48px]"
              >
                <span>📞 999</span>
              </button>
            </div>
          </div>

          {/* Delivery Breakdown for Recipients */}
          <div className="pt-2 border-t border-red-900/50">
            <h3 className="text-xs font-bold text-zinc-400 mb-2">
              {lang === "bn" ? "সদস্যদের কাছে নোটিফিকেশন স্ট্যাটাস:" : "Recipient Delivery Status:"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeSession.recipients.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs"
                >
                  <div>
                    <span className="font-bold text-zinc-200">{rec.recipient_name}</span>
                    <span className="text-zinc-500 ml-2 text-[11px]">{rec.recipient_phone}</span>
                  </div>
                  <div className="flex items-center gap-1 font-bold">
                    {rec.delivery_status === "DELIVERED" ? (
                      <span className="text-emerald-400">✓ {t.guard_status_delivered}</span>
                    ) : rec.delivery_status === "SENT" ? (
                      <span className="text-blue-400">✓ {t.guard_status_sent}</span>
                    ) : (
                      <span className="text-amber-400">? {t.guard_status_pending}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* 3. PRIMARY EMERGENCY TRIGGER BUTTON                                 */}
      {/* =================================================================== */}
      {!activeSession && (
        <section className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-3xl border border-red-500/20 bg-gradient-to-b from-red-950/20 via-zinc-900/40 to-zinc-950/80 backdrop-blur-md shadow-2xl text-center space-y-6">
          <div className="space-y-2 max-w-md">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {lang === "bn" ? "জরুরি অ্যালার্ট ট্রিগার" : "Instant Emergency Trigger"}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              {contacts.length === 0
                ? lang === "bn"
                  ? "সতর্কতা পাঠানোর জন্য নিচে অন্তত একজন বিশ্বস্ত ব্যক্তি যুক্ত করুন।"
                  : "Add at least one trusted contact below to receive emergency alerts."
                : lang === "bn"
                ? "বাটনটিতে ট্যাপ করলে ৫ সেকেন্ডের নিশ্চিতকরণ কাউন্টডাউন শুরু হবে।"
                : "Tapping will start a safe 5-second countdown before notifying your contacts."}
            </p>
          </div>

          {/* Big Emergency Trigger Button */}
          <button
            type="button"
            onClick={() => {
              if (contacts.length === 0) {
                openAddContactModal();
              } else {
                setIsTestMode(false);
                setCountdownModalOpen(true);
              }
            }}
            disabled={triggering}
            className="group relative flex flex-col items-center justify-center h-44 w-44 sm:h-52 sm:w-52 rounded-full bg-gradient-to-br from-red-600 via-red-600 to-red-800 text-white font-black shadow-2xl shadow-red-600/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer ring-8 ring-red-500/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-400"
            aria-label={t.guard_emergency_btn}
          >
            <span className="text-3xl sm:text-4xl mb-1 group-hover:scale-110 transition">🔴</span>
            <span className="text-base sm:text-lg tracking-wider font-extrabold">{t.guard_emergency_btn}</span>
            <span className="text-[10px] text-red-200 font-semibold mt-1">
              {contacts.length} {lang === "bn" ? "জন বিশ্বস্ত ব্যক্তি" : "Contacts Linked"}
            </span>
          </button>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (contacts.length === 0) {
                  openAddContactModal();
                } else {
                  setIsTestMode(true);
                  setCountdownModalOpen(true);
                }
              }}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-4 flex items-center gap-1.5 transition"
            >
              <span>🧪</span>
              <span>{t.guard_test_alert_btn}</span>
            </button>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* 4. TRUSTED CONTACTS SECTION (1 to 5 contacts)                       */}
      {/* =================================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>👥</span>
              <span>{t.guard_trusted_contacts_title}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                {contacts.length}/5
              </span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t.guard_trusted_contacts_desc}
            </p>
          </div>

          {contacts.length < 5 && (
            <button
              type="button"
              onClick={openAddContactModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition active:scale-95 min-h-[40px]"
            >
              <span>+</span>
              <span>{t.guard_add_contact_btn}</span>
            </button>
          )}
        </div>

        {contacts.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-3">
            <p className="text-xs text-zinc-400">
              {lang === "bn"
                ? "এখনো কোনো বিশ্বস্ত ব্যক্তি যুক্ত করা হয়নি।"
                : "No trusted contacts configured yet."}
            </p>
            <button
              type="button"
              onClick={openAddContactModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition"
            >
              + {t.guard_add_contact_btn}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{c.name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {c.relationship}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{c.phone}</p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditContactModal(c)}
                    className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Edit contact"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteContact(c.id)}
                    className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/40 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Delete contact"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =================================================================== */}
      {/* 5. EMERGENCY HISTORY SECTION                                       */}
      {/* =================================================================== */}
      <section className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <h2 className="text-base font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <span>📋</span>
          <span>{t.guard_history_title}</span>
        </h2>

        {history.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">
            {t.guard_history_empty}
          </p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-black text-[11px] ${
                        item.status === "RESOLVED"
                          ? "text-emerald-500"
                          : item.status === "CANCELLED"
                          ? "text-zinc-400"
                          : "text-red-500"
                      }`}
                    >
                      ● {item.status}
                    </span>
                    {item.is_test && (
                      <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                        TEST
                      </span>
                    )}
                    <span className="text-zinc-400 text-[11px]">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-300 truncate max-w-md">
                    {item.message}
                  </p>
                </div>
                <div className="text-right text-[11px] text-zinc-400">
                  {item.recipient_count} {lang === "bn" ? "সদস্য" : "recipients"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =================================================================== */}
      {/* MODAL 1: 5-SECOND EMERGENCY COUNTDOWN MODAL                         */}
      {/* =================================================================== */}
      {countdownModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-sm rounded-3xl border-2 border-red-500 bg-zinc-950 p-6 text-center space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="h-20 w-20 mx-auto rounded-full bg-red-600/20 border-2 border-red-500 flex items-center justify-center text-4xl font-black text-red-500 animate-bounce">
              {countdown}
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">
                {isTestMode ? "🧪 " + t.guard_test_alert_btn : t.guard_confirm_heading}
              </h3>
              <p className="text-xs text-zinc-300">
                {t.guard_confirm_sub}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelCountdown}
                className="px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition min-h-[44px]"
              >
                {t.guard_cancel_btn}
              </button>

              <button
                type="button"
                onClick={handleImmediateSend}
                className="px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-black shadow-lg shadow-red-600/40 transition min-h-[44px]"
              >
                {t.guard_send_now_btn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: "I'M SAFE" CONFIRMATION MODAL                              */}
      {/* =================================================================== */}
      {safeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-sm rounded-3xl border border-emerald-500/40 bg-zinc-900 p-6 text-center space-y-4 shadow-2xl">
            <div className="text-4xl">🟢</div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">{t.guard_im_safe_confirm}</h3>
              <p className="text-xs text-zinc-400">{t.guard_im_safe_confirm_sub}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSafeModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs font-bold"
              >
                {t.guard_cancel_btn}
              </button>
              <button
                type="button"
                onClick={handleConfirmSafe}
                disabled={resolving}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-600/30"
              >
                {resolving ? "..." : t.guard_im_safe_yes}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: ADD / EDIT TRUSTED CONTACT MODAL                           */}
      {/* =================================================================== */}
      {contactModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">
                {editingContact ? t.guard_edit_contact_btn : t.guard_add_contact_btn}
              </h3>
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            {contactError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-xs text-red-300">
                {contactError}
              </div>
            )}

            <form onSubmit={handleSaveContact} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  {t.guard_contact_name_label} *
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Mother / Rahat"
                  required
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  {t.guard_contact_phone_label} *
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+88017XXXXXXXX"
                  required
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  {t.guard_contact_relation_label}
                </label>
                <select
                  value={contactRelation}
                  onChange={(e) => setContactRelation(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
                >
                  <option value="Mother">Mother / মা</option>
                  <option value="Father">Father / বাবা</option>
                  <option value="Brother">Brother / ভাই</option>
                  <option value="Sister">Sister / বোন</option>
                  <option value="Spouse">Spouse / জীবনসঙ্গী</option>
                  <option value="Friend">Friend / বন্ধু</option>
                  <option value="Guardian">Guardian / অভিভাবক</option>
                  <option value="Other">Other / অন্যান্য</option>
                </select>
              </div>

              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="confirm_contact"
                  checked={contactConfirmed}
                  onChange={(e) => setContactConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="confirm_contact" className="text-[11px] text-zinc-400">
                  {t.guard_contact_confirm_check}
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setContactModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs font-bold"
                >
                  {t.guard_cancel_btn}
                </button>
                <button
                  type="submit"
                  disabled={savingContact}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-700/30"
                >
                  {savingContact ? "..." : lang === "bn" ? "সংরক্ষণ করুন" : "Save Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: GUARD SETTINGS MODAL                                       */}
      {/* =================================================================== */}
      {settingsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">⚙️ {t.guard_settings_title}</h3>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Location sharing toggle */}
              <div className="flex items-start justify-between gap-3 p-3 rounded-2xl bg-zinc-800/80 border border-zinc-700">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-white block">
                    📍 {t.guard_share_location_label}
                  </span>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    {t.guard_share_location_desc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShareLocationSetting(!shareLocationSetting)}
                  className={`h-6 w-11 rounded-full transition-colors relative shrink-0 ${
                    shareLocationSetting ? "bg-emerald-600" : "bg-zinc-700"
                  }`}
                  role="switch"
                  aria-checked={shareLocationSetting}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                      shareLocationSetting ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Custom message */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  💬 {t.guard_custom_msg_label}
                </label>
                <textarea
                  value={customMsgSetting}
                  onChange={(e) => setCustomMsgSetting(e.target.value)}
                  placeholder="I need help. Please contact me as soon as possible."
                  rows={3}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSettingsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 text-xs font-bold"
                >
                  {t.guard_cancel_btn}
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-700/30"
                >
                  {savingSettings ? "..." : lang === "bn" ? "আপডেট করুন" : "Update Settings"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Emergency 999 Dialer Modal */}
      <EmergencyCallModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        targetNumber="999"
        lang={lang}
      />
    </div>
  );
}
