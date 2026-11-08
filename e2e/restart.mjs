// LT-17 and CO-07: across an Obsidian restart (e2e/sandbox.sh restart: same vault and profile), lanes tabs come
// back with their names, own layout, dragged sizes, pinned / collapsed cards and a card's own view mode; and a lanes
// tab restored in the background (not loaded yet) loads cleanly when it's activated and a note is opened into it
// at once, leaving no card leaf detached. LT-09b: "Reset every tab to the default" also resets a lanes tab restored
// in the background and not loaded yet (a third tab, "Restart C", with its own layout).
//
//   npm run e2e:restart              set up, restart the sandbox, check (writes LT-17 and CO-07 to results.json)
//   node e2e/restart.mjs --after     only the checks, after a restart made another way (needs a set-up before it)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { HERE, N, SANDBOX_SH } from "./config.mjs";
import { FILES, NOTES, coreNotes } from "./fixtures.mjs";
import { open } from "./lib.mjs";

const after = process.argv.includes("--after");
const beforeFile = path.join(HERE, "restart.before.json");
const pageCode = ["hook.js", "helpers.js"].map(f => fs.readFileSync(path.join(HERE, f), "utf8"));
const connect = async () => {
  const c = await open();
  c.js = body => c.ev(`(async()=>{${body}})()`);
  for (const code of pageCode) await c.ev(code);
  await c.ev(`window.__lanesFixtures = ${JSON.stringify(coreNotes())}; 1`);
  return c;
};
const j = JSON.stringify;

if (!after) {
  const c = await connect();
  const before =
    await c.js(`await T.reset(); const P=T.P(); const t=T.tab(); await t.setLayout("40, 30x2, 30"); t.rename("Restart A"); await T.sleep(200);
    await P.openInLane(T.f(${j(NOTES.A.path)}),"same",t.lanes[0]); await P.openInLane(T.f(${j(NOTES.RESTART.path)}),"same",t.lanes[1]);
    await P.openInLane(T.f(${j(NOTES.B.path)}),"same",t.lanes[2]); await P.openInLane(T.f(${j(NOTES.C.path)}),"same",t.lanes[3]);
    t.lanes[0].togglePin(t.lanes[0].items[0]); await t.lanes[2].setView(t.lanes[2].items[0],{mode:"preview"}); await t.lanes[3].setCollapsed(t.lanes[3].items[0], true);
    t.sizes={for:"40, 30x2, 30", cols:[30,40,30], rows:[[100],[70,30],[100]]}; t.save();
    await P.newLanesTab(); T.tab().rename("Restart B"); await P.openInLane(T.f(${j(NOTES.D.path)}),"same",T.tab().lanes[0]);
    await P.newLanesTab(); T.tab().rename("Restart C"); await T.tab().setLayout("100");
    // a canvas tab in front: both lanes tabs are restored in the background
    const l=app.workspace.getLeaf("tab"); await l.openFile(T.f(${j(FILES.CANVAS)})); app.workspace.setActiveLeaf(l,{focus:true});
    await T.sleep(800); await app.workspace.saveLayout(); window.__errs=[];
    return app.workspace.getLeavesOfType("editor-lanes").map(x=>x.view.getState()).filter(s=>s.name!=="Restart C")`);
  fs.writeFileSync(beforeFile, JSON.stringify(before, null, 1));
  c.close();
  console.log("restarting sandbox", N);
  execFileSync("bash", [SANDBOX_SH, "restart", String(N)], { stdio: "inherit" });
}

