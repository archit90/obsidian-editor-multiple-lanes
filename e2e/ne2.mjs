import {
  A,
  B,
  C,
  D,
  MOD,
  openIn,
  explorerClick,
  clickLinkIn,
  quick,
  st,
  eq,
  headerClick,
  clickLine,
} from "./common.mjs";
const item = (lane, i) => `T.tab().lanes[${lane}].items[${i}]`;
const LONG = "_test/Outline mode.md";
const RENDER =
  "intro\\n\\n> [!note] A callout\\n> body\\n\\n| a | b |\\n|---|---|\\n| 1 | 2 |\\n\\n```js\\nlet x = 1;\\n```\\n\\n$$e^{i\\\\pi}+1=0$$\\n\\n```mermaid\\ngraph TD; A-->B\\n```\\n\\n![[Writing hides attention]]\\n\\n![[u/2026-10-19-143000 architecture sketch v1.png]]\\n\\n## Fold me\\nunder heading\\n";
export const cases = [
  {
    id: "NE-09",
    run: async c => {
      await openIn(c, LONG, 0);
      await clickLine(c, item(0, 0), 1);
      await c.js(
        `const o=app.workspace.getLeavesOfType("outline")[0]; await app.workspace.revealLeaf(o); await T.sleep(800); return 1`,
      );
      await c.clickEl(
        `[...document.querySelectorAll(".workspace-leaf-content[data-type=outline] .tree-item-self")].find(e=>/B2. Enter splits/.test(e.textContent))`,
        { wait: 900 },
      );
      const r = await c.js(
        `const l=T.tab().lanes[0]; const L=l.listEl.getBoundingClientRect(); const h=[...l.items[0].el.querySelectorAll(".cm-line")].find(e=>e.textContent.includes("B2. Enter splits")); return {y: h ? Math.round(h.getBoundingClientRect().top-L.top) : null, scroll: Math.round(l.listEl.scrollTop), outlineFile: app.workspace.getLeavesOfType("outline")[0].view.file?.path}`,
      );
      await c.js(`app.workspace.rightSplit.collapse(); return 1`);
      return {
        ok: r.y !== null && r.y > 40 && r.y < 860 && r.scroll > 1000 && r.outlineFile === LONG,
        note: JSON.stringify(r),
      };
    },
  },
  {
    id: "NE-10",
    run: async c => {
      await openIn(c, LONG, 0);
      await clickLine(c, item(0, 0), 1);
      const m = () =>
        c.js(
          `const it=${item(0, 0)}; const e=it.leaf.view.editor; const co=e.cm.coordsAtPos(e.cm.state.selection.main.head); const h=it.el.querySelector(".lane-item-header").getBoundingClientRect(); const L=it.el.closest(".lane-list").getBoundingClientRect(); return {line: e.getCursor().line, top: Math.round(co.top), hb: Math.round(h.bottom), lb: Math.round(L.bottom)}`,
        );
      const down = [];
      for (let i = 0; i < 60; i++) {
        await c.key("ArrowDown");
      }
      await c.sleep(300);
      down.push(await m());
      for (let i = 0; i < 120; i++) await c.key("ArrowDown");
      await c.sleep(300);
      down.push(await m());
      const up = [];
      for (let i = 0; i < 100; i++) await c.key("ArrowUp");
      await c.sleep(300);
      up.push(await m());
      await c.key("PageDown");
      await c.sleep(300);
      const pd = await m();
      const ok = [...down, ...up].every(x => x.top >= x.hb && x.top < x.lb) && down[1].line > down[0].line;
      return { ok, note: JSON.stringify({ down, up, pageDown: pd }) };
    },
  },
  {
    id: "NE-11",
    run: async c => {
      await openIn(c, LONG, 0);
      await clickLine(c, item(0, 0), 3);
      await c.key("End");
      await c.key("Enter");
      await c.type("[[Writing hi");
      await c.sleep(1000);
      const g = () =>
        c.js(
          `const s=document.querySelector(".suggestion-container"); const e=${item(0, 0)}.leaf.view.editor; const co=e.cm.coordsAtPos(e.cm.state.selection.main.head); return s ? {sTop: Math.round(s.getBoundingClientRect().top), caret: Math.round(co.bottom)} : null`,
        );
      const g1 = await g();
      const p = await c.at(`T.tab().lanes[0].listEl`);
      await c.wheel(p.x, p.t + 60, 120);
      await c.sleep(500);
      const g2 = await g();
      await c.key("Escape");
      for (let i = 0; i < 13; i++) await c.key("Backspace");
      const ok = g1 && g2 && Math.abs(g1.sTop - g1.caret - (g2.sTop - g2.caret)) < 6 && g1.caret !== g2.caret;
      return { ok, note: JSON.stringify([g1, g2]) };
    },
  },
  {
    id: "NE-12",
    run: async c => {
      await c.js(
        `if(!T.f("_test/EL render.md")) await app.vault.create("_test/EL render.md", "${RENDER}"); else await app.vault.modify(T.f("_test/EL render.md"), "${RENDER}"); return 1`,
      );
      await openIn(c, "_test/EL render.md", 0);
      await clickLine(c, item(0, 0), 0);
      await c.sleep(1500);
      const q = sel => `!!${item(0, 0)}.el.querySelector(${JSON.stringify(sel)})`;
      const lp = await c.js(
        `return {callout: ${q(".cm-callout, .callout")}, table: ${q("table")}, code: ${q(".cm-line .cm-hmd-codeblock, .HyperMD-codeblock")}, math: ${q(".math, mjx-container")}, mermaid: ${q(".mermaid svg, .block-language-mermaid svg")}, embed: ${q(".internal-embed .markdown-embed-content, .markdown-embed")}, img: ${q(".internal-embed img, img")}, fold: ${q(".cm-fold-indicator")}}`,
      );
      await c.js(
        `const l=T.tab().lanes[0]; await l.setView(l.items[0],{mode:"preview"}); await T.sleep(1500); return 1`,
      );
      const rd = await c.js(
        `return {callout: ${q(".callout")}, table: ${q("table")}, code: ${q("pre code")}, math: ${q("mjx-container, .math")}, mermaid: ${q(".mermaid svg")}, embed: ${q(".markdown-embed")}, img: ${q("img")}}`,
      );
      c.shot("NE-12");
      return {
        ok: Object.values(lp).every(Boolean) && Object.values(rd).every(Boolean),
        note: JSON.stringify({ lp, rd }),
      };
    },
  },
  {
    id: "NE-13",
    run: async c => {
      await openIn(c, A, 0);
      const p = await c.at(
        `[...${item(0, 0)}.el.querySelectorAll(".cm-content .cm-underline")].find(e=>/Evidence/.test(e.textContent))`,
      );
      await c.mouse("mouseMoved", p.x, p.y, { buttons: 0, mods: MOD.ctrl });
      await c.sleep(200);
      await c.raw("Control", "ControlLeft", 17, MOD.ctrl);
      await c.mouse("mouseMoved", p.x + 1, p.y, { buttons: 0, mods: MOD.ctrl });
      await c.sleep(1500);
      const pop = await c.js(
        `const pp=document.querySelector(".popover.hover-popover"); return pp ? {text: pp.textContent.slice(0,60), links: pp.querySelectorAll("a.internal-link, .cm-underline").length} : null`,
      );
      let opened = null;
      if (pop && pop.links) {
        await c.clickEl(
          `document.querySelector(".popover.hover-popover").querySelector("a.internal-link, .cm-underline")`,
          { wait: 1200 },
        );
        opened = await st(c);
      }
      return {
        ok: !!pop && (!opened || (opened.roots.length === 1 && opened.lanes.flat().length === 2)),
        note: JSON.stringify({ pop, opened }),
      };
    },
  },
  {
    id: "NE-14",
    run: async c => {
      await openIn(c, A, 0);
      const p = await c.at(`${item(0, 0)}.el.querySelectorAll(".cm-line")[1]`);
      await c.click(Math.round(p.l + 5), Math.round(p.t + 6), { button: "right" });
      await c.sleep(400);
      const items = await c.js(
        `return [...document.querySelectorAll(".menu .menu-item")].map(e=>e.textContent.trim())`,
      );
      await c.key("Escape");
      return { ok: items.some(x => /^Cut|^Copy|^Paste/.test(x)), note: JSON.stringify(items.slice(0, 12)) };
    },
  },
  {
    id: "NE-16",
    run: async c => {
      await c.js(
        `for (const p of ["_test/EL u1.md","_test/EL u2.md"]) { if(T.f(p)) await app.vault.modify(T.f(p),"base"); else await app.vault.create(p,"base"); } return 1`,
      );
      await openIn(c, "_test/EL u1.md", 0);
      await openIn(c, "_test/EL u2.md", 1);
      await clickLine(c, item(0, 0), 0);
      await c.key("End");
      await c.type(" one");
      await c.sleep(600);
      await clickLine(c, item(1, 0), 0);
      await c.key("End");
      await c.type(" two");
      await c.sleep(600);
      await clickLine(c, item(0, 0), 0);
      await c.key("z", { ctrl: true });
      await c.sleep(300);
      const r = await c.js(
        `return [${item(0, 0)}.leaf.view.editor.getValue(), ${item(1, 0)}.leaf.view.editor.getValue()]`,
      );
      return { ok: r[0] === "base" && r[1] === "base two", note: JSON.stringify(r) };
    },
  },
  {
    id: "NE-19",
    run: async c => {
      await openIn(c, A, 0);
      const before = await c.js(`return !!${item(0, 0)}.el.querySelector(".cm-lineNumbers")`);
      await c.js(
        `app.vault.setConfig("showLineNumber", true); app.workspace.updateOptions(); await T.sleep(500); return 1`,
      );
      const on = await c.js(`return !!${item(0, 0)}.el.querySelector(".cm-lineNumbers")`);
      await c.js(
        `app.vault.setConfig("readableLineLength", true); app.workspace.updateOptions(); await T.sleep(500); return 1`,
      );
      const rl = await c.js(
        `return ${item(0, 0)}.el.querySelector(".markdown-source-view").classList.contains("is-readable-line-width")`,
      );
      await c.js(
        `app.vault.setConfig("showLineNumber", false); app.vault.setConfig("readableLineLength", false); app.workspace.updateOptions(); return 1`,
      );
      return { ok: !before && on && rl, note: JSON.stringify({ before, on, rl }) };
    },
  },
  {
    id: "NE-20",
    run: async c => {
      await openIn(c, A, 0);
      await c.sleep(1500);
      const on = await c.js(
        `return !!${item(0, 0)}.el.querySelector(".bfv-container") && ${item(0, 0)}.el.querySelector(".bfv-container").offsetHeight>0`,
      );
      await c.js(
        `T.P().settings.showBacklinks=false; await T.P().settingsChanged("backlinks"); await T.sleep(1200); return 1`,
      );
      const off = await c.js(
        `const b=${item(0, 0)}.el.querySelector(".bfv-container"); return !!b && b.offsetHeight>0`,
      );
      await c.js(
        `T.P().settings.showBacklinks=true; await T.P().settingsChanged("backlinks"); await T.sleep(1200); return 1`,
      );
      const back = await c.js(
        `const b=${item(0, 0)}.el.querySelector(".bfv-container"); return !!b && b.offsetHeight>0`,
      );
      return { ok: on && !off && back, note: JSON.stringify({ on, off, back }) };
    },
  },
  {
    id: "NE-21",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 1);
      await c.js(
        `for (const t of ["outgoing-link","outline"]) { const l=app.workspace.getLeavesOfType(t)[0]; if (l) await app.workspace.revealLeaf(l); } await T.sleep(400); return 1`,
      );
      await clickLine(c, item(1, 0), 1);
      await c.sleep(500);
      const r = await c.js(
        `const out={}; for (const t of ["outline","outgoing-link","localgraph","backlink"]) { const l=app.workspace.getLeavesOfType(t)[0]; if(l) out[t]=l.view.file?.path ?? l.view.getState?.().file ?? null; } return out`,
      );
      await c.js(`app.workspace.rightSplit.collapse(); return 1`);
      return { ok: Object.values(r).length > 0 && Object.values(r).every(v => v === B), note: JSON.stringify(r) };
    },
  },
  {
    id: "NE-22",
    run: async c => {
      await openIn(c, D, 0);
      await clickLine(c, item(0, 0), 1);
      await c.js(`app.commands.executeCommandById("file-explorer:reveal-active-file"); await T.sleep(800); return 1`);
      const r = await c.js(
        `return document.querySelector(".nav-file-title.is-active, .tree-item-self.is-active")?.getAttribute("data-path")`,
      );
      let clip = null;
      try {
        await c.js(`app.commands.executeCommandById("workspace:copy-path"); await T.sleep(300); return 1`);
        clip = await c.js(`return require("electron").clipboard.readText()`);
      } catch {}
      return { ok: r === D && clip === D, note: JSON.stringify({ reveal: r, clip }) };
    },
  },
  {
    id: "NE-23",
    run: async c => {
      await c.js(
        `const f=app.vault.getAbstractFileByPath("_test/EL tpl.md"); if(f) await app.vault.modify(f,"start"); else await app.vault.create("_test/EL tpl.md","start"); return 1`,
      );
      await openIn(c, "_test/EL tpl.md", 0);
      await clickLine(c, item(0, 0), 0);
      await c.key("End");
      await c.js(
        `app.commands.executeCommandById("templater-obsidian:insert-templater"); await T.sleep(700); return 1`,
      );
      const modal = await c.js(
        `return [...document.querySelectorAll(".suggestion-item")].map(e=>e.textContent).slice(0,40)`,
      );
      const pick = modal.find(x => /zettel/i.test(x)) || modal[0];
      if (pick) {
        await c.type(pick.replace(/\\.md$/, ""));
        await c.sleep(400);
        await c.key("Enter");
        await c.sleep(1500);
      }
      const v = await c.js(
        `const it=${item(0, 0)}; return {path: it.file.path, title: it.titleEl.textContent, text: it.leaf.view.editor.getValue().slice(0,40)}`,
      );
      await c
        .js(
          `await T.sleep(2100); const f=T.f(${"`"}\${v.path}${"`"}); if (f && f.path!=="_test/EL tpl.md") await app.vault.delete(f); return 1`,
        )
        .catch(() => 0);
      return {
        ok: !!pick && /type: zettel/.test(v.text) && v.title === v.path.split("/").pop().replace(/\.md$/, ""),
        note: JSON.stringify({ pick, v, n: modal.length }),
      };
    },
  },
  {
    id: "NE-24",
    run: async c => {
      await c.js(
        `if(T.f("_test/EL list.md")) await app.vault.modify(T.f("_test/EL list.md"),"- a\\n- b"); else await app.vault.create("_test/EL list.md","- a\\n- b"); return 1`,
      );
      await openIn(c, "_test/EL list.md", 0);
      await clickLine(c, item(0, 0), 1);
      await c.key("End");
      await c.key("Tab");
      await c.sleep(300);
      const v = await c.js(`return ${item(0, 0)}.leaf.view.editor.getValue()`);
      return { ok: /^- a\n\s+- b$/.test(v), note: JSON.stringify(v) };
    },
  },
  {
    id: "NE-25",
    run: async c => {
      await c.js(
        `if(T.f("_test/EL paste.md")) await app.vault.modify(T.f("_test/EL paste.md"),"x"); else await app.vault.create("_test/EL paste.md","x"); return 1`,
      );
      await openIn(c, "_test/EL paste.md", 0);
      await clickLine(c, item(0, 0), 0);
      await c.key("End");
      const n0 = await c.js(`return app.vault.getFiles().filter(f=>f.path.startsWith("u/")).length`);
      await c.js(
        `const b64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="; const bin=Uint8Array.from(atob(b64),ch=>ch.charCodeAt(0)); const file=new File([bin],"image.png",{type:"image/png"}); const dt=new DataTransfer(); dt.items.add(file); const cm=${item(0, 0)}.el.querySelector(".cm-content"); cm.dispatchEvent(new ClipboardEvent("paste",{clipboardData:dt,bubbles:true,cancelable:true})); await T.sleep(1500); return 1`,
      );
      const r = await c.js(
        `const nf=app.vault.getFiles().filter(f=>f.path.startsWith("u/")); return {n: nf.length, text: ${item(0, 0)}.leaf.view.editor.getValue(), newest: nf.sort((a,b)=>b.stat.ctime-a.stat.ctime)[0]?.path}`,
      );
      if (r.n > n0) await c.js(`await app.vault.delete(T.f(${JSON.stringify(r.newest)})); return 1`);
      return { ok: r.n === n0 + 1 && /!\[\[/.test(r.text), note: JSON.stringify(r) };
    },
  },
];
