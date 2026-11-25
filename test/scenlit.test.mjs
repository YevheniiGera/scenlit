// npm test
// Both examples run by replay (their recordings are committed) in strict mode, so no model is called and nothing is spent.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync as rm, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { launch } from "../src/browser.mjs";
import { project } from "../src/config.mjs";
import { writeFilm } from "../src/film.mjs";
import { writeGuide } from "../src/guide.mjs";
import { init } from "../src/init.mjs";
import { parseActions, promptFor } from "../src/model.mjs";
import { writePosts } from "../src/post.mjs";
import { outline, runScene } from "../src/scene.mjs";
import { check, frames } from "../src/site.mjs";

const example = (name) => fileURLToPath(new URL(`../examples/${name}`, import.meta.url));
const quiet = { log: () => {} };

test("the model's answer is read out of whatever surrounds it", () => {
  assert.deepEqual(parseActions('{"actions":[{"action":"click","el":3},{"action":"fill","el":1,"value":"{card}"}]}'), [{ action: "click", el: 3 }, { action: "fill", el: 1, value: "{card}" }]);
  assert.deepEqual(parseActions('Sure.\n```json\n{"action":"click","el":3}\n```'), [{ action: "click", el: 3 }]);
  assert.deepEqual(parseActions('{"actions":[]}'), []);
  assert.deepEqual(parseActions('{"action":"done"} I am finished.'), []);
  assert.throws(() => parseActions("I could not decide."), /could not be read/);
});

test("the model is shown placeholders, never the values", () => {
  const prompt = promptFor({ goal: "pay with the card {card}", params: ["card"], done: [], els: [{ i: 0, role: "textbox", name: "Card number" }], where: { url: "http://x/", text: "Checkout" } });
  assert.match(prompt, /\{card\}/);
  assert.doesNotMatch(prompt, /4242/);
});

test("init sets up a project and keeps what is already there", () => {
  const root = mkdtempSync(join(tmpdir(), "scenlit-init-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "@acme/shop", scripts: { dev: "vite" }, devDependencies: { vite: "1" } }));
  init(root, quiet);
  const settings = JSON.parse(readFileSync(join(root, ".scenlit/config.json"), "utf8"));
  assert.equal(settings.app.url, "http://localhost:5173");
  assert.equal(settings.app.start, "npm run dev");
  assert.equal(settings.brand.name, "Shop");
  for (const f of [".scenlit/.gitignore", ".scenlit/scenes/first.scene.mjs", ".claude/skills/scenlit/SKILL.md"]) assert.ok(existsSync(join(root, f)), f);
  writeFileSync(join(root, ".scenlit/config.json"), "{}");
  init(root, quiet);
  assert.equal(readFileSync(join(root, ".scenlit/config.json"), "utf8"), "{}");
  // AGENTS.md: written when there is none; added to once when there is one, and the rest of it kept
  assert.match(readFileSync(join(root, "AGENTS.md"), "utf8"), /npx scenlit guide/);
  const other = mkdtempSync(join(tmpdir(), "scenlit-init-"));
  writeFileSync(join(other, "AGENTS.md"), "# Our rules\n\nRun the tests before a commit.\n");
  init(other, quiet); init(other, quiet);
  const agents = readFileSync(join(other, "AGENTS.md"), "utf8");
  assert.ok(agents.startsWith("# Our rules\n\nRun the tests before a commit.\n\n## Videos"));
  assert.equal(agents.split("npx scenlit guide").length, 2);
});

test("a piece someone shared is added from a folder: code only when you say so, nothing of yours replaced", async () => {
  const { add } = await import("../src/share.mjs"), { ownMotion } = await import("../src/motion.mjs");
  const root = mkdtempSync(join(tmpdir(), "scenlit-add-")), piece = mkdtempSync(join(tmpdir(), "scenlit-piece-")), put = (f, text) => { mkdirSync(join(piece, f, ".."), { recursive: true }); writeFileSync(join(piece, f), text); };
  init(root, quiet);
  put("components/pr-card.html", "<div data-overlay>passed</div>");
  put("motion/zip.js", 'scenlitMotion((define) => define("cut", "zip", (layer, at, dur, kit) => kit.to(layer, "opacity", at, dur, 1)));');
  put("looks/chalk.json", JSON.stringify({ css: "body { filter: grayscale(1) }" }));
  put("formats/teaser.json", JSON.stringify({ pace: 0.8 }));
  put("README.md", "not for Scenlit");
  const p = project(root);
  await assert.rejects(add(p, piece, { log: () => {}, ask: async () => "n" }), /not added/);
  assert.ok(!existsSync(join(p.dir, "components/pr-card.html")), "nothing was added");
  const r = await add(p, piece, { log: () => {}, ask: async () => "y" });
  assert.deepEqual(r.files.sort(), [".scenlit/components/pr-card.html", ".scenlit/formats/teaser.json", ".scenlit/looks/chalk.json", ".scenlit/motion/zip.js"]);
  const q = project(root);
  assert.equal(q.config.looks.chalk.css, "body { filter: grayscale(1) }", "a look is read from its own file");
  assert.equal(q.config.formats.teaser.pace, 0.8, "and a kind of film");
  assert.match(ownMotion(q), /define\("cut", "zip"/, "and a motion piece");
  assert.ok(q.component("pr-card").endsWith("pr-card.html"));
  writeFileSync(join(q.dir, "components/pr-card.html"), "<div>mine now</div>");
  await assert.rejects(add(q, piece, { yes: true, log: () => {} }), /already in this project, and different: .scenlit\/components\/pr-card.html/);
  await add(q, piece, { yes: true, force: true, log: () => {} });
  assert.equal(readFileSync(join(q.dir, "components/pr-card.html"), "utf8"), "<div data-overlay>passed</div>");
  await assert.rejects(add(q, mkdtempSync(join(tmpdir(), "scenlit-empty-")), { yes: true, log: () => {} }), /nothing Scenlit can use/);
  const { share } = await import("../src/share.mjs");
  await assert.rejects(share(q, "look", "nowhere", { to: "http://127.0.0.1:9" }), /no look named "nowhere"/, "a piece that is not there is said so, folder or not");
  await assert.rejects(share(q, "motion", "inside", { to: "http://127.0.0.1:9" }), /put the piece in a file of its own/);
});

test("find says what each piece is and how a scene uses it, with a picture to look at", { timeout: 60_000 }, async () => {
  const { find } = await import("../src/find.mjs");
  const root = mkdtempSync(join(tmpdir(), "scenlit-find-"));
  init(root, quiet);
  mkdirSync(join(root, ".scenlit/components"), { recursive: true });
  writeFileSync(join(root, ".scenlit/components/invoice-mail.html"), '<!doctype html><html data-state="sent"><title>Invoice email</title><!-- An invoice arriving by email.\n  States: sent, paid --><style>[data-state="paid"] .x{}</style><b data-slot="customer">Acme</b><i data-slot="amount">$2,400</i></html>');
  mkdirSync(join(root, ".scenlit/motion"), { recursive: true });
  writeFileSync(join(root, ".scenlit/motion/zip.js"), '// A cut that zips across.\nscenlitMotion((define) => define("cut", "zip", () => {}));');
  const p = project(root);
  const pr = (await find(p, "pull request", { gallery: false })).results[0];
  assert.deepEqual([pr.where, pr.kind, pr.name], ["built-in", "component", "pull-request"]);
  assert.deepEqual(pr.states, ["running", "failed", "passed"]);
  assert.ok(pr.slots.some((x) => x.name === "title" && x.example) && pr.use[0].startsWith('await open("component:pull-request", { data: {'));
  const mine = (await find(p, "invoice", { gallery: false, pictures: true })).results[0];
  assert.deepEqual([mine.where, mine.name, mine.about, mine.states], ["yours", "invoice-mail", "An invoice arriving by email.", ["sent", "paid"]]);
  assert.deepEqual(mine.slots, [{ name: "customer", example: "Acme" }, { name: "amount", example: "$2,400" }]);
  assert.ok(existsSync(mine.picture) && mine.picture.endsWith(".png"), "a picture to look at");
  const cuts = (await find(p, "zip", { kind: "motion", gallery: false })).results;
  assert.deepEqual(cuts.map((r) => [r.where, r.name, r.use[0]]), [["yours", "zip", '"style": { "motion": { "cut": "zip" } }']]);
  assert.ok((await find(p, "", { kind: "sound", gallery: false })).results.some((r) => r.name === "ding" && r.about));
  assert.match((await find(p, "chat")).note ?? "", /no platform known/, "without a platform, it says the gallery was not searched");
});

test("check reads a scene without running it", async () => {
  const p = project(example("store")), o = await outline(await p.loadScene("checkout"));
  assert.deepEqual(o.shots, ["checkout", "paid"]);
  assert.equal(o.steps.filter((s) => s.kind === "act").length, 3);
  assert.deepEqual(await check(p), []);
});

test("the store replays with no model and makes a film, posts, screenshots and a guide", { timeout: 180_000 }, async () => {
  const p = project(example("store")), scene = await p.loadScene("checkout");
  const { capture, stats } = await runScene(p, scene, { ...quiet, strict: true });
  assert.equal(stats.model, 0);
  assert.equal(stats.replayed, 7);
  assert.ok(capture.shots.paid.crop.w > 100);
  assert.ok(existsSync(capture.shots.paid.png), "the plain screenshot");

  assert.ok(existsSync(writeFilm(p, scene)));
  const stills = await frames(p, "checkout", { count: 3 });
  for (const f of stills) assert.ok(readFileSync(f).length > 10_000, `${f} looks empty`);
  assert.equal((await writePosts(p, scene, quiet)).length, 6); // two posts, three sizes each
  const guide = readFileSync(await writeGuide(p, scene), "utf8");
  assert.match(guide, /Click \*\*Add Trail Mug to cart\*\*/);
  assert.match(guide, /Type in \*\*Email\*\*/);
});

test("a step that is not recorded fails in strict mode instead of calling a model", { timeout: 60_000 }, async () => {
  const p = project(example("store")), scene = await p.loadScene("checkout");
  const other = { ...scene, name: "unrecorded", run: async ({ open, act }) => { await open("/"); await act("add the Field Notebook to the cart"); } };
  await assert.rejects(runScene(p, other, { ...quiet, strict: true }), /is not recorded, and strict mode never calls a model/);
});

test("the dashboard: a scene signs in, another starts signed in on sample data", { timeout: 180_000 }, async () => {
  const p = project(example("dashboard"));
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  assert.ok(existsSync(p.session("member")), "the saved login");

  const scene = await p.loadScene("customers"), { capture, stats } = await runScene(p, scene, { ...quiet, strict: true });
  assert.equal(stats.model, 0);
  assert.deepEqual(capture.steps.map((s) => s.kind), ["zoom", "select", "label", "hover", "chapter", "act", "point", "click"]);
  assert.equal(capture.view.width, 1280);
  assert.ok(existsSync(join(p.root, "docs/img/overdue.png")), "the screenshot saved into the project");

  // the label's words reach the film
  writeFilm(p, scene);
  assert.match(readFileSync(join(p.output, "customers", "film.html"), "utf8"), /Two weeks late/);

  // the same scene in the marketing look: a smaller viewport, so bigger type
  const marketing = await runScene(p, scene, { ...quiet, strict: true, look: "marketing" });
  assert.equal(marketing.capture.view.width, 1120);
});

// ---- phases 2 and 3
import { rmSync } from "node:fs";
import { chromium } from "playwright-core";
import { record } from "../src/author.mjs";
import { totp } from "../src/totp.mjs";

test("sign-in codes match the standard's test values", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // "12345678901234567890"
  assert.equal(totp(secret, { at: 59_000, digits: 8 }), "94287082");
  assert.equal(totp(secret, { at: 1_111_111_109_000, digits: 8 }), "07081804");
  assert.match(totp(secret), /^\d{6}$/);
});

test("motion, a chapter and a carousel come out of the dashboard", { timeout: 240_000 }, async () => {
  const p = project(example("dashboard"));
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  const scene = await p.loadScene("customers"), { capture } = await runScene(p, scene, { ...quiet, strict: true });
  const opened = capture.steps.find((s) => s.kind === "act").actions[0];
  assert.ok(opened.motion.length >= 3, "the panel sliding in was recorded as frames");
  assert.equal(capture.steps.filter((s) => s.kind === "chapter").length, 1);

  const files = await writePosts(p, scene, quiet);
  assert.ok(files.some((f) => f.endsWith("carousels/tour.pdf")));
  assert.ok(readFileSync(files.find((f) => f.endsWith(".pdf"))).subarray(0, 4).toString() === "%PDF");
  writeFilm(p, scene);
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    // only the pictures in play are drawn: the first at the start, the last at the end, and never none in between
    const film = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await film.goto(`file://${join(p.output, "customers", "film.html")}?export`);
    await film.evaluate(() => window.__film.ready());
    const drawn = await film.evaluate(() => {
      const all = [...document.querySelectorAll(".shots > *")], seen = (e) => getComputedStyle(e).visibility === "visible", n = [];
      for (let ms = 0; ms <= window.__film.total; ms += 100) { window.__film.seek(ms); n.push(all.filter(seen).length); }
      return { all: all.length, n, last: seen(all.at(-1)) };
    });
    assert.ok(drawn.all > 5 && drawn.n[0] === 1 && drawn.n.at(-1) === 1 && drawn.last && Math.min(...drawn.n) === 1, JSON.stringify(drawn));
  } finally { await browser.close(); }
});

test("a phone look captures a phone-sized page in a phone frame", { timeout: 120_000 }, async () => {
  const p = project(example("dashboard")), { capture } = await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true, look: "phone" });
  assert.equal(capture.view.device, "phone");
  assert.ok(capture.view.width < 1100);
});

