export function getApiBaseUrl(): string {
  // 1. Explicit production environment variable override (non-localhost)
  if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes("localhost")) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
  }

  // 2. Client-side runtime checks
  if (typeof window !== "undefined") {
    // Check if running inside Capacitor native mobile app
    const isCapacitor =
      typeof (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor !== "undefined" &&
      (Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) ||
        window.location.protocol === "capacitor:" ||
        window.location.hostname === "localhost");

    if (isCapacitor) {
      return "https://citizen-report-backend.onrender.com/api/v1";
    }

    // Check if running on live web domain (Vercel, custom domain)
    const hostname = window.location.hostname;
    if (hostname && !hostname.includes("localhost") && !hostname.includes("127.0.0.1")) {
      return "https://citizen-report-backend.onrender.com/api/v1";
    }
  }

  // 3. Development fallback (local web development only)
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiFetch<T>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // Only set Content-Type: application/json if not uploading FormData and not already set
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // Attach token if available in client localStorage
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  // Safe timeout handling (default 25 seconds to accommodate backend spin-up)
  const timeoutMs = options.timeoutMs ?? 25000;
  const controller = new AbortController();
  let isTimeout = false;

  const timer = setTimeout(() => {
    isTimeout = true;
    controller.abort();
  }, timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (isTimeout) {
      throw new Error("Request timed out. The server took too long to respond. Please try again.");
    }
    if (err instanceof Error && err.name === "AbortError" && !isTimeout) {
      throw err; // Caller explicitly cancelled
    }
    // Network drop / offline / DNS failure
    throw new Error("Unable to connect to the server. Please check your internet connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  let data: unknown;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    if (typeof data === "object" && data !== null && "detail" in data) {
      const detail = (data as { detail: unknown }).detail;
      if (typeof detail === "string") {
        errorMessage = detail;
      } else if (Array.isArray(detail)) {
        errorMessage = detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(", ");
      }
    } else if (response.status === 401) {
      errorMessage = "Session expired or unauthorized. Please log in again.";
    } else if (response.status === 403) {
      errorMessage = "You do not have permission to perform this action.";
    } else if (response.status === 404) {
      errorMessage = "The requested resource was not found.";
    } else if (response.status === 429) {
      errorMessage = "Too many requests. Please wait a moment and try again.";
    } else if (response.status >= 500) {
      errorMessage = "Server error. Please try again later.";
    }

    // On 401 (unauthorized / session expired) on any authenticated endpoint, clear client token and notify listeners
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      !endpoint.includes("/auth/login") &&
      !endpoint.includes("/auth/register")
    ) {
      localStorage.removeItem("token");
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }

    throw new Error(errorMessage);
  }

  return data as T;
}
