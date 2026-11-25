// The "user's app": a tiny store, served as one page. Nothing here knows about the studio.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("./index.html", import.meta.url));
createServer((_, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(html); })
  .listen(4173, () => console.log("store on http://localhost:4173"));
