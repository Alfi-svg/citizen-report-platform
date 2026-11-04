"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  X,
  Send,
  Loader2,
  Droplet,
  Activity,
  Check,
  HelpCircle,
  Clock,
  MapPin,
  User as UserIcon,
  AlertOctagon,
  Shield,
  BarChart3,
  Calendar,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  ChatMessage,
  AdminCopilotResponse,
  AdminCopilotConfirmResponse,
  ModerationActionPreview,
  SearchModerationReportsOutput,
  GetModerationReportOutput,
  GetModerationSummaryOutput,
  SearchBloodRequestsAdminOutput,
  PlatformActivitySummaryOutput,
  RecentModerationActivityOutput,
  OperationalAttentionOutput,
  ReportItemResult,
} from "@/lib/types";
import { useBackClose } from "@/lib/useBackClose";
import { Language } from "@/lib/i18n";

interface AdminCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReportId?: string;
  onActionExecuted?: () => void;
}

interface CopilotHistoryItem {
  role: "user" | "assistant";
  content: string;
  responsePayload?: AdminCopilotResponse;
  confirmedResult?: AdminCopilotConfirmResponse;
}

export default function AdminCopilotModal({
  isOpen,
  onClose,
  initialReportId,
  onActionExecuted,
}: AdminCopilotModalProps) {
  const [lang, setLang] = useState<Language>("en");
  const [messages, setMessages] = useState<CopilotHistoryItem[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<ModerationActionPreview | null>(null);
  const [customUserMessage, setCustomUserMessage] = useState<string>("");
  const [customInternalNotes, setCustomInternalNotes] = useState<string>("");
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

  // Back button and ESC close handling
  useBackClose(isOpen, onClose, "adminCopilotModal");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Initialize conversation
  useEffect(() => {
    if (isOpen) {
      const newConvId = `conv-adm-${Date.now()}`;
      setConversationId(newConvId);
      setErrorMessage(null);
      setPendingPreview(null);

      const welcomeEn = initialReportId
        ? `Hello! I am your Admin & Moderator Copilot. Report #${initialReportId.slice(0, 8)} is in context. Would you like me to inspect its details, prepare a moderation review, or prepare an approval/rejection action?`
        : "Hello Moderator! I am your Admin & Moderator Copilot. I can inspect the moderation queue, detect operational bottlenecks, summarize platform metrics, and prepare safe moderation actions requiring your confirmation.";

      const welcomeBn = initialReportId
        ? `নমস্কার! আমি অ্যাডমিন ও মডারেটর কপাইলট। রিপোর্ট #${initialReportId.slice(0, 8)} পর্যালোচনার জন্য প্রস্তুত। আপনি কি এই রিপোর্টের বিশদ তথ্য, চেকলিস্ট বা অনুমোদন/বাতিল অ্যাকশন প্রস্তুত করতে চান?`
        : "নমস্কার মডারেটর! আমি অ্যাডমিন ও মডারেটর কপাইলট। আমি অপেক্ষমাণ মডারেশন সারি পর্যবেক্ষণ, জরুরি অপারেশনাল সমস্যা শনাক্তকরণ, পরিসংখ্যান উপস্থাপন এবং অনুমোদন/বাতিল অ্যাকশন প্রস্তুতিতে সহায়তা করতে পারি।";

      setMessages([
        {
          role: "assistant",
          content: lang === "bn" ? welcomeBn : welcomeEn,
        },
      ]);
    }
  }, [isOpen, initialReportId, lang]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, confirming]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || sending) return;

    setInputValue("");
    setErrorMessage(null);

    const userMsg: CopilotHistoryItem = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
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

      const res = await apiFetch<AdminCopilotResponse>(
        "/admin/ai-assistant/copilot",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      // If an action preview is returned, register it for human confirmation
      if (res.action_preview) {
        setPendingPreview(res.action_preview);
        setCustomUserMessage(res.action_preview.details?.user_message || "");
        setCustomInternalNotes(res.action_preview.details?.internal_notes || "");
      }

      const botMsg: CopilotHistoryItem = {
        role: "assistant",
        content: res.reply,
        responsePayload: res,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error("Admin Copilot error:", err);
      const errText =
        lang === "bn"
          ? "কপাইলট অনুরোধ সম্পন্ন করতে ব্যর্থ হয়েছে। অনুমতি বা নেটওয়ার্ক যাচাই করুন।"
          : "Failed to process Copilot request. Verify moderator permissions or network.";
      setErrorMessage(err?.detail || errText);
    } finally {
      setSending(false);
    }
  };

  const handleConfirmAction = async (preview: ModerationActionPreview) => {
    if (confirming) return;
    setConfirming(true);
    setErrorMessage(null);

    try {
      const confirmPayload = {
        conversation_id: conversationId,
        confirmation_token: preview.confirmation_token,
        action_type: preview.action_type,
        target_record_id: preview.target_record_id,
        user_message: customUserMessage || preview.details?.user_message,
        internal_notes: customInternalNotes || preview.details?.internal_notes,
      };

      const result = await apiFetch<AdminCopilotConfirmResponse>(
        "/admin/ai-assistant/copilot/confirm",
        {
          method: "POST",
          body: JSON.stringify(confirmPayload),
        }
      );

      setPendingPreview(null);

      const confirmMsg: CopilotHistoryItem = {
        role: "assistant",
        content: result.message,
        confirmedResult: result,
      };

      setMessages((prev) => [...prev, confirmMsg]);

      if (onActionExecuted) {
        onActionExecuted();
      }
    } catch (err: any) {
      console.error("Action confirmation failure:", err);
      setErrorMessage(err?.detail || "Action execution failed. Re-verification required.");
    } finally {
      setConfirming(false);
    }
  };

  const handleCancelAction = () => {
    setPendingPreview(null);
    const cancelMsg: CopilotHistoryItem = {
      role: "assistant",
      content: lang === "bn" ? "প্রস্তাবিত অ্যাকশন বাতিল করা হয়েছে।" : "Action preparation cancelled by moderator.",
    };
    setMessages((prev) => [...prev, cancelMsg]);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl h-[94vh] max-h-[860px] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-amber-950/80 border border-amber-800/60 text-amber-400 shadow-inner">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-zinc-100">
                  {lang === "bn" ? "অ্যাডমিন ও মডারেটর কপাইলট" : "Admin & Moderator Copilot"}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800/40">
                  Phase D • Staff Only
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {lang === "bn"
                  ? "অপারেশনাল ইন্টেলিজেন্স, কিউ ম্যানেজমেন্ট ও হিউম্যান-ইন-দ্য-লুপ মডারেশন"
                  : "Database-grounded operational intelligence & human-controlled moderation"}
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

        {/* Scrollable Conversation */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="h-8 w-8 rounded-xl bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div className={`max-w-[88%] space-y-3 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-amber-700 text-white rounded-br-xs"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-xs"
                  }`}
                >
                  {msg.content}
                </div>

                {/* Structured Payload Renderers */}
                {msg.responsePayload && (
                  <div className="space-y-3 pt-1">
                    {/* 1. Reports Queue Results */}
                    {msg.responsePayload.reports_result && (
                      <ModerationReportsCard
                        results={msg.responsePayload.reports_result}
                        lang={lang}
                        onInspect={(rId) => handleSendMessage(`Inspect report ${rId}`)}
                        onReview={(rId) => handleSendMessage(`Review report ${rId}`)}
                        onApprove={(rId) => handleSendMessage(`Approve report ${rId}`)}
                        onReject={(rId) => handleSendMessage(`Reject report ${rId}`)}
                      />
                    )}

                    {/* 2. Platform Activity Overview */}
                    {msg.responsePayload.platform_activity && (
                      <PlatformActivityCard activity={msg.responsePayload.platform_activity} lang={lang} />
                    )}

                    {/* 3. Operational Attention Items */}
                    {msg.responsePayload.attention_items && (
                      <AttentionItemsCard
                        attention={msg.responsePayload.attention_items}
                        lang={lang}
                        onActOnItem={(rId) => handleSendMessage(`Inspect report ${rId}`)}
                      />
                    )}

                    {/* 4. Moderation Summary */}
                    {msg.responsePayload.moderation_summary && (
                      <ModerationSummaryCard summary={msg.responsePayload.moderation_summary} lang={lang} />
                    )}

                    {/* 5. Blood Requests Queue */}
                    {msg.responsePayload.blood_requests_result && (
                      <BloodRequestsCard requests={msg.responsePayload.blood_requests_result} lang={lang} />
                    )}

                    {/* 6. Recent Moderation Activity */}
                    {msg.responsePayload.recent_activity && (
                      <RecentActivityCard activity={msg.responsePayload.recent_activity} lang={lang} />
                    )}

                    {/* 7. Single Report Details */}
                    {msg.responsePayload.report_details && (
                      <ReportDetailsCard
                        report={msg.responsePayload.report_details}
                        lang={lang}
                        onApprove={(rId) => handleSendMessage(`Approve report ${rId}`)}
                        onReject={(rId) => handleSendMessage(`Reject report ${rId}`)}
                        onRequestInfo={(rId) => handleSendMessage(`Request more info for report ${rId}`)}
                      />
                    )}

                    {/* 8. Clarification Prompt */}
                    {msg.responsePayload.is_clarification_needed && (
                      <div className="bg-zinc-900/90 border border-amber-900/40 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                          <HelpCircle className="h-4 w-4 text-amber-400" />
                          <span>{msg.responsePayload.follow_up_question}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {[
                            lang === "bn" ? "অপেক্ষমাণ রিপোর্ট সারি" : "Pending reports queue",
                            lang === "bn" ? "জরুরি অপারেশনাল সমস্যা" : "Operational attention items",
                            lang === "bn" ? "প্ল্যাটফর্ম কার্যক্রম সারসংক্ষেপ" : "Platform activity summary",
                            lang === "bn" ? "উন্মুক্ত রক্তের আবেদনসমূহ" : "Open blood requests",
                          ].map((chip, cIdx) => (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => handleSendMessage(chip)}
                              className="px-2.5 py-1 text-xs rounded-xl bg-amber-950/70 border border-amber-800/50 text-amber-200 hover:bg-amber-900 transition cursor-pointer"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Confirmed Result Banner */}
                {msg.confirmedResult && (
                  <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/50 space-y-1 text-xs text-emerald-300">
                    <div className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>Action Confirmed & Executed</span>
                    </div>
                    <p className="text-[11px] text-emerald-200/90">
                      Target #{msg.confirmedResult.record_id.slice(0, 8)} transitioned to{" "}
                      <strong>{msg.confirmedResult.new_status}</strong>. Audit record committed.
                    </p>
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

          {/* Active Action Confirmation Card (Human-in-the-Loop) */}
          {pendingPreview && (
            <div className="p-4 rounded-3xl bg-amber-950/30 border-2 border-amber-600/70 space-y-3.5 shadow-xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-amber-800/40 pb-2.5">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5 text-amber-400" />
                  <h4 className="font-bold text-amber-200 text-sm">
                    {lang === "bn" ? "অ্যাকশন কনফার্মেশন প্রয়োজন" : "Human Action Confirmation Required"}
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700/60 font-mono">
                  {pendingPreview.action_type}
                </span>
              </div>

              <div className="space-y-1 text-xs text-zinc-200">
                <div className="font-semibold text-zinc-100">{pendingPreview.target_title}</div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span>Record ID: #{pendingPreview.target_record_id.slice(0, 8)}</span>
                  <span>•</span>
                  <span>
                    Status Transition:{" "}
                    <strong className="text-zinc-300">{pendingPreview.current_status}</strong> →{" "}
                    <strong className="text-emerald-400">{pendingPreview.proposed_status}</strong>
                  </span>
                </div>
                <div className="text-[11px] text-amber-200/90 pt-1">
                  <strong>Recommendation Rationale:</strong> {pendingPreview.reason}
                </div>
              </div>

              {/* Editable user message input */}
              <div className="space-y-1 pt-1">
                <label className="text-[10px] font-semibold text-zinc-400 block">
                  Citizen Message (Visible to Report Owner):
                </label>
                <input
                  type="text"
                  value={customUserMessage}
                  onChange={(e) => setCustomUserMessage(e.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Editable internal notes input */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-zinc-400 block">
                  Confidential Internal Notes (Staff Only):
                </label>
                <input
                  type="text"
                  value={customInternalNotes}
                  onChange={(e) => setCustomInternalNotes(e.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-amber-800/40">
                <button
                  type="button"
                  onClick={handleCancelAction}
                  disabled={confirming}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
                >
                  {lang === "bn" ? "বাতিল করুন" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmAction(pendingPreview)}
                  disabled={confirming}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {confirming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span>
                    {confirming
                      ? "Executing..."
                      : lang === "bn"
                      ? "অ্যাকশন নিশ্চিত করুন (Confirm)"
                      : "Confirm Action"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {sending && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-xl bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-bl-xs px-4 py-3 text-xs text-zinc-400 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                <span>
                  {lang === "bn"
                    ? "ডাটাবেস অনুসন্ধান ও অ্যানালাইসিস চলছে..."
                    : "Executing controlled tool & analyzing database state..."}
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

        {/* Suggestion Chips */}
        <div className="px-4 py-2 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
          <span className="text-zinc-500 font-medium shrink-0 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-400" />
            {lang === "bn" ? "প্রস্তাবনা:" : "Suggestions:"}
          </span>
          {[
            lang === "bn" ? "অপেক্ষমাণ রিপোর্ট কিউ" : "Show reports waiting for review",
            lang === "bn" ? "জরুরি অপারেশনাল সমস্যা" : "Identify operational attention items",
            lang === "bn" ? "প্ল্যাটফর্ম কার্যক্রম সারসংক্ষেপ" : "Platform activity summary",
            lang === "bn" ? "উন্মুক্ত রক্তের আবেদন" : "Show open blood requests",
            lang === "bn" ? "সাম্প্রতিক মডারেশন কার্যক্রম" : "Show recent moderation activity",
          ].map((prompt, pIdx) => (
            <button
              key={pIdx}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition whitespace-nowrap cursor-pointer shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Form */}
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
                ? "মডারেশন সংক্রান্ত প্রশ্ন বা কমান্ড লিখুন (বাংলা বা ইংরেজিতে)..."
                : "Ask copilot to search reports, summarize activity, or prepare review..."
            }
            disabled={sending}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !inputValue.trim()}
            className="h-10 w-10 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white flex items-center justify-center transition cursor-pointer shrink-0"
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
// 1. Moderation Reports Card
// ---------------------------------------------------------------------------

function ModerationReportsCard({
  results,
  lang,
  onInspect,
  onReview,
  onApprove,
  onReject,
}: {
  results: SearchModerationReportsOutput;
  lang: Language;
  onInspect: (id: string) => void;
  onReview: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (results.reports.length === 0) {
    return (
      <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
        {lang === "bn" ? "মডারেশন কিউতে কোনো রিপোর্ট নেই।" : "No reports found matching criteria in moderation queue."}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
        <span>
          {lang === "bn" ? "রিপোর্ট সংখ্যা:" : "Moderation Queue Reports:"} {results.total_found}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-amber-300 font-mono text-[10px]">
          Staff Authorized
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
                  r.status === "APPROVED"
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800/50"
                    : r.status === "SUBMITTED"
                    ? "bg-blue-950 text-blue-300 border border-blue-800/50"
                    : r.status === "UNDER_REVIEW"
                    ? "bg-amber-950 text-amber-300 border border-amber-800/50"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >
                {r.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-amber-400" />
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

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => onInspect(r.id)}
                className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition cursor-pointer"
              >
                Inspect
              </button>
              <button
                type="button"
                onClick={() => onReview(r.id)}
                className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-amber-950 border border-amber-800/50 text-amber-300 hover:bg-amber-900 transition cursor-pointer"
              >
                Prepare Review
              </button>
              {r.status !== "APPROVED" && (
                <button
                  type="button"
                  onClick={() => onApprove(r.id)}
                  className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-emerald-950 border border-emerald-800/50 text-emerald-300 hover:bg-emerald-900 transition cursor-pointer"
                >
                  Approve
                </button>
              )}
              {r.status !== "REJECTED" && (
                <button
                  type="button"
                  onClick={() => onReject(r.id)}
                  className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-red-950 border border-red-800/50 text-red-300 hover:bg-red-900 transition cursor-pointer"
                >
                  Reject
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Platform Activity Card
// ---------------------------------------------------------------------------

function PlatformActivityCard({
  activity,
  lang,
}: {
  activity: PlatformActivitySummaryOutput;
  lang: Language;
}) {
  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2 font-semibold text-zinc-200">
          <Activity className="h-4 w-4 text-amber-400" />
          <span>{lang === "bn" ? "প্ল্যাটফর্ম কার্যক্রম মেট্রিক্স" : "Platform Operational Metrics"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
          <span className="text-[10px] text-zinc-500 block">Total Reports</span>
          <span className="text-base font-bold text-zinc-100">{activity.total_reports}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
          <span className="text-[10px] text-amber-400 block">Pending Review</span>
          <span className="text-base font-bold text-amber-400">{activity.pending_reports}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
          <span className="text-[10px] text-emerald-400 block">Verified Active</span>
          <span className="text-base font-bold text-emerald-400">{activity.approved_reports}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
          <span className="text-[10px] text-red-400 block">Active Blood Reqs</span>
          <span className="text-base font-bold text-red-400">{activity.active_blood_requests}</span>
        </div>
      </div>

      <p className="text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-800/80 pt-2 italic">
        {activity.summary_narrative}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Operational Attention Items Card
// ---------------------------------------------------------------------------

function AttentionItemsCard({
  attention,
  lang,
  onActOnItem,
}: {
  attention: OperationalAttentionOutput;
  lang: Language;
  onActOnItem: (id: string) => void;
}) {
  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-amber-900/40 space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2 font-bold text-amber-300">
          <ShieldAlert className="h-4 w-4 text-amber-400" />
          <span>{lang === "bn" ? "অপারেশনাল সতর্কতা আইটেম" : "Operational Attention Items"}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/40">
          {attention.total_items} items
        </span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {attention.items.map((it, idx) => (
          <div
            key={idx}
            className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <h5 className="font-semibold text-zinc-200 line-clamp-1">{it.title}</h5>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  it.severity === "CRITICAL"
                    ? "bg-red-950 text-red-300 border border-red-800/60"
                    : it.severity === "HIGH"
                    ? "bg-amber-950 text-amber-300 border border-amber-800/60"
                    : "bg-blue-950 text-blue-300 border border-blue-800/60"
                }`}
              >
                {it.severity}
              </span>
            </div>

            <p className="text-[11px] text-zinc-400">{it.reason}</p>
            <div className="text-[11px] text-amber-300/90 font-medium">
              Recommendation: {it.recommended_action}
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => onActOnItem(it.record_id)}
                className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition cursor-pointer"
              >
                Investigate #{it.record_id.slice(0, 8)}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Moderation Summary Card
