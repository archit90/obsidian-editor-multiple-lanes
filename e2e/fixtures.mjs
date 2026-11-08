// The e2e suite's own notes and files: their names (what the cases assert on) and their content, made the same way
// on every run. e2e/make-vault.mjs writes them into a sandbox vault before Obsidian starts; the runner puts the
// notes the cases edit back before every case (T.restoreFixtures in helpers.js). Every name is unique, so the
// fixtures also work in a copy of another vault (OBS_VAULT, e.g. a big test vault): nothing else is touched there.

/** Every fixture lives in this folder. */
export const DIR = "lanes-e2e";
const note = title => ({ title, path: `${DIR}/${title}.md`, folder: DIR });

/** The notes the cases open into lanes (A–D) and the notes A links to. */
export const NOTES = {
  A: note("EL Alpha"),
  B: note("EL Bravo"),
  C: note("EL Charlie"),
  D: note("EL Delta"),
  /** A's first link; it links on to L2 (a hover popover over A shows a link that isn't A). */
  L1: note("EL Link one"),
  /** A's second link; it links back to A (a backlink, for Backlinks Full View under A's card). */
  L2: note("EL Link two"),
  L3: note("EL Link three"),
  L4: note("EL Link four"),
  /** Dropped onto a lane as an obsidian:// URL. */
  DROP: note("EL Drop target"),
  /** The only note with SEARCH_WORD in it. */
  SEARCH: note("EL Search target"),
  /** An exception in some cases ("README" matches any README.md). */
  README: { title: "README", path: `${DIR}/README.md`, folder: DIR },
  /** A long list-and-headings note (LONG below). */
  LONG: note("EL Long note"),
  /** A name with a date-time prefix ("Keep a date-time prefix when renaming"). */
  STAMPED: note("2026-11-06-053000 EL standup"),
  /** Opened in the restart cases (e2e/restart.mjs). */
  RESTART: note("EL Restart"),
};
export const SEARCH_WORD = "quillwort";

/** Non-note files: a lanes tab never replaces itself with these; they open beside it. */
export const FILES = {
  PDF: `${DIR}/EL kitchen quote.pdf`,
  PNG: `${DIR}/EL sketch.png`,
  CANVAS: `${DIR}/EL board.canvas`,
  BASE: `${DIR}/EL review.base`,
};

/** Bulk notes: MANY (realistic length, for lazy mounting and far-away cards), PEOPLE (short). */
export const MANY = { folder: `${DIR}/many`, count: 125, title: i => `EL Many ${String(i).padStart(3, "0")}` };
export const PEOPLE = { folder: `${DIR}/people`, count: 55, title: i => `EL Person ${String(i).padStart(2, "0")}` };

/** Headings and words in LONG the cases use. */
export const LONG = {
  /** NE-08 links here. */
  linkHeading: "C4. Folded item above",
  /** NE-09 clicks this in the Outline view. */
  outlineHeading: "B2. Enter splits an item",
  /** PK-02 folds this heading (the line starting with it). */
  foldHeading: "## Stage B",
  /** On 8 lines spread over the note (in-note search). */
  searchWord: "Escape",
  /** On most list lines, but not in the first 20 lines (a capped card has to scroll to its matches). */
  itemWord: "item",
};

/** For Templater (together runs): its templates folder and a template named "zettel". */
export const TEMPLATES = { folder: `${DIR}/templates`, zettel: `${DIR}/templates/EL zettel.md` };

// ---------- content ----------

const frontmatter = created => `---\ntype: zettel\ncreated: ${created}\n---\n`;

/** Paragraphs separated by a blank line, after frontmatter: in Live Preview `.cm-line` 1, 3, 5 are the paragraphs. */
const zettel = (created, ...paragraphs) => `${frontmatter(created)}\n${paragraphs.join("\n\n")}\n`;

