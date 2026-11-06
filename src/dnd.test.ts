import { describe, expect, it } from "vitest";
import { clampIn, linkpathsInText, pickDropEffect } from "./dnd";

describe("pickDropEffect", () => {
  it("takes the first preference when the source allows anything", () => {
    expect(pickDropEffect("all", ["link", "copy"])).toBe("link");
    expect(pickDropEffect("uninitialized", ["move"])).toBe("move");
    expect(pickDropEffect(undefined, ["copy"])).toBe("copy");
  });
  it("falls back to an effect the source allows (an editor text drag allows copy / move only)", () => {
    expect(pickDropEffect("copyMove", ["link", "copy", "move"])).toBe("copy");
    expect(pickDropEffect("linkMove", ["move", "link"])).toBe("move");
    expect(pickDropEffect("link", ["copy", "link"])).toBe("link");
  });
  it("gives nothing when no preference is allowed", () => {
    expect(pickDropEffect("copy", ["link", "move"])).toBeNull();
    expect(pickDropEffect("none", ["link"])).toBeNull();
  });
});

describe("clampIn", () => {
  const p = (pinned: boolean) => ({ pinned });
  const list = [p(true), p(true), p(false), p(false)];
  it("keeps pinned notes within the pinned block at the top", () => {
    expect(clampIn(list, true, 0)).toBe(0);
    expect(clampIn(list, true, 3)).toBe(2);
    expect(clampIn(list, true, -5)).toBe(0);
  });
  it("keeps other notes below the pinned block", () => {
    expect(clampIn(list, false, 0)).toBe(2);
    expect(clampIn(list, false, 3)).toBe(3);
    expect(clampIn(list, false, 99)).toBe(4);
  });
  it("works for an empty lane", () => {
    expect(clampIn([], false, 3)).toBe(0);
    expect(clampIn([], true, 3)).toBe(0);
  });
});

describe("linkpathsInText", () => {
  it("reads the file of an obsidian://open URL", () => {
    expect(linkpathsInText("obsidian://open?vault=v&file=x%2Fnotes%2FPlan")).toEqual(["x/notes/Plan"]);
  });
  it("reads every wikilink, without heading, block or alias", () => {
    expect(linkpathsInText("see [[a/b|B]] and ![[c#Goals]] or [[d^blk]]")).toEqual(["a/b", "c", "d"]);
  });
  it("reads markdown links to notes, decoding them", () => {
    expect(linkpathsInText("[Plan](x/My%20Plan.md#Goals) [web](https://e.com)")).toEqual(["x/My Plan.md"]);
    expect(linkpathsInText("[Plan](<x/My Plan.md>)")).toEqual(["x/My Plan.md"]);
  });
  it("takes a plain line as a note name, one per line", () => {
    expect(linkpathsInText("Plan\n\n  x/Other  \r\n")).toEqual(["Plan", "x/Other"]);
  });
  it("ignores a line with brackets but no link", () => {
    expect(linkpathsInText("call (555) [later]")).toEqual([]);
  });
});
