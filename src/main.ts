import {
  Menu,
  OpenViewState,
  Plugin,
  TAbstractFile,
  TFile,
  WorkspaceLeaf,
  WorkspaceSplit,
  debounce,
  getLinkpath,
} from "obsidian";
import { around } from "monkey-around";
import { asEl } from "./dom";
import { LaneView } from "./lane-view";
import { NotePicker } from "./note-picker";
import { DEFAULTS, LanesSettingTab, Settings } from "./settings";
import { AddOpts, INTENT_MS, Intent, Item, LaneDir, SWALLOW_MS, VIEW_TYPE, Where } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
/** For around() on methods whose (overloaded) public types don't fit a wrapper that also returns null. */
const loose = (o: object) => o as unknown as Record<string, AnyFn>;

/*
 * Editor Lanes: Logseq-style editor lanes. A lane is a column in the main area holding a scrollable stack of
 * notes, newest on top, each a real Obsidian editor (Live Preview / Source / Reading, hotkeys, [[ suggest…),
 * collapsible and closable. Lanes sit side by side.
 *
 * "Lanes only" (setting, on by default): every note opened in the main area goes into a lane instead of a
 * tab. A link followed inside lane n opens in lane n+1 (created if needed), like sliding panes; a "new tab"
 * open (Ctrl/Cmd- or middle-click) gets a new lane; anything else (explorer, quick switcher, search…) goes
 * to the lane used last. Opens aimed at a popout window stay there, unless they come from a lane in it.
 *   Shift-click a link: add to the lane used last.   Shift+Alt-click: start a new lane on the right.
 * Where an open came from is recorded when it starts: `workspace.getLeaf` / `getUnpinnedLeaf` are wrapped
 * to note the pane type and the lane that was active (and last received input) at call time.
 *
 * How the editors are hosted: every note gets a real WorkspaceLeaf inside a private WorkspaceSplit. The
 * split is not a child of any workspace split, but its `parent` points at the right sidebar, so Obsidian
 * sees the leaves as attached (they can be the active leaf, so editor commands and hotkeys act on them)
 * while never treating them as main-area tabs. A patched `workspace.iterateLeaves` makes them visible to
 * `iterateAllLeaves` / `getLeavesOfType`, which is how other plugins (Backlinks Full View) find them.
 * Per hosted leaf: it stays pinned (so a link followed inside one goes through the normal "open" path, where
 * lanes-only routing picks it up) and unpinning it (Ctrl+W) closes the card; `getContainer` answers with
 * the lane's window; `setEphemeralState({rename})` edits the card title. Notes mount when expanded and
 * scrolled near view, and unmount when collapsed. Checked against Obsidian 1.15.0's app.js and app.css.
 */

export default class EditorLanesPlugin extends Plugin {
  override settings: Settings = { ...DEFAULTS };
  /** Every private split / hosted leaf, for the iterateLeaves patch and for not routing our own opens. */
  splits = new Set<any>();
  hostedLeaves = new Map<WorkspaceLeaf, { lane: LaneView; item: Item }>();
  lastLane: LaneView | null = null;
  /** The note card being dragged by its header, if any. */
  dragItem: { lane: LaneView; item: Item } | null = null;
  private swallow: { until: number; el: HTMLElement } | null = null;
  private routing = new Set<WorkspaceLeaf>(); // leaves whose open is being routed right now (the sweep skips them)
  private intents = new WeakMap<WorkspaceLeaf, Intent>();
  private seen = new WeakSet<WorkspaceLeaf>(); // main-area leaves the sweep has already looked at
  private sweeping = false;
  private lastInput: Node | null = null; // target of the last mousedown / keydown in any window
  private windowDocs = new WeakSet<Document>();
  private requestSweep = debounce(() => void this.sweepMainArea(false), 250, true);

