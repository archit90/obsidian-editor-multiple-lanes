# Editor Multiple Lanes

An Obsidian plugin for Logseq-style **editor lanes**: tabs that hold side-by-side columns ("lanes") of
scrollable, fully editable notes ("cards"), so you can work on many notes in one tab.

## Features

- **Lanes tabs** with a layout you define: `50, 50` is two columns, `40, 30x2, 30` three columns with two
  stacked lanes in the middle. A default layout in settings, or one per tab; draggable dividers.
- **Cards** are real Obsidian editors (Live Preview, Source, Reading view) with a header to collapse, pin,
  rename, switch mode or close. Drag cards between lanes.
- **Where notes open:** optionally every note opens in a lane ("Editor lanes only", with exceptions); a link
  clicked in a lane opens in the next lane; Shift-click and menus for "Open in editor lane".
- **Tidy lanes:** accordion mode, a maximum number of notes per lane, auto-collapse.
- Lanes tabs are saved with the workspace, survive "Undo close tab" and Workspaces, and get a random name
  you can change.
- **Mobile:** phones show one lane at a time with swipe and dots; tablets show the desktop layout.

## Install with BRAT

1. Install **BRAT** (Obsidian42 - BRAT) from Community plugins.
2. BRAT → **Add beta plugin** → `archit90/obsidian-editor-multiple-lanes` → Add plugin.
3. Enable **Editor Multiple Lanes** in Community plugins.

## Notes

Works on its own. With the optional [Backlinks Full View](https://github.com/archit90/obsidian-backlinks-full-view)
plugin, cards show its backlinks panes under each note (setting: Show backlinks panes under lane notes).

Requires Obsidian 1.15 or later. Lanes depend on Obsidian internals that aren't public API (checked against
1.15.0), so a new Obsidian version may need an update.

## Building

```sh
npm install
npm run build                    # main.js
npm test                         # unit tests
npm run check                    # format, lint, typecheck, unit tests, build, smoke load: before every commit
npm run deploy -- <vault> …      # build and copy into vaults that have the plugin installed (--install adds it)
e2e/sandbox.sh reset 3 && npm run e2e -- all   # end-to-end tests in a throwaway Obsidian (see TEST-CASES.md)
```

Releasing: `npm run release` bumps the patch version only (0.1.1 → 0.1.2 …) in `package.json`, `manifest.json`
and `versions.json` and tags the commit with it; `git push --follow-tags` then runs the release workflow, which
checks, builds and publishes the GitHub release BRAT installs from. A new minor or major version is a deliberate
choice: `ALLOW_MINOR_BUMP=1 npm version minor`. End-to-end tests: see `TEST-CASES.md` and `SPEC.md`
(Development).

## Licence

MIT
