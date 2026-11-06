import { describe, expect, it } from "vitest";
import { locateText, scrollDelta } from "./card-scroll";

const view = { top: 100, bottom: 600 };

describe("scrollDelta", () => {
  it("start: the target's top just below the covered part", () => {
    expect(scrollDelta(view, { top: 900, bottom: 920 }, 40, "start", 8)).toBe(900 - 148);
    expect(scrollDelta(view, { top: 50, bottom: 70 }, 40, "start", 8)).toBe(50 - 148);
  });
  it("center: the middle of the target in the middle of the uncovered part", () => {
    expect(scrollDelta(view, { top: 1000, bottom: 1020 }, 100, "center")).toBe(1010 - 400);
    expect(scrollDelta(view, { top: 390, bottom: 410 }, 100, "center")).toBe(0);
  });
  it("nearest: nothing when fully shown", () => {
    expect(scrollDelta(view, { top: 200, bottom: 300 }, 40)).toBe(0);
  });
  it("nearest: up to below the covered part, or down to the bottom edge", () => {
    expect(scrollDelta(view, { top: 120, bottom: 140 }, 40, "nearest", 8)).toBe(120 - 148);
    expect(scrollDelta(view, { top: 700, bottom: 720 }, 40, "nearest", 8)).toBe(720 - 592);
  });
  it("nearest: a target taller than the view goes to the start", () => {
    expect(scrollDelta(view, { top: 700, bottom: 2000 }, 40, "nearest", 8)).toBe(700 - 148);
  });
  it("a negative inset counts as none", () => {
    expect(scrollDelta(view, { top: 300, bottom: 310 }, -20, "start", 0)).toBe(200);
  });
});

describe("locateText", () => {
  it("finds both ends across text nodes", () => {
    expect(locateText(["Hello ", "wor", "ld"], 6, 11)).toEqual({ from: [1, 0], to: [2, 2] });
    expect(locateText(["abc"], 1, 2)).toEqual({ from: [0, 1], to: [0, 2] });
  });
  it("an end on a node boundary stays in the earlier node", () => {
    expect(locateText(["ab", "cd"], 0, 2)).toEqual({ from: [0, 0], to: [0, 2] });
  });
  it("out of range: null", () => {
    expect(locateText(["ab"], 1, 5)).toBeNull();
    expect(locateText([], 0, 0)).toBeNull();
  });
});
