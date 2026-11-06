import {
  App,
  Keymap,
  Menu,
  Notice,
  Platform,
  TFile,
  WorkspaceLeaf,
  WorkspaceSplit,
  getLinkpath,
  setIcon,
} from "obsidian";
import type EditorLanesPlugin from "./main";
import type { LanesView } from "./lanes-view";
import { asEl } from "./dom";
import { DropEffect, clampIn, linkpathsInText, pickDropEffect } from "./dnd";
import { noteNameError, tidyName } from "./names";
import { accordionCollapse, insertIndex, overExpanded, overLimit } from "./tidy";
import { AddOpts, Item, ItemData, Taken, stamp } from "./types";

let srHintSeq = 0;

/**
 * One lane of a lanes tab: a column (or a stacked row) holding a scrollable list of note cards, newest on top,
 * each a real Obsidian editor in a hosted WorkspaceLeaf (see the comment at the top of main.ts). Not a leaf or
 * a view itself: the tab (LanesView) builds its lanes from its layout, places their elements in its grid and
 * saves their notes in its view state.
 */
export class Lane {
  items: Item[] = [];
  /** The lane's element: a small header, then the list of cards. The tab moves it when its layout changes. */
  readonly el: HTMLElement;
  private listEl: HTMLElement;
  private emptyEl: HTMLElement;
  private observer: IntersectionObserver | null = null;
  private observerMargin = -1; // the pre-load distance the observer was built with
  private observerWin: Window | null = null; // and the window (a tab moved to a popout needs a new one)
  private lazyQueue: Item[] = [];
  private draining = false;

  constructor(
    readonly tab: LanesView,
    private plugin: EditorLanesPlugin,
  ) {
    // made in the tab's own window (main or popout), like everything an IntersectionObserver watches
    const root = (this.el = tab.contentEl.createDiv({ cls: "lane" }));
    // pointerdown: mouse, pen and touch alike (a tap's emulated mousedown can be skipped)
    root.addEventListener("pointerdown", () => this.plugin.notePointerIn(this), { capture: true });
    this.emptyEl = root.createDiv({
      cls: "lane-empty",
      text: Platform.isMobile
        ? "Open a note, long-press a link → Open in editor lane, or drag a note here."
        : "Open a note, Shift-click a link, or drag a note or link here.",
    });
    this.listEl = root.createDiv({ cls: "lane-list" });
    this.updateEmpty();
    this.setupDrop(root);
    // Right-click (touch: long-press) on the lane's background (not a card): the lane's menu (lanes have no
    // header of their own: the layout comes from the settings or the tab's "Lane layout…"). Obsidian turns a long-press into a contextmenu event on iOS; Android sends one itself.
    root.addEventListener("contextmenu", e => {
      if (asEl(e.target)?.closest(".lane-item")) return;
      e.preventDefault();
      const menu = new Menu();
      this.tab.addLaneMenuItems(menu, this);
      menu.showAtMouseEvent(e);
    });
    this.applySettings();
  }

  private get app(): App {
    return this.plugin.app;
  }

  private save() {
    this.tab.save();
  }

  /** What a lane shows and how it loads, from the settings; called when made and whenever settings change. */
  applySettings() {
    for (const it of this.items) this.updateTitle(it);
    if (this.observerMargin !== this.plugin.settings.preloadDistance || this.observerWin !== this.el.win) {
      this.buildObserver();
    }
  }

  /** The tab moved to another window: lazy mounting needs an observer from that window. */
  checkWindow() {
    if (this.observerWin !== this.el.win) this.buildObserver();
  }

  /** Detach every hosted leaf and stop observing. Safe to call twice. */
  destroy() {
    for (const it of this.items) this.unmount(it);
    this.items = [];
    this.lazyQueue = [];
    this.listEl.empty();
    this.observer?.disconnect();
    this.observer = null;
    this.observerMargin = -1;
    if (this.plugin.lastLane === this) this.plugin.lastLane = null;
  }

  // ---------- persistence (the tab's view state) ----------

  getState(): ItemData[] {
    return this.items.map(i => ({ path: i.file.path, collapsed: i.collapsed, pinned: i.pinned, openedAt: i.openedAt }));
  }

