"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  AlertTriangle,
  MapPin,
  Heart,
  Check,
  Send,
  X,
  Loader2,
  Droplets,
  Bell,
  Users,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  Clock,
  Search,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  ChatMessage,
  DonorCoordinationResponse,
  DonorCoordinationConfirmResponse,
  ActionPreview,
} from "@/lib/types";
import { useBackClose } from "@/lib/useBackClose";
import { Language } from "@/lib/i18n";

interface AIDonorCoordinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId?: string;
  isOwner?: boolean;
  bloodGroup?: string;
  hospitalName?: string;
  district?: string;
  onActionCompleted?: () => void;
}

export default function AIDonorCoordinationModal({
  isOpen,
  onClose,
  requestId,
  isOwner = false,
  bloodGroup,
  hospitalName,
  district,
  onActionCompleted,
}: AIDonorCoordinationModalProps) {
  const [lang, setLang] = useState<Language>("en");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [currentResponse, setCurrentResponse] = useState<DonorCoordinationResponse | null>(null);
  const [activePreview, setActivePreview] = useState<ActionPreview | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<DonorCoordinationConfirmResponse | null>(null);
  const [donorPhoneInput, setDonorPhoneInput] = useState<string>("");
  const [donorMessageInput, setDonorMessageInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync language with application preference
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

  useBackClose(isOpen, onClose, "aiDonorCoordinationModal");

  // Initial welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      let initialMsg = "";
      if (requestId) {
        if (isOwner) {
          initialMsg = isBn
            ? `আসসালামু আলাইকুম। আমি আপনার রক্তের আবেদন (${bloodGroup || "রক্ত"}, ${hospitalName || "হাসপাতাল"}) এর এআই সমন্বয় সহকারী। আপনি রেসপন্স জানতে পারেন, ম্যাচিং রক্তদাতা খুঁজতে পারেন অথবা নিকটবর্তী ডোনারদের নোটিফিকেশন পাঠাতে পারেন।`
            : `Hello! I am your AI Donor Coordination Assistant for this blood request (${bloodGroup || "Blood"}, ${hospitalName || "Hospital"}). You can ask about donor response counts, find matching donors, or prepare an outreach broadcast to nearby donors.`;
        } else {
          initialMsg = isBn
            ? `আসসালামু আলাইকুম। আমি এই রক্তের আবেদন (${bloodGroup || "রক্ত"}, ${hospitalName || "হাসপাতাল"}) এর সমন্বয় সহকারী। আপনি রক্তদানে সহায়তা করতে চাইলে জানাতে পারেন অথবা উপযুক্ত ডোনার খুঁজতে পারেন।`
            : `Hello! I am the AI Coordination Assistant for this blood request (${bloodGroup || "Blood"}, ${hospitalName || "Hospital"}). Would you like to volunteer to donate, or understand donor compatibility?`;
        }
      } else {
        initialMsg = isBn
          ? "আসসালামু আলাইকুম। আমি নিরাপদ রক্তদাতা সমন্বয় ও অনুসন্ধান সহকারী। যেকোনো রক্তের গ্রুপ বা এলাকার ডোনার খুঁজতে আমাকে লিখুন (যেমন: 'সাভারে O+ ডোনার দরকার')।"
          : "Hello! I am Nirapotta's AI Donor Search & Coordination Assistant. Ask me to find verified blood donors by group and area (e.g. 'Show available O positive donors near Savar').";
      }

      setMessages([{ role: "assistant", content: initialMsg }]);
    }
  }, [isOpen, messages.length, isBn, isOwner, bloodGroup, hospitalName, requestId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, activePreview, currentResponse]);

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || inputValue.trim();
    if (!textToSend || sending) return;

    setInputValue("");
    setErrorMessage(null);

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: textToSend }];
    setMessages(newMessages);
    setSending(true);

    try {
      const payload = {
        message: textToSend,
        request_id: requestId || undefined,
        conversation_id: conversationId || undefined,
        history: messages.slice(-6),
        lang: lang,
      };

      const resp = await apiFetch<DonorCoordinationResponse>(
        "/reports/ai-assistant/donor-coordination",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      setCurrentResponse(resp);
      if (resp.conversation_id) setConversationId(resp.conversation_id);

      setMessages((prev) => [...prev, { role: "assistant", content: resp.reply }]);

      if (resp.action_preview) {
        setActivePreview(resp.action_preview);
      }
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : "Failed to query AI Donor Coordination service.";
      setErrorMessage(errStr);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isBn
            ? "দুঃখিত, সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
            : "Sorry, an error occurred while connecting to the donor coordination assistant. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!activePreview || confirming) return;

    setConfirming(true);
    setErrorMessage(null);

    try {
      const confirmPayload = {
        conversation_id: conversationId || currentResponse?.conversation_id || "",
        confirmation_token: activePreview.confirmation_token,
        action_type: activePreview.action_type,
        request_id: activePreview.request_id,
        message: donorMessageInput.trim() || undefined,
        contact_phone: donorPhoneInput.trim() || undefined,
      };

      const result = await apiFetch<DonorCoordinationConfirmResponse>(
        "/reports/ai-assistant/donor-coordination/confirm",
        {
          method: "POST",
          body: JSON.stringify(confirmPayload),
        }
      );

      setConfirmationResult(result);
      setActivePreview(null);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isBn
            ? `নিশ্চিতকরণ সফল: ${result.message}`
            : `Action Confirmed: ${result.message}`,
        },
      ]);

      if (onActionCompleted) {
        onActionCompleted();
      }
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : "Confirmation failed. Please try again.";
      setErrorMessage(errStr);
    } finally {
      setConfirming(false);
    }
  };

  const handleCancelAction = () => {
    setActivePreview(null);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: isBn
          ? "পদক্ষেপটি বাতিল করা হয়েছে। আর কীভাবে সহায়তা করতে পারি?"
          : "Action preview cancelled. How else can I assist you?",
      },
    ]);
  };

  const handleReset = () => {
    setMessages([]);
    setCurrentResponse(null);
    setActivePreview(null);
    setConfirmationResult(null);
    setErrorMessage(null);
    setConversationId("");
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="donor-coordination-title"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-rose-700 to-red-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 id="donor-coordination-title" className="text-sm sm:text-base font-bold leading-tight">
                  {isBn ? "এআই ডোনার সমন্বয় সহকারী" : "AI Donor Coordination Assistant"}
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/40 text-rose-100 font-semibold uppercase">
                  Database Agent
                </span>
              </div>
              <p className="text-[11px] text-rose-100/80">
                {bloodGroup ? `${bloodGroup} Blood` : "Live Search"} • {hospitalName || district || "National Network"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextLang = isBn ? "en" : "bn";
                setLang(nextLang);
                if (typeof window !== "undefined") {
                  localStorage.setItem("app_lang", nextLang);
                  window.dispatchEvent(new Event("languagechange"));
                }
              }}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition"
              title="Toggle Language"
            >
              {isBn ? "EN" : "বাংলা"}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Privacy & Medical Banner */}
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-200 shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
            <span>
              {isBn
                ? "হাসপাতালে ক্রস-ম্যাচিং যাচাই আবশ্যক। রক্তদাতার ব্যক্তিগত ফোন নম্বর ও সঠিক অবস্থান সুরক্ষিত।"
                : "Hospital cross-matching required. Donor phone numbers and exact coordinates are protected."}
            </span>
          </span>
          <button
            onClick={handleReset}
            className="text-[10px] text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 shrink-0 ml-2"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>{isBn ? "রিসেট" : "Reset"}</span>
          </button>
        </div>

        {/* Chat Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs sm:text-sm">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                  msg.role === "user"
                    ? "bg-rose-600 text-white"
                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {msg.role === "user" ? "You" : "AI"}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 whitespace-pre-wrap leading-relaxed shadow-2xs ${
                  msg.role === "user"
                    ? "bg-rose-600 text-white rounded-tr-none"
                    : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 rounded-tl-none border border-zinc-200/60 dark:border-zinc-700/60"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-zinc-400 text-xs italic py-1">
              <Loader2 className="w-4 h-4 text-rose-600 animate-spin" aria-hidden="true" />
              <span>{isBn ? "এআই ডেটাবেস অনুসন্ধান করছে..." : "AI querying donor database..."}</span>
            </div>
          )}

          {/* Matched / Searched Donors Cards (Database-Grounded Results) */}
          {currentResponse?.matched_donors && currentResponse.matched_donors.length > 0 && (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Users className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                  <span>
                    {isBn
                      ? `যাচাইকৃত ডেটাবেস রক্তদাতা (${currentResponse.matched_donors.length} জন)`
                      : `Verified Database Donors (${currentResponse.matched_donors.length})`}
                  </span>
                </span>
                <span className="text-[10px] text-zinc-400 font-normal">
                  {isBn ? "গোপনীয়তা সংরক্ষিত" : "Privacy protected"}
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                {currentResponse.matched_donors.map((donor, dIdx) => (
                  <div
                    key={donor.donor_id || dIdx}
                    className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2 shadow-2xs text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-rose-600 text-white font-extrabold rounded-md text-[11px] shrink-0">
                          {donor.blood_group}
                        </span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {donor.display_name}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 inline-flex items-center gap-1 ${
                          donor.availability_status === "AVAILABLE"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        {donor.availability_status === "AVAILABLE" && (
                          <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                        )}
                        <span>{donor.availability_status}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 text-zinc-400 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {donor.area}, {donor.district}
                          {donor.distance_km != null && ` (~${donor.distance_km} km)`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-zinc-400 shrink-0" aria-hidden="true" />
                        <span className={donor.eligible_to_donate ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-amber-600 dark:text-amber-400"}>
                          {donor.eligible_to_donate
                            ? (isBn ? "ক্লিনিক্যালি উপযুক্ত (>৯০ দিন)" : "Clinically eligible (>90d)")
                            : (isBn ? "বিরতি চলমান (<৯০ দিন)" : "Interval pending (<90d)")}
                        </span>
                      </div>
                    </div>

                    {donor.match_explanation && (
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800/80 pt-1.5 italic">
                        {donor.match_explanation}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                      <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                        <ShieldCheck className="h-3 w-3 text-zinc-400" aria-hidden="true" />
                        <span>{donor.contact_phone || "Contact protected"}</span>
                      </span>
                      <span className="font-mono text-zinc-400">
                        Method: {donor.preferred_contact_method || "IN_APP"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Donors Card if Available */}
          {currentResponse?.matching_explanation && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Users className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                  <span>{isBn ? "মেডিকেল ম্যাচিং ফলাফল" : "Medical Matching Summary"}</span>
                </span>
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                  {currentResponse.matching_explanation.total_compatible_found} {isBn ? "জন ডোনার" : "donors found"}
                </span>
              </div>
              <div className="text-[11px] text-zinc-600 dark:text-zinc-300 space-y-1">
                <p>
                  <strong className="text-zinc-800 dark:text-zinc-200">{isBn ? "সামঞ্জস্যপূর্ণ গ্রুপসমূহ:" : "Compatible Groups:"}</strong>{" "}
                  {currentResponse.matching_explanation.compatible_blood_groups.join(", ")}
                </p>
                <ul className="pl-4 list-disc space-y-0.5 text-zinc-500 dark:text-zinc-400">
                  {currentResponse.matching_explanation.matching_criteria.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center justify-between text-xs text-red-700 dark:text-red-300">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-xs text-red-700 underline font-bold"
              >
                {isBn ? "মুছে ফেলুন" : "Dismiss"}
              </button>
            </div>
          )}

          {/* SUCCESS BANNER POST CONFIRMATION */}
          {confirmationResult && (
            <div className="p-4 rounded-2xl bg-gradient-to-b from-emerald-50 to-teal-50 dark:from-emerald-950/60 dark:to-teal-950/40 border border-emerald-300 dark:border-emerald-700 space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <span>
                  {isBn ? "সফলভাবে নিশ্চিত ও সম্পন্ন হয়েছে!" : "Action Confirmed & Executed Successfully!"}
                </span>
              </div>
              <p className="text-xs text-zinc-700 dark:text-zinc-300">
                {confirmationResult.message}
              </p>
              {confirmationResult.record_id && (
                <p className="text-[11px] font-mono text-zinc-500">
                  Reference ID: {confirmationResult.record_id}
                </p>
              )}
            </div>
          )}

          {/* ACTION PREVIEW CARD (EXPLICIT USER CONFIRMATION REQUIRED) */}
          {!confirmationResult && activePreview && (
            <div className="p-4 rounded-2xl bg-gradient-to-b from-rose-50/80 to-orange-50/50 dark:from-rose-950/40 dark:to-orange-950/20 border border-rose-300 dark:border-rose-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {activePreview.action_type === "TRIGGER_OUTREACH" ? (
                    <Bell className="h-4 w-4 text-rose-600" aria-hidden="true" />
                  ) : (
                    <Heart className="h-4 w-4 text-rose-600" aria-hidden="true" />
                  )}
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-600 text-white">
                    {isBn ? "পদক্ষেপ প্রিভিউ (নিশ্চিতকরণ আবশ্যক)" : "Action Preview (Confirmation Required)"}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  {activePreview.action_title}
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                  {activePreview.action_description}
                </p>
              </div>

              {/* Action Parameter Details */}
              {activePreview.details && Object.keys(activePreview.details).length > 0 && (
                <div className="p-2.5 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-[11px] space-y-1">
                  {activePreview.details.eligible_recipient_count != null && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">{isBn ? "বিজ্ঞপ্তি প্রাপক সংখ্যা:" : "Recipients:"}</span>
                      <strong className="text-zinc-800 dark:text-zinc-200">
                        {activePreview.details.eligible_recipient_count} {isBn ? "জন ডোনার" : "donors"}
                      </strong>
                    </div>
                  )}
                  {activePreview.details.district && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">{isBn ? "জেলা:" : "District:"}</span>
                      <strong className="text-zinc-800 dark:text-zinc-200">{activePreview.details.district}</strong>
                    </div>
                  )}
                  {activePreview.details.blood_group && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">{isBn ? "রক্তের গ্রুপ:" : "Blood Group:"}</span>
                      <strong className="text-rose-600">{activePreview.details.blood_group}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Additional Inputs for EXPRESS_INTEREST */}
              {activePreview.action_type === "EXPRESS_INTEREST" && (
                <div className="space-y-2 pt-1 border-t border-rose-200 dark:border-rose-900/60 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      {isBn ? "আপনার মোবাইল নম্বর (ঐচ্ছিক):" : "Your Contact Phone (Optional):"}
                    </label>
                    <input
                      type="text"
                      placeholder="017XXXXXXXX"
                      value={donorPhoneInput}
                      onChange={(e) => setDonorPhoneInput(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      {isBn ? "বার্তা বা হাসপাতালে আসার সময় (ঐচ্ছিক):" : "Message / Estimated Arrival Time:"}
                    </label>
                    <input
                      type="text"
                      placeholder={isBn ? "যেমন: বিকেল ৪টায় আসতে পারব" : "e.g. Can arrive by 4 PM"}
                      value={donorMessageInput}
                      onChange={(e) => setDonorMessageInput(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
              )}

              {/* Confirmation CTA Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancelAction}
                  disabled={confirming}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  {isBn ? "বাতিল" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  disabled={confirming}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      <span>{isBn ? "নিশ্চিত করা হচ্ছে..." : "Confirming..."}</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isBn ? "নিশ্চিত করুন (Confirm)" : "Confirm Action"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips & Message Input */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-800 shrink-0 space-y-2">
          {/* Quick Prompt Chips */}
          {!activePreview && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
              <button
                type="button"
                onClick={() => handleSendMessage("Find O+ donors near Savar")}
                className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 hover:border-rose-500 text-[11px] transition flex items-center gap-1 shrink-0"
              >
                <Search className="h-3 w-3 text-rose-500" aria-hidden="true" />
                <span>{isBn ? "সাভারে O+ ডোনার" : "O+ in Savar"}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage(isBn ? "রক্তের গ্রুপ ম্যাচিং কারণ ব্যাখ্যা করুন" : "Explain blood matching rules")}
                className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 hover:border-rose-500 text-[11px] transition flex items-center gap-1 shrink-0"
              >
                <Droplets className="h-3 w-3 text-rose-500" aria-hidden="true" />
                <span>{isBn ? "ম্যাচিং নিয়ম" : "Matching rules"}</span>
              </button>

              {requestId && isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage(
                        isBn ? "আমার এই রক্তের আবেদনের স্ট্যাটাস কী?" : "What is the status of my blood request?"
                      )
                    }
                    className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 hover:border-rose-500 text-[11px] transition flex items-center gap-1 shrink-0"
                  >
                    <HelpCircle className="h-3 w-3 text-rose-500" aria-hidden="true" />
                    <span>{isBn ? "আবেদনের অবস্থা" : "Request status"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage(
                        isBn ? "কয়জন রক্তদাতা রেসপন্স বা আগ্রহ প্রকাশ করেছেন?" : "How many donors have responded?"
                      )
                    }
                    className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 hover:border-rose-500 text-[11px] transition flex items-center gap-1 shrink-0"
                  >
                    <Users className="h-3 w-3 text-rose-500" aria-hidden="true" />
                    <span>{isBn ? "ডোনার রেসপন্স" : "Donor responses"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage(
                        isBn ? "এই request এর outreach status কী?" : "Can we broadcast and notify matching donors?"
                      )
                    }
                    className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 hover:border-rose-500 text-[11px] transition flex items-center gap-1 shrink-0"
                  >
                    <Bell className="h-3 w-3 text-rose-500" aria-hidden="true" />
                    <span>{isBn ? "আউটরিচ ব্রডকাস্ট" : "Broadcast outreach"}</span>
                  </button>
                </>
              ) : requestId && !isOwner ? (
                <button
                  type="button"
                  onClick={() =>
                    handleSendMessage(
                      isBn ? "আমি donor হিসেবে এই request এ interested হতে চাই।" : "I want to help with this blood request"
                    )
                  }
                  className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 hover:border-rose-500 text-[11px] transition flex items-center gap-1 shrink-0"
                >
                  <Heart className="h-3 w-3 text-rose-500" aria-hidden="true" />
                  <span>{isBn ? "আমি রক্ত দিতে আগ্রহী" : "I can help / donate"}</span>
                </button>
              ) : null}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                isBn
                  ? "ডোনার সন্ধান বা সমন্বয় প্রশ্ন লিখুন (যেমন: 'Find O+ donors' বা 'সাভারে O+ ডোনার দরকার')..."
                  : "Search donors or ask coordination question (e.g. 'Find O+ donors near Savar')..."
              }
              className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-600"
              disabled={sending || confirming}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || sending || confirming}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow transition disabled:opacity-40 shrink-0 flex items-center gap-1 cursor-pointer"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isBn ? "পাঠান" : "Send"}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
