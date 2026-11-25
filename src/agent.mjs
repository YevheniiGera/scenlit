// What an agent (or a person) needs to work without guessing:
//   inspect    what is on a page: its controls by name, its text, and a picture
//   sheet      a film as one image: eight moments with their time and caption
//   review     what reads wrong after a run, as plain sentences
//   component  a vector piece written by hand or by an agent, usable in scenes like a page of the app
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { describePage, launch, openApp, startApp, stopApp } from "./browser.mjs";
import { filmFile, openFilm } from "./film.mjs";
import { loadCapture, runScene } from "./scene.mjs";

// ---- inspect: a page of the app, or "component:<name>"
export async function inspect(p, { path = "/", as = null, look = null } = {}) {
  const component = /^component:([\w./-]+)/.exec(path), app = p.config.app;
  const child = component ? null : await startApp(app, p.root), browser = await launch();
  try {
    const { page } = await openApp(browser, p, { look: p.look(look), as });
    const data = p.config.data;
    await page.addInitScript((d) => { const go = () => window.__scenlit.data(d); document.body ? go() : addEventListener("DOMContentLoaded", go); }, data);
    if (data.date) await page.clock.setFixedTime(new Date(data.date));
    await page.goto(component ? pathToFileURL(p.component(component[1])).href : new URL(path, app.url).href);
    await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(p.config.look.settle);
    const picture = join(p.output, "_inspect", `${path.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "home"}.png`);
    mkdirSync(dirname(picture), { recursive: true });
    await page.screenshot({ path: picture });
    const found = await page.evaluate(describePage);
    return { ...found, picture };
  } finally { await browser.close(); stopApp(child); }
}
// the page a scene ends on: how to look at a screen that is only reached by clicking. Write the steps that get
// there, inspect, then write the rest.
export async function inspectScene(p, scene, { look = null } = {}) {
  const { ended } = await runScene(p, scene, { inspect: true, look, log: () => {} });
  return ended;
}
export const inspectText = (r) => [
  `${r.title}  ${r.url}`, r.headings.length ? `headings: ${r.headings.join(" · ")}` : "", `text: ${r.text}`, "",
  "controls (use the name in click/fill/select, or { testid }):",
  ...r.controls.map((c) => `  ${c.role.padEnd(9)} ${JSON.stringify(c.name)}${c.testid ? `  { testid: ${JSON.stringify(c.testid)} }` : ""}${c.options ? `  options: ${c.options.join(" | ")}` : ""}${c.value ? `  holds ${JSON.stringify(c.value)}` : ""}${c.unstable ? (c.testid ? "   <- the name has a number that may change: use the testid" : "   <- the name has a number that may change") : ""}`),
  ...(r.regions.length ? ["", "other parts (for point, zoom, label and shot's crop; add a name for the guide: { selector, name: \"the total\" }):", ...r.regions.map((g) => `  ${(g.testid ? `{ testid: ${JSON.stringify(g.testid)} }` : `{ selector: ${JSON.stringify(g.selector)} }`).padEnd(44)} ${g.w}×${g.h}  ${JSON.stringify(g.text)}`)] : []),
  ...(r.states.length ? ["", `states (await state("…")): ${r.states.join(", ")}`] : []),
  ...(r.slots?.length ? [`slots (open("component:…", { data: { ${r.slots[0].name}: "…" } })), each with the words it holds now:`, ...r.slots.map((x) => `  ${x.name.padEnd(12)} ${JSON.stringify(x.example)}`)] : []),
  "", `picture: ${r.picture}`,
].filter((l) => l !== "").join("\n");

