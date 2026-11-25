// Where things live, and the project's settings (.scenlit/config.json) over the defaults.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkSave } from "./save.mjs";
import { withCards } from "./cards.mjs";

// what the cartoon and sketch looks do to the app while it is captured: heavier outlines, rounder corners, a hand's lettering
const HAND = '"Chalkboard SE", "Comic Sans MS", "Comic Neue", "Marker Felt", cursive';
const CARTOON = `*{font-family:${HAND} !important}
button,input,select,textarea,table,[class*=card],[class*=panel],[class*=box],[role=dialog],dialog{border:2.5px solid #1a1a1a !important;border-radius:16px !important;box-shadow:5px 5px 0 #1a1a1a !important}
button,[role=button]{font-weight:700 !important}`;
const SKETCH = `*{font-family:${HAND} !important;box-shadow:none !important}
button,input,select,textarea,table,[class*=card],[class*=panel],[class*=box],[role=dialog],dialog{border:2px solid #222 !important;border-radius:8px !important}`;

// type for the kinds of film that want a heavy grotesk: Inter Tight when the project brings it, else the system's own
const GROTESK = '"Inter Tight", "SF Pro Display", -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif';
const HEAVY = ".card{font-weight:800;letter-spacing:-.045em;line-height:.98}.card .lead{opacity:.5}", MEDIUM = ".card{font-weight:500;letter-spacing:-.035em;line-height:1.05}.card .lead{font-weight:400}";

