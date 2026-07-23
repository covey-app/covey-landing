/*
 * Activity categories — mirrors the iOS app's ActivityCategoryPalette.swift
 * (Activity Taxonomy v2, 9 categories). The exact per-category hex values
 * (light + dark) live as CSS custom properties in `src/styles/global.css`
 * (`--cat-{key}`, `--cat-{key}-soft`, `--cat-{key}-ink`) so category colors
 * theme correctly in dark mode. This file is the single source for the
 * ordered list, display labels, and the CSS-variable key each maps to.
 */

export interface Category {
  /** CSS-variable key: colors resolve to `--cat-{key}` etc. */
  key: string;
  /** Canonical slug from ActivityCategorySlug. */
  slug: string;
  /** Display label (matches the app). */
  label: string;
  /** A few representative real-world plans, for marketing copy. */
  examples: string;
}

export const CATEGORIES: readonly Category[] = [
  { key: "food", slug: "food_drink", label: "Food & Drink", examples: "wine crawls · supper clubs · coffee walks" },
  { key: "outdoors", slug: "outdoors", label: "Outdoors", examples: "sunrise hikes · picnics · tidepools" },
  { key: "sports", slug: "sports", label: "Sports & Fitness", examples: "run clubs · bouldering · pickleball" },
  { key: "arts", slug: "arts_crafts", label: "Arts & Crafts", examples: "pottery nights · life drawing · film photo" },
  { key: "culture", slug: "culture", label: "Culture & Sightseeing", examples: "gallery loops · museum days · landmarks" },
  { key: "media", slug: "media", label: "Media", examples: "screenings · listening parties · game nights" },
  { key: "nightlife", slug: "nightlife_parties", label: "Nightlife & Parties", examples: "warehouse sets · karaoke · dance floors" },
  { key: "fashion", slug: "fashion", label: "Shopping", examples: "thrift runs · flea markets · vintage" },
  { key: "professional", slug: "professional", label: "Professional", examples: "coworking · mixers · office hours" },
] as const;
