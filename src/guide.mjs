// A step-by-step guide from a scene: each step's words, what to do, and a picture with the place marked.
// -> .scenlit/output/<scene>/guide.md and guide/NN.png
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch } from "./browser.mjs";
import { loadCapture } from "./scene.mjs";

const b = (s) => `**${String(s).replace(/\*/g, "")}**`;
export const sentence = (a) => ({
  click: `Click ${b(a.what)}.`, fill: `Type in ${b(a.what)}.`, select: `Choose ${b(a.value)} in ${b(a.what)}.`, press: `Press ${b(a.what)}.`,
  hover: `Move the pointer over ${b(a.what)}.`, upload: `Add a file in ${b(a.what)}.`, drag: `Drag ${b(a.what)}.`, scroll: `Scroll to ${b(a.what)}.`,
  state: `Now: ${b(a.what)}.`,
  effect: `Look at ${b(a.what)}.`,
  link: `${b(a.what)} leads to ${a.href}.`,
  point: `Look at ${b(a.what)}.`, zoom: `Look at ${b(a.what)}.`, label: /^[#.[]/.test(a.what ?? "") || !a.what ? `${a.text}.`.replace(/\.\.$/, ".") : `${b(a.what)}: ${a.text}`, // a label placed by selector says only its words
}[a.do] ?? `${a.do} ${b(a.what)}`);

export async function writeGuide(p, scene) {
  const capture = loadCapture(p, scene.name), out = join(p.output, scene.name), dir = join(out, "guide"), capDir = join(p.captures, scene.name);
  mkdirSync(dir, { recursive: true });
  const steps = capture.steps.filter((s) => s.actions.length && s.kind !== "cut"); // a cut only shows a page that was opened
  if (!steps.length) return null;
  const browser = await launch(), lines = [`# ${`${scene.title.lead} ${scene.title.key}`.trim()}`, ""];
  try {
    const page = await browser.newPage({ viewport: capture.view, deviceScaleFactor: 1.5 });
    let n = 0, lastAfter = null;
    const picture = async (file, box) => {
      const name = `${String(++n).padStart(2, "0")}.png`;
      await page.setContent(`<body style="margin:0"><img src="data:image/jpeg;base64,${readFileSync(join(capDir, file)).toString("base64")}" style="display:block;width:100vw">${box ? `<div style="position:absolute;left:${box.x - 6}px;top:${box.y - 6}px;width:${box.w + 12}px;height:${box.h + 12}px;border:3px solid ${p.config.brand.accent};border-radius:10px;box-shadow:0 0 0 4px #0002"></div>` : ""}</body>`);
      await page.evaluate(() => document.images[0].decode());
      await page.screenshot({ path: join(dir, name) });
      return `guide/${name}`;
    };
    for (const [i, s] of steps.entries()) {
      lines.push(`## ${i + 1}. ${s.say ?? (s.kind === "act" ? s.text[0].toUpperCase() + s.text.slice(1) : sentence(s.actions[0]).replace(/\*\*/g, ""))}`, "");
      for (const [j, a] of s.actions.entries()) {
        lines.push(`${j + 1}. ${sentence(a)}`, "", `   ![](${await picture(a.box ? a.before : a.after, a.box)})`, "");
        lastAfter = a.after;
      }
    }
    if (lastAfter) lines.push("## Result", "", `![](${await picture(lastAfter, null)})`, "");
  } finally { await browser.close(); }
  const file = join(out, "guide.md");
  writeFileSync(file, lines.join("\n"));
  return file;
}
