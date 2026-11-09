import { resolve } from "node:path";
import { type Options as BuildOptions, build as tsup } from "tsup";

export async function build(source: string, options: BuildOptions = {}) {
  return tsup({
    splitting: false,
    entry: [
      resolve(source, "src/**/*.ts"),
      `!${resolve(source, "src/**/*.d.ts")}`,
    ],
    external: ["bun", "bun:ffi", "node:ffi"],
    format: ["esm"],
    outDir: "dist/esm",
    minify: false,
    bundle: true,
    treeshake: true,
    sourcemap: false,
    clean: true,
    skipNodeModulesBundle: true,
    dts: false,
    esbuildPlugins: [],
    ...options,
  });
}
