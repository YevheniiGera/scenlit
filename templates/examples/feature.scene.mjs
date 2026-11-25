// feature: one new thing, for a release post, the changelog or "What's new". 15 to 20 seconds, square.
//
// The shape:
//   hook      what is new, in a few words: a square frame has room for two short lines
//   context   where it lives, in one beat
//   moment    the new thing, marked, then used
//   next      out today, with a button
// Why: people scroll past release notes; one feature, shown working, in a square that fits every feed.
//
// This runs on a sample invoicing app. Keep the shape; change the pages, names and words to your app.
export default {
  format: "feature",
  shape: "square",
  kind: "news",
  async run({ card, open, select, click, label, see }) {
    await card("New:", "one-click reminders.");

    await open("/");
    await select("Status", "Past due");
    await click("Pinecrest Dental", { say: "An invoice is four days late." });

    await label({ selector: "#act", name: "Send reminder" }, "New", { sound: "sparkle" });
    await click("Send reminder", { say: "Now it takes one click.", sound: "chime", hold: 600 });
    await see("Reminder sent");

    await card("Out today,", "for everyone.", { button: "Try it" });
  },
};
