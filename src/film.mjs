// Writes a scene's film: one HTML page that plays (.scenlit/output/<scene>/film.html). The page holds the capture
// and the player (src/player.js); the pictures stay in .scenlit/captures and are referred to from there.
// Also the CSS that films and posts share: the brand's colours and the style's choices.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BEDS, asCues, bed, soundsOf, soundUri } from "./sounds.mjs";
import { checkMotion, ownMotion } from "./motion.mjs";
import { FILTERS } from "./vector.mjs";
export { FILTERS };
import { loadCapture } from "./scene.mjs";
import { clipsFor, mediaOf } from "./voice.mjs";

const PLAYER = fileURLToPath(new URL("./player.js", import.meta.url));
export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
export const hostOf = (scene, p) => scene.app.as || p.config.brand.url || new URL(scene.app.url).host;

const background = (brand, bg) => {
  const colors = bg.colors ?? [brand.glow, brand.background];
  if (bg.kind === "image" && bg.image) return `url("${bg.image}") center/cover no-repeat, ${brand.background}`;
  if (bg.kind === "gradient") return `linear-gradient(${bg.angle}deg, ${colors.join(", ")})`;
  if (bg.kind === "solid") return bg.colors?.[0] ?? brand.background;
  return `radial-gradient(120% 70% at 50% 108%, ${colors[0]} 0%, ${colors.at(-1)} 62%)`;
};
// a background() step: a colour, a list of colours, a picture (a path in your project, or an address), or the
// style's own shape ({ kind, colors, angle, image })
const PICTURE = /^(https?:|data:image\/)|\.(png|jpe?g|webp|gif|avif|svg)$/i;
const pictureOf = (p, f) => {
  if (/^(https?:|data:)/.test(f)) return f;
  const file = resolve(p.root, f), ext = extname(file).slice(1).toLowerCase();
  if (!existsSync(file)) throw new Error(`background("${f}"): there is no picture there (a path in your project, or an address)`);
  return `data:${ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}`};base64,${readFileSync(file).toString("base64")}`;
};
const asBackground = (p, v, base) => {
  if (typeof v === "string") return PICTURE.test(v) ? { ...base, kind: "image", image: pictureOf(p, v) } : { ...base, kind: "solid", colors: [v] };
  if (Array.isArray(v)) return { ...base, kind: v.length > 1 ? "gradient" : "solid", colors: v };
  return { ...base, ...v, ...(v.image ? { kind: v.kind ?? "image", image: pictureOf(p, v.image) } : {}) };
};
// the page around the film takes the colour at the film's edge, so a film in a wider window does not sit there as a box
const around = (brand, bg) => (bg.kind === "solid" ? bg.colors?.[0] : bg.kind === "image" || bg.kind === "gradient" ? null : bg.colors?.at(-1)) ?? brand.background;
// dark or light words, whichever reads on a colour (#rgb or #rrggbb; for anything else, `unknown`)
const ink = (c, unknown = "#111111") => { const m = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(c ?? ""); if (!m) return unknown; const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join("") : m[1], [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#111111" : "#ffffff"; };
const SHADOW = { soft: "0 40px 120px #000a, 0 0 0 1px #ffffff1f", hard: "0 18px 0 #0005, 0 0 0 2px #000", flat: "0 2px 10px #0000001a, 0 0 0 1px #00000014", none: "none" };

// the look shared by films and posts: the brand's colours, the style's background, window and captions
export function baseCss(brand, style) {
  const win = style.window, light = win.bar === "light";
  return `${brand.fontImport ? `@import url("${brand.fontImport}");` : ""}
