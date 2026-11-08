// node e2e/eval.mjs '<js expression>' (or e2e/e): evaluate an expression in the sandbox's Obsidian and print the
// result as JSON. Refuses an Obsidian whose vault isn't a sandbox's (cdp.mjs assertSandboxVault).
import { assertSandboxVault, connect } from "./cdp.mjs";
import { PORT } from "./config.mjs";

const c = await connect(PORT);
try {
  await assertSandboxVault(c);
  console.log(JSON.stringify(await c.ev(process.argv[2] ?? ""), null, 1));
} finally {
  c.close();
}
