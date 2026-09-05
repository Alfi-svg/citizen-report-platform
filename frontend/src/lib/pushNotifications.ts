import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  ActionPerformed,
  PushNotificationSchema,
  Token,
} from "@capacitor/push-notifications";
import { apiFetch } from "@/lib/api";

const TOKEN_STORAGE_KEY = "citizen_report_device_token";
const PUSH_PROMPT_DISMISSED_KEY = "citizen_report_push_prompt_dismissed";

export interface PushStatus {
  isSupported: boolean;
  isGranted: boolean;
  isDenied: boolean;
  canPrompt: boolean;
}

/**
 * Checks whether push notifications are supported on this device/platform.
 */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}

/**
 * Checks current push notification permission status without prompting the user.
 */
export async function checkPushPermissionStatus(): Promise<PushStatus> {
  if (!isPushSupported()) {
    return {
      isSupported: false,
      isGranted: false,
      isDenied: false,
      canPrompt: false,
    };
  }

  try {
    const perm = await PushNotifications.checkPermissions();
    const isGranted = perm.receive === "granted";
    const isDenied = perm.receive === "denied";
    const canPrompt = perm.receive === "prompt" || perm.receive === "prompt-with-rationale";

    return {
      isSupported: true,
      isGranted,
      isDenied,
      canPrompt,
    };
  } catch (error) {
    console.warn("Error checking push notification permissions:", error);
    return {
      isSupported: true,
      isGranted: false,
      isDenied: false,
      canPrompt: false,
    };
  }
}

/**
 * User-initiated request for push notification permission.
 * Should only be triggered when the user explicitly taps "Enable Notifications".
 */
export async function requestPushPermission(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const result = await PushNotifications.requestPermissions();
    if (result.receive === "granted") {
      await PushNotifications.register();
      return true;
    }
    return false;
  } catch (error) {
    console.warn("Error requesting push notification permission:", error);
    return false;
  }
}

/**
 * Sends device token to backend to associate with the current authenticated user.
 */
export async function registerDeviceTokenWithBackend(tokenValue: string): Promise<boolean> {
  if (!tokenValue) return false;

  try {
    await apiFetch("/notifications/devices", {
      method: "POST",
      body: JSON.stringify({
        token: tokenValue,
        platform: "ANDROID",
        device_name: `${Capacitor.getPlatform().toUpperCase()} Device`,
      }),
    });
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenValue);
    return true;
  } catch (error) {
    console.warn("Failed to register device token with backend:", error);
    return false;
  }
}

/**
 * Deactivates device token on backend upon user logout or permission revocation.
 */
export async function deactivatePushTokenOnBackend(): Promise<void> {
  if (typeof window === "undefined") return;

  const currentToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (currentToken) {
    try {
      await apiFetch(`/notifications/devices/${encodeURIComponent(currentToken)}`, {
        method: "DELETE",
      });
    } catch {
      // Ignore network errors during logout deactivation
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }

  if (isPushSupported()) {
    try {
      await PushNotifications.removeAllListeners();
    } catch {
      // Ignore cleanup error
    }
  }
}

/**
 * Resolves safe local navigation route from push notification payload data.
 */
export function sanitizePushRedirectUrl(data?: Record<string, unknown>): string {
  if (!data) return "/notifications";

  // Check explicit target URL
  if (typeof data.url === "string" && data.url.startsWith("/")) {
    return data.url;
  }

  // Check report_id fallback
  if (typeof data.report_id === "string" && data.report_id.trim()) {
    return `/reports/${data.report_id.trim()}`;
  }

  // Check blood request fallback
  if (typeof data.blood_request_id === "string" && data.blood_request_id.trim()) {
    return `/blood-help/${data.blood_request_id.trim()}`;
  }

  // Check missing person alert fallback
  if (typeof data.missing_person_id === "string" && data.missing_person_id.trim()) {
    return `/missing-person`;
  }

  return "/notifications";
}

/**
 * Initializes push notification listeners for the authenticated session.
 * Connects registration, foreground notifications, and tap-to-navigate deep linking.
 */
export async function initializePushNotifications(
  onNavigate: (url: string) => void
): Promise<() => void> {
  if (!isPushSupported()) {
    return () => {};
  }

  try {
    const status = await checkPushPermissionStatus();
    if (!status.isGranted) {
      return () => {};
    }

    // 1. Listen for device registration token
    const regHandle = await PushNotifications.addListener("registration", (token: Token) => {
      registerDeviceTokenWithBackend(token.value);
    });

    // 2. Listen for registration errors
    const regErrHandle = await PushNotifications.addListener("registrationError", (error) => {
      console.warn("Push registration error:", error);
      // In development / emulator when live Firebase keys are not provided, register dev token
      if (process.env.NODE_ENV === "development" && !localStorage.getItem(TOKEN_STORAGE_KEY)) {
        const devToken = `dev-emulator-token-${Date.now().toString(36)}`;
        registerDeviceTokenWithBackend(devToken);
      }
    });

    // 3. Foreground notification received -> dispatch custom event for quiet in-app update
    const recHandle = await PushNotifications.addListener(
      "pushNotificationReceived",
      (notification: PushNotificationSchema) => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("notification:received", {
              detail: notification,
            })
          );
        }
      }
    );

    // 4. Background / Tray Notification Tapped -> Deep Link Navigation
    const actHandle = await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action: ActionPerformed) => {
        const targetUrl = sanitizePushRedirectUrl(action.notification.data);
        onNavigate(targetUrl);
      }
    );

    // Register with FCM
    await PushNotifications.register();

    // Return cleanup handle
    return () => {
      regHandle.remove();
      regErrHandle.remove();
      recHandle.remove();
      actHandle.remove();
    };
  } catch (error) {
    console.warn("Push initialization failed:", error);
    return () => {};
  }
}

/**
 * Helpers for managing prompt dismissal preference in local storage.
 */
export function isPushPromptDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === "true";
}

export function dismissPushPrompt(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "true");
}

export function resetPushPromptDismissal(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PUSH_PROMPT_DISMISSED_KEY);
}
