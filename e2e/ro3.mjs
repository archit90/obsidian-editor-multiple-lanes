import { A, B, C, D, MOD, openIn, explorerClick, clickLinkIn, quick, st, eq, headerClick } from "./common.mjs";
const lanesTab = `app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("editor-lanes")[0],{focus:true}); await T.sleep(300);`;
export const cases = [
  {
    id: "RO-16",
    run: async c => {
      await c.js(`T.P().settings.lanesOnly=false; await T.P().settingsChanged("routing"); return 1`);
      await explorerClick(c, A);
      let s = await st(c);
      const t1 = s.roots.includes("markdown:" + A) && eq(s.lanes, [[], [], []]);
      // shift-click a link in the normal tab → lane
      await c.clickEl(
        `[...document.querySelectorAll(".workspace-leaf.mod-active .cm-content .cm-underline")].find(e=>/Evidence/.test(e.textContent))`,
        { mods: MOD.shift, wait: 900 },
      );
      s = await st(c);
      const t2 = s.lanes.flat().includes("Evidence is a kind of pronunciation");
      // pin a second tab; turn lanes only on: unpinned note tab swept, pinned stays
      await c.js(
        `const l=app.workspace.getLeaf("tab"); await l.openFile(T.f(${JSON.stringify(B)})); l.setPinned(true); await T.sleep(300); T.P().settings.lanesOnly=true; await T.P().settingsChanged("routing"); await T.sleep(1200); return 1`,
      );
      s = await st(c);
      const t3 =
        !s.roots.includes("markdown:" + A) &&
        s.roots.includes("markdown:" + B) &&
        s.lanes.flat().includes("Writing replaces caching");
      return {
        ok: t1 && t2 && t3,
        note: `off→tab ${t1}; shift-click→lane ${t2}; on→swept, pinned stays ${t3}; ${JSON.stringify(s)}`,
      };
    },
  },
  {
    id: "RO-17",
    run: async c => {
      await c.js(
        `const l=app.workspace.getLeaf("tab"); await l.openFile(T.f(${JSON.stringify(A)})); await T.sleep(1500); return 1`,
      );
      const s = await st(c);
      return {
        ok:
          s.roots.length === 2 &&
          s.roots.every(r => r.startsWith("editor-lanes")) &&
          s.active.startsWith("card:Writing replaces caching@0"),
        note: "getLeaf('tab').openFile = a 'new' open → new lanes tab; " + JSON.stringify(s),
      };
    },
  },
  {
    id: "RO-17b",
    run: async c => {
      // a tab created without openFile (setViewState directly, as Workspaces / some plugins do)
      await c.js(
        `const l=app.workspace.getLeaf("tab"); await l.setViewState({type:"markdown", state:{file:${JSON.stringify(B)}, mode:"preview"}}); await T.sleep(3000); return 1`,
      );
      const s = await st(c);
      const mode = await c.js(
        `const it=T.tab().lanes.flatMap(l=>l.items).find(i=>i.file.basename==="Writing hides attention"); return it && it.leaf?.getViewState().state.mode`,
      );
      return {
        ok: s.roots.length === 1 && s.lanes.flat().includes("Writing hides attention") && mode === "preview",
        note: "mode=" + mode + " " + JSON.stringify(s),
      };
    },
  },
  {
    id: "RO-20",
    run: async c => {
      await c.clickEl(`document.querySelectorAll(".lane")[1]`, { dy: 400 });
      await c.key("n", { ctrl: true });
      await c.sleep(1500);
      const r = await c.js(
        `const it=T.tab().lanes.flatMap(l=>l.items).find(i=>i.file.basename.startsWith("Untitled")||/^\\d{14}/.test(i.file.basename)); const sel=document.getSelection(); return {name: it?.file.path, lane: T.tab().lanes.findIndex(l=>l.items.includes(it)), titleFocused: document.activeElement===it?.titleEl, sel: sel.toString()}`,
      );
      const s = await st(c);
      // type a name and press Enter
      await c.type("EL new note test");
      await c.key("Enter");
      await c.sleep(800);
      const r2 = await c.js(`return T.tab().lanes.flatMap(l=>l.items).map(i=>i.file.path)`);
      await c.js(
        `const f=app.vault.getFiles().find(f=>f.basename==="EL new note test"); if(f) await app.vault.delete(f); return 1`,
      );
      return {
        ok:
          !!r.name &&
          r.lane === 1 &&
          r.titleFocused &&
          r2.some(p => /EL new note test/.test(p)) &&
          s.roots.length === 1,
        note: JSON.stringify(r) + " → " + JSON.stringify(r2) + " " + JSON.stringify(s.roots),
      };
    },
  },
  {
    id: "RO-21",
    run: async c => {
      await openIn(c, A, 0);
      await c.clickEl(`T.tab().lanes[0].items[0].el.querySelectorAll(".cm-content .cm-line")[3]`);
      await c.key("n", { alt: true });
      await c.sleep(1500);
      const r = await c.js(
        `const m=document.querySelector(".modal-container .prompt, .modal"); return {modal: !!m, text: m?.innerText.slice(0,200)}`,
      );
      let ok = r.modal;
      let note = JSON.stringify(r);
      if (r.modal) {
        await c.type("zettel");
        await c.sleep(600);
        await c.key("Enter");
        await c.sleep(2500);
        const r2 = await c.js(
          `const m=document.querySelector(".modal-container"); return {modal: m?.innerText.slice(0,300), st: T.st(), active: app.workspace.getActiveFile()?.path, cursor: app.workspace.activeEditor?.editor?.getCursor()}`,
        );
        note += " → " + JSON.stringify(r2);
      }
      return { ok, note, allowErrs: true };
    },
  },
  {
    id: "RO-22",
    run: async c => {
      await openIn(c, A, 0);
      await clickLinkIn(c, A, /Evidence/);
      await c.sleep(300);
      let s = await st(c);
      // back from the new card: Evidence was opened fresh: no history → nothing. Use the history-in-card: a tab swept with history
      await c.js(
        `const l=app.workspace.getLeaf("tab"); await l.openFile(T.f(${JSON.stringify(C)})); await T.sleep(1600); return 1`,
      );
      // the card for C came from a fresh tab: no back entries. Build a real history: lanes only off, follow a link in a tab, then turn on
      await c.js(
        `T.P().settings.lanesOnly=false; await T.P().settingsChanged("none"); const l=app.workspace.getLeaf("tab"); await l.openFile(T.f(${JSON.stringify(A)})); await l.openFile(T.f(${JSON.stringify(D)})); app.workspace.setActiveLeaf(l,{focus:true}); await T.sleep(2100); T.P().settings.lanesOnly=true; await T.P().settingsChanged("routing"); await T.sleep(1000); return 1`,
      );
      s = await st(c);
      const moved = s.lanes.flat().includes("Vocabulary predicts money");
      await c.js(
        `const it=T.tab().lanes.flatMap(l=>l.items).find(i=>i.file.path===${JSON.stringify(D)}); app.workspace.setActiveLeaf(it.leaf,{focus:true}); await T.sleep(200); return 1`,
      );
      await c.key("ArrowLeft", { ctrl: true, alt: true });
      await c.sleep(1200);
      s = await st(c);
      const lane = await c.js(`const t=T.tab(); return t.lanes.map(l=>l.items.map(i=>i.file.basename))`);
      return {
        ok: moved && s.active.startsWith("card:Writing replaces caching"),
        note: JSON.stringify({ active: s.active, lane, roots: s.roots }),
      };
    },
  },
  {
    id: "RO-23",
    run: async c => {
      await openIn(c, A, 0);
      await c.clickEl(`document.querySelectorAll(".lane")[2]`, { dy: 400 });
      // bookmarks pane: open bookmarks view and click a bookmark (add one)
      await c.js(
        `const bp=app.internalPlugins.getEnabledPluginById("bookmarks"); bp.addItem({type:"file", path:${JSON.stringify(D)}}); const l=app.workspace.getLeavesOfType("bookmarks")[0]; app.workspace.revealLeaf(l); await T.sleep(500); return 1`,
      );
      await c.clickEl(
        `[...document.querySelectorAll(".workspace-leaf-content[data-type=bookmarks] .tree-item-self")].find(e=>/Vocabulary predicts money/.test(e.textContent))`,
        { wait: 1000 },
      );
      let s = await st(c);
      const t1 = s.lanes[2][0] === "Vocabulary predicts money";
      await c.js(
        `const bp=app.internalPlugins.getEnabledPluginById("bookmarks"); for (const it of bp.items.filter(i=>i.path===${JSON.stringify(D)})) bp.removeItem(it); app.workspace.getLeavesOfType("file-explorer")[0] && app.workspace.revealLeaf(app.workspace.getLeavesOfType("file-explorer")[0]); return 1`,
      );
      return { ok: t1, note: JSON.stringify(s) };
    },
  },
  {
    id: "RO-24",
    run: async c => {
      await c.clickEl(`document.querySelectorAll(".lane")[1]`, { dy: 400 });
      await c.js(`app.workspace.openLinkText("Writing delays interfaces", "", false); await T.sleep(1000); return 1`);
      let s = await st(c);
      const t1 = s.lanes[1][0] === "Writing delays interfaces";
      await c.js(
        `app.workspace.protocolHandler.dispatch({action:"open", vault: app.vault.getName(), file: "z/Vocabulary predicts money"}); await T.sleep(1500); return 1`,
      );
      s = await st(c);
      const t2 = s.lanes.flat().includes("Vocabulary predicts money");
      return { ok: t1 && t2, note: `openLinkText→last-used lane ${t1}; obsidian:// ${t2} ` + JSON.stringify(s) };
    },
  },
];
