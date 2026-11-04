"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  AlertTriangle,
  Zap,
  MapPin,
  HeartPulse,
  Check,
  CarFront,
  Flame,
  Send,
  X,
  PhoneCall,
  Loader2,
  Droplet,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  HelpCircle,
  FileText,
  Mic,
} from "lucide-react";
import AIVoiceEmergencyModal from "@/components/AIVoiceEmergencyModal";
import { apiFetch } from "@/lib/api";
import {
  ChatMessage,
  EmergencyAssistantResponse,
  EmergencyConfirmationResponse,
  DraftReportPreview,
  EmergencyType,
  Category,
} from "@/lib/types";
import { useBackClose } from "@/lib/useBackClose";
import { Language } from "@/lib/i18n";

interface AIEmergencyAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyDraft: (draft: DraftReportPreview) => void;
  categories: Category[];
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  currentLocationText?: string | null;
}

export default function AIEmergencyAssistantModal({
  isOpen,
  onClose,
  onApplyDraft,
  categories,
  currentLatitude,
  currentLongitude,
  currentLocationText,
}: AIEmergencyAssistantModalProps) {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [currentResponse, setCurrentResponse] = useState<EmergencyAssistantResponse | null>(null);
  const [conversationId, setConversationId] = useState<string>("");
  const [confirmationResult, setConfirmationResult] = useState<EmergencyConfirmationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const isBn = lang === "bn";

  useBackClose(isOpen, onClose, "aiEmergencyAssistantModal");

  // Initial welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: isBn
            ? "আসসালামু আলাইকুম। আপনি কি কোনো জরুরি দুর্ঘটনা, বিপদ বা রক্তের জরুরি প্রয়োজনে সাহায্য খুঁজছেন? আপনার ভাষায় সংক্ষেপে বলুন (যেমন: 'মিরপুরে বাস দুর্ঘটনা ঘটেছে, আহতদের সাহায্য দরকার' অথবা 'আমার বাবার B+ রক্ত লাগবে ঢাকা মেডিকেল ২ ব্যাগ')।"
            : "Hello. Did you witness an incident, hazard, or do you have an urgent medical blood requirement? Describe what happened or what you need naturally (e.g. 'Bus accident near Mirpur 10' or 'Need 2 bags of B+ blood at Dhaka Medical tonight').",
        },
      ]);
    }
  }, [isOpen, messages.length, isBn]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, confirming]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputValue;
    if (!textToSend.trim() || sending || confirming) return;

    setErrorMessage(null);
    const userMsg: ChatMessage = { role: "user", content: textToSend.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputValue("");
    setSending(true);

    try {
      const res = await apiFetch<EmergencyAssistantResponse>("/reports/ai-assistant/chat", {
        method: "POST",
        body: JSON.stringify({
          message: textToSend.trim(),
          history: newHistory,
          conversation_id: conversationId || undefined,
          current_latitude: currentLatitude || undefined,
          current_longitude: currentLongitude || undefined,
          current_location_text: currentLocationText || undefined,
          lang,
        }),
      });

      setCurrentResponse(res);
      setConversationId(res.conversation_id);

      const aiMsgContent = res.follow_up_question
        ? `${res.reply}\n\n${res.follow_up_question}`
        : res.reply;

      setMessages((prev) => [...prev, { role: "assistant", content: aiMsgContent }]);
    } catch {
      setErrorMessage(
        isBn
          ? "সংযোগ ব্যর্থ হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।"
          : "Connection failed. Please retry your request."
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isBn
            ? "দুঃখিত, সংযোগে বিঘ্ন ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
            : "Connection error. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleApplyToForm = () => {
    if (currentResponse?.draft_report) {
      onApplyDraft(currentResponse.draft_report);
      onClose();
    }
  };

  const handleConfirmAndSubmit = async () => {
    if (!currentResponse || confirming) return;

    const emergencyType: EmergencyType = currentResponse.emergency_type || "INCIDENT";
    setConfirming(true);
    setErrorMessage(null);

    try {
      const payload = {
        conversation_id: currentResponse.conversation_id,
        emergency_type: emergencyType,
        confirmation_token: currentResponse.confirmation_token || undefined,
        draft_report: currentResponse.draft_report || undefined,
        draft_blood_request: currentResponse.draft_blood_request || undefined,
      };

      const result = await apiFetch<EmergencyConfirmationResponse>("/reports/ai-assistant/confirm", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setConfirmationResult(result);
    } catch (err: any) {
      const detail = err?.message || err?.detail;
      if (err?.status === 401 || detail?.includes("unauthorized") || detail?.includes("Not authenticated")) {
        setErrorMessage(
          isBn
            ? "অনুরোধ নিশ্চিত করতে অনুগ্রহ করে প্রথমে সিস্টেমে লগইন করুন।"
            : "Please log in to your citizen account to confirm and submit this emergency request."
        );
      } else {
        setErrorMessage(
          detail ||
            (isBn
              ? "অনুরোধ জমা দিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
              : "Failed to confirm emergency request. Please retry.")
        );
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setCurrentResponse(null);
    setConfirmationResult(null);
    setErrorMessage(null);
    setInputValue("");
    setConversationId("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[720px]">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-bold leading-tight">
                  {isBn ? "এআই জরুরি সহকারী" : "AI Emergency Assistant"}
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/40 text-blue-100 font-semibold tracking-wide uppercase">
                  Phase A
                </span>
              </div>
              <p className="text-[11px] text-blue-100/80">
                {isBn
                  ? "স্বাভাবিক ভাষায় বলুন — দুর্ঘটনা বা জরুরি রক্তের আবেদন"
                  : "Natural Language Incident & Blood Emergency Intake"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Toggle */}
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

            {/* National 999 Hotline */}
            <a
              href="tel:999"
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
              title="National Emergency 999"
            >
              <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
              <span>999</span>
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Emergency Alert Banner */}
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/50 flex items-center justify-between text-[11px] text-red-700 dark:text-red-300 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            <span>
              {isBn
                ? "জীবনের তাৎক্ষণিক ঝুঁকিতে চ্যাট না করে সরাসরি ৯৯৯ নম্বরে কল করুন।"
                : "In immediate life-threatening danger, dial National Emergency 999 directly."}
            </span>
          </span>
          <a href="tel:999" className="font-bold underline text-red-800 dark:text-red-200 shrink-0 ml-2">
            {isBn ? "কল ৯৯৯" : "Call 999"}
          </a>
        </div>

        {/* Active Context / Extraction Status Banner */}
        {currentResponse && (
          <div className="px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between text-[11px] shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto py-0.5">
              <span className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">
                {isBn ? "ধরণ:" : "Type:"}
              </span>
              <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">
                {currentResponse.emergency_type === "BLOOD_REQUEST"
                  ? isBn
                    ? "জরুরি রক্ত"
                    : "Blood Emergency"
                  : isBn
                  ? "দুর্ঘটনা / অভিযোগ"
                  : "Incident Report"}
              </span>

              {/* Status chips */}
              {currentResponse.is_ready_for_review ? (
                <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  <span>{isBn ? "যাচাইয়ের জন্য প্রস্তুত" : "Ready for Preview"}</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" aria-hidden="true" />
                  <span>{isBn ? "অতিরিক্ত তথ্য প্রয়োজন" : "Needs Clarification"}</span>
                </span>
              )}

              {currentResponse.missing_fields.length > 0 && (
                <span className="text-zinc-500 text-[10px]">
                  {isBn ? "বাকি:" : "Missing:"} {currentResponse.missing_fields.join(", ")}
                </span>
              )}
            </div>

            <button
              onClick={handleReset}
              className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1 transition shrink-0 ml-2"
              title="Reset conversation"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              <span>{isBn ? "রিসেট" : "Reset"}</span>
            </button>
          </div>
        )}

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
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {msg.role === "user" ? "You" : "AI"}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 whitespace-pre-wrap leading-relaxed shadow-2xs ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-none"
                    : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 rounded-tl-none border border-zinc-200/60 dark:border-zinc-700/60"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-zinc-400 text-xs italic py-1">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" aria-hidden="true" />
              <span>{isBn ? "এআই তথ্য বিশ্লেষণ করছে..." : "AI analyzing emergency details..."}</span>
            </div>
          )}

          {/* Action plan summary chips if available */}
          {currentResponse?.action_plan_summary && currentResponse.action_plan_summary.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
              <span className="font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <span>{isBn ? "তাৎক্ষণিক করণীয় পদক্ষেপ:" : "Immediate Safety Steps:"}</span>
              </span>
              <ul className="space-y-1 pl-4 list-disc">
                {currentResponse.action_plan_summary.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
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
                onClick={handleConfirmAndSubmit}
                className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition shrink-0 ml-2"
              >
                {isBn ? "পুনরায় চেষ্টা" : "Retry"}
              </button>
            </div>
          )}

          {/* SUCCESS BANNER POST-CONFIRMATION */}
          {confirmationResult && (
            <div className="p-4 rounded-2xl bg-gradient-to-b from-emerald-50 to-teal-50 dark:from-emerald-950/60 dark:to-teal-950/40 border border-emerald-300 dark:border-emerald-700 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <span>
                  {isBn ? "জরুরি অনুরোধ সফলভাবে নিশ্চিত ও তৈরি হয়েছে!" : "Emergency Request Successfully Confirmed!"}
                </span>
              </div>

              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {confirmationResult.message}
              </p>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 font-mono bg-white dark:bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <span className="font-bold text-zinc-500">{isBn ? "আইডি:" : "Record ID:"}</span>
                <span className="text-zinc-900 dark:text-zinc-100 font-semibold">
                  {confirmationResult.record_id}
                </span>
                <span className="ml-auto px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                  {confirmationResult.request_status}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    onClose();
                    router.push(confirmationResult.redirect_url);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <span>{isBn ? "অনুরোধটি দেখুন" : "View Created Request"}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* DRAFT INCIDENT REPORT PREVIEW CARD */}
          {!confirmationResult && currentResponse?.draft_report && (
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-b from-blue-50/70 to-indigo-50/40 dark:from-blue-950/40 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-600 text-white uppercase tracking-wider">
                    {isBn ? "খসড়া রিপোর্ট (এখনও জমা হয়নি)" : "Draft Report (Not Submitted Yet)"}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300">
                  {currentResponse.draft_report.category_name}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {currentResponse.draft_report.title}
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 line-clamp-3">
                  {currentResponse.draft_report.description}
                </p>
                <div className="mt-2 text-xs flex flex-wrap items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>{currentResponse.draft_report.location_text}</span>
                  </span>
                  {currentResponse.draft_report.injuries_reported && (
                    <span className="text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                      <HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{currentResponse.draft_report.injuries_reported}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-blue-200/60 dark:border-blue-800/40 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-zinc-500">
                  {isBn ? "যাচাই করুন ও জমা দিতে কনফার্ম চাপুন।" : "Review and confirm to submit report."}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleApplyToForm}
                    className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-zinc-800 dark:text-zinc-200 font-semibold text-xs rounded-xl transition"
                    title="Edit in full form"
                  >
                    {isBn ? "ফর্মে যুক্ত করুন" : "Apply to Form"}
                  </button>
                  <button
                    onClick={handleConfirmAndSubmit}
                    disabled={confirming}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    {confirming ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        <span>{isBn ? "জমা হচ্ছে..." : "Submitting..."}</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{isBn ? "নিশ্চিত ও জমা দিন" : "Confirm & Submit"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DRAFT BLOOD REQUEST PREVIEW CARD */}
          {!confirmationResult && currentResponse?.draft_blood_request && (
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-b from-rose-50/70 to-red-50/40 dark:from-rose-950/40 dark:to-red-950/20 border border-rose-200 dark:border-rose-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Droplet className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-600 text-white uppercase tracking-wider">
                    {isBn ? "খসড়া রক্তের আবেদন (এখনও জমা হয়নি)" : "Draft Blood Request (Not Submitted Yet)"}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-md text-xs font-black bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-200">
                  {currentResponse.draft_blood_request.blood_group}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-white/70 dark:bg-zinc-800/70 border border-rose-100 dark:border-rose-900/40">
                  <span className="text-[10px] text-zinc-500 block uppercase font-bold">
                    {isBn ? "হাসপাতাল" : "Hospital"}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {currentResponse.draft_blood_request.hospital_name}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white/70 dark:bg-zinc-800/70 border border-rose-100 dark:border-rose-900/40">
                  <span className="text-[10px] text-zinc-500 block uppercase font-bold">
                    {isBn ? "পরিমাণ / ব্যাগ" : "Quantity"}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {currentResponse.draft_blood_request.units_required} {isBn ? "ব্যাগ" : "bag(s)"}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white/70 dark:bg-zinc-800/70 border border-rose-100 dark:border-rose-900/40">
                  <span className="text-[10px] text-zinc-500 block uppercase font-bold">
                    {isBn ? "এলাকা ও জেলা" : "Area & District"}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {currentResponse.draft_blood_request.hospital_area}, {currentResponse.draft_blood_request.district}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white/70 dark:bg-zinc-800/70 border border-rose-100 dark:border-rose-900/40">
                  <span className="text-[10px] text-zinc-500 block uppercase font-bold">
                    {isBn ? "যোগাযোগের নম্বর" : "Contact Phone"}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {currentResponse.draft_blood_request.contact_phone || (isBn ? "প্রয়োজন" : "Required")}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-rose-200/60 dark:border-rose-800/40 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-zinc-500">
                  {isBn
                    ? "নিশ্চিত করলে রক্তদানকারী ডোনারদের নিকট পৌঁছে দেওয়া হবে।"
                    : "Confirming will notify community blood donors."}
                </span>

                <button
                  onClick={handleConfirmAndSubmit}
                  disabled={confirming || !currentResponse.is_ready_for_review}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      <span>{isBn ? "পোস্ট হচ্ছে..." : "Publishing..."}</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isBn ? "নিশ্চিত ও পোস্ট করুন" : "Confirm & Post Request"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input & Preset Suggestion Bar */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/70 border-t border-zinc-200 dark:border-zinc-800 space-y-2 shrink-0">
          {/* Quick chip suggestions if message list is short */}
          {messages.length <= 2 && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              <button
                type="button"
                onClick={() =>
                  handleSendMessage(
                    isBn
                      ? "মিরপুরে বাস ও রিকশা সংঘর্ষ হয়েছে, দুজন আহত"
                      : "Bus and rickshaw collision near Mirpur 10, two injured"
                  )
                }
                className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 hover:border-blue-500 text-[11px] transition flex items-center gap-1"
              >
                <CarFront className="h-3 w-3 text-slate-400" aria-hidden="true" />
                <span>{isBn ? "মিরপুরে বাস দুর্ঘটনা" : "Bus collision in Mirpur"}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSendMessage(
                    isBn
                      ? "আমার বাবার B+ রক্ত লাগবে ঢাকা মেডিকেল ২ ব্যাগ, ফোন 01712345678"
                      : "My father needs two bags of B+ blood tonight at Dhaka Medical, contact: 01712345678"
                  )
                }
                className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 hover:border-rose-500 text-[11px] transition flex items-center gap-1"
              >
                <Droplet className="h-3 w-3 text-rose-500" aria-hidden="true" />
                <span>{isBn ? "বি+ রক্ত জরুরি লাগবে" : "Need B+ Blood (2 bags)"}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSendMessage(
                    isBn ? "ধানমন্ডিতে বৈদ্যুতিক তারে আগুন লেগেছে" : "Electrical wire caught fire near Dhanmondi"
                  )
                }
                className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 hover:border-amber-500 text-[11px] transition flex items-center gap-1"
              >
                <Flame className="h-3 w-3 text-slate-400" aria-hidden="true" />
                <span>{isBn ? "ধানমন্ডিতে আগুন" : "Fire in Dhanmondi"}</span>
              </button>
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
                  ? "আপনার সমস্যা লিখুন (যেমন: 'ধানমন্ডি ২৭ এ দুর্ঘটনা...' বা 'B+ রক্ত লাগবে...')..."
                  : "Describe emergency (e.g. 'Accident at Mirpur...' or 'Need B+ blood...')..."
              }
              className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={sending || confirming}
            />
            <button
              type="button"
              onClick={() => setIsVoiceOpen(true)}
              title={isBn ? "ভয়েস দিয়ে বলুন" : "Speak with Voice Assistant"}
              className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 transition cursor-pointer shrink-0"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="submit"
              disabled={!inputValue.trim() || sending || confirming}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow transition disabled:opacity-40 shrink-0 flex items-center gap-1"
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

      <AIVoiceEmergencyModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onApplyDraft={onApplyDraft}
        categories={categories}
        currentLatitude={currentLatitude}
        currentLongitude={currentLongitude}
        currentLocationText={currentLocationText}
      />
    </div>
  );
}