test("the recorder turns clicks and typing into a scene file", { timeout: 120_000 }, async () => {
  const p = project(example("store")), file = join(p.scenes, "recorded-test.scene.mjs");
  rmSync(file, { force: true });
  try {
    const r = await record(p, "recorded-test", { ...quiet, drive: async (page) => {
      await page.getByRole("button", { name: "Add Trail Mug to cart" }).click();
      await page.getByTestId("cart").click();
      await page.getByRole("button", { name: "Continue to payment" }).click();
      await page.getByLabel("Email").fill("ada@example.test");
      await page.getByLabel("Email").blur();
    } });
    const src = readFileSync(r.file, "utf8");
    assert.match(src, /await click\("Add Trail Mug to cart"\);/);
    assert.match(src, /await click\("Continue to payment"\);/);
    assert.match(src, /await fill\("Email", "ada@example.test"\);/);
  } finally { rmSync(file, { force: true }); }
});

// ---- style, vector pictures, the kit
import { writeKit } from "../src/kit.mjs";

test("style: the project's, then the format's, then the scene's own", async () => {
  const p = project(example("store")), scene = await p.loadScene("checkout");
  assert.equal(p.style(scene).pace, 1);
  assert.equal(p.style({ ...scene, format: "tutorial" }).pace, 1.25);
  assert.equal(p.style({ ...scene, format: "tutorial", style: { pace: 2, window: { bar: "light" } } }).pace, 2);
  assert.equal(p.style({ ...scene, style: { window: { bar: "light" } } }).window.radius, 14, "what a scene does not say stays");
  assert.throws(() => p.style({ format: "nope" }), /no format "nope"/);
});

