import { byTest, readHeal, readResults, score, type KaneTest } from "@/lib/verify";

function Result({ t }: { t?: KaneTest }) {
  if (!t) return <span className="vcell none">Desktop only</span>;
  return (
    <span className="vcell">
      <span className={`verdict ${t.status === "passed" ? "passed" : "failed"}`}>{t.status === "passed" ? "Passed" : "Failed"}</span>
      {t.testUrl && <a href={t.testUrl} target="_blank" rel="noreferrer">Evidence</a>}
    </span>
  );
}

export default function Verified() {
  const r = readResults();
  const heal = readHeal();
  const web = r && score(r, "web");
  const phone = r && score(r, "phone");
  return (
    <>
      <div className="main-top"><h1>Verified by Kane</h1></div>
      <p className="sub" style={{ marginTop: 8, maxWidth: "64ch" }}>Kane CLI tests every money flow in a real browser before each release, written in plain English, and runs the key flows again on a phone screen. If a test fails, the failure goes back to the coding agent, which fixes the code and runs Kane again. Nothing ships until every test passes.</p>
      {!r ? (
        <div className="c" style={{ marginTop: 18 }}><div className="empty">No Kane run recorded yet. Run <code>npm run verify</code> or <code>npm run loop</code>.</div></div>
      ) : (
        <div className="grid">
          <div className="c"><h3>Desktop browser</h3><div className="big-num" data-testid="kane-score">{web!.passed}/{web!.total}</div>
            <div className="sub">tests passed in Chrome</div></div>
          <div className="c"><h3>Phone</h3><div className="big-num" data-testid="kane-phone-score">{phone!.total ? `${phone!.passed}/${phone!.total}` : "Not run"}</div>
            <div className="sub">{r.phone ? `${r.phone.name}, ${r.phone.width}×${r.phone.height}` : "Phone runs not recorded yet"}</div></div>
          <div className="c"><h3>Latest run</h3><div className="big-num" style={{ fontSize: 22 }}>{new Date(r.finishedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</div>
            <div className="sub">{new Date(r.finishedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}, against {r.baseUrl.replace(/^https?:\/\//, "")}</div></div>

          <div className="c" style={{ gridColumn: "1 / -1" }}><h3>Tests</h3>
            <div className="vtable" role="table" aria-label="Kane results by device">
              <div className="vrow vhead" role="row"><span role="columnheader">Test</span><span role="columnheader">Desktop</span><span role="columnheader">Phone</span></div>
              {byTest(r).map((row) => (
                <div className="vrow" role="row" key={row.file}>
                  <span role="cell">{row.name}<small>{(row.phone?.status === "failed" ? row.phone : row.web)?.summary.split("\n")[0]}</small></span>
                  <span role="cell" data-label="Desktop"><Result t={row.web} /></span>
                  <span role="cell" data-label="Phone"><Result t={row.phone} /></span>
                </div>
              ))}
            </div>
          </div>

          {heal && (
            <details className="c heal-box" style={{ gridColumn: "1 / -1" }} data-testid="heal-drill">
              <summary>
                <span className={`verdict ${heal.healed ? "passed" : "failed"}`}>{heal.healed ? "healed" : "not healed"}</span>
                <span className="heal-line"><b>Self-heal drill</b>{" "}
                  {heal.healed ? "Kane caught a bug we planted in Shield, Claude Code fixed it, and Kane passed the fix."
                    : heal.caught ? "Kane caught a bug we planted in Shield, but the fix didn’t pass yet."
                    : "Kane didn’t catch the bug we planted in Shield."}</span>
                <span className="heal-more">{new Date(heal.finishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
              </summary>
              <p className="sub" style={{ marginTop: 14, maxWidth: "70ch" }}>We broke Mlyfo on purpose to prove the loop works. {heal.bug.effect}</p>
              <ol className="heal">
                <li><b>Broken on purpose</b><span>{heal.bug.title}, in <code>{heal.bug.file}</code></span><pre className="diff">{heal.bug.plantedDiff}</pre></li>
                <li><b>{heal.caught ? "Caught by Kane" : "Kane missed it"}</b><span>{heal.caught ? `“${heal.caughtBy}” failed in a real browser.` : "The test passed on the broken build."}</span></li>
                {heal.attempts.filter((a) => a.fixedBy).map((a) => (
                  <li key={a.attempt}><b>Fixed by {a.fixedBy === "claude" ? "Claude Code" : a.fixedBy}</b><span>The failure and Kane’s evidence went to the coding agent, which changed the code.</span>
                    {heal.fixDiff && <pre className="diff">{heal.fixDiff}</pre>}</li>
                ))}
                <li><b>{heal.healed ? "Healed" : "Not healed"}</b><span>{heal.healed ? `Kane ran the test again and it passed, ${heal.attempts.length} attempts in all.` : "Kane still finds the failure, so this build would not ship."}</span>
                  <span className={`verdict ${heal.healed ? "passed" : "failed"}`} style={{ marginTop: 6, width: "fit-content" }}>{heal.healed ? "passed" : "failed"}</span></li>
              </ol>
              <div className="sub" style={{ marginTop: 10 }}>Run it yourself: <code>npm run heal</code>. {new Date(heal.finishedAt).toLocaleString()}</div>
            </details>
          )}

          <div className="c" style={{ gridColumn: "1 / -1" }}><h3>Fix loop</h3>
            <div className="list">
              {r.loop.map((l) => (
                <div className="li" key={l.attempt}><div className="ava">{l.failed.length ? "↻" : "✓"}</div>
                  <div>Attempt {l.attempt}<small>{l.failed.length ? `Failed: ${l.failed.join(", ")}` : "All tests passed"}{l.fixedBy ? `. Fix sent to ${l.fixedBy}` : ""}</small></div>
                  <span className={`verdict ${l.failed.length ? "failed" : "passed"}`}>{l.failed.length ? "failed" : "passed"}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