  /** Cards from a saved state (an empty lane only). Notes that no longer exist are skipped. */
  load(list: readonly ItemData[]) {
    if (this.items.length) return;
    list.forEach((d, n) => {
      const f = this.app.vault.getAbstractFileByPath(d.path);
      if (!(f instanceof TFile) || this.items.some(i => i.file === f)) return;
      // no stamp saved: the top note counts as the most recently opened
      const it = this.createItem(f, d.collapsed, !!d.pinned, d.openedAt ?? list.length - n);
      this.place(it, this.items.length); // pinned ones end up first
      if (!it.collapsed) this.mountLazily(it);
    });
    this.updateEmpty();
  }

  /** The vault changed: a deleted note's card closes, a renamed one's title follows. */
  onFileDeleted(f: unknown) {
    for (const it of this.items.filter(i => i.file === f)) this.close(it);
  }
  onFileRenamed(f: unknown) {
    const it = this.items.find(i => i.file === f);
    if (!it) return;
    this.updateTitle(it);
    this.save();
  }

  /**
   * Expanded notes restored from a layout (or "Expand all") mount once they're scrolled within the pre-load
   * distance. IntersectionObserver's rootMargin is fixed at construction, so a new distance needs a new one;
   * every expanded note that hasn't mounted yet is observed again.
   */
  private buildObserver() {
    this.observer?.disconnect();
    this.observer = null;
    const margin = this.plugin.settings.preloadDistance;
    this.observerMargin = margin;
    this.observerWin = this.el.win;
    try {
      const IO: typeof IntersectionObserver = (this.el.win as any)?.IntersectionObserver ?? IntersectionObserver;
      this.observer = new IO(
        entries => {
          for (const en of entries) {
            if (!en.isIntersecting) continue;
            const it = this.items.find(i => i.el === en.target);
            if (it && !it.collapsed && !it.leaf && !this.lazyQueue.includes(it)) this.lazyQueue.push(it);
          }
          void this.drainLazy();
        },
        { root: this.listEl, rootMargin: `${margin}px 0px` },
      );
    } catch {
      this.observer = null;
    }
    for (const it of this.items) if (!it.collapsed && !it.leaf) this.mountLazily(it);
  }

  // ---------- items ----------

  /**
   * Add a note where "New notes go" says (by default the top, below any pinned notes), or at `opts.index`, and
   * expand it. A note already in this lane moves there instead; a pinned one keeps its place. Then the
   * "Keeping lanes tidy" rules run, never touching this note.
   */
  async add(file: TFile, opts: AddOpts = {}) {
    this.plugin.lastLane = this;
    let it = this.items.find(i => i.file === file);
    const isNew = !it;
    if (!it) it = this.createItem(file, false);
    it.openedAt = stamp();
    const cur = this.items.indexOf(it);
    if (opts.index !== undefined) this.placeAt(it, cur >= 0 && cur < opts.index ? opts.index - 1 : opts.index);
    else if (!it.pinned || cur < 0) {
      const others = this.items.filter(i => i !== it);
      this.place(it, insertIndex(others, this.plugin.settings.newNotePosition, opts.after));
    }
    this.updateEmpty();
    if (!it.leaf && opts.mode) it.pending = { ...it.pending, mode: opts.mode };
    if (isNew) this.closeOverLimit(it);
    await this.setCollapsed(it, false);
    this.afterExpand(it);
    if (opts.index === undefined) this.scrollToItem(it);
    if (opts.focus !== false) this.tab.showLane(this); // phones: switch to this lane
    const leaf: any = it.leaf;
    if (leaf) {
      if (opts.mode && leaf.getViewState().state?.mode !== opts.mode) {
        const vs = leaf.getViewState();
        await leaf.setViewState({ ...vs, state: { ...vs.state, mode: opts.mode } });
      }
      if (isNew && opts.history) {
        try {
          leaf.history?.deserialize?.(opts.history);
        } catch {
          /* ignore */
        }
      }
      if (opts.focus) this.app.workspace.setActiveLeaf(leaf, { focus: true });
      // after focusing: e.g. a #heading link scrolls to it, `rename` (new note) selects the title
      if (opts.eState) leaf.setEphemeralState(opts.eState);
    }
    this.save();
  }