test("pictures are vector, a styled film carries its style, and the kit holds vector pieces", { timeout: 240_000 }, async () => {
  const p = project(example("dashboard"));
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  const scene = await p.loadScene("customers"), { capture, stats } = await runScene(p, scene, { ...quiet, strict: true });
  assert.equal(stats.vector, stats.pictures, "every picture of the example freezes faithfully");
  const frozen = readFileSync(join(p.captures, "customers", Object.values(capture.vector)[0]), "utf8");
  assert.doesNotMatch(frozen, /<script(?![^>]*>for\(const e of document)/, "no script of the app is kept");
  assert.doesNotMatch(frozen, /Hartwell/, "the frozen page holds the sample data, not the real customers");

  const html = readFileSync(writeFilm(p, { ...scene, format: "tutorial", style: { background: { kind: "gradient", colors: ["#111111", "#333333"] }, end: { button: "Try it" } } }), "utf8");
  assert.match(html, /linear-gradient\(160deg, #111111, #333333\)/);
  assert.match(html, /"pace":1.25/);
  assert.match(html, /"button":"Try it"/);
  writeFilm(p, scene); // back to the scene's own style

  await writePosts(p, scene, quiet);
  const kit = await writeKit(p, quiet);
  assert.ok(kit.items.length >= 3);
  assert.equal(readFileSync(join(kit.dir, "customers", "customer.pdf")).subarray(0, 4).toString(), "%PDF");
});

// ---- for agents: inspect, components, states, the contact sheet, review notes
import { inspect, newComponent, review, sheet } from "../src/agent.mjs";

test("inspect lists a component's controls and states", { timeout: 60_000 }, async () => {
  const r = await inspect(project(example("dashboard")), { path: "component:pr-check" });
  assert.deepEqual(r.states, ["failed"]);
  assert.ok(r.controls.some((c) => c.role === "button" && c.name === "Merge pull request"));
  assert.ok(existsSync(r.picture));
});

test("a story across a component and the app: states, the window's address, no model", { timeout: 180_000 }, async () => {
  const p = project(example("dashboard"));
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  const scene = await p.loadScene("story"), { capture, stats } = await runScene(p, scene, { ...quiet, strict: true });
  assert.equal(stats.calls, 0);
  assert.deepEqual(capture.steps.map((s) => s.kind), ["state", "point", "select"]);
  assert.ok(Object.values(capture.hosts).every((h) => h.startsWith("git.example.com")), "pictures of the component carry its address");
  assert.ok(Object.keys(capture.hosts).length < new Set(capture.steps.flatMap((s) => s.actions.flatMap((a) => [a.before, a.after]))).size, "pictures of the app do not");
  writeFilm(p, scene);
  assert.deepEqual(review(p, scene), []);
  const s = await sheet(p, "story");
  assert.ok(readFileSync(s.file).length > 50_000);
});

test("review says what reads wrong", async () => {
  const p = project(example("dashboard")), scene = await p.loadScene("story");
  const long = { ...scene, posts: [{ name: "x", lead: "A very long first line that keeps going and going", key: "and a second line that is just as long as the first", shot: "checks-failed" }] };
  assert.ok(review(p, long).some((n) => /title is long/.test(n)));
});

test("review says when a film has no hook, no moment, and captions about clicks; a tutorial may say what to do", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scenlit-story-")); init(dir, quiet);
  const p = project(dir), { CAPTURE } = await import("../src/scene.mjs"), { mkdirSync } = await import("node:fs");
  const step = (kind, say) => ({ kind, text: "", say, actions: [] });
  mkdirSync(join(p.captures, "tour"), { recursive: true });
  writeFileSync(join(p.captures, "tour", "capture.json"), JSON.stringify({ v: CAPTURE, shots: {}, vector: {}, steps: [step("select", "Select Past due in the filter."), step("click", "Click Kestrel Robotics."), step("click", "1. Click Send reminder.")] }));
  const tour = { name: "tour", title: { lead: "", key: "tour", none: true } }, notes = review(p, tour);
  assert.ok(notes.some((n) => /opens straight in the app/.test(n)), notes.join("\n"));
  assert.ok(notes.some((n) => /nothing in the film stands out/.test(n)));
  assert.equal(notes.filter((n) => /says what was clicked/.test(n)).length, 3);
  assert.deepEqual(review(p, { ...tour, format: "tutorial" }).filter((n) => /stands out|says what was clicked/.test(n)), []);
});

test("every example scene is listed in the guide and reads as a scene", async () => {
  const { readdirSync } = await import("node:fs"), dir = fileURLToPath(new URL("../templates/examples/", import.meta.url));
  const guide = readFileSync(fileURLToPath(new URL("../templates/SKILL.md", import.meta.url)), "utf8"), names = readdirSync(dir).map((f) => f.replace(".scene.mjs", ""));
  assert.ok(names.length >= 5);
  for (const n of names) {
    assert.ok(guide.includes(`| \`${n}\` |`), `the guide's table lists ${n}`);
    const { steps } = await outline((await import(join(dir, `${n}.scene.mjs`))).default);
    assert.ok(steps.some((s) => s.kind === "open"), `${n} opens a page`);
  }
});

test("a new component comes with its contract", () => {
  const root = mkdtempSync(join(tmpdir(), "scenlit-comp-"));
  init(root, quiet);
  const file = newComponent(project(root), "chat-message"), src = readFileSync(file, "utf8");
  assert.match(src, /scenlit:host/);
  assert.match(src, /\[data-state="done"\]/);
  assert.throws(() => newComponent(project(root), "chat-message"), /exists already/);
});

// ---- third-party screens, thumbnails, voice providers, export presets, code integration
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dev } from "../src/dev.mjs";
import { exportFor } from "../src/export.mjs";
import { recordVoice } from "../src/voice.mjs";

test("the built-in screens are there without copying, filled from the scene", { timeout: 180_000 }, async () => {
  const p = project(example("dashboard"));
  assert.deepEqual(p.builtInComponents(), ["chat", "email", "issue", "notification", "phone", "pull-request", "terminal"]);
  const r = await inspect(p, { path: "component:chat" });
  assert.deepEqual(r.states, ["message", "thread"]);
  assert.ok(r.slots.some((x) => x.name === "text" && x.example));
  const scene = await p.loadScene("screens"), { capture, stats } = await runScene(p, scene, { ...quiet, strict: true });
  assert.equal(stats.calls, 0);
  assert.equal(stats.vector, stats.pictures);
  const frozen = Object.values(capture.vector).map((f) => readFileSync(join(p.captures, "screens", f), "utf8")).join("\n");
  assert.match(frozen, /1\.4 is not ready: the Past due filter shows no customers\./, "a slot was filled from the scene");
  assert.match(frozen, /3 customers are behind on payment/);
});

test("a scene is found anywhere in the project, TypeScript included, and a login can live elsewhere", async () => {
  const p = project(example("store"));
  assert.ok(p.sceneNames().includes("tote"), "app/features/tote.scene.ts");
  assert.match(p.sceneFiles().get("tote"), /app\/features\/tote\.scene\.ts$/);
  if (process.features?.typescript) assert.equal((await p.loadScene("tote")).title.key, "next to its feature.");
  const root = mkdtempSync(join(tmpdir(), "scenlit-sess-"));
  mkdirSync(join(root, ".scenlit"), { recursive: true });
  writeFileSync(join(root, ".scenlit/config.json"), JSON.stringify({ sessions: { member: "playwright/.auth/user.json" } }));
  assert.equal(project(root).session("member"), join(root, "playwright/.auth/user.json"));
  assert.equal(project(root).session("admin"), join(root, ".scenlit/sessions/admin.json"));
});

test("init adds the team's commands to package.json", () => {
  const root = mkdtempSync(join(tmpdir(), "scenlit-pkg-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "shop", scripts: { dev: "vite" } }));
  init(root, quiet);
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts.films, "scenlit run --all");
  assert.equal(pkg.scripts.dev, "vite");
  assert.match(readFileSync(join(root, ".scenlit/config.json"), "utf8"), /"\$schema": "\.\.\/node_modules\/scenlit\/schema\.json"/);
});

test("a thumbnail, a voice of your own with its own sentence, and an export for a place", { timeout: 300_000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), "scenlit-voice-"));
  init(root, quiet);
  // a stand-in voice: a tone as long as the line. The step's caption and its spoken sentence differ.
  writeFileSync(join(root, "voice.mjs"), `import { execFileSync } from "node:child_process";\nexport default async (text, { file }) => { execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=330:duration=" + (0.5 + text.length * 0.04).toFixed(2), file]); };\n`);
  writeFileSync(join(root, ".scenlit/config.json"), JSON.stringify({ voice: { provider: "./voice.mjs", says: { Scenlit: "Seen lit" } } }));
  writeFileSync(join(root, ".scenlit/scenes/first.scene.mjs"), `export default { title: { lead: "A terminal,", key: "narrated." }, end: { lead: "That", key: "is all." },
    async run({ open, state, see }) { await open("component:terminal"); await state("done", { say: { text: "It ran.", voice: "Scenlit ran the scene and wrote the film." } }); await see("done"); } };`);
  const p = project(root), scene = await p.loadScene("first"), { capture } = await runScene(p, scene, { ...quiet, strict: true });
  assert.equal(capture.steps[0].say, "It ran.");
  assert.equal(capture.steps[0].speak, "Scenlit ran the scene and wrote the film.");
  assert.equal(await recordVoice(p, capture, quiet), 1);
  const clips = JSON.parse(readFileSync(join(p.voice, "clips.json"), "utf8")), clip = Object.values(clips)[0];
  assert.equal(clip.line, "Scenlit ran the scene and wrote the film.");
  assert.ok(clip.ms > 1500, "as long as the spoken sentence, not the caption");
  assert.equal(await recordVoice(p, capture, quiet), 0, "a recorded line is not recorded again");

  writeFilm(p, scene);
  await writePosts(p, scene, quiet);
  assert.ok(existsSync(join(p.output, "first", "thumbnail.png")), "every scene gets a thumbnail");
  const out = await exportFor(p, scene, "youtube", quiet);
  assert.deepEqual(out.files.sort(), ["first.mp4", "first.srt", "first.vtt", "thumbnail.png", "transcript.txt"]);
  assert.match(readFileSync(join(out.dir, "first.srt"), "utf8"), /^1\n00:00:\d\d,\d{3} --> 00:00:\d\d,\d{3}\nIt ran\.\n/);
  const streams = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", join(out.dir, "first.mp4")]).toString();
  assert.match(streams, /video/); assert.match(streams, /audio/);
});

test("dev serves the film and tells the page to reload", { timeout: 60_000 }, async () => {
  const p = project(example("dashboard"));
  let runs = 0;
  const d = await dev(p, "story", async () => { runs++; }, { port: 4477, log: () => {} });
  try {
    const html = await (await fetch(d.url)).text();
    assert.match(html, /window\.FILM=/);
    assert.match(html, /new EventSource\("\/__scenlit"\)/);
    assert.equal((await fetch("http://localhost:4477/../../package.json")).status, 404, "nothing outside .scenlit is served");
    assert.equal(runs, 1);
  } finally { d.close(); }
});

