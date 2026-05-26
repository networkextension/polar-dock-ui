import { hydrateSiteBrand } from "./lib/site.js";

async function bootstrap(): Promise<void> {
  try {
    const res = await fetch("/api/me", { credentials: "include" });
    if (res.ok) {
      window.location.replace("/dashboard.html");
      return;
    }
  } catch {
    // Ignore and show entry links.
  }
}

void bootstrap();
void hydrateSiteBrand();
