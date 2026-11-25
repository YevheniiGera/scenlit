#!/usr/bin/env node
// scenlit: product films, posts, docs screenshots and guides made from your real app.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { flag, option, project } from "../src/config.mjs";

// TypeScript scenes run as they are on a recent Node; its note about that being new is not the user's concern
const warn = process.emitWarning;
process.emitWarning = (w, ...rest) => (String(w?.message ?? w).includes("Type Stripping") ? undefined : warn.call(process, w, ...rest));

const HELP = `scenlit: films, posts, screenshots and guides made from your real app

  init                           set up .scenlit/ in this project
  doctor                         is this machine ready, and what is missing
  login [path] [--as name]       sign in to your app by hand; scenes then start signed in
  look [path] [--save]           the app's name and accent colour, and a marketing look (less around the content,
                                 bigger type) for films and posts
  dev <scene> [--port 4400]      run it, serve the film, and run again every time you save
  run <scene> | --all            run a scene on the app, then write its film, posts, screenshots and guide
      --record                   work the steps out again
      --strict                   never call a model; fail when a step is not recorded (the default in CI)
      --look <name>              capture with another look
      --format <kind>            make it another kind of film this time: trailer, recording, short, keynote, launch, …
      --sheet                    also the film as one image (an agent looks at it next)
      --headed                   watch the browser
  check [scene]                  every scene without running it: what is missing
  inspect [path | component:x]   what is on a page: its controls by name, its other parts, its text, a picture
  inspect --scene <name>         the same for the page a scene ends on (a page only reached by clicking)
  sheet <scene> [--shape s]      the film as one image: eight moments with time and caption
  component list                 the built-in screens: pull-request, chat, email, terminal, issue, notification, phone
  component add <kind> [name]    copy a built-in one into the project to edit it
  component new <name>           a vector piece of your own (.scenlit/components/), opened with open("component:<name>")
  component from <scene>/<shot> <name>
                                 start a component from a picture of the real app
  motion list | motion new       the pieces that move things, and a file to add or replace them (.scenlit/motion.js)
  sounds [--save]                the sound effects and music beds, and where a sound can play (--save: as .wav files to listen to)
  guide [example]                how to make a good film, for an agent or a person; with a name, an example scene:
                                 product-demo, feature, tutorial, story, short, launch
  (run, check, inspect and sheet take --json)
  frames <scene> [--shape s] [--at seconds]
                                 still frames of the film, to look at
  voice <scene> [--retake]       record the narration (the voice in .scenlit/config.json)
  export <scene>                 the film as an MP4 (needs ffmpeg)
      --for web|youtube|linkedin|x|reels|docs|readme|all
                                 the right shape and the files that place wants, in one folder
      --shape wide|square|vertical | --all
      --out <path>               a copy where you want it: a file, or a folder (also for frames and sheet)
      --step <n> [--gif]         only that step, as a short loop
      --4k, --fps 60             twice the size (sharp with vector pictures), smoother motion
      --blur                     motion blur on everything that moves (takes five times as long)
  kit                            the app as a library of vector pieces: HTML, PDF and SVG of every named picture
  site                           one page listing everything that was made
  connect [--to address]         connect this computer to the platform (you approve it in the browser, with GitHub or Google)
  disconnect                     this computer may no longer publish there
  publish <scene> [--to address] the video gets a link on the platform: a page to watch it on, an embed, who watched it
      --kind demo|help|news      where its product's page shows it (else: the scene's "kind"; a tutorial is help)
      --private | --public       only your product's people may watch it (or anyone with the link again)
      --listed | --unlisted      on Scenlit's front page, with the scene that made it (or off it again)
  unpublish <scene>              take the video down
  portal                         your products on the platform, in the browser

  record <name> [path]           click through the app yourself and get the scene file
  translate <scene> --to <lang>  the film's words in another language (then: voice/export --lang <lang>)

Everything is written to .scenlit/output/<scene>/.`;

