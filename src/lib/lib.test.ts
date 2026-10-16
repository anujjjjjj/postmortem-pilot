import { describe, expect, it } from "vitest";
import { parse } from "./parse";
import { heuristicDraft } from "./heuristic";
import { groundDraft, extractJSON } from "./validate";
import { toMarkdown } from "./markdown";
import { SAMPLE } from "./sample";

describe("parse", () => {
  it("reads time, author and tags from chat lines", () => {
    const l = parse(SAMPLE);
    expect(l[1]).toMatchObject({ n: 2, time: "14:03", author: "pagerduty" });
    expect(l[1].tags).toContain("alert");
    expect(l.find((x) => x.n === 8)!.tags).toContain("rollback");
  });
  it("handles 12h clock and midnight rollover", () => {
    const l = parse("11:58 PM alice: alert firing\n12:07 AM bob: rolled back");
    expect(l[0].time).toBe("23:58");
    expect(l[1].minutes! - l[0].minutes!).toBe(9);
  });
  it("keeps original line numbers when blank lines exist", () => {
    expect(parse("\n\n10:00 a: hi").map((x) => x.n)).toEqual([3]);
  });
});

describe("heuristic draft", () => {
  it("computes metrics deterministically from the sample", () => {
    const d = heuristicDraft(parse(SAMPLE));
    expect(d.metrics).toMatchObject({ detectedAt: "14:03", mitigatedAt: "14:10", resolvedAt: "14:45", timeToMitigateMin: 7, durationMin: 42 });
    expect(d.rootCause.cites).toEqual([7]);
    expect(d.actionItems.map((a) => a.cites[0])).toEqual(expect.arrayContaining([14, 15, 16]));
  });
  it("warns instead of guessing when signal is missing", () => {
    const d = heuristicDraft(parse("hello\nworld"));
    expect(d.warnings.length).toBeGreaterThan(0);
    expect(d.rootCause.text).toMatch(/Unknown/);
  });
});

describe("grounding", () => {
  const lines = parse(SAMPLE);
  it("drops hallucinated citations and flags unsupported claims", () => {
    const d = groundDraft(
      {
        summary: { text: "ok", cites: [2, 999] },
        root_cause: { text: "cosmic rays", cites: [] },
        timeline: [{ line: 2, event: "alert" }, { line: 404, event: "made up" }],
      },
      lines,
      "openai",
    );
    expect(d.summary.cites).toEqual([2]);
    expect(d.rootCause.verified).toBe(false);
    expect(d.timeline).toEqual([{ line: 2, time: "14:03", event: "alert" }]);
    expect(d.warnings.join(" ")).toMatch(/don't exist/);
  });
  it("takes metrics from the parser, not the model", () => {
    expect(groundDraft({}, lines, "anthropic").metrics.timeToMitigateMin).toBe(7);
  });
  it("extracts JSON from fenced model output", () => {
    expect(extractJSON('here:\n```json\n{"title":"x"}\n```')).toEqual({ title: "x" });
  });
});

it("renders markdown with line citations", () => {
  const md = toMarkdown(heuristicDraft(parse(SAMPLE)));
  expect(md).toContain("## Timeline");
  expect(md).toMatch(/\[L7\]/);
});
