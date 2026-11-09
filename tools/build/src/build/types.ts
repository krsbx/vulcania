import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);

// TS 7 native compiler (aliased as `@typescript/native` at the repo root).
const tscPkg = require.resolve("@typescript/native/package.json");
const tsc = resolve(dirname(tscPkg), require(tscPkg).bin.tsc);

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

/**
 * Emits declarations once into `dist/types`, shared by the ESM and CJS
 * outputs. Uses a throwaway tsconfig next to the package's own so `types`,
 * `extends`, and path settings resolve exactly as they do for type checking.
 */
export async function build(source: string, outDir: string = "dist/types") {
  const out = resolve(source, outDir);
  const tsconfig = resolve(source, "tsconfig.types.tmp.json");

  await rm(out, { recursive: true, force: true });

  await writeFile(
    tsconfig,
    JSON.stringify({
      extends: "./tsconfig.json",
      include: ["./src/**/*.ts"],
      exclude: ["./src/**/*.d.ts"],
      compilerOptions: {
        noEmit: false,
        declaration: true,
        emitDeclarationOnly: true,
        rootDir: "./src",
        outDir: out,
      },
    })
  );

  try {
    // `process.execPath` is whichever runtime is running the build.
    await run(process.execPath, [tsc, "-p", tsconfig], source);
  } finally {
    await rm(tsconfig, { force: true });
  }
}
