// "Keeping lanes tidy" rules with no DOM or app access, so they can be unit-tested. Each takes a lane's notes
// (in lane order) and `keep`, the note just opened, which is never picked.

export interface TidyItem {
  collapsed: boolean;
  pinned: boolean;
  /** When the note was last added to the lane or opened (expanded) there; larger is more recent. */
  openedAt: number;
}

const oldestFirst = <T extends TidyItem>(a: T, b: T) => a.openedAt - b.openedAt;

/** Accordion: every other expanded note that isn't pinned. */
export function accordionCollapse<T extends TidyItem>(items: readonly T[], keep: T | null): T[] {
  return items.filter(i => i !== keep && !i.pinned && !i.collapsed);
}

/**
 * "Auto-collapse after N expanded": when more than `max` notes are expanded (pinned ones count), the least
 * recently opened expanded notes that aren't pinned, enough to get back to `max` (or as close as pins allow).
 */
export function overExpanded<T extends TidyItem>(items: readonly T[], max: number, keep: T | null): T[] {
  if (max <= 0) return [];
  const extra = items.filter(i => !i.collapsed).length - max;
  if (extra <= 0) return [];
  return items
    .filter(i => i !== keep && !i.pinned && !i.collapsed)
    .sort(oldestFirst)
    .slice(0, extra);
}

/** "Maximum notes per lane": the least recently opened notes that aren't pinned, enough to get back to `max`. */
export function overLimit<T extends TidyItem>(items: readonly T[], max: number, keep: T | null): T[] {
  if (max <= 0) return [];
  const extra = items.length - max;
  if (extra <= 0) return [];
  return items
    .filter(i => i !== keep && !i.pinned)
    .sort(oldestFirst)
    .slice(0, extra);
}

/** Where a new note goes, as an index into the lane's other notes (pinned ones are kept on top by the caller). */
export function insertIndex<T>(
  others: readonly T[],
  position: "top" | "bottom" | "after",
  after: T | null | undefined,
): number {
  if (position === "bottom") return others.length;
  if (position === "after" && after) {
    const i = others.indexOf(after);
    if (i >= 0) return i + 1;
  }
  return 0;
}
