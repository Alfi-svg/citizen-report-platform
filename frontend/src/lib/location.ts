/**
 * Bangladesh Citizen Report Platform — Location Utilities
 * 
 * Privacy-First, One-Time Location Capture
 * - Uses @capacitor/geolocation on native Android for reliable runtime permissions
 * - Falls back to standard browser navigator.geolocation on web
 * - Zero continuous tracking, zero background GPS, zero location history
 * - Automatic 3-decimal (~110m) privacy approximation
 */

import { Capacitor } from "@capacitor/core";
import { Geolocation, Position, PermissionStatus } from "@capacitor/geolocation";

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  approximateLatitude: number;
  approximateLongitude: number;
  suggestedAreaName?: string;
}

export type LocationErrorCode =
  | "PERMISSION_DENIED"
  | "SERVICES_DISABLED"
  | "TIMEOUT"
  | "POSITION_UNAVAILABLE"
  | "UNSUPPORTED";

export interface LocationError {
  code: LocationErrorCode;
  message: string;
  isPermanent?: boolean;
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
export async function checkLocationPermission(): Promise<PermissionStatus["location"]> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Geolocation.checkPermissions();
      return status.location;
    } catch {
      return "denied";
    }
  }

  // Web browser fallback
  if (typeof navigator !== "undefined" && navigator.permissions) {
    try {
      const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      return status.state as PermissionStatus["location"];
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
        // Request permissions
        permStatus = await Geolocation.requestPermissions({ permissions: ["location"] });
      }

      if (permStatus.location !== "granted") {
        return {
          error: {
            code: "PERMISSION_DENIED",
            message:
              "Location permission was denied. You can manually enter your incident location below, or enable Location in your device App Settings.",
            isPermanent: permStatus.location === "denied",
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
      if (msg.includes("location disabled") || msg.includes("location service") || msg.includes("disabled") || msg.includes("provider")) {
        return {
          error: {
            code: "SERVICES_DISABLED",
            message:
              "Location services are disabled on your device. Please turn on Location in Quick Settings or type your location manually.",
          },
        };
      }
      if (msg.includes("timeout")) {
        return {
          error: {
            code: "TIMEOUT",
            message:
              "Location request timed out. Please try again with clear sky view or enter your location manually.",
          },
        };
      }
      return {
        error: {
          code: "POSITION_UNAVAILABLE",
          message:
            "Unable to retrieve current location. Please enter your location manually.",
        },
      };
    }
  }

  // 2. Desktop & Mobile Web Browser Fallback
  if (typeof window === "undefined" || !navigator.geolocation) {
    return {
      error: {
        code: "UNSUPPORTED",
        message: "Geolocation is not supported by your browser. Please type your location manually.",
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
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({
            error: {
              code: "PERMISSION_DENIED",
              message:
                "Location permission was denied. You can manually enter your incident location below.",
            },
          });
        } else if (err.code === err.TIMEOUT) {
          resolve({
            error: {
              code: "TIMEOUT",
              message:
                "Location request timed out. Please try again or enter your location manually.",
            },
          });
        } else {
          resolve({
            error: {
              code: "POSITION_UNAVAILABLE",
              message:
                "Unable to retrieve GPS coordinates. Please enter your location manually.",
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
