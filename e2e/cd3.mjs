import { A, B, C, D, openIn, st, tA, tB, tC, tD } from "./common.mjs";
import { drag } from "./lib.mjs";
const item = (lane, i) => `T.tab().lanes[${lane}].items[${i}]`;
const hdr = (lane, i) => `${item(lane, i)}.el.querySelector(".lane-item-header")`;
export const cases = [
  {
    id: "CD-15",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 0);
      await openIn(c, C, 0);
      const menu = async (lane, i, title) => {
        const p = await c.at(hdr(lane, i));
        await c.click(Math.round(p.l + p.w - 110), p.y, { button: "right" });
        await c.sleep(300);
        const items = await c.js(
          `return [...document.querySelectorAll(".menu .menu-item")].map(e=>e.textContent.trim()+(e.hasClass("is-disabled")?"(x)":""))`,
        );
        if (title)
          await c.clickEl(
            `[...document.querySelectorAll(".menu .menu-item")].find(e=>e.textContent.trim()===${JSON.stringify(title)})`,
            { wait: 600 },
          );
        else await c.key("Escape");
        return items;
      };
      const items = await menu(0, 1);
      const log = [];
      await menu(0, 1, "Move to top");
      log.push((await st(c)).lanes[0].join("|"));
      await menu(0, 0, "Move down");
      log.push((await st(c)).lanes[0].join("|"));
      await menu(0, 1, "Move up");
      log.push((await st(c)).lanes[0].join("|"));
      await menu(0, 0, "Move to next lane");
      log.push(JSON.stringify((await st(c)).lanes));
      await menu(1, 0, "Move to previous lane");
      log.push(JSON.stringify((await st(c)).lanes));
      await menu(0, 0, "Open in next lane");
      log.push(JSON.stringify((await st(c)).lanes));
      await menu(0, 0, "Pin");
      log.push(JSON.stringify((await st(c)).lanes[0]));
      await menu(0, 0, "Unpin");
      await menu(0, 1, "Close others");
      log.push(JSON.stringify((await st(c)).lanes[0]));
      await menu(0, 0, "Close");
      log.push(JSON.stringify((await st(c)).lanes[0]));
      await openIn(c, A, 0);
      await menu(0, 0, "Open in new lanes tab");
      const s = await st(c);
      log.push(s.roots.length + " " + s.active);
      const want = [
        "Open in next lane",
        "Open in new lanes tab",
        "Move to top",
        "Move up",
        "Move down",
        "Move to previous lane",
        "Move to next lane",
        "Reading view",
        "Live Preview",
        "Source mode",
        "Rename note",
        "Pin",
        "Close",
        "Close others",
      ];
      const ok =
        want.every(w => items.some(x => x.startsWith(w))) &&
        items.some(x => /Open in new window/.test(x)) &&
        items.filter(x => x === "Open in new lanes tab").length === 1 &&
        items.indexOf("Open in next lane") === 0 &&
        log[0] === [tB, tC, tA].join("|") &&
        log[1] === [tC, tB, tA].join("|") &&
        log[2] === [tB, tC, tA].join("|") &&
        log[3] === JSON.stringify([[tC, tA], [tB], []]) &&
        log[4] === JSON.stringify([[tB, tC, tA], [], []]) &&
        log[5] === JSON.stringify([[tB, tC, tA], [tB], []]) &&
        log[6] === JSON.stringify([`P:${tB}`, tC, tA]) &&
        log[7] === JSON.stringify([tC]) &&
        log[8] === JSON.stringify([]) &&
        log[9] === `2 card:${tA}@0`;
      return { ok, note: JSON.stringify(items) + " LOG " + JSON.stringify(log) };
    },
  },
  {
    id: "CD-16",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 0);
      await openIn(c, C, 0);
      await c.js(`for (const it of T.tab().lanes[0].items) T.tab().lanes[0].setCollapsed(it,true); return 1`);
      await openIn(c, D, 1);
      await c.js(`T.tab().lanes[1].setCollapsed(T.tab().lanes[1].items[0],true); return 1`);
      // within lane: drag first (C) below the third
      const f1 = await c.at(hdr(0, 0));
      const t1 = await c.at(hdr(0, 2));
      const d1 = await drag(c, { x: f1.l + f1.w - 120, y: f1.y }, { x: t1.x, y: t1.t + t1.h - 3 });
      let s = await st(c);
      const r1 = s.lanes[0].join("|");
      // to another lane: drag lane0[0] onto lane 1 bottom area
      const f2 = await c.at(hdr(0, 0));
      const l1 = await c.at(`T.tab().lanes[1].listEl`);
      await drag(c, { x: f2.l + f2.w - 120, y: f2.y }, { x: l1.x, y: l1.t + 200 });
      s = await st(c);
      const r2 = JSON.stringify(s.lanes);
      // mode + cursor kept: set reading on lane1 card then move back
      await c.js(
        `const it=T.tab().lanes[1].items.find(i=>i.file.basename===${JSON.stringify(tB)}); if(it){ await T.tab().lanes[1].setCollapsed(it,false); await T.tab().lanes[1].setView(it,{mode:"preview"}); } await T.sleep(400); return 1`,
      );
      const f3 = await c.at(
        `T.tab().lanes[1].items.find(i=>i.file.basename===${JSON.stringify(tB)}).el.querySelector(".lane-item-header")`,
      );
      const l0 = await c.at(`T.tab().lanes[0].listEl`);
      await drag(c, { x: f3.l + f3.w - 120, y: f3.y }, { x: l0.x, y: l0.t + 5 });
      const m = await c.js(
        `const it=T.tab().lanes[0].items.find(i=>i.file.basename===${JSON.stringify(tB)}); return it && {idx: T.tab().lanes[0].items.indexOf(it), mode: it.leaf?.getViewState().state.mode}`,
      );
      return {
        ok:
          d1 &&
          r1 === [`C:${tB}`, `C:${tA}`, `C:${tC}`].join("|") &&
          s.lanes[1].some(x => x === `C:${tB}` || x === tB) &&
          m?.idx === 0 &&
          m.mode === "preview",
        note: `drag ok ${d1}; within: ${r1}; across: ${r2}; back w/ mode ${JSON.stringify(m)}`,
      };
    },
  },
];
