// Narration: one clip per spoken line, kept in .scenlit/voice by what is said and who says it, so a line is
// recorded once and reused. The film gives each step at least as long as its clip.
// A step's spoken line is its caption (`say: "Paid."`), or its own sentence (`say: { text: "Paid.", voice: "And
// just like that, the order is paid." }`).
//
// Who speaks is a provider. Built in:
//   say         the Mac's own voice. Free, for drafts.
//   elevenlabs  ELEVENLABS_API_KEY. Costs credits.
//   openai      OPENAI_API_KEY. Costs credits.
//   command     any program: "voice": { "provider": "command", "command": "piper -m en.onnx -f {file}" }
//               ({text} and {file} are filled in; without {text} the line is given on standard input)
// Or your own: "provider": "./tools/voice.mjs", a module whose default export is
//   async (text, { file, voice, model, lang }) => { /* write the audio to `file` (an .mp3 path) */ }
// Paid providers only ever run from `scenlit voice`.
import { execFileSync, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const has = (bin) => { try { execFileSync(process.platform === "win32" ? "where" : "which", [bin], { stdio: "ignore" }); return true; } catch { return false; } };
export const ffmpeg = () => { if (!has("ffmpeg")) throw new Error("this needs ffmpeg (https://ffmpeg.org; on a Mac: brew install ffmpeg)"); return "ffmpeg"; };
const lengthMs = (file) => Math.round(parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString()) * 1000);
const toMp3 = (from, mp3) => { execFileSync(ffmpeg(), ["-y", "-loglevel", "error", "-i", from, "-ac", "1", "-b:a", "128k", mp3]); rmSync(from); };

const PROVIDERS = {
  async say(text, { file, voice }) {
    if (!has("say")) throw new Error('the "say" voice is only on a Mac; use another provider');
    const aiff = file.replace(/\.mp3$/, ".aiff");
    execFileSync("say", [...(voice ? ["-v", voice] : []), "-o", aiff, text]);
    toMp3(aiff, file);
  },
  async elevenlabs(text, { file, voice, model }) {
    const key = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
    if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
    const headers = { "xi-api-key": key };
    let id = voice ?? "George";
    if (!/^[A-Za-z0-9]{20}$/.test(id)) {
      const list = (await (await fetch("https://api.elevenlabs.io/v1/voices", { headers })).json()).voices ?? [];
      const found = list.find((x) => x.name.toLowerCase().startsWith(id.toLowerCase()));
      if (!found) throw new Error(`ElevenLabs has no voice "${id}" (${list.map((x) => x.name.split(" ")[0]).join(", ")})`);
      id = found.voice_id;
    }
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ text, model_id: model ?? "eleven_v4" }) });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  },
  async openai(text, { file, voice, model }) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    const res = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: model ?? "gpt-4o-mini-tts", voice: voice ?? "alloy", input: text, response_format: "mp3" }) });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  },
  async command(text, { file, settings }) {
    if (!settings.command) throw new Error('the "command" voice needs "command": "<program> … {file}" in the voice settings');
    const raw = file.replace(/\.mp3$/, ".wav"), quote = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;
    execSync(settings.command.replace("{file}", quote(raw)).replace("{text}", quote(text)), { input: settings.command.includes("{text}") ? undefined : text, stdio: ["pipe", "ignore", "inherit"] });
    if (!existsSync(raw)) throw new Error(`the voice command did not write ${raw}`);
    toMp3(raw, file);
  },
};

async function providerOf(p, v) {
  if (PROVIDERS[v.provider]) return PROVIDERS[v.provider];
  if (/\.(mjs|js)$/.test(v.provider)) {
    const file = resolve(p.root, v.provider);
    if (!existsSync(file)) throw new Error(`the voice provider ${v.provider} is not in this project`);
    const fn = (await import(pathToFileURL(file).href)).default;
    if (typeof fn !== "function") throw new Error(`${v.provider}: export default async (text, { file, voice, model, lang }) => { … }`);
    return fn;
  }
  throw new Error(`unknown voice provider "${v.provider}" (${Object.keys(PROVIDERS).join(", ")}, none, or a module of your own such as "./tools/voice.mjs")`);
}

