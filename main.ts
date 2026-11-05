import {
  App,
  FuzzySuggestModal,
  ItemView,
  Keymap,
  Menu,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TAbstractFile,
  TFile,
  WorkspaceLeaf,
  WorkspaceSplit,
  debounce,
  getLinkpath,
} from "obsidian";

/*
 * Editor Lanes: Logseq-style editor lanes. A lane is a column in the main area holding a scrollable stack of
 * notes, newest on top, each a real Obsidian editor (Live Preview / Source / Reading, hotkeys, [[ suggest…),
 * collapsible and closable. Lanes sit side by side.
 *
 * "Lanes only" (setting, on by default): every note opened in the main area goes into a lane instead of a
 * tab. A link clicked inside lane n opens in lane n+1 (created if needed), like sliding panes; a note
 * opened from anywhere else (explorer, quick switcher, search…) goes to the lane used last.
 *   Shift-click a link: add to the lane used last.   Shift+Alt-click: start a new lane on the right.
 *
 * How the editors are hosted: every note gets a real WorkspaceLeaf inside a private WorkspaceSplit. The
 * split is not a child of any workspace split, but its `parent` points at the right sidebar, so Obsidian
 * sees the leaves as attached (they can be the active leaf, so editor commands and hotkeys act on them)
 * while never treating them as main-area tabs. A patched `workspace.iterateLeaves` makes them visible to
 * `iterateAllLeaves` / `getLeavesOfType`, which is how other plugins (Backlinks Full View) find them. The
 * leaves are pinned, so a link followed inside one goes through the normal "open" path, where lanes-only
 * routing picks it up. Checked against Obsidian 1.15.0's app.js and app.css.
 */

const VIEW_TYPE = "editor-lane";
const SWALLOW_MS = 700;      // after a shift-mousedown we handled, ignore the matching mouseup/click
const POINTER_LANE_MS = 3000; // a click in a lane this recent decides the "source lane" of an open

interface Settings { lanesOnly: boolean }
const DEFAULTS: Settings = { lanesOnly: true };

interface ItemData { path: string; collapsed: boolean }

interface Item {
  file: TFile;
  collapsed: boolean;
  el: HTMLElement;
  chevEl: HTMLElement;
  titleEl: HTMLElement;
  pathEl: HTMLElement;
  bodyEl: HTMLElement;
  split: any | null;       // private WorkspaceSplit holding the leaf (created on first expand)
  leaf: WorkspaceLeaf | null;
}

type Where = "last" | "next" | "new";

