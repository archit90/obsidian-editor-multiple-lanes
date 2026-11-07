/*
GENERATED FILE, built by esbuild from src/. Edit the TypeScript sources, not this file.
*/

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => EditorLanesPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian8 = require("obsidian");
var import_view = require("@codemirror/view");

// src/card-scroll.ts
function scrollDelta(view, target, inset = 0, how = "nearest", margin = 8) {
  const top = view.top + Math.max(0, inset);
  const toStart = target.top - (top + margin);
  if (how === "start") return toStart;
  if (how === "center") return (target.top + target.bottom) / 2 - (top + view.bottom) / 2;
  if (target.top < top + margin) return toStart;
  if (target.bottom > view.bottom - margin) {
    const toEnd = target.bottom - (view.bottom - margin);
    return Math.min(toEnd, toStart);
  }
  return 0;
}
function locateText(texts, start, end) {
  let pos = 0;
  let from = null;
  for (let i = 0; i < texts.length; i++) {
    const next = pos + texts[i].length;
    if (pos <= start && start <= next) from = [i, start - pos];
    if (from && pos <= end && end <= next) return { from, to: [i, end - pos] };
    pos = next;
  }
  return null;
}
var isScroller = (el) => {
  const oy = el.win.getComputedStyle(el).overflowY;
  return (oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1;
};
function coveredTop(scroller, card) {
  let h = 0;
  if (scroller.hasClass("lane-list"))
    h += card.querySelector(":scope > .lane-item-header")?.offsetHeight ?? 0;
  const bar = card.querySelector(".lane-item-body .document-search-container");
  if (bar && scroller.contains(bar)) h += bar.offsetHeight;
  return h;
}
function scrollCardBand(el, rect, how) {
  const card = el.closest(".lane-item");
  const list = card?.closest(".lane-list");
  if (!card || !list) return false;
  for (let s = el.parentElement; s; s = s.parentElement) {
    if (s !== list && !isScroller(s)) continue;
    const r = rect();
    if (!r) break;
    const v = s.getBoundingClientRect();
    const d = scrollDelta({ top: v.top, bottom: v.top + s.clientHeight }, r, coveredTop(s, card), how);
    if (Math.abs(d) >= 1) s.scrollTop += d;
    if (s === list) break;
  }
  return true;
}
function matchBand(sectionEl, start, end) {
  const nodes = [];
  const walk = sectionEl.doc.createTreeWalker(
    sectionEl,
    4
    /* NodeFilter.SHOW_TEXT */
  );
  for (let n = walk.nextNode(); n; n = walk.nextNode()) nodes.push(n);
  const loc = locateText(
    nodes.map((n) => n.textContent ?? ""),
    start,
    end
  );
  let r = null;
  if (loc) {
    const range = sectionEl.doc.createRange();
    range.setStart(nodes[loc.from[0]], loc.from[1]);
    range.setEnd(nodes[loc.to[0]], loc.to[1]);
    r = range.getBoundingClientRect();
  }
  if (!r || !r.width && !r.height) r = sectionEl.getBoundingClientRect();
  return r.width || r.height ? { top: r.top, bottom: r.bottom } : null;
}

// ../node_modules/monkey-around/dist/index.mjs
function around(obj, factories) {
  const removers = Object.keys(factories).map((key) => around1(obj, key, factories[key]));
  return removers.length === 1 ? removers[0] : function() {
    removers.forEach((r) => r());
  };
}
function around1(obj, method, createWrapper) {
  const inherited = obj[method], hadOwn = obj.hasOwnProperty(method), original = hadOwn ? inherited : function() {
    return Object.getPrototypeOf(obj)[method].apply(this, arguments);
  };
  let current = createWrapper(original);
  if (inherited)
    Object.setPrototypeOf(current, inherited);
  Object.setPrototypeOf(wrapper, current);
  obj[method] = wrapper;
  return remove;
  function wrapper(...args) {
    if (current === original && obj[method] === wrapper)
      remove();
    return current.apply(this, args);
  }
  function remove() {
    if (obj[method] === wrapper) {
      if (hadOwn)
        obj[method] = original;
      else
        delete obj[method];
    }
    if (current === original)
      return;
    current = original;
    Object.setPrototypeOf(wrapper, inherited || Function);
  }
}

// src/config.ts
var DEFAULTS = {
  lanesOnly: true,
  linkTarget: "next",
  newNotePosition: "top",
  duplicateMode: "copy",
  routeExceptions: "",
  defaultLayout: "50, 50",
  accordion: false,
  maxNotesPerLane: 0,
  autoCollapseAfter: 0,
  showFolder: true,
  headerSize: "comfortable",
  noteHeight: "grow",
  noteMaxHeight: 600,
  showBacklinks: true,
  preloadDistance: 300,
  dropOnText: "insert"
};
var LIMITS = {
  maxNotesPerLane: [0, 500],
  autoCollapseAfter: [0, 500],
  noteMaxHeight: [80, 1e4],
  preloadDistance: [0, 5e3]
};
var CHOICES = {
  linkTarget: ["next", "same", "last"],
  newNotePosition: ["top", "bottom", "after"],
  duplicateMode: ["copy", "jump", "move"],
  headerSize: ["comfortable", "compact"],
  noteHeight: ["grow", "cap"],
  dropOnText: ["insert", "open"]
};
function parseCount(v, range) {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.trim()) : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n >= range[0] && n <= range[1] ? n : null;
}
function loadSettings(saved) {
  const raw = migrateSettings(saved);
  const out = Object.assign({}, DEFAULTS);
  const o = out;
  for (const key of Object.keys(DEFAULTS)) {
    if (!(key in raw)) continue;
    const v = raw[key];
    const def = DEFAULTS[key];
    const choices = CHOICES[key];
    const range = LIMITS[key];
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
function migrateSettings(saved) {
  const raw = saved && typeof saved === "object" ? { ...saved } : {};
  if (!("defaultLayout" in raw) && typeof raw.layout === "string") raw.defaultLayout = raw.layout;
  return raw;
}

// src/dom.ts
var asEl = (t) => t && t.nodeType === 1 ? t : null;

// src/exceptions.ts
var escape = (s) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += escape(c);
  }
  return new RegExp(`^${re}$`, "i");
}
function compileOne(raw) {
  let p = raw.trim().replace(/\\/g, "/");
  if (!p || p.startsWith("#")) return null;
  p = p.replace(/^\/+/, "");
  if (!p) return null;
  if (/[*?]/.test(p)) {
    const re = globToRegExp(p);
    if (!p.includes("/")) return (path) => re.test(path.split("/").pop() ?? path);
    return (path) => re.test(path);
  }
  const lower = p.toLowerCase();
  if (lower.endsWith("/")) return (path) => path.toLowerCase().startsWith(lower);
  const md = `${lower}.md`;
  if (!lower.includes("/")) {
    return (path) => {
      const base = (path.split("/").pop() ?? path).toLowerCase();
      return base === lower || base === md;
    };
  }
  return (path) => {
    const l = path.toLowerCase();
    return l === lower || l === md || l.startsWith(lower + "/");
  };
}
function compileExceptions(text) {
  const list = text.split(/\r?\n/).map(compileOne).filter((m) => !!m);
  if (!list.length) return () => false;
  return (path) => list.some((m) => m(path));
}

// src/lanes-view.ts
var import_obsidian5 = require("obsidian");

// src/lane.ts
var import_obsidian2 = require("obsidian");

// src/hosting.ts
var import_obsidian = require("obsidian");
function createHostSplit(ws, ...cls) {
  const split = new import_obsidian.WorkspaceSplit(ws, "horizontal");
  let detached = false;
  Object.defineProperty(split, "parent", {
    configurable: true,
    get: () => detached ? null : ws.rightSplit ?? null,
    set: (v) => {
      if (v === null) detached = true;
    }
  });
  split.containerEl.addClass("lane-split", "mod-visible", ...cls);
  return split;
}

// src/park.ts
var PARK_MS = 5e3;
var PARK_CHECK_MS = 1e3;
var PARK_SCREENS = 3;
function parkDistance(viewHeight, preloadDistance) {
  return Math.max(PARK_SCREENS * viewHeight, preloadDistance + 2 * viewHeight);
}
function isFar(view, card, distance) {
  return card.bottom < view.top - distance || card.top > view.bottom + distance;
}
function parkStep(farSince, far, keep, now) {
  if (!far || keep) return { since: null, park: false };
  const since = farSince ?? now;
  return { since, park: now - since >= PARK_MS };
}

