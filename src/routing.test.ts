import { describe, expect, it } from "vitest";
import { planOpen, whereFor } from "./routing";

const lane = { name: "lane 0" };
const card = { name: "card A" };
const intent = (link: boolean, paneType: unknown = false) => ({ from: lane, fromItem: card, link, paneType });

describe("planOpen", () => {
  it("a link followed in a card comes from its lane", () => {
    const p = planOpen({ host: null, intent: intent(true), creating: false });
    expect(p).toEqual({ from: lane, fromItem: card, wantNew: false });
    expect(whereFor(p, "next")).toBe("next");
    expect(whereFor(p, "same")).toBe("same");
  });
  it("Ctrl/Cmd+N typed in a card is a new note for the last-used lane, not a link", () => {
    const p = planOpen({ host: null, intent: intent(false, "tab"), creating: true });
    expect(p).toEqual({ from: null, fromItem: null, wantNew: false });
    expect(whereFor(p, "next")).toBe("last");
  });
  it("a hotkey or template open typed in a card is an open from outside the lanes", () => {
    const p = planOpen({ host: null, intent: intent(false), creating: false });
    expect(p.from).toBeNull();
    expect(whereFor(p, "next")).toBe("last");
  });
  it("a new note made by following a link to it is still a new note", () => {
    expect(planOpen({ host: null, intent: intent(true), creating: true }).from).toBeNull();
  });
  it("a new-tab open is a new lanes tab, a link or not", () => {
    for (const paneType of ["tab", true, "split", "window"]) {
      const p = planOpen({ host: null, intent: intent(true, paneType), creating: false });
      expect(p.wantNew).toBe(true);
      expect(whereFor(p, "next")).toBe("newTab");
    }
    expect(planOpen({ host: null, intent: intent(false, "tab"), creating: false }).wantNew).toBe(true);
  });
  it("an open aimed at a card's own leaf comes from that card's lane", () => {
    const p = planOpen({ host: { lane, item: card }, intent: null, creating: false });
    expect(p).toEqual({ from: lane, fromItem: card, wantNew: false });
  });
  it("an open with no recorded intent comes from outside the lanes", () => {
    expect(planOpen({ host: null, intent: null, creating: false })).toEqual({
      from: null,
      fromItem: null,
      wantNew: false,
    });
  });
});
