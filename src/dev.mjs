// `scenlit dev <scene>`: write the scene, save, watch the film. It runs the scene, serves the film on a local
// address, and when the scene file, the settings, the style or a component is saved it runs again and the page
// reloads itself. Nothing leaves this machine.
import { createReadStream, existsSync, statSync, watch } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".gif": "image/gif", ".pdf": "application/pdf", ".woff2": "font/woff2", ".woff": "font/woff", ".md": "text/plain; charset=utf-8", ".vtt": "text/vtt" };
const RELOAD = `<script>new EventSource("/__scenlit").onmessage = (e) => { if (e.data === "reload") location.reload(); else document.title = e.data; };</script>`;

// `make(name)` runs the scene and writes its film (the same thing `scenlit run` does). Returns { url, close }.
export async function dev(p, name, make, { port = 4400, log = console.log } = {}) {
  const clients = new Set(), tell = (data) => { for (const res of clients) res.write(`data: ${data}\n\n`); };
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/__scenlit") { res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" }); res.write(": hello\n\n"); clients.add(res); req.on("close", () => clients.delete(res)); return; }
    const file = normalize(join(p.dir, path));
    if (!file.startsWith(p.dir) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    if (extname(file) !== ".html") return createReadStream(file).pipe(res);
    let html = ""; // a page gets the few lines that make it reload when the scene is run again
    createReadStream(file, "utf8").on("data", (d) => (html += d)).on("end", () => res.end(html.includes("</body>") ? html.replace("</body>", `${RELOAD}</body>`) : html + RELOAD));
  });
  await new Promise((ok, no) => server.once("error", (e) => no(e.code === "EADDRINUSE" ? new Error(`port ${port} is taken; pick another with --port`) : e)).listen(port, "127.0.0.1", ok));

  let running = false, again = false;
  const run = async (why) => {
    if (running) { again = true; return; }
    running = true;
    if (why) { log(`\n${why} changed`); tell("running…"); }
    try { await make(name); tell("reload"); } catch (e) { log(`  FAILED: ${e.message}`); tell(`failed: ${e.message.split("\n")[0]}`); }
    running = false;
    if (again) { again = false; run("something else"); }
  };
  await run(null);

  // what a film depends on: its scene file, the settings, the style sheet, the components
  const scene = p.sceneFiles().get(name), targets = [scene, p.file, join(p.dir, "style.css"), join(p.dir, "motion.js"), join(p.dir, "motion"), join(p.dir, "looks"), join(p.dir, "formats"), join(p.dir, "components")].filter((f) => f && existsSync(f)), watchers = [];
  let timer = null;
  for (const f of targets) watchers.push(watch(f, () => { clearTimeout(timer); timer = setTimeout(() => run(f.replace(`${p.root}/`, "")), 250); }));
  const url = `http://localhost:${port}/output/${name}/film.html`;
  log(`\nwatching ${targets.map((f) => f.replace(`${p.root}/`, "")).join(", ")}\nfilm:  ${url}\nall:   http://localhost:${port}/output/index.html\nSave a file to run again. Ctrl+C to stop.`);
  return { url, close: () => { watchers.forEach((w) => w.close()); for (const res of clients) res.end(); server.close(); } };
}
