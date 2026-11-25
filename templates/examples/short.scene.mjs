// short: for Reels, Shorts and TikTok. About 15 seconds, vertical, the app on a phone.
//
// The shape:
//   hook      a problem in four or five words, on screen at once
//   beats     three quick steps, each with a few big words
//   payoff    the result, then how little it took
// Why: the thumb decides in a second, and most people watch without sound, so the words carry it.
//
// This runs on a sample invoicing app. Keep the shape; change the pages, names and words to your app.
export default {
  format: "short",
  async run({ card, open, select, click, see }) {
    await card("Two customers", "have not paid.");

    await open("/");
    await select("Status", "Past due", { say: "Filter: past due." });
    await click("Kestrel Robotics", { say: "Twelve days late." });
    await click("Send reminder", { say: "One tap. Reminded.", sound: "chime" });
    await see("Reminder sent");

    await card("Chased in", "ten seconds.");
  },
};
