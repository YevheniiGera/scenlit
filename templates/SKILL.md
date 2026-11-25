---
name: scenlit
description: Make a product film, social post, carousel, docs screenshot, step-by-step guide or click-through demo of this app from a brief, a feature or a pull request. Looks at the real app, writes a scene in .scenlit/scenes/, runs it, reads the result and fixes what reads wrong. Can also draw vector components for things outside the app. Never publishes.
---

# Scenlit

Everything is made from **scenes**: files named `<name>.scene.mjs` (or `.ts`) in `.scenlit/scenes/`, or next to the
feature they show anywhere in the project, that drive the real, running app.
One run of a scene writes a film, posts, plain screenshots and a guide to `.scenlit/output/<name>/`.
Settings are in `.scenlit/config.json`. Every command below is `npx scenlit …`; `run`, `check`, `inspect` and
`sheet` take `--json`.
To keep a result in the project (a film on the site, a picture in the docs), give the scene
`save: { film: "public/films/<name>", video: "public/<name>.mp4" }` (also `posts`, `guide`, `thumbnail`), or a
shot its own `{ save }`. A copy is made there on every run. `--out <path>` on `export`, `frames` and `sheet`
copies one result once.

## First, get to know the product

Before writing anything, find out what the product is for and where it shines:

- Read the project: the README, the landing page's words if they are in the repo, the routes, the changelog and
  recent commits (what is new).
- Walk the app: `inspect /`, then each page the navigation leads to. Note who uses it, the job it does for them,
  and the moment it saves them real work: that moment is the film.
- Unless the user said exactly what to make, suggest before you start: two or three films, each in a few lines:
  who it is for, its first three seconds, its one moment, the kind (`product-demo`, `feature`, `tutorial`,
  `story`, `short`) and its length. Ask which to make.

## What makes a demo good

- **One film, one idea.** Say it in one sentence first: "<who> can <do what> in <how little>". If you cannot, do
  not film yet.
- **Hook in three seconds.** Open on the viewer's problem or on the result, never on the product's name alone:
  `card("Who owes you", "money right now?")`. Short cards, two lines.
- **Build to one moment.** Everything before it is setup: quick, `fast()` for forms. The moment itself is bigger
  and slower: `zoom` or `piece`, `hold`, a sound. One per film.
- **Show the before.** The pain first (an email asking about a payment, a long list), then the product making it
  go away. A component can show what is outside the app.
- **Captions say what the viewer gets**, not what was clicked: "Kestrel gets a reminder", not "Click Send
  reminder". At most eight words; not every step needs one. (In a tutorial, captions say what to do.)
- **Data that tells one story.** Names, amounts and dates that fit together; never empty, never lorem ipsum,
  never a real customer (`mock`, `replace`).