// ---- motion you can extend
import { checkMotion, newMotion } from "../src/motion.mjs";

test("a project's own motion pieces and effects run in the film, and a missing one is named", { timeout: 180_000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), "scenlit-motion-"));
  init(root, quiet);
  const p = project(root);
  assert.match(readFileSync(newMotion(p), "utf8"), /define\("cut", "wipe"/);
  writeFileSync(join(root, ".scenlit/scenes/first.scene.mjs"), `export default { title: { lead: "Motion", key: "of our own." }, end: { lead: "That", key: "is all." },
    style: { motion: { cut: "wipe", click: "pulse", enter: "grow" } },
    async run({ open, state, effect, click, see }) { await open("component:issue"); await click("Assign to me"); await state("done"); await effect("stamp", { testid: "details" }, { text: "FIXED" }); await see("Done"); } };`);
  const scene = await p.loadScene("first"), { capture } = await runScene(p, scene, { ...quiet, strict: true });
  assert.equal(capture.steps.at(-1).actions[0].name, "stamp");
  const film = writeFilm(p, scene), browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`file://${film}?export`);
    await page.evaluate(() => window.__film.ready());
    const found = await page.evaluate(() => ({ pieces: window.__film.motion, stamp: document.querySelector(".stamp")?.textContent, rings: document.querySelectorAll(".ring").length }));
    assert.ok(found.pieces.cut.includes("wipe") && found.pieces.effect.includes("stamp"), "the project's pieces are registered");
    assert.equal(found.stamp, "FIXED", "the project's effect ran");
    assert.equal(found.rings, 2, "the pulse click draws two rings");
  } finally { await browser.close(); }

  assert.throws(() => checkMotion(p, { motion: { cut: "explode" } }, capture), /no cut motion named "explode"/);
  assert.throws(() => checkMotion(p, { motion: { warp: "x" } }, capture), /no family "warp"/);
  assert.throws(() => writeFilm(p, { ...scene, style: { motion: { enter: "teleport" } } }), /no enter motion named "teleport"/);
});

// ---- the film on a web page, with the player
import { writeWeb } from "../src/film.mjs";

test("the web export is a folder that holds everything and plays embedded", { timeout: 180_000 }, async () => {
  const p = project(example("dashboard"));
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  const scene = await p.loadScene("story");
  await runScene(p, scene, { ...quiet, strict: true });
  const web = writeWeb(p, scene), html = readFileSync(web.file, "utf8");
  assert.match(html, /"rel":"captures"/);
  assert.doesNotMatch(html, /\.\.\/\.\.\/captures/, "nothing reaches outside the folder");
  assert.match(readFileSync(join(web.dir, "embed.html"), "utf8"), /<iframe src=/);
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const missing = [];
    page.on("requestfailed", (r) => missing.push(r.url()));
    await page.goto(`file://${web.file}`);
    await page.evaluate(() => window.__film.ready());
    assert.deepEqual(missing, [], "every picture the film needs is in the folder");
    assert.equal(await page.evaluate(() => document.body.classList.contains("paused")), true, "it waits with a play button");
    await page.click("#big");
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => document.body.classList.contains("paused")), false, "a click plays it");
  } finally { await browser.close(); }
});

