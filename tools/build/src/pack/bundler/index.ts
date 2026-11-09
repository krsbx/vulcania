import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as tsdown } from "tsdown";
import { virtualEntryPlugin } from "../../plugins/entry.ts";
import { createRequrePlugin, lazyLoadFfiPlugin } from "../../plugins/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const injectPath = resolve(__dirname, "./inject.ts");

const entryId = "vulcania-entry";

export async function bundle(
  entryPoint: string,
  outputDir: string
): Promise<void> {
  await tsdown({
    deps: { neverBundle: ["bun"] },
    entry: { bundle: entryId },
    plugins: [
      virtualEntryPlugin(entryId, [injectPath, resolve(entryPoint)]),
      lazyLoadFfiPlugin,
      createRequrePlugin,
    ],
    outDir: outputDir,
    outExtensions: () => ({ js: ".js" }),
    clean: false,
    dts: false,
    hash: false,
    format: "esm",
    platform: "node",
    target: ["node26"],
    sourcemap: false,
    minify: true,
    outputOptions: {
      codeSplitting: false,
    },
  });
}
