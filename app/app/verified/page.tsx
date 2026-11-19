import { readResults } from "@/lib/verify";

export default function Verified() {
  const r = readResults();
  return (
    <>
      <div className="main-top"><h1>Verified by Kane</h1></div>
      <p className="sub" style={{ marginTop: 8, maxWidth: "64ch" }}>Kane CLI tests every money flow in a real browser before each release, written in plain English. If a test fails, the failure goes back to the coding agent, which fixes the code and runs Kane again. Nothing ships until every test passes.</p>
      {!r ? (
        <div className="c" style={{ marginTop: 18 }}><div className="empty">No Kane run recorded yet. Run <code>npm run verify</code> or <code>npm run loop</code>.</div></div>
      ) : (
        <div className="grid">
          <div className="c"><h3>Latest run</h3><div className="big-num" data-testid="kane-score">{r.passed}/{r.total}</div>
            <div className="sub">tests passed, {new Date(r.finishedAt).toLocaleString()}</div>
            <div className="sub" style={{ marginTop: 6 }}>Against {r.baseUrl}</div></div>
          <div className="c span2"><h3>Fix loop</h3>
            <div className="list">
              {r.loop.length === 0 && <div className="empty">Passed on the first attempt.</div>}
              {r.loop.map((l) => (
                <div className="li" key={l.attempt}><div className="ava">{l.failed.length ? "↻" : "✓"}</div>
                  <div>Attempt {l.attempt}<small>{l.failed.length ? `Failed: ${l.failed.join(", ")}` : "All tests passed"}{l.fixedBy ? `. Fix sent to ${l.fixedBy}` : ""}</small></div>
                  <span className={`verdict ${l.failed.length ? "failed" : "passed"}`}>{l.failed.length ? "failed" : "passed"}</span></div>
              ))}
            </div>
          </div>
          <div className="c" style={{ gridColumn: "1 / -1" }}><h3>Tests</h3>
            <div className="list">
              {r.tests.map((t) => (
                <div className="li" key={t.file} style={{ gridTemplateColumns: "34px 1fr auto" }}><div className="ava">{t.status === "passed" ? "✓" : "✕"}</div>
                  <div>{t.name}<small>{t.summary}{t.testUrl ? " " : ""}{t.testUrl && <a href={t.testUrl} target="_blank" rel="noreferrer" style={{ color: "var(--teal-ink)" }}>Evidence</a>}</small></div>
                  <span className={`verdict ${t.status === "passed" ? "passed" : "failed"}`}>{t.status}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
