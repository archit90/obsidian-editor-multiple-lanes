import { A, B, C, D, openIn, st, eq } from "./common.mjs";
import { settingsWin } from "./lib.mjs";
export const cases = [
 { id: "SE-01", run: async c => { const s = await settingsWin(c);
     const r = await c.js(`const el=app.setting.activeTab.containerEl; return [...el.querySelectorAll(".setting-item")].map(s=>{const n=s.querySelector(".setting-item-name")?.textContent; const ctl=s.querySelector("select, input, textarea, .checkbox-container, button"); let v=null; if(ctl?.tagName==="SELECT") v=ctl.value; else if(ctl?.tagName==="INPUT"||ctl?.tagName==="TEXTAREA") v=ctl.value; else if(ctl?.classList.contains("checkbox-container")) v=ctl.classList.contains("is-enabled"); else if (ctl) v="button"; return n+"="+v + (s.classList.contains("setting-item-heading")?" [H]":"") + (s.offsetParent===null?" [hidden]":"")})`);
     await s.close();
     const want = ["Editor lanes only=true","Link clicked in a lane opens in=next","New notes go=top","Note already open in another lane=copy","Exceptions to lanes only=","Default lane layout=50, 50,50","Accordion mode=false","Maximum notes per lane=0","Auto-collapse after this many expanded=0","Show folder in note headers=true","Header size=comfortable","Note height=grow","Maximum note height=600 [hidden]","Show backlinks panes under lane notes=true","Pre-load distance=300","Dropping a note or link onto a note's text=insert"];
     return { ok: want.every(w=>r.includes(w)), note: JSON.stringify(r) }; } },
 { id: "SE-02", run: async c => { const s = await settingsWin(c); const out = [];
     const inp = `${s.row("Maximum notes per lane")}.querySelector("input")`;
     for (const v of ["-1","501","abc","2.5","7"]) { await s.clickEl(inp); await s.send("Input.dispatchKeyEvent",{type:"rawKeyDown",key:"a",code:"KeyA",windowsVirtualKeyCode:65,modifiers:2}); await s.send("Input.dispatchKeyEvent",{type:"keyUp",key:"a",code:"KeyA",windowsVirtualKeyCode:65,modifiers:2}); await s.send("Input.insertText",{text:v}); await s.sleep(250);
       out.push(await c.js(`const i=${inp}; return ${JSON.stringify(v)}+":"+i.classList.contains("lane-setting-invalid")+":"+T.P().settings.maxNotesPerLane`)); }
     const disk = await c.js(`return (await T.P().loadData()).maxNotesPerLane`);
     await s.close(); await c.js(`T.P().settings.maxNotesPerLane=0; await T.P().saveSettings(); return 1`);
     return { ok: eq(out, ["-1:true:0","501:true:0","abc:true:0","2.5:true:0","7:false:7"]) && disk===7, note: JSON.stringify({out, disk}) }; } },
 { id: "SE-03", run: async c => { await c.js(`T.P().settings.lanesOnly=false; await T.P().settingsChanged("routing"); const l=app.workspace.getLeaf("tab"); await l.openFile(T.f("README.md")); await T.sleep(300); T.P().settings.lanesOnly=true; T.P().settings.routeExceptions="README"; await T.P().settingsChanged("routing"); await T.sleep(500); return 1`);
     const s = await settingsWin(c); const ta = `${s.row("Exceptions to lanes only")}.querySelector("textarea")`;
     await s.clickEl(ta); await s.send("Input.dispatchKeyEvent",{type:"rawKeyDown",key:"a",code:"KeyA",windowsVirtualKeyCode:65,modifiers:2}); await s.send("Input.insertText",{text:"READ"}); await s.sleep(800);
     const mid = await c.js(`return T.roots()`);
     await s.send("Input.insertText",{text:"X"}); await s.sleep(200);
     // blur: click the heading
     await s.clickEl(`${s.row("Opening notes")}`); await s.sleep(1200);
     const after = await c.js(`return {roots: T.roots(), saved: T.P().settings.routeExceptions}`);
     await s.close();
     return { ok: mid.includes("markdown:README.md") && !after.roots.includes("markdown:README.md") && after.saved==="READX", note: JSON.stringify({mid, after}) }; } },
 { id: "SE-04", run: async c => { await c.js(`T.P().settings.preloadDistance=3000; await T.P().settingsChanged("looks"); const l=T.tab().lanes[0]; const fs=app.vault.getMarkdownFiles().filter(f=>f.path.startsWith("z/")).slice(0,25); for (const f of fs) await l.add(f,{focus:false}); l.setAllCollapsed(true); l.listEl.scrollTop=0; l.setAllCollapsed(false); await T.sleep(4000); return 1`);
     const big = await c.js(`return T.tab().lanes[0].items.filter(i=>i.leaf).length`);
     await c.js(`T.P().settings.preloadDistance=0; await T.P().settingsChanged("looks"); const l=T.tab().lanes[0]; l.setAllCollapsed(true); await T.sleep(300); l.listEl.scrollTop=0; l.setAllCollapsed(false); await T.sleep(3000); return 1`);
     const small = await c.js(`return T.tab().lanes[0].items.filter(i=>i.leaf).length`);
     return { ok: big > small, note: JSON.stringify({big, small}) }; } },
 { id: "SE-06", run: async c => { const r = await c.js(`const P=T.P(); const keep=await P.loadData(); await P.saveData({...keep, lanesOnly:"yes", maxNotesPerLane: 9999, linkTarget: "nowhere", preloadDistance: "200", bogus: 1, layout: "70, 30"}); await app.plugins.disablePlugin("obsidian-editor-lanes"); await app.plugins.enablePlugin("obsidian-editor-lanes"); await T.sleep(1500); const s=T.P().settings; const out={lanesOnly:s.lanesOnly, max:s.maxNotesPerLane, lt:s.linkTarget, pre:s.preloadDistance, bogus: "bogus" in s, def: s.defaultLayout}; await T.P().saveData(keep); T.P().settings=Object.assign(T.P().settings, keep); return out`);
     return { ok: r.lanesOnly===true && r.max===0 && r.lt==="next" && r.pre===200 && !r.bogus && r.def==="50, 50,50", note: JSON.stringify(r) }; } },
];
