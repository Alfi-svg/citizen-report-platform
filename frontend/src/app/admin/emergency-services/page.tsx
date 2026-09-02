"use client";

import React, { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { apiFetch } from "@/lib/api";
import {
  EmergencyService,
  AdminEmergencyServicePagination,
  ServiceType,
  VerificationStatus,
  SafetyDirectoryMetrics,
  SafetyServiceVerificationAudit,
  SafetyServiceDuplicateCandidate,
} from "@/lib/types";

const DIVISIONS = [
  "Dhaka",
  "Chittagong",
  "Rajshahi",
  "Khulna",
  "Barisal",
  "Sylhet",
  "Rangpur",
  "Mymensingh",
];

export default function AdminEmergencyServicesPage() {
  const [data, setData] = useState<AdminEmergencyServicePagination | null>(null);
  const [metrics, setMetrics] = useState<SafetyDirectoryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedFreshness, setSelectedFreshness] = useState<string>("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionSubmitting, setBulkActionSubmitting] = useState(false);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<EmergencyService | null>(null);

  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<EmergencyService | null>(null);
  const [verifySource, setVerifySource] = useState("Official Bangladesh Police Directory");
  const [verifySourceUrl, setVerifySourceUrl] = useState("");
  const [verifyNotes, setVerifyNotes] = useState("");

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<EmergencyService | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyService, setHistoryService] = useState<EmergencyService | null>(null);
  const [historyLogs, setHistoryLogs] = useState<SafetyServiceVerificationAudit[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicates, setDuplicates] = useState<SafetyServiceDuplicateCandidate[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [importResult, setImportResult] = useState<{ total: number; imported: number; duplicates: number; errors: string[] } | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // Form data for create/edit
  const [formData, setFormData] = useState({
    name: "",
    name_bn: "",
    service_type: "POLICE_STATION" as ServiceType,
    division: "Dhaka",
    district: "Dhaka",
    area: "",
    address: "",
    address_bn: "",
    phone: "",
    alternate_phone: "",
    latitude: 23.7461 as number | null,
    longitude: 90.3742 as number | null,
    source: "Official Bangladesh Police Directory",
    source_url: "",
    verification_status: "UNVERIFIED" as VerificationStatus,
    is_active: true,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load KPI Metrics
  const loadMetrics = () => {
    apiFetch<SafetyDirectoryMetrics>("/admin/safety/services/metrics")
      .then((res) => setMetrics(res))
      .catch(() => {});
  };

  // Load Directory Services
  const loadServices = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.append("search", search.trim());
    if (selectedType) params.append("service_type", selectedType);
    if (selectedDivision) params.append("division", selectedDivision);
    if (selectedDistrict) params.append("district", selectedDistrict);
    if (selectedStatus) params.append("verification_status", selectedStatus);
    if (selectedFreshness) params.append("freshness", selectedFreshness);
    params.append("limit", PAGE_SIZE.toString());
    params.append("offset", (page * PAGE_SIZE).toString());

    apiFetch<AdminEmergencyServicePagination>(`/admin/safety/services?${params.toString()}`)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  useEffect(() => {
    loadServices();
  }, [search, selectedType, selectedDivision, selectedDistrict, selectedStatus, selectedFreshness, page]);

  // Bulk Selection Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && data) {
      setSelectedIds(data.items.map((i) => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkAction = async (action: "NEEDS_REVIEW" | "DEACTIVATE") => {
    if (selectedIds.length === 0) return;
    setBulkActionSubmitting(true);
    try {
      await apiFetch("/admin/safety/services/bulk-action", {
        method: "POST",
        body: JSON.stringify({
          service_ids: selectedIds,
          action,
          admin_notes: `Bulk action performed via admin console on ${selectedIds.length} records.`,
        }),
      });
      setSelectedIds([]);
      loadServices();
      loadMetrics();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBulkActionSubmitting(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingService(null);
    setFormData({
      name: "",
      name_bn: "",
      service_type: "POLICE_STATION",
      division: "Dhaka",
      district: "Dhaka",
      area: "",
      address: "",
      address_bn: "",
      phone: "",
      alternate_phone: "",
      latitude: 23.7461,
      longitude: 90.3742,
      source: "Official Bangladesh Police Directory",
      source_url: "",
      verification_status: "UNVERIFIED",
      is_active: true,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (service: EmergencyService) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      name_bn: service.name_bn || "",
      service_type: service.service_type,
      division: service.division || "Dhaka",
      district: service.district,
      area: service.area,
      address: service.address,
      address_bn: service.address_bn || "",
      phone: service.phone,
      alternate_phone: service.alternate_phone || "",
      latitude: service.latitude ?? null,
      longitude: service.longitude ?? null,
      source: service.source,
      source_url: service.source_url || "",
      verification_status: service.verification_status,
      is_active: service.is_active,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Save Service (Create or Update)
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    const payload = {
      ...formData,
      name_bn: formData.name_bn.trim() || null,
      address_bn: formData.address_bn.trim() || null,
      alternate_phone: formData.alternate_phone.trim() || null,
      source_url: formData.source_url.trim() || null,
      latitude: formData.latitude !== null && !isNaN(Number(formData.latitude)) ? Number(formData.latitude) : null,
      longitude: formData.longitude !== null && !isNaN(Number(formData.longitude)) ? Number(formData.longitude) : null,
    };

    try {
      if (editingService) {
        await apiFetch(`/admin/safety/services/${editingService.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/admin/safety/services", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setIsEditModalOpen(false);
      loadServices();
      loadMetrics();
    } catch (err: unknown) {
      if (err instanceof Error) setFormError(err.message);
      else setFormError("Failed to save service record.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Verify Action
  const handleOpenVerify = (svc: EmergencyService) => {
    setVerifyTarget(svc);
    setVerifySource(svc.source || "Official Bangladesh Police Directory");
    setVerifySourceUrl(svc.source_url || "");
    setVerifyNotes("");
    setIsVerifyModalOpen(true);
  };

  const handleConfirmVerify = async () => {
    if (!verifyTarget) return;
    try {
      await apiFetch(`/admin/safety/services/${verifyTarget.id}/verify`, {
        method: "POST",
        body: JSON.stringify({
          source: verifySource.trim(),
          source_url: verifySourceUrl.trim() || null,
          verification_notes: verifyNotes.trim() || "Verified by authorized administrator.",
        }),
      });
      setIsVerifyModalOpen(false);
      loadServices();
      loadMetrics();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Verification failed");
    }
  };

  // Mark Needs Review
  const handleOpenReview = (svc: EmergencyService) => {
    setReviewTarget(svc);
    setReviewNotes("");
    setIsReviewModalOpen(true);
  };

  const handleConfirmReview = async () => {
    if (!reviewTarget || !reviewNotes.trim()) return;
    try {
      await apiFetch(`/admin/safety/services/${reviewTarget.id}/needs-review`, {
        method: "POST",
        body: JSON.stringify({
          verification_notes: reviewNotes.trim(),
        }),
      });
      setIsReviewModalOpen(false);
      loadServices();
      loadMetrics();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  };

  // Mark Outdated
  const handleMarkOutdated = async (svc: EmergencyService) => {
    if (!confirm(`Mark "${svc.name}" as OUTDATED?`)) return;
    try {
      await apiFetch(`/admin/safety/services/${svc.id}/mark-outdated`, { method: "POST" });
      loadServices();
      loadMetrics();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  };

  // Deactivate
  const handleDeactivate = async (svc: EmergencyService) => {
    if (!confirm(`Deactivate "${svc.name}"? It will no longer be visible in public search results.`)) return;
    try {
      await apiFetch(`/admin/safety/services/${svc.id}/deactivate`, { method: "POST" });
      loadServices();
      loadMetrics();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  };

  // Reactivate
  const handleReactivate = async (svc: EmergencyService) => {
    try {
      await apiFetch(`/admin/safety/services/${svc.id}/reactivate`, { method: "POST" });
      loadServices();
      loadMetrics();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  };

  // Open Audit History Modal
  const handleOpenHistory = (svc: EmergencyService) => {
    setHistoryService(svc);
    setHistoryLoading(true);
    setIsHistoryModalOpen(true);
    apiFetch<SafetyServiceVerificationAudit[]>(`/admin/safety/services/${svc.id}/history`)
      .then((res) => setHistoryLogs(res))
      .catch(() => setHistoryLogs([]))
      .finally(() => setHistoryLoading(false));
  };

  // Open Duplicate Detection Modal
  const handleOpenDuplicates = () => {
    setIsDuplicateModalOpen(true);
    setDuplicatesLoading(true);
    apiFetch<SafetyServiceDuplicateCandidate[]>("/admin/safety/services/duplicates")
      .then((res) => setDuplicates(res))
      .catch(() => setDuplicates([]))
      .finally(() => setDuplicatesLoading(false));
  };

  // Batch Import
  const handleBatchImport = async () => {
    if (!importJsonText.trim()) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const parsed = JSON.parse(importJsonText);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      const res = await apiFetch<{
        total_rows: number;
        imported_count: number;
        duplicate_count: number;
        error_count: number;
        errors: string[];
      }>("/admin/safety/services/import", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      setImportResult({
        total: res.total_rows,
        imported: res.imported_count,
        duplicates: res.duplicate_count,
        errors: res.errors,
      });
      loadServices();
      loadMetrics();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Import parsing failed");
    } finally {
      setImportLoading(false);
    }
  };

  const getStatusBadge = (status: VerificationStatus, is_active: boolean) => {
    if (!is_active || status === "INACTIVE") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
          Inactive
        </span>
      );
    }
    switch (status) {
      case "VERIFIED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
            ✓ Verified
          </span>
        );
      case "NEEDS_REVIEW":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
            ⚠️ Review Needed
          </span>
        );
      case "OUTDATED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
            🕒 Outdated
          </span>
        );
      case "PENDING_VERIFICATION":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
            ⏳ Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
            Unverified
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-16">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <span>🛡️</span>
              <span>Official Bangladesh Safety Directory Verification</span>
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Audit, verify, and maintain official police, fire, and emergency service contact records with strict audit logging.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleOpenDuplicates}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 transition shadow-xs"
            >
              <span>🔍</span>
              <span>Check Duplicates</span>
            </button>
            <button
              onClick={() => {
                setIsImportModalOpen(true);
                setImportResult(null);
                setImportJsonText("");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 transition shadow-xs"
            >
              <span>📥</span>
              <span>Batch Import</span>
            </button>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition active:scale-95"
            >
              <span>+</span>
              <span>New Service</span>
            </button>
          </div>
        </div>

        {/* KPI Metrics Summary Bar */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 shadow-xs">
              <p className="text-[11px] font-semibold text-zinc-500">Total Services</p>
              <p className="text-xl font-black text-zinc-900 dark:text-zinc-100 mt-1">{metrics.total_services}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-3 shadow-xs">
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Verified Active</p>
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{metrics.verified_count}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-3 shadow-xs">
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Unverified Queue</p>
              <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">{metrics.unverified_count}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-orange-200 dark:border-orange-900/40 rounded-2xl p-3 shadow-xs">
              <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400">Needs Review</p>
              <p className="text-xl font-black text-orange-700 dark:text-orange-300 mt-1">{metrics.needs_review_count}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/40 rounded-2xl p-3 shadow-xs">
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">Outdated (&gt;90d)</p>
              <p className="text-xl font-black text-rose-700 dark:text-rose-300 mt-1">{metrics.outdated_count}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-3 shadow-xs">
              <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">Verified (30d)</p>
              <p className="text-xl font-black text-blue-700 dark:text-blue-300 mt-1">{metrics.recently_verified_count}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 shadow-xs">
              <p className="text-[11px] font-semibold text-zinc-400">Inactive</p>
              <p className="text-xl font-black text-zinc-500 mt-1">{metrics.inactive_count}</p>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div className="lg:col-span-2">
              <input
                type="text"
                placeholder="Search name, area, address, phone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Service Type */}
            <div>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setPage(0);
                }}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Service Types</option>
                <option value="POLICE_STATION">Police Station</option>
                <option value="POLICE_BOX">Police Box</option>
                <option value="FIRE_SERVICE">Fire Service</option>
                <option value="EMERGENCY_SERVICE">Emergency Service</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Division */}
            <div>
              <select
                value={selectedDivision}
                onChange={(e) => {
                  setSelectedDivision(e.target.value);
                  setPage(0);
                }}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Divisions</option>
                {DIVISIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Verification Status */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(0);
                }}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Statuses</option>
                <option value="VERIFIED">Verified</option>
                <option value="UNVERIFIED">Unverified</option>
                <option value="NEEDS_REVIEW">Needs Review</option>
                <option value="OUTDATED">Outdated</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            {/* Freshness Filter */}
            <div>
              <select
                value={selectedFreshness}
                onChange={(e) => {
                  setSelectedFreshness(e.target.value);
                  setPage(0);
                }}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Freshness</option>
                <option value="fresh">Fresh (≤90 days)</option>
                <option value="outdated">Outdated (&gt;90 days)</option>
                <option value="unverified">Unverified Queue</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Actions Banner */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900 text-white shadow-md">
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-emerald-400 font-bold">
                {selectedIds.length}
              </span>
              <span>records selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={bulkActionSubmitting}
                onClick={() => handleBulkAction("NEEDS_REVIEW")}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-50"
              >
                Bulk Mark Review
              </button>
              <button
                disabled={bulkActionSubmitting}
                onClick={() => handleBulkAction("DEACTIVATE")}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50"
              >
                Bulk Deactivate
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Services Table */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5 w-8">
                    <input
                      type="checkbox"
                      checked={data ? selectedIds.length === data.items.length && data.items.length > 0 : false}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="p-3.5">Service Name & Type</th>
                  <th className="p-3.5">Location</th>
                  <th className="p-3.5">Contact</th>
                  <th className="p-3.5">Status & Freshness</th>
                  <th className="p-3.5">Source</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-400 font-semibold">
                      Loading safety directory records...
                    </td>
                  </tr>
                ) : data && data.items.length > 0 ? (
                  data.items.map((svc) => (
                    <tr
                      key={svc.id}
                      className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition ${
                        selectedIds.includes(svc.id) ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
                      }`}
                    >
                      <td className="p-3.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(svc.id)}
                          onChange={() => handleSelectRow(svc.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-3.5 space-y-0.5">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <span>{svc.name}</span>
                          {svc.latitude === null && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-medium">
                              No GPS
                            </span>
                          )}
                        </div>
                        {svc.name_bn && (
                          <div className="text-[11px] text-zinc-400">{svc.name_bn}</div>
                        )}
                        <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
                          {svc.service_type.replace("_", " ")}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="text-zinc-900 dark:text-zinc-100 font-medium">
                          {svc.area}, {svc.district}
                        </div>
                        {svc.division && (
                          <div className="text-[10px] text-zinc-400">{svc.division} Div.</div>
                        )}
                        <div className="text-[11px] text-zinc-500 line-clamp-1">{svc.address}</div>
                      </td>
                      <td className="p-3.5 space-y-0.5">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">
                          <a href={`tel:${svc.phone}`} className="hover:underline text-emerald-600 dark:text-emerald-400">
                            {svc.phone}
                          </a>
                        </div>
                        {svc.alternate_phone && (
                          <div className="text-[11px] text-zinc-500">Alt: {svc.alternate_phone}</div>
                        )}
                      </td>
                      <td className="p-3.5 space-y-1">
                        <div>{getStatusBadge(svc.verification_status, svc.is_active)}</div>
                        {svc.last_verified_at ? (
                          <div className="text-[10px] text-zinc-500">
                            {new Date(svc.last_verified_at).toLocaleDateString()}
                          </div>
                        ) : (
                          <div className="text-[10px] text-zinc-400 italic">Never verified</div>
                        )}
                      </td>
                      <td className="p-3.5 space-y-0.5 max-w-[150px]">
                        <div className="text-[11px] text-zinc-700 dark:text-zinc-300 truncate" title={svc.source}>
                          {svc.source}
                        </div>
                        {svc.source_url && (
                          <a
                            href={svc.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                          >
                            <span>Link</span>
                            <span>↗</span>
                          </a>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Verify Action */}
                          {svc.verification_status !== "VERIFIED" && svc.is_active && (
                            <button
                              onClick={() => handleOpenVerify(svc)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs"
                            >
                              Verify
                            </button>
                          )}

                          {/* Review Action */}
                          {svc.verification_status === "VERIFIED" && svc.is_active && (
                            <button
                              onClick={() => handleOpenReview(svc)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition"
                            >
                              Review
                            </button>
                          )}

                          {/* Outdated Action */}
                          {svc.verification_status === "VERIFIED" && (
                            <button
                              onClick={() => handleMarkOutdated(svc)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 transition"
                            >
                              Outdated
                            </button>
                          )}

                          {/* Edit Action */}
                          <button
                            onClick={() => handleOpenEdit(svc)}
                            className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 transition"
                          >
                            Edit
                          </button>

                          {/* Audit History */}
                          <button
                            onClick={() => handleOpenHistory(svc)}
                            className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 transition"
                            title="View verification audit trail"
                          >
                            📜
                          </button>

                          {/* Deactivate / Reactivate */}
                          {svc.is_active ? (
                            <button
                              onClick={() => handleDeactivate(svc)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 transition"
                              title="Deactivate service"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(svc)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 hover:bg-blue-100 transition"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-400 font-semibold">
                      No emergency services match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          {data && data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between p-4 border-t border-zinc-200 dark:border-zinc-800 text-xs">
              <span className="text-zinc-500 font-medium">
                Showing {data.offset + 1} - {Math.min(data.offset + PAGE_SIZE, data.total)} of {data.total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={(page + 1) * PAGE_SIZE >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL 1: VERIFY CONFIRMATION */}
      {isVerifyModalOpen && verifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>✓</span>
              <span>Verify Directory Record</span>
            </h3>
            <p className="text-xs text-zinc-500">
              You are verifying <strong className="text-zinc-800 dark:text-zinc-200">{verifyTarget.name}</strong>.
              This will mark the service as officially verified with your admin credentials recorded in the audit log.
            </p>

            <div className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Official Source Name *
                </label>
                <input
                  type="text"
                  required
                  value={verifySource}
                  onChange={(e) => setVerifySource(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Official Source / Directory URL
                </label>
                <input
                  type="url"
                  placeholder="https://dmp.gov.bd/roster"
                  value={verifySourceUrl}
                  onChange={(e) => setVerifySourceUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Internal Verification Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Cross-referenced with official DMP police directory 2026."
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setIsVerifyModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVerify}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              >
                Confirm Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MARK NEEDS REVIEW */}
      {isReviewModalOpen && reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-amber-600 flex items-center gap-2">
              <span>⚠️</span>
              <span>Mark Record For Review</span>
            </h3>
            <p className="text-xs text-zinc-500">
              State the reason why <strong className="text-zinc-800 dark:text-zinc-200">{reviewTarget.name}</strong> requires verification review.
            </p>

            <div className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Reason for Review *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Phone number reported disconnected by citizen; needs contact re-check."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reviewNotes.trim()}
                onClick={handleConfirmReview}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-sm disabled:opacity-50"
              >
                Confirm Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: AUDIT HISTORY TIMELINE */}
      {isHistoryModalOpen && historyService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>📜</span>
                  <span>Verification & Audit History</span>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">{historyService.name} ({historyService.district})</p>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {historyLoading ? (
                <div className="p-8 text-center text-zinc-400 font-semibold">Loading audit logs...</div>
              ) : historyLogs.length === 0 ? (
                <div className="p-8 text-center text-zinc-400">No audit events recorded for this service.</div>
              ) : (
                historyLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">
                        {log.previous_status} → <span className="text-emerald-600 dark:text-emerald-400">{log.new_status}</span>
                      </span>
                      <span className="text-zinc-400">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    {log.verification_notes && (
                      <p className="text-zinc-600 dark:text-zinc-400 italic bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        &quot;{log.verification_notes}&quot;
                      </p>
                    )}
                    {log.source && (
                      <div className="text-[10px] text-zinc-500">
                        Source: {log.source} {log.source_url && `(${log.source_url})`}
                      </div>
                    )}
                    {log.changed_fields && (
                      <div className="text-[10px] text-zinc-400 font-mono overflow-x-auto">
                        Changes: {log.changed_fields}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DUPLICATE CANDIDATES */}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>🔍</span>
                  <span>Potential Duplicate Service Records</span>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Records matching identical contact numbers, locations, or names across the directory.
                </p>
              </div>
              <button
                onClick={() => setIsDuplicateModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {duplicatesLoading ? (
                <div className="p-8 text-center text-zinc-400 font-semibold">Scanning directory for duplicates...</div>
              ) : duplicates.length === 0 ? (
                <div className="p-8 text-center text-emerald-600 dark:text-emerald-400 font-semibold">
                  ✓ No duplicate candidate records detected in the active directory!
                </div>
              ) : (
                duplicates.map((dup, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-2"
                  >
                    <div className="flex items-center justify-between font-bold text-amber-800 dark:text-amber-300">
                      <span>Reason: {dup.reason}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                        Duplicate Candidate
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-amber-100 dark:border-amber-900/40">
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{dup.service_name}</p>
                        <p className="text-zinc-500 text-[11px]">{dup.district} • {dup.phone}</p>
                      </div>
                      <div className="border-l border-zinc-100 dark:border-zinc-800 pl-3">
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{dup.duplicate_with_name}</p>
                        <p className="text-zinc-500 text-[11px]">{dup.duplicate_with_phone}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setIsDuplicateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: BATCH IMPORT */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>📥</span>
                  <span>Safe Batch Directory Ingest</span>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  All imported rows enter the queue as UNVERIFIED. Coordinates and Bangladesh phone formats are strictly validated.
                </p>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  JSON Dataset Array (Paste array of objects)
                </label>
                <textarea
                  rows={8}
                  placeholder={`[\n  {\n    "name": "Badda Police Box",\n    "service_type": "POLICE_BOX",\n    "division": "Dhaka",\n    "district": "Dhaka",\n    "area": "Badda",\n    "address": "Pragoti Sarani, Badda",\n    "phone": "+8801711000000",\n    "latitude": 23.7800,\n    "longitude": 90.4200,\n    "source": "Official DMP Portal"\n  }\n]`}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  className="w-full px-3 py-2 font-mono text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {importResult && (
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 space-y-1">
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">
                    Import Result: {importResult.imported} of {importResult.total} imported.
                  </p>
                  <p className="text-zinc-500">
                    Duplicates skipped: {importResult.duplicates} | Errors: {importResult.errors.length}
                  </p>
                  {importResult.errors.length > 0 && (
                    <ul className="text-rose-600 dark:text-rose-400 list-disc list-inside mt-1">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importLoading || !importJsonText.trim()}
                onClick={handleBatchImport}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm disabled:opacity-50"
              >
                {importLoading ? "Ingesting..." : "Ingest As Unverified"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: CREATE / EDIT SERVICE */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
              {editingService ? `Edit Service: ${editingService.name}` : "Create New Emergency Service"}
            </h3>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveService} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Name (English) *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Name (Bangla)</label>
                  <input
                    type="text"
                    value={formData.name_bn}
                    onChange={(e) => setFormData({ ...formData, name_bn: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Service Type *</label>
                  <select
                    value={formData.service_type}
                    onChange={(e) => setFormData({ ...formData, service_type: e.target.value as ServiceType })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="POLICE_STATION">Police Station</option>
                    <option value="POLICE_BOX">Police Box</option>
                    <option value="FIRE_SERVICE">Fire Service</option>
                    <option value="EMERGENCY_SERVICE">Emergency Service</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Division</label>
                  <select
                    value={formData.division}
                    onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  >
                    {DIVISIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">District *</label>
                  <input
                    type="text"
                    required
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Thana / Area *</label>
                  <input
                    type="text"
                    required
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Primary Phone / Hotline *</label>
                  <input
                    type="text"
                    required
                    placeholder="+8801XXXXXXXXX or 999"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Address (English) *</label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Address (Bangla)</label>
                  <input
                    type="text"
                    value={formData.address_bn}
                    onChange={(e) => setFormData({ ...formData, address_bn: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Latitude (optional)</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="23.7461"
                    value={formData.latitude ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, latitude: e.target.value === "" ? null : parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Longitude (optional)</label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="90.3742"
                    value={formData.longitude ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, longitude: e.target.value === "" ? null : parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Source Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Source URL</label>
                  <input
                    type="url"
                    value={formData.source_url}
                    onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm disabled:opacity-50"
                >
                  {formSubmitting ? "Saving..." : editingService ? "Update Service" : "Create Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
