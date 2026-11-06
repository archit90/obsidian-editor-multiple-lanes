import { App, PluginSettingTab, Setting } from "obsidian";
import type EditorLanesPlugin from "./main";

export interface Settings {
  lanesOnly: boolean;
}
export const DEFAULTS: Settings = { lanesOnly: true };

export class LanesSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: EditorLanesPlugin,
  ) {
    super(app, plugin);
  }
  override display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("Editor lanes only")
      .setDesc(
        "Every note opened in the main area goes into a lane instead of a tab. A link clicked in a lane opens in the lane to its right. Off: notes open in normal tabs, and lanes are only filled by Shift-click, drag and drop, or the menus.",
      )
      .addToggle(t =>
        t.setValue(this.plugin.settings.lanesOnly).onChange(async v => {
          this.plugin.settings.lanesOnly = v;
          await this.plugin.saveData(this.plugin.settings);
          if (v) void this.plugin.sweepMainArea(true);
        }),
      );
  }
}
