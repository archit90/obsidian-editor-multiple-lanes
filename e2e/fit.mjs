// node e2e/fit.mjs: the sandbox window back to its size (config.mjs WINDOW), e.g. after a phone-sized case stopped
import { WINDOW } from "./config.mjs";
import { open, resize } from "./lib.mjs";

const c = await open();
console.log(await resize(c, WINDOW.width, WINDOW.height));
c.close();
