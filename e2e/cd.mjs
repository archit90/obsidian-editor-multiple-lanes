import { A, DIR, NOTES, MOD, openIn, st, tA } from "./common.mjs";
const item = (lane, i) => `T.tab().lanes[${lane}].items[${i}]`;
const STAMPED = NOTES.STAMPED;
export const cases = [
  {
    id: "CD-01",
    run: async c => {
      await openIn(c, A, 0);
      c.shot("CD-01");
      const r = await c.js(
        `const it=${item(0, 0)}; const h=it.el.querySelector(".lane-item-header"); return {kids:[...h.children].map(e=>e.className.split(" ")[0]), path: it.pathEl.textContent, title: it.titleEl.textContent, inline: getComputedStyle(it.el.querySelector(".inline-title")).display, vh: getComputedStyle(it.el.querySelector(".view-header")).display, lp: it.leaf.view.getMode(), source: it.leaf.view.getState().source, editable: it.titleEl.contentEditable, doc: it.el.ownerDocument===it.el.closest(".lane").ownerDocument}`,
      );
      return {
        ok:
          r.path.replace(/‎/g, "") === `${DIR}/` &&
          r.title === tA &&
          r.inline === "none" &&
          r.vh === "none" &&
          r.lp === "source" &&
          r.source === false &&
          r.doc &&
          r.kids.join() === "lane-chevron,lane-item-name,lane-sr-only,lane-mode,lane-pin,lane-close",
        note: JSON.stringify(r),
      };
    },
  },
  {
    id: "CD-02",
    run: async c => {
      await c.js(`await T.note("_test/deep/very/long/folder/name/for/the/test/EL deep note.md","deep"); return 1`);
      await openIn(c, "_test/deep/very/long/folder/name/for/the/test/EL deep note.md", 0);
      c.shot("CD-02");
      const r = await c.js(
        `const it=${item(0, 0)}; const t=it.titleEl.getBoundingClientRect(), p=it.pathEl.getBoundingClientRect(), h=it.el.querySelector(".lane-item-header").getBoundingClientRect(); return {titleW:t.width, titleScroll: it.titleEl.scrollWidth, pathW:p.width, pathScroll: it.pathEl.scrollWidth, tip: it.pathEl.title, hw:h.width}`,
      );
      return {
        ok: r.titleW >= r.titleScroll - 1 && r.pathW < r.pathScroll && r.tip.endsWith("EL deep note.md"),
        note: JSON.stringify(r),
      };
    },
  },
  {
    id: "CD-03",
    run: async c => {
      await openIn(c, A, 0);
      const h1 = await c.js(`return ${item(0, 0)}.el.querySelector(".lane-item-header").offsetHeight`);
      await c.js(
        `T.P().settings.headerSize="compact"; T.P().settings.showFolder=false; await T.P().settingsChanged("looks"); return 1`,
      );
      c.shot("CD-03");
      const r = await c.js(
        `const it=${item(0, 0)}; return {h: it.el.querySelector(".lane-item-header").offsetHeight, path: it.pathEl.textContent}`,
      );
      return { ok: r.h < h1 && r.path === "", note: `comfortable ${h1} → compact ${r.h}, folder "${r.path}"` };
    },
  },
  {
    id: "CD-03b",
    run: async c => {
      const P = "_test/EL props.md";
      await c.js(
        `await T.note(${JSON.stringify(P)}, "---\\ntype: zettel\\nstatus: inbox\\n---\\n# EL props\\n\\nbody"); return 1`,
      );
      await openIn(c, P, 0);
      const gaps = () =>
        c.js(
          `const it=${item(0, 0)}; const body=it.el.querySelector(".lane-item-body").getBoundingClientRect(); const meta=it.el.querySelector(".metadata-container").getBoundingClientRect(); const h=it.el.querySelector(".cm-line.HyperMD-header-1").getBoundingClientRect(); const arrow=it.el.querySelector(".metadata-properties-heading .collapse-indicator").getBoundingClientRect(); return {top: Math.round(meta.top-body.top), left: Math.round(meta.left-body.left), toHeading: Math.round(h.top-meta.bottom), arrowInside: arrow.left >= body.left, cls: it.el.closest(".lanes-view").classList.contains("lane-compact-editor")}`,
        );
      const off = await gaps();
      await c.js(
        `T.P().settings.compactEditor=true; await T.P().settingsChanged("looks"); await T.sleep(300); return 1`,
      );
      c.shot("CD-03b");
      const on = await gaps();
      await c.js(`T.P().settings.compactEditor=false; await T.P().settingsChanged("looks"); return 1`);
      const back = await gaps();
      return {
        ok:
          !off.cls &&
          on.cls &&
          on.top < off.top &&
          on.left < off.left &&
          on.toHeading < off.toHeading &&
          on.arrowInside &&
          back.top === off.top,
        note: JSON.stringify({ off, on, back }),
      };
    },
  },
  {
    id: "CD-04",
    run: async c => {
      await c.js(
        `for (const p of ["_test/EL rename.md","_test/EL renamed.md","_test/EL renamed2.md","_test/EL linker.md"]) if(T.f(p)) await app.vault.delete(T.f(p)); await T.note("_test/EL rename.md","body"); await T.note("_test/EL linker.md","see [[_test/EL rename]]"); await T.sleep(500); return 1`,
      );
      await openIn(c, "_test/EL rename.md", 0);
      await c.clickEl(`${item(0, 0)}.titleEl`);
      await c.key("End");
      await c.type("d");
      await c.key("Enter");
      await c.sleep(1200);
      let r = await c.js(
        `return {exists: !!T.f("_test/EL renamed.md"), title: ${item(0, 0)}.titleEl.textContent, link: await app.vault.read(T.f("_test/EL linker.md"))}`,
      );
      const t1 = r.exists && r.title === "EL renamed" && /EL renamed/.test(r.link);
      // Escape cancels
      await c.clickEl(`${item(0, 0)}.titleEl`);
      await c.key("End");
      await c.type("XYZ");
      await c.key("Escape");
      await c.sleep(500);
      const r2 = await c.js(`return {exists: !!T.f("_test/EL renamed.md"), title: ${item(0, 0)}.titleEl.textContent}`);
      const t2 = r2.exists && r2.title === "EL renamed";
      // click away commits
      await c.clickEl(`${item(0, 0)}.titleEl`);
      await c.key("End");
      await c.type("2");
      await c.clickEl(`document.querySelectorAll(".lane")[2]`, { dy: 300 });
      await c.sleep(1000);
      const r3 = await c.js(`return {exists: !!T.f("_test/EL renamed2.md"), title: ${item(0, 0)}.titleEl.textContent}`);
      const t3 = r3.exists;
      // paste multi-line → plain single line
      await c.clickEl(`${item(0, 0)}.titleEl`);
      await c.js(
        `const el=${item(0, 0)}.titleEl; const dt=new DataTransfer(); dt.setData("text/plain","a\\nb"); const s=getSelection(); const rg=document.createRange(); rg.selectNodeContents(el); rg.collapse(false); s.removeAllRanges(); s.addRange(rg); el.dispatchEvent(new ClipboardEvent("paste",{clipboardData:dt,bubbles:true,cancelable:true})); return 1`,
      );
      const r4 = await c.js(`return ${item(0, 0)}.titleEl.textContent`);
      await c.key("Escape");
      await c.sleep(300);
      await c.js(
        `for (const p of ["_test/EL renamed2.md","_test/EL linker.md"]) if(T.f(p)) await app.vault.delete(T.f(p)); return 1`,
      );
      return {
        ok: t1 && t2 && t3 && r4 === "EL renamed2a b",
        note: `enter ${t1} ${JSON.stringify(r)}; esc ${t2}; click-away ${t3}; paste "${r4}"`,
      };
    },
  },
  {
    id: "CD-05",
    run: async c => {
      await c.js(`for (const p of ["_test/EL refuse.md","_test/EL taken.md"]) await T.note(p,"x"); return 1`);
      await openIn(c, "_test/EL refuse.md", 0);
      const tries = ["a/b", "a:b", ".x", "x.md", "EL taken", "a#b", "a|b", "a?b"];
      const out = [];
      const rename = async (to, expectPath) => {
        await c.clickEl(`${item(0, 0)}.titleEl`);
        await c.key("a", { ctrl: true });
        await c.type(to);
        await c.key("Enter");
        await c.sleep(700);
        const r = await c.js(
          `return {exists: !!T.f(${JSON.stringify(expectPath)}), title: ${item(0, 0)}.titleEl.textContent, notice: [...document.querySelectorAll(".notice")].map(n=>n.textContent).pop()}`,
        );
        await c.js(`document.querySelectorAll(".notice").forEach(n=>n.remove()); T.P().noticeAt=0; return 1`);
        return r;
      };
      for (const t of tries) out.push({ t, ...(await rename(t, "_test/EL refuse.md")) });
      // a name with a date-time prefix keeps one ("Keep a date-time prefix when renaming", any folder)
      await c.js(`for (const l of T.tab().lanes) for (const it of [...l.items]) l.close(it); return 1`);
      await openIn(c, STAMPED.path, 0);
      const kept = await rename("EL no stamp", STAMPED.path);
      const keptOk = kept.exists && kept.title === STAMPED.title && /date-time prefix/.test(kept.notice || "");
      // …and loses it with the setting off
      await c.js(`T.P().settings.keepStampPrefix=false; await T.P().saveSettings(); return 1`);
      const off = await rename("EL no stamp", `${DIR}/EL no stamp.md`);
      await c.js(
        `T.P().settings.keepStampPrefix=true; await T.P().saveSettings(); const f=T.f(${JSON.stringify(`${DIR}/EL no stamp.md`)}); if(f) await app.fileManager.renameFile(f, ${JSON.stringify(STAMPED.path)}); return 1`,
      );
      const ok =
        out.every(o => o.exists && o.title === "EL refuse" && o.notice) &&
        keptOk &&
        off.exists &&
        off.title === "EL no stamp";
      return {
        ok,
        note:
          JSON.stringify(out.map(o => o.t + "→" + o.notice)) +
          " stamp kept:" +
          JSON.stringify(kept) +
          " off:" +
          JSON.stringify(off),
      };
    },
  },
  {
    id: "CD-06",
    run: async c => {
      await openIn(c, A, 0);
      await c.clickEl(`${item(0, 0)}.titleEl`);
      await c.key("ArrowDown");
      await c.sleep(300);
      const r = await c.js(`return {inEditor: !!document.activeElement.closest(".cm-editor"), active: T.active()}`);
      return { ok: r.inEditor && r.active.startsWith(`card:${tA}`), note: JSON.stringify(r) };
    },
  },
  {
    id: "CD-07",
    run: async c => {
      await openIn(c, A, 0);
      await c.clickEl(`${item(0, 0)}.titleEl`, { mods: MOD.ctrl, wait: 1000 });
      const s = await st(c);
      return {
        ok: s.roots.length === 2 && s.active.startsWith(`card:${tA}@0`),
        note: JSON.stringify(s),
      };
    },
  },
];
