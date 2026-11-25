// `scenlit look`: proposes a marketing look for the app. The same app, with less around its content and bigger
// type: it only hides and enlarges, it never adds anything. A model picks what to hide from the things around the
// page's content; you look at the two pictures, and `--save` keeps the look in .scenlit/config.json.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { launch, openApp, startApp, stopApp } from "./browser.mjs";
import { merge } from "./config.mjs";
import { ask, parseJson } from "./model.mjs";

const prompt = (items) => `Below are the things around the content of one page of a web app. A marketing picture shows the same app with less around it.

Pick what to hide: search boxes, notification bells, avatars and account menus, help and chat widgets, cookie banners, promo bars, secondary toolbars, footers.
Keep: the logo, the main navigation, and anything that is the page's own content or that a viewer needs to understand the page. When unsure, keep it.

${items.map((c, i) => `[${i}] <${c.tag}> "${c.text}" ${c.w}x${c.h} at ${c.x},${c.y}`).join("\n")}

Reply with one line of JSON and nothing else: {"hide":[<numbers>],"why":"<one sentence>"}`;

export async function proposeLook(p, { path = "/", save = false, as = null, log = console.log } = {}) {
  const app = p.config.app, dir = join(p.output, "_look"), base = p.config.look;
  mkdirSync(dir, { recursive: true });
  const child = await startApp(app, p.root), browser = await launch();
  try {
    const shoot = async (look, file) => {
      const { page, context } = await openApp(browser, p, { look, as });
      // the project's sample data applies here too, so the proposal's pictures show no real customer
      const data = p.config.data;
      await page.addInitScript((d) => { const go = () => window.__scenlit.data(d); document.body ? go() : addEventListener("DOMContentLoaded", go); }, data);
      if (data.date) await page.clock.setFixedTime(new Date(data.date));
      await page.goto(new URL(path, app.url).href);
      await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(base.settle);
      await page.screenshot({ path: join(dir, file) });
      const items = await page.evaluate(() => window.__scenlit.chrome());
      await context.close();
      return items;
    };
    const items = await shoot(base, "app.png");
    if (!items.length) throw new Error("found nothing around the page's content to hide; set looks.marketing by hand in .scenlit/config.json");
    const answer = parseJson(await ask(prompt(items), p.config.model), "hide");
    const hide = [...new Set((answer.hide ?? []).map((i) => items[i]?.selector).filter(Boolean))];
    // bigger type: the same window, drawn from a smaller viewport
    const proposal = { viewport: { width: Math.round(base.viewport.width * 0.875), height: Math.round(base.viewport.height * 0.875) }, hide };
    await shoot(merge(base, proposal), "marketing.png");
    if (save) p.save((s) => { (s.looks ??= {}).marketing = proposal; });
    log(`  hides: ${hide.length ? hide.join(", ") : "nothing"}`);
    if (answer.why) log(`  why:   ${answer.why}`);
    log(`  before: ${join(dir, "app.png")}\n  after:  ${join(dir, "marketing.png")}`);
    log(save ? '  saved as looks.marketing. A scene uses it with look: "marketing".' : "  not saved. Look at the two pictures, then: scenlit look --save");
    return { proposal, why: answer.why };
  } finally { await browser.close(); stopApp(child); }
}
