// Posts and carousels: still images for social media and link previews, from a scene's named pictures (`shot`).
// In the scene file:
//   posts: [{ name: "paid", lead: "Your checks are green.", key: "Is the checkout?", line: "One plain sentence.",
//             shot: "paid",                      one picture; or  shots: ["paid", "cart"]  two or three, overlapping
//             tilt: true,                        the picture turned a little in space
//             sizes: ["portrait", "square", "link"] }]
//   carousels: [{ name: "whats-new", slides: [{ lead, key, line, shot }, ...] }]     a PDF for LinkedIn, and each slide as a PNG
// -> .scenlit/output/<scene>/posts/<name>-<size>.png, carousels/<name>.pdf
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch } from "./browser.mjs";
import { baseCss, esc, FILTERS, hostOf } from "./film.mjs";
import { loadCapture } from "./scene.mjs";

export const SIZES = { portrait: [1080, 1350], square: [1080, 1080], link: [1200, 630], thumb: [1280, 720] };
const side = (size) => size === "link" || size === "thumb"; // the text beside the picture, not above it

// where the text and the picture go, per size. The picture runs off the right and bottom edges.
function layout(size, W) {
  if (size === "link") return { text: { left: 64, top: 70, width: 480 }, type: 42, line: 22, pic: { x: 590, y: 84, w: W - 590 - 60 } };
  if (size === "thumb") return { text: { left: 72, top: 96, width: 540 }, type: 58, line: 26, pic: { x: 660, y: 110, w: W - 660 - 60 } };
  const m = 84, top = size === "square" ? 420 : 560;
  return { text: { left: m, top: size === "square" ? 76 : 96, width: W - 2 * m }, type: size === "square" ? 66 : 76, line: size === "square" ? 28 : 32, pic: { x: m, y: top, w: W - 2 * m } };
}

// one picture: around an element (cropped), in a phone, or the whole screen in a browser window.
// The frozen page is used when the capture has one (sharp at any size), else the screenshot.
function piece(p, scene, capture, name, post, { x, y, w, H, size }) {
  const shot = capture.shots[name], view = capture.view, dir = join(p.captures, scene.name), frozen = capture.vector?.[shot.file];
  // the app's screen drawn k times its size, moved so that (ox, oy) of it sits at the corner of its box
  const screen = (k, ox = 0, oy = 0) => (frozen
    ? `<iframe src="file://${join(dir, frozen)}" scrolling="no" style="position:absolute;left:${-ox * k}px;top:${-oy * k}px;width:${view.width}px;height:${view.height}px;border:0;transform:scale(${k});transform-origin:0 0"></iframe>`
    : `<img src="file://${join(dir, shot.file)}" style="position:absolute;left:${-ox * k}px;top:${-oy * k}px;width:${view.width * k}px">`);
  if (shot.crop) {
    const pad = post.pad ?? 28, c = { x: Math.max(0, shot.crop.x - pad), y: Math.max(0, shot.crop.y - pad), w: shot.crop.w + 2 * pad, h: shot.crop.h + 2 * pad }, k = (w / c.w) * (post.zoom ?? 1);
    return { h: c.h * k, html: `<div class="win" style="left:${x}px;top:${y}px;width:${c.w * k}px;height:${c.h * k}px">${screen(k, c.x, c.y)}</div>` };
  }
  if (view.device && view.device !== "desktop") {
    // as tall as the room under the text allows, standing in the middle of it
    const h = Math.min((H - y) * 1.25, 1100) * (post.zoom ?? 1), k = h / view.height, pw = view.width * k;
    return { h, html: `<div class="win device" style="left:${side(size) ? x + 120 : x + (w - pw) / 2}px;top:${y}px;width:${pw}px;height:${h}px;--r:${(view.device === "phone" ? 46 : 28) * k}px;--edge:${12 * k}px">${screen(k)}</div>` };
  }
  const k = post.zoom ?? (side(size) ? 0.8 : 1.3), BAR = p.style(scene).window.bar === "none" ? 0 : 44;
  return { h: BAR + view.height * k, html: `<div class="win" style="left:${x}px;top:${y}px;width:${view.width * k}px"><div class="bar" style="height:${BAR}px"><i></i><i></i><i></i><span>${esc(hostOf(scene, p))}</span></div><div style="position:relative;height:${view.height * k}px">${screen(k)}</div></div>` };
}

