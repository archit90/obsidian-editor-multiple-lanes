import { FuzzySuggestModal, TFile } from "obsidian";
import type EditorLanesPlugin from "./main";

export class NotePicker extends FuzzySuggestModal<TFile> {
  constructor(private plugin: EditorLanesPlugin) {
    super(plugin.app);
    this.setPlaceholder("Open a note in an editor lane…");
  }
  getItems() {
    return this.app.vault.getMarkdownFiles();
  }
  getItemText(f: TFile) {
    return f.path.replace(/\.md$/, "");
  }
  onChooseItem(f: TFile) {
    void this.plugin.openInLane(f, "last", null, { focus: true });
  }
}
