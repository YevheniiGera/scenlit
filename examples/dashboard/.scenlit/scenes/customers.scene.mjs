// A signed-in scene on sample data: nothing from a real customer reaches the film.
// Run `node ../../bin/cli.mjs run signin` first: it saves the login this scene starts from.
/** @type {import("scenlit").Scene} */
export default {
  title: { lead: "Who is behind on payment?", key: "One filter answers it." },
  end: { lead: "Your customers,", key: "at a glance." },
  as: "member",

  async run({ open, act, select, hover, click, point, zoom, label, see, shot, mock, replace, chapter }) {
    // the app asks its own API for customers: answer with sample ones
    await mock("/api/customers", [
      { name: "Acme Inc", email: "billing@acme.example", plan: "Business", mrr: 1250, status: "Active", since: "2024-11-02" },
      { name: "Globex", email: "ap@globex.example", plan: "Team", mrr: 480, status: "Active", since: "2025-03-14" },
      { name: "Initech", email: "office@initech.example", plan: "Starter", mrr: 90, status: "Past due", since: "2026-01-20" },
      { name: "Umbrella Co", email: "hello@umbrella.example", plan: "Team", mrr: 480, status: "Past due", since: "2025-08-09" },
    ]);
    await replace({ MR: "AL" }); // the signed-in person's initials
    await open("/");
    await see("Acme Inc");

    await zoom({ testid: "mrr" }, { say: "Revenue is on top." });
    await select("Status", "Past due", { say: "One filter shows who is behind." });
    await label("Initech", "Two weeks late");
    await hover("Umbrella Co");
    await shot("filtered", { crop: { selector: "table" } });
    await chapter("Then look closer:", "one customer.");
    await act("open the customer Initech", { say: "A click opens the customer." });
    await see("Customer since");
    await point({ selector: "#panel dl" }, { say: "Everything about them, in one place." });
    await shot("customer", { crop: { selector: "#panel" } });
    await click("Close");
    await shot("overdue", { save: "docs/img/overdue.png" });
  },

  posts: [{ name: "overdue", lead: "Who is behind on payment?", key: "One filter answers it.", line: "Ledgerly shows every customer's status at a glance.", shot: "overdue" },
    { name: "pieces", lead: "The list, and the customer:", key: "side by side.", shots: ["filtered", "customer"], tilt: true, sizes: ["portrait"] },
  ],
  carousels: [{ name: "tour", slides: [
    { lead: "Who is behind on payment?", key: "One filter answers it.", shot: "overdue" },
    { lead: "Only the late ones,", key: "in one list.", shot: "filtered" },
    { lead: "Everything about a customer,", key: "in one place.", shot: "customer" },
  ] }],
};
