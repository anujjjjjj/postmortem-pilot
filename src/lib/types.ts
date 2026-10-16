export type Line = {
  n: number; // 1-based line number in the pasted source
  raw: string;
  time?: string; // normalized HH:MM or HH:MM:SS as written
  minutes?: number; // minutes since midnight (with day rollover), for durations
  author?: string;
  text: string;
  tags: Tag[];
};
export type Tag = "alert" | "ack" | "deploy" | "rollback" | "mitigated" | "resolved" | "customer" | "action" | "cause";

export type Cited = { text: string; cites: number[]; verified?: boolean };
export type TimelineItem = { line: number; time?: string; event: string };

export type Draft = {
  title: string;
  summary: Cited;
  impact: Cited;
  rootCause: Cited;
  contributingFactors: Cited[];
  timeline: TimelineItem[];
  actionItems: (Cited & { owner?: string })[];
  openQuestions: string[];
  metrics: { detectedAt?: string; mitigatedAt?: string; resolvedAt?: string; timeToMitigateMin?: number; durationMin?: number };
  source: "heuristic" | "anthropic" | "openai";
  warnings: string[];
};
