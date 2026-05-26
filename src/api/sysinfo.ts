import { requestJson } from "./http.js";
import type { SystemHostInfo } from "../types/sysinfo.js";

export async function fetchSystemHostInfo() {
  return requestJson<SystemHostInfo>("/api/system/info");
}
