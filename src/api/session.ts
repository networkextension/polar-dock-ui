import { clearAccessExpiry, request, requestJson } from "./http.js";
import { setCurrentWorkspaceID } from "../lib/workspace.js";
import type { EmailVerificationResponse, UserProfile } from "../types/session.js";

export async function fetchCurrentUser() {
  return requestJson<UserProfile>("/api/me");
}

// logout ends the session on both sides. The server call revokes the token
// family and clears the auth cookies; the local half drops the state that
// would otherwise outlive the session — the access-expiry stamp (keeps the
// proactive-refresh timer alive) and the active workspace id (would ride
// along as X-Workspace-Id into whoever logs in next on this browser).
//
// Local cleanup runs even when the server call fails: a failed logout leaves
// the session alive, but nothing good comes from keeping the stale local
// copies. The Response is still returned — admin.ts / dashboard.ts /
// llm-config.ts surface "logout failed, retry" off response.ok.
export async function logout() {
  try {
    return await request("/api/logout", { method: "POST" });
  } finally {
    clearAccessExpiry();
    setCurrentWorkspaceID("");
  }
}

export async function sendEmailVerification() {
  return requestJson<EmailVerificationResponse>("/api/email-verification/send", {
    method: "POST",
  });
}
