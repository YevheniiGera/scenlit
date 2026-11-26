// A scene that lives next to the code it shows, written in TypeScript.
import type { Scene } from "scenlit";

const scene: Scene = {
  async run({ card, open, click, see }) {
    await card("A scene can live", "next to its feature.");
    await open("/");
    await click("Add Canvas Tote to cart", { say: "Typed, and found anywhere in the repo." });
    await see("Added");
    await card("Found by its name:", "tote.scene.ts");
  },
};
export default scene;