// ---------------------------------------------------------------------------

function ModerationSummaryCard({
  summary,
}: {
  summary: GetModerationSummaryOutput;
  lang?: Language;
}) {
  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 text-xs">
      <div className="flex items-center gap-2 font-semibold text-zinc-200 border-b border-zinc-800 pb-2">
        <BarChart3 className="h-4 w-4 text-amber-400" />
        <span>Moderation Queue Status Summary</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="p-2 rounded-xl bg-zinc-950 text-center">
          <span className="text-[10px] text-zinc-500 block">Pending</span>
          <span className="text-base font-bold text-amber-400">{summary.pending_review_count}</span>
        </div>
        <div className="p-2 rounded-xl bg-zinc-950 text-center">
          <span className="text-[10px] text-zinc-500 block">Approved</span>
          <span className="text-base font-bold text-emerald-400">{summary.approved_count}</span>
        </div>
        <div className="p-2 rounded-xl bg-zinc-950 text-center">
          <span className="text-[10px] text-zinc-500 block">Needs Info</span>
          <span className="text-base font-bold text-blue-400">{summary.needs_info_count}</span>
        </div>
        <div className="p-2 rounded-xl bg-zinc-950 text-center">
          <span className="text-[10px] text-zinc-500 block">Rejected</span>
          <span className="text-base font-bold text-red-400">{summary.rejected_count}</span>
        </div>
      </div>

      <p className="text-[11px] text-zinc-400 leading-relaxed italic pt-1">
        {summary.summary_narrative}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Blood Requests Queue Card
// ---------------------------------------------------------------------------

function BloodRequestsCard({
  requests,
}: {
  requests: SearchBloodRequestsAdminOutput;
  lang?: Language;
}) {
  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2.5 text-xs">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2 font-semibold text-zinc-200">
          <Droplet className="h-4 w-4 text-red-400" />
          <span>Blood Coordination Queue ({requests.total_found})</span>
        </div>
      </div>

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {requests.requests.map((b) => (
          <div key={b.id} className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-zinc-200 flex items-center gap-2">
                <span>{b.blood_group} ({b.units_required} units)</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-950 text-red-300 font-bold">
                  {b.urgency}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                {b.hospital_name}, {b.district} • Status: {b.status}
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-[10px] shrink-0">
              {b.response_count} responses
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Recent Activity Audit Card
// ---------------------------------------------------------------------------

function RecentActivityCard({
  activity,
}: {
  activity: RecentModerationActivityOutput;
  lang?: Language;
}) {
  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2.5 text-xs">
      <div className="flex items-center gap-2 font-semibold text-zinc-200 border-b border-zinc-800 pb-2">
        <Clock className="h-4 w-4 text-amber-400" />
        <span>Recent Staff Moderation Actions</span>
      </div>

      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {activity.recent_records.map((r, idx) => (
          <div key={idx} className="p-2 rounded-xl bg-zinc-950 text-[11px] space-y-0.5">
            <div className="flex items-center justify-between text-zinc-300">
              <span className="font-bold text-amber-300">{r.action}</span>
              <span className="text-[10px] text-zinc-500">{r.created_at.slice(0, 16)}</span>
            </div>
            <div className="text-zinc-400 line-clamp-1">{r.report_title}</div>
            <div className="text-[10px] text-zinc-500">Moderator: {r.moderator_name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Single Report Details Card
// ---------------------------------------------------------------------------

function ReportDetailsCard({
  report,
  onApprove,
  onReject,
  onRequestInfo,
}: {
  report: GetModerationReportOutput;
  lang?: Language;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRequestInfo: (id: string) => void;
}) {
  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 text-xs">
      <div className="flex items-start justify-between gap-2 border-b border-zinc-800 pb-2">
        <div>
          <h4 className="font-bold text-zinc-100 text-sm">{report.title}</h4>
          <span className="text-[10px] text-zinc-500 font-mono">ID: {report.report_id}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/40">
          {report.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
        <div>Category: <strong className="text-zinc-200">{report.category_name}</strong></div>
        <div>Location: <strong className="text-zinc-200">{report.location_text}</strong></div>
        <div>Reporter: <strong className="text-zinc-200">{report.reporter_username || "Anonymous"}</strong></div>
        <div>Flags on Record: <strong className="text-zinc-200">{report.flags_count}</strong></div>
      </div>

      <div className="p-2.5 rounded-xl bg-zinc-950 text-[11px] text-zinc-300">
        {report.description}
      </div>

      {report.moderation_history.length > 0 && (
        <div className="space-y-1 pt-1">
          <span className="text-[10px] font-bold text-zinc-500 uppercase">Moderation History:</span>
          {report.moderation_history.map((m, idx) => (
            <div key={idx} className="p-2 rounded-lg bg-zinc-950/80 text-[10px] text-zinc-400">
              <span className="font-bold text-amber-300">{m.action}</span>: {m.internal_notes || m.user_message || "No notes"}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/80">
        {report.status !== "APPROVED" && (
          <button
            type="button"
            onClick={() => onApprove(report.report_id)}
            className="px-3 py-1.5 rounded-xl bg-emerald-950 border border-emerald-800/50 text-emerald-300 text-xs font-semibold hover:bg-emerald-900 transition cursor-pointer"
          >
            Approve Report
          </button>
        )}
        {report.status !== "REJECTED" && (
          <button
            type="button"
            onClick={() => onReject(report.report_id)}
            className="px-3 py-1.5 rounded-xl bg-red-950 border border-red-800/50 text-red-300 text-xs font-semibold hover:bg-red-900 transition cursor-pointer"
          >
            Reject Report
          </button>
        )}
        {report.status in ["SUBMITTED", "UNDER_REVIEW"] && (
          <button
            type="button"
            onClick={() => onRequestInfo(report.report_id)}
            className="px-3 py-1.5 rounded-xl bg-blue-950 border border-blue-800/50 text-blue-300 text-xs font-semibold hover:bg-blue-900 transition cursor-pointer"
          >
            Request More Info
          </button>
        )}
      </div>
    </div>
  );
}
