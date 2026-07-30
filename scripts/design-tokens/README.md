# scripts/design-tokens

Brand tokens shared with the Covey product app — the separate
[`covey-web`](https://github.com/covey-app/covey-web) repo, deployed at
`app.coveyapp.co` while this site owns `coveyapp.co`.

Sharing is deliberately **one-directional**, across two repositories:

```
covey-web: lib/theme/colors.ts     source of truth (Expo runtime, ported from iOS)
        │  verified against (needs a covey-web checkout)
        ▼
tokens.json                        canonical, framework-neutral copy (this repo)
        │  generate.mjs
        ▼
src/styles/tokens.css              consumed by the Astro global.css
```

Nothing here writes to covey-web. If the Expo theme changes over there,
`verify.mjs` fails and you update `tokens.json` to match — never the other
way round.

## Commands

Run from the repo root (no dependencies, plain node):

```bash
npm run tokens:generate   # rewrite src/styles/tokens.css
npm run tokens:check      # standalone: fail if tokens.css is stale vs tokens.json
npm run tokens:verify     # drift check against covey-web + the staleness check
```

`tokens:verify` needs a covey-web checkout: a sibling directory
(`../covey-web`) by default, or set `COVEY_WEB_DIR=/path/to/covey-web`. CI
runs only `tokens:check`, which needs nothing outside this repo.

`tokens:verify` fails when:

- any color in `tokens.json` differs from covey-web's `lib/theme/colors.ts`
  (hex case and whitespace inside `rgba()` are normalized before comparing);
- a palette key exists in the Expo theme but is missing from `tokens.json`;
- a radius or spacing value differs from `lib/theme/colors.ts`;
- a font face in `lib/theme/typography.ts` doesn't belong to one of the three
  families here, or a family here is unused by the Expo theme;
- `src/styles/tokens.css` is out of date with `tokens.json`.

## What is and isn't shared

Shared, and therefore generated: colors (light + dark), radii, spacing, font
family stacks.

Not shared: shadows (the web values are tuned for CSS box-shadow and diverge
from the RN elevation tokens), the activity category palette (no Expo
counterpart yet), and motion curves. Those stay hand-written in
`src/styles/global.css`.

The generated CSS only emits the colors listed in `$cssColorNames`; the rest of
the palette stays in `tokens.json` so the drift check covers the whole theme
without shipping unused custom properties.

## Files

| File | Role |
| --- | --- |
| `tokens.json` | Canonical values + the color → CSS custom property map |
| `generate.mjs` | Writes `tokens.css`; `--check` mode fails on a stale file |
| `verify.mjs` | Compares `tokens.json` against the covey-web Expo theme |
| `parse-expo-theme.mjs` | Reads covey-web's `lib/theme/*.ts` as text (they import `react-native`, so they can't be imported from node) |
