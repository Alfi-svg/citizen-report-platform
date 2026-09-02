"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { FlagResponse, FlagTargetType, ReportFlagReason, CommentFlagReason } from "@/lib/types";

interface FlagModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: FlagTargetType;
  targetId: string;
  targetTitleOrSnippet?: string;
}

const REPORT_REASONS: { value: ReportFlagReason; label: string; desc: string }[] = [
  {
    value: "FALSE_OR_MISLEADING",
    label: "False or Misleading / মিথ্যা বা বিভ্রান্তিকর",
    desc: "Contains factual inaccuracies, fabrications, or manipulated media.",
  },
  {
    value: "SPAM",
    label: "Spam or Advertising / স্প্যাম বা প্রচার",
    desc: "Commercial promotional content or irrelevant advertising.",
  },
  {
    value: "DUPLICATE",
    label: "Duplicate Report / ডুপ্লিকেট রিপোর্ট",
    desc: "This incident has already been reported and approved on the platform.",
  },
  {
    value: "PRIVACY_CONCERN",
    label: "Privacy Violation / ব্যক্তিগত গোপনীয়তা লঙ্ঘন",
    desc: "Exposes private phone numbers, sensitive documents, or non-consensual details.",
  },
  {
    value: "HARASSMENT_OR_ABUSE",
    label: "Harassment or Defamation / হয়রানি বা অপবাদ",
    desc: "Unsubstantiated personal attacks or targeted harassment.",
  },
  {
    value: "INAPPROPRIATE_CONTENT",
    label: "Inappropriate or Graphic Content / অনুপযুক্ত বা গ্রাফিক কন্টেন্ট",
    desc: "Excessively graphic violence, gore, or NSFW imagery.",
  },
  {
    value: "OTHER",
    label: "Other Safety Concern / অন্যান্য নিরাপত্তা উদ্বেগ",
    desc: "Other issue requiring moderator attention.",
  },
];

const COMMENT_REASONS: { value: CommentFlagReason; label: string; desc: string }[] = [
  {
    value: "SPAM",
    label: "Spam or Promotion / স্প্যাম বা প্রচার",
    desc: "Commercial links, promotional spam, or repetitive text.",
  },
  {
    value: "HARASSMENT_OR_ABUSE",
    label: "Harassment or Abuse / হয়রানি বা গালিগালাজ",
    desc: "Targeted bullying, threats, or abusive language.",
  },
  {
    value: "HATEFUL_OR_OFFENSIVE",
    label: "Hate Speech / বিদ্বেষমূলক বক্তব্য",
    desc: "Attacks on identity, religion, ethnicity, or community.",
  },
  {
    value: "PERSONAL_INFORMATION",
    label: "Personal Data Leak / ব্যক্তিগত তথ্য প্রকাশ",
    desc: "Sharing private contact information, addresses, or doxxing.",
  },
  {
    value: "THREATENING_CONTENT",
    label: "Threats of Harm / সহিংস হুমকির ভাষা",
    desc: "Threats of physical violence or endangerment.",
  },
  {
    value: "INAPPROPRIATE_CONTENT",
    label: "Inappropriate Content / অনুপযুক্ত মন্তব্য",
    desc: "Explicit, vulgar, or inappropriate comments.",
  },
  {
    value: "OTHER",
    label: "Other Issue / অন্যান্য",
    desc: "Other moderation concern.",
  },
];

export default function FlagModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitleOrSnippet,
}: FlagModalProps) {
  const { isAuthenticated } = useAuth();

  const [selectedReason, setSelectedReason] = useState<string>(
    targetType === "REPORT" ? "FALSE_OR_MISLEADING" : "SPAM"
  );
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const reasons = targetType === "REPORT" ? REPORT_REASONS : COMMENT_REASONS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return;

    setError(null);
    setSubmitting(true);

    try {
      const endpoint =
        targetType === "REPORT"
          ? `/reports/${targetId}/flags`
          : `/comments/${targetId}/flags`;

      const res = await apiFetch<FlagResponse>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          reason: selectedReason,
          details: details.trim() || undefined,
        }),
      });

      setConfirmationMessage(res.message);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setConfirmationMessage(null);
    setError(null);
    setDetails("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>🚩</span>
            <span>
              {targetType === "REPORT"
                ? "Flag Incident Report for Review / রিপোর্টটি ফ্ল্যাগ করুন"
                : "Flag Comment for Review / মন্তব্য ফ্ল্যাগ করুন"}
            </span>
          </h3>
          <button
            onClick={handleClose}
            type="button"
            className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {confirmationMessage ? (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 text-xl font-bold">
              ✓
            </div>
            <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Flag Recorded
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
              {confirmationMessage}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl bg-zinc-900 dark:bg-zinc-100 px-5 py-2 text-xs font-semibold text-white dark:text-zinc-900"
              >
                Close / সম্পন্ন
              </button>
            </div>
          </div>
        ) : !isAuthenticated ? (
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 p-6 text-center space-y-3 border border-zinc-200 dark:border-zinc-700">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Only authenticated citizens may submit moderation flags to prevent abuse.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href="/login"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition shadow-sm"
              >
                Sign In to Flag
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {targetTitleOrSnippet && (
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-3 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 block mb-0.5">
                  Target Content:
                </span>
                <span className="italic line-clamp-2">“{targetTitleOrSnippet}”</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                Reason for Flagging / ফ্ল্যাগ করার কারণ <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {reasons.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                      selectedReason === r.value
                        ? "bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="flag_reason"
                      value={r.value}
                      checked={selectedReason === r.value}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">
                        {r.label}
                      </span>
                      <span className="text-[11px] text-zinc-500 block leading-tight mt-0.5">
                        {r.desc}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Additional Context (Optional) / অতিরিক্ত বিবরণ
              </label>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                placeholder="Provide specific timestamps, links, or context to assist moderators..."
                className="w-full rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-zinc-400 block text-right">
                {details.length} / 500 characters
              </span>
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
              >
                Cancel / বাতিল
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-500 transition shadow-sm disabled:opacity-50"
              >
                {submitting ? "Submitting Flag..." : "Submit Flag / ফ্ল্যাগ জমা দিন"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
