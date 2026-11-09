import { existsSync, statSync } from "node:fs";
import path from "node:path";
import type { Options as BuildOptions } from "tsup";

export type EsBuildPlugin = Required<BuildOptions>["esbuildPlugins"][number];

function isFile(p: string): boolean {
  return existsSync(p) && statSync(p).isFile();
}

/**
 * Rewrites relative imports so the emitted output points at real files:
 * - `./foo`        -> `./foo.js`        (when `./foo.ts` exists)
 * - `./foo`        -> `./foo/index.js`  (when `./foo/index.ts` exists)
 * - `./foo.ts`     -> `./foo.js`
 * - `./foo.js`     -> left as-is        (when `./foo.ts` exists)
 * Non-relative (package) imports and anything that doesn't map to a source
 * file are left to esbuild's default resolution.
 */
export function addExtension(
  extension: string = ".js",
  fileExtension: string = ".ts"
): EsBuildPlugin {
  return {
    name: "add-extension",
    setup(build) {
      build.onResolve({ filter: /^\.\.?(\/|$)/ }, (args) => {
        if (!args.importer) return;

        const spec = args.path.replace(/\/+$/, "");
        const abs = path.join(args.resolveDir, spec);

        // Import already includes the source extension: swap it.
        if (spec.endsWith(fileExtension) && isFile(abs)) {
          return {
            path: spec.slice(0, -fileExtension.length) + extension,
            external: true,
          };
        }

        // Import already includes the output extension and maps to a source file.
        if (
          spec.endsWith(extension) &&
          isFile(abs.slice(0, -extension.length) + fileExtension)
        ) {
          return { path: spec, external: true };
        }

        // Extensionless file import.
        if (isFile(abs + fileExtension)) {
          return { path: spec + extension, external: true };
        }

        // Directory import resolving to an index file.
        if (isFile(path.join(abs, `index${fileExtension}`))) {
          return { path: `${spec}/index${extension}`, external: true };
        }
      });
    },
  };
}
