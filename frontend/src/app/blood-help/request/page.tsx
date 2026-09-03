"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { BloodGroup, BloodUrgency, PublicBloodRequest } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const BD_DISTRICTS = [
  "Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Rangpur", "Mymensingh",
  "Gazipur", "Narayanganj", "Cumilla", "Bogura", "Cox's Bazar", "Noakhali", "Feni", "Brahmanbaria",
  "Jessore", "Kushtia", "Pabna", "Dinajpur", "Tangail", "Faridpur", "Jamalpur"
];

export default function CreateBloodRequestPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [bloodGroup, setBloodGroup] = useState<BloodGroup>("O+");
  const [unitsRequired, setUnitsRequired] = useState<number>(1);
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalArea, setHospitalArea] = useState("");
  const [district, setDistrict] = useState("Dhaka");
  const [requiredDate, setRequiredDate] = useState("");
  const [requiredTime, setRequiredTime] = useState("");
  const [urgency, setUrgency] = useState<BloodUrgency>("URGENT");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMethod, setContactMethod] = useState("PHONE");
  const [additionalInfo, setAdditionalInfo] = useState("");

  React.useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setRequiredDate(tomorrow.toISOString().slice(0, 10));
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="py-20 text-center text-xs text-zinc-400">
        Checking authentication...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <span className="text-4xl">🔒</span>
        <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-100">
          Sign In Required to Request Blood
        </h1>
        <p className="text-xs text-zinc-500 max-w-md mx-auto">
          To protect community donors and prevent misuse, you must sign in to submit a verified blood request.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            href="/login?redirect=/blood-help/request"
            className="rounded-2xl bg-rose-600 hover:bg-rose-700 px-5 py-2.5 text-xs font-bold text-white shadow-2xs transition"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="rounded-2xl border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Register
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospitalName.trim() || !hospitalArea.trim()) {
      setError("Please provide hospital name and local area.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      blood_group: bloodGroup,
      units_required: unitsRequired,
      hospital_name: hospitalName.trim(),
      hospital_area: hospitalArea.trim(),
      district,
      required_date: new Date(requiredDate).toISOString(),
      required_time: requiredTime.trim() || undefined,
      urgency,
      contact_name: contactName.trim() || undefined,
      contact_phone: contactPhone.trim() || undefined,
      contact_method: contactMethod,
      additional_information: additionalInfo.trim() || undefined,
    };

    try {
      const created = await apiFetch<PublicBloodRequest>("/blood/requests", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/blood-help/${created.id}`);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Back Link */}
      <Link
        href="/blood-help"
        className="text-xs font-bold text-zinc-500 hover:text-rose-600 inline-flex items-center gap-1.5 transition"
      >
        <span>←</span>
        <span>Back to Blood Help Hub</span>
      </Link>

      {/* Main Form Container */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-10 shadow-2xs space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60">
            <span>🚨</span>
            <span>Emergency Blood Request</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
            Create Community Blood Request
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Notify eligible nearby donors in your district immediately.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Blood Group */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
              Blood Group Needed *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {BLOOD_GROUPS.map((bg) => (
                <button
                  type="button"
                  key={bg}
                  onClick={() => setBloodGroup(bg)}
                  className={`rounded-2xl py-3 text-xs font-black transition cursor-pointer border ${
                    bloodGroup === bg
                      ? "bg-rose-600 text-white border-rose-600 shadow-2xs scale-[1.02]"
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-rose-400"
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>

          {/* Units & Urgency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Units / Bags Required *
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={unitsRequired}
                onChange={(e) => setUnitsRequired(parseInt(e.target.value) || 1)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Urgency Level *
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as BloodUrgency)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600 font-bold"
              >
                <option value="EMERGENCY">🚨 Emergency (Immediate Need / Operation)</option>
                <option value="URGENT">⚠️ Urgent (Needed within 24 hours)</option>
                <option value="NORMAL">ℹ️ Normal (Scheduled in advance)</option>
              </select>
            </div>
          </div>

          {/* Hospital Name & Area */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Hospital / Medical Center *
              </label>
              <input
                type="text"
                placeholder="e.g. Square Hospital, Dhaka Medical"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Hospital Area / Location *
              </label>
              <input
                type="text"
                placeholder="e.g. Panthapath, Dhanmondi"
                value={hospitalArea}
                onChange={(e) => setHospitalArea(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                required
              />
            </div>
          </div>

          {/* District, Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                District *
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
              >
                {BD_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Required Date *
              </label>
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Required Time / Shift
              </label>
              <input
                type="text"
                placeholder="e.g. 2:00 PM / Morning"
                value={requiredTime}
                onChange={(e) => setRequiredTime(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Contact Person Name
              </label>
              <input
                type="text"
                placeholder="e.g. Patient Relative"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Emergency Phone Number
              </label>
              <input
                type="tel"
                placeholder="e.g. 017xxxxxxxx"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Contact Method
              </label>
              <select
                value={contactMethod}
                onChange={(e) => setContactMethod(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
              >
                <option value="PHONE">Phone Call</option>
                <option value="IN_APP">In-App Notification</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Additional Context / Case Details
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Operation scheduled in 4 hours, patient admitted in Ward 5 Bed 12. Donor can contact attendant directly upon arrival."
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
            />
          </div>

          {/* Privacy Protection Notice */}
          <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/20 p-4 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            🛡️ <strong>Privacy Protection Guaranteed:</strong> Your patient&apos;s home address and exact GPS coordinates are NEVER collected or broadcasted. Only the public hospital name, area, and urgency are published on the emergency board.
          </div>

          {/* Submit CTA */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/blood-help"
              className="rounded-xl px-5 py-2.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-2xl bg-rose-600 hover:bg-rose-700 px-6 py-3 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Publishing..." : "Publish Blood Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
