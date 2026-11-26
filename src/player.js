// The film, in the browser. Reads window.FILM (the capture, the titles, the style, the narration clips), lays the
// whole film out on one clock, and plays it. Every moving thing is one paused animation that the clock positions,
// so any moment can be shown exactly: that is how the export takes its frames (window.__film.seek).
//   film.html?shape=wide|square|vertical      the frame's shape
//   film.html?export                          no controls, no autoplay
//   film.html?embed&autoplay                  embedded, and playing as soon as it is ready
//   film.html?embed&controls=none             no controls of its own: the page around it plays it (play, pause, seek)
//   film.html?background                      the app part only, at once, silent, on a loop, no controls: behind a page's words
//   film.html?clear                           a see-through stage: the window floats on the page that embeds the film
// `tempo`: a factor on the pace, and `speed`: how much quicker the whole film plays; both found below when the scene
// asks for a length. `measure`: only lay the film out, and say how long it is.
const film = (tempo, measure, speed = 1) => {
  const D = window.FILM, S = D.style, q = new URLSearchParams(location.search), exporting = q.has("export");
  const background = q.has("background"); // behind a page's words: no captions, no sound, no controls
  // a click-through demo: every step with a place to click waits for the viewer, as if each said byViewer
  const tour = !background && (!!S.player?.tour || q.has("tour")), BY_VIEWER = ["act", "click", "fill", "select", "hover", "drag", "upload"];
  if (q.has("clear") && !measure) document.head.insertAdjacentHTML("beforeend", "<style>html,body,.bg{background:transparent!important}.bg:after{display:none}</style>");
  const FORMATS = {
    wide: { W: 1920, H: 1080, win: { x: 210, y: 132, w: 1500 }, bar: 46, zoom: 1.16, pull: [0.35, 0.45], type: 84, cap: 40, capY: 64 },
    square: { W: 1080, H: 1080, win: { x: 50, y: null, w: 980 }, bar: 36, zoom: 1.7, pull: [0.9, 0.75], type: 62, cap: 36, capY: 56 },
    vertical: { W: 1080, H: 1920, win: { x: 40, y: null, w: 1500 }, bar: 44, zoom: 1.3, pull: [0.9, 0.5], type: 70, cap: 42, capY: 330 },
  };
  const name = FORMATS[q.get("shape")] ? q.get("shape") : FORMATS[D.shape] ? D.shape : "wide", F = { ...FORMATS[name] }, { W, H } = F;
  const SRC = !!(S.source && D.source && name === "wide"); // the film shows its own scene file, the line now playing lit
  // a phone or a tablet stands in the middle of the frame, as tall as fits, and the camera stays still
  document.documentElement.dataset.shape = name; // for a style sheet that places things by the frame's shape
  const device = D.view.device && D.view.device !== "desktop" ? D.view.device : null;
  if (device) { const h = { wide: 900, square: 900, vertical: 1480 }[name] * S.window.scale, w = (h * D.view.width) / D.view.height; F.win = { x: (W - w) / 2, y: Math.round((H - h) / 2 - (name === "vertical" ? 70 : 30)), w }; F.bar = 0; }
  else if (S.window.fill) { F.win = { x: 0, y: 0, w: W }; F.bar = 0; } // the app is the whole frame: a page made to be filmed, edge to edge
  else if (SRC) { const x = Math.round(W * 0.385); F.win = { x, y: null, w: W - x - Math.round(W * 0.035) }; if (S.window.bar === "none") F.bar = 0; } // the scene's own code on the left, the app beside it
  else {
    if (S.window.bar === "none") F.bar = 0;
    const w = F.win.w * S.window.scale; // a smaller window leaves more of the background around it
    F.win = { ...F.win, x: F.win.x + (F.win.w - w) / 2, y: F.win.y == null ? null : F.win.y + ((F.win.w - w) / 2) * 0.4, w };
  }
  const K = F.win.w / D.view.width, viewH = D.view.height * K, winH = F.bar + viewH, WIN = { ...F.win };
  if (WIN.y == null) WIN.y = Math.round((H - winH) / 2 - 40);
  const want = S.camera.zoom, still = want === 1 || !!device;
  const Z = still ? 1 : name === "wide" && want ? want : F.zoom, PULL = still ? [0, 0] : F.pull;
  let pace = S.pace * tempo; // a step can have its own: { pace: 0.5 }
  const MOVE = 800 / S.camera.speed, hold = (ms) => ms * pace; // how long the camera takes, and how long things rest
  const EASE = "cubic-bezier(.3,.7,.2,1)";
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; };

  // ---- the stage
  const stage = el(`<div id="stage" style="width:${W}px;height:${H}px;--type:${F.type}px;--cap:${F.cap}px;--capy:${F.capY}px"><div class="bg"></div></div>`);
  if (!measure) document.body.appendChild(stage);
  const win = el(`<div class="win${device ? " device" : ""}" style="left:${WIN.x}px;top:${WIN.y}px;width:${WIN.w}px;${device ? `--r:${(device === "phone" ? 46 : 28) * K}px;--edge:${12 * K}px` : ""}"><div class="bar" style="height:${F.bar}px"><i></i><i></i><i></i><span class="hosts"></span></div><div class="view" style="height:${viewH}px"><div class="shots"></div></div></div>`);
  const view = win.querySelector(".view"), pics = win.querySelector(".shots");
  if (D.view.ground) win.style.setProperty("--ground", D.view.ground); // the app's own colour behind its pictures, not white
  // the window, the cursor and the rings of a click share one frame, so they turn in space together
  const rig = el(`<div class="rig"></div>`), FIN = S.finish ?? {}, bgEl = stage.querySelector(".bg"), TILT = SRC ? null : S.camera.tilt, PARA = S.camera.parallax || 0;
  if (FIN.light) stage.appendChild(el(`<div class="light" style="--light:${FIN.light === true ? "var(--accent)" : esc(FIN.light)}"></div>`)); // a soft light behind the window
  stage.appendChild(rig); rig.appendChild(win);
  // the scene file down the left, every line numbered; the line now playing is lit by a band of the accent that
  // reaches across to what it does in the app (the camera puts that thing at the band's height)
  const paintCode = (line) => {
    const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(await|async|export|default|const|let|return|function|true|false|null)\b|([A-Za-z_$][\w$]*)(?=\()/g;
    let out = "", last = 0, m;
    while ((m = re.exec(line))) { out += esc(line.slice(last, m.index)) + `<i class="${m[1] ? "c" : m[2] ? "s" : m[3] ? "k" : "f"}">${esc(m[0])}</i>`; last = re.lastIndex; }
    return out + esc(line.slice(last));
  };
  const LH = Math.round(F.type * 0.54), LITH = Math.round(LH * 1.6), DIM = 0.38;
  const srcEl = SRC ? el(`<div class="src"><div class="lit" style="height:${LITH}px"></div><div class="code" style="width:${WIN.x - Math.round(W * 0.03)}px;font-size:${Math.round(F.type * 0.31)}px;line-height:${LH}px">${D.source.map((l, n) => `<div class="cl"><b>${n + 1}</b><span>${paintCode(l)}</span></div>`).join("")}</div></div>`) : null;
  const codeEl = srcEl?.querySelector(".code"), litEl = srcEl?.querySelector(".lit"), codeLines = srcEl ? [...srcEl.querySelectorAll(".cl")] : [];
  const across = SRC ? el(`<div class="lit across" style="left:${WIN.x}px;height:${LITH}px"></div>`) : null; // the same band, faint, across the app
  if (SRC) { stage.insertBefore(srcEl, rig); stage.appendChild(across); rig.style.clipPath = `inset(0 0 0 ${WIN.x - 40}px)`; stage.classList.add("srcmode"); }
  let litLine = null, litPending = null, litY = H * 0.47;
  const litTo = (line, y, at) => {
    if (!SRC || !line || !codeLines[line - 1]) return;
    litY = clamp(y, H * 0.2, H * 0.8);
    to(codeEl, "translate", at, 560, `0px ${Math.round(litY - ((line - 1) * LH + LH / 2))}px`, GLIDE);
    to(litEl, "translate", at, 560, `0px ${Math.round(litY - LITH / 2)}px`, GLIDE); to(across, "translate", at, 560, `0px ${Math.round(litY - LITH / 2)}px`, GLIDE);
    if (litLine !== line) { if (litLine) to(codeLines[litLine - 1], "opacity", at, 300, DIM); to(codeLines[line - 1], "opacity", at, 300, 1); litLine = line; }
  };
  if (PARA) bgEl.style.inset = "-8%"; // room for the background to follow the camera
  // the music's beat, when cards and the window are to arrive on it
  const BEAT = D.music?.cuts && D.music.bpm ? 60000 / D.music.bpm : 0, onBeat = (x) => (BEAT ? Math.ceil((x - 20) / BEAT) * BEAT : x);
  const words = (s) => esc(s).split(/(\s+)/).map((w) => (w.trim() ? `<span class="w">${w}</span>` : w)).join(""); // each word on its own, for motions that bring them in one by one
  const card = (c, last = false) => el(`<div class="card"><div>${S.logo ? `<img class="logo" src="${S.logo}">` : ""}<div class="lead">${words(c.lead)}</div><div><span class="key">${words(c.key)}<i class="u"></i></span></div>${c.url ? `<div class="url">${esc(c.url)}</div>` : ""}${last && (c.button ?? S.end.button) ? `<div class="btn">${esc(c.button ?? S.end.button)}</div>` : ""}</div></div>`);
  const title = card(D.title), end = card(D.end, true);
  // the presenter: a recording of a person in a corner, kept in step with the film's clock
  const ME = background || measure ? null : D.presenter, meSize = ME ? H * ME.size : 0, meEdge = W * 0.035;
  const me = ME ? el(`<video class="me${ME.round ? " round" : ""}" src="${ME.file}" playsinline preload="auto" style="height:${meSize}px;${ME.round ? `width:${meSize}px;` : ""}${ME.at.includes("left") ? "left" : "right"}:${meEdge}px;${ME.at.includes("top") ? "top" : "bottom"}:${meEdge}px"></video>`) : null;
  // a cursor with a name beside it is one person among others, as on a shared canvas: its arrow and its name in its colour
  const arrow = (color, named) => `<svg viewBox="0 0 24 24"><path d="M5 2l14 11-6.5 1 3.6 7-2.7 1.3-3.5-7L5 20z" fill="${color}" stroke="${named ? "#fff" : "#111"}" stroke-width="${named ? 1.6 : 1.2}" stroke-linejoin="round"/></svg>`;
  const person = (who, color, id = "") => el(`<div ${id ? `id="${id}" ` : ""}class="who">${arrow(color, true)}<span style="background:${color}">${esc(who)}</span></div>`);
  const cur = device ? el(`<div id="cur" class="touch"></div>`)
    : S.cursor.name ? person(S.cursor.name, S.cursor.color, "cur")
    : el(`<svg id="cur" viewBox="0 0 24 24"><path d="M5 2l14 11-6.5 1 3.6 7-2.7 1.3-3.5-7L5 20z" fill="${S.cursor.color}" stroke="#111" stroke-width="1.2"/></svg>`);

  // ---- the clock: every change is (element, property, when, how long, to what)
  const tracks = new Map();
  const track = (e, prop) => { if (!tracks.has(e)) tracks.set(e, {}); return (tracks.get(e)[prop] ??= { from: null, segs: [] }); };
  // twins: an element that follows another's every change of these (on a canvas, the board follows the window)
  // (a follower takes on what was already asked of the one it follows)
  const twins = new Map(), follow = (e, o, props) => {
    twins.set(e, [...(twins.get(e) ?? []), { o, props: new Set(props) }]);
    for (const prop of props) { const had = tracks.get(e)?.[prop]; if (had) { const mine = track(o, prop); mine.from = had.from; mine.segs.push(...had.segs); } }
  };
  const twin = (e, prop) => (twins.get(e) ?? []).filter((x) => x.props.has(prop)).map((x) => x.o);
  const start = (e, prop, value) => { track(e, prop).from = value; for (const o of twin(e, prop)) track(o, prop).from = value; };
  const every = []; // every change in the order it was asked for, so a fast-forwarded step can pull its own closer together
  const raw = (e, prop, t, dur, value, ease = EASE) => { const g = { t, dur, value, ease }; track(e, prop).segs.push(g); every.push(g); return g; };
  const to = (e, prop, t, dur, value, ease = EASE) => { const g = raw(e, prop, t, dur, value, ease); for (const o of twin(e, prop)) track(o, prop).segs.push(g); };
  const show = (e, t, dur = 300) => to(e, "opacity", t, dur, 1), hide = (e, t, dur = 300) => to(e, "opacity", t, dur, 0);

  // ---- motion: every way something moves is a named piece in a family, and a project can add or replace pieces.
  // .scenlit/motion.js:   scenlitMotion((define, kit) => { define("cut", "slide", (layer, at, dur) => { … }); });
  // A piece schedules changes with the kit's start / to / show / hide; times are milliseconds on the film's clock.
  const kit = {
    W, H, K, WIN, bar: F.bar, format: name, style: S, stage, rig, win, view, el, from: { x: 50, y: 50 }, esc, start, to, show, hide, hold, MOVE, EASE, clamp,
    // a box of the app (in its own pixels) -> its place inside the window's view; an element put there moves with the camera
    inView: (b, pad = 0) => ({ left: (b.x - pad) * K, top: (b.y - pad) * K, width: (b.w + 2 * pad) * K, height: (b.h + 2 * pad) * K }),
    box: (b, pad, cls) => { const r = kit.inView(b, pad), e = el(`<div class="${cls}" style="position:absolute;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px"></div>`); view.appendChild(e); start(e, "opacity", 0); return e; },
  };
  // text that arrives: each run of text becomes what has been said and the rest, which keeps its place but is not seen
  const unfold = (e, at, dur, byWord) => {
    if (e.matches("input,textarea")) { const full = e.value; tickers.push((ms) => { e.value = full.slice(0, Math.round(full.length * clamp((ms - at) / dur, 0, 1))); }); return; }
    const doc = e.ownerDocument, walk = doc.createTreeWalker(e, 4), found = []; let n;
    while ((n = walk.nextNode())) if (n.nodeValue.trim()) found.push(n);
    // One line being typed grows as it does at a keyboard, so what follows it (a terminal's own cursor) moves along
    // instead of waiting at the end; such a cursor is then the caret. Longer text keeps its place, so lines do not jump.
    const view2 = doc.defaultView, cs = view2.getComputedStyle(e), line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25;
    const grows = !byWord && e.getBoundingClientRect().height < line * 1.6, next = e.nextElementSibling, nb = next?.getBoundingClientRect();
    const ownCaret = grows && nb && !next.textContent.trim() && nb.width > 0 && nb.width < 20;
    const runs = found.map((node) => { const text = node.nodeValue, on = doc.createElement("span"), off = doc.createElement("span"); if (grows) off.style.display = "none"; else off.style.opacity = "0"; node.replaceWith(on, off); return { text, on, off }; });
    const all = runs.reduce((s, r) => s + r.text.length, 0);
    tickers.push((ms) => {
      const k = clamp((ms - at) / dur, 0, 1); let left = Math.round(all * k);
      for (const r of runs) {
        let c = Math.min(left, r.text.length); left -= c;
        if (byWord && c < r.text.length) c = Math.max(0, r.text.lastIndexOf(" ", c));
        r.on.textContent = r.text.slice(0, c); r.off.textContent = r.text.slice(c);
        r.on.style.boxShadow = !byWord && !ownCaret && k > 0 && k < 1 && c > 0 && c < r.text.length ? "2px 0 0 currentColor" : "none"; // the caret
      }
    });
  };
  // how long something on the app's screen takes to move, when the scene does not say
  const lasts = (name, a) => a.options?.ms ?? { count: 1400, draw: 1500, rows: 1200, build: 1400, pulse: 900, pop: 500, lift: 700 }[name] ?? (name === "type" ? clamp((a.chars ?? 20) * 45, 400, 4000) : name === "stream" ? clamp((a.words ?? 20) * 75, 500, 6000) : 1000);
  const css0 = (e) => e.ownerDocument.defaultView.getComputedStyle(e), block = (e) => { if (css0(e).display === "inline") e.style.display = "inline-block"; }; // an inline element cannot be scaled
  const bricks = {
    // a title card comes in: (card, at) => the time it is all there
    title: {
      rise: (c, at) => { start(c, "translate", "0px 14px"); show(c, at, 600); to(c, "translate", at, 600, "0px 0px"); return at + 600; },
      fade: (c, at) => { show(c, at, 600); return at + 600; },
      words: (c, at) => { const ws = [...c.querySelectorAll(".w")]; to(c, "opacity", at, 1, 1); ws.forEach((w, i) => { start(w, "opacity", 0); start(w, "translate", "0px 10px"); show(w, at + i * 90, 380); to(w, "translate", at + i * 90, 380, "0px 0px"); }); return at + ws.length * 90 + 300; },
      slam: (c, at) => { start(c, "scale", "1.18"); show(c, at, 140); to(c, "scale", at, 320, "1", "cubic-bezier(.2,.9,.2,1)"); return at + 320; },
    },
    // a caption comes in: (caption, at). words: one word after another, each with a small pop
    caption: {
      fade: (c, at) => show(c, at, 350),
      // with narration (`ms`: how long it is said for), each word comes as it is spoken, as near as its length tells
      words: (c, at, _kit, o) => {
        const ws = [...c.querySelectorAll(".w")], all = ws.reduce((n, w) => n + w.textContent.length + 1, 0) || 1; let said = 0;
        to(c, "opacity", at, 1, 1);
        ws.forEach((w, i) => { const when = at + (o?.ms ? (said / all) * o.ms * 0.94 : i * 120); said += w.textContent.length + 1; start(w, "opacity", 0); start(w, "scale", "0.7"); show(w, when, 120); to(w, "scale", when, 260, "1", "cubic-bezier(.2,1.7,.4,1)"); ring(S.sounds.word, when, 0.5); });
      },
    },
    // the window arrives and leaves: (window, at) => how long it takes
    enter: {
      rise: (w, at) => { start(w, "translate", "0px 30px"); show(w, at, 700); to(w, "translate", at, 700, "0px 0px"); return 700; },
      fade: (w, at) => { show(w, at, 700); return 700; },
      none: (w, at) => { to(w, "opacity", at, 1, 1); return 0; }, // there from the first frame
      grow: (w, at) => { start(w, "scale", "0.94"); show(w, at, 700); to(w, "scale", at, 700, "1"); return 700; },
    },
    exit: {
      fade: (w, at) => { hide(w, at, 500); return 500; },
      none: () => 0, // it stays to the last frame: a film that loops, or ends on its picture
      drop: (w, at) => { hide(w, at, 500); to(w, "translate", at, 500, "0px 40px"); return 500; },
    },
    // one picture gives way to the next: (the new picture's layer, at, how long)
    cut: {
      fade: (l, at, dur) => show(l, at, dur),
      slide: (l, at, dur) => { start(l, "translate", "3% 0%"); show(l, at, Math.max(dur, 320)); to(l, "translate", at, Math.max(dur, 320), "0% 0%"); },
      none: (l, at) => to(l, "opacity", at, 1, 1),
      grow: (l, at, dur, k) => { const c = k?.from ?? { x: 50, y: 50 }; start(l, "clipPath", `circle(0% at ${c.x}% ${c.y}%)`); to(l, "opacity", at, 1, 1); to(l, "clipPath", at, Math.max(dur, 520), `circle(150% at ${c.x}% ${c.y}%)`, "cubic-bezier(.3,0,.2,1)"); },
    },
    // the cursor travels: (cursor, from, to, when, how long). arc: a slight bow, speeding up and slowing down, as a hand moves it
    cursor: {
      arc: (c, from, at, when, dur) => {
        const dx = at.x - from.x, dy = at.y - from.y, far = Math.hypot(dx, dy);
        if (far <= 160) return to(c, "translate", when, dur, `${at.x}px ${at.y}px`);
        const bow = Math.min(60, far * 0.1), mid = { x: from.x + dx / 2 + (dy / far) * bow, y: from.y + dy / 2 - (dx / far) * bow };
        to(c, "translate", when, dur / 2, `${mid.x}px ${mid.y}px`, "cubic-bezier(.4,0,.8,.7)");
        to(c, "translate", when + dur / 2, dur / 2, `${at.x}px ${at.y}px`, "cubic-bezier(.2,.3,.6,1)");
      },
      line: (c, from, at, when, dur) => to(c, "translate", when, dur, `${at.x}px ${at.y}px`),
    },
    // what a click looks like: (the point in the frame, when)
    click: {
      ring: (at, when) => { const r = el(`<div class="ring" style="left:${at.x}px;top:${at.y}px"></div>`); rig.appendChild(r); start(r, "opacity", 0); start(r, "scale", "0.3"); to(r, "opacity", when, 1, 0.9); to(r, "scale", when, 450, "1", "ease-out"); to(r, "opacity", when + 1, 449, 0, "ease-out"); },
      pulse: (at, when) => { bricks.click.ring(at, when); bricks.click.ring(at, when + 180); },
      none: () => {},
    },
    // pointing at something: (its box, at) => the element, or elements, to take away when the step ends
    spotlight: {
      dim: (b, at) => { const e = kit.box(b, 8, "spot"); show(e, at, 350); return e; },
      outline: (b, at) => { const e = kit.box(b, 6, "mark"); show(e, at, 300); return e; },
      // selected, as on a design canvas: a thin blue box, a handle at each corner and its real size under it
      select: (b, at) => { const e = kit.box(b, 3, "sel"); e.innerHTML = `<i></i><i></i><i></i><i></i><em>${Math.round(b.w)} × ${Math.round(b.h)}</em>`; show(e, at, 150); return e; },
      // everything around it goes soft and a little darker, as a lens would leave it: four panels around the thing,
      // each straight in the view. (A wrapper that fades would hide what lies behind from the blur, and a blur ignores
      // a hole cut or masked into one panel.)
      focus: (b, at) => {
        const r = kit.inView(b, 12), y2 = r.top + r.height, x2 = r.left + r.width;
        return [`left:0;right:0;top:0;height:${r.top}px`, `left:0;right:0;top:${y2}px;bottom:0`, `left:0;top:${r.top}px;width:${r.left}px;height:${r.height}px`, `left:${x2}px;right:0;top:${r.top}px;height:${r.height}px`]
          .map((place) => { const e = el(`<div class="soft" style="${place}"></div>`); view.appendChild(e); start(e, "opacity", 0); show(e, at, 450); return e; });
      },
    },
    // something on the app's own screen moves: the real element, inside the frozen page. ({ el, at, dur, options }, kit)
    animate: {
      // text is typed: letter by letter, with a caret. In a field, its value is typed
      type: ({ el: e, at, dur }) => unfold(e, at, dur, false),
      // text streams in, word by word, as an answer does
      stream: ({ el: e, at, dur }) => unfold(e, at, dur, true),
      // a screen builds itself: its blocks arrive in reading order
      build: ({ el: e, at, dur }) => {
        const view2 = e.ownerDocument.defaultView, area = (x) => { const r = x.getBoundingClientRect(); return r.width * r.height; }, whole = area(e) || 1, blocks = [];
        const open = (x, depth) => { const kids = [...x.children].filter((c) => area(c) > 0 && view2.getComputedStyle(c).position !== "fixed"); if (depth < 5 && kids.length && area(x) > whole * 0.08) kids.forEach((c) => open(c, depth + 1)); else blocks.push(x); };
        open(e, 0);
        const top = (x) => x.getBoundingClientRect();
        blocks.sort((a, b) => (Math.abs(top(a).top - top(b).top) > 12 ? top(a).top - top(b).top : top(a).left - top(b).left));
        const gap = Math.min(110, dur / Math.max(1, blocks.length));
        blocks.forEach((b, i) => { block(b); start(b, "opacity", 0); start(b, "translate", "0px 14px"); show(b, at + i * gap, 380); to(b, "translate", at + i * gap, 420, "0px 0px"); });
      },
      // a number counts up to its value
      count: ({ el: e, at, dur }) => {
        const walk = e.ownerDocument.createTreeWalker(e, 4); let node; while ((node = walk.nextNode())) if (/\d/.test(node.nodeValue)) break;
        if (!node) return;
        const text = node.nodeValue, m = text.match(/\d[\d,]*(?:\.(\d+))?/), end = parseFloat(m[0].replace(/,/g, "")), dec = m[1]?.length ?? 0;
        const write = (v) => text.replace(m[0], v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: m[0].includes(",") }));
        tickers.push((ms) => { const k = clamp((ms - at) / dur, 0, 1); node.nodeValue = write(end * (1 - (1 - k) ** 3)); });
      },
      // a drawing draws itself: lines trace from their start, filled shapes follow; anything else is uncovered from the left
      draw: ({ el: e, at, dur }) => {
        const css = (s) => e.ownerDocument.defaultView.getComputedStyle(s), shapes = [...(e.matches("path,line,polyline") ? [e] : []), ...e.querySelectorAll("path,line,polyline,circle,rect")].filter((s) => typeof s.getTotalLength === "function");
        const lines = shapes.filter((s) => css(s).stroke !== "none" && css(s).fill === "none" && s.getTotalLength() > 0);
        if (!lines.length) { start(e, "clipPath", "inset(0% 100% 0% 0%)"); to(e, "clipPath", at, dur, "inset(0% 0% 0% 0%)", "cubic-bezier(.3,0,.2,1)"); return; }
        for (const s of lines) { const L = s.getTotalLength(); s.style.strokeDasharray = `${L}`; start(s, "strokeDashoffset", `${L}`); to(s, "strokeDashoffset", at, dur, "0", "cubic-bezier(.3,0,.2,1)"); }
        for (const s of shapes.filter((x) => !lines.includes(x))) { start(s, "opacity", 0); to(s, "opacity", at + dur * 0.45, dur * 0.55, 1); }
      },
      // the rows of a table, or the children of anything, arrive one after another
      rows: ({ el: e, at, dur }) => { const kids = [...(e.querySelector("tbody") ? e.querySelectorAll("tbody tr") : e.children)], gap = Math.min(90, dur / Math.max(1, kids.length)); kids.forEach((k, i) => { start(k, "opacity", 0); start(k, "translate", "0px 12px"); show(k, at + i * gap, 320); to(k, "translate", at + i * gap, 320, "0px 0px"); }); },
      // look here: it swells twice
      pulse: ({ el: e, at, dur }) => { block(e); start(e, "scale", "1"); for (const i of [0, 1]) { to(e, "scale", at + (i * dur) / 2, dur * 0.22, "1.07", "ease-out"); to(e, "scale", at + (i * dur) / 2 + dur * 0.22, dur * 0.28, "1", "ease-in-out"); } },
      // it appears with a small bounce
      pop: ({ el: e, at, dur }) => { block(e); start(e, "opacity", 0); start(e, "scale", "0.6"); show(e, at, dur * 0.3); to(e, "scale", at, dur, "1", "cubic-bezier(.2,1.6,.4,1)"); },
      // it rises off the page, towards the viewer
      lift: ({ el: e, at, dur }) => { block(e); if (css0(e).position === "static") e.style.position = "relative"; e.style.zIndex = "5"; start(e, "scale", "1"); start(e, "boxShadow", "0 0 0 0 #0000"); to(e, "scale", at, dur, "1.05", "cubic-bezier(.2,.9,.2,1)"); to(e, "boxShadow", at, dur, "0 30px 70px -10px #0006"); },
    },
    // effects a scene asks for by name: await effect("pulse", target) -> ({ box, at, options }) => how long it takes
    effect: {
      pulse: ({ box, at }) => { if (!box) return 0; const e = kit.box(box, 8, "mark"); start(e, "scale", "1"); for (const i of [0, 1]) { to(e, "opacity", at + i * 600, 150, 1); to(e, "scale", at + i * 600, 450, "1.06", "ease-out"); to(e, "opacity", at + i * 600 + 300, 300, 0); to(e, "scale", at + i * 600 + 450, 1, "1"); } return 1300; },
      shake: ({ at }) => { [10, -9, 7, -5, 3, 0].forEach((x, i) => to(win, "translate", at + i * 70, 70, `${x}px 0px`, "linear")); return 500; },
    },
  };
  const define = (family, id, fn) => { if (!bricks[family]) throw new Error(`no motion family "${family}" (${Object.keys(bricks).join(", ")})`); bricks[family][id] = fn; };
  for (const more of window.__motions ?? []) more(define, kit);
  const chosen = { title: S.titles.animation, enter: "rise", exit: "fade", cut: "fade", caption: "fade", cursor: "arc", click: S.cursor.ring ? "ring" : "none", spotlight: "dim", ...S.motion };
  const motion = (family) => bricks[family][chosen[family]] ?? Object.values(bricks[family])[0];

  let t = 0;
  const audio = [], captions = [], ranges = [], loads = [];
  const waits = [], marks = []; // waits: moments the film stops for the viewer (their click, a button). marks: where each chapter begins
  // sound effects: (which, when, how loud). The style gives one to clicks, cards and so on; a step can ask for its own
  const sfx = [], ring = (name, at, vol = 1) => { if (name && D.sfx?.[name] && !background) sfx.push({ name, at, vol }); };
  // what moves on the app's own screen: found in the frozen pages once they have loaded, and things that follow the clock
  const inside = [], tickers = [];
  const alonePieces = []; // a piece's frozen page and its mark: only the piece is left showing there (settle)
  const keys = (at, dur, chars) => { const n = Math.min(chars, Math.round(dur / 70)); for (let k = 0; k < n; k++) ring(S.sounds.type, at + (k * dur) / n, 0.7); }; // a key for each letter, as fast as fingers go
  // a card comes in the way the style says (rise, fade, or word by word), then its underline draws. Returns when it is all there.
  const reveal = (c, at, kind = "card") => {
    const u = c.querySelector(".u");
    start(c, "opacity", 0); start(u, "scale", "0 1"); ring(S.sounds[kind] ?? S.sounds.card, at);
    const logo = kind === "end" && S.end.sting ? c.querySelector(".logo") : null;
    if (logo) { // the logo lands first, large; the words follow
      c.classList.add("sting"); to(c, "opacity", at, 1, 1);
      for (const x of c.querySelectorAll(".lead,.key,.url,.btn")) { start(x, "opacity", 0); show(x, at + 520, 400); }
      start(logo, "opacity", 0); start(logo, "scale", "0.5"); show(logo, at, 180); to(logo, "scale", at, 620, "1", "cubic-bezier(.2,1.5,.3,1)"); ring(S.sounds.logo, at);
      to(u, "scale", at + 900, 700, "1 1");
      return at + 1600;
    }
    const done = motion("title")(c, at, kit);
    to(u, "scale", done, 700, "1 1");
    return done + 700;
  };

  // title card
  if (S.titles.show === false) start(title, "opacity", 0); // a film that starts straight in the app
  else { const shown = reveal(title, 0, "title"); hide(title, shown + hold(1500), 400); t = shown + hold(1500) + 400; }
  let opens = t; // the title is done: the app's window comes in

  // the app's window, on its first picture. A picture is the frozen page when there is one (sharp at any zoom), else the screenshot.
  const layers = [], nodes = {}, loaded = (node) => new Promise((r) => { node.onload = r; node.onerror = r; });
  // Only the pictures in play are drawn. One waiting for its turn, or left under the one that replaced it, costs the
  // browser as much as one on screen; with every picture of a film kept drawn it ran out of room when the camera pulled
  // back to show them whole, and showed a blank window instead. at: when this one comes. done: when it has covered
  // those under it, which are then put away (a frame of the app's own motion never has: it may be cut short).
  let live = [];
  const layer = (file, opacity, at = 0, done = null) => {
    const v = D.vector[file];
    const node = v ? el(`<iframe src="${D.rel}/${v}" scrolling="no" tabindex="-1" style="width:${D.view.width}px;height:${D.view.height}px;transform:scale(${K})"></iframe>`) : el(`<img src="${D.rel}/${file}">`);
    loads.push(v ? loaded(node) : loaded(node).then(() => node.decode?.().catch(() => {})));
    pics.appendChild(node); start(node, "opacity", opacity); layers.push(file); nodes[file] = node;
    start(node, "visibility", live.length ? "hidden" : "visible");
    if (live.length) to(node, "visibility", Math.max(0, at - 300), 1, "visible");
    if (done != null) { for (const n of live) to(n, "visibility", done + 200, 1, "hidden"); live = []; }
    live.push(node);
    return node;
  };
  // the address in the window's bar: the app's, or a component's own while one is on screen
  const bar0 = win.querySelector(".hosts"), hostEls = {};
  const hostEl = (h) => (hostEls[h] ??= (() => { const b = el(`<b>${esc(h)}</b>`); bar0.appendChild(b); start(b, "opacity", 0); return b; })());
  let host = D.hosts[D.start] ?? D.host;
  start(hostEl(host), "opacity", 1);
  const address = (file, at) => { const h = D.hosts[file] ?? D.host; if (h === host) return; hide(hostEl(host), at, 150); show(hostEl(h), at + 100, 200); host = h; };
  layer(D.start, 1);
  // a new picture: the style's cut when the film goes to another place, a quick fade when the same page only changed
  // (a menu opened, a state was set). Returns whether the place changed. (A cut has a second at most.)
  let place = D.pages?.[D.start]; // the page on screen (the frames of the app's own motion between two pictures stay on it)
  // a canvas: every place the film goes to is a frame, side by side on one board, its name over it. The window is the
  // frame being used; going to another place, the camera travels along the board to the next frame instead of cutting.
  const BOARD = !!S.board && !device && D.pages && Object.keys(D.pages).length > 0;
  const visits = [], STEP = WIN.w + Math.round(W * 0.05);
  if (BOARD) {
    const seq = [D.start, ...D.steps.flatMap((s) => s.actions.flatMap((a) => [a.before, a.after]))].filter(Boolean);
    for (const f of seq) { const v = visits.at(-1); if (v && D.pages[f] === v.page) v.last = f; else visits.push({ page: D.pages[f], first: f, last: f }); }
  }
  const nameOf = (f) => (D.names?.[f] ?? "").split(/\s+[|·—–-]\s+/)[0].trim();
  const board = BOARD ? el(`<div class="board" style="left:${WIN.x}px;top:${WIN.y}px;width:${WIN.w}px;height:${winH}px"><div class="strip"></div></div>`) : null, strip = board?.firstChild;
  const frames = visits.map((v, k) => {
    const f = el(`<div class="frame" style="left:${k * STEP}px;width:${WIN.w}px;height:${viewH}px"><b>${esc(nameOf(v.first))}</b><div class="clip"><img src="${D.rel}/${v.first}">${v.last !== v.first ? `<img class="last" src="${D.rel}/${v.last}">` : ""}</div></div>`);
    strip.appendChild(f); const last = f.querySelector(".last"); if (last) start(last, "opacity", 0);
    return { last };
  });
  if (board) { rig.insertBefore(board, win); follow(win, board, ["opacity", "transform", "translate", "scale"]); start(strip, "translate", "0px 0px"); }
  let visit = 0, panMs = 0;
  const pan = (file, at) => {
    const k = Math.min(++visit, visits.length - 1), P = Math.round(1100 / S.camera.speed);
    if (frames[k - 1]?.last) to(frames[k - 1].last, "opacity", at, 1, 1); // the frame it leaves keeps its last picture (the window covers it until it has gone)
    to(strip, "translate", at, P, `${-k * STEP}px 0px`, GLIDE);
    raw(win, "translate", at, P, `${-STEP}px 0px`, GLIDE); raw(win, "translate", at + P, 1, "0px 0px", "linear"); // the window travels with its frame, then stands for the next one
    if (cam) { to(win, "transform", at, P, "translate(0px, 0px) scale(1)", GLIDE); Object.assign(lens, { tx: 0, ty: 0, z: 1 }); cam = false; }
    const img = layer(file, 0, at + P, at + P + 50); to(img, "opacity", at + P, 1, 1);
    return P;
  };
  const put = (file, at, dur) => {
    panMs = 0;
    if (layers.at(-1) === file) return null;
    const moved = !D.pages?.[file] || D.pages[file] !== place;
    place = D.pages?.[file];
    if (moved && BOARD) { panMs = pan(file, at); address(file, at); return moved; }
    const img = layer(file, 0, at, at + Math.max(dur, 1000));
    if (moved) motion("cut")(img, at, dur, kit); else bricks.cut.fade(img, at, Math.min(dur, 250)); address(file, at);
    return moved;
  };
  start(win, "opacity", 0); start(win, "translate", "0px 0px"); start(win, "transform", "translate(0px, 0px) scale(1)");
  t = onBeat(t);
  let appAt = t; // when the app's window arrives
  start(rig, "translate", "0px 0px"); start(rig, "scale", "1");
  // a film that opens on words: the window first comes when the words are done
  const opener = D.steps.find((x) => x.kind !== "background"), wordsFirst = opener?.kind === "words" && !opener.words.beside;
  if (!wordsFirst) ring(S.sounds.enter, t), motion("enter")(win, t, kit);
  if (srcEl) { // the code starts on the first line that acts, dim, the band at the middle
    const first = D.steps.find((x) => x.src && x.kind !== "words")?.src ?? 1;
    codeLines.forEach((c) => start(c, "opacity", DIM));
    start(codeEl, "translate", `0px ${Math.round(litY - ((first - 1) * LH + LH / 2))}px`); start(litEl, "translate", `0px ${Math.round(litY - LITH / 2)}px`); start(across, "translate", `0px ${Math.round(litY - LITH / 2)}px`);
    start(srcEl, "opacity", 0); start(across, "opacity", 0); if (!wordsFirst) { show(srcEl, t, 600); show(across, t, 600); }
  }
  let pos = { x: W * 0.8, y: H * 0.84 }, cam = false;
  start(cur, "opacity", 0); start(cur, "translate", `${pos.x}px ${pos.y}px`); start(cur, "scale", "1");
  if (!wordsFirst) t += 900;
  const usesCursor = (a) => a.box && !["zoom", "label", "scroll", "effect"].includes(a.do);
  const pointer = S.cursor.show !== false && D.steps.some((s) => s.actions.some(usesCursor)), back = (at) => { if (pointer) show(cur, at, 300); }; // the cursor, in a film that uses one
  if (!wordsFirst) back(t - 300);

  // a point of the app (in its own pixels) -> the window; and the camera: move in on a point, pull it towards the
  // middle of the frame, but keep the window covering the place it rests in and the point inside the frame
  const inWin = (x, y) => ({ x: x * K, y: F.bar + y * K });
  // The camera does not chase every click: while the next point is comfortably in view it stays where it is, and
  // only the cursor moves. When it does move, it eases out and in again.
  const lens = { tx: 0, ty: 0, z: 1 }, GLIDE = "cubic-bezier(.5,0,.15,1)";
  // the camera: and in a film that shows its code, the line now playing follows what the camera aims at
  const camera = (p, z, pull, at, dur = MOVE) => { const r = aim(p, z, pull, at, dur); if (litPending) { litTo(litPending, r.y, at); litPending = null; } return r; };
  const aim = (p, z, pull, at, dur = MOVE) => {
    const here = { x: WIN.x + lens.z * p.x + lens.tx, y: WIN.y + lens.z * p.y + lens.ty };
    const L = SRC ? WIN.x : 0, R = SRC ? WIN.x + WIN.w : W; // the part of the frame the app has
    if (z === lens.z && here.x > L + (R - L) * 0.2 && here.x < L + (R - L) * 0.8 && here.y > H * 0.16 && here.y < H - F.capY - 170) return here;
    const d = { x: ((L + R) / 2 - WIN.x - p.x) * pull[0], y: (H * 0.47 - WIN.y - p.y) * pull[1] };
    const tx = clamp(p.x * (1 - z) + d.x, (SRC ? WIN.w : Math.min(WIN.w, W - 2 * WIN.x)) - z * WIN.w, 0);
    let ty = clamp(p.y * (1 - z) + d.y, Math.min(winH, H - WIN.y) - z * winH, 0);
    if (z > 1) ty -= Math.max(0, WIN.y + z * p.y + ty - (H - F.capY - 150));
    to(win, "transform", at, dur, `translate(${tx}px, ${ty}px) scale(${z})`, GLIDE); cam = true;
    if (PARA) to(bgEl, "translate", at, dur, `${tx * PARA}px ${ty * PARA}px`, GLIDE);
    Object.assign(lens, { tx, ty, z });
    return { x: WIN.x + z * p.x + tx, y: WIN.y + z * p.y + ty };
  };
  const moveTo = (at, when, dur = MOVE) => { (device ? bricks.cursor.line : motion("cursor"))(cur, pos, at, when, dur, kit); pos = at; };
  const click = (at, when) => {
    motion("click")(at, when, kit);
    to(cur, "scale", when, 110, "0.86"); to(cur, "scale", when + 110, 110, "1");
    ring(S.sounds.click, when);
  };
  // the picture after an action: with motion, the frames the app drew on the way there, each at its moment
  const after = (a, when, dur = 220) => {
    if (!a.motion?.length || (BOARD && D.pages[a.after] !== place)) { const moved = put(a.after, when, dur); return moved && panMs ? Math.max(hold(870), panMs + hold(400)) : hold(870); }
    let last = 0;
    // a recorded frame keeps its own shape (it may be cut short at the bottom) and sits at the top of the view
    for (const f of a.motion) { const img = layer(f.file, 0, when + f.at); img.style.height = "auto"; to(img, "opacity", when + f.at, 1, 1); last = f.at; }
    put(a.after, when + last + 60, 160);
    return Math.max(hold(870), last + 620);
  };
  // a sentence as a scene: alone on the stage, or beside the app, which steps to the right and comes back after. A list
  // of phrases plays as quick swaps in one place. How the words come in is the step's `motion`:
  //   rise     word after word, from a little below          letters  letter after letter, quickly
  //   bounce   letters drop in, tilted, and bounce           blur     letters come together out of a blur
  //   track    the line closes up from wide spacing          type     letter by letter, as typed
  // `big` words are set larger, `highlight` ones in the accent (with `sweep`, a box of it sweeps in behind them), `tag`
  // is a small tilted label stamped on after, `stroke` draws a line through the words.
  const ENTER = {
    rise: (parts, at, gap) => parts.words.forEach((w, n) => { start(w, "opacity", 0); start(w, "translate", "0px .28em"); show(w, at + n * gap, 240); to(w, "translate", at + n * gap, 340, "0px 0px"); }),
    letters: (parts, at) => parts.letters.forEach((l, n) => { start(l, "opacity", 0); start(l, "translate", "0px .45em"); show(l, at + n * 26, 160); to(l, "translate", at + n * 26, 300, "0px 0px", "cubic-bezier(.2,.8,.2,1)"); }),
    bounce: (parts, at) => parts.letters.forEach((l, n) => { const r = ((n * 37) % 21) - 10; start(l, "opacity", 0); start(l, "translate", "0px -1.1em"); start(l, "rotate", `${r}deg`); show(l, at + n * 45, 120); to(l, "translate", at + n * 45, 520, "0px 0px", "cubic-bezier(.3,1.6,.5,1)"); to(l, "rotate", at + n * 45, 520, "0deg", "cubic-bezier(.3,1.6,.5,1)"); }),
    blur: (parts, at) => parts.letters.forEach((l, n) => { const x = (((n * 53) % 17) - 8) / 10; start(l, "opacity", 0); start(l, "translate", `${x}em 0px`); start(l, "filter", "blur(10px)"); show(l, at + n * 16, 300); to(l, "translate", at + n * 16, 460, "0em 0px", "cubic-bezier(.2,.8,.2,1)"); to(l, "filter", at + n * 16, 460, "blur(0px)"); }),
    track: (parts, at) => { parts.line.classList.add("track"); start(parts.line, "letterSpacing", ".5em"); start(parts.line, "opacity", 0); show(parts.line, at, 400); to(parts.line, "letterSpacing", at, 900, "-.03em", "cubic-bezier(.2,.8,.2,1)"); },
    type: (parts, at) => parts.letters.forEach((l, n) => { start(l, "opacity", 0); to(l, "opacity", at + n * 42, 1, 1); }),
  };
  const lasting = { rise: (n, gap) => n.words * gap + 300, letters: (n) => n.letters * 26 + 300, bounce: (n) => n.letters * 45 + 520, blur: (n) => n.letters * 16 + 460, track: () => 900, type: (n) => n.letters * 42 + 100 };
  const inkOn = (c) => { const m = /^#([0-9a-f]{6})$/i.exec(c ?? ""); if (!m) return "#f4f2ec"; const n = parseInt(m[1], 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) > 150 ? "#0c0c0c" : "#f4f2ec"; };
  const sentence = (wd, spoken, after, before, src) => {
    const bare = (w) => w.toLowerCase().replace(/[.,!?;:"']+$/, ""), set = (x) => new Set((x ?? []).flatMap((y) => y.split(/\s+/)).map(bare));
    const hi = set(wd.highlight), big = set(wd.big), motion = ENTER[wd.motion] ? wd.motion : "rise", phrases = wd.phrases ?? [wd.text];
    const letterwise = ["letters", "bounce", "blur", "type"].includes(motion);
    const word = (w) => `<span class="w${hi.has(bare(w)) ? " hi" : ""}${big.has(bare(w)) ? " big" : ""}">${hi.has(bare(w)) && wd.sweep ? `<i class="sw"></i>` : ""}${letterwise ? [...w].map((c) => `<span class="l">${esc(c)}</span>`).join("") : esc(w)}</span>`;
    const chained = (x) => x?.kind === "words" && !x.words.beside && !wd.beside; // words after words: the app stays away between them
    if (wd.beside) { to(rig, "translate", t, 650, `${Math.round(W * 0.21)}px 0px`, GLIDE); to(rig, "scale", t, 650, "0.6", GLIDE); } else if (!chained(before)) { hide(win, t, 300); hide(cur, t, 200); if (srcEl) hide(srcEl, t, 300), hide(across, t, 300); }
    let at = onBeat(t + (chained(before) ? 80 : 380)), gone = at;
    // a field: a colour over the whole frame behind the words, cut in and out; the words take the ink that reads on it
    const FIELD = wd.field ?? null, ink = FIELD ? inkOn(FIELD) : null, STACK = !!wd.stack || (SRC && !wd.beside), CUT = FIELD ? 1 : 350; // a film that shows its code sets words as its lines
    const fieldEl = FIELD ? el(`<div class="field" style="background:${esc(FIELD)}"></div>`) : null;
    if (fieldEl) { stage.appendChild(fieldEl); start(fieldEl, "opacity", 0); to(fieldEl, "opacity", at - 80, 1, 1); }
    // stacked: each phrase a line under the last, on the grid; the newest lit (with a field: a poster, all lines kept)
    let geo = null, stackEl = null, band = null, lines = [];
    if (STACK) {
      const longest = Math.max(...phrases.map((x) => x.length)), fs = Math.round(Math.min(F.type * (FIELD ? 3.6 : 2), (W * (FIELD ? 0.92 : 0.8)) / (longest * 0.52)));
      const lh = Math.round(fs * (FIELD ? 0.84 : 1.06)), x = Math.round(W * (FIELD ? 0.045 : 0.137));
      geo = { fs, lh, x, top: Math.round((H - lh * phrases.length) / 2) };
      stackEl = el(`<div class="say stack${FIELD ? " poster" : ""}" style="font-size:${fs}px${ink ? `;color:${ink}` : ""}">${FIELD ? "" : `<div class="srule" style="left:${x - Math.round(F.type * 0.62)}px"></div><div class="sband" style="height:${Math.round(lh * 1.1)}px"></div>`}</div>`);
      stage.appendChild(stackEl); start(stackEl, "opacity", 0); to(stackEl, "opacity", at, 1, 1);
      band = stackEl.querySelector(".sband"); if (band) start(band, "translate", `0px ${geo.top - Math.round(lh * 0.05)}px`);
    }
    phrases.forEach((text, j) => {
      const inner = `${text.split(/(\s+)/).map((w) => (w.trim() ? word(w) : w)).join("")}${wd.tag && j === phrases.length - 1 ? `<span class="stamp">${esc(wd.tag)}</span>` : ""}`;
      let e;
      if (STACK) {
        const y = geo.top + j * geo.lh;
        e = el(`<div class="line" style="left:${geo.x}px;top:${y}px;line-height:${geo.lh}px">${inner}</div>`); stackEl.appendChild(e);
        if (!FIELD) {
          const num = el(`<b class="num" style="top:${y}px;line-height:${geo.lh}px;right:${W - geo.x + Math.round(F.type * 0.95)}px">${(src ?? 1) + j}</b>`); stackEl.appendChild(num);
          start(num, "opacity", 0); show(num, at, 200); to(num, "color", at, 200, "var(--accent)"); if (j) to(stackEl.querySelectorAll(".num")[j - 1], "color", at, 200, "var(--muted)");
          if (j) { to(band, "translate", at, 420, `0px ${y - Math.round(geo.lh * 0.05)}px`, GLIDE); to(lines[j - 1], "opacity", at, 300, 0.36); }
        }
        lines.push(e);
      } else {
        e = el(`<div class="say${wd.beside ? " beside" : ""}"${wd.beside ? "" : ` style="font-size:calc(var(--type) * ${clamp(26 / text.length, 1.2, 2.3).toFixed(2)})${ink ? `;color:${ink}` : ""}"`}><div class="line" ${wd.beside ? `style="width:${Math.round(W * 0.37)}px"` : ""}>${inner}</div></div>`);
        stage.appendChild(e); start(e, "opacity", 0); to(e, "opacity", at, 1, 1);
      }
      const parts = { line: e.matches(".line") ? e : e.querySelector(".line"), words: [...e.querySelectorAll(".w")], letters: [...e.querySelectorAll(".l")] };
      const count = { words: parts.words.length, letters: parts.letters.length };
      const gap = spoken && phrases.length === 1 ? clamp((spoken * 0.94) / count.words, 70, 420) : 130;
      ENTER[motion](parts, at, gap);
      if (motion === "rise") parts.words.forEach((w, n) => ring(S.sounds.word, at + n * gap, 0.5)); else ring(S.sounds.word, at, 0.5);
      let ready = at + lasting[motion](count, gap);
      for (const w of parts.words.filter((x) => x.classList.contains("hi"))) { // a box of the accent sweeps in behind the highlighted words
        const sw = w.querySelector(".sw"); if (!sw) continue;
        start(sw, "scale", "0 1"); to(sw, "scale", ready - 120, 380, "1 1", "cubic-bezier(.6,0,.2,1)"); to(w, "color", ready + 60, 200, "var(--accent-ink)"); ready += 120;
      }
      const stamp = e.querySelector(".stamp");
      if (stamp) { start(stamp, "opacity", 0); start(stamp, "scale", "1.6"); show(stamp, ready, 90); to(stamp, "scale", ready, 300, "1", "cubic-bezier(.2,1.5,.4,1)"); ring(S.sounds.word, ready, 0.8); ready += 300; }
      if (wd.stroke && j === phrases.length - 1) { // a line drawn through the words, from edge to edge
        const sv = swoosh("stroke"); (STACK ? stackEl : e).prepend(sv); drawn(sv, at + 80, 700); ready = Math.max(ready, at + 800);
      }
      const holds = wd.for ?? (phrases.length > 1 ? hold(450 + text.length * 22) : hold(800 + text.length * 30));
      gone = ready + holds;
      const last = j === phrases.length - 1;
      if (STACK) { if (last) hide(stackEl, gone, CUT); }
      else if (last) hide(e, gone, CUT);
      else { to(parts.line, "translate", gone, 220, "0px -.35em"); hide(e, gone, 200); }
      at = last ? gone : onBeat(gone + (STACK ? 0 : 60));
    });
    if (fieldEl) hide(fieldEl, gone, 1);
    // the page the next step acts on is in the window before it comes back, so the last one does not flash by
    const coming = D.steps.slice(D.steps.indexOf(after)).find((x) => x?.actions?.length)?.actions[0].before;
    if (after && coming && !wd.beside) put(coming, gone + 250, 1);
    if (SRC && after?.src && after.kind !== "words") litTo(after.src, litY, gone + 250); // the code comes back on the line that plays next
    if (!wd.beside && (lens.z !== 1 || lens.tx || lens.ty)) { to(win, "transform", gone + 250, 1, "translate(0px, 0px) scale(1)"); Object.assign(lens, { tx: 0, ty: 0, z: 1 }); } // and it comes back whole
    if (wd.beside) { to(rig, "translate", gone, 650, "0px 0px", GLIDE); to(rig, "scale", gone, 650, "1", GLIDE); t = gone + 650; } else if (chained(after) || !after) t = gone + 300; else { show(win, gone + 350, 500); if (srcEl) show(srcEl, gone + 350, 500), show(across, gone + 350, 500); back(gone + 550); t = gone + 850; }
  };
  // a mark that draws itself, in the accent: around something of the app (circle, box), under it (underline), pointing
  // at it (arrow), all moving with the camera; or across the stage (stroke). It stays while its step lasts.
  const SWOOSH = [[-40, 320], [200, 380], [330, 40], [480, 130], [580, 380], [680, 250], [900, 120], [1040, 160]]; // on a 1000 × 400 stage
  const swoosh = (cls) => {
    const [a0, ...c] = SWOOSH.map(([x, y]) => `${Math.round((x * W) / 1000)} ${Math.round((y * H) / 400)}`);
    return el(`<svg class="${cls}" viewBox="0 0 ${W} ${H}"><path pathLength="1" style="stroke-width:${Math.round(F.type * 0.2)}px" d="M ${a0} C ${c[0]}, ${c[1]}, ${c[2]} S ${c[3]}, ${c[4]} S ${c[5]}, ${c[6]}"/></svg>`);
  };
  const drawn = (sv, at, ms) => { const path = sv.querySelector("path"); start(sv, "opacity", 0); to(sv, "opacity", at, 1, 1); start(path, "strokeDashoffset", "1"); to(path, "strokeDashoffset", at, ms, "0", "cubic-bezier(.5,0,.2,1)"); };
  const drawMark = (a, b, p, at, until) => {
    if (!b) { const sv = swoosh("mk across"); stage.appendChild(sv); drawn(sv, at, 700); ring(S.sounds.point, at); until.push(sv); return at + 800 + hold(700); }
    const there = camera(p, Z, PULL, at); moveTo(there, at); at += MOVE;
    const r = kit.inView(b, 10), w = r.width, h = r.height, m = 60;
    const d = {
      underline: `M ${m - 4} ${m + h + 4} C ${m + w * 0.3} ${m + h + 10}, ${m + w * 0.7} ${m + h - 2}, ${m + w + 6} ${m + h + 6}`,
      circle: `M ${m + w * 0.55} ${m - 6} C ${m + w + 22} ${m - 8}, ${m + w + 26} ${m + h + 12}, ${m + w * 0.5} ${m + h + 10} C ${m - 24} ${m + h + 10}, ${m - 22} ${m - 10}, ${m + w * 0.62} ${m - 2}`,
      box: `M ${m} ${m} H ${m + w} V ${m + h} H ${m} Z`,
      arrow: `M ${m - 52} ${m - 44} C ${m - 40} ${m - 6}, ${m - 22} ${m + h * 0.3}, ${m - 6} ${m + h * 0.5} M ${m - 22} ${m + h * 0.5 - 4} L ${m - 6} ${m + h * 0.5} L ${m - 12} ${m + h * 0.5 - 18}`,
    }[a.name];
    const sv = el(`<svg class="mk" style="left:${r.left - m}px;top:${r.top - m}px;width:${w + 2 * m}px;height:${h + 2 * m}px" viewBox="0 0 ${w + 2 * m} ${h + 2 * m}"><path pathLength="1" d="${d}"/></svg>`);
    view.appendChild(sv); drawn(sv, at, 650); ring(S.sounds.point, at);
    until.push(sv); return at + 650 + hold(1300);
  };
  // a component laid over the film for a while: it comes in from the nearest edge, stays, and leaves the way it came.
  // A second one in the same place sits beside the first while that one is still there.
  const showing = [];
  const over = (o, when) => {
    const k = Math.min(1.25, W / 1280) * (o.scale ?? 1), w = o.w * k, h = o.h * k, edge = W * 0.03 - o.room * k, [a, b] = o.at.split(" ");
    const side = [a, b].includes("left") ? "left" : [a, b].includes("right") ? "right" : "middle", level = [a, b].includes("top") ? "top" : [a, b].includes("bottom") ? "bottom" : "middle";
    const taken = showing.filter((q) => q.at === o.at && q.until > when).reduce((n, q) => n + q.h, 0), inAt = when + 150, stay = inAt + 520 + o.for;
    const x = side === "left" ? edge : side === "right" ? W - w - edge : (W - w) / 2, y = level === "top" ? edge + taken : level === "bottom" ? H - h - edge - taken : (H - h) / 2;
    const from = side === "right" ? `${w * 0.35}px 0px` : side === "left" ? `${-w * 0.35}px 0px` : level === "top" ? `0px ${-h * 0.5}px` : level === "bottom" ? `0px ${h * 0.5}px` : "0px 24px";
    const e = el(`<img class="over" src="${D.rel}/${o.file}" style="left:${x}px;top:${y}px;width:${w}px">`);
    stage.appendChild(e); loads.push(loaded(e)); start(e, "opacity", 0); start(e, "translate", from);
    show(e, inAt, 260); to(e, "translate", inAt, 520, "0px 0px", "cubic-bezier(.2,1.1,.3,1)"); ring(S.sounds.overlay, inAt);
    hide(e, stay, 300); to(e, "translate", stay, 380, from, "cubic-bezier(.5,0,.8,.4)");
    showing.push({ at: o.at, until: stay + 380, h: h - 2 * o.room * k + 14 });
    return { in: inAt, gone: stay + 380 };
  };
  // a button laid over the film for a while: in the player it leads somewhere, and the film can stop on it
  const cta = (o, when, step) => {
    const [a, b] = o.at.split(" "), is = (x) => a === x || b === x, inAt = when + 150, stay = inAt + 420 + o.for;
    const wrap = el(`<div class="cta-at" style="padding:${Math.round(H * 0.05)}px ${Math.round(W * 0.04)}px ${Math.round(H * 0.17)}px;justify-content:${is("left") ? "flex-start" : is("right") ? "flex-end" : "center"};align-items:${is("top") ? "flex-start" : is("bottom") ? "flex-end" : "center"}"><a class="cta" target="_blank" rel="noopener"></a></div>`), e = wrap.firstChild;
    e.textContent = o.text; e.href = o.href; stage.appendChild(wrap);
    start(e, "opacity", 0); start(e, "translate", "0px 18px"); start(e, "visibility", "hidden");
    to(e, "visibility", inAt, 1, "visible"); show(e, inAt, 260); to(e, "translate", inAt, 420, "0px 0px", "cubic-bezier(.2,1.1,.3,1)");
    hide(e, stay, 300); to(e, "visibility", stay + 300, 1, "hidden");
    if (o.wait) waits.push({ at: inAt + 420, el: e, step });
    return { in: inAt, gone: stay + 300 };
  };
  const chapter = (c, i) => {
    marks.push({ at: t, text: `${c.lead} ${c.key}` });
    const e = card(c); stage.appendChild(e);
    const next = D.steps.slice(i + 1).find((x) => x.actions.length)?.actions[0].before;
    if (BOARD) { // on a canvas the card is words over it: the camera draws back to show the frames, travels to the next, comes in again
      e.classList.add("over"); hide(cur, t, 200);
      const z = 0.42, out = `translate(${Math.round(W / 2 - WIN.x - (z * WIN.w) / 2)}px, ${Math.round(H * 0.64 - WIN.y - (z * winH) / 2)}px) scale(${z})`;
      to(win, "transform", t, 900, out, GLIDE); Object.assign(lens, { tx: 0, ty: 0, z: 1 }); cam = false;
      const done = reveal(e, onBeat(t + 500), "chapter");
      const moved = next && next !== layers.at(-1) ? put(next, done + hold(300), 0) : null, there = done + hold(300) + (moved ? panMs : 0) + hold(600);
      hide(e, there, 400); to(win, "transform", there + 150, 900, "translate(0px, 0px) scale(1)", GLIDE); back(there + 900);
      t = there + 1050; return;
    }
    hide(win, t, 300); hide(cur, t, 200);
    // the next place is set up behind the card, with the camera back at rest: the film comes back on it, not on the
    // place it left, which would then cut away
    if (next && next !== layers.at(-1)) {
      put(next, t + 300, 0);
      if (cam) { to(win, "transform", t + 300, 1, "translate(0px, 0px) scale(1)"); if (PARA) to(bgEl, "translate", t + 300, 1, "0px 0px"); Object.assign(lens, { tx: 0, ty: 0, z: 1 }); cam = false; }
    }
    const done = reveal(e, onBeat(t + 300), "chapter");
    hide(e, done + hold(1300), 400); ring(S.sounds.enter, done + hold(1300) + 300); show(win, done + hold(1300) + 400, 500); back(done + hold(1300) + 600);
    t = done + hold(1300) + 1000;
  };

  // the steps
  let cap = null, ff = null, grp = null;
  D.steps.forEach((s, i) => {
    // steps that run together: the first sets the moment (once the camera has come to it), the others start there too,
    // or a little after one another; the film goes on when the last of them is done
    const tg = s.together;
    if (tg && tg.n === 0) grp = { id: tg.id, at: null, end: t }; else if (tg) t = grp.at + tg.lag;
    const t0 = t, clip = D.clips?.[s.speak ?? s.say], until = []; // until: things that leave when the step ends
    pace = S.pace * tempo * (s.pace ?? 1);
    const mark = { segs: every.length, sfx: sfx.length, inside: inside.length };
    if (s.fast > 1 && !ff) { ff = el(`<div class="ff">${s.fast}×</div>`); stage.appendChild(ff); start(ff, "opacity", 0); show(ff, t0, 200); ring(S.sounds.fast, t0); }
    let result = null; // when the last action's result came on screen
    if (SRC && s.src && s.kind !== "words") litPending = s.src;
    if (s.say && (!cap || cap.say !== s.say)) {
      if (cap) { if (cap.el) hide(cap.el, t0, 200); captions.at(-1).to = t0; }
      cap = { say: s.say, el: S.captions.show && !background ? el(`<div class="cap${S.captions.position === "top" ? "" : " low"}"><span>${chosen.caption === "fade" ? esc(s.say) : words(s.say)}</span></div>`) : null };
      captions.push({ text: s.say, from: t0, to: null });
      if (cap.el) { stage.appendChild(cap.el); start(cap.el, "opacity", 0); motion("caption")(cap.el, t0 + (i ? 150 : 0), kit, { ms: clip?.ms }); ring(S.sounds.caption, t0 + (i ? 150 : 0)); }
    }
    if (clip && !(s.fast > 1)) audio.push({ file: `${D.voiceRel}/${clip.file}`, at: t0 + 150, ms: clip.ms });
    if (s.kind === "chapter") chapter(s.card, i);
    if (s.kind === "background") { // a new stage behind the window: said before anything else, it is there from the start; later, it fades in
      const layer = el(`<div style="position:absolute;inset:0"></div>`), first = D.steps.slice(0, i).every((x) => x.kind === "background");
      layer.style.background = s.css; bgEl.appendChild(layer);
      if (first) start(layer, "opacity", 1); else { start(layer, "opacity", 0); to(layer, "opacity", t, 700, 1); t += 700; }
    }
    if (s.kind === "words") sentence(s.words, clip?.ms, D.steps[i + 1], D.steps[i - 1], s.src);
    if (s.kind === "button") { const it = cta(s.button, t, i); result = it.in; if (s.button.wait) t = it.gone; } // the film carries on under it, unless it stops there
    if (s.kind === "overlay") { const it = over(s.overlay, t); result = it.in; if (s.overlay.wait) t = it.gone; } // the film carries on under it, unless it is told to wait
    if (s.kind === "cut" && (lens.z !== 1 || lens.tx || lens.ty)) { camera(inWin(D.view.width / 2, D.view.height / 2), 1, [0, 0], t); t += MOVE; } // a page opened after a close-up comes in whole
    for (const a of s.actions) {
      if (put(a.before, t, 250) && !(i === 0 && a === s.actions[0])) { ring(S.sounds.cut, t); t += panMs; } // the page changed between two steps (on a canvas: the camera travels there)
      const b = a.box, p = b && inWin(b.x + b.w / 2, b.y + b.h / 2);
      if (a.do === "scroll") { t += 200; put(a.after, t, 500); t += hold(900); continue; }
      if (a.do === "mark") { t = drawMark(a, b, p, t, until); continue; }
      if (a.do === "effect") { const fx = bricks.effect[a.name]; t += (fx ? fx({ box: b, at: t, options: a.options ?? {}, kit }) ?? 0 : 0) + hold(400); continue; }
      kit.from = b ? { x: ((b.x + b.w / 2) / D.view.width) * 100, y: ((b.y + b.h / 2) / D.view.height) * 100 } : { x: 50, y: 50 }; // where a "grow" cut starts
      if (a.do === "piece") {
        // the window steps away; each piece is shown alone, as large as fits, all at one scale so their type matches
        const parts = a.parts.map((q) => ({ ...q, box: q.pad ? { x: q.box.x - q.pad, y: q.box.y - q.pad, w: q.box.w + 2 * q.pad, h: q.box.h + 2 * q.pad } : q.box })), gapPx = 44; // a bare line of text gets room around it
        const room = { w: W * 0.84, h: H * (s.say && S.captions.show ? 0.56 : 0.66) };
        const wide = parts.reduce((n, q) => n + q.box.w, 0), tall = Math.max(...parts.map((q) => q.box.h)), k = Math.min((room.w - gapPx * (parts.length - 1)) / wide, room.h / tall, 3.2);
        let x = (W - (wide * k + gapPx * (parts.length - 1))) / 2;
        hide(win, t, 300); hide(cur, t, 200);
        const v = D.vector[a.before], dur = a.name ? lasts(a.name, a) : 0;
        parts.forEach((q, n) => {
          const e = el(`<div class="piece" style="left:${x}px;top:${(H - q.box.h * k) / 2 - (s.say && S.captions.show ? F.capY * 0.35 : 0)}px;width:${q.box.w * k}px;height:${q.box.h * k}px">${v
            ? `<iframe src="${D.rel}/${v}" scrolling="no" tabindex="-1" style="width:${D.view.width}px;height:${D.view.height}px;transform:scale(${k});left:${-q.box.x * k}px;top:${-q.box.y * k}px"></iframe>`
            : `<img src="${D.rel}/${a.before}" style="width:${D.view.width * k}px;left:${-q.box.x * k}px;top:${-q.box.y * k}px">`}</div>`);
          x += q.box.w * k + gapPx;
          const node = e.firstChild, at = t + 350 + n * 170;
          loads.push(loaded(node));
          if (v) alonePieces.push({ node, id: q.id });
          stage.insertBefore(e, rig.nextSibling); start(e, "opacity", 0); start(e, "scale", "0.9");
          show(e, at, 350); to(e, "scale", at, 650, "1", "cubic-bezier(.2,1.2,.3,1)"); ring(S.sounds.piece, at);
          if (a.name && n === 0) { inside.push({ node, id: q.id, name: a.name, at: at + 500, dur, options: a.options ?? {} }); ring(S.sounds.animate, at + 500); if (a.name === "type") keys(at + 500, dur, a.chars ?? 12); }
          until.push(e);
        });
        result = t + 700; t += 350 + (parts.length - 1) * 170 + 650 + (dur ? dur + 150 : 0) + hold(1500); continue;
      }
      if (a.do === "animate") {
        // the real element moves, inside the frozen page; the camera comes to it first when it is out of view
        if (!(tg?.n > 0)) { // (the camera moves once for steps that run together: for the first of them)
          const was = `${lens.tx} ${lens.ty} ${lens.z}`;
          if (!still && b) camera(p, Z, PULL, t);
          t += `${lens.tx} ${lens.ty} ${lens.z}` === was ? 150 : MOVE;
          if (tg) grp.at = t;
        }
        const dur = lasts(a.name, a);
        if (a.name === "type") keys(t, dur, a.chars ?? 12);
        inside.push({ file: a.before, id: a.id, name: a.name, at: t, dur, options: a.options ?? {} });
        ring(S.sounds.animate, t); result = t + dur; t += dur + hold(500); continue;
      }
      if (a.do === "zoom") {
        // closer than usual: the element fills most of the frame
        const z = clamp(Math.min((W * 0.7) / (b.w * K), (H * 0.5) / (b.h * K)), Math.max(Z, 1.3), 2.4);
        camera(p, z, [1, 1], t, MOVE + 100); ring(S.sounds.zoom, t);
        const ring1 = chosen.spotlight === "select" ? bricks.spotlight.select(b, t + MOVE) : kit.box(b, 6, "mark"); if (chosen.spotlight !== "select") show(ring1, t + MOVE, 300); until.push(ring1);
        t += MOVE + 100 + hold(1300); continue;
      }
      if (a.do === "label") {
        const above = b.y > 56, tag = el(`<div class="tag${above ? "" : " below"}" style="left:${(b.x + b.w / 2) * K}px;top:${(above ? b.y - 10 : b.y + b.h + 10) * K}px">${esc(a.text)}</div>`);
        view.appendChild(tag); start(tag, "opacity", 0); start(tag, "translate", `-50% ${above ? "-90%" : "-10%"}`);
        if (!still) camera(p, Z, PULL, t);
        show(tag, t + 500, 300); ring(S.sounds.label, t + 500); to(tag, "translate", t + 500, 300, `-50% ${above ? "-100%" : "0%"}`);
        until.push(tag); t += 800 + hold(1300); continue;
      }
      if (a.do === "link") { // something of the app the viewer can follow: marked, and in the player a real link, while the step lasts
        const at = camera(p, Z, PULL, t); moveTo(at, t); t += MOVE;
        const r = kit.inView(b, 6), e = el(`<a class="hot" target="_blank" rel="noopener" style="left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px"></a>`);
        e.href = a.href; e.setAttribute("aria-label", a.what || a.href); view.appendChild(e);
        start(e, "opacity", 0); start(e, "visibility", "hidden"); to(e, "visibility", t, 1, "visible"); show(e, t, 250); until.push(e); ring(S.sounds.point, t);
        result = t; t += 350 + hold(1700); continue;
      }
      if (a.do === "point") {
        const at = camera(p, Z, PULL, t); moveTo(at, t); t += MOVE;
        until.push(...[motion("spotlight")(b, t, kit)].flat()); ring(S.sounds.point, t); // (one element, or several)
        t += 350 + hold(1300); continue;
      }
      if (!b) { t += 250; result = t; t += after(a, t); continue; } // a key press: nothing to point at
      const at = camera(p, Z, PULL, t); moveTo(at, t); t += MOVE + 120;
      if ((s.byViewer || (tour && BY_VIEWER.includes(s.kind) && !s.fast)) && !waits.some((w) => w.step === i)) { // the viewer's own click: in the player the film stops here, with the place marked
        const r = kit.inView(b, 8), e = el(`<button class="spot" type="button" style="left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px"></button>`);
        e.setAttribute("aria-label", `Click ${a.what || "here"}`); view.appendChild(e); waits.push({ at: t, el: e, step: i });
      }
      if (a.do === "hover") { result = t; t += after(a, t, 250) + 230; continue; }
      if (a.do === "drag") {
        const q2 = inWin(a.to.x + a.to.w / 2, a.to.y + a.to.h / 2);
        to(cur, "scale", t, 110, "0.86"); t += 200;
        moveTo({ x: at.x + (q2.x - p.x) * Z, y: at.y + (q2.y - p.y) * Z }, t, 700); t += 700;
        to(cur, "scale", t, 110, "1"); result = t; t += after(a, t); continue;
      }
      click(at, t); t += 220; result = t;
      if (a.do === "fill") keys(t, clamp((a.chars ?? 8) * 45, 300, 1500), a.chars ?? 8);
      if (a.do === "fill" && !a.motion?.length && a.after !== layers.at(-1)) {
        // typing: the picture with the text in it is uncovered from the left edge of the field to its right edge
        const img = layer(a.after, 0, t, t + 1500), pc = (v, of) => `${((v / of) * 100).toFixed(3)}%`;
        const top = pc(b.y - 6, D.view.height), bottom = pc(D.view.height - b.y - b.h - 6, D.view.height);
        const left = pc(b.x - 6, D.view.width), ms = Math.min(1500, Math.max(450, (a.chars ?? 12) * 45));
        start(img, "clipPath", `inset(${top} ${pc(D.view.width - b.x + 6, D.view.width)} ${bottom} ${left})`);
        to(img, "opacity", t, 1, 1);
        to(img, "clipPath", t, ms, `inset(${top} ${pc(D.view.width - b.x - b.w - 6, D.view.width)} ${bottom} ${left})`, "linear");
        to(img, "clipPath", t + ms, 1, "inset(0% 0% 0% 0%)");
        t += ms + hold(400);
      } else t += after(a, t);
    }
    if (litPending) { litTo(litPending, litY, t0); litPending = null; } // a step with nothing to aim at: its line is lit where the band is
    if (s.kind === "pause") t += s.ms ?? 1000;
    // a step's own sounds: when it starts, or when what it did shows (those two before any fast-forward pulls them closer)
    const own = s.sound ?? [];
    const began = tg?.n === 0 ? grp.at ?? t0 : t0; // steps that run together begin once the camera has come to them
    for (const x of own) if (x.at !== "end") ring(x.name, (x.at === "start" ? began : result ?? t0 + 200) + x.delay, x.volume);
    // a step lasts as long as its words need, and what the action brought stays under them long enough to be seen
    const least = Math.max(t0 + Math.max(clip ? 150 + clip.ms + 250 : 0, s.say ? hold(900 + s.say.length * 45) : 0), s.say && result != null ? result + hold(1700) : 0);
    if (t < least) t = least;
    if (s.hold) t += s.hold; // stay on what the step did, this much longer
    if (s.fast > 1) { // fast-forward: everything this step put on the clock happens sooner and quicker
      const near = (x) => t0 + (x - t0) / s.fast;
      for (const g of every.slice(mark.segs)) { g.t = near(g.t); g.dur /= s.fast; }
      for (const x of sfx.slice(mark.sfx)) x.at = near(x.at);
      for (const x of inside.slice(mark.inside)) { x.at = near(x.at); x.dur /= s.fast; }
      t = near(t);
    }
    for (const x of own) if (x.at === "end") ring(x.name, t + x.delay, x.volume); // and when it ends
    for (const e of until) { hide(e, t, 250); if (e.tagName === "A") to(e, "visibility", t + 250, 1, "hidden"); } // a link that is gone cannot be clicked
    ranges.push({ from: t0, to: t + 250, src: s.src ?? null }); // src: the scene line the step was written on
    const next = D.steps[i + 1];
    if (ff && !(next?.fast > 1)) { hide(ff, t, 250); ff = null; }
    if (s.kind === "piece") { if (!(next?.kind === "piece" || (next?.kind === "words" && !next.words.beside))) { show(win, t + 200, 450); back(t + 400); } t += 450; } // the window comes back, unless another piece or a sentence follows
    if (cap && (!next || next.say !== cap.say)) { if (cap.el) hide(cap.el, t, 250); captions.at(-1).to = t; cap = null; }
    if (tg) { grp.at ??= t0; grp.end = Math.max(grp.end, t); if (next?.together?.id !== tg.id) { t = grp.end; grp = null; } }
  });
  pace = S.pace * tempo;
  if (!D.steps.some((s) => s.actions.length)) t += hold(1800);
  t = Math.max(t, ...showing.map((q) => q.until)); // the film does not end under something still laid over it

  // the others on the canvas: their cursors wander about the frames at the sides, and are there while the window is
  if (S.cursor.guests?.length && !device) {
    const crowd = el(`<div class="crowd"></div>`); rig.appendChild(crowd); follow(win, crowd, ["opacity"]); start(crowd, "opacity", 0);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    S.cursor.guests.forEach((g, n) => {
      const who = person(g.name, g.color ?? ["#f24e1e", "#0fa958", "#ff7262", "#e5a000"][n % 4]); crowd.appendChild(who);
      const spot = () => ({ x: (n % 2 ? 0.8 : 0.03) * W + rnd() * W * 0.16, y: H * 0.15 + rnd() * H * 0.65 }); // about the edges, by the frames beside
      let p = spot(); start(who, "translate", `${p.x}px ${p.y}px`);
      for (let at = appAt + 400 + n * 700; at < t; at += 1600 + rnd() * 1800) { p = spot(); to(who, "translate", at, 900 + rnd() * 500, `${p.x}px ${p.y}px`, "cubic-bezier(.45,0,.25,1)"); }
    });
  }

  // back out, then the end card
  hide(cur, t, 300);
  // after words the window is already away: the end card comes straight on
  const lastStep = D.steps.at(-1), wordsLast = lastStep?.kind === "words" && !lastStep.words.beside;
  if (!wordsLast) {
    if (cam) { to(win, "transform", t, 900, "translate(0px, 0px) scale(1)", GLIDE); if (PARA) to(bgEl, "translate", t, 900, "0px 0px", GLIDE); t += 900; }
    t += hold(1300);
    // without an end card the window stays (unless an exit is asked for): the film ends on its last picture, not on
    // an empty background
    if (S.end.show !== false || S.motion?.exit) { ring(S.sounds.exit, t); if (srcEl) hide(srcEl, t, 400), hide(across, t, 400); t += motion("exit")(win, t, kit); }
  }
  t = onBeat(t);
  let endAt = t;
  if (me) { start(me, "opacity", 0); show(me, 250, 400); hide(me, endAt, 350); } // the presenter is there from the start, and leaves for the end card
  // the window turned in space, swinging slowly to the other side; and the whole picture coming a little closer
  if (TILT || S.camera.drift) {
    const turn = (x, y, s) => `rotateX(${x}deg) rotateY(${y}deg) scale(${s})`, [tx0, ty0] = TILT ?? [0, 0];
    if (TILT) stage.style.perspective = "2600px";
    start(rig, "transform", turn(tx0, ty0, 1)); to(rig, "transform", appAt, Math.max(1, endAt - appAt), turn(tx0 * 0.4, -ty0 * 0.6, 1 + (S.camera.drift || 0)), "linear");
  }
  if (S.end.show === false) start(end, "opacity", 0);
  let total = S.end.show === false ? t + hold(300) : reveal(end, t, "end") + hold(2400);
  // the whole film a little quicker or slower. Never with narration (a voice keeps its own speed), nor when cards sit on the music's beat
  if (speed !== 1 && !audio.length && !BEAT) {
    const q = (x) => x / speed;
    for (const g of every) { g.t = q(g.t); g.dur = q(g.dur); }
    for (const x of sfx) x.at = q(x.at);
    for (const x of inside) { x.at = q(x.at); x.dur = q(x.dur); }
    for (const x of [...captions, ...ranges]) { x.from = q(x.from); if (x.to != null) x.to = q(x.to); }
    for (const x of [...waits, ...marks]) x.at = q(x.at);
    endAt = q(endAt); total = q(total); appAt = q(appAt); opens = q(opens);
  }
  // the scene's cues: sounds at moments of the film itself
  for (const c of D.cues ?? []) ring(c.name, (typeof c.at === "number" ? (c.at >= 0 ? c.at * 1000 : total + c.at * 1000) : c.at === "end" ? endAt : c.at === "app" ? appAt : 0) + c.delay, c.volume);
  if (measure) return total;
  rig.appendChild(cur); stage.append(title, end);
  if (me) { stage.appendChild(me); loads.push(new Promise((r) => { me.onloadeddata = r; me.onerror = r; })); }
  if (FIN.vignette) stage.appendChild(el(`<div class="vig" style="opacity:${+FIN.vignette}"></div>`));
  if (FIN.grain) stage.appendChild(el(`<div class="grain" style="opacity:${+FIN.grain}"></div>`));

  // ---- one paused animation per element and property, as long as the film
  const anims = [];
  const build = () => { for (const [e, props] of tracks) for (const [prop, { from, segs }] of Object.entries(props)) {
    let value = from, lastEnd = 0;
    const kf = [{ offset: 0, [prop]: value }];
    for (const s of segs.sort((a, b) => a.t - b.t)) {
      const t0 = Math.max(s.t, lastEnd), t1 = Math.max(t0 + 1, s.t + s.dur);
      kf.push({ offset: Math.min(1, t0 / total), [prop]: value, easing: s.ease }, { offset: Math.min(1, t1 / total), [prop]: s.value });
      value = s.value; lastEnd = t1;
    }
    kf.push({ offset: 1, [prop]: value });
    const a = e.animate(kf, { duration: total, fill: "both" }); a.pause(); anims.push(a);
  } tracks.clear(); };
  build();

  // ---- playing
  const sounds = audio.map((c) => Object.assign(new Audio(c.file), { preload: "auto" }));
  const M = D.music, music = M ? Object.assign(new Audio(M.file), { loop: M.loop, preload: "auto" }) : null;
  // the viewer's own setting: sound on or off, and how loud; kept for next time where the browser allows
  const kept = (() => { try { return JSON.parse(localStorage.getItem("scenlit:sound")) ?? {}; } catch { return {}; } })();
  let loud = kept.loud ?? 1, off = !!kept.off;
  const level = () => (off ? 0 : loud);
  // how loud the music is at a moment: it comes in, sinks while someone is speaking, and goes out with the film
  const musicAt = (ms) => {
    const s = ms / 1000, far = ME?.sound ? 0 : audio.reduce((m, c) => Math.min(m, ms < c.at ? c.at - ms : ms > c.at + c.ms ? ms - c.at - c.ms : 0), Infinity);
    return M.volume * (M.fadeIn > 0 ? clamp(s / M.fadeIn, 0, 1) : 1) * (M.fadeOut > 0 ? clamp((total / 1000 - s) / M.fadeOut, 0, 1) : 1) * (M.duck + (1 - M.duck) * clamp(far / 300, 0, 1));
  };
  const mix = () => { const mute = level() === 0; if (music) { music.volume = clamp(musicAt(now) * level(), 0, 1); music.muted = mute; } for (const s of sounds) { s.volume = level(); s.muted = mute; } if (me) { me.muted = !ME.sound || mute; me.volume = clamp(ME.volume * level(), 0, 1); } };
  const meAt = () => clamp(ME.start + now / 1000, 0, ME.ms ? ME.ms / 1000 - 0.04 : Infinity); // where the presenter's recording is when the film is at `now`
  let now = 0, playing = false, base = 0, since = 0;
  const seek = (ms) => { now = Math.max(0, Math.min(total, ms)); for (const a of anims) a.currentTime = now; for (const f of tickers) f(now); if (me && (!playing || Math.abs(me.currentTime - meAt()) > 0.3)) me.currentTime = meAt(); };
  // the same, for a picture: it is done when the presenter's recording has reached that moment too
  const frame = (ms) => { seek(ms); return !me || !me.seeking ? Promise.resolve() : new Promise((r) => { me.addEventListener("seeked", () => requestAnimationFrame(() => r()), { once: true }); setTimeout(r, 2000); }); };
  // once the frozen pages are there: find what a scene asked to move inside them, and give it its place on the clock.
  // A picture that is not a frozen page, or a page the browser will not let us into, simply stays still.
  const settle = () => {
    for (const x of inside) {
      let e = null;
      try { e = (x.node ?? nodes[x.file])?.contentDocument?.querySelector(`[data-scenlit-a="${x.id}"]`); } catch { /* another origin */ }
      if (e) bricks.animate[x.name]?.({ el: e, at: x.at, dur: x.dur, options: x.options }, kit); else window.__film.still++;
    }
    // a piece is shown alone: the room around it (a bare line of text gets some) shows what holds it, not the edges of
    // its neighbours. Everything else in its frozen page is hidden in place, so nothing moves.
    for (const { node, id } of alonePieces) {
      let doc = null;
      try { doc = node.contentDocument; } catch { /* another origin: it shows as it was pictured */ }
      if (!doc?.querySelector(`[data-scenlit-a="${id}"]`)) continue;
      const a = `[data-scenlit-a="${id}"]`, css = doc.createElement("style");
      css.textContent = `body *:not(:has(${a})):not(${a}):not(${a} *){visibility:hidden!important}`;
      doc.head.appendChild(css);
    }
    build(); seek(now);
  };
  const ready = Promise.all([document.fonts.ready, ...loads]).then(settle);
  sfx.sort((a, b) => a.at - b.at);
  const fx = Object.fromEntries(Object.entries(D.sfx ?? {}).map(([k, v]) => [k, Object.assign(new Audio(v), { preload: "auto" })]));
  let rung = 0;
  const quiet = () => { sounds.forEach((s) => s.pause()); music?.pause(); me?.pause(); };
  const embed = !!D.embed || q.has("embed") || background; // embedded: the film fills its frame
  // the player around the film is the project's to set (style.player): its controls, its colour, how it starts
  const P = S.player ?? {}, CONTROLS = P.controls === false || q.get("controls") === "none" ? [] : P.controls ?? ["play", "scrub", "time", "sound", "fullscreen"], bare = !CONTROLS.length;
  const fit = () => { const full = exporting || embed || bare, s = exporting ? 1 : Math.min(innerWidth / W, (innerHeight - (full ? 0 : 66)) / H); stage.style.transform = `translate(-50%, -50%) scale(${s})`; stage.style.top = full ? "50%" : `calc(50% - 33px)`; stage.style.setProperty("--lift", `${Math.round(78 / s)}px`); }; // --lift: the height of the controls, in the film's own pixels
  addEventListener("resize", fit); fit();
  // inside a frame the film can start before the page around it has given the frame a size, and no resize is told
  // when the size first arrives: watch the page's own box as well
  if (!exporting && window.ResizeObserver) new ResizeObserver(fit).observe(document.documentElement);
  // asks: where the film stops for the viewer. chapters: where each chapter begins. still: things a scene asked to move on the app's screen that could not be reached
  window.__film = { total, audio, captions, motion: Object.fromEntries(Object.entries(bricks).map(([f, v]) => [f, Object.keys(v)])), music: D.music, presenter: ME, steps: ranges, seek, frame, format: { name, W, H }, sfx, sfxVolume: S.sounds.volume, tempo, speed, still: 0, ready: () => ready,
    asks: waits.map((w) => ({ at: w.at, step: w.step })), chapters: marks, player: { ...P, controls: CONTROLS } };
  seek(0);
  if (exporting) return;

  const hasSound = !!(M || audio.length || sfx.length || ME?.sound);
  // the places a viewer can go to, marked on the bar and listed under "chapters": the film's chapters, or in a film
  // without any, each step that says something (player.marks: "chapters" or "steps" to choose, false for none)
  const said = () => captions.map((c) => ({ at: c.from, text: c.text })), byChapter = () => (marks.length ? [{ at: 0, text: `${D.title.lead} ${D.title.key}` }, ...marks] : []);
  const chapters = P.marks === false ? [] : P.marks === "steps" ? said() : P.marks === "chapters" || marks.length ? byChapter() : said();
  window.__film.marks = chapters;
  const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
  // the controls are icons; what each does is its label (for a screen reader, and under the pointer)
  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`, line = (d) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`;
  const SPEAKER = `<path d="M4 9.6v4.8a1 1 0 0 0 1 1h2.9l4.4 3.5a.7.7 0 0 0 1.2-.5V5.6a.7.7 0 0 0-1.2-.5L7.9 8.6H5a1 1 0 0 0-1 1z"/>`;
  const ICONS = {
    Play: svg(`<path d="M8 5.3v13.4a1 1 0 0 0 1.5.9l10.9-6.7a1 1 0 0 0 0-1.8L9.5 4.4A1 1 0 0 0 8 5.3z"/>`),
    Pause: svg(`<rect x="6.2" y="5" width="4.3" height="14" rx="1.3"/><rect x="13.5" y="5" width="4.3" height="14" rx="1.3"/>`),
    "Play again": svg(line("M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.2 4.5v3.6h3.6")),
    sound: svg(`${SPEAKER}${line("M16.6 9.3a4 4 0 0 1 0 5.4M19 6.8a7.5 7.5 0 0 1 0 10.4")}`),
    muted: svg(`${SPEAKER}${line("M17 9.8l4.4 4.4M21.4 9.8L17 14.2")}`),
    captions: svg(`<rect x="3" y="5.5" width="18" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.9"/>${line("M10.3 10.7a2 2 0 1 0 0 2.6M16.8 10.7a2 2 0 1 0 0 2.6")}`),
    chapters: svg(`${line("M9.5 7h10M9.5 12h10M9.5 17h10")}<circle cx="5" cy="7" r="1.25"/><circle cx="5" cy="12" r="1.25"/><circle cx="5" cy="17" r="1.25"/>`),
    full: svg(line("M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3")),
    small: svg(line("M9 4v3a2 2 0 0 1-2 2H4M20 9h-3a2 2 0 0 1-2-2V4M15 20v-3a2 2 0 0 1 2-2h3M4 15h3a2 2 0 0 1 2 2v3")),
  };
  ICONS.Continue = ICONS.Play;
  const button = (id, label, body = "", more = "") => `<button id="${id}" type="button" aria-label="${label}" title="${label}"${more}>${body}</button>`;
  // the bar is cut where the film's marks are: one piece for each place, filling as the film goes through it
  const GAP = 3, cuts = [...new Set([0, ...chapters.map((c) => c.at)])].filter((at) => at < total).sort((a, b) => a - b), pieces = cuts.map((from, k) => ({ from, to: cuts[k + 1] ?? total }));
  const parts = {
    play: button("pp", "Play"),
    scrub: `<span id="track"><span class="segs">${pieces.map((g) => `<span class="seg" style="flex:${Math.round(g.to - g.from)} 1 0"><i></i></span>`).join("")}</span><i class="knob"></i><input id="scrub" type="range" min="0" max="${Math.round(total)}" value="0" aria-label="Position in the film"><output id="tip" hidden></output></span>`,
    time: `<span id="time"><b></b><i></i></span>`,
    sound: hasSound ? `<span id="sound">${button("snd", "Sound", "", ` aria-pressed="false"`)}<input id="vol" type="range" min="0" max="1" step="0.05" aria-label="Volume"></span>` : "",
    captions: captions.length && S.captions.show ? button("cc", "Captions", ICONS.captions, ` aria-pressed="true"`) : "",
    speed: button("rate", "Playing speed"),
    chapters: chapters.length ? button("chap", "Chapters", ICONS.chapters, ` aria-expanded="false"`) : "",
    fullscreen: document.fullscreenEnabled ? button("full", "Full screen", ICONS.full) : "",
  };
  // the bar on top, across the whole width; under it play, sound and time on the left and the rest on the right, each side in the project's order
  const LEFT = ["play", "sound", "time"], side = (left) => CONTROLS.filter((c) => c !== "scrub" && LEFT.includes(c) === left).map((c) => parts[c] ?? "").join("");
  const bar = el(`<div id="bar">${CONTROLS.includes("scrub") ? parts.scrub : ""}<div class="row"><div class="side">${side(true)}</div><div class="side">${side(false)}</div></div></div>`), part = (id) => bar.querySelector(`#${id}`);
  if (bare) document.body.classList.add("bare"); else document.body.appendChild(bar);
  const pp = part("pp"), scrub = part("scrub"), time = part("time"), snd = part("snd"), vol = part("vol"), cc = part("cc"), rateBtn = part("rate"), chap = part("chap");
  const stop = (e) => e.stopPropagation(), stored = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }, store = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private window */ } };

  // sound: the viewer's button and slider (or the M key). `keep(false)`: for now only, not for next time
  const keep = (forNext = true) => {
    if (snd) { const say = off ? "Turn the sound on" : "Turn the sound off"; snd.innerHTML = off ? ICONS.muted : ICONS.sound; snd.setAttribute("aria-label", say); snd.title = say; snd.setAttribute("aria-pressed", String(!off)); vol.value = off ? 0 : loud; vol.style.setProperty("--v", `${(off ? 0 : loud) * 100}%`); }
    mix(); if (forNext) store("scenlit:sound", { loud, off });
  };
  if (snd) { snd.onclick = (e) => { stop(e); off = !off; keep(); }; vol.oninput = () => { const v = +vol.value; off = v === 0; if (v > 0) loud = v; keep(); }; vol.onclick = stop; }
  if (hasSound) addEventListener("keydown", (e) => { if (e.key === "m") { off = !off; keep(); } });
  keep(false);
  // a browser lets nothing make sound before the viewer has clicked: a film started by itself, or by the page around
  // it, goes on with its sound off, and the sound button turns it on
  const blocked = (err) => { if (err?.name !== "NotAllowedError" || off) return; off = true; keep(false); if (playing) { music?.play().catch(() => {}); me?.play().catch(() => {}); } };

  // captions: on or off for this viewer (the C key), when the player has the button
  let caps = (cc ? stored("scenlit:captions") : null) ?? P.captions !== false;
  const showCaps = () => { stage.classList.toggle("nocap", !caps); cc?.setAttribute("aria-pressed", String(caps)); };
  if (cc) { cc.onclick = (e) => { stop(e); caps = !caps; showCaps(); store("scenlit:captions", caps); }; addEventListener("keydown", (e) => { if (e.key === "c") cc.click(); }); }
  showCaps();

  // speed: the clock runs quicker or slower, and the voices with it (the music keeps its own)
  const RATES = [1, 1.25, 1.5, 2, 0.75];
  let rate = 1;
  const setRate = (r) => { if (playing) { base = now; since = performance.now(); } rate = r; for (const x of sounds) x.playbackRate = r; if (me) me.playbackRate = r; if (rateBtn) { rateBtn.textContent = `${r}×`; rateBtn.title = `Playing speed: ${r}×`; } };
  if (rateBtn) rateBtn.onclick = (e) => { stop(e); setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length]); };
  setRate(clamp(+P.speed || 1, 0.25, 4));

  // the page that embeds the film can follow it and drive it. It is told: ready, play, pause, ended, time (four times a
  // second), step (which step is on screen; -1: the title, -2: the end), ask (the film waits for the viewer) and link
  // (the viewer followed a link or a button: its text and address).
  // It can say: { scenlit: { do: "play" | "pause" | "seek" | "sound" | "ready", at: seconds, on: true } } ("ready": tell me again)
  // ready also says where the app's window comes in, where each step begins and ends (and the scene line it was
  // written on: lines), and where the end card begins
  const sec = (ms) => +(ms / 1000).toFixed(2), timing = () => ({ seconds: sec(total), opens: sec(opens), steps: ranges.map((r) => [sec(r.from), sec(r.to)]), lines: ranges.map((r) => r.src), end: sec(endAt) });
  const tell = (event, more) => { if (parent !== window) parent.postMessage({ scenlit: { event, at: +(now / 1000).toFixed(2), ...more } }, "*"); };
  const cueAt = (ms) => { if (!ranges.length || ms < ranges[0].from) return -1; if (ms >= endAt) return -2; let k = 0; ranges.forEach((r, i) => { if (ms >= r.from) k = i; }); return k; };
  let cue = null, told = -1000;
  const announce = () => { const c = cueAt(now); if (c !== cue) { cue = c; tell("step", { step: c }); } };

  // before it is first played the film rests: on its poster (a moment of the film, or a picture), else where it begins
  let waiting = false;
  const poster = typeof P.poster === "string" ? el(`<img id="poster" alt="">`) : null;
  if (poster) { poster.src = P.poster; stage.appendChild(poster); }
  const rest = () => { waiting = true; document.body.classList.add("rest"); if (typeof P.poster === "number") seek(Math.min(total, P.poster * 1000)); else if (embed && !poster) seek(Math.min(2200, total)); paint(); };
  const leave = () => { waiting = false; document.body.classList.remove("rest"); poster?.remove(); };

  // a step the viewer does: the film stops with the place marked (or on a button that waits), and goes on at their
  // click, or when they press play
  let asking = null;
  const ask = (w) => { asking = w; w.el.classList.add("on"); document.body.classList.add("asking"); if (w.el.tagName === "BUTTON") w.el.focus({ preventScroll: true }); }; // (focused: Enter or the space bar clicks it too)
  const answer = () => { if (!asking) return; asking.done = true; asking.el.classList.remove("on"); asking.el.blur(); document.body.classList.remove("asking"); asking = null; };
  const jump = (ms) => { answer(); leave(); seek(ms); for (const w of waits) w.done = w.at < now; paint(); };
  for (const w of waits) {
    if (w.el.classList.contains("spot")) w.el.onclick = (e) => { stop(e); if (asking === w) play(); };
  }
  for (const a of stage.querySelectorAll("a.hot, a.cta")) a.onclick = (e) => { stop(e); if (playing) pause(); tell("link", { text: a.textContent.trim() || a.getAttribute("aria-label") || "", address: a.getAttribute("href") }); }; // following a link: the film waits for them to come back

  const knob = part("track")?.querySelector(".knob"), fills = [...bar.querySelectorAll(".seg i")], rows = [];
  let shown = {};
  const paint = () => {
    announce(); document.body.classList.toggle("paused", !playing);
    const does = playing ? "Pause" : asking ? "Continue" : now >= total ? "Play again" : "Play", at = clock(now), k = Math.max(0, pieces.findLastIndex((g) => now >= g.from));
    if (pp && shown.does !== does) { pp.innerHTML = ICONS[does]; pp.setAttribute("aria-label", does); pp.title = does; }
    if (time && shown.at !== at) { time.firstChild.textContent = at; time.lastChild.textContent = ` / ${clock(total)}`; }
    if (scrub) {
      scrub.value = Math.round(now); if (shown.at !== at) scrub.setAttribute("aria-valuetext", at);
      fills.forEach((f, n) => { f.style.width = `${clamp((now - pieces[n].from) / (pieces[n].to - pieces[n].from), 0, 1) * 100}%`; });
      knob.style.left = `calc(${(now / total).toFixed(5)} * (100% - ${GAP * (pieces.length - 1)}px) + ${GAP * k}px)`;
    }
    const here = rows.length ? chapters.findLastIndex((c) => c.at <= now) : -1;
    if (shown.here !== here) rows.forEach((b, n) => b.setAttribute("aria-current", String(n === here)));
    shown = { does, at, here };
  };
  const LOOP = !!P.loop || q.has("loop"), AUTO = !!P.autoplay || q.has("autoplay");
  const tick = () => {
    if (!playing) return;
    seek(base + (performance.now() - since) * rate);
    const w = background ? null : waits.find((x) => !x.done && now >= x.at);
    if (w) { seek(w.at); ask(w); pause(); tell("ask", { step: w.step }); return; }
    audio.forEach((c, i) => { const x = sounds[i]; if (now >= c.at && now < c.at + c.ms) { if (x.paused) { x.currentTime = (now - c.at) / 1000; x.play().catch(blocked); } } else if (!x.paused) x.pause(); });
    mix();
    while (rung < sfx.length && sfx[rung].at <= now) { const x = sfx[rung++]; if (now - x.at < 200 && fx[x.name] && level() > 0) { const a = fx[x.name].cloneNode(); a.volume = Math.min(1, x.vol * S.sounds.volume * level()); a.play().catch(() => {}); } }
    if (background && now >= loopTo) { seek(loopFrom); base = loopFrom; since = performance.now(); }
    if (now - told >= 250 || now < told) { told = now; tell("time"); }
    if (now >= total) { playing = false; quiet(); paint(); tell("ended"); if (LOOP) play(); return; }
    paint(); requestAnimationFrame(tick);
  };
  const loopFrom = Math.max(0, (ranges[0]?.from ?? 0) - 700), loopTo = Math.max(loopFrom + 1000, endAt - 600);
  const play = () => {
    answer();
    if (background) { audio.length = 0; if (now < loopFrom || now >= loopTo) seek(loopFrom); } else if (now >= total || waiting) { seek(0); for (const w of waits) w.done = false; }
    leave(); base = now; since = performance.now(); playing = true; rung = sfx.findIndex((x) => x.at > now); if (rung < 0) rung = sfx.length;
    if (!background && music) { const d = music.duration, at = M.start + now / 1000; try { music.currentTime = d > 0 && isFinite(d) ? (M.loop ? at % d : Math.min(at, d)) : M.start; } catch { /* not loaded yet */ } mix(); music.play().catch(blocked); }
    if (me) { me.currentTime = meAt(); mix(); me.play().catch(blocked); }
    paint(); tell("play"); requestAnimationFrame(tick);
  };
  const pause = () => { if (!playing) return paint(); playing = false; quiet(); paint(); tell("pause"); };
  const toggle = () => (playing ? pause() : play());
  Object.assign(window.__film, { play, pause, jump, playing: () => playing, asking: () => (asking ? asking.step : null) });
  if (pp) pp.onclick = (e) => { stop(e); toggle(); };
  // The pointer on the bar: over it, the moment under the pointer and the place it belongs to; pressed, the film goes
  // there and follows a drag; near a mark it lands on the mark. The arrow keys go five seconds back or on, Home and
  // End to the start and the end. (The bar's own input is there to be found and read by a screen reader.)
  const placeAt = (ms) => chapters.filter((c) => c.at <= ms).at(-1), near = (ms) => chapters.find((c) => Math.abs(c.at - ms) < total * 0.012)?.at ?? ms;
  if (scrub) {
    const track = part("track"), tip = part("tip");
    // where on the bar a moment is, the other way round: its pieces are as wide as they are long, with the gaps between
    const momentAt = (x, w) => { const inner = w - GAP * (pieces.length - 1); let from = 0; for (const g of pieces) { const wide = (inner * (g.to - g.from)) / total; if (x <= from + wide) return g.from + clamp((x - from) / wide, 0, 1) * (g.to - g.from); from += wide + GAP; } return total; };
    const under = (e) => { const r = track.getBoundingClientRect(); return { r, at: near(momentAt(clamp(e.clientX - r.left, 0, r.width), r.width)) }; };
    let held = null; // while the bar is held: whether the film was playing
    track.onpointerdown = (e) => { if (e.button) return; e.preventDefault(); held = { was: playing }; track.setPointerCapture(e.pointerId); pause(); jump(under(e).at); };
    track.onpointermove = (e) => {
      const { r, at } = under(e), text = placeAt(at)?.text;
      if (held) jump(at);
      tip.textContent = text ? `${clock(at)}  ${text}` : clock(at); tip.hidden = false;
      tip.style.left = `${clamp(e.clientX - r.left, tip.offsetWidth / 2, r.width - tip.offsetWidth / 2)}px`;
    };
    track.onpointerup = track.onpointercancel = () => { if (held?.was) play(); held = null; };
    track.onpointerleave = () => { tip.hidden = true; };
    track.onclick = stop;
    addEventListener("keydown", (e) => { // wherever the keyboard is, but for the volume, which the arrows turn
      const to = e.target === vol || e.metaKey || e.ctrlKey || e.altKey ? null : { ArrowLeft: now - 5000, ArrowRight: now + 5000, Home: 0, End: total }[e.key];
      if (to == null) return;
      e.preventDefault(); const was = playing; pause(); jump(to); if (was) play();
    });
  }
  if (chap) {
    const menu = el(`<div id="chapters" hidden></div>`), shut = () => { menu.hidden = true; chap.setAttribute("aria-expanded", "false"); };
    for (const c of chapters) { const b = el(`<button type="button"><i></i> <span></span></button>`); b.firstChild.textContent = clock(c.at); b.lastChild.textContent = c.text; b.onclick = (e) => { stop(e); shut(); pause(); jump(c.at); play(); }; menu.appendChild(b); rows.push(b); }
    document.body.appendChild(menu);
    chap.onclick = (e) => { stop(e); menu.hidden = !menu.hidden; chap.setAttribute("aria-expanded", String(!menu.hidden)); };
    addEventListener("click", shut); addEventListener("keydown", (e) => { if (e.key === "Escape") shut(); });
  }
  // full screen, for a film on a page and one opened by itself
  const full = part("full");
  if (full) {
    full.onclick = (e) => { stop(e); document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); };
    addEventListener("fullscreenchange", () => { const on = !!document.fullscreenElement, say = on ? "Leave full screen" : "Full screen"; full.innerHTML = on ? ICONS.small : ICONS.full; full.setAttribute("aria-label", say); full.title = say; });
    addEventListener("keydown", (e) => { if (e.key === "f" && !e.target.closest?.("input")) full.click(); });
  }
  addEventListener("keydown", (e) => { if (e.code === "Space" && !e.target.closest?.("a,button")) { e.preventDefault(); toggle(); } });
  addEventListener("message", (e) => {
    const m = e.data?.scenlit;
    if (e.source !== parent || parent === window || !m?.do) return;
    if (m.do === "play") play(); else if (m.do === "pause") pause();
    else if (m.do === "seek") { const was = playing; pause(); jump((+m.at || 0) * 1000); if (was) play(); }
    else if (m.do === "sound") { off = m.on === false; keep(false); }
    else if (m.do === "ready") ready.then(() => tell("ready", timing())); // a page that came late asks again
  });
  paint();
  if (background) { bar.remove(); ready.then(() => { sounds.length = 0; play(); }); return; }
  if (embed) {
    // like a video on a page: it waits with a play button, and a click anywhere plays or pauses
    document.body.classList.add("embed");
    if (q.get("controls") !== "none") { // (driven by the page around it: its own button plays it)
      const big = el(`<button id="big" type="button" aria-label="Play">${ICONS.Play}</button>`);
      document.body.appendChild(big);
      big.onclick = toggle;
    }
    // the controls step back while it plays, and come forward when the pointer moves
    let idle = 0;
    const stir = () => { document.body.classList.add("active"); clearTimeout(idle); idle = setTimeout(() => document.body.classList.remove("active"), 2600); };
    addEventListener("pointermove", stir); addEventListener("pointerdown", stir); addEventListener("keydown", stir);
  }
  if (embed || bare) stage.onclick = toggle; // (a film with no controls is played and paused by a click on it)
  // a silent film opened by itself plays at once; one with sound waits for a click, unless it is set to start by
  // itself: then it starts with its sound off
  ready.then(() => { tell("ready", timing()); if (AUTO || (!embed && !hasSound && P.poster == null)) play(); else rest(); });
};
// A scene can ask for a length (`length: 15`, in seconds). The film is laid out a few times without being shown, each
// time with the pace nearer to the one that gives that length; then it is made for real. First only the rests stretch
// or shrink (the camera and the cursor keep their speed), between 0.3 and 4 times the style's pace. If that is not
// enough, the whole film plays a little quicker or slower for the rest of the way, by at most a half.
{
  const want = (window.FILM.length ?? 0) * 1000, lim = (v) => Math.max(0.3, Math.min(4, v));
  let x = 1, speed = 1;
  if (want > 0) {
    let x0 = 1, t0 = film(1, true), t1 = film((x = lim(want / t0)), true);
    for (let i = 0; i < 4 && Math.abs(t1 - want) > want * 0.01 && t1 !== t0; i++) { const next = lim(x + ((want - t1) * (x - x0)) / (t1 - t0)); x0 = x; t0 = t1; t1 = film((x = next), true); }
    if (Math.abs(t1 - want) > want * 0.01) speed = Math.max(0.67, Math.min(1.5, t1 / want));
  }
  film(x, false, speed);
}
