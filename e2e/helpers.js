// Evaluated in the sandbox's Obsidian before every case (run.mjs): the `T` helpers the cases use.
// window.__lanesFixtures (path → content, from fixtures.mjs coreNotes) is set by the runner first.
(() => {
  const T = (window.T = {});
  T.P = () => app.plugins.plugins["editor-multiple-lanes"];
  T.f = p => app.vault.getFileByPath(p);
  T.sleep = ms => new Promise(r => setTimeout(r, ms));
  T.tabs = () => T.P().allTabs();
  T.tab = () => T.P().currentTab() || T.tabs()[0];
  T.lanes = (t = T.tab()) =>
    t.lanes.map(l => l.items.map(i => (i.pinned ? "P:" : "") + (i.collapsed ? "C:" : "") + i.file.basename));
  T.active = () => {
    const l = app.workspace.activeLeaf;
    const h = T.P().hostedLeaves.get(l);
    return h
      ? "card:" + h.item.file.basename + "@" + h.lane.tab.lanes.indexOf(h.lane)
      : l?.view?.getViewType() + ":" + (l?.view?.file?.path || "");
  };
  T.roots = () => {
    const a = [];
    app.workspace.iterateAllLeaves(l => {
      if (T.P().hostedLeaves.has(l)) return;
      const r = l.getRoot();
      if (r === app.workspace.leftSplit || r === app.workspace.rightSplit) return;
      a.push(l.getViewState().type + ":" + (l.getViewState().state?.file || l.view?.tabName?.() || ""));
    });
    return a;
  };
  // a note with this text: created (with its folders) or overwritten
  T.note = async (path, text) => {
    const f = T.f(path);
    if (f) {
      if ((await app.vault.read(f)) !== text) await app.vault.modify(f, text);
      return f;
    }
    const dir = path.split("/").slice(0, -1).join("/");
    if (dir && !app.vault.getAbstractFileByPath(dir)) await app.vault.createFolder(dir).catch(() => 0);
    return app.vault.create(path, text);
  };
  // the fixture notes as fixtures.mjs makes them (a case before may have edited, renamed or deleted one)
  T.restoreFixtures = async () => {
    const fx = window.__lanesFixtures || {};
    let n = 0;
    for (const [path, text] of Object.entries(fx)) {
      const f = T.f(path);
      if (!f || (await app.vault.read(f)) !== text) {
        await T.note(path, text);
        n++;
      }
    }
    return n;
  };
  T.defaults = async () => {
    const P = T.P();
    Object.assign(P.settings, {
      lanesOnly: true,
      linkTarget: "next",
      newNotePosition: "top",
      duplicateMode: "copy",
      routeExceptions: "",
      defaultLayout: "50, 50,50",
      accordion: false,
      maxNotesPerLane: 0,
      autoCollapseAfter: 0,
      showFolder: true,
      headerSize: "comfortable",
      noteHeight: "grow",
      noteMaxHeight: 600,
      keepStampPrefix: true,
      showBacklinks: true,
      preloadDistance: 300,
      dropOnText: "insert",
    });
    await P.settingsChanged("all");
  };
  // one lanes tab, empty, default layout, in the main window; the fixture notes as they were
  T.reset = async () => {
    await T.defaults();
    for (const w of app.workspace.floatingSplit.children.slice()) {
      try {
        w.win?.close();
      } catch {}
    }
    await T.sleep(200);
    const leaves = [];
    app.workspace.iterateRootLeaves(l => {
      leaves.push(l);
    });
    let keep = leaves.find(l => l.view?.getViewType() === "editor-lanes");
    if (!keep) {
      await T.P().newLanesTab();
      keep = app.workspace.getLeavesOfType("editor-lanes").find(l => T.P().inMainArea(l));
    }
    for (const l of leaves)
      if (l !== keep) {
        try {
          T.P().detachQuietly(l);
        } catch {}
      }
    if (!keep) {
      await T.P().newLanesTab();
      keep = app.workspace.getLeavesOfType("editor-lanes")[0];
    }
    // after a reload (mobile emulation, the plugin turned off and on) the tab can still be deferred: load it and
    // wait until it's a lanes view again
    await keep.loadIfDeferred?.();
    for (let i = 0; i < 50 && typeof keep.view?.layoutInfo !== "function"; i++) await T.sleep(100);
    const t = keep.view;
    if (t.layoutInfo().own) await t.setLayout(null);
    for (const l of t.lanes) for (const it of [...l.items]) l.close(it);
    t.sizes = null;
    await T.restoreFixtures();
    app.workspace.setActiveLeaf(keep, { focus: true });
    window.__errs = [];
    await T.sleep(300);
    return T.roots();
  };
  T.st = () => ({
    active: T.active(),
    lanes: T.lanes(),
    roots: T.roots(),
    errs: (window.__errs || []).filter(e => !/ResizeObserver/.test(e)),
  });
  return "ok";
})();
