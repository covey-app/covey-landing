/**
 * Reads the covey-web Expo theme modules as text so the token tooling never
 * has to load React Native (lib/theme/colors.ts imports `react-native`, which
 * cannot be required from plain node). Deliberately dependency-free.
 *
 * covey-web is a SEPARATE repository — this script finds it via the
 * COVEY_WEB_DIR environment variable, defaulting to a sibling checkout
 * (../covey-web). The drift check in verify.mjs is therefore a local dev
 * tool; CI only runs the standalone tokens.css staleness check.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const coveyWebRoot = process.env.COVEY_WEB_DIR
  ? path.resolve(process.env.COVEY_WEB_DIR)
  : path.resolve(repoRoot, '../covey-web');

const COLORS_PATH = path.join(coveyWebRoot, 'lib/theme/colors.ts');
const TYPOGRAPHY_PATH = path.join(coveyWebRoot, 'lib/theme/typography.ts');

/**
 * Returns the source between the brace that follows `marker` and its match.
 * Top-level `export const x` declarations open on `= {`, skipping any inline
 * type annotation (`export const palettes: { light: … } = {`).
 */
function braceBlock(source, marker, afterAssignment = marker.startsWith('export')) {
  const markerAt = source.indexOf(marker);
  if (markerAt === -1) throw new Error(`Could not find \`${marker}\` in the Expo theme source.`);
  let open;
  if (afterAssignment) {
    const rest = source.slice(markerAt);
    const assigned = /=\s*\{/.exec(rest);
    if (!assigned) throw new Error(`No object literal assigned to \`${marker}\`.`);
    open = markerAt + assigned.index + assigned[0].length - 1;
  } else {
    open = source.indexOf('{', markerAt);
  }
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`Unbalanced braces after \`${marker}\`.`);
}

function stringEntries(block) {
  const out = {};
  for (const [, key, value] of block.matchAll(/(\w+):\s*'([^']*)'/g)) out[key] = value;
  return out;
}

function numberEntries(block) {
  const out = {};
  for (const [, key, value] of block.matchAll(/(\w+):\s*(-?\d+(?:\.\d+)?)\s*,/g)) {
    out[key] = Number(value);
  }
  return out;
}

export function readExpoTheme() {
  if (!existsSync(COLORS_PATH)) {
    throw new Error(
      `covey-web checkout not found at ${coveyWebRoot} (looked for lib/theme/colors.ts).\n` +
        `Clone covey-web as a sibling directory, or point COVEY_WEB_DIR at it:\n` +
        `  COVEY_WEB_DIR=/path/to/covey-web npm run tokens:verify`
    );
  }
  const colorsSource = readFileSync(COLORS_PATH, 'utf8');
  const palettesBlock = braceBlock(colorsSource, 'export const palettes');

  return {
    sources: { colors: COLORS_PATH, typography: TYPOGRAPHY_PATH },
    colors: {
      light: stringEntries(braceBlock(palettesBlock, 'light:')),
      dark: stringEntries(braceBlock(palettesBlock, 'dark:')),
    },
    radii: numberEntries(braceBlock(colorsSource, 'export const radii')),
    spacing: numberEntries(braceBlock(colorsSource, 'export const spacing')),
    fonts: stringEntries(braceBlock(readFileSync(TYPOGRAPHY_PATH, 'utf8'), 'export const fonts')),
  };
}

/** `#AABBCC` and `rgba(1, 2, 3, 0.4)` compare equal regardless of case/spacing. */
export function normalizeColor(value) {
  return value.toLowerCase().replace(/\s+/g, '');
}
