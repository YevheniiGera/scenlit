// The same things the command line does, for use from code.
export { project } from "./config.mjs";
export { runScene, loadCapture, outline } from "./scene.mjs";
export { writeFilm, writeWeb } from "./film.mjs";
export { writePosts } from "./post.mjs";
export { writeGuide } from "./guide.mjs";
export { proposeLook } from "./look.mjs";
export { recordVoice } from "./voice.mjs";
export { exportFilm } from "./export.mjs";
export { writeSite, check, frames, doctor } from "./site.mjs";
export { init } from "./init.mjs";
export { inspect, sheet, review } from "./agent.mjs";
export { writeKit } from "./kit.mjs";
export { totp } from "./totp.mjs";
export { publish, unpublish, openPortal, connect, disconnect } from "./publish.mjs";
export { add, share } from "./share.mjs";
export { find } from "./find.mjs";
export { launch } from "./browser.mjs";

// For autocomplete: `export default defineScene({ ... })`. They return what they are given.
export const defineScene = (scene) => scene;
