// `scenlit find`: is there already a piece for this? One search over the built-in pieces, the project's own and the
// platform's gallery. Each result says what it is, how a scene uses it, and (with `pictures`) where a picture of it
// was saved, so a person or a coding agent can look at it and decide.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./browser.mjs";
import { FAMILIES, motionDir, motionFile } from "./motion.mjs";
import { describeComponent, describeFormat, describeLook, describeMotion, describeSound } from "./pieces.mjs";
import { call, portalOf } from "./publish.mjs";
import { ABOUT as SOUND_ABOUT, SOUNDS } from "./sounds.mjs";

const BUILT_LOOKS = { phone: "the app in a phone, at a phone's size", tablet: "the app in a tablet", dark: "the app's dark mode", light: "the app's light mode", cartoon: "a drawn cartoon: thick outlines, flat colours", sketch: "a pencil sketch on paper", blueprint: "white lines on blue" };
const BUILT_FORMATS = { demo: "a product demo", tutorial: "a calm how-to with numbered steps", feature: "one new thing, shown", trailer: "short and loud: black, slammed titles", canvas: "a shared design canvas: the screens side by side, named cursors, selections", launch: "a launch film with music", recording: "a polished screen recording, no cards", short: "a vertical short with bold captions", keynote: "a dark keynote, slow and big", loop: "a silent loop for a README" };
const ORDER = { yours: 0, "built-in": 1, gallery: 2 };

function local(p) {
  const out = [], read = (f) => readFileSync(f, "utf8"), files = (dir, re) => (existsSync(dir) ? readdirSync(dir).filter((f) => re.test(f)) : []);
  const builtDir = fileURLToPath(new URL("../templates/components/", import.meta.url));
  for (const f of files(builtDir, /\.html$/)) out.push({ where: "built-in", kind: "component", name: f.slice(0, -5), file: join(builtDir, f), ...describeComponent(f.slice(0, -5), read(join(builtDir, f))), add: `scenlit component add ${f.slice(0, -5)}   (only to change it; it works without)` });
  for (const f of files(join(p.dir, "components"), /\.html$/)) out.push({ where: "yours", kind: "component", name: f.slice(0, -5), file: join(p.dir, "components", f), ...describeComponent(f.slice(0, -5), read(join(p.dir, "components", f))) });
  for (const [family, v] of Object.entries(FAMILIES)) for (const name of v.built) out.push({ where: "built-in", kind: "motion", name, about: `${family}: ${v.what}`, defines: [{ family, name }], use: describeMotion("", `define("${family}", "${name}")`).use });
  for (const f of [...(existsSync(motionFile(p)) ? [motionFile(p)] : []), ...files(motionDir(p), /\.js$/).map((x) => join(motionDir(p), x))]) for (const d of describeMotion(f, read(f)).defines) out.push({ where: "yours", kind: "motion", name: d.name, file: f, ...describeMotion(f, `define("${d.family}", "${d.name}")`), about: describeMotion(f, read(f)).about || `${d.family}: ${FAMILIES[d.family]?.what ?? ""}` });
  for (const [name, about] of Object.entries(BUILT_LOOKS)) out.push({ where: "built-in", kind: "look", name, ...describeLook(name), about });
  for (const [name, about] of Object.entries(BUILT_FORMATS)) out.push({ where: "built-in", kind: "format", name, ...describeFormat(name), about });
  for (const [name, look] of Object.entries(p.config.looks)) if (!BUILT_LOOKS[name]) out.push({ where: "yours", kind: "look", name, ...describeLook(name, look) });
  for (const [name, format] of Object.entries(p.config.formats)) if (!BUILT_FORMATS[name]) out.push({ where: "yours", kind: "format", name, ...describeFormat(name, format) });
  for (const name of SOUNDS) out.push({ where: "built-in", kind: "sound", name, ...describeSound(name, SOUND_ABOUT[name] ?? "") });
  for (const f of files(join(p.dir, "sounds"), /\.(wav|mp3|m4a|ogg)$/)) out.push({ where: "yours", kind: "sound", name: f.replace(/\.\w+$/, ""), file: join(p.dir, "sounds", f), ...describeSound(f.replace(/\.\w+$/, "")) });
  return out;
}
const words = (q) => String(q ?? "").toLowerCase().split(/\s+/).filter((w) => w.length > 1);
const haystack = (r) => [r.name, r.kind, r.about, r.title, r.host, r.by, ...(r.slots ?? []).flatMap((s) => [s.name, s.example]), ...(r.states ?? []), ...(r.defines ?? []).flatMap((d) => [d.family, d.name])].filter(Boolean).join(" ").toLowerCase();
const score = (r, ws) => ws.reduce((n, w) => n + (r.name.toLowerCase().includes(w) ? 3 : haystack(r).includes(w) ? 1 : 0), 0);

