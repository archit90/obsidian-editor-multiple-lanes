// Far-away cards on an (emulated) phone: one lane at a time, phone-sized window. The hooks put the desktop and the
// window size back even when the case fails.
import { MANY } from "./common.mjs";
import { WINDOW } from "./config.mjs";
import { emulateMobile, resize } from "./lib.mjs";
export async function before(c) {
  await emulateMobile(c, true);
  await resize(c, 421, 862);
}
export async function after(c) {
  await emulateMobile(c, false);
  await resize(c, WINDOW.width, WINDOW.height);
}
export const cases = [
  {
    id: "PK-06",
    run: async c => {
      const r =
        await c.js(`if(!document.body.classList.contains("is-phone")) return {skip:true}; const l=T.tab().lanes[0]; const fs=app.vault.getMarkdownFiles().filter(f=>f.path.startsWith(${JSON.stringify(MANY.folder + "/")})).slice(0,100); for (const f of fs) await l.add(f,{focus:false, index: l.items.length}); l.setAllCollapsed(true); await T.sleep(300); l.listEl.scrollTop=0; l.setAllCollapsed(false); await T.sleep(1500);
       const peak=[]; for (let i=0;i<150;i++){ l.listEl.scrollTop += 400; await T.sleep(30); if(i%30===29) peak.push(l.items.filter(x=>x.leaf).length); } await T.sleep(7000); const settled=l.items.filter(x=>x.leaf).length;
       const up=[]; for (let i=0;i<60;i++){ l.listEl.scrollTop -= 300; await T.sleep(40); if (i%15===14) { const L=l.listEl.getBoundingClientRect(); { const e=l.items.filter(x=>{const r=x.el.getBoundingClientRect(); return !x.collapsed && !x.leaf && r.bottom>L.top && r.top<L.bottom}); up.push(e.length+"(parked "+e.filter(x=>x.parked).length+")"); } } }
       return {peak, settled, up, phone: document.body.classList.contains("is-phone")}`);
      return { ok: !r.skip && r.settled <= 15 && r.up.every(n => /\(parked 0\)/.test(n)), note: JSON.stringify(r) };
    },
  },
];
