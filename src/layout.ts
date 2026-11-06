// Lane layout logic with no DOM or app access, so it can be unit-tested: the layout definition a lanes tab is
// built from (columns of stacked lanes), lane order and the next-lane wrap rule, what happens to lanes and their
// notes when a tab's layout changes, adding / removing a lane, and sizes (new-lane width, dragged dividers).

export const MAX_COLUMNS = 8;
export const MAX_ROWS = 6;

export interface LayoutColumn {
  /** Share of the main area's width, in percent (the columns add up to 100). */
  width: number;
  /** Lanes stacked in this column, top to bottom. */
  rows: number;
}

export type ParsedLayout = { ok: true; columns: LayoutColumn[] } | { ok: false; error: string };

/**
 * A layout definition: the columns from left to right, separated by commas, each a relative width, optionally
 * followed by "x" and the number of lanes stacked in that column. "40, 30, 30" is three side-by-side lanes;
 * "50, 50x2" is one lane on the left and two stacked on the right, each column half the width. Widths are
 * relative ("2, 1" = "66, 33"); "×" and "*" work like "x"; a bare "x2" means width 1, two rows.
 */
export function parseLayout(text: string): ParsedLayout {
  const parts = text
    .split(/[,;]/)
    .map(p => p.trim())
    .filter(p => p !== "");
  if (!parts.length) return { ok: false, error: "Enter at least one column, e.g. 50, 50" };
  if (parts.length > MAX_COLUMNS) return { ok: false, error: `At most ${MAX_COLUMNS} columns` };
  const cols: { w: number; rows: number }[] = [];
  for (const p of parts) {
    const m = /^(\d+(?:\.\d+)?)?\s*(?:[x×*]\s*(\d+))?$/i.exec(p);
    if (!m || (m[1] === undefined && m[2] === undefined)) {
      return { ok: false, error: `"${p}" isn't a width, or a width x rows (e.g. 30 or 30x2)` };
    }
    const w = m[1] === undefined ? 1 : Number(m[1]);
    const rows = m[2] === undefined ? 1 : Number(m[2]);
    if (!(w > 0)) return { ok: false, error: `"${p}": a width must be more than 0` };
    if (rows < 1 || rows > MAX_ROWS) return { ok: false, error: `"${p}": 1 to ${MAX_ROWS} lanes per column` };
    cols.push({ w, rows });
  }
  const total = cols.reduce((s, c) => s + c.w, 0);
  return { ok: true, columns: cols.map(c => ({ width: (c.w / total) * 100, rows: c.rows })) };
}

/** Quick picks in the "Lane layout…" dialog. */
export const PRESETS: { name: string; layout: string }[] = [
  { name: "1 lane", layout: "100" },
  { name: "2 columns", layout: "50, 50" },
  { name: "3 columns", layout: "1, 1, 1" },
  { name: "2 × 2", layout: "50x2, 50x2" },
  { name: "1 + 2 stacked", layout: "50, 50x2" },
  { name: "Wide middle", layout: "25, 50, 25" },
];

/** Plain-language summary, e.g. "3 lanes: 40% | 30% (2 stacked) | 30%". */
export function describeLayout(columns: readonly LayoutColumn[]): string {
  const n = laneCount(columns);
  const cols = columns.map(c => `${Math.round(c.width)}%${c.rows > 1 ? ` (${c.rows} stacked)` : ""}`);
  return `${n} lane${n === 1 ? "" : "s"}: ${cols.join(" | ")}`;
}

export function laneCount(columns: readonly LayoutColumn[]): number {
  return columns.reduce((s, c) => s + c.rows, 0);
}

/** Which kept lane (by order) the notes of lane `index` go to when only `keep` lanes stay: wrap around. */
export function mergeTarget(index: number, keep: number): number {
  return keep <= 0 ? -1 : index < keep ? index : index % keep;
}

/** The lane `step` places from `current` in `order`, wrapping around at either end (next of the last = first). */
export function wrapStep<T>(order: readonly T[], current: T, step: 1 | -1): T | null {
  const n = order.length;
  if (!n) return null;
  const i = order.indexOf(current);
  if (i < 0) return order[0];
  return order[(((i + step) % n) + n) % n];
}

/**
 * Flex shares (percent, adding up to 100) for the children of a split, given their current sizes in px, so
 * that child `index` gets `target` px and the others share the rest in their current proportions. No child
 * gets less than `min` px where the total allows it.
 */
export function shareWithTarget(sizes: readonly number[], index: number, target: number, min = 120): number[] {
  const n = sizes.length;
  const total = sizes.reduce((s, x) => s + Math.max(0, x), 0);
  if (n <= 1 || total <= 0 || index < 0 || index >= n) return sizes.map(() => 100 / Math.max(n, 1));
  const lo = Math.min(min, total / n);
  const t = Math.min(Math.max(target, lo), total - lo * (n - 1));
  const others = sizes.reduce((s, x, i) => (i === index ? s : s + Math.max(0, x)), 0);
  const rest = total - t;
  const px = sizes.map((x, i) => (i === index ? t : others > 0 ? (Math.max(0, x) / others) * rest : rest / (n - 1)));
  return px.map(x => (x / total) * 100);
}

/** A layout written back in the settings syntax, widths rounded: "40, 30x2, 30". */
export function formatLayout(columns: readonly LayoutColumn[]): string {
  return columns.map(c => `${Math.max(1, Math.round(c.width))}${c.rows > 1 ? `x${c.rows}` : ""}`).join(", ");
}

/**
 * Where lane `index` sits: its column and its row in that column. Lanes are numbered in layout order: columns
 * left to right, and top to bottom within a column. Null past the last lane.
 */
