import { A, B, C, D, MOD, openIn, explorerClick, clickLinkIn, quick, st, eq } from "./common.mjs";
export const cases = [
 { id: "RO-01", run: async c => { await openIn(c, B, 2); await c.clickEl(`document.querySelectorAll(".lane")[1]`, {dy: 400}); await explorerClick(c, A); const s = await st(c); return { ok: eq(s.lanes, [[],["Writing replaces caching"],["Writing hides attention"]]) && s.active==="card:Writing replaces caching@1" && s.roots.length===1, note: JSON.stringify(s) }; } },
 { id: "RO-02", run: async c => { await c.clickEl(`document.querySelectorAll(".lane")[0]`, {dy: 400}); await quick(c, "Writing hides attention"); const s = await st(c); return { ok: eq(s.lanes, [["Writing hides attention"],[],[]]) && s.active==="card:Writing hides attention@0", note: JSON.stringify(s) }; } },
 { id: "RO-05", run: async c => { await openIn(c, A, 2); await clickLinkIn(c, A, /Evidence/); let s = await st(c); const ok1 = eq(s.lanes, [["Evidence is a kind of pronunciation"],[],["Writing replaces caching"]]) && s.active.startsWith("card:Evidence"); 
     await c.js(`await T.tab().setLayout("100"); await T.sleep(500); return 1`); await clickLinkIn(c, A, /Plan incidents/); s = await st(c); const ok2 = s.lanes.length===1 && s.lanes[0][0]==="Plan incidents 57";
     return { ok: ok1 && ok2, note: JSON.stringify(s) }; } },
 { id: "RO-06", run: async c => { await c.js(`T.P().settings.linkTarget="same"; return 1`); await openIn(c, A, 1); await clickLinkIn(c, A, /Evidence/); let s = await st(c); const ok1 = eq(s.lanes[1], ["Evidence is a kind of pronunciation","Writing replaces caching"]);
     await c.js(`T.P().settings.linkTarget="last"; return 1`); await c.clickEl(`document.querySelectorAll(".lane")[2]`, {dy: 400}); await clickLinkIn(c, A, /Plan incidents/); s = await st(c); const ok2 = s.lanes[2][0]==="Plan incidents 57" && s.lanes[1].length===2;
     return { ok: ok1 && ok2, note: "same ok="+ok1+" last→ (clicking a link makes its own lane the last used) "+JSON.stringify(s) }; } },
 { id: "RO-07", run: async c => { await openIn(c, A, 0); await clickLinkIn(c, A, /Evidence/, MOD.ctrl); let s = await st(c); const t1 = s.roots.length===2 && s.active.startsWith("card:Evidence"); const s1=JSON.stringify(s);
     await c.js(`app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("editor-lanes")[0],{focus:true}); await T.sleep(300); return 1`);
     await clickLinkIn(c, A, /Plan incidents/, 0, "middle"); s = await st(c); const t2 = s.roots.length===3 && s.active.startsWith("card:Plan incidents 57@0");
     await c.js(`app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("editor-lanes")[0],{focus:true}); await T.sleep(300); return 1`);
     await clickLinkIn(c, A, /Too much sleep/, MOD.shift|MOD.alt); s = await st(c); const t3 = s.roots.length===4 && s.active.startsWith("card:Too much sleep");
     return { ok: t1&&t2&&t3, note: `ctrl=${t1} ${s1} middle=${t2} shift+alt=${t3} ${JSON.stringify(s)}` }; } },
 { id: "RO-08", run: async c => { await openIn(c, A, 0); await c.clickEl(`document.querySelectorAll(".lane")[2]`, {dy: 400}); await clickLinkIn(c, A, /Evidence/, MOD.shift); let s = await st(c); const t1 = s.lanes[2][0]==="Evidence is a kind of pronunciation";
     // Source mode: shift-click extends the selection
     await c.js(`const it=T.tab().lanes[0].items[0]; await T.tab().lanes[0].setView(it,{mode:"source",source:true}); await T.sleep(300); it.leaf.view.editor.setCursor({line:0,ch:0}); return 1`);
     await c.clickEl(`[...T.tab().lanes[0].items[0].el.querySelectorAll(".cm-line")].find(e=>/Plan incidents/.test(e.textContent))`, {mods: MOD.shift, wait: 700});
     s = await st(c); const sel = await c.js(`return T.tab().lanes[0].items[0].leaf.view.editor.somethingSelected()`);
     return { ok: t1 && sel && !s.lanes.flat().includes("Plan incidents 57"), note: `lp-shift→last lane ${t1}; source shift selects ${sel}; ${JSON.stringify(s.lanes)}` }; } },
];
