import { describe, expect, it } from "vitest";
import { accordionCollapse, insertIndex, overExpanded, overLimit } from "./tidy";

const item = (openedAt: number, collapsed = false, pinned = false) => ({ openedAt, collapsed, pinned });

describe("accordionCollapse", () => {
  it("collapses every other expanded note except pinned ones", () => {
    const a = item(1),
      b = item(2, true),
      c = item(3, false, true),
      d = item(4);
    expect(accordionCollapse([a, b, c, d], d)).toEqual([a]);
  });
});

describe("overExpanded", () => {
  it("collapses the least recently opened expanded notes beyond the limit", () => {
    const a = item(5),
      b = item(1),
      c = item(3),
      d = item(9);
    expect(overExpanded([a, b, c, d], 2, d)).toEqual([b, c]);
  });
  it("counts pinned notes but never collapses them, nor the one just opened", () => {
    const p = item(0, false, true),
      a = item(1),
      n = item(2);
    expect(overExpanded([p, a, n], 1, n)).toEqual([a]);
    expect(overExpanded([p, n], 1, n)).toEqual([]);
  });
  it("is off at 0 and within the limit", () => {
    expect(overExpanded([item(1), item(2)], 0, null)).toEqual([]);
    expect(overExpanded([item(1), item(2, true)], 1, null)).toEqual([]);
  });
});

describe("overLimit", () => {
  it("closes the oldest notes that aren't pinned", () => {
    const a = item(1, true),
      p = item(0, false, true),
      b = item(2),
      n = item(3);
    expect(overLimit([n, p, a, b], 2, n)).toEqual([a, b]);
    expect(overLimit([n, p, a, b], 3, n)).toEqual([a]);
  });
  it("is off at 0", () => {
    expect(overLimit([item(1), item(2)], 0, null)).toEqual([]);
  });
});

describe("insertIndex", () => {
  const list = ["a", "b", "c"];
  it("puts a note at the top, the bottom, or after its source", () => {
    expect(insertIndex(list, "top", null)).toBe(0);
    expect(insertIndex(list, "bottom", null)).toBe(3);
    expect(insertIndex(list, "after", "b")).toBe(2);
  });
  it("falls back to the top when the source isn't in the lane", () => {
    expect(insertIndex(list, "after", "z")).toBe(0);
    expect(insertIndex(list, "after", null)).toBe(0);
  });
});
