// Contracts with other plugins, tested without them by doing in the page what the partner does (SPEC.md, Working
// with other plugins). The cases that run with the real partner have `needs` (CO-04, NE-20, NE-23, NE-24, PK-05,
// RO-21, RO-25).
import { A, B, C, NOTES, MOD, openIn, clickLine, st, eq, tA } from "./common.mjs";
const L2 = NOTES.L2;
const L3 = NOTES.L3;
const card = (lane, i) => `T.tab().lanes[${lane}].items[${i}]`;
// what Backlinks Full View puts under a note: a card element carrying data-bfv-path (its note) with links in it;
// its links follow Obsidian's conventions through workspace.openLinkText (BFV wireLinks)
const bfvLike = (parentExpr, id) => `(()=>{
  const host=(${parentExpr}); const box=host.ownerDocument.createElement("div"); box.id=${JSON.stringify(id)}; box.className="el-contract-pane";
  box.setAttribute("data-bfv-path", ${JSON.stringify(L2.path)});
  const a=box.ownerDocument.createElement("a"); a.className="internal-link"; a.setAttribute("data-href", ${JSON.stringify(L3.title)}); a.setAttribute("href", ${JSON.stringify(L3.title)}); a.textContent=${JSON.stringify(L3.title)};
  box.appendChild(a); host.appendChild(box); window.__clicks=0;
  const source=el=>el.closest("[data-bfv-path]")?.getAttribute("data-bfv-path") ?? "";
  box.addEventListener("click", e=>{ window.__clicks++; const l=e.target.closest("a.internal-link"); if(!l) return; e.preventDefault(); e.stopPropagation(); const mod=e.ctrlKey||e.metaKey; app.workspace.openLinkText(l.getAttribute("data-href"), source(l), mod ? (e.altKey ? (e.shiftKey ? "window" : "split") : "tab") : false); });
  box.addEventListener("auxclick", e=>{ const l=e.target.closest("a.internal-link"); if(!l || e.button!==1) return; e.preventDefault(); e.stopPropagation(); app.workspace.openLinkText(l.getAttribute("data-href"), source(l), "tab"); });
  return 1})()`;