const [cmd, ...args] = process.argv.slice(2);
const valued = ["as", "look", "format", "shape", "step", "at", "to", "lang", "file", "fps", "scene", "for", "port", "out", "kind", "preview", "about"]; // options that take a value: that value is not the scene's name
const rest = args.filter((a, i) => !a.startsWith("--") && !valued.includes(args[i - 1]?.slice(2))), name = rest[0]; // what is not an option: the scene's name first
const need = () => { if (!name) throw new Error(`which scene? scenlit ${cmd} <scene>`); return name; };

const json = flag(args, "json"), say = json ? () => {} : console.log; // --json: one JSON document on stdout, nothing else

async function make(p, sceneName) {
  const scene = await p.loadScene(sceneName, { format: option(args, "format") }); // --format trailer: this scene as another kind of film, this time
  say(`scene ${scene.name}`);
  const { capture, stats } = await (await import("../src/scene.mjs")).runScene(p, scene, { record: flag(args, "record"), headed: flag(args, "headed"), look: option(args, "look"), log: say, ...(flag(args, "strict") ? { strict: true } : {}) });
  const film = (await import("../src/film.mjs")).writeFilm(p, scene);
  const posts = await (await import("../src/post.mjs")).writePosts(p, scene, { log: say });
  const guide = await (await import("../src/guide.mjs")).writeGuide(p, scene);
  const notes = (await import("../src/agent.mjs")).review(p, scene);
  say(`  film:  ${film}`);
  if (posts.length) say(`  posts: ${posts[0].replace(/[^/\\]+$/, "")}`);
  if (guide) say(`  guide: ${guide}`);
  const saved = await (await import("../src/save.mjs")).saveRun(p, scene); // what the scene keeps in the project (its `save`)
  for (const f of saved) say(`  saved: ${f}`);
  for (const n of notes) say(`  look at: ${n}`);
  const board = json || flag(args, "sheet") ? (await (await import("../src/agent.mjs")).sheet(p, scene.name, { shape: scene.shape ?? "wide" })) : null; // an agent reads this next
  return {
    files: { film, posts, guide, saved, shots: Object.values(capture.shots).map((x) => x.png), ...(board ? { sheet: board.file } : {}) }, ...(board ? { filmSeconds: board.filmSeconds } : {}), stats, notes,
    checks: capture.checks.map((text) => ({ see: text, ok: true })),
    steps: capture.steps.map((x) => ({ kind: x.kind, text: x.text, say: x.say, from: x.from, actions: x.actions.map((a) => ({ do: a.do, what: a.what })) })),
  };
}

