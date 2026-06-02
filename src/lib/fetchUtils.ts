/**
 * Shared fetch utilities with timeout, retry, and uniform error reporting.
 * All network calls in the app go through timedFetch() so we never hang
 * forever on a stalled mirror.
 */

export interface TimedFetchOpts extends RequestInit {
  /** Abort after this many milliseconds (default 12_000). */
  timeoutMs?: number;
  /** Number of additional attempts on 5xx / network errors (default 1). 4xx is NEVER retried. */
  retries?: number;
  /** Base delay (ms) for exponential backoff between retries (default 600). */
  backoffMs?: number;
}

export class FetchError extends Error {
  status: number;
  url: string;
  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.url = url;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function timedFetch(url: string, opts: TimedFetchOpts = {}): Promise<Response> {
  const { timeoutMs = 12_000, retries = 1, backoffMs = 600, ...fetchInit } = opts;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...fetchInit, signal: ctrl.signal });
      clearTimeout(timer);
      // Never retry 4xx — they will not succeed on retry
      if (res.status >= 400 && res.status < 500) {
        throw new FetchError(`HTTP ${res.status}`, res.status, url);
      }
      if (!res.ok && attempt < retries) {
        await sleep(backoffMs * Math.pow(2, attempt));
        continue;
      }
      if (!res.ok) {
        throw new FetchError(`HTTP ${res.status}`, res.status, url);
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      // Don't retry 4xx
      if (e instanceof FetchError && e.status >= 400 && e.status < 500) throw e;
      if (attempt < retries) {
        await sleep(backoffMs * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(`Fetch failed: ${url}`);
}

/** Pretty-print an error message for the user. */
export function errorMessage(e: unknown): string {
  if (e instanceof FetchError) return `${e.message} (${new URL(e.url).host})`;
  if (e instanceof Error) {
    if (e.name === "AbortError") return "Pedido cancelado (timeout)";
    return e.message;
  }
  return String(e);
}

/** Returns true when the browser reports we are online. */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
