// Sound effects. The built-in ones are made in code, so there is no file to ship and nothing to license: each is a
// short mono clip worked out sample by sample. A project's own go in .scenlit/sounds/<name>.wav (or .mp3, .m4a, .ogg)
// and win over a built-in one of the same name.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RATE = 44100, TAU = 2 * Math.PI;
// `secs` of sound from a function of time; `noise()` is the same every time, so a film sounds the same every time
const make = (secs, fn) => {
  const n = Math.round(secs * RATE), out = new Float32Array(n);
  let seed = 1234567;
  const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 31) - 1;
  const state = { phase: 0, low: 0 };
  for (let i = 0; i < n; i++) out[i] = fn(i / RATE, noise, state, i / n);
  return out;
};
const fall = (t, tau) => Math.exp(-t / tau);
// a tone whose pitch moves: the phase is added up, so the glide has no clicks in it
const glide = (state, hz) => { state.phase += (TAU * hz) / RATE; return Math.sin(state.phase); };

// one note: a tone that starts at `from` and dies away
const note = (t, from, hz, tau, shape = 0) => (t < from ? 0 : (Math.sin(TAU * hz * (t - from)) + shape * Math.sin(TAU * 3 * hz * (t - from))) * fall(t - from, tau));

const BUILT = {
  tick: () => make(0.06, (t) => Math.sin(TAU * 1700 * t) * fall(t, 0.012)),                                      // the old click: a short high tone
  tap: () => make(0.05, (t, noise) => (0.6 * Math.sin(TAU * 1100 * t) + 0.5 * noise()) * fall(t, 0.008)),         // a mouse click
  key: () => make(0.05, (t, noise) => (0.5 * Math.sin(TAU * 520 * t) + 0.45 * noise()) * fall(t, 0.011)),         // one key of a keyboard
  pop: () => make(0.12, (t, _n, s) => glide(s, 320 + 700 * Math.min(1, t / 0.09)) * fall(t, 0.035)),              // a word or a thing appearing
  whoosh: () => make(0.45, (_t, noise, s, k) => { const bell = Math.sin(Math.PI * k) ** 2; s.low += (0.02 + 0.3 * bell) * (noise() - s.low); return s.low * bell * 1.6; }), // something passing
  chime: () => make(0.9, (t) => 0.5 * (Math.sin(TAU * 880 * t) * fall(t, 0.25) + (t > 0.07 ? Math.sin(TAU * 1318.5 * (t - 0.07)) * fall(t - 0.07, 0.3) : 0))), // it worked
  swipe: () => make(0.22, (_t, noise, s, k) => { s.low += (0.05 + 0.5 * k) * (noise() - s.low); return s.low * Math.sin(Math.PI * k ** 0.6) * 1.8; }),   // a page turning over, a quick pass
  rise: () => make(1.2, (t, noise, s, k) => (0.5 * glide(s, 200 + 1000 * k * k) + 0.35 * noise() * k) * k * k * Math.min(1, (1 - k) / 0.02)),      // building up to something
  thud: () => make(0.35, (t, noise, s) => { s.low += 0.08 * (noise() - s.low); return glide(s, 38 + 42 * fall(t, 0.05)) * fall(t, 0.1) + 2 * s.low * fall(t, 0.02); }), // something heavy landing
  ding: () => make(1.0, (t) => note(t, 0, 1568, 0.35) + 0.4 * note(t, 0, 1568 * 2.76, 0.12)),                                                           // a small bell
  success: () => make(0.8, (t) => 0.6 * (note(t, 0, 1046.5, 0.22) + note(t, 0.09, 1318.5, 0.22) + note(t, 0.18, 1568, 0.3))),                         // three notes going up
  error: () => make(0.45, (t) => 0.7 * (note(t, 0, 311.1, 0.09, 0.3) + note(t, 0.17, 233.1, 0.12, 0.3))),                                              // two low notes going down
  notify: () => make(0.6, (t) => 0.6 * (note(t, 0, 880, 0.18) + note(t, 0.12, 1174.7, 0.22))),                                                         // a message arriving
  shutter: () => make(0.14, (t, noise) => noise() * (fall(t, 0.006) + (t > 0.06 ? fall(t - 0.06, 0.008) : 0)) + 0.5 * note(t, 0, 150, 0.02)),          // a picture being taken
  sparkle: () => make(0.7, (t) => 0.4 * [2093, 2637, 3136, 3951, 4186].reduce((v, hz, i) => v + note(t, i * 0.06, hz, 0.12), 0)),                      // something new, something nice
  boom: () => make(0.7, (t, noise, s) => glide(s, 42 + 53 * fall(t, 0.09)) * fall(t, 0.22) + 0.5 * noise() * fall(t, 0.01)), // a title landing
};
export const SOUNDS = Object.keys(BUILT);

