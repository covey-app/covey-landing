/*
 * Content collections for the events guide.
 *
 * One activity is entered once (content/live/activities/*.md) and reused by
 * /events, the home page, and social planning —
 * the fields mirror the Events / Location Bank sheets of the "Covey Social
 * Media Manager [SF]" workbook, and `sheetId` keeps the EVT-/LOC- id so a row
 * and its page can be matched. scripts/content/import-sheet.mjs converts a
 * CSV export of those sheets into these files.
 *
 * Everything lives in content/live: real entries only. There is no sample
 * set — tests build these same files with COVEY_TODAY pinned.
 *
 * Rules (enforced here where a schema can): every entry links to its original
 * organizer or event page; prices and times come from that page; `verifiedAt`
 * is the date someone checked them there.
 */
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { CATEGORY_KEYS, TAGS } from "./lib/categories";

const root = "content/live";
const md = (base: string) => glob({ pattern: "**/[^_]*.md", base });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h HH:MM");
const link = z.object({ url: z.url(), name: z.string().max(60) });
const weekday = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

const activities = defineCollection({
  loader: md(`${root}/activities`),
  schema: z
    .object({
      title: z.string().min(3).max(90),
      /** A dated `event`, or a `place` worth going to any week (uses `days`). */
      kind: z.enum(["event", "place"]),
      category: z.enum(CATEGORY_KEYS),
      /** The sheet's "Activity", e.g. "Live music", "Run club". */
      activity: z.string().max(40).optional(),
      venue: z.string().max(80),
      neighborhood: z.string().max(40),
      address: z.string().max(120).optional(),
      date: isoDate.optional(),
      endDate: isoDate.optional(),
      /** For places: the days it makes most sense to go. */
      days: z.array(weekday).optional(),
      time: clock.optional(),
      endTime: clock.optional(),
      /** Lowest and highest price per person in USD; 0 means free. Omit if unknown. */
      priceMin: z.number().min(0).optional(),
      priceMax: z.number().min(0).optional(),
      /** Overrides the computed price label, e.g. "Pay what you can". */
      priceNote: z.string().max(40).optional(),
      summary: z.string().min(10).max(240),
      source: link,
      /** More places to read about it (an Instagram post, a ticket page). */
      links: z.array(link).max(3).default([]),
      tags: z.array(z.enum(TAGS)).default([]),
      /** "Know before you go": RSVPs, age limits, codes, conflicting listings. */
      tips: z.array(z.string().min(3).max(120)).max(3).default([]),
      sheetId: z.string().regex(/^(EVT|LOC)-\d{3,}$/).optional(),
      verifiedAt: isoDate,
      status: z.enum(["published", "draft"]).default("published"),
    })
    .refine((a) => a.kind !== "event" || a.date, { message: "Events need a date", path: ["date"] })
    .refine((a) => a.kind !== "place" || (a.days && a.days.length > 0), {
      message: "Places need days",
      path: ["days"],
    }),
});

export const collections = { activities };
