// Drag-and-drop logic with no DOM or app access, so it can be unit-tested.

export type DropEffect = "link" | "copy" | "move";

/**
 * The first of `prefs` that a drag source allowing `effectAllowed` accepts. A text drag from an editor
 * allows only copy / move; asking for "link" there makes the browser refuse the drop.
 */
export function pickDropEffect(effectAllowed: string | undefined, prefs: readonly DropEffect[]): DropEffect | null {
  const allowed = (effectAllowed || "all").toLowerCase();
  if (allowed === "all" || allowed === "uninitialized") return prefs[0] ?? null;
  if (allowed === "none") return null;
  return prefs.find(p => allowed.includes(p)) ?? null;
}

/** Where a note may go in `list` (which doesn't contain it): pinned notes stay above the others. */
export function clampIn(list: readonly { pinned: boolean }[], pinned: boolean, index: number): number {
  const n = list.filter(i => i.pinned).length;
  return pinned ? Math.min(Math.max(index, 0), n) : Math.min(Math.max(index, n), list.length);
}

/**
 * Link paths in dragged text, in order, one entry per link: the `file` of an obsidian://open URL, every
 * [[wikilink]] (without #heading / ^block / |alias) and [text](note.md) link; a line with no link and no
 * brackets is taken as a note name itself. Resolving them to notes is up to the caller.
 */
export function linkpathsInText(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const url = /^obsidian:\/\/open\?(.*)$/.exec(t);
    if (url) {
      const file = new URLSearchParams(url[1]).get("file");
      if (file) out.push(file);
      continue;
    }
    const before = out.length;
    for (const m of t.matchAll(/\[\[([^\]|#^]+)/g)) out.push(m[1].trim());
    for (const m of t.matchAll(/\]\(<?([^)>#]+?\.md)(?:#[^)>]*)?>?\)/g)) {
      let target = m[1];
      try {
        target = decodeURIComponent(target);
      } catch {
        /* keep as is */
      }
      out.push(target);
    }
    if (out.length === before && !/[[\]()]/.test(t)) out.push(t);
  }
  return out;
}
