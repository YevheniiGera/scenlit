/** A control or element on the page: its visible name or text, a test id, or a CSS selector. */
export type Target = string | { testid: string } | { selector: string } | { role: string; name: string; nth?: number };

export interface StepSound { name: string; at?: "result" | "start" | "end"; delay?: number; volume?: number }
/** A sound at a moment of the film: seconds from the start (2.5), from the end (-3), or "title", "app" (the window arrives), "end" (the end card arrives). */
export interface Cue { name: string; at: number | "title" | "app" | "end"; delay?: number; volume?: number }

export interface StepOptions {
  /** The caption for this step, and its narration when a voice is set. `{ text, voice }` gives the narration its own sentence; `{ text, file }` plays your own recording of it (a path in your project). */
  say?: string | { text?: string; voice?: string; file?: string };
  /** A sound effect: a name ("chime"), or { name, at, delay, volume } to say when ("result": when what the step did shows, the default; "start"; "end"), how many milliseconds later and how loud. A list plays several. */
  sound?: string | StepSound | Array<string | StepSound>;
  /** Stay on what the step did this many milliseconds longer. */
  hold?: number;
  /** This step's own pace, times the style's: 0.5 is twice as brisk, 2 gives it double the time. */
  pace?: number;
  /** On a step that clicks, types, chooses, hovers or drags: in the player the film stops there with the place marked, and goes on when the viewer clicks it. An MP4 plays straight through. */
  byViewer?: boolean;
}

/** Where a scene's results are also kept in your project: paths, with {scene} and {shape} filled in. A copy is made on every run. */
export interface Save {
  /** The film with its player and all it needs: a folder for any web host. */
  film?: string;
  /** The MP4 when it is exported, its captions and poster beside it; or a place for each shape. */
  video?: string | { wide?: string; square?: string; vertical?: string };
  /** The posts: a folder. */
  posts?: string;
  /** The guide and its pictures: a folder, or the .md file. */
  guide?: string;
  /** The thumbnail: a PNG. */
  thumbnail?: string;
}

/** The player around the film (never part of an MP4). */
export interface Player {
  /** The colour of its controls and of what the viewer can click in the film. The brand's accent when not given. */
  accent?: string | null;
  /** Which controls it has, in this order. `false`: none, and a click on the film plays and pauses it. */
  controls?: Array<"play" | "scrub" | "time" | "sound" | "captions" | "speed" | "chapters" | "fullscreen"> | false;
  /** The places a viewer can go to, marked on the bar and listed under "chapters": the film's chapter() cards, or in a film without any, each step that says something (true). "chapters" or "steps" to choose; false: none. */
  marks?: boolean | "chapters" | "steps";
  /** What waits before the film is played: seconds into the film, or a picture in your project. */
  poster?: number | string | null;
  /** Whether captions start on. */
  captions?: boolean;
  /** How fast it plays: 1.5 is half as fast again. */
  speed?: number;
  /** It starts by itself, with its sound off until the viewer turns it on. */
  autoplay?: boolean;
  /** It starts again at its end. */
  loop?: boolean;
  /** A click-through demo: the film stops at every click, choice and typing, and the viewer does it. */
  tour?: boolean;
}

export interface SceneApi {
  /** Go to a page of the app ("/checkout"), or a component ("component:pr-check", "component:pr-check?state=failed"). */
  open(path?: string, options?: { /** Text for a component's slots: { title: "…" } fills every [data-slot="title"]. */ data?: Record<string, string> }): Promise<void>;
  /** Put the page in another state: sets data-state (or data-<name>) on its root. How a component changes. */
  state(value: string, options?: StepOptions & { name?: string }): Promise<void>;
  /**
   * One small goal in plain language. A model works it out on the first run; later runs replay the recording.
   * Values written as {name} in the goal come from `params`; the model never sees them.
   */
  act(goal: string, options?: StepOptions & { params?: Record<string, string | number> }): Promise<void>;

  /** Exact actions, with no model. */
  click(target: Target, options?: StepOptions): Promise<void>;
  fill(target: Target, value: string, options?: StepOptions): Promise<void>;
  select(target: Target, option: string, options?: StepOptions): Promise<void>;
  hover(target: Target, options?: StepOptions): Promise<void>;
  /** `file` is a path in your project. */
  upload(target: Target, file: string, options?: StepOptions): Promise<void>;
  drag(from: Target, to: Target, options?: StepOptions): Promise<void>;
  /** Press a key, for example "Enter". */
  press(key: string, options?: StepOptions): Promise<void>;
  /** Bring something into view. */
  scroll(target: Target, options?: StepOptions): Promise<void>;

