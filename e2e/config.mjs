// Where the e2e suite finds its sandbox (e2e/sandbox.sh). OBS_SANDBOX is the sandbox number (default 3: this
// plugin's); CDP_PORT defaults to 9310 + that number (9313, as e2e/cdp.mjs). OBS_SANDBOX_DIR as in sandbox.sh.
import path from "node:path";
import { fileURLToPath } from "node:url";

/** This folder (e2e/) and the plugin's folder. */
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.dirname(HERE);
const port = process.env.CDP_PORT ? Number(process.env.CDP_PORT) : null;
/** The sandbox number: OBS_SANDBOX, else the one CDP_PORT belongs to, else 3. */
export const N = process.env.OBS_SANDBOX ? Number(process.env.OBS_SANDBOX) : port ? port - 9310 : 3;
export const PORT = port ?? 9310 + N;
/** Sandbox state, screenshots (absolute: ImageMagick's policy refuses paths with ../). */
export const SANDBOX_DIR = path.resolve(process.env.OBS_SANDBOX_DIR || path.join(ROOT, ".sandbox"));
export const SHOTS = path.join(SANDBOX_DIR, "shots");
export const SANDBOX_SH = path.join(HERE, "sandbox.sh");
/** The window size sandbox-init.mjs gives the sandbox (and fit.mjs puts back). */
export const WINDOW = { width: 1600, height: 1000 };
/** Every group, in the order `npm run e2e -- all` runs them; the mobile ones (emulated) come last. */
export const GROUPS = ["ct", "ro", "ro2", "ro3", "cd", "cd2", "cd3", "cd4", "ne", "ne2", "ne3", "lt", "pw", "se", "cm"];
export const LATE_GROUPS = ["co", "pk", "pf"];
export const MOBILE_GROUPS = ["mo", "pkm"];