export const DEFAULTS = {
  // the app the scenes run against. `start`: the command that starts it when it is not up. `as`: the address films show.
  app: { url: "http://localhost:3000", start: null, as: null },
  // how the films and posts look
  brand: {
    name: "", url: "", theme: "night", // night, paper (light) or plain: a set of colours, under the ones written here
    background: "#07090d", glow: "#1b2a3f", text: "#f3f1ea", muted: "#8d939e", accent: "#f5b63a",
    font: '-apple-system, "Helvetica Neue", Arial, sans-serif', titleFont: 'Georgia, "Times New Roman", serif',
    fontImport: null, // a stylesheet address (for example Google Fonts) that brings `font` / `titleFont`
  },
  // how the app is captured. A smaller viewport gives bigger type in the film. `hide`: selectors to hide (cookie
  // banners, chat bubbles, dev toolbars). `css`: extra CSS for the app while it is captured.
  // `device`: desktop, phone or tablet (the frame the film draws). `scheme`: dark or light. `locale`: the language the
  // app is asked for, for example "de-DE". `motion`: record what the app does between the two pictures of an action.
  // `vector`: also keep each page as HTML and CSS, so films and posts stay sharp at any size.
  // A look can also restyle: `css` changes the app itself while it is captured, `filter` is a CSS filter laid on every
  // picture (built in: url(#nt-sketch), url(#nt-toon), url(#nt-blueprint)), and `style` changes the film around it.
  look: { viewport: { width: 1280, height: 800 }, hide: [], css: "", settle: 600, device: "desktop", scheme: null, locale: null, motion: true, vector: true, filter: null, style: null },
  // other looks, each laid over `look`. A scene picks one with `look: "marketing"` (`scenlit look` proposes it).
  looks: {
    phone: { viewport: { width: 390, height: 844 }, device: "phone" },
    tablet: { viewport: { width: 820, height: 1180 }, device: "tablet" },
    dark: { scheme: "dark" }, light: { scheme: "light" },
    // drawn styles: the same app and the same scene, in another hand
    cartoon: {
      css: CARTOON, filter: "url(#nt-toon) saturate(1.2)", brand: { text: "#17140c", muted: "#5b4a17", accent: "#17140c" },
      style: { background: { kind: "solid", colors: ["#ffd84d"], dots: false }, window: { bar: "light", radius: 26, shadow: "hard" }, cursor: { size: 56 }, captions: { look: "pill" }, motion: { enter: "grow", click: "pulse" } },
    },
    sketch: {
      css: SKETCH, filter: "url(#nt-sketch) grayscale(1) contrast(1.15)", brand: { text: "#1c1b19", muted: "#6b675e", accent: "#1c1b19" },
      style: { background: { kind: "solid", colors: ["#f4f1ea"], dots: false }, window: { bar: "none", radius: 6, shadow: "none" }, cursor: { color: "#1c1b19" }, captions: { look: "plain" } },
    },
    blueprint: {
      filter: "url(#nt-blueprint)",
      style: { background: { kind: "solid", colors: ["#16408a"], dots: true }, window: { bar: "none", radius: 4, shadow: "none" } },
    },
  },
  // where scenes are looked for besides .scenlit/scenes: folders of your project, searched for *.scene.mjs / .js / .ts,
  // so a scene can live next to the feature it shows
  scenes: ["."],
  // saved logins kept elsewhere, by name: reuse the one your Playwright tests make: { "member": "playwright/.auth/user.json" }
  sessions: {},
  // where every scene's results are also kept in your project: { film: "public/films/{scene}", video: "public/{scene}.mp4" }
  // (film, video, posts, guide, demo, thumbnail). A scene's own `save` adds to it or replaces a place.
  save: {},
  // the platform `scenlit publish` sends videos to (its address; SCENLIT_PORTAL or --to say it for one run), and the
  // product they belong to there (letters, digits and dashes; else made from the brand's name)
  portal: null,
  product: null,
  // sample data for every scene: text to replace, selectors to blur, and the date the app believes it is
  data: { replace: {}, blur: [], date: null },
  // how films and posts are styled. Every part can be set here, per format, or per scene (`style: {...}`).
  style: {
    background: { kind: "glow", colors: null, angle: 160, image: null, dots: true }, // glow | gradient | solid | image
    window: { bar: "dark", radius: 14, shadow: "soft", scale: 1, fill: false },      // bar: dark | light | none; shadow: soft | hard | flat | none; fill: the page is the whole frame
    // name: words beside the cursor, as on a shared canvas. guests: others' cursors about it: [{ name, color }]. show: false, none
    cursor: { size: 44, color: "#ffffff", ring: true, name: null, guests: [], show: true },
    board: false,                                                                     // true: the places of the film are frames side by side on one canvas, and the camera travels between them
    select: null,                                                                     // the colour of a selection (the "select" spotlight)
    // zoom: 1 keeps the camera still. tilt: [x, y] in degrees turns the window in space, and it swings slowly to the other
    // side as the film goes. drift: the whole picture comes this much closer over the film (0.04 = 4%), so it never stands
    // still. parallax: how much the background follows the camera (0.05), which gives depth to a glow or an image.
    camera: { zoom: null, speed: 1, tilt: null, drift: 0, parallax: 0 },
    captions: { show: true, position: "bottom", size: 1, look: "pill" },              // look: pill | plain | bold (big words, for vertical shorts)
    titles: { show: true, animation: "rise", underline: true, size: 1, align: "center" }, // animation: rise | fade | words | slam; show: false starts straight in the app
    end: { show: true, button: null, sting: false },                                  // sting: the logo lands first, large, then the words                                                // button: words on a button under the end card; show: false ends on the app
    logo: null,                                                                       // an image in your project: on the cards and on posts
    pace: 1,                                                                          // above 1: more time on every step
    motion: {},                                                                       // which piece moves what: { cut: "slide", enter: "grow", click: "pulse" } (scenlit motion list)
    // a sound effect for each kind of moment (scenlit sounds lists them; your own go in .scenlit/sounds/). card: every card,
    // unless title, chapter or end says otherwise. cut: the page changes between two steps. fast: a fast-forward begins.
    sounds: { click: null, type: null, caption: null, card: null, title: null, chapter: null, end: null, enter: null, exit: null, cut: null, zoom: null, point: null, label: null, animate: null, fast: null, piece: null, word: null, logo: null, overlay: null, volume: 0.5 },
    // music under the film. `file`: a track in your project, or a built-in bed ("calm", "pulse"). `volume`: 0 to 1.
    // `start`: seconds into the track. `duck`: how far it sinks under narration
    // (0.45 = to 45%). The viewer has a sound button and a volume slider in the player.
    // `cuts`: cards and the window arrive on the beat (needs `bpm`; the built-in beds know theirs).
    music: { file: null, volume: 0.15, start: 0, fadeIn: 0.6, fadeOut: 1.5, duck: 0.45, loop: true, bpm: null, cuts: false },
    // the last touches: a soft light behind the window (true: the accent colour, or a colour), film grain (0.05) and
    // darker corners (0.3)
    finish: { light: null, grain: 0, vignette: 0 },
    // the player around the film (never part of an MP4). accent: the colour of its controls (the brand's when not given).
    // controls: which it has, in this order: any of play, scrub, time, sound, captions, speed, chapters, fullscreen;
    // false: none, and a click on the film plays and pauses it. poster: what waits before the film is played: seconds
    // into the film, or a picture in your project. captions: whether they start on. speed: how fast it plays (1.5).
    // autoplay: it starts by itself, with its sound off until the viewer turns it on. loop: it starts again at its end.
    // tour: a click-through demo: the film stops at every click, choice and typing, and the viewer does it.
    // marks: the places a viewer can go to, shown on the bar and listed under "chapters": the film's chapter cards,
    // or in a film without any, each step that says something. "chapters" or "steps" to choose; false: none.
    player: { accent: null, controls: ["play", "scrub", "time", "sound", "fullscreen"], marks: true, poster: null, captions: true, speed: 1, autoplay: false, loop: false, tour: false },
    // source: the film shows its own scene file down the left, the app beside it, and lights the line now playing,
    // joined by a band of light to what that line does. true, or { font } for the code's typeface
    source: false,
    sheet: null,                                                                      // CSS as text (a format brings its own this way); `css` is a file
    spotlight: 0.6,                                                                   // how dark the rest goes when something is pointed at
    css: null,                                                                        // a CSS file laid over everything (.scenlit/style.css is used when it exists)
  },
  // kinds of film: each a set of style changes, and when it needs them its own colours and fonts (`brand`), a look
  // (`look`: "phone") and a frame shape (`shape`: wide, square or vertical). A scene picks one with `format: "tutorial"`,
  // or the command line does for any scene: scenlit run checkout --format trailer. Add your own here.
  formats: {
    // a launch trailer: black, heavy words that land hard, quick shots; chapter() cards carry the story
    trailer: {
      brand: { background: "#000000", glow: "#000000", text: "#ffffff", muted: "#ffffff", font: GROTESK, titleFont: GROTESK },
      titles: { animation: "slam", underline: false, size: 2.1 }, captions: { show: false }, pace: 0.5, window: { bar: "none", radius: 22 },
      background: { kind: "solid", colors: ["#000000"], dots: false }, camera: { zoom: 1.5, speed: 1.5 },
      motion: { cut: "slide", enter: "grow", exit: "drop", click: "pulse" }, sounds: { card: "boom", enter: "whoosh", click: "tap" }, sheet: HEAVY,
    },
    // a shared design canvas: light grey, the app's places as frames side by side and named, the camera travelling
    // from one to the next, people's named cursors about, and what is pointed at selected with its size
    canvas: {
      brand: { background: "#e6e6e6", glow: "#e6e6e6", text: "#111111", muted: "#6b6b6b", font: GROTESK, titleFont: GROTESK },
      titles: { animation: "words", underline: false, size: 1.3 }, window: { bar: "none", radius: 10, shadow: "flat", scale: 0.78 },
      background: { kind: "solid", colors: ["#e6e6e6"], dots: false }, camera: { zoom: 1.3 }, board: true,
      cursor: { size: 40, color: "#0d99ff", name: "You", guests: [{ name: "Sam" }, { name: "Alex" }] },
      motion: { spotlight: "select", enter: "fade", click: "ring" }, sounds: { click: "tap", cut: "swipe" }, sheet: MEDIUM,
    },
    // a launch film: pieces of the app staged one at a time on a dark set, a soft light behind them, a window turned in
    // space that never quite stands still, words that land with the voice. Write it with piece(), words() and animate().
    launch: {
      brand: { background: "#09090b", glow: "#09090b", text: "#f5f4f0", muted: "#9b9a95", font: GROTESK, titleFont: GROTESK },
      titles: { animation: "words", underline: false, size: 1.15 }, captions: { size: 0.9 }, window: { bar: "none", radius: 20, scale: 0.84 },
      background: { kind: "solid", colors: ["#09090b"], dots: false }, camera: { zoom: 1.25, speed: 0.8, tilt: [4, -9], drift: 0.04, parallax: 0.05 },
      motion: { enter: "grow", cut: "grow", spotlight: "focus", caption: "words" }, finish: { light: true, grain: 0.05, vignette: 0.3 }, end: { sting: true },
      sounds: { click: "tap", type: "key", piece: "pop", end: "thud", logo: "ding" }, sheet: MEDIUM,
    },
    // the scene's own code: the scene file down the left, the app beside it, the line now playing lit and joined by a
    // band of light to what it does; words as numbered lit lines, and colour fields between (words with a field).
    // Blue-black ink, Funnel Display, Funnel Sans and Fragment Mono. The accent is the project's own. Wide films
    source: {
      brand: { background: "#0d1117", glow: "#0d1117", text: "#ecebe6", muted: "#5d6472", font: '"Funnel Sans", -apple-system, sans-serif', titleFont: '"Funnel Display", -apple-system, sans-serif', fontImport: "https://fonts.googleapis.com/css2?family=Funnel+Display:wght@500;700;800&family=Funnel+Sans:wght@400;600&family=Fragment+Mono&display=swap" },
      source: true, titles: { animation: "words", underline: false, size: 1.15, align: "left" }, captions: { size: 0.95 }, window: { bar: "none", radius: 18 },
      background: { kind: "solid", colors: ["#0d1117"], dots: false }, camera: { zoom: 1.25, speed: 0.8 },
      motion: { enter: "grow", cut: "grow", spotlight: "focus", caption: "words" }, finish: { light: false, grain: 0.035, vignette: 0 },
      sounds: { click: "tap", type: "key", piece: "pop", end: "thud" },
    },
    // a polished screen recording: a colour gradient, a big cursor, the camera after every click, no cards
    recording: {
      titles: { show: false }, end: { show: false }, background: { kind: "gradient", colors: ["#ffb347", "#ff7a59", "#e8436a"], angle: 135, dots: false },
      window: { bar: "light", radius: 18, scale: 0.9 }, cursor: { size: 62 }, camera: { zoom: 1.45 }, motion: { click: "pulse", enter: "grow" }, sounds: { click: "tap", type: "key" },
    },
    // a vertical short: the app on a phone, big captions word by word above it
    short: {
      shape: "vertical", look: "phone", brand: { background: "#0b0b0b", glow: "#0b0b0b", text: "#ffffff", muted: "#ffffff", accent: "#ffe14d", font: GROTESK, titleFont: GROTESK },
      titles: { animation: "slam", underline: false, size: 1.3 }, pace: 0.8, captions: { look: "bold", position: "top", size: 1.7 }, motion: { caption: "words" },
      window: { scale: 0.8 }, background: { kind: "solid", colors: ["#0b0b0b"], dots: false }, sounds: { card: "boom", caption: "pop", click: "tap" },
      sheet: `${HEAVY}\n[data-shape="vertical"] .win{margin-top:190px}[data-shape="vertical"] .cap{top:120px}.cap .w:last-child{color:var(--accent)}`,
    },
    // a keynote moment: the app in dark mode on black, a slow camera, one thing at a time
    keynote: {
      look: "dark", brand: { background: "#000000", glow: "#000000", text: "#ffffff", muted: "#8e8e93", font: GROTESK, titleFont: GROTESK },
      titles: { animation: "fade", underline: false, size: 1.15 }, pace: 1.3, spotlight: 0.82, camera: { zoom: 1.35, speed: 0.6, drift: 0.03 },
      window: { bar: "none", radius: 24, shadow: "none" }, background: { kind: "solid", colors: ["#000000"], dots: false }, sounds: { animate: "pop" }, sheet: MEDIUM,
    },
    // a loop for a README or a docs page: no cards, no captions, a still camera (play it with ?background, or export --gif)
    loop: {
      titles: { show: false }, end: { show: false }, captions: { show: false }, camera: { zoom: 1 }, window: { bar: "none", radius: 14, shadow: "none" },
      background: { kind: "solid", colors: ["#ffffff"], dots: false }, cursor: { color: "#17181c" },
    },
    demo: { titles: { animation: "words" } },
    tutorial: { titles: { animation: "fade", size: 0.8 }, camera: { zoom: 1.08 }, pace: 1.25, background: { kind: "solid", dots: false } },
    feature: { pace: 0.9, end: { button: "See what's new" } },
  },
  // who works out the steps on a first run. claude-code: the Claude Code login on this machine (no key).
  // anthropic: the Claude API, or any API that speaks it. openai: any API that speaks OpenAI's chat completions
  // (OpenAI, OpenRouter, Ollama, LM Studio, vLLM, …). url: the API's address when it is not the provider's own; key:
  // the name of the environment variable that holds the key; model: which model.
  model: { provider: "claude-code", model: null, url: null, key: null },
  // narration. none: captions only. say: the Mac's own voice (free, for drafts). elevenlabs: ELEVENLABS_API_KEY, costs credits.
  voice: { provider: "none", voice: null, model: null },
};

