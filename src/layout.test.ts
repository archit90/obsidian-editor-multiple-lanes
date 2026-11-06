import { describe, expect, it } from "vitest";
import {
  describeLayout,
  effectiveShares,
  firstLaneOf,
  formatLayout,
  insertLane,
  laneCount,
  mergeTarget,
  PRESETS,
  parseLayout,
  planInsert,
  planRelayout,
  planRemove,
  removeLane,
  resizePair,
  shareWithTarget,
  slotOf,
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

describe("shareWithTarget", () => {
  const round = (a: number[]) => a.map(x => Math.round(x));
  it("gives the new child its width and scales the others", () => {
    expect(round(shareWithTarget([500, 250, 250], 2, 500))).toEqual([33, 17, 50]);
  });
  it("keeps every child at least `min` wide where it can", () => {
    expect(round(shareWithTarget([500, 500], 1, 990, 100))).toEqual([10, 90]);
    expect(round(shareWithTarget([500, 500], 1, 10, 100))).toEqual([90, 10]);
  });
  it("adds up to 100", () => {
    const s = shareWithTarget([300, 200, 100, 400], 1, 350);
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });
  it("splits evenly when there's nothing to measure", () => {
    expect(shareWithTarget([0, 0], 0, 300)).toEqual([50, 50]);
    expect(shareWithTarget([400], 0, 300)).toEqual([100]);
  });
});

const cols = (t: string) => {
  const p = parseLayout(t);
  if (!p.ok) throw new Error(p.error);
  return p.columns;
};

describe("formatLayout / slotOf / firstLaneOf", () => {
  it("writes a layout back in the settings syntax", () => {
    expect(formatLayout(cols("40, 30x2, 30"))).toBe("40, 30x2, 30");
    expect(formatLayout(cols("1, 1, 1"))).toBe("33, 33, 33");
    expect(parseLayout(formatLayout(cols("2, 1x3"))).ok).toBe(true);
  });
  it("numbers lanes by column, top to bottom", () => {
    const c = cols("40, 30x2, 30");
    expect([0, 1, 2, 3].map(i => slotOf(c, i))).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 2, row: 0 },
    ]);
    expect(slotOf(c, 4)).toBeNull();
    expect(firstLaneOf(c, 2)).toBe(3);
  });
});

describe("planRelayout / planInsert / planRemove", () => {
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
  it("inserts an empty lane where asked", () => {
    expect(planInsert(3, 1).slots).toEqual([0, null, 1, 2]);
    expect(planInsert(2, 2).slots).toEqual([0, 1, null]);
  });
  it("removes a lane, handing its notes to the lane before it", () => {
    expect(planRemove(3, 1)).toEqual({ slots: [0, 2], merges: [{ from: 1, to: 0 }] });
    expect(planRemove(3, 0)).toEqual({ slots: [1, 2], merges: [{ from: 0, to: 0 }] });
    expect(planRemove(1, 0)).toEqual({ slots: [0], merges: [] });
  });
});

describe("insertLane / removeLane", () => {
  it("adds a column beside a lane, halving its column", () => {
    const r = insertLane(cols("50, 50"), 1, "right");
    expect(r && formatLayout(r.columns)).toBe("50, 25, 25");
    expect(r?.index).toBe(2);
    const l = insertLane(cols("50, 50x2"), 2, "left");
    expect(l && formatLayout(l.columns)).toBe("50, 25, 25x2");
    expect(l?.index).toBe(1);
  });
  it("stacks a lane above or below", () => {
    const d = insertLane(cols("50, 50"), 0, "down");
    expect(d && formatLayout(d.columns)).toBe("50x2, 50");
    expect(d?.index).toBe(1);
    expect(insertLane(cols("50, 50"), 1, "up")?.index).toBe(1);
  });
  it("refuses past the limits or for a lane that isn't there", () => {
    expect(insertLane(cols("1,1,1,1,1,1,1,1"), 0, "right")).toBeNull();
    expect(insertLane(cols("x6"), 0, "down")).toBeNull();
    expect(insertLane(cols("50"), 3, "down")).toBeNull();
  });
  it("removes a lane, its column going when it's the last in it", () => {
    expect(formatLayout(removeLane(cols("50, 50x2"), 1)!)).toBe("50, 50");
    expect(formatLayout(removeLane(cols("50, 25, 25"), 0)!)).toBe("50, 50");
    expect(removeLane(cols("100"), 0)).toBeNull();
  });
});

describe("resizePair / effectiveShares", () => {
  it("moves the divider between two shares, keeping both above the minimum", () => {
    expect(resizePair([50, 50], 0, 10)).toEqual([60, 40]);
    expect(resizePair([50, 30, 20], 1, 100)).toEqual([50, 45, 5]);
    expect(resizePair([50, 50], 1, 10)).toEqual([50, 50]);
  });
  it("uses dragged sizes only for the layout they were made for, and not while locked", () => {
    const c = cols("50, 50x2");
    const sizes = { for: "50, 50x2", cols: [30, 70], rows: [[100], [20, 80]] };
    expect(effectiveShares(c, sizes, false)).toEqual({ cols: [30, 70], rows: [[100], [20, 80]] });
    expect(effectiveShares(c, sizes, true)).toEqual({ cols: [50, 50], rows: [[100], [50, 50]] });
    expect(effectiveShares(cols("40, 60x2"), sizes, false).cols).toEqual([40, 60]);
    expect(effectiveShares(c, null, false).rows).toEqual([[100], [50, 50]]);
  });
});