// 16-bit mono WAV, as loud as it can be without clipping
const wav = (samples, rate = RATE) => {
  const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1, data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round((v / peak) * 0.9 * 32767), i * 2));
  const head = Buffer.alloc(44);
  head.write("RIFF", 0); head.writeUInt32LE(36 + data.length, 4); head.write("WAVEfmt ", 8); head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write("data", 36); head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
};

const TYPES = { wav: "audio/wav", mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg" };
const own = (p, name) => Object.keys(TYPES).map((ext) => join(p.dir, "sounds", `${name}.${ext}`)).find((f) => existsSync(f)) ?? null;
// a sound by name: { bytes, type }. Throws when there is none, saying which there are.
export function sound(p, name) {
  const file = own(p, name);
  if (file) return { bytes: readFileSync(file), type: TYPES[file.split(".").pop()], file };
  if (!BUILT[name]) throw new Error(`no sound named "${name}". Built in: ${SOUNDS.join(", ")}. Your own go in .scenlit/sounds/${name}.wav`);
  return { bytes: wav(BUILT[name]()), type: "audio/wav", file: null };
}
export const soundUri = (p, name) => { const s = sound(p, name); return `data:${s.type};base64,${s.bytes.toString("base64")}`; };
// every sound a film plays: the ones its style gives to clicks, cards and so on, and the ones its steps ask for
// A step's `sound` as the film reads it: a list of { name, at, delay, volume }. `at` is "result" (when what the step did
// shows, the default), "start" or "end"; `delay` is milliseconds after that; `volume` is 0 to 1.
const MOMENTS = ["result", "start", "end"];
export const asSounds = (sound) => (sound == null || sound === false ? [] : [sound].flat()).map((s) => (typeof s === "string" ? { name: s } : s)).map((s) => {
  if (!s?.name) throw new Error(`a step's sound is a name ("chime") or { name, at, delay, volume }; got ${JSON.stringify(s)}`);
  if (s.at != null && !MOMENTS.includes(s.at)) throw new Error(`sound "${s.name}": at is one of ${MOMENTS.join(", ")}; got "${s.at}"`);
  return { name: s.name, at: s.at ?? "result", delay: +s.delay || 0, volume: s.volume ?? 1 };
});
// A scene's `cues`: sounds at moments of the film itself. `at`: seconds from the start (2.5), from the end (-3), or
// "title", "app" (the window arrives), "end" (the end card arrives).
export const asCues = (cues) => (cues ?? []).map((c) => {
  if (!c?.name || !(typeof c.at === "number" || ["title", "app", "end"].includes(c.at))) throw new Error(`a cue is { name, at }, with at in seconds (negative: from the end) or "title", "app", "end"; got ${JSON.stringify(c)}`);
  return { name: c.name, at: c.at, delay: +c.delay || 0, volume: c.volume ?? 1 };
});
export const soundsOf = (style, capture, cues = []) => [...new Set([
  ...Object.entries(style.sounds ?? {}).filter(([k, v]) => k !== "volume" && v).map(([, v]) => v),
  ...capture.steps.flatMap((s) => (s.sound ?? []).map((x) => x.name)), ...cues.map((c) => c.name)])];

// ---- music beds: a few bars that loop without a seam, made in code like the effects. Not a composition: a quiet
// ground for a film to stand on. `calm`: slow chords. `pulse`: the same chords with a soft beat and a bass under them.
const BED_RATE = 22050, BEAT = 0.6, BAR = 4 * BEAT, EDGE = 0.4; // 100 beats a minute; each chord lasts a bar and melts into the next
const hz = (semitonesFromA4) => 440 * 2 ** (semitonesFromA4 / 12);
const CHORDS = [[-28, -16, -9, -5], [-24, -12, -9, -2], [-21, -17, -14, -5], [-26, -14, -10, -7]].map((c) => c.map(hz)); // F, A minor, C, G: low root, three voices
const bedOf = (beat) => {
  const L = CHORDS.length * BAR, n = Math.round(L * BED_RATE), out = new Float32Array(n);
  let seed = 7654321;
  const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 31) - 1;
  for (let i = 0; i < n; i++) {
    const t = i / BED_RATE;
    let v = 0;
    CHORDS.forEach((notes, c) => { // each chord from a little before its bar to a little after, measured in its own time so the loop has no click
      const u = (((t - c * BAR + EDGE) % L) + L) % L;
      if (u >= BAR + 2 * EDGE) return;
      const env = u < 2 * EDGE ? Math.sin((Math.PI / 2) * (u / (2 * EDGE))) ** 2 : u > BAR ? Math.cos((Math.PI / 2) * ((u - BAR) / (2 * EDGE))) ** 2 : 1;
      for (const [k, f] of notes.entries()) v += env * (k ? 0.16 : 0.22) * (Math.sin(TAU * f * u) + Math.sin(TAU * f * 1.003 * u) + 0.25 * Math.sin(TAU * 2 * f * u));
    });
    if (beat) {
      const b = t % BEAT, bar = Math.floor(t / BAR) % CHORDS.length, off = (t + BEAT / 2) % BEAT;
      v += 0.9 * Math.sin(TAU * (45 * b + 65 * 0.03 * (1 - Math.exp(-b / 0.03)))) * Math.exp(-b / 0.11);       // a soft kick on every beat
      v += 0.3 * (Math.sin(TAU * CHORDS[bar][0] * b) + 0.3 * Math.sin(TAU * 2 * CHORDS[bar][0] * b)) * Math.exp(-b / 0.22); // the bass plays the chord's root
      v += 0.05 * noise() * Math.exp(-off / 0.015);                                                               // a tick between the beats
    }
    out[i] = v;
  }
  return out;
};
const BED = { calm: () => bedOf(false), pulse: () => bedOf(true) };
export const BEDS = Object.keys(BED);
export const bed = (name) => wav(BED[name](), BED_RATE);

