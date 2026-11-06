import { App, ButtonComponent, Modal, TextComponent } from "obsidian";
import type EditorLanesPlugin from "./main";
import type { LanesView } from "./lanes-view";
import { LayoutColumn, PRESETS, describeLayout, laneCount, parseLayout } from "./layout";

/** Little boxes showing the columns (to scale) and the lanes stacked in each. */
export function drawPreview(el: HTMLElement, columns: readonly LayoutColumn[]) {
  for (const c of columns) {
    const col = el.createDiv({ cls: "lane-layout-col" });
    col.style.flexGrow = String(c.width);
    for (let r = 0; r < c.rows; r++) col.createDiv({ cls: "lane-layout-cell" });
  }
}

/**
 * "Lane layout…" for one lanes tab (its ⋯ menu, its tab header's menu, a lane's menu, the command): the layout
 * syntax with a live summary and preview, presets, and "Use default from settings". With the default in the
 * settings, the only place a tab's layout changes.
 */
export class LayoutModal extends Modal {
  constructor(
    app: App,
    private plugin: EditorLanesPlugin,
    private tab: LanesView,
  ) {
    super(app);
  }

  override onOpen() {
    const { contentEl } = this;
    this.titleEl.setText("Lane layout of this tab");
    const info = this.tab.layoutInfo();
    const def = this.plugin.settings.defaultLayout;
    contentEl.createEl("p", {
      cls: "lane-layout-hint",
      text: info.own
        ? `This tab has its own layout. The default from the settings is "${def}".`
        : `This tab follows the default from the settings ("${def}"). A layout set here is this tab's own; it stays when the default changes.`,
    });
    contentEl.createEl("p", {
      cls: "lane-layout-hint",
      text: "Columns from left to right as relative widths, separated by commas; add x and a number to stack lanes in a column. 40, 30x2, 30 is three columns with two lanes stacked in the middle one.",
    });

    const row = contentEl.createDiv({ cls: "lane-layout-input" });
    const input = new TextComponent(row);
    let apply: ButtonComponent | null = null;
    const summary = contentEl.createDiv({ cls: "lane-layout-summary" });
    const preview = contentEl.createDiv({ cls: "lane-layout-preview", attr: { "aria-hidden": "true" } });
    const warn = contentEl.createDiv({ cls: "lane-layout-summary" });
    const show = (text: string) => {
      const p = parseLayout(text);
      summary.toggleClass("lane-setting-error", !p.ok);
      input.inputEl.toggleClass("lane-setting-invalid", !p.ok);
      input.inputEl.setAttr("aria-invalid", String(!p.ok));
      preview.empty();
      warn.setText("");
      apply?.setDisabled(!p.ok);
      if (!p.ok) {
        summary.setText(p.error);
        return;
      }
      summary.setText(describeLayout(p.columns));
      drawPreview(preview, p.columns);
      const n = laneCount(p.columns);
      const moved = this.tab.lanes.slice(n).reduce((s, l) => s + l.items.length, 0);
      if (moved) {
        warn.setText(
          `${this.tab.lanes.length - n} lane${this.tab.lanes.length - n === 1 ? "" : "s"} will go; their ${moved} note${moved === 1 ? " moves" : "s move"} into the remaining lanes.`,
        );
      }
    };

    input.setPlaceholder("50, 50");
    input.setValue(info.text);
    input.onChange(show);
    input.inputEl.addEventListener("keydown", e => {
      if (e.key === "Enter" && parseLayout(input.getValue()).ok) {
        e.preventDefault();
        void this.done(input.getValue());
      }
    });

    const presets = contentEl.createDiv({ cls: "lane-layout-presets" });
    for (const p of PRESETS) {
      new ButtonComponent(presets).setButtonText(p.name).onClick(() => {
        input.setValue(p.layout);
        show(p.layout);
        input.inputEl.focus();
      });
    }

    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    new ButtonComponent(buttons)
      .setButtonText("Use default from settings")
      .setDisabled(!info.own)
      .onClick(() => void this.done(null));
    new ButtonComponent(buttons).setButtonText("Cancel").onClick(() => this.close());
    apply = new ButtonComponent(buttons)
      .setButtonText("Apply")
      .setCta()
      .onClick(() => void this.done(input.getValue()));
    show(info.text);
    window.setTimeout(() => input.inputEl.select(), 0);
  }

  private async done(text: string | null) {
    if (text !== null && !parseLayout(text).ok) return;
    this.close();
    await this.tab.setLayout(text);
  }

  override onClose() {
    this.contentEl.empty();
  }
}