const before = JSON.parse(fs.readFileSync(beforeFile, "utf8"));
const c = await connect();
const r = await c.js(`await T.sleep(1500); const ws=app.workspace; const leaves=()=>ws.getLeavesOfType("editor-lanes");
  const name=l=>l.view.getState?.().name ?? l.getViewState().state?.name;
  const deferred=leaves().map(l=>({name: name(l), deferred: !!l.isDeferred}));
  // CO-07: activate the background "Restart A" and open a note into it at once
  const a=leaves().find(l=>name(l)==="Restart A"); ws.setActiveLeaf(a,{focus:true}); await ws.getLeaf(false).openFile(T.f(${j(NOTES.LONG.path)})); await T.sleep(1500);
  for (const l of leaves().filter(l=>name(l)!=="Restart C")) { ws.setActiveLeaf(l,{focus:true}); await T.sleep(800); }
  const dead=ws.getLeavesOfType("markdown").filter(l=>!l.containerEl.isConnected).length;
  const landed=a.view.lanes?.some(l=>l.items.some(i=>i.file.path===${j(NOTES.LONG.path)}));
  const states=leaves().filter(l=>name(l)!=="Restart C").map(x=>x.view.getState());
  const t=a.view; ws.setActiveLeaf(t.leaf,{focus:true}); await T.sleep(600);
  const ui={widths:[...t.contentEl.querySelectorAll(".lanes-col")].map(c=>Math.round(c.getBoundingClientRect().width)), mode: t.lanes[2].items[0]?.leaf?.getViewState().state.mode, pinnedCls: t.lanes[0].items[0]?.el.classList.contains("is-pinned"), title: document.querySelector(".mod-root .workspace-tab-header.is-active")?.getAttribute("aria-label")};
  // LT-09b: "Restart C" is still in the background, not loaded: the reset loads and resets it
  const cl=leaves().find(l=>name(l)==="Restart C"); const cDeferred=!!cl?.isDeferred; await T.P().resetAllLayouts(); await T.sleep(500);
  const reset={deferred: cDeferred, loaded: !!cl && !cl.isDeferred, own: cl?.view?.layoutInfo?.().own ?? null, lanes: cl?.view?.lanes?.length ?? null};
  return {deferred, dead, landed, states, ui, reset, errs: (window.__errs||[]).filter(e=>!/ResizeObserver/.test(e))}`);
c.close();

// LT-17: each tab as it was (Restart A may have one card more: CO-07's note)
const cards = st =>
  st.lanes.map(l => l.map(d => ({ path: d.path, collapsed: d.collapsed, pinned: !!d.pinned, view: d.view ?? null })));
const byName = Object.fromEntries(r.states.map(s => [s.name, s]));
const same = before.every(b => {
  const a = byName[b.name];
  if (!a || a.layout !== b.layout || JSON.stringify(a.sizes ?? null) !== JSON.stringify(b.sizes ?? null)) return false;
  const want = cards(b);
  const got = cards(a).map(l => l.filter(d => d.path !== NOTES.LONG.path));
  return JSON.stringify(want) === JSON.stringify(got);
});
const w = r.ui.widths;
const lt17 =
  same &&
  w.length === 3 &&
  Math.abs(w[0] - w[2]) <= 2 &&
  w[1] > w[0] &&
  r.ui.mode === "preview" &&
  r.ui.pinnedCls === true &&
  r.ui.title === "Editor lane Restart A" &&
  r.errs.length === 0;
const co07 = r.deferred.some(d => d.name === "Restart A" && d.deferred) && r.landed === true && r.dead === 0;

const resFile = path.join(HERE, "results.json");
const res = fs.existsSync(resFile) ? JSON.parse(fs.readFileSync(resFile, "utf8")) : {};
const at = new Date().toISOString();
const put = (id, ok, note) => {
  res[id] = { status: ok ? "pass" : "fail", ok, note, at };
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${note}`);
};
put("LT-17", lt17, JSON.stringify({ same, ui: r.ui, errs: r.errs }));
put("CO-07", co07, JSON.stringify({ deferred: r.deferred, landed: r.landed, dead: r.dead }));
const lt09b = r.reset.deferred && r.reset.loaded && r.reset.own === false && r.reset.lanes === 3;
put("LT-09b", lt09b, JSON.stringify(r.reset));
fs.writeFileSync(resFile, JSON.stringify(res, null, 1));
process.exit(lt17 && co07 && lt09b ? 0 : 1);
