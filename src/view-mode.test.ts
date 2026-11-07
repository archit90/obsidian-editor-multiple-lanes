import { describe, expect, it } from "vitest";
import { isViewMode, modeOfState, ownViewChange, stateForMode, toggledState } from "./view-mode";

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

describe("ownViewChange", () => {
  const lp = JSON.stringify({ mode: "source", source: false });
  const rd = JSON.stringify({ mode: "preview" });
  it("records the mode a note without its own opens with, without saving it", () => {
    expect(ownViewChange(null, undefined, lp, true)).toEqual({ save: false, mounted: lp });
  });
  it("doesn't save before the mount has finished (a layout-change while the editor opens)", () => {
    expect(ownViewChange(null, undefined, lp, false)).toEqual({ save: false, mounted: undefined });
  });
  it("saves a change from the mode it opened with", () => {
    expect(ownViewChange(null, lp, rd, false)).toEqual({ save: true, mounted: lp });
    expect(ownViewChange(null, lp, lp, false).save).toBe(false);
  });
  it("saves a note's own mode only when it changes", () => {
    expect(ownViewChange(rd, undefined, rd, true).save).toBe(false);
    expect(ownViewChange(rd, undefined, lp, false).save).toBe(true);
  });
});
