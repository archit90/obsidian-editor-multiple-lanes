# Editor Multiple Lanes: specification

This document describes the plugin as it is now; `README.md` is the user guide and `TEST-CASES.md` the test
catalogue. **Keeping this current:** every change updates this document in the same commit. There is no change
log: git history has the past, this document the present.

Plugin id `editor-multiple-lanes` (until 2026-11-08 `obsidian-editor-lanes`, display name Editor Lanes); repo `archit90/obsidian-editor-multiple-lanes`.

Logseq-style editor lanes: Obsidian tabs that hold side-by-side columns ("lanes") of scrollable, fully
editable notes ("cards").

## Lanes tabs and layouts

- **A lanes tab** (view type `editor-lanes`) is an ordinary Obsidian tab. It can be split, dragged, popped
  out, closed and restored with "Undo close tab" (with all its notes). Several lanes tabs are independent.
  Other views (canvas, PDF, graph, Bases…) open as ordinary tabs beside them.
- **Tab names:** "Editor lane <Name>", with a random short public-domain fictional name (Ariel, Puck,
  Merlin, Nemo, Quixote… 151 in all) that no other lanes tab in any window has; when all are taken,
  " II", " III"… is appended. "Rename lanes tab…" (tab ⋯ menu, tab-header menu, mobile tab switcher,
  command) sets a name (trimmed, 1–40 characters; a duplicate is allowed but noted) or a new random one.
- **Layout syntax:** columns left to right as relative widths separated by commas; `xN` stacks N lanes in
  a column. `40, 30x2, 30` is three columns with two stacked lanes in the middle. 1–8 columns, 1–6 lanes
  per column. Invalid text shows an error and isn't applied.
- **Default and per-tab layout:** every new lanes tab starts with Settings → "Default lane layout"
  (default `50, 50`) and follows it until it gets its own from its "Lane layout…" dialog (view-header
  button, ⋯ menu, tab-header menu, lane menu, command). The dialog has a live summary and preview,
  presets (1 lane, 2 columns, 3 columns, 2 × 2, 1 + 2 stacked, wide middle), "Use default from settings",
  and warns when lanes would go. Settings → "Reset every tab to the default" drops all per-tab layouts.
- **Changing a layout:** a shrinking layout moves the notes of removed lanes to the bottom of the kept
  lane at their position (wrapping round), pins kept on top, so nothing is lost; a growing one adds empty
  lanes. Lanes exist only through layouts: there are no per-lane add or remove buttons and no lane headers
  or numbers.
- **Sizes:** the dividers between columns and between stacked lanes can always be dragged (minimum 5%);
  double-click or ⋯ → "Reset lane sizes" resets them. Sizes are saved in the tab, for the layout they were
  made for.
- **Split right / down and "Open in new window"** on a lanes tab give an empty lanes tab with the same
  layout and sizes and a new name, not a copy of the notes. (With a card active, Obsidian doesn't offer its
  split commands: it treats cards as sidebar leaves.)
