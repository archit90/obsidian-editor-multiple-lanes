import { describe, expect, it } from "vitest";
import { asRecord, stamp } from "./types";

describe("stamp", () => {
  it("strictly increases, even within one millisecond", () => {
    const a = Array.from({ length: 50 }, () => stamp());
    for (let i = 1; i < a.length; i++) expect(a[i]).toBeGreaterThan(a[i - 1]);
  });
});

describe("asRecord", () => {
  it("passes plain objects and drops everything else", () => {
    expect(asRecord({ rename: "all" })).toEqual({ rename: "all" });
    for (const v of [null, undefined, 1, "x", [1], true]) expect(asRecord(v)).toBeUndefined();
  });
});
