// One click adds the Field Notebook to the cart, and the cart shows the total.
/** @type {import("scenlit").Scene} */
export default {
  title: { lead: "Adding to the cart", key: "takes one click." },
  end: { lead: "One click,", key: "and the total is there." },

  async run({ open, click, point, zoom, see, shot }) {
    await open("/");
    await point({ selector: ".card:last-child" }, { say: "Here is the Field Notebook, $16." });
    await click("Add Field Notebook to cart", { say: "One click adds it to the cart." });
    await see("Added");
    await point({ testid: "cart" }, { say: "The cart now counts one item." });
    await click({ testid: "cart" }, { say: "The cart opens with the notebook inside." });
    await see("Field Notebook");
    await zoom({ selector: ".row.total" }, { say: "And it shows the total: $16." });
    await see("Total");
    await shot("cart", { crop: { selector: ".panel" } });
  },

  posts: [
    { name: "one-click", lead: "One click adds it.", key: "The cart shows the total.", line: "Field Notebook, $16, in the cart.", shot: "cart" },
  ],
};
