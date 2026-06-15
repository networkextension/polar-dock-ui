# Auth token refresh (dock-ui)

How the web UI keeps a session alive without the user re-logging in. The
implementation is `src/api/http.ts`; this doc is the reference its top
comment points to.

## Cookies (set by dock on login/register)

| Cookie | Max-Age | Path | Notes |
|---|---|---|---|
| `access_token` | 1800s (30 min) | `/` | Domain `*.4950.store`; sent on every API call. httpOnly — JS can't read it. |
| `refresh_token` | 2592000s (30 d) | `/api/token` | `SameSite=Strict`; only sent to the refresh endpoint. |

`POST /api/token/refresh` (`handleTokenRefresh`) mints a fresh `access_token`
and returns `{ "access_expires_in": <seconds> }`.

## Two mechanisms

### 1. Proactive refresh (primary)
`access_token` is httpOnly, so JS can't read its expiry. Instead `login` and
every refresh return `access_expires_in`; `noteAccessExpiry()` stores the
absolute expiry in `localStorage[polar_access_expires_at]`. A timer
(`startProactiveRefresh`, every 5 min + on `visibilitychange`) calls
`/api/token/refresh` once the remaining lifetime drops below 1h. So an open
tab refreshes ahead of expiry and never hits a mid-session 401.

Until an expiry is known (fresh page load before any login/refresh this
session) the proactive path is a no-op and mechanism 2 covers it.

### 2. On-401 interceptor (safety net)
`installAuthInterceptor()` wraps `window.fetch` as a module-level side effect:
any page that imports from `./api/*` gets it; login/register/index don't, so
they keep plain fetch. On a `401`:

1. If the request path is in `AUTH_EXEMPT_PATHS` (`/api/login`, `/api/register`,
   `/api/logout`, `/api/token/refresh`) → return the 401 as-is (refreshing a
   failed login would loop).
2. Otherwise call `runRefresh()` — a **serialized single** `POST
   /api/token/refresh`. Concurrent 401s share one in-flight promise, so a page
   firing 10 parallel calls triggers exactly one refresh.
3. If refresh succeeds → **replay the original request once** and return that.
4. If refresh fails → return the original 401 (see fallback below).

Replay re-issues `fetch(input, init)`. A non-replayable body (an
already-consumed stream) surfaces as a `TypeError`, which the caller handles
like any network error. JSON/string bodies (the common case) replay fine.

## Refresh-token-expired fallback
After ~30 days the `refresh_token` itself expires; `/api/token/refresh` then
401s and `runRefresh` returns false. The interceptor surfaces the original
401, and each page's own guard does `window.location.replace("/login.html")`
(see `admin.ts`, `llm-config.ts`, `chat.ts`, `editor.ts`, `markdown.ts`, …).
So the user lands on the login page rather than a broken view.

## Invariants
- Exactly one refresh in flight at a time (`refreshInFlight`), released on the
  next microtask so concurrent 401 callers resolve against the same refresh
  before a brand-new one can start.
- The interceptor installs once (`installed` guard).
- All API calls go through the wrapped global `fetch` via `request()` /
  `requestJson()`, so the interceptor is transparent to callers.
