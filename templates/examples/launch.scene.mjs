// launch: a launch video for developers, in the "source" format. 40 to 55 seconds, wide.
//
// The shape:
//   hook      the pain as poster type on a colour field (yellow), then as lit lines on the code grid
//   name      "Meet <product>." with a stroke drawn through it
//   product   the scene's own lines beside the real app: each step lights its line, joined by the band to what it does
//   list      what it gives, as lines building on a second colour field
//   change    the problem it solves again, then the proof (a terminal, closed up on the result)
//   end       free, on the first field's colour; the end card with the one command to type
// Why: a developer trusts what they can read. The film shows the code that made it, running.
//
// This runs on a sample invoicing app. Keep the shape; change the pages, names and words to your app. The scene file
// is shown in the film: keep it short and readable, and put no secrets in it.
export default {
  format: "source", // the scene file beside the app, lines lit; words as lit lines; colour fields between
  thumbnail: false,
  brand: { accent: "#ffd23f", url: "" },
  style: { music: { file: "pulse", volume: 0.35, cuts: true } },
  async run({ words, card, open, state, click, mark, see, zoom }) {
    await words(["Your demo", "is from", "March."], { stack: true, field: "#ffd23f", motion: "letters", for: 520 });
    await words(["Your app shipped", "eleven times since."], { stack: true, motion: "letters", for: 700 });
    await words(["Making it again", "is painful."], { stack: true, motion: "bounce", for: 900 });
    await words("Meet Scenlit.", { stack: true, motion: "track", stroke: true });

    await open("/");
    await click("Kestrel Robotics", { say: "Each line is a step in your real app." });
    await mark("circle", "Overdue $2,400");
    await click("Send reminder", { sound: "success", say: "Your coding agent writes the lines." });
    await see("Reminder sent");

    await words(["A demo video.", "Screenshots.", "A step-by-step guide.", "A click-through tour."], { stack: true, field: "#0f3b2d", motion: "blur", for: 480 });
    await words(["All from", "one scene file."], { stack: true, motion: "letters" });

    await words("Your app changed?", { stack: true, motion: "type" });
    await open("component:terminal", { data: { prompt: "~/ledgerly $", command: "npx scenlit run --all", line1: "scene reminders", line2: "scene tutorial", line3: "scene launch", result: "done: 3 scenes made again" } });
    await state("done");
    await zoom({ testid: "result" }, { say: "Run it again. Every demo is new.", hold: 600 });

    await words(["Free and", "open source."], { stack: true, field: "#ffd23f", motion: "bounce", for: 900 });
    await card("Scenlit", "Demos of your real app.", { button: "npx scenlit init" });
  },
};
