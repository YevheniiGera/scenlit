// A staged film: a piece of the app alone on the stage, sentences as scenes, a screen that builds itself, and a window
// turned in space on a lit set. `format: "launch"` brings the set; the scene does the staging.
export default {
  as: "member",
  format: "launch",
  thumbnail: false,
  async run({ card, open, words, piece, animate, point }) {
    await card("Who is behind", "on payment?");
    await open("/");
    await words("Who is behind on payment?", { highlight: "behind" });
    await piece({ testid: "mrr" }, { animate: "count", say: "Revenue, counted on its own." });
    await animate({ selector: "main" }, "build");
    await words("One table answers it.", { beside: true });
    await point({ selector: "table" }, { say: "Everything else goes out of focus." });
    await card("One table", "answers it.");
  },
};