*{box-sizing:border-box;margin:0}
html,body{height:100%}
body{background:${around(brand, style.background)};color:${brand.text};font-family:${brand.font};overflow:hidden}
.bg{position:absolute;inset:0;background:${background(brand, style.background)}}
${style.background.dots && style.background.kind !== "image" ? `.bg:after{content:"";position:absolute;inset:0;background-image:radial-gradient(#ffffff14 1px,transparent 1.5px);background-size:44px 44px;-webkit-mask-image:linear-gradient(#000,transparent 70%);mask-image:linear-gradient(#000,transparent 70%)}` : ""}
.win{position:absolute;border-radius:${win.radius}px;overflow:hidden;background:#fff;box-shadow:${SHADOW[win.shadow] ?? SHADOW.soft};transform-origin:0 0}
.bar{display:${win.bar === "none" ? "none" : "flex"};align-items:center;gap:8px;padding:0 18px;background:${light ? "#eceef1" : "#1a1d23"};color:${light ? "#5d6470" : "#9aa0aa"};font-size:15px}
.bar .hosts{display:inline-grid}.bar .hosts b{grid-area:1/1;font-weight:400}
.bar i{width:12px;height:12px;border-radius:50%;background:${light ? "#c9ced6" : "#3a3f48"};flex:none}.bar span{margin-left:14px;background:${light ? "#fff" : "#0f1115"};border-radius:8px;padding:5px 16px;white-space:nowrap}
.win.device{border-radius:var(--r);box-shadow:0 0 0 var(--edge) #0d0f13,0 0 0 calc(var(--edge) + 2px) #2f343d,0 40px 120px #000a}.win.device .bar{display:none}
${style.filter ? `.win img{filter:${style.filter}}` : ""}
.lead{color:${brand.muted}}
.key{position:relative;display:inline-block;font-family:${brand.titleFont}}
.key .u{position:absolute;left:0;bottom:-.12em;height:.07em;width:100%;background:${brand.accent};transform-origin:0 50%${style.titles.underline ? "" : ";display:none"}}
.logo{display:block;height:1.1em;width:auto}
`;
}

const filmCss = (brand, style) => {
  const cap = style.captions, t = style.titles, left = t.align === "left";
  return `
#stage{position:absolute;left:50%;top:50%;overflow:hidden}
.win{opacity:0}.view{position:relative;overflow:hidden}.shots{position:absolute;inset:0}.shots img{position:absolute;inset:0;width:100%;height:100%}
.shots iframe{position:absolute;left:0;top:0;border:0;pointer-events:none;background:#fff;transform-origin:0 0}
.spot{position:absolute;border-radius:10px;box-shadow:0 0 0 4000px rgba(7,9,13,${style.spotlight})}
.mark{position:absolute;border-radius:10px;border:3px solid var(--accent);box-shadow:0 0 0 6px #0000001f}
.tag{position:absolute;background:#111418;color:#fff;font-size:20px;line-height:1;padding:10px 14px;border-radius:8px;white-space:nowrap;box-shadow:0 6px 20px #0006}
.tag:after{content:"";position:absolute;left:50%;top:100%;margin-left:-7px;border:7px solid transparent;border-top-color:#111418}
.tag.below:after{top:auto;bottom:100%;border-top-color:transparent;border-bottom-color:#111418}
.card{position:absolute;inset:0;display:grid;place-content:center;${left ? "justify-content:start;text-align:left;padding:0 10%" : "text-align:center;padding:0 8%"};font-size:calc(var(--type) * ${t.size});line-height:1.18;letter-spacing:-.02em}
.card.over{place-content:start center;padding-top:7%;font-size:calc(var(--type) * ${t.size} * .8)} /* on a canvas: over the frames, which stay */
.card .logo{margin:0 ${left ? "0" : "auto"} .7em;height:.8em}.card .w{display:inline-block;white-space:pre}
.card .url{margin-top:.55em;font-size:.36em;letter-spacing:0;opacity:.6}
.card .btn{display:inline-block;margin-top:1.1em;font-family:${brand.font};font-size:.34em;letter-spacing:0;font-weight:600;background:${brand.accent};color:#111;border-radius:999px;padding:.7em 1.5em}
.cap{position:absolute;left:6%;right:6%;${cap.position === "top" ? "top:var(--capy)" : "bottom:var(--capy)"};text-align:center;font-size:calc(var(--cap) * ${cap.size});line-height:1.35}
.rig{position:absolute;inset:0}
.over{position:absolute;max-width:none}
.me{position:absolute;object-fit:cover;border-radius:18px;background:#000;box-shadow:0 0 0 3px #ffffff24,0 18px 50px -10px #000a}.me.round{border-radius:50%}
.piece{position:absolute;overflow:hidden;border-radius:18px;background:#fff;box-shadow:${SHADOW.soft}}
.piece iframe,.piece img{position:absolute;border:0;max-width:none;transform-origin:0 0;pointer-events:none}
.say{position:absolute;inset:0;display:grid;place-content:center;text-align:center;padding:0 10%;font-family:${brand.titleFont};font-size:calc(var(--type) * 1.2);font-weight:700;line-height:1.08;letter-spacing:-.03em}
.say.beside{place-content:center start;text-align:left;padding:0 0 0 6%;font-size:calc(var(--type) * .82)}
.say .w{display:inline-block;white-space:pre;position:relative;isolation:isolate}.say .hi{color:var(--accent)}
.say .l{display:inline-block;white-space:pre}.say .big{font-size:1.9em;line-height:.95}
.say .sw{position:absolute;inset:.02em -.1em -.02em;background:var(--accent);z-index:-1;transform-origin:0 50%;border-radius:.06em}
.say .stamp{display:inline-block;margin-left:.25em;padding:.08em .32em;background:var(--accent);color:var(--accent-ink);font-family:${brand.font};font-weight:700;font-size:.5em;letter-spacing:0;rotate:-6deg;vertical-align:middle;border-radius:.14em}
.say .line{position:relative}
.field{position:absolute;inset:0;z-index:40}.say{z-index:41}.say.stack{display:block;padding:0;text-align:left}.say.stack .line{position:absolute;white-space:nowrap}
.say.stack .num{position:absolute;font-family:var(--mono);font-weight:400;font-size:calc(var(--type) * .36);letter-spacing:0;color:${brand.muted}}
.say.stack .srule{position:absolute;top:0;bottom:0;width:1px;background:color-mix(in srgb,${brand.muted} 30%,transparent)}
.say.stack .sband{position:absolute;left:0;right:0;top:0;background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 17%,transparent),color-mix(in srgb,var(--accent) 7%,transparent) 55%,transparent)}
.say.stack .sband:before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--accent);box-shadow:0 0 40px 6px color-mix(in srgb,var(--accent) 45%,transparent)}
.say.poster{font-weight:800;letter-spacing:-.055em}.say .stroke,.mk.across{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.say .stroke path,.mk path{fill:none;stroke:var(--accent);stroke-width:5px;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1 1}
.mk{position:absolute;overflow:visible;pointer-events:none;z-index:5}
.src{position:absolute;inset:0;overflow:hidden}.src .code{position:absolute;left:0;top:0;font-family:var(--mono);color:${brand.text};white-space:pre;-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent)}
.src .cl{display:flex}.src .cl b{flex:none;width:3.6em;padding-right:1.3em;text-align:right;font-weight:400;color:${brand.muted};opacity:.7}.src .cl span{overflow:hidden}
.src i{font-style:normal}.src .k{color:${brand.muted}}.src .s{color:#b6e08c}.src .f{color:var(--accent)}.src .c{color:${brand.muted};opacity:.6}
.src .lit{position:absolute;left:0;right:0;top:0;background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 17%,transparent),color-mix(in srgb,var(--accent) 7%,transparent) 55%,transparent)}
.lit.across{position:absolute;right:0;top:0;z-index:4;pointer-events:none;background:color-mix(in srgb,var(--accent) 13%,transparent);border-top:1px solid color-mix(in srgb,var(--accent) 35%,transparent);border-bottom:1px solid color-mix(in srgb,var(--accent) 35%,transparent);mix-blend-mode:multiply}
.srcmode .cap{left:0;right:auto;width:690px;text-align:left}.srcmode .cap > span{display:inline-block;font-family:${brand.titleFont};font-weight:600;letter-spacing:-.015em;color:${brand.text};background:linear-gradient(90deg,color-mix(in srgb,${brand.background} 96%,transparent),color-mix(in srgb,${brand.background} 88%,transparent));box-shadow:inset 5px 0 0 var(--accent);border-radius:0;padding:.42em .9em .42em 1.15em;text-shadow:none}
.srcmode .card{justify-content:start;text-align:left;padding:0 0 0 263px}.srcmode .card .lead{font-family:var(--mono);font-size:.3em;letter-spacing:0;margin-bottom:.6em}
.srcmode .card .key{font-size:1.45em;font-weight:800;letter-spacing:-.045em}.srcmode .card .key .u{display:none}
.srcmode .card .btn{display:block;width:fit-content;position:relative;margin-top:.75em;padding:.4em 0;font-family:var(--mono);font-weight:400;font-size:.4em;letter-spacing:0;color:${brand.text};background:none;border-radius:0}
.srcmode .card .btn:before{content:"";position:absolute;top:0;bottom:0;left:-263px;width:1920px;z-index:-1;background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 18%,transparent),color-mix(in srgb,var(--accent) 6%,transparent) 45%,transparent 75%);box-shadow:inset 6px 0 0 var(--accent)}
.src .lit:before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--accent);box-shadow:0 0 40px 6px color-mix(in srgb,var(--accent) 45%,transparent)}.mk.across{z-index:6}.mk:not(.across) path{stroke-width:7px}.say .track{white-space:nowrap}
.soft{position:absolute;backdrop-filter:blur(7px) brightness(.72);-webkit-backdrop-filter:blur(7px) brightness(.72)}
.light{position:absolute;inset:0;background:radial-gradient(58% 54% at 50% 46%,color-mix(in srgb,var(--light) 34%,transparent),transparent 72%)}
.vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(78% 78% at 50% 50%,transparent 52%,#000 135%)}
.grain{position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>")}")}
.card.sting .logo{height:1.7em;margin-bottom:.45em}
.cap .w{display:inline-block;white-space:pre}
.ff{position:absolute;right:3.2%;top:5.5%;font-size:calc(var(--cap) * .8);line-height:1;font-variant-numeric:tabular-nums;background:#07090dd9;color:#fff;padding:.4em .75em;border-radius:999px}
.cap > span{${cap.look === "bold" ? `font-family:${brand.font};font-weight:800;font-size:1.9em;line-height:1.08;letter-spacing:-.025em;color:#fff;text-shadow:0 .06em 0 #000,0 0 .5em #000c` : cap.look === "plain" ? `color:${brand.text};text-shadow:0 2px 14px ${brand.background},0 0 3px ${brand.background}` : "background:#07090dd9;color:#fff;padding:.25em .65em;border-radius:12px;-webkit-box-decoration-break:clone;box-decoration-break:clone"}}
#cur{position:absolute;left:0;top:0;width:${style.cursor.size}px;height:${style.cursor.size}px;transform-origin:0 0;filter:drop-shadow(0 4px 10px #0008)}
#cur.touch{width:46px;height:46px;margin:-23px;border-radius:50%;background:#ffffffb0;border:2px solid #fff;transform-origin:50% 50%;filter:drop-shadow(0 2px 8px #0006)}
/* a canvas: the places of the film as frames side by side, each named over it; people's cursors, named; a selection */
.board{position:absolute;transform-origin:0 0}.strip{position:absolute;left:0;top:0}.frame{position:absolute;top:0}
.frame b{position:absolute;left:2px;bottom:100%;margin-bottom:14px;font-size:22px;font-weight:500;line-height:1;opacity:.55;white-space:nowrap}
.frame .clip{position:absolute;inset:0;overflow:hidden;border-radius:${style.window.radius}px;background:#fff;box-shadow:${SHADOW[style.window.shadow] ?? SHADOW.soft}}.frame img{position:absolute;inset:0;width:100%;height:100%}
.crowd{position:absolute;inset:0}.who{position:absolute;left:0;top:0;width:${Math.round(style.cursor.size * 0.8)}px;height:${Math.round(style.cursor.size * 0.8)}px;transform-origin:0 0}
#cur.who{width:${Math.round(style.cursor.size * 0.8)}px;height:${Math.round(style.cursor.size * 0.8)}px;filter:drop-shadow(0 2px 6px #0004)}
.who svg{display:block;width:100%;height:100%;overflow:visible}.who span{position:absolute;left:68%;top:82%;padding:7px 12px 8px;border-radius:4px 12px 12px 12px;color:#fff;font:600 19px/1 ${brand.font};white-space:nowrap;box-shadow:0 2px 8px #0002}
.sel{--sel:${style.select ?? "#0d99ff"};border:2px solid var(--sel)}.sel i{position:absolute;width:11px;height:11px;background:#fff;border:2px solid var(--sel)}
.sel i:nth-child(1){left:-7px;top:-7px}.sel i:nth-child(2){right:-7px;top:-7px}.sel i:nth-child(3){left:-7px;bottom:-7px}.sel i:nth-child(4){right:-7px;bottom:-7px}
.sel em{position:absolute;left:50%;top:100%;margin-top:10px;transform:translateX(-50%);padding:5px 8px;border-radius:5px;background:var(--sel);color:#fff;font:600 16px/1 ${brand.font};font-style:normal;white-space:nowrap}
.ring{position:absolute;width:90px;height:90px;margin:-45px;border-radius:50%;border:3px solid var(--accent)}
/* the player: icon buttons under a slim bar that is cut where the film's marks are. Under the film when the film is
   opened by itself; over it, stepping back while it plays, when it is on a page. --ink: its colour on what is behind it */
#bar{position:fixed;left:0;right:0;bottom:0;height:66px;box-sizing:border-box;padding:6px 14px 0;color:var(--ink);font:500 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none}
#bar .row{display:flex;align-items:center;justify-content:space-between;height:40px;margin-top:2px}
#bar .side{display:flex;align-items:center;gap:2px;min-width:0}
#bar button{display:grid;place-items:center;flex:none;width:36px;height:36px;padding:0;border:0;border-radius:50%;background:none;color:inherit;font:inherit;cursor:pointer;transition:background .15s,transform .1s}
#bar button:hover{background:color-mix(in srgb,currentColor 14%,transparent)}
#bar button:active{transform:scale(.92)}
#bar svg,#big svg{display:block;width:22px;height:22px;fill:currentColor}
#bar #pp svg{width:26px;height:26px}
#time{margin:0 10px 0 6px;white-space:nowrap;font-variant-numeric:tabular-nums;letter-spacing:.01em}#time b{font-weight:500}#time i{font-style:normal;opacity:.55}
#bar #rate{width:auto;min-width:36px;padding:0 10px;border-radius:18px;font-weight:600;font-variant-numeric:tabular-nums}
#cc{position:relative}#cc:after{content:"";position:absolute;left:9px;right:9px;bottom:3px;height:2px;border-radius:2px;background:var(--player);transform:scaleX(0);transition:transform .15s}
#cc[aria-pressed="true"]:after{transform:scaleX(1)}#cc[aria-pressed="false"] svg{opacity:.6}
/* the bar: one piece for each place of the film, filling as the film goes through it */
#track{position:relative;display:block;height:16px;cursor:pointer;touch-action:none}
#track .segs{position:absolute;left:0;right:0;top:50%;height:4px;margin-top:-2px;display:flex;gap:3px;transition:height .12s,margin-top .12s}
#track:hover .segs,#track:focus-within .segs{height:6px;margin-top:-3px}
#track .seg{position:relative;min-width:1px;overflow:hidden;border-radius:3px;background:color-mix(in srgb,currentColor 26%,transparent)}
#track .seg i{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--player)}
#track .knob{position:absolute;top:50%;left:0;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--player);box-shadow:0 1px 5px #0007;transform:scale(0);transition:transform .12s;pointer-events:none}
#track:hover .knob,#track:focus-within .knob{transform:scale(1)}
#scrub{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;pointer-events:none;appearance:none;-webkit-appearance:none}
#track:has(#scrub:focus-visible) .segs{outline:2px solid var(--player);outline-offset:4px}
#tip{position:absolute;bottom:calc(100% + 6px);transform:translateX(-50%);max-width:min(60vw,360px);overflow:hidden;text-overflow:ellipsis;white-space:pre;padding:6px 10px;border-radius:9px;background:#14161ce6;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid #ffffff1f;color:#f2f1ee;font:500 12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;font-variant-numeric:tabular-nums;pointer-events:none}
#tip[hidden]{display:none}
/* sound: the slider opens beside the button when the pointer is there */
#sound{display:flex;align-items:center}
#vol{appearance:none;-webkit-appearance:none;width:0;height:20px;margin:0;padding:0;background:none;color:inherit;opacity:0;cursor:pointer;transition:width .2s,opacity .2s,margin .2s;--v:100%}
#sound:hover #vol,#sound:focus-within #vol{width:68px;opacity:1;margin:0 8px 0 2px}
#vol::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:linear-gradient(to right,currentColor var(--v),color-mix(in srgb,currentColor 30%,transparent) var(--v))}
#vol::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;margin-top:-4.5px;border-radius:50%;background:currentColor}
#vol::-moz-range-track{height:3px;border-radius:2px;background:color-mix(in srgb,currentColor 30%,transparent)}#vol::-moz-range-progress{height:3px;border-radius:2px;background:currentColor}
#vol::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:currentColor}
/* the places of the film, as a list */
#chapters{position:fixed;right:14px;bottom:72px;max-width:min(86vw,420px);max-height:min(60vh,420px);overflow:auto;display:flex;flex-direction:column;gap:1px;padding:6px;border-radius:14px;background:#14161cd9;-webkit-backdrop-filter:blur(20px) saturate(1.5);backdrop-filter:blur(20px) saturate(1.5);border:1px solid #ffffff1f;box-shadow:0 18px 50px #0008;color:#f2f1ee;font:500 13px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;z-index:5}
#chapters[hidden]{display:none}
#chapters button{display:flex;align-items:baseline;gap:12px;flex:none;padding:9px 12px;border:0;border-radius:9px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
#chapters button i{flex:none;min-width:2.4em;font-style:normal;font-variant-numeric:tabular-nums;opacity:.55}
#chapters button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#chapters button:hover,#chapters button:focus-visible{background:#ffffff17}
#chapters button[aria-current="true"] i{color:var(--player);opacity:1}
#bar button:focus-visible,#chapters button:focus-visible,#big:focus-visible,.spot:focus-visible,.cta:focus-visible,.hot:focus-visible{outline:2px solid var(--player);outline-offset:2px}
/* on a page: the controls lie over the film, on a soft shade, and step back while it plays */
body.embed #bar{height:auto;padding:28px 14px 6px;color:#fff;background:linear-gradient(transparent,#0008 60%,#000b);opacity:0;transform:translateY(4px);transition:opacity .25s,transform .25s}
body.embed.paused #bar,body.embed.active #bar,body.embed #bar:has(:focus-visible){opacity:1;transform:none}
body.embed:not(.active):not(.paused) #stage{cursor:none}
body.embed #chapters{bottom:80px}
#big{position:fixed;inset:0;margin:auto;width:84px;height:84px;padding:0;display:none;place-items:center;border-radius:50%;border:1px solid #ffffff2e;background:#0b0d1199;-webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);color:#fff;cursor:pointer;transition:transform .15s,background .15s}
#big svg{width:36px;height:36px;margin-left:3px}
#big:hover{transform:scale(1.06);background:#0b0d11c0}
body.embed.rest #big{display:grid} /* before it is first played; paused later, nothing covers the picture */
#bar{pointer-events:none}#bar .row>*,#track{pointer-events:auto} /* only the controls take clicks, not the shade around them */
body.embed.asking:not(.active) #bar{opacity:0} /* while the film waits for the viewer's click, the controls stay out of its way */
body.embed.paused .cap.low,body.embed.active .cap.low{transform:translateY(calc(-1 * var(--lift,0px)))}.cap{transition:transform .25s} /* captions step up, clear of the controls */
@media (max-width:520px){#bar{padding-left:8px;padding-right:8px}#time i{display:none}#sound #vol{display:none}#big{width:64px;height:64px}#big svg{width:28px;height:28px}}
@media (prefers-reduced-motion:reduce){#bar,#bar *,#big{transition:none}}
.nocap .cap{visibility:hidden}
#poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
body.bare #stage{cursor:pointer}
/* what the viewer can click inside the film: a place the film waits on, something of the app that is a link, a button */
#stage *{pointer-events:none}#stage .spot.on,#stage a.hot,#stage a.cta{pointer-events:auto} /* nothing else in a film takes a click: a card that is not on screen would swallow it */
.spot{position:absolute;padding:0;border:3px solid var(--player);border-radius:10px;background:none;cursor:pointer;opacity:0}
.spot.on{opacity:1;animation:spot 1.4s ease-in-out infinite}
@keyframes spot{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--player) 60%,transparent)}50%{box-shadow:0 0 0 16px transparent}}
.hot{position:absolute;border-radius:8px;box-shadow:0 0 0 2px var(--player),0 0 0 7px color-mix(in srgb,var(--player) 25%,transparent);cursor:pointer}
.cta-at{position:absolute;inset:0;display:flex}
.cta{font:600 30px/1 ${brand.font};color:var(--player-ink);background:var(--player);padding:20px 36px;border-radius:999px;text-decoration:none;box-shadow:0 14px 40px #0006;cursor:pointer}
body.asking #big{display:none}
@media (prefers-reduced-motion:reduce){.spot.on{animation:none}}
`;
};

// which pictures share a page, as numbers: the film needs no more, and an address (of a file on this computer, or of
// an app's own pages) has no place in a film that is published
const placesOf = (pages = {}) => { const ids = new Map(); return Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, ids.get(v) ?? (ids.set(v, ids.size + 1), ids.size)])); };

// a capture's pictures, addressed from .scenlit/captures: "<scene>/<file>"
const within = (name, capture) => {
  const at = (f) => `${name}/${f}`;
  return {
    ...capture, start: at(capture.start), vector: Object.fromEntries(Object.entries(capture.vector ?? {}).map(([k, v]) => [at(k), at(v)])),
    hosts: Object.fromEntries(Object.entries(capture.hosts ?? {}).map(([k, v]) => [at(k), v])),
    pages: Object.fromEntries(Object.entries(capture.pages ?? {}).map(([k, v]) => [at(k), v])),
    names: Object.fromEntries(Object.entries(capture.names ?? {}).map(([k, v]) => [at(k), v])),
    steps: capture.steps.map((s) => ({ ...s, ...(s.overlay ? { overlay: { ...s.overlay, file: at(s.overlay.file) } } : {}), actions: s.actions.map((a) => ({ ...a, before: at(a.before), after: at(a.after), ...(a.motion ? { motion: a.motion.map((m) => ({ ...m, file: at(m.file) })) } : {}) })) })),
  };
};

// the music a film plays, and how: the style's (a scene's, a format's or the project's). A built-in bed is written out
// once, next to the films, so the page and the export can both read it; it knows its own beat.
export function musicOf(p, style) {
  const m = style.music, bed1 = BEDS.includes(m.file);
  if (!m.file) return null;
  const file = bed1 ? join(p.output, "_music", `${m.file}.wav`) : resolve(p.root, m.file);
  if (bed1 && !existsSync(file)) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bed(m.file)); }
  if (!existsSync(file)) throw new Error(`no music at "${m.file}". Give a file in your project, or a built-in bed: ${BEDS.join(", ")}`);
  return { ...m, file, bpm: m.bpm ?? (bed1 ? 100 : null) };
}

// the presenter: a recording of a person, shown in a corner in step with the film. `presenter: "me.mp4"`, or
// { file, at: "bottom right", size: 0.24 (of the frame's height), round: true, start: 0 (seconds into it), volume: 1,
// sound: true }. Its sound is the film's narration; reading its length needs ffmpeg.
const CORNERS = ["bottom left", "bottom right", "left top", "right top"];
export function presenterOf(p, scene) {
  const it = typeof scene.presenter === "string" ? { file: scene.presenter } : scene.presenter;
  if (!it?.file) return null;
  const file = resolve(p.root, it.file), at = (it.at ?? "bottom right").trim().split(/\s+/).sort().join(" ");
  if (!existsSync(file)) throw new Error(`no presenter recording at "${it.file}" (a path in your project)`);
  if (!CORNERS.includes(at)) throw new Error(`presenter: at is a corner (bottom right, bottom left, top right, top left); got "${it.at}"`);
  let media = { ms: null, sound: true };
  try { media = mediaOf(file); } catch { /* without ffprobe its length is not known: it plays to its end */ }
  return { file, at, size: it.size ?? 0.24, round: it.round !== false, start: it.start ?? 0, volume: it.volume ?? 1, ms: media.ms, sound: media.sound && it.sound !== false };
}

// `to`: where the page goes and how it reaches its files. By default next to the scene's other output, reading
// pictures from .scenlit/captures; the web export writes a folder that holds everything it needs.
function page(p, name, def, capture, clips, to = {}) {
  const out = to.out ?? join(p.output, name), style = p.style(def, capture.look ?? def.look), brand = style.brand;
  mkdirSync(out, { recursive: true });
  for (const key of ["title", "end"]) if (def[key] && !def[key].none && (!def[key].lead || !def[key].key)) throw new Error(`"${name}": ${key} needs two lines, { lead, key }`);
  // no opening card: the film starts in the app; no end card: it ends on its last picture
  if (def.title?.none) style.titles = { ...style.titles, show: false };
  if (def.end?.none) style.end = { ...style.end, show: false };
  checkMotion(p, style, capture);
  const cues = asCues(def.cues), sfx = Object.fromEntries(soundsOf(style, capture, cues).map((n) => [n, soundUri(p, n)])); // throws for a sound that is not there
  const its = musicOf(p, style), music = its ? { ...its, file: to.music ?? relative(out, its.file) } : null;
  const me = presenterOf(p, def), presenter = me ? { ...me, file: to.presenter ?? relative(out, me.file) } : null;
  const data = {
    title: def.title, end: { url: brand.url, ...def.end }, host: def.host, shape: def.shape ?? "wide", sfx, cues, length: def.length > 0 ? +def.length : null,
    view: capture.view, start: capture.start, steps: capture.steps.map((s) => (s.kind === "background" ? { ...s, css: background(brand, asBackground(p, s.background, style.background)) } : s)), vector: capture.vector ?? {}, hosts: capture.hosts ?? {}, pages: placesOf(capture.pages), names: capture.names ?? {}, clips,
    style: { player: style.player, window: style.window, cursor: style.cursor, camera: style.camera, captions: style.captions, titles: style.titles, end: style.end, pace: style.pace, logo: style.logo, motion: style.motion, sounds: style.sounds, finish: style.finish, board: style.board, select: style.select, source: !!style.source },
    ...(style.source && capture.source ? { source: capture.source } : {}), // the scene's own lines go into the film only when it shows them
    rel: to.rel ?? "../../captures", voiceRel: to.voiceRel ?? "../../voice", music, presenter, embed: !!to.embed,
  };
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(`${def.title.lead} ${def.title.key}`.trim())}</title>
<style>${baseCss(brand, style)}
:root{--accent:${brand.accent};--accent-ink:${ink(brand.accent)};--muted:${brand.muted};--player:${style.player.accent ?? brand.accent};--player-ink:${ink(style.player.accent ?? brand.accent)};--ink:${ink(around(brand, style.background), "#ffffff")};--mono:${style.source?.font ?? '"Fragment Mono", ui-monospace, "SF Mono", Menlo, monospace'}}${filmCss(brand, style)}
/* your own CSS (.scenlit/style.css) */
${style.css.replace(/<\/style/gi, "<\\/style")}</style></head><body>${FILTERS}
<script>window.FILM=${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
<script>window.__motions = []; window.scenlitMotion = (add) => window.__motions.push(add);</script>
<script>/* your own motion (.scenlit/motion.js) */
${ownMotion(p).replace(/<\/script/gi, "<\\/script")}</script>
<script>${readFileSync(PLAYER, "utf8")}</script>
</body></html>`;
  const file = join(out, to.fileName ?? "film.html");
  writeFileSync(file, html);
  return file;
}

// a film's words in another language (scenlit translate writes the file, and it can be edited freely)
export const translationFile = (p, name, lang) => join(p.dir, "translations", `${name}.${lang}.json`);
export const loadTranslation = (p, name, lang) => { const f = translationFile(p, name, lang); if (!existsSync(f)) throw new Error(`"${name}" is not translated to ${lang} yet: scenlit translate ${name} --to ${lang}`); return JSON.parse(readFileSync(f, "utf8")); };
// a scene and its recording as they are, or with their words in that language
const inLang = (p, scene, lang) => {
  const capture = loadCapture(p, scene.name);
  if (!lang) return { def: scene, capture };
  const map = loadTranslation(p, scene.name, lang), tr = (w) => map[w] ?? w;
  return { capture: translated(capture, map), def: { ...scene, title: { ...scene.title, lead: tr(scene.title.lead), key: tr(scene.title.key) }, end: { ...scene.end, lead: tr(scene.end.lead), key: tr(scene.end.key) } } };
};

// one scene's film
export function writeFilm(p, scene, { lang = null } = {}) {
  const { def, capture } = inLang(p, scene, lang);
  return page(p, scene.name, { ...def, host: hostOf(scene, p) }, within(scene.name, capture), clipsFor(p, capture, lang), { fileName: lang ? `film.${lang}.html` : "film.html" });
}

// The film as a folder you can put on any web host and embed like a video: the player, and every file it needs.
// -> .scenlit/output/<scene>/export/web/  (index.html, embed.html, captures/, voice/)
export function writeWeb(p, scene, { lang = null } = {}) {
  const { def, capture } = inLang(p, scene, lang);
  const out = join(p.output, scene.name, "export", "web"), c = within(scene.name, capture), clips = clipsFor(p, capture, lang);
  const put = (from, to) => { if (existsSync(from)) { mkdirSync(dirname(join(out, to)), { recursive: true }); cpSync(from, join(out, to), { recursive: true }); } };
  // only what this film shows: its pictures, their frozen pages and what those need, the frames of motion, the narration
  const used = new Set([c.start, ...Object.values(c.vector), ...c.steps.filter((s) => s.overlay).map((s) => s.overlay.file), ...c.steps.flatMap((s) => s.actions.flatMap((a) => [a.before, a.after, ...(a.motion ?? []).map((m) => m.file)]))]);
  for (const f of used) put(join(p.captures, f), join("captures", f));
  put(join(p.captures, scene.name, "assets"), join("captures", scene.name, "assets"));
  for (const clip of Object.values(clips)) put(join(p.voice, clip.file), join("voice", clip.file));
  let music = null;
  const its = musicOf(p, p.style(def, capture.look ?? def.look));
  if (its) { music = `music${extname(its.file)}`; put(its.file, music); }
  const me = presenterOf(p, def), presenter = me ? `presenter${extname(me.file)}` : null;
  if (me) put(me.file, presenter);
  const file = page(p, scene.name, { ...def, host: hostOf(scene, p) }, c, clips, { out, fileName: "index.html", rel: "captures", voiceRel: "voice", music, presenter, embed: true });
  writeFileSync(join(out, "embed.html"), `<!-- Put this folder on your site, then paste this where the film should be. Change the address to where the folder is. -->
<iframe src="https://your-site.example/films/${scene.name}/index.html" title="${esc(`${def.title.lead} ${def.title.key}`.trim())}"
  style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px" allow="fullscreen; autoplay" loading="lazy"></iframe>
`);
  return { dir: out, file, files: used.size + Object.keys(clips).length };
}
export const translated = (capture, map) => {
  const tr = (w) => (w ? map[w] ?? w : w);
  return { ...capture, steps: capture.steps.map((s) => ({ ...s, say: tr(s.say), ...(s.speak ? { speak: tr(s.speak) } : {}), ...(s.card ? { card: { lead: tr(s.card.lead), key: tr(s.card.key) } } : {}), actions: s.actions.map((a) => (a.text ? { ...a, text: tr(a.text) } : a)) })) };
};

// the frame's shapes; and a film opened in a page of that shape, still and ready, to be photographed at any moment
export const SIZE = { wide: [1920, 1080], square: [1080, 1080], vertical: [1080, 1920] };
export async function openFilm(browser, film, shape = "wide", scale = 1) {
  if (!SIZE[shape]) throw new Error(`unknown shape "${shape}" (${Object.keys(SIZE).join(", ")})`);
  const page = await browser.newPage({ viewport: { width: SIZE[shape][0], height: SIZE[shape][1] }, deviceScaleFactor: scale }); // scale 2: twice the pixels
  await page.goto(`file://${film}?export&shape=${shape}`);
  await page.evaluate(() => window.__film.ready());
  return page;
}
export const filmFile = (p, name, lang = null) => { const f = join(p.output, name, lang ? `film.${lang}.html` : "film.html"); if (!existsSync(f)) throw new Error(`"${name}" has no film yet: scenlit run ${name}`); return f; };
