import { ItemView, Menu, Platform, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { debounce } from "./debounce";
import type EditorLanesPlugin from "./main";
import { Lane } from "./lane";
import { LayoutModal } from "./layout-modal";
import {
  LayoutColumn,
  RelayoutPlan,
  Sizes,
  effectiveShares,
  formatLayout,
  laneCount,
  nearestIndex,
  parseLayout,
  planRelayout,
  resizePair,
} from "./layout";
import { TabNameModal } from "./tab-name-modal";
import { TAB_TITLE_PREFIX } from "./tab-names";
import { fitLanes, readTabState, savedTabName } from "./tab-state";
import { LEGACY_VIEW_TYPE, OLD_NAV_VIEW_TYPE, VIEW_TYPE } from "./types";

const ONE_LANE: LayoutColumn[] = [{ width: 100, rows: 1 }];
/**
 * A lanes tab: one Obsidian tab (an ItemView, so it can be split, dragged, popped out, closed and restored like
 * any tab) that lays out all its lanes itself, as DOM columns of stacked lanes, from a layout definition: the
 * default from the settings, or the tab's own ("Lane layout…", saved in its view state). Lanes are Lane objects
 * inside it, not leaves. Lanes have no header and can't be added or removed one by one: they
 * only come from the layout. Dividers between columns and rows can always be dragged (sizes
 * saved in the view state too).
 *
 * Phones (`body.is-phone`) show one lane at a time: the lanes sit side by side in a horizontal scroller that
 * snaps to each lane (swipe between them), with a row of lane buttons above (the lane switcher). The layout,
 * routing and saved state are the same as on a wide screen; tablets show the layout as on the desktop.
 */
export class LanesView extends ItemView {
  /** In layout order: columns left to right, top to bottom within a column. */
  lanes: Lane[] = [];
  /** This tab's lanes, most recently used first (see EditorLanesPlugin.lastLane). */
  private used: Lane[] = [];
  /** The lane of this tab used last (see EditorLanesPlugin.lastLane); setting null forgets them all. */
  get lastLane(): Lane | null {
    return this.used.find(l => this.lanes.includes(l)) ?? null;
  }
  set lastLane(lane: Lane | null) {
    this.used = lane ? [lane, ...this.used.filter(l => l !== lane && this.lanes.includes(l))] : [];
  }
  /**
   * The lane used last other than `lane`, else `lane`: where "last-used lane" opens go when they start in `lane`
   * (a link followed or Shift-clicked there: the click itself has just made `lane` the last used one).
   */
  lastUsedOtherThan(lane: Lane): Lane {
    return this.used.find(l => l !== lane && this.lanes.includes(l)) ?? lane;
  }
  /** The tab's own layout, or null: it follows the default in the settings. */
  private override: string | null = null;
  private nameValue: string | null = null;
  /** The saved name, without picking one (for naming other tabs). */
  get peekName(): string | null {
    return this.nameValue;
  }
  private sizes: Sizes | null = null;
  private columns: LayoutColumn[] = ONE_LANE;
  private gridEl!: HTMLElement;
  /** Phones: one button per lane, above the lanes. Hidden by CSS on wider screens. */
  private switcherEl!: HTMLElement;
  /** Phones: the lane scrolled into view. */
  private shownLane: Lane | null = null;
  private colEls: HTMLElement[] = [];
  /** What the grid was last drawn for (layout, sizes), so settings changes only redraw when needed. */
  private drawn = "";
  private relaying: Promise<void> = Promise.resolve();

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: EditorLanesPlugin,
  ) {
    super(leaf);
    this.navigation = false; // opens never replace a lanes tab (getUnpinnedLeaf skips it)
  }

  getViewType() {
    return VIEW_TYPE;
  }
  /**
   * "Editor lane <name>": every lanes tab gets a random fictional name no other lanes tab has when it's first
   * shown or saved, and keeps it (saved in its state); "Rename lanes tab…" changes it.
   */
  getDisplayText() {
    return `${TAB_TITLE_PREFIX}${this.tabName()}`;
  }

  /** This tab's name, picked on first use. */
  tabName(): string {
    if (this.nameValue === null) this.nameValue = this.plugin.pickTabName(this);
    return this.nameValue;
  }

  /** "Rename lanes tab…": a new name (already validated and tidied). */
  rename(name: string) {
    this.nameValue = name;
    this.titleEl?.setText(this.getDisplayText()); // the view header's title (shown on phones)
    this.save(); // also updates the tab header
  }

  openRenameDialog() {
    new TabNameModal(this.app, this.plugin, this).open();
  }
  override getIcon() {
    return "columns-3";
  }

  override async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("lanes-view");
    this.switcherEl = root.createDiv({ cls: "lanes-switcher", attr: { role: "tablist", "aria-label": "Lanes" } });
    this.gridEl = root.createDiv({ cls: "lanes-grid" });
    // phones: the lane swiped to becomes the current one (where opens from outside the tab go)
    const settle = debounce(() => this.onSwiped(), 120, true);
    this.registerDomEvent(this.gridEl, "scroll", () => settle());
    this.addAction("layout-grid", "Lane layout…", () => this.openLayoutDialog());
    this.registerEvent(this.app.vault.on("delete", f => this.lanes.forEach(l => l.onFileDeleted(f))));
    this.registerEvent(this.app.vault.on("rename", f => this.lanes.forEach(l => l.onFileRenamed(f))));
    this.applyLooks();
    if (!this.lanes.length) this.build([]); // setState follows with the saved lanes, if any
  }

  override async onClose() {
    this.teardown();
    this.plugin.forgetTab(this);
  }

  /** Detach every hosted leaf of every lane. Safe to call twice. */
  teardown() {
    for (const l of this.lanes) l.destroy();
    this.lanes = [];
    this.lastLane = null;
  }

  override onResize() {
    for (const l of this.lanes) l.checkWindow(); // a tab moved to another window
    // phones: keep the shown lane in place (rotation, the keyboard, a window that became phone-sized)
    if (this.isPhone()) this.showLane(this.shownLane ?? this.currentLane());
  }

  // ---------- phones: one lane at a time ----------

  /** Phone-sized screen: the lanes are a horizontal scroller (see styles.css). Follows Obsidian's body class. */
  isPhone(): boolean {
    return !!this.contentEl?.doc.body.hasClass("is-phone");
  }

  /**
   * Phones: scroll `lane` into view (a note opened or moved there, a lane button). Elsewhere nothing to do.
   * It jumps there at once, never smoothly: CodeMirror scrolls every scrolling ancestor to show a caret (this
   * grid too), so the note just opened would apply its pending scroll-into-view as soon as its card came into
   * sight, a few pixels into the animation. That cuts the smooth scroll short, and the snap then lands on the
   * lane before (seen 2026-11-08, MO-02). With the lane already in view, that scroll does nothing.
   */
  showLane(lane: Lane | null) {
    if (!lane || !this.gridEl || !this.isPhone() || !this.lanes.includes(lane)) return;
    this.shownLane = lane;
    this.updateSwitcher();
    const left = lane.el.offsetLeft; // .lanes-grid is the offset parent
    if (Math.abs(this.gridEl.scrollLeft - left) > 1) this.gridEl.scrollTo({ left, behavior: "auto" });
  }

  /** Phones: the lane a swipe (or a scroll) settled on. */
  private onSwiped() {
    if (!this.isPhone() || !this.lanes.length) return;
    const i = nearestIndex(
      this.lanes.map(l => l.el.offsetLeft),
      this.gridEl.scrollLeft,
    );
    const lane = this.lanes[i];
    if (!lane || lane === this.shownLane) return;
    this.shownLane = lane;
    this.updateSwitcher();
    this.plugin.lastLane = lane;
  }

  /** The lane buttons (phones): "1", "2"… with the note count; the shown lane is selected. */
  private updateSwitcher() {
    const el = this.switcherEl;
    if (!el) return;
    el.empty();
    if (this.lanes.length < 2) {
      el.addClass("lane-hidden");
      return;
    }
    el.removeClass("lane-hidden");
    const shown = this.shownLane && this.lanes.includes(this.shownLane) ? this.shownLane : this.lanes[0];
    this.lanes.forEach((lane, i) => {
      const n = lane.items.length;
      const b = el.createEl("button", {
        cls: "lanes-switch",
        attr: {
          role: "tab",
          "aria-selected": String(lane === shown),
          "aria-label": `Lane ${i + 1} of ${this.lanes.length}, ${n} note${n === 1 ? "" : "s"}`,
        },
      });
      // a dot per lane (lanes aren't numbered), with its note count
      b.createSpan({ cls: "lanes-switch-dot" });
      if (n) b.createSpan({ cls: "lanes-switch-count", text: String(n) });
      b.toggleClass("is-active", lane === shown);
      b.addEventListener("click", () => {
        this.plugin.lastLane = lane;
        this.showLane(lane);
      });
    });
  }

  // ---------- state (workspace.json, Workspaces, "Undo close tab") ----------

  override getState(): Record<string, unknown> {
    const s: Record<string, unknown> = { name: this.tabName(), lanes: this.lanes.map(l => l.getState()) };
    if (this.override !== null) s.layout = this.override;
    if (this.sizes) s.sizes = this.sizes;
    return s;
  }

  override async setState(state: unknown, result: ViewStateResult) {
    const st = readTabState(state);
    if (st.name !== null) this.nameValue = st.name; // a numbered tab saved before names gets a new one
    this.override = st.layout;
    this.sizes = st.sizes;
    this.build(st.lanes);
    await super.setState(state, result);
  }

  /** New lanes for the current layout, filled from saved state (notes of lanes past the end wrap round). */
  private build(saved: Parameters<typeof fitLanes>[0]) {
    this.teardown();
    this.columns = this.layoutColumns();
    const data = fitLanes(saved, laneCount(this.columns));
    this.lanes = data.map(() => new Lane(this, this.plugin));
    this.lanes.forEach((l, i) => l.load(data[i]));
    this.draw();
  }

  save() {
    this.app.workspace.requestSaveLayout();
    this.leaf.updateHeader?.();
  }

  // ---------- layout ----------

  /** The tab's own layout if it has a valid one, else the default from the settings, else one lane. */
  private layoutColumns(): LayoutColumn[] {
    for (const text of [this.override, this.plugin.settings.defaultLayout]) {
      if (text === null) continue;
      const p = parseLayout(text);
      if (p.ok) return p.columns;
    }
    return ONE_LANE;
  }

  /** The layout text this tab shows, and whether it's its own (not the default). */
  layoutInfo(): { text: string; own: boolean } {
    return { text: this.override ?? this.plugin.settings.defaultLayout, own: this.override !== null };
  }

  private drawKey() {
    return `${formatLayout(this.columns)}|${JSON.stringify(this.sizes)}`;
  }

  /** (Re)build the grid: columns with their lanes, and the dividers between them. Lane elements are moved, not remade. */
  private draw() {
    if (!this.gridEl) return;
    this.drawn = this.drawKey();
    const shares = effectiveShares(this.columns, this.sizes);
    this.gridEl.empty();
    this.colEls = [];
    let n = 0;
    this.columns.forEach((c, ci) => {
      if (ci > 0) this.divider(this.gridEl, "col", ci, ci - 1);
      const colEl = this.gridEl.createDiv({ cls: "lanes-col" });
      colEl.style.flexGrow = String(shares.cols[ci]);
      this.colEls.push(colEl);
      for (let r = 0; r < c.rows; r++) {
        if (r > 0) this.divider(colEl, "row", ci, r - 1);
        const lane = this.lanes[n++];
        if (!lane) continue;
        lane.el.style.flexGrow = String(shares.rows[ci][r]);
        colEl.appendChild(lane.el);
      }
    });
    if (this.shownLane && !this.lanes.includes(this.shownLane)) this.shownLane = null;
    this.updateSwitcher();
    // phones: the redrawn grid starts scrolled to the left; go back to the lane shown before
    if (this.isPhone() && this.shownLane) this.showLane(this.shownLane);
  }

  /** A divider between two columns (`kind` "col") or two lanes stacked in column `ci` ("row"). Always draggable: sizes are the one thing that changes. */
  private divider(parent: HTMLElement, kind: "col" | "row", ci: number, i: number) {
    const el = parent.createDiv({ cls: `lanes-divider mod-${kind}` });
    // touch: a drag here must not open Obsidian's mobile sidebars (their swipe skips this attribute)
    el.setAttr("data-ignore-swipe", "true");
    el.setAttr("aria-label", Platform.isMobile ? "Drag to resize" : "Drag to resize; double-click to reset");
    el.addEventListener("dblclick", () => this.resetSizes());
    el.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const base = effectiveShares(this.columns, this.sizes);
      const container = kind === "col" ? this.gridEl : this.colEls[ci];
      const total = kind === "col" ? container.clientWidth : container.clientHeight;
      const start = kind === "col" ? e.clientX : e.clientY;
      const startShares = kind === "col" ? base.cols : base.rows[ci];
      const sum = startShares.reduce((a, b) => a + b, 0);
      const els =
        kind === "col"
          ? this.colEls
          : (Array.from(container.children).filter(c => c.hasClass("lane")) as HTMLElement[]);
      let cur = startShares;
      el.addClass("is-dragging");
      el.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        if (!(total > 0)) return;
        const pos = kind === "col" ? ev.clientX : ev.clientY;
        cur = resizePair(startShares, i, ((pos - start) / total) * sum, sum * 0.05);
        cur.forEach((s, k) => {
          if (els[k]) els[k].style.flexGrow = String(s);
        });
      };
      const up = () => {
        el.removeClass("is-dragging");
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        if (kind === "col") base.cols = cur;
        else base.rows[ci] = cur;
        this.sizes = { for: formatLayout(this.columns), cols: base.cols, rows: base.rows };
        this.drawn = this.drawKey();
        this.save();
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
  }

  /** Back to the layout's own widths (double-click a divider, ⋯ → "Reset lane sizes"). */
  private resetSizes() {
    this.sizes = null;
    this.draw();
    this.save();
  }

  /** A lane's notes changed (count shown in its header). */
  laneChanged(lane: Lane) {
    if (!this.lanes.includes(lane)) return;
    this.updateSwitcher();
  }

  /** Change the layout and move lanes / notes as `plan` says (or by order). Runs one at a time. */
  private relayout(plan?: RelayoutPlan): Promise<void> {
    const run = this.relaying.then(() => this.relayoutNow(plan));
    this.relaying = run.catch(e => console.error("[editor-multiple-lanes] could not change the lane layout", e));
    return run;
  }

  private async relayoutNow(plan?: RelayoutPlan) {
    const old = this.lanes;
    this.columns = this.layoutColumns();
    const count = laneCount(this.columns);
    if (!plan || plan.slots.length !== count) plan = planRelayout(old.length, count);
    const next = plan.slots.map(s => (s === null ? new Lane(this, this.plugin) : old[s]));
    this.lanes = next;
    // notes of lanes that go move into the remaining ones (at the bottom; pinned ones join the pinned block)
    for (const m of plan.merges) {
      const from = old[m.from];
      const to = next[m.to];
      if (!from || !to) continue;
      for (const it of [...from.items]) await to.insertTaken(from.take(it), to.items.length, false);
      if (this.lastLane === from) this.lastLane = to;
      if (this.plugin.lastLane === from) this.plugin.lastLane = to;
      from.destroy();
      from.el.remove();
    }
    this.draw();
    this.save();
  }

  /** Every setting this tab shows: looks, the lanes' own settings, and the default layout. */
  applySettings() {
    this.applyLooks();
    this.applyLaneSettings();
    this.applyLayoutSetting();
  }

  /** The lanes' own settings: card titles (show folder), pre-load distance. */
  applyLaneSettings() {
    for (const l of this.lanes) l.applySettings();
  }

  /** A tab without its own layout follows the default one in the settings. */
  applyLayoutSetting() {
    const cols = this.layoutColumns();
    if (formatLayout(cols) !== formatLayout(this.columns) || laneCount(cols) !== this.lanes.length) {
      void this.relayout();
    } else if (this.drawKey() !== this.drawn) this.draw();
  }

  /** Settings that change how cards look (on the tab's element, so tabs in popouts follow too). */
  applyLooks() {
    const s = this.plugin.settings;
    const root = this.contentEl;
    root.toggleClass("lane-compact", s.headerSize === "compact");
    root.toggleClass("lane-capped", s.noteHeight === "cap");
    root.style.setProperty("--lane-note-max-height", `${s.noteMaxHeight}px`);
    // Backlinks Full View skips note views inside an element with this attribute: a cheap cross-plugin signal
    // through the DOM, no API between the plugins (see SPEC.md, Working with other plugins). Lanes never styles
    // BFV's own elements.
    if (s.showBacklinks) root.removeAttribute("data-bfv-skip");
    else root.setAttribute("data-bfv-skip", "editor-lanes");
  }

  /** "Lane layout…": the tab's own layout (`text`), or back to the default (null). */
  async setLayout(text: string | null) {
    if (text !== null && !parseLayout(text).ok) return;
    this.override = text;
    this.sizes = null;
    await this.relayout();
  }

  openLayoutDialog() {
    new LayoutModal(this.app, this.plugin, this).open();
  }

  /** The lane opens go to when they don't name one: the one used last here, else the first. */
  currentLane(): Lane | null {
    return this.lastLane && this.lanes.includes(this.lastLane) ? this.lastLane : (this.lanes[0] ?? null);
  }

  // ---------- menus ----------

  /** The tab's ⋯ menu and its tab header's right-click menu (Obsidian's items, such as Split, come first). */
  override onPaneMenu(menu: Menu, source: string) {
    super.onPaneMenu(menu, source);
    this.addTabItems(menu);
  }

  /**
   * The tab-header menu: Obsidian builds it from onTabMenu and then onPaneMenu(menu, "tab-header"), except for a
   * tab that isn't shown and in the mobile tab switcher (a long-press on a tab), where only onTabMenu runs.
   */
  override onTabMenu(menu: Menu) {
    super.onTabMenu(menu);
    const switcher = Platform.isMobile && !!this.app.mobileTabSwitcher?.isVisible;
    if (switcher || !this.leaf.isVisible()) this.addTabItems(menu);
  }

  private addTabItems(menu: Menu) {
    menu.addItem(i =>
      i
        .setSection("pane")
        .setTitle("Rename lanes tab…")
        .setIcon("pencil")
        .onClick(() => this.openRenameDialog()),
    );
    menu.addItem(i =>
      i
        .setSection("pane")
        .setTitle("Lane layout…")
        .setIcon("layout-grid")
        .onClick(() => this.openLayoutDialog()),
    );
    if (this.sizes) {
      menu.addItem(i =>
        i
          .setSection("pane")
          .setTitle("Reset lane sizes")
          .setIcon("rotate-ccw")
          .onClick(() => this.resetSizes()),
      );
    }
  }

  /** A lane's own menu: a right-click (touch: long-press) on its background. */
  addLaneMenuItems(menu: Menu, lane: Lane) {
    const none = !lane.items.length;
    menu.addItem(i =>
      i
        .setSection("notes")
        .setTitle("Collapse all notes")
        .setIcon("chevrons-down-up")
        .setDisabled(none)
        .onClick(() => lane.setAllCollapsed(true)),
    );
    menu.addItem(i =>
      i
        .setSection("notes")
        .setTitle("Expand all notes")
        .setIcon("chevrons-up-down")
        .setDisabled(none)
        .onClick(() => lane.setAllCollapsed(false)),
    );
    menu.addItem(i =>
      i
        .setSection("notes")
        .setTitle("Close all notes")
        .setIcon("x-circle")
        .setDisabled(none)
        .onClick(() => lane.closeAll()),
    );
    menu.addItem(i =>
      i
        .setSection("tab")
        .setTitle("Lane layout of this tab…")
        .setIcon("layout-grid")
        .onClick(() => this.openLayoutDialog()),
    );
  }
}

