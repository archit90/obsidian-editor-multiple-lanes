import {
  A,
  B,
  C,
  D,
  FILES,
  NOTES,
  openIn,
  explorerClick,
  clickLinkIn,
  quick,
  st,
  eq,
  headerClick,
  tA,
  tB,
  tC,
  tD,
} from "./common.mjs";
const L1 = NOTES.L1.title;
const README = NOTES.README.path;
const LINKS = "_test/el-links.md";
const linksText = `Links: [[${README.replace(/\.md$/, "")}]] and [[${FILES.PDF}]] and [[${FILES.CANVAS}]]\n\n![[${FILES.PNG}]]`;
export const cases = [
  {
    id: "RO-03",
    run: async c => {
      await c.key("t", { ctrl: true });
      await c.sleep(100);
      const mid = await c.js(`return T.roots()`);
      await quick(c, tB);
      await c.sleep(300);
      const s = await st(c);
      return {
        ok:
          s.roots.length === 2 &&
          s.roots.every(r => r.startsWith("editor-lanes")) &&
          s.active.startsWith(`card:${tB}@0`) &&
          s.lanes[0][0] === tB,
        note: "mid=" + JSON.stringify(mid) + " " + JSON.stringify(s),
      };
    },
  },
  {
    id: "RO-04",
    run: async c => {
      await openIn(c, A, 0);
      await c.key("w", { ctrl: true });
      await c.sleep(200);
      let s = await st(c);
      const t1 = eq(s.lanes, [[], [], []]); // Ctrl+W on the card closes the card
      await c.js(
        `app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("editor-lanes")[0],{focus:true}); await T.sleep(100); return 1`,
      );
      await c.key("w", { ctrl: true });
      await c.sleep(800);
      s = await st(c);
      return {
        ok: t1 && s.roots.length === 1 && s.roots[0].startsWith("editor-lanes"),
        note: "card closed by Ctrl+W=" + t1 + "; " + JSON.stringify(s),
      };
    },
  },
  {
    id: "RO-09",
    run: async c => {
      await c.js(
        `await T.note("_test/EL excepted.md", "excepted"); T.P().settings.routeExceptions="_test/\\nREADME"; await T.P().settingsChanged("routing"); return 1`,
      );
      await explorerClick(c, "_test/EL excepted.md");
      let s = await st(c);
      const t1 = s.roots.includes("markdown:_test/EL excepted.md") && eq(s.lanes, [[], [], []]);
      // a link to an excepted note from a card
      await c.js(
        `await T.note(${JSON.stringify(LINKS)}, ${JSON.stringify(linksText)}); app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("editor-lanes")[0],{focus:true}); T.P().settings.routeExceptions="README"; await T.P().settingsChanged("routing"); await T.P().openInLane(T.f(${JSON.stringify(LINKS)}),"same",T.tab().lanes[0],{focus:true}); await T.sleep(500); return 1`,
      );
      await clickLinkIn(c, LINKS, "README");
      s = await st(c);
      const t2 = s.roots.includes("markdown:" + README) && s.lanes[0].length === 1;
      return {
        ok: t1 && t2,
        note: `explorer excepted→tab ${t1}; link to excepted from card→tab ${t2}; ${JSON.stringify(s)}`,
      };
    },
  },
  {
    id: "RO-10",
    run: async c => {
      await c.js(
        `await T.note(${JSON.stringify(LINKS)}, ${JSON.stringify(linksText)}); await T.P().openInLane(T.f(${JSON.stringify(LINKS)}),"same",T.tab().lanes[0],{focus:true}); await T.sleep(600); return 1`,
      );
      await clickLinkIn(c, LINKS, "kitchen");
      let s = await st(c);
      const t1 = s.roots.some(r => r.startsWith("pdf")) && s.lanes[0][0] === "el-links";
      await c.js(
        `app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("editor-lanes")[0],{focus:true}); await T.sleep(300); return 1`,
      );
      await clickLinkIn(c, LINKS, "board");
      s = await st(c);
      const t2 = s.roots.some(r => r.startsWith("canvas")) && s.lanes[0][0] === "el-links";
      return { ok: t1 && t2, note: `pdf→tab ${t1}; canvas→tab ${t2}; ${JSON.stringify(s)}` };
    },
  },
  {
    id: "RO-11",
    run: async c => {
      await openIn(c, A, 0);
      await c.clickEl(`document.querySelectorAll(".lane")[2]`, { dy: 400 });
      await c.js(`T.P().settings.duplicateMode="copy"; return 1`);
      await quick(c, tA);
      let s = await st(c);
      const copy = eq(s.lanes, [[tA], [], [tA]]);
      await c.js(
        `const l=T.tab().lanes[2]; l.close(l.items[0]); T.tab().lanes[0].setCollapsed(T.tab().lanes[0].items[0], true); T.P().settings.duplicateMode="jump"; return 1`,
      );
      await c.clickEl(`document.querySelectorAll(".lane")[2]`, { dy: 400 });
      await quick(c, tA);
      s = await st(c);
      const jump = eq(s.lanes, [[tA], [], []]) && s.active === `card:${tA}@0`;
      await c.js(`T.P().settings.duplicateMode="move"; return 1`);
      await c.clickEl(`document.querySelectorAll(".lane")[1]`, { dy: 400 });
      await quick(c, tA);
      s = await st(c);
      const move = eq(s.lanes, [[], [tA], []]) && s.active === `card:${tA}@1`;
      return { ok: copy && jump && move, note: `copy ${copy} jump ${jump} move ${move} ${JSON.stringify(s)}` };
    },
  },
  {
    id: "RO-12",
    run: async c => {
      await openIn(c, A, 0);
      await openIn(c, B, 0);
      let s = await st(c);
      const top = eq(s.lanes[0], [tB, tA]);
      await c.js(`T.P().settings.newNotePosition="bottom"; return 1`);
      await openIn(c, C, 0);
      s = await st(c);
      const bottom = s.lanes[0][2] === tC;
      await c.js(`T.P().settings.newNotePosition="after"; T.P().settings.linkTarget="same"; return 1`);
      await clickLinkIn(c, A, L1);
      s = await st(c);
      const after = s.lanes[0][2] === L1 && s.lanes[0][1] === tA;
      return {
        ok: top && bottom && after,
        note: `top ${top} bottom ${bottom} after ${after} ${JSON.stringify(s.lanes)}`,
      };
    },
  },
  {
    id: "RO-13",
    run: async c => {
      await c.js(`T.P().settings.accordion=true; return 1`);
      await openIn(c, A, 0);
      await openIn(c, B, 0);
      await c.js(
        `T.tab().lanes[0].togglePin(T.tab().lanes[0].items.find(i=>i.file.basename===${JSON.stringify(tB)})); return 1`,
      );
      await openIn(c, C, 0);
      let s = await st(c);
      const t1 = eq(s.lanes[0], [`P:${tB}`, tC, `C:${tA}`]);
      await headerClick(c, "T.tab().lanes[0].items[2]");
      await c.sleep(500);
      s = await st(c);
      const t2 = eq(s.lanes[0], [`P:${tB}`, `C:${tC}`, tA]);
      return { ok: t1 && t2, note: JSON.stringify(s.lanes) };
    },
  },
  {
    id: "RO-14",
    run: async c => {
      await c.js(`T.P().settings.maxNotesPerLane=2; return 1`);
      await openIn(c, A, 0);
      await openIn(c, B, 0);
      await c.js(`T.tab().lanes[0].togglePin(T.tab().lanes[0].items[1]); return 1`);
      await openIn(c, C, 0);
      await openIn(c, D, 0);
      let s = await st(c);
      return {
        ok: eq(s.lanes[0], [`P:${tA}`, tD]),
        note: JSON.stringify(s.lanes),
      };
    },
  },
  {
    id: "RO-15",
    run: async c => {
      await c.js(`T.P().settings.autoCollapseAfter=2; return 1`);
      await openIn(c, A, 0);
      await openIn(c, B, 0);
      await openIn(c, C, 0);
      let s = await st(c);
      return {
        ok: eq(s.lanes[0], [tC, tB, `C:${tA}`]),
        note: JSON.stringify(s.lanes),
      };
    },
  },
];
