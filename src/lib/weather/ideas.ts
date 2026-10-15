/*
 * Weather plans: turn a day's forecast into something to do with a few
 * people. Pure and dependency-free so it runs in the browser (WeatherPlans)
 * and under node --test.
 *
 * The ideas are evergreen plan suggestions, not listings: nothing here
 * claims an event exists. Edit freely — keep them small-group, cheap or free,
 * and true to San Francisco (fog at the beach usually means sun in the
 * Mission; warm evenings are rare, so they get used).
 */
import type { ForecastDay } from "./forecast";

export type Mood = "wet" | "hot" | "warm" | "sunny" | "grey" | "cold" | "windy";
export type IdeaIcon =
  | "soup"
  | "dices"
  | "landmark"
  | "popcorn"
  | "cooking-pot"
  | "coffee"
  | "cloud-fog"
  | "book-open"
  | "shopping-bag"
  | "sun"
  | "utensils"
  | "bike"
  | "sunset"
  | "ice-cream-cone"
  | "waves"
  | "wind"
  | "mountain";

export interface Idea {
  title: string;
  line: string;
  icon: IdeaIcon;
}

const SOUP: Idea = { title: "host a soup night", line: "One big pot, and everyone brings bread or a topping. The best excuse there is to have people over.", icon: "soup" };
const READ: Idea = { title: "go to the park and read", line: "Dolores, Alamo Square, or a quiet corner of Golden Gate Park. Bring a blanket and one friend, or none.", icon: "book-open" };
const BEACH: Idea = { title: "beach day at Baker Beach", line: "Bridge views, cold water, warm sand. Get there before the afternoon wind picks up.", icon: "waves" };

export const IDEAS: Record<Mood, Idea[]> = {
  wet: [
    SOUP,
    { title: "board games at someone's place", line: "Pick a host, pick a game nobody's played, order dumplings.", icon: "dices" },
    { title: "a museum, while everyone stays home", line: "Rainy days are the quiet days at the de Young and SFMOMA. Go with two friends and split up at the good rooms.", icon: "landmark" },
    { title: "a matinee double feature", line: "Two films at a neighborhood theater, a vote on snacks, and dinner to argue about them after.", icon: "popcorn" },
  ],
  cold: [
    SOUP,
    { title: "hot pot for four", line: "Hot pot is built for groups. Split one in the Richmond or the Sunset.", icon: "cooking-pot" },
    { title: "a café crawl with a book", line: "Three cafés, a chapter at each. Warm, cheap, and good alone or with one friend.", icon: "coffee" },
  ],
  grey: [
    { title: "walk Lands End in the fog", line: "Fog is the point: cypress trees, the Sutro Baths ruins, and the bridge appearing and disappearing.", icon: "cloud-fog" },
    { title: "a bookstore crawl", line: "North Beach to the Mission, one bookstore at a time. Grey days are reading days.", icon: "book-open" },
    { title: "head east for the sun", line: "Fog at the beach usually means sun in the Mission. Dolores Park is a bet worth making.", icon: "sun" },
    { title: "thrift and coffee in the Haight", line: "Set a $20 limit each and dress each other.", icon: "shopping-bag" },
  ],
  sunny: [
    READ,
    { title: "a long-table picnic", line: "Everyone brings one thing. Pick a park, set a time, and see who shows up.", icon: "utensils" },
    { title: "bike to the ocean", line: "Golden Gate Park end to end, then fries at the beach. About three miles each way.", icon: "bike" },
  ],
  warm: [
    READ,
    { title: "a sunset picnic on Bernal Hill", line: "Warm evenings are rare here. Carry dinner up the hill and watch the city light up.", icon: "sunset" },
    { title: "an ice cream crawl", line: "Three scoop shops, a walk between each, and a ranking at the end.", icon: "ice-cream-cone" },
    BEACH,
  ],
  hot: [
    BEACH,
    { title: "a swim at Aquatic Park", line: "Cold water, hot air: the bay at its friendliest. Bring a friend and a towel.", icon: "waves" },
    { title: "somewhere with air conditioning", line: "A museum or a matinee in the middle of the day, then outside again once it cools off.", icon: "landmark" },
  ],
  windy: [
    { title: "fly a kite at Crissy Field", line: "Dry and windy is kite weather, with the bridge behind you.", icon: "wind" },
    { title: "a climbing gym session", line: "Indoors, social, and everyone's sore together the next day.", icon: "mountain" },
    SOUP,
  ],
};

/** Labels for the fallback shown before (or without) a forecast. */
export const WHATEVER_THE_WEATHER: { when: string; mood: Mood; idea: Idea }[] = [
  { when: "If it's cold or wet", mood: "wet", idea: SOUP },
  { when: "If it's foggy", mood: "grey", idea: IDEAS.grey[0] },
  { when: "If it's sunny", mood: "sunny", idea: READ },
];

/** What kind of day it is, for choosing ideas. Rain beats everything; then
    temperature; then wind; then whether the sun's out. */
export function moodOf(d: Pick<ForecastDay, "high" | "low" | "rain" | "wind" | "sky">): Mood {
  const sky = d.sky.toLowerCase();
  const high = d.high ?? d.low ?? 60;
  if (d.rain >= 50 || /rain|shower|drizzle|thunder/.test(sky)) return "wet";
  if (high >= 85) return "hot";
  if (high < 60) return "cold";
  if (d.wind >= 20) return "windy";
  if (high >= 73) return "warm";
  if (/sunny|clear/.test(sky)) return "sunny";
  return /fog|cloud|overcast|haze/.test(sky) ? "grey" : "sunny";
}

/** Whether a mood favors being outside (used to suggest a listing). */
export const OUTDOOR_MOODS: Mood[] = ["sunny", "warm", "hot", "grey"];

/** One idea per day, rotating by date and never repeating within a run. */
export function ideasFor(days: { date: string; mood: Mood }[]): Idea[] {
  const used = new Set<string>();
  return days.map(({ date, mood }) => {
    const list = IDEAS[mood];
    const start = Number(date.slice(8, 10)) % list.length;
    for (let i = 0; i < list.length; i++) {
      const idea = list[(start + i) % list.length];
      if (!used.has(idea.title)) {
        used.add(idea.title);
        return idea;
      }
    }
    return list[start];
  });
}

const rad = Math.PI / 180;

/** Sunset in San Francisco for a YYYY-MM-DD date, as "6:25pm" (the sunrise
    equation; within a minute or two of the almanac). */
export function sunsetSF(iso: string, lat = 37.7749, lon = -122.4194): string {
  const [y, m, d] = iso.split("-").map(Number);
  const jd = Date.UTC(y, m - 1, d, 12) / 86_400_000 + 2_440_587.5;
  const n = Math.round(jd - 2_451_545 + 0.0008);
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit = 2_451_545 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const decl = Math.asin(Math.sin(lambda * rad) * Math.sin(23.4397 * rad));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(decl)) / (Math.cos(lat * rad) * Math.cos(decl));
  const set = transit + Math.acos(cosW) / rad / 360;
  const ms = (set - 2_440_587.5) * 86_400_000;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" })
    .format(new Date(ms))
    .replace(" ", "")
    .toLowerCase();
}