  /** Show something without acting on it: the cursor goes there and everything else dims. */
  point(target: Target, options?: StepOptions): Promise<void>;
  /** A closer look: the camera moves in until the element fills much of the frame. */
  zoom(target: Target, options?: StepOptions): Promise<void>;
  /** A small tag next to an element, for as long as the step lasts. */
  label(target: Target, text: string, options?: StepOptions): Promise<void>;

  /** An effect by name, on something or on the whole window: "pulse", "shake", or one of your own (.scenlit/motion.js). */
  effect(name: string, target?: Target, options?: StepOptions & Record<string, unknown>): Promise<void>;
  /** Something on the app's own screen moves: "count" (a number counts up), "draw" (a chart draws itself), "rows", "pulse", "pop", "lift", or your own. `ms`: how long. */
  animate(target: Target, name?: string, options?: StepOptions & { ms?: number }): Promise<void>;
  /** One piece of the app alone on the stage, large: a card, a message, a chart. `with`: more pieces beside it. `animate`: what the first does once there. */
  piece(target: Target, options?: StepOptions & { with?: Target | Target[]; animate?: string; ms?: number }): Promise<void>;
  /** A component laid over the film for a while, as the steps after it carry on: a notification, a phone. `at`: "top right", "bottom left", "top", "right", "center"…; `for`: milliseconds it stays; `wait`: hold the film until it has gone. */
  overlay(component: string, options?: StepOptions & { data?: Record<string, string>; at?: string; for?: number; wait?: boolean; scale?: number }): Promise<void>;
  /** A sentence as a scene: its words land one by one, alone on the stage or `beside` the app. `highlight`: the word or words set apart. */
  /** Words on the stage. A list of phrases plays as quick swaps in one place. */
  words(text: string | string[], options?: StepOptions & {
    highlight?: string | string[]; beside?: boolean;
    /** How they come in. "rise" (the default): word after word. "letters": letter after letter. "bounce": letters drop in, tilted. "blur": letters come together out of a blur. "track": the line closes up from wide spacing. "type": as typed. */
    motion?: "rise" | "letters" | "bounce" | "blur" | "track" | "type";
    /** Words set larger. */ big?: string | string[];
    /** A box of the accent sweeps in behind the highlighted words. */ sweep?: boolean;
    /** A small tilted label stamped on after the words. */ tag?: string;
    /** A line drawn through the words. */ stroke?: boolean;
    /** How long each phrase stays, in milliseconds. */ for?: number;
    /** Each phrase a line under the last, on a numbered grid, the newest lit. */ stack?: boolean;
    /** A colour over the whole frame behind the words ("#ffd23f"): poster type in the ink that reads on it. */ field?: string;
  }): Promise<void>;
  /** A mark that draws itself in the accent colour: around something of the app ("circle", "box"), under it ("underline"), pointing at it ("arrow"), or across the stage ("stroke", with no target). */
  mark(kind: "underline" | "circle" | "box" | "arrow" | "stroke", target?: Target, options?: StepOptions): Promise<void>;
  /** Something of the app the viewer can click through: it is marked while the step lasts, and in the player a click on it opens the address (a web address, a path on your site, or mailto:). */
  link(target: Target, address: string, options?: StepOptions): Promise<void>;
  /** A button laid over the film for a while, as the steps after it carry on. `at`: where ("bottom", "top right"…); `for`: milliseconds it stays; `wait`: in the player the film stops on it until the viewer goes on. */
  button(text: string, address: string, options?: StepOptions & { at?: string; for?: number; wait?: boolean }): Promise<void>;
  /** Several things at once: the steps inside (animate, effect, overlay, sound, button) start at the same moment, or `stagger` milliseconds apart. `say`, `sound` and `hold` are for the group. */
  together(steps: () => Promise<void>, options?: StepOptions & { stagger?: number }): Promise<void>;
  /** Fast-forward: the steps inside play `speed` times quicker (4 by default), with a mark on screen. */
  fast(steps: () => Promise<void>, options?: { speed?: number }): Promise<void>;
  /** A sound effect by itself: "chime", "pop", "boom", "whoosh", "tap", "key", or your own in .scenlit/sounds/. */
  sound(name: string, options?: StepOptions & { delay?: number; volume?: number }): Promise<void>;
  /** A check: the text must be on the page, or the scene fails and nothing is recorded. */
  see(text: string, options?: { timeout?: number }): Promise<void>;
  /** Hold the film here. */
  pause(ms?: number, options?: StepOptions): Promise<void>;
  /** A title card in the middle of the film. */
  chapter(lead: string, key: string, options?: StepOptions): Promise<void>;
  /** Two lines on the stage. Said before the app shows, it opens the film and names it; after the last step, it ends it (with `url` and `button`); anywhere else, it is a chapter. */
  card(lead: string, key: string, options?: StepOptions & { url?: string; button?: string }): Promise<void>;
  /** The film's opening card, wherever it is said (card() decides by place). */
  title(lead: string, key: string): Promise<void>;
  /** The film's end card, wherever it is said (card() decides by place). */
  end(lead: string, key: string, options?: { url?: string }): Promise<void>;
  /** The stage behind the app's window from here on: a colour, colours for a gradient, a picture ("assets/sky.jpg": a path in your project, or an address), or the style's shape. Said first, the film starts on it; later, it fades in. */
  background(value: string | string[] | { kind?: "glow" | "gradient" | "solid" | "image"; colors?: string[]; angle?: number; image?: string }, options?: StepOptions): Promise<void>;
  /** The six-digit code an authenticator app would show for this secret. */
  totp(secret: string): string;
  /**
   * A named picture for posts and docs: the whole screen, or with `crop`, around one element.
   * `save`: also written to this path in your project, for example "docs/img/checkout.png".
   */
  shot(name: string, options?: { crop?: Target; save?: string }): Promise<void>;

