/**
 * Scrolling inside note cards. A card's editor grows to its content, so its own scroller (CodeMirror's
 * .cm-scroller, Reading view's .markdown-preview-view) never scrolls: the lane list does (or, with "Note height:
 * capped", the card body, then the lane list). Obsidian's code that sets `scrollTop` on those elements (Reading
 * view: scroll to a heading / line, in-note search) would do nothing; main.ts sends those requests here instead.
 * CodeMirror's own scrollIntoView already scrolls ancestors, so editing-mode search and the caret need no help.
 */

/** A vertical extent in client coordinates. */
export interface Band {
  top: number;
  bottom: number;
}

export type ScrollHow = "start" | "center" | "nearest";

/**
 * How far to scroll (positive: down) so `target` shows in `view`, whose top `inset` px are covered (the sticky
 * card header, an open search bar). `start`: the target's top just below the inset; `center`: its middle in the
 * middle of the uncovered part; `nearest`: as little as possible (0 if it's already fully shown; a target taller
 * than the uncovered part goes to the start). `margin`: breathing room at the edges.
 */
export function scrollDelta(view: Band, target: Band, inset = 0, how: ScrollHow = "nearest", margin = 8): number {
  const top = view.top + Math.max(0, inset);
  const toStart = target.top - (top + margin);
  if (how === "start") return toStart;
  if (how === "center") return (target.top + target.bottom) / 2 - (top + view.bottom) / 2;
  if (target.top < top + margin) return toStart;
  if (target.bottom > view.bottom - margin) {
    const toEnd = target.bottom - (view.bottom - margin);
    return Math.min(toEnd, toStart);
  }
  return 0;
}

/** Text offsets [start, end) in the joined `texts` (a section's text nodes, as Reading view search counts them) → [node index, offset] of each end. */
export function locateText(
  texts: readonly string[],
  start: number,
  end: number,
): { from: [number, number]; to: [number, number] } | null {
  let pos = 0;
  let from: [number, number] | null = null;
  for (let i = 0; i < texts.length; i++) {
    const next = pos + texts[i].length;
    if (pos <= start && start <= next) from = [i, start - pos]; // like Obsidian: a start on a boundary goes to the later node
    if (from && pos <= end && end <= next) return { from, to: [i, end - pos] };
    pos = next;
  }
  return null;
}

// ---------- DOM ----------

const isScroller = (el: HTMLElement) => {
  const oy = el.win.getComputedStyle(el).overflowY;
  return (oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1;
};

/** What covers the top of `scroller` over content in `card`: its sticky header (lane list only), a search bar. */
function coveredTop(scroller: HTMLElement, card: HTMLElement): number {
  let h = 0;
  if (scroller.hasClass("lane-list"))
    h += card.querySelector<HTMLElement>(":scope > .lane-item-header")?.offsetHeight ?? 0;
  const bar = card.querySelector<HTMLElement>(".lane-item-body .document-search-container");
  if (bar && scroller.contains(bar)) h += bar.offsetHeight;
  return h;
}

/**
 * Scroll whatever scrolls around `el` (inside its card, up to and including the lane list) so the band from
 * `rect()` (re-read after each step) shows. False when `el` isn't in a card.
 */
export function scrollCardBand(el: HTMLElement, rect: () => Band | null, how: ScrollHow): boolean {
  const card = el.closest<HTMLElement>(".lane-item");
  const list = card?.closest<HTMLElement>(".lane-list");
  if (!card || !list) return false;
  for (let s: HTMLElement | null = el.parentElement; s; s = s.parentElement) {
    if (s !== list && !isScroller(s)) continue;
    const r = rect();
    if (!r) break;
    const v = s.getBoundingClientRect();
    const d = scrollDelta({ top: v.top, bottom: v.top + s.clientHeight }, r, coveredTop(s, card), how);
    if (Math.abs(d) >= 1) s.scrollTop += d;
    if (s === list) break;
  }
  return true;
}

/** Where a Reading view search match (text offsets in a section, see locateText) is on screen. */
export function matchBand(sectionEl: HTMLElement, start: number, end: number): Band | null {
  const nodes: Text[] = [];
  const walk = sectionEl.doc.createTreeWalker(sectionEl, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) nodes.push(n as Text);
  const loc = locateText(
    nodes.map(n => n.textContent ?? ""),
    start,
    end,
  );
  let r: DOMRect | null = null;
  if (loc) {
    const range = sectionEl.doc.createRange();
    range.setStart(nodes[loc.from[0]], loc.from[1]);
    range.setEnd(nodes[loc.to[0]], loc.to[1]);
    r = range.getBoundingClientRect();
  }
  if (!r || (!r.width && !r.height)) r = sectionEl.getBoundingClientRect();
  return r.width || r.height ? { top: r.top, bottom: r.bottom } : null;
}
