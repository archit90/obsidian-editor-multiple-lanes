import { open } from "./lib.mjs";
const c = await open();
console.log(await c.ev(`(async()=>{const r=require("electron").remote||require("@electron/remote"); r.getCurrentWindow().setBounds({x:0,y:0,width:1528,height:955}); await new Promise(r=>setTimeout(r,600)); return innerWidth+"x"+innerHeight})()`));
c.close();