  /** Sample data. Call these before `open`. */
  /** Answer one of the app's own requests (a path such as "/api/customers", or a RegExp on the address). */
  mock(path: string | RegExp, answer: unknown | ((request: unknown) => unknown)): Promise<void>;
  /** Swap text wherever the page shows it (whole words). */
  replace(map: Record<string, string>): Promise<void>;
  /** Blur elements: CSS selectors, or `{ testid }`. */
  blur(...targets: Array<string | { testid: string } | { selector: string }>): Promise<void>;
  /** The date and time the app believes it is. */
  freeze(date: string | Date): Promise<void>;

  /** Keep this browser's login for other scenes (`as: "admin"`). */
  saveLogin(as?: string): Promise<void>;
}

export interface Card {
  /** The grey lead-in. */
  lead: string;
  /** The line that matters, underlined. */
  key: string;
}

export interface Post extends Card {
  name: string;
  /** One plain sentence under the title. */
  line?: string;
  /** The name of a picture the scene takes with `shot`. */
  shot?: string;
  /** Two or three pictures, overlapping. */
  shots?: string[];
  /** Turn the picture a little in space. */
  tilt?: boolean;
  sizes?: Array<"portrait" | "square" | "link" | "thumb">;
  /** How much bigger than the default the picture is drawn. */
  zoom?: number;
  /** Room around a cropped picture, in app pixels. */
  pad?: number;
}

