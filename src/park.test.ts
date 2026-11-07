import { describe, expect, it } from "vitest";
import { PARK_MS, isFar, parkDistance, parkStep } from "./park";

describe("parkDistance", () => {
  it("is several lane heights, and well beyond the pre-load distance", () => {
    expect(parkDistance(800, 300)).toBe(2400);
    expect(parkDistance(800, 3000)).toBe(4600);
  });
});

describe("isFar", () => {
  const view = { top: 100, bottom: 900 };
  it("is true only for a card entirely beyond the distance, above or below", () => {
    expect(isFar(view, { top: 3000, bottom: 4000 }, 2000)).toBe(true);
    expect(isFar(view, { top: -5000, bottom: -1950 }, 2000)).toBe(true);
    expect(isFar(view, { top: 2800, bottom: 4000 }, 2000)).toBe(false);
    expect(isFar(view, { top: -5000, bottom: 500 }, 2000)).toBe(false); // a long card reaching into view
  });
});

describe("parkStep", () => {
  it("parks a card only after it has been far for PARK_MS", () => {
    const a = parkStep(undefined, true, false, 1000);
    expect(a).toEqual({ since: 1000, park: false });
    expect(parkStep(1000, true, false, 1000 + PARK_MS - 1).park).toBe(false);
    expect(parkStep(1000, true, false, 1000 + PARK_MS)).toEqual({ since: 1000, park: true });
  });
  it("starts over when the card comes near or must stay (focused, active, unsaved, dragged)", () => {
    expect(parkStep(1000, false, false, 99999)).toEqual({ since: null, park: false });
    expect(parkStep(1000, true, true, 99999)).toEqual({ since: null, park: false });
  });
});
