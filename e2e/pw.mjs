import { A, B, C, D, openIn, clickLine, eq, tB, tD } from "./common.mjs";
import { connect } from "./cdp.mjs";
import { PORT } from "./config.mjs";
const item = (lane, i) => `T.tab().lanes[${lane}].items[${i}]`;
const wins = `app.workspace.floatingSplit.children.filter(w=>w.win)`;
export const cases = [
  {
    id: "LT-13",
    run: async c => {
      await c.js(`await T.tab().setLayout("40, 60"); return 1`);
      await openIn(c, A, 0);
      await c.js(
        `app.workspace.duplicateLeaf(app.workspace.getLeavesOfType("editor-lanes")[0], "window"); await T.sleep(1500); return 1`,
      );
      const r1 = await c.js(
        `const w=${wins}; const t=app.workspace.getLeavesOfType("editor-lanes").find(l=>l.getRoot()===app.workspace.floatingSplit); return {wins: w.length, popTab: t && {layout: t.view.layoutInfo().text, n: t.view.lanes.flatMap(l=>l.items).length, name: t.view.tabName()}, main: T.tabs()[0].lanes.flatMap(l=>l.items).length}`,
      );
      await c.js(`for (const w of ${wins}) w.win.close(); await T.sleep(800); return 1`);
      // move the whole tab to a new window
      await c.js(
        `app.workspace.moveLeafToPopout(app.workspace.getLeavesOfType("editor-lanes")[0]); await T.sleep(2000); return 1`,
      );
      const r2 = await c.js(
        `const t=app.workspace.getLeavesOfType("editor-lanes").find(l=>l.getRoot()===app.workspace.floatingSplit); const it=t?.view.lanes[0].items[0]; return {inPop: !!t, item: it?.file.path, mounted: !!it?.leaf, conn: it?.leaf?.containerEl.isConnected, doc: it?.leaf?.containerEl.ownerDocument!==document, mainRoots: T.roots().length}`,
      );
      // type in the popout card via its own CDP target
      let typed = null;
      try {
        const p = await connect(PORT, t => t.url === "about:blank" && !/Settings/.test(t.title));
        await p.ev(`(()=>{const ed=document.querySelector(".lane-item .cm-content"); ed.focus(); return 1})()`);
        await p.send("Input.insertText", { text: "POPTYPE " });
        await new Promise(r => setTimeout(r, 300));
        typed = await c.js(
          `const t=app.workspace.getLeavesOfType("editor-lanes").find(l=>l.getRoot()===app.workspace.floatingSplit); return t.view.lanes[0].items[0].leaf.view.editor.getValue().includes("POPTYPE")`,
        );
        await p.ev(`(()=>{document.execCommand("undo"); return 1})()`);
        p.close();
      } catch (e) {
        typed = "ERR " + e.message;
      }
      await c.js(
        `const t=app.workspace.getLeavesOfType("editor-lanes").find(l=>l.getRoot()===app.workspace.floatingSplit); t.view.lanes[0].items[0].leaf.view.editor.undo(); await T.sleep(300); return 1`,
      );
      await c.js(`for (const w of ${wins}) w.win.close(); await T.sleep(800); return 1`);
      const after = await c.js(`return {roots: T.roots(), hosted: T.P().hostedLeaves.size}`);
      return {
        ok:
          r1.wins === 1 &&
          r1.popTab?.layout === "40, 60" &&
          r1.popTab.n === 0 &&
          r1.main === 1 &&
          r2.inPop &&
          r2.item === A &&
          r2.mounted &&
          r2.conn &&
          r2.doc &&
          typed === true,
        note: JSON.stringify({ r1, r2, typed, after }),
      };
    },
  },
  {
    id: "RO-18",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 0);
      await c.js(
        `const L=T.tab().lanes[0]; L.togglePin(L.items.find(i=>i.file.path===${JSON.stringify(A)})); return 1`,
      );
      await clickLine(c, `T.tab().lanes[0].items.find(i=>i.file.path===${JSON.stringify(A)})`, 1);
      // what "Move to new window" (the tab menu, the command) calls: it returns the new window, as for a tab
      const ret = await c.js(
        `const w=app.workspace.moveLeafToPopout(app.workspace.activeLeaf); await T.sleep(2000); return {win: !!w?.win}`,
      );
      const r = await c.js(
        `const t=app.workspace.getLeavesOfType("editor-lanes").find(l=>l.getRoot()===app.workspace.floatingSplit); const it=t?.view.lanes[0].items[0]; const main=app.workspace.getLeavesOfType("editor-lanes").find(l=>l.getRoot()===app.workspace.rootSplit); return {pop: it && {file: it.file.path, pinned: it.pinned, mounted: !!it.leaf}, main: main.view.lanes.map(l=>l.items.map(i=>i.file.basename))}`,
      );
      // routing in the popout: an open while the popout is active goes to the popout's lanes tab
      const r2 = await c.js(
        `const t=app.workspace.getLeavesOfType("editor-lanes").find(l=>l.getRoot()===app.workspace.floatingSplit); app.workspace.setActiveLeaf(t.view.lanes[0].items[0].leaf, {focus:true}); await T.sleep(300); await app.workspace.getLeaf(false).openFile(T.f(${JSON.stringify(D)})); await T.sleep(1000); return {pop: t.view.lanes.map(l=>l.items.map(i=>i.file.basename))}`,
      );
      await c.js(`for (const w of ${wins}) w.win.close(); await T.sleep(800); return 1`);
      return {
        ok:
          ret.win &&
          r.pop?.file === A &&
          r.pop.pinned &&
          r.pop.mounted &&
          eq(r.main[0], [tB]) &&
          r2.pop.flat().includes(tD),
        note: JSON.stringify({ ret, r, r2 }),
      };
    },
  },
  {
    id: "LT-15",
    run: async c => {
      await openIn(c, A, 0);
      await c.js(
        `const l=app.workspace.getLeaf("split","vertical"); await l.setViewState({type:"graph"}); await T.sleep(300); const lanes=app.workspace.getLeavesOfType("editor-lanes")[0]; const target=l.parent; lanes.parent.removeChild(lanes); target.insertChild(1, lanes); app.workspace.setActiveLeaf(lanes,{focus:true}); await T.sleep(800); return 1`,
      );
      const r = await c.js(
        `const it=T.tab().lanes[0].items[0]; return {mounted: !!it.leaf, conn: it.leaf?.containerEl.isConnected, w: Math.round(T.tab().contentEl.getBoundingClientRect().width), roots: T.roots()}`,
      );
      await clickLine(c, item(0, 0), 1);
      await c.type("Q");
      await c.sleep(200);
      const v = await c.js(
        `const e=${item(0, 0)}.leaf.view.editor; const ok=e.getValue().includes("Q"); e.undo(); return ok`,
      );
      return { ok: r.mounted && r.conn && v, note: JSON.stringify({ r, v }) };
    },
  },
  {
    id: "LT-18",
    run: async c => {
      await c.js(
        `const l=app.workspace.getLeavesOfType("editor-lanes")[0]; await l.setViewState({type:"editor-lanes", state:{name:"Extra", lanes:[[{path:${JSON.stringify(A)},collapsed:false}],[{path:${JSON.stringify(B)},collapsed:true}],[{path:${JSON.stringify(C)},collapsed:false}],[{path:${JSON.stringify(D)},collapsed:false,pinned:true}],[{path:${JSON.stringify(A)},collapsed:false}],[{path:"nope/missing.md",collapsed:false}]]}}); await T.sleep(800); return 1`,
      );
      const r = await c.js(`return {lanes: T.lanes(), name: T.tab().tabName()}`);
      return {
        ok:
          r.lanes.length === 3 &&
          r.lanes.flat().length === 5 &&
          r.name === "Extra" &&
          r.lanes.flat().includes(`P:${tD}`),
        note: JSON.stringify(r),
      };
    },
  },
];