- **The lane menu** (right-click, or long-press, on a lane's background): Collapse all notes, Expand all
  notes, Close all notes, Lane layout….
- **Saved state** (in `workspace.json` and Workspaces): layout, sizes, name, and per lane its cards
  (path, collapsed, pinned, view mode, last-opened time). Loading is tolerant: saved lanes beyond the
  layout hand their notes to the kept lanes.

## Cards

- **A card** is a real Obsidian editor (a `WorkspaceLeaf` in a private split whose `parent` is the right
  sidebar; a patched `iterateLeaves` exposes these leaves), so Live Preview, Source mode, Reading view,
  hotkeys, the `[[` suggest and plugins work as in a tab. Backlinks Full View panes show under each card
  unless turned off.
- **Header:** collapse chevron; `folder/` (muted, cut from the left when long, optional) and the note name;
  the view-mode button; the pin button (always visible, accent colour when pinned); ✕. Size comfortable or
  compact.
- **Renaming:** clicking the name edits it (desktop); Enter or clicking away renames the file (links
  update), Escape cancels, ↓ moves into the note, paste inserts plain text. Refused with a notice: `\ / : #
^ [ ] | * " < > ?`, a leading dot, `.md`, a name taken in the folder, and, with "Keep a date-time prefix when
  renaming" on, a new name without a leading `YYYY-MM-DD-HHmmss` date-time for a note whose name starts with one
  (any folder). Ctrl/Cmd-click on the name opens the note in a new lanes tab. On touch, a tap toggles
  the card and "Rename note" in the card menu makes the name editable.
- **View mode** per card: the header button toggles Reading view and editing (back to the card's last
  editing kind); the card menu has Reading view, Live Preview and Source mode. A card without its own mode
  follows the vault defaults. Commands and hotkeys (Ctrl+E…) are picked up. Kept while collapsed or moved,
  and saved.
- **Collapsing** a card unmounts its editor; mode, cursor, selection and undo history come back on expand
  (Obsidian keeps a note's editor history). Expanded cards mount lazily as they come within "Pre-load
  distance" of the visible part of the lane.
- **Far-away cards:** an expanded card that has been more than three lane heights (and well beyond
  the pre-load distance) outside the visible part for 5 s is unmounted, keeping its height, mode, cursor,
  selection, folds and scroll; it mounts again within two lane heights, before it scrolls back into view.
  Never the active or focused card, one with unsaved changes or an open search, or one being dragged.
- **Pinning** keeps a card in a pinned block at the top of its lane: new notes go below it, it hides ✕,
  Ctrl+W does nothing on it, and Close all / Close others skip it. Saved with the tab.
- **Closing:** ✕ or Ctrl+W closes a card (no undo); closing a whole lanes tab can be undone.
- **Card menu** (right-click or long-press on the header): Open in next lane, Open in new lanes tab, Move to
  top, Move up / down, Move to previous / next lane, Reading view / Live Preview / Source mode, Pin, Rename
  note, Close, Close others, plus Obsidian's file menu (the card's items first).
- **Dragging a card** by its header reorders it in its lane or moves it to another lane, in this or another
  lanes tab (a line marks the drop point). The editor reopens with its mode, cursor and scroll; undo history
  isn't kept. If the target lane has the note already, that card moves to the drop point. Dropped anywhere
  else, it acts like a dragged file (onto an editor it inserts a link).
- **Dropping onto a lane** a file from the explorer, a search result, a Reading-view link, a selected
  `[[link]]` or `[text](note.md)`, or an `obsidian://` URL opens it at the drop point. Over a card's text the
  default is Obsidian's (insert a link); the "Dropping a note or link onto a note's text" setting can make it
  open in the lane instead.

## Where notes open

- **Editor lanes only** (on by default): every note opened in a main area of any window goes into a lane
  instead of its own tab, and an empty tab (Ctrl+T, "+", the last tab closed) becomes a lanes tab (after
  about 250 ms). A note tab that appears some other way is moved into the window's most recent lanes tab,
  or becomes one. Notes matching "Exceptions to lanes only" (one pattern per line: `folder/`, a path or name,
  `*` within a folder, `**` across folders, case-insensitive, `#` comments) open as normal tabs. With lanes
  only off, notes open in tabs and lanes are filled by Shift-click, drag and drop and the menus.
- **A link followed in a card** goes to the next lane of its tab (columns left to right, top to bottom in a
  column, wrapping from the last lane to the first; with one lane, the same lane). Setting: next lane, same
  lane, or the tab's last-used lane (the lane used last before the one the link is in).
- **Only a link followed in a card** (a click in Live Preview or Reading view, "Follow link under cursor", a link
  in another plugin's pane under the card: anything Obsidian opens through `workspace.openLinkText`) counts as
  coming from that card's lane. A new note, a template or a command that opens a note while the caret is in a
  card is an open from outside lanes.
- **Opens from outside lanes** (explorer, quick switcher, search, Shift-click) go to the last-used lane of
  the active lanes tab, else of the window's most recent lanes tab, else a new lanes tab. A click on a lane's
  background makes it the last-used lane. A new note (Ctrl/Cmd+N, the explorer's New note, Templater) goes
  there too, not to a new lanes tab. Shift-click on a link in a card (touch: the link's "Open in editor
  lane") goes to the lane used last before the card's.
- **"New" opens** (Ctrl/Cmd-click, middle-click, Open in new tab / window, split, Shift+Alt-click, "Open in
  new lanes tab") give a new lanes tab with the note in its first lane.
- **Never replaced:** an open never replaces a lanes tab or a card. A non-note file or an exception opened
  from a card opens in a new tab right after the lanes tab, never in place of another tab.
- **Note already open in another lane:** open another copy (default), jump to it, or move it here. Searches
  every lanes tab, the source's tab first.
- **Position and tidiness:** new notes go to the top below pinned notes (default), the bottom, or right
  after the card they came from. Optional: accordion mode (expanding a note collapses the lane's other
  unpinned notes), a maximum number of notes per lane (closes the least recently opened unpinned ones), and
  auto-collapse beyond N expanded notes.
- **Moving between windows:** "Move to new window" on a card moves it (pin included) into a new window's
  lanes tab.

## Native editor behaviour in cards

- **Active editor:** focusing anything in a card makes it the active leaf; a lanes tab that becomes active
  hands that to its last active (else first) card; and `workspace.getActiveViewOfType` answers with the
  tab's card. So commands that need an active editor (Templater's insert and cursor jump, editor
  commands, the status bar) work from a lanes tab.
- **In-note search** (Ctrl/Cmd+F, Ctrl/Cmd+H, editing and Reading view) is per card: its bar sticks under
  the card header while you're in that card, the lane scrolls to each match, replace changes only that
  note, and keys (Enter, Escape, F3…) go to the focused card's bar while other cards' bars stay open.
- **Scrolling:** heading and block links, Outline clicks and search matches scroll the lane (Reading view
  through a patch of its renderer). The caret is never hidden under the sticky header or search bar, and
  editor suggests follow the caret while the lane scrolls. History entries for another note open it in the
  lane after the card.
- **Works as normal:** folding, properties, embeds, callouts, tables, code blocks, math, mermaid, images,
  Page preview, context menus, spellcheck, pasting images, F2, delete / move / export of the active file,
  linked graph / outline / backlinks, readable line length, line numbers, the mobile toolbar.
- **Doesn't:** Vim's own scroll commands (Ctrl-E/Y/D/U, zt/zz/zb); Page Up / Down page by the window height.

## Mobile

- **Tablets** show the desktop layout; dividers are touch-draggable.
- **Phones** show one lane at a time: the lanes (in layout order) sit in a horizontal snap-scrolling row,
  with a row of dots and note counts above to switch. The lane swiped to is the current lane, and opening a
  note in a lane switches to it. A switch (a dot, a note opened in a lane) jumps there at once, not with a smooth
  scroll: the editor scrolling its cursor into view would cut the animation short and the snap would land on the
  lane before. Swiping past the first or last lane opens Obsidian's drawers.
- **Touch:** long-press a card header for its menu, or long-press and move to drag it; long-press a lane's
  background for the lane menu; the file menu's "Open in editor lane" / "Open in new lanes tab" replace
  Shift-click. Hit areas are 40–44 px and the pin is always shown.
- **Adapted for Obsidian mobile:** the lanes tab stays visible while a card is active, the explorer drawer
  closes when a note opens in a lane, phone spacing rules don't reach into cards, the tab title shows in the
  view header, the caret is scrolled into view when the keyboard opens, and popout actions give a new lanes
  tab (there are no popouts).
- **Testing on desktop:** `app.emulateMobile(true)` in the developer console (resize under 600 px for a
  phone), `app.emulateMobile(false)` to go back.

## Settings (defaults)

- Editor lanes only: on. Exceptions to lanes only: empty (applied when the field loses focus).
- **Opening notes:** link clicked in a lane opens in: next lane; new notes go: top; note already open in
  another lane: open another copy.
- **Lane layout:** default lane layout `50, 50` (applied only when valid and complete); reset every tab to
  the default; a note on lane sizes.
- **Keeping lanes tidy:** accordion mode off; maximum notes per lane 0 (no limit); auto-collapse after 0
  (off).
- **Looks:** show folder in note headers on; header size comfortable; note height grow to content (or cap
  at 600 px and scroll inside the card).
- **Renaming:** keep a date-time prefix when renaming on.
- **Performance:** show backlinks panes under lane notes on; pre-load distance 300 px (far-away cards also
  unload and reload, see Cards).
- **Drag and drop:** dropping a note or link onto a note's text: insert a link.
- Numbers are range-checked (an invalid value is outlined red and not saved). Saved settings load over the
  defaults; wrong types, out-of-range values and unknown keys (from older versions) are dropped.

## Commands

New lanes tab (also the ribbon) · Change lane layout of this tab… · Rename lanes tab… · Open current note in
an editor lane · Open current note in a new lanes tab · Open note in an editor lane… · Close all notes in the
current editor lane · Collapse all notes in the current editor lane · Pin or unpin the current note in its
editor lane · Move the current note to the next / previous editor lane · Toggle editor lanes only.

## Compatibility

- **Workspaces** (core plugin): saving and loading keep every lanes tab with its notes.
- Disabling and re-enabling the plugin brings every lanes tab back with its notes.
- **Old layouts:** the one-lane-per-tab view type `editor-lane` and the removed Navigator tab
  (`editor-lanes-navigator`) are registered as stubs that close those tabs without "plugin no longer
  active" placeholders; a window left without a lanes tab gets one. (Open item: kept while the author's vaults
  may still hold such tabs; to remove later.)
- **Obsidian internals check:** at load the plugin checks the internals it needs (the methods it patches or
  calls, and that a leaf in a private split can be made, reads as attached and comes out again). If one is
  missing it patches nothing, says so in one notice, notes open in normal tabs, and lanes tabs load as stubs that
  keep their saved state and list their notes.

## Known limits

- Ctrl+T shows Obsidian's empty tab for about 250 ms before it becomes a lanes tab.
- Cards flung past before they ever mounted show empty until they come within the pre-load distance.
- A layout change moves lane elements between columns; scroll positions inside lanes may reset.
- A lanes tab in a background tab that hasn't loaded yet isn't a routing target.
- A restored tab keeps its saved name even if another tab has taken it since.
- Code that does `await leaf.openFile(f); leaf.view…` on a leaf whose open was routed into a lane gets an
  empty leaf.
- Depends on internals not in the public API, checked in 1.15.0, among them: `iterateLeaves`, `openFile`,
  `getLeaf` / `getUnpinnedLeaf`, `createLeafBySplit`, `duplicateLeaf`, `moveLeafToPopout`,
  `rightSplit.collapse`, `getActiveViewOfType`, `updateMobileVisibleTabGroup`, `focusLeaf`, `revealLeaf`,
  `MarkdownView.editMode` / `previewMode.renderer`, `workspace.editorSuggest` and the keymap scope stack.

## Working with other plugins

Every pairing is optional and goes through the DOM or Obsidian's own API, never an import or a call into the
other plugin.

- **Backlinks Full View:** while "Show backlinks panes under lane notes" is off, every lanes tab's `.lanes-view`
  element carries `data-bfv-skip="editor-lanes"` (tabs made later and tabs in popouts too), and each change of
  the setting fires `layout-change`; BFV skips note views inside such an element. A Shift-clicked link inside an
  element with `data-bfv-path` is resolved from that note. A plain click on a link in a BFV pane under a card is a
  link followed in that card (BFV opens it with `workspace.openLinkText`). Card editors force their own bottom
  padding (none), which BFV keeps. Lanes never styles BFV's elements.
- **Card leaves** are ordinary markdown leaves: in `iterateAllLeaves` / `getLeavesOfType("markdown")`, inside the
  lanes tab's `.lanes-view` (and `.workspace-leaf-content[data-type="editor-lanes"]`); a view state set on them
  directly is picked up (mode button, saved mode). New notes from Templater or Editor Defaults (opened with
  `eState.rename`) go to the last-used lane, and the new card is the active editor at once. A caller that opens a
  note into a leaf and then sets that leaf's ephemeral state (Templater's "Create new note from template":
  `openFile`, then `setEphemeralState({rename: "all"})`) has it applied to the card the note went to, within 2 s:
  the card's title is selected to name it. Applied to the leaf it would act on the note still shown there (a rename
  prompt for the note you were in).
- **Test API for other plugins' test suites** (nothing else): the plugin instance's `settings.lanesOnly`,
  `settings.showBacklinks`, `settings.routeExceptions`, then `settingsChanged("routing")` /
  `settingsChanged("backlinks")` (not just `saveSettings`, which leaves `data-bfv-skip` stale); the view type
  `editor-lanes`; `.lanes-view`; a card found by `leaf.view.containerEl.closest(".lanes-view")`. Suites save these
  settings first and put them back in a `finally`.
- These contracts are tested here without the partners (TEST-CASES.md group CT: BF-01 to BF-05, API-01, CS-01,
  NN-01), and with them in the cases that `need` them.

## Development

- **Repository:** this folder is the whole repo. `package.json` (scripts and tool versions), `tsconfig.json`
  (strict, `noImplicitOverride`, `noUnusedLocals`), `eslint.config.mjs`, `.prettierrc`, `.editorconfig`,
  `.gitattributes`, `esbuild.config.mjs` (`src/main.ts` → `main.js`, not minified; `npm run dev` rebuilds on save
  with an inline source map) and `vitest.config.mts`. `main.js` is built, never committed.
- **`npm run check`:** format check, lint, typecheck, unit tests (vitest, including `test/typing.test.ts`), build,
  and a smoke load of the bundle (`test/smoke.cjs`, with stubs for `obsidian` and `@codemirror/language`). It must
  pass before a commit or a release; CI (`.github/workflows/ci.yml`) runs it on every push.
- **Typing:** no untyped code. `noImplicitAny` (strict) in TypeScript; ESLint fails any explicit `any` (tests
  included) and `@ts-ignore` / `@ts-nocheck` / an undescribed `@ts-expect-error`. Obsidian internals are typed
  in `src/types/*.d.ts` or taken as `unknown` and narrowed. An `any` that can't be avoided carries
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>`; `test/typing.test.ts` fails
  any `eslint-disable` without its rules and a reason after `--`.
- **Code layout:** source in `src/` modules, with the pure logic kept free of Obsidian imports so it can be
  unit-tested (`test/obsidian-stub.ts` stands in for `obsidian`). Patches of Obsidian methods use
  `monkey-around` and are registered with the plugin, so they come off on unload.
- **Timers:** debounced work uses `src/debounce.ts`, which runs on the main window's timers, never Obsidian's
  `debounce()`: that one puts its timer on the window active at the first call, and when that window closes
  first (a popout, or Settings, which the "Trust author" prompt opens on a vault's first open) the timer is
  lost and the debouncer never runs again. Seen 2026-11-08: Backlinks Full View built no panes until a restart.
- **Internals:** every Obsidian internal used was checked against Obsidian 1.15.0's `app.js` and `app.css`.
  `minAppVersion` is 1.15.0. A new Obsidian version means re-checking them.
- **Versions and releases:** the version is 0.1.0, and releases bump the patch version only (0.1.0 → 0.1.1 …);
  the minor and major stay. `npm run release` (= `npm version patch`) bumps `package.json`, then
  `scripts/version-bump.mjs` copies the version into `manifest.json` and `versions.json`; npm commits and tags it
  (tag = the version, no `v`, `.npmrc`). `scripts/version-bump.mjs` refuses a new minor or major version (and puts
  `package.json` back) unless it's asked for with `ALLOW_MINOR_BUMP=1 npm version minor|major`. `git push
--follow-tags` runs `.github/workflows/release.yml`: `npm run check`, a check that the tag is the manifest
  version, then a GitHub release with `main.js`, `manifest.json` and `styles.css`, which BRAT installs.
  `isDesktopOnly` is false.
- **Trying a build in a vault:** `npm run deploy -- <vault> …` (or `OBSIDIAN_VAULTS`) builds and copies `main.js`,
  `manifest.json` and `styles.css` into each vault that already has the plugin (`--install` adds it); `data.json`
  is never touched. Reload the plugin in Obsidian afterwards.
- **End-to-end tests:** `e2e/sandbox.sh start|stop|restart|reset|deploy|shot|status <n>` runs a throwaway Obsidian
  (`OBS_APP`, default the 1.15.0 AppImage) on its own Xvfb display `:110+n` (never on your screen), with its own
  profile, its own vault in `.sandbox/sb<n>/` (git-ignored) and the DevTools port `9310+n` (this plugin: sandbox 3).
  The vault is a fresh empty one with only this plugin, plus any built plugins in `OBS_PLUGINS` (folders or GitHub
  releases, separated by `:`) to test them together; or a copy of `OBS_VAULT`. Every start installs the current
  build. `e2e/make-vault.mjs` writes the suite's fixtures (`e2e/fixtures.mjs`) and the settings and core plugins it
  relies on before Obsidian starts; the runner puts the fixture notes back before every case. `npm run e2e --
<group>|all|mobile [id-regex]` runs the cases over the DevTools protocol (`e2e/cdp.mjs`, refusing any vault but a
  sandbox's) with real key and mouse input; `npm run e2e:restart` the restart cases. Cases that need another plugin
  say so (`needs`) and are skipped without it (`E2E_REQUIRE=<ids>` makes that a failure). Results:
  `e2e/results.json`. Needs Xvfb, rsync, curl, node and ImageMagick.

## Verification status

- **Confirmed in Obsidian by the user:** Templater from lanes tabs (Alt+N "Create new note from template", "Open
  insert template modal").
- **Decided by the user (2026-11-07):** expanded cards far off-screen are unmounted (Cards, Far-away cards); Ctrl/Cmd+N
  goes to the last-used lane; "last-used lane" for a link in a card means the lane used last other than the card's
  own.
- **Checked in a test Obsidian** (1.15.0 sandbox, real input over CDP; `TEST-CASES.md`, scripts in `e2e/`):
  2026-11-08, alone in a fresh empty vault (every group, mobile emulation on tablet and
  phone, and an Obsidian restart): 139 cases, 132 pass, 7 skipped (they need another plugin); MO-02 (a phone's
  lane switching landed one lane late) was fixed after that run and the mobile groups rerun clean. Together with
  Backlinks Full View, Editor Outliner, Templater and Calendar: the contract cases and every case that needs them
  pass (CO-04 and NE-20 after Backlinks Full View's debounce fix). Details: `TEST-CASES.md`, Runs.
- **Everything else** is built and unit-tested (`npm run check`), not confirmed by the user in Obsidian.
