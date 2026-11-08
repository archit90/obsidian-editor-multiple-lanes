// The e2e runner. In the plugin's folder:
//
//   npm run e2e -- <group> [id-regex]     e.g. npm run e2e -- ro "RO-0[1-5]"; a group is e2e/<group>.mjs
//   npm run e2e -- all                    every group (config.mjs GROUPS, then LATE_GROUPS, then the mobile ones)
//   npm run e2e -- mobile                 the mobile groups (emulated: tablet, then phone)
//
// A group exports `cases` = [{ id, needs?, allowErrs?, run: async c => ({ ok, note, allowErrs? }) }] and may
// export `before(c)` / `after(c)`, run around its cases (after also when one fails). `needs` lists the plugins a
// case tests together with Lanes: plugin ids, or `core:<id>` for a core plugin. Without them it's skipped
// (SKIP …), unless E2E_REQUIRE=<id>,<id> names one of them: then it fails. Before every case: the fixture notes
// are put back (fixtures.mjs), Lanes' settings reset and one empty lanes tab left (helpers.js T.reset). A case
// also fails on console errors (unless allowErrs) and on card leaves left detached. Results go to e2e/results.json
// (per id: status pass / fail / skip, note, time); the process exits 1 if a case failed.
import fs from "node:fs";
import path from "node:path";
import { GROUPS, HERE, LATE_GROUPS, MOBILE_GROUPS, PORT } from "./config.mjs";
import { coreNotes } from "./fixtures.mjs";
import { emulateMobile, open } from "./lib.mjs";

const arg = process.argv[2];
if (!arg) {
  console.error("usage: npm run e2e -- <group>|all|mobile [id-regex]");
  process.exit(2);
}
const groups =
  arg === "all"
    ? [...GROUPS, ...LATE_GROUPS, ...MOBILE_GROUPS]
    : arg === "mobile"
      ? MOBILE_GROUPS
      : [arg.replace(/\.mjs$/, "")];
const filt = process.argv[3] ? new RegExp(process.argv[3]) : null;
const required = new Set(
  (process.env.E2E_REQUIRE ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean),
);

const c = await open();
c.js = async body => c.ev(`(async()=>{${body}})()`);
const pageCode = ["hook.js", "helpers.js"].map(f => fs.readFileSync(path.join(HERE, f), "utf8"));
const fixtures = JSON.stringify(coreNotes());
c.prep = async () => {
  for (const code of pageCode) await c.ev(code);
  await c.ev(`window.__lanesFixtures = ${fixtures}; 1`);
};
await c.prep();
console.log(`sandbox on port ${PORT}; groups: ${groups.join(" ")}`);

const resFile = path.join(HERE, "results.json");
const res = fs.existsSync(resFile) ? JSON.parse(fs.readFileSync(resFile, "utf8")) : {};
const count = { pass: 0, fail: 0, skip: 0 };
const record = (id, status, note) => {
  count[status]++;
  res[id] = { status, ok: status === "pass", note, at: new Date().toISOString() };
  console.log(`${status.toUpperCase()} ${id} ${note ?? ""}`);
};

/** The `needs` of a case that aren't there: plugins not loaded, core plugins (`core:<id>`) not enabled. */
const missingNeeds = async needs => {
  if (!needs?.length) return [];
  const have = await c.js(
    `return ${JSON.stringify(needs)}.filter(id => id.startsWith("core:") ? !!app.internalPlugins.getEnabledPluginById(id.slice(5)) : !!app.plugins.plugins[id])`,
  );
  return needs.filter(id => !have.includes(id));
};

for (const g of groups) {
  const mod = await import(path.join(HERE, `${g}.mjs`));
  const cases = mod.cases.filter(cs => !filt || filt.test(cs.id));
  if (!cases.length) continue;
  // a group that isn't about mobile runs on the desktop (a mobile run that stopped half-way leaves emulation on)
  if (!MOBILE_GROUPS.includes(g) && (await emulateMobile(c, false))) await c.prep();
  try {
    if (mod.before) {
      try {
        await mod.before(c);
        await c.prep();
      } catch (e) {
        for (const cs of cases) record(cs.id, "fail", `EXC in the group's before: ${String(e?.message || e)}`);
        continue;
      }
    }
    for (const cs of cases) {
      const missing = await missingNeeds(cs.needs);
      if (missing.length) {
        const forced = missing.filter(id => required.has(id));
        if (forced.length) record(cs.id, "fail", `needs ${missing.join(", ")}: not enabled (E2E_REQUIRE)`);
        else record(cs.id, "skip", `(needs ${missing.join(", ")}: not enabled)`);
        continue;
      }
      let r;
      try {
        await c.unstick();
        await c.key("Escape");
        await c.prep();
        await c.js("await T.reset(); return 1");
        r = await cs.run(c);
      } catch (e) {
        r = { ok: false, note: "EXC " + String(e?.message || e).slice(0, 300) };
      }
      const dead = await c
        .js(
          `const P=T.P(); return app.workspace.getLeavesOfType("markdown").filter(l=>!l.containerEl.isConnected && (P.hostedLeaves.has(l) || l.containerEl.closest(".lane-split"))).map(l=>l.view.file?.path).concat([...P.hostedLeaves.keys()].filter(l=>!l.containerEl.isConnected).map(l=>"hosted:"+l.view.file?.path))`,
        )
        .catch(() => []);
      if (dead?.length) {
        r.ok = false;
        r.note = (r.note || "") + " | DETACHED LEAVES: " + JSON.stringify(dead);
      }
      const errs = await c.js("return window.__errs.filter(e=>!/ResizeObserver/.test(e))").catch(() => []);
      if (errs?.length && !cs.allowErrs && !r.allowErrs) {
        r.ok = false;
        r.note = (r.note || "") + " | console errors: " + JSON.stringify(errs).slice(0, 500);
      }
      record(cs.id, r.ok ? "pass" : "fail", r.note);
    }
  } finally {
    if (mod.after) {
      await c.prep().catch(() => 0);
      await mod.after(c).catch(e => console.log(`after ${g} failed: ${e?.message || e}`));
    }
  }
}

fs.writeFileSync(resFile, JSON.stringify(res, null, 1));
console.log(`\n${count.pass} passed, ${count.fail} failed, ${count.skip} skipped`);
c.close();
process.exit(count.fail ? 1 : 0);
