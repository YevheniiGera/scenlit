// Vector pictures: next to every screenshot, the page itself, frozen: its HTML and CSS with scripts removed, form
// values written in, and fonts and images saved beside it. A film or post that shows the frozen page instead of
// the screenshot stays sharp at any zoom and any export size.
// A frozen page is only used when it looks like the screenshot it was taken with (see `faithful`): when a page
// cannot be frozen well (a canvas chart, a closed shadow root, a video), the screenshot is used for that picture.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

// filters a look can lay over the pictures: a hand-drawn wobble, flat cartoon colours, white lines on blue.
// A browser will not let a page put such a filter on another page it frames, so a frozen page carries its look's
// filter itself (`filtered`), and screenshots get it from the film's own CSS.
export const FILTERS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<filter id="nt-sketch" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="nt-toon" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="1" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" result="w"/><feComponentTransfer in="w"><feFuncR type="discrete" tableValues="0 .2 .4 .6 .8 1"/><feFuncG type="discrete" tableValues="0 .2 .4 .6 .8 1"/><feFuncB type="discrete" tableValues="0 .2 .4 .6 .8 1"/></feComponentTransfer></filter>
<filter id="nt-blueprint" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="-.1913 -.6437 -.065 0 1  -.1595 -.5364 -.0542 0 1  -.0957 -.3218 -.0325 0 1  0 0 0 1 0"/></filter>
</defs></svg>`;

// a frozen page with its look's filter on its own root (after it was checked against the screenshot without it)
export function filtered(file, filter) {
  const html = readFileSync(file, "utf8");
  writeFileSync(file, html.replace("</head>", `<style>html{filter:${filter}}</style></head>`).replace(/<body[^>]*>/, (m) => `${m}${FILTERS}`));
}

// runs in the page: the document as static HTML. Returns { html, pending: [stylesheets the page may not read] }
export function freeze() {
  const abs = (u, base) => { try { return new URL(u, base).href; } catch { return u; } };
  // a frozen page keeps the colour scheme it was filmed in, whatever the viewer's own setting is: a rule for the
  // scheme on screen becomes one that always holds, a rule for the other scheme one that never does
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const scheme = (css) => css.replace(/\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/g, (_m, s) => ((s === "dark") === dark ? "(min-width: 0px)" : "(max-width: 0px)"));
  const fix = (css, base) => scheme(css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, _q, u) => (u.startsWith("data:") || u.startsWith("#") ? m : `url("${abs(u, base)}")`)));
  const pending = [];
  const read = (sheet) => {
    let rules;
    try { rules = sheet.cssRules; } catch { if (sheet.href) { pending.push(sheet.href); return `/*@@${sheet.href}@@*/`; } return ""; }
    const base = sheet.href || location.href;
    let out = "";
    for (const r of rules) out += `${r.type === CSSRule.IMPORT_RULE && r.styleSheet ? read(r.styleSheet) : fix(r.cssText, base)}\n`;
    const media = sheet.media?.mediaText;
    return media && media !== "all" ? `@media ${scheme(media)}{${out}}` : out;
  };
  const css = [...document.styleSheets, ...(document.adoptedStyleSheets ?? [])].filter((s) => !s.disabled).map(read).join("\n");

  const src = [...document.documentElement.querySelectorAll("*")], root = document.documentElement.cloneNode(true), dst = [...root.querySelectorAll("*")];
  src.forEach((s, i) => {
    const d = dst[i];
    if (s.tagName === "INPUT") {
      if (s.type === "checkbox" || s.type === "radio") s.checked ? d.setAttribute("checked", "") : d.removeAttribute("checked");
      else d.setAttribute("value", s.type === "password" ? "x".repeat(s.value.length) : s.value);
    } else if (s.tagName === "TEXTAREA") d.textContent = s.value;
    else if (s.tagName === "OPTION") s.selected ? d.setAttribute("selected", "") : d.removeAttribute("selected");
    else if (s.tagName === "IMG") { d.setAttribute("src", s.currentSrc || s.src); d.removeAttribute("srcset"); d.removeAttribute("sizes"); d.removeAttribute("loading"); }
    else if (s.tagName === "CANVAS") { try { const img = document.createElement("img"); img.src = s.toDataURL(); img.className = s.className; img.style.cssText = `${s.style.cssText};width:${s.offsetWidth}px;height:${s.offsetHeight}px`; d.replaceWith(img); } catch { /* a canvas the page may not read stays empty */ } }
    else if (s.tagName === "IFRAME") d.setAttribute("src", "about:blank");
    if (s.scrollTop || s.scrollLeft) d.setAttribute("data-nt-scroll", `${s.scrollLeft},${s.scrollTop}`);
    if (d.isConnected !== false && d.getAttribute?.("style")?.includes("url(")) d.setAttribute("style", fix(d.getAttribute("style"), location.href));
    d.removeAttribute?.("data-scenlit-el");
  });
  for (const e of root.querySelectorAll("script,noscript,link,style,base,meta,template")) e.remove();
  if (scrollX || scrollY) root.setAttribute("data-nt-scroll", `${scrollX},${scrollY}`);
  const head = root.querySelector("head") ?? root.insertBefore(document.createElement("head"), root.firstChild);
  // finished animations rest in their last state, endless ones stop where they are, and nothing eases in again
  head.innerHTML = `<meta charset="utf-8"><style>${css.replace(/<\/style/gi, "<\\/style")}</style><style>*,*::before,*::after{animation-delay:-9999s !important;animation-play-state:paused !important;transition:none !important;caret-color:transparent !important;scroll-behavior:auto !important}</style>`;
  const restore = document.createElement("script");
  restore.textContent = 'for(const e of document.querySelectorAll("[data-nt-scroll]")){const[x,y]=e.dataset.ntScroll.split(",").map(Number);e===document.documentElement?scrollTo(x,y):(e.scrollLeft=x,e.scrollTop=y)}';
  (root.querySelector("body") ?? root).appendChild(restore);
  return { html: `<!doctype html>${root.outerHTML}`, pending };
}

const TYPES = { "font/woff2": ".woff2", "font/woff": ".woff", "font/ttf": ".ttf", "image/png": ".png", "image/jpeg": ".jpg", "image/svg+xml": ".svg", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif" };

// freeze the page into <dir>/<name>.html; what it needs (fonts, images) goes to <dir>/assets, each file once
export async function saveFrozen(page, dir, name, assets) {
  let { html, pending } = await page.evaluate(freeze);
  const get = async (url) => { try { const r = await page.context().request.get(url, { timeout: 8000 }); return r.ok() ? r : null; } catch { return null; } };
  for (const href of pending) { // a stylesheet from another site: read it from here
    const r = await get(href);
    const css = r ? (await r.text()).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, _q, u) => (u.startsWith("data:") ? m : `url("${new URL(u, href).href}")`)) : "";
    html = html.split(`/*@@${href}@@*/`).join(css.replace(/<\/style/gi, "<\\/style"));
  }
  // what it loads from the web, and from files on this computer (a component's own fonts and pictures): copied beside it,
  // so the film has them wherever it is published
  const found = new Set([...html.matchAll(/url\("((?:https?|file):[^"]+)"\)/g), ...html.matchAll(/\ssrc="((?:https?|file):[^"]+)"/g)].map((m) => m[1]));
  mkdirSync(join(dir, "assets"), { recursive: true });
  for (const raw of found) {
    const url = raw.replace(/&amp;/g, "&");
    if (!assets.has(url)) {
      const local = url.startsWith("file:") ? (() => { try { return readFileSync(fileURLToPath(url)); } catch { return null; } })() : undefined;
      const r = local === undefined ? await get(url) : null;
      if (!r && !local) { assets.set(url, null); continue; }
      const ext = (r && TYPES[(r.headers()["content-type"] ?? "").split(";")[0]]) ?? (extname(new URL(url).pathname).slice(0, 6) || ".bin");
      const file = `assets/${createHash("sha1").update(url).digest("hex").slice(0, 12)}${ext}`;
      writeFileSync(join(dir, file), local ?? (await r.body()));
      assets.set(url, file);
    }
    if (assets.get(url)) html = html.split(raw).join(assets.get(url));
  }
  writeFileSync(join(dir, `${name}.html`), html);
  return `${name}.html`;
}

// runs in a page: the share of pixels that differ between two pictures of the same size
export async function unlike([a, b]) {
  const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const [x, y] = await Promise.all([load(a), load(b)]), w = Math.min(x.width, y.width), h = Math.min(x.height, y.height);
  const px = (img) => { const c = Object.assign(document.createElement("canvas"), { width: w, height: h }), g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
  const p = px(x), q = px(y);
  let n = 0;
  for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 90) n++;
  return n / (w * h);
}

// runs in a page: are two pictures the same, but for the noise of drawing a page twice? Something blurred or shaded,
// drawn again, comes out a shade off in a few places (measured: 2 of 255 at most, on a busy machine); a change
// someone could see, even a faint hover tint, moves a pixel further than `noise`.
export async function alike([a, b, noise = 4]) {
  const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const [x, y] = await Promise.all([load(a), load(b)]), w = x.width, h = x.height;
  if (w !== y.width || h !== y.height) return false;
  const px = (img) => { const c = Object.assign(document.createElement("canvas"), { width: w, height: h }), g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
  const p = px(x), q = px(y);
  // the same but for the noise of a JPEG: no pixel far off, and only a few a little off (a real change, even one
  // letter, moves many pixels a long way)
  let faint = 0;
  for (let i = 0; i < p.length; i += 4) {
    const d = Math.max(Math.abs(p[i] - q[i]), Math.abs(p[i + 1] - q[i + 1]), Math.abs(p[i + 2] - q[i + 2]));
    if (d > noise * 6) return false;
    if (d > noise && ++faint > w * h * 0.001) return false;
  }
  return true;
}

// does the frozen page look like the screenshot? Shown in a second page of the same size and compared.
export async function faithful(checker, judge, file, shot, limit = 0.02) {
  await checker.goto(`file://${file}`);
  await checker.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))]));
  const again = await checker.screenshot({ type: "jpeg", quality: 90 }), data = (b) => `data:image/jpeg;base64,${b.toString("base64")}`;
  const off = await judge.evaluate(unlike, [data(shot), data(again)]);
  return { ok: off <= limit, off };
}
