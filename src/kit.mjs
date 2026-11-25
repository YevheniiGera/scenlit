// `scenlit kit`: the app as a library of vector pieces. Every named picture (`shot`) of every scene that has been
// run is kept in .scenlit/kit/ as:
//   <scene>/<shot>.html   the frozen page itself (HTML and CSS; open it, restyle it, embed it)
//   <scene>/<shot>.pdf    the picture as vectors: text stays text, shapes stay shapes (opens in design tools)
//   <scene>/<shot>.svg    the same as SVG, when pdftocairo (poppler) is installed
//   index.html            a gallery of everything, live
// Only pictures whose frozen page is faithful are in the kit; the others exist as PNG screenshots in output/.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch } from "./browser.mjs";
import { esc } from "./film.mjs";
import { recorded } from "./scene.mjs";
import { has } from "./voice.mjs";

export async function writeKit(p, { log = console.log } = {}) {
  const dir = join(p.dir, "kit"), items = [], skipped = [], svg = has("pdftocairo");
  mkdirSync(dir, { recursive: true });
  const browser = await launch();
  try {
    for (const [scene, capture] of recorded(p, log)) {
      const from = join(p.captures, scene), to = join(dir, scene);
      for (const [name, shot] of Object.entries(capture.shots)) {
        const frozen = capture.vector?.[shot.file];
        if (!frozen) { skipped.push(`${scene}/${name}`); continue; }
        mkdirSync(to, { recursive: true });
        cpSync(join(from, frozen), join(to, `${name}.html`));
        if (existsSync(join(from, "assets"))) cpSync(join(from, "assets"), join(to, "assets"), { recursive: true });
        // the piece: the whole screen, or the part the shot was cropped to
        const view = capture.view, c = shot.crop ?? { x: 0, y: 0, w: view.width, h: view.height }, w = Math.ceil(c.w), h = Math.ceil(c.h);
        const frame = join(to, `${name}.piece.html`);
        writeFileSync(frame, `<!doctype html><meta charset="utf-8"><style>@page{size:${w}px ${h}px;margin:0}html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}iframe{position:absolute;left:${-c.x}px;top:${-c.y}px;width:${view.width}px;height:${view.height}px;border:0}</style><iframe src="${name}.html" scrolling="no"></iframe>`);
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        await page.emulateMedia({ media: "screen" });
        await page.goto(`file://${frame}`);
        await page.pdf({ path: join(to, `${name}.pdf`), width: `${w}px`, height: `${h}px`, printBackground: true, pageRanges: "1" });
        await page.close();
        const files = ["html", "pdf"];
        if (svg) try { execFileSync("pdftocairo", ["-svg", join(to, `${name}.pdf`), join(to, `${name}.svg`)]); files.push("svg"); } catch { /* the PDF is still there */ }
        items.push({ scene, name, width: w, height: h, cropped: !!shot.crop, files });
      }
    }
  } finally { await browser.close(); }
  // components written by hand or by an agent sit beside the frozen pieces
  const compDir = join(p.dir, "components"), components = existsSync(compDir) ? readdirSync(compDir).filter((f) => f.endsWith(".html")).map((f) => f.replace(/\.html$/, "")).sort() : [];
  writeFileSync(join(dir, "kit.json"), `${JSON.stringify(items, null, 2)}\n`);
  writeFileSync(join(dir, "index.html"), `<!doctype html><meta charset="utf-8"><title>${esc(p.config.brand.name || "App")} kit</title><style>
body{margin:0 auto;max-width:1240px;padding:32px 24px 80px;font:15px/1.5 -apple-system,"Helvetica Neue",Arial,sans-serif;background:#0b0d11;color:#e8e6df}
h1{font-size:22px;margin:0 0 4px}p{color:#9aa0aa;margin:0 0 28px}a{color:inherit}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:22px}
.item{background:#12151a;border:1px solid #2a2f38;border-radius:12px;padding:14px}.item b{display:block}.item small{color:#9aa0aa}
.box{position:relative;height:220px;margin:12px 0 10px;overflow:hidden;border-radius:8px;background:#fff}.box iframe{position:absolute;left:0;top:0;border:0;transform-origin:0 0;pointer-events:none}
</style><h1>${esc(p.config.brand.name || "App")} kit</h1><p>${items.length} vector piece${items.length === 1 ? "" : "s"}, frozen from the real app. Made again by <code>scenlit kit</code> after the scenes run.</p>
<div class="grid">${items.map((i) => { const k = Math.min(332 / i.width, 220 / i.height); return `<div class="item"><b>${esc(i.name)}</b><small>${esc(i.scene)} · ${i.width}×${i.height}${i.cropped ? " · a piece" : " · the whole screen"}</small>
<div class="box"><iframe src="${i.scene}/${i.name}.piece.html" style="width:${i.width}px;height:${i.height}px;transform:scale(${k})" scrolling="no"></iframe></div>
<small>${i.files.map((f) => `<a href="${i.scene}/${i.name}.${f}">${f}</a>`).join(" · ")}</small></div>`; }).join("")}</div>
${components.length ? `<h1 style="margin-top:44px">Components</h1><p>Written by hand or by an agent, in .scenlit/components/. A scene opens one with open("component:name").</p>
<div class="grid">${components.map((c) => `<div class="item"><b>${esc(c)}</b><small>component:${esc(c)}</small><div class="box"><iframe src="../components/${c}.html" style="width:1280px;height:800px;transform:scale(${332 / 1280})" scrolling="no"></iframe></div><small><a href="../components/${c}.html">html</a></small></div>`).join("")}</div>` : ""}`);
  log(`  ${items.length} piece${items.length === 1 ? "" : "s"} in .scenlit/kit/${svg ? "" : " (no SVG: install poppler for pdftocairo)"}`);
  if (skipped.length) log(`  not vector, left out: ${skipped.join(", ")}`);
  return { dir, items, skipped };
}