const A_TEXT = zettel(
  "2024-11-20T14:23:36",
  `Really example trade-off tell merge less less late [[${NOTES.L1.title}]] bad. [[${NOTES.L2.title}]] file reason although still late index query test maybe service call signal of week hard. Clear step [[${NOTES.L3.title}]] build old draft review. Draft hard keep very test while quite chat client bad service reason note page.`,
  `Call cost client answer even or problem read check page schema doc meeting rarely easy reason without. Pull bug easy new [[${NOTES.L4.title}]] check late review week even. Review early large bug cache build maybe ask cost pattern meeting system step think for call good. On in then yesterday evening draft not large maybe also cache quarter of evening result.`,
  `User or slow when file to pull example messy cost quite late note to. Team in fix tell evening hard week even bad before then. After reason still write fast value so because just ship cost messy to. Just quite plan often very team service. Month noise value just often index pattern with really read.`,
);
const B_TEXT = zettel(
  "2025-06-16T14:34:33",
  `Week doc quarter even although idea index client hard value never today email very because. Noise always slow queue reason file check just the pattern. Chat also queue more and quarter trade-off. Old so large an small cost question try file slow. Or then file when push trade-off read ask today cost more in before more service today.`,
  `Morning when question service of data although query cache service queue not user more meeting slow build without. Data pattern tomorrow question think morning task and change cache risk think goal chat. Old the yesterday evening system without even note and meeting pull for plan.`,
);
const C_TEXT = zettel(
  "2025-06-24T05:37:49",
  `Spec goal before ask cache slow bad and sync fix client problem slow stop chat bad idea. Team so fix example new step data of while tomorrow test think show index system result think and. The slow call hard chat still read file build pattern even team today stop data an goal. In rarely with task goal review ship and stop pattern.`,
  `Or think slow but note small review index but write noise move even an. Pull to often stop keep job move build fast easy bug build pattern job test idea often fix. Only job even old very or keep noise change change ship problem although a review. Quite quite easy idea read file service maybe never more not without service always review data.`,
  `Less and a team chat push messy still doc problem start today quite so step or. When idea clear but risk a spec page question stop morning draft ship. Still try pattern ask meeting or today bad messy call. For the trade-off cost maybe new reason hard just client maybe move when so.`,
);
const D_TEXT = zettel(
  "2026-09-20T14:01:51",
  `To sync a late good very messy value. New because index answer service queue today example signal team system yesterday write morning after. Check tomorrow sync read fix an email a before new schema show write spec. Schema tomorrow week of although never cost note.`,
  `On of hard answer noise test build. Usually early query on move reason quarter evening week for after value reason answer email show. And bug without fast always file tell good large change trade-off messy an trade-off email.`,
);