// themes: colours a brand starts from; what config.json says wins
export const THEMES = {
  night: {},
  paper: { background: "#f4f1ea", glow: "#e2dccd", text: "#1c1b19", muted: "#7a756a" },
  plain: { background: "#0b0d11", glow: "#0b0d11" },
};

export const CONTROLS = ["play", "scrub", "time", "sound", "captions", "speed", "chapters", "fullscreen"]; // what a film's player can have
export const merge = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) out[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? merge(a[k], v) : v;
  return out;
};

const withTheme = (config, settings) => {
  const theme = THEMES[config.brand.theme];
  if (!theme) throw new Error(`unknown theme "${config.brand.theme}" (${Object.keys(THEMES).join(", ")})`);
  config.brand = { ...config.brand, ...theme, ...(settings.brand ?? {}) };
  return config;
};

// looks and kinds of film kept one to a file (.scenlit/looks/<name>.json, .scenlit/formats/<name>.json), as `scenlit
// add` installs them; config.json's own of the same name win
function pieces(dir, kind) {
  const folder = join(dir, kind);
  if (!existsSync(folder)) return {};
  return Object.fromEntries(readdirSync(folder).filter((f) => /^[\w-]+\.json$/.test(f)).map((f) => {
    try { return [f.slice(0, -5), JSON.parse(readFileSync(join(folder, f), "utf8"))]; } catch (e) { throw new Error(`${join(folder, f)}: ${e.message}`); }
  }));
}

