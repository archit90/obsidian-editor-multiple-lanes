// A lanes tab's view state (workspace.json, Workspaces, "Undo close tab"), read tolerantly. No DOM or app
// access, so it can be unit-tested.
import { Sizes, mergeTarget, parseLayout } from "./layout";
import type { ItemData } from "./types";

export interface TabState {
  /** The tab's own layout ("Lane layout…"), or null: it follows the default from the settings. */
  layout: string | null;
  /** Divider positions dragged in this tab (unlocked), for the layout they were made for. */
  sizes: Sizes | null;
  /** Each lane's notes, in lane order (columns left to right, top to bottom in a column). */
  lanes: ItemData[][];
}

const nums = (v: unknown): number[] | null =>
  Array.isArray(v) && v.every(n => typeof n === "number" && Number.isFinite(n) && n > 0) ? (v as number[]) : null;

function readSizes(v: unknown): Sizes | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const cols = nums(o.cols);
  const rows = Array.isArray(o.rows) ? o.rows.map(nums) : null;
  if (typeof o.for !== "string" || !cols || !rows || rows.some(r => !r)) return null;
  return { for: o.for, cols, rows: rows as number[][] };
}

function readItem(v: unknown): ItemData | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.path !== "string" || !o.path) return null;
  const d: ItemData = { path: o.path, collapsed: !!o.collapsed };
  if (o.pinned) d.pinned = true;
  if (typeof o.openedAt === "number" && Number.isFinite(o.openedAt)) d.openedAt = o.openedAt;
  return d;
}

export function readTabState(raw: unknown): TabState {
  const o: Record<string, unknown> = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const layout = typeof o.layout === "string" && parseLayout(o.layout).ok ? o.layout : null;
  const lanes = Array.isArray(o.lanes)
    ? o.lanes.map(l => (Array.isArray(l) ? l.map(readItem).filter((d): d is ItemData => !!d) : []))
    : [];
  return { layout, sizes: readSizes(o.sizes), lanes };
}

/**
 * Saved lanes fitted to `count` lanes: lanes past the end hand their notes to the kept lanes, wrapping round
 * (mergeTarget), at the bottom. A note twice in one lane is kept once, pinned if either was. No note is lost.
 */
export function fitLanes(lanes: readonly ItemData[][], count: number): ItemData[][] {
  const out: ItemData[][] = Array.from({ length: Math.max(count, 0) }, (_, i) => [...(lanes[i] ?? [])]);
  if (!out.length) return out;
  for (let i = count; i < lanes.length; i++) out[mergeTarget(i, count)].push(...lanes[i]);
  return out.map(lane => {
    const seen = new Map<string, ItemData>();
    for (const d of lane) {
      const had = seen.get(d.path);
      if (!had) seen.set(d.path, { ...d });
      else if (d.pinned) had.pinned = true;
    }
    return [...seen.values()];
  });
}
