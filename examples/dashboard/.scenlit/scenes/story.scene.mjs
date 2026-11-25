// A story that starts outside the app: a pull request's checks (a component, drawn as HTML and CSS in
// .scenlit/components/pr-check.html), then the app itself. No model is needed: every step is exact.
/** @type {import("scenlit").Scene} */
export default {
  title: { lead: "Two checks are green.", key: "The third tried the app." },
  end: { lead: "Find it in the pull request,", key: "not in production." },
  as: "member",
  format: "feature",

  async run({ open, state, point, select, see, shot, mock }) {
    await open("component:pr-check");
    await shot("checks-running", { crop: { testid: "checks" } });
    await state("failed", { say: "The release check fails." });
    await point("Release check", { say: "It says what a customer would hit." });
    await shot("checks-failed", { crop: { testid: "checks" } });

    // the same thing in the app: the filter comes back empty
    await mock("/api/customers", [{ name: "Acme Inc", email: "billing@acme.example", plan: "Business", mrr: 1250, status: "Active", since: "2024-11-02" }]);
    await open("/");
    await select("Status", "Past due", { say: "In the app, the filter is empty." });
    await see("0 of 1");
  },

  posts: [{ name: "blocked", lead: "Two checks are green.", key: "The third tried the app.", shots: ["checks-running", "checks-failed"], sizes: ["portrait"] }],
};
