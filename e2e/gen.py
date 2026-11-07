import json, re, sys, datetime
cases = open('cases.txt').read()
# replacements / additions to the drafted catalogue
repl = {
 "CD-17": "CD-17 | Drag a card header onto a normal tab's editor (an excepted note open beside the lanes tab) | Inserts a link like a dragged file; the card stays in its lane. (Over another card's text in a lane the card moves there: the lane takes card drags in the capture phase.) | Dragging a card",
 "CD-18": "CD-18 | Drop onto a lane: a file from the explorer, at a drop point above a card, a search result, a Reading-view link, `[[link]]` + `obsidian://` URL text | Each opens at the drop point. (A tab header can't be dropped into a lane: Obsidian's own tab drag carries no file; see report) | Dropping onto a lane",
 "KL-03": "KL-03 | A lanes tab in a background tab that hasn't loaded yet isn't a routing target | Documented; after a restart, activating it loads it and an open made right then lands in it (LT-17 / CO-07) | Known limits",
 "KL-04": "KL-04 | (was: collapsing clears undo history) | Superseded by CD-26: Obsidian 1.15 keeps a note's undo history across its editors | Known limits (to correct)",
 "PF-04": "PF-04 | EL-19 | See group PK | Known/open item, now decided",
}
extra = """
CD-26 | Type in a card, collapse and expand it (right after typing), Ctrl+Z, Ctrl+Shift+Z | The remounted editor shows the typed text at once (the closing editor's save is awaited); undo / redo still work (Obsidian keeps a note's editor history) | common sense; corrects EL-22

## PK: Far-away cards unmounted (EL-19, decided by the user)
PK-01 | "Expand all" on a 120-note lane, wheel-scroll through it, wait, then scroll back up quickly | Mounted editors stay bounded (peak while flinging ≈ 35, settled 3); parking never moves what's on screen; parked cards are back before they show | EL-19
PK-02 | A long note with a selection (two lines) and a folded heading, parked (60 cards below, scrolled to the end, active card elsewhere, 7 s), then scrolled back | Parked (no leaf, body keeps its height); after remount the same selection, the same folds, the same mode, height released | EL-19
PK-03 | A parked and remounted card: Ctrl+F finds matches, a link click opens in the next lane | Works as in a never-parked card | EL-19
PK-04 | The active card scrolled far away (lane scrolled 80 000 px, 7 s) | Stays mounted and active (also: the focused card, one with unsaved changes or saving, an open search bar, a card being dragged) | EL-19
PK-05 | Editor Outliner Tab in a parked and remounted list note | Indents the item | EL-19
PK-06 | Mobile (emulated phone): 100 notes, scroll down and back up | Settled at 3 mounted; no parked card visible empty while scrolling back | EL-19, Mobile
PK-07 | Type in a card, park it, remount, Ctrl+Z | The typing is undone (undo history survives parking) | EL-19

## TY: Typing
TYPING | `npx eslint editor-lanes` clean (no-explicit-any and ban-ts-comment are errors), `npx vitest run test/typing.test.ts editor-lanes` passes, `tsc --noEmit` passes | One documented `any` remains (AnyFn, monkey-around wrappers) | coordinator requirement

## CO (addition)
CO-07 | Restart with a lanes tab in the background (a canvas tab active), activate it and immediately open a note into it; list markdown leaves | No detached (disconnected) card leaves; the open lands in the reloaded tab | Outliner agent's report; common sense
"""
lines = cases.splitlines()
out_lines = []
for l in lines:
    m = re.match(r'^([A-Z]+-\d+) \|', l)
    if m and m.group(1) in repl: l = repl[m.group(1)]
    out_lines.append(l)
cases = "\n".join(out_lines) + extra
res = json.load(open('results.json'))
manual = json.load(open('manual.json'))
fixed = json.load(open('fixed.json'))
md = []
for l in cases.splitlines():
    if l.startswith('## '):
        md.append(''); md.append(l); md.append(''); md.append('| ID | Case | Expected | Source | Status | Final-run evidence |'); md.append('|---|---|---|---|---|---|'); continue
    if ' | ' not in l: continue
    parts = [p.strip() for p in l.split(' | ')]
    cid = parts[0]; case, exp, src = (parts[1:] + ['','',''])[:3]
    if cid in manual: st, ev = manual[cid]
    elif cid in res: st, ev = ('PASS' if res[cid]['ok'] else 'FAIL'), (res[cid].get('note') or '')
    else: st, ev = 'NOT RUN', ''
    if cid in fixed and st == 'PASS': st = 'FAIL → fixed'
    ev = ev.replace('|','/').replace('\n',' ')
    if len(ev) > 260: ev = ev[:257] + '…'
    md.append(f'| {cid} | {case.replace("|","/")} | {exp.replace("|","/")} | {src} | **{st}** | {ev} |')
print("\n".join(md))
