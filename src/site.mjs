// What was made, on one page: every scene's film, video files, posts, screenshots and guide. -> .scenlit/output/index.html
// Also: `check` (every scene without running it), `frames` (still frames of a film) and `doctor` (is this machine ready).
import { PROVIDERS, keyOf } from "./model.mjs";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch } from "./browser.mjs";
import { esc, filmFile, openFilm } from "./film.mjs";
import { outline } from "./scene.mjs";
import { has } from "./voice.mjs";

const list = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort() : []);

export function writeSite(p) {
  const scenes = existsSync(p.output) ? readdirSync(p.output).filter((d) => existsSync(join(p.output, d, "film.html"))).sort() : [];
  const block = (name) => {
    const dir = join(p.output, name), posts = list(join(dir, "posts"), ".png"), shots = list(join(dir, "shots"), ".png"), files = [...list(dir, ".mp4"), ...list(dir, ".gif")];
    const cap = join(p.captures, name, "capture.json"), st = existsSync(cap) ? JSON.parse(readFileSync(cap, "utf8")).stats : null;
    const tiles = (folder, items) => `<div class="tiles">${items.map((f) => `<a href="${name}/${folder}/${f}"><img src="${name}/${folder}/${f}" loading="lazy"><span>${esc(f.replace(/\.png$/, ""))}</span></a>`).join("")}</div>`;
    return `<section><h2>${esc(name)}</h2>
<p><a href="${name}/film.html">Film</a> · <a href="${name}/film.html?shape=square">square</a> · <a href="${name}/film.html?shape=vertical">vertical</a>${existsSync(join(dir, "guide.md")) ? ` · <a href="${name}/guide.md">guide</a>` : ""}${files.map((v) => ` · <a href="${name}/${v}">${esc(v)}</a>`).join("")}${st ? ` · last run: ${st.seconds}s, ${st.calls} model call${st.calls === 1 ? "" : "s"}` : ""}</p>
<iframe src="${name}/film.html" loading="lazy"></iframe>
${posts.length ? `<h3>Posts</h3>${tiles("posts", posts)}` : ""}${shots.length ? `<h3>Screenshots</h3>${tiles("shots", shots)}` : ""}</section>`;
  };
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.config.brand.name || "Scenlit")}</title><style>
body{margin:0 auto;max-width:1100px;padding:32px 24px 80px;font:15px/1.5 -apple-system,"Helvetica Neue",Arial,sans-serif;background:#0b0d11;color:#e8e6df}
h1{font-size:22px}h2{font-size:17px;margin:44px 0 4px}h3{font-size:13px;color:#9aa0aa;font-weight:500;margin:18px 0 8px}a{color:inherit}p{color:#9aa0aa;margin:0 0 12px}
iframe{width:100%;aspect-ratio:16/9.6;border:1px solid #2a2f38;border-radius:10px;background:#000}
.tiles{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}.tiles a{text-decoration:none;color:#9aa0aa;font-size:13px}
.tiles img{display:block;height:220px;max-width:420px;object-fit:contain;border-radius:8px;border:1px solid #2a2f38;margin-bottom:4px;background:#111}
</style></head><body><h1>${esc(p.config.brand.name || "Scenlit")}</h1>
${scenes.length ? scenes.map(block).join("\n") : "<p>Nothing yet. Run a scene: scenlit run &lt;name&gt;</p>"}
</body></html>`;
  mkdirSync(p.output, { recursive: true });
  const file = join(p.output, "index.html");
  writeFileSync(file, html);
  return file;
}

// every scene, without a browser: what would stop it from making a good film
export async function check(p, names = p.sceneNames()) {
  const problems = [];
  for (const name of names) {
    const say = (m) => problems.push(`${name}: ${m}`);
    let scene;
    try { scene = await p.loadScene(name); } catch (e) { say(e.message); continue; }
    if (scene.look && scene.look !== "app" && !p.config.looks[scene.look]) say(`uses the look "${scene.look}", which .scenlit/config.json does not have`);
    if (scene.as && !existsSync(p.session(scene.as))) say(`runs as "${scene.as}", and nobody is signed in as that yet (scenlit login --as ${scene.as})`);
    let o;
    try { o = await outline(scene); } catch (e) { say(`run() failed before any step: ${e.message}`); continue; }
    for (const key of ["title", "end"]) { const c = o[key] ?? scene[key]; if (c && !c.none && (!c.lead || !c.key)) say(`${key} needs two lines: { lead, key }, or card(lead, key) in run()`); }
    if (o.steps.some((s) => s.kind === "act") && !o.steps.some((s) => s.kind === "see")) say('no check: end the scene with see("…") so a broken run is not recorded');
    const recFile = join(p.recordings, `${name}.json`), rec = existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")).steps : {};
    for (const s of o.steps.filter((x) => x.kind === "act" && !rec[x.text])) say(`not recorded yet: "${s.text}" (the next run asks the model)`);
    for (const post of scene.posts ?? []) {
      if (!post.name || !post.lead || !post.key) say("a post needs name, lead and key");
      for (const n of post.shots ?? [post.shot]) if (!o.shots.includes(n)) say(`post "${post.name}" uses the picture "${n}", which the scene does not take`);
    }
    for (const c of scene.carousels ?? []) for (const [i, slide] of (c.slides ?? []).entries()) {
      if (!slide.lead || !slide.key) say(`carousel "${c.name}", slide ${i + 1}: needs lead and key`);
      if (!o.shots.includes(slide.shot)) say(`carousel "${c.name}", slide ${i + 1} uses the picture "${slide.shot}", which the scene does not take`);
    }
  }
  return problems;
}

// still frames of a film, spread over its length: what a reviewer (or Claude) looks at without playing it
export async function frames(p, name, { shape = "wide", count = 8, at = null } = {}) {
  const film = filmFile(p, name), dir = join(p.output, name, "frames");
  mkdirSync(dir, { recursive: true });
  const browser = await launch(), files = [];
  try {
    const page = await openFilm(browser, film, shape);
    const total = await page.evaluate(() => window.__film.total);
    if (at != null) count = 1;
    else for (const old of readdirSync(dir).filter((f) => f.startsWith(`${shape}-`))) rmSync(join(dir, old)); // a new set replaces the last one
    for (let i = 0; i < count; i++) {
      const ms = at != null ? Math.round(at * 1000) : Math.round(i === 0 ? 2000 : i === count - 1 ? total - 500 : 3200 + ((total - 6000) * i) / (count - 1));
      await page.evaluate((t) => window.__film.frame(t), ms);
      const file = join(dir, `${shape}-${String(i + 1).padStart(2, "0")}-${(ms / 1000).toFixed(1)}s.jpg`);
      await page.screenshot({ path: file, type: "jpeg", quality: 80 });
      files.push(file);
    }
  } finally { await browser.close(); }
  return files;
}

// is this machine ready? Each line: ok or not, and what to do
export async function doctor(p) {
  const rows = [], add = (ok, what, fix = "") => rows.push({ ok, what, fix });
  const [major] = process.versions.node.split(".").map(Number);
  add(major >= 20, `Node ${process.versions.node}`, "Scenlit needs Node 20 or newer");
  try { await (await launch()).close(); add(true, "Chrome starts"); } catch { add(false, "Chrome does not start", "install Google Chrome, or set SCENLIT_CHROME to a Chrome or Chromium binary"); }
  add(p.exists, p.exists ? ".scenlit/config.json" : "no .scenlit/config.json here", "scenlit init");
  if (p.exists) {
    let up = false; try { await fetch(p.config.app.url, { redirect: "manual" }); up = true; } catch { /* not up */ }
    add(up || !!p.config.app.start, up ? `the app answers at ${p.config.app.url}` : p.config.app.start ? `the app is not up; "${p.config.app.start}" will start it` : `the app does not answer at ${p.config.app.url}`, 'start it, or set "app.start"');
    // the model that works out new steps (only needed the first time a plain-language step runs)
    const m = p.config.model, where = m.url ? ` at ${m.url}` : "";
    if (m.provider === "claude-code") add(has("claude"), "the claude command (for working out new steps)", 'install Claude Code and sign in, or set "model" to an API (anthropic or openai)');
    else if (!PROVIDERS.includes(m.provider)) add(false, `"model.provider" is "${m.provider}"`, `use ${PROVIDERS.join(", ")}`);
    else {
      let k = null; try { k = keyOf(m); } catch (e) { add(false, "the model's key", e.message); }
      const sdk = m.provider !== "anthropic" || (await import("@anthropic-ai/sdk").then(() => true, () => false));
      if (!sdk) add(false, "the Claude SDK", "npm i -D @anthropic-ai/sdk");
      if (m.provider === "openai" && !m.model) add(false, "the model's name", 'set "model.model"');
      const keyed = !k || !!k.value || (m.provider === "anthropic" && !m.key && !!process.env.ANTHROPIC_AUTH_TOKEN) || (m.provider === "openai" && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(m.url ?? ""));
      if (k) add(keyed, `${m.provider}${where}: ${k.value ? `a key in ${k.name}` : keyed ? "no key needed" : `no key in ${k.name}`}`, `set ${k.name}`);
    }
    const v = p.config.voice.provider;
    if (v === "say") add(has("say"), 'the "say" voice', "it exists on a Mac only; use elevenlabs or none");
    if (v === "openai") add(!!process.env.OPENAI_API_KEY, "an OpenAI key in the environment", "set OPENAI_API_KEY");
    if (v === "elevenlabs") add(!!(process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY), "an ElevenLabs key in the environment", "set ELEVENLABS_API_KEY");
  }
  add(has("ffmpeg"), "ffmpeg (for MP4, GIF and voice)", "https://ffmpeg.org; on a Mac: brew install ffmpeg. Films and posts work without it.");
  return rows;
}
