import { A, B, C, D, openIn, clickLine, clickLinkIn, st, eq } from "./common.mjs";
const LONG = "_test/Outline mode.md";
const fill = (n, lane = 0) => `const l=T.tab().lanes[${lane}]; const fs=app.vault.getMarkdownFiles().filter(f=>f.path.startsWith("z/") && !/Writing (replaces caching|hides attention|delays interfaces)/.test(f.path)).slice(0,${n}); for (const f of fs) await l.add(f,{focus:false, index: l.items.length}); l.setAllCollapsed(true); await T.sleep(300); l.listEl.scrollTop=0; l.setAllCollapsed(false); await T.sleep(1500);`;
const mounted = lane => `T.tab().lanes[${lane}].items.filter(i=>i.leaf).length`;
const toBottom = async (c, lane = 0) => { const p = await c.at(`T.tab().lanes[${lane}].listEl`); for (let i = 0; i < 400; i++) { await c.wheel(p.x, p.y, 600); await c.sleep(25); if (i % 40 === 39 && await c.js(`const l=T.tab().lanes[${lane}].listEl; return l.scrollTop + l.clientHeight >= l.scrollHeight - 5`)) break; } };
const emptyVisible = lane => `(()=>{const l=T.tab().lanes[${lane}]; const L=l.listEl.getBoundingClientRect(); return l.items.filter(i=>{const r=i.el.getBoundingClientRect(); return !i.collapsed && !i.leaf && r.bottom>L.top && r.top<L.bottom}).length})()`;
export const cases = [
 { id: "PK-01", run: async c => { await c.js(`${fill(120)} return 1`);
     const samples = [];
     const p = await c.at(`T.tab().lanes[0].listEl`);
     for (let i = 0; i < 300; i++) { await c.wheel(p.x, p.y, 500); await c.sleep(40); if (i % 30 === 29) { samples.push(await c.js(`return {m: ${mounted(0)}, empty: ${emptyVisible(0)}, top: Math.round(T.tab().lanes[0].listEl.scrollTop)}`)); } }
     await c.sleep(7000); const after = await c.js(`return {m: ${mounted(0)}, n: T.tab().lanes[0].items.length, hosted: T.P().hostedLeaves.size, md: app.workspace.getLeavesOfType("markdown").length}`);
     // anchor stability while parking happens without scrolling
     await c.js(`const l=T.tab().lanes[0]; l.listEl.scrollTop = l.listEl.scrollHeight/2; await T.sleep(1500); return 1`);
     const a1 = await c.js(`const l=T.tab().lanes[0]; const L=l.listEl.getBoundingClientRect(); const it=l.items.find(i=>i.el.getBoundingClientRect().top>L.top); window.__anchor=it; return Math.round(it.el.getBoundingClientRect().top)`);
     await c.sleep(7000); const a2 = await c.js(`return {y: Math.round(window.__anchor.el.getBoundingClientRect().top), m: ${mounted(0)}}`);
     // scroll back up quickly: cards come back before they show
     const back = []; for (let i = 0; i < 60; i++) { await c.wheel(p.x, p.y, -800); await c.sleep(60); if (i % 10 === 9) back.push(await c.js(`return ${emptyVisible(0)}`)); }
     c.shot("PK-01");
     const ok = samples.every(s => s.m <= 60) && after.m <= 15 && after.hosted <= 15 && Math.abs(a2.y - a1) <= 2 && a2.m <= 15;
     return { ok, note: JSON.stringify({samples, after, anchor: [a1, a2], emptyWhileScrollingUp: back}) }; } },
 { id: "PK-02", run: async c => { await openIn(c, LONG, 0);
     await c.js(`const l=T.tab().lanes[0]; const it=l.items[0]; const e=it.leaf.view.editor; e.setSelection({line:40,ch:2},{line:41,ch:5}); e.exec?.("toggleFold"); await T.sleep(200); app.workspace.setActiveLeaf(it.leaf,{focus:true}); return 1`);
     // fold a heading through the fold command at line of "Stage B"
     const foldLine = await c.js(`const e=T.tab().lanes[0].items[0].leaf.view.editor; const n=e.lineCount(); for (let i=0;i<n;i++) if (/^## Stage B/.test(e.getLine(i))) return i; return -1`);
     await c.js(`const e=T.tab().lanes[0].items[0].leaf.view.editor; e.setCursor({line:${foldLine},ch:0}); app.commands.executeCommandById("editor:toggle-fold"); await T.sleep(300); e.setSelection({line:40,ch:2},{line:41,ch:5}); return 1`);
     const before = await c.js(`const it=T.tab().lanes[0].items[0]; const v=it.leaf.view; return {sel: v.editor.listSelections(), folds: v.currentMode.getFoldInfo?.()?.folds?.length ?? null, mode: v.getState().mode}`);
     // make it far away: 60 cards below, move focus to a card far below and scroll there
     await c.js(`const l=T.tab().lanes[0]; const fs=app.vault.getMarkdownFiles().filter(f=>f.path.startsWith("z/") && !/Writing (replaces caching|hides attention|delays interfaces)/.test(f.path)).slice(0,60); for (const f of fs) await l.add(f,{focus:false, index: l.items.length}); await T.sleep(500); return 1`);
     await toBottom(c, 0); await c.js(`const l=T.tab().lanes[0]; const last=l.items[l.items.length-1]; if(!last.leaf) await l.setCollapsed(last,false); app.workspace.setActiveLeaf(last.leaf,{focus:true}); await T.sleep(7000); return 1`);
     const parked = await c.js(`const it=T.tab().lanes[0].items[0]; return {leaf: !!it.leaf, parked: !!it.parked, minH: it.bodyEl.style.minHeight}`);
     await c.js(`T.tab().lanes[0].listEl.scrollTop=0; await T.sleep(2500); return 1`);
     const after = await c.js(`const it=T.tab().lanes[0].items[0]; const v=it.leaf?.view; return v ? {sel: v.editor.listSelections(), folds: v.currentMode.getFoldInfo?.()?.folds?.length ?? null, mode: v.getState().mode, minH: it.bodyEl.style.minHeight} : null`);
     await c.js(`app.workspace.setActiveLeaf(T.tab().lanes[0].items[0].leaf,{focus:true}); app.commands.executeCommandById("editor:unfold-all"); await T.sleep(300); return 1`);
     return { ok: !parked.leaf && parked.parked && !!after && eq(after.sel, before.sel) && after.folds===before.folds && before.folds>=1 && after.minH==="", note: JSON.stringify({before, parked, after}) }; } },
 { id: "PK-03", run: async c => { await openIn(c, A, 0); await c.js(`const l=T.tab().lanes[0]; const fs=app.vault.getMarkdownFiles().filter(f=>f.path.startsWith("z/") && !/Writing (replaces caching|hides attention|delays interfaces)/.test(f.path)).slice(0,60); for (const f of fs) await l.add(f,{focus:false, index: l.items.length}); await T.sleep(500); return 1`);
     await toBottom(c, 0); await c.js(`const l=T.tab().lanes[0]; const last=l.items[l.items.length-1]; if(!last.leaf) await l.setCollapsed(last,false); app.workspace.setActiveLeaf(last.leaf,{focus:true}); await T.sleep(7000); return 1`);
     const parked = await c.js(`return !T.tab().lanes[0].items[0].leaf`);
     await c.js(`T.tab().lanes[0].listEl.scrollTop=0; await T.sleep(2500); return 1`);
     // Ctrl+F in the remounted card
     await clickLine(c, `T.tab().lanes[0].items[0]`, 1); await c.key("f", {ctrl:true}); await c.sleep(300); await c.type("the"); await c.sleep(300); await c.key("Enter"); await c.sleep(300);
     const search = await c.js(`return T.tab().lanes[0].items[0].el.querySelector(".document-search-count")?.textContent`); await c.key("Escape");
     // Outliner / editing: Tab on a list
     await c.clickEl(`[...T.tab().lanes[0].items[0].el.querySelectorAll(".cm-content .cm-underline")].find(e=>/Onboarding/.test(e.textContent))`, {wait: 1000});
     const link = await c.js(`return T.lanes()[1]`);
     return { ok: parked && /[0-9]+ . [0-9]+/.test(search||"") && /Onboarding/.test(link[0]), note: JSON.stringify({parked, search, link}) }; } },
 { id: "PK-04", run: async c => { await openIn(c, A, 0); await c.js(`const l=T.tab().lanes[0]; const fs=app.vault.getMarkdownFiles().filter(f=>f.path.startsWith("z/") && !/Writing (replaces caching|hides attention|delays interfaces)/.test(f.path)).slice(0,60); for (const f of fs) await l.add(f,{focus:false, index: l.items.length}); await T.sleep(500); return 1`);
     // A stays the active card while the lane scrolls far away
     await clickLine(c, `T.tab().lanes[0].items[0]`, 1);
     await c.js(`const l=T.tab().lanes[0]; for (let i=0;i<40;i++){ l.listEl.scrollTop += 2000; await T.sleep(60);} await T.sleep(7000); return 1`);
     const r = await c.js(`const it=T.tab().lanes[0].items[0]; return {leaf: !!it.leaf, active: T.active(), scrolled: T.tab().lanes[0].listEl.scrollTop, mounted: ${mounted(0)}}`);
     return { ok: r.leaf && r.active.startsWith("card:Writing replaces caching") && r.scrolled > 20000, note: JSON.stringify(r) }; } },
  { id: "PK-05", run: async c => { await c.js(`await app.vault.modify(T.f("_test/EL list.md"),"- a\\n- b"); return 1`); await openIn(c, "_test/EL list.md", 0);
     await c.js(`const l=T.tab().lanes[0]; const fs=app.vault.getMarkdownFiles().filter(f=>f.path.startsWith("z/") && !/Writing (replaces caching|hides attention|delays interfaces)/.test(f.path)).slice(0,60); for (const f of fs) await l.add(f,{focus:false, index: l.items.length}); await T.sleep(300); return 1`);
     await toBottom(c, 0); await c.js(`const l=T.tab().lanes[0]; const last=l.items[l.items.length-1]; if(!last.leaf) await l.setCollapsed(last,false); app.workspace.setActiveLeaf(last.leaf,{focus:true}); await T.sleep(7000); return 1`);
     const parked = await c.js(`return !T.tab().lanes[0].items[0].leaf`);
     await c.js(`T.tab().lanes[0].listEl.scrollTop=0; await T.sleep(2000); return 1`);
     await clickLine(c, "T.tab().lanes[0].items[0]", 1); await c.key("End"); await c.key("Tab"); await c.sleep(300);
     const v = await c.js(`return T.tab().lanes[0].items[0].leaf.view.editor.getValue()`);
     return { ok: parked && /^- a\n\s+- b$/.test(v), note: JSON.stringify({parked, v}) }; } },
  { id: "PK-07", run: async c => { await c.js(`await app.vault.modify(T.f("_test/EL u1.md"),"base"); return 1`); await openIn(c, "_test/EL u1.md", 0); await clickLine(c, "T.tab().lanes[0].items[0]", 0); await c.key("End"); await c.type(" x"); await c.sleep(2500);
     await c.js(`const l=T.tab().lanes[0]; const fs=app.vault.getMarkdownFiles().filter(f=>f.path.startsWith("z/") && !/Writing (replaces caching|hides attention|delays interfaces)/.test(f.path)).slice(0,60); for (const f of fs) await l.add(f,{focus:false, index: l.items.length}); await T.sleep(300); return 1`);
     await toBottom(c, 0); await c.js(`const l=T.tab().lanes[0]; const last=l.items[l.items.length-1]; if(!last.leaf) await l.setCollapsed(last,false); app.workspace.setActiveLeaf(last.leaf,{focus:true}); await T.sleep(7000); return 1`);
     const parked = await c.js(`return !T.tab().lanes[0].items[0].leaf`);
     await c.js(`T.tab().lanes[0].listEl.scrollTop=0; await T.sleep(2000); app.workspace.setActiveLeaf(T.tab().lanes[0].items[0].leaf,{focus:true}); return 1`);
     await c.key("z", {ctrl:true}); await c.sleep(300); const v = await c.js(`return T.tab().lanes[0].items[0].leaf.view.editor.getValue()`);
     await c.js(`await T.sleep(2200); await app.vault.modify(T.f("_test/EL u1.md"),"base"); return 1`);
     return { ok: parked && v==="base", note: JSON.stringify({parked, afterUndo: v}) }; } },
];