- **Cut what does not move the story.** Start signed in and open the page that matters; no tour of the menu.
- **End on what to do next:** an end card with `{ button, url }`.
- **Length:** a product demo 20 to 45 seconds, a feature 15 to 20, a short 15, a tutorial as long as its steps.
- **Motion has a job.** It guides the eye (a `mark`, a `zoom`), shows a change (`animate`), or sets the pace (short
  `words` between shots, on the music's beat). A launch film can open with quick moving words (`words([...], { motion:
  "letters", for: 900 })`) and cut between words and the app; a tutorial stays calm. Motion that does none of these
  is noise.
- **Check it as a stranger would:** on the sheet, could someone who never saw the product say what it does from
  the first three moments?

## Design it before you build it

A demo that looks expensive is designed, not only recorded. Set its look before writing `run()`. If you have a design
skill (for example `frontend-design`), use it for this step; otherwise follow this:

1. **Start from the product.** Its own colours, type, words and world are where a look comes from, not a template.
2. **Write a short plan:** four to six colours with hex values, one or two typefaces and what each is for, how a frame
   is laid out (where the words sit, where the app sits, left or centred), and the one thing this film will be
   remembered by. Spend boldness there; keep the rest quiet.
3. **Check the plan against the defaults** that generated designs fall into, and change any part you would have
   made for any product: near-black with one bright accent, cream with a serif and a clay accent, identical rounded
   cards with the same soft shadow, all-caps labels above every heading, a glow behind the window, one word of a
   headline in another colour.
4. **Show two or three directions first.** Make style frames (the hook, the product moment, the end) as stills, and
   let the user pick or mix before you build the film. Once a scene runs, `frames <name> --at <s>` renders any moment.
5. **Build the chosen look into the scene:** `brand` (colours; fonts with `fontImport`), `style` (background,
   window, captions, `finish`, `source: true` to show the scene's own code beside the app), `words` (`motion`,
   `stack`, `field`, `big`, `sweep`), `mark`. Then watch the export frame by frame and fix what reads cheap.

## Examples

Do not invent the shape of a film: start from the example of its kind, `npx scenlit guide <example>`. Each is a
complete scene that runs on a sample invoicing app, with notes on why it is built that way. Keep the shape, change
the pages, names and words to this app.

| Example | For | Length |
|---|---|---|
| `product-demo` | A landing page, a sales email: hook, setup, one moment, payoff, next | 25 to 40 s, wide |
| `feature` | A release post, the changelog: one new thing, shown working | 15 to 20 s, square |
| `tutorial` | The help center, the docs: one task, numbered steps | as long as its steps, wide |
| `story` | One person's problem across the screens it touches: before, moment, after | 30 to 45 s, wide |
| `short` | Reels, Shorts, TikTok: a hook and three quick beats | about 15 s, vertical |
| `launch` | A launch for developers: the scene's own code beside the app, colour fields between | 40 to 55 s, wide |

## The loop

1. **Look before you write.** `npx scenlit inspect /path` prints the page's controls by name, its other parts
   with a selector for each, its text, and saves a picture you can read (`--as admin` for a signed-in page). Never
   guess a name or a selector.
   - A page that is only reached by clicking (a cart, a dialog, a side panel): write the steps that get there,
     then `npx scenlit inspect --scene <name>` shows the page the scene ends on. Write the rest from that.
   - When `inspect` says a name has a number that may change ("Cart0"), use its `{ testid }`.
2. **Write the scene** with exact steps, using the names `inspect` printed:

   ```js
   /** @type {import("scenlit").Scene} */
   export default {
     async run({ card, open, click, fill, select, hover, point, zoom, label, see, shot, mock, replace, freeze }) {
       await mock("/api/customers", [{ name: "Acme Inc", status: "Past due" }]);   // never film a real customer
       await card("Who is behind on payment?", "One filter answers it.");   // first: opens the film; always two lines
       await open("/");                                               // starts signed in with the saved login
       await zoom({ testid: "mrr" }, { say: "Revenue is on top." });
       await select("Status", "Past due", { say: "One filter shows who is behind." });
       await click("Acme Inc", { say: "A click opens the customer." });
       await see("Customer since");                                   // a check, after the last action
       await shot("customer", { crop: { selector: "#panel" }, save: "docs/img/customer.png" });
       await card("Your customers,", "at a glance.");                 // last: ends it
     },
     posts: [{ name: "late", lead: "Who is behind on payment?", key: "One filter answers it.", shot: "customer" }],
   };
   ```

3. **Run it:** `npx scenlit run <name> --json`. The JSON lists what each step did, the checks that passed,
   every file written (`files.sheet` among them), and `notes`: what reads wrong (a click that changed nothing, a
   caption that will wrap, a step that did too much). Fix every note or decide it is fine. An empty `notes` does
   not mean the film reads well: only looking does.
4. **Look at it:** read `files.sheet` (`.scenlit/output/<name>/sheet-wide.jpg`; `npx scenlit sheet <name>` makes it
   again): one image, the film at eight moments with time and caption. Check that each caption matches what is on screen at that moment, that the camera shows the thing the
   step is about, and that nothing private is visible. For one moment, `frames <name> --at 7.5`. Read the post
   images in `posts/` too.
5. **Fix and run again** until the sheet reads right. Then show the user `.scenlit/output/index.html`.

## Steps

| Step | Use |
|---|---|
| `open(path)` | A page of the app, or `"component:<name>"` |
| `click`, `fill(t, value)`, `select(t, option)`, `hover`, `upload(t, file)`, `drag(from, to)`, `press(key)`, `scroll(t)` | Exact actions. A target `t` is the control's name from `inspect`, or `{ testid }`, or `{ selector }` |
| `act(goal, { params, say })` | A goal in plain language, worked out by a model once and recorded. Use it only when exact steps would be brittle; you can usually write exact ones |
| `point(t)`, `zoom(t)`, `label(t, text)` | Show something without acting on it: spotlight, closer look, a tag |
| `effect(name, t?, options)` | An effect on something or the whole window: `pulse`, `shake`, or the project's own |
| `animate(t, name)` | The app's own element moves, inside the page: `count` (a number counts up), `draw` (a chart draws itself), `rows`, `build` (a whole section arrives block by block), `type`, `stream` (text is typed, or streams in), `pulse`, `pop`, `lift`. Put it right after the page appears: the element waits in its starting place from the moment its page shows |
| `piece(t, { with, animate })` | One part of the app alone on the stage, large (a card, a chart, a message); `with: [t2]` puts more beside it; `animate: "count"` moves it once there |
| `words(text, { motion, highlight, big, sweep, tag, stroke, for, beside })` | Words as a scene. A list of phrases plays as quick swaps. `motion`: `rise`, `letters`, `bounce`, `blur`, `track`, `type`. `big`: words set larger; `sweep`: a box of the accent behind the highlighted ones; `tag`: a tilted label; `stroke`: a line through them; `for`: ms each stays. `stack: true`: the phrases build up as numbered lines, the newest lit; `field: "#ffd23f"`: a full-bleed colour behind, poster type. `beside: true` keeps the app on screen, stepped to the right |
| `mark(kind, t)` | A mark that draws itself on the app: `circle`, `box`, `underline`, `arrow`; `mark("stroke")` across the stage |
| `overlay("component:notification", { at, for, data })` | A component laid over the film for a while (a notification, `component:phone`), as the steps after it carry on underneath. `wait: true` holds the film until it has gone |
| `together(async () => { … }, { stagger, say })` | The steps inside (`animate`, `effect`, `overlay`, `sound`) start at the same moment. A sound for one of them goes on that step, not on the group |
| `link(t, address)`, `button(text, address, { at, for, wait })` | Something of the app the viewer can click through; a button laid over the film. Any acting step takes `{ byViewer: true }`: in the player the film stops there until the viewer clicks the marked place. `?tour` on the film's address (or `player: { tour: true }`) makes every such step wait: a click-through demo. Use these only when asked for a film people take part in |
| `fast(async () => { … })` | Fast-forward the steps inside (a long form). No captions in there |
| `sound(name)` | A sound effect by itself. `npx scenlit sounds` lists them |
| `state(value)` | Sets `data-state` on the page's root: how a component changes (below) |
| `see(text)` | A check: this text, or any visible text containing it, must be on the page. Put one after the last action; a scene that fails writes nothing |
| `card(lead, key)` | Two lines on the stage: first, it opens the film; last, it ends it; between, a chapter |
| `pause(ms)` | Hold |
| `background(colour or picture)` | The stage behind the app from here on: a colour, colours for a gradient, or a picture path |
| `shot(name, { crop, save })` | A named picture: for posts, as a PNG, and with `save`, written into the project |
| `mock(path, answer)`, `replace({ from: to })`, `blur(selector)`, `freeze(date)` | Sample data. Call before `open` |
| `saveLogin()`, `totp(secret)` | Keep the login: scenes start signed in with it (`saveLogin("admin")` and `as: "admin"` for a second one); an authenticator code |

Any step also takes `sound: "success"` (or `{ name, at: "start" | "result" | "end", delay, volume }`), `hold: 1500`
(stay that much longer on what it did) and `pace: 0.5`.

`say` on any step is its caption (and narration when a voice is set; `say: { text, voice }` gives the narration
its own, longer sentence; `say: { text, file: "voice/paid.mp3" }` plays the user's own recording): at most about eight plain words, the
viewer's outcome ("The cart shows the total"), not an instruction ("Open the cart"), matching what the screen
shows once the step is done.

A target for `point`, `zoom`, `label` or a crop is often not a control: use a selector from `inspect`'s "other
parts", and give it a name so the written guide reads well: `{ selector: ".row.total", name: "the total" }`. Values that matter go in `params` or the environment, never in
a goal's text.

## Components: things outside the app

When the story needs a screen that is not this app (a pull request's checks, a chat message, an email), or a
state the app cannot easily reach, draw it as a component: one self-contained HTML file with CSS.

- **Start from the built-in ones:** `pull-request`, `chat`, `email`, `terminal`, `issue`, `notification`, `phone` work without copying
  (`npx scenlit component list`). `npx scenlit inspect component:chat` shows a component's states, slots and
  controls. Fill its text from the scene and move it through its states:
  `await open("component:chat", { data: { channel: "releases", text: "2.2 is not ready." } }); await state("message");`
  `npx scenlit component add chat` copies one into the project when its look must change.
- `npx scenlit component new pr-check` writes `.scenlit/components/pr-check.html` with the contract in its
  comments. `npx scenlit component from <scene>/<shot> <name>` starts from a frozen page of the real app instead.
- Draw it at the look's viewport (1280×800). Real text and borders, no images of text, no network, no build step.
  Give controls real names so scenes can `click("Details")`.
- States are CSS on the root: `[data-state="failed"] .icon { … }`. A scene calls `await state("failed")`; add
  transitions, they are filmed.
- `<meta name="scenlit:host" content="git.example.com/…">` is the address the film's window shows for it.
- Check it like a page: `npx scenlit inspect component:pr-check` (it lists the states too), then use it:
  `await open("component:pr-check"); await state("failed", { say: "The release check fails." });`
- Recognizable, not a copy: do not reproduce another product's logo or exact look.

## Look and style

- A scene may set `look` (`"marketing"`, `"phone"`, `"tablet"`, `"dark"`, `"light"`, or a drawn one: `"cartoon"`,
  `"sketch"`, `"blueprint"`; a look of your own is `{ css, filter, style }` under `looks` in `config.json`), `format` (the kind of film, one word:
  `"demo"`, `"tutorial"`, `"feature"`, `"trailer"`, `"canvas"`, `"launch"`, `"recording"`, `"short"`, `"keynote"`, `"loop"`, `"source"` (the scene's own code beside the app, the playing line lit); try one on any
  scene with `run <name> --format trailer`), `length: 20` (seconds) and `style: { … }` (background, window, cursor,
  camera, captions, titles, end button, pace, sounds, music, finish). The project's defaults are under `style` in `config.json`; `.scenlit/style.css` is laid over
  everything.
- Every run writes `thumbnail.png` (the title beside the first named picture); `thumbnail: { lead, key, shot }`
  in the scene chooses its words and picture.
- Posts: `{ name, lead, key, line, shot }`: two title lines, one optional plain sentence (`line`), and a picture;
  or `shots: ["a", "b"]` (overlapping), `tilt: true`, `sizes`. Carousels:
  `carousels: [{ name, slides: [{ lead, key, line, shot }] }]`.
- Change the project's brand, style or looks only when the user asks.

## Motion

Every way something moves is a named piece in a family: `title`, `enter`, `exit`, `cut`, `cursor`, `click`,
`spotlight`, and `effect`. `npx scenlit motion list` shows the built-in pieces and the shape of each.

- Pick pieces in a scene or the settings: `style: { motion: { cut: "slide", enter: "grow", click: "pulse" } }`.
- A scene can ask for an effect: `await effect("pulse", { testid: "total" })`, `await effect("shake")`.
- To change how something moves, or add an effect, write it in `.scenlit/motion.js` (`npx scenlit motion new`
  writes the file with two examples and the kit explained). A piece schedules changes on the film's clock with
  `kit.start`, `kit.to`, `kit.show`, `kit.hide`; it never uses timers or CSS animations of its own, so every
  moment of the film can still be shown exactly. Then look at the sheet, as with any change. A piece meant to be
  shared goes in a file of its own, `.scenlit/motion/<name>.js`.

## Other commands

| Command | What it does |
|---|---|
| `dev <name>` | Runs the scene, serves the film, and runs again on every save: for a person watching while you edit |
| `check [--json]` | Every scene without running it: what is missing |
| `run --all --strict` | Every scene, never calling a model (what CI does) |
| `export <name> --for web\|youtube\|linkedin\|x\|reels\|docs\|readme` | The right shape and files for that place, in `export/<place>/` (needs ffmpeg). Also `--shape wide\|square\|vertical`, `--step n --gif`, `--4k`, `--blur` |
| `kit` | The vector library: HTML, PDF and SVG of every named picture, plus the components, in a gallery |
| `translate <name> --to de` | The film's words in another language |
| `login [--as name]`, `look --save`, `voice <name>` | These need the user: a person signs in; they approve the brand and look; a paid voice costs credits |
| `doctor` | What this machine is missing |

## Rules

- Never post, publish or send anything. The user does that.
- Only what the real app shows. Sample data hides real customers; it must not show features that do not exist. A
  component stands for something outside the app, never for a screen of the app that is not built.
- Ask before `voice` with a paid provider, before `look --save`, and before changing
  `config.json`'s brand or style.
- Commit `.scenlit/scenes/`, `recordings/`, `components/`, `voice/`, `kit/`; sessions, captures and output stay
  out of git.
