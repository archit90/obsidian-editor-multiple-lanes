// Lanes tab names ("Editor lane <name>"): the built-in list, picking a free one, and checking a typed one. No
// Obsidian imports, so it can be unit-tested.

/** Every lanes tab title starts with this; the tab's name follows it. */
export const TAB_TITLE_PREFIX = "Editor lane ";
/** The longest name "Rename lanes tab…" accepts. */
export const MAX_TAB_NAME = 40;

/**
 * Short, memorable fictional names, all public domain: Shakespeare, Arthurian legend, Greek and Norse myth,
 * folklore, fairy tales and 17th–19th-century novels. At most 8 letters, unique. Nothing from modern,
 * copyrighted franchises.
 */
export const TAB_NAMES: readonly string[] = [
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
  "Lupin",
];

/** A typed name tidied: whitespace runs (pasted line breaks too) become one space, ends trimmed. */
export function tidyTabName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Why `raw` (tidied) can't be a tab's name, or null if it can. */
export function tabNameError(raw: string): string | null {
  const name = tidyTabName(raw);
  if (!name) return "Enter a name";
  if (name.length > MAX_TAB_NAME) return `At most ${MAX_TAB_NAME} characters (this is ${name.length})`;
  return null;
}

/** A saved name if it's a valid one (tidied), else null. */
export function readTabName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return tabNameError(v) === null ? tidyTabName(v) : null;
}

/** Roman numerals for the suffix of names used up ("Ariel II"); `n` ≥ 1. */
export function roman(n: number): string {
  const parts: [number, string][] = [
    [1000, "M"],
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
    [1, "I"],
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

/**
 * A name for a new lanes tab: a random one of `names` that no other tab uses (`used`: other tabs' names, any
 * value; compared ignoring case). With every name taken, the same list with " II", then " III"… appended.
 * `random` returns a number in [0, 1), like Math.random.
 */
export function pickTabName(used: Iterable<unknown>, random: () => number = Math.random, names = TAB_NAMES): string {
  if (!names.length) return "Lanes";
  const taken = new Set<string>();
  for (const u of used) if (typeof u === "string") taken.add(u.toLowerCase());
  for (let round = 1; ; round++) {
    const suffix = round === 1 ? "" : ` ${roman(round)}`;
    const free = names.map(n => n + suffix).filter(n => !taken.has(n.toLowerCase()));
    if (free.length) {
      const i = Math.min(free.length - 1, Math.max(0, Math.floor(random() * free.length)));
      return free[i];
    }
  }
}