// ---- drawn looks
test("a drawn look restyles the app, filters its pictures and dresses the film", { timeout: 180_000 }, async () => {
  const p = project(example("dashboard"));
  assert.equal(p.style({}, "cartoon").window.shadow, "hard", "a look brings its own film style");
  assert.equal(p.style({ style: { window: { shadow: "soft" } } }, "cartoon").window.shadow, "soft", "and a scene still has the last word");
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  const scene = await p.loadScene("story"), { capture } = await runScene(p, scene, { ...quiet, strict: true, look: "sketch" });
  assert.equal(capture.look, "sketch");
  const frozen = readFileSync(join(p.captures, "story", Object.values(capture.vector)[0]), "utf8");
  assert.match(frozen, /html\{filter:url\(#nt-sketch\) grayscale\(1\)/, "the frozen page carries the look's filter itself");
  assert.match(frozen, /<filter id="nt-sketch"/);
  assert.match(readFileSync(writeFilm(p, scene), "utf8"), /\.win img\{filter:url\(#nt-sketch\)/, "screenshots get it from the film");
  await runScene(p, scene, { ...quiet, strict: true }); // back to the plain look for the tests that follow
});

test("an element of the app moves in the film, steps make sounds and keep their own time, and a kind of film is one word", { timeout: 180_000 }, async () => {
  const p = project(example("dashboard"));
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  const scene = await p.loadScene("numbers", { format: null }), { capture } = await runScene(p, scene, { ...quiet, strict: true });
  const moves = capture.steps.flatMap((s) => s.actions).filter((a) => a.do === "animate");
  assert.deepEqual(moves.map((a) => a.name), ["count", "rows"]);
  // the film opens on the marked picture, so the number is at its start from the moment the page shows
  assert.equal(capture.start, moves[0].before);
  const frozen = readFileSync(join(p.captures, "numbers", capture.vector[moves[1].before]), "utf8");
  assert.match(frozen, /data-scenlit-a="a0"/);
  assert.match(frozen, /data-scenlit-a="a1"/);

  // a page opened after a click is a new moment: marking something on it must not rewrite what the click showed
  const again = await runScene(p, { ...scene, name: "numbers-again", run: async ({ open, click, animate }) => { await open("/"); await click("Export CSV"); await open("/"); await animate({ testid: "mrr" }, "count"); } }, { ...quiet, strict: true });
  const [clicked, counted] = again.capture.steps.map((s) => s.actions[0]);
  assert.notEqual(clicked.after, counted.before, "the click still ends on its own picture");
  assert.equal(again.capture.start, clicked.before);

  // the sounds a film plays travel inside it: the style's (a tap on a click) and the steps' own
  writeFilm(p, scene);
  const file = join(p.output, "numbers", "film.html"), html = readFileSync(file, "utf8");
  for (const name of ["tap", "pop", "chime"]) assert.match(html, new RegExp(`"${name}":"data:audio/wav;base64,`));
  await assert.rejects(async () => writeFilm(p, { ...scene, style: { sounds: { click: "kazoo" } } }), /no sound named "kazoo"/);

  // where a sound plays: a step says when (start, result or end), how much later and how loud; the style gives one to a
  // kind of moment; a cue puts one at a moment of the film itself
  const placed = { ...scene, cues: [{ name: "rise", at: -3 }, { name: "thud", at: "end" }, { name: "notify", at: 2.5, volume: 0.4 }], style: { sounds: { click: "tap", exit: "swipe", title: "boom" } } };
  writeFilm(p, placed);
  for (const name of ["rise", "thud", "notify", "swipe", "boom"]) assert.match(readFileSync(file, "utf8"), new RegExp(`"${name}":"data:audio/wav;base64,`));
  await assert.rejects(async () => writeFilm(p, { ...scene, cues: [{ name: "rise", at: "later" }] }), /a cue is \{ name, at \}/);
  await assert.rejects(async () => writeFilm(p, { ...scene, cues: [{ name: "kazoo", at: 1 }] }), /no sound named "kazoo"/);
  {
    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      await page.goto(`file://${file}?export`);
      await page.evaluate(() => window.__film.ready());
      const f = await page.evaluate(() => ({ total: window.__film.total, sfx: window.__film.sfx.map((s) => ({ name: s.name, at: Math.round(s.at), vol: s.vol })) })), at = (name) => f.sfx.find((s) => s.name === name);
      assert.equal(at("boom").at, 0, "the title's own sound, as the film starts");
      assert.deepEqual(at("notify"), { name: "notify", at: 2500, vol: 0.4 });
      assert.ok(Math.abs(at("rise").at - (f.total - 3000)) < 2, "three seconds before the end");
      assert.ok(at("swipe").at < at("thud").at && at("thud").at < f.total, "the window leaves, then the end card lands");
    } finally { await browser.close(); }
  }
  writeFilm(p, scene);

  // a step's narration from the project's own recording: no voice provider, the clip measured and kept with the others
  {
    const own = join(p.output, "own-voice.wav");
    writeFileSync(own, (await import("../src/sounds.mjs")).sound(p, "chime").bytes);
    const said = { ...scene, name: "numbers-said", run: async ({ open, pause }) => { await open("/"); await pause(300, { say: { text: "Counted.", file: ".scenlit/output/own-voice.wav" } }); } };
    const { capture: spoken } = await runScene(p, said, { ...quiet, strict: true });
    assert.deepEqual([spoken.steps[0].say, spoken.steps[0].clip], ["Counted.", ".scenlit/output/own-voice.wav"]);
    writeFilm(p, said);
    const clips = JSON.parse(readFileSync(join(p.output, "numbers-said", "film.html"), "utf8").match(/"clips":(\{.*?\}\})/)[1]), clip = clips["file:.scenlit/output/own-voice.wav"];
    assert.ok(clip.file.startsWith("own-") && Math.abs(clip.ms - 900) < 30, JSON.stringify(clip));
    assert.ok(existsSync(join(p.voice, clip.file)), "the recording, beside the other clips");
    await assert.rejects(async () => { const gone = { ...said, name: "numbers-gone", run: async ({ open, pause }) => { await open("/"); await pause(300, { say: { file: "nope.mp3" } }); } }; await runScene(p, gone, { ...quiet, strict: true }); writeFilm(p, gone); }, /no recording at "nope.mp3"/);
  }
  // a recording of another shape is not guessed at
  {
    const file = join(p.captures, "numbers-said", "capture.json"), was = readFileSync(file, "utf8");
    writeFileSync(file, was.replace('"v": 1', '"v": 0'));
    assert.throws(() => writeFilm(p, { ...scene, name: "numbers-said" }), /recorded by an earlier version of Scenlit.*scenlit run numbers-said/s);
    writeFileSync(file, was);
  }

  // music under one film: a built-in bed, written out once, with the scene's own volume and start; a missing track is said
  writeFilm(p, { ...scene, style: { music: { file: "calm", volume: 0.3, start: 2 } } });
  assert.match(readFileSync(file, "utf8"), /"music":\{"file":"[^"]*_music\/calm\.wav","volume":0\.3,"start":2,"fadeIn":0\.6,"fadeOut":1\.5,"duck":0\.45,"loop":true,"bpm":100,"cuts":false\}/);
  assert.ok(existsSync(join(p.output, "_music", "calm.wav")), "the bed, as a file");
  await assert.rejects(async () => writeFilm(p, { ...scene, style: { music: { file: "assets/nope.mp3" } } }), /no music at "assets\/nope.mp3"/);
  writeFilm(p, scene);

  // in a browser: the sounds are on the clock, and the number is part of the way there in the middle of its count
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`file://${file}?export`);
    await page.evaluate(() => window.__film.ready());
    const film = await page.evaluate(() => ({ sfx: window.__film.sfx.map((s) => s.name), from: window.__film.steps[0].from, total: window.__film.total, took: window.__film.steps.map((s) => s.to - s.from), mark: document.querySelector(".ff")?.textContent }));
    assert.deepEqual(film.sfx, ["pop", "ding", "tap", "tap", "tap", "chime"]);
    const shown = async (at) => { await page.evaluate((t) => window.__film.seek(t), at); return page.evaluate(() => [...document.querySelectorAll("iframe")].map((f) => f.contentDocument?.querySelector('[data-scenlit-a="a0"]')?.textContent).find(Boolean)); };
    const mid = await shown(film.from + 700), done = await shown(film.from + 4000);
    assert.match(done, /^\$[\d,]+$/);
    assert.notEqual(mid, done, "the number is still counting");

    // time: the two fast-forwarded steps are over quickly and carry a mark; the last step stays 1.5 s longer
    assert.deepEqual(capture.steps.map((s) => s.fast ?? 1), [1, 1, 4, 4, 1]);
    assert.equal(film.mark, "4×");
    assert.ok(film.took[2] < 1200 && film.took[3] < 1200, `fast steps took ${film.took[2]} and ${film.took[3]} ms`);
    assert.equal(capture.steps.at(-1).hold, 1500);

    // a length to fit: the pace is worked out so that the film takes the seconds the scene asks for
    writeFilm(p, { ...scene, length: 14 });
    await page.goto(`file://${file}?export`);
    await page.evaluate(() => window.__film.ready());
    const fitted = await page.evaluate(() => ({ total: window.__film.total, tempo: window.__film.tempo }));
    assert.ok(Math.abs(fitted.total - 14000) < 300, `asked for 14 s, got ${Math.round(fitted.total)} ms (the film is ${Math.round(film.total)} ms at its own pace)`);
    assert.notEqual(fitted.tempo, 1);
    writeFilm(p, scene);
  } finally { await browser.close(); }

  // a kind of film is one word: it brings its style, and when it needs them a look and a frame shape
  const short = await p.loadScene("numbers", { format: "short" });
  assert.equal(short.look, "phone");
  assert.equal(short.shape, "vertical");
  assert.equal(p.style(short).captions.look, "bold");
  assert.equal(p.style(short).brand.accent, "#ffe14d");
  await assert.rejects(() => p.loadScene("numbers", { format: "nope" }), /no format "nope"/);
});

test("a staged film: a piece alone on the stage, sentences as scenes, a screen that builds, a window in space, a finish", { timeout: 180_000 }, async () => {
  const p = project(example("dashboard"));
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  const scene = await p.loadScene("staged", { format: null }), { capture } = await runScene(p, scene, { ...quiet, strict: true });
  assert.deepEqual(capture.steps.map((s) => s.kind), ["words", "piece", "animate", "words", "point"]);
  const piece = capture.steps[1].actions[0];
  assert.equal(piece.name, "count");
  assert.equal(piece.parts[0].pad, 18, "a bare number gets room around it");
  assert.deepEqual(capture.steps[3].words, { text: "One table answers it.", phrases: ["One table answers it."], highlight: [], big: [], beside: true, motion: "rise" });

  writeFilm(p, scene);
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`file://${join(p.output, "staged", "film.html")}?export`);
    await page.evaluate(() => window.__film.ready());
    const at = async (ms) => { await page.evaluate((t) => window.__film.seek(t), ms); return page.evaluate(() => {
      const css = (q, prop) => { const e = document.querySelector(q); return e ? getComputedStyle(e)[prop] : null; };
      return { piece: +css(".piece", "opacity"), win: +css(".win", "opacity"), rig: css(".rig", "scale"), turn: css(".rig", "transform"), number: document.querySelector(".piece iframe")?.contentDocument?.querySelector('[data-scenlit-a="a0"]')?.textContent ?? null };
    }); };
    const made = await page.evaluate(() => ({ steps: window.__film.steps, pieces: document.querySelectorAll(".piece").length, says: document.querySelectorAll(".say").length, beside: document.querySelectorAll(".say.beside").length,
      set: [".light", ".grain", ".vig"].map((q) => !!document.querySelector(q)), hi: document.querySelector(".say .hi")?.textContent, perspective: document.querySelector("#stage").style.perspective }));
    assert.deepEqual([made.pieces, made.says, made.beside], [1, 2, 1]);
    assert.deepEqual(made.set, [true, true, true], "the light, the grain and the darker corners");
    assert.equal(made.hi, "behind");
    assert.equal(made.perspective, "2600px");

    // the piece is alone on the stage while its number counts; the window is away
    const mid = await at(made.steps[1].from + 1500), done = await at(made.steps[1].to - 400);
    assert.ok(mid.piece > 0.9 && mid.win < 0.1, `piece ${mid.piece}, window ${mid.win}`);
    assert.match(done.number, /^\$[\d,]+$/);
    assert.notEqual(mid.number, done.number, "the number is still counting");
    // beside a sentence the window steps aside, smaller; and it is turned in space all the way through
    const beside = await at(made.steps[3].from + 1300);
    assert.equal(beside.rig, "0.6");
    assert.notEqual(beside.turn, "none");
    // what is pointed at stays sharp, the rest goes soft: four panels straight in the view (inside a wrapper that
    // fades, the blur would see nothing behind it)
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".soft")].map((e) => e.parentElement.className)), ["view", "view", "view", "view"]);
  } finally { await browser.close(); }
});

test("a component is laid over the film while the steps under it carry on", { timeout: 120_000 }, async () => {
  const p = project(example("dashboard"));
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  const base = await p.loadScene("numbers", { format: null });
  const scene = { ...base, name: "numbers-over", run: async ({ open, overlay, click }) => {
    await open("/");
    await overlay("component:notification?tone=dark", { at: "right top", sound: "notify", data: { app: "Ledgerly", title: "Initech is late" } });
    await click("Export CSV", { say: "The app carries on under it." });
    await overlay("component:phone", { at: "right", for: 1500, wait: true, data: { title: "Paid" } });
  } };
  const { capture } = await runScene(p, scene, { ...quiet, strict: true });
  const [note, , phone] = capture.steps;
  assert.deepEqual([note.kind, note.overlay.at, note.overlay.wait, phone.overlay.at, phone.overlay.wait], ["overlay", "right top", false, "right", true]);
  assert.ok(existsSync(join(p.captures, "numbers-over", note.overlay.file)), "the component's picture");
  assert.ok(phone.overlay.h > note.overlay.h * 3, "only the marked element is cut out, with room for its shadow");
  await assert.rejects(() => runScene(p, { ...scene, name: "numbers-nowhere", run: async ({ open, overlay }) => { await open("/"); await overlay("component:phone", { at: "somewhere" }); } }, { ...quiet, strict: true }), /overlay: at is one of/);
  await assert.rejects(() => runScene(p, { ...scene, name: "numbers-nowhere", run: async ({ open, overlay }) => { await open("/"); await overlay("/reports"); } }, { ...quiet, strict: true }), /overlay shows a component/);

  writeFilm(p, scene);
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`file://${join(p.output, "numbers-over", "film.html")}?export`);
    await page.evaluate(() => window.__film.ready());
    const f = await page.evaluate(() => ({ took: window.__film.steps.map((s) => s.to - s.from), from: window.__film.steps.map((s) => s.from), sfx: window.__film.sfx.map((s) => s.name), overs: document.querySelectorAll("img.over").length }));
    assert.equal(f.overs, 2);
    assert.equal(f.from[0], f.from[1], "the next step starts at the same moment: the notification does not hold the film");
    assert.ok(f.took[2] >= 1500, `an overlay told to wait holds the film for as long as it stays (${f.took[2]} ms)`);
    assert.equal(f.sfx[0], "notify");
    // while the click happens, the notification is over it, at the top right
    await page.evaluate((t) => window.__film.seek(t), f.from[1] + 900);
    const seen = await page.evaluate(() => { const e = document.querySelector("img.over"), r = e.getBoundingClientRect(); return { shown: +getComputedStyle(e).opacity, right: r.right > innerWidth * 0.85, top: r.top < innerHeight * 0.2 }; });
    assert.deepEqual(seen, { shown: 1, right: true, top: true });
  } finally { await browser.close(); }
});

