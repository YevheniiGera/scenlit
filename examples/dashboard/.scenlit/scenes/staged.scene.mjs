// A staged film: a piece of the app alone on the stage, sentences as scenes, a screen that builds itself, and a window
// turned in space on a lit set. `format: "launch"` brings the set; the scene does the staging.
export default {
  title: { lead: "Who is behind", key: "on payment?" },
  end: { lead: "One table", key: "answers it." },
  as: "member",
  format: "launch",
  thumbnail: false,
  async run({ open, words, piece, animate, point }) {
    await open("/");
    await words("Who is behind on payment?", { highlight: "behind" });
    await piece({ testid: "mrr" }, { animate: "count", say: "Revenue, counted on its own." });
    await animate({ selector: "main" }, "build");
    await words("One table answers it.", { beside: true });
    await point({ selector: "table" }, { say: "Everything else goes out of focus." });
  },
};
