import { connect } from "../../editor-outliner/e2e/cdp.mjs";
import { execSync } from "node:child_process";
export const H = "../../../.sandbox";
export async function open() {
  const c = await connect(9313);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const mouse = async (type, x, y, o = {}) =>
    c.send("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: o.button ?? "left",
      clickCount: o.count ?? 1,
      modifiers: o.mods ?? 0,
      buttons: o.buttons ?? (type === "mouseMoved" ? 0 : 1),
    });
  const click = async (x, y, o = {}) => {
    await mouse("mouseMoved", x, y, { ...o, buttons: 0 });
    await mouse("mousePressed", x, y, o);
    await mouse("mouseReleased", x, y, { ...o, buttons: 0 });
    await sleep(o.wait ?? 150);
  };
  // center of the first element matching a selector-ish JS expression returning an Element
  const at = async expr => {
    const sc = await c.ev(
      `(()=>{const e=(${expr}); if(!e) return false; const r0=e.getBoundingClientRect(); const L=e.closest(".lane-list")?.getBoundingClientRect() || {top:0,bottom:innerHeight}; if (r0.top < L.top + 50 || r0.bottom > L.bottom) { e.scrollIntoView({block:"center", behavior:"instant"}); return true } return false})()`,
    );
    if (sc) await sleep(250);
    return c.ev(
      `(()=>{const e=(${expr}); if(!e) return null; const r=(e.getClientRects&&e.getClientRects()[0])||e.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2), l:r.left,t:r.top,w:r.width,h:r.height}})()`,
    );
  };
  const clickEl = async (expr, o = {}) => {
    const p = await at(expr);
    if (!p) throw new Error("no element: " + expr);
    await click(o.dx != null ? Math.round(p.l + o.dx) : p.x, o.dy != null ? Math.round(p.t + o.dy) : p.y, o);
    return p;
  };
  const shot = name =>
    execSync(`mkdir -p ${H}/shots-el && bash ../../../tools/obs-sandbox.sh shot 3 ${H}/shots-el/${name}.png`);
  const wheel = async (x, y, dy) =>
    c.send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: dy });
  const unstick = async () => {
    await c.send("Input.setInterceptDrags", { enabled: false });
    await c.send("Input.dispatchDragEvent", {
      type: "dragCancel",
      x: 5,
      y: 5,
      data: { items: [], dragOperationsMask: 1 },
    });
    await mouse("mouseReleased", 5, 5, { buttons: 0 });
  };
  const raw = async (key, code, vk, mods = 0) => {
    await c.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key,
      code,
      windowsVirtualKeyCode: vk,
      modifiers: mods,
    });
    await c.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, modifiers: mods });
  };
  return { ...c, sleep, mouse, click, at, clickEl, shot, wheel, unstick, raw };
}
// HTML5 drag and drop with real mouse input: CDP intercepts the drag and replays it as drag events
export async function drag(c, from, to, o = {}) {
  if (!from || !to) throw new Error("drag: no source or target");
  await c.send("Input.setInterceptDrags", { enabled: true });
  let data = null;
  c.on("Input.dragIntercepted", p => {
    data = p.data;
  });
  await c.mouse("mouseMoved", from.x, from.y, { buttons: 0 });
  await c.mouse("mousePressed", from.x, from.y, { buttons: 1 });
  for (let i = 1; i <= 6; i++) {
    await c.mouse("mouseMoved", from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12, {
      buttons: 1,
    });
    await c.sleep(30);
    if (data) break;
  }
  if (!data) {
    await c.unstick();
    return false;
  }
  const mods = o.mods ?? 0;
  await c.send("Input.dispatchDragEvent", { type: "dragEnter", x: to.x, y: to.y, data, modifiers: mods });
  for (let i = 0; i < 3; i++) {
    await c.send("Input.dispatchDragEvent", { type: "dragOver", x: to.x, y: to.y + i, data, modifiers: mods });
    await c.sleep(50);
  }
  if (o.beforeDrop) await o.beforeDrop();
  await c.send("Input.dispatchDragEvent", {
    type: o.cancel ? "dragCancel" : "drop",
    x: to.x,
    y: to.y + 2,
    data,
    modifiers: mods,
  });
  await c.mouse("mouseReleased", to.x, to.y, { buttons: 0 });
  await c.send("Input.setInterceptDrags", { enabled: false });
  await c.sleep(o.wait ?? 800);
  return true;
}
// The settings window (Obsidian 1.15 opens Settings in its own window): a second connection for real input there
export async function settingsWin(c) {
  await c.ev(
    `(async()=>{app.setting.open(); await new Promise(r=>setTimeout(r,300)); app.setting.openTabById("obsidian-editor-lanes"); await new Promise(r=>setTimeout(r,600)); return 1})()`,
  );
  const { connect } = await import("../../editor-outliner/e2e/cdp.mjs");
  const s = await connect(9313, t => t.url === "about:blank" && /Settings/.test(t.title));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const mouse = async (type, x, y, o = {}) =>
    s.send("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: "left",
      clickCount: 1,
      buttons: type === "mousePressed" ? 1 : 0,
    });
  const click = async (x, y) => {
    await mouse("mouseMoved", x, y);
    await mouse("mousePressed", x, y);
    await mouse("mouseReleased", x, y);
    await sleep(150);
  };
  // expr is evaluated in the main window; `D` is the settings tab's document
  const at = expr =>
    c.ev(
      `(()=>{const D=app.setting.activeTab.containerEl.ownerDocument; const e=(${expr}); if(!e) return null; e.scrollIntoView({block:"center"}); const r=e.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)}})()`,
    );
  const clickEl = async expr => {
    const p = await at(expr);
    if (!p) throw new Error("no element " + expr);
    await click(p.x, p.y);
  };
  const row = name =>
    `[...app.setting.activeTab.containerEl.querySelectorAll(".setting-item")].find(s=>s.querySelector(".setting-item-name")?.textContent===${JSON.stringify(name)})`;
  return {
    ...s,
    sleep,
    click,
    at,
    clickEl,
    row,
    close: async () => {
      s.close();
      await c.ev(`app.setting.close(), 1`);
    },
  };
}
