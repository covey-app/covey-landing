/*
 * The nine plan categories, shared by the content schema, the activities
 * directory, the newsletter, and the hero cast. Keys match `--cat-*` in
 * global.css (ActivityCategoryPalette.swift) and CategoryKey in plans.ts.
 *
 * `icon` is the app's category glyph (covey-ios ActivityGlyph.categoryGlyphs,
 * the white symbol inside a CategoryStopBead) translated to its closest Lucide
 * icon — SF Symbols can't be used on the web. `bird` is the category quail
 * from covey-ios (OnboardingBird*), restored from the asset catalog's history
 * into public/brand/flock/, used for illustration, not as an icon.
 */
import type { IconName } from "./icons";

export const CATEGORY_KEYS = [
  "food",
  "outdoors",
  "sports",
  "arts",
  "culture",
  "media",
  "nightlife",
  "fashion",
  "professional",
] as const;
export type Category = (typeof CATEGORY_KEYS)[number];

export const CATEGORIES: Record<Category, { label: string; short: string; icon: IconName; bird: string; doing: string }> = {
  food: { label: "Food & drink", short: "Food", icon: "utensils", bird: "food", doing: "out for a bite" }, // fork.knife
  outdoors: { label: "Outdoors", short: "Outdoors", icon: "leaf", bird: "outdoors", doing: "on the trail" }, // leaf.fill
  sports: { label: "Sports & fitness", short: "Sports", icon: "footprints", bird: "sports", doing: "on the court" }, // figure.run (no Lucide runner)
  arts: { label: "Arts & making", short: "Arts", icon: "palette", bird: "arts", doing: "at the wheel" }, // paintpalette.fill
  culture: { label: "Culture", short: "Culture", icon: "landmark", bird: "culture", doing: "at the museum" }, // building.columns.fill
  media: { label: "Film, books & games", short: "Media", icon: "square-play", bird: "media", doing: "on the couch" }, // play.rectangle.fill
  nightlife: { label: "Nightlife", short: "Nightlife", icon: "moon-star", bird: "nightlife", doing: "on the dance floor" }, // moon.stars.fill
  fashion: { label: "Shopping & style", short: "Style", icon: "shopping-bag", bird: "fashion", doing: "thrifting" }, // bag.fill
  professional: { label: "Professional", short: "Pro", icon: "briefcase", bird: "professional", doing: "at a meetup" }, // briefcase.fill
};

export const TAGS = ["after-work", "weekend", "free", "solo-friendly", "reservation", "outdoors", "all-ages"] as const;
export type Tag = (typeof TAGS)[number];

export const TAG_LABELS: Record<Tag, string> = {
  "after-work": "After work",
  weekend: "Weekend",
  free: "Free",
  "solo-friendly": "Good solo",
  reservation: "Book ahead",
  outdoors: "Outside",
  "all-ages": "All ages",
};

/** srcset for a category quail illustration. */
export function birdSrc(category: Category): { src: string; srcset: string } {
  const b = CATEGORIES[category].bird;
  return { src: `/brand/flock/${b}-240.webp`, srcset: `/brand/flock/${b}-240.webp 1x, /brand/flock/${b}-480.webp 2x` };
}
