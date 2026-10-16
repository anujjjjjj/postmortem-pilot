import type { Cited, Draft } from "./types";

const c = (x: Cited) => `${x.text}${x.cites.length ? ` [L${x.cites.join(", L")}]` : ""}${x.verified === false ? " _(unverified)_" : ""}`;

export function toMarkdown(d: Draft): string {
  const m = d.metrics;
  const out = [
    `# ${d.title}`,
    "",
    "_Blameless postmortem draft. `[Lnn]` = line in the source transcript._",
    "",
    "| Detected | Mitigated | Resolved | Time to mitigate | Duration |",
    "|---|---|---|---|---|",
    `| ${m.detectedAt ?? "?"} | ${m.mitigatedAt ?? "?"} | ${m.resolvedAt ?? "?"} | ${m.timeToMitigateMin ?? "?"} min | ${m.durationMin ?? "?"} min |`,
    "",
    "## Summary", c(d.summary), "",
    "## Impact", c(d.impact), "",
    "## Root cause", c(d.rootCause), "",
  ];
  if (d.contributingFactors.length) out.push("## Contributing factors", ...d.contributingFactors.map((f) => `- ${c(f)}`), "");
  out.push("## Timeline", "| Time | Event | Src |", "|---|---|---|", ...d.timeline.map((t) => `| ${t.time ?? ""} | ${t.event.replace(/\|/g, "\\|")} | L${t.line} |`), "");
  if (d.actionItems.length) out.push("## Action items", ...d.actionItems.map((a) => `- [ ] ${c(a)}${a.owner ? ` (owner: ${a.owner})` : ""}`), "");
  if (d.openQuestions.length) out.push("## Open questions", ...d.openQuestions.map((q) => `- ${q}`), "");
  return out.join("\n");
}
