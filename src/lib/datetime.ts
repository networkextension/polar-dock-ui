import { getLang } from "./i18n.js";

// Shared date/time formatting bound to the app language toggle.
//
// Before this existed, 20+ call sites each did a bare
// `new Date(x).toLocaleString()`, which follows the *browser* locale —
// so the same user saw "5/16/2026, 6:11:48 AM" on one page and
// "2026/7/19 09:44:42" on another depending on where the string was
// produced. Route every user-visible timestamp through here instead.

function locale(): string {
  return getLang() === "en" ? "en-US" : "zh-CN";
}

function parse(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Full date + time, e.g. zh-CN "2026/7/19 09:44:42". "—" for empty/invalid. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const d = parse(value);
  return d ? d.toLocaleString(locale()) : "—";
}

/** Date only, e.g. zh-CN "2026/7/19". "—" for empty/invalid. */
export function formatDate(value: string | number | Date | null | undefined): string {
  const d = parse(value);
  return d ? d.toLocaleDateString(locale()) : "—";
}

/** Time only, e.g. zh-CN "09:44:42". "—" for empty/invalid. */
export function formatTime(value: string | number | Date | null | undefined): string {
  const d = parse(value);
  return d ? d.toLocaleTimeString(locale()) : "—";
}
