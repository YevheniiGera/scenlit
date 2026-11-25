// A scene that lives next to the code it shows, written in TypeScript.
import type { Scene } from "scenlit";

const scene: Scene = {
  title: { lead: "A scene can live", key: "next to its feature." },
  end: { lead: "Found by its name:", key: "tote.scene.ts" },
  async run({ open, click, see }) {
    await open("/");
    await click("Add Canvas Tote to cart", { say: "Typed, and found anywhere in the repo." });
    await see("Added");
  },
};
export default scene;
