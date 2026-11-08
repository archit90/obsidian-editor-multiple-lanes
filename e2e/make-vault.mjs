// Run by e2e/sandbox.sh once a sandbox's vault is made, before Obsidian starts: `node e2e/make-vault.mjs <vault>`.
// Writes the suite's fixtures (fixtures.mjs: notes, bulk notes, a PDF, an image, a canvas, a base) and the
// settings the suite relies on: in .obsidian/app.json "Automatically update internal links" and a local trash,
// and the core plugins it uses (Workspaces among them, which is off in a new vault). With Templater installed
// (OBS_PLUGINS), also a templates folder with a "zettel" template, and Alt+N for "Create new note from template",
// unless the vault has its own. Idempotent: a file is only written when its content differs. In a copy of
// another vault (OBS_VAULT) only the suite's own fixture paths are added or refreshed; its notes stay as they are.
import fs from "node:fs";
import path from "node:path";
import { TEMPLATES, ZETTEL_TEMPLATE, allFiles } from "./fixtures.mjs";

const vault = process.argv[2];
if (!vault || !fs.existsSync(path.join(vault, ".obsidian"))) {
  console.error("usage: node e2e/make-vault.mjs <vault>   (a folder with .obsidian/ in it)");
  process.exit(2);
}

let written = 0;
/** Write `data` to the vault-relative `rel` unless it's there already with that content. */
function put(rel, data) {
  const file = path.join(vault, rel);
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
  if (fs.existsSync(file) && fs.readFileSync(file).equals(buf)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  written++;
}
/** Merge `values` into the JSON object in .obsidian/<name> (made if missing); other keys stay. */
function mergeJson(name, values) {
  const file = path.join(vault, ".obsidian", name);
  const cur = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const next = { ...cur, ...values };
  if (JSON.stringify(next) !== JSON.stringify(cur)) {
    fs.writeFileSync(file, JSON.stringify(next, null, 2));
    written++;
  }
  return next;
}

for (const [rel, data] of Object.entries(allFiles())) put(rel, data);
// _test/ (sandbox.sh makes it) holds the notes cases create for themselves
fs.mkdirSync(path.join(vault, "_test"), { recursive: true });

// a rename from a card title updates links without asking; trashed notes stay in the vault (.trash)
mergeJson("app.json", { alwaysUpdateLinks: true, trashOption: "local" });
// core plugins the suite uses, on (a new vault has most of them on already; Workspaces is off)
const core = [
  "file-explorer",
  "global-search",
  "switcher",
  "command-palette",
  "graph",
  "canvas",
  "bases",
  "outgoing-link",
  "outline",
  "page-preview",
  "word-count",
  "bookmarks",
  "workspaces",
  "daily-notes",
  "editor-status",
  "properties",
  "file-recovery",
];
mergeJson("core-plugins.json", Object.fromEntries(core.map(id => [id, true])));

// Templater, when it's one of the plugins to test together: its templates and Alt+N, unless the vault has its own
const tpl = path.join(vault, ".obsidian", "plugins", "templater-obsidian");
if (fs.existsSync(path.join(tpl, "manifest.json"))) {
  if (!fs.existsSync(path.join(tpl, "data.json"))) {
    fs.writeFileSync(path.join(tpl, "data.json"), JSON.stringify({ templates_folder: TEMPLATES.folder }, null, 2));
    written++;
  }
  put(TEMPLATES.zettel, ZETTEL_TEMPLATE);
  const hk = path.join(vault, ".obsidian", "hotkeys.json");
  const keys = fs.existsSync(hk) ? JSON.parse(fs.readFileSync(hk, "utf8")) : {};
  const id = "templater-obsidian:create-new-note-from-template";
  if (!keys[id]?.length) mergeJson("hotkeys.json", { [id]: [{ modifiers: ["Alt"], key: "N" }] });
}

console.log(`make-vault: ${written} file(s) written in ${vault}`);
