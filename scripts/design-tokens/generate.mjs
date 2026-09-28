/**
 * Emits src/styles/tokens.css from tokens.json.
 *
 * Only this Astro site consumes the output — the Expo app (the separate
 * covey-web repo) keeps reading its lib/theme/colors.ts directly, so token
 * sharing stays one-directional and this script can never rewrite the RN
 * theme.
 *
 *   node scripts/design-tokens/generate.mjs            # write
 *   node scripts/design-tokens/generate.mjs --check    # exit 1 if stale
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './parse-expo-theme.mjs';

const TOKENS_PATH = path.join(repoRoot, 'scripts/design-tokens/tokens.json');
const OUT_PATH = path.join(repoRoot, 'src/styles/tokens.css');

const tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));

function colorBlock(palette) {
  const map = tokens.$cssColorNames;
  return Object.entries(map)
    .filter(([key]) => !key.startsWith('$'))
    .map(([key, cssName]) => {
      const value = tokens.colors[palette][key];
      if (value === undefined) throw new Error(`tokens.json: colors.${palette}.${key} is missing.`);
      return `  ${cssName}: ${value};`;
    })
    .join('\n');
}

function scaleBlock(prefix, values) {
  return Object.entries(values)
    .map(([key, value]) => `  --${prefix}-${kebab(key)}: ${value}px;`)
    .join('\n');
}

function kebab(key) {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function renderCss() {
  const fonts = Object.entries(tokens.fontFamilies)
    .map(([key, font]) => `  --ff-${key}: ${font.stack};`)
    .join('\n');

  return `/*
 * GENERATED FILE — DO NOT EDIT.
 * Source: scripts/design-tokens/tokens.json
 * Regenerate: npm run tokens:generate   Verify: npm run tokens:verify
 *
 * These are the tokens shared with the Expo app (covey-web repo:
 * lib/theme/colors.ts, lib/theme/typography.ts). Landing-only values —
 * shadows, the activity category palette, motion — stay hand-written in
 * global.css.
 */

:root {
  color-scheme: light;

${colorBlock('light')}

  /* Font stacks — CoveyFontFamily */
${fonts}

  /* Radii — CoveyRadius */
${scaleBlock('rad', tokens.radii)}

  /* Spacing — CoveySpacing (8-pt system) */
${scaleBlock('space', tokens.spacing)}
}

.dark {
  color-scheme: dark;

${colorBlock('dark')}
}
`;
}

const css = renderCss();

if (process.argv.includes('--check')) {
  let current = null;
  try {
    current = readFileSync(OUT_PATH, 'utf8');
  } catch {
    /* missing file reports as stale below */
  }
  if (current !== css) {
    console.error(`✗ src/styles/tokens.css is stale. Run \`npm run tokens:generate\`.`);
    process.exit(1);
  }
  console.log('✓ tokens.css is up to date with tokens.json');
} else {
  writeFileSync(OUT_PATH, css);
  console.log(`✓ wrote ${path.relative(repoRoot, OUT_PATH)}`);
}
