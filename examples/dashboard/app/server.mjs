// The second example app: a small customer dashboard behind a login, with data that looks like real customers'.
// It exists to try what a real app needs: a saved login, sample data, pointing, a marketing look.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const page = (name) => readFileSync(new URL(`./${name}.html`, import.meta.url));
const CUSTOMERS = [
  { name: "Hartwell & Finch Ltd", email: "billing@hartwellfinch.example", plan: "Team", mrr: 480, status: "Active", since: "2025-03-14" },
  { name: "Okonkwo Logistics", email: "ap@okonkwo-logistics.example", plan: "Business", mrr: 1250, status: "Active", since: "2024-11-02" },
  { name: "Brightside Dental", email: "office@brightsidedental.example", plan: "Starter", mrr: 90, status: "Past due", since: "2026-01-20" },
  { name: "Nordlys Studio", email: "hei@nordlys.example", plan: "Team", mrr: 480, status: "Active", since: "2025-08-09" },
  { name: "Castellane Wines", email: "compta@castellane.example", plan: "Starter", mrr: 90, status: "Cancelled", since: "2025-05-30" },
];
const signedIn = (req) => /(^|;\s*)session=ok/.test(req.headers.cookie ?? "");

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (code, type, body, headers = {}) => { res.writeHead(code, { "content-type": type, ...headers }); res.end(body); };
  if (url.pathname === "/login" && req.method === "POST") {
    let body = ""; req.on("data", (d) => (body += d));
    return req.on("end", () => {
      const f = new URLSearchParams(body);
      if (f.get("email") && f.get("password") === "demo") return send(302, "text/plain", "", { location: "/", "set-cookie": "session=ok; Path=/; HttpOnly" });
      send(302, "text/plain", "", { location: "/login?wrong=1" });
    });
  }
  if (url.pathname === "/login") return send(200, "text/html", page("login"));
  if (!signedIn(req)) return url.pathname.startsWith("/api/") ? send(401, "application/json", "{}") : send(302, "text/plain", "", { location: "/login" });
  if (url.pathname === "/api/customers") return send(200, "application/json", JSON.stringify(CUSTOMERS));
  send(200, "text/html", page("index"));
}).listen(4174, () => console.log("dashboard on http://localhost:4174"));
