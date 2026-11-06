/*
GENERATED FILE, built by esbuild from src/. Edit the TypeScript sources, not this file.
*/

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => EditorLanesPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// ../node_modules/monkey-around/dist/index.mjs
function around(obj, factories) {
  const removers = Object.keys(factories).map((key) => around1(obj, key, factories[key]));
  return removers.length === 1 ? removers[0] : function() {
    removers.forEach((r) => r());
  };
}
function around1(obj, method, createWrapper) {
  const inherited = obj[method], hadOwn = obj.hasOwnProperty(method), original = hadOwn ? inherited : function() {
    return Object.getPrototypeOf(obj)[method].apply(this, arguments);
  };
  let current = createWrapper(original);
  if (inherited)
    Object.setPrototypeOf(current, inherited);
  Object.setPrototypeOf(wrapper, current);
  obj[method] = wrapper;
  return remove;
  function wrapper(...args) {
    if (current === original && obj[method] === wrapper)
      remove();
    return current.apply(this, args);
  }
  function remove() {
    if (obj[method] === wrapper) {
      if (hadOwn)
        obj[method] = original;
      else
        delete obj[method];
    }
    if (current === original)
      return;
    current = original;
    Object.setPrototypeOf(wrapper, inherited || Function);
  }
}

// src/dom.ts
var asEl = (t) => t && t.nodeType === 1 ? t : null;

// src/lane-view.ts
var import_obsidian = require("obsidian");

