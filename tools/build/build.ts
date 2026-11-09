import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./src/build";

globalThis.__filename = globalThis.__filename || fileURLToPath(import.meta.url);
globalThis.__dirname = globalThis.__dirname || dirname(globalThis.__filename);

await build(__dirname, {
  buildEsm: true,
  buildCjs: true,
});
