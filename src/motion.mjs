// Motion you can extend. Every way something moves in a film is a named piece in a family; the built-in pieces
// are in src/player.js, and a project adds or replaces pieces in .scenlit/motion.js and in .scenlit/motion/<name>.js
// (one file a piece, as `scenlit add` installs them), all of which run in the film's page.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const FAMILIES = {
  title: { what: "how a title card comes in", built: ["rise", "fade", "words", "slam"], shape: "(card, at, kit) => the time it is all there" },
  caption: { what: "how a caption comes in", built: ["fade", "words"], shape: "(caption, at, kit)" },
  animate: { what: "what a scene's animate() does to an element of the app", built: ["count", "draw", "rows", "build", "type", "stream", "pulse", "pop", "lift"], shape: "({ el, at, dur, options }, kit)" },
  enter: { what: "how the window arrives", built: ["rise", "fade", "grow", "none"], shape: "(window, at, kit) => how long it takes" },
  exit: { what: "how the window leaves", built: ["fade", "drop", "none"], shape: "(window, at, kit) => how long it takes" },
  cut: { what: "how one picture gives way to the next", built: ["fade", "slide", "none", "grow"], shape: "(newLayer, at, dur, kit)" },
  cursor: { what: "how the cursor travels", built: ["arc", "line"], shape: "(cursor, from, to, when, dur, kit)" },
  click: { what: "what a click looks like", built: ["ring", "pulse", "none"], shape: "(pointInFrame, when, kit)" },
  spotlight: { what: "how something is pointed at", built: ["dim", "outline", "focus", "select"], shape: "(box, at, kit) => the element (or elements) to remove when the step ends" },
  effect: { what: "effects a scene asks for by name: await effect(\"pulse\", target)", built: ["pulse", "shake"], shape: "({ box, at, options, kit }) => how long it takes" },
};

export const motionFile = (p) => join(p.dir, "motion.js");
export const motionDir = (p) => join(p.dir, "motion");
export const ownMotion = (p) => [
  existsSync(motionFile(p)) ? readFileSync(motionFile(p), "utf8") : "",
  ...(existsSync(motionDir(p)) ? readdirSync(motionDir(p)).filter((f) => /^[\w-]+\.js$/.test(f)).sort().map((f) => `/* .scenlit/motion/${f} */\n${readFileSync(join(motionDir(p), f), "utf8")}`) : []),
].filter(Boolean).join("\n");
const defines = (src, family, id) => new RegExp(`define\\(\\s*["'\`]${family}["'\`]\\s*,\\s*["'\`]${id}["'\`]`).test(src);

// is every piece a film asks for there? (style.motion picks one per family; a scene's effect() names an effect)
export function checkMotion(p, style, capture) {
  const src = ownMotion(p), has = (family, id) => FAMILIES[family].built.includes(id) || defines(src, family, id);
  for (const [family, id] of Object.entries(style.motion ?? {})) {
    if (!FAMILIES[family] || family === "effect" || family === "animate") throw new Error(`style.motion has no family "${family}" (${Object.keys(FAMILIES).filter((f) => f !== "effect" && f !== "animate").join(", ")})`);
    if (!has(family, id)) throw new Error(`no ${family} motion named "${id}". Built in: ${FAMILIES[family].built.join(", ")}. Your own go in .scenlit/motion.js (scenlit motion new).`);
  }
  for (const a of capture.steps.flatMap((s) => s.actions)) if (a.do === "animate" && !has("animate", a.name)) throw new Error(`no animation named "${a.name}". Built in: ${FAMILIES.animate.built.join(", ")}. Your own go in .scenlit/motion.js: define("animate", "${a.name}", ({ el, at, dur }, kit) => { … })`);
  for (const a of capture.steps.flatMap((s) => s.actions)) if (a.do === "effect" && !has("effect", a.name)) throw new Error(`no effect named "${a.name}". Built in: ${FAMILIES.effect.built.join(", ")}. Your own go in .scenlit/motion.js (scenlit motion new).`);
}

export const listText = (p) => [
  "Motion families, their built-in pieces, and the shape of a piece:",
  ...Object.entries(FAMILIES).map(([f, v]) => `  ${f.padEnd(10)} ${v.built.join(", ").padEnd(22)} ${v.what}\n${" ".repeat(13)}${v.shape}`),
  "", 'Pick one per family under "style": { "motion": { "cut": "slide", "enter": "grow" } } (project, format or scene).',
  existsSync(motionFile(p)) || existsSync(motionDir(p)) ? `Your own pieces: ${[existsSync(motionFile(p)) && motionFile(p), existsSync(motionDir(p)) && `${motionDir(p)}/`].filter(Boolean).join(" and ")}` : "Add your own: scenlit motion new, or one someone shared: scenlit add <source>",
].join("\n");

const TEMPLATE = `// Your own motion. This file runs inside the film's page, after the built-in pieces are set up.
// define(family, name, piece) adds a piece or replaces a built-in one of the same name.
// Pick a piece in .scenlit/config.json or a scene:  "style": { "motion": { "cut": "wipe" } }
//
// A piece does not animate anything itself: it schedules changes on the film's one clock, so any moment of the
// film can be shown exactly (that is how export and the contact sheet work). Times are in milliseconds.
//   kit.start(el, prop, value)             the value the film begins with
//   kit.to(el, prop, at, dur, value, ease) change prop to value between at and at + dur
//   kit.show(el, at, dur) / kit.hide(...)  opacity to 1 / to 0
//   kit.el(html)                           make an element;  kit.stage, kit.win, kit.view: where to put it
//   kit.box(box, pad, className)           an element laid over a box of the app (it moves with the camera)
//   kit.W, kit.H                           the frame's size;  kit.hold(ms): ms scaled by the film's pace
// Props are CSS properties that can be animated: opacity, translate, scale, rotate, clipPath, filter, …
// Families and the shape of a piece in each:  npx scenlit motion list

scenlitMotion((define, kit) => {
  // A new way for one picture to give way to the next: it wipes in from the left.
  define("cut", "wipe", (layer, at, dur) => {
    kit.start(layer, "clipPath", "inset(0% 100% 0% 0%)");
    kit.to(layer, "opacity", at, 1, 1);
    kit.to(layer, "clipPath", at, Math.max(dur, 450), "inset(0% 0% 0% 0%)");
  });

  // An effect a scene can ask for:  await effect("stamp", { testid: "order" }, { text: "PAID" })
  define("effect", "stamp", ({ box, at, options }) => {
    const e = kit.box(box, 0, "stamp");
    e.textContent = options.text ?? "DONE";
    e.style.cssText += ";display:grid;place-items:center;font:800 44px/1 sans-serif;color:#d1242f;letter-spacing:.1em";
    kit.start(e, "scale", "1.6"); kit.start(e, "rotate", "-8deg");
    kit.show(e, at, 120); kit.to(e, "scale", at, 220, "1", "cubic-bezier(.3,1.6,.5,1)");
    kit.hide(e, at + kit.hold(1400), 300);
    return kit.hold(1400) + 300;   // how long the effect takes
  });
});
`;

export function newMotion(p) {
  const file = motionFile(p);
  if (existsSync(file)) throw new Error(`${file} exists already`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, TEMPLATE);
  return file;
}
