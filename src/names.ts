/** A date-time prefix at the start of a note name: YYYY-MM-DD-HHmmss (e.g. "2026-11-06-053000 standup"). */
const STAMP = /^\d{4}-\d{2}-\d{2}-\d{6}/;

/**
 * Why `name` can't be a note's new name, or null if it can. `basename` is the name of the note being renamed.
 * Characters forbidden on Windows / Android (synced vaults) and Obsidian's link characters are refused. With
 * `keepStampPrefix` (setting "Keep a date-time prefix when renaming"), a note whose name starts with a
 * YYYY-MM-DD-HHmmss date-time can only get a name that starts with one too, in any folder.
 */
export function noteNameError(name: string, basename: string, keepStampPrefix: boolean): string | null {
  const bad = name.match(/[\\/:#^[\]|*"<>?]/);
  if (bad) return `A note name can't contain ${bad[0]}`;
  if (name.startsWith(".")) return "A note name can't start with a dot";
  if (/\.md$/i.test(name)) return "Leave out the .md extension";
  if (keepStampPrefix && STAMP.test(basename) && !STAMP.test(name)) {
    return "Keep the name's YYYY-MM-DD-HHmmss date-time prefix (setting: Keep a date-time prefix when renaming)";
  }
  return null;
}

/** The title as typed, tidied: whitespace runs (pasted line breaks too) become one space, ends trimmed. */
export function tidyName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}
