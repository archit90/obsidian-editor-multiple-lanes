import { Workspace, WorkspaceParent, WorkspaceSplit } from "obsidian";

/** The private split a card's leaf lives in: `parent` reads as the right sidebar until it's set to null. */
export type HostSplit = Omit<WorkspaceSplit, "parent"> & { parent: WorkspaceParent | null };
/** WorkspaceSplit's constructor (not in the public API): new WorkspaceSplit(workspace, direction). */
type SplitConstructor = new (ws: Workspace, direction: "horizontal" | "vertical") => HostSplit;

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
export function createHostSplit(ws: Workspace, ...cls: string[]): HostSplit {
  const split = new (WorkspaceSplit as unknown as SplitConstructor)(ws, "horizontal");
  let detached = false;
  Object.defineProperty(split, "parent", {
    configurable: true,
    get: () => (detached ? null : (ws.rightSplit ?? null)),
    set: (v: unknown) => {
      if (v === null) detached = true;
    },
  });
  split.containerEl.addClass("lane-split", "mod-visible", ...cls);
  return split;
}