test("steps start together, and a presenter's recording stays in step with the film", { timeout: 180_000 }, async () => {
  const p = project(example("dashboard"));
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  const base = await p.loadScene("numbers", { format: null }), { execFileSync } = await import("node:child_process");
  // a short recording to stand in for a person: a moving pattern with a tone
  const me = join(p.output, "me.mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=240x240:rate=30:duration=4", "-f", "lavfi", "-i", "sine=frequency=330:duration=4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", me]);
  const scene = { ...base, name: "numbers-together", presenter: { file: ".scenlit/output/me.mp4", at: "top left", start: 0.5 }, run: async ({ open, together, animate, overlay }) => {
    await open("/");
    await together(async () => {
      await animate({ testid: "mrr" }, "count", { ms: 1500 });
      await animate({ selector: "table" }, "rows", { ms: 1500 });
      await overlay("component:notification", { sound: "notify", data: { title: "Paid" } });
    }, { stagger: 200, say: "All of it at once.", sound: "pop" });
  } };
  const { capture } = await runScene(p, scene, { ...quiet, strict: true });
  assert.deepEqual(capture.steps.map((s) => s.together), [{ id: 0, n: 0, lag: 0 }, { id: 0, n: 1, lag: 200 }, { id: 0, n: 2, lag: 400 }]);
  assert.deepEqual([capture.steps[0].say, capture.steps[0].sound[0].at], ["All of it at once.", "start"]);
  await assert.rejects(() => runScene(p, { ...scene, name: "numbers-apart", run: async ({ open, together, click }) => { await open("/"); await together(async () => { await click("Export CSV"); }); } }, { ...quiet, strict: true }), /"click" cannot run together/);
  await assert.rejects(async () => writeFilm(p, { ...scene, presenter: "nobody.mp4" }), /no presenter recording at "nobody.mp4"/);

  writeFilm(p, scene);
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`file://${join(p.output, "numbers-together", "film.html")}?export`);
    await page.evaluate(() => window.__film.ready());
    const f = await page.evaluate(() => ({ steps: window.__film.steps, me: window.__film.presenter, still: window.__film.still, sfx: Object.fromEntries(window.__film.sfx.map((x) => [x.name, x.at])) }));
    // the second and third start 200 ms apart, while the first is still going
    assert.ok(Math.abs(f.steps[2].from - f.steps[1].from - 200) < 1 && f.steps[1].from < f.steps[0].to, JSON.stringify(f.steps));
    assert.equal(f.still, 0);
    // the group's sound plays as the group begins; the notification's own, as the notification comes in
    assert.ok(Math.abs(f.sfx.pop - (f.steps[1].from - 200)) < 1 && Math.abs(f.sfx.notify - (f.steps[2].from + 150)) < 1, JSON.stringify(f.sfx));
    assert.deepEqual([f.me.at, f.me.round, f.me.sound, Math.round(f.me.ms / 1000)], ["left top", true, true, 4]);
    // a picture of the film waits until the recording has reached that moment
    await page.evaluate(() => window.__film.frame(2000));
    const at = await page.evaluate(() => { const v = document.querySelector("video.me"), r = v.getBoundingClientRect(); return { time: v.currentTime, left: r.left < innerWidth * 0.1, top: r.top < innerHeight * 0.1, round: getComputedStyle(v).borderRadius }; });
    assert.ok(Math.abs(at.time - 2.5) < 0.05, `the recording is at ${at.time}s`);
    assert.deepEqual([at.left, at.top, at.round], [true, true, "50%"]);
  } finally { await browser.close(); }
});


test("what a scene makes is kept where the project wants it", { timeout: 180_000 }, async () => {
  const p = project(example("dashboard")), to = mkdtempSync(join(tmpdir(), "scenlit-kept-"));
  const { checkSave, copyTo, saveRun, saveVideo } = await import("../src/save.mjs");
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  const base = await p.loadScene("numbers", { format: null });
  const scene = { ...base, name: "numbers-kept", save: { film: `${to}/films/{scene}`, guide: `${to}/guide/how.md`, video: `${to}/video/{scene}-{shape}.mp4` },
    run: async ({ open, click }) => { await open("/"); await click("Export CSV", { say: "One click exports them." }); } };
  await runScene(p, scene, { ...quiet, strict: true });
  writeFilm(p, scene); await writeGuide(p, scene);
  const kept = await saveRun(p, scene);
  assert.deepEqual(kept.map((f) => f.slice(to.length + 1)).sort(), ["films/numbers-kept", "guide/how.md"]);
  assert.ok(existsSync(join(to, "films/numbers-kept/index.html")) && existsSync(join(to, "films/numbers-kept/captures")), "the film's folder holds its player and its pictures");
  const pic = /\]\((guide\/[^)]+)\)/.exec(readFileSync(join(to, "guide/how.md"), "utf8"))[1];
  assert.ok(existsSync(join(to, "guide", pic)), "the guide's pictures are where its lines look for them");
  // the MP4 goes to its place when it is exported, its captions beside it (here a stand-in for the export)
  const out = join(p.output, "numbers-kept");
  writeFileSync(join(out, "numbers-kept-square.mp4"), "mp4"); writeFileSync(join(out, "numbers-kept.vtt"), "WEBVTT\n");
  assert.equal(saveVideo(p, scene, join(out, "numbers-kept-square.mp4"), "square"), join(to, "video/numbers-kept-square.mp4"));
  assert.ok(existsSync(join(to, "video/numbers-kept-square.vtt")));
  assert.equal(saveVideo(p, { ...scene, save: { video: `${to}/one.mp4` } }, join(out, "numbers-kept-square.mp4"), "square"), null, "one place is for the scene's own shape");
  // a file goes to a file, or into a folder
  assert.equal(copyTo(p, join(out, "film.html"), `${to}/pages/`), join(to, "pages/film.html"));
  assert.throws(() => checkSave({ movie: "x" }, "scene"), /save has no "movie" \(film, video/);
  assert.throws(() => checkSave({ film: "public/film.html" }, "scene"), /save\.film is a folder/);
});

