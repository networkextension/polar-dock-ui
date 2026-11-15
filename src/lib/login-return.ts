// Cross-origin login returns are restricted to the cloud console we serve.
export function loginReturn(search: string, origin: string): string {
  const params = new URLSearchParams(search);
  const raw = params.get("return") || params.get("return_to") || params.get("next");
  if (!raw || /[\u0000-\u0020\\]/.test(raw) || raw.startsWith("//")) return "/dashboard.html";
  try {
    const url = new URL(raw, origin);
    if (url.username || url.password) return "/dashboard.html";
    if (url.origin !== origin && url.origin !== "https://cloud.4950.store:2443") return "/dashboard.html";
    if (url.pathname === "/login.html") return "/dashboard.html";
    return url.href;
  } catch {
    return "/dashboard.html";
  }
}
