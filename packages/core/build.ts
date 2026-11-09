import { build } from "@vulcania/build";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

await build(__dirname, {
  buildEsm: true,
  buildCjs: true,
});
