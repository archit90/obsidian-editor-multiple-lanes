// node e2e/unstick.mjs: cancel a drag (or a pressed mouse button) a stopped case left in the sandbox
import { open } from "./lib.mjs";
const c = await open();
await c.send("Input.setInterceptDrags", { enabled: false });
console.log(
  JSON.stringify(
    await c.send("Input.dispatchDragEvent", {
      type: "dragCancel",
      x: 10,
      y: 10,
      data: { items: [], dragOperationsMask: 1 },
    }),
  ),
);
await c.mouse("mouseReleased", 10, 10, { buttons: 0 });
await c.key("Escape");
c.close();
