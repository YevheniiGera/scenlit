// The built-in third-party screens, one after another, each filled from here and moved through its states.
// No app and no model: `open("component:<name>")` works without copying anything into the project.
/** @type {import("scenlit").Scene} */
export default {
  title: { lead: "The story around your app:", key: "five screens, ready to use." },
  end: { lead: "Fill them with your words,", key: "and film them like a page." },
  style: { camera: { zoom: 1 } },

  async run({ open, state, click, point, see, shot, chapter }) {
    await open("component:pull-request", { data: { repo: "ledgerly / app", title: "Faster customer filter", failure: "The Past due filter shows no customers" } });
    await state("failed", { say: "A pull request, when a check fails." });
    await shot("pull-request", { crop: { testid: "checks" } });

    await open("component:chat", { data: { workspace: "Ledgerly", text: "1.4 is not ready: the Past due filter shows no customers." } });
    await state("message", { say: "A chat channel, when the news arrives." });
    await state("thread");
    await shot("chat", { crop: { testid: "message" } });

    await open("component:email", { data: { from: "Ledgerly", subject: "3 customers are behind on payment", body: "Initech, Umbrella Co and Hooli are past due.\nOpen the list to see who to write to first.", button: "Open the list" } });
    await click("3 customers are behind on payment", { say: "A mail, opened." });
    await see("Open the list");
    await shot("email", { crop: { testid: "mail" } });

    await chapter("And for developers:", "a terminal and a ticket.");
    await open("component:terminal", { data: { command: "npx scenlit run customers" } });
    await state("running", { say: "A terminal, running a command." });
    await state("done");
    await point({ testid: "result" });

    await open("component:issue", { data: { title: "Past due filter shows no customers", id: "APP-131" } });
    await state("assigned", { say: "A ticket, taken and closed." });
    await state("done");
    await shot("issue", { crop: { testid: "details" } });
  },

  posts: [{ name: "screens", lead: "The story around your app:", key: "ready to use.", shots: ["pull-request", "chat"], sizes: ["portrait"] }],
};
