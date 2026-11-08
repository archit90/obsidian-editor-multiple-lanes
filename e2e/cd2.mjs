import { A, B, C, MANY, NOTES, openIn, quick, st, eq, headerClick, tA, tB, tC } from "./common.mjs";
const item = (lane, i) => `T.tab().lanes[${lane}].items[${i}]`;
const mode = (lane, i) =>
  `(()=>{const it=${item(lane, i)}; const vs=it.leaf?.getViewState().state; return {mode: vs?.mode, source: vs?.source, view: it.view, btn: it.el.getAttribute("data-view-mode")}})()`;
export const cases = [
  {
    id: "CD-08",
    run: async c => {
      await openIn(c, A, 0);
      const out = [];
      await c.clickEl(`${item(0, 0)}.modeEl`);
      await c.sleep(400);
      out.push(await c.js(`return ${mode(0, 0)}`));
      await c.clickEl(`${item(0, 0)}.modeEl`);
      await c.sleep(400);
      out.push(await c.js(`return ${mode(0, 0)}`));
      // card menu → Source mode
      await c.clickEl(`${item(0, 0)}.el.querySelector(".lane-item-header")`, { button: "right", dx: 300 });
      await c.sleep(300);
      await c.clickEl(
        `[...document.querySelectorAll(".menu .menu-item")].find(e=>e.textContent.trim()==="Source mode")`,
      );
      await c.sleep(400);
      out.push(await c.js(`return ${mode(0, 0)}`));
      // reading then back → source (last editing kind)
      await c.clickEl(`${item(0, 0)}.modeEl`);
      await c.sleep(300);
      await c.clickEl(`${item(0, 0)}.modeEl`);
      await c.sleep(400);
      out.push(await c.js(`return ${mode(0, 0)}`));
      // collapse/expand keeps; move to next lane keeps
      await headerClick(c, item(0, 0));
      await headerClick(c, item(0, 0));
      out.push(await c.js(`return ${mode(0, 0)}`));
      await c.js(`await T.P().moveToLane(T.tab().lanes[0], ${item(0, 0)}, 1); await T.sleep(500); return 1`);
      out.push(await c.js(`return ${mode(1, 0)}`));
      const saved = await c.js(`return T.tab().getState().lanes[1][0].view`);
      const ok =
        out[0].mode === "preview" &&
        out[0].btn === "reading" &&
        out[1].mode === "source" &&
        out[1].source === false &&
        out[2].source === true &&
        out[2].btn === "source" &&
        out[3].source === true &&
        out[3].mode === "source" &&
        out[4].source === true &&
        out[5].source === true &&
        saved?.source === true;
      return { ok, note: JSON.stringify(out) + " saved=" + JSON.stringify(saved) };
    },
  },
  {
    id: "CD-09",
    run: async c => {
      await openIn(c, A, 0);
      await c.clickEl(`${item(0, 0)}.el.querySelectorAll(".cm-line")[3]`);
      await c.key("e", { ctrl: true });
      await c.sleep(600);
      const r1 = await c.js(`return ${mode(0, 0)}`);
      await c.key("e", { ctrl: true });
      await c.sleep(600);
      const r2 = await c.js(`return ${mode(0, 0)}`);
      await c.js(`app.commands.executeCommandById("editor:toggle-source"); await T.sleep(500); return 1`);
      const r3 = await c.js(`return ${mode(0, 0)}`);
      return {
        ok:
          r1.mode === "preview" &&
          r1.btn === "reading" &&
          r2.mode === "source" &&
          r3.source === true &&
          r3.btn === "source" &&
          r3.view?.source === true,
        note: JSON.stringify([r1, r2, r3]),
      };
    },
  },
  {
    id: "CD-10",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 1);
      await c.clickEl(`document.querySelectorAll(".lane")[2]`, { dy: 300 });
      await quick(c, tC);
      await c.sleep(800);
      const r = await c.js(
        `return T.tab().getState().lanes.flat().map(d=>d.path.split("/").pop()+":"+JSON.stringify(d.view||null))`,
      );
      return { ok: r.every(x => x.endsWith(":null")), note: JSON.stringify(r) };
    },
  },
  {
    id: "CD-11",
    run: async c => {
      await openIn(c, NOTES.LONG.path, 0);
      await c.js(`const it=${item(0, 0)}; it.leaf.view.editor.setCursor({line:40,ch:2}); return 1`);
      await c.clickEl(`${item(0, 0)}.chevEl`);
      await c.sleep(300);
      const r1 = await c.js(
        `const it=${item(0, 0)}; return {collapsed: it.collapsed, leaf: !!it.leaf, bodyShown: it.bodyEl.offsetHeight}`,
      );
      // Enter on the chevron (keyboard)
      await c.js(`${item(0, 0)}.chevEl.focus(); return 1`);
      await c.key("Enter");
      await c.sleep(700);
      const r2 = await c.js(
        `const it=${item(0, 0)}; return {collapsed: it.collapsed, leaf: !!it.leaf, cursor: it.leaf?.view.editor.getCursor()}`,
      );
      await c.js(`${item(0, 0)}.chevEl.focus(); return 1`);
      await c.key("Space");
      await c.sleep(400);
      const r3 = await c.js(`return ${item(0, 0)}.collapsed`);
      return {
        ok:
          r1.collapsed &&
          !r1.leaf &&
          r1.bodyShown === 0 &&
          !r2.collapsed &&
          r2.leaf &&
          r2.cursor?.line === 40 &&
          r3 === true,
        note: JSON.stringify([r1, r2, r3]),
      };
    },
  },
  {
    id: "CD-12",
    run: async c => {
      const n = await c.js(
        `const fs=app.vault.getMarkdownFiles().filter(f=>f.path.startsWith(${JSON.stringify(MANY.folder + "/")})).slice(0,60); const l=T.tab().lanes[0]; for (const f of fs) await l.add(f,{focus:false}); l.setAllCollapsed(true); await T.sleep(500); l.listEl.scrollTop=0; return fs.length`,
      );
      const t0 = Date.now();
      await c.js(`T.tab().lanes[0].setAllCollapsed(false); await T.sleep(1500); return 1`);
      const r1 = await c.js(
        `const l=T.tab().lanes[0]; return {mounted: l.items.filter(i=>i.leaf).length, expanded: l.items.filter(i=>!i.collapsed).length}`,
      );
      // scroll with the wheel through the lane
      const p = await c.at(`T.tab().lanes[0].listEl`);
      for (let i = 0; i < 30; i++) {
        await c.wheel(p.x, p.y, 1500);
        await c.sleep(60);
      }
      await c.sleep(1500);
      const r2 = await c.js(
        `const l=T.tab().lanes[0]; return {mounted: l.items.filter(i=>i.leaf).length, top: l.listEl.scrollTop, h: l.listEl.scrollHeight}`,
      );
      // a placeholder far below: click mounts it
      c.shot("CD-12");
      return {
        ok: n === 60 && r1.mounted < 20 && r2.mounted > r1.mounted,
        note: `60 cards; mounted after expand-all ${r1.mounted}; after scrolling ${JSON.stringify(r2)}`,
      };
    },
  },
  {
    id: "CD-13",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 0);
      await c.clickEl(`${item(0, 1)}.pinEl`);
      let s = await st(c);
      const t1 = eq(s.lanes[0], [`P:${tA}`, tB]);
      await openIn(c, C, 0);
      s = await st(c);
      const t2 = eq(s.lanes[0], [`P:${tA}`, tC, tB]);
      const closeHidden = await c.js(`return getComputedStyle(${item(0, 0)}.el.querySelector(".lane-close")).display`);
      await c.clickEl(`${item(0, 0)}.el.querySelectorAll(".cm-line")[3]`);
      await c.key("w", { ctrl: true });
      await c.sleep(400);
      s = await st(c);
      const t3 = s.lanes[0][0] === `P:${tA}`;
      await c.js(`T.tab().lanes[0].closeAll(); return 1`);
      s = await st(c);
      const t4 = eq(s.lanes[0], [`P:${tA}`]);
      const saved = await c.js(`return T.tab().getState().lanes[0][0].pinned`);
      return {
        ok: t1 && t2 && t3 && t4 && closeHidden === "none" && saved === true,
        note: JSON.stringify({ t1, t2, closeHidden, t3, t4, saved }),
      };
    },
  },
  {
    id: "CD-14",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 0);
      const undo0 = await c.js(`return app.workspace.undoHistory?.length ?? -1`);
      await c.clickEl(`${item(0, 0)}.el.querySelector(".lane-close")`);
      let s = await st(c);
      const t1 = eq(s.lanes[0], [tA]);
      await c.clickEl(`${item(0, 0)}.el.querySelectorAll(".cm-line")[3]`);
      await c.key("w", { ctrl: true });
      await c.sleep(400);
      s = await st(c);
      const t2 = eq(s.lanes[0], []);
      const undo1 = await c.js(`return app.workspace.undoHistory?.length ?? -1`);
      const focus = await c.js(`return {active: T.active(), el: document.activeElement?.className}`);
      return { ok: t1 && t2 && undo0 === undo1, note: JSON.stringify({ t1, t2, undo0, undo1, focus }) };
    },
  },
];
