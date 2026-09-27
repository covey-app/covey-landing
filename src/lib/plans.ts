/*
 * Example plans for the marketing demos. Every field maps to something the app
 * really shows (PlanCardView, BrochureOpeningCover, TimelineView, PlanMapPage,
 * PlanGroupPage in covey-ios) — but the plans themselves are illustrative, and
 * the UI labels them "Example plan".
 *
 * Rules for editing:
 *  - Public places and neighbourhoods only. No real business names: naming a
 *    venue on a marketing page reads as a partnership that doesn't exist.
 *  - Weekdays, never calendar dates, so the page can't go stale between deploys.
 *  - Seat counts stay inside what the app allows (host-set, default 6).
 */
import type { IconName } from "./icons";

export type CategoryKey =
  | "food"
  | "outdoors"
  | "sports"
  | "arts"
  | "culture"
  | "media"
  | "nightlife"
  | "fashion"
  | "professional";

export interface Stop {
  time: string;
  /** Activity chip label, e.g. "Coffee". */
  activity: string;
  category: CategoryKey;
  icon: IconName;
  title: string;
  venue: string;
  area: string;
  /** Position on the abstract route map, 0–100 on each axis. */
  at: [number, number];
}

export interface Leg {
  mode: "walk" | "bus";
  minutes: number;
}

export interface Person {
  name: string;
  initials: string;
  arrival?: "Arrived" | "On the way" | "Running late";
}

export interface ExamplePlan {
  id: string;
  /** Short label for the plan picker. */
  pick: string;
  title: string;
  hangout: "Casual" | "Event";
  join: "Open" | "Request to join";
  day: string;
  timeRange: string;
  area: string;
  description: string;
  seats: number;
  host: Person;
  /** Everyone going, host first. `going` is derived, as in the app. */
  people: Person[];
  stops: Stop[];
  /** legs[i] joins stops[i] → stops[i + 1]. */
  legs: Leg[];
}

