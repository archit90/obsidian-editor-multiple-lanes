// Shared bits of the e2e cases: the fixture notes (fixtures.mjs) and input helpers.
import { NOTES } from "./fixtures.mjs";
export { DIR, FILES, LONG, MANY, NOTES, PEOPLE, SEARCH_WORD, TEMPLATES } from "./fixtures.mjs";

/** The four notes most cases open: their paths, and their titles (what T.lanes() shows). */
export const A = NOTES.A.path,
  B = NOTES.B.path,
  C = NOTES.C.path,
  D = NOTES.D.path;
export const tA = NOTES.A.title,
  tB = NOTES.B.title,
  tC = NOTES.C.title,
  tD = NOTES.D.title;
export const MOD = { alt: 1, ctrl: 2, meta: 4, shift: 8 };
export async function openIn(c, path, lane = 0, extra = "") {
  return c.js(
    `await T.P().openInLane(T.f(${JSON.stringify(path)}), "same", T.tab().lanes[${lane}], {focus:true}); ${extra}; await T.sleep(400); return 1`,
  );
}
export async function explorerClick(c, path, mods = 0, button = "left") {
  await c.js(
    `const v=app.workspace.getLeavesOfType("file-explorer")[0].view; v.revealInFolder(T.f(${JSON.stringify(path)})); await T.sleep(500); return 1`,
  );
  await c.clickEl(`document.querySelector('.nav-file-title[data-path="${path}"]')`, { mods, button, wait: 900 });
}
// a link inside a card: the first rendered link (Live Preview or Reading view) whose text contains `text`
export async function clickLinkIn(c, cardFile, text, mods = 0, button = "left") {
  return c.clickEl(
    `(()=>{const it=T.tab().lanes.flatMap(l=>l.items).find(i=>i.file.path===${JSON.stringify(cardFile)}); const e=[...it.el.querySelectorAll(".cm-content .cm-underline, .markdown-preview-view a.internal-link")].find(e=>e.textContent.includes(${JSON.stringify(text)})); const r=e.getBoundingClientRect(); const L=e.closest(".lane-list").getBoundingClientRect(); if(r.top<L.top+60||r.bottom>L.bottom-10) e.scrollIntoView({block:"center"}); return e})()`,
    { mods, button, wait: 1000 },
  );
}
export async function quick(c, text) {
  await c.key("o", { ctrl: true });
  await c.sleep(400);
  await c.type(text);
  await c.sleep(800);
  await c.key("Enter");
  await c.sleep(1200);
}
export const st = c => c.js("return T.st()");
export const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function headerClick(c, itemExpr, o = {}) {
  const p = await c.at(
    `(()=>{const h=(${itemExpr}).el.querySelector(".lane-item-header"); const r=h.getBoundingClientRect(), L=h.closest(".lane-list").getBoundingClientRect(); if(r.top<L.top||r.bottom>L.bottom) h.scrollIntoView({block:"center"}); return h})()`,
  );
  await c.click(Math.round(p.l + p.w - 110), p.y, o);
  await c.sleep(400);
}

// click at the start of a card's n-th editor line (not on a link)
export async function clickLine(c, itemExpr, n = 1) {
  const p = await c.at(`(${itemExpr}).el.querySelectorAll(".cm-line")[${n}]`);
  await c.click(Math.round(p.l + 2), Math.round(p.t + 6));
  await c.sleep(200);
}
