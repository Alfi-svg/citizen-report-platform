/**
 * Bangladesh Citizen Report Platform — Location Utilities
 * 
 * Privacy-First, One-Time Location Capture
 * - Uses @capacitor/geolocation on native Android for reliable runtime permissions
 * - Falls back to standard browser navigator.geolocation on web
 * - Zero continuous tracking, zero background GPS, zero location history
 * - Automatic 3-decimal (~110m) privacy approximation
 * - Platform-aware error handling for Android & Web
 */

import { Capacitor, registerPlugin } from "@capacitor/core";
import { Geolocation, Position } from "@capacitor/geolocation";

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  approximateLatitude: number;
  approximateLongitude: number;
  suggestedAreaName?: string;
}

export type LocationErrorCode =
  | "NOT_REQUESTED"
  | "PERMISSION_DENIED"
  | "PERMANENTLY_DENIED"
  | "SERVICES_DISABLED"
  | "TIMEOUT"
  | "POSITION_UNAVAILABLE"
  | "UNSUPPORTED";

export interface LocationError {
  code: LocationErrorCode;
  message: string;
  messageBn: string;
  isPermanent?: boolean;
  isServicesDisabled?: boolean;
  canOpenSettings?: boolean;
}

interface NativeSettingsPluginInterface {
  openAppSettings(): Promise<void>;
  openLocationSettings(): Promise<void>;
}

const NativeSettings = registerPlugin<NativeSettingsPluginInterface>("NativeSettings");

/**
 * Open native Android App Info settings screen where user can grant permissions.
 */
export async function openNativeAppSettings(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeSettings.openAppSettings();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Open native Android Location Source settings screen where user can toggle GPS on.
 */
export async function openNativeLocationSettings(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeSettings.openLocationSettings();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// Major Bangladesh reference points for fast, zero-network local approximation
const BD_REFERENCE_HUBS = [
  { name: "Dhanmondi, Dhaka", lat: 23.7461, lng: 90.3742 },
  { name: "Shahbagh / University Area, Dhaka", lat: 23.7389, lng: 90.3957 },
  { name: "Gulshan, Dhaka", lat: 23.7925, lng: 90.4078 },
  { name: "Banani, Dhaka", lat: 23.7937, lng: 90.4066 },
  { name: "Mirpur, Dhaka", lat: 23.8223, lng: 90.3654 },
  { name: "Uttara, Dhaka", lat: 23.8759, lng: 90.3795 },
  { name: "Mohammadpur, Dhaka", lat: 23.7658, lng: 90.3585 },
  { name: "Farmgate / Tejgaon, Dhaka", lat: 23.7561, lng: 90.3872 },
  { name: "Motijheel, Dhaka", lat: 23.7330, lng: 90.4172 },
  { name: "Old Dhaka (Kotwali), Dhaka", lat: 23.7100, lng: 90.4070 },
  { name: "Badda / Rampura, Dhaka", lat: 23.7700, lng: 90.4240 },
  { name: "Jatrabari, Dhaka", lat: 23.7104, lng: 90.4349 },
  { name: "GEC / Kotwali, Chittagong", lat: 22.3569, lng: 91.7832 },
  { name: "Bandar Bazar, Sylhet", lat: 24.8949, lng: 91.8687 },
  { name: "Zero Point, Rajshahi", lat: 24.3745, lng: 88.6042 },
  { name: "Dakbangla, Khulna", lat: 22.8122, lng: 89.5644 },
  { name: "Barisal Sadar, Barisal", lat: 22.7010, lng: 90.3535 },
  { name: "Rangpur Sadar, Rangpur", lat: 25.7439, lng: 89.2752 },
  { name: "Mymensingh Town, Mymensingh", lat: 24.7471, lng: 90.4203 },
];

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Approximate GPS coordinates to 3 decimals (~110m fuzzing).
 * Preserves citizen privacy from exact residential address exposure.
 */
export function approximateCoordinates(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.round(lat * 1000) / 1000,
    lng: Math.round(lng * 1000) / 1000,
  };
}

/**
 * Suggests nearest known Bangladesh urban landmark for user convenience.
 */
export function suggestNearestArea(lat: number, lng: number): string | undefined {
  let closestHub: (typeof BD_REFERENCE_HUBS)[0] | null = null;
  let minDistance = Infinity;

  for (const hub of BD_REFERENCE_HUBS) {
    const dist = haversineDistanceKm(lat, lng, hub.lat, hub.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestHub = hub;
    }
  }

  if (closestHub && minDistance <= 8.0) {
    return closestHub.name;
  }
  return undefined;
}

/**
 * Checks current location permission without triggering a prompt.
 */
export async function checkLocationPermission(): Promise<"granted" | "denied" | "prompt"> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location === "granted") return "granted";
      if (status.location === "denied") return "denied";
      return "prompt";
    } catch {
      return "prompt";
    }
  }

  // Web browser fallback
  if (typeof navigator !== "undefined" && navigator.permissions) {
    try {
      const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      if (status.state === "granted") return "granted";
      if (status.state === "denied") return "denied";
      return "prompt";
    } catch {
      return "prompt";
    }
  }

  return "prompt";
}

