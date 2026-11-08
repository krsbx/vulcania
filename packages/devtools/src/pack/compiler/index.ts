import esbuild from "esbuild";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AppMetadata,
  LinuxMetadata,
  MacOSMetadata,
  WindowsMetadata,
} from "../types.ts";
import { bundleCreateRequirePlugin, lazyLoadFfiPlugin } from "./plugin.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const injectPath = resolve(__dirname, "../inject.ts");

export async function compileVulcania(
  entryPoint: string,
  outputDir: string,
  _metadata: AppMetadata | LinuxMetadata | MacOSMetadata | WindowsMetadata
): Promise<boolean> {
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  await esbuild.build({
    // Virtual entry: ESM evaluates imports in order, so inject.ts (library
    // path env vars) runs before anything in the app's module graph.
    stdin: {
      contents: [injectPath, resolve(entryPoint)]
        .map((path) => `import ${JSON.stringify(path)};`)
        .join("\n"),
      resolveDir: process.cwd(),
      sourcefile: "vulcania-entry.js",
      loader: "js",
    },
    bundle: true, // Combine all dependencies into one file
    outfile: resolve(outputDir, "bundle.js"), // Output file path
    platform: "node", // Target platform ('node' or 'browser')
    target: ["node26"], // JavaScript/Node version target
    format: "esm", // Output format ('esm', 'cjs', or 'iife')
    minify: true, // Optional: minify code
    sourcemap: true, // Optional: generate sourcemaps
    plugins: [lazyLoadFfiPlugin, bundleCreateRequirePlugin],
    external: [
      "bun:ffi",
      "node:ffi",
      "node:*", // Built-in Node modules (fs, path, process, etc.)
    ],
  });

  return true;
}
