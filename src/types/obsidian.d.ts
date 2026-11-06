// Obsidian internals Editor Lanes relies on (not in the public API). Checked against Obsidian 1.15.0's
// app.js; see the comment at the top of main.ts for how they're used.
import "obsidian";

declare module "obsidian" {
  interface App {
    /** Tracks the current drag: `draggable` is what Obsidian's own drop targets read. */
    dragManager?: DragManager;
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
  }

  interface WorkspaceLeaf {
    /** Set when the leaf is linked to others ("Link with tab"). */
    group?: string | null;
    history?: { serialize?(): unknown; deserialize?(state: unknown): void };
    /** Re-reads the view's icon and display text into the tab header. */
    updateHeader?(): void;
  }
}