// what each built-in sound is for, for `scenlit sounds`
export const ABOUT = {
  tap: "a mouse click", key: "one key of a keyboard", tick: "a short high tone", pop: "a word or a thing appearing", swipe: "a page turning over",
  whoosh: "something passing", rise: "building up to something", boom: "a title landing", thud: "something heavy landing", ding: "a small bell",
  chime: "it worked", success: "three notes going up", error: "two low notes going down", notify: "a message arriving", shutter: "a picture being taken", sparkle: "something new",
  calm: "music: slow chords", pulse: "music: the same chords with a soft beat",
};
// the list as text; with `to`, every built-in sound and bed is also written there as a .wav, to listen to
export function soundsText(p, to = null) {
  const mine = existsSync(join(p.dir, "sounds")) ? readdirSync(join(p.dir, "sounds")).filter((f) => /\.(wav|mp3|m4a|ogg)$/.test(f)) : [];
  if (to) { mkdirSync(to, { recursive: true }); for (const n of SOUNDS) writeFileSync(join(to, `${n}.wav`), sound({ dir: "" }, n).bytes); for (const n of BEDS) writeFileSync(join(to, `${n}.wav`), bed(n)); }
  return ["Sound effects, made in code (nothing to license):", ...SOUNDS.map((n) => `  ${n.padEnd(9)} ${ABOUT[n] ?? ""}`), "", "Music beds:", ...BEDS.map((n) => `  ${n.padEnd(9)} ${ABOUT[n]}`), "",
    mine.length ? `Your own (.scenlit/sounds/): ${mine.join(", ")}` : "Your own go in .scenlit/sounds/<name>.wav (or .mp3, .m4a, .ogg) and win over a built-in one of the same name.",
    "", "Where a sound plays:", '  the style, one per kind of moment   "sounds": { "click": "tap", "cut": "swipe", "end": "thud" }',
    '  a step                              click("Pay", { sound: "success" })  or  { sound: { name: "ding", at: "end", delay: 300, volume: 0.6 } }',
    '  a step of its own                   await sound("notify")', '  a moment of the film                cues: [{ name: "rise", at: -3 }, { name: "thud", at: "end" }]',
    ...(to ? ["", `Written to ${to} to listen to.`] : ["", "scenlit sounds --save writes them out as .wav files to listen to."])].join("\n");
}

