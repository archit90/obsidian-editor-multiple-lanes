import { describe, expect, it } from "vitest";
import { fitLanes, readTabState, readView, savedTabName } from "./tab-state";

const d = (path: string, extra = {}) => ({ path, collapsed: false, ...extra });

describe("readTabState", () => {
  it("reads a saved tab", () => {
    const s = readTabState({
      layout: "50, 50x2",
      sizes: { for: "50, 50x2", cols: [40, 60], rows: [[100], [50, 50]] },
      lanes: [[d("a.md", { pinned: true, openedAt: 5 })], [], [d("b.md")]],
    });
    expect(s.layout).toBe("50, 50x2");
    expect(s.sizes?.cols).toEqual([40, 60]);
    expect(s.lanes).toEqual([[{ path: "a.md", collapsed: false, pinned: true, openedAt: 5 }], [], [d("b.md")]]);
  });
  it("tolerates nothing saved and bad values", () => {
    expect(readTabState(undefined)).toEqual({ name: null, layout: null, sizes: null, lanes: [] });
    const s = readTabState({ layout: "abc", sizes: { cols: [1] }, lanes: [[{ nope: 1 }, d("x.md")], "junk"] });
    expect(s.layout).toBeNull();
    expect(s.sizes).toBeNull();
    expect(s.lanes).toEqual([[d("x.md")], []]);
  });
});

describe("fitLanes", () => {
  it("pads with empty lanes", () => {
    expect(fitLanes([[d("a")]], 3)).toEqual([[d("a")], [], []]);
  });
  it("wraps the notes of extra lanes round, at the bottom, never losing one", () => {
    const out = fitLanes([[d("a")], [d("b")], [d("c")], [d("e")]], 2);
    expect(out.map(l => l.map(x => x.path))).toEqual([
      ["a", "c"],
      ["b", "e"],
    ]);
  });
  it("keeps a note once per lane, pinned if either copy was", () => {
    const out = fitLanes([[d("a")], [d("a", { pinned: true })]], 1);
    expect(out).toEqual([[{ path: "a", collapsed: false, pinned: true }]]);
  });
});

describe("tab names", () => {
  it("reads a saved name, tidied, ignoring invalid ones", () => {
    expect(readTabState({ name: "Puck" }).name).toBe("Puck");
    expect(readTabState({ name: "  My   tab " }).name).toBe("My tab");
    expect(readTabState({}).name).toBeNull();
    expect(readTabState({ name: "" }).name).toBeNull();
    expect(readTabState({ name: 7 }).name).toBeNull();
    expect(readTabState({ name: "z".repeat(41) }).name).toBeNull();
  });
  it("gives a 0.2 numbered tab no name (it gets a new one)", () => {
    expect(readTabState({ num: 3, lanes: [] }).name).toBeNull();
  });
  it("reads the name from a deferred tab's raw state", () => {
    expect(savedTabName({ name: "Nemo", lanes: [] })).toBe("Nemo");
    expect(savedTabName({ num: 2 })).toBeNull();
    expect(savedTabName(undefined)).toBeNull();
    expect(savedTabName("Nemo")).toBeNull();
  });
});

describe("saved view modes", () => {
  it("keeps a card's mode / source and drops anything else", () => {
    const s = readTabState({ lanes: [[{ path: "a.md", collapsed: false, view: { mode: "preview", source: true } }]] });
    expect(s.lanes[0][0].view).toEqual({ mode: "preview", source: true });
    expect(readView({ mode: "weird", source: "yes" })).toBeNull();
    expect(readView({ source: false })).toEqual({ source: false });
    expect(readView(null)).toBeNull();
  });
});
