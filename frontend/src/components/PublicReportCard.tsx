"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicReport, ReactionSummary, ReactionType, ReactionToggleResponse } from "@/lib/types";
import { getApiBaseUrl, apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import FlagModal from "@/components/FlagModal";

interface PublicReportCardProps {
  report: PublicReport;
}

export default function PublicReportCard({ report }: PublicReportCardProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);

  // Reactions state
  const [reactions, setReactions] = useState<ReactionSummary>({
    report_id: report.id,
    support_count: 0,
    important_count: 0,
    user_reactions: [],
  });
  const [isReacting, setIsReacting] = useState(false);

  // Comments count state
  const [commentCount, setCommentCount] = useState<number>(0);

  const apiBase = getApiBaseUrl();
  const firstImage = report.media?.find(
    (m) => m.media_type === "image" || m.mime_type.startsWith("image/")
  );

  const getFullUrl = (downloadUrl: string) => {
    if (downloadUrl.startsWith("http")) return downloadUrl;
    const normalizedPath = downloadUrl.replace(/^\/api\/v1/, "");
    return `${apiBase}${normalizedPath}`;
  };

  // Load reactions & comments count on mount
  useEffect(() => {
    let isMounted = true;

    // Fetch reactions
    apiFetch<ReactionSummary>(`/public/reports/${report.id}/reactions`)
      .then((res) => {
        if (isMounted) setReactions(res);
      })
      .catch(() => {});

    // Fetch comments count
    apiFetch<{ total: number }>(`/public/reports/${report.id}/comments?limit=1`)
      .then((res) => {
        if (isMounted) setCommentCount(res.total || 0);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [report.id, isAuthenticated]);

  // Toggle reaction
  const handleToggleReaction = async (type: ReactionType, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      router.push(`/login?redirect=/reports/${report.id}`);
      return;
    }

    if (isReacting) return;
    setIsReacting(true);

    try {
      const res = await apiFetch<ReactionToggleResponse>(
        `/reports/${report.id}/reactions`,
        {
          method: "POST",
          body: JSON.stringify({ reaction_type: type }),
        }
      );
      setReactions(res.summary);
    } catch {
      // Graceful fallback
    } finally {
      setIsReacting(false);
    }
  };

  const hasSupported = reactions.user_reactions.includes("SUPPORT");

  // Share handler
  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/reports/${report.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: report.title,
          text: `Platform-Reviewed Citizen Report: ${report.title} in ${report.location_text}`,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format date
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <article className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-md hover:border-emerald-700/40 dark:hover:border-emerald-500/40 transition duration-200 overflow-hidden">
        <div>
          {/* 1. Card Top Bar: Category Badge + Author / Time + More Menu */}
          <div className="p-4 pb-3 flex items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-2 min-w-0">
              {/* Category Pill */}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60 shrink-0">
                {report.category?.name || "Civic Incident"}
              </span>

              {/* Author / Anonymous Indicator */}
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {report.is_anonymous ? (
                  <span className="inline-flex items-center gap-1 font-medium">
                    <span>🛡️</span>
                    <span>Anonymous</span>
                  </span>
                ) : (
                  <span className="font-medium truncate">
                    {report.reporter_display_name || "Citizen"}
                  </span>
                )}
              </span>
            </div>

            {/* More Menu (•••) */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="h-7 w-7 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-xs font-bold transition"
                aria-label="More options"
                title="More options"
              >
                •••
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                    }}
                  />
                  <div className="absolute right-0 top-8 z-30 w-44 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-1 shadow-lg text-xs space-y-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        setShowMenu(false);
                        handleShare(e);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center gap-2"
                    >
                      <span>🔗</span>
                      <span>{copied ? "Link Copied!" : "Copy Report Link"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowMenu(false);
                        setIsFlagModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2"
                    >
                      <span>🚩</span>
                      <span>Flag / Report Content</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 2. Title & Short Description */}
          <div className="p-4 space-y-2">
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition leading-snug">
              <Link href={`/reports/${report.id}`}>
                {report.title}
              </Link>
            </h3>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
              {report.description}
            </p>

            {/* Metadata: Approximate Location + Date */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              <div className="inline-flex items-center gap-1 font-medium bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md max-w-full truncate">
                <span>📍</span>
                <span className="truncate">{report.location_text}</span>
              </div>
              <div className="inline-flex items-center gap-1">
                <span>🕒</span>
                <span>{formatDate(report.created_at)}</span>
              </div>
            </div>
          </div>

          {/* 3. Evidence Preview (if available) */}
          {firstImage && (
            <Link
              href={`/reports/${report.id}`}
              className="block relative aspect-16/9 w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden border-y border-zinc-100 dark:border-zinc-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getFullUrl(firstImage.download_url)}
                alt={firstImage.caption || report.title}
                className="h-full w-full object-cover group-hover:scale-102 transition duration-300"
                loading="lazy"
              />
              {report.media_count > 1 && (
                <span className="absolute bottom-2 right-2 rounded-md bg-zinc-950/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs">
                  📷 +{report.media_count - 1} more
                </span>
              )}
            </Link>
          )}
        </div>

        {/* 4. Bottom Row: Reactions, Comments, Share, and Platform-Reviewed Badge */}
        <div className="p-3 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Social Interactions */}
            <div className="flex items-center gap-1 flex-wrap">
              {/* Support / Helpful Reaction */}
              <button
                type="button"
                onClick={(e) => handleToggleReaction("SUPPORT", e)}
                disabled={isReacting}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  hasSupported
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 shadow-2xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60"
                }`}
                title={isAuthenticated ? "Support this civic report" : "Sign in to react"}
              >
                <span>👍</span>
                <span>{reactions.support_count > 0 ? reactions.support_count : "Support"}</span>
              </button>

              {/* Comments count link */}
              <Link
                href={`/reports/${report.id}#comments`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition"
                title="View discussion & comments"
              >
                <span>💬</span>
                <span>{commentCount > 0 ? commentCount : "Comment"}</span>
              </Link>

              {/* Share button */}
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition"
                title="Share report"
              >
                <span>↗</span>
                <span>{copied ? "Copied" : "Share"}</span>
              </button>
            </div>

            {/* Platform Reviewed Status Badge */}
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                <span>Reviewed</span>
              </span>
            </div>
          </div>
        </div>
      </article>

      {/* Flag / Report Modal */}
      {isFlagModalOpen && (
        <FlagModal
          isOpen={isFlagModalOpen}
          onClose={() => setIsFlagModalOpen(false)}
          targetType="REPORT"
          targetId={report.id}
          targetTitleOrSnippet={report.title}
        />
      )}
    </>
  );
}
