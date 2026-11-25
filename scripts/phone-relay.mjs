#!/usr/bin/env node
// Makes Kane test Mlyfo on a phone-shaped browser.
//
// Kane's web runs always ask Chrome for a desktop-sized page (its window setting can't go below 800px).
// This starts a headless Chrome that identifies as an iPhone, and a small relay in front of its
// remote-debugging port. Kane connects to the relay (kane-cli run --cdp-endpoint http://127.0.0.1:<port>),
// and the relay turns every "set the page size" command into an iPhone 15 screen: 393×852, 3× pixels,
// mobile mode, touch. Every other command passes through unchanged, so Kane drives the page exactly as
// it would on desktop, but the app sees a phone.
//
//   import { startPhone } from "./phone-relay.mjs";
//   const phone = await startPhone();   // { endpoint, close() }
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";

export const PHONE = {
  name: "iPhone 15 (Safari)",
  width: 393, height: 852, scale: 3,
  ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
};

const METRICS = { width: PHONE.width, height: PHONE.height, deviceScaleFactor: PHONE.scale, mobile: true, screenWidth: PHONE.width, screenHeight: PHONE.height };

function rewrite(msg) {
  if (msg.method === "Emulation.setDeviceMetricsOverride") msg.params = { ...msg.params, ...METRICS };
  else if (msg.method === "Browser.setWindowBounds") msg.params = { ...msg.params, bounds: { ...msg.params?.bounds, width: PHONE.width, height: PHONE.height } };
  else if (msg.method === "Emulation.setUserAgentOverride") msg.params = { ...msg.params, userAgent: PHONE.ua, platform: "iPhone" };
  return msg;
}

/** After Chrome attaches to a page, make sure it's phone-sized even if Kane never sends a size command. */
function phoneCommands(sessionId, nextId) {
  return [
    { id: nextId(), sessionId, method: "Emulation.setDeviceMetricsOverride", params: METRICS },
    { id: nextId(), sessionId, method: "Emulation.setTouchEmulationEnabled", params: { enabled: true, maxTouchPoints: 5 } },
    { id: nextId(), sessionId, method: "Emulation.setUserAgentOverride", params: { userAgent: PHONE.ua, platform: "iPhone" } },
  ];
}

const freePort = () => new Promise((res) => { const s = http.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });

async function waitFor(url, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return r.json(); } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Phone browser didn’t start (${url})`);
}

export async function startPhone({ chrome = process.env.KANE_CLI_CHROME_PATH, log = () => {} } = {}) {
  if (!chrome) throw new Error("Set KANE_CLI_CHROME_PATH to a Chrome or headless_shell binary (source scripts/kane-env.sh).");
  const relayPort = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "mlyfo-phone-"));
  // A busy CI machine sometimes loses the race for the port or starts Chrome slowly: try up to 3 times.
  let proc, upstream;
  for (let attempt = 1; ; attempt++) {
    const chromePort = await freePort();
    proc = spawn(chrome, [
      "--headless", "--no-sandbox", `--remote-debugging-port=${chromePort}`, `--user-data-dir=${profile}`,
      `--window-size=${PHONE.width},${PHONE.height}`, "--touch-events=enabled", `--user-agent=${PHONE.ua}`,
      "--no-first-run", "--no-default-browser-check", "about:blank",
    ], { stdio: "ignore" });
    upstream = `127.0.0.1:${chromePort}`;
    try { await waitFor(`http://${upstream}/json/version`, 30000); break; }
    catch (e) {
      try { proc.kill("SIGKILL"); } catch {}
      if (attempt === 3) throw e;
      log(`Phone browser didn’t start, retrying (${attempt}/3)`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // HTTP discovery (/json/version, /json/list …): forward, pointing websocket URLs at the relay.
  const server = http.createServer(async (req, res) => {
    try {
      const r = await fetch(`http://${upstream}${req.url}`, { method: req.method });
      const body = (await r.text()).replaceAll(upstream, `127.0.0.1:${relayPort}`);
      res.writeHead(r.status, { "content-type": r.headers.get("content-type") ?? "application/json" }).end(body);
    } catch (e) { res.writeHead(502).end(String(e)); }
  });

  const wss = new WebSocketServer({ server });
  wss.on("connection", (client, req) => {
    const up = new WebSocket(`ws://${upstream}${req.url}`, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
    const pending = [];
    let id = 2_000_000_000;
    const nextId = () => ++id;
    const ours = new Set();
    const send = (m) => { const s = JSON.stringify(m); up.readyState === 1 ? up.send(s) : pending.push(s); };
    up.on("open", () => { for (const s of pending.splice(0)) up.send(s); });

    client.on("message", (data) => {
      let msg; try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.method) log(msg.method);
      send(rewrite(msg));
    });
    up.on("message", (data) => {
      const text = data.toString();
      let msg; try { msg = JSON.parse(text); } catch { client.send(text); return; }
      if (msg.id && ours.has(msg.id)) { ours.delete(msg.id); return; } // replies to our own commands stay here
      // A page session just opened (Playwright/Puppeteer attach): size it as a phone straight away.
      if (msg.method === "Target.attachedToTarget" && msg.params?.targetInfo?.type === "page") {
        for (const c of phoneCommands(msg.params.sessionId, nextId)) { ours.add(c.id); send(c); }
      }
      client.send(text);
    });
    const closeBoth = () => { try { client.close(); } catch {} try { up.close(); } catch {} };
    client.on("close", closeBoth); up.on("close", closeBoth);
    client.on("error", closeBoth); up.on("error", closeBoth);
  });

  await new Promise((r) => server.listen(relayPort, "127.0.0.1", r));
  return {
    endpoint: `http://127.0.0.1:${relayPort}`,
    async close() {
      wss.close(); server.close();
      // Wait for Chrome to exit before removing its profile, or it may still be writing files there.
      const exited = proc.exitCode !== null || proc.signalCode !== null
        ? Promise.resolve()
        : new Promise((r) => { proc.once("exit", r); setTimeout(r, 5000); });
      try { proc.kill("SIGKILL"); } catch {}
      await exited;
      try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
    },
  };
}

// Run on its own: keep a phone browser up and print the endpoint (handy for trying Kane by hand).
if (import.meta.url === `file://${process.argv[1]}`) {
  const phone = await startPhone({ log: process.env.DEBUG ? (m) => console.error("cdp", m) : undefined });
  console.log(`Phone browser ready (${PHONE.name}). Use: kane-cli run "…" --agent --cdp-endpoint ${phone.endpoint}`);
  process.on("SIGINT", async () => { await phone.close(); process.exit(0); });
}
