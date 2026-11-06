import { describe, expect, it } from "vitest";
import { stamp } from "./types";

describe("stamp", () => {
  it("strictly increases, even within one millisecond", () => {
    const a = Array.from({ length: 50 }, () => stamp());
    for (let i = 1; i < a.length; i++) expect(a[i]).toBeGreaterThan(a[i - 1]);
  });
});
