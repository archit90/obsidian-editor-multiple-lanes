// node run.mjs group.mjs [filter]  — runs cases exported as `cases` = [{id, run: async c => ({ok, note})}]
import fs from "node:fs";
import { open } from "./lib.mjs";
const mod = await import("./" + process.argv[2]);
const filt = process.argv[3] ? new RegExp(process.argv[3]) : null;
const c = await open();
c.js = async body => c.ev(`(async()=>{${body}})()`);
c.prep = async () => {
  await c.ev(fs.readFileSync("hook.js", "utf8"));
  await c.ev(fs.readFileSync("helpers.js", "utf8"));
};
await c.prep();
const resFile = "results.json";
const res = fs.existsSync(resFile) ? JSON.parse(fs.readFileSync(resFile, "utf8")) : {};
// a case that tests working with another plugin says so (`needs: "<plugin id>"`), and is skipped without it:
// Editor Lanes itself works without any of them
const loaded = new Set(await c.js("return Object.keys(app.plugins.plugins)"));
for (const cs of mod.cases) {
  if (filt && !filt.test(cs.id)) continue;
  if (cs.needs && !loaded.has(cs.needs)) {
    console.log(`SKIP ${cs.id} (${cs.needs} not enabled)`);
    continue;
  }
  let r;
  try {
    await c.unstick();
    await c.key("Escape");
    await c.prep();
    await c.js("await T.reset(); return 1");
    r = await cs.run(c);
  } catch (e) {
    r = { ok: false, note: "EXC " + (e.message || e).slice(0, 300) };
  }
  const dead = await c
    .js(
      `const P=T.P(); return app.workspace.getLeavesOfType("markdown").filter(l=>!l.containerEl.isConnected && (P.hostedLeaves.has(l) || l.containerEl.closest(".lane-split"))).map(l=>l.view.file?.path).concat([...P.hostedLeaves.keys()].filter(l=>!l.containerEl.isConnected).map(l=>"hosted:"+l.view.file?.path))`,
    )
    .catch(() => []);
  if (dead?.length) {
    r.ok = false;
    r.note = (r.note || "") + " | DETACHED LEAVES: " + JSON.stringify(dead);
  }
  const errs = await c.js("return window.__errs.filter(e=>!/ResizeObserver/.test(e))").catch(() => []);
  if (errs?.length && !cs.allowErrs) {
    r.ok = false;
    r.note = (r.note || "") + " | console errors: " + JSON.stringify(errs).slice(0, 500);
  }
  res[cs.id] = { ok: r.ok, note: r.note, at: new Date().toISOString() };
  console.log(`${r.ok ? "PASS" : "FAIL"} ${cs.id} ${r.note ?? ""}`);
}
fs.writeFileSync(resFile, JSON.stringify(res, null, 1));
c.close();