function html(p, scene, capture, post, size, mark = "") {
  const [W, H] = SIZES[size], L = layout(size, W), names = post.shots ?? [post.shot], style = p.style(scene, capture.look ?? scene.look);
  // several pictures overlap: each further right and lower, a little smaller, on top of the one before
  const first = piece(p, scene, capture, names[0], post, { ...L.pic, w: names.length > 1 ? L.pic.w * 0.8 : L.pic.w, H, size });
  const rest = names.slice(1).map((n, i) => piece(p, scene, capture, n, post, { x: L.pic.x + L.pic.w * (0.28 + 0.12 * i), y: L.pic.y + Math.min(first.h * 0.62, 320) * (i + 1), w: L.pic.w * 0.66, H, size }));
  const pictures = [first, ...rest].map((x) => x.html).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss(style.brand, style)}
body{width:${W}px;height:${H}px;position:relative}
.t{position:absolute;left:${L.text.left}px;top:${L.text.top}px;width:${L.text.width}px;font-size:${L.type}px;line-height:1.14;letter-spacing:-.02em}
.line{margin-top:.9em;font-size:${L.line}px;line-height:1.4;letter-spacing:0;opacity:.72}
.mark{position:absolute;left:${L.text.left}px;bottom:${side(size) ? 54 : 44}px;font-size:22px;opacity:.6}
.corner{position:absolute;right:${L.text.left}px;top:${side(size) ? 40 : 56}px;height:${side(size) ? 30 : 40}px}
.tilt{position:absolute;inset:0;transform:perspective(2200px) rotateY(-16deg) rotateX(7deg) translateX(40px);transform-origin:${L.pic.x}px ${L.pic.y}px}
/* your own CSS (.scenlit/style.css) */
${style.css.replace(/<\/style/gi, "<\\/style")}</style></head><body>${FILTERS}<div class="bg"></div>${style.logo ? `<img class="logo corner" src="${style.logo}">` : ""}
<div class="t"><div class="lead">${esc(post.lead)}</div><div><span class="key">${esc(post.key)}<i class="u"></i></span></div>${post.line ? `<div class="line">${esc(post.line)}</div>` : ""}</div>
${post.tilt ? `<div class="tilt">${pictures}</div>` : pictures}
${mark ? `<div class="mark">${esc(mark)}</div>` : side(size) && style.brand.url ? `<div class="mark">${esc(style.brand.url)}</div>` : ""}
${side(size) ? "" : `<script>/* a long title pushes the pictures down instead of running into them */
const under = document.querySelector(".t").getBoundingClientRect().bottom + 56, wins = [...document.querySelectorAll(".win")], top = Math.min(...wins.map((e) => e.offsetTop));
if (top < under) wins.forEach((e) => { e.style.top = e.offsetTop + under - top + "px"; });</script>`}
</body></html>`;
}

// a page of HTML written beside its picture and photographed at twice the size: <file>.html -> <file>.png
async function picture(browser, file, content, [W, H]) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  writeFileSync(`${file}.html`, content);
  await page.goto(`file://${file}.html`);
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]));
  await page.screenshot({ path: `${file}.png` });
  await page.close();
  return `${file}.png`;
}

