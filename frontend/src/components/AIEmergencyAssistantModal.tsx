"use client";

import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  ChatMessage,
  EmergencyAssistantResponse,
  DraftReportPreview,
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
  const [lang, setLang] = useState<Language>("en");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [currentResponse, setCurrentResponse] = useState<EmergencyAssistantResponse | null>(null);
  const [conversationId, setConversationId] = useState<string>("");
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
            ? "আসসালামু আলাইকুম। আপনি কি কোনো জরুরি দুর্ঘটনা বা বিপদের প্রত্যক্ষদর্শী? আপনার ভাষায় ঘটনাটি সংক্ষেপে বলুন (যেমন: 'ধানমন্ডি ২৭ এ মোটরসাইকেল দুর্ঘটনা ঘটেছে, একজন আহত')।"
            : "Hello. Did you witness an emergency or hazard? Please describe what happened in your own words (e.g., 'Motorcycle accident near Dhanmondi 27, one person injured').",
        },
      ]);
    }
  }, [isOpen, messages.length, isBn]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputValue;
    if (!textToSend.trim() || sending) return;

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
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isBn
            ? "দুঃখিত, সংযোগে বিঘ্ন ঘটেছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন অথবা সরাসরি ফর্ম পূরণ করুন।"
            : "Connection error. Please try again or fill in the report manually.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleApply = () => {
    if (currentResponse?.draft_report) {
      onApplyDraft(currentResponse.draft_report);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[720px]">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold leading-tight flex items-center gap-1.5">
                <span>{isBn ? "এআই জরুরি রিপোর্টিং সহকারী" : "AI Emergency Assistant"}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/40 text-blue-100 font-semibold">
                  NLP
                </span>
              </h3>
              <p className="text-[11px] text-blue-100/80">
                {isBn ? "স্বাভাবিক ভাষায় বলুন, খসড়া রিপোর্ট তৈরি হবে" : "Speak naturally in Bangla or English"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              className="p-1 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
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
                : "In life-threatening danger, dial National Emergency 999 directly."}
            </span>
          </span>
          <a href="tel:999" className="font-bold underline text-red-800 dark:text-red-200 shrink-0 ml-2">
            {isBn ? "কল ৯৯৯" : "Call 999"}
          </a>
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
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>{isBn ? "এআই তথ্য বিশ্লেষণ করছে..." : "AI analyzing report details..."}</span>
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

          {/* Draft Report Card Preview */}
          {currentResponse?.draft_report && (
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-b from-emerald-50 to-teal-50/40 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-600 text-white uppercase tracking-wider">
                  {isBn ? "প্রস্তুতকৃত খসড়া রিপোর্ট" : "Structured Draft Report"}
                </span>
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
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

              <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-between gap-3">
                <span className="text-[11px] text-zinc-500">
                  {isBn
                    ? "রিপোর্টে যুক্ত করার পর জমা দেওয়ার পূর্বে যাচাই করতে পারবেন।"
                    : "Review & edit before final submission."}
                </span>
                <button
                  onClick={handleApply}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isBn ? "রিপোর্টে প্রয়োগ করুন" : "Apply to Report"}</span>
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
                onClick={() => handleSendMessage(isBn ? "মিরপুরে বাস ও রিকশা সংঘর্ষ হয়েছে, দুজন আহত" : "Bus and rickshaw collision near Mirpur, two injured")}
                className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 hover:border-blue-500 text-[11px] transition flex items-center gap-1"
              >
                <CarFront className="h-3 w-3 text-slate-400" aria-hidden="true" />
                <span>{isBn ? "মিরপুরে বাস সংঘর্ষ" : "Bus collision near Mirpur"}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage(isBn ? "ধানমন্ডিতে বৈদ্যুতিক তারে আগুন লেগেছে" : "Electrical wire caught fire near Dhanmondi")}
                className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 hover:border-blue-500 text-[11px] transition flex items-center gap-1"
              >
                <Flame className="h-3 w-3 text-slate-400" aria-hidden="true" />
                <span>{isBn ? "ধানমন্ডিতে বৈদ্যুতিক আগুন" : "Electrical fire in Dhanmondi"}</span>
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
              placeholder={isBn ? "ঘটনার বিবরণ লিখুন (যেমন: 'উত্তরায় সড়ক দুর্ঘটনা...')..." : "Describe emergency (e.g., 'Accident at Uttara...')..."}
              className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || sending}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow transition disabled:opacity-40 shrink-0"
            >
              {isBn ? "পাঠান" : "Send"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
