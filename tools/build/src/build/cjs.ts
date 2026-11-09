import { resolve } from "node:path";
import { type Options as BuildOptions, build as tsup } from "tsup";
import { fixCjsBuild } from "./fix";

export async function build(source: string, options: BuildOptions = {}) {
  await tsup({
    splitting: false,
    entry: [
      resolve(source, "src/**/*.ts"),
      `!${resolve(source, "src/**/*.d.ts")}`,
    ],
    external: ["bun", "bun:ffi", "node:ffi"],
    format: ["cjs"],
    outDir: "dist/cjs",
    minify: false,
    bundle: false,
    treeshake: true,
    sourcemap: false,
    clean: true,
    skipNodeModulesBundle: true,
    dts: false,
    legacyOutput: true,
    ...options,
  });

  fixCjsBuild(source);
}
