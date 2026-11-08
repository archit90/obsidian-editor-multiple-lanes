import { App, Workspace, WorkspaceLeaf, WorkspaceParent, WorkspaceSplit } from "obsidian";
import { LEAF_METHODS, WORKSPACE_METHODS, missingMethods } from "./compat";

/** The private split a card's leaf lives in: `parent` reads as the right sidebar until it's set to null. */
export type HostSplit = Omit<WorkspaceSplit, "parent"> & { parent: WorkspaceParent | null };
/** WorkspaceSplit's constructor (not in the public API): new WorkspaceSplit(workspace, direction). */
type SplitConstructor = new (ws: Workspace, direction: "horizontal" | "vertical") => HostSplit;
/** WorkspaceLeaf's constructor (not in the public API): new WorkspaceLeaf(app). */
type LeafConstructor = new (app: App) => WorkspaceLeaf;

/**
 * A private WorkspaceSplit for hosting a leaf outside the layout tree (see the comment at the top of main.ts):
 * not a child of any split, but its `parent` reads as the right sidebar (mobile: the right drawer), so its
 * leaves count as attached. `parent` is looked up on every read: loading a layout (startup, the Workspaces
 * plugin) replaces workspace.rightSplit, and setLayout builds the main area, and so restores lanes, before the
 * new right sidebar exists; a stored reference would point at the old one (or null). Setting `parent` to null
 * marks it detached for good (do that before taking its leaf out: an emptied split removes itself from its
 * parent, and it was never the parent's child).
 *
 * `mod-visible`: on phones Obsidian hides every .workspace-split inside the main area without it (the split
 * isn't in the layout tree, so updateMobileVisibleTabGroup never sets or clears it).
 */
export function createHostSplit(ws: Workspace): HostSplit {
  const split = new (WorkspaceSplit as unknown as SplitConstructor)(ws, "horizontal");
  let detached = false;
  Object.defineProperty(split, "parent", {
    configurable: true,
    get: () => (detached ? null : (ws.rightSplit ?? null)),
    set: (v: unknown) => {
      if (v === null) detached = true;
    },
  });
  split.containerEl.addClass("lane-split", "mod-visible");
  return split;
}

/** A new leaf for a card (falls back to createLeafInParent if the constructor isn't usable). */
export function createHostLeaf(app: App, split: HostSplit): WorkspaceLeaf {
  try {
    const leaf = new (WorkspaceLeaf as unknown as LeafConstructor)(app);
    split.insertChild(0, leaf);
    return leaf;
  } catch {
    return app.workspace.createLeafInParent(split as unknown as WorkspaceSplit, 0);
  }
}

/**
 * Whether this Obsidian can host notes the way Lanes does: the methods it patches or calls exist, and a leaf in
 * a private split can be made, reads as attached to the right sidebar, and comes out again (`detach`: without
 * an "Undo close tab" entry). Returns what's missing (for the notice), or null when everything works. Run once
 * at load; when it fails, the plugin leaves Obsidian alone and notes open in normal tabs.
 */
export function probeInternals(app: App, detach: (leaf: WorkspaceLeaf) => void): string | null {
  const ws = app.workspace;
  const missing = [
    ...(typeof WorkspaceSplit === "function" ? [] : ["WorkspaceSplit"]),
    ...missingMethods(ws, WORKSPACE_METHODS).map(n => `workspace.${n}`),
    ...missingMethods(WorkspaceLeaf.prototype, LEAF_METHODS).map(n => `WorkspaceLeaf.${n}`),
  ];
  if (missing.length) return missing.join(", ");
  let split: HostSplit | null = null;
  let leaf: WorkspaceLeaf | null = null;
  try {
    split = createHostSplit(ws);
    leaf = createHostLeaf(app, split);
    if ((leaf.parent as unknown) !== split) return "a leaf in a private split";
    // before the layout has loaded there may be no right sidebar yet: nothing to compare with then
    if (ws.rightSplit && (leaf.getRoot() as unknown) !== ws.rightSplit) return "a hosted leaf's root";
    return null;
  } catch (e) {
    return `a private split (${e instanceof Error ? e.message : String(e)})`;
  } finally {
    if (split) split.parent = null;
    if (leaf) {
      try {
        detach(leaf);
      } catch {
        /* the probe's leaf goes with its split */
      }
    }
    split?.containerEl.remove();
  }
}
