// eslint-disable-next-line no-restricted-imports
import { build } from "@vulcania/build";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

globalThis.__filename = globalThis.__filename || fileURLToPath(import.meta.url);
globalThis.__dirname = globalThis.__dirname || dirname(globalThis.__filename);

await build(__dirname, {
  buildEsm: true,
  buildCjs: true,
});
