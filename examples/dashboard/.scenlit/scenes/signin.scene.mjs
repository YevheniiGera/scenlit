// Signs in and keeps the login for the other scenes (`as: "member"`), so nobody has to sign in by hand.
// The password comes from the environment in a real project; this demo app accepts "demo".
/** @type {import("scenlit").Scene} */
export default {
  async run({ card, open, fill, click, see, saveLogin }) {
    await card("Sign in once,", "every scene starts signed in.");
    await open("/login");
    await fill("Email", "maya@ledgerly.example", { say: "Sign in the way a person would." });
    await fill("Password", process.env.DEMO_PASSWORD ?? "demo");
    await click("Sign in");
    await see("Customers");
    await saveLogin("member");
    await card("The login is saved", "and kept out of git.");
  },
};
