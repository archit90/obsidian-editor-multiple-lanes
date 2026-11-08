import { A, B, C, D, MOD, openIn, clickLine, st, eq, headerClick } from "./common.mjs";
import { drag, settingsWin } from "./lib.mjs";
const item = (lane, i) => `T.tab().lanes[${lane}].items[${i}]`;
const menuClick = async (c, title) => {
  await c.sleep(300);
  if (
    !(await c.js(
      `return [...document.querySelectorAll(".menu .menu-item")].some(e=>e.textContent.trim()===${JSON.stringify(title)})`,
    ))
  ) {
    c.shot("menufail");
    console.log(
      "MENUFAIL",
      await c.js(
        `return {menus: [...document.querySelectorAll(".menu .menu-item")].map(e=>e.textContent), modal: !!document.querySelector(".modal-container"), el: document.activeElement.className}`,
      ),
    );
  }
  await c.clickEl(
    `[...document.querySelectorAll(".menu .menu-item")].find(e=>e.textContent.trim()===${JSON.stringify(title)})`,
    { wait: 500 },
  );
};
export const cases = [
  {
    id: "LT-01",
    run: async c => {
      await c.clickEl(`document.querySelector('.side-dock-ribbon-action[aria-label="New lanes tab"]')`, { wait: 800 });
      let s = await st(c);
      await c.js(`app.commands.executeCommandById("editor-multiple-lanes:new-lane"); await T.sleep(600); return 1`);
      const s2 = await st(c);
      const hint = await c.js(
        `return [...T.tab().contentEl.querySelectorAll(".lane-empty")].filter(e=>e.offsetHeight>0).length`,
      );
      return {
        ok: s.roots.length === 2 && s2.roots.length === 3 && s2.active === "editor-lanes:" && hint === 3,
        note: JSON.stringify({ s: s.roots, s2: s2.roots, hint }),
      };
    },
  },
  {
    id: "LT-02",
    run: async c => {
      await c.js(`for (let i=0;i<5;i++) await T.P().newLanesTab(); await T.sleep(500); return 1`);
      const r = await c.js(
        `return {names: T.tabs().map(t=>t.tabName()), titles: [...document.querySelectorAll(".workspace-tab-header")].map(e=>e.getAttribute("aria-label")).filter(x=>/^Editor lane/.test(x)), hdr: getComputedStyle(T.tab().containerEl.querySelector(".view-header-title-container")).display, nav: getComputedStyle(T.tab().containerEl.querySelector(".view-header-nav-buttons")).display}`,
      );
      return {
        ok: new Set(r.names).size === 6 && r.titles.length === 6 && r.hdr === "none" && r.nav === "none",
        note: JSON.stringify(r),
      };
    },
  },
  {
    id: "LT-03",
    run: async c => {
      const old = await c.js(`return T.tab().tabName()`);
      await c.js(`app.commands.executeCommandById("editor-multiple-lanes:rename-tab"); await T.sleep(400); return 1`);
      await c.key("a", { ctrl: true });
      await c.type("  Foo   bar ");
      await c.sleep(200);
      const msg1 = await c.js(`return document.querySelector(".modal .lane-layout-summary")?.textContent`);
      await c.key("Enter");
      await c.sleep(300);
      const n1 = await c.js(
        `return {name: T.tab().tabName(), header: document.querySelector(".mod-root .workspace-tab-header.is-active")?.getAttribute("aria-label")}`,
      );
      // empty / too long
      await c.js(`T.tab().openRenameDialog(); await T.sleep(300); return 1`);
      await c.key("a", { ctrl: true });
      await c.key("Backspace");
      await c.sleep(200);
      const empty = await c.js(
        `return {msg: document.querySelector(".modal .lane-layout-summary")?.textContent, saveDisabled: [...document.querySelectorAll(".modal button")].find(b=>b.textContent==="Save")?.disabled}`,
      );
      await c.type("x".repeat(41));
      await c.sleep(200);
      const long = await c.js(
        `return {msg: document.querySelector(".modal .lane-layout-summary")?.textContent, saveDisabled: [...document.querySelectorAll(".modal button")].find(b=>b.textContent==="Save")?.disabled}`,
      );
      // duplicate name from another tab → allowed, noted
      await c.js(`await T.P().newLanesTab(); await T.sleep(300); return 1`);
      await c.key("Escape");
      await c.js(`T.tab().openRenameDialog(); await T.sleep(300); return 1`);
      await c.key("a", { ctrl: true });
      await c.type("Foo bar");
      await c.sleep(200);
      const dup = await c.js(`return document.querySelector(".modal .lane-layout-summary")?.textContent`);
      await c.clickEl(`[...document.querySelectorAll(".modal button")].find(b=>b.textContent==="New random name")`);
      const rnd = await c.js(`return document.querySelector(".modal input").value`);
      await c.key("Escape");
      // tab header menu has the item
      await c.clickEl(`document.querySelector(".mod-root .workspace-tab-header.is-active")`, { button: "right" });
      const tm = await c.js(`return [...document.querySelectorAll(".menu .menu-item")].map(e=>e.textContent.trim())`);
      await c.key("Escape");
      await c.clickEl(`T.tab().containerEl.querySelector(".view-header .view-action[aria-label='More options']")`);
      const pm = await c.js(`return [...document.querySelectorAll(".menu .menu-item")].map(e=>e.textContent.trim())`);
      await c.key("Escape");
      const ok =
        n1.name === "Foo bar" &&
        n1.header === "Editor lane Foo bar" &&
        empty.saveDisabled &&
        long.saveDisabled &&
        /another lanes tab/.test(dup) &&
        rnd &&
        rnd !== "Foo bar" &&
        tm.includes("Rename lanes tab…") &&
        pm.includes("Rename lanes tab…") &&
        tm.includes("Lane layout…") &&
        pm.includes("Lane layout…");
      return { ok, note: JSON.stringify({ old, msg1, n1, empty, long, dup, rnd, tm, pm }) };
    },
  },
  {
    id: "LT-04",
    run: async c => {
      await c.clickEl(`T.tab().containerEl.querySelector(".view-header .view-action[aria-label='Lane layout…']")`, {
        wait: 400,
      });
      const r = await c.js(
        `const m=document.querySelector(".modal"); return {val: m.querySelector("input").value, summary: m.querySelector(".lane-layout-summary").textContent, cells: m.querySelectorAll(".lane-layout-cell").length, presets: [...m.querySelectorAll(".lane-layout-presets button")].map(b=>b.textContent)}`,
      );
      await c.key("a", { ctrl: true });
      await c.type("40, 30x2");
      await c.sleep(200);
      const p1 = await c.js(
        `const m=document.querySelector(".modal"); return {summary: m.querySelector(".lane-layout-summary").textContent, cells: m.querySelectorAll(".lane-layout-cell").length}`,
      );
      await c.key("a", { ctrl: true });
      await c.type("40, 30x9");
      await c.sleep(200);
      const bad = await c.js(
        `const m=document.querySelector(".modal"); return {summary: m.querySelector(".lane-layout-summary").textContent, apply: [...m.querySelectorAll("button")].find(b=>b.textContent==="Apply").disabled}`,
      );
      await c.key("Enter");
      await c.sleep(200);
      const stillOpen = await c.js(`return !!document.querySelector(".modal")`);
      await c.clickEl(
        `[...document.querySelectorAll(".modal .lane-layout-presets button")].find(b=>b.textContent==="2 × 2")`,
      );
      const pv = await c.js(`return document.querySelector(".modal input").value`);
      await c.key("Enter");
      await c.sleep(600);
      const after = await c.js(`return {n: T.tab().lanes.length, info: T.tab().layoutInfo()}`);
      // other entry points open the dialog
      const opens = {};
      await c.clickEl(`T.tab().containerEl.querySelector(".view-header .view-action[aria-label='More options']")`);
      await menuClick(c, "Lane layout…");
      opens.more = await c.js(`const m=!!document.querySelector(".modal .lane-layout-input"); return m`);
      await c.key("Escape");
      await c.sleep(400);
      await c.sleep(500);
      await c.clickEl(`T.tab().lanes[0].el`, { dy: 300, button: "right" });
      await menuClick(c, "Lane layout of this tab…");
      opens.lane = await c.js(`const m=!!document.querySelector(".modal .lane-layout-input"); return m`);
      await c.key("Escape");
      await c.sleep(400);
      await c.js(
        `app.commands.executeCommandById("editor-multiple-lanes:change-layout"); await T.sleep(300); return 1`,
      );
      opens.cmd = await c.js(`const m=!!document.querySelector(".modal .lane-layout-input"); return m`);
      await c.key("Escape");
      await c.sleep(400);
      await c.clickEl(`document.querySelector(".mod-root .workspace-tab-header.is-active")`, { button: "right" });
      await menuClick(c, "Lane layout…");
      opens.tabHeader = await c.js(`const m=!!document.querySelector(".modal .lane-layout-input"); return m`);
      await c.key("Escape");
      await c.sleep(400);
      const ok =
        r.val === "50, 50,50" &&
        r.cells === 3 &&
        r.presets.length === 6 &&
        p1.cells === 3 &&
        bad.apply &&
        stillOpen &&
        after.n === 4 &&
        after.info.own &&
        Object.values(opens).every(Boolean);
      return { ok, note: JSON.stringify({ r, p1, bad, stillOpen, pv, after, opens }) };
    },
  },
  {
    id: "LT-05",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 1);
      await openIn(c, C, 2);
      await openIn(c, D, 2);
      await c.js(`T.tab().lanes[2].togglePin(T.tab().lanes[2].items[1]); return 1`);
      await c.js(`T.tab().openLayoutDialog(); await T.sleep(300); return 1`);
      await c.key("a", { ctrl: true });
      await c.type("100");
      await c.sleep(200);
      const warn = await c.js(
        `return [...document.querySelectorAll(".modal .lane-layout-summary")].map(e=>e.textContent).join(" | ")`,
      );
      await c.key("Enter");
      await c.sleep(800);
      const s = await st(c);
      return {
        ok:
          s.lanes.length === 1 &&
          eq(s.lanes[0], [
            "P:Writing delays interfaces",
            "Writing replaces caching",
            "Writing hides attention",
            "Vocabulary predicts money",
          ]) &&
          /2 lanes will go; their 3 notes move/.test(warn),
        note: warn + " " + JSON.stringify(s.lanes),
      };
    },
  },
  {
    id: "LT-06",
    run: async c => {
      await c.js(`await T.tab().setLayout("100"); return 1`);
      await openIn(c, A, 0);
      await c.js(`await T.tab().setLayout("40, 30x2, 30"); await T.sleep(500); return 1`);
      const r = await c.js(
        `return {lanes: T.lanes(), cols: [...T.tab().contentEl.querySelectorAll(".lanes-col")].map(c=>c.querySelectorAll(":scope > .lane").length), widths: [...T.tab().contentEl.querySelectorAll(".lanes-col")].map(c=>Math.round(c.getBoundingClientRect().width))}`,
      );
      c.shot("LT-06");
      return {
        ok:
          eq(r.lanes, [["Writing replaces caching"], [], [], []]) && eq(r.cols, [1, 2, 1]) && r.widths[0] > r.widths[1],
        note: JSON.stringify(r),
      };
    },
  },
  {
    id: "LT-07",
    run: async c => {
      await c.js(`await T.tab().setLayout("100"); T.tab().openLayoutDialog(); await T.sleep(300); return 1`);
      await c.clickEl(
        `[...document.querySelectorAll(".modal button")].find(b=>b.textContent==="Use default from settings")`,
        { wait: 600 },
      );
      const r1 = await c.js(`return {info: T.tab().layoutInfo(), n: T.tab().lanes.length}`);
      await c.js(
        `T.P().settings.defaultLayout="50, 50"; await T.P().settingsChanged("layout"); await T.sleep(500); return 1`,
      );
      const r2 = await c.js(`return T.tab().lanes.length`);
      return { ok: !r1.info.own && r1.n === 3 && r2 === 2, note: JSON.stringify({ r1, r2 }) };
    },
  },
  {
    id: "LT-08",
    run: async c => {
      await c.js(`await T.P().newLanesTab(); await T.tab().setLayout("100"); await T.sleep(300); return 1`);
      const w = await settingsWin(c);
      const inp = `${w.row("Default lane layout")}.querySelector("input")`;
      const selAll = async () => {
        await w.send("Input.dispatchKeyEvent", {
          type: "rawKeyDown",
          key: "a",
          code: "KeyA",
          windowsVirtualKeyCode: 65,
          modifiers: 2,
        });
        await w.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: "a",
          code: "KeyA",
          windowsVirtualKeyCode: 65,
          modifiers: 2,
        });
      };
      await w.clickEl(inp);
      await selAll();
      await w.send("Input.insertText", { text: "50, 50, " });
      await w.sleep(1300);
      const mid = await c.js(`return T.tabs().map(t=>t.lanes.length)`);
      await w.send("Input.insertText", { text: "30" });
      await w.sleep(1300);
      const r1 = await c.js(`return {n: T.tabs().map(t=>t.lanes.length), saved: T.P().settings.defaultLayout}`);
      await selAll();
      await w.send("Input.insertText", { text: "50, x" });
      await w.sleep(1200);
      const bad = await c.js(
        `const i=${inp}; return {invalid: i.classList.contains("lane-setting-invalid"), saved: T.P().settings.defaultLayout, n: T.tabs().map(t=>t.lanes.length), msg: ${w.row("Default lane layout")}.nextElementSibling?.textContent}`,
      );
      await selAll();
      await w.send("Input.insertText", { text: "50, 50,50" });
      await w.sleep(1200);
      await w.close();
      return {
        ok:
          eq(mid, [3, 1]) && eq(r1.n, [3, 1]) && r1.saved === "50, 50, 30" && bad.invalid && bad.saved === "50, 50, 30",
        note: JSON.stringify({ mid, r1, bad }),
      };
    },
  },
  {
    id: "LT-09",
    run: async c => {
      await c.js(
        `await T.tab().setLayout("100"); await T.P().newLanesTab(); await T.tab().setLayout("50x2"); await T.sleep(300); return 1`,
      );
      const w = await settingsWin(c);
      await w.clickEl(`${w.row("Reset every tab to the default")}.querySelector("button")`);
      await w.sleep(800);
      const r = await c.js(`return T.tabs().map(t=>[t.layoutInfo().own, t.lanes.length])`);
      await w.close();
      return { ok: r.length === 2 && r.every(x => !x[0] && x[1] === 3), note: JSON.stringify(r) };
    },
  },
  {
    id: "LT-10",
    run: async c => {
      await c.js(`await T.tab().setLayout("50, 50x2"); await T.sleep(300); return 1`);
      const d0 = await c.at(`T.tab().contentEl.querySelector(".lanes-divider.mod-col")`);
      const d = { ...d0, y: Math.round(d0.t + 150) };
      await c.mouse("mouseMoved", d.x, d.y, { buttons: 0 });
      await c.sleep(200);
      await c.mouse("mousePressed", d.x, d.y);
      await c.sleep(50);
      for (let i = 1; i <= 10; i++) await c.mouse("mouseMoved", d.x - i * 20, d.y, { buttons: 1 });
      await c.mouse("mouseReleased", d.x - 200, d.y, { buttons: 0 });
      await c.sleep(300);
      const w1 = await c.js(
        `return [...T.tab().contentEl.querySelectorAll(".lanes-col")].map(c=>Math.round(c.getBoundingClientRect().width))`,
      );
      // far beyond: min 5%
      const d2a = await c.at(`T.tab().contentEl.querySelector(".lanes-divider.mod-col")`);
      const d2 = { ...d2a, y: Math.round(d2a.t + 150) };
      await c.mouse("mousePressed", d2.x, d2.y);
      for (let i = 1; i <= 10; i++) await c.mouse("mouseMoved", d2.x - i * 100, d2.y, { buttons: 1 });
      await c.mouse("mouseReleased", 0, d2.y, { buttons: 0 });
      await c.sleep(300);
      const w2 = await c.js(
        `return [...T.tab().contentEl.querySelectorAll(".lanes-col")].map(c=>Math.round(c.getBoundingClientRect().width))`,
      );
      const r = await c.at(`T.tab().contentEl.querySelector(".lanes-divider.mod-row")`);
      await c.mouse("mousePressed", r.x, r.y);
      for (let i = 1; i <= 5; i++) await c.mouse("mouseMoved", r.x, r.y + i * 30, { buttons: 1 });
      await c.mouse("mouseReleased", r.x, r.y + 150, { buttons: 0 });
      await c.sleep(300);
      const h = await c.js(
        `return [...T.tab().contentEl.querySelectorAll(".lanes-col")[1].querySelectorAll(".lane")].map(c=>Math.round(c.getBoundingClientRect().height))`,
      );
      const saved = await c.js(`return T.tab().getState().sizes`);
      // reload plugin: sizes back
      await c.js(
        `await app.plugins.disablePlugin("editor-multiple-lanes"); await app.plugins.enablePlugin("editor-multiple-lanes"); await T.sleep(2000); return 1`,
      );
      const w3 = await c.js(
        `return {w: [...T.tab().contentEl.querySelectorAll(".lanes-col")].map(c=>Math.round(c.getBoundingClientRect().width)), h: [...T.tab().contentEl.querySelectorAll(".lanes-col")[1].querySelectorAll(".lane")].map(c=>Math.round(c.getBoundingClientRect().height))}`,
      );
      const total = w2[0] + w2[1];
      return {
        ok:
          w1[0] < w1[1] - 300 &&
          w2[0] >= Math.floor(total * 0.05) - 2 &&
          w2[0] <= Math.ceil(total * 0.05) + 3 &&
          h[0] > h[1] &&
          !!saved &&
          eq(w3.w, w2) &&
          eq(w3.h, h),
        note: JSON.stringify({ w1, w2, h, saved, w3 }),
      };
    },
  },
  {
    id: "LT-11",
    run: async c => {
      await c.js(`await T.tab().setLayout("50, 50x2"); await T.sleep(300); return 1`);
      const d = await c.at(`T.tab().contentEl.querySelector(".lanes-divider.mod-col")`);
      await c.mouse("mousePressed", d.x, d.y);
      for (let i = 1; i <= 5; i++) await c.mouse("mouseMoved", d.x - i * 40, d.y, { buttons: 1 });
      await c.mouse("mouseReleased", d.x - 200, d.y, { buttons: 0 });
      await c.sleep(300);
      await c.clickEl(`T.tab().containerEl.querySelector(".view-header .view-action[aria-label='More options']")`);
      const items = await c.js(
        `return [...document.querySelectorAll(".menu .menu-item")].map(e=>e.textContent.trim())`,
      );
      await menuClick(c, "Reset lane sizes");
      const w1 = await c.js(
        `return {w: [...T.tab().contentEl.querySelectorAll(".lanes-col")].map(c=>Math.round(c.getBoundingClientRect().width)), s: T.tab().getState().sizes ?? null}`,
      );
      const d2a = await c.at(`T.tab().contentEl.querySelector(".lanes-divider.mod-col")`);
      const d2 = { ...d2a, y: Math.round(d2a.t + 150) };
      await c.mouse("mousePressed", d2.x, d2.y);
      for (let i = 1; i <= 5; i++) await c.mouse("mouseMoved", d2.x + i * 40, d2.y, { buttons: 1 });
      await c.mouse("mouseReleased", d2.x + 200, d2.y, { buttons: 0 });
      await c.sleep(300);
      const d3 = await c.at(`T.tab().contentEl.querySelector(".lanes-divider.mod-col")`);
      await c.click(d3.x, d3.y);
      await c.click(d3.x, d3.y, { count: 2 });
      await c.sleep(300);
      const w2 = await c.js(
        `return {w: [...T.tab().contentEl.querySelectorAll(".lanes-col")].map(c=>Math.round(c.getBoundingClientRect().width)), s: T.tab().getState().sizes ?? null}`,
      );
      await c.clickEl(`T.tab().containerEl.querySelector(".view-header .view-action[aria-label='More options']")`);
      const items2 = await c.js(
        `return [...document.querySelectorAll(".menu .menu-item")].map(e=>e.textContent.trim())`,
      );
      await c.key("Escape");
      return {
        ok:
          items.includes("Reset lane sizes") &&
          !w1.s &&
          Math.abs(w1.w[0] - w1.w[1]) < 3 &&
          !w2.s &&
          Math.abs(w2.w[0] - w2.w[1]) < 3 &&
          !items2.includes("Reset lane sizes"),
        note: JSON.stringify({ items, w1, w2 }),
      };
    },
  },
  {
    id: "LT-12",
    run: async c => {
      await c.js(`await T.tab().setLayout("40, 60"); await T.sleep(200); return 1`);
      await openIn(c, A, 0);
      await c.clickEl(`T.tab().containerEl.querySelector(".view-header .view-action[aria-label='More options']")`);
      await menuClick(c, "Split right");
      await c.sleep(600);
      let r = await c.js(
        `return T.tabs().map(t=>({name: t.tabName(), layout: t.layoutInfo(), n: t.lanes.flatMap(l=>l.items).length}))`,
      );
      await c.js(
        `app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("editor-lanes")[0], {focus:true}); app.commands.executeCommandById("workspace:split-horizontal"); await T.sleep(600); return 1`,
      );
      const r2 = await c.js(
        `return T.tabs().map(t=>({name: t.tabName(), layout: t.layoutInfo().text, n: t.lanes.flatMap(l=>l.items).length}))`,
      );
      // on a card: split down from the card
      await clickLine(c, `T.tabs()[0].lanes[0].items[0]`, 1);
      await c.js(`app.commands.executeCommandById("workspace:split-vertical"); await T.sleep(600); return 1`);
      const r3 = await c.js(
        `const offered = app.commands.findCommand("workspace:split-vertical").checkCallback(true); const card = T.P().hostedLeaves.keys().next().value; await app.workspace.duplicateLeaf(card, "vertical"); await T.sleep(600); return {offered, tabs: T.tabs().length, hostedOk: [...T.P().splits].every(s=>s.containerEl.querySelectorAll(".workspace-leaf").length===1), splitInCard: !!document.querySelector(".lane-item-body .workspace-split .workspace-split")}`,
      );
      return {
        ok:
          r.length === 2 &&
          r[1].n === 0 &&
          r[1].layout.text === "40, 60" &&
          r[0].n === 1 &&
          r[0].name !== r[1].name &&
          r2.length === 3 &&
          r3.offered === false &&
          r3.tabs === 4 &&
          r3.hostedOk &&
          !r3.splitInCard,
        note: JSON.stringify({ r, r2, r3 }),
      };
    },
  },
  {
    id: "LT-14",
    run: async c => {
      await c.js(`await T.tab().setLayout("40, 60"); await T.sleep(200); return 1`);
      await openIn(c, A, 0);
      await openIn(c, B, 1);
      await c.js(
        `const l=T.tab().lanes[1]; l.togglePin(l.items[0]); await l.setView(l.items[0], {mode:"preview"}); T.tab().lanes[0].setCollapsed(T.tab().lanes[0].items[0], true); await T.P().newLanesTab(); app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("editor-lanes")[0], {focus:true}); await T.sleep(300); return 1`,
      );
      const before = await c.js(`return JSON.stringify(T.tab().getState())`);
      await c.js(`app.workspace.getLeavesOfType("editor-lanes")[0].detach(); await T.sleep(400); return 1`);
      await c.key("t", { ctrl: true, shift: true });
      await c.sleep(1200);
      const after = await c
        .js(
          `const t=T.tabs().find(t=>t.tabName()===JSON.parse(${JSON.stringify("x")}==="x" ? ${"`"}${"$"}{0}${"`"} : "")); return 1`,
        )
        .catch(() => null);
      const r = await c.js(
        `const b=JSON.parse(${JSON.stringify(before)}); const t=T.tabs().find(t=>t.tabName()===b.name); if(!t) return {missing: T.tabs().map(t=>t.tabName())}; const s=t.getState(); return {same: JSON.stringify({...s, lanes: s.lanes.map(l=>l.map(d=>({...d, openedAt:0})))})===JSON.stringify({...b, lanes: b.lanes.map(l=>l.map(d=>({...d, openedAt:0})))}), s, mode: t.lanes[1].items[0]?.leaf?.getViewState().state.mode}`,
      );
      return { ok: r.same && r.mode === "preview", note: JSON.stringify(r).slice(0, 600) };
    },
  },
  {
    id: "LT-16",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 0);
      await c.js(`T.tab().lanes[0].togglePin(T.tab().lanes[0].items[1]); return 1`);
      await c.clickEl(`document.querySelectorAll(".lane")[2]`, { dy: 300, button: "right" });
      const empty = await c.js(
        `return [...document.querySelectorAll(".menu .menu-item")].map(e=>e.textContent.trim()+(e.classList.contains("is-disabled")?"(x)":""))`,
      );
      await c.key("Escape");
      const lane0 = async t => {
        await c.js(
          `const l=T.tab().lanes[0].listEl; for (let i=0;i<4;i++){ l.scrollTop=l.scrollHeight; await T.sleep(300);} return 1`,
        );
        const p = await c.at(`T.tab().lanes[0].listEl`);
        await c.click(p.x, Math.round(p.t + p.h - 10), { button: "right" });
        await c.sleep(300);
        await menuClick(c, t);
      };
      await lane0("Collapse all notes");
      const r1 = (await st(c)).lanes[0];
      await lane0("Expand all notes");
      await c.sleep(800);
      const r2 = await c.js(`return T.tab().lanes[0].items.map(i=>!i.collapsed)`);
      await lane0("Close all notes");
      const r3 = (await st(c)).lanes[0];
      return {
        ok:
          eq(empty, [
            "Collapse all notes(x)",
            "Expand all notes(x)",
            "Close all notes(x)",
            "Lane layout of this tab…",
          ]) &&
          eq(r1, ["P:C:Writing replaces caching", "C:Writing hides attention"]) &&
          r2.every(Boolean) &&
          eq(r3, ["P:Writing replaces caching"]),
        note: JSON.stringify({ empty, r1, r2, r3 }),
      };
    },
  },
  {
    id: "LT-19",
    run: async c => {
      await openIn(c, A, 0);
      await c.js(
        `for (const p of ["Untitled.canvas","u/2026-10-10-120000 kitchen quote.pdf","u/2026-10-19-143000 architecture sketch v1.png","x/daily review.base"]) { await app.workspace.getLeaf(false).openFile(T.f(p)); await T.sleep(500); app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("editor-lanes")[0], {focus:true}); await T.sleep(200); } const l=app.workspace.getLeaf(false); await l.setViewState({type:"graph", active:true}); await T.sleep(500); return 1`,
      );
      const s = await st(c);
      return {
        ok: s.roots.length === 6 && s.roots.filter(r => r.startsWith("editor-lanes")).length === 1,
        note: JSON.stringify(s.roots),
      };
    },
  },
  {
    id: "LT-20",
    run: async c => {
      await c.js(`await T.P().newLanesTab(); await T.sleep(300); return 1`);
      const tabs = await c.js(`return app.workspace.getLeavesOfType("editor-lanes").length`);
      await c.js(
        `const ls=app.workspace.getLeavesOfType("editor-lanes"); app.workspace.setActiveLeaf(ls[0],{focus:true}); await T.sleep(200); return 1`,
      );
      await c.js(`app.workspace.getLeaf(false).openFile(T.f(${JSON.stringify(A)})); await T.sleep(700); return 1`);
      await c.js(
        `const ls=app.workspace.getLeavesOfType("editor-lanes"); app.workspace.setActiveLeaf(ls[1],{focus:true}); await T.sleep(200); return 1`,
      );
      await c.js(`app.workspace.getLeaf(false).openFile(T.f(${JSON.stringify(B)})); await T.sleep(700); return 1`);
      const r = await c.js(
        `return app.workspace.getLeavesOfType("editor-lanes").map(l=>l.view.lanes.flatMap(x=>x.items.map(i=>i.file.basename)))`,
      );
      return {
        ok: tabs === 2 && eq(r, [["Writing replaces caching"], ["Writing hides attention"]]),
        note: JSON.stringify(r),
      };
    },
  },
];
