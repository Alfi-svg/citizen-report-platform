"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PublicBloodRequest, BloodResponseItem, BloodDonationRecord } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { useBackClose } from "@/lib/useBackClose";

export default function BloodRequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const requestId = params?.id as string;
  const { isAuthenticated, user } = useAuth();

  const [request, setRequest] = useState<PublicBloodRequest | null>(null);
  const [responses, setResponses] = useState<BloodResponseItem[]>([]);
  const [donations, setDonations] = useState<BloodDonationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Response Modal State ("I Can Help")
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const [responsePhone, setResponsePhone] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [hasRespondedLocally, setHasRespondedLocally] = useState(false);

  // Blood Donation Claim & Verification State
  const [claimingDonation, setClaimingDonation] = useState(false);
  const [confirmingDonationId, setConfirmingDonationId] = useState<string | null>(null);

  // Dispute Modal State
  const [disputeDonation, setDisputeDonation] = useState<BloodDonationRecord | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // Rating Modal State
  const [ratingDonation, setRatingDonation] = useState<BloodDonationRecord | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [donorReview, setDonorReview] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  // Flag Modal State
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("Commercial selling / Spam");
  const [flagDetails, setFlagDetails] = useState("");
  const [submittingFlag, setSubmittingFlag] = useState(false);

  // Android back-button compatibility for modals
  useBackClose(isResponseModalOpen, () => setIsResponseModalOpen(false), "bloodResponseModal");
  useBackClose(isFlagModalOpen, () => setIsFlagModalOpen(false), "bloodFlagModal");
  useBackClose(!!disputeDonation, () => setDisputeDonation(null), "bloodDisputeModal");
  useBackClose(!!ratingDonation, () => setRatingDonation(null), "bloodRatingModal");

  useEffect(() => {
    if (!isResponseModalOpen && !isFlagModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsResponseModalOpen(false);
        setIsFlagModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isResponseModalOpen, isFlagModalOpen]);

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

      // If user is authenticated, load blood donation claims
      if (isAuthenticated) {
        try {
          const dons = await apiFetch<BloodDonationRecord[]>(`/blood/requests/${requestId}/donations`);
          setDonations(dons);
        } catch {
          // Ignore
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
  }, [requestId, user?.id, isAuthenticated]);

  const handleClaimDonation = async () => {
    if (!confirm("Confirm that you provided blood for this patient? This creates a verification request for the recipient.")) return;
    setClaimingDonation(true);
    setError(null);
    try {
      await apiFetch(`/blood/requests/${requestId}/claim-donation`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setSuccess("Blood donation claimed! The recipient has been notified to verify your donation. Upon confirmation, you will receive +50 Impact Points.");
      fetchRequestDetails();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setClaimingDonation(false);
    }
  };

  const handleConfirmDonation = async (donationId: string) => {
    if (!confirm("Confirm that you received blood from this volunteer? This will verify the donation and award them +50 community impact points.")) return;
    setConfirmingDonationId(donationId);
    setError(null);
    try {
      const confirmed = await apiFetch<BloodDonationRecord>(`/blood/donations/${donationId}/confirm`, {
        method: "POST",
      });
      setSuccess("Donation verified successfully! +50 Impact Points awarded to donor. Please leave a rating for this volunteer.");
      fetchRequestDetails();
      // Prompt rating modal
      setRatingDonation(confirmed);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setConfirmingDonationId(null);
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeDonation) return;
    if (disputeReason.trim().length < 3) {
      setError("Please provide a valid dispute reason (at least 3 characters).");
      return;
    }
    setSubmittingDispute(true);
    setError(null);
    try {
      await apiFetch(`/blood/donations/${disputeDonation.id}/dispute`, {
        method: "POST",
        body: JSON.stringify({ dispute_reason: disputeReason.trim() }),
      });
      setSuccess("Donation claim disputed. This record has been routed to platform administrators for oversight.");
      setDisputeDonation(null);
      setDisputeReason("");
      fetchRequestDetails();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingDonation) return;
    setSubmittingRating(true);
    setError(null);
    try {
      await apiFetch(`/blood/donations/${ratingDonation.id}/rate`, {
        method: "POST",
        body: JSON.stringify({
          rating: selectedRating,
          review: donorReview.trim() || undefined,
        }),
      });
      setSuccess("Thank you! Your rating and feedback for the donor have been recorded.");
      setRatingDonation(null);
      setDonorReview("");
      fetchRequestDetails();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSubmittingRating(false);
    }
  };

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
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
          } else {
            router.push("/blood-help");
          }
        }}
        className="text-xs font-bold text-zinc-500 hover:text-rose-600 inline-flex items-center gap-1.5 transition min-h-[36px] cursor-pointer"
      >
        <span>←</span>
        <span>Back to Active Blood Requests</span>
      </button>

      {/* Notifications */}
      {success && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}

      {/* Main Request Container */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-10 shadow-2xs space-y-6">
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

        {/* Donation Lifecycle Progress Bar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
            <span className="flex items-center gap-1.5">
              <span>🩸</span>
              <span>Donation Workflow Progress</span>
            </span>
            <span className="text-[11px] font-normal text-zinc-500">
              Community volunteer donation & verification
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            {/* Step 1 */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/60 text-rose-800 dark:text-rose-300">
              <span className="h-5 w-5 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
              <div>
                <span className="font-bold block text-[11px]">Request Posted</span>
                <span className="text-[10px] text-zinc-500 block">Needs Blood</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${
              responses.length > 0 || request.status === "RESPONDED" || hasRespondedLocally
                ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-900/60 text-blue-800 dark:text-blue-300"
                : "bg-zinc-100/50 dark:bg-zinc-800/20 border-zinc-200 dark:border-zinc-800 text-zinc-400"
            }`}>
              <span className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                responses.length > 0 || request.status === "RESPONDED" || hasRespondedLocally
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
              }`}>2</span>
              <div>
                <span className="font-bold block text-[11px]">Donor Offered</span>
                <span className="text-[10px] text-zinc-500 block">{responses.length > 0 ? `${responses.length} Responded` : "Awaiting Donors"}</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${
              donations.length > 0
                ? "bg-amber-50/80 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-900/60 text-amber-800 dark:text-amber-300"
                : "bg-zinc-100/50 dark:bg-zinc-800/20 border-zinc-200 dark:border-zinc-800 text-zinc-400"
            }`}>
              <span className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                donations.length > 0
                  ? "bg-amber-600 text-white"
                  : "bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
              }`}>3</span>
              <div>
                <span className="font-bold block text-[11px]">Blood Donated</span>
                <span className="text-[10px] text-zinc-500 block">{donations.length > 0 ? "Claimed" : "Hospital visit"}</span>
              </div>
            </div>

            {/* Step 4 */}
            <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${
              donations.some(d => d.status === "VERIFIED") || request.status === "FULFILLED"
                ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300"
                : "bg-zinc-100/50 dark:bg-zinc-800/20 border-zinc-200 dark:border-zinc-800 text-zinc-400"
            }`}>
              <span className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                donations.some(d => d.status === "VERIFIED") || request.status === "FULFILLED"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
              }`}>4</span>
              <div>
                <span className="font-bold block text-[11px]">Verified (+50 pts)</span>
                <span className="text-[10px] text-zinc-500 block">{donations.some(d => d.status === "VERIFIED") ? "Completed" : "Recipient confirms"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Next Steps Guidance Card */}
        <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-xs flex items-start gap-2.5">
          <span className="text-base leading-none">💡</span>
          <div className="space-y-0.5">
            <span className="font-bold text-blue-900 dark:text-blue-200 block">
              What happens next?
            </span>
            <p className="text-[11px] text-blue-800/90 dark:text-blue-300 leading-relaxed">
              {request.status === "FULFILLED"
                ? "This blood request has been fulfilled. Thank you to everyone who stepped forward to save a life."
                : user && donations.find(d => d.donor_id === user.id)?.status === "VERIFIED"
                ? "Your donation has been verified by the recipient. +50 Community Impact Points and +5 Trust Score have been awarded to your account."
                : user && donations.find(d => d.donor_id === user.id)?.status === "PENDING_CONFIRMATION"
                ? "You claimed your blood donation. The recipient has been prompted to confirm receipt. Once verified, +50 Impact Points will be credited."
                : user && donations.find(d => d.donor_id === user.id)?.status === "DISPUTED"
                ? "Verification of this claim is unresolved and currently undergoing platform administrator review. No reputation or points are altered while under dispute."
                : hasRespondedLocally
                ? "Your response has been sent. Please communicate directly with the requester to confirm donation time and hospital logistics. After donating, click 'I Donated Blood'."
                : "Tapping 'I Can Help' sends your willingness to donate and contact information to the patient's family. There is no commercial exchange — this is 100% voluntary."}
            </p>
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

        {/* View on Map Link */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 text-xs">
          <span className="text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5 text-[11px]">
            <span>🛡️</span>
            <span>Approximate Location (~110m privacy buffer)</span>
          </span>
          <Link
            href={`/blood-help/map?id=${request.id}`}
            className="font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 text-xs"
          >
            <span>View On Blood Help Map</span>
            <span>→</span>
          </Link>
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

            {/* Recipient Blood Donation Verification Queue */}
            {donations.length > 0 && (
              <div className="pt-3 border-t border-amber-200/60 dark:border-amber-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>🩸</span> Blood Donation Claims ({donations.length})
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Verify or dispute volunteer donations
                  </span>
                </div>

                <div className="space-y-2">
                  {donations.map((d) => (
                    <div
                      key={d.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs space-y-2 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-black text-zinc-900 dark:text-zinc-100">
                            {d.donor_name}
                          </span>
                          <span className="ml-2 text-[10px] text-zinc-400">
                            Claimed: {new Date(d.claimed_at).toLocaleString()}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            d.status === "VERIFIED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : d.status === "PENDING_CONFIRMATION"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : d.status === "DISPUTED"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {d.status === "PENDING_CONFIRMATION"
                            ? "Pending Confirmation"
                            : d.status === "VERIFIED"
                            ? "Verified (+50 pts)"
                            : d.status === "DISPUTED"
                            ? "Disputed"
                            : d.status}
                        </span>
                      </div>

                      {d.status === "PENDING_CONFIRMATION" && (
                        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                            Did this volunteer donate blood for this patient?
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleConfirmDonation(d.id)}
                              disabled={confirmingDonationId === d.id}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer"
                            >
                              {confirmingDonationId === d.id ? "Confirming..." : "✅ Confirm Received"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDisputeDonation(d);
                                setDisputeReason("");
                              }}
                              className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 font-semibold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            >
                              ⚠️ Dispute Claim
                            </button>
                          </div>
                        </div>
                      )}

                      {d.status === "VERIFIED" && (
                        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                          {d.donor_rating ? (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                              <span>★ {d.donor_rating} / 5</span>
                              {d.donor_review && (
                                <span className="text-zinc-500 font-normal italic">
                                  &ldquo;{d.donor_review}&rdquo;
                                </span>
                              )}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setRatingDonation(d);
                                setSelectedRating(5);
                                setDonorReview("");
                              }}
                              className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>⭐</span>
                              <span>Rate Donor Assistance</span>
                            </button>
                          )}
                        </div>
                      )}

                      {d.status === "DISPUTED" && (
                        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                          <span className="font-bold flex items-center gap-1.5 text-[11px]">
                            <span>⚖️</span>
                            <span>Claim Verification Unresolved</span>
                          </span>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                            Verification is currently unresolved and under administrative review. No points are awarded while disputed.
                          </p>
                          {d.dispute_reason && (
                            <p className="text-[11px] text-zinc-500 italic">
                              Note: &ldquo;{d.dispute_reason}&rdquo;
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Public Donor Actions ("I Can Help", "I Donated Blood", "Report Request") */}
        {!request.is_own_request && request.status !== "FULFILLED" && request.status !== "CANCELLED" && (
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
            {/* If user already claimed donation for this request */}
            {user && donations.find((d) => d.donor_id === user.id) ? (
              (() => {
                const myDonation = donations.find((d) => d.donor_id === user.id)!;
                return (
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          Your Blood Donation Record
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            myDonation.status === "VERIFIED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : myDonation.status === "PENDING_CONFIRMATION"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : myDonation.status === "DISPUTED"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {myDonation.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        {myDonation.status === "PENDING_CONFIRMATION"
                          ? "You claimed donation. Awaiting confirmation from the recipient."
                          : myDonation.status === "VERIFIED"
                          ? "Verified! You earned +50 Community Impact Points and +5 Trust Score."
                          : myDonation.status === "DISPUTED"
                          ? `Verification is currently unresolved and undergoing neutral administrator review (${myDonation.dispute_reason || "unresolved"}). No points or scores are affected while under review.`
                          : "Status: " + myDonation.status}
                      </p>
                      {myDonation.donor_rating && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-1">
                          Rating received: ★ {myDonation.donor_rating} / 5
                          {myDonation.donor_review && ` — "${myDonation.donor_review}"`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {isAuthenticated ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsResponseModalOpen(true)}
                      disabled={hasRespondedLocally}
                      className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-2xs transition disabled:opacity-50 cursor-pointer"
                    >
                      <span>❤️</span>
                      <span>{hasRespondedLocally ? "Response Sent ✓" : "I Can Help (Donate Blood)"}</span>
                    </button>

                    {!donations.some((d) => d.donor_id === user?.id) && (
                      <button
                        type="button"
                        onClick={handleClaimDonation}
                        disabled={claimingDonation}
                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 hover:bg-emerald-800 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-2xs transition disabled:opacity-50 cursor-pointer"
                      >
                        <span>🩸</span>
                        <span>{claimingDonation ? "Submitting Claim..." : "I Donated Blood"}</span>
                      </button>
                    )}
                  </>
                ) : (
                  <Link
                    href={`/login?redirect=/blood-help/${request.id}`}
                    className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-2xs transition"
                  >
                    <span>❤️</span>
                    <span>Sign In to Volunteer or Claim Donation</span>
                  </Link>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsFlagModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <span>🚩</span>
                <span>Report Request</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Response Modal */}
      {isResponseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
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
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 min-h-[40px] flex items-center justify-center cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResponse}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-2 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50 min-h-[40px] flex items-center justify-center cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
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
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 min-h-[40px] flex items-center justify-center cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFlag}
                  className="rounded-xl bg-red-600 hover:bg-red-700 px-5 py-2 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50 min-h-[40px] flex items-center justify-center cursor-pointer"
                >
                  {submittingFlag ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {disputeDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>⚠️</span> Dispute Donation Claim
                </h3>
                <p className="text-xs text-zinc-500">
                  Donor: {disputeDonation.donor_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDisputeDonation(null)}
                className="rounded-xl p-1.5 text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-bold">Important Notice:</p>
              <p className="text-[11px] leading-relaxed">
                Disputing this claim flags it for administrative oversight. No community points will be awarded until reviewed by platform moderators.
              </p>
            </div>

            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Reason for Dispute <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. The volunteer did not arrive at the hospital, or another donor provided the blood."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDisputeDonation(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 min-h-[40px] flex items-center justify-center cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispute || disputeReason.trim().length < 3}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-2 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50 min-h-[40px] flex items-center justify-center cursor-pointer"
                >
                  {submittingDispute ? "Submitting..." : "Submit Dispute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Donor Rating Modal */}
      {ratingDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>⭐</span> Rate Volunteer Donor
                </h3>
                <p className="text-xs text-zinc-500">
                  Donor: {ratingDonation.donor_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRatingDonation(null)}
                className="rounded-xl p-1.5 text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Rating (1 to 5 Stars)
                </label>
                <div className="flex items-center gap-2 justify-center py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSelectedRating(star)}
                      className="text-3xl transition transform hover:scale-125 focus:outline-none cursor-pointer"
                    >
                      {star <= selectedRating ? (
                        <span className="text-amber-400">★</span>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">☆</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="text-center text-xs font-bold text-amber-600 dark:text-amber-400">
                  {selectedRating === 5
                    ? "⭐⭐⭐⭐⭐ Outstanding / Lifesaver!"
                    : selectedRating === 4
                    ? "⭐⭐⭐⭐ Very Helpful & Reliable"
                    : selectedRating === 3
                    ? "⭐⭐⭐ Helpful"
                    : selectedRating === 2
                    ? "⭐⭐ Below Expectations"
                    : "⭐ Poor Assistance"}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Appreciation or Feedback Note (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Arrived on time at the hospital, very polite and helpful."
                  value={donorReview}
                  onChange={(e) => setDonorReview(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRatingDonation(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 min-h-[40px] flex items-center justify-center cursor-pointer"
                >
                  Skip
                </button>
                <button
                  type="submit"
                  disabled={submittingRating}
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50 min-h-[40px] flex items-center justify-center cursor-pointer"
                >
                  {submittingRating ? "Submitting..." : "Submit Rating"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
