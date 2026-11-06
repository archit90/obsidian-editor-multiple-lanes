// "Exceptions to lanes only": notes that keep opening in normal tabs. No DOM or app access, so it can be tested.
//
// One pattern per line; blank lines and lines starting with # are ignored; matching ignores case.
//   folder/         every note in that folder and its subfolders
//   folder/note.md  that note (the .md may be left out); a bare name without "/" matches a note of that name anywhere
//   *.excalidraw.md wildcards: * is any run of characters except "/", ** also crosses folders, ? one character.
//                   A pattern without "/" is matched against the file name, one with "/" against the full path.

export type Matcher = (path: string) => boolean;

const escape = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");

function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++; // "**/" also matches no folder at all
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += escape(c);
  }
  return new RegExp(`^${re}$`, "i");
}

function compileOne(raw: string): Matcher | null {
  let p = raw.trim().replace(/\\/g, "/");
  if (!p || p.startsWith("#")) return null;
  p = p.replace(/^\/+/, "");
  if (!p) return null;
  if (/[*?]/.test(p)) {
    const re = globToRegExp(p);
    if (!p.includes("/")) return path => re.test(path.split("/").pop() ?? path);
    return path => re.test(path);
  }
  const lower = p.toLowerCase();
  if (lower.endsWith("/")) return path => path.toLowerCase().startsWith(lower);
  const withExt = /\.[a-z0-9]+$/i.test(lower) ? lower : `${lower}.md`;
  if (!lower.includes("/")) {
    return path => (path.split("/").pop() ?? path).toLowerCase() === withExt;
  }
  return path => {
    const l = path.toLowerCase();
    return l === withExt || l === lower || l.startsWith(lower + "/");
  };
}

/** A matcher for the setting's text: true when a note at `path` (vault-relative) is an exception. */
export function compileExceptions(text: string): Matcher {
  const list = text
    .split(/\r?\n/)
    .map(compileOne)
    .filter((m): m is Matcher => !!m);
  if (!list.length) return () => false;
  return path => list.some(m => m(path));
}
