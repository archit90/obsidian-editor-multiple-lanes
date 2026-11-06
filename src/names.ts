/** Log notes in folder `0/` are named YYYY-MM-DD-HHmmss…; renaming must keep that stamp. */
const STAMP = /^\d{4}-\d{2}-\d{2}-\d{6}/;

/**
 * Why `name` can't be a note's new name, or null if it can. `basename` / `folder` describe the note being
 * renamed (`folder` is "" or "/" for the vault root). Characters forbidden on Windows / Android (synced
 * vaults) and Obsidian's link characters are refused.
 */
export function noteNameError(name: string, basename: string, folder: string): string | null {
  const bad = name.match(/[\\/:#^[\]|*"<>?]/);
  if (bad) return `A note name can't contain ${bad[0]}`;
  if (name.startsWith(".")) return "A note name can't start with a dot";
  if (/\.md$/i.test(name)) return "Leave out the .md extension";
  if (folder === "0" && STAMP.test(basename) && !STAMP.test(name)) {
    return "A log's name must keep its YYYY-MM-DD-HHmmss prefix";
  }
  return null;
}

/** The title as typed, tidied: whitespace runs (pasted line breaks too) become one space, ends trimmed. */
export function tidyName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}
