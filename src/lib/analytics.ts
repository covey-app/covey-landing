/*
 * Conversion events. Vercel Web Analytics is the sink (cookieless, first-party,
 * loaded by BaseLayout only on Vercel builds); everything else is a no-op, so
 * local and test runs never phone home.
 *
 * Never put an email address, a name, or free text in `data` — event names and
 * small enums only. Every event is also dispatched as a `covey:track` DOM event,
 * which is what the Playwright tests assert against.
 */
export type TrackData = Record<string, string | number | boolean>;

type VercelQueue = (cmd: "event", payload: { name: string; data?: TrackData }) => void;

export function track(name: string, data?: TrackData): void {
  try {
    (window as unknown as { va?: VercelQueue }).va?.("event", { name, data });
  } catch {
    /* analytics must never break the page */
  }
  document.dispatchEvent(new CustomEvent("covey:track", { detail: { name, data } }));
}

/** Coarse device class for segmenting conversion; no fingerprinting. */
export function deviceClass(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}