export function slotOf(columns: readonly LayoutColumn[], index: number): { col: number; row: number } | null {
  let first = 0;
  for (let col = 0; col < columns.length; col++) {
    if (index < first + columns[col].rows) return index >= first ? { col, row: index - first } : null;
    first += columns[col].rows;
  }
  return null;
}

/** The number of the first lane in column `col`. */
export function firstLaneOf(columns: readonly LayoutColumn[], col: number): number {
  return columns.slice(0, col).reduce((s, c) => s + c.rows, 0);
}

/**
 * What becomes of a tab's lanes when its layout changes. `slots[j]` is the old lane that becomes new lane j
 * (null: a new, empty lane). `merges` are the old lanes that go: each one's notes move into new lane `to`.
 */
export interface RelayoutPlan {
  slots: (number | null)[];
  merges: { from: number; to: number }[];
}

/** A new layout of `newCount` lanes: lanes keep their place in order; the extra old ones wrap round (mergeTarget). */
export function planRelayout(oldCount: number, newCount: number): RelayoutPlan {
  const slots = Array.from({ length: newCount }, (_, j) => (j < oldCount ? j : null));
  const merges = [];
  for (let i = newCount; i < oldCount; i++) merges.push({ from: i, to: mergeTarget(i, newCount) });
  return { slots, merges };
}

/** A new, empty lane at position `at`; the others keep their notes. */
export function planInsert(oldCount: number, at: number): RelayoutPlan {
  const slots: (number | null)[] = Array.from({ length: oldCount }, (_, i) => i);
  slots.splice(Math.min(Math.max(at, 0), oldCount), 0, null);
  return { slots, merges: [] };
}

/** Lane `at` goes; its notes move to the lane before it (the first lane's to the new first lane). */
export function planRemove(oldCount: number, at: number): RelayoutPlan {
  if (oldCount <= 1 || at < 0 || at >= oldCount) return planRelayout(oldCount, oldCount);
  const slots: (number | null)[] = Array.from({ length: oldCount }, (_, i) => i).filter(i => i !== at);
  return { slots, merges: [{ from: at, to: Math.max(at - 1, 0) }] };
}

export type Side = "left" | "right" | "up" | "down";

/**
 * The layout with a new lane beside lane `index`: left / right is a new column next to the lane's column, which
 * gives it half its width; up / down is one more lane stacked in the lane's column. `index` in the result is the
 * new lane's number. Null if the layout would get too big (MAX_COLUMNS, MAX_ROWS) or `index` isn't a lane.
 */
export function insertLane(
  columns: readonly LayoutColumn[],
  index: number,
  side: Side,
): { columns: LayoutColumn[]; index: number } | null {
  const at = slotOf(columns, index);
  if (!at) return null;
  const cols = columns.map(c => ({ ...c }));
  if (side === "up" || side === "down") {
    if (cols[at.col].rows >= MAX_ROWS) return null;
    cols[at.col].rows++;
    return { columns: cols, index: side === "up" ? index : index + 1 };
  }
  if (cols.length >= MAX_COLUMNS) return null;
  const half = cols[at.col].width / 2;
  cols[at.col].width = half;
  const col = side === "left" ? at.col : at.col + 1;
  cols.splice(col, 0, { width: half, rows: 1 });
  return { columns: cols, index: firstLaneOf(cols, col) };
}

/** The layout without lane `index` (a column left empty goes, the others share its width). Null for the last lane. */
export function removeLane(columns: readonly LayoutColumn[], index: number): LayoutColumn[] | null {
  const at = slotOf(columns, index);
  if (!at || laneCount(columns) <= 1) return null;
  const cols = columns.map(c => ({ ...c }));
  if (cols[at.col].rows > 1) cols[at.col].rows--;
  else cols.splice(at.col, 1);
  const total = cols.reduce((s, c) => s + c.width, 0);
  return cols.map(c => ({ ...c, width: (c.width / total) * 100 }));
}

/**
 * Two neighbouring shares (percent) after dragging the divider between `i` and `i + 1` by `delta` percent:
 * the pair keeps its total and neither drops below `min`.
 */
export function resizePair(shares: readonly number[], i: number, delta: number, min = 5): number[] {
  const out = [...shares];
  if (i < 0 || i + 1 >= out.length) return out;
  const pair = out[i] + out[i + 1];
  const lo = Math.min(min, pair / 2);
  const a = Math.min(Math.max(out[i] + delta, lo), pair - lo);
  out[i] = a;
  out[i + 1] = pair - a;
  return out;
}

/** Dragged sizes, kept in a tab's state: for the layout `for` (formatLayout), column and per-column row shares. */
export interface Sizes {
  for: string;
  cols: number[];
  rows: number[][];
}

/**
 * The shares a tab shows: its dragged sizes when they were made for this very layout (and the layout isn't
 * locked), else the layout's own widths with stacked lanes sharing their column equally.
 */
export function effectiveShares(
  columns: readonly LayoutColumn[],
  sizes: Sizes | null,
  locked: boolean,
): { cols: number[]; rows: number[][] } {
  const fits =
    !locked &&
    !!sizes &&
    sizes.for === formatLayout(columns) &&
    sizes.cols.length === columns.length &&
    columns.every((c, i) => sizes.rows[i]?.length === c.rows);
  if (fits) return { cols: [...sizes.cols], rows: sizes.rows.map(r => [...r]) };
  return {
    cols: columns.map(c => c.width),
    rows: columns.map(c => Array.from({ length: c.rows }, () => 100 / c.rows)),
  };
}
