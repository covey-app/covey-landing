/*
 * Assembles the weekly guide from the content collections: editions with
 * their picks resolved, the complete guide grouped by day, and the upcoming
 * activities for /activities. Dates are calendar dates in San Francisco and
 * are handled as YYYY-MM-DD strings (UTC arithmetic only), so a build server
 * in any timezone produces the same pages.
 */
import { getCollection, getEntry, type CollectionEntry } from "astro:content";

export type Activity = CollectionEntry<"activities">;
export type Edition = CollectionEntry<"editions">;

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

export function weekLabel(weekOf: string): string {
  const end = addDays(weekOf, 6);
  return weekOf.slice(5, 7) === end.slice(5, 7)
    ? `${shortDate(weekOf)}–${Number(end.slice(8, 10))}`
    : `${shortDate(weekOf)} – ${shortDate(end)}`;
}

/** "Oct 17–18", "Oct 30 – Nov 2", or "Oct 17" for one day. */
export function dateSpan(from: string, to: string): string {
  if (from === to) return shortDate(from);
  return from.slice(5, 7) === to.slice(5, 7) ? `${shortDate(from)}–${Number(to.slice(8, 10))}` : `${shortDate(from)} – ${shortDate(to)}`;
}

/** Parts of the day an edition's guide is organized by. Untimed places go
    under "Any time". */
export const DAY_PARTS = [
  { key: "morning", label: "Morning", until: "12:00" },
  { key: "afternoon", label: "Afternoon", until: "17:00" },
  { key: "evening", label: "Evening", until: "21:00" },
  { key: "late", label: "Late", until: "24:00" },
] as const;

export function partsOfDay(items: Activity[]): { key: string; label: string; items: Activity[] }[] {
  const out = DAY_PARTS.map((p) => ({ key: p.key, label: p.label, items: [] as Activity[] }));
  const anytime: Activity[] = [];
  for (const a of items) {
    const t = a.data.time;
    if (!t) anytime.push(a);
    else out[DAY_PARTS.findIndex((p) => t < p.until)].items.push(a);
  }
  return [...out, { key: "anytime", label: "Any time", items: anytime }].filter((p) => p.items.length);
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

export async function publishedEditions(): Promise<Edition[]> {
  const all = await getCollection("editions", (e) => e.data.status === "published");
  return all.sort((a, b) => b.data.weekOf.localeCompare(a.data.weekOf));
}

export interface GuideDay {
  date: string;
  items: Activity[];
}

/** Sort within a day: timed items by time, then untimed places. */
const byTime = (a: Activity, b: Activity) => (a.data.time ?? "99").localeCompare(b.data.time ?? "99") || a.data.title.localeCompare(b.data.title);

/** Every published activity happening on each day of [start, start+days). */
export function groupByDay(activities: Activity[], start: string, days = 7, editionSlug?: string): GuideDay[] {
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
        const inEdition = !editionSlug || d.editions.includes(editionSlug);
        return inEdition && (d.days ? d.days.includes(key) : false);
      })
      .sort(byTime);
    out.push({ date, items });
  }
  return out;
}

export interface EditionPlan {
  title: string;
  for: string;
  note: string;
  stops: Activity[];
}

export interface ResolvedEdition {
  entry: Edition;
  slug: string;
  picks: { activity: Activity; why: string }[];
  plans: EditionPlan[];
  days: GuideDay[];
  total: number;
  /** "Oct 17–18": the days that actually have listings (an edition may cover
      only a weekend of its Monday–Sunday week). */
  span: string;
}

export async function resolveEdition(entry: Edition, all?: Activity[]): Promise<ResolvedEdition> {
  const activities = all ?? (await publishedActivities());
  const picks: ResolvedEdition["picks"] = [];
  for (const p of entry.data.picks) {
    const activity = await getEntry(p.activity);
    if (activity && activity.data.status === "published") picks.push({ activity, why: p.why });
  }
  const plans: EditionPlan[] = [];
  for (const p of entry.data.plans) {
    const stops = (await Promise.all(p.stops.map((s) => getEntry(s)))).filter((a): a is Activity => !!a && a.data.status === "published");
    if (stops.length >= 2) plans.push({ title: p.title, for: p.for, note: p.note, stops });
  }
  const inWeek = activities.filter((a) => a.data.kind === "event" || a.data.editions.includes(entry.id));
  const days = groupByDay(inWeek, entry.data.weekOf, 7, entry.id);
  const total = new Set(days.flatMap((d) => d.items.map((i) => i.id))).size;
  const filled = days.filter((d) => d.items.length).map((d) => d.date);
  return { entry, slug: entry.id, picks, plans, days, total, span: filled.length ? dateSpan(filled[0], filled.at(-1)!) : weekLabel(entry.data.weekOf) };
}

export async function latestEdition(): Promise<ResolvedEdition | null> {
  const [latest] = await publishedEditions();
  return latest ? resolveEdition(latest) : null;
}

/** Neighborhoods present in a set of activities, alphabetised. */
export function neighborhoods(activities: Activity[]): string[] {
  return [...new Set(activities.map((a) => a.data.neighborhood))].sort();
}
