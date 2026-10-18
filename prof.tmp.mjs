import { chromium } from "@playwright/test";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await c.newPage();
await p.goto("http://localhost:3100/b/prof" + Date.now());
await p.waitForFunction(() => window.__liveBoard);
await p.evaluate(() => window.__liveBoard.seed(500));
for (let i = 0; i < 8; i++) await p.getByTestId("zoom-out").click();
const cdp = await c.newCDPSession(p);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
const mode = process.argv[2];
await cdp.send("Profiler.start");
if (mode === "pan") { await p.mouse.move(640,400); for (let i = 0; i < 40; i++) await p.mouse.wheel(12, 8); }
else if (mode === "remote") {
  const c2 = await b.newContext(); const q = await c2.newPage(); await q.goto(p.url()); await q.waitForFunction(() => window.__liveBoard?.doc.getMap("elements").size === 500);
  await q.evaluate(async () => { const m = window.__liveBoard.doc.getMap("elements").get("seed-100"); for (let i=0;i<60;i++){ m.set("x", m.get("x")+2); await new Promise(r=>setTimeout(r,16)); } });
} else { const s = { x: 640, y: 400 }; await p.mouse.move(s.x, s.y); await p.mouse.down(); for (let i=0;i<40;i++) await p.mouse.move(s.x+i*3, s.y+i*2); await p.mouse.up(); }
const { profile } = await cdp.send("Profiler.stop");
const self = new Map(); const byId = new Map(profile.nodes.map(n => [n.id, n]));
const dt = profile.timeDeltas; const counts = new Map();
profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
for (const [id, t] of counts) { const n = byId.get(id); const cf = n.callFrame; const key = `${cf.functionName || "(anon)"} ${cf.url.split("/").pop()}:${cf.lineNumber}`; self.set(key, (self.get(key) || 0) + t); }
const total = [...self.values()].reduce((a, b) => a + b, 0);
console.log(mode, "total ms", Math.round(total / 1000));
[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).forEach(([k, t]) => console.log((t / 1000).toFixed(0).padStart(6), k));
await b.close();
