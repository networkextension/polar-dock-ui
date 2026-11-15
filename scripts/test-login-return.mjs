import assert from "node:assert/strict";
import { buildSync } from "esbuild";

const result = buildSync({
  entryPoints: [new URL("../src/lib/login-return.ts", import.meta.url).pathname],
  bundle: true,
  format: "esm",
  write: false,
});
const { loginReturn } = await import(
  "data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64")
);
const origin = "https://zen.4950.store:2443";
const cloud = "https://cloud.4950.store:2443/#/vms/new?step=3&os=freebsd";
const cases = [
  [cloud, cloud],
  ["/console.html", origin + "/console.html"],
  ["https://evil.example/", "/dashboard.html"],
  ["//evil.example/", "/dashboard.html"],
  ["https://cloud.4950.store:2443.evil.example/", "/dashboard.html"],
  ["javascript:alert(1)", "/dashboard.html"],
  ["https://a:b@cloud.4950.store:2443/", "/dashboard.html"],
  ["/login.html?return=%2F", "/dashboard.html"],
  ["\\\\evil.example", "/dashboard.html"],
];
for (const [raw, expected] of cases) {
  for (const key of ["return", "return_to", "next"]) {
    assert.equal(loginReturn(`?${key}=${encodeURIComponent(raw)}`, origin), expected);
  }
}
assert.equal(loginReturn("", origin), "/dashboard.html");
console.log("28 login return URL cases passed");