// ---- sheet: the film at eight moments, in one image
export async function sheet(p, name, { shape = "wide", count = 8 } = {}) {
  const film = filmFile(p, name);
  const browser = await launch();
  try {
    const page = await openFilm(browser, film, shape);
    const { total, captions } = await page.evaluate(() => ({ total: window.__film.total, captions: window.__film.captions }));
    const cells = [];
    for (let i = 0; i < count; i++) {
      let ms = Math.round(i === 0 ? Math.min(2400, total / 4) : i === count - 1 ? total - 500 : 3200 + ((total - 6000) * i) / (count - 1));
      const changing = captions.find((c) => ms >= c.from - 250 && ms < c.from + 600); // not while one caption gives way to the next
      if (changing) ms = Math.min(total - 500, changing.from + 700);
      await page.evaluate((t) => window.__film.frame(t), ms);
      const cap = captions.find((c) => ms >= c.from && ms <= (c.to ?? total));
      cells.push({ src: `data:image/jpeg;base64,${(await page.screenshot({ type: "jpeg", quality: 70 })).toString("base64")}`, label: `${(ms / 1000).toFixed(1)}s${cap ? `  ${cap.text}` : ""}` });
    }
    const cols = shape === "wide" ? 2 : 4, w = shape === "wide" ? 800 : 400, board = await browser.newPage({ viewport: { width: cols * (w + 12) + 12, height: 100 } });
    await board.setContent(`<body style="margin:12px;background:#0b0d11;font:14px -apple-system,sans-serif;color:#e8e6df;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:12px">${cells.map((c) => `<figure style="margin:0"><img src="${c.src}" style="display:block;width:${w}px"><figcaption style="padding:4px 0 6px">${c.label.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption></figure>`).join("")}</body>`);
    const file = join(p.output, name, `sheet-${shape}.jpg`);
    await board.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 80 });
    return { file, filmSeconds: +(total / 1000).toFixed(1) };
  } finally { await browser.close(); }
}

// ---- review: what a careful person would say after watching, from what the run recorded
export function review(p, scene) {
  const capture = loadCapture(p, scene.name), notes = [], steps = capture.steps;
  if (!steps.some((s) => s.say)) notes.push("no step has words (say: \"…\"): the film has no captions and no narration");
  for (const s of steps) {
    if (s.say && s.say.length > 70) notes.push(`a caption is ${s.say.length} characters and will wrap: "${s.say.slice(0, 50)}…" (keep it under 70)`);
    if (s.kind === "act" && s.actions.length > 4) notes.push(`"${s.text}" took ${s.actions.length} actions: split it into smaller steps so each can have its own words`);
    for (const a of s.actions) if (["click", "select", "press"].includes(a.do) && a.before === a.after) notes.push(`nothing changed on screen after ${a.do} "${a.what}": the film shows a click with no effect`);
  }
  // the story: a first three seconds, one moment that stands out, captions about what the viewer gets
  const kind = capture.format ?? scene.format ?? null, howTo = kind === "tutorial", bare = ["loop", "recording"].includes(kind);
  if (scene.title?.none && !bare && steps.find((s) => s.kind !== "background")?.kind !== "words") notes.push("the film opens straight in the app: an opening card with the viewer's problem or question (card(\"Who owes you\", \"money right now?\")) makes a stronger first three seconds");
  const STANDS_OUT = ["zoom", "point", "label", "piece", "animate", "words", "overlay"];
  if (!howTo && !bare && steps.filter((s) => s.say).length >= 3 && !steps.some((s) => STANDS_OUT.includes(s.kind) || s.hold || s.sound?.length)) notes.push("nothing in the film stands out: give its one moment a zoom, point or piece, a hold and a sound (npx scenlit guide product-demo)");
  const CLICKY = /^(\d+\.\s*)?(click|tap|press|open|select|choose|go to|type|enter|navigate|scroll)\b/i;
  if (!howTo) for (const s of steps) if (typeof s.say === "string" && CLICKY.test(s.say)) notes.push(`a caption says what was clicked, not what the viewer gets: "${s.say}" (in a tutorial that is right; in a demo, say the result)`);
  const all = steps.flatMap((s) => s.actions);
  if (all.length > 24) notes.push(`${all.length} actions make a long film; most films work best under 12`);
  const pictures = new Set(all.flatMap((a) => [a.before, a.after])), frozen = Object.keys(capture.vector ?? {}).length;
  if (p.look(scene.look).vector && pictures.size && frozen < pictures.size) notes.push(`${pictures.size - frozen} of ${pictures.size} pictures are screenshots, not vector: they soften when the camera zooms in`);
  for (const post of scene.posts ?? []) for (const n of post.shots ?? [post.shot]) {
    const shot = capture.shots[n];
    if (shot?.crop && (shot.crop.w < 120 || shot.crop.h < 60)) notes.push(`post "${post.name}": the picture "${n}" is only ${Math.round(shot.crop.w)}×${Math.round(shot.crop.h)}; it will be blown up a lot`);
    if (`${post.lead} ${post.key}`.length > 70) notes.push(`post "${post.name}": the title is long (${`${post.lead} ${post.key}`.length} characters) and will take four lines or more`);
  }
  return notes;
}

