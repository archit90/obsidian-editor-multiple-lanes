import { A, B, C, D, MOD, openIn, clickLine, st, eq } from "./common.mjs";
const item = (lane, i) => `T.tab().lanes[${lane}].items[${i}]`;
const LONG = "_test/Outline mode.md";
export const cases = [
 { id: "NE-17", run: async c => { await c.js(`if(T.f("_test/EL vim.md")) await app.vault.modify(T.f("_test/EL vim.md"),"one\\ntwo\\nthree"); else await app.vault.create("_test/EL vim.md","one\\ntwo\\nthree"); app.vault.setConfig("vimMode", true); app.workspace.updateOptions(); await T.sleep(300); return 1`);
     await openIn(c, "_test/EL vim.md", 0); await clickLine(c, item(0,0), 0); await c.key("Escape"); await c.key("j"); await c.sleep(150);
     const r1 = await c.js(`return ${item(0,0)}.leaf.view.editor.getCursor()`);
     await c.key("A"); await c.type("X"); await c.key("Escape"); await c.sleep(200); const v = await c.js(`return ${item(0,0)}.leaf.view.editor.getValue()`);
     await c.key("u"); await c.sleep(200); const u = await c.js(`return ${item(0,0)}.leaf.view.editor.getValue()`);
     // in a long note, Ctrl-E (Vim scroll) — documented limit: does not scroll the lane
     await openIn(c, LONG, 1); await clickLine(c, item(1,0), 1); await c.key("Escape"); const s0 = await c.js(`return T.tab().lanes[1].listEl.scrollTop`);
     await c.key("d", {ctrl:true}); await c.sleep(300); const s1 = await c.js(`return {scroll: T.tab().lanes[1].listEl.scrollTop, line: ${item(1,0)}.leaf.view.editor.getCursor().line}`);
     await c.js(`app.vault.setConfig("vimMode", false); app.workspace.updateOptions(); return 1`);
     return { ok: r1.line===1 && v==="one\ntwoX\nthree" && u==="one\ntwo\nthree", note: JSON.stringify({r1, v, u, ctrlD: {s0, ...s1}}) }; } },
 { id: "NE-18", run: async c => { await openIn(c, LONG, 0); await clickLine(c, item(0,0), 1); const s0 = await c.js(`return {s: T.tab().lanes[0].listEl.scrollTop, l: ${item(0,0)}.leaf.view.editor.getCursor().line}`);
     await c.key("PageDown"); await c.sleep(300); const s1 = await c.js(`return {s: T.tab().lanes[0].listEl.scrollTop, l: ${item(0,0)}.leaf.view.editor.getCursor().line}`);
     return { ok: s1.l > s0.l && s1.s > s0.s, note: JSON.stringify({s0, s1}) }; } },
];
