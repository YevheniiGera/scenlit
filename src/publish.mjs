// Publishing: a video gets a link on the platform, where anyone can watch it and its product's team sees how it was
// watched. The same scene keeps the same link: publishing again puts a new version behind it.
// You connect each computer once (`scenlit connect`: the browser asks you to approve it); the
// token is kept in ~/.scenlit/keys.json, never in the project. In CI the token comes from SCENLIT_TOKEN.
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { basename, dirname, join } from "node:path";
import { launch } from "./browser.mjs";
import { openFilm, writeWeb } from "./film.mjs";
import { loadCapture } from "./scene.mjs";

const STRIP = 20; // how many moments of the film the portal gets as small pictures (the audience is shown over them)
const keysFile = () => join(process.env.SCENLIT_HOME ?? join(homedir(), ".scenlit"), "keys.json");
// where to publish: --to, else SCENLIT_PORTAL, else "portal" in .scenlit/config.json, else the one portal this
// computer is connected to (scenlit connect keeps a token for each), else scenlit.dev
export const PORTAL = "https://scenlit.dev";
export const portalOf = (p, to = null) => {
  const connected = Object.keys(readKeys());
  const address = to ?? process.env.SCENLIT_PORTAL ?? p.config.portal ?? (connected.length === 1 ? connected[0] : connected.length ? null : PORTAL);
  if (!address) throw new Error(`this computer is connected to more than one portal (${connected.join(", ")}): say which with --to <address>`);
  return String(address).replace(/\/+$/, "");
};

