// What a piece is and how a scene uses it, read from its own files: for people choosing one, and for an agent
// deciding (scenlit find --json). The platform's gallery reads pieces the same way.
//   component: <title>, the opening comment, its slots (data-slot, with the words they hold), its states (data-state),
//              whether it can come in over the app (data-overlay), the address its window shows (scenlit:host)
//   motion:    the pieces a file defines (define("cut", "rise", ...)) and its opening comment
//   look, format, sound: the name, and how a scene asks for it
// what a shared piece may bring, where each kind lives in .scenlit/, and a piece's name: one set of rules for the tool
// and the platform's gallery
export const PIECE = /^(components\/[\w-]+\.html|motion\/[\w-]+\.js|looks\/[\w-]+\.json|formats\/[\w-]+\.json|sounds\/[\w-]+\.(wav|mp3|m4a|ogg))$/;
export const KINDS = { component: ["components", "html"], motion: ["motion", "js"], look: ["looks", "json"], format: ["formats", "json"], sound: ["sounds", "wav|mp3|m4a|ogg"] };
export const NAME = /^[\w-]{1,60}$/;
export const TEXT = /\.(html|js|json)$/; // files shown as text, and code (html, js) that runs in films

const first = (re, text) => re.exec(text)?.[1]?.trim() ?? "";
const unique = (list) => [...new Set(list.filter(Boolean))];
const clean = (t) => t.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
// the words of the first comment, up to its first labelled line (States:, Slots:, Controls:)
const opening = (text, open, close) => { const c = first(new RegExp(`${open}([\\s\\S]*?)${close}`), text); return c.split(/\n\s*(?:States|Slots|Controls|Pick it)\b/)[0].replace(/^[\s/*]+|\s*\n\s*(?:\/\/)?\s*/gm, " ").trim(); };
const MOTION_USE = { animate: (n) => `await animate(target, "${n}")`, effect: (n) => `await effect("${n}", target)` };

export function describeComponent(name, html) {
  const slots = [], seen = new Set();
  for (const m of html.matchAll(/data-slot="([\w-]+)"[^>]*>([\s\S]*?)<\//g)) if (!seen.has(m[1])) { seen.add(m[1]); slots.push({ name: m[1], example: clean(m[2]).slice(0, 80) }); }
  const states = unique([first(/<html[^>]*\sdata-state="([\w-]+)"/, html), ...[...html.matchAll(/\[data-state="([\w-]+)"\]/g)].map((m) => m[1])]);
  const overlay = /\sdata-overlay\b/.test(html), example = slots.slice(0, 2).map((s) => `${JSON.stringify(s.name).replace(/^"([\w]+)"$/, "$1")}: ${JSON.stringify(s.example || "…")}`).join(", ");
  return {
    title: clean(first(/<title>([\s\S]*?)<\/title>/, html)), about: clean(opening(html, "<!--", "-->")), slots, states, overlay,
    controls: first(/Controls:\s*(.*?)\s*(?:-->)?\s*$/m, html), host: first(/<meta name="scenlit:host" content="([^"]*)"/, html),
    use: [`await open("component:${name}"${example ? `, { data: { ${example} } }` : ""})`, ...(states.length > 1 ? [`await open("component:${name}?state=${states[1]}")`] : []), ...(overlay ? [`await overlay("component:${name}", { at: "right top" })`] : [])],
  };
}
export function describeMotion(file, js) {
  const defines = [...js.matchAll(/define\(\s*["'`](\w+)["'`]\s*,\s*["'`]([\w-]+)["'`]/g)].map((m) => ({ family: m[1], name: m[2] }));
  return { about: opening(js, "/[/*]", "\\n\\s*(?:scenlitMotion|define|const|function)"), defines, use: defines.map((d) => MOTION_USE[d.family]?.(d.name) ?? `"style": { "motion": { "${d.family}": "${d.name}" } }`) };
}
export const describeLook = (name, look = {}) => ({ about: look.about ?? "", settings: Object.keys(look).filter((k) => k !== "about"), use: [`look: "${name}"`] });
export const describeFormat = (name, format = {}) => ({ about: format.about ?? "", settings: Object.keys(format).filter((k) => k !== "about"), use: [`format: "${name}"`, `scenlit run <scene> --format ${name}`] });
export const describeSound = (name, about = "") => ({ about, use: [`"style": { "sounds": { "click": "${name}" } }`, `await click("…", { sound: "${name}" })`] });

// a piece's files -> what it is (the gallery and `scenlit find` both use this)
export function describe(kind, files) {
  const text = (re) => Object.entries(files).find(([f]) => re.test(f));
  if (kind === "component") { const [f, v] = text(/^components\/[\w-]+\.html$/) ?? []; return f ? describeComponent(f.slice(11, -5), v) : {}; }
  if (kind === "motion") { const all = Object.entries(files).filter(([f]) => /^motion\/[\w-]+\.js$/.test(f)); const d = all.map(([f, v]) => describeMotion(f, v)); return { about: d[0]?.about ?? "", defines: d.flatMap((x) => x.defines), use: d.flatMap((x) => x.use) }; }
  if (kind === "look" || kind === "format") { const [f, v] = text(/^(looks|formats)\/[\w-]+\.json$/) ?? []; if (!f) return {}; const name = f.split("/")[1].slice(0, -5); let j = {}; try { j = JSON.parse(v); } catch { /* checked elsewhere */ } return kind === "look" ? describeLook(name, j) : describeFormat(name, j); }
  if (kind === "sound") { const [f] = text(/^sounds\//) ?? []; return f ? describeSound(f.split("/")[1].replace(/\.\w+$/, "")) : {}; }
  return {};
}
