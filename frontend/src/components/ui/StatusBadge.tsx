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
    case "VERIFIED":
      return (
        <Badge variant="primary" size={size} dot pulse className={className}>
          {lang === "bn" ? "যাচাইকৃত" : "Verified"}
        </Badge>
      );

    // Active Missing Person Alert / Emergency / Urgent
    case "ALERT_ACTIVE":
    case "ACTIVE":
    case "URGENT":
    case "EMERGENCY":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-bold text-white bg-red-600 rounded-full px-2.5 py-0.5 text-[11px] shadow-2xs select-none ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          <span>
            {normalized === "URGENT" || normalized === "EMERGENCY"
              ? lang === "bn"
                ? "জরুরি"
                : "Urgent"
              : lang === "bn"
              ? "সক্রিয় অ্যালার্ট"
              : "Active Alert"}
          </span>
        </span>
      );

    // Found / Safe / Completed / Fulfilled
    case "FOUND":
    case "COMPLETED":
    case "FULFILLED":
      return (
        <Badge variant="success" size={size} dot className={className}>
          {normalized === "FOUND"
            ? lang === "bn"
              ? "নিরাপদ / উদ্ধার"
              : "Found & Safe"
            : lang === "bn"
            ? "সম্পন্ন"
            : "Completed"}
        </Badge>
      );

    // Submitted / Under Review / Pending
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

    // Disputed / Flagged
    case "DISPUTED":
      return (
        <Badge variant="warning" size={size} dot className={className}>
          {lang === "bn" ? "বিতর্কিত" : "Disputed"}
        </Badge>
      );

    // Open / Available
    case "OPEN":
    case "IN_PROGRESS":
      return (
        <Badge variant="info" size={size} dot className={className}>
          {normalized === "OPEN"
            ? lang === "bn"
              ? "উন্মুক্ত"
              : "Open"
            : lang === "bn"
            ? "চলমান"
            : "In Progress"}
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

    // Draft / Cancelled
    case "DRAFT":
    case "CANCELLED":
      return (
        <Badge variant="neutral" size={size} className={className}>
          {normalized === "CANCELLED"
            ? lang === "bn"
              ? "বাতিল"
              : "Cancelled"
            : lang === "bn"
            ? "খসড়া"
            : "Draft"}
        </Badge>
      );

    // Archived / Expired / Closed
    case "ARCHIVED":
    case "EXPIRED":
    case "CLOSED":
      return (
        <Badge variant="default" size={size} className={className}>
          {normalized === "ARCHIVED"
            ? lang === "bn"
              ? "সংরক্ষিত"
              : "Archived"
            : lang === "bn"
            ? "সমাপ্ত"
            : "Closed"}
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
