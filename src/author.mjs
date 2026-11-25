// Help with writing: record a scene by clicking through the app, and translate a film.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch, openApp, startApp, stopApp } from "./browser.mjs";
import { ask, parseJson } from "./model.mjs";
import { translationFile } from "./film.mjs";
import { loadCapture } from "./scene.mjs";

const q = (s) => JSON.stringify(String(s));
const target = (t) => (t.name ? q(t.name) : t.testid ? `{ testid: ${q(t.testid)} }` : `{ selector: ${q(t.selector)} }`);

// ---- record: you click through the app, and get the scene file
// `drive(page)` stands in for the person (tests use it); without it, a window opens and waits to be closed.
export async function record(p, name, { path = "/", as = null, drive = null, log = console.log } = {}) {
  const file = join(p.scenes, `${name}.scene.mjs`);
  if (existsSync(file)) throw new Error(`${file} exists already; pick another name`);
  const app = p.config.app, child = await startApp(app, p.root), browser = await launch({ headed: !drive }), events = [];
  try {
    const { page, context } = await openApp(browser, p, { as });
    await context.exposeBinding("__scenlitRecord", (_, ev) => { events.push(ev); });
    await page.addInitScript(() => {
      const say = (ev) => window.__scenlitRecord(ev);
      addEventListener("click", (e) => { const t = window.__scenlit.describe(e.target); if (t && !t.typed) say({ do: "click", ...t }); }, true);
      addEventListener("change", (e) => { const t = window.__scenlit.describe(e.target); if (t?.typed) say({ do: t.tag === "select" ? "select" : "fill", ...t, value: t.tag === "select" ? e.target.selectedOptions[0]?.label : e.target.value, secret: e.target.type === "password" }); }, true);
    });
    await page.goto(new URL(path, app.url).href);
    if (drive) await drive(page);
    else { log("Click through your app in the window that opened. Close the window when you are done."); await new Promise((done) => { page.on("close", done); browser.on("disconnected", done); }); }
    await page.waitForTimeout(200).catch(() => {});
  } finally { await browser.close().catch(() => {}); stopApp(child); }
  if (!events.length) throw new Error("nothing was clicked or typed; no scene written");

  const secrets = events.some((e) => e.secret);
  const lines = events.map((e) => (e.do === "click" ? `    await click(${target(e)});`
    : e.do === "select" ? `    await select(${target(e)}, ${q(e.value)});`
      : `    await fill(${target(e)}, ${e.secret ? 'process.env.PASSWORD ?? ""' : q(e.value)});`));
  mkdirSync(p.scenes, { recursive: true });
  writeFileSync(file, `// Recorded by clicking through the app. Next: give the steps their words (say: "..."), and end on a check.
/** @type {import("scenlit").Scene} */
export default {
  title: { lead: "The first line,", key: "and the line that matters." },
  end: { lead: "The closing line,", key: "and what to remember." },

  async run({ open, click, fill, select, see, shot }) {
    await open(${q(path)});
${lines.join("\n")}
    // await see("…");   // text that shows the flow worked
    await shot("end");
  },
};
${secrets ? "// A password was typed: it is read from the PASSWORD environment variable, never written here.\n" : ""}`);
  return { file, steps: events.length };
}

// ---- translate: the film's words in another language (.scenlit/translations/<scene>.<lang>.json)

export async function translate(p, scene, lang) {
  const capture = loadCapture(p, scene.name);
  const words = [...new Set([scene.title.lead, scene.title.key, scene.end.lead, scene.end.key,
    ...capture.steps.flatMap((s) => [s.say, s.speak, s.card?.lead, s.card?.key, ...s.actions.map((a) => a.text)])].filter(Boolean))];
  const file = translationFile(p, scene.name, lang), had = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const missing = words.filter((w) => !had[w]);
  if (missing.length) {
    const answer = parseJson(await ask(`Translate these lines of a short product film into ${lang}. They are titles and captions: keep them as short and plain as the originals, keep product names and numbers as they are.

${missing.map((w, i) => `${i + 1}. ${w}`).join("\n")}

Reply with JSON only: {"lines":["<translation of 1>","<translation of 2>", ...]} with exactly ${missing.length} entries, in order.`, p.config.model), "lines");
    if (answer.lines?.length !== missing.length) throw new Error(`the model returned ${answer.lines?.length ?? 0} lines for ${missing.length}; run it again`);
    missing.forEach((w, i) => { had[w] = String(answer.lines[i]); });
  }
  mkdirSync(join(p.dir, "translations"), { recursive: true });
  writeFileSync(file, `${JSON.stringify(Object.fromEntries(words.map((w) => [w, had[w]])), null, 2)}\n`);
  return { file, translated: missing.length };
}
