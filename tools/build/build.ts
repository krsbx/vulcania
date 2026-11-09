import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./src/build/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

await build(__dirname, {
  buildEsm: true,
  buildCjs: true,
});