// src/dnd.ts
function pickDropEffect(effectAllowed, prefs) {
  const allowed = (effectAllowed || "all").toLowerCase();
  if (allowed === "all" || allowed === "uninitialized") return prefs[0] ?? null;
  if (allowed === "none") return null;
  return prefs.find((p) => allowed.includes(p)) ?? null;
}
function clampIn(list, pinned, index) {
  const n = list.filter((i) => i.pinned).length;
  return pinned ? Math.min(Math.max(index, 0), n) : Math.min(Math.max(index, n), list.length);
}
function linkpathsInText(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const url = /^obsidian:\/\/open\?(.*)$/.exec(t);
    if (url) {
      const file = new URLSearchParams(url[1]).get("file");
      if (file) out.push(file);
      continue;
    }
    const before = out.length;
    for (const m of t.matchAll(/\[\[([^\]|#^]+)/g)) out.push(m[1].trim());
    for (const m of t.matchAll(/\]\(<?([^)>#]+?\.md)(?:#[^)>]*)?>?\)/g)) {
      let target = m[1];
      try {
        target = decodeURIComponent(target);
      } catch {
      }
      out.push(target);
    }
    if (out.length === before && !/[[\]()]/.test(t)) out.push(t);
  }
  return out;
}

// src/names.ts
var STAMP = /^\d{4}-\d{2}-\d{2}-\d{6}/;
function noteNameError(name, basename, folder) {
  const bad = name.match(/[\\/:#^[\]|*"<>?]/);
  if (bad) return `A note name can't contain ${bad[0]}`;
  if (name.startsWith(".")) return "A note name can't start with a dot";
  if (/\.md$/i.test(name)) return "Leave out the .md extension";
  if (folder === "0" && STAMP.test(basename) && !STAMP.test(name)) {
    return "A log's name must keep its YYYY-MM-DD-HHmmss prefix";
  }
  return null;
}
function tidyName(raw) {
  return raw.replace(/\s+/g, " ").trim();
}

// src/types.ts
var VIEW_TYPE = "editor-lane";
var SWALLOW_MS = 700;
var INTENT_MS = 2e3;
var LAZY_MARGIN = 300;

// src/lane-view.ts
var srHintSeq = 0;
var LaneView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.items = [];
    this.observer = null;
    this.lazyQueue = [];
    this.draining = false;
    this.navigation = false;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "Editor lane";
  }
  getIcon() {
    return "columns-3";
  }
  async onOpen() {
    this.addAction("arrow-down", "New editor lane below", () => void this.plugin.newLaneAt(this, "down"));
    this.addAction("arrow-up", "New editor lane above", () => void this.plugin.newLaneAt(this, "up"));
    this.addAction("arrow-right", "New editor lane to the right", () => void this.plugin.newLaneAt(this, "right"));
    this.addAction("arrow-left", "New editor lane to the left", () => void this.plugin.newLaneAt(this, "left"));
    const root = this.contentEl;
    root.empty();
    root.addClass("lane-view");
    root.addEventListener("mousedown", () => this.plugin.notePointerIn(this), { capture: true });
    this.listEl = root.createDiv({ cls: "lane-list" });
    this.emptyEl = root.createDiv({
      cls: "lane-empty",
      text: "Open a note, Shift-click a link, or drag a note or link here."
    });
    this.updateEmpty();
    try {
      const IO = root.win?.IntersectionObserver ?? IntersectionObserver;
      this.observer = new IO(
        (entries) => {
          for (const en of entries) {
            if (!en.isIntersecting) continue;
            const it = this.items.find((i) => i.el === en.target);
            if (it && !it.collapsed && !it.leaf && !this.lazyQueue.includes(it)) this.lazyQueue.push(it);
          }
          void this.drainLazy();
        },
        { root: this.listEl, rootMargin: `${LAZY_MARGIN}px 0px` }
      );
    } catch {
      this.observer = null;
    }
    this.setupDrop(root);
    this.registerEvent(
      this.app.vault.on("delete", (f) => {
        const it = this.items.find((i) => i.file === f);
        if (it) this.close(it);
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (f) => {
        const it = this.items.find((i) => i.file === f);
        if (it) {
          this.updateTitle(it);
          this.save();
        }
      })
    );
  }
  /** The lane's actions live in Obsidian's own "More options" (⋯) menu at the right of the lane header. */
  onPaneMenu(menu, source) {
    const dirs = [
      ["left", "New editor lane to the left", "arrow-left"],
      ["right", "New editor lane to the right", "arrow-right"],
      ["up", "New editor lane above", "arrow-up"],
      ["down", "New editor lane below", "arrow-down"]
    ];
    for (const [d, title, icon] of dirs) {
      menu.addItem(
        (i) => i.setSection("pane").setTitle(title).setIcon(icon).onClick(() => void this.plugin.newLaneAt(this, d))
      );
    }
    menu.addItem(
      (i) => i.setSection("pane").setTitle("Collapse all notes").setIcon("chevrons-down-up").setDisabled(!this.items.length).onClick(() => this.setAllCollapsed(true))
    );
    menu.addItem(
      (i) => i.setSection("pane").setTitle("Expand all notes").setIcon("chevrons-up-down").setDisabled(!this.items.length).onClick(() => this.setAllCollapsed(false))
    );
    menu.addItem(
      (i) => i.setSection("pane").setTitle("Close all notes").setIcon("x-circle").setDisabled(!this.items.length).onClick(() => this.closeAll())
    );
  }
  async onClose() {
    this.teardown();
    this.observer?.disconnect();
    this.observer = null;
    if (this.plugin.lastLane === this) this.plugin.lastLane = null;
  }
  /** Detach every hosted leaf. Safe to call twice. */
  teardown() {
    for (const it of this.items) this.unmount(it);
    this.items = [];
    this.lazyQueue = [];
    this.listEl?.empty();
  }
  // ---------- persistence (workspace.json, via the view state) ----------
  getState() {
    const items = this.items.map((i) => ({ path: i.file.path, collapsed: i.collapsed, pinned: i.pinned }));
    return { items };
  }
  async setState(state, result) {
    const list = Array.isArray(state?.items) ? state.items : [];
    if (!this.items.length && list.length) {
      for (const d of list) {
        const f = this.app.vault.getAbstractFileByPath(String(d?.path ?? ""));
        if (!(f instanceof import_obsidian.TFile) || this.items.some((i) => i.file === f)) continue;
        const it = this.createItem(f, !!d.collapsed, !!d?.pinned);
        this.place(it, this.items.length);
        if (!it.collapsed) this.mountLazily(it);
      }
      this.updateEmpty();
    }
    await super.setState(state, result);
  }
  save() {
    this.app.workspace.requestSaveLayout();
  }
  // ---------- items ----------
  /**
   * Add a note at the top, below any pinned notes (or at `opts.index`), and expand it. A note already in this
   * lane moves there instead; a pinned one keeps its place.
   */
  async add(file, opts = {}) {
    this.plugin.lastLane = this;
    let it = this.items.find((i) => i.file === file);
    const isNew = !it;
    if (!it) it = this.createItem(file, false);
    const cur = this.items.indexOf(it);
    if (opts.index !== void 0) this.placeAt(it, cur >= 0 && cur < opts.index ? opts.index - 1 : opts.index);
    else if (!it.pinned || cur < 0) this.place(it, 0);
    this.updateEmpty();
    if (!it.leaf && opts.mode) it.pending = { ...it.pending, mode: opts.mode };
    await this.setCollapsed(it, false);
    if (opts.index === void 0) this.scrollToItem(it);
    const leaf = it.leaf;
    if (leaf) {
      if (opts.mode && leaf.getViewState().state?.mode !== opts.mode) {
        const vs = leaf.getViewState();
        await leaf.setViewState({ ...vs, state: { ...vs.state, mode: opts.mode } });
      }
      if (isNew && opts.history) {
        try {
          leaf.history?.deserialize?.(opts.history);
        } catch {
        }
      }
      if (opts.focus) this.app.workspace.setActiveLeaf(leaf, { focus: true });
      if (opts.eState) leaf.setEphemeralState(opts.eState);
    }
    this.save();
  }
  createItem(file, collapsed, pinned = false) {
    const el = createDiv({ cls: "lane-item" });
    const header = el.createDiv({ cls: "lane-item-header" });
    const chevEl = header.createEl("button", { cls: "lane-chevron" });
    const hintId = `lane-title-hint-${++srHintSeq}`;
    const nameEl = header.createSpan({ cls: "lane-item-name" });
    const pathEl = nameEl.createSpan({ cls: "lane-item-path" });
    const titleEl = nameEl.createSpan({
      cls: "lane-item-title",
      attr: { contenteditable: "true", spellcheck: "false", role: "textbox", "aria-describedby": hintId }
    });
    header.createSpan({ cls: "lane-sr-only", text: "Note name. Edit to rename the note.", attr: { id: hintId } });
    const pinEl = header.createEl("button", { cls: "lane-pin clickable-icon" });
    (0, import_obsidian.setIcon)(pinEl, "pin");
    const closeEl = header.createEl("button", { cls: "lane-close", text: "\u2715", attr: { "aria-label": "Close" } });
    const bodyEl = el.createDiv({ cls: "lane-item-body" });
    const it = {
      file,
      collapsed,
      pinned,
      el,
      headerEl: header,
      pinEl,
      chevEl,
      titleEl,
      pathEl,
      bodyEl,
      split: null,
      leaf: null,
      ready: null,
      pending: null,
      editStart: null,
      cancelEdit: false
    };
    this.updateTitle(it);
    this.applyCollapsed(it);
    this.applyPinned(it);
    pinEl.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePin(it);
    });
    header.draggable = true;
    header.addEventListener("dragstart", (e) => {
      if (asEl(e.target)?.closest(".lane-item-title:focus, button")) {
        e.preventDefault();
        return;
      }
      this.plugin.dragItem = { lane: this, item: it };
      el.addClass("is-lane-dragging");
      const dm = this.app.dragManager;
      try {
        dm?.onDragStart?.(e, dm.dragFile(e, it.file, "editor-lanes"));
      } catch {
      }
    });
    header.addEventListener("dragend", () => this.plugin.endItemDrag());
    titleEl.addEventListener("focus", () => {
      header.draggable = false;
    });
    titleEl.addEventListener("blur", () => {
      header.draggable = true;
    });
    header.addEventListener("click", (e) => {
      if (e.target.closest(".lane-item-title, .lane-close, .lane-pin")) return;
      void this.setCollapsed(it, !it.collapsed).then(() => this.save());
    });
    bodyEl.addEventListener("pointerdown", () => {
      if (!it.collapsed && !it.leaf) void this.mount(it);
    });
    titleEl.addEventListener("mousedown", (e) => {
      if (!import_obsidian.Keymap.isModEvent(e)) return;
      e.preventDefault();
      if (this.plugin.settings.lanesOnly) void this.plugin.openInLane(it.file, "new", this, { focus: true });
      else void this.app.workspace.getLeaf("tab").openFile(it.file);
    });
    titleEl.addEventListener("focus", () => {
      if (it.editStart === null) it.editStart = titleEl.textContent ?? "";
    });
    titleEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        titleEl.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        it.cancelEdit = true;
        titleEl.setText(it.file.basename);
        titleEl.blur();
      } else if (e.key === "ArrowDown" && it.leaf) {
        e.preventDefault();
        this.app.workspace.setActiveLeaf(it.leaf, { focus: true });
      }
    });
    titleEl.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData?.getData("text/plain") ?? "").replace(/[\r\n]+/g, " ");
      titleEl.doc.execCommand("insertText", false, text);
    });
    titleEl.addEventListener("blur", () => {
      if (!it.cancelEdit && !titleEl.doc.hasFocus()) return;
      void this.renameFromTitle(it);
    });
    closeEl.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close(it);
    });
    header.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const menu = new import_obsidian.Menu();
      menu.addItem(
        (i) => i.setTitle("Open in next lane").setIcon("arrow-right").onClick(() => void this.plugin.openInLane(it.file, "next", this, { focus: true }))
      );
      menu.addItem(
        (i) => i.setTitle("Open in new editor lane").setIcon("columns-3").onClick(() => void this.plugin.openInLane(it.file, "new", this, { focus: true }))
      );
      menu.addItem(
        (i) => i.setTitle("Move to top").setIcon("arrow-up").onClick(() => this.placeAt(it, 0))
      );
      menu.addItem(
        (i) => i.setTitle("Move to previous lane").setIcon("arrow-left").onClick(() => void this.plugin.moveToLane(this, it, -1))
      );
      menu.addItem(
        (i) => i.setTitle("Move to next lane").setIcon("arrow-right").onClick(() => void this.plugin.moveToLane(this, it, 1))
      );
      menu.addSeparator();
      menu.addItem(
        (i) => i.setTitle(it.pinned ? "Unpin" : "Pin").setIcon(it.pinned ? "pin-off" : "pin").onClick(() => this.togglePin(it))
      );
      menu.addItem(
        (i) => i.setTitle("Close").setIcon("x").setDisabled(it.pinned).onClick(() => this.close(it))
      );
      menu.addItem(
        (i) => i.setTitle("Close others").setIcon("x-circle").onClick(() => {
          for (const o of [...this.items]) if (o !== it && !o.pinned) this.close(o);
        })
      );
      this.app.workspace.trigger("file-menu", menu, it.file, "editor-lanes", void 0);
      menu.showAtMouseEvent(e);
    });
    return it;
  }
  /** Focus the card title and select it, for `eState.rename` ("all" / "start" / "end"), e.g. a new note or F2. */
  editTitle(it, how) {
    const el = it.titleEl;
    el.focus();
    const sel = el.win.getSelection();
    if (!sel) return;
    const range = el.doc.createRange();
    range.selectNodeContents(el);
    if (how === "start") range.collapse(true);
    else if (how === "end") range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  /** Rename the note to the edited title, the way Obsidian's inline title does (links update with it). */
  async renameFromTitle(it) {
    const raw = it.titleEl.textContent ?? "";
    const start = it.editStart;
    it.editStart = null;
    if (it.cancelEdit) {
      it.cancelEdit = false;
      this.updateTitle(it);
      return;
    }
    if (start !== null && raw === start) {
      this.updateTitle(it);
      return;
    }
    const name = tidyName(raw);
    if (!name || name === it.file.basename) {
      this.updateTitle(it);
      return;
    }
    const refuse = (msg) => {
      new import_obsidian.Notice(msg);
      this.updateTitle(it);
    };
    const err = noteNameError(name, it.file.basename, it.file.parent?.path ?? "");
    if (err) return refuse(err);
    const dir = it.file.parent && it.file.parent.path !== "/" ? it.file.parent.path + "/" : "";
    const path = `${dir}${name}.${it.file.extension}`;
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing && existing !== it.file) return refuse(`"${name}" already exists in ${dir || "the vault root"}`);
    try {
      await this.app.fileManager.renameFile(it.file, path);
    } catch (e) {
      console.error("[editor-lanes] rename failed", e);
      refuse(`Couldn't rename: ${e?.message ?? e}`);
    }
  }
  updateTitle(it) {
    const folder = it.file.parent && it.file.parent.path !== "/" ? it.file.parent.path + "/\u200E" : "";
    it.pathEl.setText(folder);
    it.pathEl.setAttr("title", it.file.path);
    if (it.titleEl.doc.activeElement === it.titleEl) return;
    it.titleEl.setText(it.file.basename);
    it.titleEl.setAttr("aria-label", it.file.path);
  }
  applyCollapsed(it) {
    it.el.toggleClass("is-collapsed", it.collapsed);
    it.chevEl.setText(it.collapsed ? "\u25B8" : "\u25BE");
    it.chevEl.setAttr("aria-expanded", String(!it.collapsed));
    it.chevEl.setAttr("aria-label", it.collapsed ? "Expand note" : "Collapse note");
  }
  /** Collapsing unmounts the editor (its mode and cursor are kept for the next expand). */
  async setCollapsed(it, collapsed) {
    it.collapsed = collapsed;
    this.applyCollapsed(it);
    if (collapsed) this.unmount(it, true);
    else await this.mount(it);
  }
  setAllCollapsed(collapsed) {
    for (const it of this.items) {
      if (collapsed) void this.setCollapsed(it, true);
      else if (it.collapsed) {
        it.collapsed = false;
        this.applyCollapsed(it);
        this.mountLazily(it);
      }
    }
    this.save();
  }
  close(it) {
    this.unmount(it);
    it.el.remove();
    this.items.remove(it);
    this.updateEmpty();
    this.save();
  }
  /** Close every note that isn't pinned. */
  closeAll() {
    for (const it of [...this.items]) if (!it.pinned) this.close(it);
  }
  // ---------- order, pinning, moving ----------
  /** Put `it` at `index` of the list without it; pinned notes stay above the others. */
  place(it, index) {
    this.items.remove(it);
    const i = clampIn(this.items, it.pinned, index);
    this.items.splice(i, 0, it);
    const next = this.items[i + 1];
    this.listEl.insertBefore(it.el, next ? next.el : null);
  }
  /** Reorder a note of this lane (`index` counted without it). */
  placeAt(it, index) {
    this.place(it, index);
    this.updateEmpty();
    this.save();
  }
  togglePin(it) {
    it.pinned = !it.pinned;
    this.applyPinned(it);
    this.placeAt(it, it.pinned ? this.items.length : 0);
  }
  applyPinned(it) {
    it.el.toggleClass("is-pinned", it.pinned);
    it.pinEl.setAttr("aria-label", it.pinned ? "Unpin" : "Pin");
    it.pinEl.setAttr("aria-pressed", String(it.pinned));
  }
  scrollToItem(it) {
    const top = it.el.getBoundingClientRect().top - this.listEl.getBoundingClientRect().top;
    this.listEl.scrollTop = Math.max(0, this.listEl.scrollTop + top - 12);
  }
  /** Remove a card to move it to another lane: its editor closes, keeping its mode and cursor. */
  take(it) {
    this.unmount(it, true);
    it.el.remove();
    this.items.remove(it);
    this.updateEmpty();
    this.save();
    return { file: it.file, collapsed: it.collapsed, pinned: it.pinned, pending: it.pending };
  }
  /** A card moved here from another lane. If this lane already has the note, that card moves instead. */
  async insertTaken(d, index) {
    this.plugin.lastLane = this;
    let it = this.items.find((i) => i.file === d.file);
    if (it) {
      const cur = this.items.indexOf(it);
      if (d.pinned && !it.pinned) {
        it.pinned = true;
        this.applyPinned(it);
      }
      this.place(it, cur < index ? index - 1 : index);
      if (!d.collapsed && it.collapsed) await this.setCollapsed(it, false);
    } else {
      it = this.createItem(d.file, d.collapsed, d.pinned);
      it.pending = d.pending;
      this.place(it, index);
      if (!it.collapsed) await this.mount(it);
    }
    this.updateEmpty();
    this.save();
    if (!it.collapsed && it.leaf) this.app.workspace.setActiveLeaf(it.leaf, { focus: true });
  }
  updateEmpty() {
    this.emptyEl?.toggleClass("lane-hidden", this.items.length > 0);
  }
  // ---------- hosted editors ----------
  /** Mount an expanded note once it's near the visible part of the lane (one at a time). */
  mountLazily(it) {
    if (it.leaf) return;
    if (this.observer) this.observer.observe(it.el);
    else void this.mount(it);
  }
  async drainLazy() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.lazyQueue.length) {
        const it = this.lazyQueue.shift();
        if (!this.items.includes(it) || it.collapsed || it.leaf) continue;
        if (!this.nearView(it.el)) continue;
        await this.mount(it);
        await new Promise((r) => window.setTimeout(r, 16));
      }
    } finally {
      this.draining = false;
    }
  }
  nearView(el) {
    const r = el.getBoundingClientRect();
    const v = this.listEl.getBoundingClientRect();
    return v.height > 0 && r.top < v.bottom + LAZY_MARGIN && r.bottom > v.top - LAZY_MARGIN;
  }
  /** Create the item's private split + leaf and open the note in it. */
  mount(it) {
    if (!it.ready) it.ready = this.doMount(it);
    return it.ready;
  }
  async doMount(it) {
    this.observer?.unobserve(it.el);
    const ws = this.app.workspace;
    const split = new import_obsidian.WorkspaceSplit(ws, "horizontal");
    let detached = false;
    Object.defineProperty(split, "parent", {
      configurable: true,
      get: () => detached ? null : ws.rightSplit ?? null,
      set: (v) => {
        if (v === null) detached = true;
      }
    });
    split.containerEl.addClass("lane-split");
    let leaf;
    try {
      leaf = new import_obsidian.WorkspaceLeaf(this.app);
      split.insertChild(0, leaf);
    } catch {
      leaf = ws.createLeafInParent(split, 0);
    }
    it.split = split;
    it.leaf = leaf;
    this.plugin.splits.add(split);
    this.plugin.hostedLeaves.set(leaf, { lane: this, item: it });
    const origSetPinned = leaf.setPinned?.bind(leaf);
    origSetPinned?.(true);
    leaf.setPinned = (v) => {
      if (!v && it.leaf === leaf && !it.pinned) this.close(it);
    };
    leaf.togglePinned = () => {
    };
    const origDetach = leaf.detach.bind(leaf);
    leaf.detach = () => {
      if (it.leaf === leaf && !leaf.__laneUnmounting) this.close(it);
      else origDetach();
    };
    leaf.getContainer = () => this.leaf.getContainer();
    const origSetEState = leaf.setEphemeralState.bind(leaf);
    leaf.setEphemeralState = (e) => {
      if (e?.rename) {
        const how = e.rename;
        e = { ...e };
        delete e.rename;
        window.setTimeout(() => this.editTitle(it, how), 0);
      }
      return origSetEState(e);
    };
    it.bodyEl.appendChild(split.containerEl);
    const pending = it.pending;
    it.pending = null;
    try {
      await leaf.openFile(it.file, {
        active: false,
        state: pending?.mode ? { mode: pending.mode } : void 0,
        eState: pending?.eState
      });
    } catch (e) {
      console.error("[editor-lanes] could not open", it.file.path, e);
      it.bodyEl.createDiv({ cls: "lane-empty", text: "Couldn't open this note." });
    }
  }
  /** Detach the item's hosted leaf. `keep`: remember its mode and cursor for the next mount. */
  unmount(it, keep = false) {
    this.observer?.unobserve(it.el);
    if (!it.split) return;
    const split = it.split;
    const leaf = it.leaf;
    if (keep && leaf) {
      try {
        it.pending = { mode: leaf.getViewState().state?.mode, eState: leaf.getEphemeralState() };
      } catch {
        it.pending = null;
      }
    }
    this.plugin.splits.delete(split);
    if (leaf) this.plugin.hostedLeaves.delete(leaf);
    split.parent = null;
    it.split = null;
    it.leaf = null;
    it.ready = null;
    if (leaf) {
      leaf.__laneUnmounting = true;
      this.plugin.detachQuietly(leaf);
    }
    split.containerEl.remove();
  }
  // ---------- drag and drop ----------
  /**
   * A card dragged by its header (capture phase, so it moves even when dropped on a note's editor, which
   * would otherwise insert a link) and notes / links dragged from anywhere else: the explorer, tabs, search,
   * links in Reading view, a selected [[link]] or obsidian:// URL. Those open at the drop point, unless
   * they're dropped on a note's body: there the editor takes them as usual (a link inserted into the note).
   */
  setupDrop(root) {
    const dm = () => this.app.dragManager;
    const inBody = (t) => !!asEl(t)?.closest(".lane-item-body");
    const onCard = (e) => {
      const d = this.plugin.dragItem;
      if (!d) return;
      e.preventDefault();
      setDropEffect(e, ["move", "link", "copy"]);
      this.showDrop(this.dropIndex(e.clientY, d.item), d.item.pinned, d.item);
      dm()?.setAction?.(d.lane === this ? "Move here" : "Move to this lane");
    };
    root.addEventListener("dragenter", onCard, { capture: true });
    root.addEventListener("dragover", onCard, { capture: true });
    root.addEventListener(
      "drop",
      (e) => {
        const d = this.plugin.dragItem;
        if (!d) return;
        e.preventDefault();
        e.stopPropagation();
        const index = this.dropIndex(e.clientY, d.item);
        this.plugin.endItemDrag();
        void this.plugin.moveItem(d.lane, d.item, this, index);
      },
      { capture: true }
    );
    root.addEventListener("dragover", (e) => {
      if (this.plugin.dragItem) return;
      if (e.defaultPrevented || inBody(e.target)) {
        this.clearDrop();
        return;
      }
      if (!this.dropFiles(e, true).length && !e.dataTransfer?.types.includes("text/plain")) return;
      e.preventDefault();
      setDropEffect(e, ["link", "copy", "move"]);
      this.showDrop(this.dropIndex(e.clientY), false);
      dm()?.setAction?.("Open in this lane");
    });
    root.addEventListener("dragleave", (e) => {
      if (!root.contains(e.relatedTarget)) this.clearDrop();
    });
    root.addEventListener("drop", (e) => {
      if (this.plugin.dragItem) return;
      const index = this.dropIndex(e.clientY);
      this.clearDrop();
      if (e.defaultPrevented || inBody(e.target)) return;
      const files = this.dropFiles(e, false);
      if (!files.length) return;
      e.preventDefault();
      e.stopPropagation();
      void (async () => {
        let i = index;
        for (const f of files) {
          await this.add(f, { index: i });
          i = this.items.findIndex((x) => x.file === f) + 1;
        }
      })();
    });
  }
  /** Where a drop at `y` goes: before the first card whose middle is below it (`skip`: the card being moved). */
  dropIndex(y, skip) {
    const list = this.items.filter((i) => i !== skip);
    for (let i = 0; i < list.length; i++) {
      const r = list[i].el.getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return list.length;
  }
  /** Outline the lane and draw a line where the drop will land. */
  showDrop(index, pinned, skip) {
    this.clearDrop();
    this.contentEl.addClass("is-drop-target");
    const list = this.items.filter((i2) => i2 !== skip);
    if (!list.length) return;
    const i = clampIn(list, pinned, index);
    if (i < list.length) list[i].el.addClass("lane-drop-before");
    else list[list.length - 1].el.addClass("lane-drop-after");
  }
  clearDrop() {
    this.contentEl.removeClass("is-drop-target");
    for (const it of this.items) it.el.removeClass("lane-drop-before", "lane-drop-after");
  }
  /** Notes being dragged (Obsidian's drag manager, or an obsidian:// URL / [[link]] as text). */
  dropFiles(e, peek) {
    const out = [];
    const add = (f) => {
      if (f instanceof import_obsidian.TFile && f.extension === "md" && !out.includes(f)) out.push(f);
    };
    const d = this.app.dragManager?.draggable;
    if (d) {
      if (d.type === "file") add(d.file);
      else if (d.type === "files") (d.files ?? []).forEach(add);
      else if (d.type === "link" && d.linktext) {
        add(this.app.metadataCache.getFirstLinkpathDest((0, import_obsidian.getLinkpath)(d.linktext), d.sourcePath ?? ""));
        add(d.file);
      }
    }
    if (out.length || peek) return out;
    for (const p of linkpathsInText(e.dataTransfer?.getData("text/plain") ?? "")) {
      add(this.app.metadataCache.getFirstLinkpathDest(p, ""));
    }
    return out;
  }
};
function setDropEffect(e, prefs) {
  const p = e.dataTransfer ? pickDropEffect(e.dataTransfer.effectAllowed, prefs) : null;
  if (p && e.dataTransfer) e.dataTransfer.dropEffect = p;
}

