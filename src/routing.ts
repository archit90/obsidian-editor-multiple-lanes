// Where a routed open counts as coming from, and where it goes. No DOM or app access, so it can be unit-tested.
import type { Where } from "./types";

/** What an open that's being routed into a lane knows when it starts. */
export interface OpenSource<L, I> {
  /** The leaf the open is aimed at is a card: its lane and card. */
  host: { lane: L; item: I } | null;
  /** Recorded by the getLeaf wrappers when the open picked its leaf (see Intent). */
  intent: { from: L | null; fromItem: I | null; link: boolean; paneType: unknown } | null;
  /** A new note to name (eState.rename): Ctrl/Cmd+N, the explorer's New note, a template. */
  creating: boolean;
}

export interface OpenPlan<L, I> {
  /** The lane the open counts as coming from (a link followed there), or null: an open from outside the lanes. */
  from: L | null;
  /** The card in `from` it came from, for "New notes go: right after the note it was opened from". */
  fromItem: I | null;
  /** A "new tab" open (Ctrl/Cmd-click, middle-click, Open in new tab / window, Split): a new lanes tab. */
  wantNew: boolean;
}

/**
 * Where an open comes from. Only a link followed in a card (an open made inside workspace.openLinkText while the
 * input was in that card), or an open aimed at a card's own leaf, comes from a lane. Anything else started while
 * the caret is in a card (Ctrl/Cmd+N, a template, a hotkey) is an open from outside the lanes and goes to the
 * last-used lane. A new note never asks for a new lanes tab: Obsidian opens it in a new tab only so the current
 * note stays open, which a lane does anyway.
 */
export function planOpen<L, I>(s: OpenSource<L, I>): OpenPlan<L, I> {
  const p = s.intent?.paneType;
  const wantNew = !s.host && !s.creating && (p === "tab" || p === true || p === "split" || p === "window");
  if (s.host) return { from: s.host.lane, fromItem: s.host.item, wantNew };
  if (s.intent?.link && !s.creating) return { from: s.intent.from, fromItem: s.intent.fromItem, wantNew };
  return { from: null, fromItem: null, wantNew };
}

/** The lane choice for a routed open: a new lanes tab, "Link clicked in a lane opens in" for a link, else the last-used lane. */
export function whereFor(plan: { from: unknown; wantNew: boolean }, linkTarget: Where): Where {
  if (plan.wantNew) return "newTab";
  return plan.from ? linkTarget : "last";
}