/** A long note: a heading, 20 lines of text, then four stages of ten sections of list items (about 470 lines). */
function longText() {
  const lines = ["# EL Long note", ""];
  for (let i = 2; i < 20; i++) lines.push(`Line ${i} of the long note, plain text for scrolling tests.`);
  lines.push("");
  const titles = {
    A2: "A2. Second steps",
    B2: LONG.outlineHeading,
    C4: LONG.linkHeading,
  };
  for (const stage of ["A", "B", "C", "D"]) {
    lines.push(`## Stage ${stage}: list sections`, "");
    for (let s = 1; s <= 10; s++) {
      const key = `${stage}${s}`;
      lines.push(`### ${titles[key] ?? `${key}. Section ${key}`}`, "");
      for (let i = 1; i <= 8; i++) {
        const words = s === 3 || s === 8 ? (i === 4 ? `press ${LONG.searchWord} to stop` : "keep going") : "and so on";
        lines.push(`- ${LONG.itemWord} ${key}.${i}: ${words}, then the next line`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

// deterministic filler text: a fixed word list and a seeded generator
const WORDS = (
  "time plan note page draft review cache build ship team chat client service queue index query test signal " +
  "week month quarter morning evening today tomorrow yesterday reason value cost risk idea goal spec data " +
  "schema pattern system step change fix bug job task file doc email meeting question answer noise sync"
).split(" ");
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sentence(r, n) {
  const w = Array.from({ length: n }, () => WORDS[Math.floor(r() * WORDS.length)]);
  return w[0][0].toUpperCase() + w[0].slice(1) + " " + w.slice(1).join(" ") + ".";
}
function paragraph(r, sentences, links = []) {
  const out = Array.from({ length: sentences }, () => sentence(r, 8 + Math.floor(r() * 8)));
  links.forEach((l, i) => (out[Math.min(i + 1, out.length - 1)] += ` See [[${l}]].`));
  return out.join(" ");
}
function manyText(i) {
  const r = rng(1000 + i);
  const a = MANY.title(((i * 7) % MANY.count) + 1);
  const b = MANY.title(((i * 13) % MANY.count) + 1);
  return zettel(
    `2025-01-01T00:00:${String(i % 60).padStart(2, "0")}`,
    paragraph(r, 5, [a]),
    paragraph(r, 5, [b]),
    paragraph(r, 4),
  );
}
function personText(i) {
  const r = rng(5000 + i);
  return `Person ${i}. ${paragraph(r, 3)}\n`;
}

/** A valid one-page PDF (pdf.js logs errors for a broken one), with a correct cross-reference table. */
export function pdfBytes() {
  const content = "BT /F1 18 Tf 20 100 Td (Kitchen quote) Tj ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
export const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/**
 * The notes the cases open and edit, with their content: the runner restores these before every case, so a case
 * that failed half-way doesn't change what the next one sees.
 */
export function coreNotes() {
  return {
    [NOTES.A.path]: A_TEXT,
    [NOTES.B.path]: B_TEXT,
    [NOTES.C.path]: C_TEXT,
    [NOTES.D.path]: D_TEXT,
    [NOTES.L1.path]: `${NOTES.L1.title}: a note A links to. It links on to [[${NOTES.L2.title}]].\n`,
    [NOTES.L2.path]: `${NOTES.L2.title}: a note A links to, and it links back to [[${NOTES.A.title}]].\n`,
    [NOTES.L3.path]: `${NOTES.L3.title}: a note A links to.\n`,
    [NOTES.L4.path]: `${NOTES.L4.title}: a note A links to.\n`,
    [NOTES.DROP.path]: `${NOTES.DROP.title}: dropped onto a lane as an obsidian:// URL.\n`,
    [NOTES.SEARCH.path]: `${NOTES.SEARCH.title}: the only note with the word ${SEARCH_WORD} in it.\n`,
    [NOTES.README.path]: `# Editor Multiple Lanes e2e fixtures\n\nNotes and files the end-to-end suite works with.\n`,
    [NOTES.LONG.path]: longText(),
    [NOTES.STAMPED.path]: "A note whose name starts with a date-time.\n",
    [NOTES.RESTART.path]: "Opened in the restart cases.\n",
  };
}

/** Every file make-vault.mjs writes (path → string or Buffer), notes and bulk notes and the other files. */
export function allFiles() {
  const files = { ...coreNotes() };
  for (let i = 1; i <= MANY.count; i++) files[`${MANY.folder}/${MANY.title(i)}.md`] = manyText(i);
  for (let i = 1; i <= PEOPLE.count; i++) files[`${PEOPLE.folder}/${PEOPLE.title(i)}.md`] = personText(i);
  files[FILES.PDF] = pdfBytes();
  files[FILES.PNG] = Buffer.from(PNG_BASE64, "base64");
  files[FILES.CANVAS] = JSON.stringify({ nodes: [], edges: [] });
  files[FILES.BASE] = "views:\n  - type: table\n    name: Table\n";
  return files;
}

/** The Templater template the together cases pick ("zettel"). */
export const ZETTEL_TEMPLATE = `---\ntype: zettel\ncreated: <% tp.date.now("YYYY-MM-DDTHH:mm") %>\n---\n<% tp.file.cursor() %>\n`;