export const EXAMPLE_PLANS: readonly ExamplePlan[] = [
  {
    id: "sunset",
    pick: "Sunset walk",
    title: "Lands End sunset walk",
    hangout: "Casual",
    join: "Open",
    day: "Sat",
    timeRange: "5:30 pm – 8:00 pm",
    area: "Outer Richmond",
    description:
      "Coffee, an easy walk along the cliffs, and sunset over the Sutro Baths ruins. Come as you are.",
    seats: 6,
    host: { name: "Maya", initials: "M" },
    people: [
      { name: "Maya", initials: "M", arrival: "Arrived" },
      { name: "Dev", initials: "D", arrival: "On the way" },
      { name: "Sam", initials: "S", arrival: "On the way" },
      { name: "Lena", initials: "L", arrival: "Running late" },
    ],
    stops: [
      {
        time: "From 5:30 pm",
        activity: "Coffee",
        category: "food",
        icon: "coffee",
        title: "Coffee on Clement",
        venue: "A café on Clement St",
        area: "Inner Richmond",
        at: [76, 34],
      },
      {
        time: "From 6:15 pm",
        activity: "Hiking",
        category: "outdoors",
        icon: "mountain",
        title: "Lands End Trail",
        venue: "Lands End Trailhead",
        area: "Outer Richmond",
        at: [36, 24],
      },
      {
        time: "From 7:20 pm",
        activity: "Sightseeing",
        category: "culture",
        icon: "sunset",
        title: "Sunset at Sutro Baths",
        venue: "Sutro Baths",
        area: "Point Lobos Ave",
        at: [16, 64],
      },
    ],
    legs: [
      { mode: "bus", minutes: 18 },
      { mode: "walk", minutes: 12 },
    ],
  },
  {
    id: "ramen",
    pick: "Ramen & arcade",
    title: "Japantown ramen & arcade",
    hangout: "Casual",
    join: "Request to join",
    day: "Fri",
    timeRange: "7:00 pm – 10:00 pm",
    area: "Japantown",
    description:
      "Ramen first, then settle scores at the arcade. Mochi for the walk home. Keeping it small, so request a seat.",
    seats: 5,
    host: { name: "Dev", initials: "D" },
    people: [
      { name: "Dev", initials: "D", arrival: "Arrived" },
      { name: "Priya", initials: "P", arrival: "Arrived" },
      { name: "Jonah", initials: "J", arrival: "On the way" },
    ],
    stops: [
      {
        time: "From 7:00 pm",
        activity: "Ramen",
        category: "food",
        icon: "soup",
        title: "Ramen at the counter",
        venue: "Japan Center",
        area: "Post St",
        at: [30, 50],
      },
      {
        time: "From 8:15 pm",
        activity: "Arcade games",
        category: "media",
        icon: "gamepad",
        title: "Arcade & photo booth",
        venue: "Japan Center malls",
        area: "Japantown",
        at: [60, 34],
      },
      {
        time: "From 9:30 pm",
        activity: "Dessert",
        category: "food",
        icon: "ice-cream",
        title: "Mochi for the road",
        venue: "Buchanan Mall",
        area: "Buchanan St",
        at: [72, 68],
      },
    ],
    legs: [
      { mode: "walk", minutes: 3 },
      { mode: "walk", minutes: 5 },
    ],
  },
  {
    id: "pickleball",
    pick: "Pickleball & brunch",
    title: "Sunday pickleball & brunch",
    hangout: "Casual",
    join: "Open",
    day: "Sun",
    timeRange: "9:30 am – 12:30 pm",
    area: "Mission",
    description:
      "Beginner-friendly doubles with paddles to share, then a long brunch. No one's keeping score. Mostly.",
    seats: 8,
    host: { name: "Priya", initials: "P" },
    people: [
      { name: "Priya", initials: "P", arrival: "Arrived" },
      { name: "Sam", initials: "S", arrival: "Arrived" },
      { name: "Ana", initials: "A", arrival: "On the way" },
      { name: "Theo", initials: "T", arrival: "On the way" },
      { name: "Kai", initials: "K", arrival: "Running late" },
    ],
    stops: [
      {
        time: "From 9:30 am",
        activity: "Pickleball",
        category: "sports",
        icon: "volleyball",
        title: "Doubles at the courts",
        venue: "Mission Playground",
        area: "Mission District",
        at: [34, 36],
      },
      {
        time: "From 11:30 am",
        activity: "Brunch",
        category: "food",
        icon: "croissant",
        title: "Brunch on Valencia",
        venue: "Valencia St",
        area: "Mission District",
        at: [66, 62],
      },
    ],
    legs: [{ mode: "walk", minutes: 6 }],
  },
];

/** "4/6 going" — the host counts toward going, exactly as PlanCardView does. */
export const goingLabel = (p: ExamplePlan) => `${p.people.length}/${p.seats} going`;

/** "SAT · 5:30 PM – 8:00 PM · OUTER RICHMOND · 3 STOPS" parts (uppercased by CSS). */
export const metaParts = (p: ExamplePlan) => [
  p.day,
  p.timeRange,
  p.area,
  `${p.stops.length} ${p.stops.length === 1 ? "stop" : "stops"}`,
];

/** Sample plans verbatim from the iOS signed-out marquee (SignedOutBrowseView). */
export const SAMPLE_PLANS: readonly { label: string; category: CategoryKey; icon: IconName }[] = [
  { label: "Trail run", category: "outdoors", icon: "footprints" },
  { label: "Gallery crawl", category: "culture", icon: "palette" },
  { label: "Ramen run", category: "food", icon: "soup" },
  { label: "Night market", category: "nightlife", icon: "moon-star" },
  { label: "Pickup hoops", category: "sports", icon: "trophy" },
  { label: "Film club", category: "media", icon: "film" },
  { label: "Long lunch", category: "food", icon: "utensils" },
  { label: "Thrift crawl", category: "fashion", icon: "shopping-bag" },
  { label: "Sunset picnic", category: "outdoors", icon: "sunset" },
];