// src/dnd.ts
function pickDropEffect(effectAllowed, prefs) {
  const allowed = (effectAllowed || "all").toLowerCase();
  if (allowed === "all" || allowed === "uninitialized") return prefs[0] ?? null;
  if (allowed === "none") return null;
  return prefs.find((p) => allowed.includes(p)) ?? null;
}
function clampIn(list, pinned, index) {
  const n = list.filter((i) => i.pinned).length;
  return pinned ? Math.min(Math.max(index, 0), n) : Math.min(Math.max(index, n), list.length);
}
function linkpathsInText(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const url = /^obsidian:\/\/open\?(.*)$/.exec(t);
    if (url) {
      const file = new URLSearchParams(url[1]).get("file");
      if (file) out.push(file);
      continue;
    }
    const before = out.length;
    for (const m of t.matchAll(/\[\[([^\]|#^]+)/g)) out.push(m[1].trim());
    for (const m of t.matchAll(/\]\(<?([^)>#]+?\.md)(?:#[^)>]*)?>?\)/g)) {
      let target = m[1];
      try {
        target = decodeURIComponent(target);
      } catch {
      }
      out.push(target);
    }
    if (out.length === before && !/[[\]()]/.test(t)) out.push(t);
  }
  return out;
}

// src/names.ts
var STAMP = /^\d{4}-\d{2}-\d{2}-\d{6}/;
function noteNameError(name, basename, folder) {
  const bad = name.match(/[\\/:#^[\]|*"<>?]/);
  if (bad) return `A note name can't contain ${bad[0]}`;
  if (name.startsWith(".")) return "A note name can't start with a dot";
  if (/\.md$/i.test(name)) return "Leave out the .md extension";
  if (folder === "0" && STAMP.test(basename) && !STAMP.test(name)) {
    return "A log's name must keep its YYYY-MM-DD-HHmmss prefix";
  }
  return null;
}
function tidyName(raw) {
  return raw.replace(/\s+/g, " ").trim();
}

// src/tidy.ts
var oldestFirst = (a, b) => a.openedAt - b.openedAt;
function accordionCollapse(items, keep) {
  return items.filter((i) => i !== keep && !i.pinned && !i.collapsed);
}
function overExpanded(items, max, keep) {
  if (max <= 0) return [];
  const extra = items.filter((i) => !i.collapsed).length - max;
  if (extra <= 0) return [];
  return items.filter((i) => i !== keep && !i.pinned && !i.collapsed).sort(oldestFirst).slice(0, extra);
}
function overLimit(items, max, keep) {
  if (max <= 0) return [];
  const extra = items.length - max;
  if (extra <= 0) return [];
  return items.filter((i) => i !== keep && !i.pinned).sort(oldestFirst).slice(0, extra);
}
function insertIndex(others, position, after) {
  if (position === "bottom") return others.length;
  if (position === "after" && after) {
    const i = others.indexOf(after);
    if (i >= 0) return i + 1;
  }
  return 0;
}

// src/layout.ts
var MAX_COLUMNS = 8;
var MAX_ROWS = 6;
function parseLayout(text) {
  const parts = text.split(/[,;]/).map((p) => p.trim()).filter((p) => p !== "");
  if (!parts.length) return { ok: false, error: "Enter at least one column, e.g. 50, 50" };
  if (parts.length > MAX_COLUMNS) return { ok: false, error: `At most ${MAX_COLUMNS} columns` };
  const cols = [];
  for (const p of parts) {
    const m = /^(\d+(?:\.\d+)?)?\s*(?:[x×*]\s*(\d+))?$/i.exec(p);
    if (!m || m[1] === void 0 && m[2] === void 0) {
      return { ok: false, error: `"${p}" isn't a width, or a width x rows (e.g. 30 or 30x2)` };
    }
    const w = m[1] === void 0 ? 1 : Number(m[1]);
    const rows = m[2] === void 0 ? 1 : Number(m[2]);
    if (!(w > 0)) return { ok: false, error: `"${p}": a width must be more than 0` };
    if (rows < 1 || rows > MAX_ROWS) return { ok: false, error: `"${p}": 1 to ${MAX_ROWS} lanes per column` };
    cols.push({ w, rows });
  }
  const total = cols.reduce((s, c) => s + c.w, 0);
  return { ok: true, columns: cols.map((c) => ({ width: c.w / total * 100, rows: c.rows })) };
}
var PRESETS = [
  { name: "1 lane", layout: "100" },
  { name: "2 columns", layout: "50, 50" },
  { name: "3 columns", layout: "1, 1, 1" },
  { name: "2 \xD7 2", layout: "50x2, 50x2" },
  { name: "1 + 2 stacked", layout: "50, 50x2" },
  { name: "Wide middle", layout: "25, 50, 25" }
];
function describeLayout(columns) {
  const n = laneCount(columns);
  const cols = columns.map((c) => `${Math.round(c.width)}%${c.rows > 1 ? ` (${c.rows} stacked)` : ""}`);
  return `${n} lane${n === 1 ? "" : "s"}: ${cols.join(" | ")}`;
}
function laneCount(columns) {
  return columns.reduce((s, c) => s + c.rows, 0);
}
function mergeTarget(index, keep) {
  return keep <= 0 ? -1 : index < keep ? index : index % keep;
}
function wrapStep(order, current, step) {
  const n = order.length;
  if (!n) return null;
  const i = order.indexOf(current);
  if (i < 0) return order[0];
  return order[((i + step) % n + n) % n];
}
function nearestIndex(starts, pos) {
  let best = -1;
  for (let i = 0; i < starts.length; i++) {
    if (best < 0 || Math.abs(starts[i] - pos) < Math.abs(starts[best] - pos)) best = i;
  }
  return best;
}
function formatLayout(columns) {
  return columns.map((c) => `${Math.max(1, Math.round(c.width))}${c.rows > 1 ? `x${c.rows}` : ""}`).join(", ");
}
function planRelayout(oldCount, newCount) {
  const slots = Array.from({ length: newCount }, (_, j) => j < oldCount ? j : null);
  const merges = [];
  for (let i = newCount; i < oldCount; i++) merges.push({ from: i, to: mergeTarget(i, newCount) });
  return { slots, merges };
}
function resizePair(shares, i, delta, min = 5) {
  const out = [...shares];
  if (i < 0 || i + 1 >= out.length) return out;
  const pair = out[i] + out[i + 1];
  const lo = Math.min(min, pair / 2);
  const a = Math.min(Math.max(out[i] + delta, lo), pair - lo);
  out[i] = a;
  out[i + 1] = pair - a;
  return out;
}
function effectiveShares(columns, sizes) {
  const fits = !!sizes && sizes.for === formatLayout(columns) && sizes.cols.length === columns.length && columns.every((c, i) => sizes.rows[i]?.length === c.rows);
  if (fits) return { cols: [...sizes.cols], rows: sizes.rows.map((r) => [...r]) };
  return {
    cols: columns.map((c) => c.width),
    rows: columns.map((c) => Array.from({ length: c.rows }, () => 100 / c.rows))
  };
}

// src/tab-names.ts
var TAB_TITLE_PREFIX = "Editor lane ";
var MAX_TAB_NAME = 40;
var TAB_NAMES = [
  // Shakespeare
  "Ariel",
  "Puck",
  "Oberon",
  "Titania",
  "Prospero",
  "Miranda",
  "Caliban",
  "Ophelia",
  "Hamlet",
  "Horatio",
  "Portia",
  "Viola",
  "Olivia",
  "Rosalind",
  "Orlando",
  "Beatrice",
  "Benedick",
  "Juliet",
  "Romeo",
  "Mercutio",
  "Tybalt",
  "Falstaff",
  "Iago",
  "Othello",
  "Lear",
  "Cordelia",
  "Macbeth",
  "Banquo",
  "Imogen",
  "Perdita",
  "Hermia",
  "Lysander",
  "Helena",
  "Malvolio",
  "Cressida",
  "Troilus",
  // Arthurian legend
  "Merlin",
  "Arthur",
  "Gawain",
  "Lancelot",
  "Galahad",
  "Percival",
  "Tristan",
  "Isolde",
  "Morgana",
  "Nimue",
  "Mordred",
  "Bedivere",
  "Elaine",
  "Guinever",
  // Greek myth and epic
  "Odysseus",
  "Penelope",
  "Achilles",
  "Hector",
  "Ajax",
  "Medea",
  "Theseus",
  "Ariadne",
  "Icarus",
  "Daedalus",
  "Orpheus",
  "Eurydice",
  "Perseus",
  "Pandora",
  "Circe",
  "Calypso",
  "Psyche",
  "Electra",
  "Aeneas",
  "Dido",
  "Atalanta",
  "Galatea",
  // Norse, Celtic, Germanic and other legend
  "Freya",
  "Sigurd",
  "Brynhild",
  "Beowulf",
  "Grendel",
  "Fingal",
  "Ossian",
  "Deirdre",
  "Oisin",
  "Enkidu",
  "Roland",
  "Undine",
  "Melusine",
  "Lorelei",
  // Folklore and fairy tales
  "Alice",
  "Gretel",
  "Hansel",
  "Rapunzel",
  "Aladdin",
  "Sinbad",
  "Marian",
  "Heidi",
  // Classic novels and tales
  "Gulliver",
  "Crusoe",
  "Quixote",
  "Sancho",
  "Dulcinea",
  "Ishmael",
  "Ahab",
  "Queequeg",
  "Nemo",
  "Phileas",
  "Dorian",
  "Jekyll",
  "Holmes",
  "Watson",
  "Moriarty",
  "Dracula",
  "Mina",
  "Darcy",
  "Pip",
  "Estella",
  "Havisham",
  "Fagin",
  "Scrooge",
  "Micawber",
  "Pickwick",
  "Huck",
  "Ivanhoe",
  "Rowena",
  "Athos",
  "Porthos",
  "Aramis",
  "Valjean",
  "Cosette",
  "Javert",
  "Fantine",
  "Candide",
  "Pangloss",
  "Faust",
  "Mephisto",
  "Ichabod",
  "Uncas",
  "Hester",
  "Ligeia",
  "Lenore",
  "Annabel",
  "Usher",
  "Mowgli",
  "Baloo",
  "Bagheera",
  "Akela",
  "Ayesha",
  "Dorothy",
  "Toto",
  "Ozma",
  "Glinda",
  "Ratty",
  "Lupin"
];
function tidyTabName(raw) {
  return raw.replace(/\s+/g, " ").trim();
}
function tabNameError(raw) {
  const name = tidyTabName(raw);
  if (!name) return "Enter a name";
  if (name.length > MAX_TAB_NAME) return `At most ${MAX_TAB_NAME} characters (this is ${name.length})`;
  return null;
}
function readTabName(v) {
  if (typeof v !== "string") return null;
  return tabNameError(v) === null ? tidyTabName(v) : null;
}
function roman(n) {
  const parts = [
    [1e3, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"]
  ];
  let out = "";
  let rest = Math.max(1, Math.floor(n));
  for (const [v, s] of parts) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}
function pickTabName(used, random = Math.random, names = TAB_NAMES) {
  if (!names.length) return "Lanes";
  const taken = /* @__PURE__ */ new Set();
  for (const u of used) if (typeof u === "string") taken.add(u.toLowerCase());
  for (let round = 1; ; round++) {
    const suffix = round === 1 ? "" : ` ${roman(round)}`;
    const free = names.map((n) => n + suffix).filter((n) => !taken.has(n.toLowerCase()));
    if (free.length) {
      const i = Math.min(free.length - 1, Math.max(0, Math.floor(random() * free.length)));
      return free[i];
    }
  }
}

// src/tab-state.ts
var nums = (v) => Array.isArray(v) && v.every((n) => typeof n === "number" && Number.isFinite(n) && n > 0) ? v : null;
function readSizes(v) {
  if (!v || typeof v !== "object") return null;
  const o = v;
  const cols = nums(o.cols);
  const rows = Array.isArray(o.rows) ? o.rows.map(nums) : null;
  if (typeof o.for !== "string" || !cols || !rows || rows.some((r) => !r)) return null;
  return { for: o.for, cols, rows };
}
function readView(v) {
  if (!v || typeof v !== "object") return null;
  const o = v;
  const out = {};
  if (o.mode === "preview" || o.mode === "source") out.mode = o.mode;
  if (typeof o.source === "boolean") out.source = o.source;
  return out.mode || out.source !== void 0 ? out : null;
}
function readItem(v) {
  if (!v || typeof v !== "object") return null;
  const o = v;
  if (typeof o.path !== "string" || !o.path) return null;
  const d = { path: o.path, collapsed: !!o.collapsed };
  if (o.pinned) d.pinned = true;
  if (typeof o.openedAt === "number" && Number.isFinite(o.openedAt)) d.openedAt = o.openedAt;
  const view = readView(o.view);
  if (view) d.view = view;
  return d;
}
function readTabState(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const layout = typeof o.layout === "string" && parseLayout(o.layout).ok ? o.layout : null;
  const lanes = Array.isArray(o.lanes) ? o.lanes.map((l) => Array.isArray(l) ? l.map(readItem).filter((d) => !!d) : []) : [];
  return { name: readTabName(o.name), layout, sizes: readSizes(o.sizes), lanes };
}
function savedTabName(raw) {
  return raw && typeof raw === "object" ? readTabName(raw.name) : null;
}
function fitLanes(lanes, count) {
  const out = Array.from({ length: Math.max(count, 0) }, (_, i) => [...lanes[i] ?? []]);
  if (!out.length) return out;
  for (let i = count; i < lanes.length; i++) out[mergeTarget(i, count)].push(...lanes[i]);
  return out.map((lane) => {
    const seen = /* @__PURE__ */ new Map();
    for (const d of lane) {
      const had = seen.get(d.path);
      if (!had) seen.set(d.path, { ...d });
      else if (d.pinned) had.pinned = true;
    }
    return [...seen.values()];
  });
}

// src/types.ts
var VIEW_TYPE = "editor-lanes";
var LEGACY_VIEW_TYPE = "editor-lane";
var OLD_NAV_VIEW_TYPE = "editor-lanes-navigator";
var SWALLOW_MS = 700;
var INTENT_MS = 2e3;
var RESTORE_MS = 5e3;
var lastStamp = 0;
function stamp() {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}
function asRecord(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : void 0;
}

// src/view-mode.ts
var VIEW_MODES = ["reading", "live", "source"];
var MODE_TITLES = {
  reading: "Reading view",
  live: "Live Preview",
  source: "Source mode"
};
var MODE_ICONS = { reading: "book-open", live: "edit-3", source: "code-2" };
function modeOfState(state, defaults = {}) {
  const s = state && typeof state === "object" ? state : {};
  const mode = s.mode === "preview" || s.mode === "source" ? s.mode : defaults.defaultViewMode;
  if (mode === "preview") return "reading";
  const source = typeof s.source === "boolean" ? s.source : defaults.livePreview === false;
  return source ? "source" : "live";
}
function stateForMode(mode) {
  if (mode === "reading") return { mode: "preview" };
  return { mode: "source", source: mode === "source" };
}
function toggledState(state, defaults = {}) {
  return { mode: modeOfState(state, defaults) === "reading" ? "source" : "preview" };
}
function ownViewChange(saved, mounted, current, mounting) {
  if (saved === null) {
    if (mounting) return { save: false, mounted: current };
    if (mounted === void 0 || mounted === current) return { save: false, mounted };
    return { save: true, mounted };
  }
  return { save: current !== saved, mounted };
}

// src/lane.ts
var srHintSeq = 0;
var saving = /* @__PURE__ */ new Map();
var unmounting = /* @__PURE__ */ new WeakSet();
var FILE_MENU_SECTIONS = [
  "title",
  "open",
  "action-primary",
  "action",
  "info",
  "info.copy",
  "view",
  "system",
  "",
  "danger"
];
var Lane = class {
  constructor(tab, plugin) {
    this.tab = tab;
    this.plugin = plugin;
    this.items = [];
    this.observer = null;
    this.observerMargin = -1;
    // the pre-load distance the observer was built with
    this.observerWin = null;
    // and the window (a tab moved to a popout needs a new one)
    this.lazyQueue = [];
    /** Card header heights → `--lane-header-h` on each card (an open search bar sticks right below it). */
    this.headerObserver = null;
    this.draining = false;
    /**
     * Set when the lane is destroyed: its place in the tab's layout then. An open can pick a lane and then wait
     * (revealLeaf) while the tab rebuilds its lanes (a background tab loading its saved state): it goes to the lane
     * now at that place instead, and nothing is ever mounted into a destroyed lane (its editor would stay registered
     * as a leaf, detached from the page).
     */
    this.destroyedAt = null;
    /** When each mounted card was first seen far from view (EL-19). */
    this.farSince = /* @__PURE__ */ new WeakMap();
    this.waking = 0;
    /** The card that shows the drop line, and on which side. */
    this.dropMark = null;
    const root = this.el = tab.contentEl.createDiv({ cls: "lane" });
    root.addEventListener("pointerdown", () => this.plugin.notePointerIn(this), { capture: true });
    this.emptyEl = root.createDiv({
      cls: "lane-empty",
      text: import_obsidian2.Platform.isMobile ? "Open a note, long-press a link \u2192 Open in editor lane, or drag a note here." : "Open a note, Shift-click a link, or drag a note or link here."
    });
    this.listEl = root.createDiv({ cls: "lane-list" });
    this.listEl.addEventListener(
      "scroll",
      () => {
        const host = this.plugin.hostedLeaves.get(this.app.workspace.activeLeaf);
        if (host?.lane === this) this.app.workspace.editorSuggest?.reposition();
        this.wakeParkedSoon();
      },
      { passive: true }
    );
    this.updateEmpty();
    this.setupDrop(root);
    root.addEventListener("contextmenu", (e) => {
      if (asEl(e.target)?.closest(".lane-item")) return;
      e.preventDefault();
      const menu = new import_obsidian2.Menu();
      this.tab.addLaneMenuItems(menu, this);
      menu.showAtMouseEvent(e);
    });
    this.applySettings();
  }
  /** The lane that took this destroyed lane's place (else the tab's current lane), or null if the tab is gone. */
  successor() {
    if (this.destroyedAt === null) return this;
    const next = this.tab.lanes[this.destroyedAt] ?? this.tab.currentLane();
    return next && next !== this ? next : null;
  }
  get app() {
    return this.plugin.app;
  }
  save() {
    this.tab.save();
  }
  /** What a lane shows and how it loads, from the settings; called when made and whenever settings change. */
  applySettings() {
    for (const it of this.items) this.updateTitle(it);
    if (this.observerMargin !== this.plugin.settings.preloadDistance || this.observerWin !== this.el.win) {
      this.buildObserver();
    }
  }
  /** The tab moved to another window: lazy mounting needs an observer from that window. */
  checkWindow() {
    if (this.observerWin !== this.el.win) this.buildObserver();
  }
  /** Detach every hosted leaf and stop observing. Safe to call twice. */
  destroy() {
    if (this.destroyedAt === null) this.destroyedAt = Math.max(0, this.tab.lanes.indexOf(this));
    for (const it of this.items) this.unmount(it);
    this.items = [];
    this.lazyQueue = [];
    this.listEl.empty();
    this.observer?.disconnect();
    this.observer = null;
    this.observerMargin = -1;
    this.headerObserver?.disconnect();
    this.headerObserver = null;
    if (this.waking) this.el.win.cancelAnimationFrame(this.waking);
    this.waking = 0;
    if (this.plugin.lastLane === this) this.plugin.lastLane = null;
  }
  // ---------- persistence (the tab's view state) ----------
  getState() {
    return this.items.map((i) => {
      const d = { path: i.file.path, collapsed: i.collapsed, pinned: i.pinned, openedAt: i.openedAt };
      if (i.view) d.view = { ...i.view };
      return d;
    });
  }
  /** Cards from a saved state (an empty lane only). Notes that no longer exist are skipped. */
  load(list) {
    if (this.items.length) return;
    list.forEach((d, n) => {
      const f = this.app.vault.getAbstractFileByPath(d.path);
      if (!(f instanceof import_obsidian2.TFile) || this.items.some((i) => i.file === f)) return;
      const it = this.createItem(f, d.collapsed, !!d.pinned, d.openedAt ?? list.length - n);
      if (d.view) this.restoreView(it, d.view);
      this.place(it, this.items.length);
      if (!it.collapsed) this.mountLazily(it);
    });
    this.updateEmpty();
  }
  /** The vault changed: a deleted note's card closes, a renamed one's title follows. */
  onFileDeleted(f) {
    for (const it of this.items.filter((i) => i.file === f)) this.close(it);
  }
  onFileRenamed(f) {
    const it = this.items.find((i) => i.file === f);
    if (!it) return;
    this.updateTitle(it);
    this.save();
  }
  /**
   * Expanded notes restored from a layout (or "Expand all") mount once they're scrolled within the pre-load
   * distance. IntersectionObserver's rootMargin is fixed at construction, so a new distance needs a new one;
   * every expanded note that hasn't mounted yet is observed again.
   */
  buildObserver() {
    this.observer?.disconnect();
    this.observer = null;
    const margin = this.plugin.settings.preloadDistance;
    this.observerMargin = margin;
    this.observerWin = this.el.win;
    try {
      const IO = this.el.win?.IntersectionObserver ?? IntersectionObserver;
      this.observer = new IO(
        (entries) => {
          for (const en of entries) {
            if (!en.isIntersecting) continue;
            const it = this.items.find((i) => i.el === en.target);
            if (it && !it.collapsed && !it.leaf && !this.lazyQueue.includes(it)) this.lazyQueue.push(it);
          }
          void this.drainLazy();
        },
        { root: this.listEl, rootMargin: `${margin}px 0px` }
      );
    } catch {
      this.observer = null;
    }
    for (const it of this.items) if (!it.collapsed && !it.leaf) this.mountLazily(it);
    this.headerObserver?.disconnect();
    this.headerObserver = null;
    try {
      const RO = this.el.win?.ResizeObserver ?? ResizeObserver;
      this.headerObserver = new RO((entries) => {
        for (const en of entries) {
          const head = en.target;
          head.parentElement?.style.setProperty("--lane-header-h", `${head.offsetHeight}px`);
        }
      });
    } catch {
      this.headerObserver = null;
    }
    for (const it of this.items) this.observeHeader(it);
  }
  /** Watch (`on` false: stop watching) a card header's height. */
  observeHeader(it, on = true) {
    const head = it.el.querySelector(":scope > .lane-item-header");
    if (!head) return;
    if (on) this.headerObserver?.observe(head);
    else this.headerObserver?.unobserve(head);
  }
  // ---------- items ----------
  /**
   * Add a note where "New notes go" says (by default the top, below any pinned notes), or at `opts.index`, and
   * expand it. A note already in this lane moves there instead; a pinned one keeps its place. Then the
   * "Keeping lanes tidy" rules run, never touching this note.
   */
  async add(file, opts = {}) {
    if (this.destroyedAt !== null) return void await this.successor()?.add(file, opts);
    this.plugin.lastLane = this;
    let it = this.items.find((i) => i.file === file);
    const isNew = !it;
    if (!it) it = this.createItem(file, false);
    it.openedAt = stamp();
    const cur = this.items.indexOf(it);
    if (opts.index !== void 0) this.placeAt(it, cur >= 0 && cur < opts.index ? opts.index - 1 : opts.index);
    else if (!it.pinned || cur < 0) {
      const others = this.items.filter((i) => i !== it);
      this.place(it, insertIndex(others, this.plugin.settings.newNotePosition, opts.after));
    }
    this.updateEmpty();
    if (!it.leaf && opts.mode) it.pending = { ...it.pending, mode: opts.mode };
    if (isNew) this.closeOverLimit(it);
    await this.setCollapsed(it, false);
    this.afterExpand(it);
    if (opts.index === void 0) this.scrollToItem(it);
    if (opts.focus !== false) this.tab.showLane(this);
    const leaf = it.leaf;
    if (leaf) {
      if (opts.mode && leaf.getViewState().state?.mode !== opts.mode) {
        const vs = leaf.getViewState();
        await leaf.setViewState({ ...vs, state: { ...vs.state, mode: opts.mode } });
        this.syncView(it);
      }
      if (isNew && opts.history) {
        try {
          leaf.history?.deserialize?.(opts.history);
        } catch {
        }
      }
      if (opts.focus) this.app.workspace.setActiveLeaf(leaf, { focus: true });
      if (opts.eState) leaf.setEphemeralState(opts.eState);
    }
    this.save();
  }
  createItem(file, collapsed, pinned = false, openedAt = stamp()) {
    const el = createDiv({ cls: "lane-item" });
    const header = el.createDiv({ cls: "lane-item-header" });
    const chevEl = header.createEl("button", { cls: "lane-chevron" });
    const hintId = `lane-title-hint-${++srHintSeq}`;
    const nameEl = header.createSpan({ cls: "lane-item-name" });
    const pathEl = nameEl.createSpan({ cls: "lane-item-path" });
    const titleEl = nameEl.createSpan({
      cls: "lane-item-title",
      attr: {
        contenteditable: String(!import_obsidian2.Platform.isMobile),
        spellcheck: "false",
        role: "textbox",
        "aria-describedby": hintId
      }
    });
    header.createSpan({ cls: "lane-sr-only", text: "Note name. Edit to rename the note.", attr: { id: hintId } });
    const modeEl = header.createEl("button", { cls: "lane-mode clickable-icon" });
    const pinEl = header.createEl("button", { cls: "lane-pin clickable-icon" });
    (0, import_obsidian2.setIcon)(pinEl, "pin");
    const closeEl = header.createEl("button", { cls: "lane-close", text: "\u2715", attr: { "aria-label": "Close" } });
    const bodyEl = el.createDiv({ cls: "lane-item-body" });
    const it = {
      file,
      collapsed,
      pinned,
      openedAt,
      view: null,
      modeEl,
      el,
      pinEl,
      chevEl,
      titleEl,
      pathEl,
      bodyEl,
      split: null,
      leaf: null,
      ready: null,
      pending: null,
      editStart: null,
      cancelEdit: false
    };
    this.updateTitle(it);
    this.applyCollapsed(it);
    this.applyPinned(it);
    this.observeHeader(it);
    pinEl.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePin(it);
    });
    this.updateModeButton(it);
    modeEl.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.setView(it, toggledState(this.viewOf(it), this.modeDefaults()));
    });
    header.draggable = true;
    header.addEventListener("dragstart", (e) => {
      if (asEl(e.target)?.closest(".lane-item-title:focus, button")) {
        e.preventDefault();
        return;
      }
      this.plugin.dragItem = { lane: this, item: it };
      el.addClass("is-lane-dragging");
      const dm = this.app.dragManager;
      try {
        dm?.onDragStart?.(e, dm.dragFile(e, it.file, "editor-lanes"));
      } catch {
      }
    });
    header.addEventListener("dragend", () => this.plugin.endItemDrag());
    titleEl.addEventListener("focus", () => {
      header.draggable = false;
    });
    titleEl.addEventListener("blur", () => {
      header.draggable = true;
    });
    header.addEventListener("click", (e) => {
      if (e.target.closest(
        '.lane-item-title[contenteditable="true"], .lane-close, .lane-pin, .lane-mode'
      ))
        return;
      const expanding = it.collapsed;
      if (expanding) it.openedAt = stamp();
      void this.setCollapsed(it, !it.collapsed).then(() => {
        if (expanding) this.afterExpand(it);
        this.save();
      });
    });
    bodyEl.addEventListener("pointerdown", () => {
      if (!it.collapsed && !it.leaf) void this.mount(it);
    });
    titleEl.addEventListener("mousedown", (e) => {
      if (!import_obsidian2.Keymap.isModEvent(e)) return;
      e.preventDefault();
      if (this.plugin.settings.lanesOnly) void this.plugin.openInLane(it.file, "newTab", this, { focus: true });
      else void this.app.workspace.getLeaf("tab").openFile(it.file);
    });
    titleEl.addEventListener("focus", () => {
      if (it.editStart === null) it.editStart = titleEl.textContent ?? "";
    });
    titleEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        titleEl.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        it.cancelEdit = true;
        titleEl.setText(it.file.basename);
        titleEl.blur();
      } else if (e.key === "ArrowDown" && it.leaf) {
        e.preventDefault();
        this.app.workspace.setActiveLeaf(it.leaf, { focus: true });
      }
    });
    titleEl.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData?.getData("text/plain") ?? "").replace(/[\r\n]+/g, " ");
      titleEl.doc.execCommand("insertText", false, text);
    });
    titleEl.addEventListener("blur", () => {
      if (!it.cancelEdit && !titleEl.doc.hasFocus()) return;
      if (import_obsidian2.Platform.isMobile) titleEl.setAttr("contenteditable", "false");
      void this.renameFromTitle(it);
    });
    closeEl.addEventListener("click", (e) => {
      e.stopPropagation();
      this.close(it);
    });
    header.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const menu = new import_obsidian2.Menu();
      menu.addSections?.(["lane-open", "lane-move", "lane-view", "lane-note", ...FILE_MENU_SECTIONS]);
      const at = this.items.indexOf(it);
      menu.addItem(
        (i) => i.setSection("lane-open").setTitle("Open in next lane").setIcon("arrow-right").onClick(() => void this.plugin.openInLane(it.file, "next", this, { focus: true }))
      );
      menu.addItem(
        (i) => i.setSection("lane-open").setTitle("Open in new lanes tab").setIcon("columns-3").onClick(() => void this.plugin.openInLane(it.file, "newTab", this, { focus: true }))
      );
      menu.addItem(
        (i) => i.setSection("lane-move").setTitle("Move to top").setIcon("arrow-up-to-line").setDisabled(at <= 0).onClick(() => this.placeAt(it, 0))
      );
      menu.addItem(
        (i) => i.setSection("lane-move").setTitle("Move up").setIcon("arrow-up").setDisabled(at <= 0).onClick(() => this.placeAt(it, Math.max(0, this.items.indexOf(it) - 1)))
      );
      menu.addItem(
        (i) => i.setSection("lane-move").setTitle("Move down").setIcon("arrow-down").setDisabled(at < 0 || at >= this.items.length - 1).onClick(() => this.placeAt(it, this.items.indexOf(it) + 1))
      );
      menu.addItem(
        (i) => i.setSection("lane-move").setTitle("Move to previous lane").setIcon("arrow-left").onClick(() => void this.plugin.moveToLane(this, it, -1))
      );
      menu.addItem(
        (i) => i.setSection("lane-move").setTitle("Move to next lane").setIcon("arrow-right").onClick(() => void this.plugin.moveToLane(this, it, 1))
      );
      const current = modeOfState(this.viewOf(it), this.modeDefaults());
      for (const m of VIEW_MODES) {
        menu.addItem(
          (i) => i.setSection("lane-view").setTitle(MODE_TITLES[m]).setIcon(MODE_ICONS[m]).setChecked(m === current).onClick(() => void this.setView(it, stateForMode(m)))
        );
      }
      menu.addItem(
        (i) => i.setSection("lane-note").setTitle("Rename note").setIcon("pencil").onClick(() => window.setTimeout(() => this.editTitle(it, "all"), 0))
      );
      menu.addItem(
        (i) => i.setSection("lane-note").setTitle(it.pinned ? "Unpin" : "Pin").setIcon(it.pinned ? "pin-off" : "pin").onClick(() => this.togglePin(it))
      );
      menu.addItem(
        (i) => i.setSection("lane-note").setTitle("Close").setIcon("x").setDisabled(it.pinned).onClick(() => this.close(it))
      );
      menu.addItem(
        (i) => i.setSection("lane-note").setTitle("Close others").setIcon("x-circle").onClick(() => {
          for (const o of [...this.items]) if (o !== it && !o.pinned) this.close(o);
        })
      );
      this.app.workspace.trigger("file-menu", menu, it.file, "editor-lanes", void 0);
      menu.showAtMouseEvent(e);
    });
    return it;
  }
  /** Focus the card title and select it, for `eState.rename` ("all" / "start" / "end"), e.g. a new note or F2. */
  editTitle(it, how) {
    const el = it.titleEl;
    el.setAttr("contenteditable", "true");
    el.focus();
    const sel = el.win.getSelection();
    if (!sel) return;
    const range = el.doc.createRange();
    range.selectNodeContents(el);
    if (how === "start") range.collapse(true);
    else if (how === "end") range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  /** Rename the note to the edited title, the way Obsidian's inline title does (links update with it). */
  async renameFromTitle(it) {
    const raw = it.titleEl.textContent ?? "";
    const start = it.editStart;
    it.editStart = null;
    if (it.cancelEdit) {
      it.cancelEdit = false;
      this.updateTitle(it);
      return;
    }
    if (start !== null && raw === start) {
      this.updateTitle(it);
      return;
    }
    const name = tidyName(raw);
    if (!name || name === it.file.basename) {
      this.updateTitle(it);
      return;
    }
    const refuse = (msg) => {
      new import_obsidian2.Notice(msg);
      this.updateTitle(it);
    };
    const err = noteNameError(name, it.file.basename, it.file.parent?.path ?? "");
    if (err) return refuse(err);
    const dir = it.file.parent && it.file.parent.path !== "/" ? it.file.parent.path + "/" : "";
    const path = `${dir}${name}.${it.file.extension}`;
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing && existing !== it.file) return refuse(`"${name}" already exists in ${dir || "the vault root"}`);
    try {
      await this.app.fileManager.renameFile(it.file, path);
    } catch (e) {
      console.error("[editor-lanes] rename failed", e);
      refuse(`Couldn't rename: ${e?.message ?? e}`);
    }
  }
  updateTitle(it) {
    const showFolder = this.plugin.settings.showFolder;
    const folder = showFolder && it.file.parent && it.file.parent.path !== "/" ? `\u200E${it.file.parent.path}/\u200E` : "";
    it.pathEl.setText(folder);
    it.pathEl.setAttr("title", it.file.path);
    if (it.titleEl.doc.activeElement === it.titleEl) return;
    it.titleEl.setText(it.file.basename);
    it.titleEl.setAttr("aria-label", it.file.path);
  }
  applyCollapsed(it) {
    it.el.toggleClass("is-collapsed", it.collapsed);
    it.chevEl.setText(it.collapsed ? "\u25B8" : "\u25BE");
    it.chevEl.setAttr("aria-expanded", String(!it.collapsed));
    it.chevEl.setAttr("aria-label", it.collapsed ? "Expand note" : "Collapse note");
  }
  /** Collapsing unmounts the editor (its mode and cursor are kept for the next expand). */
  async setCollapsed(it, collapsed) {
    it.collapsed = collapsed;
    this.applyCollapsed(it);
    if (collapsed) this.unmount(it, true);
    else await this.mount(it);
  }
  setAllCollapsed(collapsed) {
    for (const it of this.items) {
      if (collapsed) void this.setCollapsed(it, true);
      else if (it.collapsed) {
        it.collapsed = false;
        this.applyCollapsed(it);
        this.mountLazily(it);
      }
    }
    this.save();
  }
  /** "Accordion mode" / "Auto-collapse after N expanded", after `it` was opened or expanded. */
  afterExpand(it) {
    const s = this.plugin.settings;
    const extra = s.accordion ? accordionCollapse(this.items, it) : overExpanded(this.items, s.autoCollapseAfter, it);
    for (const o of extra) void this.setCollapsed(o, true);
    if (extra.length) this.save();
  }
  /** "Maximum notes per lane": close the least recently opened unpinned notes beyond it, never `keep`. */
  closeOverLimit(keep) {
    for (const o of overLimit(this.items, this.plugin.settings.maxNotesPerLane, keep)) this.close(o);
  }
  /** "Note already open in another lane: jump to it": show, expand and focus this lane's card. */
  async reveal(it) {
    this.plugin.lastLane = this;
    await this.app.workspace.revealLeaf(this.tab.leaf);
    if (it.collapsed) {
      it.openedAt = stamp();
      await this.setCollapsed(it, false);
      this.afterExpand(it);
      this.save();
    }
    this.scrollToItem(it);
    this.tab.showLane(this);
    if (it.leaf) this.app.workspace.setActiveLeaf(it.leaf, { focus: true });
    else it.titleEl.focus();
  }
  close(it) {
    this.unmount(it);
    this.observeHeader(it, false);
    it.el.remove();
    this.items.remove(it);
    this.updateEmpty();
    this.save();
  }
  /** Close every note that isn't pinned. */
  closeAll() {
    for (const it of [...this.items]) if (!it.pinned) this.close(it);
  }
  // ---------- order, pinning, moving ----------
  /** Put `it` at `index` of the list without it; pinned notes stay above the others. */
  place(it, index) {
    this.items.remove(it);
    const i = clampIn(this.items, it.pinned, index);
    this.items.splice(i, 0, it);
    const next = this.items[i + 1];
    this.listEl.insertBefore(it.el, next ? next.el : null);
  }
  /** Reorder a note of this lane (`index` counted without it). */
  placeAt(it, index) {
    this.place(it, index);
    this.updateEmpty();
    this.save();
  }
  togglePin(it) {
    it.pinned = !it.pinned;
    this.applyPinned(it);
    this.placeAt(it, it.pinned ? this.items.length : 0);
  }
  applyPinned(it) {
    it.el.toggleClass("is-pinned", it.pinned);
    it.pinEl.setAttr("aria-label", it.pinned ? "Unpin" : "Pin");
    it.pinEl.setAttr("aria-pressed", String(it.pinned));
  }
  scrollToItem(it) {
    const top = it.el.getBoundingClientRect().top - this.listEl.getBoundingClientRect().top;
    this.listEl.scrollTop = Math.max(0, this.listEl.scrollTop + top - 12);
  }
  // ---------- view mode (per note) ----------
  /** The vault's "Default view for new tabs" / "Default editing mode", for notes with no mode of their own. */
  modeDefaults() {
    const v = this.app.vault;
    return { defaultViewMode: v.getConfig?.("defaultViewMode"), livePreview: v.getConfig?.("livePreview") };
  }
  /** A note's view-mode fields: from its editor while mounted, else what it was left in (or nothing). */
  viewOf(it) {
    if (it.leaf) return readView(it.leaf.getViewState().state);
    return it.view;
  }
  /** A saved mode for a note that isn't mounted yet: it opens in it. */
  restoreView(it, view) {
    it.view = { ...view };
    it.pending = { ...it.pending, ...view };
    this.updateModeButton(it);
  }
  /** Switch one note's view mode (`patch`: MarkdownView's mode / source fields). */
  async setView(it, patch) {
    const leaf = it.leaf;
    if (leaf) {
      const vs = leaf.getViewState();
      await leaf.setViewState({ ...vs, state: { ...vs.state, ...patch } });
      this.syncView(it);
    } else {
      this.restoreView(it, { ...it.view, ...patch });
      this.save();
    }
  }
  /** Read the mounted editor's mode back (it can also change by command / hotkey); saves if it changed. */
  syncView(it, mounting = false) {
    if (it.leaf) {
      this.plugin.adoptCardView(it.leaf.view);
      const view = readView(it.leaf.getViewState().state);
      const json = JSON.stringify(view);
      const own = ownViewChange(it.view === null ? null : JSON.stringify(it.view), it.mountedView, json, mounting);
      it.mountedView = own.mounted;
      if (own.save) {
        it.view = view;
        this.save();
      }
    }
    this.updateModeButton(it);
  }
  /** After any layout change (a mode toggled by command, Ctrl+E…): every note's mode button and saved mode. */
  syncViews() {
    for (const it of this.items) if (it.leaf) this.syncView(it);
  }
  updateModeButton(it) {
    const m = modeOfState(this.viewOf(it), this.modeDefaults());
    if (it.shownMode === m) return;
    it.shownMode = m;
    const reading = m === "reading";
    (0, import_obsidian2.setIcon)(it.modeEl, reading ? "edit-3" : "book-open");
    it.modeEl.setAttr(
      "aria-label",
      reading ? "Current view: reading. Click to edit" : `Current view: editing (${MODE_TITLES[m]}). Click to read`
    );
    it.el.setAttr("data-view-mode", m);
  }
  /** Remove a card to move it to another lane: its editor closes, keeping its mode and cursor. */
  take(it) {
    this.unmount(it, true);
    this.observeHeader(it, false);
    it.el.remove();
    this.items.remove(it);
    this.updateEmpty();
    this.save();
    return {
      file: it.file,
      collapsed: it.collapsed,
      pinned: it.pinned,
      pending: it.pending,
      openedAt: it.openedAt,
      view: it.view
    };
  }
  /**
   * A card moved here from another lane. If this lane already has the note, that card moves instead.
   * `focus`: make it the active note (a user's move; not when a layout change merges lanes).
   */
  async insertTaken(d, index, focus = true) {
    if (this.destroyedAt !== null) return void await this.successor()?.insertTaken(d, index, focus);
    if (focus) this.plugin.lastLane = this;
    let it = this.items.find((i) => i.file === d.file);
    if (it) {
      const cur = this.items.indexOf(it);
      if (d.pinned && !it.pinned) {
        it.pinned = true;
        this.applyPinned(it);
      }
      this.place(it, cur < index ? index - 1 : index);
      if (!d.collapsed && it.collapsed) await this.setCollapsed(it, false);
    } else {
      it = this.createItem(d.file, d.collapsed, d.pinned, d.openedAt);
      if (d.view) this.restoreView(it, d.view);
      it.pending = d.pending;
      this.place(it, index);
      if (focus) this.closeOverLimit(it);
      if (!it.collapsed) {
        if (focus) await this.mount(it);
        else this.mountLazily(it);
      }
    }
    this.updateEmpty();
    if (focus && !it.collapsed) {
      it.openedAt = stamp();
      this.afterExpand(it);
    }
    this.save();
    if (focus) this.tab.showLane(this);
    if (focus && !it.collapsed && it.leaf) this.app.workspace.setActiveLeaf(it.leaf, { focus: true });
  }
  updateEmpty() {
    this.tab.laneChanged(this);
    this.emptyEl.toggleClass("lane-hidden", this.items.length > 0);
  }
  // ---------- hosted editors ----------
  /** Mount an expanded note once it's near the visible part of the lane (one at a time). */
  mountLazily(it) {
    if (it.leaf) return;
    if (this.observer) this.observer.observe(it.el);
    else void this.mount(it);
  }
  async drainLazy() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.lazyQueue.length) {
        const it = this.lazyQueue.shift();
        if (!this.items.includes(it) || it.collapsed || it.leaf) continue;
        if (!this.nearView(it.el, it.parked ? this.wakeDistance() : void 0)) continue;
        if (it.parked) {
          void this.mount(it);
          continue;
        }
        await this.mount(it);
        await new Promise((r) => window.setTimeout(r, 16));
      }
    } finally {
      this.draining = false;
    }
  }
  /**
   * EL-19: unmount ("park") expanded cards that have been far outside the visible part of the lane for a while
   * (park.ts), keeping their height, mode, cursor, selection and scroll; the lazy-mount observer mounts them again
   * within wakeDistance(), before they scroll into view. Undo history survives, as for collapsing (Obsidian keeps
   * a note's editor history across its editors).
   * Never the active or focused card, one with unsaved changes or an open search, or one being dragged. A lane that
   * isn't shown (a background tab) is left alone.
   */
  parkFar(now) {
    const v = this.listEl.getBoundingClientRect();
    if (v.height <= 0 || !this.listEl.isShown()) return;
    const dist = parkDistance(v.height, this.plugin.settings.preloadDistance);
    for (const it of [...this.items]) {
      if (!it.leaf || it.collapsed || !it.ready) {
        this.farSince.delete(it);
        continue;
      }
      const r = it.el.getBoundingClientRect();
      const step = parkStep(this.farSince.get(it), isFar(v, r, dist), this.keepMounted(it), now);
      if (step.since === null) this.farSince.delete(it);
      else this.farSince.set(it, step.since);
      if (step.park) this.park(it);
    }
  }
  /** A card that must stay mounted however far away it is. */
  keepMounted(it) {
    const leaf = it.leaf;
    if (!leaf || leaf === this.app.workspace.activeLeaf || this.plugin.dragItem?.item === it) return true;
    if (it.el.contains(it.el.doc.activeElement)) return true;
    const view = leaf.view;
    if (!(view instanceof import_obsidian2.MarkdownView)) return true;
    const state = view;
    if (state.dirty || state.saving || view.editMode?.search?.isActive) return true;
    const bar = view.containerEl.querySelector(".document-search-container");
    return !!bar && bar.isShown();
  }
  /** While the lane scrolls: parked cards coming within wakeDistance() mount (once per frame at most). */
  wakeParkedSoon() {
    if (this.waking || !this.items.some((i) => i.parked && !i.leaf)) return;
    this.waking = this.el.win.requestAnimationFrame(() => {
      this.waking = 0;
      const v = this.listEl.getBoundingClientRect();
      const dist = this.wakeDistance();
      let any = false;
      for (const it of this.items) {
        if (!it.parked || it.leaf || it.collapsed || this.lazyQueue.includes(it)) continue;
        if (isFar(v, it.el.getBoundingClientRect(), dist)) continue;
        this.lazyQueue.push(it);
        any = true;
      }
      if (any) void this.drainLazy();
    });
  }
  /**
   * How near the visible part a parked card mounts again: further than the pre-load distance (at least two lane
   * heights), so a quick scroll doesn't reach it before its editor is back; less than parkDistance.
   */
  wakeDistance() {
    return Math.max(this.plugin.settings.preloadDistance, 2 * this.listEl.clientHeight);
  }
  park(it) {
    const height = it.bodyEl.offsetHeight;
    const bodyScroll = it.bodyEl.scrollTop;
    this.unmount(it, true);
    if (it.pending) it.pending.bodyScroll = bodyScroll;
    it.parked = true;
    it.bodyEl.style.minHeight = `${height}px`;
    this.farSince.delete(it);
    this.mountLazily(it);
  }
  nearView(el, margin) {
    const r = el.getBoundingClientRect();
    const v = this.listEl.getBoundingClientRect();
    const m = margin ?? this.plugin.settings.preloadDistance;
    return v.height > 0 && r.top < v.bottom + m && r.bottom > v.top - m;
  }
  /** Create the item's private split + leaf and open the note in it. */
  mount(it) {
    if (this.destroyedAt !== null || !this.items.includes(it)) return Promise.resolve();
    if (!it.ready) it.ready = this.doMount(it);
    return it.ready;
  }
  async doMount(it) {
    this.observer?.unobserve(it.el);
    const split = createHostSplit(this.app.workspace);
    let leaf;
    try {
      leaf = new import_obsidian2.WorkspaceLeaf(this.app);
      split.insertChild(0, leaf);
    } catch {
      leaf = this.app.workspace.createLeafInParent(split, 0);
    }
    it.split = split;
    it.leaf = leaf;
    this.plugin.splits.add(split);
    this.plugin.hostedLeaves.set(leaf, { lane: this, item: it });
    leaf.setPinned(true);
    leaf.setPinned = (v) => {
      if (!v && it.leaf === leaf && !it.pinned) this.close(it);
    };
    leaf.togglePinned = () => {
    };
    const origDetach = leaf.detach.bind(leaf);
    leaf.detach = () => {
      if (it.leaf === leaf && !unmounting.has(leaf)) this.close(it);
      else origDetach();
    };
    const hist = leaf.history;
    if (hist && typeof hist.updateState === "function") {
      const origUpdate = hist.updateState.bind(hist);
      hist.updateState = async (entry) => {
        const path = entry?.state?.state?.file;
        if (typeof path !== "string" || path === it.file.path) return origUpdate(entry);
        const f = this.app.vault.getFileByPath(path);
        const eState = asRecord(entry.eState);
        if (f) await this.plugin.openInLane(f, "same", this, { focus: true, after: it, eState });
      };
    }
    leaf.getContainer = () => this.tab.leaf.getContainer();
    const origSetEState = leaf.setEphemeralState.bind(leaf);
    leaf.setEphemeralState = (e) => {
      const st = asRecord(e);
      if (st?.rename) {
        const { rename: how, ...rest } = st;
        window.setTimeout(() => this.editTitle(it, how), 0);
        return origSetEState(rest);
      }
      return origSetEState(e);
    };
    it.bodyEl.appendChild(split.containerEl);
    await saving.get(it.file);
    if (it.leaf !== leaf) return;
    const pending = it.pending;
    it.pending = null;
    try {
      const { cursor, ...eState } = pending?.eState ?? {};
      delete eState.scroll;
      await leaf.openFile(it.file, {
        active: false,
        state: mountViewState(pending),
        eState: Object.keys(eState).length ? eState : void 0
      });
      if (cursor) restoreSelection(leaf, cursor);
      this.syncView(it, true);
      if (it.parked) {
        it.parked = false;
        if (pending?.bodyScroll) it.bodyEl.scrollTop = pending.bodyScroll;
        window.requestAnimationFrame(() => {
          if (!it.parked) it.bodyEl.style.minHeight = "";
        });
      }
    } catch (e) {
      console.error("[editor-lanes] could not open", it.file.path, e);
      it.bodyEl.createDiv({ cls: "lane-empty", text: "Couldn't open this note." });
    }
  }
  /** Detach the item's hosted leaf. `keep`: remember its mode and cursor for the next mount. */
  unmount(it, keep = false) {
    this.observer?.unobserve(it.el);
    if (it.parked) {
      it.parked = false;
      it.bodyEl.style.minHeight = "";
    }
    if (!it.split) return;
    const split = it.split;
    const leaf = it.leaf;
    if (keep && leaf) {
      try {
        const st = leaf.getViewState().state ?? {};
        it.pending = {
          mode: typeof st.mode === "string" ? st.mode : void 0,
          source: typeof st.source === "boolean" ? st.source : void 0,
          eState: leaf.getEphemeralState()
        };
      } catch {
        it.pending = null;
      }
    }
    this.plugin.splits.delete(split);
    if (leaf) this.plugin.hostedLeaves.delete(leaf);
    split.parent = null;
    it.mountedView = void 0;
    it.split = null;
    it.leaf = null;
    it.ready = null;
    if (leaf) {
      const view = leaf.view;
      if (view instanceof import_obsidian2.MarkdownView && view.file) {
        const file = view.file;
        const done = view.save().catch(() => void 0).finally(() => {
          if (saving.get(file) === done) saving.delete(file);
        });
        saving.set(file, done);
      }
      this.plugin.dropSearchKeys(leaf);
      unmounting.add(leaf);
      this.plugin.detachQuietly(leaf);
    }
    split.containerEl.remove();
  }
  // ---------- drag and drop ----------
  /**
   * A card dragged by its header (capture phase, so it moves even when dropped on a note's editor, which
   * would otherwise insert a link) and notes / links dragged from anywhere else: the explorer, tabs, search,
   * links in Reading view, a selected [[link]] or obsidian:// URL. Those open at the drop point, unless
   * they're dropped on a note's body: there the editor takes them as usual (a link inserted into the note),
   * or, with "Dropping a note or link onto a note's text: open it in the lane", the lane takes them in the
   * capture phase too. Only drags Obsidian's drag manager knows (files, links) are taken over a body: a plain
   * text drag there still moves text between notes.
   */
  setupDrop(root) {
    const dm = () => this.app.dragManager;
    const inBody = (t) => !!asEl(t)?.closest(".lane-item-body");
    const takeOverBody = (e) => this.plugin.settings.dropOnText === "open" && inBody(e.target) && this.dropFiles(e, true).length > 0;
    const onBody = (e) => {
      if (this.plugin.dragItem || !takeOverBody(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setDropEffect(e, ["link", "copy", "move"]);
      this.showDrop(this.dropIndex(e.clientY), false);
      dm()?.setAction?.("Open in this lane");
    };
    root.addEventListener("dragenter", onBody, { capture: true });
    root.addEventListener("dragover", onBody, { capture: true });
    root.addEventListener(
      "drop",
      (e) => {
        if (this.plugin.dragItem || !takeOverBody(e)) return;
        e.preventDefault();
        e.stopPropagation();
        const index = this.dropIndex(e.clientY);
        this.clearDrop();
        void this.addDropped(this.dropFiles(e, true), index);
      },
      { capture: true }
    );
    const onCard = (e) => {
      const d = this.plugin.dragItem;
      if (!d) return;
      e.preventDefault();
      setDropEffect(e, ["move", "link", "copy"]);
      this.showDrop(this.dropIndex(e.clientY, d.item), d.item.pinned, d.item);
      dm()?.setAction?.(d.lane === this ? "Move here" : "Move to this lane");
    };
    root.addEventListener("dragenter", onCard, { capture: true });
    root.addEventListener("dragover", onCard, { capture: true });
    root.addEventListener(
      "drop",
      (e) => {
        const d = this.plugin.dragItem;
        if (!d) return;
        e.preventDefault();
        e.stopPropagation();
        const index = this.dropIndex(e.clientY, d.item);
        this.plugin.endItemDrag();
        void this.plugin.moveItem(d.lane, d.item, this, index);
      },
      { capture: true }
    );
    root.addEventListener("dragover", (e) => {
      if (this.plugin.dragItem) return;
      if (e.defaultPrevented || inBody(e.target)) {
        this.clearDrop();
        return;
      }
      if (!this.dropFiles(e, true).length && !e.dataTransfer?.types.includes("text/plain")) return;
      e.preventDefault();
      setDropEffect(e, ["link", "copy", "move"]);
      this.showDrop(this.dropIndex(e.clientY), false);
      dm()?.setAction?.("Open in this lane");
    });
    root.addEventListener("dragleave", (e) => {
      if (!root.contains(e.relatedTarget)) this.clearDrop();
    });
    root.addEventListener("drop", (e) => {
      if (this.plugin.dragItem) return;
      const index = this.dropIndex(e.clientY);
      this.clearDrop();
      if (e.defaultPrevented || inBody(e.target)) return;
      const files = this.dropFiles(e, false);
      if (!files.length) return;
      e.preventDefault();
      e.stopPropagation();
      void this.addDropped(files, index);
    });
  }
  /** Dropped notes open in order from `index`. */
  async addDropped(files, index) {
    let i = index;
    for (const f of files) {
      await this.add(f, { index: i });
      i = this.items.findIndex((x) => x.file === f) + 1;
    }
  }
  /** Where a drop at `y` goes: before the first card whose middle is below it (`skip`: the card being moved). */
  dropIndex(y, skip) {
    const list = this.items.filter((i) => i !== skip);
    for (let i = 0; i < list.length; i++) {
      const r = list[i].el.getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return list.length;
  }
  /** Outline the lane and draw a line where the drop will land. */
  showDrop(index, pinned, skip) {
    const list = this.items.filter((i) => i !== skip);
    let mark = null;
    if (list.length) {
      const i = clampIn(list, pinned, index);
      mark = i < list.length ? { el: list[i].el, cls: "lane-drop-before" } : { el: list[list.length - 1].el, cls: "lane-drop-after" };
    }
    if (this.el.hasClass("is-drop-target") && this.dropMark?.el === mark?.el && this.dropMark?.cls === mark?.cls)
      return;
    this.clearDrop();
    this.el.addClass("is-drop-target");
    this.dropMark = mark;
    mark?.el.addClass(mark.cls);
  }
  clearDrop() {
    this.dropMark = null;
    this.el.removeClass("is-drop-target");
    for (const it of this.items) it.el.removeClass("lane-drop-before", "lane-drop-after");
  }
  /** Notes being dragged (Obsidian's drag manager, or an obsidian:// URL / [[link]] as text). */
  dropFiles(e, peek) {
    const out = [];
    const add = (f) => {
      if (f instanceof import_obsidian2.TFile && f.extension === "md" && !out.includes(f)) out.push(f);
    };
    const d = this.app.dragManager?.draggable;
    if (d) {
      if (d.type === "file") add(d.file);
      else if (d.type === "files") (d.files ?? []).forEach(add);
      else if (d.type === "link" && d.linktext) {
        add(this.app.metadataCache.getFirstLinkpathDest((0, import_obsidian2.getLinkpath)(d.linktext), d.sourcePath ?? ""));
        add(d.file);
      }
    }
    if (out.length || peek) return out;
    for (const p of linkpathsInText(e.dataTransfer?.getData("text/plain") ?? "")) {
      add(this.app.metadataCache.getFirstLinkpathDest(p, ""));
    }
    return out;
  }
};
function setDropEffect(e, prefs) {
  const p = e.dataTransfer ? pickDropEffect(e.dataTransfer.effectAllowed, prefs) : null;
  if (p && e.dataTransfer) e.dataTransfer.dropEffect = p;
}
function mountViewState(pending) {
  if (!pending) return void 0;
  const st = {};
  if (pending.mode) st.mode = pending.mode;
  if (typeof pending.source === "boolean") st.source = pending.source;
  return Object.keys(st).length ? st : void 0;
}
function restoreSelection(leaf, cursor) {
  const view = leaf.view;
  const c = asRecord(cursor);
  const from = asRecord(c?.from);
  const to = asRecord(c?.to) ?? from;
  if (!(view instanceof import_obsidian2.MarkdownView) || view.getMode() !== "source" || !from || !to) return;
  const pos = (p) => ({ line: Number(p.line) || 0, ch: Number(p.ch) || 0 });
  try {
    const ed = view.editor;
    const last = ed.lastLine();
    const clamp = (p) => ed.posToOffset({ line: Math.min(p.line, last), ch: p.ch });
    ed.cm?.dispatch({ selection: { anchor: clamp(pos(from)), head: clamp(pos(to)) } });
  } catch {
  }
}

// src/layout-modal.ts
var import_obsidian3 = require("obsidian");
function drawPreview(el, columns) {
  for (const c of columns) {
    const col = el.createDiv({ cls: "lane-layout-col" });
    col.style.flexGrow = String(c.width);
    for (let r = 0; r < c.rows; r++) col.createDiv({ cls: "lane-layout-cell" });
  }
}
var LayoutModal = class extends import_obsidian3.Modal {
  constructor(app, plugin, tab) {
    super(app);
    this.plugin = plugin;
    this.tab = tab;
  }
  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText("Lane layout of this tab");
    const info = this.tab.layoutInfo();
    const def = this.plugin.settings.defaultLayout;
    contentEl.createEl("p", {
      cls: "lane-layout-hint",
      text: info.own ? `This tab has its own layout. The default from the settings is "${def}".` : `This tab follows the default from the settings ("${def}"). A layout set here is this tab's own; it stays when the default changes.`
    });
    contentEl.createEl("p", {
      cls: "lane-layout-hint",
      text: "Columns from left to right as relative widths, separated by commas; add x and a number to stack lanes in a column. 40, 30x2, 30 is three columns with two lanes stacked in the middle one."
    });
    const row = contentEl.createDiv({ cls: "lane-layout-input" });
    const input = new import_obsidian3.TextComponent(row);
    let apply = null;
    const summary = contentEl.createDiv({ cls: "lane-layout-summary" });
    const preview = contentEl.createDiv({ cls: "lane-layout-preview", attr: { "aria-hidden": "true" } });
    const warn = contentEl.createDiv({ cls: "lane-layout-summary" });
    const show = (text) => {
      const p = parseLayout(text);
      summary.toggleClass("lane-setting-error", !p.ok);
      input.inputEl.toggleClass("lane-setting-invalid", !p.ok);
      input.inputEl.setAttr("aria-invalid", String(!p.ok));
      preview.empty();
      warn.setText("");
      apply?.setDisabled(!p.ok);
      if (!p.ok) {
        summary.setText(p.error);
        return;
      }
      summary.setText(describeLayout(p.columns));
      drawPreview(preview, p.columns);
      const n = laneCount(p.columns);
      const moved = this.tab.lanes.slice(n).reduce((s, l) => s + l.items.length, 0);
      if (moved) {
        warn.setText(
          `${this.tab.lanes.length - n} lane${this.tab.lanes.length - n === 1 ? "" : "s"} will go; their ${moved} note${moved === 1 ? " moves" : "s move"} into the remaining lanes.`
        );
      }
    };
    input.setPlaceholder("50, 50");
    input.setValue(info.text);
    input.onChange(show);
    input.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && parseLayout(input.getValue()).ok) {
        e.preventDefault();
        void this.done(input.getValue());
      }
    });
    const presets = contentEl.createDiv({ cls: "lane-layout-presets" });
    for (const p of PRESETS) {
      new import_obsidian3.ButtonComponent(presets).setButtonText(p.name).onClick(() => {
        input.setValue(p.layout);
        show(p.layout);
        input.inputEl.focus();
      });
    }
    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    new import_obsidian3.ButtonComponent(buttons).setButtonText("Use default from settings").setDisabled(!info.own).onClick(() => void this.done(null));
    new import_obsidian3.ButtonComponent(buttons).setButtonText("Cancel").onClick(() => this.close());
    apply = new import_obsidian3.ButtonComponent(buttons).setButtonText("Apply").setCta().onClick(() => void this.done(input.getValue()));
    show(info.text);
    window.setTimeout(() => input.inputEl.select(), 0);
  }
  async done(text) {
    if (text !== null && !parseLayout(text).ok) return;
    this.close();
    await this.tab.setLayout(text);
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/tab-name-modal.ts
var import_obsidian4 = require("obsidian");
var TabNameModal = class extends import_obsidian4.Modal {
  constructor(app, plugin, tab) {
    super(app);
    this.plugin = plugin;
    this.tab = tab;
  }
  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText("Rename lanes tab");
    contentEl.createEl("p", {
      cls: "lane-layout-hint",
      text: `The tab's title is "${TAB_TITLE_PREFIX}" followed by this name (at most ${MAX_TAB_NAME} characters).`
    });
    const row = contentEl.createDiv({ cls: "lane-layout-input" });
    const input = new import_obsidian4.TextComponent(row);
    const msg = contentEl.createDiv({ cls: "lane-layout-summary" });
    let save = null;
    const show = (raw) => {
      const err = tabNameError(raw);
      input.inputEl.toggleClass("lane-setting-invalid", !!err);
      input.inputEl.setAttr("aria-invalid", String(!!err));
      msg.toggleClass("lane-setting-error", !!err);
      save?.setDisabled(!!err);
      if (err) msg.setText(err);
      else {
        const name = tidyTabName(raw);
        const clash = this.plugin.tabNameInUse(name, this.tab);
        msg.setText(`${TAB_TITLE_PREFIX}${name}${clash ? " (another lanes tab has this name too)" : ""}`);
      }
    };
    input.setValue(this.tab.tabName());
    input.inputEl.maxLength = MAX_TAB_NAME + 20;
    input.onChange(show);
    input.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !tabNameError(input.getValue())) {
        e.preventDefault();
        this.done(input.getValue());
      }
    });
    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    new import_obsidian4.ButtonComponent(buttons).setButtonText("New random name").onClick(() => {
      const name = this.plugin.pickTabName(this.tab, [input.getValue(), this.tab.tabName()]);
      input.setValue(name);
      show(name);
    });
    new import_obsidian4.ButtonComponent(buttons).setButtonText("Cancel").onClick(() => this.close());
    save = new import_obsidian4.ButtonComponent(buttons).setButtonText("Save").setCta().onClick(() => this.done(input.getValue()));
    show(input.getValue());
    if (!import_obsidian4.Platform.isPhone) window.setTimeout(() => input.inputEl.select(), 0);
  }
  done(raw) {
    if (tabNameError(raw)) return;
    this.close();
    this.tab.rename(tidyTabName(raw));
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/lanes-view.ts
var ONE_LANE = [{ width: 100, rows: 1 }];
var LanesView = class extends import_obsidian5.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    /** In layout order: columns left to right, top to bottom within a column. */
    this.lanes = [];
    /** This tab's lanes, most recently used first (see EditorLanesPlugin.lastLane). */
    this.used = [];
    /** The tab's own layout, or null: it follows the default in the settings. */
    this.override = null;
    this.nameValue = null;
    this.sizes = null;
    this.columns = ONE_LANE;
    /** Phones: the lane scrolled into view. */
    this.shownLane = null;
    this.colEls = [];
    /** What the grid was last drawn for (layout, sizes), so settings changes only redraw when needed. */
    this.drawn = "";
    this.relaying = Promise.resolve();
    this.navigation = false;
  }
  /** The lane of this tab used last (see EditorLanesPlugin.lastLane); setting null forgets them all. */
  get lastLane() {
    return this.used.find((l) => this.lanes.includes(l)) ?? null;
  }
  set lastLane(lane) {
    this.used = lane ? [lane, ...this.used.filter((l) => l !== lane && this.lanes.includes(l))] : [];
  }
  /**
   * The lane used last other than `lane`, else `lane`: where "last-used lane" opens go when they start in `lane`
   * (a link followed or Shift-clicked there: the click itself has just made `lane` the last used one).
   */
  lastUsedOtherThan(lane) {
    return this.used.find((l) => l !== lane && this.lanes.includes(l)) ?? lane;
  }
  /** The saved name, without picking one (for naming other tabs). */
  get peekName() {
    return this.nameValue;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  /**
   * "Editor lane <name>": every lanes tab gets a random fictional name no other lanes tab has when it's first
   * shown or saved, and keeps it (saved in its state); "Rename lanes tab…" changes it.
   */
  getDisplayText() {
    return `${TAB_TITLE_PREFIX}${this.tabName()}`;
  }
  /** This tab's name, picked on first use. */
  tabName() {
    if (this.nameValue === null) this.nameValue = this.plugin.pickTabName(this);
    return this.nameValue;
  }
  /** "Rename lanes tab…": a new name (already validated and tidied). */
  rename(name) {
    this.nameValue = name;
    this.titleEl?.setText(this.getDisplayText());
    this.save();
  }
  openRenameDialog() {
    new TabNameModal(this.app, this.plugin, this).open();
  }
  getIcon() {
    return "columns-3";
  }
  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("lanes-view");
    this.switcherEl = root.createDiv({ cls: "lanes-switcher", attr: { role: "tablist", "aria-label": "Lanes" } });
    this.gridEl = root.createDiv({ cls: "lanes-grid" });
    const settle = (0, import_obsidian5.debounce)(() => this.onSwiped(), 120, true);
    this.registerDomEvent(this.gridEl, "scroll", () => settle());
    this.addAction("layout-grid", "Lane layout\u2026", () => this.openLayoutDialog());
    this.registerEvent(this.app.vault.on("delete", (f) => this.lanes.forEach((l) => l.onFileDeleted(f))));
    this.registerEvent(this.app.vault.on("rename", (f) => this.lanes.forEach((l) => l.onFileRenamed(f))));
    this.applyLooks();
    if (!this.lanes.length) this.build([]);
  }
  async onClose() {
    this.teardown();
    this.plugin.forgetTab(this);
  }
  /** Detach every hosted leaf of every lane. Safe to call twice. */
  teardown() {
    for (const l of this.lanes) l.destroy();
    this.lanes = [];
    this.lastLane = null;
  }
  onResize() {
    for (const l of this.lanes) l.checkWindow();
    if (this.isPhone()) this.showLane(this.shownLane ?? this.currentLane(), false);
  }
  // ---------- phones: one lane at a time ----------
  /** Phone-sized screen: the lanes are a horizontal scroller (see styles.css). Follows Obsidian's body class. */
  isPhone() {
    return !!this.contentEl?.doc.body.hasClass("is-phone");
  }
  /** Phones: scroll `lane` into view (a note opened or moved there, a lane button). Elsewhere nothing to do. */
  showLane(lane, smooth = true) {
    if (!lane || !this.gridEl || !this.isPhone() || !this.lanes.includes(lane)) return;
    this.shownLane = lane;
    this.updateSwitcher();
    const left = lane.el.offsetLeft;
    if (Math.abs(this.gridEl.scrollLeft - left) > 1) {
      this.gridEl.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
    }
  }
  /** Phones: the lane a swipe (or a scroll) settled on. */
  onSwiped() {
    if (!this.isPhone() || !this.lanes.length) return;
    const i = nearestIndex(
      this.lanes.map((l) => l.el.offsetLeft),
      this.gridEl.scrollLeft
    );
    const lane = this.lanes[i];
    if (!lane || lane === this.shownLane) return;
    this.shownLane = lane;
    this.updateSwitcher();
    this.plugin.lastLane = lane;
  }
  /** The lane buttons (phones): "1", "2"… with the note count; the shown lane is selected. */
  updateSwitcher() {
    const el = this.switcherEl;
    if (!el) return;
    el.empty();
    if (this.lanes.length < 2) {
      el.addClass("lane-hidden");
      return;
    }
    el.removeClass("lane-hidden");
    const shown = this.shownLane && this.lanes.includes(this.shownLane) ? this.shownLane : this.lanes[0];
    this.lanes.forEach((lane, i) => {
      const n = lane.items.length;
      const b = el.createEl("button", {
        cls: "lanes-switch",
        attr: {
          role: "tab",
          "aria-selected": String(lane === shown),
          "aria-label": `Lane ${i + 1} of ${this.lanes.length}, ${n} note${n === 1 ? "" : "s"}`
        }
      });
      b.createSpan({ cls: "lanes-switch-dot" });
      if (n) b.createSpan({ cls: "lanes-switch-count", text: String(n) });
      b.toggleClass("is-active", lane === shown);
      b.addEventListener("click", () => {
        this.plugin.lastLane = lane;
        this.showLane(lane);
      });
    });
  }
  // ---------- state (workspace.json, Workspaces, "Undo close tab") ----------
  getState() {
    const s = { name: this.tabName(), lanes: this.lanes.map((l) => l.getState()) };
    if (this.override !== null) s.layout = this.override;
    if (this.sizes) s.sizes = this.sizes;
    return s;
  }
  async setState(state, result) {
    const st = readTabState(state);
    if (st.name !== null) this.nameValue = st.name;
    this.override = st.layout;
    this.sizes = st.sizes;
    this.build(st.lanes);
    await super.setState(state, result);
  }
  /** New lanes for the current layout, filled from saved state (notes of lanes past the end wrap round). */
  build(saved) {
    this.teardown();
    this.columns = this.layoutColumns();
    const data = fitLanes(saved, laneCount(this.columns));
    this.lanes = data.map(() => new Lane(this, this.plugin));
    this.lanes.forEach((l, i) => l.load(data[i]));
    this.draw();
  }
  save() {
    this.app.workspace.requestSaveLayout();
    this.leaf.updateHeader?.();
  }
  // ---------- layout ----------
  /** The tab's own layout if it has a valid one, else the default from the settings, else one lane. */
  layoutColumns() {
    for (const text of [this.override, this.plugin.settings.defaultLayout]) {
      if (text === null) continue;
      const p = parseLayout(text);
      if (p.ok) return p.columns;
    }
    return ONE_LANE;
  }
  /** The layout text this tab shows, and whether it's its own (not the default). */
  layoutInfo() {
    return { text: this.override ?? this.plugin.settings.defaultLayout, own: this.override !== null };
  }
  drawKey() {
    return `${formatLayout(this.columns)}|${JSON.stringify(this.sizes)}`;
  }
  /** (Re)build the grid: columns with their lanes, and the dividers between them. Lane elements are moved, not remade. */
  draw() {
    if (!this.gridEl) return;
    this.drawn = this.drawKey();
    const shares = effectiveShares(this.columns, this.sizes);
    this.gridEl.empty();
    this.colEls = [];
    let n = 0;
    this.columns.forEach((c, ci) => {
      if (ci > 0) this.divider(this.gridEl, "col", ci, ci - 1);
      const colEl = this.gridEl.createDiv({ cls: "lanes-col" });
      colEl.style.flexGrow = String(shares.cols[ci]);
      this.colEls.push(colEl);
      for (let r = 0; r < c.rows; r++) {
        if (r > 0) this.divider(colEl, "row", ci, r - 1);
        const lane = this.lanes[n++];
        if (!lane) continue;
        lane.el.style.flexGrow = String(shares.rows[ci][r]);
        colEl.appendChild(lane.el);
      }
    });
    if (this.shownLane && !this.lanes.includes(this.shownLane)) this.shownLane = null;
    this.updateSwitcher();
    if (this.isPhone() && this.shownLane) this.showLane(this.shownLane, false);
  }
  /** A divider between two columns (`kind` "col") or two lanes stacked in column `ci` ("row"). Always draggable: sizes are the one thing that changes. */
  divider(parent, kind, ci, i) {
    const el = parent.createDiv({ cls: `lanes-divider mod-${kind}` });
    el.setAttr("data-ignore-swipe", "true");
    el.setAttr("aria-label", import_obsidian5.Platform.isMobile ? "Drag to resize" : "Drag to resize; double-click to reset");
    el.addEventListener("dblclick", () => this.resetSizes());
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const base = effectiveShares(this.columns, this.sizes);
      const container = kind === "col" ? this.gridEl : this.colEls[ci];
      const total = kind === "col" ? container.clientWidth : container.clientHeight;
      const start = kind === "col" ? e.clientX : e.clientY;
      const startShares = kind === "col" ? base.cols : base.rows[ci];
      const sum = startShares.reduce((a, b) => a + b, 0);
      const els = kind === "col" ? this.colEls : Array.from(container.children).filter((c) => c.hasClass("lane"));
      let cur = startShares;
      el.addClass("is-dragging");
      el.setPointerCapture(e.pointerId);
      const move = (ev) => {
        if (!(total > 0)) return;
        const pos = kind === "col" ? ev.clientX : ev.clientY;
        cur = resizePair(startShares, i, (pos - start) / total * sum, sum * 0.05);
        cur.forEach((s, k) => {
          if (els[k]) els[k].style.flexGrow = String(s);
        });
      };
      const up = () => {
        el.removeClass("is-dragging");
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        if (kind === "col") base.cols = cur;
        else base.rows[ci] = cur;
        this.sizes = { for: formatLayout(this.columns), cols: base.cols, rows: base.rows };
        this.drawn = this.drawKey();
        this.save();
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
  }
  /** Back to the layout's own widths (double-click a divider, ⋯ → "Reset lane sizes"). */
  resetSizes() {
    this.sizes = null;
    this.draw();
    this.save();
  }
  /** A lane's notes changed (count shown in its header). */
  laneChanged(lane) {
    if (!this.lanes.includes(lane)) return;
    this.updateSwitcher();
  }
  /** Change the layout and move lanes / notes as `plan` says (or by order). Runs one at a time. */
  relayout(plan) {
    const run = this.relaying.then(() => this.relayoutNow(plan));
    this.relaying = run.catch((e) => console.error("[editor-lanes] could not change the lane layout", e));
    return run;
  }
  async relayoutNow(plan) {
    const old = this.lanes;
    this.columns = this.layoutColumns();
    const count = laneCount(this.columns);
    if (!plan || plan.slots.length !== count) plan = planRelayout(old.length, count);
    const next = plan.slots.map((s) => s === null ? new Lane(this, this.plugin) : old[s]);
    this.lanes = next;
    for (const m of plan.merges) {
      const from = old[m.from];
      const to = next[m.to];
      if (!from || !to) continue;
      for (const it of [...from.items]) await to.insertTaken(from.take(it), to.items.length, false);
      if (this.lastLane === from) this.lastLane = to;
      if (this.plugin.lastLane === from) this.plugin.lastLane = to;
      from.destroy();
      from.el.remove();
    }
    this.draw();
    this.save();
  }
  /** The settings changed: looks and, for a tab without its own layout, the default layout. */
  applySettings() {
    this.applyLooks();
    for (const l of this.lanes) l.applySettings();
    const cols = this.layoutColumns();
    if (formatLayout(cols) !== formatLayout(this.columns) || laneCount(cols) !== this.lanes.length) {
      void this.relayout();
    } else if (this.drawKey() !== this.drawn) this.draw();
  }
  /** Settings that change how cards look (on the tab's element, so tabs in popouts follow too). */
  applyLooks() {
    const s = this.plugin.settings;
    const root = this.contentEl;
    root.toggleClass("lane-compact", s.headerSize === "compact");
    root.toggleClass("lane-capped", s.noteHeight === "cap");
    root.style.setProperty("--lane-note-max-height", `${s.noteMaxHeight}px`);
    if (s.showBacklinks) root.removeAttribute("data-bfv-skip");
    else root.setAttribute("data-bfv-skip", "editor-lanes");
  }
  /** "Lane layout…": the tab's own layout (`text`), or back to the default (null). */
  async setLayout(text) {
    if (text !== null && !parseLayout(text).ok) return;
    this.override = text;
    this.sizes = null;
    await this.relayout();
  }
  openLayoutDialog() {
    new LayoutModal(this.app, this.plugin, this).open();
  }
  /** The lane opens go to when they don't name one: the one used last here, else the first. */
  currentLane() {
    return this.lastLane && this.lanes.includes(this.lastLane) ? this.lastLane : this.lanes[0] ?? null;
  }
  // ---------- menus ----------
  /** The tab's ⋯ menu and its tab header's right-click menu (Obsidian's items, such as Split, come first). */
  onPaneMenu(menu, source) {
    super.onPaneMenu(menu, source);
    this.addTabItems(menu);
  }
  /**
   * The tab-header menu: Obsidian builds it from onTabMenu and then onPaneMenu(menu, "tab-header"), except for a
   * tab that isn't shown and in the mobile tab switcher (a long-press on a tab), where only onTabMenu runs.
   */
  onTabMenu(menu) {
    super.onTabMenu(menu);
    const switcher = import_obsidian5.Platform.isMobile && !!this.app.mobileTabSwitcher?.isVisible;
    if (switcher || !this.leaf.isVisible()) this.addTabItems(menu);
  }
  addTabItems(menu) {
    menu.addItem(
      (i) => i.setSection("pane").setTitle("Rename lanes tab\u2026").setIcon("pencil").onClick(() => this.openRenameDialog())
    );
    menu.addItem(
      (i) => i.setSection("pane").setTitle("Lane layout\u2026").setIcon("layout-grid").onClick(() => this.openLayoutDialog())
    );
    if (this.sizes) {
      menu.addItem(
        (i) => i.setSection("pane").setTitle("Reset lane sizes").setIcon("rotate-ccw").onClick(() => this.resetSizes())
      );
    }
  }
  /** A lane's own menu: a right-click (touch: long-press) on its background. */
  addLaneMenuItems(menu, lane) {
    const none = !lane.items.length;
    menu.addItem(
      (i) => i.setSection("notes").setTitle("Collapse all notes").setIcon("chevrons-down-up").setDisabled(none).onClick(() => lane.setAllCollapsed(true))
    );
    menu.addItem(
      (i) => i.setSection("notes").setTitle("Expand all notes").setIcon("chevrons-up-down").setDisabled(none).onClick(() => lane.setAllCollapsed(false))
    );
    menu.addItem(
      (i) => i.setSection("notes").setTitle("Close all notes").setIcon("x-circle").setDisabled(none).onClick(() => lane.closeAll())
    );
    menu.addItem(
      (i) => i.setSection("tab").setTitle("Lane layout of this tab\u2026").setIcon("layout-grid").onClick(() => this.openLayoutDialog())
    );
  }
};
var LegacyLaneView = class extends import_obsidian5.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.navigation = false;
  }
  getViewType() {
    return LEGACY_VIEW_TYPE;
  }
  getDisplayText() {
    return "Old editor lane";
  }
  async onOpen() {
    this.contentEl.setText("Replaced by lanes tabs; this tab closes.");
    this.plugin.requestLegacyCleanup();
  }
};
var OldNavigatorView = class extends import_obsidian5.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.navigation = false;
  }
  getViewType() {
    return OLD_NAV_VIEW_TYPE;
  }
  getDisplayText() {
    return "Navigator (removed)";
  }
  async onOpen() {
    this.contentEl.setText("Files, Search and Bookmarks are back in the left sidebar; this tab closes.");
    this.plugin.requestLegacyCleanup();
  }
};

