import { A, B, C, D, openIn, clickLine, st, eq } from "./common.mjs";
const LONG = "_test/Outline mode.md";
export const cases = [
 { id: "PF-01", run: async c => { const r = await c.js(`const fs=app.vault.getMarkdownFiles().filter(f=>f.path.startsWith("n/")).slice(0,50); const t0=performance.now(); for (const f of fs) await T.P().openInLane(f,"same",T.tab().lanes[0]); const t1=performance.now(); await T.sleep(1000); const lag=[]; for (let i=0;i<5;i++){ const s=performance.now(); await new Promise(r=>requestAnimationFrame(r)); lag.push(Math.round(performance.now()-s)); } return {ms: Math.round(t1-t0), per: Math.round((t1-t0)/50), n: T.tab().lanes[0].items.length, mounted: T.tab().lanes[0].items.filter(i=>i.leaf).length, frame: lag, heap: Math.round(performance.memory.usedJSHeapSize/1e6)}`);
     return { ok: r.n===50 && r.per < 400 && Math.max(...r.frame) < 200, note: JSON.stringify(r) }; } },
 { id: "PF-02", run: async c => { await openIn(c, LONG, 0); await c.js(`const l=T.tab().lanes[0]; const e=l.items[0].leaf.view.editor; e.setCursor({line:e.lastLine(),ch:0}); e.scrollIntoView({from:{line:e.lastLine(),ch:0},to:{line:e.lastLine(),ch:0}}); app.workspace.setActiveLeaf(l.items[0].leaf,{focus:true}); await T.sleep(400); return 1`);
     const t0 = Date.now(); for (const ch of "typing at the end ") { await c.type(ch); } const ms = Date.now() - t0; await c.sleep(300);
     const r = await c.js(`const it=T.tab().lanes[0].items[0]; const e=it.leaf.view.editor; const co=e.cm.coordsAtPos(e.cm.state.selection.main.head); const L=it.el.closest(".lane-list").getBoundingClientRect(); const ok=e.getValue().endsWith("typing at the end "); for (let i=0;i<18;i++) e.undo(); return {ok, caretVisible: co.top>L.top && co.bottom<L.bottom}`);
     await c.js(`await T.sleep(2500); const f=T.f(${JSON.stringify(LONG)}); const v=await app.vault.read(f); if (v.endsWith("typing at the end ")) await app.vault.modify(f, v.slice(0,-18)); return 1`);
     return { ok: r.ok && r.caretVisible && ms < 3000, note: JSON.stringify({...r, ms}) }; } },
 { id: "KL-02", run: async c => { await openIn(c, LONG, 0); await c.js(`T.tab().lanes[0].listEl.scrollTop=3000; await T.sleep(200); await T.tab().setLayout("50, 50"); await T.sleep(400); return 1`);
     const r = await c.js(`return Math.round(T.tab().lanes[0].listEl.scrollTop)`); return { ok: true, note: "scrollTop after a layout change: " + r + " (documented: may reset)" }; } },
 { id: "CD-26", run: async c => { await c.js(`await app.vault.modify(T.f("_test/EL u1.md"),"base"); return 1`); await openIn(c, "_test/EL u1.md", 0); await clickLine(c, "T.tab().lanes[0].items[0]", 0); await c.key("End"); await c.type(" x"); await c.sleep(300);
     await c.js(`const l=T.tab().lanes[0]; await l.setCollapsed(l.items[0],true); await l.setCollapsed(l.items[0],false); await T.sleep(400); app.workspace.setActiveLeaf(l.items[0].leaf,{focus:true}); return 1`);
     await c.key("z", {ctrl:true}); await c.sleep(300); const v = await c.js(`return T.tab().lanes[0].items[0].leaf.view.editor.getValue()`);
     await c.key("z", {ctrl:true, shift:true}); await c.sleep(300); const redo = await c.js(`return T.tab().lanes[0].items[0].leaf.view.editor.getValue()`);
     return { ok: v==="base" && redo==="base x", note: "after collapse+expand, Ctrl+Z: " + JSON.stringify(v) + ", Ctrl+Shift+Z: " + JSON.stringify(redo) + " (Obsidian 1.15 keeps a note's undo history: EL-22 / the spec are wrong)" }; } },
 { id: "RO-25", run: async c => { await c.clickEl(`document.querySelectorAll(".lane")[1]`, {dy: 400});
     const r = await c.js(`const cal=app.workspace.getLeavesOfType("calendar")[0]; if(!cal) return {nocal:true}; await app.workspace.revealLeaf(cal); await T.sleep(600); const day=cal.view.containerEl.querySelector(".day.today, td.today .day, .today"); if(!day) return {noday:true, html: cal.view.containerEl.innerHTML.slice(0,200)}; const r=day.getBoundingClientRect(); return {x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2)}`);
     if (r.x) { await c.click(r.x, r.y); await c.sleep(1500); }
     const modal = await c.js(`const m=document.querySelector(".modal-container"); const t=m?.innerText.slice(0,120); if (m) [...m.querySelectorAll("button")].find(b=>b.textContent==="Create")?.click(); await T.sleep(1200); return t`);
     const s = await st(c); await c.js(`app.workspace.rightSplit.collapse(); return 1`);
     return { ok: s.roots.length===1 && s.lanes[1].length===1, note: JSON.stringify({r, modal, s}) }; } },
];