// the voice settings for a language: "voices": { "de": { "voice": "Anna" } } lies over the main ones
const settingsFor = (p, lang) => ({ ...p.config.voice, ...(lang ? p.config.voice.voices?.[lang] : null) });
// what is sent to the voice: the line, with the project's pronunciations ("says": { "Scenlit": "Seen lit" })
const spoken = (v, line) => Object.entries(v.says ?? {}).reduce((s, [from, to]) => s.split(from).join(to), line);
const linesOf = (capture) => [...new Set(capture.steps.filter((s) => !s.clip).map((s) => s.speak ?? s.say).filter(Boolean))]; // a step with its own recording is not sent to a voice
const idOf = (v, line) => createHash("sha1").update([v.provider, v.voice ?? "", v.model ?? "", spoken(v, line)].join("|")).digest("hex").slice(0, 12);
const index = (p) => { const f = join(p.voice, "clips.json"); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {}; };

// a recording: how long it is, and whether it has sound (needs ffmpeg's ffprobe)
export const mediaOf = (file) => {
  const it = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", file]).toString());
  return { ms: Math.round(parseFloat(it.format.duration) * 1000), sound: it.streams.some((x) => x.codec_type === "audio") };
};

// your own recording of a line, kept beside the other clips (so the film and its web export find it) and measured
function ownClip(p, path) {
  const from = resolve(p.root, path);
  if (!existsSync(from)) throw new Error(`no recording at "${path}" (a step's say: { file } is a path in your project)`);
  const info = statSync(from), file = `own-${createHash("sha1").update(`${from}|${info.size}|${info.mtimeMs}`).digest("hex").slice(0, 12)}${extname(from)}`;
  mkdirSync(p.voice, { recursive: true });
  if (!existsSync(join(p.voice, file))) copyFileSync(from, join(p.voice, file));
  try { return { file, ms: lengthMs(join(p.voice, file)) }; }
  catch { throw new Error(`could not read how long "${path}" is: that needs ffmpeg (its ffprobe), and a file it can read`); }
}

// the clips this capture's lines already have, for the film: { "<line>": { file, ms } }
export function clipsFor(p, capture, lang = null) {
  const v = settingsFor(p, lang), all = index(p), out = {};
  // a step's own recording (say: { text, file }), in the language it was recorded in: no voice provider is needed
  if (!lang) for (const s of capture.steps) if (s.clip) out[s.speak] = ownClip(p, s.clip);
  if (v.provider === "none") return out;
  for (const line of linesOf(capture)) { const c = all[idOf(v, line)]; if (c && existsSync(join(p.voice, c.file))) out[line] = c; }
  return out;
}

// record what is missing (or, with retake, everything)
export async function recordVoice(p, capture, { retake = false, lang = null, log = console.log } = {}) {
  const v = settingsFor(p, lang);
  if (v.provider === "none") throw new Error('no voice is set. In .scenlit/config.json: "voice": { "provider": "say" } (free, a Mac), "elevenlabs" or "openai" (cost credits), "command", or a module of your own');
  const speak = await providerOf(p, v), all = index(p);
  mkdirSync(p.voice, { recursive: true });
  let made = 0;
  for (const line of linesOf(capture)) {
    const id = idOf(v, line), file = `${id}.mp3`, path = join(p.voice, file), tmp = join(p.voice, `${id}.new.mp3`);
    if (!retake && all[id] && existsSync(path)) continue;
    await speak(spoken(v, line), { file: tmp, voice: v.voice, model: v.model, lang, settings: v });
    if (!existsSync(tmp)) throw new Error(`the voice provider did not write the clip for: ${line}`);
    renameSync(tmp, path);
    all[id] = { file, ms: lengthMs(path), line }; made++;
    log(`  recorded: ${line}`);
  }
  writeFileSync(join(p.voice, "clips.json"), `${JSON.stringify(all, null, 2)}\n`);
  return made;
}
