/**
 * Fails if tokens.json has drifted from the Expo theme in the covey-web repo.
 *
 * covey-web's lib/theme/colors.ts and lib/theme/typography.ts remain the
 * source of truth: this script never writes to them. When it fails, either
 * the Expo theme changed on purpose (update tokens.json here, then
 * `npm run tokens:generate`) or a token was edited in the wrong place.
 *
 * Requires a covey-web checkout — sibling directory by default, or set
 * COVEY_WEB_DIR. CI runs only the standalone staleness check
 * (`generate.mjs --check`); this drift check is for local development.
 *
 *   node scripts/design-tokens/verify.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readExpoTheme, normalizeColor, repoRoot } from './parse-expo-theme.mjs';

const tokens = JSON.parse(
  readFileSync(path.join(repoRoot, 'scripts/design-tokens/tokens.json'), 'utf8')
);
const expo = readExpoTheme();

const problems = [];

function compare(label, expected, actual, equal = (a, b) => a === b) {
  if (actual === undefined) problems.push(`${label}: missing from the Expo theme`);
  else if (!equal(expected, actual)) problems.push(`${label}: tokens.json ${expected} ≠ ${actual}`);
}

for (const palette of ['light', 'dark']) {
  const expoPalette = expo.colors[palette];
  for (const [key, value] of Object.entries(tokens.colors[palette])) {
    compare(
      `colors.${palette}.${key}`,
      value,
      expoPalette[key],
      (a, b) => normalizeColor(a) === normalizeColor(b)
    );
  }
  for (const key of Object.keys(expoPalette)) {
    if (!(key in tokens.colors[palette])) {
      problems.push(`colors.${palette}.${key}: in the Expo theme but not in tokens.json`);
    }
  }
}

for (const [key, value] of Object.entries(tokens.radii)) compare(`radii.${key}`, value, expo.radii[key]);
for (const [key, value] of Object.entries(tokens.spacing)) {
  compare(`spacing.${key}`, value, expo.spacing[key]);
}

// Native font names are PostScript faces ("GeistMono-SemiBold"); the web side
// only shares the family, so check every RN face resolves to a known family.
const prefixes = Object.entries(tokens.fontFamilies).map(([key, font]) => [key, font.nativePrefix]);
for (const [face, value] of Object.entries(expo.fonts)) {
  if (!prefixes.some(([, prefix]) => value.startsWith(prefix))) {
    problems.push(
      `fonts.${face}: "${value}" does not belong to any family in tokens.json (${prefixes
        .map(([, prefix]) => prefix)
        .join(', ')})`
    );
  }
}
for (const [key, prefix] of prefixes) {
  if (!Object.values(expo.fonts).some((value) => value.startsWith(prefix))) {
    problems.push(`fontFamilies.${key}: no "${prefix}*" face is used by the Expo theme`);
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} token drift(s) between tokens.json and the Expo theme:\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    `\nSource of truth: ${expo.sources.colors}, ${expo.sources.typography}`
  );
  process.exit(1);
}

const counts = [
  `${Object.keys(tokens.colors.light).length}×2 colors`,
  `${Object.keys(tokens.radii).length} radii`,
  `${Object.keys(tokens.spacing).length} spacing`,
  `${Object.keys(tokens.fontFamilies).length} font families`,
];
console.log(`✓ tokens.json matches the Expo theme (${counts.join(', ')})`);
