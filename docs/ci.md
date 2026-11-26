# Running Scenlit on every pull request

A scene is also a test: when a release breaks a flow, the scene that films it fails. This workflow runs every
scene on each pull request and keeps what they made.

```yaml
# .github/workflows/scenlit.yml
name: Scenlit
on: pull_request
permissions: { contents: read }
jobs:
  scenes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - uses: YevheniiGera/scenlit@v0.1.1   # the action in this repository
```

What it needs from your repository:

- **Recordings in git.** In CI Scenlit runs in strict mode: it replays `.scenlit/recordings/` and never calls a
  model, so no model key is needed. A step that is not recorded fails with a message saying so. Record on your
  machine (`npx scenlit run <scene>`) and commit.
- **A way to start the app.** `app.start` in `.scenlit/config.json` (for example `npm run dev`) and whatever the app
  needs to boot: a database, seed data (`setup` in a scene), environment variables.
- **A login without a person.** A scene that signs in and ends with `saveLogin("member")`, with the password from a
  repository secret. `run --all` runs scenes in name order, so name it to come first (`00-signin`).

The films and posts are in the run's artifact. Nothing is posted anywhere.
