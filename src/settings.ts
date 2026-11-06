import { App, PluginSettingTab, Setting, debounce } from "obsidian";
import type EditorLanesPlugin from "./main";
import { LIMITS, Settings, parseCount } from "./config";
import { drawPreview } from "./layout-modal";
import { describeLayout, parseLayout } from "./layout";

type NumberKey = keyof typeof LIMITS;
/** What has to be redone when a setting changes (see EditorLanesPlugin.settingsChanged). */
export type Refresh = "none" | "looks" | "layout" | "routing" | "backlinks";

export class LanesSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: EditorLanesPlugin,
  ) {
    super(app, plugin);
  }

  private get s(): Settings {
    return this.plugin.settings;
  }

  private async set<K extends keyof Settings>(key: K, value: Settings[K], refresh: Refresh) {
    this.s[key] = value;
    await this.plugin.settingsChanged(refresh);
  }

  private choice<K extends keyof Settings>(
    el: HTMLElement,
    key: K,
    name: string,
    desc: string,
    options: Record<string, string>,
    refresh: Refresh,
    after?: () => void,
  ) {
    return new Setting(el)
      .setName(name)
      .setDesc(desc)
      .addDropdown(d =>
        d
          .addOptions(options)
          .setValue(String(this.s[key]))
          .onChange(async v => {
            await this.set(key, v as Settings[K], refresh);
            after?.();
          }),
      );
  }

  private toggle<K extends keyof Settings>(el: HTMLElement, key: K, name: string, desc: string, refresh: Refresh) {
    return new Setting(el)
      .setName(name)
      .setDesc(desc)
      .addToggle(t => t.setValue(!!this.s[key]).onChange(v => this.set(key, v as Settings[K], refresh)));
  }

  /** A whole-number field: out-of-range or non-numeric input is flagged and not saved. */
  private number(el: HTMLElement, key: NumberKey, name: string, desc: string, refresh: Refresh) {
    const range = LIMITS[key];
    return new Setting(el)
      .setName(name)
      .setDesc(`${desc} (${range[0]}–${range[1]})`)
      .addText(t => {
        t.inputEl.type = "number";
        t.inputEl.min = String(range[0]);
        t.inputEl.max = String(range[1]);
        t.inputEl.addClass("lane-setting-number");
        t.setValue(String(this.s[key]));
        t.onChange(async v => {
          const n = parseCount(v, range);
          t.inputEl.toggleClass("lane-setting-invalid", n === null);
          t.inputEl.setAttr("aria-invalid", String(n === null));
          if (n !== null) await this.set(key, n, refresh);
        });
      });
  }

  override display() {
    const { containerEl: el } = this;
    el.empty();

    new Setting(el)
      .setName("Editor lanes only")
      .setDesc(
        "Every note opened in a main area (any window) goes into a lane of a lanes tab instead of its own tab, and an empty tab (Ctrl+T, +) becomes a lanes tab. Other views (canvas, PDF, graph…) and the exceptions below open as normal tabs. Off: notes open in normal tabs, and lanes are only filled by Shift-click, drag and drop, or the menus.",
      )
      .addToggle(t => t.setValue(this.s.lanesOnly).onChange(v => this.set("lanesOnly", v, "routing")));

    // ---------- Opening notes ----------
    new Setting(el).setName("Opening notes").setHeading();
    this.choice(
      el,
      "linkTarget",
      "Link clicked in a lane opens in",
      "Where a link followed inside a lane goes. Next lane: the next one in its tab (columns left to right, top to bottom within a column), from the last back to the first. Ctrl/Cmd-click, middle-click and Shift+Alt-click open a new lanes tab instead.",
      { next: "Next lane (sliding panes)", same: "Same lane", last: "Last-used lane of the tab" },
      "none",
    );
    this.choice(
      el,
      "newNotePosition",
      "New notes go",
      "Where a note added to a lane appears. Pinned notes always stay on top.",
      {
        top: "Top of the lane, below pinned notes",
        bottom: "Bottom of the lane",
        after: "Right after the note it was opened from",
      },
      "none",
    );
    this.choice(
      el,
      "duplicateMode",
      "Note already open in another lane",
      "What happens when you open a note that another lane (in any lanes tab) already shows.",
      { copy: "Open another copy here", jump: "Jump to it", move: "Move it here" },
      "none",
    );
    new Setting(el)
      .setName("Exceptions to lanes only")
      .setDesc(
        "Notes matching these open in normal tabs even with lanes only on (a link to one followed in a lane opens as a tab next to the lanes tab). One per line: a folder (Templates/), a note path or name, or a pattern like *.excalidraw.md (* stays in one folder, ** crosses folders).",
      )
      .addTextArea(t => {
        t.inputEl.rows = 4;
        t.inputEl.addClass("lane-setting-textarea");
        t.setPlaceholder("Templates/\n*.excalidraw.md");
        t.setValue(this.s.routeExceptions);
        t.onChange(v => this.set("routeExceptions", v, "routing"));
      });

    // ---------- Lane layout ----------
    new Setting(el).setName("Lane layout").setHeading();
    this.layoutSection(el);

    // ---------- Keeping lanes tidy ----------
    new Setting(el).setName("Keeping lanes tidy").setHeading();
    this.toggle(
      el,
      "accordion",
      "Accordion mode",
      "Opening or expanding a note collapses the other notes in its lane, except pinned ones.",
      "none",
    );
    this.number(
      el,
      "maxNotesPerLane",
      "Maximum notes per lane",
      "Adding a note beyond this closes the least recently opened note that isn't pinned. 0 = no limit",
      "none",
    );
    this.number(
      el,
      "autoCollapseAfter",
      "Auto-collapse after this many expanded",
      "With more notes expanded than this, the least recently opened ones (not pinned) collapse. 0 = off",
      "none",
    );

    // ---------- Looks ----------
    new Setting(el).setName("Looks").setHeading();
    this.toggle(el, "showFolder", "Show folder in note headers", "Show the note's folder before its name.", "looks");
    this.choice(
      el,
      "headerSize",
      "Header size",
      "How tall each note's header is.",
      { comfortable: "Comfortable", compact: "Compact" },
      "looks",
    );
    const widthPx = () =>
      this.number(el, "newLaneWidthPx", "Fixed new lane width", "Width in pixels for a new lane", "none");
    let widthSetting: Setting | null = null;
    this.choice(
      el,
      "newLaneWidth",
      "New lane width",
      "How wide a lane added to the left or right of another (lane header buttons, unlocked) starts out.",
      { equal: "Equal split", fixed: "Fixed width", copy: "Same as the current lane" },
      "none",
      () => widthSetting?.settingEl.toggle(this.s.newLaneWidth === "fixed"),
    );
    widthSetting = widthPx();
    widthSetting.settingEl.toggle(this.s.newLaneWidth === "fixed");
    let heightSetting: Setting | null = null;
    this.choice(
      el,
      "noteHeight",
      "Note height",
      "Grow each note to its full length, or cap it and scroll inside the note.",
      { grow: "Grow to content", cap: "Cap height" },
      "looks",
      () => heightSetting?.settingEl.toggle(this.s.noteHeight === "cap"),
    );
    heightSetting = this.number(el, "noteMaxHeight", "Maximum note height", "Height in pixels", "looks");
    heightSetting.settingEl.toggle(this.s.noteHeight === "cap");

    // ---------- Performance ----------
    new Setting(el).setName("Performance").setHeading();
    this.toggle(
      el,
      "showBacklinks",
      "Show backlinks panes under lane notes",
      "Off hides Backlinks Full View's panes in lanes, and that plugin skips the work for them.",
      "backlinks",
    );
    this.number(
      el,
      "preloadDistance",
      "Pre-load distance",
      "Expanded notes this many pixels outside the visible part of a lane are loaded ahead of time",
      "looks",
    );

    // ---------- Drag and drop ----------
    new Setting(el).setName("Drag and drop").setHeading();
    this.choice(
      el,
      "dropOnText",
      "Dropping a note or link onto a note's text",
      "Insert a link into the note (Obsidian's behaviour), or open the dropped note in the lane.",
      { insert: "Insert a link", open: "Open it in the lane" },
      "none",
    );
  }

  private layoutSection(el: HTMLElement) {
    el.createEl("p", {
      cls: "setting-item-description",
      text: 'All lanes of a lanes tab live in that one tab. Every new lanes tab, in any window, starts with the default layout below, and follows it when it changes. A tab can have its own layout instead: its ⋯ menu or tab menu → Lane layout… (or the command "Change lane layout of this tab…"); that\'s saved with the tab. When a layout has fewer lanes, the notes of the lanes that go move into the remaining ones.',
    });
    const def = new Setting(el)
      .setName("Default lane layout")
      .setDesc(
        "Columns from left to right, separated by commas, as relative widths. Add x and a number to stack lanes in a column: 40, 30x2, 30 is three columns with two lanes stacked in the middle one.",
      );
    const info = el.createDiv({ cls: "lane-layout-info" });
    const summary = info.createDiv({ cls: "lane-layout-summary" });
    const preview = info.createDiv({ cls: "lane-layout-preview", attr: { "aria-hidden": "true" } });
    const show = (text: string) => {
      const p = parseLayout(text);
      summary.toggleClass("lane-setting-error", !p.ok);
      preview.empty();
      if (!p.ok) {
        summary.setText(p.error);
        return false;
      }
      summary.setText(describeLayout(p.columns));
      drawPreview(preview, p.columns);
      return true;
    };
    const applySoon = debounce(() => void this.plugin.settingsChanged("layout"), 800, true);
    def.addText(t => {
      t.setPlaceholder("50, 50");
      t.setValue(this.s.defaultLayout);
      t.onChange(async v => {
        const ok = show(v);
        t.inputEl.toggleClass("lane-setting-invalid", !ok);
        t.inputEl.setAttr("aria-invalid", String(!ok));
        if (!ok) return;
        this.s.defaultLayout = v;
        await this.plugin.saveSettings();
        applySoon();
      });
    });
    show(this.s.defaultLayout);
    new Setting(el)
      .setName("Reset every tab to the default")
      .setDesc("Open lanes tabs that have their own layout go back to the default layout (notes are kept).")
      .addButton(b => b.setButtonText("Reset").onClick(() => void this.plugin.resetAllLayouts()));
    new Setting(el)
      .setName("Lock layout")
      .setDesc(
        "Inside lanes tabs, no ad-hoc changes: no buttons to add or remove lanes, and the dividers between lanes can't be dragged (each tab shows its layout's exact widths). Layouts then change only here (the default) or in a tab's Lane layout… dialog, which stays available. Tabs themselves stay normal: they can be opened, closed, split, dragged and moved to other windows. Off: drag the dividers to resize (double-click resets), and use the ←→↑↓ and × buttons in a lane's header to add or remove lanes; that gives the tab its own layout.",
      )
      .addToggle(t => t.setValue(this.s.lockLayout).onChange(v => this.set("lockLayout", v, "layout")));
  }
}
