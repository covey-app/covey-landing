import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, "../public/og-image.png");

// 1200x630 OG card on the current Covey palette (paper ground, charcoal ink,
// the 5-color flock dot cluster, Geist-style wordmark + tagline).
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#F4F4F4"/>
  <rect x="40" y="40" width="1120" height="550" rx="28" fill="#FFFFFF" stroke="#E3E3E1" stroke-width="1.4"/>
  <radialGradient id="bloom" cx="18%" cy="8%" r="70%">
    <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/>
    <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
  </radialGradient>
  <rect x="40" y="40" width="1120" height="550" rx="28" fill="url(#bloom)"/>

  <g transform="translate(100,150)">
    <circle cx="0"   cy="0" r="13" fill="#C77A5A"/>
    <circle cx="34"  cy="0" r="13" fill="#3DB078"/>
    <circle cx="68"  cy="0" r="13" fill="#5C7BD9"/>
    <circle cx="102" cy="0" r="13" fill="#E2A634"/>
    <circle cx="136" cy="0" r="13" fill="#112100"/>
  </g>

  <text x="98" y="330" font-family="'Geist Mono','SF Mono',ui-monospace,monospace" font-size="150" font-weight="600" letter-spacing="-6" fill="#1C1C1E">Covey</text>

  <text x="102" y="410" font-family="'Geist Mono','SF Mono',ui-monospace,monospace" font-size="30" letter-spacing="4" fill="#6B6B70">/kuh-vee/ &#183; a small group, one plan, one day</text>

  <text x="102" y="500" font-family="'Instrument Sans',system-ui,sans-serif" font-size="40" fill="#1C1C1E">Make a plan. Open a few spots. Meet people through it.</text>

  <text x="102" y="545" font-family="'Geist Mono','SF Mono',ui-monospace,monospace" font-size="22" letter-spacing="3" fill="#6F4E37">COVEYAPP.CO &#183; iOS, INVITE-ONLY</text>
</svg>`;

await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toFile(out);

console.log("Wrote", out);
