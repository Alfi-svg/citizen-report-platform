"use client";

import React, { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { apiFetch } from "@/lib/api";
import {
  EmergencyService,
  AdminEmergencyServicePagination,
  ServiceType,
  VerificationStatus,
} from "@/lib/types";

export default function AdminEmergencyServicesPage() {
  const [data, setData] = useState<AdminEmergencyServicePagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    name_bn: "",
    service_type: "POLICE_STATION" as ServiceType,
    district: "Dhaka",
    area: "",
    address: "",
    address_bn: "",
    phone: "",
    alternate_phone: "",
    latitude: 23.7461,
    longitude: 90.3742,
    source: "Official Bangladesh Police Directory",
    verification_status: "VERIFIED" as VerificationStatus,
    is_active: true,
  });
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadServices = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.append("search", search.trim());
    if (selectedType) params.append("service_type", selectedType);
    if (selectedDistrict) params.append("district", selectedDistrict);
    params.append("limit", PAGE_SIZE.toString());
    params.append("offset", (page * PAGE_SIZE).toString());

    apiFetch<AdminEmergencyServicePagination>(`/admin/emergency-services?${params.toString()}`)
      .then((res) => setData(res))
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadServices();
  }, [search, selectedType, selectedDistrict, page]);

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFormData({
      name: "",
      name_bn: "",
      service_type: "POLICE_STATION",
      district: "Dhaka",
      area: "",
      address: "",
      address_bn: "",
      phone: "",
      alternate_phone: "",
      latitude: 23.7461,
      longitude: 90.3742,
      source: "Official Bangladesh Police Directory",
      verification_status: "VERIFIED",
      is_active: true,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (service: EmergencyService) => {
    setEditingId(service.id);
    setFormData({
      name: service.name,
      name_bn: service.name_bn || "",
      service_type: service.service_type,
      district: service.district,
      area: service.area,
      address: service.address,
      address_bn: service.address_bn || "",
      phone: service.phone,
      alternate_phone: service.alternate_phone || "",
      latitude: service.latitude,
      longitude: service.longitude,
      source: service.source,
      verification_status: service.verification_status,
      is_active: service.is_active,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalSubmitting(true);
    setModalError(null);

    try {
      if (editingId) {
        await apiFetch(`/admin/emergency-services/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
      } else {
        await apiFetch("/admin/emergency-services", {
          method: "POST",
          body: JSON.stringify(formData),
        });
      }
      setIsModalOpen(false);
      loadServices();
    } catch (err: unknown) {
      if (err instanceof Error) setModalError(err.message);
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleToggleActive = async (service: EmergencyService) => {
    try {
      await apiFetch(`/admin/emergency-services/${service.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !service.is_active }),
      });
      loadServices();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
    }
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Admin Navigation Suite */}
      <AdminNav />

      {/* Header & Create Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
            Emergency Services Directory
          </h1>
          <p className="text-xs text-zinc-500">
            Maintain verified official police stations, police boxes, fire services, and emergency contacts.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition shrink-0"
        >
          + Add Emergency Service
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="sm:col-span-5">
          <input
            type="text"
            placeholder="Search by name, area, address, or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">All Service Types</option>
            <option value="POLICE_STATION">Police Station</option>
            <option value="POLICE_BOX">Police Box</option>
            <option value="FIRE_SERVICE">Fire Service</option>
            <option value="EMERGENCY_SERVICE">Emergency Service</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div className="sm:col-span-3">
          <input
            type="text"
            placeholder="Filter district (e.g. Dhaka)..."
            value={selectedDistrict}
            onChange={(e) => {
              setSelectedDistrict(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Directory Table */}
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-xs text-zinc-500">
          No emergency service records match your filter criteria.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 font-semibold text-zinc-900 dark:text-zinc-100">
                <tr>
                  <th className="p-3.5">Name & Area</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Phone</th>
                  <th className="p-3.5">Coordinates</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.items.map((svc) => (
                  <tr key={svc.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">{svc.name}</div>
                      {svc.name_bn && <div className="text-[11px] text-zinc-500">{svc.name_bn}</div>}
                      <div className="text-[11px] text-zinc-400 mt-0.5">{svc.area}, {svc.district}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="inline-flex rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                        {svc.service_type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {svc.phone}
                    </td>
                    <td className="p-3.5 text-zinc-500 font-mono text-[11px]">
                      {svc.latitude.toFixed(4)}, {svc.longitude.toFixed(4)}
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold w-max ${
                          svc.verification_status === "VERIFIED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {svc.verification_status}
                        </span>
                        <span className={`text-[10px] font-semibold ${svc.is_active ? "text-emerald-600" : "text-red-500"}`}>
                          {svc.is_active ? "● Active" : "○ Inactive"}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(svc)}
                        className="font-semibold text-emerald-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(svc)}
                        className={`font-semibold ${svc.is_active ? "text-red-600" : "text-emerald-600"} hover:underline`}
                      >
                        {svc.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-zinc-500">
              Showing {data.items.length} of {data.total} records
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {editingId ? "Edit Emergency Service" : "Add New Emergency Service"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700">
                {modalError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Name (EN) *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Name (BN)</label>
                  <input
                    type="text"
                    value={formData.name_bn}
                    onChange={(e) => setFormData({ ...formData, name_bn: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Service Type *</label>
                  <select
                    value={formData.service_type}
                    onChange={(e) => setFormData({ ...formData, service_type: e.target.value as ServiceType })}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                  >
                    <option value="POLICE_STATION">Police Station</option>
                    <option value="POLICE_BOX">Police Box</option>
                    <option value="FIRE_SERVICE">Fire Service</option>
                    <option value="EMERGENCY_SERVICE">Emergency Service</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">District *</label>
                  <input
                    type="text"
                    required
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Area *</label>
                  <input
                    type="text"
                    required
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Address *</label>
                <textarea
                  required
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Primary Phone *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Alternate Phone</label>
                  <input
                    type="text"
                    value={formData.alternate_phone}
                    onChange={(e) => setFormData({ ...formData, alternate_phone: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Latitude *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Longitude *</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Verification Status</label>
                  <select
                    value={formData.verification_status}
                    onChange={(e) => setFormData({ ...formData, verification_status: e.target.value as VerificationStatus })}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5"
                  >
                    <option value="VERIFIED">Verified</option>
                    <option value="UNVERIFIED">Unverified</option>
                    <option value="PENDING_REVIEW">Pending Review</option>
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="h-4 w-4 rounded text-emerald-600"
                    />
                    <span>Active in Directory</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2 font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
                >
                  {modalSubmitting ? "Saving..." : editingId ? "Save Changes" : "Create Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
