import {
  A,
  B,
  C,
  D,
  NOTES,
  MOD,
  openIn,
  explorerClick,
  clickLinkIn,
  clickLine,
  st,
  eq,
  tA,
  tB,
  tC,
  tD,
} from "./common.mjs";
const L1 = NOTES.L1.title;
const card = (lane, i) => `T.tab().lanes[${lane}].items[${i}]`;
// the note a case created (title "Untitled…" or a timestamp): where it landed, then it's deleted
const newNote = known =>
  `const known=new Set(${JSON.stringify(known)}); const it=T.tab().lanes.flatMap(l=>l.items).find(i=>!known.has(i.file.path)); return it ? {path: it.file.path, lane: T.tab().lanes.findIndex(l=>l.items.includes(it)), text: (await app.vault.read(it.file)).slice(0,80)} : null`;
const fixturePaths = Object.values(NOTES).map(n => n.path);
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
        `[...document.querySelectorAll(".workspace-leaf.mod-active .cm-content .cm-underline")].find(e=>e.textContent.includes(${JSON.stringify(L1)}))`,
        { mods: MOD.shift, wait: 900 },
      );
      s = await st(c);
      const t2 = s.lanes.flat().includes(L1);
      // pin a second tab; turn lanes only on: unpinned note tab swept, pinned stays
      await c.js(
        `const l=app.workspace.getLeaf("tab"); await l.openFile(T.f(${JSON.stringify(B)})); l.setPinned(true); await T.sleep(300); T.P().settings.lanesOnly=true; await T.P().settingsChanged("routing"); await T.sleep(1200); return 1`,
      );
      s = await st(c);
      const t3 = !s.roots.includes("markdown:" + A) && s.roots.includes("markdown:" + B) && s.lanes.flat().includes(tA);
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
          s.active.startsWith(`card:${tA}@0`),
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
        `const it=T.tab().lanes.flatMap(l=>l.items).find(i=>i.file.basename===${JSON.stringify(tB)}); return it && it.leaf?.getViewState().state.mode`,
      );
      return {
        ok: s.roots.length === 1 && s.lanes.flat().includes(tB) && mode === "preview",
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
        `const it=T.tab().lanes.flatMap(l=>l.items).find(i=>i.file.basename.startsWith("Untitled")); const sel=document.getSelection(); return {name: it?.file.path, lane: T.tab().lanes.findIndex(l=>l.items.includes(it)), titleFocused: document.activeElement===it?.titleEl, sel: sel.toString()}`,
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
    id: "RO-20b",
    run: async c => {
      // Ctrl+N with the caret in a card: a new note goes to the last-used lane (that card's), not to the next lane
      // the way a link followed in the card does
      await openIn(c, A, 0);
      await clickLine(c, card(0, 0), 1);
      await c.key("End");
      await c.key("n", { ctrl: true });
      await c.sleep(1500);
      const created = await c.js(newNote(fixturePaths));
      await c.key("Escape");
      await c.sleep(300);
      if (created)
        await c.js(`const f=T.f(${JSON.stringify(created.path)}); if(f) await app.vault.delete(f); return 1`);
      // a link followed in the same card still goes to the next lane
      await clickLinkIn(c, A, L1);
      const s = await st(c);
      return {
        ok: created?.lane === 0 && s.lanes[1][0] === L1,
        note: JSON.stringify({ created, lanes: s.lanes }),
      };
    },
  },
  {
    id: "RO-21",
    needs: ["templater-obsidian"],
    run: async c => {
      // Templater's Alt+N "Create new note from template" with the caret in a card: the new note goes to the
      // last-used lane (the card's), the template applied
      await openIn(c, A, 0);
      await clickLine(c, card(0, 0), 3); // the line's start: not on one of its links
      await c.key("n", { alt: true });
      await c.sleep(1500);
      const r = await c.js(
        `const m=document.querySelector(".modal-container .prompt, .modal"); return {modal: !!m, text: m?.innerText.slice(0,200)}`,
      );
      let created = null;
      if (r.modal) {
        await c.type("zettel");
        await c.sleep(600);
        await c.key("Enter");
        await c.sleep(2500);
        created = await c.js(newNote(fixturePaths));
        if (created)
          await c.js(
            `await T.sleep(500); const f=T.f(${JSON.stringify(created.path)}); if(f) await app.vault.delete(f); return 1`,
          );
      }
      return {
        ok: r.modal && created?.lane === 0 && /type: zettel/.test(created.text),
        note: JSON.stringify({ r, created }),
      };
    },
  },
  {
    id: "RO-22",
    run: async c => {
      await openIn(c, A, 0);
      await clickLinkIn(c, A, L1);
      await c.sleep(300);
      let s = await st(c);
      await c.js(
        `const l=app.workspace.getLeaf("tab"); await l.openFile(T.f(${JSON.stringify(C)})); await T.sleep(1600); return 1`,
      );
      // a card with history: lanes only off, follow a link in a tab, then turn it on (the tab is swept with it)
      await c.js(
        `T.P().settings.lanesOnly=false; await T.P().settingsChanged("routing"); const l=app.workspace.getLeaf("tab"); await l.openFile(T.f(${JSON.stringify(A)})); await l.openFile(T.f(${JSON.stringify(D)})); app.workspace.setActiveLeaf(l,{focus:true}); await T.sleep(2100); T.P().settings.lanesOnly=true; await T.P().settingsChanged("routing"); await T.sleep(1000); return 1`,
      );
      s = await st(c);
      const moved = s.lanes.flat().includes(tD);
      await c.js(
        `const it=T.tab().lanes.flatMap(l=>l.items).find(i=>i.file.path===${JSON.stringify(D)}); app.workspace.setActiveLeaf(it.leaf,{focus:true}); await T.sleep(200); return 1`,
      );
      await c.key("ArrowLeft", { ctrl: true, alt: true });
      await c.sleep(1200);
      s = await st(c);
      const lane = await c.js(`const t=T.tab(); return t.lanes.map(l=>l.items.map(i=>i.file.basename))`);
      return {
        ok: moved && s.active.startsWith(`card:${tA}`),
        note: JSON.stringify({ active: s.active, lane, roots: s.roots }),
      };
    },
  },
  {
    id: "RO-23",
    needs: ["core:bookmarks"],
    run: async c => {
      await openIn(c, A, 0);
      await c.clickEl(`document.querySelectorAll(".lane")[2]`, { dy: 400 });
      // bookmarks pane: add a bookmark and click it
      await c.js(
        `const bp=app.internalPlugins.getEnabledPluginById("bookmarks"); bp.addItem({type:"file", path:${JSON.stringify(D)}}); const l=app.workspace.getLeavesOfType("bookmarks")[0]; await app.workspace.revealLeaf(l); await T.sleep(500); return 1`,
      );
      await c.clickEl(
        `[...document.querySelectorAll(".workspace-leaf-content[data-type=bookmarks] .tree-item-self")].find(e=>e.textContent.includes(${JSON.stringify(tD)}))`,
        { wait: 1000 },
      );
      let s = await st(c);
      const t1 = s.lanes[2][0] === tD;
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
      await c.js(`app.workspace.openLinkText(${JSON.stringify(tC)}, "", false); await T.sleep(1000); return 1`);
      let s = await st(c);
      const t1 = s.lanes[1][0] === tC;
      await c.js(
        `app.workspace.protocolHandler.dispatch({action:"open", vault: app.vault.getName(), file: ${JSON.stringify(D.replace(/\.md$/, ""))}}); await T.sleep(1500); return 1`,
      );
      s = await st(c);
      const t2 = s.lanes.flat().includes(tD);
      return { ok: t1 && t2, note: `openLinkText→last-used lane ${t1}; obsidian:// ${t2} ` + JSON.stringify(s) };
    },
  },
  {
    id: "RO-26",
    needs: ["core:daily-notes"],
    run: async c => {
      // a command that opens a note (today's daily note) right after typing in a card: not a link followed there,
      // so it goes to the last-used lane (the card's), not to the next lane
      const before = await c.js(`return app.vault.getMarkdownFiles().map(f=>f.path)`);
      await openIn(c, A, 0);
      await clickLine(c, card(0, 0), 1);
      await c.key("End");
      await c.js(`app.commands.executeCommandById("daily-notes"); await T.sleep(1500); return 1`);
      const r = await c.js(newNote(fixturePaths));
      const made = await c.js(
        `const before=new Set(${JSON.stringify(before)}); return app.vault.getMarkdownFiles().map(f=>f.path).filter(p=>!before.has(p))`,
      );
      for (const p of made) await c.js(`const f=T.f(${JSON.stringify(p)}); if(f) await app.vault.delete(f); return 1`);
      return { ok: r?.lane === 0, note: JSON.stringify({ r, made }) };
    },
  },
];
