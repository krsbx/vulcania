import type { TsdownPlugin } from "tsdown";

// `\0` marks the id as virtual so other plugins and the resolver leave it be.
const prefix = "\0lazy-load-ffi:";

/**
 * Bundles that inline both FFI backends would hoist `import "bun:ffi"` and
 * `import "node:ffi"` into one file, which fails on whichever runtime lacks
 * the other. Swap them for `process.getBuiltinModule`, which returns
 * `undefined` instead of throwing; the unused backend is never initialized.
 */
export const lazyLoadFfiPlugin: TsdownPlugin = {
  name: "lazy-load-ffi",
  resolveId(source) {
    if (/^(bun|node):ffi$/.test(source)) {
      return prefix + source;
    }

    return null;
  },
  load(id) {
    if (!id.startsWith(prefix)) return null;

    const source = id.slice(prefix.length);

    return {
      code: `module.exports = process.getBuiltinModule(${JSON.stringify(source)}) ?? {};`,
    };
  },
};
