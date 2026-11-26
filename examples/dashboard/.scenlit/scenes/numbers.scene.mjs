// What moves on the app's own screen, what a film sounds like, and how its time is set: a number counts up, the rows
// arrive, a dull part is fast-forwarded, a click chimes and the film stays on it a little longer.
export default {
  as: "member",
  thumbnail: false,
  style: { sounds: { click: "tap" } },
  async run({ card, open, animate, click, select, fast }) {
    await card("The numbers", "arrive on their own.");
    await open("/");
    await animate({ testid: "mrr" }, "count", { say: "Revenue counts up to its value.", sound: "pop" });
    await animate({ selector: "table" }, "rows", { say: "The customers arrive one by one.", sound: { name: "ding", at: "end", delay: 200, volume: 0.6 } });
    await fast(async () => { // dull to watch at full length: it plays four times quicker, with a mark on screen
      await select("Status", "Past due");
      await select("Status", "All");
    });
    await click("Export CSV", { say: "And a click can be heard.", sound: "chime", hold: 1500 });
    await card("Counted on screen,", "not pasted in.");
  },
};