export interface Scene {
  /** The opening card (or card(lead, key) first in run()). None: the film starts in the app, named after the scene. */
  title?: Card;
  /** The closing card (or card(lead, key) last in run()). `url` defaults to the brand's. None: the film ends on its last picture. */
  end?: Card & { url?: string };
  /** This scene's app, over .scenlit/config.json's. */
  app?: { url?: string; start?: string | null; as?: string | null };
  /** A look: "marketing" (after `scenlit look --save`), "phone", "tablet", "dark", "light", a drawn one ("cartoon", "sketch", "blueprint"), or one of your own. */
  look?: string;
  /** Start signed in as this saved login (`scenlit login --as admin`, or a scene's `saveLogin`). */
  as?: string;
  /** Sample data for this scene, over config.json's `data`. */
  data?: { replace?: Record<string, string>; blur?: string[]; date?: string | null };
  /** A command before the scene (seed the database) and after it (clean up). */
  setup?: string;
  teardown?: string;
  /** This film's own colours and fonts, over the project's `brand`: { background, text, muted, accent, font, titleFont, fontImport }. */
  brand?: Record<string, string | null>;
  /** A kind of film from config.json's `formats`: "demo", "tutorial", "feature", "trailer", "canvas", "launch", "recording", "short", "keynote", "loop", or one of your own. */
  format?: string;
  /** A recording of a person, shown in a corner in step with the film; its sound is the narration. A path in your project, or { file, at, size, round, start, volume, sound }. */
  presenter?: string | { file: string; at?: "bottom right" | "bottom left" | "top right" | "top left"; size?: number; round?: boolean; start?: number; volume?: number; sound?: boolean };
  /** Sounds at moments of the film itself: [{ name: "rise", at: -3 }, { name: "thud", at: "end" }]. */
  cues?: Cue[];
  /** How long the film should be, in seconds. The rests are stretched or shrunk to fit; if that is not enough, the whole film plays up to a half quicker or slower. */
  length?: number;
  /** The frame's shape, when not the format's: "wide", "square" or "vertical". */
  shape?: "wide" | "square" | "vertical";
  /** Style changes for this scene, over the project's `style` and the format's. See the README, "Make it look like yours". */
  style?: {
    background?: { kind?: "glow" | "gradient" | "solid" | "image"; colors?: string[]; angle?: number; image?: string; dots?: boolean };
    /** fill: the page is the whole frame, edge to edge (a component made to be filmed). */
    window?: { bar?: "dark" | "light" | "none"; radius?: number; shadow?: "soft" | "hard" | "flat" | "none"; scale?: number; fill?: boolean };
    /** name: words beside the cursor, as on a shared canvas; guests: others' cursors about it. */
    cursor?: { size?: number; color?: string; ring?: boolean; name?: string | null; guests?: { name: string; color?: string }[]; show?: boolean };
    /** The places of the film are frames side by side on one canvas, and the camera travels between them. */
    board?: boolean;
    /** The colour of a selection (the "select" spotlight). */
    select?: string | null;
    /** tilt: [x, y] degrees turns the window in space; drift: the picture comes this much closer over the film; parallax: how much the background follows the camera. */
    camera?: { zoom?: number; speed?: number; tilt?: [number, number] | null; drift?: number; parallax?: number };
    /** A soft light behind the window (true: the accent colour, or a colour), film grain and darker corners. */
    finish?: { light?: boolean | string | null; grain?: number; vignette?: number };
    /** The film shows its own scene file down the left, the app beside it, and lights the line now playing, joined by a band of light to what it does. Wide films only. */
    source?: boolean | { font?: string };
    /** The player around the film: its colour, its controls, how it starts. */
    player?: Player;
    captions?: { show?: boolean; position?: "bottom" | "top"; size?: number; look?: "pill" | "plain" | "bold" };
    titles?: { show?: boolean; animation?: "rise" | "fade" | "words" | "slam"; underline?: boolean; size?: number; align?: "center" | "left" };
    end?: { show?: boolean; button?: string | null; sting?: boolean };
    /** Music under the film: a track in your project or a built-in bed ("calm", "pulse"); `start` is seconds into the track, `duck` how far it sinks under narration. */
    music?: { file?: string | null; volume?: number | null; start?: number; fadeIn?: number; fadeOut?: number; duck?: number; loop?: boolean };
    /** A sound effect for each: "tap", "key", "pop", "boom", "whoosh", "chime", "tick", or your own in .scenlit/sounds/. */
    sounds?: { click?: string | null; type?: string | null; caption?: string | null; card?: string | null; title?: string | null; chapter?: string | null; end?: string | null; enter?: string | null; exit?: string | null; cut?: string | null; zoom?: string | null; point?: string | null; label?: string | null; animate?: string | null; fast?: string | null; piece?: string | null; word?: string | null; logo?: string | null; overlay?: string | null; volume?: number };
    logo?: string | null;
    pace?: number;
    spotlight?: number;
    /** Which piece moves what (`scenlit motion list`); your own pieces go in .scenlit/motion.js. */
    motion?: { title?: string; enter?: string; exit?: string; cut?: string; cursor?: string; click?: string; spotlight?: string };
  };
  run(api: SceneApi): Promise<void>;
  /** The 1280×720 thumbnail every run writes: its words and picture, or false for none. */
  thumbnail?: false | (Partial<Card> & { shot?: string; line?: string });
  /** Where the platform shows it on its product's page: demos, help (a tutorial's default) or what's new. */
  kind?: "demo" | "help" | "news";
  /** Where this scene's results are also kept in your project, over the settings file's `save`. */
  save?: Save;
  posts?: Post[];
  /** A PDF for LinkedIn, and each slide as a PNG. */
  carousels?: Array<{ name: string; slides: Array<Card & { line?: string; shot: string }> }>;
}

