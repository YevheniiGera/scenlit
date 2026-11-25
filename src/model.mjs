// The model's part: given a goal, what was done so far and what is on the screen, name the next actions.
// It never sees a param's value: it writes {card} and the runner fills it in.
// Three ways to reach a model (.scenlit/config.json, "model"):
//   claude-code  the Claude Code login on this machine (`claude -p`): no key, uses the plan
//   anthropic    the Claude API, or any API that speaks it, through the official SDK (npm i @anthropic-ai/sdk)
//   openai       any API that speaks OpenAI's chat completions: OpenAI, OpenRouter, Ollama, LM Studio, vLLM, Groq, ...
// `url`: the API's address, when it is not the provider's own. `key`: the name of the environment variable that holds
// the key (the key itself never goes in the file). `model`: which model.
//   { "provider": "openai", "url": "http://localhost:11434/v1", "model": "qwen3" }               (Ollama: no key)
//   { "provider": "openai", "url": "https://openrouter.ai/api/v1", "key": "OPENROUTER_API_KEY", "model": "…" }
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

export const PROVIDERS = ["claude-code", "anthropic", "openai"];
const KEYS = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY" };
// the key a provider uses: from the variable `key` names (else the provider's usual one). A key written in place of
// the variable's name is refused, so it is not left in a file that goes to git.
export function keyOf({ provider, key }) {
  if (key && !/^[A-Z_][A-Z0-9_]*$/.test(key)) throw new Error(`"model.key" names the environment variable that holds the key (like "OPENROUTER_API_KEY"), not the key itself. Take the key out of .scenlit/config.json`);
  const name = key ?? KEYS[provider];
  return { name, value: name ? process.env[name] : undefined };
}
const local = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|\/|$)/.test(url ?? "");

const viaClaudeCode = (prompt, model) => new Promise((ok, no) => {
  const p = spawn("claude", ["-p", "--model", model ?? "haiku"], { cwd: tmpdir(), stdio: ["pipe", "pipe", "pipe"] });
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
  p.on("error", (e) => no(new Error(e.code === "ENOENT" ? 'the "claude" command is not installed. Install Claude Code, or set "model": { "provider": "anthropic" } or { "provider": "openai", … } in .scenlit/config.json.' : e.message)));
  p.on("close", (code) => (code === 0 ? ok(out) : no(new Error(`claude exited ${code}: ${(err || out).slice(0, 300)}`))));
  p.stdin.end(prompt);
});

