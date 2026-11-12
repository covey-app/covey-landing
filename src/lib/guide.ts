/*
 * Assembles the events guide from the content collection: upcoming listings
 * grouped by day for /events and the home page. Dates are calendar dates in
 * San Francisco and are handled as YYYY-MM-DD strings (UTC arithmetic only),
 * so a build server in any timezone produces the same pages.
 */
import { getCollection, type CollectionEntry } from "astro:content";

export type Activity = CollectionEntry<"activities">;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => fromUtc(toUtc(iso) + n * 86_400_000);
export const weekdayIndex = (iso: string) => new Date(toUtc(iso)).getUTCDay();
export const dayKey = (iso: string) => DAY_KEYS[weekdayIndex(iso)];
export const dayName = (iso: string) => DAY_NAMES[weekdayIndex(iso)];
export const shortDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
export const longDate = (iso: string) => `${dayName(iso)}, ${shortDate(iso)}`;

/** Today in San Francisco, as YYYY-MM-DD. COVEY_TODAY pins it for
    reproducible builds (Playwright, design review of a past week). */
export function todaySF(now = new Date()): string {
  const pinned = typeof process !== "undefined" ? process.env.COVEY_TODAY : undefined;
  if (pinned && /^\d{4}-\d{2}-\d{2}$/.test(pinned)) return pinned;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);
}
/** Monday of the week containing `iso`. */
export function mondayOf(iso: string): string {
  const i = weekdayIndex(iso);
  return addDays(iso, i === 0 ? -6 : 1 - i);
}

export function timeLabel(a: Activity["data"]): string | undefined {
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const hh = h % 12 || 12;
    return `${hh}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
  };
  if (!a.time) return undefined;
  return a.endTime ? `${fmt(a.time)}–${fmt(a.endTime)}` : fmt(a.time);
}

export function priceLabel(a: Activity["data"]): string | undefined {
  if (a.priceNote) return a.priceNote;
  if (a.priceMin === undefined) return undefined;
  if (a.priceMin === 0 && !a.priceMax) return "Free";
  const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  return a.priceMax && a.priceMax !== a.priceMin ? `${usd(a.priceMin)}–${usd(a.priceMax)}` : usd(a.priceMin);
}

export async function publishedActivities(): Promise<Activity[]> {
  return getCollection("activities", (a) => a.data.status === "published");
}

/** The next `n` dated events that haven't ended by `today`, soonest first. */
export function upcomingEvents(activities: Activity[], today: string, n = 3): Activity[] {
  return activities
    .filter((a) => a.data.kind === "event" && (a.data.endDate ?? a.data.date!) >= today)
    .sort((a, b) => a.data.date!.localeCompare(b.data.date!) || (a.data.time ?? "99").localeCompare(b.data.time ?? "99"))
    .slice(0, n);
}

export interface GuideDay {
  date: string;
  items: Activity[];
}

/** Sort within a day: timed items by time, then untimed places. */
const byTime = (a: Activity, b: Activity) => (a.data.time ?? "99").localeCompare(b.data.time ?? "99") || a.data.title.localeCompare(b.data.title);

/** Every published activity happening on each day of [start, start+days). */
export function groupByDay(activities: Activity[], start: string, days = 7): GuideDay[] {
  const out: GuideDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const key = dayKey(date);
    const items = activities
      .filter((a) => {
        const d = a.data;
        if (d.kind === "event") {
          const end = d.endDate ?? d.date!;
          return d.date! <= date && date <= end;
        }
        return d.days ? d.days.includes(key) : false;
      })
      .sort(byTime);
    out.push({ date, items });
  }
  return out;
}

/** Neighborhoods present in a set of activities, alphabetised. */
export function neighborhoods(activities: Activity[]): string[] {
  return [...new Set(activities.map((a) => a.data.neighborhood))].sort();
}
