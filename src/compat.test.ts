import { describe, expect, it } from "vitest";
import { LEAF_METHODS, WORKSPACE_METHODS, missingMethods } from "./compat";

describe("missingMethods", () => {
  it("finds methods that are missing or not functions, own or inherited", () => {
    class Base {
      a() {}
    }
    class Sub extends Base {
      b() {}
    }
    const o = Object.assign(new Sub(), { c: 1 });
    expect(missingMethods(o, ["a", "b", "c", "d"])).toEqual(["c", "d"]);
  });
  it("an own property shadowing a method with undefined counts as missing", () => {
    const o = { m: undefined as unknown, n: () => 1 };
    expect(missingMethods(o, ["m", "n"])).toEqual(["m"]);
  });
  it("everything is missing on nothing", () => {
    expect(missingMethods(null, ["x"])).toEqual(["x"]);
    expect(missingMethods(undefined, WORKSPACE_METHODS)).toEqual([...WORKSPACE_METHODS]);
  });
  it("lists the internals Lanes patches", () => {
    expect(WORKSPACE_METHODS).toContain("iterateLeaves");
    expect(WORKSPACE_METHODS).toContain("pushUndoHistory");
    expect(LEAF_METHODS).toContain("openFile");
  });
});