export default class EditorLanesPlugin extends Plugin {
  settings: Settings = { ...DEFAULTS };
  /** Every private split / hosted leaf, for the iterateLeaves patch and for not routing our own opens. */
  splits = new Set<any>();
  hostedLeaves = new Set<WorkspaceLeaf>();
  lastLane: LaneView | null = null;
  private pointerLane: { lane: LaneView; at: number } | null = null;
  private swallowUntil = 0;
  private routing = new Set<WorkspaceLeaf>(); // leaves whose open is being routed right now (the sweep skips them)
  private sweeping = false;
  private modClickAt = 0; // last Ctrl/Cmd(-Alt…) mousedown: a routed open right after it gets a new lane

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
      checkCallback: (checking) => this.withActiveFile(checking, (f) => this.openInLane(f, "last")),
    });
    this.addCommand({
      id: "open-current-new-lane",
      name: "Open current note in a new editor lane",
      checkCallback: (checking) => this.withActiveFile(checking, (f) => this.openInLane(f, "new")),
    });
    this.addCommand({ id: "open-note", name: "Open note in an editor lane…", callback: () => new NotePicker(this).open() });
    this.addCommand({
      id: "close-all",
      name: "Close all notes in this editor lane",
      callback: () => this.currentLane()?.closeAll(),
    });
    this.addCommand({
      id: "collapse-all",
      name: "Collapse all notes in this editor lane",
      callback: () => this.currentLane()?.setAllCollapsed(true),
    });
    this.addCommand({
      id: "toggle-lanes-only",
      name: "Toggle editor lanes only",
      callback: async () => {
        this.settings.lanesOnly = !this.settings.lanesOnly;
        await this.saveData(this.settings);
        if (this.settings.lanesOnly) void this.sweepMainArea();
      },
    });

    // right-click on a file (explorer, tab, link, search result…)
    this.registerEvent(this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
      if (!(file instanceof TFile) || file.extension !== "md") return;
      menu.addItem((i) => i.setTitle("Open in editor lane").setIcon("columns-3").setSection("open")
        .onClick(() => void this.openInLane(file, "last")));
      menu.addItem((i) => i.setTitle("Open in new editor lane").setIcon("columns-3").setSection("open")
        .onClick(() => void this.openInLane(file, "new")));
    }));
    this.registerEvent(this.app.workspace.on("files-menu", (menu: Menu, files: TAbstractFile[]) => {
      const md = files.filter((f): f is TFile => f instanceof TFile && f.extension === "md");
      if (!md.length) return;
      menu.addItem((i) => i.setTitle(`Open ${md.length} in editor lane`).setIcon("columns-3").setSection("open")
        .onClick(async () => { for (const f of [...md].reverse()) await this.openInLane(f, "last"); }));
    }));

    // Shift-click a link: capture phase, so we act before Obsidian or CodeMirror (which would extend the selection)
    this.registerDomEvent(document, "mousedown", (e) => this.onMouseDown(e), { capture: true });
    const swallow = (e: MouseEvent) => {
      if (Date.now() < this.swallowUntil) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    this.registerDomEvent(document, "mouseup", swallow, { capture: true });
    this.registerDomEvent(document, "click", swallow, { capture: true });

    // Editor lanes only: the main area holds lanes, not tabs. Tabs that appear without going through
    // openFile (restored layout, dragged tabs, Ctrl+T) are swept into lanes after each layout change.
    const sweep = debounce(() => void this.sweepMainArea(), 250, true);
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
      const ws = this.app.workspace as any;
      const tabs: { leaf: WorkspaceLeaf; file: TFile }[] = [];
      const empties: WorkspaceLeaf[] = [];
      ws.iterateLeaves(ws.rootSplit, (leaf: WorkspaceLeaf) => {
        if (this.hostedLeaves.has(leaf) || this.routing.has(leaf)) return;
        const vs = leaf.getViewState(); // also right for deferred (not yet loaded) background tabs
        if (vs.type === "markdown") {
          const f = this.app.vault.getAbstractFileByPath(String((vs.state as any)?.file ?? ""));
          if (f instanceof TFile) tabs.push({ leaf, file: f });
        } else if (vs.type === "empty") {
          empties.push(leaf);
        }
      });
      for (const leaf of empties) await this.setLane(leaf);
      for (const { leaf, file } of tabs.reverse()) {
        const lane = this.targetLane();
        if (!lane) {
          const first = await this.setLane(leaf);
          await first?.add(file);
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

  private withActiveFile(checking: boolean, fn: (f: TFile) => unknown): boolean {
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
  private patchIterateLeaves() {
    const ws = this.app.workspace as any;
    const orig = ws.iterateLeaves;
    if (typeof orig !== "function") return;
    const splits = this.splits;
    const patched = function (this: any, a: any, b: any) {
      if (orig.call(this, a, b)) return true;
      let target = a, cb = b;
      if (typeof a === "function") { target = b; cb = a; }
      if (!target || Array.isArray(target) || typeof cb !== "function") return false;
      for (const sp of splits) {
        if (sp.parent === target && orig.call(this, sp, cb)) return true;
      }
      return false;
    };
    ws.iterateLeaves = patched;
    this.register(() => { if (ws.iterateLeaves === patched) ws.iterateLeaves = orig; });
  }

  /** Lanes only: a note about to open in a main-area leaf goes to a lane instead. */
  private patchOpenFile() {
    const proto = (WorkspaceLeaf as any).prototype;
    const orig = proto.openFile;
    if (typeof orig !== "function") return;
    const plugin = this;
    const patched = async function (this: WorkspaceLeaf, file: TFile, state?: any) {
      if (!plugin.shouldRoute(this, file)) return orig.call(this, file, state);
      try {
        await plugin.route(this, file, state);
      } catch (e) {
        console.error("[editor-lanes] routing to a lane failed, opening normally", e);
        return orig.call(this, file, state);
      }
    };
    proto.openFile = patched;
    this.register(() => { if (proto.openFile === patched) proto.openFile = orig; });
  }

  private shouldRoute(leaf: WorkspaceLeaf, file: unknown): boolean {
    if (!this.settings.lanesOnly) return false;
    if (!(file instanceof TFile) || file.extension !== "md") return false;
    if (this.hostedLeaves.has(leaf) || leaf.view instanceof LaneView) return false;
    const ws = this.app.workspace as any;
    const root = leaf.getRoot();
    return root === ws.rootSplit || root === ws.floatingSplit;
  }

  /** Where a routed open lands: the next lane after the one it came from, else the lane used last. */
  private async route(leaf: WorkspaceLeaf, file: TFile, state?: any) {
    this.routing.add(leaf);
    try { await this.routeInner(leaf, file, state); } finally { this.routing.delete(leaf); }
  }

  private async routeInner(leaf: WorkspaceLeaf, file: TFile, state?: any) {
    const ws = this.app.workspace;
    const from = this.sourceLane();
    const wantNew = Date.now() - this.modClickAt < POINTER_LANE_MS;
    this.modClickAt = 0;
    if (!this.lanes().length) {
      // first note with no lanes yet: an empty tab becomes the first lane, otherwise a lane opens beside it
      const lane = leaf.view.getViewType() === "empty"
        ? await this.setLane(leaf)
        : await this.newLane(null);
      await lane?.add(file, { focus: true, eState: state?.eState });
      return;
    }
    await this.openInLane(file, wantNew ? "new" : from ? "next" : "last", from, { focus: true, eState: state?.eState });
    // the tab Obsidian picked for this open is now unused: drop it if it's empty and not the last one
    if (leaf.view.getViewType() === "empty" && ws.getLeavesOfType("empty").length + this.lanes().length > 1) {
      leaf.detach();
    }
  }

  // ---------- lanes ----------

  allLaneViews(): LaneView[] {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE)
      .map((l) => l.view).filter((v): v is LaneView => v instanceof LaneView);
  }

  /** Lanes in the main area (and popout windows), left to right. */
  lanes(): LaneView[] {
    const ws = this.app.workspace as any;
    return this.allLaneViews()
      .filter((v) => { const r = v.leaf.getRoot(); return r === ws.rootSplit || r === ws.floatingSplit; })
      .sort((a, b) => a.containerEl.getBoundingClientRect().left - b.containerEl.getBoundingClientRect().left);
  }

  laneOfLeaf(leaf: WorkspaceLeaf | null): LaneView | null {
    if (!leaf) return null;
    if (leaf.view instanceof LaneView) return leaf.view;
    return this.allLaneViews().find((v) => v.items.some((i) => i.leaf === leaf)) ?? null;
  }

  /** The lane the current open came from: a recent click inside a lane, else the active (hosted) leaf. */
  private sourceLane(): LaneView | null {
    const p = this.pointerLane;
    if (p && Date.now() - p.at < POINTER_LANE_MS && this.allLaneViews().includes(p.lane)) return p.lane;
    return this.laneOfLeaf(this.app.workspace.activeLeaf);
  }

  /** The lane commands act on: the active one, else the one used last. */
  currentLane(): LaneView | null {
    return this.laneOfLeaf(this.app.workspace.activeLeaf) ?? this.targetLane();
  }

  private targetLane(): LaneView | null {
    const lanes = this.lanes();
    if (this.lastLane && lanes.includes(this.lastLane)) return this.lastLane;
    return lanes[lanes.length - 1] ?? null;
  }

  private async setLane(leaf: WorkspaceLeaf): Promise<LaneView | null> {
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    return leaf.view instanceof LaneView ? leaf.view : null;
  }

  /** A new lane to the right of `after` (or of the rightmost lane, or of the current tab). */
  async newLane(after: LaneView | null): Promise<LaneView | null> {
    const ws = this.app.workspace;
    const lanes = this.lanes();
    const anchor = after?.leaf ?? lanes[lanes.length - 1]?.leaf ?? ws.getMostRecentLeaf();
    let leaf: WorkspaceLeaf;
    if (anchor && anchor.getRoot() === (ws as any).rootSplit) leaf = ws.createLeafBySplit(anchor, "vertical");
    else leaf = ws.getLeaf("split", "vertical");
    const lane = await this.setLane(leaf);
    if (lane) this.lastLane = lane;
    return lane;
  }

  async openInLane(file: TFile, where: Where, from: LaneView | null = null, opts: AddOpts = {}) {
    let lane: LaneView | null = null;
    if (where === "next" && from) {
      const lanes = this.lanes();
      const i = lanes.indexOf(from);
      lane = i >= 0 ? lanes[i + 1] ?? null : null;
      if (!lane) lane = await this.newLane(from);
    } else if (where === "new") {
      lane = await this.newLane(null);
    } else {
      lane = this.targetLane() ?? await this.newLane(null);
    }
    if (!lane) return;
    await this.app.workspace.revealLeaf(lane.leaf);
    await lane.add(file, opts);
  }

  notePointerIn(lane: LaneView) { this.pointerLane = { lane, at: Date.now() }; this.lastLane = lane; }

  // ---------- shift-click ----------

  /** The note a link was clicked in: a Backlinks Full View card, else the leaf's note. */
  private sourcePathOf(el: HTMLElement): string {
    const card = el.closest("[data-bfv-path]");
    if (card) return card.getAttribute("data-bfv-path") ?? "";
    let path = "";
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!path && leaf.view.containerEl.contains(el)) path = (leaf.view as any).file?.path ?? "";
    });
    return path;
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button === 0 && Keymap.isModEvent(e)) this.modClickAt = Date.now();
    if (!e.shiftKey || e.button !== 0 || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement | null;
    if (!el || !(el instanceof HTMLElement)) return;
    if (el.closest(".nav-files-container")) return; // file explorer: Shift-click is multi-select

    let link: string | null = null;
    const a = el.closest("a.internal-link, .internal-link[data-href]") as HTMLElement | null;
    if (a) {
      link = a.getAttribute("data-href") ?? a.getAttribute("href");
    } else if (el.closest(".cm-editor")) {
      // Live Preview / Source mode: ask the editor what's under the mouse
      this.app.workspace.iterateAllLeaves((leaf) => {
        if (link !== null || !leaf.view.containerEl.contains(el)) return;
        const editor = (leaf.view as any).editor;
        try {
          const pos = editor?.posAtMouse?.(e);
          const tok = pos ? editor.getClickableTokenAt?.(pos) : null;
          if (tok?.type === "internal-link" && tok.text) link = tok.text;
        } catch { /* internal API changed: fall through to Obsidian's default */ }
      });
    }
    if (!link) return;
    const dest = this.app.metadataCache.getFirstLinkpathDest(getLinkpath(link), this.sourcePathOf(el));
    if (!(dest instanceof TFile) || dest.extension !== "md") return; // unresolved or not a note: default behaviour

    e.preventDefault();
    e.stopImmediatePropagation();
    this.swallowUntil = Date.now() + SWALLOW_MS;
    void this.openInLane(dest, e.altKey ? "new" : "last");
  }
}