// `query`: words (none: everything). `gallery`: also search the platform's (when one is known). `pictures`: draw the
// components found and fetch the gallery's pictures, into .scenlit/output/_find/, and say where
export async function find(p, query = "", { kind = null, to = null, gallery = true, pictures = false, limit = 20 } = {}) {
  const ws = words(query), found = local(p).filter((r) => !kind || r.kind === kind);
  let portal = null, note = null;
  if (gallery) {
    try { portal = portalOf(p, to); } catch (e) { note = `the gallery was not searched: ${e.message}`; }
    if (portal) {
      try {
        const { pieces } = await call(portal, null, "GET", `/api/gallery?${new URLSearchParams({ q: ws.join(" "), ...(kind ? { kind } : {}), limit: String(limit) })}`);
        for (const g of pieces) found.push({ where: "gallery", ...g, add: g.add, ref: g.page });
      } catch (e) { note = `the gallery was not searched: ${e.message}`; }
    }
  }
  const hits = (ws.length ? found.map((r) => ({ r, s: r.where === "gallery" ? Math.max(1, score(r, ws)) : score(r, ws) })).filter((x) => x.s >= Math.max(1, ws.length)) : found.map((r) => ({ r, s: 0 })))
    .sort((a, b) => b.s - a.s || ORDER[a.r.where] - ORDER[b.r.where] || (b.r.installs ?? 0) - (a.r.installs ?? 0) || a.r.name.localeCompare(b.r.name))
    .slice(0, limit).map((x) => x.r);
  if (pictures) await picture(p, hits);
  return { results: hits.map(({ file, ...r }) => ({ ...r, ...(file ? { file } : {}) })), ...(note ? { note } : {}) };
}

// a picture of each component (as a scene would show it) and of each gallery piece that has one
async function picture(p, hits) {
  const dir = join(p.output, "_find");
  mkdirSync(dir, { recursive: true });
  const draw = hits.filter((r) => r.kind === "component" && r.file);
  if (draw.length) {
    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      for (const r of draw) { await page.goto(`file://${r.file}`); await page.waitForTimeout(150); r.picture = join(dir, `${r.where}-${r.name}.png`); await page.screenshot({ path: r.picture }); }
    } finally { await browser.close(); }
  }
  for (const r of hits.filter((x) => x.where === "gallery" && x.picture)) {
    try { const res = await fetch(r.picture); if (res.ok) { const to = join(dir, `gallery-${r.product}-${r.name}.${/\.jpg/.test(r.picture) ? "jpg" : "png"}`); writeFileSync(to, Buffer.from(await res.arrayBuffer())); r.pictureUrl = r.picture; r.picture = to; } } catch { /* the address stays */ }
  }
}

// the results as text, for a person at the terminal
export const findText = ({ results, note }) => (results.length ? results.map((r) => [
  `${r.kind.padEnd(9)} ${r.name}  (${r.where === "gallery" ? `gallery, by ${r.by}${r.installs ? `, added ${r.installs} times` : ""}` : r.where})${r.about ? `  ${r.about}` : ""}`,
  ...(r.use ?? []).slice(0, 2).map((u) => `          ${u}`),
  ...(r.slots?.length ? [`          slots: ${r.slots.map((s) => s.name).join(", ")}`] : []), ...(r.states?.length > 1 ? [`          states: ${r.states.join(", ")}`] : []),
  ...(r.picture ? [`          picture: ${r.picture}`] : []), ...(r.where === "gallery" ? [`          add: ${r.add}`] : []),
].join("\n")).join("\n") : "nothing found") + (note ? `\n(${note})` : "");
