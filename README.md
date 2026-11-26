# Scenlit

Product films, posts, docs screenshots and guides made from your real app, and made again when the app changes.

You write a scene: what happens, in plain language. Scenlit runs it in a real browser on your running app, works
out the clicks with a model the first time, and records them. After that the scene replays with no model, in
seconds. Every release gets its film made again.

**[Docs](https://scenlit.dev/docs)** · [Examples](https://scenlit.dev/#make) · [npm](https://www.npmjs.com/package/scenlit) · [Changelog](CHANGELOG.md)

```js
// .scenlit/scenes/checkout.scene.mjs
export default {
  async run({ card, open, act, see, point, shot }) {
    await card("Every test is green.", "Does the checkout work?");
    await open("/shop");
    await act("add two things to the cart", { say: "A customer picks two things." });
    await act("pay with the card {card}", { params: { card: "4242 4242 4242 4242" }, say: "And pays." });
    await see("Thank you for your order");
    await point({ testid: "order-status" }, { say: "Paid, in one go." });
    await shot("paid", { crop: { testid: "order" }, save: "docs/img/paid.png" });
    await card("Test each release", "the way a customer would.");
  },

  posts: [{ name: "paid", lead: "The order went through.", key: "We watched it happen.", shot: "paid" }],
};
```

One run of that file gives you:

| What | Where |
|---|---|
| A film that plays in any browser, in wide, square and vertical | `.scenlit/output/checkout/film.html` |
| Posts in portrait, square and link sizes | `posts/` |
| Plain screenshots, also written into your docs | `shots/`, and the `save` path |
| A step-by-step guide with marked pictures | `guide.md` |
| A click-through demo, where the viewer does each click | the same film, with `?tour` |
| An MP4 with narration, or a GIF of one step | `scenlit export` |
| A carousel for LinkedIn, as a PDF | `carousels/` |

A scene is also a test: if the film cannot be made, the flow is broken.

## Start

You need Node 20 or newer and Google Chrome. Exact steps need nothing else. Plain-language steps need a model: Claude
Code signed in on this machine, or any OpenAI- or Anthropic-compatible API, a local one included (see Settings).

```sh
npm i -D scenlit
npx scenlit init          # sets up .scenlit/ and finds your app's address and start command
npx scenlit doctor        # says what this machine is missing
npx scenlit run first     # a first film and post of your home page: no model needed
open .scenlit/output/index.html
```

Then write your own scene in `.scenlit/scenes/`, or ask your coding agent to: `init` installs a `/scenlit` skill for
Claude Code, and adds a short section to `AGENTS.md` for Codex, Cursor and the others (it sends them to
`npx scenlit guide`; an `AGENTS.md` you already have is kept, with the section added once).

## What a scene can do

| Step | What it does |
|---|---|
| `open(path)` | Goes to a page of the app |
| `act(goal, { params, say })` | One small goal in plain language. Worked out by a model on the first run, replayed after |
| `click`, `fill`, `select`, `hover`, `upload`, `drag`, `press`, `scroll` | The same, said exactly, with no model |
| `point(target)`, `zoom(target)`, `label(target, text)` | Show something without acting on it: a spotlight, a closer look, a tag |
| `animate(target, name)` | Something on the app's own screen moves: `count` (a number counts up), `draw` (a chart draws itself), `rows` (rows arrive one by one), `pulse`, `pop`, `lift` |
| `sound(name)` | A sound effect by itself. Any step can also take `{ sound: "chime" }` |
| `see(text)` | A check. If the text is not on the page the scene fails and nothing is recorded |
| `card(lead, key)` | Two lines on the stage. Before the app shows, it opens the film and names it; after the last step, it ends it (`{ url, button }` there); anywhere else, a chapter. No opening card: the film starts in the app; no end card: it ends on its last picture |
| `pause(ms)` | Holds the film |
| `background(colour or picture)` | The stage behind the app from here on: a colour, colours for a gradient, or a picture (`"assets/sky.jpg"`, a path in your project, or an address). First, the film starts on it; later, it fades in |
| `fast(steps)` | Fast-forward: the steps inside play four times quicker, with a mark on screen |
| `piece(target)`, `words(text)` | One piece of the app alone on the stage; words as a scene, with moving type (below) |
| `mark(kind, target)` | A circle, box, underline or arrow that draws itself on the app; `mark("stroke")` across the stage |
| `overlay("component:x")` | A component laid over the film for a while, as the next steps carry on under it |
| `together(steps)` | The steps inside start at the same moment |
| `link(target, address)`, `button(text, address)` | Something of the app the viewer can click through; a button laid over the film |
| `shot(name, { crop, save })` | A named picture: for posts, as a plain PNG, and with `save`, written into your project |
| `mock`, `replace`, `blur`, `freeze` | Sample data (below) |
| `state(value)` | Puts a component (or the page) in another state |
| `saveLogin()`, `totp(secret)` | Keeps the login: later scenes start signed in with it. The code an authenticator app would show |

A target is a control's visible name (`"Pay"`), a test id (`{ testid: "cart" }`) or a selector. A step waits up to five
seconds for its target to show up and be enabled, so a page that is still loading needs no `pause()`.

`say` is the step's caption, and its narration when a voice is set. Values in `params` are typed by Scenlit; the
model only ever sees the placeholder (`{card}`).

A scene can also set `look: "marketing"`, `data`, and `setup` / `teardown` commands (seed the database, clean up).

## How the recording works

- The first time a scene meets an `act`, a model looks at the page's controls and names the next actions.
- When the scene ends without an error, those actions are saved to `.scenlit/recordings/<scene>.json`. Commit it.
- Later runs replay the recording: no model, no cost.
- If the app changed and a recorded control is gone, the model takes over from that point and the recording is
  repaired. `--record` forgets the recording and starts again.
- `--strict` never calls a model and fails when a step is not recorded. It is the default when `CI` is set.

## Sample data: never film a real customer

```js
await freeze("2026-03-02T09:30:00");                       // the date the app believes it is
await mock("/api/customers", [{ name: "Acme Inc", ... }]);  // answer the app's own request
await replace({ "Hartwell & Finch": "Acme Inc" });          // swap text wherever it shows (whole words)
await blur(".email");                                       // hide what is left
await open("/");
```

The same can be set for every scene under `data` in the settings.

## Signing in

- By hand: `npx scenlit login` opens your app; sign in and close the window. `--as admin` keeps several logins.
- By a scene: a scene that signs in with `fill` and `click` and ends with `saveLogin("admin")` does the same without
  a person, which is what CI needs. Take the password from the environment.
- Scenes start signed in with the saved login. With several (`saveLogin("admin")`, `login --as admin`), a scene
  picks one with `as: "admin"`.

Logins are saved in `.scenlit/sessions/` and kept out of git.

## Your brand and the marketing look

`npx scenlit look` reads the app's name and the colour it uses most on buttons and links, and proposes a second look
for the app: the same screens with less around the content (search box, bell, avatar, help bubble, footer) and
bigger type. It only hides and enlarges; it never adds anything. It writes two pictures, before and after. `--save`
keeps the brand and the look as `looks.marketing`; a scene uses it with `look: "marketing"`, or one run with
`--look marketing`.

## Built for agents

Scenlit is meant to be driven by a coding agent as easily as by a person. `init` installs a `/scenlit` skill for
Claude Code; any other agent can read the same guide with `npx scenlit guide`.

The guide is about making a good film, not only a working one. It has the agent get to know the product first (its
README, changelog and pages) and suggest two or three films before making one. It gives the rules a good demo
follows: a hook in the first three seconds, one moment that stands out, the before shown, captions about what the
viewer gets, data that tells one story. And it starts every film from an example of its kind, so the agent does not
invent the shape each time:

| Example | For |
|---|---|
| `npx scenlit guide product-demo` | A landing page: hook, setup, one moment, payoff, next |
| `npx scenlit guide feature` | A release post: one new thing, shown working, square |
| `npx scenlit guide tutorial` | The help center: one task, numbered steps |
| `npx scenlit guide story` | One person's problem across the screens it touches |
| `npx scenlit guide short` | Reels, Shorts, TikTok: a hook and three quick beats, vertical |
| `npx scenlit guide launch` | A launch for developers: the scene's own code beside the app, colour fields between |

Each is a complete scene that runs on a sample invoicing app, with notes on why it is built that way.

| Command | What an agent gets |
|---|---|
| `inspect /path` | The page's controls by name, its text, its states, and a picture: no guessing at selectors |
| `run <scene> --json` | What each step did, every file written, and `notes`: what reads wrong, the story included (no hook, nothing that stands out, captions that say what was clicked) |
| `sheet <scene>` | The film as one image: eight moments, each with its time and caption |
| `frames <scene> --at 7.5` | One moment, full size |
| `check --json` | Every scene without running it |

With `inspect`, an agent writes exact steps (`click("Export CSV")`), so a scene needs no model call of its own.
`act` stays for goals that are easier said than spelled out.

## Components: vector pieces you or an agent draw

Some things a story needs are not in your app: a pull request's checks, a chat message, an email. A component is
one self-contained HTML file with CSS in `.scenlit/components/`, and a scene opens it like a page:

```js
await open("component:pr-check");
await state("failed", { say: "The release check fails." });   // sets data-state="failed" on its root
await point("Release check");
await open("/");                                               // and on into the real app
```

Seven come built in and work without copying anything: `pull-request`, `chat`, `email`, `terminal`, `issue`,
`notification` and `phone`.
Each has states and text slots you fill from the scene:

```js
await open("component:chat", { data: { channel: "releases", text: "2.2 is not ready: checkout fails." } });
await state("message", { say: "The news arrives where the team is." });
```

`npx scenlit component list` names them, `npx scenlit inspect component:chat` shows a component's states, slots
and controls, and `npx scenlit component add chat` copies one into the project to change its look.

- `npx scenlit component new <name>` writes a starting file with the rules in its comments.
- `npx scenlit component from <scene>/<shot> <name>` starts from a frozen page of the real app.
- States are plain CSS (`[data-state="failed"] .icon { ... }`); transitions between them are filmed.
- `<meta name="scenlit:host" content="git.example.com/...">` is the address the film's window shows for it.
- Components are filmed as vectors, appear in the kit's gallery, and work in posts through `shot`.

### Several things at once: overlays

A component can be laid over the film for a while, as the steps after it carry on underneath: a notification
arriving while someone types, a phone buzzing as a payment lands.

```js
await overlay("component:notification?icon=green", { sound: "notify", data: { app: "Ledgerly", title: "Kestrel Robotics is 12 days late", body: "Invoice INV-2046 for $2,400 is overdue." } });
await select("Status", "Past due", { say: "The filter shows who is behind." });   // happens under the notification
await overlay("component:phone", { at: "right", for: 3600, data: { title: "Payment received", body: "Kestrel Robotics paid $2,400." } });
```

| Option | What it does |
|---|---|
| `at` | Where: `top right` (the default), `top left`, `bottom right`, `bottom left`, `top`, `bottom`, `left`, `right`, `center` |
| `for` | How long it stays, in milliseconds (3200 when left out) |
| `wait` | `true` holds the film until it has gone; otherwise the next step starts at once |
| `scale` | Its size, as a factor |
| `data`, `sound`, `say` | As for any component and any step |

To start several things in the same moment, put them in `together`: a number counts while a chart draws and an
answer streams in.

```js
await together(async () => {
  await animate({ testid: "revenue" }, "count");
  await animate({ selector: "#chart" }, "draw");
  await overlay("component:notification", { sound: "notify", data: { title: "Payment received" } });
}, { stagger: 250, say: "The year, drawn as you watch." });
```

Inside go the steps that do not need the one cursor or the whole stage: `animate`, `effect`, `overlay`, `sound`.
`stagger` starts each a little after the one before; `say`, `sound` and `hold` are for the group, and a group's
sound plays as the group begins. A sound that belongs to one of them (the notification's) goes on that step, so it
plays when that one shows. The film goes on when the last of them is done.

An overlay comes in from the nearest edge and leaves the way it came. A second one in the same place sits under the first
while that one is still there. What is laid over is the element the component marks with `data-overlay` (else its
first element), so any component of yours works: give its page a transparent background. An overlay is a picture,
sharp at the film's size and softer in a 4k export.

### A film the viewer takes part in

In the player a film can stop and hand the next click to the viewer, and it can lead somewhere. This works because
the film shows the real pages, not a video of them.

```js
await select("Status", "Past due", { say: "Choose who is behind.", byViewer: true });
await click("Kestrel Robotics", { byViewer: true });
await link("View invoices", "https://acme.com/docs/invoices", { say: "Every invoice is one click from here." });
await button("Try it with your own customers", "https://acme.com/start", { wait: true });
```

| | |
|---|---|
| `{ byViewer: true }` | On a step that clicks, types, chooses, hovers or drags: the cursor goes there, the film stops and the place is marked. It goes on when the viewer clicks it (or presses play, Enter or the space bar) |
| `link(target, address)` | Something of the app is marked while the step lasts, and a click on it opens the address in a new tab |
| `?tour` on the film's address, or `player: { tour: true }` | A click-through demo: every step that clicks, types, chooses, hovers or drags waits for the viewer, as if each had `byViewer` |
| `button(text, address, { at, for, wait })` | A button over the film for `for` milliseconds (4000), as the next steps carry on. `at`: where, as for an overlay (`"bottom"`). `wait: true`: the film stops on it until the viewer goes on |

An address is a web address, a path on the site the film is on (`/pricing`) or `mailto:`. In an MP4 nothing stops:
the film plays straight through, the link is only marked and the button is only shown.

## In your codebase

- **Scenes live where the feature lives.** Besides `.scenlit/scenes/`, any `*.scene.mjs`, `*.scene.js` or
  `*.scene.ts` in the project is found by its name: `src/checkout/checkout.scene.ts` runs as `scenlit run checkout`.
  TypeScript scenes need Node 22.18 or newer.
- **Typed.** `import type { Scene } from "scenlit"`, or `export default defineScene({ ... })`. The settings file
  points at a schema, so your editor completes and checks it.
- **Write, save, watch.** `npx scenlit dev checkout` runs the scene, serves the film on a local address, and runs
  again whenever you save the scene, the settings, the style sheet or a component. The page reloads itself.
- **Reuse your tests' login.** `"sessions": { "member": "playwright/.auth/user.json" }` starts scenes from the
  saved login your Playwright tests already make.
- **One command for the team.** `init` adds `npm run films` and `npm run films:check` to `package.json`.
- **From code.** Everything the command line does is exported: `import { project, runScene, writeFilm } from "scenlit"`.

### Where the results go

Everything is written to `.scenlit/output/<scene>/`. To have a result in your project as well, name its place. A
copy is made there on every run, so the film on your site and the picture in your docs are new whenever the app is.

```js
export default {
  save: {
    film: "public/films/checkout",        // the player and all it needs: a folder for any web host
    video: "public/videos/checkout.mp4",  // the MP4 when it is exported, with its captions and poster beside it
    posts: "marketing/checkout",
    guide: "docs/guides/checkout",
    thumbnail: "public/checkout.png",
  },
  async run({ shot }) {
    await shot("paid", { save: "docs/img/paid.png" }); // one picture, where the docs want it
  },
};
```

The same `save` in `.scenlit/config.json` is for every scene: `{ "film": "public/films/{scene}" }`. `{scene}` is the
scene's name and `{shape}` the frame's shape; `video` can also name a place for each shape,
`{ wide: "…", square: "…" }`. Nothing already in a folder of yours is removed.

For one result once, `--out` puts a copy where you say: `scenlit export checkout --out public/checkout.mp4`,
`scenlit frames checkout --at 12 --out docs/img/step.jpg`, `scenlit sheet checkout --out review/`.

## Make it look like yours

Everything about how films and posts look is set under `style` in `.scenlit/config.json`, and any of it can be
changed for one scene (`style: { ... }` in the scene file):

```json
"style": {
  "background": { "kind": "gradient", "colors": ["#0f172a", "#1e3a8a"], "angle": 160, "dots": false },
  "window": { "bar": "light", "radius": 22, "shadow": "soft", "scale": 0.86 },
  "cursor": { "size": 60, "color": "#111111", "ring": true },
  "camera": { "zoom": 1.25, "speed": 1.2 },
  "captions": { "show": true, "position": "top", "look": "plain", "size": 1.1 },
  "titles": { "animation": "words", "align": "left", "underline": true, "size": 0.9 },
  "end": { "button": "Start free" },
  "logo": "assets/logo.svg",
  "pace": 0.8,
  "spotlight": 0.6
}
```

| Setting | Choices |
|---|---|
| `background.kind` | `glow` (default), `gradient`, `solid`, or `image` with `"image": "assets/wallpaper.jpg"` |
| `window` | `bar`: `dark`, `light`, `none` · `radius` · `shadow`: `soft`, `hard`, `none` · `scale`: below 1 shows more background (a phone or tablet frame gets smaller too) |
| `cursor` | `size`, `color`, and `ring` (the circle on a click) |
| `camera` | `zoom`: how far it moves in (`1` keeps it still) · `speed`: above 1 is quicker |
| `captions` | `show` · `position`: `bottom`, `top` · `look`: `pill`, `plain`, `bold` (big words, for vertical shorts) · `size` |
| `titles` | `animation`: `rise`, `fade`, `words`, `slam` · `align`: `center`, `left` · `underline` · `size` |
| `end` | `button`: words on a button under the end card |
| `logo` | An image in your project, shown on the cards and on posts |
| `pace` | Above 1 gives every step more time; below 1 is brisker |

For anything else, write `.scenlit/style.css`. It is laid over every film and post, so any part can be restyled:
`.win`, `.bar`, `.card`, `.lead`, `.key`, `.cap`, `.tag`, `.spot`, `#cur`, `.ring`, `.bg`. A scene can bring its own
sheet instead (`style: { css: ".scenlit/styles/heavy.css" }`).

One film can also have its own colours and fonts, over the project's `brand`:

```js
brand: { background: "#000", text: "#fff", accent: "#35c27f", font: '"Inter Tight", sans-serif', titleFont: '"Inter Tight", sans-serif',
  fontImport: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;800&display=swap" },
```

With these, one app can be filmed as very different kinds of video. Scenlit's own showcase has ten made this way:
a launch trailer, a polished screen recording, a vertical short, a how-to, a "what's new" clip, a README loop, a
cartoon, a sketch, a customer story across screens and a dark keynote.

**Formats** are named sets of style changes. Eleven come built in, and you can add your own under `formats`:

| Format | For | What it changes |
|---|---|---|
| `demo` | Landing page, sales | Titles come in word by word |
| `tutorial` | Docs, help center | Calm: a still background, a gentle camera, more time on every step |
| `feature` | Changelog, release notes | Brisk, with a button on the end card |
| `launch` | A launch film | A dark, lit set; a window turned in space; pieces, sentences and typing staged by the scene (see "Staging a film like a launch video") |
| `trailer` | A launch | Black, heavy words that land hard, quick shots, no captions. cards in the middle (chapters) carry the story |
| `canvas` | A launch, a social clip | A light grey design canvas: every page is a frame, named, side by side; the camera travels from one to the next; named cursors about; what is pointed at is selected, with its real size. Cards are words over the canvas |
| `recording` | A polished screen recording | A colour gradient, a big cursor, the camera after every click, no cards, keys you can hear |
| `short` | Reels, Shorts, TikTok | The app on a phone in a vertical frame, big captions word by word. Write short captions for it |
| `keynote` | A talk, an all-hands | The app in dark mode on black, a slow camera, one thing at a time |
| `loop` | A README, a docs page | No cards, no captions, a still camera: play it with `?background`, or `export --gif` |
| `source` | A launch, a landing page, for developers | The scene's own code down the left, the app beside it, the line now playing lit and joined by a band of light to what it does. Words are numbered lit lines; `words(…, { field })` gives a full-bleed colour between. Blue-black ink, Funnel Display, Fragment Mono, your accent. Wide films |

A scene picks one with `format: "tutorial"`, or the command line does for any scene: `scenlit run checkout --format
trailer`. A format can bring more than style: its own colours and fonts (`brand`), a look (`look: "phone"`) and a
frame shape (`shape: "vertical"`). What the scene says itself wins.

## Motion you can change

Every way something moves is a named piece in a family, and you pick one per family:

```json
"style": { "motion": { "title": "words", "enter": "grow", "cut": "slide", "click": "pulse", "spotlight": "outline", "exit": "drop" } }
```

| Family | Built in | What it is |
|---|---|---|
| `title` | `rise`, `fade`, `words`, `slam` | How a title card comes in |
| `caption` | `fade`, `words` | How a caption comes in (`words`: one word after another) |
| `enter`, `exit` | `rise`, `fade`, `grow` · `fade`, `drop` | How the window arrives and leaves |
| `cut` | `fade`, `slide`, `none` | How one picture gives way to the next |
| `cursor` | `arc`, `line` | How the cursor travels |
| `click` | `ring`, `pulse`, `none` | What a click looks like |
| `spotlight` | `dim`, `outline` | How something is pointed at |
| `effect` | `pulse`, `shake` | Effects a scene asks for: `await effect("pulse", target)` |
| `animate` | `count`, `draw`, `rows`, `pulse`, `pop`, `lift` | What `animate()` does to an element of the app: `define("animate", "spin", ({ el, at, dur }, kit) => { … })` |

To change one, or add your own, write it in `.scenlit/motion.js` (`npx scenlit motion new` writes the file with two
examples). It runs in the film's page:

```js
scenlitMotion((define, kit) => {
  // a new way for one picture to give way to the next: it wipes in from the left
  define("cut", "wipe", (layer, at, dur) => {
    kit.start(layer, "clipPath", "inset(0% 100% 0% 0%)");
    kit.to(layer, "opacity", at, 1, 1);
    kit.to(layer, "clipPath", at, Math.max(dur, 450), "inset(0% 0% 0% 0%)");
  });
});
```

A piece schedules changes on the film's one clock (`kit.start`, `kit.to`, `kit.show`, `kit.hide`) instead of
animating by itself, which is why any moment of the film can be exported exactly. Defining a piece under a
built-in name replaces it. `npx scenlit motion list` shows every family and the shape of a piece in it.

## Vector pictures and the kit

Next to every screenshot Scenlit keeps the page itself, frozen: its HTML and CSS with the scripts removed, form
values written in, fonts and images saved beside it. Films and posts show the frozen page, so text stays sharp at
any zoom, and `export --4k` gives a 3840×2160 film that is sharp too.

A frozen page is only used when it looks like the screenshot taken with it. When a page cannot be frozen well (a
canvas chart, a video), that picture stays a screenshot; the run says how many are vector. `"look": { "vector": false }`
turns it off.

`npx scenlit kit` turns every named picture into a library in `.scenlit/kit/`:

| File | What |
|---|---|
| `<scene>/<shot>.html` | The frozen page: open it, restyle it, embed it |
| `<scene>/<shot>.pdf` | The piece as vectors, text as text: opens in design tools |
| `<scene>/<shot>.svg` | The same as SVG, when `pdftocairo` (poppler) is installed |
| `index.html` | A gallery of every piece, live |

## Looks: phone, tablet, dark, other languages

A look is how the app is captured. Besides `marketing`, four come built in, and you can add your own under `looks`:

| Look | What |
|---|---|
| `phone`, `tablet` | A phone-sized or tablet-sized page, drawn in a device frame with a touch dot for a cursor |
| `dark`, `light` | The colour scheme the app is asked for |
| your own | `{ "viewport": ..., "device": "phone", "scheme": "dark", "locale": "de-DE", "hide": [...], "css": "" }` |

Use one with `look: "phone"` in a scene, or `--look phone` for one run.

### Drawn looks: cartoon, sketch, blueprint, or your own

The same app and the same scene, in another hand:

| Look | What it does |
|---|---|
| `cartoon` | Heavy outlines, hard shadows, hand lettering, flat colours, a slight wobble, on a bright ground |
| `sketch` | Black and white, hand lettering, lines that waver like a pen's, on paper |
| `blueprint` | White lines on blue |

```sh
npx scenlit run checkout --look cartoon
```

A drawn look has three parts, and your own looks can use any of them:

```json
"looks": {
  "neon": {
    "css": "* { font-family: 'Courier New', monospace !important } button { border: 2px solid #0ff !important }",
    "filter": "invert(1) hue-rotate(180deg) saturate(1.6)",
    "style": { "background": { "kind": "solid", "colors": ["#05010f"] }, "window": { "bar": "none", "shadow": "none" } }
  }
}
```

- `css` changes the app itself while it is captured (it stays real HTML, so it stays sharp).
- `filter` is a CSS filter laid on every picture. Built in: `url(#nt-sketch)`, `url(#nt-toon)`, `url(#nt-blueprint)`.
- `style` changes the film and the posts around the app: background, window, cursor, captions, motion.

## Posts, pieces and carousels

```js
posts: [
  { name: "paid", lead: "The order went through.", key: "We watched it happen.", shot: "paid" },
  { name: "pieces", lead: "The list, and the customer:", key: "side by side.", shots: ["list", "customer"], tilt: true },
],
carousels: [{ name: "tour", slides: [{ lead: "...", key: "...", line: "...", shot: "list" }, ...] }],
```

- `shot` cropped to one element shows that piece of the product on its own, with no browser around it.
- `shots` overlaps two or three pieces; `tilt` turns them a little in space.
- A carousel is written as one PNG per slide and one PDF, which is what LinkedIn takes as a document post.

## Thumbnails

Every run writes `thumbnail.png` (1280×720): the scene's title beside its first named picture. Set
`thumbnail: { lead, key, shot }` in the scene to choose the words and the picture, or `thumbnail: false`. Posts
can also ask for the `thumb` size.

## Narration

A step's `say` is its caption and, with a voice, what is spoken. When the spoken sentence should be longer than
the caption: `say: { text: "Paid.", voice: "And just like that, the order is paid." }`.

Who speaks is a provider, set under `voice`:

| Provider | What |
|---|---|
| `say` | The Mac's own voice: free, for drafts |
| `elevenlabs`, `openai` | `ELEVENLABS_API_KEY` / `OPENAI_API_KEY`; cost credits, and only ever run from `scenlit voice` |
| `command` | Any program: `"command": "piper -m en.onnx -f {file}"` (the line comes on standard input, or as `{text}`) |
| `./tools/voice.mjs` | Your own: `export default async (text, { file, voice, model, lang }) => { /* write an mp3 to file */ }` |

**You, in the corner.** A scene can carry a recording of a person, shown in a round bubble and kept in step with
the film; its sound is the narration:

```js
presenter: "assets/me.mp4",
// or: presenter: { file: "assets/me.mp4", at: "bottom left", size: 0.24, round: true, start: 1.5, volume: 1 },
```

Record yourself while the film plays, so the two are the same length. The bubble is there from the title to the end
card, music sinks under your voice, and the MP4 and the web export both carry the recording. Reading its length needs
ffmpeg. The film does not yet follow what you say: the steps keep their own timing.

**Your own recording.** A step can play a file of yours as its narration, with no provider at all:

```js
await click("Pay", { say: { text: "Paid.", file: "voice/paid.mp3" } });
```

`text` is still the caption (leave it out for none), and the step lasts as long as the recording. The file is a path
in your project; reading its length needs ffmpeg. A translated film does not use it: it is in the language you spoke.

`"says": { "Scenlit": "Seen lit" }` fixes how a word is pronounced; `"voices": { "de": { "voice": "Anna" } }` sets
a voice per language. A line is recorded once and reused until its words or its voice change.

## Export for a place

`npx scenlit export checkout --for youtube` writes the right shape and the files that place wants into
`.scenlit/output/checkout/export/youtube/`:

| `--for` | What you get |
|---|---|
| `web` | The film with its player, as a folder to put on any web host and embed like a video. No ffmpeg needed |
| `youtube` | 1920×1080 MP4, thumbnail, captions (`.vtt`, `.srt`), transcript |
| `linkedin` | 1080×1080 MP4 with the captions drawn in, captions file |
| `x` | 1920×1080 MP4, captions file |
| `reels` | 1080×1920 MP4 for Reels, Shorts and TikTok |
| `docs` | MP4, poster, captions, and the `<video>` tag to paste (`embed.html`) |
| `readme` | A GIF, 960 wide |
| `all` | Every one of them |

`--4k` doubles the size, `--fps 60` smooths motion, `--blur` adds motion blur (five times slower to make).

### On your own site, with the player

`--for web` writes `export/web/`: `index.html` (the player), the pictures and narration it needs, and `embed.html`
with the tag to paste. Put the folder on any static host and embed it:

```html
<iframe src="https://your-site.example/films/checkout/index.html"
  style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px" allow="fullscreen; autoplay" loading="lazy"></iframe>
```

It waits on the title card with a play button, has a scrubber and full screen, and stays sharp at any size
because it shows the frozen pages, not a video. A thirty-second film is about 2 MB. `index.html?shape=square` or
`?shape=vertical` gives the other shapes. `?background` plays the app part only, silently, on a loop (for behind a
page's words, or a README-style loop), and `?clear` makes the stage see-through, so the window floats on your page.

The player is yours to set, in the project's `style`, a format's or a scene's own:

```js
style: { player: { accent: "#3366ff", controls: ["play", "scrub", "time", "captions", "speed", "chapters", "fullscreen"], poster: 6 } }
```

| | |
|---|---|
| `accent` | The colour of its controls, and of what the viewer can click in the film. The brand's accent when not given |
| `controls` | Which it has: `play`, `scrub`, `time`, `sound`, `captions`, `speed`, `chapters`, `fullscreen`. The bar runs across the top; under it `play`, `sound` and `time` sit on the left and the rest on the right, each side in your order. `false`: none, and a click on the film plays and pauses it |
| `marks` | The places a viewer can go to, marked on the bar as on a video site: the film's chapters (its cards in the middle), or in a film without any, each step that says something. The pointer over the bar names the place, and a click near a mark lands on it. `"chapters"` or `"steps"` to choose; `false`: none |
| `poster` | What waits before the film is played: seconds into the film, or a picture in your project |
| `captions`, `speed` | Whether captions start on; how fast it plays (`1.5`). With the buttons, the viewer changes both |
| `tour` | A click-through demo: the film stops at every click, choice and typing, and the viewer does it (also `?tour`) |
| `autoplay`, `loop` | It starts by itself, with its sound off until the viewer turns it on; it starts again at its end. Also `?autoplay` and `?loop` on the address |

`chapters` lists the same places as the marks, to jump to. The controls are icons on a slim bar: under the film
when the film is opened by itself, over it when it is on a page, where they step back while it plays and the
captions move up clear of them. Keys: the space bar plays and pauses, the arrows go five seconds back or on, M is
the sound, C the captions, F full screen. For anything else, `.scenlit/style.css` reaches the player too (`#bar`,
`#track`, `#pp`, `#big`, `#chapters`).

To build your own controls around the film, talk to it from your page:

```js
const film = document.querySelector("iframe").contentWindow;
film.postMessage({ scenlit: { do: "play" } }, "*");          // "play", "pause", "seek" (at: seconds), "sound" (on: true)
addEventListener("message", (e) => {
  const m = e.data?.scenlit;                                 // { event, at } and what the event brings
  if (m?.event === "step") show(m.step);                     // ready, play, pause, ended, time, step, ask, link
});
```

`step` is the step now on screen (-1: the title, -2: the end), so a page can show the matching text beside the
film; `ask` says the film is waiting for the viewer; `link` says they followed a link or a button (its `text` and
`address`).

### Publish it: a link, a product page, and who watched

[scenlit.dev](https://scenlit.dev) gives each video a link without you hosting anything, gives your product a page
with its demos, help and what's new, and shows how each video was watched (`--to <address>`, or `"portal"` in
config.json, for another platform):

```sh
npx scenlit connect            # once per computer: you approve it in the browser
npx scenlit publish checkout   # to the portal this computer is connected to
# published: https://scenlit.dev/f/k3x9m2pq7a  (version 1)
# embed:     https://scenlit.dev/e/k3x9m2pq7a
# product:   https://scenlit.dev/ledgerly
npx scenlit portal             # your products, in the browser
```

- **The link stays.** Publishing the same scene again puts a new version behind the same link and embed. The platform
  keeps the newest three, counts each on its own, shows whether the new one keeps people watching longer, and can
  play an earlier one again.
- **A product, with a team.** Videos belong to the project's product (`"product"` in config.json, else the brand's
  name). Teammates join with an invite link; CI publishes with a product's token in `SCENLIT_TOKEN`.
- **Its page.** A tutorial is shown under Help with its step-by-step guide, a scene with `kind: "news"` under What's
  new, the rest under Demos (`--kind` to choose).
- **Pictures that stay current.** A scene's screenshots and thumbnail get addresses of their own: put one in your docs
  once, and every publish shows the app as it is now.
- **Who watched.** Plays, who stayed to the end, the share still watching at every second, the step where most left,
  links followed, the sites it was embedded on, and links made for one person ("Acme") counted apart. Viewings are
  counted, viewers are not: no cookie, no address is kept.
- **`--private`** keeps a video to the product's people, for a change to review. **`--listed`** puts it on the
  platform's front page with the scene that made it.

There is no public platform yet. It lives in its own repository and runs on Cloudflare (a Worker, Postgres, R2).

## Staging a film like a launch video

A launch video rarely shows a whole screen. It shows pieces of the product, one at a time, on a set. These steps and
settings do that; `format: "launch"` turns the settings on together.

| What | How |
|---|---|
| One piece of the app alone on the stage | `piece(target)`: a card, a message, a chart, as large as fits. `{ with: [other] }` puts more beside it; `{ animate: "count" }` moves it once it is there |
| A sentence as a scene | `words("But who is late right now?", { highlight: "late" })`. `{ beside: true }` keeps the app on screen, stepped to the right |
| Moving type | `motion`: `rise` (word by word), `letters`, `bounce` (letters drop in, tilted), `blur` (letters come out of a blur), `track` (the line closes up from wide spacing), `type`. `big: "painful"` sets words larger; `sweep: true` lays a box of the accent behind the highlighted words; `tag: "every month"` stamps a tilted label on; `stroke: true` draws a line through them |
| Quick swaps | `words(["Your product ships weekly.", "Your demo", "is from March."], { motion: "letters", for: 800 })`: the phrases replace each other in one place. Words after words keep the app away between them |
| Lines and fields | `stack: true`: each phrase a line under the last, on a numbered grid, the newest lit by a band. `field: "#ffd23f"`: a full-bleed colour cuts in behind the words, with poster type in the ink that reads on it |
| The scene's own code | `style: { source: true }`: the scene file runs down the left of the frame and the app sits beside it. The line now playing is lit, and the band reaches across to what it does: the camera puts that thing at the band's height. Wide films only; the scene file goes into the film only with this on |
| Marks on the app | `mark("circle", { testid: "total" })`, `mark("underline", …)`, `mark("box", …)`, `mark("arrow", "Send reminder")`: drawn in the accent, moving with the camera. `mark("stroke")` sweeps one across the stage |
| Text that is typed, or streams in | `animate(target, "type")` (letter by letter, with a caret; a field's value is typed) and `animate(target, "stream")` (word by word, as an answer arrives) |
| A screen that builds itself | `animate({ selector: "main" }, "build")`: its blocks arrive in reading order |
| A new state growing out of the click | `motion: { cut: "grow" }` |
| The rest out of focus | `motion: { spotlight: "focus" }`, for `point()` |
| A window turned in space, never quite still | `camera: { tilt: [4, -9], drift: 0.04, parallax: 0.05 }` |
| A lit set | `finish: { light: true, grain: 0.05, vignette: 0.3 }` |
| The logo landing at the end | `logo: "assets/logo.svg"` with `end: { sting: true }` |
| Cards and the window on the music's beat | `music: { file: "pulse", cuts: true }` (your own track: add `bpm`) |
| Captions in time with the voice | `motion: { caption: "words" }`: with narration, each word comes as it is said (by its length, not by a transcript) |

```js
export default {
  format: "launch",
  style: { logo: "assets/ledgerly.svg", music: { file: "calm", cuts: true } },
  async run({ card, open, piece, words, animate, click }) {
    await card("Every month,", "someone forgets to pay.");
    await open("/reports");
    await piece({ testid: "revenue-card" }, { animate: "draw", say: "Revenue is up a third this year." });
    await words("But who is late right now?", { highlight: "late" });
    await piece({ testid: "question" }, { animate: "type" });
    await piece({ testid: "answer" }, { animate: "stream" });
    await words("Ledgerly already knows.", { beside: true, highlight: "knows" });
    await open("/");
    await animate({ selector: ".page" }, "build");
    await click("Send reminder", { say: "One click sends the reminder.", sound: "success" });
    await card("Ledgerly", "Get paid on time.");
  },
};
```

What this does not give you: live action, people, illustration, or a script. Those are still a person's work.

## Speed and timing

| What | How |
|---|---|
| The whole film's pace | `pace` in the style (a project, a format or one scene): above 1 gives every step and card more time |
| One step | `{ pace: 0.5 }` makes that step twice as brisk; `{ hold: 2000 }` stays two seconds longer on what it did |
| A dull stretch | `await fast(async () => { … })`: the steps inside play four times quicker (`{ speed: 8 }` for more), with a mark on screen |
| A film of a set length | `length: 20` on the scene, in seconds |
| A moment of nothing | `pause(1500)` |
| The camera and the cursor | `camera.speed` in the style |
| One animation | `animate(target, "count", { ms: 1800 })` |

```js
await click("New invoice", { say: "Start a new invoice and fill it in." });
await fast(async () => {
  await select("Customer", "Halcyon Health");
  await fill("Amount", "6,800");
});
await click("Send invoice", { say: "Send. It is on its way.", hold: 800 });
```

A step sizes itself: it lasts as long as its caption takes to read, or its narration to be said. Words have no time
inside `fast`, so put the caption on the step before or after. With `length`, the rests are stretched or shrunk
first (to between 0.3 and 4 times the style's pace); if that is not enough, the whole film plays up to a half
quicker or slower for the rest of the way. A film with narration is never sped up, so it may come out longer than
asked.

## Sound

Music and sound effects are part of the style, so a project, a format or one scene can set them. Both play in the
page and are mixed into the exported MP4.

**Music under one film** is part of the style, so a format or a single scene can have its own:

```js
style: { music: { file: "assets/bed.mp3", volume: 0.2, start: 12, fadeIn: 2, fadeOut: 1.5, duck: 0.45, loop: true } }
```

| Setting | What it does |
|---|---|
| `file` | A track in your project, or a built-in bed: `calm` (slow chords) or `pulse` (the same chords with a soft beat). The beds are made in code: no file to ship, nothing to license |
| `volume` | 0 to 1 (0.15 when left out) |
| `start` | Where in the track to begin, in seconds |
| `fadeIn`, `fadeOut` | Seconds to come in at the start and go out at the end (0: none) |
| `duck` | How far the music sinks while narration is speaking: 0.45 is down to 45% |
| `loop` | Start the track again when it ends (on by default) |

The viewer has their own controls in the player: a sound button (or the M key) and a volume slider, remembered for
next time. They act on everything: music, narration and effects.

**Sound effects.** Sixteen come built in, made in code, so there is no file to ship and nothing to license:

| For | Sounds |
|---|---|
| Hands | `tap` (a click), `key` (typing), `tick` |
| Things arriving and leaving | `pop`, `swipe`, `whoosh`, `rise` (a build-up), `boom`, `thud` |
| Results | `chime`, `success`, `error`, `ding`, `notify`, `sparkle`, `shutter` |

`npx scenlit sounds` lists them, and `--save` writes each as a `.wav` to listen to. Your own go in
`.scenlit/sounds/<name>.wav` (or `.mp3`, `.m4a`, `.ogg`) and win over a built-in one of the same name.

There are four ways to say where a sound plays:

```js
// 1. the style: one sound for each kind of moment (a project, a format or one scene)
style: { sounds: { click: "tap", type: "key", cut: "swipe", end: "thud", volume: 0.5 } },

// 2. a step: when what it did shows, or say when, how much later and how loud; a list plays several
await click("Pay", { sound: "success" });
await animate({ selector: "table" }, "rows", { sound: { name: "ding", at: "end", delay: 200, volume: 0.6 } });

// 3. a step of its own
await sound("notify");

// 4. a moment of the film itself: seconds from the start, from the end (negative), or "title", "app", "end"
cues: [{ name: "rise", at: "end", delay: -1200 }, { name: "notify", at: 2.5 }],
```

The kinds of moment a style can give a sound to: `click`, `type` (each key), `caption`, `card` (every card, unless
`title`, `chapter` or `end` says otherwise), `enter` and `exit` (the window), `cut` (the page changes between two
steps), `zoom`, `point`, `label`, `animate`, `fast` (a fast-forward begins). A step's `at` is `result` (the default),
`start` or `end`. A film with sound waits for a click before it plays, as browsers require.

## Moving the app's own screen

Between the two pictures of an action Scenlit records what the app draws: a panel sliding in, text being typed.
The film plays those frames, so the app's own animation shows. It is on by default (`"look": { "motion": false }`
turns it off) and costs nothing when nothing moves.

Scenlit keeps each picture as the real page, so a film can move the page's own elements, and they stay sharp:

```js
await animate({ testid: "revenue" }, "count", { say: "A hundred and fifty-eight thousand this year." });
await animate({ selector: "#chart" }, "draw", { ms: 2200 });
await animate({ selector: "table" }, "rows");
```

What is about to move is in its starting place from the moment its page first shows: a number at zero, a chart not yet
drawn. It needs the picture to be a frozen page (the run says how many are) and the film to be served or exported;
opened straight from disk in your own browser, the element stays still.

## Brand and themes

`npx scenlit look --save` keeps the app's name and colour (see above). `"brand": { "theme": "paper" }` switches the films and posts to a light look (`night` is the default, `plain` has
no glow). Any colour written under `brand` wins over the theme.

## Other languages

`npx scenlit translate checkout --to de` asks a model for the film's words in another language and writes them to
`.scenlit/translations/checkout.de.json`, which you can edit. It also writes `film.de.html`. Then
`voice checkout --lang de` and `export checkout --lang de` work on that version.

## Writing scenes with help

- `npx scenlit record signup` opens your app; click through it, close the window, and you get the scene file with
  exact steps. Passwords are never written: they are read from the `PASSWORD` environment variable.
- With Claude Code, ask in plain words: "make a film of the new export button". The `/scenlit` skill does the rest.

## In CI

[docs/ci.md](docs/ci.md): the GitHub Action that runs every scene on each pull request, so a film that can no longer
be made fails the build.

## Commands

| Command | What it does |
|---|---|
| `init` | Sets up `.scenlit/` in this project |
| `dev <scene> [--port 4400]` | Runs it, serves the film, runs again every time you save |
| `doctor` | Is this machine ready, and what is missing |
| `login [path] [--as name]` | Sign in by hand; scenes then start signed in |
| `look [path] [--save]` | Reads the app's name and colour, and proposes a marketing look |
| `run <scene>` / `run --all` | Runs on the app, then writes the film, posts, screenshots and guide. `--record`, `--strict`, `--look`, `--format <kind>`, `--headed` |
| `check [scene]` | Every scene without running it: missing titles, posts without a picture, steps not recorded yet |
| `frames <scene> [--shape s] [--at seconds] [--out path]` | Still frames of the film, to review without playing it |
| `voice <scene> [--retake]` | Records the narration |
| `export <scene> [--for place] [--shape s] [--all] [--step n] [--gif] [--4k] [--fps 60] [--blur] [--out path]` | The film as an MP4 with a poster and captions, or one step as a loop. Needs ffmpeg |
| `record <name> [path]` | Write a scene by clicking through the app |
| `translate <scene> --to <lang>` | The film's words in another language |
| `inspect [path]`, `sheet <scene>`, `guide` | For agents: what is on a page, the film as one image, how to write scenes |
| `component list`, `component add <kind>`, `component new <name>`, `component from <scene>/<shot> <name>` | The built-in screens, and vector pieces of your own |
| `motion list`, `motion new` | The pieces that move things, and a file to add or replace them |
| `sounds`, `sounds --save` | The sound effects and music beds, and where a sound can play; `--save` writes them as `.wav` files |
| `kit` | The app as a library of vector pieces |
| `site` | One page listing everything: `.scenlit/output/index.html` |
| `connect [--to address]`, `disconnect` | Connects this computer to the platform (you approve it in the browser), or no longer |
| `publish <scene> [more] \| --all [--to address] [--kind demo\|help\|news] [--private] [--listed]` | The video gets a link on the platform, its product's page shows it, and you see who watched. Several scenes in one go: name them, or `--all` |
| `unpublish <scene>`, `portal` | Takes the video down; opens your products in the browser |

## Settings: `.scenlit/config.json`

```json
{
  "app": { "url": "http://localhost:3000", "start": "npm run dev", "as": "acme.com" },
  "brand": { "name": "Acme", "url": "acme.com", "background": "#07090d", "glow": "#1b2a3f",
             "text": "#f3f1ea", "muted": "#8d939e", "accent": "#f5b63a" },
  "look": { "viewport": { "width": 1280, "height": 800 }, "hide": [".cookie-banner"], "css": "" },
  "looks": { "marketing": { "viewport": { "width": 1120, "height": 700 }, "hide": ["header .search"] } },
  "data": { "replace": {}, "blur": [], "date": null },
  "model": { "provider": "claude-code" },
  "voice": { "provider": "none" }
}
```

- **app**: where the app runs, the command that starts it when it is not up, and the address films show.
- **brand**: colours and fonts (`font`, `titleFont`, and `fontImport` for a web font stylesheet).
- **look**, **looks**: how the app is captured. A smaller viewport gives bigger type.
- **style**, **formats**: how films and posts look (above).
- **data**: sample data for every scene.
- **save**: where every scene's results are also kept in your project (see Where the results go).
- **portal**, **product**: the platform `scenlit publish` sends videos to, and the product they belong to there (see
  Publish it).
- **model**: who works out plain-language steps the first time they run (exact steps need no model).
  - `claude-code` (the default): the Claude Code login on this machine. No key.
  - `anthropic`: the Claude API, or any API that speaks it. Install `@anthropic-ai/sdk`; the key is
    `ANTHROPIC_API_KEY` (or an `ant auth login` profile).
  - `openai`: any API that speaks OpenAI's chat completions: OpenAI, OpenRouter, Ollama, LM Studio, vLLM, Groq and
    others. No package needed; the key is `OPENAI_API_KEY`, and a server on this machine needs none.

  `url` is the API's address when it is not the provider's own, `key` the name of the environment variable that holds
  the key (never the key itself: the file goes to git), `model` which model. `scenlit doctor` checks it.

  ```json
  "model": { "provider": "openai", "url": "http://localhost:11434/v1", "model": "qwen3" }
  "model": { "provider": "openai", "url": "https://openrouter.ai/api/v1", "key": "OPENROUTER_API_KEY", "model": "<a model id>" }
  ```
- **voice**: who narrates (see Narration). `none` gives captions only.

## What is in `.scenlit/`

| Folder | What | In git |
|---|---|---|
| `config.json` | Settings | yes |
| `scenes/` | Your scenes | yes |
| `recordings/` | The actions each plain-language step turned into | yes |
| `components/` | Vector pieces drawn by you or an agent | yes |
| `motion.js` | Your own motion pieces and effects | yes |
| `style.css` | Your own CSS over every film and post | yes |
| `kit/` | The vector library (`scenlit kit`) | yes |
| `voice/`, `translations/` | Narration, translated words | yes |
| `sessions/` | Saved logins | no |
| `captures/`, `output/` | Made again by a run | no |

## Limits today

- The film is built from frozen pages (or screenshots) of the app plus the frames recorded during each action. It is not a live page:
  things that move on their own between actions (a spinner, a chart animating in) show as they were when the
  picture was taken.
- Web apps only, in Chrome. Tested on macOS and Linux; Windows is not tested yet.
- A sign-in that needs a code from an email is not handled; authenticator codes are (`totp`).
- Narration is timed per step, not per word.
- A recording made by an earlier version of Scenlit is not reused when its shape has changed: the scene says so and is run again.
- The camera stays still while the next action is comfortably in view, and glides when it moves; the cursor
  travels in a slight arc.

## Examples and tests

```sh
npm install
npm test                                  # both examples by replay: no model is called
cd examples/store && node ../../bin/cli.mjs run checkout
cd examples/dashboard && node ../../bin/cli.mjs run signin && node ../../bin/cli.mjs run customers
```

- `examples/store`: a small shop. Plain-language steps, posts, a guide.
- `examples/dashboard`: an app behind a login with customer data. Sign-in by a scene, sample data, pointing, the
  marketing look.

Made by [Certyn](https://certyn.io). What changed in each version is in [CHANGELOG.md](CHANGELOG.md).

## Licence

Apache-2.0. Free for everyone, built by Certyn. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
