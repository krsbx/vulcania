import { build } from "@vulcania/build";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

await build(__dirname, {
  buildEsm: true,
  buildCjs: true,
});