export async function writePosts(p, scene, { log = console.log } = {}) {
  const capture = loadCapture(p, scene.name), out = join(p.output, scene.name), files = [], carousels = scene.carousels ?? [];
  // a thumbnail comes with every scene: its title beside a picture (the scene's `thumbnail: { lead, key, shot }`,
  // else its title and its first named picture, else the screen it ends on). `thumbnail: false` leaves it out.
  const end = capture.steps.flatMap((s) => s.actions).at(-1)?.after ?? capture.start;
  capture.shots.__end = { file: end, crop: null };
  // a film with no opening card: the thumbnail says the brand's name over the film's first caption
  const words = scene.title.none ? { lead: p.config.brand.name ?? "", key: capture.steps.find((s) => s.say)?.say ?? scene.name } : scene.title;
  const thumb = scene.thumbnail === false ? [] : [{ name: "thumbnail", lead: words.lead, key: words.key, shot: Object.keys(capture.shots)[0], ...scene.thumbnail, sizes: ["thumb"] }];
  const posts = [...(scene.posts ?? []), ...thumb];
  const known = (item, what) => { for (const n of item.shots ?? [item.shot]) if (!capture.shots[n]) throw new Error(`${what} uses the picture "${n}", which the scene does not take (${Object.keys(capture.shots).join(", ") || 'it takes none: add await shot("name")'})`); };
  const browser = await launch();
  try {
    const render = (file, content, size) => picture(browser, file, content, size);
    mkdirSync(join(out, "posts"), { recursive: true });
    for (const post of posts) {
      if (!post.name || (!post.lead && post.name !== "thumbnail") || !post.key) throw new Error(`scene "${scene.name}": a post needs name, lead and key`);
      known(post, `post "${post.name}"`);
      for (const size of post.sizes ?? ["portrait", "square", "link"]) {
        if (!SIZES[size]) throw new Error(`post "${post.name}": unknown size "${size}" (${Object.keys(SIZES).join(", ")})`);
        const made = await render(join(out, "posts", `${post.name}-${size}`), html(p, scene, capture, post, size), SIZES[size]);
        if (post.name === "thumbnail") copyFileSync(made, join(out, "thumbnail.png")); else files.push(made);
      }
    }
    for (const c of carousels) {
      if (!c.name || !c.slides?.length) throw new Error(`scene "${scene.name}": a carousel needs a name and slides`);
      c.slides.forEach((slide, i) => known(slide, `carousel "${c.name}", slide ${i + 1},`));
      files.push(await carousel(p, join(out, "carousels"), c.name, c.slides.map((slide) => ({ ...slide, scene, capture })), browser));
    }
  } finally { await browser.close(); }
  log(`  ${files.length} post file${files.length === 1 ? "" : "s"}`);
  return files;
}

// slides as PNGs and as the pages of one PDF (what LinkedIn takes as a document post). Each slide carries the
// scene and capture its picture comes from, so one carousel can draw on several scenes.
export async function carousel(p, dir, name, slides, browser = null) {
  const own = !browser, [W, H] = SIZES.portrait, pngs = [];
  browser ??= await launch();
  mkdirSync(dir, { recursive: true });
  try {
    for (const [i, slide] of slides.entries()) {
      pngs.push(await picture(browser, join(dir, `${name}-${String(i + 1).padStart(2, "0")}`), html(p, slide.scene, slide.capture, slide, "portrait", `${i + 1} / ${slides.length}`), [W, H]));
    }
    const book = join(dir, `${name}.html`), page = await browser.newPage();
    writeFileSync(book, `<!doctype html><style>@page{size:${W}px ${H}px;margin:0}*{margin:0}img{display:block;width:${W}px;height:${H}px;break-after:page}</style>${pngs.map((f) => `<img src="file://${f}">`).join("")}`);
    await page.goto(`file://${book}`);
    await page.evaluate(() => Promise.all([...document.images].map((im) => im.decode())));
    await page.pdf({ path: join(dir, `${name}.pdf`), width: `${W}px`, height: `${H}px`, printBackground: true });
    await page.close();
  } finally { if (own) await browser.close(); }
  return join(dir, `${name}.pdf`);
}
