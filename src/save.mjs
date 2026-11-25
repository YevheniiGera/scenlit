// Where a project wants what Scenlit makes. Everything is first written under .scenlit/output/<scene>/. A scene's
// `save` (or the project's, in .scenlit/config.json, for every scene) names a place in the project for a copy, made
// again with every run, so a film on your site or a picture in your docs is new whenever the app is:
//   save: { film: "public/films/late", video: "public/late.mp4", posts: "marketing/late", guide: "docs/late" }
// {scene} and {shape} in a place stand for the scene's name and the frame's shape.
import { copyFileSync, cpSync, existsSync, mkdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";

export const SAVED = {
  film: "the film with its player and everything it needs: a folder to put on a web host",
  video: "the MP4 when it is exported, its captions and poster beside it under the same name; or one place for each shape: { wide, square, vertical }",
  posts: "the posts: a folder",
  guide: "the guide and its pictures: a folder, or the .md file with the pictures beside it",
  thumbnail: "the thumbnail: a PNG",
};
export function checkSave(save, where) {
  for (const [k, v] of Object.entries(save ?? {})) {
    if (!SAVED[k]) throw new Error(`${where}: save has no "${k}" (${Object.keys(SAVED).join(", ")})`);
    if (typeof v !== "string" && !(k === "video" && v && typeof v === "object")) throw new Error(`${where}: save.${k} is a path in your project`);
    if (k === "film" && extname(v)) throw new Error(`${where}: save.film is a folder (the player and its pictures); got "${v}"`);
  }
}

// a copy of a file or a folder at `to`, a path in the project. For a file, a place that ends in / or has no extension
// is a folder. Nothing already there is removed: a folder of yours may hold other things.
export function copyTo(p, from, to) {
  const at = resolve(p.root, to);
  if (statSync(from).isDirectory()) { cpSync(from, at, { recursive: true }); return at; }
  const folder = /[/\\]$/.test(to) || !extname(at) || (existsSync(at) && statSync(at).isDirectory()), file = folder ? join(at, basename(from)) : at;
  mkdirSync(dirname(file), { recursive: true });
  copyFileSync(from, file);
  return file;
}
const named = (to, scene, shape = "") => to.replaceAll("{scene}", scene.name).replaceAll("{shape}", shape);

// after a run: what the scene asked to keep of what the run made
export async function saveRun(p, scene) {
  const want = scene.save ?? {}, out = join(p.output, scene.name), made = [];
  const keep = (kind, from) => { if (want[kind] && existsSync(from)) made.push(copyTo(p, from, named(want[kind], scene))); };
  if (want.film) made.push(copyTo(p, (await import("./film.mjs")).writeWeb(p, scene).dir, named(want.film, scene)));
  keep("posts", join(out, "posts")); keep("thumbnail", join(out, "thumbnail.png"));
  if (want.guide && existsSync(join(out, "guide.md"))) {
    const to = named(want.guide, scene), file = copyTo(p, join(out, "guide.md"), to);
    copyTo(p, join(out, "guide"), join(dirname(file), "guide")); // the guide's pictures, where its lines look for them
    made.push(file);
  }
  return made;
}
// after an export: the MP4 where the scene wants it. One place serves the scene's own shape, unless it names {shape}.
export function saveVideo(p, scene, mp4, shape) {
  const want = scene.save?.video;
  const to = !want ? null : typeof want === "object" ? want[shape] : want.includes("{shape}") || shape === (scene.shape ?? "wide") ? want : null;
  if (!to) return null;
  const file = copyTo(p, mp4, named(to, scene, shape)), base = file.replace(/\.[^.\\/]+$/, "");
  for (const [from, ext] of [[`${scene.name}.vtt`, ".vtt"], [`${scene.name}-${shape}.jpg`, ".jpg"]]) if (existsSync(join(dirname(mp4), from))) copyFileSync(join(dirname(mp4), from), base + ext);
  return file;
}