// src/note-picker.ts
var import_obsidian6 = require("obsidian");
var NotePicker = class extends import_obsidian6.FuzzySuggestModal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.setPlaceholder("Open a note in an editor lane\u2026");
  }
  getItems() {
    return this.app.vault.getMarkdownFiles();
  }
  getItemText(f) {
    return f.path.replace(/\.md$/, "");
  }
  onChooseItem(f) {
    void this.plugin.openInLane(f, "last", null, { focus: true });
  }
};

// src/settings.ts
var import_obsidian7 = require("obsidian");
var LanesSettingTab = class extends import_obsidian7.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  get s() {
    return this.plugin.settings;
  }
  async set(key, value, refresh) {
    this.s[key] = value;
    await this.plugin.settingsChanged(refresh);
  }
  choice(el, key, name, desc, options, refresh, after) {
    return new import_obsidian7.Setting(el).setName(name).setDesc(desc).addDropdown(
      (d) => d.addOptions(options).setValue(String(this.s[key])).onChange(async (v) => {
        await this.set(key, v, refresh);
        after?.();
      })
    );
  }
  toggle(el, key, name, desc, refresh) {
    return new import_obsidian7.Setting(el).setName(name).setDesc(desc).addToggle((t) => t.setValue(!!this.s[key]).onChange((v) => this.set(key, v, refresh)));
  }
  /** A whole-number field: out-of-range or non-numeric input is flagged and not saved. */
  number(el, key, name, desc, refresh) {
    const range = LIMITS[key];
    return new import_obsidian7.Setting(el).setName(name).setDesc(`${desc} (${range[0]}\u2013${range[1]})`).addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = String(range[0]);
      t.inputEl.max = String(range[1]);
      t.inputEl.addClass("lane-setting-number");
      t.setValue(String(this.s[key]));
      t.onChange(async (v) => {
        const n = parseCount(v, range);
        t.inputEl.toggleClass("lane-setting-invalid", n === null);
        t.inputEl.setAttr("aria-invalid", String(n === null));
        if (n !== null) await this.set(key, n, refresh);
      });
    });
  }
  display() {
    const { containerEl: el } = this;
    el.empty();
    new import_obsidian7.Setting(el).setName("Editor lanes only").setDesc(
      "Every note opened in a main area (any window) goes into a lane of a lanes tab instead of its own tab, and an empty tab (Ctrl+T, +) becomes a lanes tab. Other views (canvas, PDF, graph\u2026) and the exceptions below open as normal tabs. Off: notes open in normal tabs, and lanes are only filled by Shift-click, drag and drop, or the menus."
    ).addToggle((t) => t.setValue(this.s.lanesOnly).onChange((v) => this.set("lanesOnly", v, "routing")));
    new import_obsidian7.Setting(el).setName("Opening notes").setHeading();
    this.choice(
      el,
      "linkTarget",
      "Link clicked in a lane opens in",
      "Where a link followed inside a lane goes. Next lane: the next one in its tab (columns left to right, top to bottom within a column), from the last back to the first. Ctrl/Cmd-click, middle-click and Shift+Alt-click open a new lanes tab instead.",
      { next: "Next lane (sliding panes)", same: "Same lane", last: "Last-used lane of the tab" },
      "none"
    );
    this.choice(
      el,
      "newNotePosition",
      "New notes go",
      "Where a note added to a lane appears. Pinned notes always stay on top.",
      {
        top: "Top of the lane, below pinned notes",
        bottom: "Bottom of the lane",
        after: "Right after the note it was opened from"
      },
      "none"
    );
    this.choice(
      el,
      "duplicateMode",
      "Note already open in another lane",
      "What happens when you open a note that another lane (in any lanes tab) already shows.",
      { copy: "Open another copy here", jump: "Jump to it", move: "Move it here" },
      "none"
    );
    new import_obsidian7.Setting(el).setName("Exceptions to lanes only").setDesc(
      "Notes matching these open in normal tabs even with lanes only on (a link to one followed in a lane opens as a tab next to the lanes tab). One per line: a folder (Templates/), a note path or name, or a pattern like *.excalidraw.md (* stays in one folder, ** crosses folders)."
    ).addTextArea((t) => {
      t.inputEl.rows = 4;
      t.inputEl.addClass("lane-setting-textarea");
      t.setPlaceholder("Templates/\n*.excalidraw.md");
      t.setValue(this.s.routeExceptions);
      t.onChange((v) => this.set("routeExceptions", v, "none"));
      t.inputEl.addEventListener("blur", () => void this.plugin.settingsChanged("routing"));
    });
    new import_obsidian7.Setting(el).setName("Lane layout").setHeading();
    this.layoutSection(el);
    new import_obsidian7.Setting(el).setName("Keeping lanes tidy").setHeading();
    this.toggle(
      el,
      "accordion",
      "Accordion mode",
      "Opening or expanding a note collapses the other notes in its lane, except pinned ones.",
      "none"
    );
    this.number(
      el,
      "maxNotesPerLane",
      "Maximum notes per lane",
      "Adding a note beyond this closes the least recently opened note that isn't pinned. 0 = no limit",
      "none"
    );
    this.number(
      el,
      "autoCollapseAfter",
      "Auto-collapse after this many expanded",
      "With more notes expanded than this, the least recently opened ones (not pinned) collapse. 0 = off",
      "none"
    );
    new import_obsidian7.Setting(el).setName("Looks").setHeading();
    this.toggle(el, "showFolder", "Show folder in note headers", "Show the note's folder before its name.", "looks");
    this.choice(
      el,
      "headerSize",
      "Header size",
      "How tall each note's header is.",
      { comfortable: "Comfortable", compact: "Compact" },
      "looks"
    );
    let heightSetting = null;
    this.choice(
      el,
      "noteHeight",
      "Note height",
      "Grow each note to its full length, or cap it and scroll inside the note.",
      { grow: "Grow to content", cap: "Cap height" },
      "looks",
      () => heightSetting?.settingEl.toggle(this.s.noteHeight === "cap")
    );
    heightSetting = this.number(el, "noteMaxHeight", "Maximum note height", "Height in pixels", "looks");
    heightSetting.settingEl.toggle(this.s.noteHeight === "cap");
    new import_obsidian7.Setting(el).setName("Performance").setHeading();
    this.toggle(
      el,
      "showBacklinks",
      "Show backlinks panes under lane notes",
      "Off hides Backlinks Full View's panes in lanes, and that plugin skips the work for them.",
      "backlinks"
    );
    this.number(
      el,
      "preloadDistance",
      "Pre-load distance",
      "Expanded notes this many pixels outside the visible part of a lane are loaded ahead of time. Notes a few lane heights away unload after a few seconds (keeping their place, cursor and scroll) and load again before they come back into view",
      "looks"
    );
    new import_obsidian7.Setting(el).setName("Drag and drop").setHeading();
    this.choice(
      el,
      "dropOnText",
      "Dropping a note or link onto a note's text",
      "Insert a link into the note (Obsidian's behaviour), or open the dropped note in the lane.",
      { insert: "Insert a link", open: "Open it in the lane" },
      "none"
    );
  }
  layoutSection(el) {
    el.createEl("p", {
      cls: "setting-item-description",
      text: `All lanes of a lanes tab live in that one tab. Every new lanes tab, in any window, starts with the default layout below, and follows it when it changes. A tab can have its own layout instead: its \u22EF menu or tab menu \u2192 Lane layout\u2026 (or the command "Change lane layout of this tab\u2026"); that's saved with the tab. When a layout has fewer lanes, the notes of the lanes that go move into the remaining ones.`
    });
    const def = new import_obsidian7.Setting(el).setName("Default lane layout").setDesc(
      "Columns from left to right, separated by commas, as relative widths. Add x and a number to stack lanes in a column: 40, 30x2, 30 is three columns with two lanes stacked in the middle one."
    );
    const info = el.createDiv({ cls: "lane-layout-info" });
    const summary = info.createDiv({ cls: "lane-layout-summary" });
    const preview = info.createDiv({ cls: "lane-layout-preview", attr: { "aria-hidden": "true" } });
    const show = (text) => {
      const p = parseLayout(text);
      summary.toggleClass("lane-setting-error", !p.ok);
      preview.empty();
      if (!p.ok) {
        summary.setText(p.error);
        return false;
      }
      summary.setText(describeLayout(p.columns));
      drawPreview(preview, p.columns);
      return true;
    };
    const applySoon = (0, import_obsidian7.debounce)(() => void this.plugin.settingsChanged("layout"), 800, true);
    def.addText((t) => {
      t.setPlaceholder("50, 50");
      t.setValue(this.s.defaultLayout);
      t.onChange(async (v) => {
        const ok = show(v);
        t.inputEl.toggleClass("lane-setting-invalid", !ok);
        t.inputEl.setAttr("aria-invalid", String(!ok));
        if (!ok) return;
        this.s.defaultLayout = v;
        if (/[,;]\s*$/.test(v)) return void await this.plugin.saveSettings();
        await this.plugin.saveSettings();
        applySoon();
      });
    });
    show(this.s.defaultLayout);
    new import_obsidian7.Setting(el).setName("Reset every tab to the default").setDesc("Open lanes tabs that have their own layout go back to the default layout (notes are kept).").addButton((b) => b.setButtonText("Reset").onClick(() => void this.plugin.resetAllLayouts()));
    new import_obsidian7.Setting(el).setName("Lane sizes").setDesc(
      "Lanes always come from a layout (the default here, or a tab's own from its Lane layout\u2026 dialog); only their sizes can change: drag the dividers between lanes (double-click resets). Each tab remembers its sizes across restarts and workspace switches."
    );
  }
};

