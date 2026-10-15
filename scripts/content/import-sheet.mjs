// Turn a CSV export of the "Covey Social Media Manager [SF]" workbook's
// Events or Location Bank sheet into activity files for the weekly guide.
//
//   node scripts/content/import-sheet.mjs <export.csv> [--out content/live/activities] [--force] [--dry-run]
//
// In Google Sheets: open the sheet tab → File → Download → Comma-separated
// values. The header row is found automatically (the row starting with
// "Event ID" or "Location ID"); the instruction rows above it are ignored.
//
// A row becomes a file only when it's publishable — it has a name, a source
// link, a "Last verified" date, a category, and a one-line hook ("Notes /
// hook") to use as the summary — and its Status isn't an idea or a draft.
// Everything skipped is listed with the reason. Existing files are never
// overwritten without --force, so edits made in the files survive re-imports.
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const outIdx = args.indexOf("--out");
const OUT = outIdx > -1 ? args[outIdx + 1] : "content/live/activities";
const FORCE = args.includes("--force");
const DRY = args.includes("--dry-run");
if (!file) {
  console.error("usage: node scripts/content/import-sheet.mjs <export.csv> [--out dir] [--force] [--dry-run]");
  process.exit(1);
}

// Sheet category (Taxonomy & Settings) → site category key (src/lib/categories.ts).
const CATEGORY = {
  "food & drink": "food",
  outdoors: "outdoors",
  "sports & fitness": "sports",
  media: "media",
  "arts & crafts": "arts",
  "culture & sightseeing": "culture",
  "nightlife & parties": "nightlife",
  professional: "professional",
  shopping: "fashion",
};
const SKIP_STATUS = /^(idea|draft|archived|cancel)/i;

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const isoDate = (v) => {
  v = (v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return undefined;
};
const clock = (v) => {
  v = (v ?? "").trim();
  let m = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (!m) return undefined;
  let h = Number(m[1]);
  if (m[3]) h = (h % 12) + (m[3].toLowerCase() === "pm" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${m[2]}`;
};
const money = (v) => {
  const nums = (v ?? "").replace(/,/g, "").match(/\d+(\.\d+)?/g);
  if (/free/i.test(v ?? "")) return { min: 0 };
  if (!nums) return {};
  return { min: Number(nums[0]), max: nums[1] ? Number(nums[1]) : undefined };
};
const yes = (v) => /^(y|yes|true|1|✓|x)$/i.test((v ?? "").trim());
const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);
const q = (s) => JSON.stringify(String(s));

const rows = parseCsv(await readFile(file, "utf8"));
const headerAt = rows.findIndex((r) => r[0] === "Event ID" || r[0] === "Location ID");
if (headerAt < 0) {
  console.error('No header row found (expected a row starting with "Event ID" or "Location ID").');
  process.exit(1);
}
const header = rows[headerAt].map((h) => h.trim());
const isEvents = header[0] === "Event ID";
const get = (r, name) => (r[header.indexOf(name)] ?? "").trim();

const written = [], skipped = [];
if (!DRY) await mkdir(OUT, { recursive: true });

for (const r of rows.slice(headerAt + 1)) {
  const id = r[0]?.trim();
  if (!id) continue;
  const name = get(r, isEvents ? "Event name" : "Location name");
  const source = get(r, isEvents ? "Ticket / source link" : "Source link");
  const verified = isoDate(get(r, "Last verified"));
  const category = CATEGORY[get(r, "Category").toLowerCase()];
  const summary = get(r, "Notes / hook");
  const status = get(r, "Status");
  const why = [];
  if (!name) why.push("no name");
  if (!/^https?:\/\//.test(source)) why.push("no source link");
  if (!verified) why.push('no "Last verified" date');
  if (!category) why.push(`unknown category "${get(r, "Category")}"`);
  if (summary.length < 10) why.push('needs a one-line "Notes / hook" for the summary');
  if (SKIP_STATUS.test(status)) why.push(`status is "${status}"`);
  const fm = [`title: ${q(name)}`, `kind: ${isEvents ? "event" : "place"}`, `category: ${category}`];
  const activity = get(r, "Activity");
  if (activity) fm.push(`activity: ${q(activity.slice(0, 40))}`);
  fm.push(`venue: ${q(isEvents ? get(r, "Venue") || name : name)}`, `neighborhood: ${q(get(r, "Neighborhood") || get(r, "City") || "San Francisco")}`);
  const tags = [];
  if (isEvents) {
    const date = isoDate(get(r, "Start date"));
    if (!date) why.push("no start date");
    else fm.push(`date: ${q(date)}`);
    const end = isoDate(get(r, "End date"));
    if (end && end !== date) fm.push(`endDate: ${q(end)}`);
    const t = clock(get(r, "Start time"));
    if (t) fm.push(`time: ${q(t)}`);
    const p = money(get(r, "Price USD"));
    if (p.min !== undefined) fm.push(`priceMin: ${p.min}`);
    if (p.max !== undefined) fm.push(`priceMax: ${p.max}`);
    if (p.min === 0) tags.push("free");
    if (get(r, "Booking deadline")) tags.push("reservation");
  } else {
    const address = get(r, "Address");
    if (address) fm.push(`address: ${q(address.slice(0, 120))}`);
    const days = [...(yes(get(r, "After work?")) ? ["mon", "tue", "wed", "thu", "fri"] : []), ...(yes(get(r, "Weekend?")) ? ["sat", "sun"] : [])];
    if (!days.length) why.push('neither "After work?" nor "Weekend?" is set');
    else fm.push(`days: [${days.join(", ")}]`);
    if (yes(get(r, "After work?"))) tags.push("after-work");
    if (yes(get(r, "Weekend?"))) tags.push("weekend");
    const p = money(get(r, "Cost / person USD"));
    if (p.min !== undefined) fm.push(`priceMin: ${p.min}`);
    if (p.max !== undefined) fm.push(`priceMax: ${p.max}`);
    if (p.min === 0) tags.push("free");
    if (yes(get(r, "Reservation"))) tags.push("reservation");
  }
  if (why.length) {
    skipped.push(`${id} ${name || "(unnamed)"}: ${why.join("; ")}`);
    continue;
  }
  fm.push(`summary: ${q(summary.slice(0, 240))}`);
  fm.push(`source: { url: ${q(source)}, name: ${q(new URL(source).hostname.replace(/^www\./, ""))} }`);
  fm.push(`tags: [${[...new Set(tags)].join(", ")}]`);
  fm.push(`sheetId: ${q(id)}`, `verifiedAt: ${q(verified)}`);
  const path = join(OUT, `${slug(name)}-${id.toLowerCase()}.md`);
  let exists = false;
  try { await access(path); exists = true; } catch {}
  if (exists && !FORCE) {
    skipped.push(`${id} ${name}: ${path} already exists (use --force to replace)`);
    continue;
  }
  if (!DRY) await writeFile(path, `---\n${fm.join("\n")}\n---\n`);
  written.push(path);
}

console.log(`${isEvents ? "Events" : "Location Bank"}: ${written.length} written${DRY ? " (dry run)" : ""}, ${skipped.length} skipped`);
for (const w of written) console.log(`  + ${w}`);
for (const s of skipped) console.log(`  - ${s}`);
console.log("\nCheck each file, then run `npm run check` — the content schema rejects anything incomplete.");
