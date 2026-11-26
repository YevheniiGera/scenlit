# Changelog

## 0.1.0 (2026-11-26)

The first release.

**Scenes.** A scene file (`<name>.scene.mjs`, `.js` or `.ts`) drives your real app in Chrome. Steps in plain
language (`act`) are worked out by a model once, recorded, and replayed for free; exact steps (`click`, `fill`,
`select`, `hover`, `upload`, `drag`, `press`, `scroll`) never call a model. A replay repairs itself when the app
changes, and `--strict` (the default in CI) fails instead.

**What a scene makes.** A film with an embeddable player, posts and a thumbnail, docs screenshots, a how-to guide, a
click-through demo (the same film with `?tour`), a vector kit, and exports for a place (`--for web`, `youtube`, `linkedin`, `x`, `reels`, `docs`,
`readme`).

**Driven from the page.** `film.html?embed&controls=none` shows no controls of its own, for a page that plays the
film itself (it sends `play`, `pause` and `seek`, and hears `time` and `ended`).

**Everything as steps.** A scene can say all of its film in `run()`, in the order it plays. `card(lead, key)` is two
lines on the stage, and where it is said decides what it is: before the app shows, the opening card (which names the
film); after the last step, the end card (`{ url, button }`); anywhere else, a chapter. A scene needs no cards: without
an opening one the film starts in the app, without an end one it ends on its last picture. (`title()`, `end()` and
`chapter()` still say it outright, and the `title` and `end` fields still work.) `background(...)` changes the stage
from that point, a fade, or from the start when said first: a colour, colours for a gradient, or a picture (a path in
your project, or an address). The player's `ready` message now says where the window comes in, where each step begins
and where the end card begins (and a page can ask again with `ready`).

**Any model.** Plain-language steps can use any API that speaks OpenAI's chat completions (`"provider": "openai"`:
OpenAI, OpenRouter, Ollama, LM Studio, vLLM, …, with no package to install) or Anthropic's messages (`"anthropic"`),
besides the Claude Code login. `model.url` is the API's address, `model.key` the name of the environment variable that
holds the key (a key written there is refused), and `doctor` checks them.

**Other coding agents.** `init` also adds a short section to `AGENTS.md` (or writes one), so Codex, Cursor and the
other agents that read it know to run `npx scenlit guide` before writing a scene. An `AGENTS.md` that is already there
is kept, and the section is added once.

**The scene's own code.** `format: "source"` is the whole look in one word; with `style: { source: true }` a film shows its scene file down the left, every line
numbered, the app beside it; the line now playing is lit, and its band reaches across to the thing it does in the app.
`words()` can `stack` its phrases as numbered lines (the newest lit) and stand on a full-bleed colour `field`. A brand's
web fonts (`fontImport`) now load in films: the import had been placed after other rules, where browsers ignore it.

**Moving type and marks.** `words()` takes a `motion` (`rise`, `letters`, `bounce`, `blur`, `track`, `type`), a list
of phrases that swap in one place, `big` words, a `sweep` box behind the highlighted ones, a tilted `tag`, a `stroke`
drawn through them, and `for` (how long each stays); words after words keep the app away between them. `mark()` draws a
circle, box, underline or arrow on the app, or a stroke across the stage. The guide says when motion helps.

**Making a good film.** The guide now has an agent get to know the product first and suggest films before making
one, gives the rules a good demo follows (a hook in three seconds, one moment, the before, captions about what the
viewer gets, data that tells one story), and starts each film from an example of its kind: `scenlit guide
product-demo`, `feature`, `tutorial`, `story` or `short`, each a scene that runs. A run's notes now say when a film
opens with no hook, when nothing in it stands out, and when a caption says what was clicked rather than what the
viewer gets. The built-in chat and email components take their times as text (`time`, `time1`, …), so a story's
times agree on every screen. A film with no opening card gets a thumbnail again.

**Waiting.** A step waits up to five seconds for its control to show up and be enabled (a page still loading its
data, a button still disabled), and a step that fails says how long it waited.