async function main() {
  if (!cmd || cmd === "help" || args.includes("--help") || args.includes("-h") || cmd === "--help" || cmd === "-h") return console.log(HELP);
  if (cmd === "init") return (await import("../src/init.mjs")).init();
  if (cmd === "guide") { // the guide; with a name, one example scene of that kind
    if (!name) return console.log(readFileSync(new URL("../templates/SKILL.md", import.meta.url), "utf8").replace(/^---[\s\S]*?---\n+/, ""));
    const EXAMPLES = readdirSync(new URL("../templates/examples/", import.meta.url)).map((f) => f.replace(".scene.mjs", ""));
    if (!EXAMPLES.includes(name)) throw new Error(`no example "${name}": ${EXAMPLES.join(", ")}`);
    return console.log(readFileSync(new URL(`../templates/examples/${name}.scene.mjs`, import.meta.url), "utf8"));
  }  const p = project();
  if (cmd === "doctor") {
    const rows = await (await import("../src/site.mjs")).doctor(p);
    for (const r of rows) console.log(`${r.ok ? "ok  " : "MISS"}  ${r.what}${r.ok || !r.fix ? "" : `\n      ${r.fix}`}`);
    if (rows.some((r) => !r.ok)) process.exitCode = 1;
    return;
  }
  if (!p.exists) throw new Error("no .scenlit/config.json here. Run: scenlit init");

  if (cmd === "login") { const file = await (await import("../src/browser.mjs")).login(p, { path: name ?? "/", as: option(args, "as", "default") }); return console.log(`saved the login to ${file} (kept out of git)`); }
  if (cmd === "look") { // the app's name and colour, then a look with less around its content
    const o = { path: name ?? "/", save: flag(args, "save"), as: option(args, "as") };
    await (await import("../src/brand.mjs")).readBrand(p, o);
    return void (await (await import("../src/look.mjs")).proposeLook(p, o));
  }

  if (cmd === "inspect") {
    const { inspect, inspectScene, inspectText } = await import("../src/agent.mjs"), at = option(args, "scene");
    const r = at ? await inspectScene(p, await p.loadScene(at), { look: option(args, "look") }) : await inspect(p, { path: name ?? "/", as: option(args, "as"), look: option(args, "look") });
    return console.log(json ? JSON.stringify(r, null, 2) : inspectText(r));
  }
  if (cmd === "sounds") return console.log((await import("../src/sounds.mjs")).soundsText(p, flag(args, "save") ? `${p.output}/_sounds` : null));
  if (cmd === "motion") {
    const { listText, newMotion } = await import("../src/motion.mjs"), sub = args.find((x) => !x.startsWith("--"));
    if (sub === "new") return console.log(`wrote ${newMotion(p)}\nIt holds two examples (a "wipe" cut and a "stamp" effect) and the kit they are written with.`);
    return console.log(listText(p));
  }
  if (cmd === "component") {
    const { newComponent, componentFrom, addComponent } = await import("../src/agent.mjs");
    if (rest[0] === "new" && rest[1]) return console.log(`wrote ${newComponent(p, rest[1])}\nA scene opens it with open("component:${rest[1]}"); scenlit inspect component:${rest[1]} shows what it holds.`);
    if (rest[0] === "from" && rest[1] && rest[2]) return console.log(`wrote ${componentFrom(p, rest[1], rest[2])}`);
    if (rest[0] === "list") return console.log(`built in (open("component:<name>") works without copying):\n  ${p.builtInComponents().join("\n  ")}\nLook at one: scenlit inspect component:<name>.  Edit one: scenlit component add <name>`);
    if (rest[0] === "add" && rest[1]) return console.log(`wrote ${addComponent(p, rest[1], rest[2])} (your copy now wins over the built-in one)`);
    throw new Error("scenlit component list | add <kind> [name] | new <name> | from <scene>/<shot> <name>");
  }
  if (cmd === "check") {
    const problems = await (await import("../src/site.mjs")).check(p, name ? [name] : undefined);
    if (json) { console.log(JSON.stringify({ ok: !problems.length, problems }, null, 2)); if (problems.length) process.exitCode = 1; return; }
    if (!problems.length) return console.log("all good");
    for (const m of problems) console.log(m);
    process.exitCode = 1; return;
  }
  const { writeSite } = await import("../src/site.mjs");
  if (cmd === "site") return console.log(writeSite(p));
  if (cmd === "dev") { // stays running: run again on every save, and the film reloads itself
    await (await import("../src/dev.mjs")).dev(p, need(), async (n) => { const now = project(); await make(now, n); writeSite(now); }, { port: +option(args, "port", "4400") });
    return;
  }
  if (cmd === "record") { const r = await (await import("../src/author.mjs")).record(p, need(), { path: rest[1] ?? "/", as: option(args, "as") }); return console.log(`wrote ${r.file} (${r.steps} steps)`); }
  if (cmd === "kit") { const k = await (await import("../src/kit.mjs")).writeKit(p); return console.log(`gallery: ${k.dir}/index.html`); }
  if (cmd === "connect") {
    const r = await (await import("../src/publish.mjs")).connect(p, { to: option(args, "to"), show: !flag(args, "print") });
    return console.log(`connected to ${r.portal} as ${r.account.name || r.account.email}${r.products.length ? `\nyour products: ${r.products.map((x) => x.slug).join(", ")}` : ""}`);
  }
  if (cmd === "disconnect") { const r = (await import("../src/publish.mjs")).disconnect(p, { to: option(args, "to") }); return console.log(r.had ? `this computer is no longer connected to ${r.portal}` : `this computer was not connected to ${r.portal}`); }
  if (cmd === "publish") {
    const scene = await p.loadScene(need()), kind = option(args, "kind");
    if (kind && !["demo", "help", "news"].includes(kind)) throw new Error("--kind demo, help or news");
    (await import("../src/film.mjs")).writeFilm(p, scene);
    const r = await (await import("../src/publish.mjs")).publish(p, scene, { to: option(args, "to"), kind, listed: flag(args, "listed") ? true : flag(args, "unlisted") ? false : null, private: flag(args, "private") ? true : flag(args, "public") ? false : null, log: say });
    if (json) return console.log(JSON.stringify(r));
    return console.log([`published: ${r.link}  (version ${r.version}${r.private ? ", private" : ""}${r.listed ? ", on Scenlit's front page" : ""})`, r.private ? null : `embed:     ${r.embed}`, r.help ? `help:      ${r.help}` : null, `product:   ${r.page}`, r.pictures ? `pictures:  ${r.pictures}, at addresses that stay (see the product's Pictures)` : null].filter(Boolean).join("\n"));
  }
  if (cmd === "add") {
    if (!name) throw new Error("add what? a folder, github:owner/repo[/path], a gallery address, or <product>/<name>");
    const r = await (await import("../src/share.mjs")).add(p, name, { yes: flag(args, "yes"), force: flag(args, "force"), dryRun: flag(args, "dry-run"), to: option(args, "to"), log: json ? () => {} : console.log });
    if (json) return console.log(JSON.stringify(r, null, 2));
    if (r.added === false) return console.log(`would add (nothing added):\n${r.files.map((f, i) => `  ${f}: ${r.use[i]}`).join("\n")}\n${Object.entries(r.text).map(([f, t]) => `\n----- ${f}\n${t}`).join("")}`);
    return console.log(`added:\n${r.files.map((f, i) => `  ${f}: ${r.use[i]}`).join("\n")}`);
  }
  if (cmd === "find") {
    const kind = option(args, "kind");
    if (kind && !["component", "motion", "look", "format", "sound"].includes(kind)) throw new Error("--kind component, motion, look, format or sound");
    const { find, findText } = await import("../src/find.mjs"), r = await find(p, rest.join(" "), { kind, to: option(args, "to"), gallery: !flag(args, "no-gallery"), pictures: flag(args, "pictures") });
    return console.log(json ? JSON.stringify(r, null, 2) : findText(r));
  }
  if (cmd === "share") {
    const [kind, piece] = rest;
    const r = await (await import("../src/share.mjs")).share(p, kind, piece, { to: option(args, "to"), preview: option(args, "preview"), description: option(args, "about", ""), log: say });
    return console.log(`shared: ${r.page}  (version ${r.version})\nothers add it with: npx scenlit add ${r.page}`);
  }
  if (cmd === "unpublish") return console.log(`taken down: ${await (await import("../src/publish.mjs")).unpublish(p, need(), { to: option(args, "to") })}`);
  if (cmd === "portal") return console.log(`your products: ${(await import("../src/publish.mjs")).openPortal(p, { to: option(args, "to"), show: !flag(args, "print") })}`);
  if (cmd === "run") {
    const failed = [], results = [];
    for (const n of flag(args, "all") ? p.sceneNames() : [need()]) {
      const t0 = Date.now();
      try { const made = await make(p, n); results.push({ name: n, ok: true, runSeconds: +((Date.now() - t0) / 1000).toFixed(1), ...made }); }
      catch (e) { if (!flag(args, "all") && !json) throw e; failed.push(n); results.push({ name: n, ok: false, error: e.message, runSeconds: +((Date.now() - t0) / 1000).toFixed(1) }); if (!json) console.error(`  FAILED: ${e.message}`); }
    }
    if (json) { writeSite(p); console.log(JSON.stringify({ scenes: results }, null, 2)); if (failed.length) process.exitCode = 1; return; }
    console.log(`all:   ${writeSite(p)}`);
    if (failed.length) { console.error(`${failed.length} scene${failed.length === 1 ? "" : "s"} failed: ${failed.join(", ")}`); process.exitCode = 1; }
    return;
  }
  if (!["frames", "sheet", "voice", "export", "translate"].includes(cmd)) throw new Error(`unknown command "${cmd}"\n\n${HELP}`);

  const { writeFilm } = await import("../src/film.mjs"), one = writeFilm;
  const scene = await p.loadScene(need());
  const shape = option(args, "shape", scene.shape ?? "wide"); // the frame: wide, square or vertical; a scene's format may bring its own
  // --out <path>: a copy where you want it (a file, or a folder when the path ends in / or has no extension)
  const out = option(args, "out"), { copyTo, saveVideo } = await import("../src/save.mjs"), placed = (file) => (out && file ? copyTo(p, file, out) : file);
  if (cmd === "frames") { const made = await (await import("../src/site.mjs")).frames(p, scene.name, { shape, at: option(args, "at") ? +option(args, "at") : null }); for (const f of made) console.log(out ? copyTo(p, f, made.length > 1 ? `${out}/` : out) : f); return; }
  if (cmd === "sheet") { const r = await (await import("../src/agent.mjs")).sheet(p, scene.name, { shape }); r.file = placed(r.file); return console.log(json ? JSON.stringify(r) : `${r.file}  (${r.filmSeconds}s film)`); }
  const lang = option(args, "lang");
  if (cmd === "translate") {
    const to = option(args, "to"); if (!to) throw new Error("to which language? scenlit translate <scene> --to de");
    const r = await (await import("../src/author.mjs")).translate(p, scene, to);
    console.log(`${r.translated} line${r.translated === 1 ? "" : "s"} translated: ${r.file} (edit it freely)`);
    return console.log(`film:  ${one(p, scene, { lang: to })}`);
  }
  if (cmd === "voice") {
    const { loadCapture } = await import("../src/scene.mjs"), { recordVoice } = await import("../src/voice.mjs");
    const { translated, loadTranslation } = await import("../src/film.mjs");
    const capture = lang ? translated(loadCapture(p, scene.name), loadTranslation(p, scene.name, lang)) : loadCapture(p, scene.name);
    const made = await recordVoice(p, capture, { retake: flag(args, "retake"), lang });
    console.log(made ? `recorded ${made} line${made === 1 ? "" : "s"}` : "every line is already recorded");
    return console.log(`film:  ${lang ? one(p, scene, { lang }) : await writeFilm(p, scene)}`);
  }
  if (cmd === "export") {
    const { exportFilm, exportFor, PLACES, SHAPES } = await import("../src/export.mjs"), step = option(args, "step");
    if (lang) one(p, scene, { lang }); else await writeFilm(p, scene);
    const place = option(args, "for"), extra = { lang, scale: flag(args, "4k") ? 2 : 1, fps: +option(args, "fps", "30"), blur: flag(args, "blur") };
    if (place) {
      const made = new Map(); // several places want the same shape: it is rendered once
      const places = place === "all" ? Object.keys(PLACES) : [place];
      for (const one1 of places) { const r = await exportFor(p, scene, one1, { ...extra, made }); if (out) r.dir = copyTo(p, r.dir, places.length > 1 ? join(out, one1) : out); console.log(`${one1}: ${r.dir}\n  ${r.files.join("  ")}`); }
      writeSite(p); return;
    }
    const shapes = flag(args, "all") ? SHAPES : [shape];
    for (const one1 of shapes) {
      const file = await exportFilm(p, scene, { ...extra, shape: one1, step: step ? +step : null, gif: flag(args, "gif") });
      const kept = !step && !flag(args, "gif") && !lang ? saveVideo(p, scene, file, one1) : null; // the scene's own place for its MP4
      console.log(out ? copyTo(p, file, shapes.length > 1 ? `${out}/` : out) : file);
      if (kept) console.log(`saved: ${kept}`);
    }
    writeSite(p);
  }
}

main().catch((e) => { console.error(`scenlit: ${e.message}`); process.exit(1); });
