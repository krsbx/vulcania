import { resolve } from "node:path";
import { type InlineConfig, build as tsdown } from "tsdown";
import { createRequirePlugin, lazyLoadFfiPlugin } from "../plugins/index.ts";

export async function build(
  source: string,
  options: InlineConfig = {}
): Promise<void> {
  await tsdown({
    entry: [
      resolve(source, "src/**/*.ts"),
      `!${resolve(source, "src/**/*.d.ts")}`,
    ],
    deps: { neverBundle: ["bun", "bun:ffi", "node:ffi"] },
    format: ["cjs"],
    outDir: "dist/cjs",
    // `.js` (not `.mjs`) — packages are `type: module`.
    fixedExtension: false,
    minify: false,
    treeshake: true,
    sourcemap: false,
    clean: true,
    dts: false,
    plugins: [lazyLoadFfiPlugin, createRequirePlugin],
    ...options,
  });
}
