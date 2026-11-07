import { A, B, C, D, openIn, clickLine, st, eq, quick } from "./common.mjs";
const item = (lane, i) => `T.tab().lanes[${lane}].items[${i}]`;
const pal = async (c, name) => {
  await c.key("p", { ctrl: true });
  await c.sleep(400);
  await c.type(name);
  await c.sleep(600);
  const top = await c.js(`return document.querySelector(".suggestion-item.is-selected")?.textContent`);
  await c.key("Enter");
  await c.sleep(800);
  return top;
};
export const cases = [
  {
    id: "CM-01",
    run: async c => {
      const log = {};
      await openIn(c, A, 0);
      await openIn(c, B, 0);
      await clickLine(c, item(0, 0), 1);
      log.pin = await pal(c, "Editor Lanes: Pin or unpin");
      log.pinR = (await st(c)).lanes[0];
      await clickLine(c, item(0, 1), 1);
      log.next = await pal(c, "Editor Lanes: Move the current note to the next");
      log.nextR = (await st(c)).lanes;
      log.prev = await pal(c, "Editor Lanes: Move the current note to the previous");
      log.prevR = (await st(c)).lanes;
      await clickLine(c, item(0, 1), 1);
      log.coll = await pal(c, "Editor Lanes: Collapse all notes in the current");
      log.collR = (await st(c)).lanes[0];
      log.close = await pal(c, "Editor Lanes: Close all notes in the current");
      log.closeR = (await st(c)).lanes[0];
      log.openNote = await pal(c, "Editor Lanes: Open note in an editor lane");
      await c.type("Vocabulary predicts money");
      await c.sleep(600);
      await c.key("Enter");
      await c.sleep(800);
      log.openNoteR = (await st(c)).lanes;
      log.newTab = await pal(c, "Editor Lanes: Open current note in a new lanes tab");
      log.newTabR = await c.js(`return {n: T.tabs().length, a: T.active()}`);
      log.toggle = await pal(c, "Editor Lanes: Toggle editor lanes only");
      log.toggleR = await c.js(`return T.P().settings.lanesOnly`);
      await pal(c, "Editor Lanes: Toggle editor lanes only");
      const ok =
        eq(log.pinR, ["P:Writing hides attention", "Writing replaces caching"]) &&
        eq(log.nextR[1], ["Writing replaces caching"]) &&
        log.prevR[1].length === 0 &&
        eq(log.collR, ["P:C:Writing hides attention", "C:Writing replaces caching"]) &&
        eq(log.closeR, ["P:C:Writing hides attention"]) &&
        log.openNoteR.flat().includes("Vocabulary predicts money") &&
        log.newTabR.n === 2 &&
        log.toggleR === false;
      return { ok, note: JSON.stringify(log) };
    },
  },
  {
    id: "CM-02",
    run: async c => {
      await c.js(
        `await T.reset(); const l=app.workspace.getLeaf("tab"); await l.setViewState({type:"graph",active:true}); for (const x of app.workspace.getLeavesOfType("editor-lanes")) x.detach(); await T.sleep(300); return 1`,
      );
      const r = await c.js(
        `const ids=["change-layout","rename-tab","open-current","open-current-new-lane","toggle-pin","move-next-lane","move-previous-lane"].map(i=>"obsidian-editor-lanes:"+i); const av = ids.filter(id=>{ const cmd=app.commands.findCommand(id); return cmd.checkCallback ? cmd.checkCallback(true) : true}); app.commands.executeCommandById("obsidian-editor-lanes:close-all"); app.commands.executeCommandById("obsidian-editor-lanes:collapse-all"); await T.sleep(300); return {av, roots: T.roots()}`,
      );
      return { ok: r.av.length === 0, note: JSON.stringify(r) };
    },
  },
  {
    id: "CM-03",
    run: async c => {
      await c.js(
        `T.P().settings.lanesOnly=false; await T.P().settingsChanged("routing"); const l=app.workspace.getLeaf("tab"); await l.openFile(T.f(${JSON.stringify(A)})); app.workspace.setActiveLeaf(l,{focus:true}); await T.sleep(300); app.commands.executeCommandById("obsidian-editor-lanes:open-current"); await T.sleep(800); return 1`,
      );
      const s = await st(c);
      return {
        ok: s.lanes.flat().includes("Writing replaces caching") && s.roots.includes("markdown:" + A),
        note: JSON.stringify(s),
      };
    },
  },
  {
    id: "CM-04",
    run: async c => {
      await c.js(`await T.tab().setLayout("100"); return 1`);
      await openIn(c, A, 0);
      await clickLine(c, item(0, 0), 1);
      await c.js(
        `document.querySelectorAll(".notice").forEach(n=>n.remove()); app.commands.executeCommandById("obsidian-editor-lanes:move-next-lane"); await T.sleep(300); return 1`,
      );
      const n = await c.js(`return [...document.querySelectorAll(".notice")].map(n=>n.textContent)`);
      return { ok: n.some(x => /only one lane/.test(x)), note: JSON.stringify(n) };
    },
  },
];
