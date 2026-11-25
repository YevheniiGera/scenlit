// The example scene: a customer buys two things in the demo store (example/app).
// Run it from the example folder:  node ../../bin/cli.mjs run checkout
/** @type {import("scenlit").Scene} */
export default {
  title: { lead: "Every test is green.", key: "Does the checkout work?" },
  end: { lead: "Made from one scene file", key: "and the real app." },

  async run({ open, act, see, shot }) {
    await open("/");
    await act("add the Trail Mug and the Canvas Tote to the cart", { say: "A customer picks two things." });
    await act("open the cart and go to checkout", { say: "Then goes to checkout." });
    await shot("checkout");
    await act("fill in the email {email} and the card number {card}, then pay", {
      params: { email: "ada@example.test", card: "4242 4242 4242 4242" },
      say: "And pays with a card.",
    });
    await see("Thank you for your order");
    await shot("paid", { crop: { testid: "order" } });
  },

  posts: [
    { name: "question", lead: "Your checks are green.", key: "Is the checkout?", line: "Test each release the way a customer would.", shot: "checkout" },
    { name: "paid", lead: "The order went through.", key: "We watched it happen.", line: "Every release, tested like a real customer.", shot: "paid" },
  ],
};
