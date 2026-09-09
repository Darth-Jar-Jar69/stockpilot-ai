/**
 * Server-side FastAPI base URL.
 * Prefer BACKEND_URL (private Railway network) over the public NEXT_PUBLIC_API_URL.
 */
export function getBackendUrl(): string {
  const candidates = [
    process.env.BACKEND_URL,
    process.env.STOCKPILOT_AI_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ];

  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed.replace(/\/$/, "");
  }

  return "http://localhost:8000";
}

type ProxyOptions = {
  path: string;
  searchParams?: URLSearchParams | string;
  init?: RequestInit;
  revalidate?: number | false;
};

/** Fetch JSON from the FastAPI backend. Throws on network failure. */
export async function fetchBackendJson<T = unknown>(
  options: ProxyOptions,
): Promise<{ ok: boolean; status: number; data: T }> {
  const base = getBackendUrl();
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
    // Railway edge 502
    if (record.message === "Application failed to respond") {
      return "Market data service is temporarily unavailable. Retry in a moment.";
    }
    return record.message;
  }
  if (typeof record.error === "string") return record.error;
  return fallback;
}