  private createItem(file: TFile, collapsed: boolean, pinned = false, openedAt = stamp()): Item {
    const el = createDiv({ cls: "lane-item" });
    const header = el.createDiv({ cls: "lane-item-header" });
    const chevEl = header.createEl("button", { cls: "lane-chevron" });
    const hintId = `lane-title-hint-${++srHintSeq}`;
    // full path: the folder is a fixed prefix, only the name after it is editable
    const nameEl = header.createSpan({ cls: "lane-item-name" });
    const pathEl = nameEl.createSpan({ cls: "lane-item-path" });
    // Desktop: the title is always editable (click to rename). Touch: a tap on it toggles the note like the
    // rest of the header (a tap would otherwise bring up the keyboard); "Rename note" in the card's menu (a
    // long-press on the header) makes it editable until it loses focus.
    const titleEl = nameEl.createSpan({
      cls: "lane-item-title",
      attr: {
        contenteditable: String(!Platform.isMobile),
        spellcheck: "false",
        role: "textbox",
        "aria-describedby": hintId,
      },
    });
    header.createSpan({ cls: "lane-sr-only", text: "Note name. Edit to rename the note.", attr: { id: hintId } });
    const pinEl = header.createEl("button", { cls: "lane-pin clickable-icon" });
    setIcon(pinEl, "pin");
    const closeEl = header.createEl("button", { cls: "lane-close", text: "✕", attr: { "aria-label": "Close" } });
    const bodyEl = el.createDiv({ cls: "lane-item-body" });
    const it: Item = {
      file,
      collapsed,
      pinned,
      openedAt,
      el,
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
      cancelEdit: false,
    };
    this.updateTitle(it);
    this.applyCollapsed(it);
    this.applyPinned(it);
    pinEl.addEventListener("click", e => {
      e.stopPropagation();
      this.togglePin(it);
    });

    // drag the header to reorder the card, or onto another lane to move it there. Elsewhere it drags like a
    // file (onto an editor: a link; onto a tab bar: open it). Not while the title is being edited, so text
    // can be selected with the mouse.
    header.draggable = true;
    header.addEventListener("dragstart", e => {
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
        /* plain drag */
      }
    });
    header.addEventListener("dragend", () => this.plugin.endItemDrag());
    titleEl.addEventListener("focus", () => {
      header.draggable = false;
    });
    titleEl.addEventListener("blur", () => {
      header.draggable = true;
    });

