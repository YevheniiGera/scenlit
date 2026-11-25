// Your own motion. This file runs inside the film's page, after the built-in pieces are set up.
// define(family, name, piece) adds a piece or replaces a built-in one of the same name.
// Pick a piece in .scenlit/config.json or a scene:  "style": { "motion": { "cut": "wipe" } }
//
// A piece does not animate anything itself: it schedules changes on the film's one clock, so any moment of the
// film can be shown exactly (that is how export and the contact sheet work). Times are in milliseconds.
//   kit.start(el, prop, value)             the value the film begins with
//   kit.to(el, prop, at, dur, value, ease) change prop to value between at and at + dur
//   kit.show(el, at, dur) / kit.hide(...)  opacity to 1 / to 0
//   kit.el(html)                           make an element;  kit.stage, kit.win, kit.view: where to put it
//   kit.box(box, pad, className)           an element laid over a box of the app (it moves with the camera)
//   kit.W, kit.H                           the frame's size;  kit.hold(ms): ms scaled by the film's pace
// Props are CSS properties that can be animated: opacity, translate, scale, rotate, clipPath, filter, …
// Families and the shape of a piece in each:  npx scenlit motion list

scenlitMotion((define, kit) => {
  // A new way for one picture to give way to the next: it wipes in from the left.
  define("cut", "wipe", (layer, at, dur) => {
    kit.start(layer, "clipPath", "inset(0% 100% 0% 0%)");
    kit.to(layer, "opacity", at, 1, 1);
    kit.to(layer, "clipPath", at, Math.max(dur, 450), "inset(0% 0% 0% 0%)");
  });

  // An effect a scene can ask for:  await effect("stamp", { testid: "order" }, { text: "PAID" })
  define("effect", "stamp", ({ box, at, options }) => {
    const e = kit.box(box, 0, "stamp");
    e.textContent = options.text ?? "DONE";
    e.style.cssText += ";display:grid;place-items:center;font:800 44px/1 sans-serif;color:#d1242f;letter-spacing:.1em";
    kit.start(e, "scale", "1.6"); kit.start(e, "rotate", "-8deg");
    kit.show(e, at, 120); kit.to(e, "scale", at, 220, "1", "cubic-bezier(.3,1.6,.5,1)");
    kit.hide(e, at + kit.hold(1400), 300);
    return kit.hold(1400) + 300;   // how long the effect takes
  });
});
