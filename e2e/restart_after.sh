#!/bin/bash
cd "$(dirname "$0")"
timeout 90 ./e "$(cat hook.js)" >/dev/null; timeout 90 ./e "$(cat helpers.js)" >/dev/null
timeout 90 ./e '(async()=>{ await T.sleep(1500); const deferred=app.workspace.getLeavesOfType("editor-lanes").map(l=>l.view.constructor.name+":"+!!l.view.lanes); const lanesA=app.workspace.getLeavesOfType("editor-lanes")[0]; app.workspace.setActiveLeaf(lanesA,{focus:true}); await app.workspace.getLeaf(false).openFile(T.f("_test/e2e.md")); await T.sleep(1500);
 for (const l of app.workspace.getLeavesOfType("editor-lanes")) { app.workspace.setActiveLeaf(l,{focus:true}); await T.sleep(800); }
 const dead=app.workspace.getLeavesOfType("markdown").filter(l=>!l.containerEl.isConnected).length;
 const states=app.workspace.getLeavesOfType("editor-lanes").map(x=>JSON.stringify(x.view.getState()));
 const t=app.workspace.getLeavesOfType("editor-lanes")[0].view; app.workspace.setActiveLeaf(t.leaf,{focus:true}); await T.sleep(600);
 const ui={widths:[...t.contentEl.querySelectorAll(".lanes-col")].map(c=>Math.round(c.getBoundingClientRect().width)), mode: t.lanes[2].items[0]?.leaf?.getViewState().state.mode, pinnedCls: t.lanes[0].items[0]?.el.classList.contains("is-pinned"), title: document.querySelector(".mod-root .workspace-tab-header.is-active")?.getAttribute("aria-label")};
 return {deferred, dead, states, ui, errs: window.__errs}})()' > restart.after.json
cat restart.before.json; cat restart.after.json
