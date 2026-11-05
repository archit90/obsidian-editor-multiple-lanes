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

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => EditorLanesPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var VIEW_TYPE = "editor-lane";
var SWALLOW_MS = 700;
var POINTER_LANE_MS = 3e3;
var DEFAULTS = { lanesOnly: true };
var EditorLanesPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULTS };
    /** Every private split / hosted leaf, for the iterateLeaves patch and for not routing our own opens. */
    this.splits = /* @__PURE__ */ new Set();
    this.hostedLeaves = /* @__PURE__ */ new Set();
    this.lastLane = null;
    this.pointerLane = null;
    this.swallowUntil = 0;
    this.routing = /* @__PURE__ */ new Set();
    // leaves whose open is being routed right now (the sweep skips them)
    this.sweeping = false;
    this.modClickAt = 0;
  }
  // last Ctrl/Cmd(-Alt…) mousedown: a routed open right after it gets a new lane
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.addSettingTab(new LanesSettingTab(this.app, this));
    this.registerView(VIEW_TYPE, (leaf) => new LaneView(leaf, this));
    this.patchIterateLeaves();
    this.patchOpenFile();
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
    this.addCommand({ id: "open-note", name: "Open note in an editor lane\u2026", callback: () => new NotePicker(this).open() });
    this.addCommand({
      id: "close-all",
      name: "Close all notes in this editor lane",
      callback: () => {
        var _a;
        return (_a = this.currentLane()) == null ? void 0 : _a.closeAll();
      }
    });
    this.addCommand({
      id: "collapse-all",
      name: "Collapse all notes in this editor lane",
      callback: () => {
        var _a;
        return (_a = this.currentLane()) == null ? void 0 : _a.setAllCollapsed(true);
      }
    });
    this.addCommand({
      id: "toggle-lanes-only",
      name: "Toggle editor lanes only",
      callback: async () => {
        this.settings.lanesOnly = !this.settings.lanesOnly;
        await this.saveData(this.settings);
        if (this.settings.lanesOnly) void this.sweepMainArea();
      }
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof import_obsidian.TFile) || file.extension !== "md") return;
      menu.addItem((i) => i.setTitle("Open in editor lane").setIcon("columns-3").setSection("open").onClick(() => void this.openInLane(file, "last")));
      menu.addItem((i) => i.setTitle("Open in new editor lane").setIcon("columns-3").setSection("open").onClick(() => void this.openInLane(file, "new")));
    }));
    this.registerEvent(this.app.workspace.on("files-menu", (menu, files) => {
      const md = files.filter((f) => f instanceof import_obsidian.TFile && f.extension === "md");
      if (!md.length) return;
      menu.addItem((i) => i.setTitle(`Open ${md.length} in editor lane`).setIcon("columns-3").setSection("open").onClick(async () => {
        for (const f of [...md].reverse()) await this.openInLane(f, "last");
      }));
    }));
    this.registerDomEvent(document, "mousedown", (e) => this.onMouseDown(e), { capture: true });
    const swallow = (e) => {
      if (Date.now() < this.swallowUntil) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    this.registerDomEvent(document, "mouseup", swallow, { capture: true });
    this.registerDomEvent(document, "click", swallow, { capture: true });
    const sweep = (0, import_obsidian.debounce)(() => void this.sweepMainArea(), 250, true);
    this.registerEvent(this.app.workspace.on("layout-change", sweep));
    this.app.workspace.onLayoutReady(() => void this.sweepMainArea());
  }
  /**
   * Every Markdown tab in the main area moves into the lane used last (keeping tab order, first tab on top)
   * and closes; every empty tab becomes an empty lane. Other tabs (canvas, PDF, graph, Bases…) stay.
   * With no lanes yet, the first Markdown tab becomes the first lane.
   */
  async sweepMainArea() {
    if (!this.settings.lanesOnly || this.sweeping) return;
    this.sweeping = true;
    try {
      const ws = this.app.workspace;
      const tabs = [];
      const empties = [];
      ws.iterateLeaves(ws.rootSplit, (leaf) => {
        var _a, _b;
        if (this.hostedLeaves.has(leaf) || this.routing.has(leaf)) return;
        const vs = leaf.getViewState();
        if (vs.type === "markdown") {
          const f = this.app.vault.getAbstractFileByPath(String((_b = (_a = vs.state) == null ? void 0 : _a.file) != null ? _b : ""));
          if (f instanceof import_obsidian.TFile) tabs.push({ leaf, file: f });
        } else if (vs.type === "empty") {
          empties.push(leaf);
        }
      });
      for (const leaf of empties) await this.setLane(leaf);
      for (const { leaf, file } of tabs.reverse()) {
        const lane = this.targetLane();
        if (!lane) {
          const first = await this.setLane(leaf);
          await (first == null ? void 0 : first.add(file));
          continue;
        }
        await lane.add(file);
        leaf.detach();
      }
    } catch (e) {
      console.error("[editor-lanes] could not move tabs into lanes", e);
    } finally {
      this.sweeping = false;
    }
  }
  onunload() {
    for (const lane of this.allLaneViews()) lane.teardown();
  }
  withActiveFile(checking, fn) {
    const f = this.app.workspace.getActiveFile();
    if (!f || f.extension !== "md") return false;
    if (!checking) void fn(f);
    return true;
  }
  // ---------- patches ----------
  /**
   * workspace.iterateLeaves(root, cb) walks `root.children`; our splits aren't children of anything, so
   * after the normal walk, also walk every private split whose parent is that root. Arrays are left to the
   * original, which calls (the patched) iterateLeaves once per element.
   */
  patchIterateLeaves() {
    const ws = this.app.workspace;
    const orig = ws.iterateLeaves;
    if (typeof orig !== "function") return;
    const splits = this.splits;
    const patched = function(a, b) {
      if (orig.call(this, a, b)) return true;
      let target = a, cb = b;
      if (typeof a === "function") {
        target = b;
        cb = a;
      }
      if (!target || Array.isArray(target) || typeof cb !== "function") return false;
      for (const sp of splits) {
        if (sp.parent === target && orig.call(this, sp, cb)) return true;
      }
      return false;
    };
    ws.iterateLeaves = patched;
    this.register(() => {
      if (ws.iterateLeaves === patched) ws.iterateLeaves = orig;
    });
  }
  /** Lanes only: a note about to open in a main-area leaf goes to a lane instead. */
  patchOpenFile() {
    const proto = import_obsidian.WorkspaceLeaf.prototype;
    const orig = proto.openFile;
    if (typeof orig !== "function") return;
    const plugin = this;
    const patched = async function(file, state) {
      if (!plugin.shouldRoute(this, file)) return orig.call(this, file, state);
      try {
        await plugin.route(this, file, state);
      } catch (e) {
        console.error("[editor-lanes] routing to a lane failed, opening normally", e);
        return orig.call(this, file, state);
      }
    };
    proto.openFile = patched;
    this.register(() => {
      if (proto.openFile === patched) proto.openFile = orig;
    });
  }
  shouldRoute(leaf, file) {
    if (!this.settings.lanesOnly) return false;
    if (!(file instanceof import_obsidian.TFile) || file.extension !== "md") return false;
    if (this.hostedLeaves.has(leaf) || leaf.view instanceof LaneView) return false;
    const ws = this.app.workspace;
    const root = leaf.getRoot();
    return root === ws.rootSplit || root === ws.floatingSplit;
  }
  /** Where a routed open lands: the next lane after the one it came from, else the lane used last. */
  async route(leaf, file, state) {
    this.routing.add(leaf);
    try {
      await this.routeInner(leaf, file, state);
    } finally {
      this.routing.delete(leaf);
    }
  }
  async routeInner(leaf, file, state) {
    const ws = this.app.workspace;
    const from = this.sourceLane();
    const wantNew = Date.now() - this.modClickAt < POINTER_LANE_MS;
    this.modClickAt = 0;
    if (!this.lanes().length) {
      const lane = leaf.view.getViewType() === "empty" ? await this.setLane(leaf) : await this.newLane(null);
      await (lane == null ? void 0 : lane.add(file, { focus: true, eState: state == null ? void 0 : state.eState }));
      return;
    }
    await this.openInLane(file, wantNew ? "new" : from ? "next" : "last", from, { focus: true, eState: state == null ? void 0 : state.eState });
    if (leaf.view.getViewType() === "empty" && ws.getLeavesOfType("empty").length + this.lanes().length > 1) {
      leaf.detach();
    }
  }
  // ---------- lanes ----------
  allLaneViews() {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE).map((l) => l.view).filter((v) => v instanceof LaneView);
  }
  /** Lanes in the main area (and popout windows), left to right. */
  lanes() {
    const ws = this.app.workspace;
    return this.allLaneViews().filter((v) => {
      const r = v.leaf.getRoot();
      return r === ws.rootSplit || r === ws.floatingSplit;
    }).sort((a, b) => a.containerEl.getBoundingClientRect().left - b.containerEl.getBoundingClientRect().left);
  }
  laneOfLeaf(leaf) {
    var _a;
    if (!leaf) return null;
    if (leaf.view instanceof LaneView) return leaf.view;
    return (_a = this.allLaneViews().find((v) => v.items.some((i) => i.leaf === leaf))) != null ? _a : null;
  }
  /** The lane the current open came from: a recent click inside a lane, else the active (hosted) leaf. */
  sourceLane() {
    const p = this.pointerLane;
    if (p && Date.now() - p.at < POINTER_LANE_MS && this.allLaneViews().includes(p.lane)) return p.lane;
    return this.laneOfLeaf(this.app.workspace.activeLeaf);
  }
  /** The lane commands act on: the active one, else the one used last. */
  currentLane() {
    var _a;
    return (_a = this.laneOfLeaf(this.app.workspace.activeLeaf)) != null ? _a : this.targetLane();
  }
  targetLane() {
    var _a;
    const lanes = this.lanes();
    if (this.lastLane && lanes.includes(this.lastLane)) return this.lastLane;
    return (_a = lanes[lanes.length - 1]) != null ? _a : null;
  }
  async setLane(leaf) {
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    return leaf.view instanceof LaneView ? leaf.view : null;
  }
  /** A new lane to the right of `after` (or of the rightmost lane, or of the current tab). */
  async newLane(after) {
    var _a, _b, _c;
    const ws = this.app.workspace;
    const lanes = this.lanes();
    const anchor = (_c = (_b = after == null ? void 0 : after.leaf) != null ? _b : (_a = lanes[lanes.length - 1]) == null ? void 0 : _a.leaf) != null ? _c : ws.getMostRecentLeaf();
    let leaf;
    if (anchor && anchor.getRoot() === ws.rootSplit) leaf = ws.createLeafBySplit(anchor, "vertical");
    else leaf = ws.getLeaf("split", "vertical");
    const lane = await this.setLane(leaf);
    if (lane) this.lastLane = lane;
    return lane;
  }
  async openInLane(file, where, from = null, opts = {}) {
    var _a, _b;
    let lane = null;
    if (where === "next" && from) {
      const lanes = this.lanes();
      const i = lanes.indexOf(from);
      lane = i >= 0 ? (_a = lanes[i + 1]) != null ? _a : null : null;
      if (!lane) lane = await this.newLane(from);
    } else if (where === "new") {
      lane = await this.newLane(null);
    } else {
      lane = (_b = this.targetLane()) != null ? _b : await this.newLane(null);
    }
    if (!lane) return;
    await this.app.workspace.revealLeaf(lane.leaf);
    await lane.add(file, opts);
  }
  notePointerIn(lane) {
    this.pointerLane = { lane, at: Date.now() };
    this.lastLane = lane;
  }
  // ---------- shift-click ----------
  /** The note a link was clicked in: a Backlinks Full View card, else the leaf's note. */
  sourcePathOf(el) {
    var _a;
    const card = el.closest("[data-bfv-path]");
    if (card) return (_a = card.getAttribute("data-bfv-path")) != null ? _a : "";
    let path = "";
    this.app.workspace.iterateAllLeaves((leaf) => {
      var _a2, _b;
      if (!path && leaf.view.containerEl.contains(el)) path = (_b = (_a2 = leaf.view.file) == null ? void 0 : _a2.path) != null ? _b : "";
    });
    return path;
  }
  onMouseDown(e) {
    var _a;
    if (e.button === 0 && import_obsidian.Keymap.isModEvent(e)) this.modClickAt = Date.now();
    if (!e.shiftKey || e.button !== 0 || e.ctrlKey || e.metaKey) return;
    const el = e.target;
    if (!el || !(el instanceof HTMLElement)) return;
    if (el.closest(".nav-files-container")) return;
    let link = null;
    const a = el.closest("a.internal-link, .internal-link[data-href]");
    if (a) {
      link = (_a = a.getAttribute("data-href")) != null ? _a : a.getAttribute("href");
    } else if (el.closest(".cm-editor")) {
      this.app.workspace.iterateAllLeaves((leaf) => {
        var _a2, _b;
        if (link !== null || !leaf.view.containerEl.contains(el)) return;
        const editor = leaf.view.editor;
        try {
          const pos = (_a2 = editor == null ? void 0 : editor.posAtMouse) == null ? void 0 : _a2.call(editor, e);
          const tok = pos ? (_b = editor.getClickableTokenAt) == null ? void 0 : _b.call(editor, pos) : null;
          if ((tok == null ? void 0 : tok.type) === "internal-link" && tok.text) link = tok.text;
        } catch (e2) {
        }
      });
    }
    if (!link) return;
    const dest = this.app.metadataCache.getFirstLinkpathDest((0, import_obsidian.getLinkpath)(link), this.sourcePathOf(el));
    if (!(dest instanceof import_obsidian.TFile) || dest.extension !== "md") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.swallowUntil = Date.now() + SWALLOW_MS;
    void this.openInLane(dest, e.altKey ? "new" : "last");
  }
};
var LaneView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.items = [];
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
    const root = this.contentEl;
    root.empty();
    root.addClass("lane-view");
    root.addEventListener("mousedown", () => this.plugin.notePointerIn(this), { capture: true });
    this.listEl = root.createDiv({ cls: "lane-list" });
    this.emptyEl = root.createDiv({
      cls: "lane-empty",
      text: "Open a note, Shift-click a link, or drag a note here."
    });
    this.updateEmpty();
    root.addEventListener("dragover", (e) => {
      var _a;
      if (!this.dropFiles(e, true).length && !((_a = e.dataTransfer) == null ? void 0 : _a.types.includes("text/plain"))) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "link";
      root.addClass("is-drop-target");
    });
    root.addEventListener("dragleave", (e) => {
      if (!root.contains(e.relatedTarget)) root.removeClass("is-drop-target");
    });
    root.addEventListener("drop", (e) => {
      root.removeClass("is-drop-target");
      const files = this.dropFiles(e, false);
      if (!files.length) return;
      e.preventDefault();
      e.stopPropagation();
      void (async () => {
        for (const f of [...files].reverse()) await this.add(f);
      })();
    });
    this.registerEvent(this.app.vault.on("delete", (f) => {
      const it = this.items.find((i) => i.file === f);
      if (it) this.close(it);
    }));
    this.registerEvent(this.app.vault.on("rename", (f) => {
      const it = this.items.find((i) => i.file === f);
      if (it) {
        this.updateTitle(it);
        this.save();
      }
    }));
  }
  /** The lane's actions live in Obsidian's own "More options" (⋯) menu at the right of the lane header. */
  onPaneMenu(menu, source) {
    menu.addItem((i) => i.setSection("pane").setTitle("New editor lane to the right").setIcon("columns-3").onClick(() => void this.plugin.newLane(this)));
    menu.addItem((i) => i.setSection("pane").setTitle("Collapse all notes").setIcon("chevrons-down-up").setDisabled(!this.items.length).onClick(() => this.setAllCollapsed(true)));
    menu.addItem((i) => i.setSection("pane").setTitle("Expand all notes").setIcon("chevrons-up-down").setDisabled(!this.items.length).onClick(() => this.setAllCollapsed(false)));
    menu.addItem((i) => i.setSection("pane").setTitle("Close all notes").setIcon("x-circle").setDisabled(!this.items.length).onClick(() => this.closeAll()));
    super.onPaneMenu(menu, source);
  }
  async onClose() {
    this.teardown();
    if (this.plugin.lastLane === this) this.plugin.lastLane = null;
  }
  /** Detach every hosted leaf. Safe to call twice. */
  teardown() {
    var _a;
    for (const it of this.items) this.unmount(it);
    this.items = [];
    (_a = this.listEl) == null ? void 0 : _a.empty();
  }
  // ---------- persistence (workspace.json, via the view state) ----------
  getState() {
    const items = this.items.map((i) => ({ path: i.file.path, collapsed: i.collapsed }));
    return { items };
  }
  async setState(state, result) {
    var _a;
    const list = Array.isArray(state == null ? void 0 : state.items) ? state.items : [];
    if (!this.items.length && list.length) {
      for (const d of list) {
        const f = this.app.vault.getAbstractFileByPath(String((_a = d == null ? void 0 : d.path) != null ? _a : ""));
        if (!(f instanceof import_obsidian.TFile) || this.items.some((i) => i.file === f)) continue;
        const it = this.createItem(f, !!d.collapsed);
        this.listEl.appendChild(it.el);
        this.items.push(it);
        if (!it.collapsed) void this.mount(it);
      }
      this.updateEmpty();
    }
    await super.setState(state, result);
  }
  save() {
    this.app.workspace.requestSaveLayout();
  }
  // ---------- items ----------
  /** Add a note at the top (or move it there if it's already in this lane) and expand it. */
  async add(file, opts = {}) {
    this.plugin.lastLane = this;
    let it = this.items.find((i) => i.file === file);
    if (it) this.items.remove(it);
    else it = this.createItem(file, false);
    this.items.unshift(it);
    this.listEl.prepend(it.el);
    this.updateEmpty();
    await this.setCollapsed(it, false);
    this.listEl.scrollTop = 0;
    if (it.leaf) {
      if (opts.eState) it.leaf.setEphemeralState(opts.eState);
      if (opts.focus) this.app.workspace.setActiveLeaf(it.leaf, { focus: true });
    }
    this.save();
  }
  createItem(file, collapsed) {
    const el = createDiv({ cls: "lane-item" });
    const header = el.createDiv({ cls: "lane-item-header" });
    const chevEl = header.createSpan({ cls: "lane-chevron" });
    const titleEl = header.createSpan({
      cls: "lane-item-title",
      attr: { contenteditable: "true", spellcheck: "false", "aria-label": "Rename note" }
    });
    const pathEl = header.createSpan({ cls: "lane-item-path" });
    const closeEl = header.createEl("button", { cls: "lane-close", text: "\u2715", attr: { "aria-label": "Close" } });
    const bodyEl = el.createDiv({ cls: "lane-item-body" });
    const it = { file, collapsed, el, chevEl, titleEl, pathEl, bodyEl, split: null, leaf: null };
    this.updateTitle(it);
    this.applyCollapsed(it);
    header.addEventListener("click", (e) => {
      if (e.target.closest(".lane-item-title, .lane-close")) return;
      void this.setCollapsed(it, !it.collapsed).then(() => this.save());
    });
    titleEl.addEventListener("mousedown", (e) => {
      if (!import_obsidian.Keymap.isModEvent(e)) return;
      e.preventDefault();
      if (this.plugin.settings.lanesOnly) void this.plugin.openInLane(it.file, "new", this, { focus: true });
      else void this.app.workspace.getLeaf("tab").openFile(it.file);
    });
    titleEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        titleEl.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.updateTitle(it);
        titleEl.blur();
      } else if (e.key === "ArrowDown" && it.leaf) {
        e.preventDefault();
        this.app.workspace.setActiveLeaf(it.leaf, { focus: true });
      }
    });
    titleEl.addEventListener("paste", (e) => {
      var _a, _b;
      e.preventDefault();
      const text = ((_b = (_a = e.clipboardData) == null ? void 0 : _a.getData("text/plain")) != null ? _b : "").replace(/[\r\n]+/g, " ");
      document.execCommand("insertText", false, text);
    });
    titleEl.addEventListener("blur", () => void this.renameFromTitle(it));
    closeEl.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close(it);
    });
    header.addEventListener("contextmenu", (e) => {
      var _a;
      e.preventDefault();
      const menu = new import_obsidian.Menu();
      menu.addItem((i) => i.setTitle("Open in next lane").setIcon("arrow-right").onClick(() => void this.plugin.openInLane(it.file, "next", this, { focus: true })));
      menu.addItem((i) => i.setTitle("Open in new editor lane").setIcon("columns-3").onClick(() => void this.plugin.openInLane(it.file, "new", this, { focus: true })));
      menu.addItem((i) => i.setTitle("Move to top").setIcon("arrow-up").onClick(() => void this.add(it.file)));
      menu.addSeparator();
      menu.addItem((i) => i.setTitle("Close").setIcon("x").onClick(() => this.close(it)));
      menu.addItem((i) => i.setTitle("Close others").setIcon("x-circle").onClick(() => {
        for (const o of [...this.items]) if (o !== it) this.close(o);
      }));
      this.app.workspace.trigger("file-menu", menu, it.file, "editor-lanes", (_a = it.leaf) != null ? _a : void 0);
      menu.showAtMouseEvent(e);
    });
    return it;
  }
  /** Rename the note to the edited title, the way Obsidian's inline title does (links update with it). */
  async renameFromTitle(it) {
    var _a, _b;
    const name = ((_a = it.titleEl.textContent) != null ? _a : "").replace(/\s+/g, " ").trim();
    if (!name || name === it.file.basename) {
      this.updateTitle(it);
      return;
    }
    const bad = name.match(/[\\/:#^[\]|]/);
    if (bad || name.startsWith(".")) {
      new import_obsidian.Notice(bad ? `A note name can't contain ${bad[0]}` : "A note name can't start with a dot");
      this.updateTitle(it);
      return;
    }
    const dir = it.file.parent && it.file.parent.path !== "/" ? it.file.parent.path + "/" : "";
    const path = `${dir}${name}.${it.file.extension}`;
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing && existing !== it.file) {
      new import_obsidian.Notice(`"${name}" already exists in ${dir || "the vault root"}`);
      this.updateTitle(it);
      return;
    }
    try {
      await this.app.fileManager.renameFile(it.file, path);
    } catch (e) {
      console.error("[editor-lanes] rename failed", e);
      new import_obsidian.Notice(`Couldn't rename: ${(_b = e == null ? void 0 : e.message) != null ? _b : e}`);
      this.updateTitle(it);
    }
  }
  updateTitle(it) {
    if (document.activeElement === it.titleEl) return;
    it.titleEl.setText(it.file.basename);
    const folder = it.file.parent && it.file.parent.path !== "/" ? it.file.parent.path + "/" : "";
    it.pathEl.setText(folder);
  }
  applyCollapsed(it) {
    it.el.toggleClass("is-collapsed", it.collapsed);
    it.chevEl.setText(it.collapsed ? "\u25B8" : "\u25BE");
  }
  async setCollapsed(it, collapsed) {
    it.collapsed = collapsed;
    this.applyCollapsed(it);
    if (!collapsed) await this.mount(it);
  }
  setAllCollapsed(collapsed) {
    for (const it of this.items) void this.setCollapsed(it, collapsed);
    this.save();
  }
  close(it) {
    this.unmount(it);
    it.el.remove();
    this.items.remove(it);
    this.updateEmpty();
    this.save();
  }
  closeAll() {
    for (const it of [...this.items]) this.close(it);
  }
  updateEmpty() {
    var _a;
    (_a = this.emptyEl) == null ? void 0 : _a.toggleClass("lane-hidden", this.items.length > 0);
  }
  // ---------- hosted editors ----------
  /** Create the item's private split + leaf and open the note in it (first expand only). */
  async mount(it) {
    var _a;
    if (it.leaf) return;
    const ws = this.app.workspace;
    const split = new import_obsidian.WorkspaceSplit(ws, "horizontal");
    let detached = false;
    Object.defineProperty(split, "parent", {
      configurable: true,
      get: () => {
        var _a2;
        return detached ? null : (_a2 = ws.rightSplit) != null ? _a2 : null;
      },
      set: (v) => {
        if (v === null) detached = true;
      }
    });
    split.containerEl.addClass("lane-split");
    let leaf;
    try {
      leaf = new import_obsidian.WorkspaceLeaf(this.app);
      split.insertChild(0, leaf);
    } catch (e) {
      leaf = ws.createLeafInParent(split, 0);
    }
    it.split = split;
    it.leaf = leaf;
    this.plugin.splits.add(split);
    this.plugin.hostedLeaves.add(leaf);
    const origDetach = leaf.detach.bind(leaf);
    leaf.detach = () => {
      if (it.leaf === leaf && !leaf.__laneUnmounting) this.close(it);
      else origDetach();
    };
    it.bodyEl.appendChild(split.containerEl);
    (_a = leaf.setPinned) == null ? void 0 : _a.call(leaf, true);
    try {
      await leaf.openFile(it.file, { active: false });
    } catch (e) {
      console.error("[editor-lanes] could not open", it.file.path, e);
      it.bodyEl.createDiv({ cls: "lane-empty", text: "Couldn't open this note." });
    }
  }
  unmount(it) {
    if (!it.split) return;
    const split = it.split;
    const leaf = it.leaf;
    this.plugin.splits.delete(split);
    if (leaf) this.plugin.hostedLeaves.delete(leaf);
    split.parent = null;
    it.split = null;
    it.leaf = null;
    if (leaf) {
      leaf.__laneUnmounting = true;
      try {
        leaf.detach();
      } catch (e) {
        console.error("[editor-lanes] detach failed", e);
      }
    }
    split.containerEl.remove();
  }
  // ---------- drag and drop ----------
  /** Notes being dragged (Obsidian's drag manager, or an obsidian:// URL / [[link]] as text). */
  dropFiles(e, peek) {
    var _a, _b, _c, _d, _e;
    const out = [];
    const add = (f) => {
      if (f instanceof import_obsidian.TFile && f.extension === "md" && !out.includes(f)) out.push(f);
    };
    const d = (_a = this.app.dragManager) == null ? void 0 : _a.draggable;
    if (d) {
      if (d.type === "file") add(d.file);
      else if (d.type === "files") ((_b = d.files) != null ? _b : []).forEach(add);
      else if (d.type === "link" && d.linktext) {
        add(this.app.metadataCache.getFirstLinkpathDest((0, import_obsidian.getLinkpath)(d.linktext), (_c = d.sourcePath) != null ? _c : ""));
        add(d.file);
      }
    }
    if (out.length || peek) return out;
    const text = (_e = (_d = e.dataTransfer) == null ? void 0 : _d.getData("text/plain")) != null ? _e : "";
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      const url = /^obsidian:\/\/open\?(.*)$/.exec(t);
      if (url) {
        const file = new URLSearchParams(url[1]).get("file");
        if (file) add(this.app.metadataCache.getFirstLinkpathDest(file, ""));
        continue;
      }
      const wl = /^!?\[\[([^\]|#]+)/.exec(t);
      if (wl) add(this.app.metadataCache.getFirstLinkpathDest(wl[1], ""));
    }
    return out;
  }
};
var NotePicker = class extends import_obsidian.FuzzySuggestModal {
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
var LanesSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Editor lanes only").setDesc("Every note opened in the main area goes into a lane instead of a tab. A link clicked in a lane opens in the lane to its right. Off: notes open in normal tabs, and lanes are only filled by Shift-click, drag and drop, or the menus.").addToggle((t) => t.setValue(this.plugin.settings.lanesOnly).onChange(async (v) => {
      this.plugin.settings.lanesOnly = v;
      await this.plugin.saveData(this.plugin.settings);
      if (v) void this.plugin.sweepMainArea();
    }));
  }
};