export async function call(portal, token, method, path, body = null) {
  const raw = Buffer.isBuffer(body);
  let res;
  try { res = await fetch(`${portal}${path}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body && !raw ? { "content-type": "application/json" } : {}) }, body: body ? (raw ? body : JSON.stringify(body)) : undefined }); }
  catch (e) { throw new Error(`the platform at ${portal} could not be reached (${e.cause?.code ?? e.message})`); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`the platform said no: ${data.error ?? res.status}`);
  return data;
}

const readKeys = () => { const file = keysFile(); return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}; };
const writeKeys = (keys) => { const file = keysFile(); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, `${JSON.stringify(keys, null, 2)}\n`, { mode: 0o600 }); };
const openInBrowser = (link) => execFile(process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open", process.platform === "win32" ? ["/c", "start", "", link] : [link], () => {});

// connect this computer: the platform shows a code in the browser, you approve it there, and this computer gets its
// token. `show`: open the browser (else only print the address). `log`: what to tell the person meanwhile
export async function connect(p, { to = null, show = true, log = console.log, wait = 600000 } = {}) {
  const portal = portalOf(p, to), started = await call(portal, null, "POST", "/api/login", { label: `${hostname().replace(/\.local$/, "")}, ${basename(p.root ?? process.cwd())}` });
  log(`Connect this computer to ${portal}:\n  ${started.url}\n  check that the page shows the code ${started.code.slice(0, 4)}-${started.code.slice(4)}`);
  if (show) openInBrowser(started.url);
  for (const until = Date.now() + wait; Date.now() < until;) {
    await new Promise((ok) => setTimeout(ok, (started.every ?? 2) * 1000));
    const r = await call(portal, null, "POST", "/api/login/collect", { code: started.code, secret: started.secret });
    if (r.state === "approved") { writeKeys({ ...readKeys(), [portal]: r.token }); const me = await call(portal, r.token, "GET", "/api/me"); return { portal, ...me }; }
    if (r.state !== "waiting") throw new Error("the code ran out; run scenlit connect again");
  }
  throw new Error("nobody approved it in time; run scenlit connect again");
}
export function disconnect(p, { to = null } = {}) {
  const portal = portalOf(p, to), keys = readKeys(), had = !!keys[portal];
  delete keys[portal]; writeKeys(keys);
  return { portal, had };
}
// this computer's token for the platform: SCENLIT_TOKEN in CI, else the one `scenlit connect` kept, else connect now
// (only where a person is there to approve it)
export async function tokenFor(p, portal, log) {
  const t = process.env.SCENLIT_TOKEN ?? process.env.SCENLIT_KEY ?? readKeys()[portal];
  if (t) return t;
  if (!process.stdin.isTTY || process.env.CI) throw new Error(`this computer is not connected to ${portal}: run scenlit connect${portal === PORTAL ? "" : ` --to ${portal}`}, or set SCENLIT_TOKEN (a product's token, from its settings)`);
  await connect(p, { to: portal, log });
  return readKeys()[portal];
}

// the product a project's videos belong to: "product" in .scenlit/config.json, else the brand's name
const slugOf = (name) => String(name ?? "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
export const productOf = (p) => ({ slug: slugOf(p.config.product || p.config.brand.name || basename(p.root ?? process.cwd())), name: p.config.brand.name || p.config.product || basename(p.root ?? process.cwd()), site: p.config.brand.url || null });
// where a video is shown on its product's page: a scene's own `kind`, else a tutorial is help, else a demo
export const kindOf = (scene) => scene.kind ?? (scene.format === "tutorial" ? "help" : "demo");

const walk = (dir, under = "") => readdirSync(join(dir, under)).flatMap((n) => (statSync(join(dir, under, n)).isDirectory() ? walk(dir, `${under}${n}/`) : [`${under}${n}`]));
const hex6 = (c) => (/^#[0-9a-f]{6}$/i.test(c ?? "") ? c : /^#[0-9a-f]{3}$/i.test(c ?? "") ? `#${[...c.slice(1)].map((x) => x + x).join("")}` : null);

// `listed`: on Scenlit's front page with the scene that made it (false: off again; not said: as it was). `private`:
// only the product's people may watch. `kind`: demo, help or news (else the scene's own, see kindOf)
export async function publish(p, scene, { to = null, listed = null, private: closed = null, kind = null, log = () => {} } = {}) {
  const portal = portalOf(p, to), token = await tokenFor(p, portal, log), web = writeWeb(p, scene), shape = scene.shape ?? "wide", out = join(p.output, scene.name), as = kind ?? kindOf(scene);
  const extra = join(out, "export", "portal");
  rmSync(extra, { recursive: true, force: true }); mkdirSync(extra, { recursive: true });
  // what the platform shows around the video: its length, its steps, a poster, and the video as a strip of moments
  const browser = await launch();
  let facts;
  try {
    const small = await openFilm(browser, join(web.dir, "index.html"), shape, 0.25);
    facts = await small.evaluate(() => {
      const f = window.__film, said = f.captions.filter((c) => c.text).map((c) => ({ at: c.from / 1000, text: c.text })), during = (ms) => said.filter((s) => s.at * 1000 <= ms + 600).pop()?.text ?? "";
      return {
        seconds: f.total / 1000, size: [f.format.W, f.format.H], poster: typeof f.player.poster === "number" ? f.player.poster : null,
        steps: said.length ? said : f.chapters.map((c) => ({ at: c.at / 1000, text: c.text })),
        asks: f.asks.map((a) => ({ at: a.at / 1000, text: during(a.at) })),
        links: [...document.querySelectorAll("#stage a.hot, #stage a.cta")].map((a) => ({ text: a.textContent.trim() || a.getAttribute("aria-label") || "", address: a.getAttribute("href") })),
      };
    });
    for (let i = 0; i < STRIP; i++) {
      await small.evaluate((ms) => window.__film.frame(ms), Math.round(((i + 0.5) / STRIP) * facts.seconds * 1000));
      await small.screenshot({ path: join(extra, `strip-${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 72 });
    }
    await small.close();
    const large = await openFilm(browser, join(web.dir, "index.html"), shape, 2 / 3);
    // the poster: the moment the scene chose, else the fullest of the middle moments (a card or a cut is nearly empty,
    // and an emptier picture is a smaller file)
    const middle = Array.from({ length: STRIP }, (_, i) => i).filter((i) => i >= STRIP * 0.15 && i < STRIP * 0.8), fullest = middle.reduce((a, b) => (statSync(join(extra, `strip-${String(b).padStart(2, "0")}.jpg`)).size > statSync(join(extra, `strip-${String(a).padStart(2, "0")}.jpg`)).size ? b : a));
    await large.evaluate((ms) => window.__film.frame(ms), Math.round(Math.min(facts.seconds, facts.poster ?? ((fullest + 0.5) / STRIP) * facts.seconds) * 1000));
    await large.screenshot({ path: join(extra, "poster.jpg"), type: "jpeg", quality: 84 });
  } finally { await browser.close(); }

  // pictures with addresses that stay: the scene's screenshots and its thumbnail
  const pictures = [];
  const picture = (from, name) => { if (existsSync(from)) { mkdirSync(join(extra, "pictures"), { recursive: true }); writeFileSync(join(extra, "pictures", `${name}.png`), readFileSync(from)); pictures.push(name); } };
  if (existsSync(join(out, "shots"))) for (const f of readdirSync(join(out, "shots")).filter((n) => /^[\w-]+\.png$/.test(n))) picture(join(out, "shots", f), f.slice(0, -4));
  picture(join(out, "thumbnail.png"), "thumbnail");
  // a how-to goes with its step-by-step guide, made now when the last run did not
  if (as === "help") {
    if (!existsSync(join(out, "guide.md"))) await (await import("./guide.mjs")).writeGuide(p, scene);
    if (existsSync(join(out, "guide.md"))) {
      writeFileSync(join(extra, "guide.md"), readFileSync(join(out, "guide.md")));
      if (existsSync(join(out, "guide"))) { mkdirSync(join(extra, "guide"), { recursive: true }); for (const f of readdirSync(join(out, "guide")).filter((n) => /^[\w-]+\.(png|jpg)$/.test(n))) writeFileSync(join(extra, "guide", f), readFileSync(join(out, "guide", f))); }
    }
  }

  const style = p.style(scene, loadCapture(p, scene.name).look ?? scene.look), product = productOf(p);
  const made = await call(portal, token, "POST", "/api/films", {
    product, scene: scene.name, kind: as, private: closed, title: scene.title, by: p.config.brand.name, url: p.config.brand.url || null, shape, listed, strip: STRIP, pictures,
    accent: hex6(style.player?.accent ?? style.brand.accent), seconds: facts.seconds, size: facts.size, steps: facts.steps, asks: facts.asks, links: facts.links,
  });
  if (made.listed && scene.file) writeFileSync(join(extra, "scene.mjs"), readFileSync(scene.file));
  const files = [...walk(web.dir).filter((f) => f !== "embed.html").map((f) => [f, join(web.dir, f)]), ...walk(extra).map((f) => [`_portal/${f}`, join(extra, f)])];
  log(`  sending ${files.length} files to ${portal}`);
  const queue = [...files], send = async () => { for (let f = queue.shift(); f; f = queue.shift()) await call(portal, token, "PUT", `/api/films/${made.id}/${made.version}/files/${f[0].split("/").map(encodeURIComponent).join("/")}`, readFileSync(f[1])); };
  await Promise.all(Array.from({ length: 6 }, send));
  const done = await call(portal, token, "POST", `/api/films/${made.id}/${made.version}/ready`);
  return { ...done, product: made.product, kind: made.kind, private: made.private, listed: made.listed, version: made.version, files: files.length, pictures: pictures.length, seconds: +facts.seconds.toFixed(1) };
}

export async function unpublish(p, sceneName, { to = null } = {}) {
  const portal = portalOf(p, to), token = await tokenFor(p, portal, () => {}), { films } = await call(portal, token, "GET", `/api/films?product=${encodeURIComponent(productOf(p).slug)}`);
  const film = films.find((f) => f.scene === sceneName);
  if (!film) throw new Error(`"${sceneName}" is not published on ${portal}`);
  await call(portal, token, "DELETE", `/api/films/${film.id}`);
  return film.link;
}

// your products on the platform, in the browser (it signs you in there)
export function openPortal(p, { to = null, show = true } = {}) {
  const link = `${portalOf(p, to)}/app`;
  if (show) openInBrowser(link);
  return link;
}