  override async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.addSettingTab(new LanesSettingTab(this.app, this));
    this.registerView(VIEW_TYPE, leaf => new LaneView(leaf, this));
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
      checkCallback: checking => this.withActiveFile(checking, f => this.openInLane(f, "last")),
    });
    this.addCommand({
      id: "open-current-new-lane",
      name: "Open current note in a new editor lane",
      checkCallback: checking => this.withActiveFile(checking, f => this.openInLane(f, "new")),
    });
    this.addCommand({
      id: "open-note",
      name: "Open note in an editor lane…",
      callback: () => new NotePicker(this).open(),
    });
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
      id: "toggle-pin",
      name: "Pin or unpin the current note in its editor lane",
      checkCallback: checking => this.withHostedItem(checking, (lane, it) => lane.togglePin(it)),
    });
    this.addCommand({
      id: "move-next-lane",
      name: "Move the current note to the next editor lane",
      checkCallback: checking => this.withHostedItem(checking, (lane, it) => this.moveToLane(lane, it, 1)),
    });
    this.addCommand({
      id: "move-previous-lane",
      name: "Move the current note to the previous editor lane",
      checkCallback: checking => this.withHostedItem(checking, (lane, it) => this.moveToLane(lane, it, -1)),
    });
    this.addCommand({
      id: "toggle-lanes-only",
      name: "Toggle editor lanes only",
      callback: async () => {
        this.settings.lanesOnly = !this.settings.lanesOnly;
        await this.saveData(this.settings);
        if (this.settings.lanesOnly) void this.sweepMainArea(true);
      },
    });

    // right-click on a file (explorer, tab, link, search result…)
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        menu.addItem(i =>
          i
            .setTitle("Open in editor lane")
            .setIcon("columns-3")
            .setSection("open")
            .onClick(() => void this.openInLane(file, "last")),
        );
        menu.addItem(i =>
          i
            .setTitle("Open in new editor lane")
            .setIcon("columns-3")
            .setSection("open")
            .onClick(() => void this.openInLane(file, "new")),
        );
      }),
    );
    this.registerEvent(
      this.app.workspace.on("files-menu", (menu: Menu, files: TAbstractFile[]) => {
        const md = files.filter((f): f is TFile => f instanceof TFile && f.extension === "md");
        if (!md.length) return;
        menu.addItem(i =>
          i
            .setTitle(`Open ${md.length} in editor lane`)
            .setIcon("columns-3")
            .setSection("open")
            .onClick(async () => {
              for (const f of [...md].reverse()) await this.openInLane(f, "last");
            }),
        );
      }),
    );

    // Mouse / keyboard handlers in every window (the main one and popouts)
    this.registerWindow(document);
    this.registerEvent(this.app.workspace.on("window-open", (_w, win) => this.registerWindow(win.document)));

    // Editor lanes only: the main area holds lanes, not tabs. Tabs that appear without going through
    // openFile (restored layout, Workspaces load, dragged tabs, Ctrl+T) are swept into lanes: all of them on
    // startup and when the setting is turned on, afterwards only tabs that are new since the last sweep.
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.wrapRightSplitCollapse();
        this.requestSweep();
      }),
    );
    this.app.workspace.onLayoutReady(() => {
      this.wrapRightSplitCollapse();
      for (const w of (this.app.workspace as any).floatingSplit?.children ?? []) if (w?.doc) this.registerWindow(w.doc);
      void this.sweepMainArea(true);
    });
  }

  private registerWindow(doc: Document) {
    if (this.windowDocs.has(doc)) return;
    this.windowDocs.add(doc);
    // Shift-click a link: capture phase, so we act before Obsidian or CodeMirror (which would extend the selection)
    this.registerDomEvent(doc, "mousedown", e => this.onMouseDown(e), { capture: true });
    this.registerDomEvent(
      doc,
      "keydown",
      e => {
        this.lastInput = e.target as Node | null;
      },
      { capture: true },
    );
    const swallow = (e: MouseEvent) => {
      const s = this.swallow;
      if (!s) return;
      const t = asEl(e.target);
      if (Date.now() > s.until) {
        this.swallow = null;
        return;
      }
      if (!t || !(s.el.contains(t) || t.contains(s.el))) return; // only the press we handled
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
  async sweepMainArea(all: boolean) {
    if (!this.settings.lanesOnly || this.sweeping) return;
    this.sweeping = true;
    let retry = false;
    try {
      const ws = this.app.workspace as any;
      const tabs: { leaf: WorkspaceLeaf; file: TFile; opts: AddOpts }[] = [];
      const empties: WorkspaceLeaf[] = [];
      ws.iterateLeaves(ws.rootSplit, (leaf: WorkspaceLeaf) => {
        if (this.hostedLeaves.has(leaf) || leaf.view instanceof LaneView) return;
        if (this.routing.has(leaf) || this.freshIntent(leaf)) {
          retry = true;
          return;
        } // about to be routed
        if (!all && this.seen.has(leaf)) return;
        this.seen.add(leaf);
        const vs = leaf.getViewState(); // also right for deferred (not yet loaded) background tabs
        if (vs.pinned || (leaf as any).group) return;
        if (vs.type === "markdown") {
          const f = this.app.vault.getAbstractFileByPath(String((vs.state as any)?.file ?? ""));
          if (!(f instanceof TFile)) return;
          const opts: AddOpts = { mode: (vs.state as any)?.mode };
          try {
            opts.eState = leaf.getEphemeralState();
          } catch {
            /* deferred view */
          }
          try {
            opts.history = (leaf as any).history?.serialize?.();
          } catch {
            /* internal API changed */
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

  override onunload() {
    for (const lane of this.allLaneViews()) lane.teardown();
  }

  private withHostedItem(checking: boolean, fn: (lane: LaneView, it: Item) => unknown): boolean {
    const h = this.hostedLeaves.get(this.app.workspace.activeLeaf as WorkspaceLeaf);
    if (!h) return false;
    if (!checking) void fn(h.lane, h.item);
    return true;
  }

  private withActiveFile(checking: boolean, fn: (f: TFile) => unknown): boolean {
    const f = this.app.workspace.getActiveFile();
    if (!f || f.extension !== "md") return false;
    if (!checking) void fn(f);
    return true;
  }

  /** Detach a leaf without leaving an "Undo close tab" entry for it (it was moved, not closed). */
  detachQuietly(leaf: WorkspaceLeaf) {
    // WorkspaceLeaf.detach calls pushUndoHistory synchronously; skipping the push (rather than removing the
    // entry afterwards) also keeps it from evicting older entries from the 10-entry list.
    const restore = around(this.app.workspace, { pushUndoHistory: () => () => {} });
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
  private patchIterateLeaves() {
    const ws = this.app.workspace;
    const splits = this.splits;
    this.register(
      around(ws, {
        iterateLeaves: (next: AnyFn) =>
          function (this: unknown, a: unknown, b: unknown) {
            if (next.call(this, a, b)) return true;
            let target = a,
              cb = b;
            if (typeof a === "function") {
              target = b;
              cb = a;
            }
            if (!target || target !== ws.rightSplit || typeof cb !== "function") return false;
            for (const sp of splits) {
              if (sp.parent === target && next.call(this, sp, cb)) return true;
            }
            return false;
          },
      }),
    );
  }

  /** Lanes only: a note about to open in a main-area leaf goes to a lane instead. */
  private patchOpenFile() {
    const plugin = this;
    this.register(
      around(WorkspaceLeaf.prototype, {
        openFile: next =>
          async function (this: WorkspaceLeaf, file: TFile, openState?: OpenViewState) {
            if (!plugin.shouldRoute(this, file)) return next.call(this, file, openState);
            try {
              await plugin.route(this, file, openState);
            } catch (e) {
              console.error("[editor-lanes] routing to a lane failed, opening normally", e);
              return next.call(this, file, openState);
            }
          },
      }),
    );
  }

  /**
   * Record where an open starts. Obsidian's opens pick a leaf with getLeaf(paneType) (which calls
   * getUnpinnedLeaf for a plain open) and only then call openFile; by then the active leaf is often a fresh
   * temporary tab, so the source lane has to be read here.
   */
  private patchGetLeaf() {
    const ws = this.app.workspace;
    const record = (name: "getLeaf" | "getUnpinnedLeaf") => (next: AnyFn) =>
      function (this: unknown, ...args: unknown[]) {
        const from = plugin.inputLane(ws.activeLeaf);
        const leaf = next.apply(this, args) as WorkspaceLeaf | null;
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
  private patchDuplicateLeaf() {
    const plugin = this;
    this.register(
      around(loose(this.app.workspace), {
        duplicateLeaf: next =>
          async function (this: unknown, leaf: WorkspaceLeaf, mode?: unknown, dir?: unknown) {
            if (leaf?.view instanceof LaneView) {
              const d = mode === "horizontal" || dir === "horizontal" ? "down" : "right";
              return (await plugin.newLaneAt(leaf.view, d))?.leaf;
            }
            return next.call(this, leaf, mode, dir);
          },
      }),
    );
  }

  /** Splitting a hosted note (Split down, linked views…) splits its lane instead of the private split. */
  private patchCreateLeafBySplit() {
    const plugin = this;
    this.register(
      around(this.app.workspace, {
        createLeafBySplit: (next: AnyFn) =>
          function (this: unknown, leaf: WorkspaceLeaf, ...rest: unknown[]) {
            const host = leaf ? plugin.hostedLeaves.get(leaf) : undefined;
            return next.call(this, host ? host.lane.leaf : leaf, ...rest);
          },
      }),
    );
  }

  /**
   * Collapsing the right sidebar makes Obsidian move focus off any active leaf whose root is the sidebar,
   * which hosted leaves report. `setLayout` replaces rightSplit, so this is re-applied on layout changes.
   */
  private wrapRightSplitCollapse() {
    const ws = this.app.workspace;
    const rs = ws.rightSplit as WorkspaceSplit & { __laneCollapse?: boolean };
    if (!rs || rs.__laneCollapse || typeof rs.collapse !== "function") return;
    rs.__laneCollapse = true;
    const plugin = this;
    const uninstall = around(rs, {
      collapse: next =>
        function (this: unknown, ...args: unknown[]) {
          const a = ws.activeLeaf as (WorkspaceLeaf & { getRoot: () => unknown }) | null;
          if (!a || !plugin.hostedLeaves.has(a)) return next.apply(this, args);
          a.getRoot = () => ws.rootSplit; // only for this synchronous call
          try {
            return next.apply(this, args);
          } finally {
            delete (a as Partial<typeof a>).getRoot;
          }
        },
    });
    this.register(() => {
      uninstall();
      delete rs.__laneCollapse;
    });
  }

  private freshIntent(leaf: WorkspaceLeaf): Intent | null {
    const i = this.intents.get(leaf);
    return i && Date.now() - i.at < INTENT_MS ? i : null;
  }

  /** The lane of `leaf`, if the user's last mouse / key input was inside that lane (a link followed there). */
  private inputLane(leaf: WorkspaceLeaf | null): LaneView | null {
    const lane = this.laneOfLeaf(leaf);
    const t = this.lastInput;
    return lane && t && lane.containerEl.contains(t) ? lane : null;
  }

  private shouldRoute(leaf: WorkspaceLeaf, file: unknown): boolean {
    if (!(file instanceof TFile) || file.extension !== "md") return false;
    const host = this.hostedLeaves.get(leaf);
    if (host) return host.item.file !== file; // never replace a card's note in place
    if (!this.settings.lanesOnly || leaf.view instanceof LaneView) return false;
    const ws = this.app.workspace as any;
    const root = leaf.getRoot();
    if (root === ws.rootSplit) return true;
    if (root !== ws.floatingSplit) return false;
    // a popout window: only a link followed in a lane there (not "Open in new window")
    const intent = this.freshIntent(leaf);
    return !!intent?.from && intent.paneType !== "window";
  }

  /** Where a routed open lands: the next lane after the one it came from, else the lane used last. */
  private async route(leaf: WorkspaceLeaf, file: TFile, openState?: any) {
    const intent = this.freshIntent(leaf);
    this.intents.delete(leaf);
    this.routing.add(leaf);
    try {
      await this.routeInner(leaf, file, openState, intent);
    } finally {
      this.routing.delete(leaf);
    }
  }

  private async routeInner(leaf: WorkspaceLeaf, file: TFile, openState: any, intent: Intent | null) {
    const ws = this.app.workspace;
    const host = this.hostedLeaves.get(leaf);
    const from = host ? host.lane : intent ? intent.from : this.inputLane(ws.activeLeaf);
    const p = intent?.paneType;
    const wantNew = !host && (p === "tab" || p === true || p === "split");
    // like WorkspaceLeaf.openFile: `active` defaults to whether the picked leaf is the active one
    const opts: AddOpts = {
      focus: openState?.active ?? leaf === ws.activeLeaf,
      eState: openState?.eState,
      mode: openState?.state?.mode,
    };
    if (!this.lanes().length) {
      // first note with no lanes yet: an empty tab becomes the first lane, otherwise a lane opens beside it
      const lane = leaf.view.getViewType() === "empty" ? await this.setLane(leaf) : await this.newLane(null);
      await lane?.add(file, opts);
      return;
    }
    await this.openInLane(file, wantNew ? "new" : from ? "next" : "last", from, opts);
    // the tab Obsidian picked for this open is now unused: drop it if it's empty and not the last one
    if (leaf.view.getViewType() === "empty" && ws.getLeavesOfType("empty").length + this.lanes().length > 1) {
      leaf.detach();
    }
  }

  // ---------- lanes ----------

  allLaneViews(): LaneView[] {
    return this.app.workspace
      .getLeavesOfType(VIEW_TYPE)
      .map(l => l.view)
      .filter((v): v is LaneView => v instanceof LaneView);
  }

  /**
   * Lanes in the main area, then popout windows, in layout-tree order (left to right). getLeavesOfType walks
   * the tree depth-first; on-screen position would be wrong for lanes in hidden tabs or other windows.
   */
  lanes(): LaneView[] {
    const ws = this.app.workspace as any;
    return this.allLaneViews().filter(v => {
      const r = v.leaf.getRoot();
      return r === ws.rootSplit || r === ws.floatingSplit;
    });
  }

  laneOfLeaf(leaf: WorkspaceLeaf | null): LaneView | null {
    if (!leaf) return null;
    if (leaf.view instanceof LaneView) return leaf.view;
    return this.hostedLeaves.get(leaf)?.lane ?? null;
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
  /** A new, empty lane beside `lane`: left / right (side by side) or up / down (stacked). */
  async newLaneAt(lane: LaneView, dir: LaneDir): Promise<LaneView | null> {
    const ws = this.app.workspace as any;
    const direction = dir === "left" || dir === "right" ? "vertical" : "horizontal";
    const leaf: WorkspaceLeaf = ws.createLeafBySplit(lane.leaf, direction, dir === "left" || dir === "up");
    const created = await this.setLane(leaf);
    if (created) this.lastLane = created;
    return created;
  }

  async newLane(after: LaneView | null): Promise<LaneView | null> {
    const ws = this.app.workspace as any;
    const lanes = this.lanes();
    const anchor: WorkspaceLeaf | null = after?.leaf ?? lanes[lanes.length - 1]?.leaf ?? ws.getMostRecentLeaf();
    const root = anchor?.getRoot();
    let leaf: WorkspaceLeaf;
    if (anchor && (root === ws.rootSplit || root === ws.floatingSplit)) leaf = ws.createLeafBySplit(anchor, "vertical");
    else leaf = ws.getLeaf("split", "vertical");
    const lane = await this.setLane(leaf);
    if (lane) this.lastLane = lane;
    return lane;
  }

  async openInLane(file: TFile, where: Where, from: LaneView | null = null, opts: AddOpts = {}) {
    let lane: LaneView | null = null;
    if (where === "next" && from) {
      const win = from.leaf.getContainer();
      const lanes = this.lanes().filter(l => l.leaf.getContainer() === win); // same window
      const i = lanes.indexOf(from);
      lane = i >= 0 ? (lanes[i + 1] ?? null) : null;
      if (!lane) lane = await this.newLane(from);
    } else if (where === "new") {
      lane = await this.newLane(null);
    } else {
      lane = this.targetLane() ?? (await this.newLane(null));
    }
    if (!lane) return;
    if (opts.focus !== false) await this.app.workspace.revealLeaf(lane.leaf); // not for background opens
    await lane.add(file, opts);
  }

  notePointerIn(lane: LaneView) {
    this.lastLane = lane;
  }

  // ---------- moving notes between lanes ----------

  /** Move a card to `to` at `index` (counted without the card). Across lanes its editor reopens there. */
  async moveItem(from: LaneView, it: Item, to: LaneView, index: number) {
    if (!from.items.includes(it)) return;
    if (from === to) {
      from.placeAt(it, index);
      return;
    }
    await to.insertTaken(from.take(it), index);
  }

  /** Move a card to the lane before / after its own (same window); past the last one, a new lane. */
  async moveToLane(from: LaneView, it: Item, step: 1 | -1) {
    const win = from.leaf.getContainer();
    const lanes = this.lanes().filter(l => l.leaf.getContainer() === win);
    let to: LaneView | null = lanes[lanes.indexOf(from) + step] ?? null;
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
  private sourcePathOf(el: HTMLElement): string {
    const card = el.closest("[data-bfv-path]");
    if (card) return card.getAttribute("data-bfv-path") ?? "";
    let path = "";
    this.app.workspace.iterateAllLeaves(leaf => {
      if (!path && leaf.view.containerEl.contains(el)) path = (leaf.view as any).file?.path ?? "";
    });
    return path;
  }

  private onMouseDown(e: MouseEvent) {
    this.lastInput = e.target as Node | null;
    if (!e.shiftKey || e.button !== 0 || e.ctrlKey || e.metaKey) return;
    const el = asEl(e.target);
    if (!el) return;
    if (el.closest(".nav-files-container")) return; // file explorer: Shift-click is multi-select

    let link: string | null = null;
    const a = el.closest("a.internal-link, .internal-link[data-href]") as HTMLElement | null;
    if (a) {
      link = a.getAttribute("data-href") ?? a.getAttribute("href");
    } else if (el.closest(".cm-editor")) {
      // Live Preview: ask the editor what's under the mouse. Source mode keeps Shift-click = extend selection.
      this.app.workspace.iterateAllLeaves(leaf => {
        if (link !== null || !leaf.view.containerEl.contains(el)) return;
        const view = leaf.view as any;
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
          /* internal API changed: fall through to Obsidian's default */
        }
      });
    }
    if (!link) return;
    const dest = this.app.metadataCache.getFirstLinkpathDest(getLinkpath(link), this.sourcePathOf(el));
    if (!(dest instanceof TFile) || dest.extension !== "md") return; // unresolved or not a note: default behaviour

    e.preventDefault();
    e.stopImmediatePropagation();
    this.swallow = { until: Date.now() + SWALLOW_MS, el };
    void this.openInLane(dest, e.altKey ? "new" : "last");
  }
}
