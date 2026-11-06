import { ItemView, Menu, Notice, ViewStateResult, WorkspaceLeaf } from "obsidian";
import type EditorLanesPlugin from "./main";
import { Lane } from "./lane";
import { LayoutModal } from "./layout-modal";
import {
  LayoutColumn,
  RelayoutPlan,
  Side,
  Sizes,
  effectiveShares,
  formatLayout,
  insertLane,
  laneCount,
  parseLayout,
  planInsert,
  planRelayout,
  planRemove,
  removeLane,
  resizePair,
  shareWithTarget,
  slotOf,
} from "./layout";
import { fitLanes, readTabState } from "./tab-state";
import { LEGACY_VIEW_TYPE, VIEW_TYPE } from "./types";

const ONE_LANE: LayoutColumn[] = [{ width: 100, rows: 1 }];
/** The lane-adding buttons and menu items (unlocked): side, title, icon. */
const ADD_LANE: [Side, string, string][] = [
  ["left", "New lane to the left", "arrow-left"],
  ["right", "New lane to the right", "arrow-right"],
  ["up", "New lane above", "arrow-up"],
  ["down", "New lane below", "arrow-down"],
];

/**
 * A lanes tab: one Obsidian tab (an ItemView, so it can be split, dragged, popped out, closed and restored like
 * any tab) that lays out all its lanes itself, as DOM columns of stacked lanes, from a layout definition: the
 * default from the settings, or the tab's own ("Lane layout…", saved in its view state). Lanes are Lane objects
 * inside it, not leaves. With the layout unlocked, dividers between columns and rows can be dragged (sizes saved
 * in the view state too) and each lane header has buttons to add a lane beside it or remove it, which give the
 * tab its own layout.
 */
export class LanesView extends ItemView {
  /** In layout order: columns left to right, top to bottom within a column. */
  lanes: Lane[] = [];
  /** The lane of this tab used last (see EditorLanesPlugin.lastLane). */
  lastLane: Lane | null = null;
  /** The tab's own layout, or null: it follows the default in the settings. */
  private override: string | null = null;
  private sizes: Sizes | null = null;
  private columns: LayoutColumn[] = ONE_LANE;
  private gridEl!: HTMLElement;
  private colEls: HTMLElement[] = [];
  /** What the grid was last drawn for (layout, lock, sizes), so settings changes only redraw when needed. */
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
  getDisplayText() {
    // the note opened last in this tab, so several lanes tabs can be told apart
    let best: { name: string; at: number } | null = null;
    for (const l of this.lanes) {
      for (const it of l.items) if (!best || it.openedAt > best.at) best = { name: it.file.basename, at: it.openedAt };
    }
    return best ? `Lanes: ${best.name}` : "Editor lanes";
  }
  override getIcon() {
    return "columns-3";
  }

