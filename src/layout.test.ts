import { describe, expect, it } from "vitest";
import {
  describeLayout,
  effectiveShares,
  formatLayout,
  laneCount,
  mergeTarget,
  nearestIndex,
  PRESETS,
  parseLayout,
  planRelayout,
  resizePair,
  wrapStep,
} from "./layout";

const widths = (t: string) => {
  const p = parseLayout(t);
  if (!p.ok) throw new Error(p.error);
  return p.columns.map(c => [Math.round(c.width), c.rows]);
};

describe("parseLayout", () => {
  it("reads relative widths, normalised to percent", () => {
    expect(widths("40, 30, 30")).toEqual([
      [40, 1],
      [30, 1],
      [30, 1],
    ]);
    expect(widths("2,1")).toEqual([
      [67, 1],
      [33, 1],
    ]);
  });
  it("reads stacked lanes per column", () => {
    expect(widths("50, 50x2")).toEqual([
      [50, 1],
      [50, 2],
    ]);
    expect(widths("1 × 3; x2")).toEqual([
      [50, 3],
      [50, 2],
    ]);
    expect(widths("60*2")).toEqual([[100, 2]]);
  });
  it("explains what's wrong", () => {
    expect(parseLayout("").ok).toBe(false);
    expect(parseLayout("a, 3").ok).toBe(false);
    expect(parseLayout("0, 10").ok).toBe(false);
    expect(parseLayout("10x0").ok).toBe(false);
    expect(parseLayout("10x7").ok).toBe(false);
    expect(parseLayout("1,1,1,1,1,1,1,1,1").ok).toBe(false);
    const r = parseLayout("40, abc");
    expect(!r.ok && r.error).toContain("abc");
  });
  it("describes a layout and counts its lanes", () => {
    const p = parseLayout("40, 30x2, 30");
    if (!p.ok) throw new Error();
    expect(laneCount(p.columns)).toBe(4);
    expect(describeLayout(p.columns)).toBe("4 lanes: 40% | 30% (2 stacked) | 30%");
  });
});

describe("PRESETS", () => {
  it("are all valid layouts", () => {
    for (const p of PRESETS) expect(parseLayout(p.layout).ok, p.name).toBe(true);
  });
});

describe("mergeTarget", () => {
  it("keeps kept lanes and wraps the others round", () => {
    expect([0, 1, 2, 3, 4].map(i => mergeTarget(i, 2))).toEqual([0, 1, 0, 1, 0]);
    expect(mergeTarget(3, 0)).toBe(-1);
  });
});

describe("wrapStep", () => {
  const order = ["a", "b", "c"];
  it("goes right, and from the rightmost back to the leftmost", () => {
    expect(wrapStep(order, "a", 1)).toBe("b");
    expect(wrapStep(order, "c", 1)).toBe("a");
  });
  it("goes left, and from the leftmost round to the rightmost", () => {
    expect(wrapStep(order, "b", -1)).toBe("a");
    expect(wrapStep(order, "a", -1)).toBe("c");
  });
  it("handles one lane, none, or an unknown current lane", () => {
    expect(wrapStep(["a"], "a", 1)).toBe("a");
    expect(wrapStep([], "a", 1)).toBeNull();
    expect(wrapStep(order, "z", 1)).toBe("a");
  });
});

const cols = (t: string) => {
  const p = parseLayout(t);
  if (!p.ok) throw new Error(p.error);
  return p.columns;
};

describe("formatLayout", () => {
  it("writes a layout back in the settings syntax", () => {
    expect(formatLayout(cols("40, 30x2, 30"))).toBe("40, 30x2, 30");
    expect(formatLayout(cols("1, 1, 1"))).toBe("33, 33, 33");
    expect(parseLayout(formatLayout(cols("2, 1x3"))).ok).toBe(true);
  });
});

describe("planRelayout", () => {
  it("keeps lanes in order, adds empty ones and wraps the extra ones round", () => {
    expect(planRelayout(2, 3)).toEqual({ slots: [0, 1, null], merges: [] });
    expect(planRelayout(5, 2)).toEqual({
      slots: [0, 1],
      merges: [
        { from: 2, to: 0 },
        { from: 3, to: 1 },
        { from: 4, to: 0 },
      ],
    });
    expect(planRelayout(3, 3).merges).toEqual([]);
  });
});

describe("resizePair / effectiveShares", () => {
  it("moves the divider between two shares, keeping both above the minimum", () => {
    expect(resizePair([50, 50], 0, 10)).toEqual([60, 40]);
    expect(resizePair([50, 30, 20], 1, 100)).toEqual([50, 45, 5]);
    expect(resizePair([50, 50], 1, 10)).toEqual([50, 50]);
  });
  it("uses dragged sizes only for the layout they were made for", () => {
    const c = cols("50, 50x2");
    const sizes = { for: "50, 50x2", cols: [30, 70], rows: [[100], [20, 80]] };
    expect(effectiveShares(c, sizes)).toEqual({ cols: [30, 70], rows: [[100], [20, 80]] });
    expect(effectiveShares(cols("40, 60x2"), sizes).cols).toEqual([40, 60]);
    expect(effectiveShares(c, null).rows).toEqual([[100], [50, 50]]);
  });
});

describe("nearestIndex", () => {
  it("picks the lane whose start is nearest the scroll position", () => {
    expect(nearestIndex([0, 400, 800], 0)).toBe(0);
    expect(nearestIndex([0, 400, 800], 590)).toBe(1);
    expect(nearestIndex([0, 400, 800], 610)).toBe(2);
    expect(nearestIndex([0, 400, 800], 5000)).toBe(2);
  });
  it("is -1 without lanes", () => {
    expect(nearestIndex([], 10)).toBe(-1);
  });
});
