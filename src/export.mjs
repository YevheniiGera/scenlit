// The film as a file: every frame is the film page at that moment, photographed, and ffmpeg joins them with the
// narration. -> .scenlit/output/<scene>/<scene>-<shape>.mp4, a poster, and the captions (.vtt)
// With `step`, only that step: a short silent loop (and with `gif`, a GIF of it).
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { launch } from "./browser.mjs";
import { SIZE, filmFile, openFilm } from "./film.mjs";
import { sound as soundOf } from "./sounds.mjs";
import { ffmpeg } from "./voice.mjs";

export const SHAPES = Object.keys(SIZE);
const stamp = (ms) => new Date(ms).toISOString().slice(11, 23);

export async function exportFilm(p, scene, { shape = "wide", fps = 30, step = null, gif = false, lang = null, scale = 1, blur = false, log = console.log } = {}) {
  const bin = ffmpeg(), film = filmFile(p, scene.name, lang), dir = dirname(film);
  const out = join(dir, `${scene.name}-${shape}${scale > 1 ? "-4k" : ""}${lang ? `.${lang}` : ""}${step ? `-step${step}` : ""}.mp4`);
  const browser = await launch();
  try {
    const page = await openFilm(browser, film, shape, scale);
    const f = await page.evaluate(() => ({ total: window.__film.total, audio: window.__film.audio, steps: window.__film.steps, captions: window.__film.captions, sfx: window.__film.sfx, sfxVolume: window.__film.sfxVolume, music: window.__film.music, presenter: window.__film.presenter, still: window.__film.still }));
    if (f.still) log(`  ${f.still} thing${f.still === 1 ? "" : "s"} a scene asked to move on the app's screen could not be reached (its picture is a screenshot, not a frozen page): ${f.still === 1 ? "it stays" : "they stay"} still`);
    if (step && !f.steps[step - 1]) throw new Error(`the film has ${f.steps.length} steps; there is no step ${step}`);
    const from = step ? f.steps[step - 1].from : 0, to = step ? f.steps[step - 1].to : f.total;
    // motion blur: five moments are photographed for every frame and blended, as a camera's open shutter would
    const sub = blur ? 5 : 1, rate = fps * sub, frames = Math.ceil(((to - from) / 1000) * rate);

    // sound: the narration clips and the sound effects, each at its moment; music underneath. A single step is silent.
    const clips = step ? [] : f.audio.map((c) => ({ file: resolve(dir, c.file), at: c.at, volume: 1 }));
    if (!step) { // sound effects: each a clip at its moment, a built-in one written out first
      const files = {};
      for (const s of f.sfx) {
        if (!files[s.name]) { const it = soundOf(p, s.name); files[s.name] = it.file ?? join(dir, `sfx-${s.name}.wav`); if (!it.file) writeFileSync(files[s.name], it.bytes); }
        clips.push({ file: files[s.name], at: s.at, volume: +(s.vol * f.sfxVolume).toFixed(3) });
      }
    }
    // music: from its start point, in and out with the film, lower while someone is speaking
    if (!step && f.presenter?.sound) clips.push({ file: resolve(dir, f.presenter.file), at: 0, volume: f.presenter.volume, start: f.presenter.start }); // the presenter's own sound
    const its = step ? null : f.music, music = its ? resolve(dir, its.file) : null, secs = (f.total / 1000).toFixed(3); // as the film page has it, so a film of several scenes is covered too
    const under = its ? [...f.audio, ...(f.presenter?.sound ? [{ at: 0, ms: f.total }] : [])].map((c) => `volume=${its.duck}:enable='between(t,${(c.at / 1000).toFixed(2)},${((c.at + c.ms) / 1000).toFixed(2)})'`) : [];
    const inputs = [...clips.flatMap((c) => ["-i", c.file]), ...(music ? [...(its.loop ? ["-stream_loop", "-1"] : []), "-i", music] : [])], n = clips.length + (music ? 1 : 0);
    const mix = n
      ? ["-filter_complex", [
          ...clips.map((c, i) => `[${i + 1}:a]${c.start ? `atrim=start=${c.start},asetpts=PTS-STARTPTS,` : ""}volume=${c.volume},adelay=${Math.round(c.at)}:all=1[a${i}]`),
          ...(music ? [`[${clips.length + 1}:a]${[`atrim=start=${its.start}`, "asetpts=PTS-STARTPTS", `volume=${its.volume}`, ...under, `atrim=0:${secs}`, ...(its.fadeIn > 0 ? [`afade=t=in:st=0:d=${its.fadeIn}`] : []), ...(its.fadeOut > 0 ? [`afade=t=out:st=${Math.max(0, f.total / 1000 - its.fadeOut).toFixed(3)}:d=${its.fadeOut}`] : [])].join(",")}[a${clips.length}]`] : []),
          `${Array.from({ length: n }, (_, i) => `[a${i}]`).join("")}amix=inputs=${n}:normalize=0[a]`,
        ].join(";"), "-map", "0:v", "-map", "[a]", "-c:a", "aac", "-b:a", "160k"]
      : [];
    const ff = spawn(bin, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(rate), "-c:v", "mjpeg", "-i", "-", ...inputs, ...mix, ...(blur ? ["-vf", `tmix=frames=5:weights=1 2 3 2 1,fps=${fps}`] : []),
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", "-t", ((to - from) / 1000).toFixed(3), out], { stdio: ["pipe", "inherit", "inherit"] });
    const finished = new Promise((ok, no) => ff.on("close", (code) => (code === 0 ? ok() : no(new Error(`ffmpeg exited ${code}`)))));
    for (let i = 0; i < frames; i++) {
      await page.evaluate((ms) => window.__film.frame(ms), from + (i * 1000) / rate);
      const frame = await page.screenshot({ type: "jpeg", quality: 92 });
      if (!ff.stdin.write(frame)) await new Promise((r) => ff.stdin.once("drain", r));
      if (i % (rate * 5) === 0) log(`  ${shape}: ${Math.round((i / frames) * 100)}%`);
    }
    ff.stdin.end();
    await finished;

    if (gif) return toGif(out);
    if (!step) {
      // the poster: the title card with its underline drawn; and the captions, each for as long as it is on screen
      await page.evaluate(() => window.__film.frame(2000));
      await page.screenshot({ path: join(dir, `${scene.name}-${shape}.jpg`), type: "jpeg", quality: 90 });
      if (f.captions.length) writeFileSync(join(dir, `${scene.name}${lang ? `.${lang}` : ""}.vtt`), `WEBVTT\n\n${f.captions.map((l) => `${stamp(l.from)} --> ${stamp(l.to)}\n${l.text}`).join("\n\n")}\n`);
    }
  } finally { await browser.close(); }
  return out;
}

// an MP4 as a GIF beside it: 960 wide, 15 frames a second, its own palette
function toGif(mp4) {
  const file = mp4.replace(/\.mp4$/, ".gif");
  execFileSync(ffmpeg(), ["-y", "-loglevel", "error", "-i", mp4, "-vf", "fps=15,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer", file]);
  return file;
}

// ---- export for a place: the right shape and the files that place wants, in one folder
//   scenlit export <scene> --for youtube      -> .scenlit/output/<scene>/export/youtube/
export const PLACES = {
  youtube: { shape: "wide", about: "1920×1080 MP4, thumbnail, captions (.vtt, .srt), transcript" },
  linkedin: { shape: "square", about: "1080×1080 MP4 with the captions drawn in (most people watch muted), captions file" },
  x: { shape: "wide", about: "1920×1080 MP4, captions file" },
  reels: { shape: "vertical", about: "1080×1920 MP4 for Reels, Shorts and TikTok" },
  docs: { shape: "wide", about: "MP4, poster, captions and the <video> tag to paste (embed.html)" },
  readme: { shape: "wide", gif: true, about: "a GIF, 960 wide, for a README or a changelog" },
  web: { about: "the film with its player, as a folder to put on any web host and embed like a video (no ffmpeg needed)" },
};

export async function exportFor(p, scene, place, options = {}) {
  const preset = PLACES[place];
  if (!preset) throw new Error(`no place "${place}" (${Object.keys(PLACES).join(", ")})`);
  if (place === "web") { const w = (await import("./film.mjs")).writeWeb(p, scene, { lang: options.lang }); return { dir: w.dir, files: ["index.html", "embed.html", `captures/ voice/ (${w.files} files)`] }; }
  // `made`: the MP4s already rendered in this command, by shape, so two places that want the same one share it
  const { made, ...rest } = options, mp4 = made?.get(preset.shape) ?? (await exportFilm(p, scene, { ...rest, shape: preset.shape }));
  made?.set(preset.shape, mp4);
  const file = preset.gif ? toGif(mp4) : mp4, from = dirname(file), to = join(from, "export", place);
  mkdirSync(to, { recursive: true });
  const keep = (name, as = name) => { if (existsSync(join(from, name))) { copyFileSync(join(from, name), join(to, as)); return as; } return null; };
  const ext = preset.gif ? "gif" : "mp4", lang = options.lang ? `.${options.lang}` : "", files = [];
  copyFileSync(file, join(to, `${scene.name}.${ext}`)); files.push(`${scene.name}.${ext}`);
  const vtt = join(from, `${scene.name}${lang}.vtt`);
  if (!preset.gif && existsSync(vtt)) {
    const text = readFileSync(vtt, "utf8"), cues = [...text.matchAll(/(\d\d:\d\d:\d\d)\.(\d{3}) --> (\d\d:\d\d:\d\d)\.(\d{3})\n(.+)/g)];
    writeFileSync(join(to, `${scene.name}.vtt`), text); files.push(`${scene.name}.vtt`);
    writeFileSync(join(to, `${scene.name}.srt`), cues.map((c, i) => `${i + 1}\n${c[1]},${c[2]} --> ${c[3]},${c[4]}\n${c[5]}\n`).join("\n")); files.push(`${scene.name}.srt`);
    if (place === "youtube" || place === "docs") { writeFileSync(join(to, "transcript.txt"), `${cues.map((c) => c[5]).join("\n")}\n`); files.push("transcript.txt"); }
  }
  if (place === "youtube") { const t = keep("thumbnail.png"); if (t) files.push(t); }
  if (place === "docs") {
    const poster = keep(`${scene.name}-${preset.shape}.jpg`, "poster.jpg"); if (poster) files.push(poster);
    writeFileSync(join(to, "embed.html"), `<video controls preload="none" poster="poster.jpg" width="100%">\n  <source src="${scene.name}.mp4" type="video/mp4">\n${existsSync(join(to, `${scene.name}.vtt`)) ? `  <track kind="captions" src="${scene.name}.vtt" srclang="${options.lang ?? "en"}" default>\n` : ""}</video>\n`);
    files.push("embed.html");
  }
  return { dir: to, files };
}
