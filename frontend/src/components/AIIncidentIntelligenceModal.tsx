"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  Sparkles,
  Send,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  MapPin,
  Calendar,
  User as UserIcon,
  CopyCheck,
  BarChart3,
  HelpCircle,
  Loader2,
  Shield,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  ChatMessage,
  IncidentIntelligenceResponse,
  ReportItemResult,
  SearchIncidentReportsOutput,
  GetIncidentSummaryOutput,
  AnalyzeIncidentReportOutput,
  FindPossibleDuplicatesOutput,
  PrepareReportReviewOutput,
} from "@/lib/types";
import { useBackClose } from "@/lib/useBackClose";
import { Language } from "@/lib/i18n";

interface AIIncidentIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReportId?: string;
  initialCategory?: string;
  initialLocation?: string;
}

interface HistoryItem {
  role: "user" | "assistant";
  content: string;
  responsePayload?: IncidentIntelligenceResponse;
}

export default function AIIncidentIntelligenceModal({
  isOpen,
  onClose,
  initialReportId,
}: AIIncidentIntelligenceModalProps) {
  const [lang, setLang] = useState<Language>("en");
  const [messages, setMessages] = useState<HistoryItem[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  // Android back-button handling & ESC key
  useBackClose(isOpen, onClose, "aiIncidentIntelligenceModal");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Initialize conversation on open
  useEffect(() => {
    if (isOpen) {
      const newConvId = `conv-inc-${Date.now()}`;
      setConversationId(newConvId);
      setErrorMessage(null);

      const welcomeEn = initialReportId
        ? `Hello! I am Nirapotta's Incident Intelligence Agent. You are viewing report #${initialReportId.slice(0, 8)}. Would you like me to analyze its verified facts, check for duplicates, or summarize similar regional incidents?`
        : "Hello! I am Nirapotta's Incident Intelligence Agent. I can search verified reports across Bangladesh, analyze incident facts, discover duplicate reports, and provide grounded regional safety summaries.";

      const welcomeBn = initialReportId
        ? `নমস্কার! আমি নিরাপত্তা ইনসিডেন্ট ইন্টেলিজেন্স সহকারী। আপনি রিপোর্ট #${initialReportId.slice(0, 8)} পর্যবেক্ষণ করছেন। আপনি কি এই রিপোর্টের সত্যতা বিশ্লেষণ, সম্ভাব্য ডুপ্লিকেট যাচাই বা সংশ্লিষ্ট এলাকার সারসংক্ষেপ দেখতে চান?`
        : "নমস্কার! আমি নিরাপত্তা ইনসিডেন্ট ইন্টেলিজেন্স সহকারী। আমি ডাটাবেস থেকে নাগরিক নিরাপত্তা রিপোর্ট অনুসন্ধান, তথ্যের সত্যতা বিশ্লেষণ, ডুপ্লিকেট রিপোর্ট শনাক্তকরণ এবং এলাকার নিরাপত্তা সারসংক্ষেপ প্রদানে সহায়তা করতে পারি।";

      setMessages([
        {
          role: "assistant",
          content: lang === "bn" ? welcomeBn : welcomeEn,
        },
      ]);
    }
  }, [isOpen, initialReportId, lang]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || sending) return;

    setInputValue("");
    setErrorMessage(null);

    const userMsg: HistoryItem = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      // Map prior messages into simple ChatMessage format for context
      const chatHistory: ChatMessage[] = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const payload = {
        message: text,
        conversation_id: conversationId,
        report_id: initialReportId || null,
        history: chatHistory,
        lang,
      };

      const res = await apiFetch<IncidentIntelligenceResponse>(
        "/reports/ai-assistant/incident-intelligence",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      const botMsg: HistoryItem = {
        role: "assistant",
        content: res.reply,
        responsePayload: res,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error("Incident Intelligence error:", err);
      const errText =
        lang === "bn"
          ? "অনুরোধটি সম্পন্ন করা সম্ভব হয়নি। অনুগ্রহ করে কিছুক্ষণ পর পুনরায় চেষ্টা করুন।"
          : "Failed to process your request. Please check your network and try again.";
      setErrorMessage(err?.detail || errText);
    } finally {
      setSending(false);
    }
  };

  const handleChipClick = (promptText: string) => {
    handleSendMessage(promptText);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl h-[92vh] max-h-[820px] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-purple-950/80 border border-purple-800/60 text-purple-400 shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-zinc-100">
                  {lang === "bn" ? "ইনসিডেন্ট ইন্টেলিজেন্স সহকারী" : "Incident Intelligence Agent"}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-950 text-purple-300 border border-purple-800/40">
                  Phase C
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {lang === "bn"
                  ? "ডাটাবেস-যাচাইকৃত রিপোর্ট অনুসন্ধান, বিশ্লেষণ ও সারসংক্ষেপ"
                  : "Database-grounded search, factual analysis & duplicate discovery"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Conversation Thread */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="h-8 w-8 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div className={`max-w-[88%] space-y-3 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {/* Text Bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-purple-700 text-white rounded-br-xs"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-xs"
                  }`}
                >
                  {msg.content}
                </div>

                {/* Structured Payload Renderers */}
                {msg.responsePayload && (
                  <div className="space-y-3 pt-1">
                    {/* 1. Search Results List */}
                    {msg.responsePayload.search_results && (
                      <SearchResultsCard
                        results={msg.responsePayload.search_results}
                        lang={lang}
                        onSelectReport={(rId) => handleSendMessage(`Analyze report ${rId}`)}
                        onFindDuplicates={(rId) => handleSendMessage(`Find duplicate reports for ${rId}`)}
                      />
                    )}

                    {/* 2. Incident Summary Card */}
                    {msg.responsePayload.summary && (
                      <SummaryCard summary={msg.responsePayload.summary} lang={lang} />
                    )}

                    {/* 3. Report Analysis Breakdown Card */}
                    {msg.responsePayload.analysis && (
                      <AnalysisCard analysis={msg.responsePayload.analysis} lang={lang} />
                    )}

                    {/* 4. Candidate Duplicates Card */}
                    {msg.responsePayload.duplicate_candidates && (
                      <DuplicatesCard duplicates={msg.responsePayload.duplicate_candidates} lang={lang} />
                    )}

                    {/* 5. Moderation Review Preview Card */}
                    {msg.responsePayload.review_preview && (
                      <ReviewPreviewCard review={msg.responsePayload.review_preview} lang={lang} />
                    )}

                    {/* 6. Clarification Options */}
                    {msg.responsePayload.is_clarification_needed && (
                      <div className="bg-zinc-900/90 border border-purple-900/40 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
                          <HelpCircle className="h-4 w-4 text-purple-400" />
                          <span>{msg.responsePayload.follow_up_question}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {[
                            lang === "bn" ? "সাভারে অপরাধের রিপোর্ট" : "Crime in Savar",
                            lang === "bn" ? "মিরপুরের জননিরাপত্তা পরিস্থিতি" : "Public Safety in Mirpur",
                            lang === "bn" ? "ঢাকার রিপোর্টগুলোর সারসংক্ষেপ" : "Summary for Dhaka",
                            lang === "bn" ? "ডুপ্লিকেট রিপোর্ট চেক" : "Check Duplicate Reports",
                          ].map((chip, cIdx) => (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => handleChipClick(chip)}
                              className="px-2.5 py-1 text-xs rounded-xl bg-purple-950/70 border border-purple-800/50 text-purple-200 hover:bg-purple-900 transition cursor-pointer"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="h-8 w-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400 shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-bl-xs px-4 py-3 text-xs text-zinc-400 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                <span>
                  {lang === "bn"
                    ? "ডাটাবেস রেকর্ড অনুসন্ধান ও বিশ্লেষণ চলছে..."
                    : "Querying authenticated records & analyzing factual data..."}
                </span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-xs text-red-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
          <span className="text-zinc-500 font-medium shrink-0 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-purple-400" />
            {lang === "bn" ? "প্রস্তাবনা:" : "Suggestions:"}
          </span>
          {[
            lang === "bn" ? "সাভারে অপরাধের রিপোর্ট" : "Crime in Savar",
            lang === "bn" ? "মিরপুরের জননিরাপত্তা পরিস্থিতি" : "Public Safety in Mirpur",
            lang === "bn" ? "ঢাকার রিপোর্টগুলোর সারসংক্ষেপ" : "Summary for Dhaka",
            lang === "bn" ? "সম্ভাব্য ডুপ্লিকেট খুঁজুন" : "Find duplicate reports",
          ].map((prompt, pIdx) => (
            <button
              key={pIdx}
              type="button"
              onClick={() => handleChipClick(prompt)}
              className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition whitespace-nowrap cursor-pointer shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 border-t border-zinc-800 bg-zinc-900/90 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              lang === "bn"
                ? "রিপোর্ট খুঁজুন বা প্রশ্ন লিখুন (বাংলা বা ইংরেজিতে)..."
                : "Ask about incidents, search locations, or analyze reports..."
            }
            disabled={sending}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !inputValue.trim()}
            className="h-10 w-10 rounded-xl bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label="Send message"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Search Results Card Component
// ---------------------------------------------------------------------------

function SearchResultsCard({
  results,
  lang,
  onSelectReport,
  onFindDuplicates,
}: {
  results: SearchIncidentReportsOutput;
  lang: Language;
  onSelectReport: (id: string) => void;
  onFindDuplicates: (id: string) => void;
}) {
  if (results.reports.length === 0) {
    return (
      <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
        {lang === "bn"
          ? "ডাটাবেসে কোনো রেকর্ড পাওয়া যায়নি।"
          : "No reports found matching the specified parameters."}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
        <span>
          {lang === "bn" ? "অনুসন্ধান ফলাফল:" : "Matching Database Reports:"} {results.total_found}{" "}
          {lang === "bn" ? "টি" : "total"}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-[10px]">
          DB Grounded
        </span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {results.reports.map((r: ReportItemResult) => (
          <div
            key={r.id}
            className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition space-y-2 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-zinc-100 line-clamp-1">{r.title}</h4>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                  r.is_verified
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800/50"
                    : "bg-amber-950 text-amber-300 border border-amber-800/50"
                }`}
              >
                {r.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-purple-400" />
                {r.location_text}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3 text-zinc-500" />
                {new Date(r.created_at).toLocaleDateString()}
              </span>
              <span className="inline-flex items-center gap-1">
                <UserIcon className="h-3 w-3 text-zinc-500" />
                {r.reporter_name}
              </span>
            </div>

            <p className="text-[11px] text-zinc-400 line-clamp-2">{r.summary}</p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onSelectReport(r.id)}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-purple-950 text-purple-200 border border-purple-800/40 hover:bg-purple-900 transition cursor-pointer flex items-center gap-1"
              >
                <FileText className="h-3 w-3" />
                <span>{lang === "bn" ? "বিশ্লেষণ করুন" : "Analyze Facts"}</span>
              </button>
              <button
                type="button"
                onClick={() => onFindDuplicates(r.id)}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition cursor-pointer flex items-center gap-1"
              >
                <CopyCheck className="h-3 w-3" />
                <span>{lang === "bn" ? "ডুপ্লিকেট চেক" : "Check Duplicates"}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Incident Summary Card Component
// ---------------------------------------------------------------------------

function SummaryCard({ summary, lang }: { summary: GetIncidentSummaryOutput; lang: Language }) {
  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2 font-semibold text-zinc-200">
          <BarChart3 className="h-4 w-4 text-purple-400" />
          <span>{lang === "bn" ? "ডাটাবেস সারসংক্ষেপ" : "Database Incident Summary"}</span>
        </div>
        {summary.date_range && (
          <span className="text-[10px] text-zinc-500">{summary.date_range}</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
          <span className="text-[10px] text-zinc-500 block">
            {lang === "bn" ? "মোট রিপোর্ট" : "Total Reports"}
          </span>
          <span className="text-base font-bold text-zinc-100">{summary.total_reports}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
          <span className="text-[10px] text-emerald-400 block">
            {lang === "bn" ? "যাচাইকৃত" : "Verified"}
          </span>
          <span className="text-base font-bold text-emerald-400">{summary.verified_count}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
          <span className="text-[10px] text-amber-400 block">
            {lang === "bn" ? "পর্যালোচনাধীন" : "In Review"}
          </span>
          <span className="text-base font-bold text-amber-400">{summary.unverified_count}</span>
        </div>
      </div>

      {Object.keys(summary.by_category).length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-zinc-400 block">
            {lang === "bn" ? "ক্যাটাগরি ভিত্তিক সংখ্যা:" : "Category Distribution:"}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(summary.by_category).map(([cat, cnt]) => (
              <span
                key={cat}
                className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-300 text-[11px]"
              >
                {cat}: <strong className="text-zinc-100">{cnt}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-800/80 pt-2 italic">
        {summary.summary_narrative}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Report Analysis Breakdown Card Component
// ---------------------------------------------------------------------------

function AnalysisCard({ analysis, lang }: { analysis: AnalyzeIncidentReportOutput; lang: Language }) {
  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3.5 text-xs">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-purple-400" />
          <h4 className="font-semibold text-zinc-100">{analysis.title || "Report Analysis"}</h4>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-950 text-purple-300 border border-purple-800/40">
          Confidence: {Math.round(analysis.confidence_score * 100)}%
        </span>
      </div>

      {/* Verified Ground Truth */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          {lang === "bn" ? "ডাটাবেস সত্যতা (Verified Facts):" : "Verified Facts (DB Ground Truth):"}
        </span>
        <ul className="space-y-1 pl-1">
          {analysis.verified_facts.map((fact, idx) => (
            <li key={idx} className="text-zinc-300 flex items-start gap-1.5 text-[11px]">
              <span className="text-emerald-500 font-bold">•</span>
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Missing or Incomplete Details */}
      {analysis.missing_or_incomplete_info.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            {lang === "bn" ? "অনুপস্থিত বা অপর্যাপ্ত তথ্য:" : "Missing / Incomplete Information:"}
          </span>
          <ul className="space-y-1 pl-1">
            {analysis.missing_or_incomplete_info.map((gap, idx) => (
              <li key={idx} className="text-zinc-400 flex items-start gap-1.5 text-[11px]">
                <span className="text-amber-500 font-bold">•</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Safety Concerns */}
      {analysis.safety_concerns.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider block flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-red-400" />
            {lang === "bn" ? "নিরাপত্তা উদ্বেগের কারণ:" : "Safety Concerns & Civic Impact:"}
          </span>
          <ul className="space-y-1 pl-1">
            {analysis.safety_concerns.map((concern, idx) => (
              <li key={idx} className="text-zinc-300 flex items-start gap-1.5 text-[11px]">
                <span className="text-red-500 font-bold">•</span>
                <span>{concern}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Interpretation (Labeled) */}
      <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-900/40 space-y-1">
        <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider block">
          AI Advisory Interpretation
        </span>
        <p className="text-[11px] text-purple-200/90 leading-relaxed">
          {analysis.ai_interpretation}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Candidate Duplicates Card Component
// ---------------------------------------------------------------------------

function DuplicatesCard({
  duplicates,
  lang,
}: {
  duplicates: FindPossibleDuplicatesOutput;
  lang: Language;
}) {
  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2 font-semibold text-zinc-100">
          <CopyCheck className="h-4 w-4 text-purple-400" />
          <span>
            {lang === "bn"
              ? `সম্ভাব্য ডুপ্লিকেট রিপোর্ট (${duplicates.total_candidates} টি)`
              : `Candidate Duplicate Reports (${duplicates.total_candidates})`}
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800/40">
          Advisory Only
        </span>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {duplicates.candidate_duplicates.map((c) => (
          <div
            key={c.report_id}
            className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <h5 className="font-medium text-zinc-200 line-clamp-1">{c.title}</h5>
              <span className="px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 font-mono text-[10px] shrink-0 font-bold">
                {Math.round(c.similarity_score * 100)}% match
              </span>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <span>{c.category_name}</span>
              <span>•</span>
              <span>{c.location_text}</span>
              <span>•</span>
              <span className="uppercase">{c.status}</span>
            </div>

            <div className="pt-1 text-[11px] text-zinc-400">
              <span className="text-zinc-500 font-medium">
                {lang === "bn" ? "সাদৃশ্যের কারণ:" : "Matching Factors:"}
              </span>{" "}
              {c.similarity_reasons.join("; ")}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-zinc-500 italic border-t border-zinc-800/80 pt-2">
        {duplicates.safe_notice}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Moderation Review Preview Card Component
// ---------------------------------------------------------------------------

function ReviewPreviewCard({
  review,
  lang,
}: {
  review: PrepareReportReviewOutput;
  lang: Language;
}) {
  if (!review.is_authorized) {
    return (
      <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-800/40 text-xs text-red-300">
        {review.error_message || "Moderator preview restricted to authorized safety staff."}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-purple-900/50 space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2 font-semibold text-zinc-100">
          <Shield className="h-4 w-4 text-purple-400" />
          <span>{lang === "bn" ? "মডারেশন রিভিউ প্রিভিউ" : "Moderator Review Preview"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800/50">
            {review.suggested_action}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/50">
            {review.suggested_priority}
          </span>
        </div>
      </div>

      {/* Verification Checklist */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-zinc-300 block">
          {lang === "bn" ? "যাচাইকরণ চেকলিস্ট:" : "Verification Criteria Checklist:"}
        </span>
        <div className="space-y-1">
          {review.checklist.map((chk, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-zinc-950 text-[11px]"
            >
              <div className="flex items-center gap-2">
                {chk.passed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                )}
                <span className="text-zinc-200">{chk.criterion}</span>
              </div>
              <span className="text-[10px] text-zinc-400">{chk.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Rationale */}
      <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/30 space-y-1">
        <span className="text-[10px] font-bold text-purple-300 uppercase">
          AI Moderation Rationale
        </span>
        <p className="text-[11px] text-purple-200/90 leading-relaxed">{review.ai_reasoning}</p>
      </div>

      <p className="text-[10px] text-zinc-500 italic border-t border-zinc-800/80 pt-2">
        {review.disclaimer}
      </p>
    </div>
  );
}
