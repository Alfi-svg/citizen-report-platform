"use client";

import React from "react";
import { Badge, BadgeSize } from "./Badge";

export interface StatusBadgeProps {
  status: string;
  lang?: "en" | "bn";
  size?: BadgeSize;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  lang = "en",
  size = "md",
  className = "",
}) => {
  const normalized = (status || "").toUpperCase();

  switch (normalized) {
    // Approved / Verified
    case "APPROVED":
    case "OFFICIAL_VERIFIED":
    case "SIGHTING_VERIFIED":
      return (
        <Badge variant="primary" size={size} dot pulse className={className}>
          {lang === "bn" ? "যাচাইকৃত" : "Verified"}
        </Badge>
      );

    // Active Missing Person Alert (High Urgency)
    case "ALERT_ACTIVE":
    case "ACTIVE":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-black text-white bg-red-600 rounded-full px-2.5 py-0.5 text-[11px] shadow-2xs select-none ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
          <span>{lang === "bn" ? "🚨 সক্রিয় অ্যালার্ট" : "🚨 Active Alert"}</span>
        </span>
      );

    // Found / Safe
    case "FOUND":
      return (
        <Badge variant="success" size={size} dot className={className}>
          {lang === "bn" ? "নিরাপদ / উদ্ধার" : "Found & Safe"}
        </Badge>
      );

    // Submitted / Under Review
    case "SUBMITTED":
    case "ALERT_PENDING":
    case "SIGHTING_PENDING":
    case "PENDING_VERIFICATION":
    case "PENDING":
      return (
        <Badge variant="warning" size={size} dot className={className}>
          {lang === "bn" ? "পর্যালোচনাধীন" : "Under Review"}
        </Badge>
      );

    // Rejected / Flagged
    case "REJECTED":
    case "SIGHTING_REJECTED":
    case "FLAGGED_INCORRECT":
      return (
        <Badge variant="danger" size={size} className={className}>
          {lang === "bn" ? "বাতিলকৃত" : "Rejected"}
        </Badge>
      );

    // Needs More Information
    case "NEEDS_MORE_INFORMATION":
      return (
        <Badge variant="info" size={size} dot className={className}>
          {lang === "bn" ? "তথ্য প্রয়োজন" : "Needs Info"}
        </Badge>
      );

    // Draft / Expired / Closed
    case "DRAFT":
      return (
        <Badge variant="neutral" size={size} className={className}>
          {lang === "bn" ? "খসড়া" : "Draft"}
        </Badge>
      );

    case "EXPIRED":
    case "CLOSED":
      return (
        <Badge variant="default" size={size} className={className}>
          {lang === "bn" ? "সমাপ্ত" : "Closed"}
        </Badge>
      );

    default:
      return (
        <Badge variant="default" size={size} className={className}>
          {status}
        </Badge>
      );
  }
};