    // header click (or the chevron button, which also takes Enter / Space) toggles the note
    header.addEventListener("click", e => {
      if ((e.target as HTMLElement).closest('.lane-item-title[contenteditable="true"], .lane-close, .lane-pin')) return;
      const expanding = it.collapsed;
      if (expanding) it.openedAt = stamp();
      void this.setCollapsed(it, !it.collapsed).then(() => {
        if (expanding) this.afterExpand(it);
        this.save();
      });
    });
    // an expanded note that hasn't mounted yet (see mountLazily): clicking its placeholder mounts it
    bodyEl.addEventListener("pointerdown", () => {
      if (!it.collapsed && !it.leaf) void this.mount(it);
    });
    // title: edit it to rename the note, like Obsidian's inline title. Ctrl/Cmd-click opens the note instead
    // (a new lanes tab; with lanes only off, a new tab).
    titleEl.addEventListener("mousedown", e => {
      if (!Keymap.isModEvent(e)) return;
      e.preventDefault();
      if (this.plugin.settings.lanesOnly) void this.plugin.openInLane(it.file, "newTab", this, { focus: true });
      else void this.app.workspace.getLeaf("tab").openFile(it.file);
    });
    titleEl.addEventListener("focus", () => {
      // kept across a window blur / refocus, so a half-typed name is still compared with the original
      if (it.editStart === null) it.editStart = titleEl.textContent ?? "";
    });
    titleEl.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        titleEl.blur();
      } // commit (blur renames)
      else if (e.key === "Escape") {
        // cancel
        e.preventDefault();
        it.cancelEdit = true;
        titleEl.setText(it.file.basename);
        titleEl.blur();
      } else if (e.key === "ArrowDown" && it.leaf) {
        // like the inline title: into the note
        e.preventDefault();
        this.app.workspace.setActiveLeaf(it.leaf, { focus: true });
      }
    });
    titleEl.addEventListener("paste", e => {
      // plain text, one line
      e.preventDefault();
      const text = (e.clipboardData?.getData("text/plain") ?? "").replace(/[\r\n]+/g, " ");
      titleEl.doc.execCommand("insertText", false, text);
    });
    titleEl.addEventListener("blur", () => {
      // the window losing focus also blurs: keep editing, commit on the next real blur or Enter
      if (!it.cancelEdit && !titleEl.doc.hasFocus()) return;
      if (Platform.isMobile) titleEl.setAttr("contenteditable", "false");
      void this.renameFromTitle(it);
    });
    closeEl.addEventListener("click", e => {
      e.stopPropagation();
      this.close(it);
    });
    // Right-click on the header; on touch a long-press: Obsidian's drag manager starts a drag of the header and,
    // when it ends without moving, sends this contextmenu (see app.js DragManager.onDragEnd).
    header.addEventListener("contextmenu", e => {
      e.preventDefault();
      const menu = new Menu();
      const at = this.items.indexOf(it);
      menu.addItem(i =>
        i
          .setTitle("Open in next lane")
          .setIcon("arrow-right")
          .onClick(() => void this.plugin.openInLane(it.file, "next", this, { focus: true })),
      );
      menu.addItem(i =>
        i
          .setTitle("Open in new lanes tab")
          .setIcon("columns-3")
          .onClick(() => void this.plugin.openInLane(it.file, "newTab", this, { focus: true })),
      );
      menu.addItem(i =>
        i
          .setTitle("Move to top")
          .setIcon("arrow-up-to-line")
          .setDisabled(at <= 0)
          .onClick(() => this.placeAt(it, 0)),
      );
      // touch has no reliable way to drag a card a short way: one place up or down (pinned notes stay on top)
      menu.addItem(i =>
        i
          .setTitle("Move up")
          .setIcon("arrow-up")
          .setDisabled(at <= 0)
          .onClick(() => this.placeAt(it, Math.max(0, this.items.indexOf(it) - 1))),
      );
      menu.addItem(i =>
        i
          .setTitle("Move down")
          .setIcon("arrow-down")
          .setDisabled(at < 0 || at >= this.items.length - 1)
          .onClick(() => this.placeAt(it, this.items.indexOf(it) + 1)),
      );
      menu.addItem(i =>
        i
          .setTitle("Move to previous lane")
          .setIcon("arrow-left")
          .onClick(() => void this.plugin.moveToLane(this, it, -1)),
      );
      menu.addItem(i =>
        i
          .setTitle("Move to next lane")
          .setIcon("arrow-right")
          .onClick(() => void this.plugin.moveToLane(this, it, 1)),
      );
      menu.addSeparator();
      menu.addItem(i =>
        i
          .setTitle("Rename note")
          .setIcon("pencil")
          .onClick(() => window.setTimeout(() => this.editTitle(it, "all"), 0)),
      );
      menu.addItem(i =>
        i
          .setTitle(it.pinned ? "Unpin" : "Pin")
          .setIcon(it.pinned ? "pin-off" : "pin")
          .onClick(() => this.togglePin(it)),
      );
      menu.addItem(i =>
        i
          .setTitle("Close")
          .setIcon("x")
          .setDisabled(it.pinned)
          .onClick(() => this.close(it)),
      );
      menu.addItem(i =>
        i
          .setTitle("Close others")
          .setIcon("x-circle")
          .onClick(() => {
            for (const o of [...this.items]) if (o !== it && !o.pinned) this.close(o);
          }),
      );
      // no leaf: with one, core "linked view" items (local graph, outline…) would split the private split
      this.app.workspace.trigger("file-menu", menu, it.file, "editor-lanes", undefined);
      menu.showAtMouseEvent(e);
    });
    return it;
  }

  /** Focus the card title and select it, for `eState.rename` ("all" / "start" / "end"), e.g. a new note or F2. */
  private editTitle(it: Item, how: unknown) {
    const el = it.titleEl;
    el.setAttr("contenteditable", "true"); // touch: editable until it loses focus
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
  private async renameFromTitle(it: Item) {
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
    } // nothing typed
    const name = tidyName(raw);
    if (!name || name === it.file.basename) {
      this.updateTitle(it);
      return;
    }
    const refuse = (msg: string) => {
      new Notice(msg);
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
      refuse(`Couldn't rename: ${(e as Error)?.message ?? e}`);
    }
  }

  private updateTitle(it: Item) {
    // the folder prefix is drawn right-to-left (so a long one is cut from the left); the LRM keeps the
    // trailing "/" on the right of it
    const showFolder = this.plugin.settings.showFolder;
    const folder = showFolder && it.file.parent && it.file.parent.path !== "/" ? it.file.parent.path + "/\u200E" : "";
    it.pathEl.setText(folder);
    it.pathEl.setAttr("title", it.file.path);
    if (it.titleEl.doc.activeElement === it.titleEl) return; // don't overwrite a name being edited
    it.titleEl.setText(it.file.basename);
    it.titleEl.setAttr("aria-label", it.file.path);
  }

  private applyCollapsed(it: Item) {
    it.el.toggleClass("is-collapsed", it.collapsed);
    it.chevEl.setText(it.collapsed ? "▸" : "▾");
    it.chevEl.setAttr("aria-expanded", String(!it.collapsed));
    it.chevEl.setAttr("aria-label", it.collapsed ? "Expand note" : "Collapse note");
  }

  /** Collapsing unmounts the editor (its mode and cursor are kept for the next expand). */
  async setCollapsed(it: Item, collapsed: boolean) {
    it.collapsed = collapsed;
    this.applyCollapsed(it);
    if (collapsed) this.unmount(it, true);
    else await this.mount(it);
  }

  setAllCollapsed(collapsed: boolean) {
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

  /** "Accordion mode" / "Auto-collapse after N expanded", after `it` was opened or expanded. */
  private afterExpand(it: Item) {
    const s = this.plugin.settings;
    const extra = s.accordion ? accordionCollapse(this.items, it) : overExpanded(this.items, s.autoCollapseAfter, it);
    for (const o of extra) void this.setCollapsed(o, true);
    if (extra.length) this.save();
  }

  /** "Maximum notes per lane": close the least recently opened unpinned notes beyond it, never `keep`. */
  private closeOverLimit(keep: Item) {
    for (const o of overLimit(this.items, this.plugin.settings.maxNotesPerLane, keep)) this.close(o);
  }

  /** "Note already open in another lane: jump to it": show, expand and focus this lane's card. */
  async reveal(it: Item) {
    this.plugin.lastLane = this;
    await this.app.workspace.revealLeaf(this.tab.leaf);
    if (it.collapsed) {
      it.openedAt = stamp();
      await this.setCollapsed(it, false);
      this.afterExpand(it);
      this.save();
    }
    this.scrollToItem(it);
    this.tab.showLane(this);
    if (it.leaf) this.app.workspace.setActiveLeaf(it.leaf, { focus: true });
    else it.titleEl.focus();
  }

  close(it: Item) {
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
  place(it: Item, index: number) {
    this.items.remove(it);
    const i = clampIn(this.items, it.pinned, index);
    this.items.splice(i, 0, it);
    const next = this.items[i + 1];
    this.listEl.insertBefore(it.el, next ? next.el : null);
  }

  /** Reorder a note of this lane (`index` counted without it). */
  placeAt(it: Item, index: number) {
    this.place(it, index);
    this.updateEmpty();
    this.save();
  }

  togglePin(it: Item) {
    it.pinned = !it.pinned;
    this.applyPinned(it);
    // pinning: to the end of the pinned notes; unpinning: to the top of the others
    this.placeAt(it, it.pinned ? this.items.length : 0);
  }

  private applyPinned(it: Item) {
    it.el.toggleClass("is-pinned", it.pinned);
    it.pinEl.setAttr("aria-label", it.pinned ? "Unpin" : "Pin");
    it.pinEl.setAttr("aria-pressed", String(it.pinned));
  }

  scrollToItem(it: Item) {
    const top = it.el.getBoundingClientRect().top - this.listEl.getBoundingClientRect().top;
    this.listEl.scrollTop = Math.max(0, this.listEl.scrollTop + top - 12);
  }

  /** Remove a card to move it to another lane: its editor closes, keeping its mode and cursor. */
  take(it: Item): Taken {
    this.unmount(it, true);
    it.el.remove();
    this.items.remove(it);
    this.updateEmpty();
    this.save();
    return { file: it.file, collapsed: it.collapsed, pinned: it.pinned, pending: it.pending, openedAt: it.openedAt };
  }

  /**
   * A card moved here from another lane. If this lane already has the note, that card moves instead.
   * `focus`: make it the active note (a user's move; not when a layout change merges lanes).
   */
  async insertTaken(d: Taken, index: number, focus = true) {
    if (focus) this.plugin.lastLane = this;
    let it = this.items.find(i => i.file === d.file);
    if (it) {
      const cur = this.items.indexOf(it);
      if (d.pinned && !it.pinned) {
        it.pinned = true;
        this.applyPinned(it);
      }
      this.place(it, cur < index ? index - 1 : index);
      if (!d.collapsed && it.collapsed) await this.setCollapsed(it, false);
    } else {
      it = this.createItem(d.file, d.collapsed, d.pinned, d.openedAt);
      it.pending = d.pending;
      this.place(it, index);
      if (focus) this.closeOverLimit(it);
      if (!it.collapsed) {
        if (focus) await this.mount(it);
        else this.mountLazily(it);
      }
    }
    this.updateEmpty();
    if (focus && !it.collapsed) {
      it.openedAt = stamp();
      this.afterExpand(it);
    }
    this.save();
    if (focus) this.tab.showLane(this);
    if (focus && !it.collapsed && it.leaf) this.app.workspace.setActiveLeaf(it.leaf, { focus: true });
  }

  private updateEmpty() {
    this.tab.laneChanged(this);
    this.emptyEl.toggleClass("lane-hidden", this.items.length > 0);
  }

  // ---------- hosted editors ----------

  /** Mount an expanded note once it's near the visible part of the lane (one at a time). */
  private mountLazily(it: Item) {
    if (it.leaf) return;
    if (this.observer) this.observer.observe(it.el);
    else void this.mount(it);
  }

  private async drainLazy() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.lazyQueue.length) {
        const it = this.lazyQueue.shift()!;
        if (!this.items.includes(it) || it.collapsed || it.leaf) continue;
        // notes mounted before this one may have pushed it out of view; the observer reports it again
        if (!this.nearView(it.el)) continue;
        await this.mount(it);
        await new Promise(r => window.setTimeout(r, 16)); // let it lay out before measuring the next
      }
    } finally {
      this.draining = false;
    }
  }

  private nearView(el: HTMLElement): boolean {
    const r = el.getBoundingClientRect();
    const v = this.listEl.getBoundingClientRect();
    const m = this.plugin.settings.preloadDistance;
    return v.height > 0 && r.top < v.bottom + m && r.bottom > v.top - m;
  }

  /** Create the item's private split + leaf and open the note in it. */
  private mount(it: Item): Promise<void> {
    if (!it.ready) it.ready = this.doMount(it);
    return it.ready;
  }

  private async doMount(it: Item) {
    this.observer?.unobserve(it.el);
    const ws = this.app.workspace as any;
    const split = new (WorkspaceSplit as any)(ws, "horizontal");
    // Not a child of the right sidebar (see the comment at the top). `parent` is looked up on every read:
    // loading a layout (startup, the Workspaces plugin) replaces workspace.rightSplit, and setLayout builds
    // the main area, and so restores lanes, before the new right sidebar exists. A stored reference would
    // point at the old one (or null), and the hosted leaves would stop counting as attached.
    let detached = false;
    Object.defineProperty(split, "parent", {
      configurable: true,
      get: () => (detached ? null : (ws.rightSplit ?? null)),
      set: v => {
        if (v === null) detached = true;
      },
    });
    // mod-visible: on phones Obsidian hides every .workspace-split inside the main area without it (the
    // hosted split isn't in the layout tree, so updateMobileVisibleTabGroup never sets or clears it)
    split.containerEl.addClass("lane-split", "mod-visible");
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
    this.plugin.hostedLeaves.set(leaf, { lane: this, item: it });
    // Pinned: a link followed from here takes the normal open path (and lanes-only routing), because
    // getUnpinnedLeaf skips leaves that can't navigate. Unpinning is what Ctrl+W does to a pinned leaf in
    // the sidebar, so it closes the card instead; "Toggle pin" does nothing.
    const origSetPinned = leaf.setPinned?.bind(leaf);
    origSetPinned?.(true);
    leaf.setPinned = (v: boolean) => {
      if (!v && it.leaf === leaf && !it.pinned) this.close(it);
    };
    leaf.togglePinned = () => {};
    // "Close tab" / anything else that detaches a hosted note closes the item properly
    const origDetach = leaf.detach.bind(leaf);
    leaf.detach = () => {
      if (it.leaf === leaf && !leaf.__laneUnmounting) this.close(it);
      else origDetach();
    };
    // the tab's window (main or popout), so focusing the note doesn't raise the main window
    leaf.getContainer = () => this.tab.leaf.getContainer();
    // `rename` would act on the (hidden) inline title: edit the card title instead
    const origSetEState = leaf.setEphemeralState.bind(leaf);
    leaf.setEphemeralState = (e: any) => {
      if (e?.rename) {
        const how = e.rename;
        e = { ...e };
        delete e.rename;
        window.setTimeout(() => this.editTitle(it, how), 0); // after any editor focus from the same open
      }
      return origSetEState(e);
    };
    it.bodyEl.appendChild(split.containerEl);
    const pending = it.pending;
    it.pending = null;
    try {
      await leaf.openFile(it.file, {
        active: false,
        state: pending?.mode ? { mode: pending.mode } : undefined,
        eState: pending?.eState,
      });
    } catch (e) {
      console.error("[editor-lanes] could not open", it.file.path, e);
      it.bodyEl.createDiv({ cls: "lane-empty", text: "Couldn't open this note." });
    }
  }

  /** Detach the item's hosted leaf. `keep`: remember its mode and cursor for the next mount. */
  private unmount(it: Item, keep = false) {
    this.observer?.unobserve(it.el);
    if (!it.split) return;
    const split = it.split;
    const leaf: any = it.leaf;
    if (keep && leaf) {
      try {
        it.pending = { mode: leaf.getViewState().state?.mode, eState: leaf.getEphemeralState() };
      } catch {
        it.pending = null;
      }
    }
    this.plugin.splits.delete(split);
    if (leaf) this.plugin.hostedLeaves.delete(leaf);
    // Unhook first: an emptied split removes itself from its parent, and it was never the parent's child.
    split.parent = null; // the setter marks it detached
    it.split = null;
    it.leaf = null;
    it.ready = null;
    if (leaf) {
      leaf.__laneUnmounting = true;
      this.plugin.detachQuietly(leaf); // no "Undo close tab" entry per hosted note: the lane's own entry restores them
    }
    split.containerEl.remove();
  }

  // ---------- drag and drop ----------

  /**
   * A card dragged by its header (capture phase, so it moves even when dropped on a note's editor, which
   * would otherwise insert a link) and notes / links dragged from anywhere else: the explorer, tabs, search,
   * links in Reading view, a selected [[link]] or obsidian:// URL. Those open at the drop point, unless
   * they're dropped on a note's body: there the editor takes them as usual (a link inserted into the note),
   * or, with "Dropping a note or link onto a note's text: open it in the lane", the lane takes them in the
   * capture phase too. Only drags Obsidian's drag manager knows (files, links) are taken over a body: a plain
   * text drag there still moves text between notes.
   */
  private setupDrop(root: HTMLElement) {
    const dm = () => this.app.dragManager;
    const inBody = (t: EventTarget | null) => !!asEl(t)?.closest(".lane-item-body");
    const takeOverBody = (e: DragEvent) =>
      this.plugin.settings.dropOnText === "open" && inBody(e.target) && this.dropFiles(e, true).length > 0;
    const onBody = (e: DragEvent) => {
      if (this.plugin.dragItem || !takeOverBody(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setDropEffect(e, ["link", "copy", "move"]);
      this.showDrop(this.dropIndex(e.clientY), false);
      dm()?.setAction?.("Open in this lane");
    };
    root.addEventListener("dragenter", onBody, { capture: true });
    root.addEventListener("dragover", onBody, { capture: true });
    root.addEventListener(
      "drop",
      e => {
        if (this.plugin.dragItem || !takeOverBody(e)) return;
        e.preventDefault();
        e.stopPropagation();
        const index = this.dropIndex(e.clientY);
        this.clearDrop();
        void this.addDropped(this.dropFiles(e, true), index);
      },
      { capture: true },
    );
    const onCard = (e: DragEvent) => {
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
      e => {
        const d = this.plugin.dragItem;
        if (!d) return;
        e.preventDefault();
        e.stopPropagation();
        const index = this.dropIndex(e.clientY, d.item);
        this.plugin.endItemDrag();
        void this.plugin.moveItem(d.lane, d.item, this, index);
      },
      { capture: true },
    );

    root.addEventListener("dragover", e => {
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
    root.addEventListener("dragleave", e => {
      if (!root.contains(e.relatedTarget as Node | null)) this.clearDrop();
    });
    root.addEventListener("drop", e => {
      if (this.plugin.dragItem) return;
      const index = this.dropIndex(e.clientY);
      this.clearDrop();
      if (e.defaultPrevented || inBody(e.target)) return;
      const files = this.dropFiles(e, false);
      if (!files.length) return;
      e.preventDefault();
      e.stopPropagation();
      void this.addDropped(files, index);
    });
  }

  /** Dropped notes open in order from `index`. */
  private async addDropped(files: TFile[], index: number) {
    let i = index;
    for (const f of files) {
      await this.add(f, { index: i });
      i = this.items.findIndex(x => x.file === f) + 1;
    }
  }

  /** Where a drop at `y` goes: before the first card whose middle is below it (`skip`: the card being moved). */
  private dropIndex(y: number, skip?: Item): number {
    const list = this.items.filter(i => i !== skip);
    for (let i = 0; i < list.length; i++) {
      const r = list[i].el.getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return list.length;
  }

  /** Outline the lane and draw a line where the drop will land. */
  private showDrop(index: number, pinned: boolean, skip?: Item) {
    this.clearDrop();
    this.el.addClass("is-drop-target");
    const list = this.items.filter(i => i !== skip);
    if (!list.length) return;
    const i = clampIn(list, pinned, index);
    if (i < list.length) list[i].el.addClass("lane-drop-before");
    else list[list.length - 1].el.addClass("lane-drop-after");
  }

  clearDrop() {
    this.el.removeClass("is-drop-target");
    for (const it of this.items) it.el.removeClass("lane-drop-before", "lane-drop-after");
  }

  /** Notes being dragged (Obsidian's drag manager, or an obsidian:// URL / [[link]] as text). */
  private dropFiles(e: DragEvent, peek: boolean): TFile[] {
    const out: TFile[] = [];
    const add = (f: unknown) => {
      if (f instanceof TFile && f.extension === "md" && !out.includes(f)) out.push(f);
    };
    const d = this.app.dragManager?.draggable;
    if (d) {
      if (d.type === "file") add(d.file);
      else if (d.type === "files") (d.files ?? []).forEach(add);
      else if (d.type === "link" && d.linktext) {
        add(this.app.metadataCache.getFirstLinkpathDest(getLinkpath(d.linktext), d.sourcePath ?? ""));
        add(d.file);
      }
    }
    if (out.length || peek) return out;
    for (const p of linkpathsInText(e.dataTransfer?.getData("text/plain") ?? "")) {
      add(this.app.metadataCache.getFirstLinkpathDest(p, ""));
    }
    return out;
  }
}

/** Set the drop effect to the first of `prefs` the drag source allows. */
function setDropEffect(e: DragEvent, prefs: DropEffect[]) {
  const p = e.dataTransfer ? pickDropEffect(e.dataTransfer.effectAllowed, prefs) : null;
  if (p && e.dataTransfer) e.dataTransfer.dropEffect = p;
}
