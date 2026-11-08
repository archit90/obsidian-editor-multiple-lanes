import { A, B, C, D, openIn, clickLine, clickLinkIn, st, eq } from "./common.mjs";
const item = (lane, i) => `T.tab().lanes[${lane}].items[${i}]`;
export const cases = [
  {
    id: "CO-01",
    run: async c => {
      await c.js(`await T.tab().setLayout("40, 60"); T.tab().rename("WS one"); await T.sleep(200); return 1`);
      await openIn(c, A, 0);
      await openIn(c, B, 1);
      await c.js(
        `const l=T.tab().lanes[1]; l.togglePin(l.items[0]); await T.P().newLanesTab(); T.tab().rename("WS two"); await T.P().openInLane(T.f(${JSON.stringify(C)}),"same",T.tab().lanes[2]); await T.sleep(300); const ws=app.internalPlugins.getEnabledPluginById("workspaces"); ws.saveWorkspace("EL test"); await T.sleep(500); return 1`,
      );
      const before = await c.js(
        `return app.workspace.getLeavesOfType("editor-lanes").map(l=>{const s=l.view.getState(); return {name:s.name, layout:s.layout??null, lanes: s.lanes.map(x=>x.map(d=>d.path+(d.pinned?"*":"")))}})`,
      );
      await c.js(
        `await T.reset(); await T.P().openInLane(T.f(${JSON.stringify(D)}),"same",T.tab().lanes[0]); await T.sleep(300); const ws=app.internalPlugins.getEnabledPluginById("workspaces"); await ws.loadWorkspace("EL test"); await T.sleep(2500); return 1`,
      );
      const after = await c.js(
        `return app.workspace.getLeavesOfType("editor-lanes").map(l=>{const s=l.view.getState?.() ?? l.getViewState().state; return {name:s.name, layout:s.layout??null, lanes: s.lanes.map(x=>x.map(d=>d.path+(d.pinned?"*":"")))}})`,
      );
      const mounted = await c.js(
        `app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("editor-lanes")[0],{focus:true}); await T.sleep(800); return T.P().hostedLeaves.size`,
      );
      await c.js(
        `const ws=app.internalPlugins.getEnabledPluginById("workspaces"); ws.deleteWorkspace("EL test"); return 1`,
      );
      return { ok: eq(before, after) && mounted >= 2, note: JSON.stringify({ before, after, mounted }) };
    },
  },
  {
    id: "CO-02",
    run: async c => {
      await c.js(
        `const l=app.workspace.getLeaf("tab"); await l.setViewState({type:"editor-lane", state:{}}); const n=app.workspace.getLeaf("tab"); await n.setViewState({type:"editor-lanes-navigator", state:{}}); await T.sleep(1500); return 1`,
      );
      const r = await c.js(
        `return {roots: T.roots(), left: ["file-explorer","search","bookmarks"].map(t=>app.workspace.getLeavesOfType(t).length), placeholder: document.querySelectorAll(".workspace-leaf-content[data-type='editor-lane'], .workspace-leaf-content[data-type='editor-lanes-navigator']").length}`,
      );
      return {
        ok: r.roots.every(x => x.startsWith("editor-lanes:")) && r.left.every(n => n >= 1) && r.placeholder === 0,
        note: JSON.stringify(r),
        allowErrs: false,
      };
    },
  },
  {
    id: "CO-03",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 1);
      await c.js(`T.tab().lanes[1].togglePin(T.tab().lanes[1].items[0]); return 1`);
      const before = await c.js(`return JSON.stringify(T.tab().getState())`);
      const r = await c.js(
        `const domBefore=document.querySelectorAll(".lane-split").length; await app.plugins.disablePlugin("editor-multiple-lanes"); await T.sleep(800); const off={splits: document.querySelectorAll(".lane-split").length, lanesDom: document.querySelectorAll(".lane").length, patched: app.workspace.iterateLeaves.toString().includes("splits"), md: app.workspace.getLeavesOfType("markdown").length}; await app.plugins.enablePlugin("editor-multiple-lanes"); await T.sleep(2000); return {domBefore, off, after: JSON.stringify(T.tab().getState())}`,
      );
      const strip = s => JSON.stringify(JSON.parse(s).lanes.map(l => l.map(d => d.path + d.pinned)));
      return {
        ok:
          r.off.splits === 0 &&
          r.off.lanesDom === 0 &&
          !r.off.patched &&
          r.off.md === 0 &&
          strip(before) === strip(r.after) &&
          JSON.parse(before).name === JSON.parse(r.after).name,
        note: JSON.stringify({ ...r, before }),
      };
    },
  },
  {
    id: "CO-04",
    needs: "backlinks-full-view",
    run: async c => {
      await openIn(c, A, 0);
      await c.sleep(1500);
      await c.clickEl(`${item(0, 0)}.el.querySelector(".bfv-panel.bfv-base .bfv-header")`, { wait: 2000 });
      const has = await c.js(
        `return [...${item(0, 0)}.el.querySelectorAll(".bfv-container a.internal-link, .bfv-container .internal-link")].length`,
      );
      if (!has) return { ok: false, note: "no link in BFV pane" };
      await c.js(
        `const t=${item(0, 0)}.el.querySelector(".bfv-container .tree-item-self, .bfv-container summary, .bfv-container [class*=toggle]"); return 1`,
      );
      const target = await c.js(
        `const a=[...${item(0, 0)}.el.querySelectorAll(".bfv-container a.internal-link, .bfv-container .internal-link")].find(a=>a.offsetParent); return a ? (a.getAttribute("data-href")||a.textContent) : null`,
      );
      if (!target) return { ok: false, note: "BFV links not visible: " + has };
      await c.clickEl(
        `[...${item(0, 0)}.el.querySelectorAll(".bfv-container a.internal-link, .bfv-container .internal-link")].find(a=>a.offsetParent)`,
        { wait: 1200 },
      );
      const s = await st(c);
      return { ok: s.roots.length === 1 && s.lanes[1].length === 1, note: target + " " + JSON.stringify(s) };
    },
  },
  {
    id: "CO-05",
    run: async c => {
      await openIn(c, A, 0);
      const r = await c
        .js(
          `const v=${item(0, 0)}.leaf.view; const proto=Object.getPrototypeOf(v.editMode); const l=app.workspace.getLeaf("split"); await l.setViewState({type:"markdown", state:{file:"_test/Outline mode.md", mode:"source"}}); await T.sleep(600); l.view.editMode.applyScroll(120); await T.sleep(300); const sc=l.view.editMode.cm.scrollDOM.scrollTop; const nonCardScroll = l.view.scroll; l.detach(); return {sc, nonCardScroll, cardScroll: v.scroll}`,
        )
        .catch(e => ({ err: String(e) }));
      return { ok: r.sc > 1000 && r.cardScroll === null, note: JSON.stringify(r) };
    },
  },
];