**Endings.** A film without an end card (as in `recording`) now ends on its last picture: the
window no longer leaves for an empty background, unless `motion.exit` asks for it.

**Publishing.** `scenlit connect` connects a computer to [scenlit.dev](https://scenlit.dev), or another platform with
`--to` (approved in the browser), once: after that, commands publish there with no address to give; `scenlit publish <scene>` gives the video a link, an embed and a place on its product's page (demos, help
with the step-by-step guide, what's new), sends its screenshots as pictures whose addresses stay current, and keeps the newest three versions. `--private` keeps it to the product's people, `--kind` chooses where it is shown,
`--listed` puts it on the platform's front page. In CI, `SCENLIT_TOKEN` is a product's token. A scene may say
`kind: "news"`. The platform lives in its own repository. The player tells the page around it when a link is followed
(`link`), and fits itself when the frame it is in gets its size late. A guide no longer shows the selector of a label
placed by one.

**Kinds of film.** `format` is one word: `demo`, `tutorial`, `feature`, `trailer`, `recording`, `short`, `keynote`,
`loop`, `launch`, `canvas` (the pages as frames side by side on a design canvas, the camera travelling between them, named
cursors, selections with their real size). Any scene can be run as another kind: `scenlit run checkout --format trailer`.

**Staging.** `piece()` shows one part of the app alone on the stage; `words()` is a sentence as a scene; `overlay()`
lays a component over the film while it carries on (a notification, a phone); `together()` starts several steps in
the same moment; `presenter` puts a recording of you in a corner, in step with the film; `animate()`
moves the app's own elements (`count`, `draw`, `rows`, `build`, `type`, `stream`, `pulse`, `pop`, `lift`); `point()`,
`zoom()`, `label()`, `chapter()`, `effect()`.

**Looks.** `scenlit look` reads the app's name and colour and proposes a marketing look. `phone`, `tablet`, `dark`, `light`, and drawn looks (`cartoon`, `sketch`, `blueprint`). Your own colours,
fonts, background, window, cursor, camera (tilt, drift, parallax), captions, cards, finish (light, grain, vignette)
and CSS, for a project, a format or one scene. Motion is a registry of named pieces you can add to.

**Time.** `pace`, per-step `{ hold, pace }`, `fast()` to fast-forward, and `length` for a film of a set length.

**Sound.** Sixteen sound effects and two music beds made in code, your own files, a sound per kind of moment, per
step or at a moment of the film (`cues`), music with volume, start, fades and ducking, narration (`say`, ElevenLabs,
OpenAI, a command, or your own recording of a line), and sound controls for the viewer.

**Taking part.** In the player a film can stop for the viewer's own click (`byViewer`), make something of the app
a link (`link()`) and lay a button over itself (`button()`). With `?tour` on its address (or `player: { tour: true }`)
it is a click-through demo: it stops at every click, choice and typing, and the viewer does each one. The player is the project's to set: its colour, its
controls (captions, speed and chapters among them), a poster, autoplay and loop; a page that embeds a film can
follow it and drive it with messages. Its controls are icons on a slim bar that is cut at the film's marks (its
chapters, or the steps that say something): the pointer over the bar names the place, and a click near a mark
lands on it.

**Where results go.** A scene's or the project's `save` keeps the film, the MP4, the posts, the guide and
the thumbnail where the project wants them, on every run; `--out` does it once.

**Data and sign-in.** Sample data (`mock`, `replace`, `blur`, `freeze`), saved logins, authenticator codes (`totp`).

**Components.** Screens around your app, drawn as HTML: `pull-request`, `chat`, `email`, `terminal`, `issue`,
`notification`, `phone`, and your own.

**For agents and CI.** `inspect`, `sheet`, `check`, `--json`, a skill file written by `init`, a GitHub Action.

Not tested yet: Windows and Linux, the GitHub Action on GitHub, ElevenLabs and OpenAI voices.
