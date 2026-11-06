import { describe, expect, it } from "vitest";
import { noteNameError, tidyName } from "./names";

describe("noteNameError", () => {
  it("accepts ordinary names", () => {
    expect(noteNameError("Project plan v2", "old", "x")).toBeNull();
    expect(noteNameError("café – notes", "old", "")).toBeNull();
  });
  it.each(["a/b", "a\\b", "a:b", "a#b", "a^b", "a[b", "a]b", "a|b", "a*b", 'a"b', "a<b", "a>b", "a?b"])(
    "refuses %s",
    name => {
      expect(noteNameError(name, "old", "x")).toMatch(/can't contain/);
    },
  );
  it("refuses dot names and a .md extension", () => {
    expect(noteNameError(".hidden", "old", "x")).toMatch(/dot/);
    expect(noteNameError("plan.MD", "old", "x")).toMatch(/extension/);
  });
  it("makes logs in folder 0 keep their timestamp prefix", () => {
    const log = "2026-11-06-053000 standup";
    expect(noteNameError("standup", log, "0")).toMatch(/prefix/);
    expect(noteNameError("2026-11-06-053000 retro", log, "0")).toBeNull();
    expect(noteNameError("standup", log, "x")).toBeNull(); // other folders: no rule
    expect(noteNameError("anything", "not a log", "0")).toBeNull();
  });
});

describe("tidyName", () => {
  it("collapses whitespace and line breaks and trims", () => {
    expect(tidyName("  a \n b\t c  ")).toBe("a b c");
  });
});