const clients = new Map();
let Anthropic;
async function viaAnthropic(prompt, { url, key, model = "claude-opus-5-5" }) {
  if (!Anthropic) {
    try { Anthropic = (await import("@anthropic-ai/sdk")).default; }
    catch { throw new Error('the "anthropic" provider needs the SDK: npm i -D @anthropic-ai/sdk'); }
  }
  const k = keyOf({ provider: "anthropic", key }), id = `${url ?? ""}|${k.name}`;
  if (key && !k.value) throw new Error(`no key for ${url ?? "the Claude API"}: set ${k.name}`);
  // no key named: the SDK finds its own (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile)
  if (!clients.has(id)) clients.set(id, new Anthropic({ ...(url ? { baseURL: url } : {}), ...(key ? { apiKey: k.value } : {}) }));
  const client = clients.get(id);
  // these models can decline a request; with fallbacks Anthropic's API re-runs it on another model in the same call
  // (only there: another API that speaks it may not know the beta)
  const fallback = !url && /^claude-(opus-5|sonnet-5-5|fable-5)/.test(model);
  try {
    const res = await client.beta.messages.create({
      model, max_tokens: 16000,
      ...(url ? {} : { output_config: { effort: "low" } }), // one small decision per call
      ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "refusal") throw new Error(`the model declined this step${res.stop_details?.explanation ? `: ${res.stop_details.explanation}` : ""}`);
    return res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  } catch (e) {
    const where = url ? `the API at ${url}` : "the Claude API";
    if (e instanceof Anthropic.AuthenticationError) throw new Error(`${where} did not accept the credentials (${key ? k.name : "ANTHROPIC_API_KEY, or `ant auth login`"})`);
    if (e instanceof Anthropic.RateLimitError) throw new Error(`${where} is rate limiting this key; try again in a minute`);
    if (e instanceof Anthropic.APIError) throw new Error(`${where}, ${e.status}: ${e.message}`);
    throw e;
  }
}

// OpenAI's chat completions, the shape most APIs and local model servers speak
async function viaOpenAI(prompt, { url, key, model }) {
  url ||= "https://api.openai.com/v1";
  if (!model) throw new Error('the "openai" provider needs a model: "model": { "provider": "openai", "model": "…" }');
  const k = keyOf({ provider: "openai", key });
  if (!k.value && !local(url)) throw new Error(`no key for ${url}: set ${k.name}${key ? "" : ' (or name another variable with "model.key")'}`);
  let res;
  try {
    res = await fetch(`${url.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(k.value ? { Authorization: `Bearer ${k.value}` } : {}) },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
    });
  } catch (e) { throw new Error(`could not reach ${url}: ${e.cause?.code ?? e.message}${local(url) ? " (is the model server running?)" : ""}`); }
  const body = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) throw new Error(`${url} did not accept the key in ${k.name}`);
  if (res.status === 429) throw new Error(`${url} is rate limiting this key; try again in a minute`);
  if (!res.ok) throw new Error(`${url}, ${res.status}: ${body?.error?.message ?? res.statusText}`);
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error(`${url} answered without text (${body?.choices?.[0]?.finish_reason ?? "no choices"})`);
  return text;
}

// `m`: the project's "model" setting
export async function ask(prompt, m = {}) {
  const { provider = "claude-code" } = m;
  if (provider === "anthropic") return viaAnthropic(prompt, { ...m, model: m.model ?? undefined });
  if (provider === "openai") return viaOpenAI(prompt, m);
  if (provider === "claude-code") return viaClaudeCode(prompt, m.model);
  throw new Error(`"model.provider" is ${PROVIDERS.join(", ")}; got "${provider}"`);
}

// the first {...} in the answer that parses and has the key we want
export function parseJson(out, has) {
  for (let i = out.indexOf("{"); i >= 0; i = out.indexOf("{", i + 1)) {
    for (let j = out.lastIndexOf("}"); j > i; j = out.lastIndexOf("}", j - 1)) {
      try { const a = JSON.parse(out.slice(i, j + 1)); if (a && has in a) return a; } catch { /* keep looking */ }
    }
  }
  throw new Error(`the model's answer could not be read: ${out.trim().slice(0, 200)}`);
}
// the actions in an answer: {"actions":[...]}, or one {"action":...}; "done" ends the step
export function parseActions(out) {
  let a;
  try { a = parseJson(out, "actions"); } catch { a = { actions: [parseJson(out, "action")] }; }
  return (Array.isArray(a.actions) ? a.actions : []).filter((x) => x && x.action && x.action !== "done").slice(0, 4);
}

export function promptFor({ goal, params, done, els, where, appeared = null }) {
  return `You operate a web page for a product film. Name the next actions towards the goal.

Goal: ${goal}
${params.length ? `Values written as {name} in the goal are filled in later. Use the placeholder itself as the value, exactly: ${params.map((p) => `{${p}}`).join(", ")}` : ""}
Done so far:
${done.length ? done.map((a, i) => `${i + 1}. ${a.do} "${a.loc?.name ?? a.loc?.testid ?? a.value ?? ""}"${a.do !== "press" && a.value ? ` with ${a.value}` : ""}`).join("\n") : "nothing yet"}

The page now: ${where.url}
Its text: ${where.text}
${appeared === null ? "" : `After your last actions this appeared on the page: ${appeared || "nothing new"}\n`}
What can be acted on:
${els.map((e) => `[${e.i}] ${e.role} "${e.name}"${e.shows ? ` (shows "${e.shows}")` : ""}${e.value ? ` (holds "${e.value}")` : ""}${e.options ? ` (options: ${e.options.join(" | ")})` : ""}`).join("\n")}

Reply with one line of JSON and nothing else:
{"actions":[ ... ]}
Each action is one of:
{"action":"click","el":<number>}
{"action":"fill","el":<number>,"value":"<text>"}
{"action":"select","el":<number>,"value":"<the option's label>"}
{"action":"press","value":"Enter"}
List only actions on controls in the list above, in order, at most four. Stop the list at an action that changes the page: you will be asked again with the new page.
Do only what the goal asks, each thing once. If "Done so far" and the page show the goal is already reached, reply {"actions":[]}.`;
}

export const nextActions = async (input, settings) => parseActions(await ask(promptFor(input), settings));
