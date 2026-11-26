// Motion you can change: this scene picks other built-in pieces and two of the project's own (.scenlit/motion.js).
/** @type {import("scenlit").Scene} */
export default {
  style: { motion: { title: "words", enter: "grow", cut: "wipe", click: "pulse", spotlight: "outline", exit: "drop" } },

  async run({ card, open, state, click, point, effect, see }) {
    await card("Every move is a piece", "you can swap.");
    await open("component:issue", { data: { title: "Past due filter shows no customers" } });
    await point({ testid: "issue" }, { say: "Pointing draws an outline here." });
    await click("Assign to me", { say: "A click pulses twice." });
    await state("done", { say: "And a stamp of our own lands on it." });
    await effect("stamp", { testid: "details" }, { text: "FIXED" });
    await effect("shake");
    await see("Done");
    await card("Or write your own,", "in one small file.");
  },
};