  override async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("lanes-view");
    this.gridEl = root.createDiv({ cls: "lanes-grid" });
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
  }

  // ---------- state (workspace.json, Workspaces, "Undo close tab") ----------

  override getState(): Record<string, unknown> {
    const s: Record<string, unknown> = { lanes: this.lanes.map(l => l.getState()) };
    if (this.override !== null) s.layout = this.override;
    if (this.sizes) s.sizes = this.sizes;
    return s;
  }

  override async setState(state: unknown, result: ViewStateResult) {
    const st = readTabState(state);
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

  private get locked() {
    return this.plugin.settings.lockLayout;
  }

  private drawKey() {
    return `${formatLayout(this.columns)}|${this.locked}|${JSON.stringify(this.sizes)}`;
  }

  /** (Re)build the grid: columns with their lanes, and the dividers between them. Lane elements are moved, not remade. */
  private draw() {
    if (!this.gridEl) return;
    this.drawn = this.drawKey();
    const locked = this.locked;
    const shares = effectiveShares(this.columns, this.sizes, locked);
    this.gridEl.empty();
    this.gridEl.toggleClass("is-locked", locked);
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
    this.lanes.forEach(l => this.drawHeader(l));
  }

  /** A divider between two columns (`kind` "col") or two lanes stacked in column `ci` ("row"). Draggable unless locked. */
  private divider(parent: HTMLElement, kind: "col" | "row", ci: number, i: number) {
    const el = parent.createDiv({ cls: `lanes-divider mod-${kind}` });
    if (this.locked) return;
    el.setAttr("aria-label", "Drag to resize; double-click to reset");
    el.addEventListener("dblclick", () => this.resetSizes());
    el.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const base = effectiveShares(this.columns, this.sizes, false);
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

  private drawHeader(lane: Lane) {
    const n = this.lanes.indexOf(lane);
    if (n < 0) return;
    const buttons: { icon: string; title: string; run: () => void }[] = [];
    if (!this.locked) {
      for (const [side, title, icon] of ADD_LANE) {
        buttons.push({ icon, title, run: () => void this.addLaneBeside(lane, side) });
      }
      if (this.lanes.length > 1)
        buttons.push({ icon: "x", title: "Remove this lane", run: () => this.removeLane(lane) });
    }
    lane.renderHeader(n + 1, buttons);
  }

  /** A lane's notes changed (count shown in its header). */
  laneChanged(lane: Lane) {
    if (this.lanes.includes(lane)) this.drawHeader(lane);
  }

  /** Change the layout and move lanes / notes as `plan` says (or by order). Runs one at a time. */
  private relayout(plan?: RelayoutPlan): Promise<void> {
    const run = this.relaying.then(() => this.relayoutNow(plan));
    this.relaying = run.catch(e => console.error("[editor-lanes] could not change the lane layout", e));
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

  /** The settings changed: looks, the lock (buttons, dividers) and, for a tab without its own layout, the default. */
  applySettings() {
    this.applyLooks();
    for (const l of this.lanes) l.applySettings();
    const cols = this.layoutColumns();
    if (formatLayout(cols) !== formatLayout(this.columns) || laneCount(cols) !== this.lanes.length) {
      void this.relayout();
    } else if (this.drawKey() !== this.drawn) this.draw();
  }

  /** Settings that change how cards look (on the tab's element, so tabs in popouts follow too). */
  private applyLooks() {
    const s = this.plugin.settings;
    const root = this.contentEl;
    root.toggleClass("lane-compact", s.headerSize === "compact");
    root.toggleClass("lane-capped", s.noteHeight === "cap");
    root.style.setProperty("--lane-note-max-height", `${s.noteMaxHeight}px`);
    // Backlinks Full View skips note views inside an element with this attribute (and the CSS hides its panes
    // if an older BFV doesn't know it): a cheap cross-plugin signal, no API between the plugins needed.
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

  /** The columns as shown (dragged widths included), as the base for adding or removing a lane. */
  private shownColumns(): LayoutColumn[] {
    const shares = effectiveShares(this.columns, this.sizes, this.locked);
    return this.columns.map((c, i) => ({ ...c, width: shares.cols[i] }));
  }

  /**
   * Unlocked: a new, empty lane beside `lane`. Left / right is a new column ("New lane width": half of the lane's
   * column, a fixed width, or the lane's width); up / down stacks one more lane in its column. The tab then has
   * its own layout. Returns the new lane.
   */
  async addLaneBeside(lane: Lane, side: Side): Promise<Lane | null> {
    if (this.locked) {
      this.plugin.lockedNotice();
      return null;
    }
    const index = this.lanes.indexOf(lane);
    const base = this.shownColumns();
    const res = insertLane(base, index, side);
    if (!res) {
      new Notice("This tab can't take more lanes there (at most 8 columns, 6 lanes per column)");
      return null;
    }
    const mode = this.plugin.settings.newLaneWidth;
    const at = slotOf(res.columns, res.index);
    const width = this.gridEl?.clientWidth ?? 0;
    if ((side === "left" || side === "right") && mode !== "equal" && at && width > 0) {
      const src = slotOf(base, index);
      const target =
        mode === "fixed" ? this.plugin.settings.newLaneWidthPx : ((src ? base[src.col].width : 0) * width) / 100;
      const px = res.columns.map(c => (c.width * width) / 100);
      const shares = shareWithTarget(px, at.col, target);
      res.columns.forEach((c, i) => (c.width = shares[i]));
    }
    this.override = formatLayout(res.columns);
    this.sizes = null;
    await this.relayout(planInsert(this.lanes.length, res.index));
    const created = this.lanes[res.index] ?? null;
    if (created) this.plugin.lastLane = created;
    return created;
  }

  /** Unlocked: remove `lane`; its notes move to the lane before it. The tab then has its own layout. */
  removeLane(lane: Lane) {
    if (this.locked) return this.plugin.lockedNotice();
    const index = this.lanes.indexOf(lane);
    const cols = removeLane(this.shownColumns(), index);
    if (!cols) return;
    this.override = formatLayout(cols);
    this.sizes = null;
    void this.relayout(planRemove(this.lanes.length, index));
  }

  /** The lane opens go to when they don't name one: the one used last here, else the first. */
  currentLane(): Lane | null {
    return this.lastLane && this.lanes.includes(this.lastLane) ? this.lastLane : (this.lanes[0] ?? null);
  }

  // ---------- menus ----------

  /** The tab's ⋯ menu and its tab header's right-click menu (Obsidian's items, such as Split, come first). */
  override onPaneMenu(menu: Menu, source: string) {
    super.onPaneMenu(menu, source);
    menu.addItem(i =>
      i
        .setSection("pane")
        .setTitle("Lane layout…")
        .setIcon("layout-grid")
        .onClick(() => this.openLayoutDialog()),
    );
    if (this.sizes && !this.locked) {
      menu.addItem(i =>
        i
          .setSection("pane")
          .setTitle("Reset lane sizes")
          .setIcon("rotate-ccw")
          .onClick(() => this.resetSizes()),
      );
    }
  }

  /** A lane's own menu: its header's ⋯ button and a right-click on its background. */
  addLaneMenuItems(menu: Menu, lane: Lane) {
    if (!this.locked) {
      for (const [side, title, icon] of ADD_LANE) {
        menu.addItem(i =>
          i
            .setSection("lane")
            .setTitle(title)
            .setIcon(icon)
            .onClick(() => void this.addLaneBeside(lane, side)),
        );
      }
      menu.addItem(i =>
        i
          .setSection("lane")
          .setTitle("Remove this lane")
          .setIcon("x")
          .setDisabled(this.lanes.length <= 1)
          .onClick(() => this.removeLane(lane)),
      );
    }
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
 * 0.1's one-lane view, registered only so old layouts load without "plugin not active" placeholders: such a
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
    this.contentEl.setText("Replaced by lanes tabs in Editor Lanes 0.2; this tab closes.");
    this.plugin.requestLegacyCleanup();
  }
}
