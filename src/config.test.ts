import { describe, expect, it } from "vitest";
import { DEFAULTS, loadSettings, migrateSettings, parseCount } from "./config";
import { parseLayout } from "./layout";

describe("loadSettings", () => {
  it("gives the defaults for nothing saved", () => {
    expect(loadSettings(null)).toEqual(DEFAULTS);
    expect(loadSettings(undefined)).toEqual(DEFAULTS);
    expect(loadSettings("junk")).toEqual(DEFAULTS);
  });
  it("keeps an older file's settings and fills in the new ones", () => {
    const s = loadSettings({ lanesOnly: false });
    expect(s.lanesOnly).toBe(false);
    expect(s.linkTarget).toBe("next");
    expect(s.preloadDistance).toBe(300);
  });
  it("falls back to the default for a value of the wrong type or out of range", () => {
    const s = loadSettings({
      linkTarget: "sideways",
      maxNotesPerLane: -3,
      preloadDistance: "120",
      showFolder: "yes",
      defaultLayout: 5,
      noteMaxHeight: 12.5,
    });
    expect(s.linkTarget).toBe("next");
    expect(s.maxNotesPerLane).toBe(0);
    expect(s.preloadDistance).toBe(120); // a number as text is fine
    expect(s.showFolder).toBe(true);
    expect(s.defaultLayout).toBe(DEFAULTS.defaultLayout);
    expect(s.noteMaxHeight).toBe(DEFAULTS.noteMaxHeight);
  });
  it("drops unknown keys", () => {
    expect("old" in loadSettings({ old: 1 })).toBe(false);
  });
  it("drops the removed Navigator tab's settings", () => {
    const s = loadSettings({ navigatorTab: false, navigatorClosed: true, lanesOnly: false });
    expect("navigatorTab" in s).toBe(false);
    expect("navigatorClosed" in s).toBe(false);
    expect(s.lanesOnly).toBe(false);
  });
  it("has a valid default layout", () => {
    expect(parseLayout(DEFAULTS.defaultLayout).ok).toBe(true);
  });
  it("doesn't share state with DEFAULTS", () => {
    const s = loadSettings({});
    s.maxNotesPerLane = 4;
    expect(DEFAULTS.maxNotesPerLane).toBe(0);
  });
});

describe("migrateSettings", () => {
  it("turns the old locked layout into the default layout and drops lockLayout and maxLanes", () => {
    const s = loadSettings({ lockLayout: true, layout: "50, 50,50", maxLanes: 3 });
    expect(s.defaultLayout).toBe("50, 50,50");
    expect("lockLayout" in s).toBe(false);
    expect("maxLanes" in s).toBe(false);
    expect("layout" in s).toBe(false);
  });
  it("prefers an already-migrated default layout and doesn't touch the saved object", () => {
    const saved = { layout: "1", defaultLayout: "2, 1" };
    expect(loadSettings(saved).defaultLayout).toBe("2, 1");
    expect(saved.layout).toBe("1");
    expect(migrateSettings(null)).toEqual({});
  });
});

describe("parseCount", () => {
  it("accepts whole numbers in range, as numbers or text", () => {
    expect(parseCount(3, [0, 5])).toBe(3);
    expect(parseCount(" 5 ", [0, 5])).toBe(5);
  });
  it("refuses anything else", () => {
    expect(parseCount("", [0, 5])).toBeNull();
    expect(parseCount("abc", [0, 5])).toBeNull();
    expect(parseCount(1.5, [0, 5])).toBeNull();
    expect(parseCount(6, [0, 5])).toBeNull();
    expect(parseCount(NaN, [0, 5])).toBeNull();
  });
});
