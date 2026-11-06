import {
  Component,
  MarkdownEditMode,
  MarkdownView,
  Menu,
  Notice,
  OpenViewState,
  PaneType,
  Platform,
  Plugin,
  PreviewRenderer,
  Scope,
  TAbstractFile,
  TFile,
  WorkspaceContainer,
  WorkspaceItem,
  WorkspaceLeaf,
  WorkspaceParent,
  WorkspaceTabs,
  debounce,
  getLinkpath,
} from "obsidian";
import { EditorView } from "@codemirror/view";
import { matchBand, scrollCardBand } from "./card-scroll";
import { around } from "monkey-around";
import { DEFAULTS, Settings, loadSettings } from "./config";
import { asEl } from "./dom";
import { Matcher, compileExceptions } from "./exceptions";
import { Lane } from "./lane";
import { LanesView, LegacyLaneView, OldNavigatorView } from "./lanes-view";
import { wrapStep } from "./layout";
import { NotePicker } from "./note-picker";
import { LanesSettingTab, Refresh } from "./settings";
import { pickTabName } from "./tab-names";
import { savedTabName } from "./tab-state";
import { insertIndex } from "./tidy";
import {
  AddOpts,
  INTENT_MS,
  Intent,
  Item,
  LEGACY_VIEW_TYPE,
  OLD_NAV_VIEW_TYPE,
  SWALLOW_MS,
  VIEW_TYPE,
  Where,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
/** For around() on methods whose (overloaded) public types don't fit a wrapper that also returns null. */
const loose = (o: object) => o as unknown as Record<string, AnyFn>;

/*
 * Editor Lanes: Logseq-style editor lanes. A lane is a column holding a scrollable stack of notes (newest on
 * top by default), each a real Obsidian editor (Live Preview / Source / Reading, hotkeys, [[ suggest…), collapsible,
 * pinnable and closable.
 *
 * Lanes tabs (lanes-view.ts). All lanes live in ordinary Obsidian tabs of one view type, "editor-lanes": each
 * lanes tab (LanesView) lays out its lanes itself as DOM columns / stacked rows from a layout definition
 * (layout.ts, e.g. "40, 30x2, 30"), and each lane is a Lane object (lane.ts) inside it, not a leaf. Every new
 * lanes tab, in any window, starts with the default layout from the settings and follows it while it has none
 * of its own; a tab's own layout is set in its "Lane layout…" dialog (layout-modal.ts; ⋯ menu, tab-header menu,
 * a lane's menu, a command) and saved in its view state with its lanes' notes and any dragged sizes. When a
 * layout shrinks, the notes of lanes that go move into the remaining ones (layout.ts planRelayout /
 * planRemove: nothing is lost, pins kept on top); growing adds empty lanes. Since lanes tabs are ordinary tabs,
 * Obsidian's tab bar, Ctrl+T, splitting, dragging, popping out, closing and "Undo close tab" (which brings a
 * whole tab back with its notes) work as usual. "Split right / down" or "Open in new window" on a lanes tab (or a
 * card in one) gives an empty lanes tab with the same layout and lane sizes, no notes (emptyCopyOf). Other views
 * (canvas, PDF, graph, Bases…) open as ordinary tabs next to lanes tabs.
 *
 * Tab names: every lanes tab is titled "Editor lane <name>", <name> a random short fictional name from
 * tab-names.ts (Shakespeare, myth, fairy tales, classic novels; all public domain) that no other lanes tab in
 * any window has (loaded tabs are asked directly, tabs not loaded yet through their saved state); with all of
 * them taken, " II", " III"… is appended. The name is saved in the tab's view state, so restarts, Workspaces
 * and "Undo close tab" keep it; numbered tabs saved before names and the empty copies from Split / new window get a new one.
 * "Rename lanes tab…" (⋯ menu, tab-header menu, mobile tab switcher, command; tab-name-modal.ts) sets a custom
 * name or a new random one.
 *
 Lanes only ever come from a layout (the default in the settings, or a tab's "Lane layout…" dialog): there are
 * no buttons or commands to add or remove single lanes, and lanes have no header or number. Only sizes change:
 * the dividers between lanes can be dragged (double-click resets). Dragged sizes are saved in the tab's view
 * state (workspace.json, Workspaces); they apply only to the layout they were made for, so changing the tab's
 * layout starts from its own widths again.
 *
 * "Lanes only" (setting, on by default): every note opened in a main area (any window) goes into a lane
 * instead of a tab; an empty main-area tab (Ctrl+T, "+", the last tab closed) becomes a lanes tab, and note tabs
 * that appear without going through openFile (a Workspaces load, another plugin) are swept into lanes. Exceptions
 * ("Exceptions to lanes only") open as normal tabs. Where a note goes:
 * - a link followed in a lane: "Link clicked in a lane opens in" (the next lane of that tab, in layout order:
 *   columns left to right, top to bottom within a column, wrapping from the last lane to the first; or the same
 *   lane; or the last-used lane);
 * - a "new tab" open (Ctrl/Cmd-click, middle-click, Open in new tab / window, Split, Shift+Alt-click, "Open in
 *   new lanes tab"): a new lanes tab (the empty tab Obsidian made for it becomes one), the note in its first lane;
 * - anything else (explorer, quick switcher, search, Shift-click): the last-used lane of the active lanes tab,
 *   else of the most recently active lanes tab in the active window, else a new lanes tab there.
 * Where an open came from is recorded when it starts: `workspace.getLeaf` / `getUnpinnedLeaf` are wrapped to note
 * the pane type and the lane that last received input at call time.
 *
 * How the editors are hosted: every note card gets a real WorkspaceLeaf inside a private WorkspaceSplit. The
 * split is not a child of any workspace split, but its `parent` points at the right sidebar, so Obsidian sees the
 * leaves as attached (they can be the active leaf, so editor commands and hotkeys act on them) while never
 * treating them as main-area tabs. A patched `workspace.iterateLeaves` makes them visible to `iterateAllLeaves` /
 * `getLeavesOfType`, which is how other plugins (Backlinks Full View) find them; `data-bfv-skip` on a lanes tab
 * opts its notes out of BFV's panes. Per hosted leaf: it stays pinned (so a link followed inside one goes through
 * the normal "open" path, where routing picks it up) and unpinning it (Ctrl+W) closes the card; `getContainer`
 * answers with the tab's window; `setEphemeralState({rename})` edits the card title. Notes mount when expanded
 * and scrolled near view, and unmount when collapsed. Workspace patches for cards: createLeafBySplit splits the
 * card's lanes tab instead of its private split, duplicateLeaf gives the empty lanes tab above, moveLeafToPopout
 * moves the card into a new window's lanes tab, and rightSplit.collapse doesn't steal focus from an active card.
 * Checked against Obsidian 1.15.0's app.js and app.css. The private split comes from hosting.ts (createHostSplit).
 *
 * Native editor features in cards. A card's editor has its content's height, so its own scroller never scrolls;
 * the lane list does. CodeMirror scrolls every scrolling ancestor itself (caret, editing-mode search, #heading
 * links, Outline), with the card header and an open search bar as scroll margins. What Obsidian does by setting
 * scrollTop on the note's scroller is patched for cards (patchCardScrolling, card-scroll.ts): Reading view's
 * scroll to a line / heading and its in-note search's next / previous match, and editing mode's eState
 * `scroll`. A card's MarkdownView.scroll stays null (it would be re-applied on every resize). In-note search
 * is per card: each note view has its own bar (sticky under the card header, styles.css), and the editing-mode
 * search's key scope follows the focused card (searchKeysFollowFocus). Suggest popups are repositioned when a
 * lane scrolls; back / forward to another note opens it in the lane instead of in place (lane.ts).
 *
 * Mobile (phones and tablets; manifest isDesktopOnly false). Obsidian mobile runs the same app.js: rightSplit
 * is a MobileDrawer (`mobile-drawer`, leaves as direct children) instead of a sidedock, but the card trick holds:
 * isAttached / getRoot / iterateLeaves see the drawer like the sidebar, and collapsing the drawer drops an
 * active leaf rooted there just like collapsing the sidebar (onCollapse), which the collapse wrapper covers.
 * Mobile-only adaptations:
 * - updateMobileVisibleTabGroup marks the active leaf's parents `mod-visible`, and on phones CSS hides every
 *   main-area split / tab group without it. With a card active that chain is private split → drawer, so the
 *   lanes tab's own tab group would vanish: the patch re-marks the card's lanes tab chain; the private split
 *   carries mod-visible itself (it's outside the tree the method walks).
 * - focusLeaf closes the drawers only for leaves rooted in rootSplit: for a card it closes them too, so a note
 *   tapped in the file explorer drawer comes to the front.
 * - revealLeaf on a card would open the right drawer (or expand the right sidebar): it reveals the card's
 *   lanes tab instead.
 * - No popout windows: "Move to new window" on a card and a "window" duplicate fall back to a new tab.
 * - Phones (body.is-phone) show one lane at a time (lanes-view.ts): a horizontal scroll-snap row with a lane
 *   switcher; whatever opens a note in a lane, or moves one there, switches to it; swiping makes the lane shown
 *   the current one. Tablets keep the desktop layout. Phone-specific Obsidian CSS that reaches into hosted cards
 *   (view top spacing, fade masks) is undone in styles.css.
 * - Touch: long-press = contextmenu (Obsidian synthesises it on iOS, Android fires it), so card and lane menus
 *   work; a long-press on a card header starts Obsidian's touch drag (drop on a lane to move the card) and, if
 *   released without moving, opens the card menu (Move up / down / to next / previous lane, Rename note, Pin…).
 *   Shift-click has no touch equivalent: "Open in editor lane" is in the file menu, which Obsidian also shows
 *   for a long-pressed link (link-context-menu). Card titles are only editable after "Rename note". Dividers
 *   take pointer drags (data-ignore-swipe keeps the drawers from opening). Bigger hit areas in styles.css.
 * - Keyboard: an editor extension adds the card header's height to CodeMirror's scroll margins (the sticky
 *   header never covers the caret line; desktop too), and when the soft keyboard opens the caret of the
 *   focused card is scrolled into view.
 * No Node or Electron APIs are used; activeWindow (defined on mobile too) is the only window global.
 *
 * Old layouts (one "editor-lane" leaf per lane) aren't converted: their leaves are closed on load, and a window
 * left without a lanes tab gets a new one with the default layout in place of its first old lane (closeLegacy).
 * An unreleased build had a "Navigator" tab (Files, Search, Bookmarks in the main area), removed again: a saved
 * one is closed on load by a stub view (OldNavigatorView, closeOldNavigator), which puts those views back in the
 * left sidebar if they're missing.
 */

export default class EditorLanesPlugin extends Plugin {
  override settings: Settings = { ...DEFAULTS };
  /** "Exceptions to lanes only", compiled from the setting. */
  private isException: Matcher = () => false;
  /** Every private split / hosted leaf, for the iterateLeaves patch and for not routing our own opens. */
  splits = new Set<any>();
  hostedLeaves = new Map<WorkspaceLeaf, { lane: Lane; item: Item }>();
  private _lastLane: Lane | null = null;
  /** Lanes tabs, most recently active first. */
  private recent: LanesView[] = [];
  /** The note card being dragged by its header, if any. */
  dragItem: { lane: Lane; item: Item } | null = null;
  private swallow: { until: number; el: HTMLElement } | null = null;
  private routing = new Set<WorkspaceLeaf>(); // leaves whose open is being routed right now (the sweep skips them)
  private intents = new WeakMap<WorkspaceLeaf, Intent>();
  private seen = new WeakSet<WorkspaceLeaf>(); // main-area leaves the sweep has already looked at
  private sweeping = false;
  private lastInput: Node | null = null; // target of the last mousedown / keydown in any window
  private windowDocs = new WeakSet<Document>();
  /** Per popout window: its document listeners, unloaded when the window closes (so its DOM can be freed). */
  private windowParts = new Map<Document, Component>();
  private unloaded = false;
  private sweepRetry = 0;
  private requestSweep = debounce(() => void this.sweepMainArea(false), 250, true);
  requestLegacyCleanup = debounce(() => void this.closeLegacy().then(() => this.closeOldNavigator()), 100, true);
  private noticeAt = 0;

  /** The lane used last, in any tab (setting it also makes it its tab's last-used lane and that tab the most recent). */
  get lastLane(): Lane | null {
    return this._lastLane;
  }
  set lastLane(lane: Lane | null) {
    this._lastLane = lane;
    if (!lane) return;
    lane.tab.lastLane = lane;
    this.touchTab(lane.tab);
  }

  override async onload() {
    // loadSettings: old keys migrated, then laid over the defaults, dropping values of the wrong type or range
    this.settings = loadSettings(await this.loadData());
    this.isException = compileExceptions(this.settings.routeExceptions);
    this.addSettingTab(new LanesSettingTab(this.app, this));
    this.registerView(VIEW_TYPE, leaf => new LanesView(leaf, this));
    this.registerView(LEGACY_VIEW_TYPE, leaf => new LegacyLaneView(leaf, this));
    this.registerView(OLD_NAV_VIEW_TYPE, leaf => new OldNavigatorView(leaf, this));
    this.patchIterateLeaves();
    this.patchOpenFile();
    this.patchGetLeaf();
    this.patchActiveView();
    this.patchCreateLeafBySplit();
    this.patchDuplicateLeaf();
    this.patchMoveToPopout();
    this.patchRevealLeaf();
    this.patchMobileVisibility();
    this.patchMobileFocus();
    this.setupCaretVisibility();

    this.addRibbonIcon("columns-3", "New lanes tab", () => void this.newLanesTab());
    this.addCommand({ id: "new-lane", name: "New lanes tab", callback: () => void this.newLanesTab() });
    this.addCommand({
      id: "change-layout",
      name: "Change lane layout of this tab…",
      checkCallback: checking => {
        const tab = this.currentTab();
        if (!tab) return false;
        if (!checking) tab.openLayoutDialog();
        return true;
      },
    });
    this.addCommand({
      id: "rename-tab",
      name: "Rename lanes tab…",
      checkCallback: checking => {
        const tab = this.currentTab();
        if (!tab) return false;
        if (!checking) tab.openRenameDialog();
        return true;
      },
    });
    this.addCommand({
      id: "open-current",
      name: "Open current note in an editor lane",
      checkCallback: checking => this.withActiveFile(checking, f => this.openInLane(f, "last")),
    });
    this.addCommand({
      id: "open-current-new-lane",
      name: "Open current note in a new lanes tab",
      checkCallback: checking => this.withActiveFile(checking, f => this.openInLane(f, "newTab")),
    });
    this.addCommand({
      id: "open-note",
      name: "Open note in an editor lane…",
      callback: () => new NotePicker(this).open(),
    });
    this.addCommand({
      id: "close-all",
      name: "Close all notes in the current editor lane",
      callback: () => this.currentLane()?.closeAll(),
    });
    this.addCommand({
      id: "collapse-all",
      name: "Collapse all notes in the current editor lane",
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
        await this.settingsChanged("routing");
      },
    });

    // right-click on a file (explorer, tab, link, search result…); on mobile a long-press, including on a link
    // in a note (Obsidian's link-context-menu triggers file-menu): the touch way to do what Shift-click does
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
            .setTitle("Open in new lanes tab")
            .setIcon("columns-3")
            .setSection("open")
            .onClick(() => void this.openInLane(file, "newTab")),
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
    this.registerEvent(
      this.app.workspace.on("window-close", (_w, win) => {
        const part = this.windowParts.get(win.document);
        if (!part) return;
        this.windowParts.delete(win.document);
        this.windowDocs.delete(win.document);
        this.removeChild(part);
      }),
    );
    // the most recently active lanes tab is where opens from outside any lanes tab go
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", leaf => {
        const tab = this.tabOf(leaf);
        if (tab) this.touchTab(tab);
        this.activeCardFor(leaf);
        // phones: a card that becomes active (a command, a jump) is scrolled into view with its lane
        const host = leaf ? this.hostedLeaves.get(leaf) : undefined;
        if (host) host.lane.tab.showLane(host.lane);
      }),
    );

    // Lanes only: tabs that appear without going through openFile (restored layout, Workspaces load, Ctrl+T)
    // are swept into lanes tabs: all of them on startup and when the setting is turned on, afterwards only tabs
    // that are new since the last sweep. Old one-lane-per-tab leaves are closed whenever a layout brings them in.
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.wrapRightSplitCollapse();
        this.requestSweep();
        const ws = this.app.workspace;
        if (ws.getLeavesOfType(LEGACY_VIEW_TYPE).length || ws.getLeavesOfType(OLD_NAV_VIEW_TYPE).length) {
          this.requestLegacyCleanup();
        }
        // a note's view mode changed by command / hotkey (Ctrl+E, "Toggle source mode"): its button and saved mode
        for (const tab of this.allTabs()) for (const lane of tab.lanes) lane.syncViews();
      }),
    );
    this.app.workspace.onLayoutReady(async () => {
      this.wrapRightSplitCollapse();
      for (const w of this.popouts()) if (w.doc) this.registerWindow(w.doc);
      await this.closeLegacy();
      await this.closeOldNavigator();
      void this.sweepMainArea(true);
    });
  }

  override onunload() {
    this.unloaded = true;
    window.clearTimeout(this.sweepRetry);
    this.requestSweep.cancel();
    this.requestLegacyCleanup.cancel();
    for (const tab of this.allTabs()) tab.teardown();
  }

  // ---------- settings ----------

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /** Save, then redo whatever the changed setting affects, without a reload. */
  async settingsChanged(refresh: Refresh) {
    await this.saveSettings();
    if (refresh === "routing") {
      this.isException = compileExceptions(this.settings.routeExceptions);
      if (this.settings.lanesOnly) void this.sweepMainArea(true);
    }
    // looks, and the default layout of every tab that hasn't got its own
    for (const tab of this.allTabs()) tab.applySettings();
    // Backlinks Full View re-checks its views on layout-change: the ones it skipped (or now must skip) in lanes
    if (refresh === "backlinks") this.app.workspace.trigger("layout-change");
  }

  /** "Reset every tab to the default" (settings): drop every open tab's own layout. */
  async resetAllLayouts() {
    for (const tab of this.allTabs()) if (tab.layoutInfo().own) await tab.setLayout(null);
  }

  /** A note at this path keeps opening in normal tabs ("Exceptions to lanes only"). */
  isExcepted(file: TFile): boolean {
    return this.isException(file.path);
  }

  /** At most one Notice a second. */
  private refuse(msg: string) {
    const now = Date.now();
    if (now - this.noticeAt < 1000) return;
    this.noticeAt = now;
    new Notice(msg);
  }

  private registerWindow(doc: Document) {
    if (this.windowDocs.has(doc)) return;
    this.windowDocs.add(doc);
    // the main window's listeners live as long as the plugin; a popout's go when it closes
    const owner: Component = doc === document ? this : this.addChild(new Component());
    if (owner !== this) this.windowParts.set(doc, owner);
    // Shift-click a link: capture phase, so we act before Obsidian or CodeMirror (which would extend the selection)
    owner.registerDomEvent(doc, "mousedown", e => this.onMouseDown(e), { capture: true });
    // touch: a tap's emulated mousedown can be skipped (a scroll, a long-press), pointerdown always comes
    owner.registerDomEvent(
      doc,
      "pointerdown",
      e => {
        this.lastInput = e.target as Node | null;
      },
      { capture: true },
    );
    owner.registerDomEvent(
      doc,
      "keydown",
      e => {
        this.lastInput = e.target as Node | null;
      },
      { capture: true },
    );
    owner.registerDomEvent(
      doc,
      "focusin",
      e => {
        this.activeFollowsFocus(e);
        this.searchKeysFollowFocus(e);
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
    owner.registerDomEvent(doc, "mouseup", swallow, { capture: true });
    owner.registerDomEvent(doc, "click", swallow, { capture: true });
  }

  /**
   * Lanes only, in every window: each empty main-area tab becomes a lanes tab; each Markdown tab moves into the
   * most recently active lanes tab of its window (its last-used lane; keeping tab order, first tab on top, and
   * its mode, scroll / cursor and history) and closes, or, in a window with no lanes tab, becomes one holding it.
   * Pinned and linked tabs stay, as do exceptions and other tabs (canvas, PDF, graph, Bases…). `all`: look at
   * every tab, not just those new since the last sweep.
   */
  async sweepMainArea(all: boolean) {
    if (!this.settings.lanesOnly || this.sweeping) return;
    this.sweeping = true;
    let retry = false;
    try {
      const ws = this.app.workspace;
      const tabs: { leaf: WorkspaceLeaf; file: TFile; opts: AddOpts }[] = [];
      const empties: WorkspaceLeaf[] = [];
      for (const root of this.windowRoots()) {
        ws.iterateLeaves(root, (leaf: WorkspaceLeaf) => {
          if (this.hostedLeaves.has(leaf) || leaf.view instanceof LanesView) return;
          const vs = leaf.getViewState(); // also right for deferred (not yet loaded) background tabs
          if (vs.type === VIEW_TYPE || vs.type === LEGACY_VIEW_TYPE) return;
          if (this.routing.has(leaf) || this.freshIntent(leaf)) {
            retry = true; // about to be routed
            return;
          }
          if (!all && this.seen.has(leaf)) return;
          this.seen.add(leaf);
          if (vs.pinned || leaf.group) return;
          if (vs.type === "markdown") {
            const f = this.app.vault.getAbstractFileByPath(String((vs.state as any)?.file ?? ""));
            if (!(f instanceof TFile) || this.isExcepted(f)) return;
            tabs.push({ leaf, file: f, opts: this.tabState(leaf) });
          } else if (vs.type === "empty") {
            empties.push(leaf);
          }
        });
      }
      for (const leaf of empties) if (leaf.parent) await this.newTab(leaf, undefined, false);
      for (const { leaf, file, opts } of tabs.reverse()) {
        const tab = this.recentTabIn(leaf.getContainer());
        if (!tab) {
          await (await this.newTab(leaf, undefined, false))?.lanes[0]?.add(file, opts);
          continue;
        }
        await tab.currentLane()?.add(file, opts);
        this.detachQuietly(leaf);
      }
    } catch (e) {
      console.error("[editor-lanes] could not move tabs into lanes", e);
    } finally {
      this.sweeping = false;
    }
    if (retry && !this.unloaded) {
      window.clearTimeout(this.sweepRetry);
      this.sweepRetry = window.setTimeout(() => {
        if (!this.unloaded) this.requestSweep();
      }, INTENT_MS);
    }
  }

  /** A tab's mode, scroll / cursor and history, for reopening its note in a lane. */
  private tabState(leaf: WorkspaceLeaf): AddOpts {
    const vs = leaf.getViewState();
    const opts: AddOpts = { mode: (vs.state as any)?.mode };
    try {
      opts.eState = leaf.getEphemeralState();
    } catch {
      /* deferred view */
    }
    try {
      opts.history = leaf.history?.serialize?.();
    } catch {
      /* internal API changed */
    }
    return opts;
  }

  /**
   * Old layouts (one "editor-lane" leaf per lane, in any window) aren't converted: their leaves are closed
   * without "Undo close tab" entries, and a window left without a lanes tab gets one with the default layout in
   * place of its first old lane. getLeavesOfType also finds old lanes in background tabs (deferred views
   * report their saved type).
   */
  async closeLegacy() {
    const ws = this.app.workspace;
    if (!ws.layoutReady) return;
    const legacy = ws.getLeavesOfType(LEGACY_VIEW_TYPE);
    if (!legacy.length) return;
    const byWindow = new Map<WorkspaceContainer, WorkspaceLeaf[]>();
    for (const leaf of legacy) {
      if (!this.inMainArea(leaf)) {
        this.detachQuietly(leaf);
        continue;
      }
      const win = leaf.getContainer();
      byWindow.set(win, [...(byWindow.get(win) ?? []), leaf]);
    }
    let replaced = false;
    for (const [win, leaves] of byWindow) {
      let rest = leaves;
      const hasTab = ws.getLeavesOfType(VIEW_TYPE).some(l => this.inMainArea(l) && l.getContainer() === win);
      if (!hasTab) {
        try {
          await leaves[0].setViewState({ type: VIEW_TYPE });
          rest = leaves.slice(1);
          replaced = true;
        } catch (e) {
          console.error("[editor-lanes] could not open a lanes tab in place of an old lane", e);
        }
      }
      for (const leaf of rest) this.detachQuietly(leaf);
    }
    new Notice(
      replaced
        ? "Editor Lanes now keeps all lanes in one tab: the old lanes were closed and a new lanes tab opened."
        : "Editor Lanes now keeps all lanes in one tab: the old lanes were closed.",
    );
  }

  /**
   * The removed Navigator tab (OLD_NAV_VIEW_TYPE): close any left in the layout (no "Undo close tab" entries),
   * then make sure the File explorer, Search and Bookmarks views are in the left sidebar again. Obsidian's core
   * plugins do that themselves on layout-ready (their initLeaf: workspace.ensureSideLeaf(type, "left",
   * {reveal: false}), which only makes a leaf when none of that type exists); this covers the plugin being
   * enabled or updated after startup. A disabled core plugin gets no view.
   */
  async closeOldNavigator() {
    const ws = this.app.workspace;
    if (!ws.layoutReady) return;
    const old = ws.getLeavesOfType(OLD_NAV_VIEW_TYPE);
    if (!old.length) return;
    for (const leaf of old) this.detachQuietly(leaf);
    const core: [string, string][] = [
      ["file-explorer", "file-explorer"],
      ["global-search", "search"],
      ["bookmarks", "bookmarks"],
    ];
    for (const [id, type] of core) {
      try {
        if (!this.app.internalPlugins?.getEnabledPluginById(id) || ws.getLeavesOfType(type).length) continue;
        await ws.ensureSideLeaf(type, "left", { reveal: false });
      } catch (e) {
        console.error("[editor-lanes] could not put back the", type, "view", e);
      }
    }
  }

  private withHostedItem(checking: boolean, fn: (lane: Lane, it: Item) => unknown): boolean {
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

  /**
   * A note about to open in a main-area leaf goes to a lane instead (lanes only), and nothing ever replaces a
   * card's note or a lanes tab: a note opened into a lanes tab (a file dropped on its tab header, a plugin
   * opening into the active leaf) goes into its current lane; an exception or a non-note file opened from a card
   * or into a lanes tab opens as a tab beside the lanes tab.
   */
  private patchOpenFile() {
    const plugin = this;
    this.register(
      around(WorkspaceLeaf.prototype, {
        openFile: next =>
          async function (this: WorkspaceLeaf, file: TFile, openState?: OpenViewState) {
            const host = plugin.hostedLeaves.get(this);
            const tab = host ? host.lane.tab : this.view instanceof LanesView ? this.view : null;
            if (
              tab &&
              file instanceof TFile &&
              file !== host?.item.file &&
              (file.extension !== "md" || plugin.isExcepted(file))
            ) {
              return plugin.openBeside(tab, file, openState);
            }
            if (!plugin.shouldRoute(this, file)) return next.call(this, file, openState);
            try {
              await plugin.route(this, file, openState);
            } catch (e) {
              console.error("[editor-lanes] routing to a lane failed, opening normally", e);
              if (tab) return; // never in place of a card or a lanes tab
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
  /**
   * With a lanes tab as the active leaf, "the active Markdown view" is its note: the focused card, else the one
   * active last, else the first open one. workspace.activeEditor (and getActiveFile) come from
   * getActiveViewOfType(MarkdownView), and the lanes view itself isn't one, so without this, plugins acting on
   * the active editor fail in a lanes tab: Templater's "No active editor, can't append templates".
   */
  private patchActiveView() {
    const ws = this.app.workspace;
    const plugin = this;
    this.register(
      around(ws, {
        getActiveViewOfType: (next: AnyFn) =>
          function (this: unknown, type: unknown) {
            const r = next.call(this, type);
            if (r || typeof type !== "function") return r;
            const view = ws.activeLeaf?.view;
            if (!(view instanceof LanesView)) return r;
            const card = plugin.cardOfTab(view);
            return card && card.view instanceof (type as new (...a: never[]) => unknown) ? card.view : r;
          },
      }),
    );
  }

  /** The lanes tab's current note: the focused card, else the card active last, else the first open one. */
  cardOfTab(view: LanesView): WorkspaceLeaf | null {
    const mine = [...this.hostedLeaves].filter(([, h]) => h.lane.tab === view);
    const focused = activeDocument.activeElement;
    const inFocus = focused && mine.find(([, h]) => h.item.el.contains(focused));
    if (inFocus) return inFocus[0];
    const last = this.lastCard.get(view);
    if (last && mine.some(([l]) => l === last)) return last;
    return mine.find(([, h]) => !h.item.collapsed)?.[0] ?? null;
  }

  private patchGetLeaf() {
    const ws = this.app.workspace;
    const plugin = this;
    const record = (name: "getLeaf" | "getUnpinnedLeaf") => (next: AnyFn) =>
      function (this: unknown, ...args: unknown[]) {
        const before = ws.activeLeaf;
        const from = plugin.inputLane(before);
        const fromItem = from ? plugin.inputItem(from) : null;
        const leaf = next.apply(this, args) as WorkspaceLeaf | null;
        if (leaf) {
          plugin.intents.set(leaf, {
            from,
            fromItem,
            paneType: name === "getLeaf" ? args[0] : false,
            wasActive: leaf === before,
            at: Date.now(),
          });
        }
        return leaf;
      };
    this.register(around(loose(ws), { getLeaf: record("getLeaf"), getUnpinnedLeaf: record("getUnpinnedLeaf") }));
  }

  /** Splitting a hosted note (Split down, linked views…) splits its lanes tab instead of the private split. */
  private patchCreateLeafBySplit() {
    const plugin = this;
    this.register(
      around(this.app.workspace, {
        createLeafBySplit: (next: AnyFn) =>
          function (this: unknown, leaf: WorkspaceLeaf, ...rest: unknown[]) {
            const host = leaf ? plugin.hostedLeaves.get(leaf) : undefined;
            return next.call(this, host ? host.lane.tab.leaf : leaf, ...rest);
          },
      }),
    );
  }

  /**
   * "Split right / down", "Open in new window" and the like (workspace.duplicateLeaf, from the commands and
   * tab menu) on a lanes tab or a card in one: Obsidian would copy the whole tab, notes and all, so the same
   * notes would have editors in two places. Instead the new pane (split off the lanes tab, or a new tab /
   * window) is an empty lanes tab with the source tab's layout and lane sizes, and no notes.
   */
  private patchDuplicateLeaf() {
    const plugin = this;
    this.register(
      around(loose(this.app.workspace), {
        duplicateLeaf: next =>
          async function (this: unknown, leaf: WorkspaceLeaf, mode?: unknown, dir?: unknown) {
            const tab =
              leaf?.view instanceof LanesView ? leaf.view : leaf ? plugin.hostedLeaves.get(leaf)?.lane.tab : null;
            if (!tab) return next.call(this, leaf, mode, dir);
            return plugin.emptyCopyOf(tab, mode, dir);
          },
      }),
    );
  }

  /** "Move to new window" (tab menu, command) on a card: the card moves into a new window's lanes tab, pin and all. */
  private patchMoveToPopout() {
    const plugin = this;
    this.register(
      around(this.app.workspace, {
        moveLeafToPopout: (next: AnyFn) =>
          function (this: unknown, leaf: WorkspaceLeaf, ...rest: unknown[]) {
            const host = leaf ? plugin.hostedLeaves.get(leaf) : undefined;
            if (!host) return next.call(this, leaf, ...rest);
            void plugin.cardToNewWindow(host.lane, host.item);
            return undefined;
          },
      }),
    );
  }

  /**
   * revealLeaf(card) would see the card's root (the right sidebar / mobile drawer) and expand it. Reveal the
   * card's lanes tab instead, with the card scrolled into view (and its lane, on phones).
   */
  private patchRevealLeaf() {
    const plugin = this;
    this.register(
      around(loose(this.app.workspace), {
        revealLeaf: next =>
          async function (this: unknown, leaf: WorkspaceLeaf, ...rest: unknown[]) {
            const host = leaf ? plugin.hostedLeaves.get(leaf) : undefined;
            if (!host) return next.call(this, leaf, ...rest);
            await next.call(this, host.lane.tab.leaf, ...rest);
            host.lane.tab.showLane(host.lane);
            host.lane.scrollToItem(host.item);
          },
      }),
    );
  }

  /**
   * Mobile: workspace.updateMobileVisibleTabGroup marks the active leaf's parents `mod-visible` and takes the
   * class off every other split / tab group in the main area; on phones those are hidden. A card's parents are
   * its private split and the right drawer, so the lanes tab's own tab group (and splits) would be hidden: mark
   * the lanes tab's chain instead, right after. A no-op on the desktop (the method returns at once there).
   */
  private patchMobileVisibility() {
    const ws = this.app.workspace;
    if (typeof ws.updateMobileVisibleTabGroup !== "function") return;
    const plugin = this;
    this.register(
      around(ws, {
        updateMobileVisibleTabGroup: (next: AnyFn) =>
          function (this: unknown, ...args: unknown[]) {
            const out = next.apply(this, args);
            const tab = plugin.hostedLeaves.get(ws.activeLeaf as WorkspaceLeaf)?.lane.tab;
            if (Platform.isMobile && tab) {
              for (let p: WorkspaceItem | null = tab.leaf.parent; p; p = (p as WorkspaceItem).parent) {
                (p as WorkspaceItem & { containerEl?: HTMLElement }).containerEl?.addClass("mod-visible");
              }
            }
            return out;
          },
      }),
    );
  }

  /**
   * Mobile: focusing a leaf in the main area closes the sidebar drawers (workspace.focusLeaf, for leaves whose
   * root is rootSplit), so a note tapped in the file explorer drawer shows up in front. A card's root is the
   * right drawer, so do the same for cards. collapse() leaves a pinned drawer (tablets) open, as Obsidian does.
   */
  private patchMobileFocus() {
    const ws = this.app.workspace;
    if (typeof ws.focusLeaf !== "function") return;
    const plugin = this;
    this.register(
      around(ws, {
        focusLeaf: (next: AnyFn) =>
          function (this: unknown, leaf: WorkspaceLeaf, ...rest: unknown[]) {
            const out = next.call(this, leaf, ...rest);
            if (Platform.isMobile && leaf && plugin.hostedLeaves.has(leaf)) {
              for (const d of [ws.leftSplit, ws.rightSplit] as unknown as ({
                type?: string;
                collapse?(): void;
              } | null)[]) {
                if (d?.type === "mobile-drawer") d.collapse?.();
              }
            }
            return out;
          },
      }),
    );
  }

  // ---------- native editor features in cards (in-note search, scrolling to a line) ----------

  /** The hosted card whose note view this editing mode / Reading view renderer belongs to. */
  private cardOf(part: MarkdownEditMode | PreviewRenderer): { lane: Lane; item: Item } | undefined {
    for (const [leaf, host] of this.hostedLeaves) {
      const v = leaf.view;
      if (v instanceof MarkdownView && (v.editMode === part || v.previewMode?.renderer === part)) return host;
    }
    return undefined;
  }

  /**
   * A card's note view (after it opens, and after a mode change): see patchCardScrolling. MarkdownView.scroll is
   * the view's own scroll position, re-applied by mode switches, Reading view's onResize (every time the card's
   * height changes) and saved in its ephemeral state. A card has no scroll of its own (the lane list scrolls),
   * so it's kept null: re-applying it would now scroll the lane list to that line at random moments.
   * Explicit requests (a #heading link, Outline, a line, an eState `scroll`) still go through applyScroll.
   */
  adoptCardView(view: unknown) {
    if (!(view instanceof MarkdownView)) return;
    const v = view as MarkdownView & { __laneCard?: boolean };
    if (!v.__laneCard) {
      v.__laneCard = true;
      Object.defineProperty(v, "scroll", { configurable: true, get: () => null, set: () => {} });
    }
    this.patchCardScrolling(v);
  }

  private patchedProtos = new WeakSet<object>();

  /**
   * Scrolling a card to a line or a search match. Obsidian scrolls a note by setting scrollTop on its scroller
   * (.cm-scroller, .markdown-preview-view), which in a card has its content's height and doesn't scroll: the
   * lane list does. CodeMirror's own scrollIntoView already scrolls every scrolling ancestor (app.js: the
   * scrollRectIntoView loop walks parentNode up to the window, skipping elements that can't scroll, honouring
   * EditorView.scrollMargins), so editing-mode search, the caret, #heading / #^block links and Outline in Live
   * Preview / Source work as is. What sets scrollTop is patched, for cards only (the classes aren't exported:
   * their prototypes are taken from the first card's view):
   * - editing mode applyScroll(line) (an eState `scroll`): CodeMirror scrollIntoView(line start, "start");
   * - Reading view renderer applyScroll(line, {center, highlight}) (#heading / #^block links, Outline, a line,
   *   `scroll`, a search result's match): run with previewEl.scrollTop captured, then the lane scrolls there;
   *   `center` is done here (Obsidian's subtracts half of previewEl's height, which is the whole note's);
   * - Reading view renderer selectRange(match) (in-note search in Reading view: next / previous match): it only
   *   scrolls when the match is outside previewEl's own view, which in a card is everything; the lane scrolls
   *   to centre the match when it isn't shown.
   * Embeds, hover previews and canvas cards use the same classes and are left alone (cardOf finds no card).
   */
  private patchCardScrolling(view: MarkdownView) {
    const plugin = this;
    const em = view.editMode;
    const emProto = em ? Object.getPrototypeOf(em) : null;
    if (emProto && typeof emProto.applyScroll === "function" && !this.patchedProtos.has(emProto)) {
      this.patchedProtos.add(emProto);
      this.register(
        around(emProto as MarkdownEditMode, {
          applyScroll: next =>
            function (this: MarkdownEditMode, line: number) {
              if (typeof line !== "number" || isNaN(line) || !plugin.cardOf(this) || !this.cm) {
                return next.call(this, line);
              }
              const doc = this.cm.state.doc;
              const n = Math.min(Math.max(0, Math.floor(line)), doc.lines - 1);
              this.cm.dispatch({ effects: EditorView.scrollIntoView(doc.line(n + 1).from, { y: "start" }) });
            },
        }),
      );
    }
    const r = view.previewMode?.renderer;
    const rProto = r ? Object.getPrototypeOf(r) : null;
    if (
      rProto &&
      typeof rProto.applyScroll === "function" &&
      typeof rProto.selectRange === "function" &&
      !this.patchedProtos.has(rProto)
    ) {
      this.patchedProtos.add(rProto);
      this.register(
        around(rProto as PreviewRenderer, {
          applyScroll: next =>
            function (this: PreviewRenderer, line: number, opts?: { center?: boolean; highlight?: boolean }) {
              const el = this.previewEl;
              if (!el || !plugin.cardOf(this)) return next.call(this, line, opts);
              let top: number | null = null;
              Object.defineProperty(el, "scrollTop", {
                configurable: true,
                get: () => top ?? 0,
                set: (v: number) => {
                  top = v;
                },
              });
              let done: boolean;
              try {
                done = next.call(this, line, opts?.center ? { ...opts, center: false } : opts);
              } finally {
                delete (el as { scrollTop?: number }).scrollTop; // back to the prototype's accessor
              }
              const at = top;
              if (at !== null) {
                scrollCardBand(
                  el,
                  () => {
                    const y = el.getBoundingClientRect().top + at;
                    return { top: y, bottom: y + 24 };
                  },
                  opts?.center ? "center" : "start",
                );
              }
              return done;
            },
          selectRange: next =>
            function (this: PreviewRenderer, match) {
              next.call(this, match);
              if (!this.previewEl || !match?.section?.el || !plugin.cardOf(this)) return;
              scrollCardBand(this.previewEl, () => matchBand(match.section.el, match.start, match.end), "center");
            },
        }),
      );
    }
  }

  /**
   * In-note search per card. Each note view has its own search bar (MarkdownView's editing mode builds one; Reading
   * view one per view), so several cards can have one open at once, each with its own query, matches and
   * replace. Reading view's search keys live in its view's scope, which Obsidian uses for the active leaf only, so
   * they follow the focused card already. Editing mode's push a scope on the window's keymap stack instead, and
   * only the top one gets keys: with two cards searching, Enter / Escape / F3 typed in one would act on the card
   * whose bar opened last. So when focus moves into a card's note, that card's open search scope (if any) goes
   * on top and the other cards' come off (they stay open, and go back on top when focus returns to them). Focus
   * in a card header (the title) takes them all off; focus outside cards leaves the stack alone.
   */
  /**
   * Focus inside a card's note makes that card the active leaf. Cards can get focus without becoming active
   * (one opened into a lane with active: false, a restored layout, keyboard focus moves), and the lanes view
   * then stays active. workspace.activeEditor is null in that case, so commands and plugins that act on the
   * active editor fail: Templater's "Insert template" ("No active editor, can't append templates") and its
   * jump to tp.file.cursor() after creating a note.
   */
  private activeFollowsFocus(e: FocusEvent) {
    // anywhere in the card: its note, and its header (a new note's title is focused for naming it)
    const t = asEl(e.target);
    if (!t?.closest(".lane-item")) return;
    for (const [leaf, host] of this.hostedLeaves) {
      if (!host.item.el.contains(t)) continue;
      if (this.app.workspace.activeLeaf !== leaf) this.app.workspace.setActiveLeaf(leaf, { focus: false });
      return;
    }
  }

  /** Per lanes tab: its card that was active last. */
  private lastCard = new WeakMap<LanesView, WorkspaceLeaf>();

  /**
   * A lanes tab that becomes the active leaf hands that on to its last active card (else its first open one), so
   * workspace.activeEditor is a note whenever a lanes tab with an open note is in front: switching to the tab,
   * a click on a lane header, startup with a lanes tab active. The lanes view itself has no editor, and
   * Templater's "Insert template" then fails with "No active editor".
   */
  private activeCardFor(leaf: WorkspaceLeaf | null) {
    if (!leaf) return;
    const host = this.hostedLeaves.get(leaf);
    if (host) {
      this.lastCard.set(host.lane.tab, leaf);
      return;
    }
    const view = leaf.view;
    if (!(view instanceof LanesView)) return;
    const card = this.cardOfTab(view);
    if (!card) return;
    // after Obsidian's own active-leaf handling for this change has run
    activeWindow.setTimeout(() => {
      if (this.app.workspace.activeLeaf === leaf && this.hostedLeaves.has(card))
        this.app.workspace.setActiveLeaf(card, { focus: false });
    }, 0);
  }

  private searchKeysFollowFocus(e: FocusEvent) {
    const t = asEl(e.target);
    const card = t?.closest<HTMLElement>(".lane-item");
    if (!t || !card) return;
    const into = t.closest(".lane-item-body") ? card : null;
    const km = this.app.keymap;
    let mine: Scope | null = null;
    for (const [leaf, host] of this.hostedLeaves) {
      const em = leaf.view instanceof MarkdownView ? leaf.view.editMode : undefined;
      const scope = em?.search?.isActive ? em.scope : null;
      if (!scope) continue;
      if (host.item.el === into) mine = scope;
      else km.popScope(scope);
    }
    if (mine) {
      km.popScope(mine);
      km.pushScope(mine);
    }
  }

  /** A card's editor is going: its open search's key scope comes off the keymap stack (Obsidian leaves it). */
  dropSearchKeys(leaf: WorkspaceLeaf) {
    const em = leaf.view instanceof MarkdownView ? leaf.view.editMode : undefined;
    if (em?.scope) this.app.keymap.popScope(em.scope);
  }

  /**
   * Cards have a sticky header over their editor: CodeMirror's scroll margins get its height, so scrolling the
   * caret into view (typing, arrow keys, search) never leaves it under the header. Mobile: when the soft
   * keyboard opens (Obsidian's `keyboardWillShow`) or a card's editor gets focus, the caret is scrolled into
   * view once the keyboard has settled (the lane got shorter).
   */
  private setupCaretVisibility() {
    this.registerEditorExtension(
      EditorView.scrollMargins.of(view => {
        const card = view.dom.closest(".lane-item");
        const head = card?.querySelector<HTMLElement>(":scope > .lane-item-header");
        if (!head) return null;
        // the card's open search bar sticks under the header (styles.css): the caret / match must clear it too
        const bar = view.dom.parentElement?.querySelector<HTMLElement>(":scope > .document-search-container");
        return { top: head.offsetHeight + (bar?.offsetHeight ?? 0) + 4 };
      }),
    );
    if (!Platform.isMobile) return;
    let timer = 0;
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => this.keepCaretVisible(), 350);
    };
    window.addEventListener("keyboardWillShow", soon);
    this.register(() => {
      window.removeEventListener("keyboardWillShow", soon);
      window.clearTimeout(timer);
    });
    this.registerDomEvent(document, "focusin", e => {
      if (asEl(e.target)?.closest(".lane-item-body")) soon();
    });
  }

  private keepCaretVisible() {
    const host = this.hostedLeaves.get(this.app.workspace.activeLeaf as WorkspaceLeaf);
    const view = host?.item.leaf?.view;
    if (!(view instanceof MarkdownView) || !view.editor.hasFocus()) return;
    const at = view.editor.getCursor();
    view.editor.scrollIntoView({ from: at, to: at }, false);
  }

  /**
   * Collapsing the right sidebar makes Obsidian move focus off any active leaf whose root is the sidebar,
   * which hosted leaves report. `setLayout` replaces rightSplit, so this is re-applied on layout changes.
   * Mobile: the right drawer's collapse() does the same (MobileDrawer.onCollapse, called synchronously).
   */
  private wrapRightSplitCollapse() {
    const ws = this.app.workspace;
    const rs = ws.rightSplit as typeof ws.rightSplit & { __laneCollapse?: boolean };
    if (!rs || rs.__laneCollapse || typeof rs.collapse !== "function") return;
    rs.__laneCollapse = true;
    const plugin = this;
    const uninstall = around(rs, {
      collapse: (next: AnyFn) =>
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

  // ---------- routing ----------

  private freshIntent(leaf: WorkspaceLeaf): Intent | null {
    const i = this.intents.get(leaf);
    return i && Date.now() - i.at < INTENT_MS ? i : null;
  }

  /** The lane the user's last mouse / key input was in, if it's in `leaf`'s lanes tab (a link followed there). */
  private inputLane(leaf: WorkspaceLeaf | null): Lane | null {
    const tab = this.tabOf(leaf);
    const t = this.lastInput;
    return (tab && t && tab.lanes.find(l => l.el.contains(t))) || null;
  }

  /** The card in `lane` that the user's last mouse / key input was in. */
  inputItem(lane: Lane): Item | null {
    const t = this.lastInput;
    return (t && lane.items.find(i => i.el.contains(t))) || null;
  }

  shouldRoute(leaf: WorkspaceLeaf, file: unknown): boolean {
    if (!(file instanceof TFile) || file.extension !== "md") return false;
    const host = this.hostedLeaves.get(leaf);
    if (host) return host.item.file !== file; // never replace a card's note in place
    if (leaf.view instanceof LanesView) return true; // nor a lanes tab
    if (!this.settings.lanesOnly || this.isExcepted(file)) return false;
    return this.inMainArea(leaf);
  }

  async route(leaf: WorkspaceLeaf, file: TFile, openState?: any) {
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
    const fromItem = host ? host.item : intent ? intent.fromItem : from ? this.inputItem(from) : null;
    const p = intent?.paneType;
    const wantNew = !host && (p === "tab" || p === true || p === "split" || p === "window");
    // like WorkspaceLeaf.openFile: `active` defaults to whether the picked leaf is the active one
    const opts: AddOpts = {
      focus: openState?.active ?? leaf === ws.activeLeaf,
      eState: openState?.eState,
      mode: openState?.state?.mode,
      after: fromItem,
    };
    // opened into a lanes tab itself: from one of its lanes, as a link followed there ("same" / "next");
    // otherwise into its current lane
    if (leaf.view instanceof LanesView) {
      const tab = leaf.view;
      const lt = this.settings.linkTarget;
      const base = from?.tab === tab && lt !== "last" ? from : null;
      const done = base
        ? await this.openInLane(file, lt, base, opts)
        : await this.openInLane(file, "same", tab.currentLane(), opts);
      if (!done) throw new Error("no lane to open in");
      return;
    }
    // The empty tab Obsidian made or picked becomes a lanes tab for the note: for a "new tab" open (Ctrl-click,
    // Open in new tab / window, Split), when it's the tab you were in (Ctrl+T, then the quick switcher), or
    // when its window has no lanes tab yet.
    if (
      !host &&
      this.isEmptyMainLeaf(leaf) &&
      (wantNew || intent?.wasActive || !this.recentTabIn(leaf.getContainer()))
    ) {
      const tab = await this.newTab(leaf);
      if (!tab?.lanes[0]) throw new Error("no lane to open in"); // route() then opens it normally
      await tab.lanes[0].add(file, { ...opts, after: null });
      return;
    }
    // a link followed in a lane: "Link clicked in a lane opens in" (next lane by default)
    const where: Where = wantNew ? "newTab" : from ? this.settings.linkTarget : "last";
    if (!(await this.openInLane(file, where, from, opts))) throw new Error("no lane to open in");
    this.dropUsedLeaf(leaf);
  }

  /** The tab Obsidian picked (or made) for a routed open is now unused: close it if it's empty and not alone. */
  private dropUsedLeaf(leaf: WorkspaceLeaf) {
    if (!this.isEmptyMainLeaf(leaf)) return;
    let n = 0;
    this.app.workspace.iterateLeaves(leaf.getContainer() as unknown as WorkspaceItem, () => {
      n++;
    });
    if (n > 1) this.detachQuietly(leaf); // a popout's only tab would close the window
  }

  private isEmptyMainLeaf(leaf: WorkspaceLeaf): boolean {
    return (
      !this.hostedLeaves.has(leaf) && !!leaf.parent && leaf.view?.getViewType() === "empty" && this.inMainArea(leaf)
    );
  }

  /** In a window's main area (the main window's, or a popout's), not a sidebar. */
  inMainArea(item: WorkspaceItem): boolean {
    const ws = this.app.workspace;
    const root = typeof item?.getRoot === "function" ? item.getRoot() : null;
    return !!root && (root === ws.rootSplit || root === (ws.floatingSplit as unknown as WorkspaceItem));
  }

  // ---------- lanes tabs ----------

  /**
   * The names of every lanes tab but `self`, in any window, including tabs not loaded yet (their saved state is
   * read; loaded tabs are asked directly, so naming one never asks another for its state, which could name it
   * in turn). Tabs not named yet give null.
   */
  private otherTabNames(self: LanesView): (string | null)[] {
    const names: (string | null)[] = [];
    this.app.workspace.iterateAllLeaves(leaf => {
      if (leaf === self.leaf) return;
      if (leaf.view instanceof LanesView) names.push(leaf.view.peekName);
      else {
        const vs = leaf.getViewState(); // a deferred (not yet loaded) tab reports its saved state
        if (vs.type === VIEW_TYPE) names.push(savedTabName(vs.state));
      }
    });
    return names;
  }

  /** A random name for lanes tab `self` that no other lanes tab has (nor any of `avoid`). */
  pickTabName(self: LanesView, avoid: string[] = []): string {
    return pickTabName([...this.otherTabNames(self), ...avoid]);
  }

  /** Another lanes tab than `self` already has this name (ignoring case). */
  tabNameInUse(name: string, self: LanesView): boolean {
    const n = name.toLowerCase();
    return this.otherTabNames(self).some(o => o?.toLowerCase() === n);
  }

  /** Every open (loaded) lanes tab. */
  allTabs(): LanesView[] {
    return this.app.workspace
      .getLeavesOfType(VIEW_TYPE)
      .map(l => l.view)
      .filter((v): v is LanesView => v instanceof LanesView);
  }

  /** Lanes tabs in main areas, in layout-tree order (main window first). */
  tabs(): LanesView[] {
    return this.allTabs().filter(t => this.inMainArea(t.leaf));
  }

  tabOf(leaf: WorkspaceLeaf | null): LanesView | null {
    if (!leaf) return null;
    if (leaf.view instanceof LanesView) return leaf.view;
    return this.hostedLeaves.get(leaf)?.lane.tab ?? null;
  }

  touchTab(tab: LanesView) {
    if (this.recent[0] === tab) return;
    this.recent = [tab, ...this.recent.filter(t => t !== tab)];
  }

  forgetTab(tab: LanesView) {
    this.recent = this.recent.filter(t => t !== tab);
    if (this._lastLane?.tab === tab) this._lastLane = null;
  }

  /** The most recently active lanes tab in window `win`, else its first one. */
  private recentTabIn(win: WorkspaceContainer): LanesView | null {
    const here = this.tabs().filter(t => t.leaf.getContainer() === win);
    return this.recent.find(t => here.includes(t)) ?? here[0] ?? null;
  }

  /** The window (WorkspaceContainer) that has focus: a popout, or the main window's rootSplit. */
  private activeContainer(): WorkspaceContainer {
    const ws = this.app.workspace;
    const win = typeof activeWindow !== "undefined" ? activeWindow : window;
    return (this.popouts().find(w => w.win === win) ?? ws.rootSplit) as unknown as WorkspaceContainer;
  }

  /** The main window's rootSplit and every open popout window (each a WorkspaceContainer). */
  private windowRoots(): WorkspaceItem[] {
    return [this.app.workspace.rootSplit, ...this.popouts()] as unknown as WorkspaceItem[];
  }

  /** The open popout windows (WorkspaceWindow: `type` "window", with a live `win`). */
  private popouts(): { win?: Window | null; doc?: Document; type?: string }[] {
    const kids = (this.app.workspace.floatingSplit?.children ?? []) as { win?: Window | null; type?: string }[];
    return kids.filter(w => w?.type === "window" && !!w.win);
  }

  /**
   * Make `leaf` a lanes tab with the default layout, or, without one, a new tab in window `win` (default: the
   * active one): an empty tab there is reused, else a new tab joins the group of the window's most recent leaf.
   * `active`: make it the active tab (not for tabs the sweep converts in the background).
   */
  async newTab(leaf?: WorkspaceLeaf, win?: WorkspaceContainer, active = true): Promise<LanesView | null> {
    const target = leaf ?? this.emptyLeafIn(win ?? this.activeContainer()) ?? this.createTabIn(win);
    await target.setViewState({ type: VIEW_TYPE, active });
    const tab = target.view instanceof LanesView ? target.view : null;
    if (tab) this.touchTab(tab);
    return tab;
  }

  /** "New lanes tab" (ribbon, command): always a new tab in the active window. */
  async newLanesTab() {
    const tab = await this.newTab(this.createTabIn());
    if (tab) await this.app.workspace.revealLeaf(tab.leaf);
  }

  private emptyLeafIn(win: WorkspaceContainer): WorkspaceLeaf | null {
    let found: WorkspaceLeaf | null = null;
    this.app.workspace.iterateLeaves(win as unknown as WorkspaceItem, leaf => {
      if (!found && this.isEmptyMainLeaf(leaf) && !this.routing.has(leaf)) found = leaf;
    });
    return found;
  }

  /** A new tab in window `win` (default: the active one), next to its most recent leaf. */
  private createTabIn(win?: WorkspaceContainer): WorkspaceLeaf {
    const ws = this.app.workspace;
    const root = (win ?? this.activeContainer()) as unknown as WorkspaceParent;
    const recent = ws.getMostRecentLeaf(root);
    const group = recent?.parent instanceof WorkspaceTabs ? recent.parent : undefined;
    return group ? ws.createLeafInTabGroup(group) : ws.getLeaf("tab");
  }

  laneOfLeaf(leaf: WorkspaceLeaf | null): Lane | null {
    if (!leaf) return null;
    if (leaf.view instanceof LanesView) return leaf.view.currentLane();
    return this.hostedLeaves.get(leaf)?.lane ?? null;
  }

  /** The lane commands act on: the active one, else the one opens go to. */
  currentLane(): Lane | null {
    return this.laneOfLeaf(this.app.workspace.activeLeaf) ?? this.targetLane();
  }

  /** The lanes tab commands act on: the active one, else the one opens go to. */
  currentTab(): LanesView | null {
    return this.tabOf(this.app.workspace.activeLeaf) ?? this.targetLane()?.tab ?? null;
  }

  /**
   * Where an open that doesn't come from a lane goes: the last-used lane of the active lanes tab, else of the
   * most recently active lanes tab in the active window. Null if that window has none.
   */
  private targetLane(): Lane | null {
    const act = this.tabOf(this.app.workspace.activeLeaf);
    if (act && this.inMainArea(act.leaf)) return act.currentLane();
    return this.recentTabIn(this.activeContainer())?.currentLane() ?? null;
  }

  /** Pick the lane for an open (making a lanes tab where needed). */
  private async laneFor(where: Where, from: Lane | null): Promise<Lane | null> {
    if (where === "same" && from) return from;
    if (where === "next" && from) return wrapStep(from.tab.lanes, from, 1);
    if (where === "newTab") {
      const tab = await this.newTab(undefined, from ? from.tab.leaf.getContainer() : undefined);
      return tab?.lanes[0] ?? null;
    }
    return this.targetLane() ?? (await this.newTab())?.lanes[0] ?? null;
  }

  /** A card showing `file` in a lane other than `except`: in `except`'s tab first, then its window, then anywhere. */
  private findCard(file: TFile, except: Lane): { lane: Lane; item: Item } | null {
    const win = except.tab.leaf.getContainer();
    const rank = (l: Lane) => (l.tab === except.tab ? 2 : l.tab.leaf.getContainer() === win ? 1 : 0);
    const lanes = this.tabs()
      .flatMap(t => t.lanes)
      .filter(l => l !== except)
      .sort((a, b) => rank(b) - rank(a));
    for (const lane of lanes) {
      const item = lane.items.find(i => i.file === file);
      if (item) return { lane, item };
    }
    return null;
  }

  /** Open `file` in a lane; false if there was no lane to open it in. */
  async openInLane(file: TFile, where: Where, from: Lane | null = null, opts: AddOpts = {}): Promise<boolean> {
    const lane = await this.laneFor(where, from);
    if (!lane) return false;
    // "Note already open in another lane" (default: open another copy here), across all lanes of all tabs
    const dup = this.settings.duplicateMode;
    if (dup !== "copy" && !lane.items.some(i => i.file === file)) {
      const other = this.findCard(file, lane);
      if (other && dup === "jump") {
        await other.lane.reveal(other.item);
        if (opts.eState && other.item.leaf) other.item.leaf.setEphemeralState(opts.eState);
        return true;
      }
      if (other) {
        if (opts.focus !== false) await this.app.workspace.revealLeaf(lane.tab.leaf);
        const index = insertIndex(lane.items, this.settings.newNotePosition, opts.after);
        await this.moveItem(other.lane, other.item, lane, index);
        const moved = lane.items.find(i => i.file === file); // a new card: the old one's editor closed
        if (opts.eState && moved?.leaf) moved.leaf.setEphemeralState(opts.eState);
        return true;
      }
    }
    if (opts.focus !== false) await this.app.workspace.revealLeaf(lane.tab.leaf); // not for background opens
    await lane.add(file, opts);
    return true;
  }

  /**
   * An exception (or a file that isn't a note) opened from a card or into a lanes tab: a normal tab in the lanes
   * tab's tab group, else wherever Obsidian puts a new tab.
   */
  async openBeside(tab: LanesView, file: TFile, openState?: OpenViewState) {
    const ws = this.app.workspace;
    const group = tab.leaf.parent;
    const leaf = group instanceof WorkspaceTabs ? ws.createLeafInTabGroup(group) : ws.getLeaf("tab");
    await leaf.openFile(file, { ...openState, active: true });
  }

  notePointerIn(lane: Lane) {
    this.lastLane = lane;
  }

  // ---------- moving notes between lanes ----------

  /** Move a card to `to` at `index` (counted without the card). Across lanes its editor reopens there. */
  async moveItem(from: Lane, it: Item, to: Lane, index: number) {
    if (!from.items.includes(it)) return;
    if (from === to) {
      from.placeAt(it, index);
      return;
    }
    await to.insertTaken(from.take(it), index);
  }

  /** Move a card to the lane before / after its own in its tab's layout order, wrapping round at either end. */
  async moveToLane(from: Lane, it: Item, step: 1 | -1) {
    const to = wrapStep(from.tab.lanes, from, step);
    if (!to || to === from) return this.refuse("This lanes tab has only one lane");
    await this.moveItem(from, it, to, 0);
  }

  /** "Split" etc. on a lanes tab or a card: an empty lanes tab beside it (or in a new tab / window), same layout. */
  async emptyCopyOf(src: LanesView, mode: unknown, dir: unknown): Promise<WorkspaceLeaf> {
    const ws = this.app.workspace;
    // duplicateLeaf(leaf, "vertical" | "horizontal") means a split in that direction (see app.js)
    const split = mode === "split" || mode === "vertical" || mode === "horizontal";
    const d = mode === "horizontal" || dir === "horizontal" ? "horizontal" : "vertical";
    // no popout windows on mobile (Obsidian's openPopout throws there): a new tab instead
    const pane = mode === "window" && !this.canPopout() ? "tab" : mode;
    const leaf = split ? ws.createLeafBySplit(src.leaf, d) : ws.getLeaf((pane ?? "tab") as PaneType);
    const { layout, sizes } = src.getState();
    await leaf.setViewState({ type: VIEW_TYPE, active: true, state: { layout, sizes, lanes: [] } });
    if (leaf.view instanceof LanesView) this.touchTab(leaf.view);
    return leaf;
  }

  /** "Move to new window" on a card: it moves into the first lane of a new window's lanes tab, pin and all. */
  async cardToNewWindow(lane: Lane, it: Item) {
    // mobile has no popout windows: a new lanes tab instead
    const tab = await this.newTab(this.canPopout() ? this.app.workspace.openPopoutLeaf() : this.createTabIn());
    if (tab?.lanes[0]) await this.moveItem(lane, it, tab.lanes[0], 0);
  }

  /** Popout windows exist: Obsidian for desktop, not emulating mobile (Platform.canPopoutWindow in app.js). */
  private canPopout(): boolean {
    return Platform.isDesktopApp && !Platform.isMobile;
  }

  endItemDrag() {
    const d = this.dragItem;
    this.dragItem = null;
    d?.item.el.removeClass("is-lane-dragging");
    for (const t of this.allTabs()) for (const l of t.lanes) l.clearDrop();
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
    void this.openInLane(dest, e.altKey ? "newTab" : "last");
  }
}
