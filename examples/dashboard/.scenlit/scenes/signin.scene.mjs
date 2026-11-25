// Signs in and keeps the login for the other scenes (`as: "member"`), so nobody has to sign in by hand.
// The password comes from the environment in a real project; this demo app accepts "demo".
/** @type {import("scenlit").Scene} */
export default {
  title: { lead: "Sign in once,", key: "every scene starts signed in." },
  end: { lead: "The login is saved", key: "and kept out of git." },

  async run({ open, fill, click, see, saveLogin }) {
    await open("/login");
    await fill("Email", "maya@ledgerly.example", { say: "Sign in the way a person would." });
    await fill("Password", process.env.DEMO_PASSWORD ?? "demo");
    await click("Sign in");
    await see("Customers");
    await saveLogin("member");
  },
};
