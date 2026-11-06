// A note's view mode as Obsidian's MarkdownView stores it in its view state: `mode` "preview" (Reading view) or
// "source" (editing), and `source` true (Source mode) / false (Live Preview) for the editing kind. Reading view
// keeps `source` as it was, so switching back to editing returns to the same kind (as Obsidian's own toggle).
// Checked against Obsidian 1.15.0's MarkdownView.setState / toggleMode. No app access, so it can be unit-tested.

export type ViewMode = "reading" | "live" | "source";
export const VIEW_MODES: readonly ViewMode[] = ["reading", "live", "source"];

export const MODE_TITLES: Record<ViewMode, string> = {
  reading: "Reading view",
  live: "Live Preview",
  source: "Source mode",
};
export const MODE_ICONS: Record<ViewMode, string> = { reading: "book-open", live: "edit-3", source: "code-2" };

/** The vault's defaults ("Default view for new tabs", "Default editing mode"), for notes with nothing saved. */
export interface ModeDefaults {
  defaultViewMode?: unknown; // "source" | "preview"
  livePreview?: unknown; // boolean
}

export function isViewMode(v: unknown): v is ViewMode {
  return typeof v === "string" && (VIEW_MODES as readonly string[]).includes(v);
}

/** The mode a MarkdownView state describes, filling what it leaves out from the vault's defaults. */
export function modeOfState(state: unknown, defaults: ModeDefaults = {}): ViewMode {
  const s = state && typeof state === "object" ? (state as Record<string, unknown>) : {};
  const mode = s.mode === "preview" || s.mode === "source" ? s.mode : defaults.defaultViewMode;
  if (mode === "preview") return "reading";
  const source = typeof s.source === "boolean" ? s.source : defaults.livePreview === false;
  return source ? "source" : "live";
}

/** The view-state fields that put a MarkdownView in `mode` (Reading view leaves `source` alone). */
export function stateForMode(mode: ViewMode): { mode: "preview" | "source"; source?: boolean } {
  if (mode === "reading") return { mode: "preview" };
  return { mode: "source", source: mode === "source" };
}

/** The header button: Reading view ↔ editing, back to the editing kind the note had (`source`). */
export function toggledState(state: unknown, defaults: ModeDefaults = {}): { mode: "preview" | "source" } {
  return { mode: modeOfState(state, defaults) === "reading" ? "source" : "preview" };
}
