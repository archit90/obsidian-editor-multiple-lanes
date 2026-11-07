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
export const cases = [
  {
    id: "NE-01",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 1);
      await clickLine(c, item(0, 0), 1);
      const r = await c.js(
        `return {active: T.active(), file: app.workspace.getActiveFile()?.path, ed: app.workspace.activeEditor?.file?.path, status: document.querySelector(".status-bar-item.plugin-word-count")?.textContent}`,
      );
      await clickLine(c, item(1, 0), 1);
      const r2 = await c.js(
        `return {active: T.active(), status: document.querySelector(".status-bar-item.plugin-word-count")?.textContent}`,
      );
      return {
        ok: r.file === A && r.ed === A && r2.active.startsWith("card:Writing hides") && r.status !== r2.status,
        note: JSON.stringify([r, r2]),
      };
    },
  },
  {
    id: "NE-02",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 1);
      await clickLine(c, item(1, 0), 1);
      await c.js(
        `const l=app.workspace.getLeaf("tab"); await l.setViewState({type:"graph"}); app.workspace.setActiveLeaf(l,{focus:true}); await T.sleep(400); return 1`,
      );
      await c.clickEl(
        `[...document.querySelectorAll(".workspace-tab-header")].find(e=>/^Editor lane/.test(e.getAttribute("aria-label")||""))`,
        { wait: 500 },
      );
      const r = await c.js(
        `return {active: T.active(), file: app.workspace.getActiveFile()?.path, ed: app.workspace.activeEditor?.file?.path}`,
      );
      return { ok: r.active.startsWith("card:Writing hides attention@1") && r.ed === B, note: JSON.stringify(r) };
    },
  },
  {
    id: "NE-03",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 1);
      await clickLine(c, item(1, 0), 1);
      await c.key("Home");
      await c.key("p", { ctrl: true });
      await c.sleep(400);
      await c.type("Toggle checkbox status");
      await c.sleep(500);
      await c.key("Enter");
      await c.sleep(500);
      const r = await c.js(
        `const e=${item(1, 0)}.leaf.view.editor; return {line: e.getLine(e.getCursor().line).slice(0,20), other: ${item(0, 0)}.leaf.view.editor.getValue().includes("- [ ] Really")}`,
      );
      await c.key("z", { ctrl: true });
      await c.sleep(300);
      return { ok: /^- \[ \]/.test(r.line) && !r.other, note: JSON.stringify(r) };
    },
  },
  {
    id: "NE-04",
    run: async c => {
      await openIn(c, LONG, 0);
      await clickLine(c, item(0, 0), 2);
      await c.key("f", { ctrl: true });
      await c.sleep(300);
      await c.type("Escape");
      await c.sleep(400);
      const m = () =>
        c.js(
          `const l=T.tab().lanes[0]; const it=l.items[0]; const bar=it.el.querySelector(".document-search-container"); const h=it.el.querySelector(".lane-item-header"); const L=l.listEl.getBoundingClientRect(); const bb=bar.getBoundingClientRect().bottom; const vis=[...it.el.querySelectorAll(".obsidian-search-match-highlight")].map(e=>e.getBoundingClientRect()).filter(r=>r.top>=bb-1 && r.bottom<=L.bottom); return {scroll: Math.round(l.listEl.scrollTop), count: bar.querySelector(".document-search-count").textContent, barBelowHeader: Math.round(bar.getBoundingClientRect().top - h.getBoundingClientRect().bottom), visible: vis.length, hidden: [...it.el.querySelectorAll(".obsidian-search-match-highlight")].some(e=>{const r=e.getBoundingClientRect(); return r.bottom>L.top && r.top<bb-1})}`,
        );
      const tops = [await m()];
      for (let i = 0; i < 4; i++) {
        await c.key("Enter");
        await c.sleep(300);
        tops.push(await m());
      }
      c.shot("NE-04");
      await c.key("Enter", { shift: true });
      await c.sleep(300);
      const back = await m();
      await c.key("Escape");
      await c.sleep(300);
      const closed = await c.js(`return !${item(0, 0)}.el.querySelector(".document-search-container")?.isShown()`);
      const ok =
        tops.every(t => Math.abs(t.barBelowHeader) <= 2 && t.visible > 0) &&
        tops[4].scroll > tops[0].scroll &&
        tops[4].count !== tops[0].count &&
        back.count === tops[3].count &&
        closed;
      return { ok, note: JSON.stringify(tops) + " back=" + JSON.stringify(back) + " closed=" + closed };
    },
  },
  {
    id: "NE-05",
    run: async c => {
      await c.js(
        `for (const p of ["_test/EL r1.md","_test/EL r2.md"]) { if(T.f(p)) await app.vault.modify(T.f(p),"foo bar foo"); else await app.vault.create(p,"foo bar foo"); } return 1`,
      );
      await openIn(c, "_test/EL r1.md", 0);
      await openIn(c, "_test/EL r2.md", 1);
      await clickLine(c, item(0, 0), 0);
      await c.key("h", { ctrl: true });
      await c.sleep(300);
      await c.type("foo");
      await c.sleep(200);
      await c.js(
        `const r=${item(0, 0)}.el.querySelector(".document-replace-input, input[placeholder*=Replace]"); r.focus(); return 1`,
      );
      await c.type("baz");
      await c.sleep(200);
      await c.clickEl(
        `[...${item(0, 0)}.el.querySelectorAll(".document-search-button")].find(b=>/Replace all/.test(b.getAttribute("aria-label")))`,
      );
      await c.sleep(1200);
      const r = await c.js(
        `return [${item(0, 0)}.leaf.view.editor.getValue(), ${item(1, 0)}.leaf.view.editor.getValue()]`,
      );
      await c.key("Escape");
      return { ok: r[0] === "baz bar baz" && r[1] === "foo bar foo", note: JSON.stringify(r) };
    },
  },
  {
    id: "NE-06",
    run: async c => {
      await c.js(
        `for (const p of ["_test/EL r1.md","_test/EL r2.md"]) await app.vault.modify(T.f(p),"foo bar foo\\n\\nfoo again"); return 1`,
      );
      await openIn(c, "_test/EL r1.md", 0);
      await openIn(c, "_test/EL r2.md", 1);
      await clickLine(c, item(0, 0), 0);
      await c.key("f", { ctrl: true });
      await c.sleep(200);
      await c.type("foo");
      await clickLine(c, item(1, 0), 0);
      await c.key("f", { ctrl: true });
      await c.sleep(200);
      await c.type("again");
      // focus back into card 0's search input and press Enter: card 0's selection moves, card 1's not
      await c.js(`${item(0, 0)}.el.querySelector(".document-search-input input").focus(); return 1`);
      await c.sleep(200);
      const sel = () =>
        c.js(
          `return [${item(0, 0)}.el.querySelector(".document-search-count")?.textContent, ${item(1, 0)}.el.querySelector(".document-search-count")?.textContent]`,
        );
      const s0 = await sel();
      await c.key("Enter");
      await c.sleep(300);
      const s1 = await sel();
      await c.key("Escape");
      await c.sleep(300);
      const open = await c.js(
        `return [${item(0, 0)}.el.querySelector(".document-search-container")?.isShown(), ${item(1, 0)}.el.querySelector(".document-search-container")?.isShown()]`,
      );
      return {
        ok:
          JSON.stringify(s0[1]) === JSON.stringify(s1[1]) &&
          JSON.stringify(s0[0]) !== JSON.stringify(s1[0]) &&
          !open[0] &&
          open[1] === true,
        note: JSON.stringify({ s0, s1, open }),
      };
    },
  },
  {
    id: "NE-07",
    run: async c => {
      await openIn(c, LONG, 0);
      await c.js(
        `const l=T.tab().lanes[0]; await l.setView(l.items[0],{mode:"preview"}); await T.sleep(800); return 1`,
      );
      await c.clickEl(`${item(0, 0)}.el.querySelector(".markdown-preview-view p, .markdown-preview-view li")`);
      await c.key("f", { ctrl: true });
      await c.sleep(300);
      await c.type("Escape");
      await c.sleep(500);
      const ys = [];
      for (let i = 0; i < 3; i++) {
        await c.key("Enter");
        await c.sleep(400);
        ys.push(
          await c.js(
            `const l=T.tab().lanes[0]; const m=l.items[0].el.querySelector(".search-highlight > div.is-active, .is-active.search-highlight, .search-highlight .is-active") ; const L=l.listEl.getBoundingClientRect(); return {scroll: Math.round(l.listEl.scrollTop), m: m ? Math.round(m.getBoundingClientRect().top - L.top) : null, n: l.items[0].el.querySelectorAll(".search-highlight > div").length}`,
          ),
        );
      }
      c.shot("NE-07");
      await c.key("Escape");
      return {
        ok: ys[2].scroll > ys[0].scroll && ys.every(y => y.m === null || (y.m > 40 && y.m < 900)) && ys[0].n > 0,
        note: JSON.stringify(ys),
      };
    },
  },
  {
    id: "NE-08",
    run: async c => {
      await c.js(
        `if(!T.f("_test/EL headlink.md")) await app.vault.create("_test/EL headlink.md","[[Outline mode#Vim mode]]"); else await app.vault.modify(T.f("_test/EL headlink.md"), "[[Outline mode#Vim mode]]"); return 1`,
      );
      const h = await c.js(
        `return (app.metadataCache.getFileCache(T.f(${JSON.stringify(LONG)})).headings||[]).map(h=>h.heading)`,
      );
      const target = "C4. Folded item above";
      await c.js(
        `await app.vault.modify(T.f("_test/EL headlink.md"), "intro\\n\\n[[_test/Outline mode#${target}]]"); return 1`,
      );
      await openIn(c, "_test/EL headlink.md", 0);
      await clickLinkIn(c, "_test/EL headlink.md", /Outline|Folded/);
      await c.sleep(800);
      const r = await c.js(
        `const l=T.tab().lanes[1]; const it=l.items[0]; if(!it) return {lanes: T.lanes()}; const L=l.listEl.getBoundingClientRect(); const hEl=[...it.el.querySelectorAll(".cm-line, h1,h2,h3,h4")].find(e=>e.textContent.includes(${JSON.stringify(target)})); return {lane1: it?.file.path, y: hEl ? Math.round(hEl.getBoundingClientRect().top - L.top) : null, scroll: l.listEl.scrollTop}`,
      );
      return {
        ok: r.lane1 === LONG && r.y !== null && r.y > 30 && r.y < 500 && r.scroll > 100,
        note: target + " " + JSON.stringify(r),
      };
    },
  },
];
