import { heuristicDraft } from "./heuristic";
import type { Cited, Draft, Line } from "./types";

// Shape we ask the model for. Times are NOT requested: the model returns line
// numbers and we resolve timestamps from the parsed source.
export type ModelDraft = {
  title?: string;
  summary?: { text: string; cites: number[] };
  impact?: { text: string; cites: number[] };
  root_cause?: { text: string; cites: number[] };
  contributing_factors?: { text: string; cites: number[] }[];
  timeline?: { line: number; event: string }[];
  action_items?: { text: string; owner?: string; cites: number[] }[];
  open_questions?: string[];
};

export function extractJSON(s: string): unknown {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1);
  return JSON.parse(body);
}

// Grounding check: drop citations to lines that don't exist, mark claims with
// no valid citation as unverified, and replace any model timeline entry that
// points at a missing line. Metrics always come from the deterministic parser.
export function groundDraft(m: ModelDraft, lines: Line[], source: Draft["source"]): Draft {
  const byN = new Map(lines.map((l) => [l.n, l]));
  const warnings: string[] = [];
  const fix = (c: { text: string; cites: number[] } | undefined, label: string): Cited => {
    if (!c || typeof c.text !== "string") return { text: "Not provided.", cites: [], verified: false };
    const cites = (Array.isArray(c.cites) ? c.cites : []).map(Number).filter((n) => byN.has(n));
    const dropped = (c.cites?.length ?? 0) - cites.length;
    if (dropped > 0) warnings.push(`${label}: removed ${dropped} citation(s) to lines that don't exist.`);
    const verified = cites.length > 0;
    if (!verified) warnings.push(`${label}: no supporting line, marked unverified.`);
    return { text: c.text, cites, verified };
  };
  const base = heuristicDraft(lines);
  const timeline = (m.timeline ?? [])
    .filter((t) => byN.has(Number(t.line)))
    .map((t) => ({ line: Number(t.line), time: byN.get(Number(t.line))!.time, event: String(t.event) }))
    .sort((a, b) => a.line - b.line);
  const droppedTl = (m.timeline?.length ?? 0) - timeline.length;
  if (droppedTl) warnings.push(`Timeline: removed ${droppedTl} event(s) citing missing lines.`);
  return {
    title: m.title?.slice(0, 120) || base.title,
    summary: fix(m.summary, "Summary"),
    impact: fix(m.impact, "Impact"),
    rootCause: fix(m.root_cause, "Root cause"),
    contributingFactors: (m.contributing_factors ?? []).map((c, i) => fix(c, `Factor ${i + 1}`)),
    timeline: timeline.length ? timeline : base.timeline,
    actionItems: (m.action_items ?? []).map((a, i) => ({ ...fix(a, `Action ${i + 1}`), owner: a.owner })),
    openQuestions: (m.open_questions ?? []).map(String).slice(0, 8),
    metrics: base.metrics,
    source,
    warnings,
  };
}