// ---- components: vector pieces written by hand or by an agent (.scenlit/components/<name>.html)
const TEMPLATE = (name) => `<!doctype html>
<html lang="en" data-state="idle">
<head>
<meta charset="utf-8">
<title>${name}</title>
<!-- the address the film's window shows while this component is on screen -->
<meta name="scenlit:host" content="example.com">
<style>
  /* A component is one self-contained page: HTML and CSS, no build step, no network.
     Draw it at 1280×800 (or your look's viewport). Real text, real borders: it is filmed as vectors.
     States are CSS: the scene calls state("done") and the root gets data-state="done".
     Transitions between states are filmed, so let them move. */
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f8fa; color: #1f2328; font: 15px/1.5 -apple-system, "Helvetica Neue", Arial, sans-serif; }
  .card { width: 520px; background: #fff; border: 1px solid #d1d9e0; border-radius: 12px; padding: 20px 22px; }
  .row { display: flex; align-items: center; gap: 10px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: #bf8700; transition: background .3s; }
  .what { transition: opacity .3s; }
  .what.done { display: none; }
  button { margin-top: 16px; font: inherit; font-weight: 600; padding: 8px 16px; border-radius: 8px; border: 1px solid #d1d9e0; background: #f6f8fa; cursor: pointer; }

  [data-state="done"] .dot { background: #1a7f37; }
  [data-state="done"] .what.idle { display: none; }
  [data-state="done"] .what.done { display: inline; }
</style>
</head>
<body>
  <div class="card" data-testid="card">
    <div class="row"><span class="dot"></span><b>${name}</b></div>
    <p><span class="what idle">Waiting.</span><span class="what done">Done.</span></p>
    <!-- a control a scene can click by its name: click("Details") -->
    <button>Details</button>
  </div>
</body>
</html>
`;

// copy a built-in component into the project, to edit it
export function addComponent(p, kind, name = kind) {
  if (!p.builtInComponents().includes(kind)) throw new Error(`no built-in component "${kind}" (${p.builtInComponents().join(", ")})`);
  const file = join(p.dir, "components", `${name}.html`);
  if (existsSync(file)) throw new Error(`${file} exists already`);
  mkdirSync(dirname(file), { recursive: true });
  cpSync(new URL(`../templates/components/${kind}.html`, import.meta.url), file);
  return file;
}

export function newComponent(p, name) {
  const file = join(p.dir, "components", `${name}.html`);
  if (existsSync(file)) throw new Error(`${file} exists already`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, TEMPLATE(name));
  return file;
}

// start a component from a picture a scene took: the frozen page of the real app, to cut down and edit
export function componentFrom(p, from, name) {
  const [scene, shot] = from.split("/"), capture = loadCapture(p, scene), s = capture.shots[shot];
  if (!s) throw new Error(`"${scene}" takes no picture "${shot}" (${Object.keys(capture.shots).join(", ")})`);
  const frozen = capture.vector?.[s.file];
  if (!frozen) throw new Error(`"${from}" has no vector picture to start from (it stayed a screenshot)`);
  const file = join(p.dir, "components", `${name}.html`);
  if (existsSync(file)) throw new Error(`${file} exists already`);
  mkdirSync(dirname(file), { recursive: true });
  const assets = join(p.captures, scene, "assets");
  if (existsSync(assets)) cpSync(assets, join(p.dir, "components", "assets"), { recursive: true });
  writeFileSync(file, readFileSync(join(p.captures, scene, frozen), "utf8").replace("<head>", `<head><!-- Started from ${from}: the real app's page, frozen. Cut it down to the part you want and edit freely. -->`));
  return file;
}