// src/main.ts
var loose = (o) => o;
var EditorLanesPlugin = class extends import_obsidian8.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULTS };
    /** "Exceptions to lanes only", compiled from the setting. */
    this.isException = () => false;
    /** Every private split / hosted leaf, for the iterateLeaves patch and for not routing our own opens. */
    this.splits = /* @__PURE__ */ new Set();
    this.hostedLeaves = /* @__PURE__ */ new Map();
    this._lastLane = null;
    /** Lanes tabs, most recently active first. */
    this.recent = [];
    /** The note card being dragged by its header, if any. */
    this.dragItem = null;
    this.swallow = null;
    this.routing = /* @__PURE__ */ new Set();
    // leaves whose open is being routed right now (the sweep skips them)
    this.intents = /* @__PURE__ */ new WeakMap();
    this.seen = /* @__PURE__ */ new WeakSet();
    // main-area leaves the sweep has already looked at
    this.sweeping = false;
    this.lastInput = null;
    // target of the last mousedown / keydown in any window
    this.windowDocs = /* @__PURE__ */ new WeakSet();
    /** Per popout window: its document listeners, unloaded when the window closes (so its DOM can be freed). */
    this.windowParts = /* @__PURE__ */ new Map();
    this.unloaded = false;
    this.sweepRetry = 0;
    this.requestSweep = (0, import_obsidian8.debounce)(() => void this.sweepMainArea(false), 250, true);
    this.requestLegacyCleanup = (0, import_obsidian8.debounce)(() => void this.closeLegacy().then(() => this.closeOldNavigator()), 100, true);
    this.noticeAt = 0;
    /**
     * Lanes tabs Obsidian is putting back after the plugin was enabled at runtime: registerView makes it reopen
     * each "plugin not active" placeholder as an empty view and then as a lanes tab with its saved state. In
     * between it looks like an empty tab, and turning it into a new lanes tab (the sweep) would make Obsidian's
     * own setViewState a no-op (the leaf is `working`): the tab would come back empty, with a new name.
     */
    this.restoring = /* @__PURE__ */ new WeakSet();
    this.restoringUntil = 0;
    this.patchedProtos = /* @__PURE__ */ new WeakSet();
    /** Per lanes tab: its card that was active last. */
    this.lastCard = /* @__PURE__ */ new WeakMap();
  }
  /** The lane used last, in any tab (setting it also makes it its tab's last-used lane and that tab the most recent). */
  get lastLane() {
    return this._lastLane;
  }
  set lastLane(lane) {
    this._lastLane = lane;
    if (!lane) return;
    lane.tab.lastLane = lane;
    this.touchTab(lane.tab);
  }
  async onload() {
    this.settings = loadSettings(await this.loadData());
    this.isException = compileExceptions(this.settings.routeExceptions);
    this.addSettingTab(new LanesSettingTab(this.app, this));
    if (this.app.workspace.layoutReady) {
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) this.restoring.add(leaf);
      this.restoringUntil = Date.now() + RESTORE_MS;
    }
    this.registerView(VIEW_TYPE, (leaf) => new LanesView(leaf, this));
    this.registerView(LEGACY_VIEW_TYPE, (leaf) => new LegacyLaneView(leaf, this));
    this.registerView(OLD_NAV_VIEW_TYPE, (leaf) => new OldNavigatorView(leaf, this));
    this.patchIterateLeaves();
    this.patchOpenFile();
    this.patchGetLeaf();
    this.patchActiveView();
    this.patchCreateLeafBySplit();
    this.patchDuplicateLeaf();
    this.patchMoveToPopout();
    this.patchRevealLeaf();
    this.patchMobileVisibility();
    this.patchMobileFocus();
    this.patchCardDelete();
    this.setupCaretVisibility();
    this.registerInterval(
      window.setInterval(() => {
        const now = Date.now();
        for (const tab of this.allTabs()) for (const lane of tab.lanes) lane.parkFar(now);
      }, PARK_CHECK_MS)
    );
    this.addRibbonIcon("columns-3", "New lanes tab", () => void this.newLanesTab());
    this.addCommand({ id: "new-lane", name: "New lanes tab", callback: () => void this.newLanesTab() });
    this.addCommand({
      id: "change-layout",
      name: "Change lane layout of this tab\u2026",
      checkCallback: (checking) => {
        const tab = this.currentTab();
        if (!tab) return false;
        if (!checking) tab.openLayoutDialog();
        return true;
      }
    });
    this.addCommand({
      id: "rename-tab",
      name: "Rename lanes tab\u2026",
      checkCallback: (checking) => {
        const tab = this.currentTab();
        if (!tab) return false;
        if (!checking) tab.openRenameDialog();
        return true;
      }
    });
    this.addCommand({
      id: "open-current",
      name: "Open current note in an editor lane",
      checkCallback: (checking) => this.withActiveFile(checking, (f) => this.openInLane(f, "last"))
    });
    this.addCommand({
      id: "open-current-new-lane",
      name: "Open current note in a new lanes tab",
      checkCallback: (checking) => this.withActiveFile(checking, (f) => this.openInLane(f, "newTab"))
    });
    this.addCommand({
      id: "open-note",
      name: "Open note in an editor lane\u2026",
      callback: () => new NotePicker(this).open()
    });
    this.addCommand({
      id: "close-all",
      name: "Close all notes in the current editor lane",
      callback: () => this.currentLane()?.closeAll()
    });
    this.addCommand({
      id: "collapse-all",
      name: "Collapse all notes in the current editor lane",
      callback: () => this.currentLane()?.setAllCollapsed(true)
    });
    this.addCommand({
      id: "toggle-pin",
      name: "Pin or unpin the current note in its editor lane",
      checkCallback: (checking) => this.withHostedItem(checking, (lane, it) => lane.togglePin(it))
    });
    this.addCommand({
      id: "move-next-lane",
      name: "Move the current note to the next editor lane",
      checkCallback: (checking) => this.withHostedItem(checking, (lane, it) => this.moveToLane(lane, it, 1))
    });
    this.addCommand({
      id: "move-previous-lane",
      name: "Move the current note to the previous editor lane",
      checkCallback: (checking) => this.withHostedItem(checking, (lane, it) => this.moveToLane(lane, it, -1))
    });
    this.addCommand({
      id: "toggle-lanes-only",
      name: "Toggle editor lanes only",
      callback: async () => {
        this.settings.lanesOnly = !this.settings.lanesOnly;
        await this.settingsChanged("routing");
      }
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
        if (!(file instanceof import_obsidian8.TFile) || file.extension !== "md" || source === "editor-lanes") return;
        const from = source === "link-context-menu" && leaf ? this.hostedLeaves.get(leaf)?.lane ?? null : null;
        menu.addItem(
          (i) => i.setTitle("Open in editor lane").setIcon("columns-3").setSection("open").onClick(() => void this.openInLane(file, "last", from))
        );
        menu.addItem(
          (i) => i.setTitle("Open in new lanes tab").setIcon("columns-3").setSection("open").onClick(() => void this.openInLane(file, "newTab"))
        );
      })
    );
    this.registerEvent(
      this.app.workspace.on("files-menu", (menu, files) => {
        const md = files.filter((f) => f instanceof import_obsidian8.TFile && f.extension === "md");
        if (!md.length) return;
        menu.addItem(
          (i) => i.setTitle(`Open ${md.length} in editor lane`).setIcon("columns-3").setSection("open").onClick(async () => {
            for (const f of [...md].reverse()) await this.openInLane(f, "last");
          })
        );
      })
    );
    this.registerWindow(document);
    this.registerEvent(this.app.workspace.on("window-open", (_w, win) => this.registerWindow(win.document)));
    this.registerEvent(
      this.app.workspace.on("window-close", (_w, win) => {
        const part = this.windowParts.get(win.document);
        if (!part) return;
        this.windowParts.delete(win.document);
        this.windowDocs.delete(win.document);
        this.removeChild(part);
      })
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        const tab = this.tabOf(leaf);
        if (tab) this.touchTab(tab);
        this.activeCardFor(leaf);
        const host = leaf ? this.hostedLeaves.get(leaf) : void 0;
        if (host) host.lane.tab.showLane(host.lane);
      })
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.wrapRightSplitCollapse();
        this.requestSweep();
        const ws = this.app.workspace;
        if (ws.getLeavesOfType(LEGACY_VIEW_TYPE).length || ws.getLeavesOfType(OLD_NAV_VIEW_TYPE).length) {
          this.requestLegacyCleanup();
        }
        for (const tab of this.allTabs()) for (const lane of tab.lanes) lane.syncViews();
      })
    );
    this.app.workspace.onLayoutReady(async () => {
      this.wrapRightSplitCollapse();
      for (const w of this.popouts()) if (w.doc) this.registerWindow(w.doc);
      await this.closeLegacy();
      await this.closeOldNavigator();
      void this.sweepMainArea(true);
    });
  }
  onunload() {
    this.unloaded = true;
    window.clearTimeout(this.sweepRetry);
    this.requestSweep.cancel();
    this.requestLegacyCleanup.cancel();
    for (const tab of this.allTabs()) tab.teardown();
  }
  // ---------- settings ----------
  async saveSettings() {
    await this.saveData(this.settings);
  }
  /** Save, then redo whatever the changed setting affects, without a reload. */
  async settingsChanged(refresh) {
    await this.saveSettings();
    if (refresh === "routing") {
      this.isException = compileExceptions(this.settings.routeExceptions);
      if (this.settings.lanesOnly) void this.sweepMainArea(true);
    }
    for (const tab of this.allTabs()) tab.applySettings();
    if (refresh === "backlinks") this.app.workspace.trigger("layout-change");
  }
  /** "Reset every tab to the default" (settings): drop every open tab's own layout. */
  async resetAllLayouts() {
    for (const tab of this.allTabs()) if (tab.layoutInfo().own) await tab.setLayout(null);
  }
  /** A note at this path keeps opening in normal tabs ("Exceptions to lanes only"). */
  isExcepted(file) {
    return this.isException(file.path);
  }
  /** At most one Notice a second. */
  refuse(msg) {
    const now = Date.now();
    if (now - this.noticeAt < 1e3) return;
    this.noticeAt = now;
    new import_obsidian8.Notice(msg);
  }
  registerWindow(doc) {
    if (this.windowDocs.has(doc)) return;
    this.windowDocs.add(doc);
    const owner = doc === document ? this : this.addChild(new import_obsidian8.Component());
    if (owner !== this) this.windowParts.set(doc, owner);
    owner.registerDomEvent(doc, "mousedown", (e) => this.onMouseDown(e), { capture: true });
    owner.registerDomEvent(
      doc,
      "pointerdown",
      (e) => {
        this.lastInput = e.target;
      },
      { capture: true }
    );
    owner.registerDomEvent(
      doc,
      "keydown",
      (e) => {
        this.lastInput = e.target;
      },
      { capture: true }
    );
    owner.registerDomEvent(
      doc,
      "focusin",
      (e) => {
        this.activeFollowsFocus(e);
        this.searchKeysFollowFocus(e);
      },
      { capture: true }
    );
    const swallow = (e) => {
      const s = this.swallow;
      if (!s) return;
      const t = asEl(e.target);
      if (Date.now() > s.until) {
        this.swallow = null;
        return;
      }
      if (!t || !(s.el.contains(t) || t.contains(s.el))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.type === "click") this.swallow = null;
    };
    owner.registerDomEvent(doc, "mouseup", swallow, { capture: true });
    owner.registerDomEvent(doc, "click", swallow, { capture: true });
  }
  /**
   * Lanes only, in every window: each empty main-area tab becomes a lanes tab; each Markdown tab moves into the
   * most recently active lanes tab of its window (its last-used lane; keeping tab order, first tab on top, and
   * its mode, scroll / cursor and history) and closes, or, in a window with no lanes tab, becomes one holding it.
   * Pinned and linked tabs stay, as do exceptions and other tabs (canvas, PDF, graph, Bases…). `all`: look at
   * every tab, not just those new since the last sweep.
   */
  async sweepMainArea(all) {
    if (!this.settings.lanesOnly || this.sweeping) return;
    this.sweeping = true;
    let retry = false;
    try {
      const ws = this.app.workspace;
      const tabs = [];
      const empties = [];
      for (const root of this.windowRoots()) {
        ws.iterateLeaves(root, (leaf) => {
          if (this.hostedLeaves.has(leaf) || leaf.view instanceof LanesView) return;
          const vs = leaf.getViewState();
          if (vs.type === VIEW_TYPE || vs.type === LEGACY_VIEW_TYPE) return;
          if (this.routing.has(leaf) || this.freshIntent(leaf) || this.isRestoring(leaf)) {
            retry = true;
            return;
          }
          if (!all && this.seen.has(leaf)) return;
          this.seen.add(leaf);
          if (vs.pinned || leaf.group) return;
          if (vs.type === "markdown") {
            const f = this.app.vault.getAbstractFileByPath(String(vs.state?.file ?? ""));
            if (!(f instanceof import_obsidian8.TFile) || this.isExcepted(f)) return;
            tabs.push({ leaf, file: f, opts: this.tabState(leaf) });
          } else if (vs.type === "empty") {
            empties.push(leaf);
          }
        });
      }
      for (const leaf of empties) if (leaf.parent) await this.newTab(leaf, void 0, false);
      for (const { leaf, file, opts } of tabs.reverse()) {
        const tab = this.recentTabIn(leaf.getContainer());
        if (!tab) {
          await (await this.newTab(leaf, void 0, false))?.lanes[0]?.add(file, opts);
          continue;
        }
        await tab.currentLane()?.add(file, opts);
        this.detachQuietly(leaf);
      }
    } catch (e) {
      console.error("[editor-lanes] could not move tabs into lanes", e);
    } finally {
      this.sweeping = false;
    }
    if (retry && !this.unloaded) {
      window.clearTimeout(this.sweepRetry);
      this.sweepRetry = window.setTimeout(() => {
        if (!this.unloaded) this.requestSweep();
      }, INTENT_MS);
    }
  }
  /** A tab's mode, scroll / cursor and history, for reopening its note in a lane. */
  tabState(leaf) {
    const vs = leaf.getViewState();
    const mode = vs.state?.mode;
    const opts = { mode: typeof mode === "string" ? mode : void 0 };
    try {
      opts.eState = leaf.getEphemeralState();
    } catch {
    }
    try {
      opts.history = leaf.history?.serialize?.();
    } catch {
    }
    return opts;
  }
  /**
   * Old layouts (one "editor-lane" leaf per lane, in any window) aren't converted: their leaves are closed
   * without "Undo close tab" entries, and a window left without a lanes tab gets one with the default layout in
   * place of its first old lane. getLeavesOfType also finds old lanes in background tabs (deferred views
   * report their saved type).
   */
  async closeLegacy() {
    const ws = this.app.workspace;
    if (!ws.layoutReady) return;
    const legacy = ws.getLeavesOfType(LEGACY_VIEW_TYPE);
    if (!legacy.length) return;
    const byWindow = /* @__PURE__ */ new Map();
    for (const leaf of legacy) {
      if (!this.inMainArea(leaf)) {
        this.detachQuietly(leaf);
        continue;
      }
      const win = leaf.getContainer();
      byWindow.set(win, [...byWindow.get(win) ?? [], leaf]);
    }
    let replaced = false;
    for (const [win, leaves] of byWindow) {
      let rest = leaves;
      const hasTab = ws.getLeavesOfType(VIEW_TYPE).some((l) => this.inMainArea(l) && l.getContainer() === win);
      if (!hasTab) {
        try {
          await leaves[0].setViewState({ type: VIEW_TYPE });
          rest = leaves.slice(1);
          replaced = true;
        } catch (e) {
          console.error("[editor-lanes] could not open a lanes tab in place of an old lane", e);
        }
      }
      for (const leaf of rest) this.detachQuietly(leaf);
    }
    new import_obsidian8.Notice(
      replaced ? "Editor Lanes now keeps all lanes in one tab: the old lanes were closed and a new lanes tab opened." : "Editor Lanes now keeps all lanes in one tab: the old lanes were closed."
    );
  }
  /**
   * The removed Navigator tab (OLD_NAV_VIEW_TYPE): close any left in the layout (no "Undo close tab" entries),
   * then make sure the File explorer, Search and Bookmarks views are in the left sidebar again. Obsidian's core
   * plugins do that themselves on layout-ready (their initLeaf: workspace.ensureSideLeaf(type, "left",
   * {reveal: false}), which only makes a leaf when none of that type exists); this covers the plugin being
   * enabled or updated after startup. A disabled core plugin gets no view.
   */
  async closeOldNavigator() {
    const ws = this.app.workspace;
    if (!ws.layoutReady) return;
    const old = ws.getLeavesOfType(OLD_NAV_VIEW_TYPE);
    if (!old.length) return;
    for (const leaf of old) this.detachQuietly(leaf);
    const core = [
      ["file-explorer", "file-explorer"],
      ["global-search", "search"],
      ["bookmarks", "bookmarks"]
    ];
    for (const [id, type] of core) {
      try {
        if (!this.app.internalPlugins?.getEnabledPluginById(id) || ws.getLeavesOfType(type).length) continue;
        await ws.ensureSideLeaf(type, "left", { reveal: false });
      } catch (e) {
        console.error("[editor-lanes] could not put back the", type, "view", e);
      }
    }
  }
  /**
   * The card commands act on: the active one, or with a lanes tab active, its current card (as
   * getActiveViewOfType answers). Closing the command palette makes the lanes tab active for a moment before its
   * card takes over again (activeCardFor), and the palette runs the command in between.
   */
  activeCard() {
    const leaf = this.app.workspace.activeLeaf;
    return leaf?.view instanceof LanesView ? this.cardOfTab(leaf.view) : leaf;
  }
  withHostedItem(checking, fn) {
    const card = this.activeCard();
    const h = card ? this.hostedLeaves.get(card) : void 0;
    if (!h) return false;
    if (!checking) void fn(h.lane, h.item);
    return true;
  }
  withActiveFile(checking, fn) {
    const f = this.app.workspace.getActiveFile();
    if (!f || f.extension !== "md") return false;
    if (!checking) void fn(f);
    return true;
  }
  /** Detach a leaf without leaving an "Undo close tab" entry for it (it was moved, not closed). */
  detachQuietly(leaf) {
    const restore = around(this.app.workspace, { pushUndoHistory: () => () => {
    } });
    try {
      leaf.detach();
    } catch (e) {
      console.error("[editor-lanes] detach failed", e);
    } finally {
      restore();
    }
  }
  // ---------- patches (monkey-around: each is undone on unload, in any order, even if another plugin
  // wrapped the same method afterwards) ----------
  /**
   * workspace.iterateLeaves(root, cb) walks `root.children`; our splits aren't children of anything, so
   * after the normal walk of the right sidebar (the only `parent` they report), also walk every private
   * split. Obsidian's walk recurses through this function at every node, so anything else returns at once.
   */
  patchIterateLeaves() {
    const ws = this.app.workspace;
    const splits = this.splits;
    this.register(
      around(ws, {
        iterateLeaves: (next) => function(a, b) {
          if (next.call(this, a, b)) return true;
          let target = a, cb = b;
          if (typeof a === "function") {
            target = b;
            cb = a;
          }
          if (!target || target !== ws.rightSplit || typeof cb !== "function") return false;
          for (const sp of splits) {
            if (sp.parent === target && next.call(this, sp, cb)) return true;
          }
          return false;
        }
      })
    );
  }
  /**
   * A note about to open in a main-area leaf goes to a lane instead (lanes only), and nothing ever replaces a
   * card's note or a lanes tab: a note opened into a lanes tab (a file dropped on its tab header, a plugin
   * opening into the active leaf) goes into its current lane; an exception or a non-note file opened from a card
   * or into a lanes tab opens as a tab beside the lanes tab.
   */
  patchOpenFile() {
    const plugin = this;
    this.register(
      around(import_obsidian8.WorkspaceLeaf.prototype, {
        openFile: (next) => async function(file, openState) {
          const host = plugin.hostedLeaves.get(this);
          const tab = host ? host.lane.tab : this.view instanceof LanesView ? this.view : null;
          const notInLane = file instanceof import_obsidian8.TFile && (file.extension !== "md" || plugin.isExcepted(file));
          if (tab && notInLane && file !== host?.item.file) {
            return plugin.openBeside(tab, file, openState);
          }
          const intent = !tab && notInLane ? plugin.freshIntent(this) : null;
          if (intent?.from && !intent.paneType && plugin.inMainArea(this)) {
            await plugin.openBeside(intent.from.tab, file, openState);
            plugin.dropUsedLeaf(this);
            return;
          }
          if (!plugin.shouldRoute(this, file)) return next.call(this, file, openState);
          try {
            await plugin.route(this, file, openState);
          } catch (e) {
            console.error("[editor-lanes] routing to a lane failed, opening normally", e);
            if (tab) return;
            return next.call(this, file, openState);
          }
        }
      })
    );
  }
  /**
   * Record where an open starts. Obsidian's opens pick a leaf with getLeaf(paneType) (which calls
   * getUnpinnedLeaf for a plain open) and only then call openFile; by then the active leaf is often a fresh
   * temporary tab, so the source lane has to be read here.
   */
  /**
   * With a lanes tab as the active leaf, "the active Markdown view" is its note: the focused card, else the one
   * active last, else the first open one. workspace.activeEditor (and getActiveFile) come from
   * getActiveViewOfType(MarkdownView), and the lanes view itself isn't one, so without this, plugins acting on
   * the active editor fail in a lanes tab: Templater's "No active editor, can't append templates".
   */
  patchActiveView() {
    const ws = this.app.workspace;
    const plugin = this;
    this.register(
      around(ws, {
        getActiveViewOfType: (next) => function(type) {
          const r = next.call(this, type);
          if (r || typeof type !== "function") return r;
          const view = ws.activeLeaf?.view;
          if (!(view instanceof LanesView)) return r;
          const card = plugin.cardOfTab(view);
          return card && card.view instanceof type ? card.view : r;
        }
      })
    );
  }
  /** The lanes tab's current note: the focused card, else the card active last, else the first open one. */
  cardOfTab(view) {
    const mine = [...this.hostedLeaves].filter(([, h]) => h.lane.tab === view);
    const focused = activeDocument.activeElement;
    const inFocus = focused && mine.find(([, h]) => h.item.el.contains(focused));
    if (inFocus) return inFocus[0];
    const last = this.lastCard.get(view);
    if (last && mine.some(([l]) => l === last)) return last;
    return mine.find(([, h]) => !h.item.collapsed)?.[0] ?? null;
  }
  patchGetLeaf() {
    const ws = this.app.workspace;
    const plugin = this;
    const record = (name) => (next) => function(...args) {
      const before = ws.activeLeaf;
      const from = plugin.inputLane(before);
      const fromItem = from ? plugin.inputItem(from) : null;
      const leaf = next.apply(this, args);
      if (leaf) {
        plugin.intents.set(leaf, {
          from,
          fromItem,
          paneType: name === "getLeaf" ? args[0] : false,
          wasActive: leaf === before,
          at: Date.now()
        });
      }
      return leaf;
    };
    this.register(around(loose(ws), { getLeaf: record("getLeaf"), getUnpinnedLeaf: record("getUnpinnedLeaf") }));
  }
  /** Splitting a hosted note (Split down, linked views…) splits its lanes tab instead of the private split. */
  patchCreateLeafBySplit() {
    const plugin = this;
    this.register(
      around(this.app.workspace, {
        createLeafBySplit: (next) => function(leaf, ...rest) {
          const host = leaf ? plugin.hostedLeaves.get(leaf) : void 0;
          return next.call(this, host ? host.lane.tab.leaf : leaf, ...rest);
        }
      })
    );
  }
  /**
   * "Split right / down", "Open in new window" and the like (workspace.duplicateLeaf, from the commands and
   * tab menu) on a lanes tab or a card in one: Obsidian would copy the whole tab, notes and all, so the same
   * notes would have editors in two places. Instead the new pane (split off the lanes tab, or a new tab /
   * window) is an empty lanes tab with the source tab's layout and lane sizes, and no notes.
   */
  patchDuplicateLeaf() {
    const plugin = this;
    this.register(
      around(loose(this.app.workspace), {
        duplicateLeaf: (next) => async function(leaf, mode, dir) {
          const tab = leaf?.view instanceof LanesView ? leaf.view : leaf ? plugin.hostedLeaves.get(leaf)?.lane.tab : null;
          if (!tab) return next.call(this, leaf, mode, dir);
          return plugin.emptyCopyOf(tab, mode, dir);
        }
      })
    );
  }
  /** "Move to new window" (tab menu, command) on a card: the card moves into a new window's lanes tab, pin and all. */
  patchMoveToPopout() {
    const plugin = this;
    this.register(
      around(this.app.workspace, {
        moveLeafToPopout: (next) => function(leaf, ...rest) {
          const host = leaf ? plugin.hostedLeaves.get(leaf) : void 0;
          if (!host) return next.call(this, leaf, ...rest);
          void plugin.cardToNewWindow(host.lane, host.item);
          return void 0;
        }
      })
    );
  }
  /**
   * revealLeaf(card) would see the card's root (the right sidebar / mobile drawer) and expand it. Reveal the
   * card's lanes tab instead, with the card scrolled into view (and its lane, on phones).
   */
  patchRevealLeaf() {
    const plugin = this;
    this.register(
      around(loose(this.app.workspace), {
        revealLeaf: (next) => async function(leaf, ...rest) {
          const host = leaf ? plugin.hostedLeaves.get(leaf) : void 0;
          if (!host) return next.call(this, leaf, ...rest);
          await next.call(this, host.lane.tab.leaf, ...rest);
          host.lane.tab.showLane(host.lane);
          host.lane.scrollToItem(host.item);
        }
      })
    );
  }
  /**
   * Mobile: workspace.updateMobileVisibleTabGroup marks the active leaf's parents `mod-visible` and takes the
   * class off every other split / tab group in the main area; on phones those are hidden. A card's parents are
   * its private split and the right drawer, so the lanes tab's own tab group (and splits) would be hidden: mark
   * the lanes tab's chain instead, right after. A no-op on the desktop (the method returns at once there).
   */
  patchMobileVisibility() {
    const ws = this.app.workspace;
    if (typeof ws.updateMobileVisibleTabGroup !== "function") return;
    const plugin = this;
    this.register(
      around(ws, {
        updateMobileVisibleTabGroup: (next) => function(...args) {
          const out = next.apply(this, args);
          const tab = plugin.hostedLeaves.get(ws.activeLeaf)?.lane.tab;
          if (import_obsidian8.Platform.isMobile && tab) {
            for (let p = tab.leaf.parent; p; p = p.parent) {
              p.containerEl?.addClass("mod-visible");
            }
          }
          return out;
        }
      })
    );
  }
  /**
   * Mobile: focusing a leaf in the main area closes the sidebar drawers (workspace.focusLeaf, for leaves whose
   * root is rootSplit), so a note tapped in the file explorer drawer shows up in front. A card's root is the
   * right drawer, so do the same for cards. collapse() leaves a pinned drawer (tablets) open, as Obsidian does.
   */
  patchMobileFocus() {
    const ws = this.app.workspace;
    if (typeof ws.focusLeaf !== "function") return;
    const plugin = this;
    this.register(
      around(ws, {
        focusLeaf: (next) => function(leaf, ...rest) {
          const out = next.call(this, leaf, ...rest);
          if (import_obsidian8.Platform.isMobile && leaf && plugin.hostedLeaves.has(leaf)) {
            for (const d of [ws.leftSplit, ws.rightSplit]) {
              if (d?.type === "mobile-drawer") d.collapse?.();
            }
          }
          return out;
        }
      })
    );
  }
  // ---------- native editor features in cards (in-note search, scrolling to a line) ----------
  /**
   * A card's note deleted: its lane closes the card (Lane.onFileDeleted). The view's own onDelete would go back in
   * its history or empty the leaf and then read `leaf.parent.children`, which a card's leaf hasn't got (a
   * TypeError). Patched on the prototype: FileView binds onDelete when the view loads.
   */
  patchCardDelete() {
    this.register(
      around(loose(import_obsidian8.MarkdownView.prototype), {
        onDelete: (next) => async function(file) {
          if (this.__laneCard && file === this.file) return;
          return next.call(this, file);
        }
      })
    );
  }
  /** The hosted card whose note view this editing mode / Reading view renderer belongs to. */
  cardOf(part) {
    for (const [leaf, host] of this.hostedLeaves) {
      const v = leaf.view;
      if (v instanceof import_obsidian8.MarkdownView && (v.editMode === part || v.previewMode?.renderer === part)) return host;
    }
    return void 0;
  }
  /**
   * A card's note view (after it opens, and after a mode change): see patchCardScrolling. MarkdownView.scroll is
   * the view's own scroll position, re-applied by mode switches, Reading view's onResize (every time the card's
   * height changes) and saved in its ephemeral state. A card has no scroll of its own (the lane list scrolls),
   * so it's kept null: re-applying it would now scroll the lane list to that line at random moments.
   * Explicit requests (a #heading link, Outline, a line, an eState `scroll`) still go through applyScroll.
   */
  adoptCardView(view) {
    if (!(view instanceof import_obsidian8.MarkdownView)) return;
    const v = view;
    if (!v.__laneCard) {
      v.__laneCard = true;
      Object.defineProperty(v, "scroll", { configurable: true, get: () => null, set: () => {
      } });
    }
    this.patchCardScrolling(v);
  }
  /**
   * Scrolling a card to a line or a search match. Obsidian scrolls a note by setting scrollTop on its scroller
   * (.cm-scroller, .markdown-preview-view), which in a card has its content's height and doesn't scroll: the
   * lane list does. CodeMirror's own scrollIntoView already scrolls every scrolling ancestor (app.js: the
   * scrollRectIntoView loop walks parentNode up to the window, skipping elements that can't scroll, honouring
   * EditorView.scrollMargins), so editing-mode search, the caret, #heading / #^block links and Outline in Live
   * Preview / Source work as is. What sets scrollTop is patched, for cards only (the classes aren't exported:
   * their prototypes are taken from the first card's view):
   * - editing mode applyScroll(line) (an eState `scroll`): CodeMirror scrollIntoView(line start, "start");
   * - Reading view renderer applyScroll(line, {center, highlight}) (#heading / #^block links, Outline, a line,
   *   `scroll`, a search result's match): run with previewEl.scrollTop captured, then the lane scrolls there;
   *   `center` is done here (Obsidian's subtracts half of previewEl's height, which is the whole note's);
   * - Reading view renderer selectRange(match) (in-note search in Reading view: next / previous match): it only
   *   scrolls when the match is outside previewEl's own view, which in a card is everything; the lane scrolls
   *   to centre the match when it isn't shown.
   * Embeds, hover previews and canvas cards use the same classes and are left alone (cardOf finds no card).
   */
  patchCardScrolling(view) {
    const plugin = this;
    const em = view.editMode;
    const emProto = em ? Object.getPrototypeOf(em) : null;
    if (emProto && typeof emProto.applyScroll === "function" && !this.patchedProtos.has(emProto)) {
      this.patchedProtos.add(emProto);
      this.register(
        around(emProto, {
          applyScroll: (next) => function(line) {
            if (typeof line !== "number" || isNaN(line) || !plugin.cardOf(this) || !this.cm) {
              return next.call(this, line);
            }
            const doc = this.cm.state.doc;
            const n = Math.min(Math.max(0, Math.floor(line)), doc.lines - 1);
            this.cm.dispatch({ effects: import_view.EditorView.scrollIntoView(doc.line(n + 1).from, { y: "start" }) });
          }
        })
      );
    }
    const r = view.previewMode?.renderer;
    const rProto = r ? Object.getPrototypeOf(r) : null;
    if (rProto && typeof rProto.applyScroll === "function" && typeof rProto.selectRange === "function" && !this.patchedProtos.has(rProto)) {
      this.patchedProtos.add(rProto);
      this.register(
        around(rProto, {
          applyScroll: (next) => function(line, opts) {
            const el = this.previewEl;
            if (!el || !plugin.cardOf(this)) return next.call(this, line, opts);
            let top = null;
            Object.defineProperty(el, "scrollTop", {
              configurable: true,
              get: () => top ?? 0,
              set: (v) => {
                top = v;
              }
            });
            let done;
            try {
              done = next.call(this, line, opts?.center ? { ...opts, center: false } : opts);
            } finally {
              delete el.scrollTop;
            }
            const at = top;
            if (at !== null) {
              scrollCardBand(
                el,
                () => {
                  const y = el.getBoundingClientRect().top + at;
                  return { top: y, bottom: y + 24 };
                },
                opts?.center ? "center" : "start"
              );
            }
            return done;
          },
          selectRange: (next) => function(match) {
            next.call(this, match);
            if (!this.previewEl || !match?.section?.el || !plugin.cardOf(this)) return;
            scrollCardBand(this.previewEl, () => matchBand(match.section.el, match.start, match.end), "center");
          }
        })
      );
    }
  }
  /**
   * In-note search per card. Each note view has its own search bar (MarkdownView's editing mode builds one; Reading
   * view one per view), so several cards can have one open at once, each with its own query, matches and
   * replace. Reading view's search keys live in its view's scope, which Obsidian uses for the active leaf only, so
   * they follow the focused card already. Editing mode's push a scope on the window's keymap stack instead, and
   * only the top one gets keys: with two cards searching, Enter / Escape / F3 typed in one would act on the card
   * whose bar opened last. So when focus moves into a card's note, that card's open search scope (if any) goes
   * on top and the other cards' come off (they stay open, and go back on top when focus returns to them). Focus
   * in a card header (the title) takes them all off; focus outside cards leaves the stack alone.
   */
  /**
   * Focus inside a card's note makes that card the active leaf. Cards can get focus without becoming active
   * (one opened into a lane with active: false, a restored layout, keyboard focus moves), and the lanes view
   * then stays active. workspace.activeEditor is null in that case, so commands and plugins that act on the
   * active editor fail: Templater's "Insert template" ("No active editor, can't append templates") and its
   * jump to tp.file.cursor() after creating a note.
   */
  activeFollowsFocus(e) {
    const t = asEl(e.target);
    if (!t?.closest(".lane-item")) return;
    for (const [leaf, host] of this.hostedLeaves) {
      if (!host.item.el.contains(t)) continue;
      if (this.app.workspace.activeLeaf !== leaf) this.app.workspace.setActiveLeaf(leaf, { focus: false });
      return;
    }
  }
  /**
   * A lanes tab that becomes the active leaf hands that on to its last active card (else its first open one), so
   * workspace.activeEditor is a note whenever a lanes tab with an open note is in front: switching to the tab,
   * a click on a lane header, startup with a lanes tab active. The lanes view itself has no editor, and
   * Templater's "Insert template" then fails with "No active editor".
   */
  activeCardFor(leaf) {
    if (!leaf) return;
    const host = this.hostedLeaves.get(leaf);
    if (host) {
      this.lastCard.set(host.lane.tab, leaf);
      return;
    }
    const view = leaf.view;
    if (!(view instanceof LanesView)) return;
    const card = this.cardOfTab(view);
    if (!card) return;
    activeWindow.setTimeout(() => {
      if (this.app.workspace.activeLeaf === leaf && this.hostedLeaves.has(card))
        this.app.workspace.setActiveLeaf(card, { focus: false });
    }, 0);
  }
  searchKeysFollowFocus(e) {
    const t = asEl(e.target);
    const card = t?.closest(".lane-item");
    if (!t || !card) return;
    const into = t.closest(".lane-item-body") ? card : null;
    const km = this.app.keymap;
    let mine = null;
    for (const [leaf, host] of this.hostedLeaves) {
      const em = leaf.view instanceof import_obsidian8.MarkdownView ? leaf.view.editMode : void 0;
      const scope = em?.search?.isActive ? em.scope : null;
      if (!scope) continue;
      if (host.item.el === into) mine = scope;
      else km.popScope(scope);
    }
    if (mine) {
      km.popScope(mine);
      km.pushScope(mine);
    }
  }
  /** A card's editor is going: its open search's key scope comes off the keymap stack (Obsidian leaves it). */
  dropSearchKeys(leaf) {
    const em = leaf.view instanceof import_obsidian8.MarkdownView ? leaf.view.editMode : void 0;
    if (em?.scope) this.app.keymap.popScope(em.scope);
  }
  /**
   * Cards have a sticky header over their editor: CodeMirror's scroll margins get its height, so scrolling the
   * caret into view (typing, arrow keys, search) never leaves it under the header. Mobile: when the soft
   * keyboard opens (Obsidian's `keyboardWillShow`) or a card's editor gets focus, the caret is scrolled into
   * view once the keyboard has settled (the lane got shorter).
   */
  setupCaretVisibility() {
    this.registerEditorExtension(
      import_view.EditorView.scrollMargins.of((view) => {
        const card = view.dom.closest(".lane-item");
        const head = card?.querySelector(":scope > .lane-item-header");
        if (!head) return null;
        const bar = view.dom.parentElement?.querySelector(":scope > .document-search-container");
        return { top: head.offsetHeight + (bar?.offsetHeight ?? 0) + 4 };
      })
    );
    if (!import_obsidian8.Platform.isMobile) return;
    let timer = 0;
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => this.keepCaretVisible(), 350);
    };
    window.addEventListener("keyboardWillShow", soon);
    this.register(() => {
      window.removeEventListener("keyboardWillShow", soon);
      window.clearTimeout(timer);
    });
    this.registerDomEvent(document, "focusin", (e) => {
      if (asEl(e.target)?.closest(".lane-item-body")) soon();
    });
  }
  keepCaretVisible() {
    const host = this.hostedLeaves.get(this.app.workspace.activeLeaf);
    const view = host?.item.leaf?.view;
    if (!(view instanceof import_obsidian8.MarkdownView) || !view.editor.hasFocus()) return;
    const at = view.editor.getCursor();
    view.editor.scrollIntoView({ from: at, to: at }, false);
  }
  /**
   * Collapsing the right sidebar makes Obsidian move focus off any active leaf whose root is the sidebar,
   * which hosted leaves report. `setLayout` replaces rightSplit, so this is re-applied on layout changes.
   * Mobile: the right drawer's collapse() does the same (MobileDrawer.onCollapse, called synchronously).
   */
  wrapRightSplitCollapse() {
    const ws = this.app.workspace;
    const rs = ws.rightSplit;
    if (!rs || rs.__laneCollapse || typeof rs.collapse !== "function") return;
    rs.__laneCollapse = true;
    const plugin = this;
    const uninstall = around(rs, {
      collapse: (next) => function(...args) {
        const a = ws.activeLeaf;
        if (!a || !plugin.hostedLeaves.has(a)) return next.apply(this, args);
        a.getRoot = () => ws.rootSplit;
        try {
          return next.apply(this, args);
        } finally {
          delete a.getRoot;
        }
      }
    });
    this.register(() => {
      uninstall();
      delete rs.__laneCollapse;
    });
  }
  // ---------- routing ----------
  freshIntent(leaf) {
    const i = this.intents.get(leaf);
    return i && Date.now() - i.at < INTENT_MS ? i : null;
  }
  /**
   * Where the user's input is: the target of the key / mouse event being handled right now, else of the last one.
   * Obsidian's hotkeys and modals (the quick switcher's Enter) act in a keydown listener on the window, capture
   * phase, which runs before the document listeners that record `lastInput`: without the current event, a note
   * chosen in the quick switcher would count as opened from the lane clicked last (and go to the next lane).
   */
  inputTarget() {
    const ev = activeWindow.event;
    const t = ev && /^(key|mouse|pointer|click|auxclick|touch|drop)/.test(ev.type) ? ev.target : null;
    if (t && typeof t.nodeType === "number") this.lastInput = t;
    return this.lastInput;
  }
  /**
   * The lane whose card the user's last mouse / key input was in, if it's in `leaf`'s lanes tab (a link followed
   * there). A click on a lane's background isn't one: an open after it (a hotkey, a plugin) goes to that lane as
   * the last-used one, not to the lane after it.
   */
  inputLane(leaf) {
    const tab = this.tabOf(leaf);
    const t = this.inputTarget();
    return tab && t && tab.lanes.find((l) => l.items.some((i) => i.el.contains(t))) || null;
  }
  /** The card in `lane` that the user's last mouse / key input was in. */
  inputItem(lane) {
    const t = this.inputTarget();
    return t && lane.items.find((i) => i.el.contains(t)) || null;
  }
  shouldRoute(leaf, file) {
    if (!(file instanceof import_obsidian8.TFile) || file.extension !== "md") return false;
    const host = this.hostedLeaves.get(leaf);
    if (host) return host.item.file !== file;
    if (leaf.view instanceof LanesView) return true;
    if (!this.settings.lanesOnly || this.isExcepted(file)) return false;
    return this.inMainArea(leaf);
  }
  async route(leaf, file, openState) {
    const intent = this.freshIntent(leaf);
    this.intents.delete(leaf);
    this.routing.add(leaf);
    try {
      await this.routeInner(leaf, file, openState, intent);
    } finally {
      this.routing.delete(leaf);
    }
  }
  async routeInner(leaf, file, openState, intent) {
    const ws = this.app.workspace;
    const host = this.hostedLeaves.get(leaf);
    const from = host ? host.lane : intent ? intent.from : this.inputLane(ws.activeLeaf);
    const fromItem = host ? host.item : intent ? intent.fromItem : from ? this.inputItem(from) : null;
    const p = intent?.paneType;
    const creating = !!openState?.eState?.rename;
    const wantNew = !host && !creating && (p === "tab" || p === true || p === "split" || p === "window");
    const opts = {
      focus: openState?.active ?? leaf === ws.activeLeaf,
      eState: openState?.eState,
      mode: typeof openState?.state?.mode === "string" ? openState.state.mode : void 0,
      after: fromItem
    };
    if (leaf.view instanceof LanesView) {
      const tab = leaf.view;
      const lt = this.settings.linkTarget;
      const base = from?.tab === tab && lt !== "last" ? from : null;
      const done = base ? await this.openInLane(file, lt, base, opts) : await this.openInLane(file, "same", tab.currentLane(), opts);
      if (!done) throw new Error("no lane to open in");
      return;
    }
    if (!host && this.isEmptyMainLeaf(leaf) && (wantNew || intent?.wasActive && !creating || !this.recentTabIn(leaf.getContainer()))) {
      const tab = await this.newTab(leaf);
      if (!tab?.lanes[0]) throw new Error("no lane to open in");
      await tab.lanes[0].add(file, { ...opts, after: null });
      return;
    }
    const where = wantNew ? "newTab" : from ? this.settings.linkTarget : "last";
    if (!await this.openInLane(file, where, from, opts)) throw new Error("no lane to open in");
    this.dropUsedLeaf(leaf);
  }
  /** The tab Obsidian picked (or made) for a routed open is now unused: close it if it's empty and not alone. */
  dropUsedLeaf(leaf) {
    if (!this.isEmptyMainLeaf(leaf)) return;
    let n = 0;
    this.app.workspace.iterateLeaves(leaf.getContainer(), () => {
      n++;
    });
    if (n > 1) this.detachQuietly(leaf);
  }
  isEmptyMainLeaf(leaf) {
    return !this.hostedLeaves.has(leaf) && !!leaf.parent && leaf.view?.getViewType() === "empty" && !this.isRestoring(leaf) && this.inMainArea(leaf);
  }
  /** A lanes tab Obsidian is still putting back (see `restoring`). */
  isRestoring(leaf) {
    return Date.now() < this.restoringUntil && this.restoring.has(leaf) && !(leaf.view instanceof LanesView);
  }
  /** In a window's main area (the main window's, or a popout's), not a sidebar. */
  inMainArea(item) {
    const ws = this.app.workspace;
    const root = typeof item?.getRoot === "function" ? item.getRoot() : null;
    return !!root && (root === ws.rootSplit || root === ws.floatingSplit);
  }
  // ---------- lanes tabs ----------
  /**
   * The names of every lanes tab but `self`, in any window, including tabs not loaded yet (their saved state is
   * read; loaded tabs are asked directly, so naming one never asks another for its state, which could name it
   * in turn). Tabs not named yet give null.
   */
  otherTabNames(self) {
    const names = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf === self.leaf) return;
      if (leaf.view instanceof LanesView) names.push(leaf.view.peekName);
      else {
        const vs = leaf.getViewState();
        if (vs.type === VIEW_TYPE) names.push(savedTabName(vs.state));
      }
    });
    return names;
  }
  /** A random name for lanes tab `self` that no other lanes tab has (nor any of `avoid`). */
  pickTabName(self, avoid = []) {
    return pickTabName([...this.otherTabNames(self), ...avoid]);
  }
  /** Another lanes tab than `self` already has this name (ignoring case). */
  tabNameInUse(name, self) {
    const n = name.toLowerCase();
    return this.otherTabNames(self).some((o) => o?.toLowerCase() === n);
  }
  /** Every open (loaded) lanes tab. */
  allTabs() {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE).map((l) => l.view).filter((v) => v instanceof LanesView);
  }
  /** Lanes tabs in main areas, in layout-tree order (main window first). */
  tabs() {
    return this.allTabs().filter((t) => this.inMainArea(t.leaf));
  }
  tabOf(leaf) {
    if (!leaf) return null;
    if (leaf.view instanceof LanesView) return leaf.view;
    return this.hostedLeaves.get(leaf)?.lane.tab ?? null;
  }
  touchTab(tab) {
    if (this.recent[0] === tab) return;
    this.recent = [tab, ...this.recent.filter((t) => t !== tab)];
  }
  forgetTab(tab) {
    this.recent = this.recent.filter((t) => t !== tab);
    if (this._lastLane?.tab === tab) this._lastLane = null;
  }
  /** The most recently active lanes tab in window `win`, else its first one. */
  recentTabIn(win) {
    const here = this.tabs().filter((t) => t.leaf.getContainer() === win);
    return this.recent.find((t) => here.includes(t)) ?? here[0] ?? null;
  }
  /** The window (WorkspaceContainer) that has focus: a popout, or the main window's rootSplit. */
  activeContainer() {
    const ws = this.app.workspace;
    const win = typeof activeWindow !== "undefined" ? activeWindow : window;
    return this.popouts().find((w) => w.win === win) ?? ws.rootSplit;
  }
  /** The main window's rootSplit and every open popout window (each a WorkspaceContainer). */
  windowRoots() {
    return [this.app.workspace.rootSplit, ...this.popouts()];
  }
  /** The open popout windows (WorkspaceWindow: `type` "window", with a live `win`). */
  popouts() {
    const kids = this.app.workspace.floatingSplit?.children ?? [];
    return kids.filter((w) => w?.type === "window" && !!w.win);
  }
  /**
   * Make `leaf` a lanes tab with the default layout, or, without one, a new tab in window `win` (default: the
   * active one): an empty tab there is reused, else a new tab joins the group of the window's most recent leaf.
   * `active`: make it the active tab (not for tabs the sweep converts in the background).
   */
  async newTab(leaf, win, active = true) {
    const target = leaf ?? this.emptyLeafIn(win ?? this.activeContainer()) ?? this.createTabIn(win);
    await target.setViewState({ type: VIEW_TYPE, active });
    const tab = target.view instanceof LanesView ? target.view : null;
    if (tab) this.touchTab(tab);
    return tab;
  }
  /** "New lanes tab" (ribbon, command): always a new tab in the active window. */
  async newLanesTab() {
    const tab = await this.newTab(this.createTabIn());
    if (tab) await this.app.workspace.revealLeaf(tab.leaf);
  }
  emptyLeafIn(win) {
    let found = null;
    this.app.workspace.iterateLeaves(win, (leaf) => {
      if (!found && this.isEmptyMainLeaf(leaf) && !this.routing.has(leaf)) found = leaf;
    });
    return found;
  }
  /** A new tab in window `win` (default: the active one), next to its most recent leaf. */
  createTabIn(win) {
    const ws = this.app.workspace;
    const root = win ?? this.activeContainer();
    const recent = ws.getMostRecentLeaf(root);
    const group = recent?.parent instanceof import_obsidian8.WorkspaceTabs ? recent.parent : void 0;
    return group ? ws.createLeafInTabGroup(group) : ws.getLeaf("tab");
  }
  laneOfLeaf(leaf) {
    if (!leaf) return null;
    if (leaf.view instanceof LanesView) return leaf.view.currentLane();
    return this.hostedLeaves.get(leaf)?.lane ?? null;
  }
  /** The lane commands act on: the active one, else the one opens go to. */
  currentLane() {
    return this.laneOfLeaf(this.activeCard()) ?? this.laneOfLeaf(this.app.workspace.activeLeaf) ?? this.targetLane();
  }
  /** The lanes tab commands act on: the active one, else the one opens go to. */
  currentTab() {
    return this.tabOf(this.app.workspace.activeLeaf) ?? this.targetLane()?.tab ?? null;
  }
  /**
   * Where an open that doesn't come from a lane goes: the last-used lane of the active lanes tab, else of the
   * most recently active lanes tab in the active window. Null if that window has none.
   */
  targetLane() {
    const act = this.tabOf(this.app.workspace.activeLeaf);
    if (act && this.inMainArea(act.leaf)) return act.currentLane();
    return this.recentTabIn(this.activeContainer())?.currentLane() ?? null;
  }
  /** Pick the lane for an open (making a lanes tab where needed). */
  async laneFor(where, from) {
    if (where === "same" && from) return from;
    if (where === "last" && from) return from.tab.lastUsedOtherThan(from);
    if (where === "next" && from) return wrapStep(from.tab.lanes, from, 1);
    if (where === "newTab") {
      const tab = await this.newTab(void 0, from ? from.tab.leaf.getContainer() : void 0);
      return tab?.lanes[0] ?? null;
    }
    return this.targetLane() ?? (await this.newTab())?.lanes[0] ?? null;
  }
  /** A card showing `file` in a lane other than `except`: in `except`'s tab first, then its window, then anywhere. */
  findCard(file, except) {
    const win = except.tab.leaf.getContainer();
    const rank = (l) => l.tab === except.tab ? 2 : l.tab.leaf.getContainer() === win ? 1 : 0;
    const lanes = this.tabs().flatMap((t) => t.lanes).filter((l) => l !== except).sort((a, b) => rank(b) - rank(a));
    for (const lane of lanes) {
      const item = lane.items.find((i) => i.file === file);
      if (item) return { lane, item };
    }
    return null;
  }
  /** Open `file` in a lane; false if there was no lane to open it in. */
  async openInLane(file, where, from = null, opts = {}) {
    const lane = await this.laneFor(where, from);
    if (!lane) return false;
    const dup = this.settings.duplicateMode;
    if (dup !== "copy" && !lane.items.some((i) => i.file === file)) {
      const other = this.findCard(file, lane);
      if (other && dup === "jump") {
        await other.lane.reveal(other.item);
        if (opts.eState && other.item.leaf) other.item.leaf.setEphemeralState(opts.eState);
        return true;
      }
      if (other) {
        if (opts.focus !== false) await this.app.workspace.revealLeaf(lane.tab.leaf);
        const index = insertIndex(lane.items, this.settings.newNotePosition, opts.after);
        await this.moveItem(other.lane, other.item, lane, index);
        const moved = lane.items.find((i) => i.file === file);
        if (opts.eState && moved?.leaf) moved.leaf.setEphemeralState(opts.eState);
        return true;
      }
    }
    if (opts.focus !== false) await this.app.workspace.revealLeaf(lane.tab.leaf);
    await lane.add(file, opts);
    return true;
  }
  /**
   * An exception (or a file that isn't a note) opened from a card or into a lanes tab: a normal tab right after the
   * lanes tab in its tab group, else wherever Obsidian puts a new tab.
   */
  async openBeside(tab, file, openState) {
    const ws = this.app.workspace;
    const group = tab.leaf.parent;
    const leaf = group instanceof import_obsidian8.WorkspaceTabs ? ws.createLeafInParent(group, group.children.indexOf(tab.leaf) + 1) : ws.getLeaf("tab");
    await leaf.openFile(file, { ...openState, active: true });
  }
  notePointerIn(lane) {
    this.lastLane = lane;
  }
  // ---------- moving notes between lanes ----------
  /** Move a card to `to` at `index` (counted without the card). Across lanes its editor reopens there. */
  async moveItem(from, it, to, index) {
    if (!from.items.includes(it)) return;
    if (from === to) {
      from.placeAt(it, index);
      return;
    }
    await to.insertTaken(from.take(it), index);
  }
  /** Move a card to the lane before / after its own in its tab's layout order, wrapping round at either end. */
  async moveToLane(from, it, step) {
    const to = wrapStep(from.tab.lanes, from, step);
    if (!to || to === from) return this.refuse("This lanes tab has only one lane");
    await this.moveItem(from, it, to, 0);
  }
  /** "Split" etc. on a lanes tab or a card: an empty lanes tab beside it (or in a new tab / window), same layout. */
  async emptyCopyOf(src, mode, dir) {
    const ws = this.app.workspace;
    const split = mode === "split" || mode === "vertical" || mode === "horizontal";
    const d = mode === "horizontal" || dir === "horizontal" ? "horizontal" : "vertical";
    const pane = mode === "window" && !this.canPopout() ? "tab" : mode;
    const leaf = split ? ws.createLeafBySplit(src.leaf, d) : ws.getLeaf(pane ?? "tab");
    const { layout, sizes } = src.getState();
    await leaf.setViewState({ type: VIEW_TYPE, active: true, state: { layout, sizes, lanes: [] } });
    if (leaf.view instanceof LanesView) this.touchTab(leaf.view);
    return leaf;
  }
  /** "Move to new window" on a card: it moves into the first lane of a new window's lanes tab, pin and all. */
  async cardToNewWindow(lane, it) {
    const tab = await this.newTab(this.canPopout() ? this.app.workspace.openPopoutLeaf() : this.createTabIn());
    if (tab?.lanes[0]) await this.moveItem(lane, it, tab.lanes[0], 0);
  }
  /** Popout windows exist: Obsidian for desktop, not emulating mobile (Platform.canPopoutWindow in app.js). */
  canPopout() {
    return import_obsidian8.Platform.isDesktopApp && !import_obsidian8.Platform.isMobile;
  }
  endItemDrag() {
    const d = this.dragItem;
    this.dragItem = null;
    d?.item.el.removeClass("is-lane-dragging");
    for (const t of this.allTabs()) for (const l of t.lanes) l.clearDrop();
  }
  // ---------- shift-click ----------
  /** The note a link was clicked in: a Backlinks Full View card, else the leaf's note. */
  sourcePathOf(el) {
    const card = el.closest("[data-bfv-path]");
    if (card) return card.getAttribute("data-bfv-path") ?? "";
    let path = "";
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!path && leaf.view instanceof import_obsidian8.FileView && leaf.view.containerEl.contains(el))
        path = leaf.view.file?.path ?? "";
    });
    return path;
  }
  onMouseDown(e) {
    this.lastInput = e.target;
    if (!e.shiftKey || e.button !== 0 || e.ctrlKey || e.metaKey) return;
    const el = asEl(e.target);
    if (!el) return;
    if (el.closest(".nav-files-container")) return;
    let link = null;
    const a = el.closest("a.internal-link, .internal-link[data-href]");
    if (a) {
      link = a.getAttribute("data-href") ?? a.getAttribute("href");
    } else if (el.closest(".cm-editor")) {
      this.app.workspace.iterateAllLeaves((leaf) => {
        if (link !== null || !leaf.view.containerEl.contains(el)) return;
        const view = leaf.view;
        if (!(view instanceof import_obsidian8.MarkdownView)) return;
        if (view.getState().source === true) {
          link = "";
          return;
        }
        const editor = view.editor;
        try {
          const pos = editor.posAtMouse?.(e);
          const tok = pos ? editor.getClickableTokenAt?.(pos) : null;
          if (tok?.type === "internal-link" && tok.text) link = tok.text;
        } catch {
        }
      });
    }
    if (!link) return;
    const dest = this.app.metadataCache.getFirstLinkpathDest((0, import_obsidian8.getLinkpath)(link), this.sourcePathOf(el));
    if (!(dest instanceof import_obsidian8.TFile) || dest.extension !== "md") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.swallow = { until: Date.now() + SWALLOW_MS, el };
    const from = this.allTabs().flatMap((t) => t.lanes).find((l) => l.el.contains(el));
    void this.openInLane(dest, e.altKey ? "newTab" : "last", from ?? null);
  }
};
