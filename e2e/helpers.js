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
  T.defaults = async () => {
    const P = T.P();
    const keep = P.settings.defaultLayout;
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
      showBacklinks: true,
      preloadDistance: 300,
      dropOnText: "insert",
    });
    await P.settingsChanged("routing");
  };
  // one lanes tab, empty, default layout, in the main window
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
    const t = keep.view;
    if (t.layoutInfo().own) await t.setLayout(null);
    for (const l of t.lanes) for (const it of [...l.items]) l.close(it);
    t.sizes = null;
    app.workspace.setActiveLeaf(keep, { focus: true });
    window.__errs = [];
    await T.sleep(300);
    return T.roots();
  };
  T.st = () => ({ active: T.active(), lanes: T.lanes(), roots: T.roots(), errs: window.__errs });
  return "ok";
})();
