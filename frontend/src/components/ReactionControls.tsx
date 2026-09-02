"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { ReactionSummary, ReactionType, ReactionToggleResponse } from "@/lib/types";

interface ReactionControlsProps {
  reportId: string;
}

export default function ReactionControls({ reportId }: ReactionControlsProps) {
  const { isAuthenticated } = useAuth();
  const [reactions, setReactions] = useState<ReactionSummary>({
    report_id: reportId,
    support_count: 0,
    important_count: 0,
    user_reactions: [],
  });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  useEffect(() => {
    let isMounted = true;
    apiFetch<ReactionSummary>(`/public/reports/${reportId}/reactions`)
      .then((data) => {
        if (isMounted) setReactions(data);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [reportId, isAuthenticated]);

  const handleToggle = async (type: ReactionType) => {
    if (!isAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }

    setShowLoginPrompt(false);
    setToggling(true);

    // Optimistic UI update
    const hasCurrent = reactions.user_reactions.includes(type);
    const updatedTypes = hasCurrent
      ? reactions.user_reactions.filter((t) => t !== type)
      : [...reactions.user_reactions, type];

    const countKey = type === "SUPPORT" ? "support_count" : "important_count";
    setReactions((prev) => ({
      ...prev,
      [countKey]: hasCurrent ? Math.max(0, prev[countKey] - 1) : prev[countKey] + 1,
      user_reactions: updatedTypes,
    }));

    try {
      const res = await apiFetch<ReactionToggleResponse>(
        `/reports/${reportId}/reactions`,
        {
          method: "POST",
          body: JSON.stringify({ reaction_type: type }),
        }
      );
      setReactions(res.summary);
    } catch {
      // Ignored
    } finally {
      setToggling(false);
    }
  };

  const hasSupported = reactions.user_reactions.includes("SUPPORT");
  const hasMarkedImportant = reactions.user_reactions.includes("IMPORTANT");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => handleToggle("SUPPORT")}
          disabled={loading || toggling}
          aria-pressed={hasSupported}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition shadow-2xs select-none ${
            hasSupported
              ? "bg-emerald-700 text-white hover:bg-emerald-800"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/80"
          }`}
        >
          <span>🤝</span>
          <span>Community Support</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              hasSupported
                ? "bg-emerald-900/60 text-white"
                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
            }`}
          >
            {reactions.support_count}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleToggle("IMPORTANT")}
          disabled={loading || toggling}
          aria-pressed={hasMarkedImportant}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition shadow-2xs select-none ${
            hasMarkedImportant
              ? "bg-amber-600 text-white hover:bg-amber-700"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/80"
          }`}
        >
          <span>⚠️</span>
          <span>Critical Issue</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              hasMarkedImportant
                ? "bg-amber-900/60 text-white"
                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
            }`}
          >
            {reactions.important_count}
          </span>
        </button>
      </div>

      {showLoginPrompt && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between animate-fade-in">
          <span>Sign in to endorse or react to verified incident reports.</span>
          <Link
            href={`/login?redirect=/reports/${reportId}`}
            className="font-bold underline hover:text-amber-950 dark:hover:text-amber-200 ml-2 shrink-0"
          >
            Sign In →
          </Link>
        </div>
      )}
    </div>
  );
}
