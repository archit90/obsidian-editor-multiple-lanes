import { App, ButtonComponent, Modal, Platform, TextComponent } from "obsidian";
import type EditorLanesPlugin from "./main";
import type { LanesView } from "./lanes-view";
import { MAX_TAB_NAME, TAB_TITLE_PREFIX, tabNameError, tidyTabName } from "./tab-names";

/**
 * "Rename lanes tab…" (the tab's ⋯ menu, its tab-header menu, the mobile tab switcher's menu, a command): the
 * name after "Editor lane ", typed (non-empty, at most 40 characters, whitespace tidied) or a new random one.
 */
export class TabNameModal extends Modal {
  constructor(
    app: App,
    private plugin: EditorLanesPlugin,
    private tab: LanesView,
  ) {
    super(app);
  }

  override onOpen() {
    const { contentEl } = this;
    this.titleEl.setText("Rename lanes tab");
    contentEl.createEl("p", {
      cls: "lane-layout-hint",
      text: `The tab's title is "${TAB_TITLE_PREFIX}" followed by this name (at most ${MAX_TAB_NAME} characters).`,
    });
    const row = contentEl.createDiv({ cls: "lane-layout-input" });
    const input = new TextComponent(row);
    const msg = contentEl.createDiv({ cls: "lane-layout-summary" });
    let save: ButtonComponent | null = null;
    const show = (raw: string) => {
      const err = tabNameError(raw);
      input.inputEl.toggleClass("lane-setting-invalid", !!err);
      input.inputEl.setAttr("aria-invalid", String(!!err));
      msg.toggleClass("lane-setting-error", !!err);
      save?.setDisabled(!!err);
      if (err) msg.setText(err);
      else {
        const name = tidyTabName(raw);
        const clash = this.plugin.tabNameInUse(name, this.tab);
        msg.setText(`${TAB_TITLE_PREFIX}${name}${clash ? " (another lanes tab has this name too)" : ""}`);
      }
    };
    input.setValue(this.tab.tabName());
    input.inputEl.maxLength = MAX_TAB_NAME + 20; // room for spaces that are trimmed
    input.onChange(show);
    input.inputEl.addEventListener("keydown", e => {
      if (e.key === "Enter" && !tabNameError(input.getValue())) {
        e.preventDefault();
        this.done(input.getValue());
      }
    });

    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    new ButtonComponent(buttons).setButtonText("New random name").onClick(() => {
      const name = this.plugin.pickTabName(this.tab, [input.getValue(), this.tab.tabName()]);
      input.setValue(name);
      show(name);
    });
    new ButtonComponent(buttons).setButtonText("Cancel").onClick(() => this.close());
    save = new ButtonComponent(buttons)
      .setButtonText("Save")
      .setCta()
      .onClick(() => this.done(input.getValue()));
    show(input.getValue());
    // on a phone the keyboard would cover the buttons: no automatic focus there
    if (!Platform.isPhone) window.setTimeout(() => input.inputEl.select(), 0);
  }

  private done(raw: string) {
    if (tabNameError(raw)) return;
    this.close();
    this.tab.rename(tidyTabName(raw));
  }

  override onClose() {
    this.contentEl.empty();
  }
}