export function project(root = process.cwd()) {
  const dir = join(root, ".scenlit"), file = join(dir, "config.json");
  const settings = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const p = {
    root, dir, file, exists: existsSync(file), settings,
    config: withTheme(merge(DEFAULTS, { ...settings, looks: { ...pieces(dir, "looks"), ...settings.looks }, formats: { ...pieces(dir, "formats"), ...settings.formats } }), settings),
    scenes: join(dir, "scenes"), recordings: join(dir, "recordings"), captures: join(dir, "captures"),
    voice: join(dir, "voice"), output: join(dir, "output"), sessionDir: join(dir, "sessions"),
  };
  p.ensure = () => { for (const d of [p.scenes, p.recordings, p.captures, p.output]) mkdirSync(d, { recursive: true }); return p; };
  // a component by name: the project's own (.scenlit/components/), else one of the built-in ones
  p.component = (name) => {
    const own = join(dir, "components", `${name}.html`), builtIn = fileURLToPath(new URL(`../templates/components/${name}.html`, import.meta.url));
    if (existsSync(own)) return own;
    if (existsSync(builtIn)) return builtIn;
    throw new Error(`no component "${name}". Built in: ${p.builtInComponents().join(", ")}. Your own: scenlit component new ${name}`);
  };
  p.builtInComponents = () => readdirSync(fileURLToPath(new URL("../templates/components/", import.meta.url))).filter((f) => f.endsWith(".html")).map((f) => f.replace(/\.html$/, "")).sort();
  p.session = (as = "default") => (p.config.sessions[as] ? resolve(root, p.config.sessions[as]) : join(p.sessionDir, `${as}.json`));
  // the style a scene's films and posts get: the project's, then its format's, then its own
  // a kind of film by name: its style changes, and what it brings besides (colours and fonts, a look, a frame shape)
  p.format = (name) => {
    if (!name) return { style: {} };
    if (!p.config.formats[name]) throw new Error(`no format "${name}" (${Object.keys(p.config.formats).join(", ")})`);
    const { brand, look, shape, ...style } = p.config.formats[name];
    return { brand, look, shape, style };
  };
  p.style = (scene = {}, lookName = scene.look) => {
    const kind = p.format(scene.format), look = p.look(lookName), layers = [p.config.style, look.style, kind.style, scene.style];
    const style = layers.reduce((all, one) => merge(all, one), {}), read = (f) => (f && existsSync(join(root, f)) ? join(root, f) : null);
    const sheet = read(style.css) ?? (existsSync(join(dir, "style.css")) ? join(dir, "style.css") : null);
    const data = (f) => { const file = read(f); if (!file) return null; const ext = file.split(".").pop().toLowerCase(), type = ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}`; return `data:${type};base64,${readFileSync(file).toString("base64")}`; };
    // the words' colours and fonts: the project's, then the look's (dark words on a light ground), the format's, the scene's own
    const player = style.player, odd = player.controls === false ? [] : (Array.isArray(player.controls) ? player.controls : [player.controls]).filter((c) => !CONTROLS.includes(c));
    if (odd.length) throw new Error(`the player has no control "${odd[0]}" (${CONTROLS.join(", ")}; or controls: false for none)`);
    if (![true, false, "chapters", "steps"].includes(player.marks)) throw new Error(`the player's marks are "chapters", "steps", true (chapters, else steps) or false; got ${JSON.stringify(player.marks)}`);
    if (typeof player.poster === "string" && !read(player.poster)) throw new Error(`no picture at "${player.poster}" for the player's poster (a path in your project, or seconds into the film)`);
    return { ...style, player: { ...player, poster: typeof player.poster === "string" ? data(player.poster) : player.poster }, filter: look.filter, brand: { ...p.config.brand, ...look.brand, ...kind.brand, ...scene.brand },
      css: [...layers.map((l) => l?.sheet), sheet ? readFileSync(sheet, "utf8") : ""].filter(Boolean).join("\n"), // every layer's CSS text, then the file: none replaces another
      logo: data(style.logo), background: { ...style.background, image: data(style.background.image) } };
  };
  // the capture settings of a look: the base `look`, with a named one laid over it
  p.look = (name) => {
    if (!name || name === "app") return p.config.look;
    if (!p.config.looks[name]) throw new Error(`no look "${name}" in .scenlit/config.json or .scenlit/looks/ (${Object.keys(p.config.looks).join(", ") || "none yet: scenlit look --save"})`);
    return merge(p.config.look, p.config.looks[name]);
  };
  // change one part of the settings file, keeping the rest as written
  p.save = (change) => { change(settings); mkdirSync(dir, { recursive: true }); writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`); p.config = withTheme(merge(DEFAULTS, settings), settings); };
  // every scene of the project by name: .scenlit/scenes first, then *.scene.* files anywhere in the folders of `scenes`
  const SCENE = /\.scene\.(mjs|js|ts)$/, SKIP = new Set(["node_modules", ".git", ".scenlit", "dist", "build", "out", "coverage", ".next", ".nuxt", ".svelte-kit", ".turbo", ".cache", "vendor"]);
  let found = null;
  p.sceneFiles = () => {
    if (found) return found;
    found = new Map();
    const add = (file) => { const name = basename(file).replace(SCENE, ""); if (found.has(name) && found.get(name) !== file) throw new Error(`two scenes are named "${name}": ${found.get(name)} and ${file}`); found.set(name, file); };
    const walk = (folder, depth) => {
      for (const e of existsSync(folder) ? readdirSync(folder, { withFileTypes: true }) : []) {
        if (e.isDirectory()) { if (depth < 8 && !SKIP.has(e.name) && !e.name.startsWith(".")) walk(join(folder, e.name), depth + 1); }
        else if (SCENE.test(e.name)) add(join(folder, e.name));
      }
    };
    for (const f of existsSync(p.scenes) ? readdirSync(p.scenes).filter((x) => SCENE.test(x)) : []) add(join(p.scenes, f));
    for (const folder of p.config.scenes) walk(resolve(root, folder), 0);
    return found;
  };
  p.sceneNames = () => [...p.sceneFiles().keys()].sort();
  // `format`: the kind of film to make it this time (the command line's --format); left out, it is the one the scene
  // was last run as, else its own `format`; null: only its own
  p.loadScene = async (name, { format } = {}) => {
    const f = p.sceneFiles().get(name);
    if (!f) throw new Error(`no scene "${name}" (${p.sceneNames().join(", ") || "there are none yet: scenlit init"})`);
    if (f.endsWith(".ts") && !process.features?.typescript) throw new Error(`${f} is TypeScript, which Node runs from version 22.18 on (this is ${process.versions.node}). Use a newer Node, or name the scene .scene.mjs.`);
    const scene = (await import(`${pathToFileURL(f).href}?t=${Date.now()}`)).default;
    if (!scene || typeof scene.run !== "function") throw new Error(`${f}: a scene exports default { title, end, async run(...) {} }`);
    const ran = (() => { try { return JSON.parse(readFileSync(join(p.captures, name, "capture.json"), "utf8")); } catch { return null; } })();
    const as = format === undefined ? ran?.format ?? null : format, kind = as ?? scene.format ?? null, def = p.format(kind);
    // a format can bring a look (a phone) and a frame shape (vertical); what the scene says itself wins
    const save = { ...p.config.save, ...scene.save };
    checkSave(p.config.save, ".scenlit/config.json"); checkSave(scene.save, `scene "${name}"`);
    // title and end: the scene's own, or the ones its run() said last time
    return { ...scene, ...withCards({ ...scene, name, declared: { title: scene.title, end: scene.end } }, ran), name, file: f, save, app: merge(p.config.app, scene.app), ...(kind ? { format: kind } : {}), ...(as ? { asFormat: as } : {}), look: scene.look ?? def.look, shape: scene.shape ?? def.shape ?? "wide" };
  };
  return p;
}

export const flag = (args, name) => args.includes(`--${name}`);
export const option = (args, name, fallback = null) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback; };
