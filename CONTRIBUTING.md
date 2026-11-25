# Contributing to Scenlit

Thank you for wanting to help. Scenlit is small on purpose, so the best contributions are the ones that keep it that
way: a bug fixed where it starts, a real app it now films correctly, a clearer message.

## Run it

```sh
npm install
npm test          # both example apps by replay: no model is called, nothing is spent
```

You need Node 20 or newer (22.18 for scenes written in TypeScript), Google Chrome, and ffmpeg for the tests that
export a film. It is developed on a Mac; Windows and Linux are not tested yet, and help there is very welcome.

To try a change by eye, film one of the examples and open what it made:

```sh
cd examples/dashboard
node ../../bin/cli.mjs run signin && node ../../bin/cli.mjs run customers
open .scenlit/output/index.html
```

## Before you open a pull request

- **Say what it is for.** One or two sentences: what a user could not do, or what went wrong.
- **Add or change a test** in `test/scenlit.test.mjs` when behaviour changes. Tests run the real examples.
- **Look at the film.** A change to the player or the recorder can pass every test and still look wrong. Run
  `scenlit sheet <scene>` and look at the picture it writes.
- **Keep the words plain.** Comments, messages and docs here are written in everyday language: say what something does
  and why, not what it is called inside.
- **Keep changes small.** One thing per pull request.

A new step, setting or motion piece needs its line in `README.md`, `index.d.ts` and `templates/SKILL.md` (the guide
coding agents read), and in `schema.json` when it is a setting.

## What fits, and what does not

Fits: films of more kinds of real app, looks, motion pieces, sounds, voice providers, places to export for, better
messages, Windows and Linux.

Does not fit: a hosted service, accounts, telemetry, or anything that sends a project's pictures somewhere.

## Licence

Scenlit is licensed under Apache-2.0. By contributing, you agree that your contribution is licensed under the same
terms.
