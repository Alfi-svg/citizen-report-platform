/**
 * Emergency Calling Utilities for Bangladesh Citizen Report
 *
 * Provides safe, validated, and offline-independent helpers for initiating
 * emergency calls to official Bangladesh hotlines (e.g. 999, 109, 333, 106).
 *
 * Security & Reliability Guarantees:
 * - Sanitizes all phone inputs to strictly allow digits and '+'
 * - Defaults safely to official national emergency number '999'
 * - Never prompts for or queries GPS location before initiating call
 * - Operates 100% offline without backend API dependencies
 * - Requires 0 sensitive Android permissions (opens native system dialer via tel: URI)
 */

export interface EmergencyHotlineInfo {
  number: string;
  nameEn: string;
  nameBn: string;
  descEn: string;
  descBn: string;
  badge: string;
}

export const BANGLADESH_EMERGENCY_HOTLINES: Record<string, EmergencyHotlineInfo> = {
  "999": {
    number: "999",
    nameEn: "National Emergency Service (Police, Fire, Ambulance)",
    nameBn: "জাতীয় জরুরি সেবা (পুলিশ, ফায়ার সার্ভিস, অ্যাম্বুলেন্স)",
    descEn: "24/7 toll-free emergency hotline across Bangladesh.",
    descBn: "বাংলাদেশব্যাপী ২৪/৭ সার্বক্ষণিক ফ্রি জাতীয় জরুরি হটলাইন।",
    badge: "999",
  },
  "109": {
    number: "109",
    nameEn: "National Women & Children Helpline",
    nameBn: "জাতীয় নারী ও শিশু সুরক্ষা হটলাইন",
    descEn: "Toll-free 24/7 support for prevention of violence against women and children.",
    descBn: "নারী ও শিশু নির্যাতন প্রতিরোধে সার্বক্ষণিক টোল-ফ্রি জাতীয় সেবা।",
    badge: "109",
  },
  "333": {
    number: "333",
    nameEn: "National Citizen Information & Disaster Relief",
    nameBn: "জাতীয় তথ্য ও দুর্যোগ সহায়তা",
    descEn: "Government services, disaster warnings, and administrative helpline.",
    descBn: "সরকারি নাগরিক সেবা ও দুর্যোগ সংক্রান্ত জাতীয় তথ্য হটলাইন।",
    badge: "333",
  },
  "106": {
    number: "106",
    nameEn: "Anti-Corruption Commission (ACC) Helpline",
    nameBn: "দুর্নীতি দমন কমিশন (দুদক) হটলাইন",
    descEn: "Direct helpline for reporting corruption and illicit extortion.",
    descBn: "দুর্নীতি ও ঘুষের অভিযোগ সরাসরি জানানোর জাতীয় হটলাইন।",
    badge: "106",
  },
};

/**
 * Sanitizes phone input to ensure only numeric digits and leading '+' are kept.
 * Prevents any URI injection or malformed protocols.
 */
export function sanitizePhoneNumber(input?: string | null): string {
  if (!input) return "999";
  const trimmed = input.trim();
  // Strip anything that isn't a digit or leading +
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  return cleaned.slice(0, 15) || "999";
}

/**
 * Initiates an emergency call by launching the native phone dialer with the number pre-filled.
 *
 * On Android (Capacitor):
 * Android intercepts tel: URIs and opens the native Phone dialer with the number pre-filled,
 * requiring ZERO dangerous permissions (such as CALL_PHONE).
 *
 * On Web:
 * Launches the browser's native tel: protocol handler.
 *
 * Returns true if the dialer was triggered, or false if an error occurred.
 */
export function launchEmergencyDialer(rawNumber: string = "999"): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const cleanNumber = sanitizePhoneNumber(rawNumber);

  try {
    // Setting window.location.href to tel: URI is natively handled by
    // Capacitor's Bridge.launchIntent() on Android and standard browsers on web.
    window.location.href = `tel:${cleanNumber}`;
    return true;
  } catch (error) {
    console.warn("Could not launch phone dialer:", error);
    return false;
  }
}
