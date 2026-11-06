import { describe, expect, it } from "vitest";
import { isViewMode, modeOfState, stateForMode, toggledState } from "./view-mode";

describe("modeOfState", () => {
  it("reads Obsidian's mode / source fields", () => {
    expect(modeOfState({ mode: "preview", source: true })).toBe("reading");
    expect(modeOfState({ mode: "source", source: true })).toBe("source");
    expect(modeOfState({ mode: "source", source: false })).toBe("live");
  });
  it("fills missing fields from the vault's defaults", () => {
    expect(modeOfState({})).toBe("live");
    expect(modeOfState(undefined, { defaultViewMode: "preview" })).toBe("reading");
    expect(modeOfState({ mode: "source" }, { livePreview: false })).toBe("source");
    expect(modeOfState({ source: true }, { defaultViewMode: "preview" })).toBe("reading");
  });
});

describe("stateForMode / toggledState", () => {
  it("round-trips every mode", () => {
    for (const m of ["reading", "live", "source"] as const) expect(modeOfState(stateForMode(m))).toBe(m);
  });
  it("leaves the editing kind alone for Reading view", () => {
    expect(stateForMode("reading")).toEqual({ mode: "preview" });
    expect(modeOfState({ ...{ mode: "source", source: true }, ...stateForMode("reading") })).toBe("reading");
  });
  it("toggles between Reading view and editing", () => {
    expect(toggledState({ mode: "preview" })).toEqual({ mode: "source" });
    expect(toggledState({ mode: "source", source: true })).toEqual({ mode: "preview" });
    expect(toggledState({}, { defaultViewMode: "preview" })).toEqual({ mode: "source" });
  });
  it("validates saved modes", () => {
    expect(isViewMode("live")).toBe(true);
    expect(isViewMode("preview")).toBe(false);
    expect(isViewMode(undefined)).toBe(false);
  });
});
