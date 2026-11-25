// tutorial: how to do one task, for the help center or the docs. As long as its steps, wide.
//
// The shape:
//   title     the task, in the words someone stuck would search for
//   steps     one step per action, its caption numbered and said as what to do
//   proof     a check that it worked
//   end       how short it was
// Why: someone stuck wants their step fast. Each step that says something is marked on the player's bar, and the
// guide.md made from the same scene has a picture per step. No card between the steps: the app stays on screen.
// Unlike a demo, captions here say what to do.
//
// This runs on a sample invoicing app. Keep the shape; change the pages, names and words to your app.
export default {
  format: "tutorial",
  async run({ card, open, select, label, click, see }) {
    await card("How to", "export your late payers.");
    await open("/");

    await select("Status", "Past due", { say: "1. Open Status and choose Past due." });
    await label({ selector: "#count", name: "the count" }, "Only the late ones");
    await click("Export", { say: "2. Click Export to save them as a CSV file." });
    await see("Exported");

    await card("That is it:", "two steps.");
  },
};
