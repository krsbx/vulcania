import type { InlineConfig } from "tsdown";
import { build as buildCjs } from "./cjs.ts";
import { build as buildEsm } from "./esm.ts";
import { build as buildTypes } from "./types.ts";

type BuildOptions = InlineConfig & {
  /**
   * Enable CJS build
   * @default false
   */
  buildCjs?: boolean;
  /**
   * Enable ESM build
   * @default true
   */
  buildEsm?: boolean;
  /**
   * Emit declarations once into `dist/types`, shared by ESM and CJS
   * @default true
   */
  buildTypes?: boolean;
};

export async function build(source: string, options: BuildOptions = {}) {
  const {
    buildCjs: cjs = false,
    buildEsm: esm = true,
    buildTypes: types = true,
    ...tsupOptions
  } = options;

  const builds: Promise<void>[] = [];

  if (cjs) {
    builds.push(buildCjs(source, tsupOptions));
  }

  if (esm) {
    builds.push(buildEsm(source, tsupOptions));
  }

  if (types) {
    builds.push(buildTypes(source));
  }

  await Promise.all(builds);

  process.exit();
}

export { buildCjs, buildEsm, buildTypes };