type Named = Scene & { name: string };
export function project(root?: string): any;
export function runScene(p: any, scene: Named, options?: { record?: boolean; headed?: boolean; strict?: boolean; look?: string }): Promise<any>;
export function writeFilm(p: any, scene: Named): string;
export function writePosts(p: any, scene: Named): Promise<string[]>;
export function writeGuide(p: any, scene: Named): Promise<string | null>;
export function exportFilm(p: any, scene: Named, options?: { format?: "wide" | "square" | "vertical"; fps?: number; step?: number; gif?: boolean }): Promise<string>;
export function recordVoice(p: any, capture: any, options?: { retake?: boolean }): Promise<number>;
export function proposeLook(p: any, options?: { path?: string; save?: boolean; as?: string }): Promise<any>;
export function check(p: any, names?: string[]): Promise<string[]>;
export function doctor(p: any): Promise<Array<{ ok: boolean; what: string; fix: string }>>;
/** The video gets a link on the platform (`to`, SCENLIT_PORTAL or the settings' `portal`), under the project's product. Connects this computer first when it is not. */
export function publish(p: any, scene: Named, options?: { to?: string; listed?: boolean | null; private?: boolean | null; kind?: "demo" | "help" | "news" | null }): Promise<{ link: string; embed: string; page: string; help: string | null; product: string; kind: string; private: boolean; listed: boolean; version: number; files: number; pictures: number; seconds: number }>;
export function unpublish(p: any, sceneName: string, options?: { to?: string }): Promise<string>;
/** Connect this computer to the platform: you approve it in the browser. */
export function connect(p: any, options?: { to?: string; show?: boolean }): Promise<{ portal: string; account: { name: string; email: string }; products: Array<{ slug: string; name: string; page: string }> }>;
export function disconnect(p: any, options?: { to?: string }): { portal: string; had: boolean };
/** One search over the built-in pieces, the project's own and the platform's gallery: what each is and how a scene uses it. */
export function find(p: any, query?: string, options?: { kind?: "component" | "motion" | "look" | "format" | "sound"; to?: string; gallery?: boolean; pictures?: boolean; limit?: number }): Promise<{ results: Array<{ where: "built-in" | "yours" | "gallery"; kind: string; name: string; about?: string; use: string[]; slots?: Array<{ name: string; example: string }>; states?: string[]; defines?: Array<{ family: string; name: string }>; picture?: string; add?: string; page?: string }>; note?: string }>;
/** Add a shared piece (a folder, github:owner/repo/path, a gallery address); `dryRun` only says what it would add. */
export function add(p: any, source: string, options?: { yes?: boolean; force?: boolean; dryRun?: boolean; to?: string }): Promise<{ from: string; files: string[]; use: string[]; text?: Record<string, string>; added?: false }>;
/** Put one of your pieces in the platform's gallery. */
export function share(p: any, kind: "component" | "motion" | "look" | "format" | "sound", name: string, options?: { to?: string; preview?: string; description?: string }): Promise<{ id: string; version: number; page: string }>;
/** Your products on the platform, in the browser; `show` opens it. */
export function openPortal(p: any, options?: { to?: string; show?: boolean }): string;
/** The film as a folder for any web host: the page with its player, and only the files it needs. */
export function writeWeb(p: any, scene: Named, options?: { lang?: string | null }): { dir: string; file: string; files: number };
/** Chrome, opened the way Scenlit opens it (SCENLIT_CHROME to choose which). */
export function launch(options?: { headed?: boolean }): Promise<any>;

/** For autocomplete in a scene file: `export default defineScene({ title, end, async run(api) {} })`. */
export function defineScene(scene: Scene): Scene;
export function totp(secret: string, options?: { at?: number; step?: number; digits?: number }): string;