interface AddOpts { focus?: boolean; eState?: any }

class LaneView extends ItemView {
  items: Item[] = [];
  private listEl!: HTMLElement;
  private emptyEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private plugin: EditorLanesPlugin) {
    super(leaf);
    this.navigation = false;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Editor lane"; }
  getIcon() { return "columns-3"; }

  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("lane-view");
    root.addEventListener("mousedown", () => this.plugin.notePointerIn(this), { capture: true });


    this.listEl = root.createDiv({ cls: "lane-list" });
    this.emptyEl = root.createDiv({
      cls: "lane-empty",
      text: "Open a note, Shift-click a link, or drag a note here.",
    });
    this.updateEmpty();

    // drag and drop: files / links from the explorer, tabs, editors, search, bookmarks…
    root.addEventListener("dragover", (e) => {
      if (!this.dropFiles(e, true).length && !e.dataTransfer?.types.includes("text/plain")) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "link";
      root.addClass("is-drop-target");
    });
    root.addEventListener("dragleave", (e) => {
      if (!root.contains(e.relatedTarget as Node | null)) root.removeClass("is-drop-target");
    });
    root.addEventListener("drop", (e) => {
      root.removeClass("is-drop-target");
      const files = this.dropFiles(e, false);
      if (!files.length) return;
      e.preventDefault();
      e.stopPropagation();
      void (async () => { for (const f of [...files].reverse()) await this.add(f); })();
    });

    this.registerEvent(this.app.vault.on("delete", (f) => {
      const it = this.items.find((i) => i.file === f);
      if (it) this.close(it);
    }));
    this.registerEvent(this.app.vault.on("rename", (f) => {
      const it = this.items.find((i) => i.file === f);
      if (it) { this.updateTitle(it); this.save(); }
    }));
  }

  /** The lane's actions live in Obsidian's own "More options" (⋯) menu at the right of the lane header. */
  onPaneMenu(menu: Menu, source: string) {
    menu.addItem((i) => i.setSection("pane").setTitle("New editor lane to the right").setIcon("columns-3")
      .onClick(() => void this.plugin.newLane(this)));
    menu.addItem((i) => i.setSection("pane").setTitle("Collapse all notes").setIcon("chevrons-down-up")
      .setDisabled(!this.items.length).onClick(() => this.setAllCollapsed(true)));
    menu.addItem((i) => i.setSection("pane").setTitle("Expand all notes").setIcon("chevrons-up-down")
      .setDisabled(!this.items.length).onClick(() => this.setAllCollapsed(false)));
    menu.addItem((i) => i.setSection("pane").setTitle("Close all notes").setIcon("x-circle")
      .setDisabled(!this.items.length).onClick(() => this.closeAll()));
    super.onPaneMenu(menu, source);
  }

  async onClose() {
    this.teardown();
    if (this.plugin.lastLane === this) this.plugin.lastLane = null;
  }

  /** Detach every hosted leaf. Safe to call twice. */
  teardown() {
    for (const it of this.items) this.unmount(it);
    this.items = [];
    this.listEl?.empty();
  }

  // ---------- persistence (workspace.json, via the view state) ----------

  getState(): Record<string, unknown> {
    const items: ItemData[] = this.items.map((i) => ({ path: i.file.path, collapsed: i.collapsed }));
    return { items };
  }

  async setState(state: any, result: any) {
    const list: ItemData[] = Array.isArray(state?.items) ? state.items : [];
    if (!this.items.length && list.length) {
      for (const d of list) {
        const f = this.app.vault.getAbstractFileByPath(String(d?.path ?? ""));
        if (!(f instanceof TFile) || this.items.some((i) => i.file === f)) continue;
        const it = this.createItem(f, !!d.collapsed);
        this.listEl.appendChild(it.el);
        this.items.push(it);
        if (!it.collapsed) void this.mount(it);
      }
      this.updateEmpty();
    }
    await super.setState(state, result);
  }

  private save() { this.app.workspace.requestSaveLayout(); }

  // ---------- items ----------

  /** Add a note at the top (or move it there if it's already in this lane) and expand it. */
  async add(file: TFile, opts: AddOpts = {}) {
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
      if (opts.eState) it.leaf.setEphemeralState(opts.eState); // e.g. a #heading link: scroll to it
      if (opts.focus) this.app.workspace.setActiveLeaf(it.leaf, { focus: true });
    }
    this.save();
  }

  private createItem(file: TFile, collapsed: boolean): Item {
    const el = createDiv({ cls: "lane-item" });
    const header = el.createDiv({ cls: "lane-item-header" });
    const chevEl = header.createSpan({ cls: "lane-chevron" });
    const titleEl = header.createSpan({
      cls: "lane-item-title", attr: { contenteditable: "true", spellcheck: "false", "aria-label": "Rename note" },
    });
    const pathEl = header.createSpan({ cls: "lane-item-path" });
    const closeEl = header.createEl("button", { cls: "lane-close", text: "✕", attr: { "aria-label": "Close" } });
    const bodyEl = el.createDiv({ cls: "lane-item-body" });
    const it: Item = { file, collapsed, el, chevEl, titleEl, pathEl, bodyEl, split: null, leaf: null };
    this.updateTitle(it);
    this.applyCollapsed(it);

    header.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".lane-item-title, .lane-close")) return;
      void this.setCollapsed(it, !it.collapsed).then(() => this.save());
    });
    // title: edit it to rename the note, like Obsidian's inline title. Ctrl/Cmd-click opens the note instead
    // (a new lane; with lanes only off, a new tab).
    titleEl.addEventListener("mousedown", (e) => {
      if (!Keymap.isModEvent(e)) return;
      e.preventDefault();
      if (this.plugin.settings.lanesOnly) void this.plugin.openInLane(it.file, "new", this, { focus: true });
      else void this.app.workspace.getLeaf("tab").openFile(it.file);
    });
    titleEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); titleEl.blur(); }          // commit (blur renames)
      else if (e.key === "Escape") { e.preventDefault(); this.updateTitle(it); titleEl.blur(); }
      else if (e.key === "ArrowDown" && it.leaf) {                           // like the inline title: into the note
        e.preventDefault();
        this.app.workspace.setActiveLeaf(it.leaf, { focus: true });
      }
    });
    titleEl.addEventListener("paste", (e) => {                               // plain text, one line
      e.preventDefault();
      const text = (e.clipboardData?.getData("text/plain") ?? "").replace(/[\r\n]+/g, " ");
      document.execCommand("insertText", false, text);
    });
    titleEl.addEventListener("blur", () => void this.renameFromTitle(it));
    closeEl.addEventListener("click", (e) => { e.stopPropagation(); this.close(it); });
    header.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const menu = new Menu();
      menu.addItem((i) => i.setTitle("Open in next lane").setIcon("arrow-right").onClick(() =>
        void this.plugin.openInLane(it.file, "next", this, { focus: true })));
      menu.addItem((i) => i.setTitle("Open in new editor lane").setIcon("columns-3").onClick(() =>
        void this.plugin.openInLane(it.file, "new", this, { focus: true })));
      menu.addItem((i) => i.setTitle("Move to top").setIcon("arrow-up").onClick(() => void this.add(it.file)));
      menu.addSeparator();
      menu.addItem((i) => i.setTitle("Close").setIcon("x").onClick(() => this.close(it)));
      menu.addItem((i) => i.setTitle("Close others").setIcon("x-circle").onClick(() => {
        for (const o of [...this.items]) if (o !== it) this.close(o);
      }));
      this.app.workspace.trigger("file-menu", menu, it.file, "editor-lanes", it.leaf ?? undefined);
      menu.showAtMouseEvent(e);
    });
    return it;
  }

  /** Rename the note to the edited title, the way Obsidian's inline title does (links update with it). */
  private async renameFromTitle(it: Item) {
    const name = (it.titleEl.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!name || name === it.file.basename) { this.updateTitle(it); return; }
    const bad = name.match(/[\\/:#^[\]|]/);
    if (bad || name.startsWith(".")) {
      new Notice(bad ? `A note name can't contain ${bad[0]}` : "A note name can't start with a dot");
      this.updateTitle(it);
      return;
    }
    const dir = it.file.parent && it.file.parent.path !== "/" ? it.file.parent.path + "/" : "";
    const path = `${dir}${name}.${it.file.extension}`;
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing && existing !== it.file) {
      new Notice(`"${name}" already exists in ${dir || "the vault root"}`);
      this.updateTitle(it);
      return;
    }
    try {
      await this.app.fileManager.renameFile(it.file, path);
    } catch (e) {
      console.error("[editor-lanes] rename failed", e);
      new Notice(`Couldn't rename: ${(e as Error)?.message ?? e}`);
      this.updateTitle(it);
    }
  }

  private updateTitle(it: Item) {
    if (document.activeElement === it.titleEl) return; // don't overwrite a title being edited
    it.titleEl.setText(it.file.basename);
    const folder = it.file.parent && it.file.parent.path !== "/" ? it.file.parent.path + "/" : "";
    it.pathEl.setText(folder);
  }

  private applyCollapsed(it: Item) {
    it.el.toggleClass("is-collapsed", it.collapsed);
    it.chevEl.setText(it.collapsed ? "▸" : "▾");
  }

  async setCollapsed(it: Item, collapsed: boolean) {
    it.collapsed = collapsed;
    this.applyCollapsed(it);
    if (!collapsed) await this.mount(it);
  }

  setAllCollapsed(collapsed: boolean) {
    for (const it of this.items) void this.setCollapsed(it, collapsed);
    this.save();
  }

  close(it: Item) {
    this.unmount(it);
    it.el.remove();
    this.items.remove(it);
    this.updateEmpty();
    this.save();
  }

  closeAll() {
    for (const it of [...this.items]) this.close(it);
  }

  private updateEmpty() {
    this.emptyEl?.toggleClass("lane-hidden", this.items.length > 0);
  }

  // ---------- hosted editors ----------

  /** Create the item's private split + leaf and open the note in it (first expand only). */
  private async mount(it: Item) {
    if (it.leaf) return;
    const ws = this.app.workspace as any;
    const split = new (WorkspaceSplit as any)(ws, "horizontal");
    // Not a child of the right sidebar (see the comment at the top). `parent` is looked up on every read:
    // loading a layout (startup, the Workspaces plugin) replaces workspace.rightSplit, and setLayout builds
    // the main area, and so restores lanes, before the new right sidebar exists. A stored reference would
    // point at the old one (or null), and the hosted leaves would stop counting as attached.
    let detached = false;
    Object.defineProperty(split, "parent", {
      configurable: true,
      get: () => (detached ? null : ws.rightSplit ?? null),
      set: (v) => { if (v === null) detached = true; },
    });
    split.containerEl.addClass("lane-split");
    let leaf: any;
    try {
      leaf = new (WorkspaceLeaf as any)(this.app);
      split.insertChild(0, leaf);
    } catch {
      leaf = ws.createLeafInParent(split, 0);
    }
    it.split = split;
    it.leaf = leaf;
    this.plugin.splits.add(split);
    this.plugin.hostedLeaves.add(leaf);
    // Ctrl+W / "Close tab" on a hosted note closes the item properly instead of leaving an empty card
    const origDetach = leaf.detach.bind(leaf);
    leaf.detach = () => { if (it.leaf === leaf && !leaf.__laneUnmounting) this.close(it); else origDetach(); };
    it.bodyEl.appendChild(split.containerEl);
    leaf.setPinned?.(true); // links followed from here take the normal open path (and lanes-only routing)
    try {
      await leaf.openFile(it.file, { active: false });
    } catch (e) {
      console.error("[editor-lanes] could not open", it.file.path, e);
      it.bodyEl.createDiv({ cls: "lane-empty", text: "Couldn't open this note." });
    }
  }

  private unmount(it: Item) {
    if (!it.split) return;
    const split = it.split;
    const leaf: any = it.leaf;
    this.plugin.splits.delete(split);
    if (leaf) this.plugin.hostedLeaves.delete(leaf);
    // Unhook first: an emptied split removes itself from its parent, and it was never the parent's child.
    split.parent = null; // the setter marks it detached
    it.split = null;
    it.leaf = null;
    if (leaf) {
      leaf.__laneUnmounting = true;
      try { leaf.detach(); } catch (e) { console.error("[editor-lanes] detach failed", e); }
    }
    split.containerEl.remove();
  }

  // ---------- drag and drop ----------

  /** Notes being dragged (Obsidian's drag manager, or an obsidian:// URL / [[link]] as text). */
  private dropFiles(e: DragEvent, peek: boolean): TFile[] {
    const out: TFile[] = [];
    const add = (f: unknown) => { if (f instanceof TFile && f.extension === "md" && !out.includes(f)) out.push(f); };
    const d = (this.app as any).dragManager?.draggable;
    if (d) {
      if (d.type === "file") add(d.file);
      else if (d.type === "files") (d.files ?? []).forEach(add);
      else if (d.type === "link" && d.linktext) {
        add(this.app.metadataCache.getFirstLinkpathDest(getLinkpath(d.linktext), d.sourcePath ?? ""));
        add(d.file);
      }
    }
    if (out.length || peek) return out;
    const text = e.dataTransfer?.getData("text/plain") ?? "";
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
}

class NotePicker extends FuzzySuggestModal<TFile> {
  constructor(private plugin: EditorLanesPlugin) {
    super(plugin.app);
    this.setPlaceholder("Open a note in an editor lane…");
  }
  getItems() { return this.app.vault.getMarkdownFiles(); }
  getItemText(f: TFile) { return f.path.replace(/\.md$/, ""); }
  onChooseItem(f: TFile) { void this.plugin.openInLane(f, "last", null, { focus: true }); }
}

class LanesSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: EditorLanesPlugin) { super(app, plugin); }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("Editor lanes only")
      .setDesc("Every note opened in the main area goes into a lane instead of a tab. A link clicked in a lane opens in the lane to its right. Off: notes open in normal tabs, and lanes are only filled by Shift-click, drag and drop, or the menus.")
      .addToggle((t) => t.setValue(this.plugin.settings.lanesOnly).onChange(async (v) => {
        this.plugin.settings.lanesOnly = v;
        await this.plugin.saveData(this.plugin.settings);
        if (v) void this.plugin.sweepMainArea();
      }));
  }
}
