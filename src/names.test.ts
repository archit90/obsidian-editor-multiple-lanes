import { describe, expect, it } from "vitest";
import { noteNameError, tidyName } from "./names";

describe("noteNameError", () => {
  it("accepts ordinary names", () => {
    expect(noteNameError("Project plan v2", "old", true)).toBeNull();
    expect(noteNameError("café – notes", "old", true)).toBeNull();
  });
  it.each(["a/b", "a\\b", "a:b", "a#b", "a^b", "a[b", "a]b", "a|b", "a*b", 'a"b', "a<b", "a>b", "a?b"])(
    "refuses %s",
    name => {
      expect(noteNameError(name, "old", true)).toMatch(/can't contain/);
    },
  );
  it("refuses dot names and a .md extension", () => {
    expect(noteNameError(".hidden", "old", true)).toMatch(/dot/);
    expect(noteNameError("plan.MD", "old", true)).toMatch(/extension/);
  });
  it("keeps a YYYY-MM-DD-HHmmss date-time prefix, in any folder, when the setting is on", () => {
    const log = "2026-11-06-053000 standup";
    expect(noteNameError("standup", log, true)).toMatch(/date-time prefix/);
    expect(noteNameError("2026-11-06-053000 retro", log, true)).toBeNull();
    expect(noteNameError("2026-11-07-120000", log, true)).toBeNull(); // another date-time is still one
    expect(noteNameError("anything", "not a log", true)).toBeNull(); // only names that start with one
    expect(noteNameError("2026-11-06 standup", log, true)).toMatch(/prefix/); // a date alone isn't the prefix
  });
  it("lets a date-time prefix go when the setting is off", () => {
    expect(noteNameError("standup", "2026-11-06-053000 standup", false)).toBeNull();
  });
});

describe("tidyName", () => {
  it("collapses whitespace and line breaks and trims", () => {
    expect(tidyName("  a \n b\t c  ")).toBe("a b c");
  });
});
