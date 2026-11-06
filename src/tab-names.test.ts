import { describe, expect, it } from "vitest";
import { MAX_TAB_NAME, TAB_NAMES, pickTabName, readTabName, roman, tabNameError, tidyTabName } from "./tab-names";

describe("the name list", () => {
  it("has about 150 short, unique, single-word names", () => {
    expect(TAB_NAMES.length).toBeGreaterThanOrEqual(140);
    expect(new Set(TAB_NAMES.map(n => n.toLowerCase())).size).toBe(TAB_NAMES.length);
    for (const n of TAB_NAMES) expect(n).toMatch(/^[A-Z][a-z]{1,7}$/);
  });
});

describe("pickTabName", () => {
  it("picks among the names nobody uses, ignoring case", () => {
    const names = ["Ariel", "Puck", "Nemo"];
    expect(pickTabName(["ariel", "Nemo"], () => 0.99, names)).toBe("Puck");
    expect(pickTabName([], () => 0, names)).toBe("Ariel");
    expect(pickTabName([], () => 0.999999, names)).toBe("Nemo");
  });
  it("spreads picks over the free names with the random source", () => {
    const names = ["A", "B", "C", "D"];
    expect(pickTabName(["B"], () => 0.5, names)).toBe("C"); // free: A, C, D
  });
  it("ignores used values that aren't strings", () => {
    expect(pickTabName([null, undefined, 3, {}], () => 0, ["Ariel"])).toBe("Ariel");
  });
  it("appends II, III… once every name is taken", () => {
    const names = ["Ariel", "Puck"];
    expect(pickTabName(["Ariel", "Puck"], () => 0, names)).toBe("Ariel II");
    expect(pickTabName(["Ariel", "Puck", "Ariel II"], () => 0, names)).toBe("Puck II");
    expect(pickTabName(["Ariel", "Puck", "ariel ii", "Puck II"], () => 0.7, names)).toBe("Puck III");
  });
  it("never returns a used name from the real list", () => {
    const used = TAB_NAMES.slice(1);
    expect(pickTabName(used, Math.random)).toBe(TAB_NAMES[0]);
  });
  it("survives a random source outside [0, 1)", () => {
    expect(pickTabName([], () => 1, ["A", "B"])).toBe("B");
    expect(pickTabName([], () => -1, ["A", "B"])).toBe("A");
  });
});

describe("roman", () => {
  it("writes numerals", () => {
    expect([1, 2, 3, 4, 9, 14, 40, 1994].map(roman)).toEqual(["I", "II", "III", "IV", "IX", "XIV", "XL", "MCMXCIV"]);
  });
});

describe("custom names", () => {
  it("tidies whitespace", () => {
    expect(tidyTabName("  Research \n notes ")).toBe("Research notes");
  });
  it("refuses empty and too-long names", () => {
    expect(tabNameError("   ")).toBe("Enter a name");
    expect(tabNameError("x".repeat(MAX_TAB_NAME))).toBeNull();
    expect(tabNameError("x".repeat(MAX_TAB_NAME + 1))).toMatch(/At most 40/);
    expect(tabNameError(`  ${"x".repeat(MAX_TAB_NAME)}  `)).toBeNull(); // counted after trimming
  });
  it("reads a saved name only if it's valid", () => {
    expect(readTabName(" Puck ")).toBe("Puck");
    expect(readTabName("")).toBeNull();
    expect(readTabName(5)).toBeNull();
    expect(readTabName("y".repeat(41))).toBeNull();
  });
});
