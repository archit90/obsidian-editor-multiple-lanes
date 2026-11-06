import type { TFile, WorkspaceLeaf } from "obsidian";
import type { LaneView } from "./lane-view";

export const VIEW_TYPE = "editor-lane";
export const SWALLOW_MS = 700; // after a shift-mousedown we handled, ignore the matching mouseup/click
export const INTENT_MS = 2000; // an open is matched to the getLeaf call that picked its leaf within this time
export const LAZY_MARGIN = 300; // px: expanded notes this close to the visible part of a lane get mounted

export interface ItemData {
  path: string;
  collapsed: boolean;
  pinned?: boolean;
}

/** A card leaving one lane for another (its editor reopens there with this mode and cursor). */
export interface Taken {
  file: TFile;
  collapsed: boolean;
  pinned: boolean;
  pending: MountState | null;
}

/** What a hosted editor is (re)opened with: from a swept tab, a routed open, or the state saved on collapse. */
export interface MountState {
  mode?: string;
  eState?: any;
}

export interface Item {
  file: TFile;
  collapsed: boolean;
  pinned: boolean; // stays above the other notes; not closed by ×, Ctrl+W, Close all / others
  el: HTMLElement;
  headerEl: HTMLElement;
  pinEl: HTMLElement;
  chevEl: HTMLElement;
  titleEl: HTMLElement;
  pathEl: HTMLElement;
  bodyEl: HTMLElement;
  split: any | null; // private WorkspaceSplit holding the leaf (while mounted)
  leaf: WorkspaceLeaf | null;
  ready: Promise<void> | null; // the mount in progress / done
  pending: MountState | null; // applied on the next mount
  editStart: string | null; // title text when editing started
  cancelEdit: boolean; // Escape: the next blur must not rename
}

export type Where = "last" | "next" | "new";
export type LaneDir = "left" | "right" | "up" | "down";

/** Recorded by the getLeaf wrappers: where the open that will use this leaf came from. */
export interface Intent {
  from: LaneView | null;
  paneType: unknown;
  at: number;
}

/** How a note is added to a lane. `index`: where (else the top, below pinned notes). */
export interface AddOpts {
  focus?: boolean;
  eState?: any;
  mode?: string;
  history?: any;
  index?: number;
}
