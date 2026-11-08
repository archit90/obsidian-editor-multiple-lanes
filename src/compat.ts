// What Lanes needs from Obsidian beyond the public API, checked at load (hosting.ts probeInternals). No Obsidian
// imports, so it can be unit-tested.

/** Workspace methods Lanes patches or calls (see the comment at the top of main.ts and src/types/obsidian.d.ts). */
export const WORKSPACE_METHODS = [
  "iterateLeaves",
  "getLeaf",
  "getUnpinnedLeaf",
  "getActiveViewOfType",
  "createLeafBySplit",
  "duplicateLeaf",
  "moveLeafToPopout",
  "revealLeaf",
  "setActiveLeaf",
  "pushUndoHistory",
  "createLeafInParent",
  "createLeafInTabGroup",
] as const;

/** WorkspaceLeaf methods a card's leaf relies on (some are replaced per card, see Lane.doMount). */
export const LEAF_METHODS = [
  "openFile",
  "detach",
  "setPinned",
  "setViewState",
  "getViewState",
  "setEphemeralState",
  "getEphemeralState",
  "getContainer",
  "getRoot",
] as const;

/** The names in `names` that aren't functions on `obj` (own or inherited). */
export function missingMethods(obj: unknown, names: readonly string[]): string[] {
  if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return [...names];
  const o = obj as Record<string, unknown>;
  return names.filter(n => typeof o[n] !== "function");
}
