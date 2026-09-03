"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PublicBloodRequest, BloodResponseItem } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

export default function BloodRequestDetailPage() {
  const params = useParams();
  const requestId = params?.id as string;
  const { isAuthenticated, user } = useAuth();

  const [request, setRequest] = useState<PublicBloodRequest | null>(null);
  const [responses, setResponses] = useState<BloodResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Response Modal State ("I Can Help")
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const [responsePhone, setResponsePhone] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [hasRespondedLocally, setHasRespondedLocally] = useState(false);

  // Flag Modal State
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("Commercial selling / Spam");
  const [flagDetails, setFlagDetails] = useState("");
  const [submittingFlag, setSubmittingFlag] = useState(false);

  // Status updating
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchRequestDetails = async () => {
    try {
      const data = await apiFetch<PublicBloodRequest>(`/blood/requests/${requestId}`);
      setRequest(data);

      // If owner or admin, load volunteer donor responses
      if (data.is_own_request || user?.role === "ADMIN") {
        try {
          const resps = await apiFetch<BloodResponseItem[]>(`/blood/requests/${requestId}/responses`);
          setResponses(resps);
        } catch {
          // Ignore 403 for non-owners
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (requestId) fetchRequestDetails();
  }, [requestId, user?.id]);

  const handleRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingResponse(true);
    setError(null);
    try {
      await apiFetch(`/blood/requests/${requestId}/respond`, {
        method: "POST",
        body: JSON.stringify({
          message: responseMessage.trim() || undefined,
          contact_phone: responsePhone.trim() || undefined,
        }),
      });
      setHasRespondedLocally(true);
      setIsResponseModalOpen(false);
      setSuccess("Thank you! Your willingness to donate has been sent to the requester.");
      fetchRequestDetails();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleUpdateStatus = async (newStatus: "FULFILLED" | "CANCELLED") => {
    if (!confirm(`Are you sure you want to mark this request as ${newStatus}?`)) return;
    setUpdatingStatus(true);
    try {
      const updated = await apiFetch<PublicBloodRequest>(`/blood/requests/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setRequest(updated);
      setSuccess(`Request successfully marked as ${newStatus}`);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingFlag(true);
    try {
      await apiFetch(`/blood/requests/${requestId}/flag`, {
        method: "POST",
        body: JSON.stringify({
          reason: flagReason,
          details: flagDetails.trim() || undefined,
        }),
      });
      setIsFlagModalOpen(false);
      setSuccess("Thank you. This report has been submitted to platform moderators for review.");
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSubmittingFlag(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-xs text-zinc-400">
        Loading blood request details...
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
        <span className="text-4xl">⚠️</span>
        <h1 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
          Request Unavailable
        </h1>
        <p className="text-xs text-zinc-500">
          {error || "This blood request was not found or has expired."}
        </p>
        <Link
          href="/blood-help"
          className="inline-block rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-2xs"
        >
          Return to Blood Help
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Breadcrumb / Back Link */}
      <Link
        href="/blood-help"
        className="text-xs font-bold text-zinc-500 hover:text-rose-600 inline-flex items-center gap-1.5 transition"
      >
        <span>←</span>
        <span>Back to Active Blood Requests</span>
      </Link>

      {/* Notifications */}
      {success && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}

      {/* Main Request Container */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-10 shadow-2xs space-y-6">
        {/* Header Strip: Blood Badge, Status, Date */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center rounded-2xl bg-rose-600 text-white font-black text-2xl px-4 py-2 shadow-2xs">
              {request.blood_group}
            </span>
            <div>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                Required Blood Group
              </span>
              <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100">
                {request.units_required} {request.units_required === 1 ? "Bag" : "Bags"} Needed
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                request.urgency === "EMERGENCY"
                  ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-900/80"
                  : request.urgency === "URGENT"
                  ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/80"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
              }`}
            >
              {request.urgency === "EMERGENCY" && (
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
              )}
              <span>{request.urgency}</span>
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                request.status === "FULFILLED"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200"
                  : request.status === "RESPONDED"
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {request.status}
            </span>
          </div>
        </div>

        {/* Hospital & Location Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 text-xs">
          <div>
            <span className="text-zinc-400 font-medium block">Hospital / Clinic</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm mt-0.5 block truncate">
              🏥 {request.hospital_name}
            </span>
          </div>

          <div>
            <span className="text-zinc-400 font-medium block">Area & District</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm mt-0.5 block truncate">
              📍 {request.hospital_area}, {request.district}
            </span>
          </div>

          <div>
            <span className="text-zinc-400 font-medium block">Required Date & Time</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm mt-0.5 block">
              🕒 {new Date(request.required_date).toLocaleDateString()}{" "}
              {request.required_time ? `(${request.required_time})` : ""}
            </span>
          </div>
        </div>

        {/* Additional Medical / Case Details */}
        {request.additional_information && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Additional Context / Instructions
            </h2>
            <div className="p-5 rounded-2xl bg-zinc-50/50 dark:bg-zinc-800/20 border border-zinc-200/60 dark:border-zinc-800 text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
              {request.additional_information}
            </div>
          </div>
        )}

        {/* Contact Info (if authorized: requester, responder, or admin) */}
        {request.contact_phone && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20 p-4 space-y-1">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
              📞 Emergency Contact Details
            </span>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              {request.contact_name ? `${request.contact_name}: ` : ""}
              <strong className="text-sm font-mono">{request.contact_phone}</strong> ({request.contact_method})
            </p>
          </div>
        )}

        {/* Owner Management Controls */}
        {request.is_own_request && (
          <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                🛡️ You are the author of this request
              </span>
              <div className="flex gap-2">
                {request.status !== "FULFILLED" && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus("FULFILLED")}
                    disabled={updatingStatus}
                    className="rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition cursor-pointer"
                  >
                    Mark as Fulfilled
                  </button>
                )}
                {request.status !== "CANCELLED" && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus("CANCELLED")}
                    disabled={updatingStatus}
                    className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    Cancel Request
                  </button>
                )}
              </div>
            </div>

            {/* Responses List for Owner */}
            {responses.length > 0 && (
              <div className="pt-3 border-t border-amber-200/60 dark:border-amber-900/60 space-y-2">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                  Volunteer Donors Who Responded ({responses.length})
                </span>
                <div className="space-y-2">
                  {responses.map((resp) => (
                    <div
                      key={resp.id}
                      className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">
                          {resp.donor_display_name}
                        </span>
                        {resp.contact_phone && (
                          <span className="ml-2 font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                            📞 {resp.contact_phone}
                          </span>
                        )}
                        {resp.message && (
                          <p className="text-[11px] text-zinc-500 mt-0.5">{resp.message}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(resp.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Public Donor Actions ("I Can Help" & "Report Request") */}
        {!request.is_own_request && request.status !== "FULFILLED" && request.status !== "CANCELLED" && (
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => setIsResponseModalOpen(true)}
                disabled={hasRespondedLocally}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-2xs transition disabled:opacity-50 cursor-pointer"
              >
                <span>❤️</span>
                <span>{hasRespondedLocally ? "Response Sent ✓" : "I Can Help (Donate Blood)"}</span>
              </button>
            ) : (
              <Link
                href={`/login?redirect=/blood-help/${request.id}`}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-2xs transition"
              >
                <span>❤️</span>
                <span>Sign In to Volunteer as Donor</span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setIsFlagModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <span>🚩</span>
              <span>Report Request</span>
            </button>
          </div>
        )}
      </div>

      {/* Response Modal */}
      {isResponseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                  Respond to Blood Request
                </h3>
                <p className="text-xs text-zinc-500">
                  {request.units_required} unit(s) of {request.blood_group} at {request.hospital_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsResponseModalOpen(false)}
                className="rounded-xl p-1.5 text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRespond} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Your Message to Patient Attendant
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. I am compatible and can reach the hospital by 2 PM. Please let me know if you still need blood."
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Your Phone Number (Shared only with this requester)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 017xxxxxxxx"
                  value={responsePhone}
                  onChange={(e) => setResponsePhone(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResponseModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResponse}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-2 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
                >
                  {submittingResponse ? "Sending..." : "Send Response"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Flag / Report Modal */}
      {isFlagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                  Report Suspicious Blood Request
                </h3>
                <p className="text-xs text-zinc-500">
                  Help keep the community emergency service safe and spam-free.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFlagModalOpen(false)}
                className="rounded-xl p-1.5 text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFlagSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Reason
                </label>
                <select
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                >
                  <option value="Commercial selling / Spam">Commercial selling / Demanding money</option>
                  <option value="Fake / Inaccurate Location">Fake / Non-existent hospital</option>
                  <option value="Harassment / Inappropriate">Harassment / Abusive content</option>
                  <option value="Already Fulfilled">Already fulfilled / Outdated</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Details (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide additional details to assist administrators..."
                  value={flagDetails}
                  onChange={(e) => setFlagDetails(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFlagModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFlag}
                  className="rounded-xl bg-red-600 hover:bg-red-700 px-5 py-2 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50"
                >
                  {submittingFlag ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
