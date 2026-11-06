// Obsidian internals Editor Lanes relies on (not in the public API). Checked against Obsidian 1.15.0's
// app.js; see the comment at the top of main.ts for how they're used.
import "obsidian";
import type { EditorView } from "@codemirror/view";

declare module "obsidian" {
  interface Vault {
    /** A vault setting from .obsidian/app.json (e.g. "defaultViewMode", "livePreview"). */
    getConfig?(key: string): unknown;
  }

  interface App {
    /** Tracks the current drag: `draggable` is what Obsidian's own drop targets read. */
    dragManager?: DragManager;
    /** Mobile only (null on the desktop): the full-screen tab switcher; `isVisible` while it's open. */
    mobileTabSwitcher?: { isVisible: boolean } | null;
    /** Core plugins. getEnabledPluginById(id) is the plugin's instance while it's enabled, else null. */
    internalPlugins?: { getEnabledPluginById(id: string): unknown };
  }

  interface View {
    /**
     * Fills a tab header's menu (right-click on a tab; long-press in the mobile tab switcher). Obsidian then
     * calls onPaneMenu(menu, "tab-header"), except for a tab that isn't shown and in the mobile tab switcher.
     */
    onTabMenu(menu: Menu): void;
  }

  interface ItemView {
    /** The view header's title, set from getDisplayText() when the view loads. */
    titleEl?: HTMLElement;
  }

  interface DragManager {
    draggable: Draggable | null;
    dragFile(evt: DragEvent, file: TFile, source?: string): Draggable;
    onDragStart(evt: DragEvent, draggable: Draggable): void;
    setAction(text: string | null): void;
  }

  interface Draggable {
    type: "file" | "files" | "folder" | "link" | string;
    file?: TAbstractFile;
    files?: TAbstractFile[];
    linktext?: string;
    sourcePath?: string;
  }

  interface Workspace {
    /** Holds the popout windows (WorkspaceWindow, `type` "window"); a popout leaf's getRoot() is this. */
    floatingSplit: WorkspaceParent & {
      children: (WorkspaceParent & { doc?: Document; win?: Window | null; type?: string })[];
    };
    /** Walks `root`'s children; the callback returning true stops the walk. Also called as (cb, root). */
    iterateLeaves(root: WorkspaceItem, cb: (leaf: WorkspaceLeaf) => boolean | void): boolean;
    iterateLeaves(cb: (leaf: WorkspaceLeaf) => boolean | void, root: WorkspaceItem): boolean;
    /** "Undo close tab" history: WorkspaceLeaf.detach pushes an entry synchronously (not for empty leaves). */
    pushUndoHistory(leaf: WorkspaceLeaf, parentId?: string, rootId?: string): void;
    /**
     * A new tab after the most recently active one in `parent` (default: the most recent leaf's group), or that
     * tab itself when it's an empty one.
     */
    createLeafInTabGroup(parent?: WorkspaceTabs): WorkspaceLeaf;
    /**
     * Mobile only (returns at once on the desktop): marks the active leaf's chain of parents `mod-visible` and
     * takes it off every other split / tab group under rootSplit. On phones, CSS hides main-area splits and tab
     * groups without it. Called by setActiveLeaf and on every layout update.
     */
    updateMobileVisibleTabGroup(): void;
    /**
     * Focuses the leaf's window and editor; on mobile also collapses the left / right drawers, but only for a
     * leaf whose root is rootSplit. Called by setActiveLeaf(leaf, { focus: true }).
     */
    focusLeaf(leaf: WorkspaceLeaf): void;
    /**
     * The one editor-suggest popup manager ([[ links, tags, plugin EditorSuggests). Editors call reposition() when
     * their .cm-scroller scrolls, which a card's never does.
     */
    editorSuggest?: { reposition(): void };
  }

  interface WorkspaceLeaf {
    /** Set when the leaf is linked to others ("Link with tab"). */
    group?: string | null;
    history?: {
      serialize?(): unknown;
      deserialize?(state: unknown): void;
      /**
       * Back / forward land here (after moving the entry between the stacks): setViewState(entry.state with
       * popstate, entry.eState) on the leaf, i.e. the leaf shows that entry's note in place.
       */
      updateState?(entry: { state?: { state?: { file?: unknown } }; eState?: unknown }): Promise<void>;
    };
    /** Re-reads the view's icon and display text into the tab header. */
    updateHeader?(): void;
    /** Whether the leaf's element is shown (its tab is the selected one, its window open). */
    isVisible(): boolean;
  }

  interface Keymap {
    /** Takes `scope` off its window's stack wherever it is (the top: the one below becomes current). */
    popScope(scope: Scope): void;
  }

  interface MarkdownView {
    /**
     * The editing mode (Live Preview / Source), created with the view. Its class isn't exported; one per view, so
     * each note has its own in-note search.
     */
    editMode?: MarkdownEditMode;
    /**
     * Where the note was scrolled to (a line number, fractional), re-applied by mode switches, resizes
     * (Reading view's onResize) and getEphemeralState. null: none.
     */
    scroll: number | null;
  }

  /** MarkdownView.editMode. */
  interface MarkdownEditMode {
    cm: EditorView;
    /**
     * The key scope its in-note search pushed on the window's keymap stack while the search bar is open
     * (Escape, Enter, F3…; only the top scope gets keys), else null. Set by the search's applyScope callback.
     */
    scope: Scope | null;
    /** "Search current file" / "Search & replace": its own search bar, prepended to the editor's element. */
    search?: { isActive: boolean };
    /** Scrolls to a (fractional) line by setting cm.scrollDOM.scrollTop. */
    applyScroll(line: number): void;
  }

  interface MarkdownPreviewView {
    /** Reading view's renderer (not exported); previewEl is the .markdown-preview-view it scrolls. */
    renderer?: PreviewRenderer;
  }

  interface PreviewRenderer {
    previewEl: HTMLElement;
    /**
     * Scrolls to a (fractional) line by setting previewEl.scrollTop (`center`: minus half its clientHeight;
     * `highlight`: flashes it). False when not rendered yet (applyScrollDelayed then retries once it is).
     */
    applyScroll(line: number, opts?: { center?: boolean; highlight?: boolean }): boolean;
    /** Reading view search: shows the match (`center` scrollIntoView, only when outside previewEl's view). */
    selectRange(match: PreviewMatch): void;
  }

  /** A Reading view search match: text offsets within its section's text nodes. */
  interface PreviewMatch {
    section: { el: HTMLElement };
    start: number;
    end: number;
  }
}
