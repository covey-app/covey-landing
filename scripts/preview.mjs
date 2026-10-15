// Production preview: serves the built site exactly the way Vercel routes it.
// `astro preview` doesn't support @astrojs/vercel, and Playwright needs the
// production build, so this follows the build's own routing table
// (.vercel/output/config.json):
//
//   1. vercel.json redirects
//   2. files in .vercel/output/static ("handle": "filesystem")
//   3. routes whose dest is the Astro function (/api/*, /newsletter/confirm,
//      /newsletter/unsubscribe) → the built function's fetch() handler
//   4. everything else → /404.html
//
//   npm run build && npm run preview            # http://localhost:4321
//   npm run preview -- --port 4322
//
// Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (and the email vars) from
// the environment or .env, as the function would on Vercel. Without them the
// endpoints answer 503 "not_configured", exactly as production would.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(root, ".vercel/output");
const STATIC = join(OUT, "static");
const portArg = process.argv.indexOf("--port");
const PORT = Number(portArg > -1 ? process.argv[portArg + 1] : process.env.PORT || 4321);

const vercel = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"));
const redirects = new Map((vercel.redirects ?? []).map((r) => [r.source, r]));
const config = JSON.parse(await readFile(join(OUT, "config.json"), "utf8"));
const fnRoutes = config.routes.filter((r) => r.dest === "_render").map((r) => new RegExp(r.src));
const fnConfig = JSON.parse(await readFile(join(OUT, "functions/_render.func/.vc-config.json"), "utf8"));
const fn = (await import(pathToFileURL(join(OUT, "functions/_render.func", fnConfig.handler)).href)).default;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

async function fileFor(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [join(STATIC, safe), join(STATIC, safe, "index.html"), join(STATIC, `${safe}.html`)]) {
    if (!candidate.startsWith(STATIC)) continue;
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  const redirect = redirects.get(path);
  if (redirect) {
    res.writeHead(redirect.permanent ? 308 : 307, { location: redirect.destination }).end();
    return;
  }

  const file = req.method === "GET" || req.method === "HEAD" ? await fileFor(url.pathname) : null;
  if (file) {
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : await readFile(file));
    return;
  }

  if (fnRoutes.some((re) => re.test(url.pathname))) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = new Headers(req.headers);
    headers.set("x-forwarded-for", req.socket.remoteAddress ?? "127.0.0.1");
    const body = chunks.length && req.method !== "GET" && req.method !== "HEAD" ? Buffer.concat(chunks) : undefined;
    const response = await fn.fetch(new Request(url, { method: req.method, headers, body }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }

  const notFound = await fileFor("/404.html");
  res.writeHead(404, { "content-type": TYPES[".html"] });
  res.end(notFound ? await readFile(notFound) : "Not found");
}).listen(PORT, () => {
  console.log(`preview: http://localhost:${PORT}  (database ${process.env.SUPABASE_URL ? "configured" : "NOT configured — endpoints answer 503"})`);
});