test("the player is the project's own, and a film can stop for the viewer, mark a link and show a button", { timeout: 180_000 }, async () => {
  const p = project(example("dashboard"));
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  const base = await p.loadScene("numbers", { format: null });
  const scene = { ...base, name: "numbers-hands", style: { player: { controls: ["play", "scrub", "time", "captions", "speed", "chapters"], accent: "#3366ff", poster: 3 } }, run: async ({ open, select, chapter, link, button }) => {
    await open("/");
    await select("Status", "Past due", { say: "Choose who is behind.", byViewer: true });
    await chapter("Then", "take them with you.");
    await link("Export CSV", "https://example.com/docs/export", { say: "The docs are one click away." });
    await button("Try it", "/start", { at: "bottom right", for: 900, wait: true });
  } };
  const { capture } = await runScene(p, scene, { ...quiet, strict: true });
  const [pick, , out, cta] = capture.steps;
  assert.deepEqual([pick.byViewer, out.actions[0].do, out.actions[0].href, cta.button], [true, "link", "https://example.com/docs/export", { text: "Try it", href: "/start", at: "bottom right", for: 900, wait: true }]);
  const bad = (run, why) => assert.rejects(() => runScene(p, { ...scene, name: "numbers-not", run }, { ...quiet, strict: true }), why);
  await bad(async ({ open, point }) => { await open("/"); await point("Export CSV", { byViewer: true }); }, /"point" has no place for the viewer to click/);
  await bad(async ({ open, link }) => { await open("/"); await link("Export CSV", "javascript:alert(1)"); }, /link: it leads to a web address/);
  assert.throws(() => p.style({ style: { player: { controls: ["play", "rewind"] } } }), /the player has no control "rewind"/);

  const file = writeFilm(p, scene), browser = await launch();
  try {
    // as an export sees it: straight through, no player, nothing marked
    const still = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await still.goto(`file://${file}?export`);
    await still.evaluate(() => window.__film.ready());
    const plain = await still.evaluate(() => ({ total: window.__film.total, asks: window.__film.asks.map((a) => a.step), chapters: window.__film.chapters.map((c) => c.text), bar: !!document.querySelector("#bar"), marked: document.querySelectorAll(".spot.on").length }));
    assert.deepEqual([plain.asks, plain.chapters, plain.bar, plain.marked], [[0, 3], ["Then take them with you."], false, 0]);
    // a click-through demo (?tour): with no byViewer at all, the film stops at each step that has a place to click
    const plainScene = { ...base, name: "numbers-tour", run: async ({ open, select, see }) => { await open("/"); await select("Status", "Past due", { say: "Choose who is behind." }); await see("Past due"); } };
    await runScene(p, plainScene, { ...quiet, strict: true });
    const tourFile = writeFilm(p, plainScene), asks = async (q) => { const t = await browser.newPage(); await t.goto(`file://${tourFile}?export${q}`); await t.evaluate(() => window.__film.ready()); return t.evaluate(() => window.__film.asks.map((a) => a.step)); };
    assert.deepEqual([await asks(""), await asks("&tour")], [[], [0]]);

    // in the player: the project's controls and colour, and the film resting on its poster
    const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
    await page.goto(`file://${file}`);
    await page.evaluate(() => window.__film.ready());
    const state = () => page.evaluate(() => ({ playing: window.__film.playing(), asking: window.__film.asking(), play: document.querySelector("#pp").getAttribute("aria-label"), time: document.querySelector("#time").textContent.split(" ")[0], marked: document.querySelectorAll(".spot.on").length }));
    assert.deepEqual(await page.evaluate(() => [[...document.querySelectorAll("#bar button, #track, #time")].map((e) => e.id), getComputedStyle(document.documentElement).getPropertyValue("--player").trim(), window.__film.total]), [["track", "pp", "time", "cc", "rate", "chap"], "#3366ff", plain.total]); // the bar on top, the buttons under it
    assert.deepEqual(await state(), { playing: false, asking: null, play: "Play", time: "0:03", marked: 0 });
    for (let i = 0; i < 3; i++) await page.click("#rate");
    assert.equal(await page.textContent("#rate"), "2×");
    // it plays from the start and stops for the viewer, with the place marked; their click takes it on
    await page.click("#pp");
    await page.waitForFunction(() => window.__film.asking() === 0);
    assert.deepEqual([(await state()).play, (await state()).marked, await page.evaluate(() => document.querySelector("#pp svg") !== null)], ["Continue", 1, true]);
    await page.click(".spot.on");
    await page.waitForFunction(() => window.__film.playing());
    // something of the app is a link while its step lasts
    await page.waitForFunction(() => { const a = document.querySelector("a.hot"), c = getComputedStyle(a); return c.visibility === "visible" && +c.opacity > 0.9; });
    assert.equal(await page.evaluate(() => document.querySelector("a.hot").href), "https://example.com/docs/export");
    // the film stops on a button that waits; the space bar takes it on
    await page.waitForFunction(() => window.__film.asking() === 3);
    assert.deepEqual(await page.evaluate(() => { const a = document.querySelector("a.cta"); return [a.textContent, a.getAttribute("href"), getComputedStyle(a).visibility]; }), ["Try it", "/start", "visible"]);
    await page.keyboard.press("Space");
    await page.waitForFunction(() => window.__film.playing());
    // captions off for this viewer, and a jump to a chapter
    await page.click("#cc");
    assert.ok(await page.evaluate(() => document.querySelector("#stage").classList.contains("nocap")));
    await page.click("#chap");
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#chapters button")].map((b) => b.textContent.replace(/^\S+\s+/, ""))), [`${scene.title.lead} ${scene.title.key}`, "Then take them with you."]);
    await page.click("#chapters button:nth-child(2)");
    const mark = await page.evaluate(() => window.__film.chapters[0].at);
    await page.click("#pp");
    const now = await page.evaluate(() => +document.querySelector("#time").textContent.split(":")[1].slice(0, 2));
    assert.ok(Math.abs(now - Math.floor(mark / 1000)) <= 2, `after the jump the film is at ${now}s, the chapter at ${mark}ms`);
    // the chapter is marked on the bar: the pointer over it names it, a click near it lands on it, one elsewhere goes where it was put
    assert.throws(() => p.style({ style: { player: { marks: "every" } } }), /the player's marks are/);
    const bar = await page.evaluate(() => { const t = [...document.querySelectorAll("#track .seg")].map((e) => e.getBoundingClientRect()), s = document.querySelector("#track").getBoundingClientRect(); return { pieces: t.length, x: t[0].right + 1.5, y: s.y + s.height / 2, left: s.x }; });
    assert.equal(bar.pieces, 2, "the bar is cut at the chapter");
    await page.mouse.move(bar.x + 3, bar.y);
    assert.match(await page.textContent("#tip"), /^0:\d\d {2}Then take them with you\.$/);
    await page.mouse.click(bar.left + 40, bar.y);
    const early = await page.evaluate(() => +document.querySelector("#scrub").value);
    assert.ok(early > 0 && early < mark - 1000, `a click near the start of the bar put the film at ${early}ms`);
    await page.mouse.click(bar.x + 4, bar.y);
    assert.equal(await page.evaluate(() => +document.querySelector("#scrub").value), Math.round(mark));
  } finally { await browser.close(); }
});

test("card() is the opening, a chapter or the end, by where it is said", async () => {
  const { placeCards } = await import("../src/cards.mjs");
  const step = (kind, extra = {}) => ({ kind, text: "", actions: [], ...extra });
  const card = (key, extra = {}) => step("card", { card: { lead: "A", key }, ...extra });
  let cards = {}, steps = placeCards([step("background"), card("first"), step("click"), card("middle"), step("click"), step("background"), card("last", { card: { lead: "A", key: "last", button: "Try" } })], cards);
  assert.deepEqual(cards, { title: { lead: "A", key: "first" }, end: { lead: "A", key: "last", button: "Try" } });
  assert.deepEqual(steps.map((s) => s.kind), ["background", "click", "chapter", "click", "background"]);
  // after the app has opened, a card is no longer the opening one; a scene can have no cards at all
  cards = {}; steps = placeCards([card("after open", { opened: true }), step("click")], cards);
  assert.deepEqual([cards, steps.map((s) => s.kind)], [{}, ["chapter", "click"]]);
  // title() said it already: the first card is a chapter
  cards = { title: { lead: "T", key: "said" } }; placeCards([card("x"), step("click")], cards);
  assert.equal(cards.title.key, "said");
});

test("a model behind any OpenAI- or Anthropic-compatible API", async () => {
  const { createServer } = await import("node:http"), { ask, keyOf } = await import("../src/model.mjs");
  const seen = [];
  const server = createServer((req, res) => {
    let body = ""; req.on("data", (d) => (body += d)); req.on("end", () => {
      seen.push({ path: req.url, auth: req.headers.authorization ?? null, xkey: req.headers["x-api-key"] ?? null, body: JSON.parse(body || "{}") });
      res.setHeader("content-type", "application/json");
      if (req.url === "/v1/chat/completions") return res.end(JSON.stringify({ choices: [{ message: { content: '{"actions":[]}' } }] }));
      if (req.url === "/v1/messages") return res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text: "hello" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }));
      res.statusCode = 404; res.end("{}");
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/v1`;
  try {
    // a local server: no key needed; the model and the words go as OpenAI's chat completions
    assert.equal(await ask("hi", { provider: "openai", url, model: "qwen3" }), '{"actions":[]}');
    assert.deepEqual([seen[0].path, seen[0].auth, seen[0].body.model, seen[0].body.messages[0].content], ["/v1/chat/completions", null, "qwen3", "hi"]);
    // a key from the variable `key` names
    process.env.SCENLIT_TEST_KEY = "secret-1";
    await ask("hi", { provider: "openai", url, key: "SCENLIT_TEST_KEY", model: "m" });
    assert.equal(seen[1].auth, "Bearer secret-1");
    // the key itself in the file is refused; a remote API without a key says which variable to set
    assert.throws(() => keyOf({ provider: "openai", key: "sk-proj-abc123" }), /names the environment variable/);
    await assert.rejects(ask("hi", { provider: "openai", url: "https://api.example.invalid/v1", key: "SCENLIT_NO_SUCH_KEY", model: "m" }), /set SCENLIT_NO_SUCH_KEY/);
    await assert.rejects(ask("hi", { provider: "openai", url }), /needs a model/);
    await assert.rejects(ask("hi", { provider: "gemini" }), /"model.provider" is claude-code, anthropic, openai/);
    // an API that speaks Anthropic's messages, through the SDK (when it is installed)
    if (await import("@anthropic-ai/sdk").then(() => true, () => false)) {
      assert.equal(await ask("hi", { provider: "anthropic", url: url.replace(/\/v1$/, ""), key: "SCENLIT_TEST_KEY", model: "some-model" }), "hello");
      const last = seen.at(-1); // the key goes as x-api-key or, from SDK 1.0 on, as a bearer token
      assert.deepEqual([last.path, last.xkey === "secret-1" || last.auth === "Bearer secret-1", last.body.model], ["/v1/messages", true, "some-model"]);
    }
  } finally { server.close(); delete process.env.SCENLIT_TEST_KEY; }
});

test("a step waits for a control that shows up late, and says how long it waited when it never does", { timeout: 120_000 }, async () => {
  const p = project(example("dashboard")), file = join(p.dir, "components", "late-button.html");
  writeFileSync(file, `<!doctype html><html><body style="margin:0;background:#fff;font:20px sans-serif"><main id="m" style="padding:40px"><p>Loading</p><button disabled>Send</button></main>
<script>setTimeout(() => { document.querySelector("#m").insertAdjacentHTML("beforeend", "<button>Ready now</button>"); document.querySelector("button").disabled = false; }, 1500)</script></body></html>`);
  try {
    const base = await p.loadScene("story"), late = { ...base, name: "late-button", run: async ({ open, click }) => { await open("component:late-button"); await click("Ready now"); await click("Send"); } };
    const { capture } = await runScene(p, late, { ...quiet, strict: true });
    assert.deepEqual(capture.steps.map((s) => s.kind), ["click", "click"]);
    const t0 = Date.now();
    await assert.rejects(() => runScene(p, { ...late, name: "late-never", run: async ({ open, click }) => { await open("component:late-button"); await click("Never there"); } }, { ...quiet, strict: true }), /"Never there" is not on the page \(waited 5 s\)/);
    assert.ok(Date.now() - t0 >= 5000);
  } finally { rm(file, { force: true }); }
});

test("a page opened and then only looked at is still shown, and not twice when a step acts on it", { timeout: 120_000 }, async () => {
  const p = project(example("dashboard"));
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  const base = await p.loadScene("story");
  const looked = { ...base, name: "opened-looked", run: async ({ open, select, see, card }) => { await open("/"); await select("Status", "Past due"); await open("component:pr-check"); await see("Release check"); await card("Found", "before release."); } };
  const { capture } = await runScene(p, looked, { ...quiet, strict: true });
  assert.deepEqual(capture.steps.map((s) => s.kind), ["select", "cut"]);
  assert.notEqual(capture.steps[1].actions[0].after, capture.steps[0].actions[0].after, "the cut shows the opened page");
  const acted = { ...base, name: "opened-acted", run: async ({ open, select, state }) => { await open("/"); await select("Status", "Past due"); await open("component:pr-check"); await state("failed"); } };
  assert.deepEqual((await runScene(p, acted, { ...quiet, strict: true })).capture.steps.map((s) => s.kind), ["select", "state"]);
});

test("moving type and marks: phrases swap, letters move, a mark draws itself only in its moment", { timeout: 180_000 }, async () => {
  const p = project(example("dashboard"));
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  const base = await p.loadScene("story");
  const scene = { ...base, name: "typed", run: async ({ words, open, mark }) => {
    await words(["Who owes you", "money?"], { motion: "letters", highlight: "money?", sweep: true, tag: "today", for: 600 });
    await words("Not anymore.", { motion: "bounce", big: "anymore.", stroke: true });
    await open("/");
    await mark("circle", { testid: "mrr" });
    await mark("stroke");
  } };
  const { capture } = await runScene(p, scene, { ...quiet, strict: true });
  assert.deepEqual(capture.steps.map((x) => x.kind), ["words", "words", "mark", "mark"]);
  assert.deepEqual(capture.steps[0].words.phrases, ["Who owes you", "money?"]);
  assert.ok(capture.steps[2].actions[0].box && !capture.steps[3].actions[0].box);
  const bad = (run, why) => assert.rejects(() => runScene(p, { ...scene, name: "typed-bad", run }, { ...quiet, strict: true }), why);
  await bad(async ({ words }) => { await words("Hi", { motion: "spin" }); }, /motion is one of/);
  await bad(async ({ open, mark }) => { await open("/"); await mark("circle"); }, /goes on something/);

  const browser = await launch();
  try {
    const film = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await film.goto(`file://${writeFilm(p, scene)}?export`);
    await film.evaluate(() => window.__film.ready());
    const at = (ms) => film.evaluate((ms) => { window.__film.seek(ms); const m = document.querySelector(".mk:not(.across)"), path = m.querySelector("path"); return { mark: +getComputedStyle(m).opacity, drawn: getComputedStyle(path).strokeDashoffset, letters: document.querySelectorAll(".say .l").length, phrases: document.querySelectorAll(".say").length }; }, ms);
    const first = await at(0), end = await film.evaluate(() => window.__film.total);
    assert.equal(first.mark, 0, "a mark is not seen before its moment");
    assert.equal(first.phrases, 3, "each phrase is its own scene");
    assert.ok(first.letters > 20, "letters move one by one");
    const drawnAt = await film.evaluate(() => { for (let ms = 0; ms < window.__film.total; ms += 100) { window.__film.seek(ms); const path = document.querySelector(".mk:not(.across) path"); if (getComputedStyle(path).strokeDashoffset === "0px") return ms; } return -1; });
    assert.ok(drawnAt > 3000 && drawnAt < end, `the circle is drawn at ${drawnAt}ms`);
  } finally { await browser.close(); }
});

test("a film can show its own scene file, the playing line lit; words stack as lines or stand on a colour field", { timeout: 180_000 }, async () => {
  const p = project(example("dashboard"));
  await runScene(p, await p.loadScene("signin"), { ...quiet, strict: true });
  const story = await p.loadScene("story"), { capture } = await runScene(p, story, { ...quiet, strict: true });
  const lines = readFileSync(story.file, "utf8").split("\n");
  for (const st of capture.steps) assert.ok(lines[st.src - 1].includes(`${st.kind}(`), `step ${st.kind} was written on line ${st.src}: ${lines[st.src - 1]}`);
  assert.equal(capture.source.length, lines.length);

  const asFormat = await p.loadScene("story", { format: "source" });
  assert.equal(p.style(asFormat).source, true, "the source format turns it on in one word");
  const shown = { ...story, name: "story", style: { ...story.style, source: true } }, plain = writeFilm(p, story);
  assert.ok(!readFileSync(plain, "utf8").includes('"source":['), "a film that does not show its code does not carry it");
  const file = writeFilm(p, shown), browser = await launch();
  try {
    const film = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await film.goto(`file://${file}?export`);
    await film.evaluate(() => window.__film.ready());
    const lit = await film.evaluate(() => { const at = []; for (let ms = 0; ms < window.__film.total; ms += 250) { window.__film.seek(ms); const on = [...document.querySelectorAll(".src .cl")].findIndex((c) => +getComputedStyle(c).opacity > 0.9); if (on >= 0 && at.at(-1) !== on + 1) at.push(on + 1); } return { at, rows: document.querySelectorAll(".src .cl").length }; });
    assert.equal(lit.rows, lines.length);
    assert.deepEqual(lit.at, capture.steps.map((x) => x.src), "each step lights its own line, in order");
  } finally { await browser.close(); }

  const typed = { ...story, name: "typed-stack", run: async ({ words, open }) => { await words(["Your demo", "is from March."], { stack: true, field: "#ffd23f", for: 400 }); await words(["One", "two"], { stack: true }); await open("/"); } };
  const run = await runScene(p, typed, { ...quiet, strict: true });
  assert.deepEqual(run.capture.steps[0].words.field, "#ffd23f");
  await assert.rejects(() => runScene(p, { ...typed, name: "typed-bad", run: async ({ words }) => { await words("Hi", { field: "yellow" }); } }, { ...quiet, strict: true }), /field is a colour/);
  const b2 = await launch();
  try {
    const film = await b2.newPage({ viewport: { width: 1920, height: 1080 } });
    await film.goto(`file://${writeFilm(p, typed)}?export`);
    await film.evaluate(() => window.__film.ready());
    const made = await film.evaluate(() => ({ fields: document.querySelectorAll(".field").length, stacks: document.querySelectorAll(".say.stack").length, lines: document.querySelectorAll(".say.stack .line").length, nums: document.querySelectorAll(".say.stack .num").length, ink: getComputedStyle(document.querySelector(".say.poster")).color }));
    assert.deepEqual(made, { fields: 1, stacks: 2, lines: 4, nums: 2, ink: "rgb(12, 12, 12)" });
  } finally { await b2.close(); }
});
