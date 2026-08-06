const API_BASE = "";

const WORKSPACE_KEY = "polar_active_workspace_id";

type JsonRequestInit = Omit<RequestInit, "body" | "headers"> & {
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
  headers?: HeadersInit;
};

function buildApiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

// readActiveWorkspaceID is duplicated from lib/workspace.ts on
// purpose: http.ts is imported by every page (login/register/index
// included) and we want zero coupling between this transport layer
// and the switcher feature.
function readActiveWorkspaceID(): string {
  try {
    return localStorage.getItem(WORKSPACE_KEY) || "";
  } catch {
    return "";
  }
}

function mergeHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);
  // Inject X-Workspace-Id on every request unless explicitly
  // overridden. The backend's AuthMiddleware reads this; if it
  // ever doesn't validate (stale id pointing at a team the user
  // got removed from), the middleware silently falls back to the
  // personal team — no client-side handling needed.
  if (!merged.has("X-Workspace-Id")) {
    const ws = readActiveWorkspaceID();
    if (ws) {
      merged.set("X-Workspace-Id", ws);
    }
  }
  return merged;
}

// --- 401 → refresh → retry interceptor ---------------------------------
//
// The backend issues a short-lived access cookie (30 min) and a long-lived
// refresh cookie (30 days, Path=/api/token). When the access cookie has
// expired any API call returns 401; the interceptor below catches that,
// serializes a single call to /api/token/refresh, and retries the
// original request. See doc/auth-refresh.md for the full flow.
//
// The install is a module-level side effect: any page that pulls anything
// from ./api/* gets the interceptor automatically. Login/register/index
// pages don't import these, so they keep their plain fetch behaviour.

const REFRESH_PATH = "/api/token/refresh";

// --- proactive refresh -------------------------------------------------
//
// The access cookie is httpOnly, so JS can't read its expiry. login +
// /api/token/refresh now return `access_expires_in` (seconds); we stash
// the absolute expiry and a timer refreshes once <1h remains, so an open
// tab never hits a 401 mid-session. The 401 interceptor stays as the
// safety net.
const SESSION_EXP_KEY = "polar_access_expires_at";
const PROACTIVE_THRESHOLD_MS = 60 * 60 * 1000; // refresh when <1h left
const PROACTIVE_INTERVAL_MS = 5 * 60 * 1000; // re-check cadence

// noteAccessExpiry records when the current access token expires. Called
// by login.ts (on login) and runRefresh (on refresh).
export function noteAccessExpiry(expiresInSec: number): void {
  try {
    if (expiresInSec && expiresInSec > 0) {
      localStorage.setItem(SESSION_EXP_KEY, String(Date.now() + expiresInSec * 1000));
    }
  } catch {
    /* localStorage unavailable — fall back to on-401 refresh */
  }
}

// clearAccessExpiry drops the recorded expiry. Called by logout() — leaving
// a stale "session is still valid" stamp behind keeps startProactiveRefresh
// hammering /api/token/refresh against a revoked session on any page that
// doesn't navigate away. With the key gone readAccessExpiry() returns 0 and
// the timer's check() short-circuits, so no separate stop-the-timer plumbing
// is needed.
export function clearAccessExpiry(): void {
  try {
    localStorage.removeItem(SESSION_EXP_KEY);
  } catch {
    /* localStorage unavailable — nothing was stored either */
  }
}

function readAccessExpiry(): number {
  try {
    const v = localStorage.getItem(SESSION_EXP_KEY);
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
}

// Don't try to refresh for these paths — they define the auth boundary
// themselves. Attempting to refresh a failed /login would loop.
const AUTH_EXEMPT_PATHS = new Set([
  REFRESH_PATH,
  "/api/login",
  "/api/register",
  "/api/logout",
]);

function shouldSkipRefresh(input: RequestInfo | URL): boolean {
  let url = "";
  if (typeof input === "string") {
    url = input;
  } else if (input instanceof URL) {
    url = input.pathname;
  } else if (input instanceof Request) {
    url = input.url;
  }
  try {
    const parsed = new URL(url, window.location.origin);
    return AUTH_EXEMPT_PATHS.has(parsed.pathname);
  } catch {
    return false;
  }
}

let refreshInFlight: Promise<boolean> | null = null;
let installed = false;

function runRefresh(originalFetch: typeof window.fetch): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }
  refreshInFlight = (async () => {
    try {
      const res = await originalFetch(buildApiUrl(REFRESH_PATH), {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        try {
          const body = (await res.clone().json()) as { access_expires_in?: number };
          if (typeof body.access_expires_in === "number") {
            noteAccessExpiry(body.access_expires_in);
          }
        } catch {
          /* body not JSON — ignore, on-401 still works */
        }
      }
      return res.ok;
    } catch {
      return false;
    } finally {
      // Release the lock on the next tick so concurrent 401 callers
      // observing the same in-flight promise resolve before we let a
      // brand-new refresh start.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();
  return refreshInFlight;
}

function installAuthInterceptor(): void {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") {
    return;
  }
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const firstResponse = await originalFetch(input, init);
    if (firstResponse.status !== 401 || shouldSkipRefresh(input)) {
      return firstResponse;
    }

    const refreshed = await runRefresh(originalFetch);
    if (!refreshed) {
      // Refresh itself failed — fall through to the original 401. The
      // caller (or the page's top-level load) will route to /login.html.
      return firstResponse;
    }

    // Replay the original request once. Non-retryable bodies (already
    // consumed streams) will surface as a TypeError, which the caller
    // will handle the same way any network error does.
    return originalFetch(input, init);
  };

  startProactiveRefresh(originalFetch);
}

// startProactiveRefresh refreshes the access token before it expires so an
// open tab never hits a mid-session 401. No-op until an expiry is known
// (login / first refresh records it); until then the on-401 path covers us.
function startProactiveRefresh(originalFetch: typeof window.fetch): void {
  const check = (): void => {
    const exp = readAccessExpiry();
    if (!exp) return; // unknown — rely on the 401 interceptor
    if (exp - Date.now() < PROACTIVE_THRESHOLD_MS) {
      void runRefresh(originalFetch);
    }
  };
  window.setInterval(check, PROACTIVE_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) check();
  });
  check();
}

installAuthInterceptor();

// --- public helpers ----------------------------------------------------

export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = mergeHeaders(init.headers);
  return fetch(buildApiUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });
}

export async function requestJson<T>(path: string, init: JsonRequestInit = {}): Promise<{
  response: Response;
  data: T;
}> {
  const headers = mergeHeaders(init.headers);
  let body = init.body as BodyInit | null | undefined;
  if (
    init.body !== undefined &&
    init.body !== null &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof Blob) &&
    !(init.body instanceof URLSearchParams) &&
    !(init.body instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(init.body) &&
    !(typeof ReadableStream !== "undefined" && init.body instanceof ReadableStream)
  ) {
    body = JSON.stringify(init.body);
  }

  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await request(path, {
    ...init,
    headers,
    body,
  });
  const data = (await response.json()) as T;
  return { response, data };
}

export { buildApiUrl };
