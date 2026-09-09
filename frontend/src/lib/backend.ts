/**
 * Server-side FastAPI base URL.
 * Prefer BACKEND_URL (private network) over the public NEXT_PUBLIC_API_URL.
 * Never use localhost on Vercel / production hosts.
 */
export function getBackendUrl(): string | null {
  const candidates = [
    process.env.BACKEND_URL,
    process.env.STOCKPILOT_AI_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ];

  for (const value of candidates) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const normalized = trimmed.replace(/\/$/, "");
    if (isLocalBackendUrl(normalized) && isHostedRuntime()) {
      continue;
    }
    return normalized;
  }

  if (isHostedRuntime()) return null;
  return "http://localhost:8000";
}

function isHostedRuntime(): boolean {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

function isLocalBackendUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function isBackendConfigured(): boolean {
  return getBackendUrl() != null;
}

type ProxyOptions = {
  path: string;
  searchParams?: URLSearchParams | string;
  init?: RequestInit;
  revalidate?: number | false;
};

/** Fetch JSON from the FastAPI backend. Throws when unset or on network failure. */
export async function fetchBackendJson<T = unknown>(
  options: ProxyOptions,
): Promise<{ ok: boolean; status: number; data: T }> {
  const base = getBackendUrl();
  if (!base) {
    throw new Error("Backend URL is not configured.");
  }

  const query =
    typeof options.searchParams === "string"
      ? options.searchParams
      : options.searchParams?.toString() || "";
  const url = `${base}${options.path}${query ? `?${query}` : ""}`;

  const res = await fetch(url, {
    ...options.init,
    headers: {
      Accept: "application/json",
      ...(options.init?.headers ?? {}),
    },
    ...(options.revalidate === false
      ? { cache: "no-store" as const }
      : { next: { revalidate: options.revalidate ?? 30 } }),
  });

  let data: T;
  const text = await res.text();
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    data = { message: text.slice(0, 200) || "Invalid response from backend." } as T;
  }

  return { ok: res.ok, status: res.status, data };
}

/** Human-readable error for API clients (never suggest local uvicorn in production). */
export function backendErrorMessage(data: unknown, fallback: string): string {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const detail = record.detail;
  if (detail && typeof detail === "object" && detail !== null && "message" in detail) {
    return String((detail as { message: unknown }).message);
  }
  if (typeof detail === "string") return detail;
  if (typeof record.message === "string") {
    if (record.message === "Application failed to respond") {
      return "Market data service is temporarily unavailable. Retry in a moment.";
    }
    return record.message;
  }
  if (typeof record.error === "string") return record.error;
  return fallback;
}
