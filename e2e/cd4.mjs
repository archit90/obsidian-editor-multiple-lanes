import { A, B, C, D, MOD, openIn, explorerClick, clickLinkIn, quick, st, eq, headerClick } from "./common.mjs";
import { drag } from "./lib.mjs";
const item = (lane, i) => `T.tab().lanes[${lane}].items[${i}]`;
const hdr = (lane,i) => `${item(lane,i)}.el.querySelector(".lane-item-header")`;
const exEl = p => `(()=>{app.workspace.getLeavesOfType("file-explorer")[0].view.revealInFolder(T.f(${JSON.stringify(p)})); return document.querySelector('.nav-file-title[data-path="${p}"]')})()`;
export const cases = [
 { id: "CD-17", run: async c => { await openIn(c, B, 0);
     await c.js(`T.P().settings.routeExceptions="_test/EL target.md"; await T.P().settingsChanged("routing"); if(!T.f("_test/EL target.md")) await app.vault.create("_test/EL target.md","line one\\n\\nline two"); else await app.vault.modify(T.f("_test/EL target.md"),"line one\\n\\nline two"); const l=app.workspace.getLeaf("split"); await l.openFile(T.f("_test/EL target.md")); await T.sleep(600); return 1`);
     const f = await c.at(hdr(0,0)); const t = await c.at(`[...document.querySelectorAll(".workspace-leaf")].find(l=>!l.closest(".lane-item") && l.querySelector(".cm-content") && /line two/.test(l.textContent)).querySelectorAll(".cm-line")[2]`);
     await drag(c, {x: Math.round(f.l + 4), y: f.y}, {x: t.x + 30, y: t.y}); await c.sleep(500);
     const r = await c.js(`const v=app.workspace.getLeavesOfType("markdown").find(l=>l.view.file?.path==="_test/EL target.md" && !T.P().hostedLeaves.has(l))?.view.editor.getValue(); return {v, lanes: T.lanes()}`);
     return { ok: (r.v||"").includes("Writing hides attention]]") && r.lanes[0].length===1, note: JSON.stringify(r) }; } },
 { id: "CD-18", run: async c => { await openIn(c, A, 1); await c.js(`for (const it of T.tab().lanes[1].items) T.tab().lanes[1].setCollapsed(it,true); return 1`);
     const res = {};
     // explorer file → lane 0
     let f = await c.at(exEl(C)); let t = await c.at(`T.tab().lanes[0].listEl`); await drag(c, f, {x: t.x, y: t.t + 100}); res.explorer = (await st(c)).lanes[0][0];
     // explorer file → lane 1 above existing (drop point before first card)
     f = await c.at(exEl(D)); t = await c.at(hdr(1,0)); await drag(c, f, {x: t.x, y: t.t + 3}); res.dropPoint = (await st(c)).lanes[1].join("|");
     // a search result
     await c.js(`const s=app.workspace.getLeavesOfType("search")[0]; app.workspace.revealLeaf(s); s.view.setQuery("Writing beats memory"); await T.sleep(2500); return 1`);
     f = await c.at(`[...document.querySelectorAll(".workspace-leaf-content[data-type=search] .tree-item-self.search-result-file-title")][0]`);
     const sname = await c.js(`return document.querySelector(".workspace-leaf-content[data-type=search] .search-result-file-title")?.textContent`);
     if (f) { t = await c.at(`T.tab().lanes[2].listEl`); await drag(c, f, {x: t.x, y: t.t + 100}); res.search = (await st(c)).lanes[2][0]; res.searchOk = !!res.search && sname.startsWith(res.search); }
     await c.js(`app.workspace.revealLeaf(app.workspace.getLeavesOfType("file-explorer")[0]); return 1`);
     // a Reading-view link: put card A into reading and drag its link into lane 2
     await c.js(`const l=T.tab().lanes[1]; const it=l.items.find(i=>i.file.path===${JSON.stringify(A)}); await l.setCollapsed(it,false); await l.setView(it,{mode:"preview"}); await T.sleep(600); return 1`);
     f = await c.at(`[...T.tab().lanes[1].items.find(i=>i.file.path===${JSON.stringify(A)}).el.querySelectorAll(".markdown-preview-view a.internal-link")].find(a=>/Evidence/.test(a.textContent))`);
     t = await c.at(`T.tab().lanes[2].listEl`); await drag(c, f, {x: t.x, y: t.t + 3}); res.readingLink = (await st(c)).lanes[2].join("|");
     // obsidian:// URL / [[link]] as dragged text: simulate a text drop on the lane background
     await c.js(`const el=T.tab().lanes[0].listEl; const r=el.getBoundingClientRect(); const dt=new DataTransfer(); dt.setData("text/plain","[[Vocabulary predicts money]]\\nobsidian://open?vault=vault&file=z%2FWriting%20beats%20hiring"); for (const type of ["dragenter","dragover","drop"]) el.dispatchEvent(new DragEvent(type,{dataTransfer:dt,bubbles:true,cancelable:true,clientX:r.left+50,clientY:r.bottom-50})); await T.sleep(800); return 1`);
     res.text = (await st(c)).lanes[0].join("|");
     // a tab header: make a normal tab (exception) and drag its header to lane 0
     await c.js(`T.P().settings.routeExceptions="README"; await T.P().settingsChanged("routing"); const l=app.workspace.getLeaf("tab"); await l.openFile(T.f("README.md")); await T.sleep(400); app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("editor-lanes")[0]); await T.sleep(300); return 1`);
     f = await c.at(`[...document.querySelectorAll(".workspace-tab-header")].find(e=>e.getAttribute("aria-label")==="README")`); t = await c.at(`T.tab().lanes[0].listEl`);
     if (f) { await drag(c, f, {x: t.x, y: t.t + 30}); res.tabHeader = (await st(c)).lanes[0][0] + " roots=" + (await st(c)).roots.join(","); }
     const ok = res.explorer==="Writing delays interfaces" && res.dropPoint.startsWith("Vocabulary predicts money|") && res.searchOk && /Evidence/.test(res.readingLink) && /Vocabulary predicts money/.test(res.text) && /Writing beats hiring/.test(res.text);
     return { ok, note: JSON.stringify(res) }; } },
 { id: "CD-19", run: async c => { await openIn(c, A, 1);
     await c.js(`T.P().settings.dropOnText="open"; return 1`);
     let f = await c.at(exEl(C)); let t = await c.at(`T.tab().lanes[1].items[0].el.querySelectorAll(".cm-line")[1]`); await drag(c, f, t);
     const r = await c.js(`return {lanes: T.lanes(), text: /Writing delays interfaces/.test(T.tab().lanes[1].items.find(i=>i.file.path===${JSON.stringify(A)}).leaf.view.editor.getValue())}`);
     // a plain text drag over a body still moves text: not tested here (would edit the note)
     return { ok: r.lanes[1].includes("Writing delays interfaces") && !r.text, note: JSON.stringify(r) }; } },
 { id: "CD-20", run: async c => { await c.js(`T.P().settings.noteHeight="cap"; T.P().settings.noteMaxHeight=400; await T.P().settingsChanged("looks"); return 1`); await openIn(c, "_test/Outline mode.md", 0);
     const r = await c.js(`const it=${item(0,0)}; return {body: it.bodyEl.getBoundingClientRect().height, sh: it.bodyEl.scrollHeight, ov: getComputedStyle(it.bodyEl).overflowY}`);
     // Ctrl+F in the capped card: bar sticks at the body top
     await c.clickEl(`${item(0,0)}.el.querySelectorAll(".cm-line")[2]`); await c.key("f", {ctrl: true}); await c.sleep(300); await c.type("item"); await c.sleep(300); await c.key("Enter"); await c.key("Enter"); await c.key("Enter"); await c.sleep(400);
     const r2 = await c.js(`const it=${item(0,0)}; const bar=it.el.querySelector(".document-search-container"); const b=bar?.getBoundingClientRect(), body=it.bodyEl.getBoundingClientRect(); return {bar: !!bar, barTop: b && Math.round(b.top-body.top), bodyScroll: it.bodyEl.scrollTop}`);
     c.shot("CD-20"); await c.key("Escape");
     return { ok: r.body <= 401 && r.sh > 1000 && r.ov==="auto" && r2.bar && Math.abs(r2.barTop) <= 2 && r2.bodyScroll > 0, note: JSON.stringify([r, r2]) }; } },
 { id: "CD-21", run: async c => { await openIn(c, A, 0); await openIn(c, A, 2);
     await c.clickEl(`${item(0,0)}.el.querySelectorAll(".cm-line")[1]`); await c.key("End"); await c.type(" ZZQ"); await c.sleep(800);
     const r = await c.js(`return {other: /ZZQ/.test(${item(2,0)}.leaf.view.editor.getValue()), both: T.lanes()}`);
     await c.key("z", {ctrl:true}); await c.sleep(300);
     await c.clickEl(`${item(2,0)}.el.querySelector(".lane-close")`); const r2 = await c.js(`return {lanes: T.lanes(), stillEditor: !!${item(0,0)}.leaf?.view.editor}`);
     const clean = await c.js(`await T.sleep(1500); return !/ZZQ/.test(await app.vault.read(T.f(${JSON.stringify(A)})))`);
     return { ok: r.other && r2.stillEditor && r2.lanes[2].length===0 && clean, note: JSON.stringify([r, r2, clean]) }; } },
 { id: "CD-22", run: async c => { await c.js(`for (const p of ["_test/EL ren a.md","_test/EL ren b.md","_test/sub/EL ren b.md"]) if(T.f(p)) await app.vault.delete(T.f(p)); await app.vault.createFolder("_test/sub").catch(()=>0); await app.vault.create("_test/EL ren a.md","x"); return 1`);
     await openIn(c, "_test/EL ren a.md", 0); await openIn(c, "_test/EL ren a.md", 1);
     await c.js(`await app.fileManager.renameFile(T.f("_test/EL ren a.md"), "_test/EL ren b.md"); await T.sleep(500); return 1`);
     const r1 = await c.js(`return {t: [${item(0,0)}.titleEl.textContent, ${item(1,0)}.titleEl.textContent], saved: T.tab().getState().lanes.flat().map(d=>d.path)}`);
     await c.js(`await app.fileManager.renameFile(T.f("_test/EL ren b.md"), "_test/sub/EL ren b.md"); await T.sleep(500); return 1`);
     const r2 = await c.js(`return {p: ${item(0,0)}.pathEl.textContent, saved: T.tab().getState().lanes.flat().map(d=>d.path)}`);
     // F2 in the card → title editable & selected
     await c.clickEl(`${item(0,0)}.el.querySelectorAll(".cm-line")[0]`); await c.raw("F2","F2",113); await c.sleep(400);
     const r3 = await c.js(`return {focus: document.activeElement===${item(0,0)}.titleEl, sel: getSelection().toString()}`); await c.key("Escape");
     return { ok: r1.t.every(x=>x==="EL ren b") && r1.saved.every(p=>p==="_test/EL ren b.md") && /_test\/sub\//.test(r2.p) && r2.saved.every(p=>p==="_test/sub/EL ren b.md") && r3.focus && r3.sel==="EL ren b", note: JSON.stringify([r1,r2,r3]) }; } },
 { id: "CD-23", run: async c => { await c.js(`for (const p of ["_test/EL del.md"]) if(!T.f(p)) await app.vault.create(p,"to delete"); return 1`);
     await openIn(c, "_test/EL del.md", 0); await openIn(c, "_test/EL del.md", 2); await c.js(`await T.P().newLanesTab(); await T.P().openInLane(T.f("_test/EL del.md"),"same",T.tab().lanes[1]); app.workspace.setActiveLeaf(app.workspace.getLeavesOfType("editor-lanes")[0],{focus:true}); await T.sleep(400); return 1`);
     await c.clickEl(`${item(0,0)}.el.querySelectorAll(".cm-line")[0]`);
     await c.js(`await app.fileManager.trashFile(T.f("_test/EL del.md")); await T.sleep(800); return 1`);
     const r = await c.js(`return {tabs: T.tabs().map(t=>T.lanes(t)), active: T.active(), saved: T.tabs().map(t=>t.getState().lanes.flat().length)}`);
     return { ok: r.tabs.every(t=>t.flat().length===0), note: JSON.stringify(r) }; } },
 { id: "CD-24", run: async c => { await c.js(`if(!T.f("_test/EL mv.md")) await app.vault.create("_test/EL mv.md","mv"); return 1`); await openIn(c, "_test/EL mv.md", 0);
     await c.js(`await app.fileManager.renameFile(T.f("_test/EL mv.md"), "p/EL mv.md"); await T.sleep(500); return 1`);
     const r = await c.js(`return {p: ${item(0,0)}.pathEl.textContent, file: ${item(0,0)}.leaf.view.file.path}`);
     await c.js(`await app.fileManager.renameFile(T.f("p/EL mv.md"), "_test/EL mv.md"); return 1`);
     return { ok: /^‎p\/‎$/.test(r.p) && r.file==="p/EL mv.md", note: JSON.stringify(r) }; } },
];
