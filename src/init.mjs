// `init`: the .scenlit folder for a project, a first scene that runs without a model, the Claude Code skill, and a
// section in AGENTS.md for the other coding agents (Codex, Cursor, ...). Existing files are kept.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATES = fileURLToPath(new URL("../templates/", import.meta.url));

function guess(root) {
  const pkg = existsSync(join(root, "package.json")) ? JSON.parse(readFileSync(join(root, "package.json"), "utf8")) : {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const port = deps.vite || deps["@sveltejs/kit"] ? 5173 : deps.astro ? 4321 : deps["@angular/core"] ? 4200 : 3000;
  const script = ["dev", "start"].find((s) => pkg.scripts?.[s]);
  const name = (pkg.name ?? "").replace(/^@[^/]+\//, "");
  return { name: name ? name[0].toUpperCase() + name.slice(1) : "", url: `http://localhost:${port}`, start: script ? `npm run ${script}` : null };
}

export function init(root = process.cwd(), { log = console.log } = {}) {
  const g = guess(root), dir = join(root, ".scenlit"), wrote = [], kept = [];
  const put = (file, content) => {
    if (existsSync(file)) { kept.push(file); return; }
    mkdirSync(dirname(file), { recursive: true });
    typeof content === "function" ? content(file) : writeFileSync(file, content);
    wrote.push(file);
  };
  put(join(dir, "config.json"), `${JSON.stringify({
    $schema: "../node_modules/scenlit/schema.json", // autocomplete and checks in your editor
    app: { url: g.url, start: g.start, as: null },
    brand: { name: g.name, url: "", background: "#07090d", glow: "#1b2a3f", text: "#f3f1ea", muted: "#8d939e", accent: "#f5b63a" },
    look: { viewport: { width: 1280, height: 800 }, hide: [], css: "" },
    data: { replace: {}, blur: [], date: null },
    model: { provider: "claude-code" },
    voice: { provider: "none" },
  }, null, 2)}\n`);
  put(join(dir, ".gitignore"), "# saved logins, and what is made again by running a scene\nsessions/\ncaptures/\noutput/\n");
  put(join(dir, "scenes", "first.scene.mjs"), (f) => copyFileSync(join(TEMPLATES, "first.scene.mjs"), f));
  put(join(root, ".claude", "skills", "scenlit", "SKILL.md"), (f) => copyFileSync(join(TEMPLATES, "SKILL.md"), f));
  // other coding agents read AGENTS.md: a short section that sends them to `scenlit guide`, added to the file the
  // project already has (once)
  const agents = join(root, "AGENTS.md"), had = existsSync(agents) ? readFileSync(agents, "utf8") : null;
  if (had?.includes("scenlit guide")) kept.push(agents);
  else { const note = readFileSync(join(TEMPLATES, "AGENTS.md"), "utf8"); writeFileSync(agents, had ? `${had.trimEnd()}\n\n${note}` : note); wrote.push(had ? `${agents} (a Scenlit section added)` : agents); }
  // one command for the whole team: npm run films
  const pkgFile = join(root, "package.json");
  if (existsSync(pkgFile)) {
    const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
    if (!pkg.scripts?.films) { pkg.scripts = { ...pkg.scripts, films: "scenlit run --all", "films:check": "scenlit check" }; writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`); wrote.push(`${pkgFile} (scripts: films, films:check)`); }
  }
  for (const f of wrote) log(`  wrote ${f.replace(`${root}/`, "")}`);
  for (const f of kept) log(`  kept  ${f.replace(`${root}/`, "")}`);
  log(`\nYour app: ${g.url}${g.start ? `, started with "${g.start}"` : " (start it yourself, or set app.start)"}. Change it in .scenlit/config.json.`);
  log("Next:\n  npx scenlit doctor         is everything here that it needs\n  npx scenlit run first      a first film and post of your home page\n  npx scenlit login          if the app needs a login\n  then write your own scene in .scenlit/scenes/, or ask your coding agent (Claude Code: /scenlit; Codex and others read AGENTS.md)");
}