/**
 * A lanes tab while this Obsidian can't host notes in lanes (hosting.ts probeInternals failed at load): it keeps
 * the tab's saved state exactly as it was, so nothing is lost until a version that works is installed, and lists
 * the tab's notes as links that open in normal tabs.
 */
export class UnsupportedLanesView extends ItemView {
  private saved: Record<string, unknown> = {};

  constructor(
    leaf: WorkspaceLeaf,
    private reason: string,
  ) {
    super(leaf);
    this.navigation = false;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return `${TAB_TITLE_PREFIX}${savedTabName(this.saved) ?? "(off)"}`;
  }
  override getIcon() {
    return "columns-3";
  }
  override getState(): Record<string, unknown> {
    return this.saved;
  }
  override async setState(state: unknown, result: ViewStateResult) {
    this.saved = state && typeof state === "object" ? { ...(state as Record<string, unknown>) } : {};
    this.render();
    await super.setState(state, result);
  }
  override async onOpen() {
    this.render();
  }

  private render() {
    const el = this.contentEl;
    el.empty();
    el.addClass("lanes-unsupported");
    el.createEl("p", {
      text: `Editor Multiple Lanes is off: this Obsidian version can't host notes in lanes (missing: ${this.reason}). This lanes tab is kept as it was; its notes:`,
    });
    const list = el.createEl("ul");
    for (const lane of readTabState(this.saved).lanes) {
      for (const d of lane) {
        const a = list.createEl("li").createEl("a", { cls: "internal-link", text: d.path, href: d.path });
        a.addEventListener("click", e => {
          e.preventDefault();
          void this.app.workspace.openLinkText(d.path, "", "tab");
        });
      }
    }
  }
}

