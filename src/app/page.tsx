"use client";
import { useMemo, useRef, useState } from "react";
import { parse } from "@/lib/parse";
import { heuristicDraft } from "@/lib/heuristic";
import { groundDraft, extractJSON, type ModelDraft } from "@/lib/validate";
import { toMarkdown } from "@/lib/markdown";
import { callModel, type Provider } from "@/lib/llm";
import { SAMPLE } from "@/lib/sample";
import type { Cited, Draft } from "@/lib/types";

type Mode = "heuristic" | Provider;

export default function Home() {
  const [src, setSrc] = useState(SAMPLE);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<Mode>("heuristic");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState<Draft | null>(() => heuristicDraft(parse(SAMPLE)));
  const [hl, setHl] = useState<number[]>([]);
  const lines = useMemo(() => parse(src), [src]);
  const srcRef = useRef<HTMLDivElement>(null);

  async function generate() {
    setErr("");
    setEditing(false);
    if (mode === "heuristic") return setDraft(heuristicDraft(lines));
    if (!key) return setErr("Paste an API key for the selected provider, or use Offline mode.");
    setBusy(true);
    try {
      const raw = await callModel(mode, key, lines);
      setDraft(groundDraft(extractJSON(raw) as ModelDraft, lines, mode));
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function jump(ns: number[]) {
    setHl(ns);
    setEditing(false);
    requestAnimationFrame(() => srcRef.current?.querySelector(`[data-n="${ns[0]}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }

  const md = draft ? toMarkdown(draft) : "";
  const Cites = ({ c }: { c: Cited }) => (
    <>
      {c.cites.map((n) => (
        <button key={n} className="cite" onClick={() => jump([n])}>L{n}</button>
      ))}
      {c.verified === false && <span className="unv">unverified</span>}
    </>
  );

  return (
    <main>
      <header>
        <div>
          <h1>PostmortemPilot</h1>
          <p className="sub">Paste an incident channel. Get a blameless postmortem where every claim links back to the line that supports it.</p>
        </div>
        <a className="gh" href="https://github.com/anujjjjjj/postmortem-pilot">GitHub</a>
      </header>

      <section className="bar">
        <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} aria-label="Mode">
          <option value="heuristic">Offline (deterministic, no key)</option>
          <option value="anthropic">Claude (your API key)</option>
          <option value="openai">OpenAI (your API key)</option>
        </select>
        {mode !== "heuristic" && (
          <input type="password" placeholder={mode === "anthropic" ? "sk-ant-…" : "sk-…"} value={key} onChange={(e) => setKey(e.target.value)} aria-label="API key" />
        )}
        <button className="primary" onClick={generate} disabled={busy}>{busy ? "Drafting…" : "Generate draft"}</button>
        <button onClick={() => navigator.clipboard.writeText(md)} disabled={!draft}>Copy Markdown</button>
        <button onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" })); a.download = "postmortem.md"; a.click(); }} disabled={!draft}>Download .md</button>
        <span className="note">Your key and transcript go straight from this browser to the provider. There is no backend.</span>
      </section>
      {err && <p className="err">{err}</p>}

      <div className="grid">
        <section className="pane">
          <div className="paneHead">
            <span>Source · {lines.length} lines</span>
            <span>
              <button onClick={() => setEditing(!editing)}>{editing ? "Done" : "Edit / paste"}</button>
              <button onClick={() => { setSrc(SAMPLE); setDraft(heuristicDraft(parse(SAMPLE))); }}>Sample</button>
            </span>
          </div>
          {editing ? (
            <textarea value={src} onChange={(e) => setSrc(e.target.value)} spellCheck={false} placeholder="[14:03] alice: ALERT 5xx rate 18%…" />
          ) : (
            <div className="src" ref={srcRef}>
              {src.split(/\r?\n/).map((t, i) => (
                <div key={i} data-n={i + 1} className={hl.includes(i + 1) ? "ln hl" : "ln"}>
                  <span className="no">{i + 1}</span>
                  <span>{t || " "}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="pane doc">
          {draft && (
            <>
              <div className="paneHead"><span>Draft · {draft.source === "heuristic" ? "offline rules" : draft.source}</span></div>
              <h2>{draft.title}</h2>
              <div className="metrics">
                <M k="Detected" v={draft.metrics.detectedAt} />
                <M k="Mitigated" v={draft.metrics.mitigatedAt} />
                <M k="Resolved" v={draft.metrics.resolvedAt} />
                <M k="Time to mitigate" v={draft.metrics.timeToMitigateMin != null ? `${draft.metrics.timeToMitigateMin} min` : undefined} />
                <M k="Duration" v={draft.metrics.durationMin != null ? `${draft.metrics.durationMin} min` : undefined} />
              </div>
              {draft.warnings.length > 0 && <ul className="warn">{draft.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
              <h3>Summary</h3><p>{draft.summary.text} <Cites c={draft.summary} /></p>
              <h3>Impact</h3><p>{draft.impact.text} <Cites c={draft.impact} /></p>
              <h3>Root cause</h3><p>{draft.rootCause.text} <Cites c={draft.rootCause} /></p>
              {draft.contributingFactors.length > 0 && (<><h3>Contributing factors</h3><ul>{draft.contributingFactors.map((f, i) => <li key={i}>{f.text} <Cites c={f} /></li>)}</ul></>)}
              <h3>Timeline</h3>
              <table><tbody>{draft.timeline.map((t, i) => (
                <tr key={i} onClick={() => jump([t.line])}><td className="t">{t.time ?? "—"}</td><td>{t.event}</td><td><span className="cite">L{t.line}</span></td></tr>
              ))}</tbody></table>
              {draft.actionItems.length > 0 && (<><h3>Action items</h3><ul>{draft.actionItems.map((a, i) => <li key={i}>☐ {a.text}{a.owner && <em> · {a.owner}</em>} <Cites c={a} /></li>)}</ul></>)}
              {draft.openQuestions.length > 0 && (<><h3>Open questions</h3><ul>{draft.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul></>)}
            </>
          )}
        </section>
      </div>
      <footer>Timestamps and durations come from a deterministic parser, never from the model. Citations that point at lines that don&apos;t exist are removed, and claims with no support are marked unverified. Sample incident is fictional.</footer>
    </main>
  );
}

function M({ k, v }: { k: string; v?: string }) {
  return <div className="m"><span>{k}</span><b>{v ?? "?"}</b></div>;
}
