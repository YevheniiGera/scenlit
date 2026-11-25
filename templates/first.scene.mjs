// A scene: what happens in the film, written against your real app.
// Run it:  npx scenlit run first
/** @type {import("scenlit").Scene} */
export default {
  async run({ card, open, act, click, fill, see, pause, shot, point }) {
    // a card before the app opens the film, one after the last step ends it: a grey lead-in over the line that matters
    await card("A first film,", "made from the real app.");
    await open("/");
    await shot("home"); // a named picture, for the post below and for your docs

    // Steps in plain language. The first run works them out with a model and records them;
    // after that they replay with no model. `say` is the caption (and the narration, with a voice).
    //
    // await act("add the first product to the cart", { say: "Pick something." });
    // await act("go to checkout and pay with the card {card}", {
    //   params: { card: "4242 4242 4242 4242" },   // values come from here, the model never sees them
    //   say: "And pay.",
    // });
    // await point("Order total", { say: "The total is right there." });   // show something without clicking it
    // await see("Thank you");                       // a check: the scene fails if this is not on the page
    await pause(1500);
    await card("Write the next scene", "in plain language.");
  },

  // still images made from the scene's pictures: portrait, square and link sizes
  posts: [{ name: "home", lead: "A first post,", key: "made from the real app.", line: "Change these words in the scene file.", shot: "home" }],
};
