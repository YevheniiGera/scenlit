// Runs a scene on the real app. Plain-language steps (`act`) are replayed from the recording when there is one;
// otherwise a model works them out, and they are recorded once the scene ends without an error.
// Every action is captured for the film: a picture before and after, and where it landed.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describePage, launch, openApp, saveSession, startApp, stopApp } from "./browser.mjs";
import { merge } from "./config.mjs";
import { nextActions } from "./model.mjs";
import { totp } from "./totp.mjs";
import { alike, faithful, filtered, saveFrozen } from "./vector.mjs";
import { asSounds } from "./sounds.mjs";
import { placeCards, withCards } from "./cards.mjs";

// where an overlay can sit (its words in any order: "right top" is "top right")
// what can start at the same moment as something else: nothing here needs the cursor, the camera or the whole stage
const TOGETHER = ["animate", "effect", "mark", "overlay", "sound", "button"];
const TYPE = ["rise", "letters", "bounce", "blur", "track", "type"]; // how the words of words() come in
const MARKS = ["underline", "circle", "box", "arrow", "stroke"]; // what mark() draws
const WAIT = 5000; // how long a step waits for its control to show up
const BY_VIEWER = ["act", "click", "fill", "select", "hover", "drag", "upload"]; // steps with a place the viewer can click
// where a link or a button of the film leads: a web address, a path on the site the film is on, or a mail address
const address = (href, what) => {
  if (typeof href !== "string" || !/^(https?:\/\/|mailto:|\/|#|\.{1,2}\/)/i.test(href)) throw new Error(`${what}: it leads to a web address (https://…), a path on your site (/pricing) or mailto:; got ${JSON.stringify(href)}`);
  return href;
};
const PLACES = ["top", "bottom", "left", "right", "center", "left top", "right top", "bottom left", "bottom right"];

const fillIn = (s, params) => String(s ?? "").replace(/\{(\w+)\}/g, (m, k) => (params && k in params ? String(params[k]) : m));
const locOf = (target) => (typeof target === "string" ? { text: target } : target);
const nameOf = (loc) => loc?.name ?? loc?.text ?? loc?.testid ?? loc?.selector ?? "";
const selectorOf = (t) => (typeof t === "string" ? t : t.testid ? `[data-testid="${t.testid}"]` : t.selector);

// what the scene would do, without a browser: its steps and the pictures it names (for `check`)
export async function outline(scene) {
  const steps = [], shots = [], cards = {};
  const api = new Proxy({}, { get: (_, kind) => kind === "totp" ? () => "000000" : async (first, second, third) => {
    if (kind === "shot") return void shots.push(first);
    if (kind === "title" || kind === "end") return void (cards[kind] = { lead: first, key: second });
    if (kind === "card") return void steps.push({ kind, text: second, card: { ...third, lead: first, key: second } });
    const opts = [second, third].find((o) => o && typeof o === "object" && !Array.isArray(o));
    steps.push({ kind, text: typeof first === "string" ? first : nameOf(first), say: opts?.say });
  } });
  await scene.run(api);
  return { steps: placeCards(steps, cards), shots, ...cards };
}

// `inspect`: also describe the page the scene ends on (its controls, text and a picture), for `scenlit inspect --scene`
export async function runScene(p, scene, { record = false, headed = false, strict = !!process.env.CI, look: lookName, inspect = false, log = console.log } = {}) {
  p.ensure();
  const look = p.look(lookName ?? scene.look), data = merge(p.config.data, scene.data);
  const recFile = join(p.recordings, `${scene.name}.json`), capDir = join(p.captures, scene.name), shotDir = join(p.output, scene.name, "shots");
  const old = !record && existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : { steps: {} };
  const fresh = { steps: {} }, steps = [], shots = {}, checks = [], cards = {}, stats = { replayed: 0, model: 0, calls: 0 };
  rmSync(capDir, { recursive: true, force: true }); mkdirSync(capDir, { recursive: true });

  if (scene.setup) execSync(scene.setup, { cwd: p.root, stdio: "inherit" });
  // the app is started when a scene first opens one of its pages: a scene made only of components needs no app
  let child = null, appUp = false;
  const browser = await launch({ headed }), hosts = {}, pages = {}, names = {};
  const { page, context } = await openApp(browser, p, { look, as: scene.as });
  const applyData = async () => { await page.addInitScript((d) => { const go = () => window.__scenlit.data(d); document.body ? go() : addEventListener("DOMContentLoaded", go); }, data); await page.evaluate((d) => window.__scenlit?.data(d), data).catch(() => {}); };
  if (Object.keys(data.replace).length || data.blur.length) await applyData();
  if (data.date) await page.clock.setFixedTime(new Date(data.date));

  // vector: next to each picture the page itself is frozen (src/vector.mjs), and kept when it looks like the picture
  const judge = await context.newPage(); // a page of its own for comparing pictures
  const vector = look.vector ? { checker: await context.newPage(), judge, assets: new Map(), files: {}, tried: 0 } : null;
  let n = 0, last = null, replaced = null, ground = null; // ground: the app's own background colour, behind every picture in the film's window
  const later = {}; // a picture -> the one that stands in for it: the same page, with more of it marked for the film
  // fresh: a new picture even when the page looks the same (it now carries marks for the film). `replaced` is then the
  // picture it stands in for, when the page has not changed since that one was taken.
  const picture = async ({ fresh = false } = {}) => {
    const buf = await page.screenshot({ type: "jpeg", quality: 90 }), sum = createHash("sha1").update(buf).digest("hex"), uri = (b) => `data:image/jpeg;base64,${b.toString("base64")}`;
    // the same picture: the same bytes, or the same but for the noise of drawing the page twice (a film that took those
    // for two moments would cut between them, and something about to move would not be in its place from the start)
    const same = !!last && (last.sum === sum || (await judge.evaluate(alike, [uri(last.buf), uri(buf)]).catch(() => false)));
    if (!fresh && same) return last.file; // nothing changed
    replaced = fresh && same ? last.file : null;
    const file = `${String(n++).padStart(3, "0")}.jpg`;
    if (replaced) later[replaced] = file;
    writeFileSync(join(capDir, file), buf); last = { sum, file, buf };
    // the colour under the app's pages, once: the film paints its window in it, so where a picture's edge meets the
    // window's (drawn at a fraction of a pixel as the camera moves) no other colour shows through as a line
    ground ??= await page.evaluate(() => { for (const e of [document.body, document.documentElement]) { const c = e && getComputedStyle(e).backgroundColor; if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) return c; } return null; }).catch(() => null);
    const host = await page.evaluate(() => document.querySelector('meta[name="scenlit:host"]')?.content ?? null).catch(() => null);
    if (host) hosts[file] = host; // a component says which address the film's window shows for it
    const at = await page.evaluate(() => [location.origin + location.pathname, document.title]).catch(() => [null, ""]);
    pages[file] = at[0]; // the place: a film cuts between places, not between two moments of one
    if (at[1]) names[file] = at[1]; // its name, over its frame on a canvas
    if (vector) {
      vector.tried++;
      // a mark does not change how the page looks: a picture that stands in for another keeps that one's verdict
      try { const html = await saveFrozen(page, capDir, file.replace(/\.jpg$/, ""), vector.assets); if (replaced ? vector.files[replaced] : (await faithful(vector.checker, vector.judge, join(capDir, html), buf)).ok) { vector.files[file] = html; if (look.filter) filtered(join(capDir, html), look.filter); } }
      catch { /* this picture stays a screenshot */ }
    }
    return file;
  };
  const settle = async () => { await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(look.settle); };
  // a control that is not there yet (the page is still loading its data, a button is still disabled) is waited for,
  // up to WAIT; then the step fails
  const find = async (loc, opts, wait = WAIT) => {
    const until = Date.now() + wait;
    let box;
    while (!(box = await page.evaluate(([l, o]) => window.__scenlit.find(l, o), [loc, opts ?? {}])) && Date.now() < until) await page.waitForTimeout(200);
    if (!box) return null;
    await page.waitForTimeout(150); // let a scroll into view finish
    return page.evaluate(([l, o]) => window.__scenlit.find(l, o), [loc, opts ?? {}]);
  };
  const mid = (b) => [b.x + b.w / 2, b.y + b.h / 2];

  // what the app does between the two pictures of an action (a panel sliding in, text being typed): the frames
  // the browser draws while it happens. Kept only when something moved; at most 20, from the first two seconds.
  const cdp = look.motion ? await context.newCDPSession(page) : null;
  let clips = 0;
  async function filmed(doIt) {
    if (!cdp) { await doIt(); return []; }
    const got = [], t0 = Date.now();
    const on = (f) => { got.push({ data: f.data, at: Date.now() - t0 }); cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {}); };
    cdp.on("Page.screencastFrame", on);
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 80, maxWidth: look.viewport.width, maxHeight: look.viewport.height, everyNthFrame: 1 });
    try { await doIt(); } finally { await cdp.send("Page.stopScreencast").catch(() => {}); cdp.off("Page.screencastFrame", on); }
    let frames = got.slice(1).filter((f, i, a) => f.at <= 2000 && f.data !== (a[i - 1] ?? got[0]).data);
    if (frames.length < 2) return [];
    if (frames.length > 20) frames = frames.filter((_, i) => i === frames.length - 1 || Math.floor((i * 20) / frames.length) !== Math.floor(((i - 1) * 20) / frames.length));
    const id = String(clips++).padStart(3, "0");
    return frames.map((f, i) => { const file = `m${id}-${String(i).padStart(2, "0")}.jpg`; writeFileSync(join(capDir, file), Buffer.from(f.data, "base64")); return { file, at: f.at }; });
  }

  // one action on the page, with what the film needs to show it. false: the control is not there.
  async function perform(a, step, params, wait = WAIT) {
    const box = a.do === "press" ? null : await find(a.loc, undefined, wait);
    if (a.do !== "press" && !box) return false;
    const value = fillIn(a.value, params), to = a.do === "drag" ? await find(a.to, { mark: false }) : null;
    if (a.do === "drag" && !to) return false;
    const before = await picture();
    const motion = await filmed(async () => {
      if (a.do === "press") await page.keyboard.press(value || "Enter");
      else if (a.do === "select") await page.selectOption("[data-scenlit-el]", { label: value }).catch(() => page.selectOption("[data-scenlit-el]", value));
      else if (a.do === "upload") await page.setInputFiles("[data-scenlit-el]", resolve(p.root, value));
      else if (a.do === "hover") await page.mouse.move(...mid(box), { steps: 8 });
      else if (a.do === "drag") { await page.mouse.move(...mid(box)); await page.mouse.down(); await page.mouse.move(...mid(to), { steps: 14 }); await page.mouse.up(); }
      else {
        await page.mouse.click(...mid(box));
        if (a.do === "fill") { await page.keyboard.press("ControlOrMeta+a"); await page.keyboard.type(value, cdp ? { delay: 28 } : {}); }
      }
      await settle();
    });
    step.actions.push({ do: a.do, what: nameOf(a.loc) || value, box, before, after: await picture(), ...(motion.length ? { motion } : {}), ...(to ? { to } : {}), ...(a.do === "fill" ? { chars: value.length } : {}), ...(a.do === "select" ? { value } : {}) });
    return true;
  }
  // `say` is the caption; { text, voice } gives the narration its own, longer sentence
  // a step of the film. `o` holds what any step can say for itself: say (the caption; { text, voice } gives the narration
  // its own sentence, { text, file } plays your own recording of it), sound (an effect: a name, { name, at, delay, volume }, or a list), hold (stay on what it did that
  // many milliseconds longer), pace (this step's own) and byViewer (in the player the film stops there, the place is
  // marked, and it goes on when the viewer clicks it; an MP4 plays straight through)
  // the line of the scene file a step is written on, from the call's own stack: a film can show its code beside it
  const own = scene.file ? scene.file.split(/[\\/]/).pop() : null;
  const lineOf = () => {
    if (!own) return null;
    for (const l of new Error().stack.split("\n")) { const m = /([^\s()/\\]+\.scene\.[cm]?[jt]s)(?:\?[^:)]*)?:(\d+):\d+/.exec(l); if (m && m[1] === own) return +m[2]; }
    return null;
  };
  const begin = (kind, text, o = {}) => {
    if (o.byViewer && !BY_VIEWER.includes(kind)) throw new Error(`"${kind}" has no place for the viewer to click. byViewer goes on: ${BY_VIEWER.join(", ")}`);
    if (o.byViewer && fastNow > 1) throw new Error(`byViewer inside fast(): a fast-forward does not stop for anyone`);
    if (side && !TOGETHER.includes(kind)) throw new Error(`"${kind}" cannot run together with other steps: it moves the one cursor, or takes the stage. Inside together(): ${TOGETHER.join(", ")}`);
    const src = lineOf();
    const s = { kind, text, ...(src ? { src } : {}), say: (typeof o.say === "object" ? o.say?.text : o.say) ?? null, ...(o.say?.file ? { speak: `file:${o.say.file}`, clip: o.say.file } : o.say?.voice ? { speak: o.say.voice } : {}), ...(o.sound ? { sound: asSounds(o.sound) } : {}),
      ...(o.hold > 0 ? { hold: +o.hold } : {}), ...(o.pace > 0 ? { pace: +o.pace } : {}), ...(o.byViewer ? { byViewer: true } : {}), ...(fastNow > 1 ? { fast: fastNow } : {}), ...(side ? { together: { id: side.id, n: side.n, lag: side.lag * side.n++ } } : {}), actions: [] };
    showOpened(kind); steps.push(s); return s;
  };
  // a page opened is shown by the next step that acts on it (its picture before). When a card, a pause, a sound or an
  // overlay comes first, or the scene ends, a cut to that page is put in, so it is not skipped
  let unshown = null, unshownAt = null; // the page opened and not shown yet, and the scene's line that opened it
  const ON_STAGE = ["card", "chapter", "background", "pause", "sound", "words", "overlay"];
  const showOpened = (kind) => {
    if (!unshown || (kind && !ON_STAGE.includes(kind))) { unshown = null; return; }
    const last = steps.flatMap((x) => x.actions).at(-1)?.after ?? start;
    if (unshown !== last) steps.push({ kind: "cut", text: "", ...(unshownAt ? { src: unshownAt } : {}), say: null, actions: [{ do: "scroll", what: "", box: null, before: unshown, after: unshown }] });
    unshown = null;
  };
  let marks = 0, fastNow = 0, side = null, sides = 0; // side: the steps being recorded start together
  // mark an element so the film can find it inside the frozen page. Nothing is pictured yet: `pictured` does that, once
  // for every mark of a step.
  const mark = async (loc, what) => {
    const box = await find(loc, { block: "seen" });
    if (!box) throw new Error(`${what}: "${nameOf(loc)}" is not on the page (waited ${WAIT / 1000} s)`);
    const id = `a${marks++}`;
    const text = await page.evaluate((it) => { const e = document.querySelector("[data-scenlit-el]"); e?.setAttribute("data-scenlit-a", it); const t = String(e?.value ?? e?.textContent ?? "").trim(), c = e ? getComputedStyle(e) : null;
      // bare: it has no ground or edge of its own (a line of text), so a piece of it needs room around it
      return { chars: t.length, words: t.split(/\s+/).filter(Boolean).length, bare: !!c && /rgba\(.*, 0\)|transparent/.test(c.backgroundColor) && parseFloat(c.borderTopWidth) === 0 }; }, id);
    return { id, box, ...text };
  };
  // the picture with the marks in it. When the page has not changed since its last picture, that moment has looked like
  // this all along: every use of the old picture becomes the marked one, so what is about to move is already in its
  // starting place when the film first shows it. (A page that scrolled or changed is a new moment, and nothing is rewritten.)
  const pictured = async () => {
    const pic = await picture({ fresh: true }), was = replaced;
    if (!was) return pic;
    if (start === was) start = pic;
    back: for (const st of [...steps].reverse()) for (const a of [...st.actions].reverse()) { if (a.after !== was) break back; if (a.before === was) a.before = pic; a.after = pic; }
    return pic;
  };
  const exact = (kind) => async (target, a, b) => {
    const takesValue = ["fill", "select", "upload"].includes(kind), value = takesValue ? a : undefined, opts = (takesValue || kind === "drag" ? b : a) ?? {}, loc = locOf(target);
    const action = kind === "drag" ? { do: "drag", loc, to: locOf(a) } : { do: kind, loc, value };
    if (!(await perform(action, begin(kind, nameOf(loc), opts)))) throw new Error(`${kind}: "${nameOf(loc)}" is not on the page (waited ${WAIT / 1000} s)`);
  };
  // show something without acting on it
  const pointing = (kind) => async (target, a, b) => {
    const text = kind === "label" ? a : undefined, opts = (kind === "label" ? b : a) ?? {}, loc = locOf(target);
    const box = await find(loc, { mark: false, block: "center" });
    if (!box) throw new Error(`${kind}: "${nameOf(loc)}" is not on the page (waited ${WAIT / 1000} s)`);
    const pic = await picture();
    begin(kind, nameOf(loc), opts).actions.push({ do: kind, what: nameOf(loc), box, before: pic, after: pic, ...(text ? { text } : {}) });
  };

  // a component in a page: ?state=failed sets data-state on its root (any ?name=value sets data-name), and `slots` fills
  // its text: { title: "…" } -> every [data-slot="title"]
  const show = async (pg, m, slots) => {
    await pg.goto(pathToFileURL(p.component(m[1])).href + (m[2] ?? ""));
    await pg.evaluate(([qs, d]) => {
      for (const [k, v] of new URLSearchParams(qs)) document.documentElement.dataset[k] = v;
      for (const [k, v] of Object.entries(d)) for (const e of document.querySelectorAll(`[data-slot="${k}"]`)) e.textContent = v;
    }, [m[2] ?? "", slots ?? {}]);
  };
  let aside = null, overlays = 0; // a second page, where a component is pictured without leaving the app's page
  const api = {
    // a page of the app ("/checkout"), or a component (".scenlit/components/pr-check.html" is "component:pr-check";
    // "component:pr-check?state=failed" sets data-state="failed" on its root)
    async open(path = "/", { data: slots } = {}) {
      const m = /^component:([\w./-]+?)(\?.*)?$/.exec(path);
      if (m) {
        await show(page, m, slots);
      } else {
        if (!appUp) { child = await startApp(scene.app, p.root); appUp = true; }
        await page.goto(new URL(path, scene.app.url).href);
      }
      await settle();
    },
    // put the page in another state: sets data-<name> on its root, which a component's CSS (or script) answers.
    // state("failed") is data-state="failed"; what moves on the way is filmed.
    async state(value, { name = "state", ...o } = {}) {
      const step = begin("state", value, o), before = await picture();
      const motion = await filmed(async () => { await page.evaluate(([k, v]) => { document.documentElement.dataset[k] = v; }, [name, String(value)]); await settle(); });
      step.actions.push({ do: "state", what: String(value), box: null, before, after: await picture(), ...(motion.length ? { motion } : {}) });
    },

    async act(instruction, { params, ...o } = {}) {
      const step = begin("act", instruction, o), done = [], rec = old.steps[instruction];
      for (const a of rec ?? []) {
        if (!(await perform(a, step, params))) { log(`  the recording no longer fits ("${nameOf(a.loc)}" is gone): the model takes over`); break; }
        done.push(a); stats.replayed++;
      }
      step.from = "replay";
      if (!rec || done.length < rec.length) {
        if (strict) throw new Error(`"${instruction}" ${rec ? "no longer fits its recording" : "is not recorded"}, and strict mode never calls a model. Run it once without --strict and commit .scenlit/recordings/.`);
        step.from = "model";
        let seenText = null;
        for (let turn = 0; ; turn++) {
          if (turn >= 10 || done.length > 16) throw new Error(`"${instruction}" is taking too many actions; split it into smaller steps`);
          const [els, where, text] = await Promise.all([page.evaluate(() => window.__scenlit.list()), page.evaluate(() => window.__scenlit.where()), page.evaluate(() => document.body.innerText)]);
          // what the last actions brought onto the page: how the model knows a panel opened or a row was added
          const had = new Set((seenText ?? "").split("\n").map((l) => l.trim())), unchanged = seenText === text;
          const appeared = seenText === null ? null : text.split("\n").map((l) => l.trim()).filter((l) => l && !had.has(l)).join(" | ").slice(0, 500);
          seenText = text;
          stats.calls++;
          const batch = await nextActions({ goal: instruction, params: Object.keys(params ?? {}), done, els, where, appeared }, p.config.model);
          if (!batch.length) break;
          const again = done.at(-1), first = batch[0], el = els[first.el];
          if (unchanged && again && first.action === again.do && (el?.name ?? first.value) === (again.loc?.name ?? again.value))
            throw new Error(`"${instruction}": the model repeated "${again.do} ${nameOf(again.loc) || again.value}" and the page did not change. Reword the step, or do it exactly with click().`);
          for (const [i, next] of batch.entries()) {
            let a;
            if (next.action === "press") a = { do: "press", value: next.value || "Enter" };
            else {
              const el = els[next.el];
              if (!el || !["click", "fill", "select"].includes(next.action)) throw new Error(`the model answered with something that cannot be done: ${JSON.stringify(next)}`);
              a = { do: next.action, loc: el.testid ? { testid: el.testid, name: el.name } : { role: el.role, name: el.name, nth: el.nth }, ...(next.action === "click" ? {} : { value: String(next.value ?? "") }) };
            }
            // a later action of the model's batch gets a moment (a panel sliding in), not the full wait: when it is not
            // there, the page moved on and the model is asked again
            if (!(await perform(a, step, params, i ? 1000 : WAIT))) { if (i === 0) throw new Error(`could not find ${JSON.stringify(a.loc)} on the page`); break; } // the page moved on: ask again
            done.push(a); stats.model++;
          }
        }
      }
      fresh.steps[instruction] = done;
      log(`  ${instruction}: ${done.length} action${done.length === 1 ? "" : "s"} (${step.from})`);
    },

    // the same things, said exactly: no model, nothing to record
    click: exact("click"), fill: exact("fill"), select: exact("select"), upload: exact("upload"), hover: exact("hover"), drag: exact("drag"),
    async press(key, o = {}) { await perform({ do: "press", value: key }, begin("press", key, o)); },
    async scroll(target, o = {}) {
      const loc = locOf(target), before = await picture();
      if (!(await find(loc, { mark: false, block: "center" }))) throw new Error(`scroll: "${nameOf(loc)}" is not on the page (waited ${WAIT / 1000} s)`);
      await page.waitForTimeout(350);
      begin("scroll", nameOf(loc), o).actions.push({ do: "scroll", what: nameOf(loc), box: null, before, after: await picture() });
    },
    point: pointing("point"), zoom: pointing("zoom"), label: pointing("label"),
    // something of the app the viewer can follow out of the film: it is marked while the step lasts, and in the player
    // a click on it opens the address in a new tab (in an MP4 it is only marked)
    async link(target, href, o = {}) {
      const loc = locOf(target), to = address(href, "link"), box = await find(loc, { mark: false, block: "center" });
      if (!box) throw new Error(`link: "${nameOf(loc)}" is not on the page (waited ${WAIT / 1000} s)`);
      const pic = await picture();
      begin("link", nameOf(loc), o).actions.push({ do: "link", what: nameOf(loc), href: to, box, before: pic, after: pic });
    },
    // a button laid over the film for a while, as the steps after it carry on: "Try it", "Read the docs". `at`: where.
    // `for`: how long it stays, in milliseconds. `wait: true`: in the player the film stops on it until the viewer goes on.
    async button(text, href, { at = "bottom", for: ms = 4000, wait = false, ...o } = {}) {
      const where = String(at).trim().split(/\s+/).sort().join(" ");
      if (!text || typeof text !== "string") throw new Error(`button: its words come first: button("Try it", "https://…")`);
      if (!PLACES.includes(where)) throw new Error(`button: at is one of ${PLACES.join(", ")}; got "${at}"`);
      begin("button", text, o).button = { text, href: address(href, "button"), at: where, for: Math.max(500, +ms || 4000), wait: !!wait };
    },
    // an effect by name, on something or on the whole window: built in (pulse, shake) or your own (.scenlit/motion.js)
    async effect(name, target, { say, sound, hold, pace, ...options } = {}) {
      let box = null;
      if (target) { box = await find(locOf(target), { mark: false, block: "center" }); if (!box) throw new Error(`effect "${name}": "${nameOf(locOf(target))}" is not on the page (waited ${WAIT / 1000} s)`); }
      const pic = await picture();
      begin("effect", name, { say, sound, hold, pace }).actions.push({ do: "effect", name, what: target ? nameOf(locOf(target)) : name, box, before: pic, after: pic, options });
    },

    // something on the app's own screen moves: a number counts up ("count"), a chart draws itself ("draw"), rows arrive
    // one by one ("rows"), a button swells ("pulse"), pops in ("pop") or lifts off the page ("lift"). The film moves the
    // real element inside the frozen page, so it stays sharp. `ms`: how long it takes.
    async animate(target, name = "pulse", { say, sound, hold, pace, ...options } = {}) {
      const loc = locOf(target), m = await mark(loc, "animate"), pic = await pictured();
      begin("animate", nameOf(loc), { say, sound, hold, pace }).actions.push({ do: "animate", name, id: m.id, what: nameOf(loc), box: m.box, chars: m.chars, words: m.words, before: pic, after: pic, options });
    },
    // one piece of the app alone on the stage, large: a card, a message, a chart. `with`: more pieces beside it.
    // `animate`: what the first piece does once it is there ("count", "draw", "type", "stream", …). `pad`: room around it.
    async piece(target, { with: more = [], animate, say, sound, hold, pace, ...options } = {}) {
      const locs = [target, ...[more].flat()].map(locOf), parts = [];
      for (const loc of locs) parts.push(await mark(loc, "piece"));
      // where each is now: marking a later one may have scrolled the page
      const boxes = await page.evaluate((all) => all.map((id) => { const r = document.querySelector(`[data-scenlit-a="${id}"]`).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }), parts.map((m) => m.id));
      const pic = await pictured();
      begin("piece", nameOf(locs[0]), { say, sound, hold, pace }).actions.push({ do: "piece", what: nameOf(locs[0]), box: boxes[0], chars: parts[0].chars, words: parts[0].words, before: pic, after: pic, ...(animate ? { name: animate } : {}), options,
        parts: parts.map((m, n) => ({ id: m.id, box: boxes[n], ...(m.bare || options.pad ? { pad: options.pad ?? 18 } : {}) })) });
    },
    // a component laid over the film for a while, as the steps after it carry on: a notification arriving, a phone
    // buzzing. `at`: where ("top right", "bottom left", "top", "right", "center", …). `for`: how long it stays, in
    // milliseconds. `wait: true` holds the film until it has gone. `scale`: its size. It is pictured on a page of its
    // own, so the app stays where it is.
    async overlay(path, { data: slots, at = "top right", for: ms = 3200, wait = false, scale = 1, ...o } = {}) {
      const m = /^component:([\w./-]+?)(\?.*)?$/.exec(path), where = at.trim().split(/\s+/).sort().join(" ");
      if (!m) throw new Error(`overlay shows a component: overlay("component:notification", { data: { title: "…" } })`);
      if (!PLACES.includes(where)) throw new Error(`overlay: at is one of ${PLACES.join(", ")}; got "${at}"`);
      aside ??= await context.newPage();
      await show(aside, m, slots);
      // what is laid over: the element marked data-overlay (else the first in the body), with room for its shadow
      const cut = await aside.evaluate(() => {
        const e = document.querySelector("[data-overlay]") ?? document.body.firstElementChild, r = e.getBoundingClientRect(), room = Math.min(40, r.x, r.y);
        return { x: r.x - room, y: r.y - room, width: Math.min(r.width + 2 * room, innerWidth - r.x + room), height: Math.min(r.height + 2 * room, innerHeight - r.y + room), room };
      });
      const file = `o${String(overlays++).padStart(3, "0")}.png`, { room, ...clip } = cut;
      await aside.screenshot({ path: join(capDir, file), clip, omitBackground: true });
      begin("overlay", m[1], o).overlay = { file, w: clip.width, h: clip.height, room, at: where, for: ms, wait: !!wait, scale };
    },
    // a sentence as a scene: its words land one by one, alone on the stage, or `beside` the app (the window steps to the
    // right). `highlight`: the word or words to set apart in the accent colour.
    // words on the stage. A list of phrases plays as quick swaps in one place. motion: how they come in (rise, letters,
    // bounce, blur, track, type); big: words set larger; highlight: words in the accent colour, sweep: true lays a box of
    // it behind them; tag: a small tilted label after the words; stroke: a line drawn through them; for: how long each holds
    // stack: each phrase a line under the last (the newest lit); field: a colour over the whole frame behind the words
    async words(text, { highlight, beside = false, motion = "rise", big, sweep = false, tag, stroke = false, for: ms, stack = false, field, ...o } = {}) {
      if (field != null && !/^#[0-9a-f]{6}$/i.test(String(field))) throw new Error(`words: field is a colour like "#ffd23f"; got ${JSON.stringify(field)}`);
      const phrases = [text].flat().map((x) => String(x ?? "").trim()).filter(Boolean);
      if (!phrases.length) throw new Error("words: what to say: words(\"Who owes you?\") or a list of phrases");
      if (!TYPE.includes(motion)) throw new Error(`words: motion is one of ${TYPE.join(", ")}; got "${motion}"`);
      begin("words", phrases.join(" / "), o).words = { text: phrases[0], phrases, highlight: [highlight ?? []].flat(), big: [big ?? []].flat(), beside: !!beside, motion,
        ...(sweep ? { sweep: true } : {}), ...(tag ? { tag: String(tag) } : {}), ...(stroke ? { stroke: true } : {}), ...(ms > 0 ? { for: +ms } : {}), ...(stack ? { stack: true } : {}), ...(field ? { field: String(field) } : {}) };
    },
    // a mark that draws itself: around something of the app (circle, box), under it (underline), pointing at it (arrow),
    // or across the stage (stroke, with no target)
    async mark(kind, target, { say, sound, hold, pace, ...options } = {}) {
      if (!MARKS.includes(kind)) throw new Error(`mark: one of ${MARKS.join(", ")}; got "${kind}"`);
      let box = null;
      if (target) { box = await find(locOf(target), { mark: false, block: "seen" }); if (!box) throw new Error(`mark "${kind}": "${nameOf(locOf(target))}" is not on the page (waited ${WAIT / 1000} s)`); }
      else if (kind !== "stroke") throw new Error(`mark "${kind}" goes on something: mark("${kind}", "Send reminder")`);
      const pic = await picture();
      begin("mark", kind, { say, sound, hold, pace }).actions.push({ do: "mark", name: kind, what: target ? nameOf(locOf(target)) : kind, box, before: pic, after: pic, options });
    },
    // a sound effect by itself: await sound("chime")
    async sound(name, { delay, volume, ...o } = {}) { begin("sound", name, { ...o, sound: { name, at: "start", delay, volume } }); },
    // several things at once: the steps inside start at the same moment (or `stagger` milliseconds apart), and the film
    // goes on when the last of them is done. For what does not need the one cursor: animate, effect, overlay, sound.
    // `say`, `sound` and `hold` are for the group as a whole.
    async together(these, { stagger = 0, say, sound, hold, pace } = {}) {
      if (side) throw new Error("together() inside together(): put all the steps in one");
      const from = steps.length;
      side = { id: sides++, n: 0, lag: Math.max(0, +stagger || 0) };
      try { await these(); } finally { side = null; }
      const mine = steps.slice(from);
      if (!mine.length) return;
      Object.assign(mine[0], { ...(say ? { say: (typeof say === "object" ? say.text : say) ?? null, ...(say.voice ? { speak: say.voice } : {}) } : {}), ...(sound ? { sound: asSounds([sound].flat().map((x) => (typeof x === "string" ? { name: x, at: "start" } : { at: "start", ...x }))) } : {}), ...(pace > 0 ? { pace: +pace } : {}) }); // the group's sound plays as it begins
      if (hold > 0) mine.at(-1).hold = +hold;
    },
    // fast-forward: the steps inside play `speed` times quicker, with a mark on screen. For what has to be shown but is
    // dull to watch: a long form, a wait. Words have no time there: put the caption on the step before or after.
    async fast(steps, { speed = 4 } = {}) { const was = fastNow; fastNow = speed; try { await steps(); } finally { fastNow = was; } },

    // a check: the text must be on the page
    async see(text, { timeout = 8000 } = {}) {
      checks.push(text);
      try { await page.getByText(text).first().waitFor({ timeout }); }
      catch { throw new Error(`expected to see "${text}", and it is not on the page (waited ${timeout / 1000} s)`); }
      await picture(); // what was waited for may have just arrived: the last picture is always the page as it is now
    },
    // a title card in the middle of the film
    async chapter(lead, key, o = {}) { begin("chapter", key, o).card = { lead, key }; },
    // a card: two lines on the stage. Said before the app shows, it opens the film (and names it); after the last
    // step, it ends it (with { url, button }); anywhere else it is a chapter
    async card(lead, key, { url, button, ...o } = {}) { const s = begin("card", key, o); s.card = { lead, key, ...(url ? { url } : {}), ...(button ? { button } : {}) }; if (opened) s.opened = true; },
    // the film's first and last cards, said as steps (the same as the scene's title and end): the film opens on the
    // title and closes on the end, wherever in run() they are said
    async title(lead, key) { cards.title = { lead, key }; },
    async end(lead, key, o = {}) { cards.end = { ...o, lead, key }; },
    // the stage behind the app's window, from here on: a colour, a list of colours (a gradient), a picture ("assets/sky.jpg",
    // or an address), or { kind, colors, angle, image } as in the style. Said before anything else, the film starts on it;
    // later, it fades in
    async background(value, o = {}) { begin("background", "", o).background = value; },
    // the code an authenticator app would show: fill("Code", totp(process.env.TOTP_SECRET))
    totp,
    // hold the film here (a moment to read, or to let the narration finish)
    async pause(ms = 1000, o = {}) { begin("pause", "", o).ms = ms; },
    // a named picture for posts and docs: the whole screen, or with `crop`, around one element. `save`: also
    // written there (a path in your project, for example "docs/img/checkout.png")
    async shot(name, { crop, save } = {}) {
      let box = null;
      if (crop) { box = await find(locOf(crop), { mark: false }); if (!box) throw new Error(`shot "${name}": "${nameOf(locOf(crop))}" is not on the page (waited ${WAIT / 1000} s)`); }
      const png = join(shotDir, `${name}.png`);
      mkdirSync(shotDir, { recursive: true });
      await page.screenshot({ path: png, ...(box ? { clip: { x: box.x, y: box.y, width: box.w, height: box.h } } : {}) });
      if (save) { const to = resolve(p.root, save); mkdirSync(dirname(to), { recursive: true }); copyFileSync(png, to); }
      shots[name] = { file: await picture(), crop: box, png, save: save ?? null };
    },

    // sample data, so a film never shows a real customer
    async mock(path, body) { // the app's own request to `path` gets this answer (an object, or a function of the request)
      await page.route((url) => (typeof path === "string" ? url.pathname === path || url.pathname.startsWith(`${path}/`) : path.test(url.href)),
        async (route) => route.fulfill({ json: typeof body === "function" ? await body(route.request()) : body }));
    },
    async replace(map) { Object.assign(data.replace, map); await applyData(); if (start) await picture(); },
    async blur(...targets) { data.blur.push(...targets.map(selectorOf)); await applyData(); if (start) await picture(); },
    async freeze(date) { await page.clock.setFixedTime(new Date(date)); },
    // keep this browser's login for other scenes (`as: "admin"`): how a scene signs in without a person
    async saveLogin(as = "default") { await saveSession(p, context, as); },
  };

  let start = null, failed = null, ended = null;
  const first = api.open;
  let opened = false; // the app has been shown: a card from here on is not the opening one
  // the page's own size: on a phone look, a page without a viewport tag lays itself out wider than the screen
  let layout = look.viewport;
  api.open = async (path, opts) => { opened = true; await first(path, opts); if (!start) layout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight })); const at = lineOf(); const pic = await picture(); if (start) { unshown = pic; unshownAt = at; } start ??= pic; }; // a picture after every open, so the last one is always the page as it is now
  const t0 = Date.now();
  try {
    await scene.run(api); start ??= await picture(); showOpened(null);
    if (inspect) { const file = join(p.output, "_inspect", `${scene.name}-end.png`); mkdirSync(dirname(file), { recursive: true }); await page.screenshot({ path: file }); ended = { ...(await page.evaluate(describePage)), picture: file }; }
  }
  catch (e) { failed = e; await page.screenshot({ path: join(capDir, "failed.png") }).catch(() => {}); }
  await browser.close(); stopApp(child);
  if (scene.teardown) try { execSync(scene.teardown, { cwd: p.root, stdio: "inherit" }); } catch (e) { log(`  teardown failed: ${e.message}`); }
  if (failed) { failed.message = `${failed.message}\n  nothing was recorded; the page at that moment: ${join(capDir, "failed.png")}`; throw failed; }

  if (Object.keys(fresh.steps).length) writeFileSync(recFile, `${JSON.stringify(fresh, null, 2)}\n`);
  stats.seconds = +((Date.now() - t0) / 1000).toFixed(1);
  // Every step on a page that only gained marks shows the last of its pictures, which carries all of them: what
  // moves later is then found from the page's first moment, and waits in its place (text to be typed is not there yet)
  steps.splice(0, steps.length, ...placeCards(steps, cards));
  const latest = (f) => { while (f && later[f]) f = later[f]; return f; };
  start = latest(start);
  for (const x of steps) for (const a of x.actions) { a.before = latest(a.before); a.after = latest(a.after); }
  // the film opens on the first step's picture when that is the same page: the one taken as it opened may be from
  // before its fonts settled, and carries none of the marks
  const opening = steps.find((x) => x.actions.length)?.actions[0];
  if (opening?.before && pages[opening.before] && pages[opening.before] === pages[start]) start = opening.before;
  const shown = new Set([start, ...steps.flatMap((x) => x.actions.flatMap((a) => [a.before, a.after])), ...Object.values(shots).map((x) => x.file)]);
  for (let i = 0; i < n; i++) { // pictures no step shows: a marked picture stood in for them
    const file = `${String(i).padStart(3, "0")}.jpg`;
    if (shown.has(file)) continue;
    rmSync(join(capDir, file), { force: true });
    if (vector?.files[file]) { rmSync(join(capDir, vector.files[file]), { force: true }); delete vector.files[file]; vector.tried--; }
    delete hosts[file]; delete pages[file]; delete names[file];
  }
  if (vector) { stats.vector = Object.keys(vector.files).length; stats.pictures = vector.tried; }
  const source = scene.file && existsSync(scene.file) ? readFileSync(scene.file, "utf8").split("\n") : null; // the scene's own lines, for a film that shows them
  const capture = { v: CAPTURE, ...(source ? { source } : {}), view: { ...layout, device: look.device, ...(ground ? { ground } : {}) }, start, steps, shots, stats, vector: vector?.files ?? {}, hosts, pages, names, checks, look: lookName ?? scene.look ?? null, format: scene.asFormat ?? null, ...cards }; // format: the kind it was run as, when the command line said so. title, end: when run() said them
  Object.assign(scene, withCards(scene, capture));
  writeFileSync(join(capDir, "capture.json"), JSON.stringify(capture, null, 2));
  const actions = steps.reduce((s, x) => s + x.actions.length, 0);
  log(`  ${actions} action${actions === 1 ? "" : "s"}: ${stats.replayed} replayed, ${stats.model} from the model (${stats.calls} model call${stats.calls === 1 ? "" : "s"}), ${stats.seconds}s`);
  if (vector) log(`  ${stats.vector} of ${stats.pictures} pictures are vector (the rest stay screenshots)`);
  return { capture, stats, ended };
}

// Every scene that has a recording this version can use: [name, capture]. One that does not fit is left out, and said.
export const recorded = (p, log = console.log) => p.sceneNames().filter((n) => existsSync(join(p.captures, n, "capture.json"))).flatMap((n) => {
  try { return [[n, loadCapture(p, n)]]; } catch (e) { log(`  left out: ${e.message}`); return []; }
});

// The shape of a recording (capture.json). It goes up when a film can no longer be made from an older one; a recording
// of another shape is not guessed at: the scene is run again.
export const CAPTURE = 1;
export { placeCards, withCards };
export function loadCapture(p, name) {
  const f = join(p.captures, name, "capture.json");
  if (!existsSync(f)) throw new Error(`"${name}" has not been run yet: scenlit run ${name}`);
  const capture = JSON.parse(readFileSync(f, "utf8"));
  if (capture.v !== CAPTURE) throw new Error(`"${name}" was recorded by ${capture.v > CAPTURE ? "a newer" : "an earlier"} version of Scenlit, and its recording does not fit this one. Run it again: scenlit run ${name}`);
  return capture;
}