// src/note-picker.ts
var import_obsidian2 = require("obsidian");
var NotePicker = class extends import_obsidian2.FuzzySuggestModal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.setPlaceholder("Open a note in an editor lane\u2026");
  }
  getItems() {
    return this.app.vault.getMarkdownFiles();
  }
  getItemText(f) {
    return f.path.replace(/\.md$/, "");
  }
  onChooseItem(f) {
    void this.plugin.openInLane(f, "last", null, { focus: true });
  }
};

// src/settings.ts
var import_obsidian3 = require("obsidian");
var DEFAULTS = { lanesOnly: true };
var LanesSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian3.Setting(containerEl).setName("Editor lanes only").setDesc(
      "Every note opened in the main area goes into a lane instead of a tab. A link clicked in a lane opens in the lane to its right. Off: notes open in normal tabs, and lanes are only filled by Shift-click, drag and drop, or the menus."
    ).addToggle(
      (t) => t.setValue(this.plugin.settings.lanesOnly).onChange(async (v) => {
        this.plugin.settings.lanesOnly = v;
        await this.plugin.saveData(this.plugin.settings);
        if (v) void this.plugin.sweepMainArea(true);
      })
    );
  }
};

// src/main.ts
var loose = (o) => o;
var EditorLanesPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULTS };
    /** Every private split / hosted leaf, for the iterateLeaves patch and for not routing our own opens. */
    this.splits = /* @__PURE__ */ new Set();
    this.hostedLeaves = /* @__PURE__ */ new Map();
    this.lastLane = null;
    /** The note card being dragged by its header, if any. */
    this.dragItem = null;
    this.swallow = null;
    this.routing = /* @__PURE__ */ new Set();
    // leaves whose open is being routed right now (the sweep skips them)
    this.intents = /* @__PURE__ */ new WeakMap();
    this.seen = /* @__PURE__ */ new WeakSet();
    // main-area leaves the sweep has already looked at
    this.sweeping = false;
    this.lastInput = null;
    // target of the last mousedown / keydown in any window
    this.windowDocs = /* @__PURE__ */ new WeakSet();
    this.requestSweep = (0, import_obsidian4.debounce)(() => void this.sweepMainArea(false), 250, true);
  }
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.addSettingTab(new LanesSettingTab(this.app, this));
    this.registerView(VIEW_TYPE, (leaf) => new LaneView(leaf, this));
    this.patchIterateLeaves();
    this.patchOpenFile();
    this.patchGetLeaf();
    this.patchCreateLeafBySplit();
    this.patchDuplicateLeaf();
    this.addRibbonIcon("columns-3", "New editor lane", () => void this.newLane(null));
    this.addCommand({ id: "new-lane", name: "New editor lane", callback: () => void this.newLane(null) });
    this.addCommand({
      id: "open-current",
      name: "Open current note in an editor lane",
      checkCallback: (checking) => this.withActiveFile(checking, (f) => this.openInLane(f, "last"))
    });
    this.addCommand({
      id: "open-current-new-lane",
      name: "Open current note in a new editor lane",
      checkCallback: (checking) => this.withActiveFile(checking, (f) => this.openInLane(f, "new"))
    });
    this.addCommand({
      id: "open-note",
      name: "Open note in an editor lane\u2026",
      callback: () => new NotePicker(this).open()
    });
    this.addCommand({
      id: "close-all",
      name: "Close all notes in this editor lane",
      callback: () => this.currentLane()?.closeAll()
    });
    this.addCommand({
      id: "collapse-all",
      name: "Collapse all notes in this editor lane",
      callback: () => this.currentLane()?.setAllCollapsed(true)
    });
    this.addCommand({
      id: "toggle-pin",
      name: "Pin or unpin the current note in its editor lane",
      checkCallback: (checking) => this.withHostedItem(checking, (lane, it) => lane.togglePin(it))
    });
    this.addCommand({
      id: "move-next-lane",
      name: "Move the current note to the next editor lane",
      checkCallback: (checking) => this.withHostedItem(checking, (lane, it) => this.moveToLane(lane, it, 1))
    });
    this.addCommand({
      id: "move-previous-lane",
      name: "Move the current note to the previous editor lane",
      checkCallback: (checking) => this.withHostedItem(checking, (lane, it) => this.moveToLane(lane, it, -1))
    });
    this.addCommand({
      id: "toggle-lanes-only",
      name: "Toggle editor lanes only",
      callback: async () => {
        this.settings.lanesOnly = !this.settings.lanesOnly;
        await this.saveData(this.settings);
        if (this.settings.lanesOnly) void this.sweepMainArea(true);
      }
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof import_obsidian4.TFile) || file.extension !== "md") return;
        menu.addItem(
          (i) => i.setTitle("Open in editor lane").setIcon("columns-3").setSection("open").onClick(() => void this.openInLane(file, "last"))
        );
        menu.addItem(
          (i) => i.setTitle("Open in new editor lane").setIcon("columns-3").setSection("open").onClick(() => void this.openInLane(file, "new"))
        );
      })
    );
    this.registerEvent(
      this.app.workspace.on("files-menu", (menu, files) => {
        const md = files.filter((f) => f instanceof import_obsidian4.TFile && f.extension === "md");
        if (!md.length) return;
        menu.addItem(
          (i) => i.setTitle(`Open ${md.length} in editor lane`).setIcon("columns-3").setSection("open").onClick(async () => {
            for (const f of [...md].reverse()) await this.openInLane(f, "last");
          })
        );
      })
    );
    this.registerWindow(document);
    this.registerEvent(this.app.workspace.on("window-open", (_w, win) => this.registerWindow(win.document)));
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.wrapRightSplitCollapse();
        this.requestSweep();
      })
    );
    this.app.workspace.onLayoutReady(() => {
      this.wrapRightSplitCollapse();
      for (const w of this.app.workspace.floatingSplit?.children ?? []) if (w?.doc) this.registerWindow(w.doc);
      void this.sweepMainArea(true);
    });
  }
  registerWindow(doc) {
    if (this.windowDocs.has(doc)) return;
    this.windowDocs.add(doc);
    this.registerDomEvent(doc, "mousedown", (e) => this.onMouseDown(e), { capture: true });
    this.registerDomEvent(
      doc,
      "keydown",
      (e) => {
        this.lastInput = e.target;
      },
      { capture: true }
    );
    const swallow = (e) => {
      const s = this.swallow;
      if (!s) return;
      const t = asEl(e.target);
      if (Date.now() > s.until) {
        this.swallow = null;
        return;
      }
      if (!t || !(s.el.contains(t) || t.contains(s.el))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.type === "click") this.swallow = null;
    };
    this.registerDomEvent(doc, "mouseup", swallow, { capture: true });
    this.registerDomEvent(doc, "click", swallow, { capture: true });
  }
  /**
   * Every Markdown tab in the main area moves into the lane used last (keeping tab order, first tab on top,
   * and its mode, scroll / cursor and history) and closes; every empty tab becomes an empty lane. Pinned and
   * linked tabs stay, as do other tabs (canvas, PDF, graph, Bases…). With no lanes yet, the first Markdown
   * tab becomes the first lane. `all`: look at every tab, not just those new since the last sweep.
   */
  async sweepMainArea(all) {
    if (!this.settings.lanesOnly || this.sweeping) return;
    this.sweeping = true;
    let retry = false;
    try {
      const ws = this.app.workspace;
      const tabs = [];
      const empties = [];
      ws.iterateLeaves(ws.rootSplit, (leaf) => {
        if (this.hostedLeaves.has(leaf) || leaf.view instanceof LaneView) return;
        if (this.routing.has(leaf) || this.freshIntent(leaf)) {
          retry = true;
          return;
        }
        if (!all && this.seen.has(leaf)) return;
        this.seen.add(leaf);
        const vs = leaf.getViewState();
        if (vs.pinned || leaf.group) return;
        if (vs.type === "markdown") {
          const f = this.app.vault.getAbstractFileByPath(String(vs.state?.file ?? ""));
          if (!(f instanceof import_obsidian4.TFile)) return;
          const opts = { mode: vs.state?.mode };
          try {
            opts.eState = leaf.getEphemeralState();
          } catch {
          }
          try {
            opts.history = leaf.history?.serialize?.();
          } catch {
          }
          tabs.push({ leaf, file: f, opts });
        } else if (vs.type === "empty") {
          empties.push(leaf);
        }
      });
      for (const leaf of empties) await this.setLane(leaf);
      let lane = this.targetLane();
      for (const { leaf, file, opts } of tabs.reverse()) {
        if (!lane) {
          lane = await this.setLane(leaf);
          await lane?.add(file, opts);
          continue;
        }
        await lane.add(file, opts);
        this.detachQuietly(leaf);
      }
    } catch (e) {
      console.error("[editor-lanes] could not move tabs into lanes", e);
    } finally {
      this.sweeping = false;
    }
    if (retry) window.setTimeout(() => this.requestSweep(), INTENT_MS);
  }
  onunload() {
    for (const lane of this.allLaneViews()) lane.teardown();
  }
  withHostedItem(checking, fn) {
    const h = this.hostedLeaves.get(this.app.workspace.activeLeaf);
    if (!h) return false;
    if (!checking) void fn(h.lane, h.item);
    return true;
  }
  withActiveFile(checking, fn) {
    const f = this.app.workspace.getActiveFile();
    if (!f || f.extension !== "md") return false;
    if (!checking) void fn(f);
    return true;
  }
  /** Detach a leaf without leaving an "Undo close tab" entry for it (it was moved, not closed). */
  detachQuietly(leaf) {
    const restore = around(this.app.workspace, { pushUndoHistory: () => () => {
    } });
    try {
      leaf.detach();
    } catch (e) {
      console.error("[editor-lanes] detach failed", e);
    } finally {
      restore();
    }
  }
  // ---------- patches (monkey-around: each is undone on unload, in any order, even if another plugin
  // wrapped the same method afterwards) ----------
  /**
   * workspace.iterateLeaves(root, cb) walks `root.children`; our splits aren't children of anything, so
   * after the normal walk of the right sidebar (the only `parent` they report), also walk every private
   * split. Obsidian's walk recurses through this function at every node, so anything else returns at once.
   */
  patchIterateLeaves() {
    const ws = this.app.workspace;
    const splits = this.splits;
    this.register(
      around(ws, {
        iterateLeaves: (next) => function(a, b) {
          if (next.call(this, a, b)) return true;
          let target = a, cb = b;
          if (typeof a === "function") {
            target = b;
            cb = a;
          }
          if (!target || target !== ws.rightSplit || typeof cb !== "function") return false;
          for (const sp of splits) {
            if (sp.parent === target && next.call(this, sp, cb)) return true;
          }
          return false;
        }
      })
    );
  }
  /** Lanes only: a note about to open in a main-area leaf goes to a lane instead. */
  patchOpenFile() {
    const plugin = this;
    this.register(
      around(import_obsidian4.WorkspaceLeaf.prototype, {
        openFile: (next) => async function(file, openState) {
          if (!plugin.shouldRoute(this, file)) return next.call(this, file, openState);
          try {
            await plugin.route(this, file, openState);
          } catch (e) {
            console.error("[editor-lanes] routing to a lane failed, opening normally", e);
            return next.call(this, file, openState);
          }
        }
      })
    );
  }
  /**
   * Record where an open starts. Obsidian's opens pick a leaf with getLeaf(paneType) (which calls
   * getUnpinnedLeaf for a plain open) and only then call openFile; by then the active leaf is often a fresh
   * temporary tab, so the source lane has to be read here.
   */
  patchGetLeaf() {
    const ws = this.app.workspace;
    const record = (name) => (next) => function(...args) {
      const from = plugin.inputLane(ws.activeLeaf);
      const leaf = next.apply(this, args);
      if (leaf) plugin.intents.set(leaf, { from, paneType: name === "getLeaf" ? args[0] : false, at: Date.now() });
      return leaf;
    };
    const plugin = this;
    this.register(around(loose(ws), { getLeaf: record("getLeaf"), getUnpinnedLeaf: record("getUnpinnedLeaf") }));
  }
  /**
   * "Split right" / "Split down" (commands, tab menu) duplicate the leaf, which for a lane would copy all its
   * notes. For a lane, make a new empty lane in that direction instead.
   */
  patchDuplicateLeaf() {
    const plugin = this;
    this.register(
      around(loose(this.app.workspace), {
        duplicateLeaf: (next) => async function(leaf, mode, dir) {
          if (leaf?.view instanceof LaneView) {
            const d = mode === "horizontal" || dir === "horizontal" ? "down" : "right";
            return (await plugin.newLaneAt(leaf.view, d))?.leaf;
          }
          return next.call(this, leaf, mode, dir);
        }
      })
    );
  }
  /** Splitting a hosted note (Split down, linked views…) splits its lane instead of the private split. */
  patchCreateLeafBySplit() {
    const plugin = this;
    this.register(
      around(this.app.workspace, {
        createLeafBySplit: (next) => function(leaf, ...rest) {
          const host = leaf ? plugin.hostedLeaves.get(leaf) : void 0;
          return next.call(this, host ? host.lane.leaf : leaf, ...rest);
        }
      })
    );
  }
  /**
   * Collapsing the right sidebar makes Obsidian move focus off any active leaf whose root is the sidebar,
   * which hosted leaves report. `setLayout` replaces rightSplit, so this is re-applied on layout changes.
   */
  wrapRightSplitCollapse() {
    const ws = this.app.workspace;
    const rs = ws.rightSplit;
    if (!rs || rs.__laneCollapse || typeof rs.collapse !== "function") return;
    rs.__laneCollapse = true;
    const plugin = this;
    const uninstall = around(rs, {
      collapse: (next) => function(...args) {
        const a = ws.activeLeaf;
        if (!a || !plugin.hostedLeaves.has(a)) return next.apply(this, args);
        a.getRoot = () => ws.rootSplit;
        try {
          return next.apply(this, args);
        } finally {
          delete a.getRoot;
        }
      }
    });
    this.register(() => {
      uninstall();
      delete rs.__laneCollapse;
    });
  }
  freshIntent(leaf) {
    const i = this.intents.get(leaf);
    return i && Date.now() - i.at < INTENT_MS ? i : null;
  }
  /** The lane of `leaf`, if the user's last mouse / key input was inside that lane (a link followed there). */
  inputLane(leaf) {
    const lane = this.laneOfLeaf(leaf);
    const t = this.lastInput;
    return lane && t && lane.containerEl.contains(t) ? lane : null;
  }
  shouldRoute(leaf, file) {
    if (!(file instanceof import_obsidian4.TFile) || file.extension !== "md") return false;
    const host = this.hostedLeaves.get(leaf);
    if (host) return host.item.file !== file;
    if (!this.settings.lanesOnly || leaf.view instanceof LaneView) return false;
    const ws = this.app.workspace;
    const root = leaf.getRoot();
    if (root === ws.rootSplit) return true;
    if (root !== ws.floatingSplit) return false;
    const intent = this.freshIntent(leaf);
    return !!intent?.from && intent.paneType !== "window";
  }
  /** Where a routed open lands: the next lane after the one it came from, else the lane used last. */
  async route(leaf, file, openState) {
    const intent = this.freshIntent(leaf);
    this.intents.delete(leaf);
    this.routing.add(leaf);
    try {
      await this.routeInner(leaf, file, openState, intent);
    } finally {
      this.routing.delete(leaf);
    }
  }
  async routeInner(leaf, file, openState, intent) {
    const ws = this.app.workspace;
    const host = this.hostedLeaves.get(leaf);
    const from = host ? host.lane : intent ? intent.from : this.inputLane(ws.activeLeaf);
    const p = intent?.paneType;
    const wantNew = !host && (p === "tab" || p === true || p === "split");
    const opts = {
      focus: openState?.active ?? leaf === ws.activeLeaf,
      eState: openState?.eState,
      mode: openState?.state?.mode
    };
    if (!this.lanes().length) {
      const lane = leaf.view.getViewType() === "empty" ? await this.setLane(leaf) : await this.newLane(null);
      await lane?.add(file, opts);
      return;
    }
    await this.openInLane(file, wantNew ? "new" : from ? "next" : "last", from, opts);
    if (leaf.view.getViewType() === "empty" && ws.getLeavesOfType("empty").length + this.lanes().length > 1) {
      leaf.detach();
    }
  }
  // ---------- lanes ----------
  allLaneViews() {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE).map((l) => l.view).filter((v) => v instanceof LaneView);
  }
  /**
   * Lanes in the main area, then popout windows, in layout-tree order (left to right). getLeavesOfType walks
   * the tree depth-first; on-screen position would be wrong for lanes in hidden tabs or other windows.
   */
  lanes() {
    const ws = this.app.workspace;
    return this.allLaneViews().filter((v) => {
      const r = v.leaf.getRoot();
      return r === ws.rootSplit || r === ws.floatingSplit;
    });
  }
  laneOfLeaf(leaf) {
    if (!leaf) return null;
    if (leaf.view instanceof LaneView) return leaf.view;
    return this.hostedLeaves.get(leaf)?.lane ?? null;
  }
  /** The lane commands act on: the active one, else the one used last. */
  currentLane() {
    return this.laneOfLeaf(this.app.workspace.activeLeaf) ?? this.targetLane();
  }
  targetLane() {
    const lanes = this.lanes();
    if (this.lastLane && lanes.includes(this.lastLane)) return this.lastLane;
    return lanes[lanes.length - 1] ?? null;
  }
  async setLane(leaf) {
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    return leaf.view instanceof LaneView ? leaf.view : null;
  }
  /** A new lane to the right of `after` (or of the rightmost lane, or of the current tab). */
  /** A new, empty lane beside `lane`: left / right (side by side) or up / down (stacked). */
  async newLaneAt(lane, dir) {
    const ws = this.app.workspace;
    const direction = dir === "left" || dir === "right" ? "vertical" : "horizontal";
    const leaf = ws.createLeafBySplit(lane.leaf, direction, dir === "left" || dir === "up");
    const created = await this.setLane(leaf);
    if (created) this.lastLane = created;
    return created;
  }
  async newLane(after) {
    const ws = this.app.workspace;
    const lanes = this.lanes();
    const anchor = after?.leaf ?? lanes[lanes.length - 1]?.leaf ?? ws.getMostRecentLeaf();
    const root = anchor?.getRoot();
    let leaf;
    if (anchor && (root === ws.rootSplit || root === ws.floatingSplit)) leaf = ws.createLeafBySplit(anchor, "vertical");
    else leaf = ws.getLeaf("split", "vertical");
    const lane = await this.setLane(leaf);
    if (lane) this.lastLane = lane;
    return lane;
  }
  async openInLane(file, where, from = null, opts = {}) {
    let lane = null;
    if (where === "next" && from) {
      const win = from.leaf.getContainer();
      const lanes = this.lanes().filter((l) => l.leaf.getContainer() === win);
      const i = lanes.indexOf(from);
      lane = i >= 0 ? lanes[i + 1] ?? null : null;
      if (!lane) lane = await this.newLane(from);
    } else if (where === "new") {
      lane = await this.newLane(null);
    } else {
      lane = this.targetLane() ?? await this.newLane(null);
    }
    if (!lane) return;
    if (opts.focus !== false) await this.app.workspace.revealLeaf(lane.leaf);
    await lane.add(file, opts);
  }
  notePointerIn(lane) {
    this.lastLane = lane;
  }
  // ---------- moving notes between lanes ----------
  /** Move a card to `to` at `index` (counted without the card). Across lanes its editor reopens there. */
  async moveItem(from, it, to, index) {
    if (!from.items.includes(it)) return;
    if (from === to) {
      from.placeAt(it, index);
      return;
    }
    await to.insertTaken(from.take(it), index);
  }
  /** Move a card to the lane before / after its own (same window); past the last one, a new lane. */
  async moveToLane(from, it, step) {
    const win = from.leaf.getContainer();
    const lanes = this.lanes().filter((l) => l.leaf.getContainer() === win);
    let to = lanes[lanes.indexOf(from) + step] ?? null;
    if (!to) to = await this.newLaneAt(from, step < 0 ? "left" : "right");
    if (to) await this.moveItem(from, it, to, 0);
  }
  endItemDrag() {
    const d = this.dragItem;
    this.dragItem = null;
    d?.item.el.removeClass("is-lane-dragging");
    for (const l of this.allLaneViews()) l.clearDrop();
  }
  // ---------- shift-click ----------
  /** The note a link was clicked in: a Backlinks Full View card, else the leaf's note. */
  sourcePathOf(el) {
    const card = el.closest("[data-bfv-path]");
    if (card) return card.getAttribute("data-bfv-path") ?? "";
    let path = "";
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!path && leaf.view.containerEl.contains(el)) path = leaf.view.file?.path ?? "";
    });
    return path;
  }
  onMouseDown(e) {
    this.lastInput = e.target;
    if (!e.shiftKey || e.button !== 0 || e.ctrlKey || e.metaKey) return;
    const el = asEl(e.target);
    if (!el) return;
    if (el.closest(".nav-files-container")) return;
    let link = null;
    const a = el.closest("a.internal-link, .internal-link[data-href]");
    if (a) {
      link = a.getAttribute("data-href") ?? a.getAttribute("href");
    } else if (el.closest(".cm-editor")) {
      this.app.workspace.iterateAllLeaves((leaf) => {
        if (link !== null || !leaf.view.containerEl.contains(el)) return;
        const view = leaf.view;
        if (view.getState?.()?.source === true) {
          link = "";
          return;
        }
        const editor = view.editor;
        try {
          const pos = editor?.posAtMouse?.(e);
          const tok = pos ? editor.getClickableTokenAt?.(pos) : null;
          if (tok?.type === "internal-link" && tok.text) link = tok.text;
        } catch {
        }
      });
    }
    if (!link) return;
    const dest = this.app.metadataCache.getFirstLinkpathDest((0, import_obsidian4.getLinkpath)(link), this.sourcePathOf(el));
    if (!(dest instanceof import_obsidian4.TFile) || dest.extension !== "md") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.swallow = { until: Date.now() + SWALLOW_MS, el };
    void this.openInLane(dest, e.altKey ? "new" : "last");
  }
};
