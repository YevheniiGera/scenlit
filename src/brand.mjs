// `scenlit brand`: reads the app's own name and accent colour from a page, so films and posts match it.
// It prints what it found; `--save` writes it to .scenlit/config.json.
import { launch, openApp, startApp, stopApp } from "./browser.mjs";

// runs in the page: the colour the app uses most on its buttons and links, and what it calls itself
function read() {
  const rgb = (c) => { const m = c.match(/[\d.]+/g)?.map(Number); return m && (m[3] ?? 1) > 0.5 ? m.slice(0, 3) : null; };
  const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  const vivid = ([r, g, b]) => { const hi = Math.max(r, g, b), lo = Math.min(r, g, b); return hi > 60 && (hi - lo) / hi > 0.35; };
  const votes = new Map();
  for (const e of document.querySelectorAll("button, a, [role=button], input[type=submit], [class*=btn], [class*=logo]")) {
    const s = getComputedStyle(e);
    for (const [c, weight] of [[s.backgroundColor, 3], [s.color, 1]]) { const v = rgb(c); if (v && vivid(v)) votes.set(hex(v), (votes.get(hex(v)) ?? 0) + weight); }
  }
  const theme = document.querySelector('meta[name="theme-color"]')?.content;
  const site = document.querySelector('meta[property="og:site_name"]')?.content || document.querySelector('meta[name="application-name"]')?.content;
  return {
    name: (site || document.title.split(/[|·:–—-]/)[0] || "").trim(),
    accent: [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? (theme && /^#[0-9a-f]{6}$/i.test(theme) ? theme : null),
    font: getComputedStyle(document.body).fontFamily,
  };
}

export async function readBrand(p, { path = "/", save = false, as = null, log = console.log } = {}) {
  const app = p.config.app, child = await startApp(app, p.root), browser = await launch();
  try {
    const { page } = await openApp(browser, p, { as });
    await page.goto(new URL(path, app.url).href);
    await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
    const found = await page.evaluate(read), brand = {};
    if (found.name) brand.name = found.name;
    if (found.accent) brand.accent = found.accent;
    if (app.as) brand.url = app.as.replace(/^app\./, "");
    log(`  name:   ${found.name || "(none found)"}\n  accent: ${found.accent ?? "(none found)"}\n  font:   ${found.font}  (not used: a film needs the font file; set brand.font and brand.fontImport by hand)`);
    if (save) p.save((s) => { s.brand = { ...(s.brand ?? {}), ...brand }; });
    log(save ? "  saved to .scenlit/config.json" : "  not saved. To keep it: scenlit look --save");
    return brand;
  } finally { await browser.close(); stopApp(child); }
}