/**
 * Obtains current location exactly ONCE upon explicit user action.
 * Never starts background tracking or continuous listening.
 */
export async function captureCurrentLocation(options?: {
  timeoutMs?: number;
  enableHighAccuracy?: boolean;
}): Promise<{ coordinates?: LocationCoordinates; error?: LocationError }> {
  const timeoutMs = options?.timeoutMs ?? 10000;
  const enableHighAccuracy = options?.enableHighAccuracy ?? true;

  // 1. Native Capacitor Platform
  if (Capacitor.isNativePlatform()) {
    try {
      let permStatus = await Geolocation.checkPermissions();

      if (permStatus.location === "denied") {
        return {
          error: {
            code: "PERMANENTLY_DENIED",
            message: "Location access is blocked for Nirapotta. Tap 'Open Settings', select Permissions > Location, and allow access.",
            messageBn: "নিরাপত্তা অ্যাপে লোকেশন অনুমতি বন্ধ করা আছে। 'সেটিংস খুলুন'-এ ট্যাপ করে পারমিশন থেকে লোকেশন চালু করুন।",
            isPermanent: true,
            canOpenSettings: true,
          },
        };
      }

      if (permStatus.location !== "granted") {
        // Request permissions on any ungranted state ('prompt', 'prompt-with-rationale', etc.)
        permStatus = await Geolocation.requestPermissions({ permissions: ["location"] });
      }

      if (permStatus.location !== "granted") {
        const isPermanent = permStatus.location === "denied";
        return {
          error: {
            code: isPermanent ? "PERMANENTLY_DENIED" : "PERMISSION_DENIED",
            message: isPermanent
              ? "Location access is blocked for Nirapotta. Tap 'Open Settings', select Permissions > Location, and allow access."
              : "Location permission is required to locate nearby emergency units. Tap 'Allow Location' to grant permission, or choose your area manually.",
            messageBn: isPermanent
              ? "নিরাপত্তা অ্যাপে লোকেশন অনুমতি বন্ধ করা আছে। 'সেটিংস খুলুন'-এ ট্যাপ করে পারমিশন থেকে লোকেশন চালু করুন।"
              : "কাছাকাছি সেবা পেতে লোকেশন অনুমতি প্রয়োজন। পুনরায় চেষ্টা করতে 'অনুমতি দিন'-এ ট্যাপ করুন অথবা সরাসরি এলাকা নির্বাচন করুন।",
            isPermanent,
            canOpenSettings: isPermanent,
          },
        };
      }

      const positionPromise = Geolocation.getCurrentPosition({
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge: 5000,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("location request timeout")), timeoutMs + 500);
      });

      const position: Position = await Promise.race([positionPromise, timeoutPromise]);

      const { latitude, longitude, accuracy } = position.coords;
      const approx = approximateCoordinates(latitude, longitude);
      const suggestedAreaName = suggestNearestArea(latitude, longitude);

      return {
        coordinates: {
          latitude,
          longitude,
          accuracy: Math.round(accuracy),
          approximateLatitude: approx.lat,
          approximateLongitude: approx.lng,
          suggestedAreaName,
        },
      };
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (
        msg.includes("location disabled") ||
        msg.includes("location service") ||
        msg.includes("disabled") ||
        msg.includes("provider")
      ) {
        return {
          error: {
            code: "SERVICES_DISABLED",
            message: "Device Location (GPS) is turned off. Please turn on Location in Quick Settings or tap 'Location Settings'.",
            messageBn: "ডিভাইসের লোকেশন (GPS) সেবা বন্ধ রয়েছে। কুইক সেটিংস বা 'লোকেশন সেটিংস' থেকে লোকেশন অন করুন।",
            isServicesDisabled: true,
            canOpenSettings: true,
          },
        };
      }
      if (msg.includes("timeout")) {
        return {
          error: {
            code: "TIMEOUT",
            message: "Location request timed out. Please try again with clear sky view or select your area manually.",
            messageBn: "অবস্থান শনাক্তকরণে সময় বেশি লেগেছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন অথবা সরাসরি এলাকা নির্বাচন করুন।",
          },
        };
      }
      if (msg.includes("denied") || msg.includes("permission")) {
        return {
          error: {
            code: "PERMISSION_DENIED",
            message: "Location permission is required to locate nearby emergency units. Tap 'Allow Location' to grant permission, or choose your area manually.",
            messageBn: "কাছাকাছি সেবা পেতে লোকেশন অনুমতি প্রয়োজন। পুনরায় চেষ্টা করতে 'অনুমতি দিন'-এ ট্যাপ করুন অথবা সরাসরি এলাকা নির্বাচন করুন।",
            canOpenSettings: true,
          },
        };
      }
      return {
        error: {
          code: "POSITION_UNAVAILABLE",
          message: "Unable to detect GPS position at this moment. Please check your device signal or select your area manually.",
          messageBn: "এই মুহূর্তে জিপিএস অবস্থান নির্ণয় করা সম্ভব হয়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন অথবা সরাসরি এলাকা নির্বাচন করুন।",
        },
      };
    }
  }

  // 2. Desktop & Mobile Web Browser Fallback
  if (typeof window === "undefined" || !navigator.geolocation) {
    return {
      error: {
        code: "UNSUPPORTED",
        message: "Geolocation is not supported by your browser. Please select your area manually.",
        messageBn: "আপনার ব্রাউজারে জিপিএস সমর্থিত নয়। অনুগ্রহ করে সরাসরি এলাকা নির্বাচন করুন।",
      },
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const approx = approximateCoordinates(latitude, longitude);
        const suggestedAreaName = suggestNearestArea(latitude, longitude);

        resolve({
          coordinates: {
            latitude,
            longitude,
            accuracy: Math.round(accuracy),
            approximateLatitude: approx.lat,
            approximateLongitude: approx.lng,
            suggestedAreaName,
          },
        });
      },
      async (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          let isPermanent = false;
          if (typeof navigator !== "undefined" && navigator.permissions) {
            try {
              const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
              isPermanent = status.state === "denied";
            } catch {}
          }
          resolve({
            error: {
              code: isPermanent ? "PERMANENTLY_DENIED" : "PERMISSION_DENIED",
              message: isPermanent
                ? "Location access is blocked in your browser. Click the lock icon in your address bar to allow location, or choose your area manually below."
                : "Location permission was denied. Tap 'Allow Location' to retry, or select your area manually below.",
              messageBn: isPermanent
                ? "ব্রাউজারে লোকেশন পারমিশন ব্লক করা আছে। অ্যাড্রেস বারের সাইট সেটিংসে গিয়ে লোকেশন অনুমতি দিন অথবা নিচে থেকে এলাকা নির্বাচন করুন।"
                : "লোকেশন অনুমতি দেওয়া হয়নি। সেবা খুঁজতে লোকেশন অনুমতি দিন অথবা নিচে থেকে এলাকা নির্বাচন করুন।",
              isPermanent,
            },
          });
        } else if (err.code === err.TIMEOUT) {
          resolve({
            error: {
              code: "TIMEOUT",
              message: "Location request timed out. Please try again or select your area manually.",
              messageBn: "অবস্থান শনাক্তকরণে সময় বেশি লেগেছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন অথবা সরাসরি এলাকা নির্বাচন করুন।",
            },
          });
        } else {
          resolve({
            error: {
              code: "POSITION_UNAVAILABLE",
              message: "Unable to detect GPS position at this moment. Please check your signal or select your area manually.",
              messageBn: "এই মুহূর্তে জিপিএস অবস্থান নির্ণয় করা সম্ভব হয়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন অথবা এলাকা নির্বাচন করুন।",
            },
          });
        }
      },
      {
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge: 10000,
      }
    );
  });
}

