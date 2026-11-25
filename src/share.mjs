// Pieces people share: components, motion, looks, kinds of film and sounds. A piece is a folder laid out like
// .scenlit/ itself (components/<name>.html, motion/<name>.js, looks/<name>.json, formats/<name>.json,
// sounds/<name>.wav), optionally with a scenlit.json that says what it is.
//   scenlit add <source>       a folder, github:owner/repo[/path][#ref], a gallery address, or <product>/<name>
//   scenlit share <kind> <name> [--preview <scene>]   one of your own pieces, into the platform's gallery
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { launch } from "./browser.mjs";
import { DEFAULTS } from "./config.mjs";
import { call, portalOf, productOf, publish, tokenFor } from "./publish.mjs";

import { KINDS, NAME, PIECE, TEXT } from "./pieces.mjs";

const CODE = /\.(html|js)$/; // what runs in your films: shown before it is added
const walk = (dir, under = "") => readdirSync(join(dir, under)).flatMap((n) => (statSync(join(dir, under, n)).isDirectory() ? walk(dir, `${under}${n}/`) : [`${under}${n}`]));

// a source, fetched into a folder of its own
async function fetchPiece(p, source, { to }) {
  if (existsSync(source) && statSync(source).isDirectory()) return { dir: source, from: source };
  const work = mkdtempSync(join(tmpdir(), "scenlit-add-"));
  const gh = /^github:([\w.-]+)\/([\w.-]+)(?:\/([^#]+))?(?:#(.+))?$/.exec(source);
  if (gh) {
    const [, owner, repo, sub = "", ref = "HEAD"] = gh, res = await fetch(`https://codeload.github.com/${owner}/${repo}/tar.gz/${encodeURIComponent(ref)}`);
    if (!res.ok) throw new Error(`GitHub has no ${owner}/${repo}${ref === "HEAD" ? "" : ` at ${ref}`} (${res.status})`);
    writeFileSync(join(work, "piece.tgz"), Buffer.from(await res.arrayBuffer()));
    execFileSync("tar", ["-xzf", join(work, "piece.tgz"), "-C", work]);
    const top = readdirSync(work).find((n) => n !== "piece.tgz" && statSync(join(work, n)).isDirectory());
    const dir = join(work, top, sub);
    if (!existsSync(dir)) throw new Error(`${owner}/${repo} has no folder ${sub}`);
    return { dir, from: `github.com/${owner}/${repo}${sub ? `/${sub}` : ""}`, work };
  }
  // the platform's gallery: its address, or <product>/<name> on the platform in the settings
  const g = /^(https?:\/\/[^/]+)\/gallery\/([a-z0-9-]+)\/([\w-]+)\/?$/.exec(source) ?? (/^([a-z0-9-]+)\/([\w-]+)$/.test(source) ? [null, portalOf(p, to), ...source.split("/")] : null);
  if (g) {
    const [, portal, product, name] = g, piece = await call(portal, null, "GET", `/api/gallery/${product}/${name}`);
    for (const [path, b64] of Object.entries(piece.files)) { mkdirSync(join(work, path, ".."), { recursive: true }); writeFileSync(join(work, path), Buffer.from(b64, "base64")); }
    return { dir: work, from: `${portal}/gallery/${product}/${name}`, work, about: piece };
  }
  throw new Error(`"${source}" is not a folder, github:owner/repo[/path], a gallery address or <product>/<name>`);
}

// add a shared piece to this project. Nothing already there is replaced unless `force`; code is shown first, and
// added only when `yes` (or the person at the terminal says yes)
// `dryRun`: only say what it would add, with the text of each file to read, and add nothing
export async function add(p, source, { yes = false, force = false, dryRun = false, to = null, log = console.log, ask = null } = {}) {
  const got = await fetchPiece(p, source, { to });
  try {
    const files = walk(got.dir).filter((f) => PIECE.test(f));
    if (!files.length) throw new Error(`${got.from} has nothing Scenlit can use: it brings components/, motion/, looks/, formats/ or sounds/`);
    if (dryRun) return { from: got.from, files: files.map((f) => `.scenlit/${f}`), use: files.map(useOf), text: Object.fromEntries(files.filter((f) => TEXT.test(f)).map((f) => [`.scenlit/${f}`, readFileSync(join(got.dir, f), "utf8")])), added: false };
    const clash = files.filter((f) => existsSync(join(p.dir, f)) && !readFileSync(join(p.dir, f)).equals(readFileSync(join(got.dir, f))));
    if (clash.length && !force) throw new Error(`already in this project, and different: ${clash.map((f) => `.scenlit/${f}`).join(", ")} (--force replaces them)`);
    const code = files.filter((f) => CODE.test(f));
    log(`From ${got.from}:\n${files.map((f) => `  .scenlit/${f}${CODE.test(f) ? "   (code that runs in your films)" : ""}`).join("\n")}`);
    if (code.length && !yes) {
      const answer = ask ? await ask() : process.stdin.isTTY ? await (async () => { const rl = createInterface({ input: process.stdin, output: process.stdout }); try { return await rl.question("Read it first if you do not know where it comes from. Add it? [y/N] "); } finally { rl.close(); } })() : "";
      if (!/^y(es)?$/i.test(String(answer).trim())) throw new Error("not added (--yes adds it without asking)");
    }
    for (const f of files) { mkdirSync(join(p.dir, f, ".."), { recursive: true }); cpSync(join(got.dir, f), join(p.dir, f)); }
    return { from: got.from, files: files.map((f) => `.scenlit/${f}`), use: files.map(useOf) };
  } finally { if (got.work) rmSync(got.work, { recursive: true, force: true }); }
}
// how a scene uses what was added
const useOf = (f) => {
  const [dir, file] = f.split("/"), name = file.replace(/\.\w+$/, "");
  return { components: `await open("component:${name}") in a scene`, motion: "its pieces are named in the file; pick them under style.motion (scenlit motion list)", looks: `look: "${name}" in a scene`, formats: `format: "${name}" in a scene`, sounds: `"${name}" wherever a sound is named` }[dir];
};

// put one of your own pieces in the platform's gallery, with a picture (a component is drawn) or, with `preview`, a
// scene of yours that shows it, published as a video
export async function share(p, kind, name, { to = null, preview = null, description = "", log = () => {} } = {}) {
  if (!KINDS[kind]) throw new Error(`share what? ${Object.keys(KINDS).join(", ")}`);
  if (!NAME.test(name)) throw new Error("a piece's name is letters, digits and dashes");
  const [dir, exts] = KINDS[kind], files = {};
  const file = existsSync(join(p.dir, dir)) ? readdirSync(join(p.dir, dir)).find((f) => new RegExp(`^${name}\\.(${exts})$`).test(f)) : null;
  if (file) files[`${dir}/${file}`] = readFileSync(join(p.dir, dir, file));
  else if ((kind === "look" || kind === "format") && p.settings[`${dir}`]?.[name]) files[`${dir}/${name}.json`] = Buffer.from(JSON.stringify(p.settings[dir][name], null, 2)); // kept in config.json: shared as its own file
  // one that comes with Scenlit: shared as the settings it is made of, so the gallery shows it with its video, and
  // whoever adds it has a copy of their own to change
  else if ((kind === "look" || kind === "format") && DEFAULTS[dir]?.[name]) files[`${dir}/${name}.json`] = Buffer.from(JSON.stringify(DEFAULTS[dir][name], null, 2));
  if (!Object.keys(files).length) throw new Error(kind === "motion" ? `no .scenlit/motion/${name}.js: put the piece in a file of its own to share it (scenlit motion new writes .scenlit/motion.js, which may hold many)` : `no ${kind} named "${name}" in .scenlit/${dir}/`);
  const portal = portalOf(p, to), token = await tokenFor(p, portal, log);
  let picture = null, film = null;
  if (kind === "component") { // its picture, as a scene would show it
    const browser = await launch();
    try { const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); await page.goto(`file://${join(p.dir, dir, file)}`); await page.waitForTimeout(300); picture = await page.screenshot({ type: "png" }); } finally { await browser.close(); }
  }
  if (preview) { const scene = await p.loadScene(preview); (await import("./film.mjs")).writeFilm(p, scene); film = (await publish(p, scene, { to, kind: "demo", log })).link.split("/").pop(); }
  const made = await call(portal, token, "POST", "/api/gallery", { product: productOf(p), name, kind, description, film, files: Object.fromEntries([...Object.entries(files), ...(picture ? [["preview.png", picture]] : [])].map(([k, v]) => [k, v.toString("base64")])) });
  return made;
}
