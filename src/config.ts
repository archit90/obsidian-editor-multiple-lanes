// The plugin's settings: their shape, defaults and a tolerant loader. No Obsidian imports, so it can be tested.

/** "Link clicked in a lane opens in": the lane to its right (sliding panes), the same lane, or the lane used last. */
export type LinkTarget = "next" | "same" | "last";
/** Where a newly added note goes: the top (below pinned notes), the bottom, or right after the note it came from. */
export type NewNotePosition = "top" | "bottom" | "after";
/** A note already open in another lane: open another copy here, jump to the open one, or move it here. */
export type DuplicateMode = "copy" | "jump" | "move";
export type HeaderSize = "comfortable" | "compact";
/** Width of a lane added left / right of another (unlocked): half of that lane's column, a fixed width, or its width. */
export type NewLaneWidth = "equal" | "fixed" | "copy";
export type NoteHeight = "grow" | "cap";
/** A note or link dropped onto a note's text: Obsidian inserts a link, or the lane opens it. */
export type DropOnText = "insert" | "open";

export interface Settings {
  lanesOnly: boolean;
  // Opening notes
  linkTarget: LinkTarget;
  newNotePosition: NewNotePosition;
  duplicateMode: DuplicateMode;
  routeExceptions: string; // one pattern per line, see exceptions.ts
  // Lane layout
  /** No ad-hoc lane changes inside lanes tabs: layouts change only here or in a tab's "Lane layout…" dialog. */
  lockLayout: boolean;
  /** The layout every lanes tab starts with and follows unless it has its own (see layout.ts parseLayout). */
  defaultLayout: string;
  // Keeping lanes tidy
  accordion: boolean;
  maxNotesPerLane: number; // 0 = no limit
  autoCollapseAfter: number; // 0 = off
  // Looks
  showFolder: boolean;
  headerSize: HeaderSize;
  newLaneWidth: NewLaneWidth;
  newLaneWidthPx: number;
  noteHeight: NoteHeight;
  noteMaxHeight: number; // px, with noteHeight "cap"
  // Performance
  showBacklinks: boolean;
  preloadDistance: number; // px
  // Drag and drop
  dropOnText: DropOnText;
}

/** Every default is the behaviour from before the setting existed, so nothing changes until it's changed. */
export const DEFAULTS: Settings = {
  lanesOnly: true,
  linkTarget: "next",
  newNotePosition: "top",
  duplicateMode: "copy",
  routeExceptions: "",
  lockLayout: false,
  defaultLayout: "50, 50",
  accordion: false,
  maxNotesPerLane: 0,
  autoCollapseAfter: 0,
  showFolder: true,
  headerSize: "comfortable",
  newLaneWidth: "equal",
  newLaneWidthPx: 500,
  noteHeight: "grow",
  noteMaxHeight: 600,
  showBacklinks: true,
  preloadDistance: 300,
  dropOnText: "insert",
};

/** Allowed range for each number setting (inclusive). */
export const LIMITS = {
  maxNotesPerLane: [0, 500],
  autoCollapseAfter: [0, 500],
  newLaneWidthPx: [120, 4000],
  noteMaxHeight: [80, 10000],
  preloadDistance: [0, 5000],
} as const satisfies Partial<Record<keyof Settings, readonly [number, number]>>;

const CHOICES: { [K in keyof Settings]?: readonly string[] } = {
  linkTarget: ["next", "same", "last"],
  newNotePosition: ["top", "bottom", "after"],
  duplicateMode: ["copy", "jump", "move"],
  headerSize: ["comfortable", "compact"],
  newLaneWidth: ["equal", "fixed", "copy"],
  noteHeight: ["grow", "cap"],
  dropOnText: ["insert", "open"],
};

/** A whole number within `range`, or null for anything else (text that isn't a number, NaN…). */
export function parseCount(v: unknown, range: readonly [number, number]): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.trim()) : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n >= range[0] && n <= range[1] ? n : null;
}

/**
 * Settings from `saved` (whatever loadData returned: null, an older version, hand-edited JSON) laid over the
 * defaults. Each value of the wrong type or out of range falls back to its default; unknown keys are dropped.
 */
export function loadSettings(saved: unknown): Settings {
  const raw = migrateSettings(saved);
  const out: Settings = Object.assign({}, DEFAULTS);
  const o = out as unknown as Record<string, unknown>;
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    if (!(key in raw)) continue;
    const v = raw[key];
    const def = DEFAULTS[key];
    const choices = CHOICES[key];
    const range = (LIMITS as Partial<Record<keyof Settings, readonly [number, number]>>)[key];
    if (choices) {
      if (typeof v === "string" && choices.includes(v)) o[key] = v;
    } else if (range) {
      const n = parseCount(v, range);
      if (n !== null) o[key] = n;
    } else if (typeof def === "boolean") {
      if (typeof v === "boolean") o[key] = v;
    } else if (typeof def === "string") {
      if (typeof v === "string") o[key] = v;
    }
  }
  return out;
}

/**
 * Settings saved by 0.1.x, renamed for 0.2: `layout` (the locked layout) is now `defaultLayout`, the layout every
 * lanes tab starts with. The old `layout` and `maxLanes` (gone: a tab's lanes are its layout) are then dropped by
 * loadSettings with the other unknown keys. `lockLayout` keeps its key; what it locks changed (see the settings tab).
 */
export function migrateSettings(saved: unknown): Record<string, unknown> {
  const raw: Record<string, unknown> =
    saved && typeof saved === "object" ? { ...(saved as Record<string, unknown>) } : {};
  if (!("defaultLayout" in raw) && typeof raw.layout === "string") raw.defaultLayout = raw.layout;
  return raw;
}
