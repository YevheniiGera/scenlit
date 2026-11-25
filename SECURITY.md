# Security

## Reporting a problem

Please report a security problem privately: on this repository's **Security** tab, choose **Report a
vulnerability**. Do not open a public issue for it. You will get an answer within a few days.

Useful in a report: what you did, what you expected, what happened, and the version (`npm ls scenlit`).

## What to know about what Scenlit makes

- **It runs on your machine.** Scenlit sends nothing anywhere. The one exception is a step written in plain language
  (`act`): the first time it runs, a model is asked what to click, and it is sent the page's controls and visible
  text. Values you pass as `params` are filled in locally and are not sent.
- **A film contains copies of your app's pages.** Scenlit keeps each picture as the page itself (its HTML and CSS,
  with scripts removed and typed passwords masked) so films stay sharp. Anything on a page when it is pictured is in
  the film's files, and in a web export you publish. Film sample data, not real customers: `mock`, `replace` and a
  demo account are the tools for that.
- **Saved logins are files.** `saveLogin` and `scenlit login` write a browser session to `.scenlit/sessions/`, which
  `init` keeps out of git. Treat those files like passwords.
- **Scenes are code.** A scene file runs with your permissions, like any script in your project. Read one before
  running it if you did not write it.
