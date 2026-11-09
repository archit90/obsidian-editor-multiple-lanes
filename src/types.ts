import type { TFile, WorkspaceLeaf } from "obsidian";
import type { HostSplit } from "./hosting";
import type { Lane } from "./lane";

/** A lanes tab: one Obsidian tab holding every lane of its layout. */
export const VIEW_TYPE = "editor-lanes";
/** The old view: one lane per tab. Leaves of this type are closed on load (see EditorLanesPlugin.closeLegacy). */
export const LEGACY_VIEW_TYPE = "editor-lane";
/**
 * The Navigator tab of an unreleased build (Files, Search and Bookmarks in a main-area tab; removed again at the
 * user's request). A saved layout may still hold one: it's closed on load (see EditorLanesPlugin.closeOldNavigator).
 */
export const OLD_NAV_VIEW_TYPE = "editor-lanes-navigator";
export const SWALLOW_MS = 700; // after a shift-mousedown we handled, ignore the matching mouseup/click
/** An open is matched to the getLeaf call that picked its leaf within this time. */
export const INTENT_MS = 2000;
/** How long after the plugin is enabled at runtime its lanes tabs may still be on their way back. */
export const RESTORE_MS = 5000;

export interface ItemData {
  path: string;
  collapsed: boolean;
  pinned?: boolean;
  openedAt?: number;
  /** The note's own view mode (Reading view / Live Preview / Source mode), as MarkdownView state fields. */
  view?: NoteView;
}

/** MarkdownView's view-mode fields (see view-mode.ts). */
export interface NoteView {
  mode?: "preview" | "source";
  source?: boolean;
}

/** A card leaving one lane for another (its editor reopens there with this mode and cursor). */
export interface Taken {
  file: TFile;
  collapsed: boolean;
  pinned: boolean;
  pending: MountState | null;
  openedAt: number;
  view: NoteView | null;
}

/** What a hosted editor is (re)opened with: from a swept tab, a routed open, or the state saved on collapse. */
export interface MountState {
  mode?: string;
  source?: boolean;
  eState?: Record<string, unknown>;
  /** "Note height: capped": the card body's own scroll position (a card parked while far away). */
  bodyScroll?: number;
}

export interface Item {
  file: TFile;
  collapsed: boolean;
  pinned: boolean; // stays above the other notes; not closed by ×, Ctrl+W, Close all / others
  openedAt: number; // last added / opened / expanded (stamp()), for "Keeping lanes tidy"; saved in the view state
  /** Its own view mode, kept while unmounted and saved with the tab; null: the vault default. */
  view: NoteView | null;
  modeEl: HTMLElement;
  el: HTMLElement;
  pinEl: HTMLElement;
  chevEl: HTMLElement;
  titleEl: HTMLElement;
  pathEl: HTMLElement;
  bodyEl: HTMLElement;
  split: HostSplit | null; // private WorkspaceSplit holding the leaf (while mounted)
  leaf: WorkspaceLeaf | null;
  ready: Promise<void> | null; // the mount in progress / done
  pending: MountState | null; // applied on the next mount
  editStart: string | null; // title text when editing started
  cancelEdit: boolean; // Escape: the next blur must not rename
  /** For a note following the vault default: the mode it mounted with (not saved; a change from it is). */
  mountedView?: string;
  /** The mode button's last state, so it's only redrawn when the mode changes. */
  shownMode?: string;
  /** Unmounted while far from view: its body keeps its height until it mounts again. */
  parked?: boolean;
  /**
   * "Start with properties folded": "auto" while the card holds its own fold (folded at each mount, undone before
   * each unmount, so Obsidian never saves it for the note), "user" once the properties were folded or unfolded by
   * hand (then Obsidian keeps that, as in a tab). Unset until the card first mounts its note.
   */
  propsFold?: "auto" | "user";
  /** "Couldn't open this note.", shown after a failed mount until the next one starts. */
  errorEl?: HTMLElement | null;
}

/** Where an open goes: the last-used lane, the next lane of the source tab, a new lanes tab, or the source lane. */
export type Where = "last" | "next" | "newTab" | "same";

/** Recorded by the getLeaf wrappers: where the open that will use this leaf came from. */
export interface Intent {
  from: Lane | null;
  /** The card in `from` the open came from (a link followed in it), for "New notes go: after". */
  fromItem: Item | null;
  /**
   * The open is a link being followed: getLeaf was called inside workspace.openLinkText (Live Preview / Reading
   * view / hover popover link clicks, "Follow link under cursor", Backlinks Full View's links). Only then does
   * `from` make it "a link followed in a card"; Ctrl/Cmd+N, templates and hotkeys typed in a card don't.
   */
  link: boolean;
  paneType: unknown;
  /** The picked leaf was already the active one (getUnpinnedLeaf reused it, e.g. an empty tab you're in). */
  wasActive: boolean;
  at: number;
}

/** How a note is added to a lane. `index`: where (a drop point); else where "New notes go" says. */
export interface AddOpts {
  focus?: boolean;
  eState?: Record<string, unknown>;
  mode?: string;
  /** A tab's history (WorkspaceLeaf.history.serialize()), for back / forward in the card. */
  history?: unknown;
  index?: number;
  /** The card this note was opened from, if in the same lane (for "New notes go: right after"). */
  after?: Item | null;
}

let lastStamp = 0;
/** A strictly increasing time stamp, so notes added in one go still have an order. */
export function stamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

/** `v` as a plain object (an ephemeral state, a view state), else undefined. */
export function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}
