"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { CommentPagination, PublicComment } from "@/lib/types";
import FlagModal from "@/components/FlagModal";

interface CommentsSectionProps {
  reportId: string;
}

export default function CommentsSection({ reportId }: CommentsSectionProps) {
  const { isAuthenticated, user } = useAuth();
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submission state
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [flagTargetComment, setFlagTargetComment] = useState<PublicComment | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchComments = async () => {
      try {
        const data = await apiFetch<CommentPagination>(
          `/public/reports/${reportId}/comments?limit=50&offset=0`
        );
        if (isMounted) {
          setComments(data.items);
          setTotal(data.total);
        }
      } catch {
        try {
          const fallbackData = await apiFetch<CommentPagination>(
            `/reports/${reportId}/comments?limit=50&offset=0`
          );
          if (isMounted) {
            setComments(fallbackData.items);
            setTotal(fallbackData.total);
          }
        } catch (err: unknown) {
          if (isMounted && err instanceof Error) setError(err.message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchComments();

    return () => {
      isMounted = false;
    };
  }, [reportId, isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      let newComment: PublicComment;
      try {
        newComment = await apiFetch<PublicComment>(
          `/reports/${reportId}/comments`,
          {
            method: "POST",
            body: JSON.stringify({ body: body.trim() }),
          }
        );
      } catch {
        // Fallback to public route in case endpoint is mounted under /public
        newComment = await apiFetch<PublicComment>(
          `/public/reports/${reportId}/comments`,
          {
            method: "POST",
            body: JSON.stringify({ body: body.trim() }),
          }
        );
      }
      setComments((prev) => [...prev, newComment]);
      setTotal((prev) => prev + 1);
      setBody("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message;
        if (
          msg.toLowerCase().includes("unauthorized") ||
          msg.toLowerCase().includes("token") ||
          msg.toLowerCase().includes("authentication required")
        ) {
          setSubmitError("Your session has expired. Please sign in again to comment.");
        } else {
          setSubmitError(msg);
        }
      } else {
        setSubmitError("Failed to submit comment. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Are you sure you want to remove your comment?")) return;

    setDeletingId(commentId);
    try {
      await apiFetch(`/comments/${commentId}`, {
        method: "DELETE",
      });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section id="comments" className="space-y-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <span>💬 Citizen Discussion</span>
          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-600 dark:text-zinc-400 font-bold border border-zinc-200/60 dark:border-zinc-700/60">
            {total}
          </span>
        </h2>
      </div>

      {/* Comment Input Box (Authenticated) or Prompt */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="space-y-3 bg-zinc-50/50 dark:bg-zinc-800/30 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              placeholder="Contribute factual updates, local witness context, or community feedback..."
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {submitError && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 border border-red-200 dark:border-red-900/60 flex items-center justify-between text-xs text-red-700 dark:text-red-300">
              <span>{submitError}</span>
              {submitError.includes("sign in") && (
                <Link
                  href={`/login?redirect=/reports/${reportId}#comments`}
                  className="font-bold underline ml-2 shrink-0 hover:text-red-900 dark:hover:text-red-100"
                >
                  Sign In
                </Link>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">
              {body.length} / 1000 characters
            </span>
            <button
              type="submit"
              disabled={submitting || !body.trim()}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition disabled:opacity-40 shadow-2xs cursor-pointer"
            >
              {submitting ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-6 text-center space-y-3">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
            Sign in to participate in the verified civic discussion, provide on-the-ground updates, or confirm incident details.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href={`/login?redirect=/reports/${reportId}#comments`}
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-bold text-white shadow-2xs transition"
            >
              Sign In to Comment
            </Link>
            <Link
              href="/register"
              className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Register
            </Link>
          </div>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2 animate-pulse"
            >
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4" />
              <div className="h-10 bg-zinc-100 dark:bg-zinc-800/60 rounded w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : comments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-zinc-400">
          No comments have been posted yet. Be the first citizen to contribute.
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2 text-xs shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    👤 {comment.user_display_name}
                  </span>
                  {comment.is_own_comment && (
                    <span className="rounded bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                      You
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-400">
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                  {!comment.is_own_comment && (
                    <button
                      type="button"
                      onClick={() => setFlagTargetComment(comment)}
                      className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 font-medium text-[11px]"
                    >
                      🚩 Flag
                    </button>
                  )}
                  {(comment.is_own_comment || user?.role === "ADMIN") && (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                      className="text-red-500 hover:text-red-700 font-medium text-[11px]"
                    >
                      {deletingId === comment.id ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap text-xs">
                {comment.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {flagTargetComment && (
        <FlagModal
          isOpen={true}
          onClose={() => setFlagTargetComment(null)}
          targetType="COMMENT"
          targetId={flagTargetComment.id}
          targetTitleOrSnippet={flagTargetComment.body}
        />
      )}
    </section>
  );
}
