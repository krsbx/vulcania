import { type Plugin } from "esbuild";
import { readFile } from "node:fs/promises";

export const lazyLoadFfiPlugin = {
  name: "lazy-load-ffi",
  setup(build) {
    build.onResolve({ filter: /^(bun|node):ffi$/ }, (args) => ({
      path: args.path,
      namespace: "lazy-load-ffi",
    }));

    build.onLoad({ filter: /.*/, namespace: "lazy-load-ffi" }, (args) => ({
      contents: `module.exports = process.getBuiltinModule(${JSON.stringify(args.path)}) ?? {};`,
      loader: "js",
    }));
  },
} satisfies Plugin;

/**
 * The library loaders pick their backend lazily with
 * `const r = createRequire(import.meta.url); r("./bun.ts")`. esbuild can't
 * follow an aliased require, so the backends were never bundled and the
 * call looked for `./bun.ts` beside the bundle at runtime. Rewriting the
 * alias to a bare `require("./x")` lets esbuild bundle the target and
 * compile the call to a synchronous lazy initializer — the backend module
 * graph (defs tables, dlopen) still only evaluates on first access.
 */
const createRequirePattern =
  /const\s+(\w+)\s*=\s*createRequire\(\s*import\.meta\.url\s*\);?/;

export const bundleCreateRequirePlugin = {
  name: "bundle-create-require",
  setup(build) {
    build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async (args) => {
      // Skip create require on node_modules
      if (args.path.includes("/node_modules/")) return undefined;

      const source = await readFile(args.path, "utf8");
      const alias = createRequirePattern.exec(source)?.[1];

      if (!alias) return undefined;

      const contents = source
        .replace(createRequirePattern, "")
        .replace(new RegExp(`\\b${alias}\\(`, "g"), "require(");

      const loader = args.path.endsWith("x")
        ? args.path.endsWith(".tsx")
          ? "tsx"
          : "jsx"
        : /\.[cm]?ts$/.test(args.path)
          ? "ts"
          : "js";

      return { contents, loader };
    });
  },
} satisfies Plugin;
