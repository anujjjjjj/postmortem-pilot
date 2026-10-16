import type { Line, Tag } from "./types";

// Accepts common chat/log shapes:
//   [14:02] alice: text      14:02:11 alice: text      2026-10-14T14:02:11Z alice text
//   alice  2:02 PM  text     (Slack copy-paste)
const TIME = /(?:\d{4}-\d{2}-\d{2}[T ])?(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/;

const RULES: [Tag, RegExp][] = [
  ["alert", /\b(alert|page[ds]?|pagerduty|firing|triggered|5\d\d s?|error rate|spik(e|ing)|latency|p9\d|timeouts?|down|outage|degrad)/i],
  ["ack", /\b(ack(ed|nowledged)?|on it|looking( into it)?|investigating|i'?ll take)\b/i],
  ["deploy", /\b(deploy(ed|ing)?|release[d]?|rolled out|merged|shipped|config change|migration)\b/i],
  ["rollback", /\b(roll(ed|ing)? ?back|revert(ed|ing)?|disable[d]? (the )?flag|failover|failed over|scaled? (up|out))\b/i],
  ["mitigated", /\b(mitigated|recover(ed|ing)|back to normal|error rate (is )?(down|dropping|normal)|stabili[sz]ed)\b/i],
  ["resolved", /\b(resolved|all clear|closing (the )?incident|incident (is )?closed|fully recovered)\b/i],
  ["customer", /\b(customers?|users?|merchants?|support tickets?|complain|checkout|payments? fail)/i],
  ["action", /\b(action item|follow[- ]?up|todo|we should|need to|let'?s add|postmortem item)\b/i],
  ["cause", /\b(root cause|caused by|because|culprit|turns out|the issue (is|was))\b/i],
];

export function parse(source: string): Line[] {
  const out: Line[] = [];
  let lastMinutes: number | undefined;
  let dayOffset = 0;
  source.split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return;
    const line: Line = { n: i + 1, raw, text: raw.trim(), tags: [] };
    const head = raw.slice(0, 40);
    const tm = head.match(TIME);
    if (tm) {
      let h = Number(tm[1]);
      const m = Number(tm[2]);
      const ap = tm[4]?.toLowerCase();
      if (ap === "pm" && h < 12) h += 12;
      if (ap === "am" && h === 12) h = 0;
      if (h < 24 && m < 60) {
        let mins = h * 60 + m + (tm[3] ? Number(tm[3]) / 60 : 0);
        if (lastMinutes !== undefined && mins + dayOffset < lastMinutes - 12 * 60) dayOffset += 24 * 60;
        mins += dayOffset;
        lastMinutes = mins;
        line.time = `${String(h).padStart(2, "0")}:${tm[2]}${tm[3] ? ":" + tm[3] : ""}`;
        line.minutes = mins;
      }
    }
    const rest = tm ? raw.slice((tm.index ?? 0) + tm[0].length).replace(/^[\]\)\s]+/, "") : raw;
    const am = rest.match(/^@?([A-Za-z][\w.\-]{0,30})\s*:\s+/);
    if (am) {
      line.author = am[1];
      line.text = rest.slice(am[0].length).trim();
    } else {
      line.text = rest.trim();
    }
    for (const [tag, re] of RULES) if (re.test(line.text)) line.tags.push(tag);
    out.push(line);
  });
  return out;
}

export function minutesBetween(a?: Line, b?: Line): number | undefined {
  if (a?.minutes === undefined || b?.minutes === undefined) return undefined;
  return Math.round(b.minutes - a.minutes);
}
