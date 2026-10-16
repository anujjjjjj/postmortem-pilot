import { minutesBetween } from "./parse";
import type { Draft, Line } from "./types";

// Deterministic, no-LLM draft. Every sentence is built from cited lines, so it is
// never wrong about what was said, only incomplete. Used as the no-key demo and
// as the ground-truth skeleton the LLM draft is checked against.
export function heuristicDraft(lines: Line[]): Draft {
  const first = (t: string) => lines.find((l) => l.tags.includes(t as never));
  const last = (t: string) => [...lines].reverse().find((l) => l.tags.includes(t as never));
  const alert = first("alert");
  const mitig = first("rollback") ?? first("mitigated");
  const resolved = last("resolved") ?? last("mitigated");
  const cause = first("cause");
  const customers = lines.filter((l) => l.tags.includes("customer")).slice(0, 3);
  const deploys = lines.filter((l) => l.tags.includes("deploy") && (!alert || l.n <= (mitig?.n ?? Infinity)));

  const keyTags = new Set(["alert", "ack", "deploy", "rollback", "mitigated", "resolved", "cause"]);
  const timeline = lines
    .filter((l) => !l.tags.includes("action") && l.tags.some((t) => keyTags.has(t)))
    .slice(0, 25)
    .map((l) => ({ line: l.n, time: l.time, event: (l.author ? `${l.author}: ` : "") + clip(l.text, 140) }));

  const warnings: string[] = [];
  if (!alert) warnings.push("No alert/detection line found; detection time unknown.");
  if (!cause) warnings.push("No explicit root-cause statement found in the source. Add one or use AI mode.");
  if (!lines.some((l) => l.time)) warnings.push("No timestamps recognized; durations cannot be computed.");

  const ttm = minutesBetween(alert, mitig);
  const dur = minutesBetween(alert, resolved);
  return {
    title: alert ? `Incident: ${clip(alert.text, 70)}` : "Incident postmortem (draft)",
    summary: {
      text: [
        alert && `Detected at ${alert.time ?? "unknown time"}: "${clip(alert.text, 100)}".`,
        mitig && `Mitigated at ${mitig.time ?? "?"} via "${clip(mitig.text, 90)}".`,
        resolved && resolved !== mitig && `Resolved at ${resolved.time ?? "?"}.`,
      ].filter(Boolean).join(" ") || "Not enough signal in the source to summarize.",
      cites: [alert, mitig, resolved].filter(Boolean).map((l) => l!.n),
    },
    impact: {
      text: customers.length ? customers.map((l) => `"${clip(l.text, 110)}"`).join(" · ") : "Customer impact not stated in the source.",
      cites: customers.map((l) => l.n),
    },
    rootCause: cause ? { text: clip(cause.text, 220), cites: [cause.n] } : { text: "Unknown from source.", cites: [] },
    contributingFactors: deploys.slice(0, 3).map((l) => ({ text: `Change in window: ${clip(l.text, 140)}`, cites: [l.n] })),
    timeline,
    actionItems: lines.filter((l) => l.tags.includes("action")).slice(0, 8).map((l) => ({ text: clip(l.text, 160), cites: [l.n], owner: l.author })),
    openQuestions: cause ? [] : ["What was the root cause?"],
    metrics: { detectedAt: alert?.time, mitigatedAt: mitig?.time, resolvedAt: resolved?.time, timeToMitigateMin: ttm, durationMin: dur },
    source: "heuristic",
    warnings,
  };
}

function clip(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
