import { A, B, C, D, openIn, clickLine, st, eq, headerClick } from "./common.mjs";
const item = (lane, i) => `T.tab().lanes[${lane}].items[${i}]`;
const resize = (c, w, h) =>
  c.js(
    `const r=require("electron").remote||require("@electron/remote"); r.getCurrentWindow().setBounds({x:0,y:0,width:${w},height:${h}}); await T.sleep(1200); return innerWidth+"x"+innerHeight+" phone="+document.body.classList.contains("is-phone")`,
  );
export const cases = [
  {
    id: "MO-01",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 1);
      const r = await c.js(
        `const it=${item(0, 0)}; return {hdr: it.el.querySelector(".lane-item-header").offsetHeight, pin: it.pinEl.offsetWidth, pinH: it.pinEl.offsetHeight, close: it.el.querySelector(".lane-close").offsetWidth, chev: it.chevEl.offsetWidth, title: it.titleEl.contentEditable, cols: [...T.tab().contentEl.querySelectorAll(".lanes-col")].length, div: getComputedStyle(document.querySelector(".lanes-divider.mod-col"),"::after").left, ignore: document.querySelector(".lanes-divider").dataset.ignoreSwipe}`,
      );
      // tap on the title toggles the card
      await c.clickEl(`${item(0, 0)}.titleEl`);
      await c.sleep(400);
      const tapped = await c.js(`return ${item(0, 0)}.collapsed`);
      await c.clickEl(`${item(0, 0)}.titleEl`);
      await c.sleep(400);
      c.shot("MO-01");
      return {
        ok:
          r.hdr >= 44 &&
          r.pin >= 40 &&
          r.pinH >= 40 &&
          r.close >= 40 &&
          r.chev >= 40 &&
          r.title === "false" &&
          r.cols === 3 &&
          r.div === "-12px" &&
          r.ignore === "true" &&
          tapped === true,
        note: JSON.stringify({ r, tapped }),
      };
    },
  },
  {
    id: "MO-05",
    run: async c => {
      await openIn(c, A, 0);
      await c.js(
        `${item(0, 0)}.el.querySelector(".lane-item-header").dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:500,clientY:120})); await T.sleep(300); return 1`,
      );
      const m1 = await c.js(
        `const m=[...document.querySelectorAll(".menu .menu-item")].map(e=>e.textContent.trim()); return m`,
      );
      // Rename note → title editable
      await c.clickEl(
        `[...document.querySelectorAll(".menu .menu-item")].find(e=>e.textContent.trim()==="Rename note")`,
        { wait: 400 },
      );
      const ed = await c.js(
        `return {ce: ${item(0, 0)}.titleEl.contentEditable, focus: document.activeElement===${item(0, 0)}.titleEl}`,
      );
      await c.key("Escape");
      await c.sleep(300);
      const ce2 = await c.js(`return ${item(0, 0)}.titleEl.contentEditable`);
      await c.js(
        `T.tab().lanes[2].el.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:1300,clientY:500})); await T.sleep(300); return 1`,
      );
      const m2 = await c.js(`return [...document.querySelectorAll(".menu .menu-item")].map(e=>e.textContent.trim())`);
      await c.key("Escape");
      return {
        ok:
          m1.includes("Move up") &&
          m1.includes("Rename note") &&
          ed.ce === "true" &&
          ed.focus &&
          ce2 === "false" &&
          m2.includes("Collapse all notes"),
        note: JSON.stringify({ m1: m1.slice(0, 8), ed, ce2, m2 }),
      };
    },
  },
  {
    id: "MO-07",
    run: async c => {
      const r = await c
        .js(
          `const items=[]; const m={addItem(cb){const it={t:"",setTitle(t){this.t=t;return this},setIcon(){return this},setSection(){return this},onClick(f){this.f=f;return this},setDisabled(){return this},setChecked(){return this},setSubmenu(){return {addItem(){}}},setWarning(){return this}}; cb(it); items.push(it); return this}, addSeparator(){return this}, setSectionSubmenu(){return {addItem(){}}}}; try { app.workspace.trigger("file-menu", m, T.f(${JSON.stringify(C)}), "file-explorer-context-menu"); } catch(e) {} const lane=items.find(i=>i.t==="Open in editor lane"); if (lane) { lane.f(); await T.sleep(800); } return {titles: items.map(i=>i.t), lanes: T.lanes()}`,
        )
        .catch(e => String(e));
      return {
        ok:
          r.titles?.includes("Open in editor lane") &&
          r.titles.includes("Open in new lanes tab") &&
          r.lanes.flat().includes("Writing delays interfaces"),
        note: JSON.stringify(r),
      };
    },
  },
  {
    id: "MO-08",
    run: async c => {
      await openIn(c, A, 0);
      await clickLine(c, item(0, 0), 1);
      const cmdExists = await c.js(`return !!app.commands.findCommand("workspace:move-to-new-window")`);
      await c.js(`app.workspace.moveLeafToPopout(${item(0, 0)}.leaf); await T.sleep(1500); return 1`);
      const r = await c.js(
        `return {tabs: T.tabs().map(t=>t.lanes.map(l=>l.items.map(i=>i.file.basename))), pop: app.workspace.floatingSplit.children.length}`,
      );
      const r2 = await c.js(
        `app.workspace.duplicateLeaf(app.workspace.getLeavesOfType("editor-lanes")[0], "window"); await T.sleep(1000); return {tabs: T.tabs().length, pop: app.workspace.floatingSplit.children.length}`,
      );
      return {
        ok:
          r.pop === 0 &&
          r.tabs.length === 2 &&
          r.tabs[1][0][0] === "Writing replaces caching" &&
          r2.tabs === 3 &&
          r2.pop === 0,
        note: JSON.stringify({ cmdExists, r, r2 }),
      };
    },
  },
  {
    id: "MO-02",
    run: async c => {
      const sz = await resize(c, 420, 860);
      await openIn(c, A, 0);
      await openIn(c, B, 1);
      const r = await c.js(
        `const t=T.tab(); return {sw: [...t.contentEl.querySelectorAll(".lanes-switch")].map(b=>b.getAttribute("aria-label")+(b.classList.contains("is-active")?"*":"")), laneW: t.lanes.map(l=>Math.round(l.el.getBoundingClientRect().width)), gridW: Math.round(t.contentEl.querySelector(".lanes-grid").clientWidth), scrollL: Math.round(t.contentEl.querySelector(".lanes-grid").scrollLeft)}`,
      );
      c.shot("MO-02");
      {
        const q = await c.js(
          `const r=T.tab().contentEl.querySelectorAll(".lanes-switch")[2].getBoundingClientRect(); return {x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2)}`,
        );
        await c.click(q.x, q.y);
        await c.sleep(800);
      }
      const r2 = await c.js(
        `const g=T.tab().contentEl.querySelector(".lanes-grid"); return {scrollL: Math.round(g.scrollLeft), last: T.tab().lastLane===T.tab().lanes[2]}`,
      );
      // swipe: scroll the grid to lane 0
      await c.js(
        `const g=T.tab().contentEl.querySelector(".lanes-grid"); g.scrollTo({left:0}); await T.sleep(600); return 1`,
      );
      const r3 = await c.js(
        `return {last: T.tab().lastLane===T.tab().lanes[0], active: [...T.tab().contentEl.querySelectorAll(".lanes-switch")].findIndex(b=>b.classList.contains("is-active"))}`,
      );
      // opening into lane 1 switches to it
      await c.js(
        `await T.P().openInLane(T.f(${JSON.stringify(C)}),"same",T.tab().lanes[1],{focus:true}); await T.sleep(800); return 1`,
      );
      const r4 = await c.js(`const g=T.tab().contentEl.querySelector(".lanes-grid"); return Math.round(g.scrollLeft)`);
      return {
        ok:
          /Lane 2 of 3, 1 note\*/.test(r.sw[1]) &&
          r.laneW.every(w => w === r.gridW) &&
          Math.abs(r2.scrollL - r.gridW * 2) <= 2 &&
          r2.last &&
          r3.last &&
          r3.active === 0 &&
          Math.abs(r4 - r.gridW) <= 2,
        note: JSON.stringify({ sz, r, r2, r3, r4 }),
      };
    },
  },
  {
    id: "MO-04",
    run: async c => {
      await openIn(c, A, 0);
      await clickLine(c, item(0, 0), 1);
      const r = await c.js(
        `const t=T.tab(); let p=t.leaf.parent, vis=[]; while(p){ vis.push(p.containerEl?.classList.contains("mod-visible")); p=p.parent; } return {active: T.active(), shown: t.contentEl.getBoundingClientRect().width>0, vis, title: getComputedStyle(t.containerEl.querySelector(".view-header-title-container")).display, titleText: t.containerEl.querySelector(".view-header-title")?.textContent}`,
      );
      c.shot("MO-04");
      return {
        ok: r.active.startsWith("card:") && r.shown && r.title !== "none" && /Editor lane/.test(r.titleText),
        note: JSON.stringify(r),
      };
    },
  },
  {
    id: "MO-03",
    run: async c => {
      await c.js(`app.workspace.leftSplit.expand(); await T.sleep(500); return 1`);
      const open0 = await c.js(`return !app.workspace.leftSplit.collapsed`);
      await c.js(
        `const v=app.workspace.getLeavesOfType("file-explorer")[0].view; v.revealInFolder(T.f(${JSON.stringify(D)})); await T.sleep(500); return 1`,
      );
      {
        const q = await c.js(
          `const e=document.querySelector('.nav-file-title[data-path="${D}"]'); e.scrollIntoView({block:"center"}); await T.sleep(300); const r=e.getBoundingClientRect(); return {x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2)}`,
        );
        await c.click(q.x, q.y);
        await c.sleep(1200);
      }
      const r = await c.js(`return {drawerClosed: app.workspace.leftSplit.collapsed, st: T.st()}`);
      return {
        ok: open0 && r.drawerClosed && r.st.lanes.flat().includes("Vocabulary predicts money"),
        note: JSON.stringify(r),
      };
    },
  },
];
