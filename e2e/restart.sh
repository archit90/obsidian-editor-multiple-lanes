#!/bin/bash
# LT-17 + CO-07: state survives an Obsidian restart; no detached card leaves after restore (background lanes tab)
cd "$(dirname "$0")"; H=..
timeout 90 ./e "$(cat hook.js)" >/dev/null; timeout 90 ./e "$(cat helpers.js)" >/dev/null
timeout 90 ./e '(async()=>{ await T.reset(); const P=T.P(); const t=T.tab(); await t.setLayout("40, 30x2, 30"); t.rename("Restart A"); await T.sleep(200);
 await P.openInLane(T.f("z/Writing replaces caching.md"),"same",t.lanes[0]); await P.openInLane(T.f("_test/e2e.md"),"same",t.lanes[1]); await P.openInLane(T.f("z/Writing hides attention.md"),"same",t.lanes[2]); await P.openInLane(T.f("z/Writing delays interfaces.md"),"same",t.lanes[3]);
 t.lanes[0].togglePin(t.lanes[0].items[0]); await t.lanes[2].setView(t.lanes[2].items[0],{mode:"preview"}); await t.lanes[3].setCollapsed(t.lanes[3].items[0], true);
 t.sizes={for:"40, 30x2, 30", cols:[30,40,30], rows:[[100],[70,30],[100]]}; t.save();
 await P.newLanesTab(); T.tab().rename("Restart B"); await P.openInLane(T.f("z/Vocabulary predicts money.md"),"same",T.tab().lanes[0]);
 const l=app.workspace.getLeaf("tab"); await l.openFile(T.f("Untitled.canvas")); app.workspace.setActiveLeaf(l,{focus:true});
 await T.sleep(800); await app.workspace.saveLayout(); return app.workspace.getLeavesOfType("editor-lanes").map(x=>JSON.stringify(x.view.getState()))})()' > restart.before.json
bash ../../../tools/obs-sandbox.sh stop 3; bash ../../../tools/obs-sandbox.sh start 3 | tail -1; node fit.mjs >/dev/null
timeout 90 ./e "$(cat hook.js)" >/dev/null; timeout 90 ./e "$(cat helpers.js)" >/dev/null
timeout 90 ./e '(async()=>{ await T.sleep(1500); const deferred=app.workspace.getLeavesOfType("editor-lanes").map(l=>l.view.constructor.name+":"+!!l.view.lanes); const lanesA=app.workspace.getLeavesOfType("editor-lanes")[0]; app.workspace.setActiveLeaf(lanesA,{focus:true}); await app.workspace.getLeaf(false).openFile(T.f("_test/e2e.md")); await T.sleep(1500);
 for (const l of app.workspace.getLeavesOfType("editor-lanes")) { app.workspace.setActiveLeaf(l,{focus:true}); await T.sleep(800); }
 const dead=app.workspace.getLeavesOfType("markdown").filter(l=>!l.containerEl.isConnected).length;
 const states=app.workspace.getLeavesOfType("editor-lanes").map(x=>JSON.stringify(x.view.getState()));
 const t=app.workspace.getLeavesOfType("editor-lanes")[0].view; app.workspace.setActiveLeaf(t.leaf,{focus:true}); await T.sleep(600);
 const ui={widths:[...t.contentEl.querySelectorAll(".lanes-col")].map(c=>Math.round(c.getBoundingClientRect().width)), mode: t.lanes[2].items[0]?.leaf?.getViewState().state.mode, pinnedCls: t.lanes[0].items[0]?.el.classList.contains("is-pinned"), title: document.querySelector(".mod-root .workspace-tab-header.is-active")?.getAttribute("aria-label")};
 return {deferred, dead, states, ui, errs: window.__errs}})()' > restart.after.json
cat restart.before.json; cat restart.after.json
