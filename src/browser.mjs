// The browser: Chrome on this machine, the app in it, and what runs inside the page to list and find its controls.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export async function launch({ headed = false } = {}) {
  const executablePath = process.env.SCENLIT_CHROME || undefined, { chromium } = await import("playwright-core"); // loaded here, so commands that open no browser do not pay for it
  // a window larger than any look's viewport, so the frames recorded during an action cover the whole page
  try { return await chromium.launch({ headless: !headed, args: ["--window-size=2000,1500", "--allow-file-access-from-files"], ...(executablePath ? { executablePath } : { channel: "chrome" }) }); }
  catch (e) { throw new Error(`could not start Chrome. Install Google Chrome, or set SCENLIT_CHROME to a Chrome or Chromium binary.\n${e.message.split("\n")[0]}`); }
}

// start the app when it is not answering, and wait for it
export async function startApp(app, cwd) {
  const up = async () => { try { await fetch(app.url, { redirect: "manual" }); return true; } catch { return false; } };
  if (await up()) return null;
  if (!app.start) throw new Error(`${app.url} is not answering. Start your app, or set "app.start" in .scenlit/config.json.`);
  const child = spawn(app.start, { cwd, shell: true, stdio: "ignore", detached: process.platform !== "win32" });
  for (let i = 0; i < 150; i++) { if (await up()) return child; await new Promise((r) => setTimeout(r, 200)); }
  stopApp(child);
  throw new Error(`"${app.start}" did not bring up ${app.url} in 30 seconds.`);
}
// runs in the page: what an agent needs to know about it (scenlit inspect)
export function describePage() {
  return {
    url: location.href, title: document.title,
    headings: [...document.querySelectorAll("h1,h2,h3")].map((h) => h.innerText.trim()).filter(Boolean).slice(0, 20),
    text: (document.querySelector("main") || document.body).innerText.trim().replace(/\s+/g, " ").slice(0, 1200),
    controls: window.__scenlit.list().map(({ role, name, testid, options, value, shows }) => ({ role, name, ...(testid ? { testid } : {}), ...(options ? { options } : {}), ...(value ? { value } : {}), ...(shows ? { shows } : {}), ...(/^\D{2,}?\s?\d+$/.test(name) && name.split(/\s+/).length <= 4 ? { unstable: true } : {}) })),
    regions: window.__scenlit.regions(),
    slots: [...new Map([...document.querySelectorAll("[data-slot]")].map((e) => [e.dataset.slot, e.textContent.trim().replace(/\s+/g, " ").slice(0, 40)])).entries()].map(([name, example]) => ({ name, example })),
    states: [...new Set([...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].map((r) => r.cssText); } catch { return []; } }).join(" ").match(/\[data-state=["']?[\w-]+/g) ?? [])].map((m) => m.replace(/.*=["']?/, "")),
  };
}
export const stopApp = (child) => { if (!child) return; try { process.kill(-child.pid); } catch { try { child.kill(); } catch { /* already gone */ } } };

// This function is sent into the page. It must not use anything from outside itself.
export function inPage() {
  const SEL = "a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link],[role=tab],[role=checkbox],[role=menuitem],[role=option],[role=switch],[contenteditable=true]";
  const role = (el) => el.getAttribute("role") || { A: "link", BUTTON: "button", SELECT: "select", TEXTAREA: "textbox" }[el.tagName]
    || (el.type === "checkbox" ? "checkbox" : el.type === "radio" ? "radio" : el.type === "submit" || el.type === "button" ? "button" : "value" in el ? "textbox" : "clickable");
  const text = (s) => (s || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const label = (el) => text(el.getAttribute("aria-label") || el.labels?.[0]?.innerText || el.placeholder || (el.tagName === "SELECT" ? el.name || el.id : el.innerText) || el.value || el.title || el.name);
  const seen = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && !el.disabled; };
  // controls, and also anything that shows a hand cursor (a clickable row or card): the outermost such element
  const all = () => {
    const found = new Set(document.querySelectorAll(SEL));
    for (const e of [...document.querySelectorAll("body *")].slice(0, 4000)) {
      if (found.has(e) || e.closest(SEL) || getComputedStyle(e).cursor !== "pointer") continue;
      if (e.parentElement && getComputedStyle(e.parentElement).cursor === "pointer") continue;
      found.add(e);
    }
    return [...found].filter(seen).sort((x, y) => (x.compareDocumentPosition(y) & 4 ? -1 : 1)).slice(0, 200);
  };
  const loose = (s) => s.toLowerCase().replace(/\d+([.,]\d+)*/g, "#"); // "Pay $62" still fits "Pay $86"
  const key = (el) => `${role(el)}|${label(el)}`;
  const pick = (loc) => {
    const els = all();
    if (loc.testid) { const el = els.find((e) => e.dataset.testid === loc.testid) || document.querySelector(`[data-testid="${CSS.escape(loc.testid)}"]`); if (el) return el; }
    if (loc.selector) return document.querySelector(loc.selector);
    if (loc.role) {
      const want = `${loc.role}|${loc.name}`, exact = els.filter((e) => key(e) === want);
      if (exact.length) return exact[loc.nth ?? 0] ?? exact[0];
      return els.filter((e) => loose(key(e)) === loose(want))[loc.nth ?? 0];
    }
    if (loc.text) {
      const t = loc.text.toLowerCase();
      // a control with exactly this name, then the smallest element showing exactly this text, then a control containing it
      return els.find((e) => label(e).toLowerCase() === t)
        || [...document.querySelectorAll("body *")].filter(seen).reverse().find((e) => text(e.innerText).toLowerCase() === t)
        || els.find((e) => label(e).toLowerCase().includes(t));
    }
    return null;
  };
  // a short selector that finds this element again
  const selectorOf = (el) => {
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.dataset.testid) return `[data-testid="${el.dataset.testid}"]`;
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
      const cls = [...e.classList].filter((c) => /^[a-z][\w-]*$/i.test(c)).slice(0, 2).map((c) => `.${CSS.escape(c)}`).join("");
      const same = e.parentElement ? [...e.parentElement.children].filter((s) => s.tagName === e.tagName) : [e];
      parts.unshift(`${e.tagName.toLowerCase()}${cls}${same.length > 1 && !cls ? `:nth-of-type(${same.indexOf(e) + 1})` : ""}`);
      if (e.id) { parts[0] = `#${CSS.escape(e.id)}`; break; }
    }
    return parts.join(" > ");
  };
  window.__scenlit = {
    list: () => all().map((el, i, a) => ({
      i, role: role(el), name: label(el), shows: text(el.innerText) !== label(el) && el.tagName !== "SELECT" ? text(el.innerText) || undefined : undefined,
      options: el.tagName === "SELECT" ? [...el.options].map((o) => text(o.label)).slice(0, 12) : undefined,
      testid: el.dataset.testid || undefined, value: el.type === "password" ? undefined : text(el.value) || undefined,
      nth: a.slice(0, i).filter((o) => key(o) === key(el)).length,
    })),
    where: () => ({ url: location.href, text: (document.querySelector("main") || document.body).innerText.trim().replace(/\s+/g, " ").slice(0, 600) }),
    // find one control (or any element, for a picture's crop), bring it into view, and say where it is
    find: (loc, { mark = true, block = "nearest" } = {}) => {
      const el = pick(loc);
      if (!el) return null;
      // block "seen": leave the page where it is when most of the element is already in view (a whole page section,
      // a card on screen), and bring it to the middle only when it is not
      const r0 = el.getBoundingClientRect(), shown = Math.min(r0.bottom, innerHeight) - Math.max(r0.top, 0);
      if (block !== "seen" || shown < Math.min(r0.height, innerHeight) * 0.6) el.scrollIntoView({ block: block === "seen" ? "center" : block, inline: "nearest" });
      document.querySelectorAll("[data-scenlit-el]").forEach((e) => e.removeAttribute("data-scenlit-el"));
      if (mark) el.setAttribute("data-scenlit-el", "1");
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    },
    // parts of the page that are not controls but are worth pointing at or cropping to: anything with a test id or
    // an id, and the usual containers. Each with a selector that finds it again.
    regions: () => {
      const out = new Map();
      for (const e of document.querySelectorAll("[data-testid], main [id], table, form, dialog, [role=dialog], section, article, aside, ul, ol, h1, h2, [class*=card], [class*=panel], [class*=total], [class*=summary]")) {
        if (!seen(e) || e.matches(SEL)) continue;
        const r = e.getBoundingClientRect();
        if (r.width < 40 || r.height < 16 || (r.width >= innerWidth && r.height >= innerHeight)) continue;
        const sel = selectorOf(e);
        if (!out.has(sel)) out.set(sel, { selector: sel, ...(e.dataset.testid ? { testid: e.dataset.testid } : {}), text: text(e.innerText).slice(0, 60), w: Math.round(r.width), h: Math.round(r.height) });
      }
      return [...out.values()].slice(0, 30);
    },
    // what was clicked or typed into, for the recorder: the control around it, and a name that finds it again
    describe: (node) => {
      const el = node.closest?.(SEL) || all().find((e) => e.contains(node));
      if (!el) return null;
      const typed = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && !["checkbox", "radio", "submit", "button"].includes(el.type);
      const name = label(el), same = all().filter((e) => key(e) === key(el)).length;
      return { tag: el.tagName.toLowerCase(), typed, name: name && same === 1 ? name : "", testid: el.dataset.testid || "", selector: selectorOf(el) };
    },
    // what a marketing picture might drop: the things around the page's content
    chrome: () => {
      const out = new Set();
      for (const e of document.querySelectorAll("header > *, header > * > *, nav > *, aside, aside > *, footer, [role=banner] > *, [role=search], [role=complementary], iframe")) out.add(e);
      for (const e of document.querySelectorAll("body *")) { const pos = getComputedStyle(e).position; if ((pos === "fixed" || pos === "sticky") && e.tagName !== "HEADER") out.add(e); }
      const onScreen = (e) => { const r = e.getBoundingClientRect(); return r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; };
      return [...out].filter(seen).filter(onScreen).slice(0, 40).map((e) => { const r = e.getBoundingClientRect(); return { selector: selectorOf(e), tag: e.tagName.toLowerCase(), text: text(e.innerText || e.getAttribute("aria-label") || e.placeholder).slice(0, 50), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }; });
    },
  };

  // sample data: text swapped as the page draws it
  let swaps = [];
  // whole words only: replacing "MR" must not touch "MRR"
  const whole = (from) => new RegExp(`(?<![\\p{L}\\p{N}])${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "gu");
  const swap = (node) => { let v = node.nodeValue; for (const [from, re, to] of swaps) if (v.includes(from)) v = v.replace(re, to); if (v !== node.nodeValue) node.nodeValue = v; };
  const walk = (root) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) swap(n); };
  let watching = false;
  window.__scenlit.data = (data) => {
    swaps = Object.entries(data.replace ?? {}).sort((a, b) => b[0].length - a[0].length).map(([from, to]) => [from, whole(from), to]);
    let style = document.getElementById("scenlit-data");
    if (!style) { style = document.createElement("style"); style.id = "scenlit-data"; document.documentElement.appendChild(style); }
    style.textContent = (data.blur ?? []).map((s) => `${s}{filter:blur(6px) !important}`).join("\n");
    if (!swaps.length) return;
    if (document.body) walk(document.body);
    if (!watching) {
      watching = true;
      new MutationObserver((ms) => { for (const m of ms) { if (m.type === "characterData") swap(m.target); for (const n of m.addedNodes) n.nodeType === 3 ? swap(n) : n.nodeType === 1 && walk(n); } })
        .observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    }
  };
}

// a page of the app as the film shows it: the look's viewport and CSS, a saved login
export async function openApp(browser, p, { look = p.config.look, as = null } = {}) {
  const file = p.session(as ?? "default");
  if (as && !existsSync(file)) throw new Error(`nobody is signed in as "${as}" yet: scenlit login --as ${as}`);
  const handheld = look.device === "phone" || look.device === "tablet";
  const context = await browser.newContext({
    viewport: look.viewport, deviceScaleFactor: look.device === "phone" ? 3 : 2,
    ...(handheld ? { isMobile: true, hasTouch: true } : {}),
    ...(look.scheme ? { colorScheme: look.scheme } : {}), ...(look.locale ? { locale: look.locale } : {}),
    ...(existsSync(file) ? { storageState: file } : {}),
  });
  const page = await context.newPage();
  await page.addInitScript(inPage);
  const css = [...look.hide.map((s) => `${s}{display:none !important}`), look.css, "*{caret-color:transparent !important}"].join("\n");
  await page.addInitScript((c) => { const add = () => { const s = document.createElement("style"); s.textContent = c; document.documentElement.appendChild(s); }; document.documentElement ? add() : addEventListener("DOMContentLoaded", add); }, css);
  return { context, page };
}

export async function saveSession(p, context, as = "default") {
  const file = p.session(as);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(await context.storageState(), null, 2));
  return file;
}

// sign in by hand once; scenes then start signed in
export async function login(p, { path = "/", as = "default", log = console.log } = {}) {
  const app = p.config.app, child = await startApp(app, p.root), browser = await launch({ headed: true }), file = p.session(as);
  const context = await browser.newContext({ viewport: null, ...(existsSync(file) ? { storageState: file } : {}) });
  const page = await context.newPage();
  await page.goto(new URL(path, app.url).href);
  log(`Sign in to your app${as === "default" ? "" : ` as ${as}`} in the window that opened, then close the window.`);
  let state = await context.storageState();
  const keep = setInterval(async () => { try { state = await context.storageState(); } catch { /* closing */ } }, 1000);
  await new Promise((done) => { page.on("close", done); browser.on("disconnected", done); });
  clearInterval(keep);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(state, null, 2));
  await browser.close().catch(() => {});
  stopApp(child);
  return file;
}