const linkIn = id => `document.getElementById(${JSON.stringify(id)}).querySelector("a.internal-link")`;
export const cases = [
  {
    id: "BF-01",
    run: async c => {
      // "Show backlinks panes under lane notes" off: every lanes tab's .lanes-view carries data-bfv-skip="editor-lanes"
      // (tabs made later and tabs in popouts too); on: none do; each change fires layout-change
      const r = await c.js(`const P=T.P(); const ws=app.workspace; let n=0; const ref=ws.on("layout-change",()=>n++);
        try {
          await P.newLanesTab(); const pop=ws.openPopoutLeaf(); await P.newTab(pop); await T.sleep(1000);
          P.settings.showBacklinks=false; let n0=n; await P.settingsChanged("backlinks"); await T.sleep(300);
          const fired1=n-n0; const off=P.allTabs().map(t=>t.contentEl.getAttribute("data-bfv-skip"));
          await P.newLanesTab(); await T.sleep(300); const offNew=P.allTabs().map(t=>t.contentEl.getAttribute("data-bfv-skip"));
          const lanesView=P.allTabs().every(t=>t.contentEl.classList.contains("lanes-view"));
          // Lanes doesn't style Backlinks Full View's elements (without BFV nothing hides a .bfv-container)
          const probe=T.tab().contentEl.createDiv({cls:"bfv-container"}); probe.setText("x"); const shown=!app.plugins.plugins["backlinks-full-view"] ? getComputedStyle(probe).display!=="none" : null; probe.remove();
          P.settings.showBacklinks=true; n0=n; await P.settingsChanged("backlinks"); await T.sleep(300);
          const fired2=n-n0; const on=P.allTabs().map(t=>t.contentEl.getAttribute("data-bfv-skip"));
          return {off, offNew, on, fired1, fired2, lanesView, shown, popout: P.allTabs().some(t=>t.leaf.getRoot()===ws.floatingSplit)};
        } finally { ws.offref(ref); }`);
      return {
        ok:
          r.off.length >= 3 &&
          r.off.every(v => v === "editor-lanes") &&
          r.offNew.every(v => v === "editor-lanes") &&
          r.on.every(v => v === null) &&
          r.fired1 >= 1 &&
          r.fired2 >= 1 &&
          r.lanesView &&
          r.popout &&
          r.shown !== false,
        note: JSON.stringify(r),
      };
    },
  },
  {
    id: "BF-02",
    run: async c => {
      // Shift-click on a link in a BFV card under a lanes card: resolved from the card's note (data-bfv-path), opened
      // in the lane used last before this one; the press is Lanes' (the pane's own click handler gets nothing)
      await openIn(c, A, 0);
      await c.clickEl(`document.querySelectorAll(".lane")[2]`, { dy: 400 });
      await c.js(`${bfvLike(`${card(0, 0)}.bodyEl`, "el-bf02")}; return 1`);
      await c.js(
        `const mc=app.metadataCache; window.__spy=[]; window.__orig=mc.getFirstLinkpathDest; mc.getFirstLinkpathDest=function(p,s){ window.__spy.push([p,s]); return window.__orig.call(this,p,s); }; return 1`,
      );
      try {
        await c.clickEl(linkIn("el-bf02"), { mods: MOD.shift, wait: 900 });
      } finally {
        await c.js(`app.metadataCache.getFirstLinkpathDest=window.__orig; return 1`);
      }
      const r = await c.js(`return {spy: window.__spy, clicks: window.__clicks}`);
      let s = await st(c);
      const t1 =
        r.spy.some(([p, src]) => p === L3.title && src === L2.path) && r.clicks === 0 && s.lanes[2][0] === L3.title;
      // Shift+Alt: a new lanes tab
      await c.js(`${bfvLike(`${card(0, 0)}.bodyEl`, "el-bf02b")}; return 1`);
      await c.clickEl(linkIn("el-bf02b"), { mods: MOD.shift | MOD.alt, wait: 900 });
      s = await st(c);
      const t2 = s.roots.length === 2 && s.active.startsWith(`card:${L3.title}@0`);
      return { ok: t1 && t2, note: JSON.stringify({ r, t1, t2, s }) };
    },
  },
  {
    id: "BF-03",
    run: async c => {
      // a plain click on a link in a BFV pane under a card (in the editor's sizer, where BFV puts its panes): a link
      // followed in that card, so the next lane; Ctrl/Cmd-click and middle-click: a new lanes tab. Reading view too.
      await openIn(c, A, 0);
      await c.js(`${bfvLike(`${card(0, 0)}.el.querySelector(".cm-sizer")`, "el-bf03")}; return 1`);
      await c.clickEl(linkIn("el-bf03"), { wait: 1200 });
      let s = await st(c);
      const plain = eq(s.lanes, [[tA], [L3.title], []]) && s.active === `card:${L3.title}@1` && s.roots.length === 1;
      await c.js(
        `app.workspace.setActiveLeaf(${card(0, 0)}.leaf,{focus:true}); await T.sleep(200); ${bfvLike(`${card(0, 0)}.el.querySelector(".cm-sizer")`, "el-bf03b")}; return 1`,
      );
      await c.clickEl(linkIn("el-bf03b"), { mods: MOD.ctrl, wait: 1200 });
      s = await st(c);
      const ctrl = s.roots.length === 2 && s.active.startsWith(`card:${L3.title}@0`);
      await c.js(
        `app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("editor-lanes")[0],{focus:true}); await T.sleep(300); ${bfvLike(`${card(0, 0)}.el.querySelector(".cm-sizer")`, "el-bf03c")}; return 1`,
      );
      await c.clickEl(linkIn("el-bf03c"), { button: "middle", wait: 1200 });
      s = await st(c);
      const middle = s.roots.length === 3;
      // Reading view: BFV puts the pane in the renderer's footer
      await c.js(
        `app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("editor-lanes")[0],{focus:true}); await T.sleep(200); const l=T.tab().lanes[0]; await l.setView(l.items[0],{mode:"preview"}); await T.sleep(800); for (const it of [...T.tab().lanes[1].items]) T.tab().lanes[1].close(it); ${bfvLike(`${card(0, 0)}.leaf.view.previewMode.renderer.footer.el`, "el-bf03d")}; return 1`,
      );
      await c.clickEl(linkIn("el-bf03d"), { wait: 1200 });
      s = await st(c);
      const reading = s.lanes[1][0] === L3.title;
      return { ok: plain && ctrl && middle && reading, note: JSON.stringify({ plain, ctrl, middle, reading, s }) };
    },
  },
  {
    id: "BF-04",
    run: async c => {
      // card leaves are ordinary markdown leaves: in getLeavesOfType("markdown") and iterateAllLeaves exactly once,
      // inside .lanes-view / the lanes tab's leaf content, rooted in the right sidebar, in the tab's window; gone
      // when the card closes
      await openIn(c, A, 0);
      await openIn(c, B, 1);
      await clickLine(c, card(1, 0), 1);
      const r =
        await c.js(`const ws=app.workspace; const P=T.P(); const tab=T.tab(); const hosted=[...P.hostedLeaves.keys()];
        const byType=ws.getLeavesOfType("markdown"); const all=[]; ws.iterateAllLeaves(l=>{ if(l.view?.getViewType()==="markdown") all.push(l); });
        const MV=hosted[0].view.constructor;
        const each=hosted.map(l=>({once: byType.filter(x=>x===l).length===1 && all.filter(x=>x===l).length===1, md: l.view instanceof MV, lanesView: l.view.containerEl.closest(".lanes-view")===tab.contentEl, content: !!l.view.containerEl.closest('.workspace-leaf-content[data-type="editor-lanes"]'), root: l.getRoot()===ws.rightSplit, container: l.getContainer()===tab.leaf.getContainer()}));
        const activeIsB=ws.getActiveViewOfType(MV)?.file?.path===${JSON.stringify(B)};
        const l1=tab.lanes[1]; l1.close(l1.items[0]); await T.sleep(300);
        const after=ws.getLeavesOfType("markdown").filter(l=>l.view.containerEl.closest(".lanes-view")).map(l=>l.view.file.path);
        return {n: hosted.length, each, activeIsB, after}`);
      return {
        ok:
          r.n === 2 &&
          r.each.every(e => e.once && e.md && e.lanesView && e.content && e.root && e.container) &&
          r.activeIsB &&
          eq(r.after, [A]),
        note: JSON.stringify(r),
      };
    },
  },
  {
    id: "BF-05",
    run: async c => {
      // a card's editor forces its own bottom padding (none), which Backlinks Full View keeps; a normal tab doesn't
      await openIn(c, A, 0);
      const r =
        await c.js(`const cm=${card(0, 0)}.leaf.view.editor.cm.contentDOM; const keep=cm.style.paddingBottom; cm.style.paddingBottom="77px"; const inCard=getComputedStyle(cm).paddingBottom; cm.style.paddingBottom=keep;
        const P=T.P(); P.settings.routeExceptions=${JSON.stringify(C)}; await P.settingsChanged("routing"); const l=app.workspace.getLeaf("tab"); await l.openFile(T.f(${JSON.stringify(C)})); await T.sleep(600);
        const cm2=l.view.editor.cm.contentDOM; const keep2=cm2.style.paddingBottom; cm2.style.paddingBottom="77px"; const inTab=getComputedStyle(cm2).paddingBottom; cm2.style.paddingBottom=keep2;
        return {inCard, inTab}`);
      return { ok: r.inCard === "0px" && r.inTab === "77px", note: JSON.stringify(r) };
    },
  },
  {
    id: "API-01",
    run: async c => {
      // what other plugins' test suites may use (SPEC.md, Working with other plugins), and that it behaves so
      const r = await c.js(`const P=app.plugins.plugins["editor-multiple-lanes"]; const ws=app.workspace;
        const types={lanesOnly: typeof P.settings.lanesOnly, showBacklinks: typeof P.settings.showBacklinks, routeExceptions: typeof P.settings.routeExceptions, saveSettings: typeof P.saveSettings, settingsChanged: typeof P.settingsChanged};
        const saved={lanesOnly: P.settings.lanesOnly, routeExceptions: P.settings.routeExceptions, showBacklinks: P.settings.showBacklinks};
        try {
          const lanes=ws.getLeavesOfType("editor-lanes")[0]; ws.setActiveLeaf(lanes,{focus:true}); await T.sleep(200);
          await ws.getLeaf(false).openFile(T.f(${JSON.stringify(A)})); await T.sleep(800);
          const cardLeaf=ws.getLeavesOfType("markdown").find(l=>l.view.file?.path===${JSON.stringify(A)} && l.view.containerEl.closest(".lanes-view"));
          const found=!!cardLeaf && !!cardLeaf.view.containerEl.closest('.workspace-leaf-content[data-type="editor-lanes"]');
          // a card's view state set directly (as partner harnesses do): its mode button and saved mode follow
          const st=cardLeaf.view.getState(); await cardLeaf.view.setState({...st, mode:"source", source:true}, {history:false}); await T.sleep(500);
          const it=T.tab().lanes.flatMap(l=>l.items).find(i=>i.leaf===cardLeaf); const mode={btn: it?.el.getAttribute("data-view-mode"), saved: it?.view};
          // an exception, applied with settingsChanged("routing"): a normal tab
          P.settings.routeExceptions=${JSON.stringify(B)}; await P.settingsChanged("routing");
          const t1=ws.getLeaf("tab"); await t1.openFile(T.f(${JSON.stringify(B)})); await T.sleep(800);
          const excepted=t1.view?.getViewType()==="markdown" && !t1.view.containerEl.closest(".lanes-view");
          // showBacklinks: settingsChanged("backlinks") updates data-bfv-skip; saveSettings alone doesn't
          P.settings.showBacklinks=false; await P.saveSettings(); const afterSave=T.tab().contentEl.getAttribute("data-bfv-skip");
          await P.settingsChanged("backlinks"); const afterChanged=T.tab().contentEl.getAttribute("data-bfv-skip");
          // lanes only off, applied with settingsChanged("routing"): notes open in normal tabs
          P.settings.lanesOnly=false; await P.settingsChanged("routing"); const t2=ws.getLeaf("tab"); await t2.openFile(T.f(${JSON.stringify(C)})); await T.sleep(600);
          const offTab=t2.view?.getViewType()==="markdown" && !t2.view.containerEl.closest(".lanes-view");
          return {types, found, mode, excepted, afterSave, afterChanged, offTab};
        } finally { Object.assign(P.settings, saved); await P.settingsChanged("all"); }`);
      const t = r.types;
      return {
        ok:
          t.lanesOnly === "boolean" &&
          t.showBacklinks === "boolean" &&
          t.routeExceptions === "string" &&
          t.saveSettings === "function" &&
          t.settingsChanged === "function" &&
          r.found &&
          r.mode.btn === "source" &&
          r.mode.saved?.source === true &&
          r.excepted &&
          r.afterSave === null &&
          r.afterChanged === "editor-lanes" &&
          r.offTab,
        note: JSON.stringify(r),
      };
    },
  },
  {
    id: "CS-01",
    run: async c => {
      // a card's editor doesn't scroll (it's as tall as its note): the lane does, or with "Note height: capped" the
      // card body (Editor Outliner's drag autoscroll looks for this scroller)
      await openIn(c, NOTES.LONG.path, 0);
      const scroller = `(()=>{const it=${card(0, 0)}; const sd=it.leaf.view.editor.cm.scrollDOM; let s=sd.parentElement; while(s && !(/(auto|scroll)/.test(getComputedStyle(s).overflowY) && s.scrollHeight>s.clientHeight+1)) s=s.parentElement; return {own: sd.scrollHeight<=sd.clientHeight+1, list: s===T.tab().lanes[0].listEl, body: s===it.bodyEl}})()`;
      const grow = await c.js(`return ${scroller}`);
      await c.js(`T.P().settings.noteHeight="cap"; await T.P().settingsChanged("looks"); await T.sleep(500); return 1`);
      const cap = await c.js(`return ${scroller}`);
      return { ok: grow.own && grow.list && cap.own && cap.body, note: JSON.stringify({ grow, cap }) };
    },
  },
  {
    id: "NN-01",
    run: async c => {
      // what Templater / Editor Defaults do for a new note, with the caret in a card: create it, open it with its
      // title to name (eState.rename). It goes to the card's lane (the last-used one), its title is selected, and it's
      // the active editor right away (a template's cursor jump needs that)
      await openIn(c, A, 0);
      await clickLine(c, card(0, 0), 1);
      const r =
        await c.js(`const p="_test/EL nn.md"; if(T.f(p)) await app.vault.delete(T.f(p)); const f=await app.vault.create(p,"x");
        await app.workspace.getLeaf(false).openFile(f,{state:{mode:"source"}, eState:{rename:"all"}}); await T.sleep(600);
        const it=T.tab().lanes.flatMap(l=>l.items).find(i=>i.file===f); const lane=T.tab().lanes.findIndex(l=>l.items.includes(it));
        const r={lane, titleFocused: document.activeElement===it?.titleEl, sel: document.getSelection().toString(), activeEditor: app.workspace.activeEditor?.file?.path};
        // with the lanes tab itself active, "the active Markdown view" is its card
        const MV=it.leaf.view.constructor; app.workspace.setActiveLeaf(T.tab().leaf,{focus:false}); r.viewOfTab=app.workspace.getActiveViewOfType(MV)?.file?.path ?? null;
        for (const l of T.tab().lanes) for (const x of [...l.items]) if (x.file===f) l.close(x); await app.vault.delete(f); return r`);
      return {
        ok: r.lane === 0 && r.titleFocused && r.sel === "EL nn" && r.activeEditor === "_test/EL nn.md" && !!r.viewOfTab,
        note: JSON.stringify(r),
      };
    },
  },
  {
    id: "NN-02",
    run: async c => {
      // Templater's "Create new note from template" opens the note into the leaf it picked and only then calls
      // setEphemeralState({rename: "all"}) on that leaf. With the open routed to a card, the rename belongs to the
      // card (its title, selected), never to the note still shown in that leaf (no rename prompt for it)
      const r =
        await c.js(`const P=T.P(), keep=P.settings.routeExceptions, tp="_test/EL nn tab.md", np="_test/EL nn2.md";
        try {
          for (const p of [tp, np]) if (T.f(p)) await app.vault.delete(T.f(p));
          P.settings.routeExceptions = tp; await P.settingsChanged("routing");
          const t=await app.vault.create(tp,"tab"), n=await app.vault.create(np,"new");
          const leaf=app.workspace.getLeaf("tab"); await leaf.openFile(t); await T.sleep(300);
          await leaf.openFile(n, {state:{mode:"source"}}); leaf.setEphemeralState({rename:"all"}); await T.sleep(600);
          const it=T.tab().lanes.flatMap(l=>l.items).find(i=>i.file===n);
          const r={inCard: !!it, tabShows: leaf.view.file?.path, prompts: document.querySelectorAll(".modal-container").length, titleFocused: !!it && document.activeElement===it.titleEl, sel: document.getSelection().toString()};
          document.querySelectorAll(".modal-container .mod-cancel, .modal-container .modal-close-button").forEach(b=>b.click());
          for (const l of T.tab().lanes) for (const x of [...l.items]) if (x.file===n) l.close(x);
          leaf.detach();
          return r;
        } finally {
          for (const p of [tp, np]) if (T.f(p)) await app.vault.delete(T.f(p));
          P.settings.routeExceptions = keep; await P.settingsChanged("routing");
        }`);
      return {
        ok: r.inCard && r.tabShows === "_test/EL nn tab.md" && r.prompts === 0 && r.titleFocused && r.sel === "EL nn2",
        note: JSON.stringify(r),
      };
    },
  },
  {
    id: "PB-01",
    run: async c => {
      // the Obsidian internals check at load: with a workspace method Lanes needs missing, the plugin patches nothing,
      // says so once, keeps lanes tabs as they were (a stub listing their notes) and notes open in normal tabs
      await openIn(c, A, 0);
      const r =
        await c.js(`const ws=app.workspace; await ws.saveLayout?.(); await app.plugins.disablePlugin("editor-multiple-lanes"); await T.sleep(300);
        document.querySelectorAll(".notice").forEach(n=>n.remove()); ws.moveLeafToPopout=undefined;
        try {
          await app.plugins.enablePlugin("editor-multiple-lanes"); await T.sleep(1500);
          const P=app.plugins.plugins["editor-multiple-lanes"];
          const notices=[...document.querySelectorAll(".notice")].map(n=>n.textContent);
          const stubs=ws.getLeavesOfType("editor-lanes").map(l=>({lanes: !!l.view.lanes, links: [...l.view.contentEl.querySelectorAll("a.internal-link")].map(a=>a.textContent)}));
          const patched=String(ws.iterateLeaves).startsWith("function wrapper(");
          const lf=ws.getLeaf("tab"); await lf.openFile(T.f(${JSON.stringify(B)})); await T.sleep(500);
          const r={degraded: P?.degraded ?? null, notices, stubs, patched, tab: lf.view?.getViewType(), tabInLanes: !!lf.view?.containerEl.closest(".lanes-view")};
          lf.detach();
          return r;
        } finally {
          delete ws.moveLeafToPopout; await app.plugins.disablePlugin("editor-multiple-lanes"); await app.plugins.enablePlugin("editor-multiple-lanes");
          // until every lanes tab is a working one again
          for (let i=0;i<50;i++) { await T.sleep(100); if (ws.getLeavesOfType("editor-lanes").every(l=>typeof l.view?.layoutInfo==="function")) break; }
          await T.sleep(500);
        }`);
      await c.prep();
      const after = await c.js(`return {degraded: T.P().degraded, lanes: T.tabs().map(t=>T.lanes(t))}`);
      return {
        ok:
          /workspace\.moveLeafToPopout/.test(r.degraded || "") &&
          r.notices.filter(n => /Editor Multiple Lanes is off/.test(n)).length === 1 &&
          r.stubs.length >= 1 &&
          r.stubs.every(s => !s.lanes) &&
          r.stubs.some(s => s.links.includes(A)) &&
          !r.patched &&
          r.tab === "markdown" &&
          !r.tabInLanes &&
          after.degraded === null &&
          after.lanes.flat(2).includes(tA),
        note: JSON.stringify({ r, after }),
      };
    },
  },
];
