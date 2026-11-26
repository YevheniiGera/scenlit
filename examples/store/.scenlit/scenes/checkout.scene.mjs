// The example scene: a customer buys two things in the demo store (example/app).
// Run it from the example folder:  node ../../bin/cli.mjs run checkout
/** @type {import("scenlit").Scene} */
export default {
  async run({ card, open, act, see, shot }) {
    await card("Every test is green.", "Does the checkout work?");
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
    await card("Made from one scene file", "and the real app.");
  },

  posts: [
    { name: "question", lead: "Your checks are green.", key: "Is the checkout?", line: "Test each release the way a customer would.", shot: "checkout" },
    { name: "paid", lead: "The order went through.", key: "We watched it happen.", line: "Every release, tested like a real customer.", shot: "paid" },
  ],
};
