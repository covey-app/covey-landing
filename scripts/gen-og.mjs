// Renders public/og-image.png (1200×630) with Playwright, so the share card
// uses the real Geist Mono / Instrument Sans files from Fontsource — sharp's
// SVG text path silently fell back to system fonts. Run: npm run og
import { chromium } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const font = (pkg, file) =>
  pathToFileURL(resolve(root, "node_modules/@fontsource-variable", pkg, "files", file)).href;
const icon = pathToFileURL(resolve(root, "public/brand/app-icon-256.webp")).href;

const stops = [
  { c: "#E98A2E", t: "Coffee on Clement", m: "From 5:30 pm" },
  { c: "#7FAE3F", t: "Lands End Trail", m: "From 6:15 pm" },
  { c: "#6F4E37", t: "Sunset at Sutro Baths", m: "From 7:20 pm" },
];

const html = `<!doctype html><html><head><style>
@font-face { font-family: "Geist Mono"; src: url("${font("geist-mono", "geist-mono-latin-wght-normal.woff2")}") format("woff2"); font-weight: 100 900; }
@font-face { font-family: "Instrument Sans"; src: url("${font("instrument-sans", "instrument-sans-latin-wght-normal.woff2")}") format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; background: #F4F4F4; font-family: "Instrument Sans"; color: #1C1C1E;
  background-image: radial-gradient(60% 60% at 10% 0%, rgba(255,255,255,.85), transparent 70%); }
.wrap { position: absolute; inset: 0; padding: 64px 72px; display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 48px; align-items: center; }
.brand { display: flex; align-items: center; gap: 14px; margin-bottom: 40px; }
.brand img { width: 52px; height: 52px; border-radius: 12px; box-shadow: 0 0 0 1px rgba(28,28,30,.1), 0 2px 4px rgba(18,20,30,.1); }
.brand span { font-family: "Geist Mono"; font-weight: 600; font-size: 34px; letter-spacing: -0.03em; }
h1 { font-family: "Geist Mono"; font-weight: 600; font-size: 52px; line-height: 1.06; white-space: nowrap; letter-spacing: -0.035em; }
h1 em { font-style: normal; color: #6F4E37; }
.foot { margin-top: 36px; font-family: "Geist Mono"; font-weight: 600; font-size: 15px; letter-spacing: .14em; text-transform: uppercase; color: #6B6B70; }
.card { background: #fff; border-radius: 28px; padding: 30px 30px 26px; box-shadow: 0 2px 2px rgba(18,20,30,.05), 0 16px 26px rgba(18,20,30,.14); transform: rotate(-1.5deg); }
.mast { display: flex; justify-content: space-between; font-family: "Geist Mono"; font-weight: 600; font-size: 12px; letter-spacing: .14em; color: #6B6B70; text-transform: uppercase; margin-bottom: 14px; }
.title { font-family: "Geist Mono"; font-weight: 500; font-size: 28px; letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 18px; }
.stop { display: grid; grid-template-columns: 30px 1fr; gap: 12px; align-items: center; margin-top: 12px; }
.orb { width: 30px; height: 30px; border-radius: 999px; box-shadow: 0 1.5px 3px rgba(18,20,30,.1); }
.st { font-family: "Geist Mono"; font-weight: 500; font-size: 17px; }
.sm { font-family: "Geist Mono"; font-size: 13px; color: #6B6B70; margin-top: 2px; }
.seats { margin-top: 20px; padding-top: 14px; border-top: 1px solid #E3E3E1; display: flex; gap: 5px; align-items: center; }
.seat { width: 11px; height: 11px; border-radius: 999px; background: #112100; }
.seat.o { background: none; border: 1.4px solid #9A9AA0; }
.going { font-family: "Geist Mono"; font-size: 14px; color: #112100; margin-left: 8px; }
</style></head><body><div class="wrap">
  <div>
    <div class="brand"><img src="${icon}" alt=""><span>Covey</span></div>
    <h1>turn strangers<br>into <em>friends</em>,<br>one plan at a time.</h1>
    <p class="foot">coveyapp.co · small-group plans · San Francisco</p>
  </div>
  <div class="card">
    <div class="mast"><span>Covey</span><span>Example plan</span></div>
    <div class="title">Lands End sunset walk</div>
    ${stops.map((s) => `<div class="stop"><span class="orb" style="background:${s.c}"></span><div><div class="st">${s.t}</div><div class="sm">${s.m}</div></div></div>`).join("")}
    <div class="seats"><span class="seat"></span><span class="seat"></span><span class="seat"></span><span class="seat"></span><span class="seat o"></span><span class="seat o"></span><span class="going">4/6 going</span></div>
  </div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
// file:// fonts only load from a file:// document, so render from a temp file.
const dir = mkdtempSync(join(tmpdir(), "covey-og-"));
const file = join(dir, "og.html");
writeFileSync(file, html);
await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const out = resolve(root, "public/og-image.png");
await page.screenshot({ path: out });
await browser.close();
rmSync(dir, { recursive: true, force: true });
console.log("Wrote", out);
