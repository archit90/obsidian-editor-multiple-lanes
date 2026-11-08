import { describe, expect, it } from "vitest";
import { compileExceptions } from "./exceptions";

describe("compileExceptions", () => {
  it("matches nothing when empty or only comments", () => {
    expect(compileExceptions("")("a.md")).toBe(false);
    expect(compileExceptions("# a comment\n\n")("a.md")).toBe(false);
  });
  it("matches a folder prefix and its subfolders", () => {
    const m = compileExceptions("Templates/");
    expect(m("Templates/Daily.md")).toBe(true);
    expect(m("templates/x/y.md")).toBe(true);
    expect(m("Notes/Templates/x.md")).toBe(false);
    expect(m("Templates2/x.md")).toBe(false);
  });
  it("matches a folder or note path given without a slash at the end", () => {
    const m = compileExceptions("Archive/Old\nInbox/Todo");
    expect(m("Archive/Old/a.md")).toBe(true);
    expect(m("Inbox/Todo.md")).toBe(true);
    expect(m("Inbox/Todo list.md")).toBe(false);
  });
  it("matches a bare note name anywhere", () => {
    const m = compileExceptions("Dashboard");
    expect(m("Dashboard.md")).toBe(true);
    expect(m("x/y/dashboard.md")).toBe(true);
    expect(m("x/Dashboard 2.md")).toBe(false);
  });
  it("matches *.ext against the file name in any folder", () => {
    const m = compileExceptions("*.excalidraw.md");
    expect(m("Drawings/plan.excalidraw.md")).toBe(true);
    expect(m("plan.md")).toBe(false);
  });
  it("keeps * within one folder and lets ** cross folders", () => {
    expect(compileExceptions("Daily/*.md")("Daily/2026-11-06.md")).toBe(true);
    expect(compileExceptions("Daily/*.md")("Daily/old/2026.md")).toBe(false);
    expect(compileExceptions("Daily/**.md")("Daily/old/2026.md")).toBe(true);
    expect(compileExceptions("**/kanban*")("a/b/Kanban board.md")).toBe(true);
    expect(compileExceptions("**/kanban*")("Kanban board.md")).toBe(true);
  });
  it("treats regex characters literally", () => {
    expect(compileExceptions("(old)/")("(old)/a.md")).toBe(true);
    expect(compileExceptions("a+b.md")("a+b.md")).toBe(true);
    expect(compileExceptions("a+b.md")("aab.md")).toBe(false);
  });
});

describe("note names with dots", () => {
  it("matches a name or path whose last part looks like an extension", () => {
    const m = compileExceptions("notes/v1.2\nMeeting 2026.11.06");
    expect(m("notes/v1.2.md")).toBe(true);
    expect(m("x/Meeting 2026.11.06.md")).toBe(true);
    expect(m("notes/v1.3.md")).toBe(false);
  });
});
