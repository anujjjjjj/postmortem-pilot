import type { Line } from "./types";

export type Provider = "anthropic" | "openai";

const SYSTEM = `You write blameless incident postmortems from a numbered transcript.
Rules:
- Use ONLY facts in the transcript. Every claim must cite the line numbers (integers) that support it.
- Never invent timestamps, numbers, names or causes. If unknown, say so and add an open question.
- Blameless tone: describe systems and decisions, not people's faults.
- Output a single JSON object, no prose, with keys:
  title, summary{text,cites}, impact{text,cites}, root_cause{text,cites},
  contributing_factors[{text,cites}], timeline[{line,event}], action_items[{text,owner,cites}], open_questions[string]`;

export function numbered(lines: Line[]) {
  return lines.map((l) => `L${l.n}: ${l.raw}`).join("\n");
}

// Calls the provider directly from the browser: the key and transcript go to
// the model provider only, never to this app's server.
export async function callModel(provider: Provider, key: string, lines: Line[], model?: string): Promise<string> {
  const user = `Transcript:\n${numbered(lines)}`;
  if (provider === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: model || "claude-sonnet-4-5", max_tokens: 2500, system: SYSTEM, messages: [{ role: "user", content: user }] }),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    return j.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
  }
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model || "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}