/**
 * The old one-lane-per-tab view, registered only so old layouts load without "plugin not active" placeholders: such a
 * leaf is closed as soon as it opens (and on layout ready); see EditorLanesPlugin.closeLegacy.
 */
export class LegacyLaneView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private plugin: EditorLanesPlugin,
  ) {
    super(leaf);
    this.navigation = false;
  }
  getViewType() {
    return LEGACY_VIEW_TYPE;
  }
  getDisplayText() {
    return "Old editor lane";
  }
  override async onOpen() {
    this.contentEl.setText("Replaced by lanes tabs; this tab closes.");
    this.plugin.requestLegacyCleanup();
  }
}

/**
 * Stub for the removed Navigator tab (OLD_NAV_VIEW_TYPE), so a saved layout holding one doesn't show "plugin no
 * longer active": it closes as soon as it opens (and on layout ready), with no "Undo close tab" entry, and the
 * File explorer, Search and Bookmarks views are made again in the left sidebar if they're missing.
 */
export class OldNavigatorView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private plugin: EditorLanesPlugin,
  ) {
    super(leaf);
    this.navigation = false;
  }
  getViewType() {
    return OLD_NAV_VIEW_TYPE;
  }
  getDisplayText() {
    return "Navigator (removed)";
  }
  override async onOpen() {
    this.contentEl.setText("Files, Search and Bookmarks are back in the left sidebar; this tab closes.");
    this.plugin.requestLegacyCleanup();
  }
}
