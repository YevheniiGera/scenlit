## Videos, tutorials and screenshots (Scenlit)

This project makes product videos, step-by-step guides and screenshots of the app with Scenlit. Each one comes from
a scene: a file in `.scenlit/scenes/<name>.scene.mjs` that drives the real, running app.

Before writing or changing a scene, run `npx scenlit guide` and follow it. Then:

- `npx scenlit inspect <path>`: what is on a page. Use the exact names it shows in the steps.
- `npx scenlit run <scene>`: runs it on the app and writes the video, guide and screenshots to `.scenlit/output/`.
- `npx scenlit sheet <scene>`: the video as one picture, to check every caption matches its screen.
